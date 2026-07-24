import { auth } from "@/auth";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { campaignErrorMessage, prepareCampaignDocument } from "@/lib/formato-campagna";

const MAX_BYTES = 4 * 1024 * 1024; // limite body Vercel ~4.5MB: immagini enormi → storage esterno in v2

// Lo stato di una campagna non va in nessuna cache condivisa: è privato, e una
// copia stantia riletta dal browser rimetterebbe in circolo una revisione vecchia.
const NO_STORE = { "Cache-Control": "private, no-store" };

async function owned(id: string, userId: string) {
  const [row] = await db.select().from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, userId)));
  return row ?? null;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  const row = await owned(id, session.user.id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  return NextResponse.json(row, { headers: NO_STORE });
}

/*
 * Scrittura condizionata alla revisione da cui il client è partito.
 *
 * Il controllo di proprietà e quello di attualità stanno nello STESSO `where`
 * dell'update: leggere prima e scrivere poi lascerebbe fra le due query una
 * finestra in cui un'altra scheda scrive, e l'ultimo arrivato sovrascriverebbe
 * in silenzio il lavoro dell'altro. Zero righe aggiornate è la risposta: o la
 * campagna non è tua, o il server è andato avanti. Le due si distinguono con una
 * lettura DOPO il tentativo, che non riapre nessuna finestra perché a quel punto
 * non c'è più niente da decidere.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });

  const text = await req.text();
  if (text.length > MAX_BYTES)
    return NextResponse.json(
      { error: "campagna troppo grande: sposta le immagini fuori dal JSON" },
      { status: 413, headers: NO_STORE },
    );

  let body: any;
  try { body = JSON.parse(text); } catch { return NextResponse.json({ error: "json non valido" }, { status: 400, headers: NO_STORE }); }
  const data = body.data;
  if (!data?.root || !Array.isArray(data.checklist) || !Array.isArray(data.players))
    return NextResponse.json({ error: "formato non valido" }, { status: 400, headers: NO_STORE });
  // Una PATCH senza revisione è una scrittura alla cieca: si rifiuta invece di
  // trattarla come 0, che significherebbe "sovrascrivi qualunque cosa ci sia".
  const baseRevision = body.baseRevision;
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 0)
    return NextResponse.json({ error: "baseRevision non valida" }, { status: 400, headers: NO_STORE });

  // Rigido in scrittura: nel JSONB entra solo ciò che passa il contratto, già
  // migrato alla versione corrente. Il rifiuto non perde lavoro — la copia
  // locale del client è stata scritta PRIMA della richiesta — e il 422 porta
  // il motivo, che il client mostra: senza, l'unico segnale sarebbe un
  // salvataggio che non avviene mai.
  const prepared = prepareCampaignDocument(data);
  if (!prepared.ok) {
    const status = prepared.error.code === "document_too_large" ? 413 : 422;
    return NextResponse.json({
      error: "invalid_document",
      detail: { ...prepared.error, message: campaignErrorMessage(prepared.error) },
    }, { status, headers: NO_STORE });
  }

  // Il titolo vuoto non ribattezza la campagna: senza rileggere la riga prima di
  // scrivere, il vecchio nome si conserva non toccando la colonna.
  const title = typeof data.root.title === "string" ? data.root.title.trim() : "";
  const [updated] = await db.update(campaigns)
    .set({
      data: prepared.value,
      ...(title ? { name: title.slice(0, 120) } : {}),
      updatedAt: new Date(),
      revision: sql`${campaigns.revision} + 1`,
    })
    .where(and(
      eq(campaigns.id, id),
      eq(campaigns.userId, session.user.id),
      eq(campaigns.revision, baseRevision),
    ))
    .returning({ revision: campaigns.revision, updatedAt: campaigns.updatedAt });

  if (updated) return NextResponse.json({ ok: true, ...updated }, { headers: NO_STORE });

  const current = await owned(id, session.user.id);
  if (!current)
    return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  // Il conflitto porta con sé la versione del server: il client deve poterla
  // mostrare accanto alla propria senza una seconda richiesta, che con la rete
  // che ha appena fallito è la parte meno affidabile del recupero.
  return NextResponse.json({
    error: "revision_conflict",
    revision: current.revision,
    updatedAt: current.updatedAt,
    data: current.data,
  }, { status: 409, headers: NO_STORE });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  const [deleted] = await db.delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.userId, session.user.id)))
    .returning({ id: campaigns.id });
  if (!deleted) return NextResponse.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

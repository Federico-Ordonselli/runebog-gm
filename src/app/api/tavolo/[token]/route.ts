import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { prepareCampaignDocument } from "@/lib/formato-campagna";
import { projectForPlayers } from "@/lib/share";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

// il link è segreto: che non finisca in nessuna cache condivisa lungo la strada
const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Lo stato del tavolo, per il polling dell'app. Sola lettura: qui non esiste una PATCH,
 * e non è una svista — è il modo in cui la sola lettura viene garantita. Nascondere i
 * pulsanti di modifica nell'interfaccia non impedirebbe a nessuno di chiamare l'API.
 *
 * Ogni 5 secondi, per ogni giocatore seduto al tavolo. Finché la risposta è stata
 * sempre un 200 con dentro il documento, quel ritmo si pagava tre volte: la
 * proiezione ricostruita da capo qui, il documento intero sul filo (una campagna
 * vicina al tetto di 4 MB fa 44 MB al minuto PER GIOCATORE), e due JSON.stringify
 * sul telefono di chi gioca per decidere se era cambiato qualcosa. Quasi sempre
 * non era cambiato niente: fra una battuta e l'altra il DM non scrive.
 *
 * L'ETag è `revision`, e non un hash del corpo: il contatore è già il modo in cui
 * questo repo dice "la copia da cui parti è ancora quella corrente" (vedi la PATCH
 * in api/campaigns/[id], che lo incrementa DENTRO la query che scrive `data`), e
 * un hash vorrebbe comunque proiettare tutto per poterlo calcolare — cioè
 * risparmierebbe la rete e non il server. Le rotte di condivisione toccano solo
 * `shareToken` e non la revisione: a un link rigenerato risponde il 404, che è la
 * risposta giusta.
 *
 * Il verso in cui si sbaglia: la revisione **cambia** anche quando il DM ha
 * scritto qualcosa che al tavolo non arriva (una nota sua), e allora esce un 200
 * con un documento identico a quello di prima. Lo spreco resta, e a coprirlo è il
 * confronto che il client fa già. Il contrario — una revisione ferma su un
 * documento cambiato — non può capitare, ed è l'unico caso che si vedrebbe come
 * un tavolo che smette di aggiornarsi.
 */

/**
 * Il confronto di `If-None-Match` è **debole**, cioè ignora il prefisso `W/` e
 * accetta l'elenco separato da virgole. Non è generosità: è ciò che la norma
 * chiede (RFC 9110 §13.1.2, "weak comparison"), e chiunque stia in mezzo ha il
 * permesso di indebolire un ETag forte. Un `===` sulla stringa intera legge
 * `W/"r5"` come diverso da `"r5"`, quindi risponde 200 per sempre: il polling
 * torna a scaricare tutto e nessuno se ne accorge, perché il tavolo funziona.
 * È l'unico guasto di questa rotta che non si vede.
 *
 * Misurato il 31 lug 2026 (`/themes.css` in produzione, con e senza brotli):
 * oggi l'edge di Vercel l'ETag lo lascia identico, quindi il caso non capita —
 * il confronto debole non serve a riparare qualcosa, serve a non dipendere da
 * quella misura. Qui costa niente: l'ETag *è* la revisione, e "stessa revisione
 * indebolita" vuol dire comunque stessa revisione.
 */
const stessaRevisione = (inviato: string | null, etag: string) =>
  !!inviato && inviato.split(",").some(v => v.trim().replace(/^W\//, "") === etag);

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db.select().from(campaigns).where(eq(campaigns.shareToken, token));
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const etag = `"r${row.revision}"`;
  if (stessaRevisione(req.headers.get("if-none-match"), etag))
    return new Response(null, { status: 304, headers: { ...NO_STORE, ETag: etag } });

  // Tollerante in lettura, come /tavolo/[token]: la normalizzazione è un
  // miglioramento quando riesce, mai un requisito — il polling dei giocatori
  // non deve rompersi per un documento che il contratto non riconosce.
  const prepared = prepareCampaignDocument(row.data);
  const state = projectForPlayers((prepared.ok ? prepared.value : row.data) as any);
  if (!state) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json(
    { name: row.name, state, updatedAt: row.updatedAt },
    { headers: { ...NO_STORE, ETag: etag } },
  );
}

import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { prepareCampaignDocument } from "@/lib/formato-campagna";
import { jsonForScript } from "@/lib/inline-json";
import { projectForPlayers } from "@/lib/share";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import path from "path";

/**
 * Il tavolo dei giocatori: la stessa app, senza login, in sola lettura, e con dentro
 * solo ciò che il DM ha rivelato. Serve `app.html` iniettando `window.__table` invece
 * di `window.__cloud` — l'app riconosce la differenza e si spoglia dei comandi da DM.
 */
export async function GET(_: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await db.select().from(campaigns).where(eq(campaigns.shareToken, token));
  if (!row) return new Response("Tavolo non trovato: il link è sbagliato o il DM l'ha chiuso.", { status: 404 });

  // Tollerante in lettura: il contratto normalizza quando riesce, ma un documento
  // che non lo passa (campagne mai risalvate, scritte prima del contratto) NON
  // spegne il tavolo — projectForPlayers è già difensivo campo per campo, e un
  // 422 qui chiuderebbe fuori i giocatori per un difetto che solo il DM può correggere.
  const prepared = prepareCampaignDocument(row.data);
  const state = projectForPlayers((prepared.ok ? prepared.value : row.data) as any);
  if (!state) return new Response("Tavolo non trovato.", { status: 404 });

  const html = await readFile(path.join(process.cwd(), "public", "app.html"), "utf8");
  // jsonForScript, non JSON.stringify: un titolo con "</script>" scritto dal DM
  // diventerebbe script eseguito nel browser dei giocatori.
  const bridge = `<script>window.__table = ${jsonForScript({
    token, name: row.name, state,
  })};</script>`;
  const out = html.replace("<script>", bridge + "\n<script>");

  return new Response(out, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      // il link è un segreto: non deve viaggiare nel Referer verso siti terzi
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

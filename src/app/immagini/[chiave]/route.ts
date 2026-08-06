import { db } from "@/db";
import { campaignImages } from "@/db/schema";
import { stessoEtag } from "@/lib/etag";
import { eq } from "drizzle-orm";

/*
 * Le immagini delle campagne, servite per chiave.
 *
 * **Questa rotta non controlla la sessione, ed è una scelta.** Ogni altra rotta
 * che tocca una campagna verifica che sia dell'utente autenticato; qui il
 * segreto è l'URL. Le ragioni, in ordine di peso:
 *
 * 1. È il modello di fiducia che il repo ha già scelto: `/tavolo/[token]` è un
 *    link segreto, non un'area autenticata. Chiedere a un'immagine una difesa
 *    più forte del tavolo che la contiene non protegge niente.
 * 2. L'URL di un'immagine NON condivisa non lascia mai il server:
 *    `projectForPlayers` ricostruisce la proiezione campo per campo, quindi ai
 *    giocatori arriva l'indirizzo solo di ciò che è `shared === true`. Da oggi
 *    quel filtro decide anche **chi può leggere un file**, non solo cosa si
 *    vede sulla tela: è una responsabilità in più su una funzione che ce
 *    l'aveva già.
 * 3. Dietro un'autorizzazione la risposta tornerebbe non memorizzabile in
 *    cache, e la cache **è** il guadagno per cui le immagini sono uscite dal
 *    JSON. Si sarebbe pagato lo schema senza incassare niente.
 *
 * Il rovescio, dichiarato: un URL uscito al tavolo resta valido anche dopo che
 * si rigenera `shareToken`. Rendere revocabili anche le figure vorrebbe dire
 * ri-chiavare ogni URL del documento a ogni rotazione.
 *
 * **Sta fuori da `/api` di proposito.** L'invariante della copia offline tiene
 * `/play`, `/tavolo` e `/api` fuori da ogni cache perché quelle risposte
 * **invecchiano**; una chiave immutabile no, per costruzione. Fuori da `/api`
 * la regola del service worker resta una riga sola e un domani la copia offline
 * potrà tenersi anche le figure.
 */

/* La chiave è un `crypto.randomUUID()`, ma il tetto e la classe si dichiarano
   qui invece di dedurli: questa stringa arriva dalla rete e finisce in una
   query. Deve restare almeno larga quanto la regola che `safeUrl` ammette nei
   documenti, sennò esistono URL che il contratto accetta e questa rotta non
   serve — un'immagine che sparisce senza che niente fallisca. */
const CHIAVE = /^[A-Za-z0-9_-]{1,64}$/;

/* Gli stessi tipi del contratto (`IMAGE_MIMES` in formato-campagna.js), e si
   controllano **in uscita** e non solo al caricamento: il `Content-Type` lo
   decide una riga di database, e una riga che dicesse `text/html` farebbe di
   questa rotta una XSS nell'origine del sito. Finché le immagini erano `data:`
   dentro il documento questa esposizione non esisteva: è nuova, e nasce
   dall'averle messe su un URL nostro. */
const MIME = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/svg+xml",
]);

/* Un anno, e `immutable`: la chiave è casuale e il contenuto non cambia mai:
   cambiare figura vuol dire una chiave nuova. È tutto il guadagno del lavoro —
   scaricata una volta invece che a ogni apertura dell'editor. */
const IMMUTABILE = "public, max-age=31536000, immutable";

/* `nosniff` perché il tipo lo dichiariamo noi e nessuno deve indovinarlo, e la
   CSP perché fra i tipi ammessi c'è `image/svg+xml`: un SVG dentro un `<img>`
   è inerte, ma **navigato direttamente** è un documento e può eseguire script.
   `default-src 'none'; sandbox` lo rende inerte anche lì, che è la difesa
   giusta — togliere l'SVG dai tipi ammessi cambierebbe il contratto per un
   problema che è di questa rotta. */
const DIFESE = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};

export async function GET(req: Request, { params }: { params: Promise<{ chiave: string }> }) {
  const { chiave } = await params;
  if (!CHIAVE.test(chiave)) return new Response(null, { status: 404 });

  const [row] = await db.select().from(campaignImages).where(eq(campaignImages.id, chiave));
  // Una chiave che non esiste non si mette in cache: la sola cosa immutabile
  // qui è ciò che c'è, non ciò che manca — un'immagine può ancora nascere.
  if (!row) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!MIME.has(row.mime)) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });

  /* L'ETag è la chiave, per la stessa ragione per cui l'ETag del tavolo è la
     revisione: è già il modo in cui questo dato dice qual è la sua versione, e
     un hash del corpo vorrebbe leggere i byte per poterlo calcolare — cioè
     risparmierebbe la rete e non il database. Con `immutable` il browser non
     rivalida quasi mai; questo copre il ricaricamento forzato. */
  const etag = `"${chiave}"`;
  if (stessoEtag(req.headers.get("if-none-match"), etag))
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": IMMUTABILE, ...DIFESE } });

  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mime,
      "Content-Length": String(row.bytes.length),
      "Cache-Control": IMMUTABILE,
      ETag: etag,
      ...DIFESE,
    },
  });
}

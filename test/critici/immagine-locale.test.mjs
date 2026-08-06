/*
 * `IMMAGINE_LOCALE`: la sola forma di URL **relativo** che entra in un
 * documento campagna (le immagini fuori dal JSON, 6 ago 2026).
 *
 * Sta fra i test critici e non fra quelli del formato perché qui non si decide
 * se un documento è ben formato: si decide **cosa il browser andrà a
 * chiedere**, con un valore che arriva da una campagna altrui e finisce dentro
 * l'attributo `src` di un `<img>` nell'origine del sito. Una regola troppo
 * larga qui è una richiesta verso un host che non è il nostro, o un percorso
 * che risale.
 *
 * I tre posti che la usano — il contratto, `safeUrl` in `modello.js` e
 * `safeUrl` in `share.ts` — condividono **una sola** definizione, e questo test
 * lo impone: due copie che si allontanano darebbero un client che accetta ciò
 * che il server rifiuta, cioè un 422 su una campagna legittima.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "./_repo.mjs";

const { IMMAGINE_LOCALE, prepareCampaignDocument } =
  await import(repoUrl("public/app/formato-campagna.js"));
const { sanitizeState } = await import(repoUrl("public/app/modello.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

const AMMESSI = [
  "/immagini/0f9c1e2a-1111-4222-8333-444455556666",   // la forma vera: un randomUUID
  "/immagini/a",
  "/immagini/" + "A".repeat(64),
  "/immagini/chiave_con-trattini_e_underscore",
];

/* Ogni riga è un modo diverso di uscire dal recinto, e nessuno di questi è
   teorico: sono le forme con cui un `src` relativo smette di puntare a noi. */
const RESPINTI = [
  ["//evil.example/x",                 "protocol-relative: il browser ci va davvero, su un altro host"],
  ["/immagini//evil.example/x",        "doppia barra dentro il percorso"],
  ["/immagini/../../etc/passwd",       "risalita del percorso"],
  ["/immagini/a/../b",                 "risalita in mezzo"],
  ["/immagini/a?x=1",                  "query: la chiave non è più tutta la chiave"],
  ["/immagini/a#f",                    "frammento"],
  ["/immagini/",                       "chiave vuota"],
  ["/immagini",                        "senza chiave"],
  ["/immagini/" + "A".repeat(65),      "oltre il tetto dichiarato"],
  [" /immagini/a",                     "spazio davanti"],
  ["/immagini/a ",                     "spazio dietro"],
  ["/Immagini/a",                      "percorso con la maiuscola: non è la rotta"],
  ["/immaginix/a",                     "prefisso simile"],
  ["x/immagini/a",                     "non ancorato a sinistra"],
  ["javascript:/immagini/a",           "schema ostile col percorso in coda"],
  ["/immagini/a\nx",                   "a capo dentro la chiave"],
];

test("IMMAGINE_LOCALE accetta le chiavi vere", () => {
  for (const url of AMMESSI)
    assert.ok(IMMAGINE_LOCALE.test(url), `doveva passare: ${url}`);
});

test("IMMAGINE_LOCALE respinge tutto ciò che esce dal recinto", () => {
  for (const [url, perche] of RESPINTI)
    assert.ok(!IMMAGINE_LOCALE.test(url), `doveva cadere (${perche}): ${JSON.stringify(url)}`);
});

/* La regex da sola non basta a dire che il documento è protetto: quello che
   conta è che i tre percorsi la applichino DAVVERO. Qui si guarda l'effetto. */

const documento = (img) => ({
  schemaVersion: 1,
  root: {
    id: "radice", title: "R", type: "zona", status: "", notes: "", playerNotes: "",
    img, shared: true, children: [], edges: [], x: null, y: null, shape: null,
  },
  checklist: [], players: [],
});

test("il contratto accetta una chiave locale e rifiuta una risalita", () => {
  assert.equal(prepareCampaignDocument(documento("/immagini/abc")).ok, true);

  const rotto = prepareCampaignDocument(documento("/immagini/../../etc/passwd"));
  assert.equal(rotto.ok, false, "una risalita non deve entrare nel JSONB");
  assert.equal(rotto.error.path, "$.root.img");
});

test("sanitizeState tiene la chiave locale e butta la risalita", () => {
  const buono = documento("/immagini/abc");
  sanitizeState(buono);
  assert.equal(buono.root.img, "/immagini/abc");

  const cattivo = documento("//evil.example/x.png");
  sanitizeState(cattivo);
  assert.equal(cattivo.root.img, null, "un host altrui non sopravvive alla bonifica");
});

test("la proiezione del tavolo si comporta allo stesso modo del client", () => {
  const proiettato = projectForPlayers(documento("/immagini/abc"));
  assert.equal(proiettato.root.img, "/immagini/abc");

  const ostile = projectForPlayers(documento("/immagini/a/../b"));
  assert.equal(ostile.root.img, null,
    "se il server accettasse ciò che il client rifiuta, i due elenchi sarebbero già divergenti");
});

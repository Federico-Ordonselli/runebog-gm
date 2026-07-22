/* Controlla un capitolo generato da estrai-srd-regole.mjs contro il PDF sorgente.
 *
 *   node scripts/verifica-srd-regole.mjs <PDF> <id-capitolo>
 *
 * Esiste perché la sezione regole cresce un capitolo alla volta e ogni capitolo
 * si pubblica (`pronto: true` in src/lib/srd/index.ts) solo dopo che questi
 * controlli passano. I difetti di questo parser non si vedono a occhio: una
 * lettera persa lascia una parola plausibile, un titolo mancato lascia prosa in
 * grassetto, e un PDF riscaricato può cambiare la resa dei colori sotto i piedi.
 * Il confronto è con `pdftotext`, che estrae lo stesso PDF per un'altra strada:
 * se i due concordano sul numero di parole, non si è perso testo per il viaggio.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");

const [pdf, id] = process.argv.slice(2);
if (!pdf || !id) {
  console.error("uso: node scripts/verifica-srd-regole.mjs <PDF> <id-capitolo>");
  process.exit(1);
}

const cap = JSON.parse(readFileSync(join(RADICE, "src/lib/srd/capitoli", id + ".json"), "utf8"));

/* Tutto il testo del capitolo, qualunque forma abbia il blocco. */
const parole = (x, out = []) => {
  if (typeof x === "string") out.push(...x.split(/\s+/).filter(Boolean));
  else if (Array.isArray(x)) x.forEach((y) => parole(y, out));
  else if (x && typeof x === "object")
    for (const [k, y] of Object.entries(x)) if (k !== "t" && k !== "id") parole(y, out);
  return out;
};

const mie = parole(cap.blocchi);
const testo = mie.join(" ");

/* pdftotext sulle stesse pagine: il piè di pagina (numero e titolo corrente) è
   testo anche per lui, quindi la sua conta è per forza un po' più alta — a
   contare è che non manchi nulla dalla nostra parte, non la parità esatta. */
const grezzo = execFileSync("pdftotext", [
  "-f", String(cap.pagine[0]), "-l", String(cap.pagine[1]), pdf, "-",
]).toString();
const sue = grezzo.split(/\s+/).filter(Boolean).length;

const titoli = cap.blocchi.filter((b) => b.id);
const ancore = titoli.map((b) => b.id);
const doppie = ancore.filter((a, i) => ancore.indexOf(a) !== i);

const esiti = [];
const controlla = (ok, etichetta, dettaglio = "") =>
  esiti.push({ ok, etichetta, dettaglio });
/* Un avviso si stampa ma non fa fallire: segnala un difetto noto e tollerato,
   non una regressione. */
const avvisa = (ok, etichetta, dettaglio = "") =>
  esiti.push({ ok, etichetta, dettaglio, avviso: true });

controlla(mie.length >= sue * 0.95, "copertura del testo",
  `${mie.length} parole estratte su ${sue} di pdftotext (${(mie.length / sue * 100).toFixed(1)}%)`);

/* Zero titoli è il sintomo tipico del rosso non riconosciuto (vedi l'intestazione
   di estrai-srd-regole.mjs), e per un capitolo di regole è sempre un guasto. Non
   per le informazioni legali: lì l'unico titolo rosso è quello della pagina, che
   diventa il titolo del documento, e sotto non c'è che prosa. L'elenco è
   dichiarato qui — se un domani ne nasce un altro e ci si dimentica di
   aggiungerlo, la verifica fallisce, che è il verso giusto in cui sbagliare. */
const SENZA_TITOLI = ["informazioni-legali"];
controlla(titoli.length > 0 || SENZA_TITOLI.includes(id), "titoli riconosciuti",
  `${titoli.length} titoli`);
controlla(doppie.length === 0, "ancore univoche",
  doppie.length ? `duplicate: ${[...new Set(doppie)].join(", ")}` : `${ancore.length} ancore`);
controlla(ancore.every((a) => /^[a-z0-9-]+$/.test(a)), "ancore ben formate",
  ancore.filter((a) => !/^[a-z0-9-]+$/.test(a)).join(", "));

/* Residui del PDF che non devono arrivare alla pagina. */
const pua = [...testo].filter((c) => c.codePointAt(0) >= 0xe000 && c.codePointAt(0) <= 0xf8ff);
controlla(pua.length === 0, "nessun carattere Private Use",
  pua.length ? `${pua.length} residui — sono lettere perse` : "");
controlla(!/[ﬀ-ﬆ]/.test(testo), "nessuna legatura tipografica");
controlla(!/[a-zàèéìòù]-\s/.test(testo), "nessuna sillabazione sospesa",
  (testo.match(/\S*[a-zàèéìòù]-\s\S*/g) || []).slice(0, 5).join(" | "));

/* Parole incollate: una minuscola seguita da una maiuscola dentro la stessa
   parola è quasi sempre una fusione ("sezioneVedi"). Gli acronimi e i nomi
   propri interni (PE, CA, PNG) restano fuori perché sono tutti maiuscoli. */
const fuse = (testo.match(/\b\p{Ll}+\p{Lu}\p{Ll}+/gu) || []).filter((w) => !/^(dell|nell|sull)/.test(w));
controlla(fuse.length === 0, "nessuna parola fusa",
  [...new Set(fuse)].slice(0, 8).join(", "));

/* Una tabella con righe di larghezza diversa dall'intestazione ha perso o
   inventato una colonna: è il difetto tipico delle celle fuse dal PDF. */
const tabelle = cap.blocchi.filter((b) => b.t === "tabella");
const storte = tabelle.filter((t) => t.righe.some((r) => r.length !== t.colonne.length));
controlla(storte.length === 0, "tabelle rettangolari",
  storte.length ? `storte: ${storte.map((t) => t.titolo).join(", ")}` : `${tabelle.length} tabelle`);

/* Celle vuote: qualcuna è il difetto noto annotato in TODO.md (il PDF emette un
   frammento unico per due colonne e la divisione resta stimata) e si tollera.
   Ma quando sono tante non è una stima imprecisa: è una tabella ricostruita
   male — tipicamente una tabella a piena pagina, che attraversa la separazione
   fra le due colonne di testo e il parser spezza a metà. Sopra il 5% blocca,
   così un capitolo con una tabella rotta non si pubblica per distrazione. */
/* Le righe di SEZIONE non sono buchi: dentro molte tabelle il PDF intercala
   un'etichetta a tutta larghezza ("Armi da mischia semplici", "Armatura
   leggera (1 minuto per indossare o togliere)") che per costruzione riempie
   solo la prima cella. Contarle come celle mancanti misurava la tabella
   sbagliata: in Equipaggiamento erano 46 su 52, e nascondevano i 6 buchi veri
   dietro una percentuale che non si poteva far scendere.
   La condizione è stretta apposta — TUTTE le celle dopo la prima vuote — e non
   scusa nulla di ciò per cui il controllo esiste: una riga in cui alcune
   colonne sono piene e altre no continua a contare, ed è quella che ha fatto
   trovare la colonna fantasma di "Cavalcature e altri animali". */
const sezione = (r) => r[0]?.trim() && r.slice(1).every((c) => !c.trim());
const celleDati = (t) => t.righe.filter((r) => !sezione(r)).flat();
const totCelle = tabelle.reduce((n, t) => n + celleDati(t).length, 0);
const vuote = tabelle.flatMap(celleDati).filter((c) => !c.trim()).length;
const quota = totCelle ? vuote / totCelle : 0;
const rotte = tabelle
  .filter((t) => celleDati(t).filter((c) => !c.trim()).length > celleDati(t).length * 0.05)
  .map((t) => t.titolo);
(quota > 0.05 ? controlla : avvisa)(vuote === 0, "nessuna cella vuota",
  vuote ? `${vuote} celle vuote su ${totCelle} (${(quota * 100).toFixed(1)}%)`
    + (rotte.length ? ` — tabelle sospette: ${rotte.join(", ")}` : "") : "");

console.log(`\n${cap.titolo} (pp. ${cap.pagine[0]}–${cap.pagine[1]})\n`);
for (const { ok, etichetta, dettaglio, avviso } of esiti)
  console.log(`  ${ok ? "✓" : avviso ? "!" : "✗"} ${etichetta}${dettaglio ? ` — ${dettaglio}` : ""}`);

const falliti = esiti.filter((e) => !e.ok && !e.avviso).length;
console.log(`\n${esiti.length - falliti}/${esiti.length} controlli passati\n`);
process.exit(falliti ? 1 : 0);

/* Estrae i capitoli di regole dall'SRD 5.2.1 in italiano (PDF ufficiale CC-BY-4.0)
   e genera i JSON di src/lib/srd/. Uso:

     node scripts/estrai-srd-regole.mjs percorso/IT_SRD_CC_v5.2.1.pdf [id-capitolo …]

   Il PDF non è nel repo (9 MB): https://media.dndbeyond.com/compendium-images/srd/5.2/IT_SRD_CC_v5.2.1.pdf
   Richiede `pdftohtml` (poppler). Fratello di estrai-srd-mostri.mjs: stessa fonte,
   stessa strategia, altro capitolo del PDF.

   Strategia: come per il bestiario, la semantica sta nei font, non nel testo.
   #88191f = titoli (39 = capitolo, 27/21/18 = i tre livelli sotto), Cambria 15 =
   prosa, GillSans-SemiBold 16 = didascalia di tabella, GillSans 14 = celle e
   riquadri laterali. Le colonne si separano a x=440 su pagina larga 891, e
   l'ordine di lettura dell'XML NON è quello visivo: i riquadri di fondo colonna
   arrivano prima del titolo di pagina, quindi si riordina per (colonna, top).

   Il testo inline esce come array di span ({s, i?, b?}), non come HTML: le pagine
   lo rendono con elementi React veri, così non c'è nessuna stringa di markup da
   dare in pasto a dangerouslySetInnerHTML. */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const USCITA = join(RADICE, "src", "lib", "srd", "capitoli");

/* I capitoli del PDF. `pagine` è l'intervallo stampato sulla pagina, che qui
   coincide con quello del PDF (il documento non ha pagine romane in testa). */
const CAPITOLI = [
  { id: "come-si-gioca", titolo: "Come si gioca", pagine: [5, 20] },
  { id: "creazione-del-personaggio", titolo: "Creazione del personaggio", pagine: [21, 31] },
  { id: "classi", titolo: "Classi", pagine: [32, 92] },
  { id: "origini-dei-personaggi", titolo: "Origini dei personaggi", pagine: [93, 97] },
  { id: "talenti", titolo: "Talenti", pagine: [98, 100] },
  { id: "equipaggiamento", titolo: "Equipaggiamento", pagine: [101, 117] },
  { id: "incantesimi", titolo: "Incantesimi", pagine: [118, 201] },
  { id: "glossario-delle-regole", titolo: "Glossario delle regole", pagine: [202, 219] },
  { id: "strumenti-di-gioco", titolo: "Strumenti di gioco", pagine: [220, 231] },
  { id: "oggetti-magici", titolo: "Oggetti magici", pagine: [232, 288] },
];

const COLONNA_DESTRA = 440;   // ascissa di separazione delle due colonne
const PASSO_RIGA = 23;        // px: oltre questo salto verticale è un altro paragrafo

/* --- estrazione dei frammenti --------------------------------------------- */

const unescapeXml = s => s.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"')
  .replaceAll("&apos;", "'").replaceAll("&#34;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");

/* I font del PDF sono subsettati e riassegnano la "f" alla Private Use Area
   quando fa parte di una legatura che il font compone da sé: nel documento
   escono quattro codici diversi (uno per subset) per la stessa lettera, e
   "effetto" è "e" + U+E01D U+E01D + "etto". Non sostituirli non lascia un buco
   visibile — lascia "eetto", cioè una parola plausibile con una lettera in
   meno, invisibile in un diff. Se ne comparisse uno non previsto in un capitolo
   futuro, PUA_IGNOTI lo fa fallire invece di far sparire altre lettere. */
const PUA = { "\u{E007}": "f", "\u{E00C}": "f", "\u{E011}": "f", "\u{E01D}": "f" };
const PUA_IGNOTI = new Set();

/* Un frammento <text> può contenere <b>/<i> annidati: lo riduco a span piatti. */
function spanDaHtml(html) {
  const span = [];
  let i = 0, b = 0, it = 0;
  for (const m of html.matchAll(/<(\/?)([bi])>|([^<]+)/g)) {
    if (m[3] !== undefined) {
      const s = unescapeXml(m[3]).replace(/­/g, "")
        .replace(/[\u{E000}-\u{F8FF}]/gu, c => {
          if (PUA[c]) return PUA[c];
          PUA_IGNOTI.add("U+" + c.codePointAt(0).toString(16).toUpperCase());
          return c;
        });
      if (s) span.push({ s, ...(b ? { b: 1 } : {}), ...(it ? { i: 1 } : {}) });
    } else if (m[2] === "b") b += m[1] ? -1 : 1;
    else it += m[1] ? -1 : 1;
    i++;
  }
  return span;
}

const testoDi = span => span.map(s => s.s).join("");

/* Span adiacenti con lo stesso stile si fondono in uno. Serve *durante* la
   ricucitura, non solo in uscita: il PDF emette il trattino di sillabazione
   come frammento a sé ("…i perso" + "-"), e accoda() guarda l'ultimo span per
   decidere se sciogliere la sillabazione — con "-" da solo il test "lettera
   seguita da trattino" fallisce e usciva "perso- naggi". */
const fondiSpan = span => span.reduce((acc, x) => {
  const u = acc[acc.length - 1];
  if (u && !!u.b === !!x.b && !!u.i === !!x.i) u.s += x.s; else acc.push({ ...x });
  return acc;
}, []);

/* Il rosso dei titoli non si confronta per uguaglianza: pdftohtml lo ha reso
   #88191f quando è nato il glossario e #8b2321 sul PDF riscaricato a luglio, e
   un capitolo estratto con la costante sbagliata perde TUTTI i titoli senza un
   errore — solo prosa in grassetto e zero ancore. Il criterio è la relazione
   tra i canali (rosso scuro saturo: verde e blu bassi e vicini tra loro), che
   sopravvive a una quantizzazione diversa. Esclude il grigio del piè di pagina,
   il blu dei rimandi e il #510000 dell'Optima delle schede mostro. */
const rossoTitolo = col => {
  const m = /^#(\w{2})(\w{2})(\w{2})$/.exec(col);
  if (!m) return false;
  const [r, g, b] = m.slice(1).map(h => parseInt(h, 16));
  return r >= 0x60 && r <= 0xb0 && g < r - 0x50 && b < r - 0x50 && Math.abs(g - b) <= 0x20;
};

/* Il piè di pagina (numero di pagina e titolo corrente) è grigio, e i suoi codici
   cambiano con la resa come quelli del rosso — inseguirli a uno a uno faceva
   ricomparire "202" come paragrafo. Grigio = i tre canali vicini; *chiaro* per
   non confondersi col #221f21 del corpo del testo, che è grigio anche lui. */
const grigioServizio = col => {
  const m = /^#(\w{2})(\w{2})(\w{2})$/.exec(col);
  if (!m) return false;
  const c = m.slice(1).map(h => parseInt(h, 16));
  return Math.max(...c) - Math.min(...c) <= 0x10 && Math.min(...c) >= 0x70;
};

function ruoloFont({ size, fam, col }) {
  if (grigioServizio(col)) return "scarta";                              // piè di pagina
  if (rossoTitolo(col))
    return size >= 34 ? "capitolo" : size >= 25 ? "h2" : size >= 20 ? "h3" : "h4";
  if (fam.includes("Cambria")) return "prosa";
  if (fam.includes("GillSans-SemiBold")) return size >= 16 ? "didascalia" : "intestazione-cella";
  return "gill";                                                          // celle, elenchi, riquadri
}

/* Due frammenti attaccati sulla stessa riga vanno ricuciti, ma non sempre con
   uno spazio in mezzo, e il solo gap orizzontale non basta a deciderlo: a 2px
   si trovano sia "De|ﬁ" (una parola spezzata) sia "Danni.|Se il colpo" (due
   frasi). Il discriminante è la LEGATURA: il PDF interrompe il frammento sulle
   legature ﬁ/ﬂ/ﬀ/ﬃ/ﬄ, e lì la parola prosegue senza spazio. Fuori da quel caso,
   un gap di 2px o più è uno spazio vero — con la costante sbagliata usciva
   "la sezioneVedi anche". */
const LEGATURA = /[ﬀ-ﬆ]/;
function serveSpazio(ult, f) {
  const sin = testoDi(ult.span), des = testoDi(f.span);
  if (!sin || !des) return false;
  if (/\s$/.test(sin) || /^\s/.test(des)) return false;             // lo spazio c'è già
  const gap = f.left - (ult.left + ult.larg);
  /* Dopo un segno d'interpunzione seguito da una lettera lo spazio è certo, e non
     va dedotto dai pixel: "Terreno,|ﬂora" sta a 3px, dentro la tolleranza delle
     legature, e usciva "Terreno,flora". */
  if (/[,;:.!?»]$/.test(sin) && /^\p{L}/u.test(des) && gap >= 1) return true;
  /* Sul confine di una legatura la soglia si alza invece di azzerarsi: "Deﬁ|nizione"
     sta a 2px e non vuole spazio, ma "In|ﬁamme" sta a 5px e lo vuole. Una legatura
     rende la separazione *meno probabile*, non impossibile — trattarla come veto
     dava "Infiamme" e "Lucefioca". */
  const soglia = LEGATURA.test(sin.slice(-1)) || LEGATURA.test(des[0]) ? 3 : 2;
  return gap >= soglia;
}

const TOLLERANZA_RIGA = 3;  // px: entro questo salto due frammenti sono la stessa riga visiva
const SALTO_BANDA = 40;   // px: oltre questo due righe non sono la stessa tabella

/* Le tabelle a piena pagina rompono l'assunzione portante dell'impaginato: che
   la pagina sia a due colonne per tutta la sua altezza. "Terreno di viaggio" ha
   sei colonne da x=95 a x=803 e la separazione a COLONNA_DESTRA la tagliava a
   metà, mandando tre colonne di dati in un blocco a sé.
 *
 * Si riconoscono da un frammento che ATTRAVERSA il gutter (left < 440 < fine):
 * nella prosa a due colonne non succede mai — misurato sul glossario, zero su
 * 2484 frammenti — mentre in una tabella larga una cella ci cade sopra di
 * continuo. Non tutte le righe ne hanno una, quindi la banda si propaga in su e
 * in giù alle righe contigue con un ruolo da tabella: così ci rientrano anche la
 * didascalia e le intestazioni, che stanno sopra il primo attraversamento.
 *
 * Restituisce gli intervalli verticali [y1, y2] delle bande della pagina. */
const RUOLI_TABELLA = new Set(["gill", "intestazione-cella", "didascalia"]);

function bandeFullWidth(frag) {
  const attraversa = frag
    .filter(f => f.left < COLONNA_DESTRA && f.left + f.larg > COLONNA_DESTRA)
    .map(f => f.top).sort((x, y) => x - y);
  if (!attraversa.length) return [];

  const bande = [];
  for (const t of attraversa) {
    const ult = bande[bande.length - 1];
    if (ult && t - ult[1] <= SALTO_BANDA) ult[1] = t; else bande.push([t, t]);
  }

  for (const b of bande) {
    let cresciuta = true;
    while (cresciuta) {
      cresciuta = false;
      for (const f of frag) {
        if (!RUOLI_TABELLA.has(f.ruolo) || (f.top >= b[0] && f.top <= b[1])) continue;
        if (f.top < b[0] && b[0] - f.top <= SALTO_BANDA) { b[0] = f.top; cresciuta = true; }
        else if (f.top > b[1] && f.top - b[1] <= SALTO_BANDA) { b[1] = f.top; cresciuta = true; }
      }
    }
  }
  return bande;
}

/* L'ordine di lettura di una pagina a fasce: la prosa a due colonne sopra la
   banda, poi la banda per intero, poi ciò che viene sotto. Numerando le fasce
   si ordina con un solo confronto, e dentro una banda la separazione fra le
   colonne di testo semplicemente non esiste (colonna 0 per tutti). */
function fasciaDi(f, bande) {
  for (let n = 0; n < bande.length; n++)
    if (f.top >= bande[n][0] && f.top <= bande[n][1]) return { fascia: n * 2 + 1, col: 0 };
  const sopra = bande.filter(b => f.top > b[1]).length;
  return { fascia: sopra * 2, col: f.left >= COLONNA_DESTRA ? 1 : 0 };
}

function righeDelPdf(pdf, da, a) {
  const tmp = mkdtempSync(join(tmpdir(), "srd-regole-"));
  execFileSync("pdftohtml", ["-xml", "-f", String(da), "-l", String(a), "-i", pdf, join(tmp, "estratto")]);
  const xml = readFileSync(join(tmp, "estratto.xml"), "utf8");
  rmSync(tmp, { recursive: true, force: true });

  const font = {};   // cumulativo: gli id dei fontspec proseguono di pagina in pagina
  const righe = [];
  let pag = 0;
  for (const [, corpo] of xml.matchAll(/<page[^>]*>([\s\S]*?)<\/page>/g)) {
    pag++;
    for (const m of corpo.matchAll(/<fontspec id="(\d+)" size="(\d+)" family="([^"]+)" color="(#\w+)"\/>/g))
      font[m[1]] = { size: +m[2], fam: m[3].replace(/^\w+\+/, ""), col: m[4] };

    const frag = [];
    for (const m of corpo.matchAll(/<text top="(\d+)" left="(\d+)" width="(\d+)" height="(\d+)" font="(\d+)">([\s\S]*?)<\/text>/g)) {
      const f = font[m[5]];
      if (!f) continue;
      const ruolo = ruoloFont(f);
      if (ruolo === "scarta") continue;
      const span = spanDaHtml(m[6]);
      if (!testoDi(span).trim()) continue;
      frag.push({ pag, top: +m[1], left: +m[2], larg: +m[3], ruolo, font: f, span });
    }
    /* Ordine visivo, non quello dell'XML: fascia per fascia, e dentro ogni
       fascia la colonna sinistra tutta e poi la destra. Senza bande a piena
       pagina le fasce sono una sola e si ricade nel comportamento di prima. */
    const bande = bandeFullWidth(frag);
    for (const f of frag) Object.assign(f, fasciaDi(f, bande));

    /* Si ordina per RIGA VISIVA, non per top esatto: il top è la posizione del
       glifo, e apici, frazioni e cambi di corpo la spostano di un paio di pixel.
       Nel riquadro delle formule "Passo veloce" (199), "= Chilometri al giorno
       × 1" (201) e "⅓" (199) sono una riga sola: ordinando per top la frazione
       scavalcava la formula e la voce usciva a pezzi. */
    const gruppi = new Map();
    for (const f of frag) {
      const g = `${f.fascia}:${f.col}`;
      if (!gruppi.has(g)) gruppi.set(g, []);
      gruppi.get(g).push(f);
    }
    for (const lista of gruppi.values()) {
      lista.sort((x, y) => x.top - y.top);
      let riga = 0, rif = lista.length ? lista[0].top : 0;
      for (const f of lista) {
        if (f.top - rif > TOLLERANZA_RIGA) { riga++; rif = f.top; }
        f.riga = riga;
      }
    }
    frag.sort((x, y) => x.fascia - y.fascia || x.col - y.col || x.riga - y.riga || x.left - y.left);

    /* Frammenti sulla stessa riga si fondono solo se *attaccati* (<6px): il PDF
       spezza una riga a ogni cambio di stile, e quei pezzi vanno ricuciti. La
       soglia è stretta apposta — a 12px si fondevano anche le celle di una
       tabella con la colonna accanto, cancellando la geometria su cui le
       colonne si ricostruiscono. */
    for (const f of frag) {
      const ult = righe[righe.length - 1];
      const stessaRiga = ult && ult.pag === f.pag && ult.riga === f.riga
        && ult.fascia === f.fascia && ult.col === f.col
        && ult.ruolo === f.ruolo && f.left - (ult.left + ult.larg) < 6;
      if (stessaRiga) {
        /* Lo spazio di separazione va nello span *senza stile*: quello che separa
           la prosa da un corsivo come "Vedi anche" non è esso stesso in corsivo.
           A parità (entrambi nudi o entrambi marcati) resta a sinistra. */
        if (serveSpazio(ult, f)) {
          const u = ult.span[ult.span.length - 1], p = f.span[0];
          const nudo = s => !s.b && !s.i;
          if (nudo(u) || !nudo(p)) u.s += " "; else p.s = " " + p.s;
        }
        ult.span = fondiSpan([...ult.span, ...f.span]);
        ult.larg = f.left + f.larg - ult.left;
      }
      else righe.push({ ...f, span: [...f.span] });
    }
  }
  return righe;
}

/* --- ricomposizione dei paragrafi ----------------------------------------- */

/* Unisce due righe di prosa sciogliendo la sillabazione di fine riga: nel PDF
   "oppor-" + "tunità" sono due righe, e il trattino non fa parte della parola.
   Si scioglie solo se dopo il trattino c'è una minuscola — così "Vantaggio/
   svantaggio" o un "-" voluto a fine riga non vengono mangiati. */
function accoda(span, altri) {
  const ult = span[span.length - 1], primo = altri[0];
  if (ult && primo && /[a-zàèéìòù]-$/.test(ult.s) && /^[a-zàèéìòù]/.test(primo.s))
    ult.s = ult.s.slice(0, -1);
  else if (ult && primo && !/\s$/.test(ult.s) && !/^\s/.test(primo.s))
    ult.s += " ";
  for (const s of altri) {
    const u = span[span.length - 1];
    if (u && !!u.b === !!s.b && !!u.i === !!s.i) u.s += s.s;   // stesso stile: fondi
    else span.push({ ...s });
  }
}

const ripulisci = span => span
  .map(s => ({ ...s, s: s.s.replace(/\s+/g, " ") }))
  .filter((s, k, a) => (k === 0 ? (s.s = s.s.replace(/^\s+/, "")) : true, k === a.length - 1 ? (s.s = s.s.replace(/\s+$/, "")) : true, s.s !== ""));

/* Un paragrafo che apre in grassetto e chiude il grassetto con un punto è una
   voce di definizione: nel PDF è la forma di ogni sotto-regola ("Competenza. Il
   personaggio non…"). È anche l'UNICO delimitatore affidabile di paragrafo,
   perché il rientro non lo è: il documento alterna rientro sospeso (prima riga
   al margine, seguito rientrato) e rientro di prima riga, a volte nella stessa
   pagina. Il grassetto può essere corsivo o no, a seconda del capitolo. */
function forseDefinizione(span) {
  if (!span.length || !span[0].b) return null;
  // il nome sta dentro la corsa di grassetto iniziale e finisce col punto
  let nome = "", k = 0;
  for (; k < span.length && span[k].b; k++) nome += span[k].s;
  const m = /^(.{2,70}?\.)\s*/.exec(nome);
  if (!m) return null;
  const consumato = m[0].length;
  let resto = [];
  let visti = 0;
  for (let n = 0; n < span.length; n++) {
    const s = span[n];
    if (visti + s.s.length <= consumato && n < k) { visti += s.s.length; continue; }
    const taglia = n < k ? Math.max(0, consumato - visti) : 0;
    if (n < k) visti += s.s.length;
    const testo = s.s.slice(taglia);
    if (testo) resto.push({ s: testo, ...(s.i ? { i: 1 } : {}) });
  }
  return { t: "def", nome: m[1].replace(/\.$/, ""), testo: ripulisci(resto) };
}

/* NFKD e non NFD: la scomposizione *compatibile* scioglie anche le legature del
   PDF (ﬁ → f+i), che NFD lascia intere — l'ancora di "Deﬁnizione delle regole"
   usciva "de-nizione-delle-regole". */
const slug = t => t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* --- griglie: tabelle ed elenchi impaginati su colonnine ------------------- */

const TOLLERANZA_X = 10;      // px entro cui due ascisse sono la stessa colonna
const TOLLERANZA_Y = 6;       // px entro cui due frammenti stanno sulla stessa riga

/* Agglomera le ascisse dei frammenti nelle colonne che stanno sotto. */
function colonneDaAscisse(frammenti) {
  const col = [];
  for (const x of [...new Set(frammenti.map(f => f.left))].sort((a, b) => a - b))
    if (!col.length || x - col[col.length - 1] > TOLLERANZA_X) col.push(x);
  return col;
}

const indiceColonna = (colonne, x) => {
  let idx = 0;
  for (let n = 0; n < colonne.length; n++) if (x >= colonne[n] - TOLLERANZA_X) idx = n;
  return idx;
};

/* Taglia un testo largo `larg` px, che inizia a `left`, all'ascissa `x`.
   Serve perché il PDF a volte emette più celle (o più intestazioni) come un
   frammento solo: "Contundente Oggetti contundenti, stritolamento," è una
   cella e mezza. Non avendo le ascisse delle singole parole, si stima la
   posizione in proporzione alla larghezza e si arrotonda allo spazio più
   vicino — l'arrotondamento è ciò che rende l'approssimazione innocua. */
function tagliaAllAscissa(testo, left, larg, x) {
  const quota = (x - left) / larg;
  if (!(quota > 0 && quota < 1)) return null;
  const grezzo = Math.round(testo.length * quota);
  const prima = testo.lastIndexOf(" ", grezzo);
  const dopo = testo.indexOf(" ", grezzo);
  const taglio = prima < 0 ? dopo : dopo < 0 ? prima : (grezzo - prima <= dopo - grezzo ? prima : dopo);
  if (taglio <= 0 || taglio >= testo.length - 1) return null;
  return [testo.slice(0, taglio).trim(), testo.slice(taglio + 1).trim()];
}

/* Dispone i frammenti nella griglia delle colonne date. Una riga la cui prima
   cella è vuota non è una riga: è il seguito a capo di quella sopra — nel PDF
   una cella lunga va a capo restando nella sua colonna. */
function grigliaDaFrammenti(frammenti, colonne) {
  const perRiga = [];
  for (const f of [...frammenti].sort((a, b) => a.top - b.top || a.left - b.left)) {
    const ult = perRiga[perRiga.length - 1];
    if (ult && Math.abs(ult.top - f.top) <= TOLLERANZA_Y) ult.celle.push(f);
    else perRiga.push({ top: f.top, celle: [f] });
  }

  const righe = [];
  for (const { celle } of perRiga) {
    const riga = colonne.map(() => "");
    for (const c of celle) {
      const i = indiceColonna(colonne, c.left);
      const testo = testoDi(c.span).trim();
      /* Cella che sconfina nella colonna dopo mentre quella colonna, su questa
         riga, non ha frammenti suoi: è una cella fusa dal PDF, si divide. */
      const seguente = colonne[i + 1];
      const occupata = seguente !== undefined && celle.some(a => a !== c && indiceColonna(colonne, a.left) === i + 1);
      const diviso = seguente !== undefined && !occupata && c.left + c.larg > seguente + TOLLERANZA_X
        ? tagliaAllAscissa(testo, c.left, c.larg, seguente)
        : null;
      if (diviso) {
        riga[i] = (riga[i] ? riga[i] + " " : "") + diviso[0];
        riga[i + 1] = (riga[i + 1] ? riga[i + 1] + " " : "") + diviso[1];
        continue;
      }
      riga[i] = (riga[i] ? riga[i] + " " : "") + testo;
    }
    /* Continuazione a capo: o la prima cella manca, o tutte le celle sono
       rientrate rispetto alla loro colonna (nel PDF il seguito di una cella
       lunga è indentato, quindi la riga non è vuota ma non inizia una voce). */
    const rientrata = celle.every(c => c.left - colonne[indiceColonna(colonne, c.left)] > TOLLERANZA_X);
    const prec = righe[righe.length - 1];

    /* Terzo caso di continuazione: la cella lunga della prima colonna prosegue
       a capo *senza rientro* e con le altre colonne vuote — "Quando i personaggi
       aprono un sarco-" / "fago, fuoriesce…" / "terrificante." erano tre righe
       di tabella invece di una cella sola. Non basta "solo la prima colonna
       piena", che è anche la forma di una riga di sezione legittima: si chiede
       che il testo prosegua davvero, cioè che cominci in minuscola o che la
       riga sopra finisca con una sillabazione da sciogliere. */
    /* Il vincolo non è su quante celle sono piene — in "Azioni" la riga di
       continuazione le ha piene tutte e due ("gno" | "opportunità per il resto
       del turno.") — ma su come comincia la voce: una riga nuova di queste
       tabelle inizia con maiuscola o con una cifra, quindi una minuscola in
       prima colonna è testo che prosegue. La sillabazione sospesa nella riga
       sopra è il segnale più forte e vale da sola. */
    const prosegue = prec && riga.length > 1 && riga[0]
      && (/^[a-zàèéìòù]/.test(riga[0]) || /[a-zàèéìòù]-$/.test(prec[0]));

    if (prec && (!riga[0] || rientrata || prosegue)) {
      for (let i = 0; i < riga.length; i++) {
        if (!riga[i]) continue;
        prec[i] = /[a-zàèéìòù]-$/.test(prec[i]) ? prec[i].slice(0, -1) + riga[i] : (prec[i] + " " + riga[i]).trim();
      }
    } else righe.push(riga);
  }
  return righe;
}

/* Elenco puntato: le voci aprono col pallino al margine, i capoversi sono
   rientrati. Va riconosciuto prima delle griglie, sennò il rientro dei
   capoversi passa per una seconda colonna. */
function puntato(righe, k) {
  let fine = k;
  while (fine < righe.length && righe[fine].ruolo === "gill") fine++;
  const frammenti = righe.slice(k, fine);
  if (frammenti.filter(f => testoDi(f.span).trimStart().startsWith("•")).length < 2) return null;

  const voci = [];
  for (const f of frammenti) {
    const testo = testoDi(f.span).trim();
    if (testo.startsWith("•")) voci.push(testo.replace(/^•\s*/, ""));
    else if (voci.length) {
      const u = voci.length - 1;
      voci[u] = /[a-zàèéìòù]-$/.test(voci[u]) ? voci[u].slice(0, -1) + testo : voci[u] + " " + testo;
    }
  }
  return { blocco: { t: "punti", voci: voci.filter(Boolean) }, fine };
}

/* Un blocco di righe GillSans senza didascalia: o un elenco impaginato su più
   colonnine (le azioni sotto "Azione", le condizioni), o una griglia
   chiave/valore come quella delle abbreviazioni, riconoscibile perché ha una
   colonna in grassetto. L'elenco si legge per colonna, non per riga: nel PDF è
   impaginato in ordine alfabetico dall'alto in basso, colonna dopo colonna. */
function grigliaLibera(righe, k) {
  let fine = k;
  while (fine < righe.length && (righe[fine].ruolo === "gill" || righe[fine].ruolo === "intestazione-cella")) fine++;
  const tutti = righe.slice(k, fine);
  if (tutti.length < 3) return null;

  /* Una griglia che occupa entrambe le colonne della pagina va trattata come
     due griglie in fila: agglomerare le ascisse delle due metà insieme
     produrrebbe il doppio delle colonne e righe mezze vuote. */
  const blocchi = [];
  for (const meta of [tutti.filter(f => f.left < COLONNA_DESTRA), tutti.filter(f => f.left >= COLONNA_DESTRA)]) {
    if (meta.length < 3) continue;
    const colonne = colonneDaAscisse(meta);
    if (colonne.length < 2) continue;

    if (meta.some(f => f.ruolo === "intestazione-cella")) {
      /* Griglia chiave/valore: le coppie affiancate sono elenchi indipendenti,
         e vanno a capo per conto loro. Ricostruirle insieme farebbe finire il
         seguito di una nella riga dell'altra, quindi ogni coppia di colonne si
         monta da sé — e la lettura per coppie è anche l'ordine alfabetico. */
      const corpo = [];
      for (let n = 0; n + 1 < colonne.length || n < colonne.length; n += 2) {
        const paio = colonne.slice(n, n + 2);
        if (!paio.length) break;
        corpo.push(...grigliaDaFrammenti(meta.filter(f => indiceColonna(colonne, f.left) >= n && indiceColonna(colonne, f.left) < n + 2), paio));
      }
      if (corpo.length >= 2) blocchi.push({ t: "griglia", righe: corpo });
      continue;
    }
    const voci = [];
    for (let n = 0; n < colonne.length; n++)
      for (const f of meta.filter(f => indiceColonna(colonne, f.left) === n).sort((a, b) => a.top - b.top))
        voci.push(testoDi(f.span).trim());
    /* La sillabazione va sciolta anche fra due voci: nel riquadro delle formule
       di viaggio la voce va a capo dentro la parola ("= Chilome-" / "tri
       all'ora × …") e le due metà finiscono in voci separate. */
    const unite = [];
    for (const v of [...new Set(voci)]) {
      const u = unite[unite.length - 1];
      if (u && /[a-zàèéìòù]-$/.test(u) && /^[a-zàèéìòù]/.test(v)) unite[unite.length - 1] = u.slice(0, -1) + v;
      else unite.push(v);
    }
    blocchi.push({ t: "elenco", voci: unite });
  }
  return blocchi.length ? { blocchi, fine } : null;
}

/* Le tabelle vere: una didascalia (GillSans-SemiBold 16), le intestazioni di
   colonna (SemiBold 14) e poi le celle. Le colonne le decidono le ascisse delle
   intestazioni, non quelle delle celle: una cella può essere rientrata. */
function tabella(righe, k) {
  const cap = righe[k];
  if (cap.ruolo !== "didascalia") return null;
  /* Le righe di intestazione si raccolgono guardando FIN DOVE arrivano, invece
     di fermarsi al primo font inatteso: in "Terreno di viaggio" solo "Terreno" e
     "Passo massimo" sono nel font delle intestazioni, mentre "Distanza degli
     incontri" e "CD per foraggiare" sono in GillSans normale come i dati. Ci si
     ferma all'ultima riga che contiene *almeno un* frammento d'intestazione:
     tutto ciò che sta fra la didascalia e quella riga è intestazione anche se
     il PDF non lo dice col font. */
  let ultima = -1;
  for (let j = k + 1; j < righe.length && righe[j].pag === cap.pag
       && righe[j].top - cap.top <= 80; j++)
    if (righe[j].ruolo === "intestazione-cella") ultima = j;
  if (ultima < 0) return null;

  /* …e poi fino in fondo alla sua riga VISIVA: i frammenti sono già ordinati per
     top e left, quindi le altre intestazioni della stessa riga ("Distanza degli
     incontri", "CD per cercare") vengono dopo l'ultima marcata dal font. Senza
     questo finivano fra le celle e le loro ascisse inventavano quattro colonne
     in più, una per ogni titolo. */
  while (ultima + 1 < righe.length && righe[ultima + 1].pag === righe[ultima].pag
    && Math.abs(righe[ultima + 1].top - righe[ultima].top) <= TOLLERANZA_Y) ultima++;

  let i = k + 1;
  const intest = [];
  while (i <= ultima) { intest.push(righe[i]); i++; }

  const celle = [];
  while (i < righe.length && righe[i].ruolo === "gill") { celle.push(righe[i]); i++; }
  if (!celle.length) return null;

  /* Le colonne le dettano le CELLE, non le intestazioni: le celle dati sono
     molte righe allineate a sinistra, mentre un'intestazione è una riga o due
     e spesso è centrata sulla colonna. "CD del / tiro / salvezza" sta su tre
     righe a x=380, 391, 377 — abbastanza sparse da inventare due colonne che
     nei dati non esistono, lasciando "CD del salvezza" e "tiro" come titoli
     separati e una manciata di celle vuote sotto. */
  let colonne = colonneDaAscisse(celle);
  if (colonne.length < 2) colonne = colonneDaAscisse(intest);

  /* Le intestazioni di raggruppamento ("—— Difficoltà del combattimento ——",
     che sovrasta Facile/Media/Difficile) non sono colonne: coprono più colonne
     e il PDF le marca coi trattini di riempimento. Senza scartarle finivano
     incollate al titolo della colonna su cui cade il loro centro. La gerarchia
     va persa: il formato ha una riga sola di intestazioni. */
  const raggruppamento = r => /^[—–]|[—–]$/.test(testoDi(r.span).trim());

  const titoli = colonne.map(() => "");
  for (const r of [...intest].filter(r => !raggruppamento(r)).sort((a, b) => a.top - b.top || a.left - b.left)) {
    /* L'intestazione si assegna col suo CENTRO, la cella col suo bordo sinistro:
       i dati sono allineati a sinistra, i titoli spesso centrati sulla colonna,
       e "CD del" (x=380) inizia a sinistra della colonna dei numeri (x=391) pur
       appartenendole — col bordo finiva nella colonna degli esempi. */
    const idx = indiceColonna(colonne, r.left + r.larg / 2);   // su più righe: si concatena
    titoli[idx] = (titoli[idx] ? titoli[idx] + " " : "") + testoDi(r.span).trim();
  }

  /* A volte il PDF emette le intestazioni di tutte le colonne come un unico
     frammento ("Prova di caratteristica Interazione"): l'ascissa dice una
     colonna sola mentre le celle sotto ne mostrano più d'una. Solo in quel caso
     le colonne le decidono le celle, e il titolo si taglia in proporzione alla
     larghezza del frammento, arrotondando allo spazio più vicino. */
  if (colonne.length === 1) {
    const daCelle = colonneDaAscisse(celle);
    if (daCelle.length > 1) {
      const testa = intest[0], titolo = titoli[0];
      colonne = daCelle;
      titoli.length = 0;
      let resto = titolo;
      for (let n = 0; n < colonne.length; n++) {
        if (n === colonne.length - 1) { titoli.push(resto.trim()); break; }
        const quota = (colonne[n + 1] - testa.left) / testa.larg;
        const grezzo = Math.round(titolo.length * quota) - (titolo.length - resto.length);
        const taglio = resto.lastIndexOf(" ", Math.max(0, grezzo));
        titoli.push(resto.slice(0, taglio < 0 ? resto.length : taglio).trim());
        resto = taglio < 0 ? "" : resto.slice(taglio + 1);
      }
    }
  }

  const griglia = grigliaDaFrammenti(celle, colonne);

  /* Le note a piè di tabella (le legende di * e †) non sono dati: stanno sotto
     l'ultima riga e riempiono una cella o due su sei, quindi restare nella
     griglia le rendeva righe quasi tutte vuote. Si riconoscono dalla forma —
     molto meno piene delle righe sopra — e non dal marcatore, che l'ordine dei
     frammenti può spostare in coda ("…vedi \"Veicoli\".†"). Il vincolo sulle tre
     colonne tiene fuori le tabelle a due, dove "una cella su due" è metà riga e
     non un indizio di niente. */
  const note = [];
  while (griglia.length > 1 && colonne.length >= 3) {
    const ultima = griglia[griglia.length - 1];
    /* Confronto largo (>=): in una tabella a doppia colonna con un numero
       dispari di voci l'ultima riga ne riempie esattamente metà — "17 | Pietra"
       nella CA degli oggetti è un dato, non una legenda. */
    if (ultima.filter(c => c.trim()).length >= colonne.length / 2) break;
    note.unshift(griglia.pop().filter(c => c.trim()).join(" "));
  }

  return {
    blocchi: [
      { t: "tabella", titolo: testoDi(cap.span).trim(), colonne: titoli, righe: griglia },
      ...note.map(n => ({ t: "p", testo: [{ s: n }] })),
    ],
    fine: i,
  };
}

function blocchiDaRighe(righe) {
  const blocchi = [];
  let corrente = null;                      // paragrafo o definizione in costruzione

  const chiudi = () => {
    if (!corrente) return;
    if (corrente.t === "p") corrente.testo = ripulisci(corrente.testo);
    else corrente.testo = ripulisci(corrente.testo);
    if (testoDi(corrente.testo).trim() || corrente.nome) blocchi.push(corrente);
    corrente = null;
  };

  for (let k = 0; k < righe.length; k++) {
    const r = righe[k];

    if (r.ruolo === "capitolo") { chiudi(); continue; }   // il titolo lo sappiamo già

    if (r.ruolo === "h2" || r.ruolo === "h3" || r.ruolo === "h4") {
      chiudi();
      // titoli spezzati su due righe ("Glossario delle " / "regole")
      const ult = blocchi[blocchi.length - 1];
      const testo = testoDi(r.span).trim();
      if (ult && ult.t === r.ruolo && righe[k - 1] && r.top - righe[k - 1].top < 60 && righe[k - 1].ruolo === r.ruolo) {
        ult.testo = (ult.testo + " " + testo).replace(/\s+/g, " ").trim();
        ult.id = slug(ult.testo);
      } else blocchi.push({ t: r.ruolo, testo, id: slug(testo) });
      continue;
    }

    if (r.ruolo === "didascalia") {
      const tab = tabella(righe, k);
      if (tab) { chiudi(); blocchi.push(...tab.blocchi); k = tab.fine - 1; continue; }
    }

    if (r.ruolo === "gill" || r.ruolo === "intestazione-cella") {
      const pt = puntato(righe, k);
      if (pt) { chiudi(); blocchi.push(pt.blocco); k = pt.fine - 1; continue; }
      const gr = grigliaLibera(righe, k);
      if (gr) { chiudi(); blocchi.push(...gr.blocchi); k = gr.fine - 1; continue; }
      // resto: righe fuori tabella in GillSans → prosa di riquadro
      if (corrente) accoda(corrente.testo, r.span);
      else corrente = { t: "p", testo: [...r.span] };
      continue;
    }

    /* Prosa. Il rientro NON separa i paragrafi (il documento alterna i due
       stili di rientro), quindi si rompe su due soli segnali: l'apertura in
       grassetto di una definizione, e un salto verticale più largo del passo
       di riga. Il cambio di colonna o di pagina non rompe: un paragrafo
       scavalca la colonna, e la riga successiva riprende in cima. */
    const prec = righe[k - 1];
    const stessoFlusso = prec && prec.pag === r.pag
      && (prec.left >= COLONNA_DESTRA) === (r.left >= COLONNA_DESTRA);
    const salto = stessoFlusso ? r.top - prec.top : 0;
    const def = forseDefinizione(r.span);
    if (def || !corrente || salto > PASSO_RIGA) {
      chiudi();
      corrente = def || { t: "p", testo: [...r.span] };
    } else accoda(corrente.testo, r.span);
  }
  chiudi();

  /* Gli id si assegnano alla fine, quando i titoli spezzati su due righe sono
     già stati ricuciti. Un capitolo può ripetere lo stesso titolo in sezioni
     diverse ("Bonus di competenza" compare tre volte in "Come si gioca"): due
     ancore uguali nella stessa pagina fanno atterrare ogni link sulla prima,
     quindi dal secondo in poi si numera. Il glossario non lo mostrava perché
     i suoi termini sono unici per costruzione. */
  const visti = new Map();
  for (const b of blocchi) {
    if (!b.id) continue;
    const base = slug(b.testo);
    const n = (visti.get(base) ?? 0) + 1;
    visti.set(base, n);
    b.id = n === 1 ? base : `${base}-${n}`;
  }
  return blocchi;
}

/* --- generazione ----------------------------------------------------------- */

const pdf = process.argv[2];
if (!pdf) { console.error("uso: node scripts/estrai-srd-regole.mjs <IT_SRD_CC_v5.2.1.pdf> [id-capitolo …]"); process.exit(1); }
const soli = process.argv.slice(3);
const daFare = soli.length ? CAPITOLI.filter(c => soli.includes(c.id)) : CAPITOLI;
if (!daFare.length) { console.error("nessun capitolo con quegli id"); process.exit(1); }

/* Le legature tipografiche del PDF (ﬁ, ﬂ, ﬃ…) vanno sciolte, sennò "Difﬁcoltà"
   non si trova cercando "Difficoltà" e si incolla male. Si sciolgono QUI, sul
   documento finito, e non all'estrazione: durante il parsing le legature sono
   il segnale che distingue una parola spezzata da due frasi accostate
   (vedi serveSpazio), quindi vanno lasciate intatte fin dopo la ricucitura.
   Ricorsivo perché il testo vive in posti diversi: span, celle, voci. */
const LEGATURE = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "ft", "ﬆ": "st" };

/* In uscita fondiSpan passa di nuovo: sciolte le legature, span che prima
   differivano possono ritrovarsi identici e vanno ricompattati. */
const eSpan = v => Array.isArray(v) && v.length
  && v.every(x => x && typeof x === "object" && typeof x.s === "string");

const sciogliLegature = v =>
  typeof v === "string" ? v.replace(/[ﬀ-ﬆ]/g, c => LEGATURE[c] ?? c)
  : eSpan(v) ? fondiSpan(v.map(sciogliLegature))
  : Array.isArray(v) ? v.map(sciogliLegature)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sciogliLegature(x)]))
  : v;

mkdirSync(USCITA, { recursive: true });
let guasti = 0;
for (const cap of daFare) {
  const righe = righeDelPdf(pdf, cap.pagine[0], cap.pagine[1]);
  const blocchi = blocchiDaRighe(righe);
  const conta = blocchi.reduce((m, b) => ({ ...m, [b.t]: (m[b.t] || 0) + 1 }), {});

  /* Un capitolo senza titoli non è un capitolo povero di titoli: è il segno che
     il riconoscimento dei font non ha agganciato niente (è successo col rosso
     reso diversamente da poppler). Senza titoli non ci sono ancore né indice, e
     il JSON esce plausibile — quindi il guasto va gridato, non dedotto. */
  const titoli = (conta.h2 || 0) + (conta.h3 || 0) + (conta.h4 || 0);
  if (!titoli) {
    console.error(`✗ ${cap.id}: nessun titolo riconosciuto — non lo scrivo. ` +
      `Controlla il rosso dei titoli nell'XML (pdftohtml -xml -f ${cap.pagine[0]} -l ${cap.pagine[1]}).`);
    guasti++;
    continue;
  }

  const doc = sciogliLegature({ id: cap.id, titolo: cap.titolo, pagine: cap.pagine, blocchi });
  writeFileSync(join(USCITA, cap.id + ".json"), JSON.stringify(doc, null, 1) + "\n");
  console.log(`${cap.id}: ${blocchi.length} blocchi`, conta);
}
if (PUA_IGNOTI.size) {
  console.error(`✗ codici Private Use non previsti: ${[...PUA_IGNOTI].join(", ")} — ` +
    `sono lettere rimaste nel testo. Trovane il valore dal contesto e aggiungile a PUA.`);
  guasti++;
}
if (guasti) process.exit(1);

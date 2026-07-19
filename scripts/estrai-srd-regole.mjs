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

/* Un frammento <text> può contenere <b>/<i> annidati: lo riduco a span piatti. */
function spanDaHtml(html) {
  const span = [];
  let i = 0, b = 0, it = 0;
  for (const m of html.matchAll(/<(\/?)([bi])>|([^<]+)/g)) {
    if (m[3] !== undefined) {
      const s = unescapeXml(m[3]).replace(/­/g, "");
      if (s) span.push({ s, ...(b ? { b: 1 } : {}), ...(it ? { i: 1 } : {}) });
    } else if (m[2] === "b") b += m[1] ? -1 : 1;
    else it += m[1] ? -1 : 1;
    i++;
  }
  return span;
}

const testoDi = span => span.map(s => s.s).join("");

function ruoloFont({ size, fam, col }) {
  if (col === "#7b7879" || col === "#8b8989") return "scarta";           // piè di pagina
  if (col === "#88191f")
    return size >= 34 ? "capitolo" : size >= 25 ? "h2" : size >= 20 ? "h3" : "h4";
  if (fam.includes("Cambria")) return "prosa";
  if (fam.includes("GillSans-SemiBold")) return size >= 16 ? "didascalia" : "intestazione-cella";
  return "gill";                                                          // celle, elenchi, riquadri
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
    // ordine visivo: colonna sinistra tutta, poi destra; non l'ordine dell'XML
    frag.sort((x, y) => (x.left >= COLONNA_DESTRA) - (y.left >= COLONNA_DESTRA) || x.top - y.top || x.left - y.left);

    /* Frammenti sulla stessa riga si fondono solo se *attaccati* (<6px): il PDF
       spezza una riga a ogni cambio di stile, e quei pezzi vanno ricuciti. La
       soglia è stretta apposta — a 12px si fondevano anche le celle di una
       tabella con la colonna accanto, cancellando la geometria su cui le
       colonne si ricostruiscono. */
    for (const f of frag) {
      const ult = righe[righe.length - 1];
      const stessaRiga = ult && ult.pag === f.pag && Math.abs(ult.top - f.top) <= 2
        && (ult.left >= COLONNA_DESTRA) === (f.left >= COLONNA_DESTRA)
        && ult.ruolo === f.ruolo && f.left - (ult.left + ult.larg) < 6;
      if (stessaRiga) { ult.span.push(...f.span); ult.larg = f.left + f.larg - ult.left; }
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

const slug = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
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
    if (prec && (!riga[0] || rientrata)) {
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
    blocchi.push({ t: "elenco", voci: [...new Set(voci)] });
  }
  return blocchi.length ? { blocchi, fine } : null;
}

/* Le tabelle vere: una didascalia (GillSans-SemiBold 16), le intestazioni di
   colonna (SemiBold 14) e poi le celle. Le colonne le decidono le ascisse delle
   intestazioni, non quelle delle celle: una cella può essere rientrata. */
function tabella(righe, k) {
  const cap = righe[k];
  if (cap.ruolo !== "didascalia") return null;
  let i = k + 1;
  const intest = [];
  while (i < righe.length && righe[i].ruolo === "intestazione-cella") { intest.push(righe[i]); i++; }
  if (!intest.length) return null;

  const celle = [];
  while (i < righe.length && righe[i].ruolo === "gill") { celle.push(righe[i]); i++; }
  if (!celle.length) return null;

  let colonne = colonneDaAscisse(intest);
  const titoli = colonne.map(() => "");
  for (const r of [...intest].sort((a, b) => a.top - b.top || a.left - b.left)) {
    const idx = indiceColonna(colonne, r.left);   // intestazione su due righe: si concatena
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

  return {
    blocco: { t: "tabella", titolo: testoDi(cap.span).trim(), colonne: titoli, righe: grigliaDaFrammenti(celle, colonne) },
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
      if (tab) { chiudi(); blocchi.push(tab.blocco); k = tab.fine - 1; continue; }
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
  return blocchi;
}

/* --- generazione ----------------------------------------------------------- */

const pdf = process.argv[2];
if (!pdf) { console.error("uso: node scripts/estrai-srd-regole.mjs <IT_SRD_CC_v5.2.1.pdf> [id-capitolo …]"); process.exit(1); }
const soli = process.argv.slice(3);
const daFare = soli.length ? CAPITOLI.filter(c => soli.includes(c.id)) : CAPITOLI;
if (!daFare.length) { console.error("nessun capitolo con quegli id"); process.exit(1); }

mkdirSync(USCITA, { recursive: true });
for (const cap of daFare) {
  const righe = righeDelPdf(pdf, cap.pagine[0], cap.pagine[1]);
  const blocchi = blocchiDaRighe(righe);
  const doc = { id: cap.id, titolo: cap.titolo, pagine: cap.pagine, blocchi };
  writeFileSync(join(USCITA, cap.id + ".json"), JSON.stringify(doc, null, 1) + "\n");
  const conta = blocchi.reduce((m, b) => ({ ...m, [b.t]: (m[b.t] || 0) + 1 }), {});
  console.log(`${cap.id}: ${blocchi.length} blocchi`, conta);
}

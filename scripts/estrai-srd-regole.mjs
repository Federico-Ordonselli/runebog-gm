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
/* Il corridoio vuoto fra le due colonne di testo: la sinistra chiude a 435, la
   destra apre a 470. Sono margini tipografici, non stime — sui 39.077
   frammenti del documento 434 bordi destri cadono a 434-435 e 10.242 bordi
   sinistri a 470, mentre nei 34 px in mezzo ne cadono 37 in tutto, tutti
   dentro tabelle a piena pagina. */
const GUTTER = [435, 470];
/* px: oltre questo salto verticale è un altro paragrafo. Dentro un paragrafo il
   passo è 18–19; a 23 il PDF stacca la riga in corsivo che dichiara categoria e
   rarità ("Verga, molto rara") dalla descrizione che segue, e a 23 esatti stava
   dalla parte sbagliata della soglia — su 212 casi nel PDF nessuno prosegue una
   frase, né per sillabazione né aprendo in minuscola. */
const PASSO_RIGA = 22;

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

/* Fine di riga sillabata, e inizio di riga che la prosegue. Entrambe le classi
   comprendono le LEGATURE: ﬁ e ﬂ sono minuscole a tutti gli effetti, ma non
   stanno in [a-z] e durante il parsing sono ancora intere (si sciolgono solo in
   uscita, vedi sciogliLegature). Senza, la sillabazione non si ricuciva e
   usciva "modi- ficatore" — una parola spezzata a metà, con dentro uno spazio e
   un trattino, che a rileggere il JSON non salta all'occhio. Servono tutt'e
   due: il PDF spezza la riga sia prima della legatura ("modi-" / "ﬁcatore") sia
   dopo ("modiﬁ-" / "catore"), a seconda di dove cade il margine. */
const SILLABATA = /[a-zàèéìòùﬀ-ﬆ]-$/;
const PROSEGUE = /^[a-zàèéìòùﬀ-ﬆ]/;

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

/* Due frammenti attaccati si ricuciscono solo se dicono la stessa cosa sul ruolo
   della riga — sennò le celle di una tabella si fonderebbero con la colonna
   accanto. Ma il ruolo di una riga lo dichiara il frammento che la APRE, e un
   grassetto che arriva a metà riga è enfasi, non un'intestazione: negli oggetti
   magici gli elenchi annidati dentro una cella ("…tirando un 1d10: con 1,
   allucinazione; con 2, folata di vento") e i nomi delle creature evocate
   ("Spuntano 3 boleti stridenti") sono in GillSans-SemiBold come i titoli di
   colonna. Presi per intestazioni spezzavano la riga in tre pezzi e fermavano
   la raccolta delle celle a metà tabella: nel "Cappello dei molti incantesimi"
   restavano un "4 ," in colonna 1 e la mezza frase accanto.
 *
 * Vale in una direzione sola, ed è la misura a dirlo: nel PDF i frammenti
 * attaccati con ruoli diversi sono 1671, di cui 1602 nell'altro verso — il
 * grassetto che APRE una cella ("Rosso. Tiro salvezza fallito…") e le etichette
 * delle schede ("Peso:"). Quelli devono restare righe a sé: è il punto finale,
 * non la posizione, a distinguerli dalle intestazioni vere. */
const proseguiIlRuolo = (ult, f) =>
  ult.ruolo === f.ruolo || (ult.ruolo === "gill" && f.ruolo === "intestazione-cella");

/* px: sotto questo scarto orizzontale due frammenti della stessa riga visiva si
   toccano, e quindi sono la stessa frase. Stretto apposta — a 12px si fondevano
   le celle di una tabella con la colonna accanto. Vale sia per ricucire (sopra)
   sia per riconoscere il grassetto che sta DENTRO una cella (vedi tabella). */
const ATTACCATI = 6;

/* La colonna di testo in cui vive un frammento: pagina, fascia (le bande a
   piena pagina non hanno colonne) e colonna. È l'unità che si esaurisce e manda
   una tabella a capo. */
const stessaColonna = (a, b) => !!a && !!b && a.pag === b.pag
  && a.fascia === b.fascia && a.col === b.col;

/* Due frammenti della stessa riga visiva: il numero di riga è già calcolato
   dentro la fascia e la colonna di pagina, quindi confrontarli è un'uguaglianza
   e non una tolleranza. */
const stessaRigaVisiva = (a, b) => stessaColonna(a, b) && a.riga === b.riga;

const TOLLERANZA_RIGA = 3;  // px: entro questo salto due frammenti sono la stessa riga visiva
const SALTO_BANDA = 40;   // px: oltre questo due righe non sono la stessa tabella

/* Le tabelle a piena pagina rompono l'assunzione portante dell'impaginato: che
   la pagina sia a due colonne per tutta la sua altezza. "Terreno di viaggio" ha
   sei colonne da x=95 a x=803 e la separazione a COLONNA_DESTRA la tagliava a
   metà, mandando tre colonne di dati in un blocco a sé.
 *
 * Si riconoscono da un frammento che INVADE il corridoio fra le due colonne:
 * nella prosa non succede mai, perché il corridoio è il margine delle colonne,
 * mentre in una tabella larga una cella ci cade dentro di continuo. Non basta
 * chiedere che il frammento scavalchi la mezzeria (left < 440 < fine): la
 * tabella "Privilegi del bardo" ha quattordici colonne e nessuna cella che
 * passi per il centro — "Trucchetti" sta a 445-508, appena dentro il corridoio
 * — e usciva tagliata in due, quattro colonne da una parte e le altre dieci
 * lette per colonnine come se fossero un elenco.
 * Non tutte le righe ne hanno una, quindi la banda si propaga in su e
 * in giù alle righe contigue con un ruolo da tabella: così ci rientrano anche la
 * didascalia e le intestazioni, che stanno sopra il primo attraversamento.
 *
 * La propagazione però non deve scavalcare le righe dove la pagina è a due
 * colonne DAVVERO: all'apertura di ogni classe il riquadro "Tratti del
 * <classe>" è una tabella alta mezza pagina nella colonna sinistra, la tabella
 * dei privilegi sta sotto a piena pagina, e le righe del riquadro hanno tutte
 * un ruolo da tabella a meno di SALTO_BANDA l'una dall'altra. La banda risaliva
 * di riga in riga fino in cima e le due colonne uscivano interlacciate ("Dado
 * Vita | D10 per ogni livello da guerriero cati nella tabella Privilegi del
 * guerriero."). Quelle righe le riconosce `righeADueColonne`.
 *
 * Restituisce gli intervalli verticali [y1, y2] delle bande della pagina. */
const RUOLI_TABELLA = new Set(["gill", "intestazione-cella", "didascalia"]);
const RUOLI_PROSA = new Set(["prosa", "capitolo", "h2", "h3", "h4"]);
/* px: entro questo scarto verticale due righe di colonne diverse convivono,
   cioè si affiancano sulla pagina. È mezza riga — l'interlinea è 18–19 px e le
   due colonne non vanno a capo insieme. */
const AFFIANCATE = 11;

const invadeIlGutter = f => f.left + f.larg > GUTTER[0] && f.left < GUTTER[1];

/* 0 = colonna sinistra, 1 = destra, null = nessuna delle due (sta nel gutter,
   quindi appartiene a una fascia a piena pagina). */
const latoDi = f => invadeIlGutter(f) ? null : f.left < COLONNA_DESTRA ? 0 : 1;

/* Le righe che stanno nella pagina a due colonne, e che quindi nessuna banda
   può inghiottire. Il segnale diretto è la prosa dell'altra colonna che le
   affianca; ma la prosa finisce prima del riquadro accanto, e le ultime righe
   del riquadro restano sole in mezzo alla pagina — geometricamente
   indistinguibili dalla didascalia di una tabella a piena pagina, che nel PDF
   comincia 19 px sotto la prosa mentre quelle ne distano 18. A separarle non è
   la misura ma la CONTINUITÀ: una riga prosegue ciò che ha sopra nella sua
   colonna, quindi eredita. Una didascalia no — apre una tabella per
   definizione, e non è mai il seguito di niente. */
function righeADueColonne(frag) {
  const prosa = frag.filter(f => RUOLI_PROSA.has(f.ruolo));
  const marcate = new Set();
  /* Le righe si contano DENTRO la colonna. Raggrupparle per sola ordinata, a
     cavallo del gutter, fondeva in una riga sola le due colonne affiancate —
     che alla stessa altezza sono due righe diverse — e quella riga sembrava
     larga quanto la pagina: esattamente ciò che si sta cercando di escludere. */
  for (const lato of [0, 1]) {
    const righe = [];
    for (const f of frag.filter(f => latoDi(f) === lato).sort((x, y) => x.top - y.top)) {
      const ult = righe[righe.length - 1];
      if (ult && f.top - ult.top <= TOLLERANZA_RIGA) ult.frag.push(f);
      else righe.push({ top: f.top, frag: [f] });
    }
    let sopra = null;
    for (const r of righe) {
      const eredita = sopra && sopra.marcata && r.top - sopra.top <= SALTO_BANDA
        && !r.frag.some(f => f.ruolo === "didascalia");
      r.marcata = eredita
        || prosa.some(p => latoDi(p) === 1 - lato && Math.abs(p.top - r.top) <= AFFIANCATE);
      if (r.marcata) for (const f of r.frag) marcate.add(f);
      sopra = r;
    }
  }
  return marcate;
}

function bandeFullWidth(frag) {
  const attraversa = frag.filter(f => latoDi(f) === null).map(f => f.top).sort((x, y) => x - y);
  if (!attraversa.length) return [];

  const bande = [];
  for (const t of attraversa) {
    const ult = bande[bande.length - 1];
    if (ult && t - ult[1] <= SALTO_BANDA) ult[1] = t; else bande.push([t, t]);
  }

  const dueColonne = righeADueColonne(frag);
  for (const b of bande) {
    let cresciuta = true;
    while (cresciuta) {
      cresciuta = false;
      for (const f of frag) {
        if (!RUOLI_TABELLA.has(f.ruolo) || (f.top >= b[0] && f.top <= b[1])) continue;
        if (dueColonne.has(f)) continue;
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

    /* Frammenti sulla stessa riga si fondono solo se *attaccati*: il PDF spezza
       una riga a ogni cambio di stile, e quei pezzi vanno ricuciti. */
    for (const f of frag) {
      const ult = righe[righe.length - 1];
      const stessaRiga = ult && ult.pag === f.pag && ult.riga === f.riga
        && ult.fascia === f.fascia && ult.col === f.col
        && proseguiIlRuolo(ult, f) && f.left - (ult.left + ult.larg) < ATTACCATI;
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
  if (ult && primo && SILLABATA.test(ult.s) && PROSEGUE.test(primo.s))
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
  /* Un grassetto che apre in minuscola non è un nome: è la CODA di un nome
     spezzato a fine riga ("Usando uno slot di livello supe-" / "riore."), e
     prenderlo per una definizione nuova apriva 97 blocchi intitolati "riore".
     Restituendo null la riga si accoda al paragrafo precedente e il nome si
     ricompone: a promuoverlo a definizione ci pensa `chiudi`, che vede la
     corsa di grassetto intera. */
  if (!/^[\p{Lu}0-9«"]/u.test(m[1])) return null;
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

/* Dice se la riga `k` APRE una definizione, che è il solo segnale affidabile di
   paragrafo nuovo insieme al salto verticale. Non basta guardare la riga: il
   nome può stare a cavallo di due righe ("Usando uno slot di livello supe-" /
   "riore."), e pretendendo il punto finale sulla prima si perdeva la rottura —
   in Incantesimi succede a 97 paragrafi su 158, perché quel nome è lungo.
   Quindi la corsa di grassetto si insegue in avanti finché apre le righe, e il
   punto che chiude il nome si cerca lì dentro. Il grassetto che CONTINUA dalla
   riga sopra non apre niente: è la coda di un nome spezzato. */
function apreDefinizione(righe, k) {
  const r = righe[k], prec = righe[k - 1];
  if (!r.span.length || !r.span[0].b) return false;
  if (prec && prec.span.length && prec.span[prec.span.length - 1].b) return false;
  let nome = "";
  for (let n = k; n < righe.length && nome.length < 70; n++) {
    const sp = righe[n].span;
    if (!sp.length || !sp[0].b) break;
    for (let j = 0; j < sp.length && sp[j].b; j++) nome += sp[j].s;
    if (sp.some(s => !s.b)) break;          // il grassetto finisce qui: non prosegue
    nome = nome.replace(SILLABATA, "");   // sillabazione a fine riga
  }
  return /^.{2,70}?\./s.test(nome);
}

/* NFKD e non NFD: la scomposizione *compatibile* scioglie anche le legature del
   PDF (ﬁ → f+i), che NFD lascia intere — l'ancora di "Deﬁnizione delle regole"
   usciva "de-nizione-delle-regole". */
const slug = t => t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* --- griglie: tabelle ed elenchi impaginati su colonnine ------------------- */

const TOLLERANZA_X = 10;      // px entro cui due ascisse sono la stessa colonna
const TOLLERANZA_Y = 6;       // px entro cui due frammenti stanno sulla stessa riga

/* Raggruppa i frammenti per SOVRAPPOSIZIONE orizzontale invece che per ascissa,
   e restituisce l'inizio di ogni colonna.
 *
 * Raggruppare per ascissa presume che le celle siano allineate a sinistra, il
 * che in questo PDF è falso in due modi opposti: i valori numerici sono
 * allineati a destra ("2 kg" comincia a x=335 e "0,5 kg" a x=324, e ognuno si
 * prendeva una colonna), mentre le intestazioni sono centrate e spezzate su più
 * righe ("CD del" / "tiro" / "salvezza" a x=380, 391, 377). La sovrapposizione
 * non presume niente: quei tre titoli si coprono a vicenda e fanno una colonna
 * sola, mentre "Oggetto" / "Peso" / "Costo" non si toccano e restano tre.
 *
 * Serve alle intestazioni, che sono poche e affidabili: dedurre le colonne dalle
 * celle creava confini spuri, e allora tagliaAllAscissa() — nato per dividere le
 * celle che il PDF fonde — tagliava celle sane, da cui "0,5" e "kg" in due
 * colonne diverse. */
function colonneDaIntervalli(frammenti) {
  const intervalli = frammenti
    .map(f => [f.left, f.left + f.larg])
    .sort((a, b) => a[0] - b[0]);
  const gruppi = [];
  for (const [x1, x2] of intervalli) {
    const ult = gruppi[gruppi.length - 1];
    if (ult && x1 <= ult[1]) ult[1] = Math.max(ult[1], x2);   // si toccano: stessa colonna
    else gruppi.push([x1, x2]);
  }
  return gruppi;
}

/* Le intestazioni dicono la struttura, ma il PDF a volte ne fonde due in un
   frammento solo ("CA Materiale" sta sopra i numeri E i materiali, ed è una
   colonna dove le celle ne mostrano due). Le celle rivelano il confine, e qui
   sono l'unica prova disponibile — ma non ogni ascissa in più è una colonna:
   sotto "Peso" i valori "0,5" e "kg" ne producono due e sono un dato solo.
   A distinguere i due casi, che hanno la STESSA geometria, è l'intestazione:
   si adotta il confine solo se il titolo si lascia tagliare lì, cioè se ha uno
   spazio dove spezzarsi ("CA Materiale" sì, "Peso" no). */
function raffinaConCelle(gruppi, titolari, celle) {
  const daCelle = colonneDaAscisse(celle);
  const colonne = [];
  for (const [x1, x2] of gruppi) {
    colonne.push(x1);

    /* Si CONTANO le colonne di celle sotto il gruppo, comprese quelle allineate
       al suo inizio: una sola vuol dire che il gruppo è già una colonna, con le
       celle spostate rispetto al titolo ("Distanza degli incontri" sta a 335 e
       i suoi "6d6 × 3 metri" a 359, e cercare confini interni lo spaccava in
       due). Da due in su il titolo sovrasta davvero più colonne. */
    const sotto = daCelle.filter(x => x > x1 - TOLLERANZA_X && x < x2 - TOLLERANZA_X);
    if (sotto.length < 2) continue;
    const dentro = sotto.slice(1);

    /* Il titolo da spezzare è il frammento che copre tutto il gruppo — o quello
       fuso ("CA Materiale"), o quello a cavallo delle sottocolonne ("Distanza
       percorsa ogni..." sopra Minuto/Ora, che fondeva le due in una). Se non
       c'è, il gruppo è un'intestazione impilata su più righe e si lascia stare. */
    const r = titolari.find(r =>
      r.left <= x1 + TOLLERANZA_X && r.left + r.larg >= x2 - TOLLERANZA_X);
    if (!r) continue;

    let resto = testoDi(r.span).trim(), x = r.left, larg = r.larg, tagliato = true;
    const pezzi = [];
    for (const c of dentro) {
      const div = tagliaAllAscissa(resto, x, larg, c);
      if (!div) { tagliato = false; break; }
      pezzi.push(div[0]);
      [resto, larg, x] = [div[1], x + larg - c, c];
    }
    pezzi.push(resto);

    /* Terza condizione, e nasce dove le prime due non bastano: se il gruppo è
       coperto da UN SOLO frammento, ogni pezzo che ne esce deve poter essere un
       titolo di colonna, cioè cominciare per maiuscola o per cifra.
       "Capacità di trasporto" sopra "225 kg" ha la stessa geometria di
       "CA Materiale" sopra "11 Stoffa" — un titolo con uno spazio e due colonne
       di celle sotto — e passava, lasciando una colonna "Capacità" sempre vuota
       e una intitolata "di trasporto". Nessun titolo di questo PDF comincia per
       preposizione: è il testo a dire che quel gruppo è un blocco solo.
       Il vincolo del frammento unico non è cosmetico: quando i frammenti sono
       più d'uno le sottocolonne sono DICHIARATE da titoli veri, e sopra ci passa
       un titolo di raggruppamento che li scavalca ("Distanza percorsa ogni…"
       sopra Minuto e Ora). Lì la concatenazione delle due righe produce pezzi
       che cominciano in minuscola ("ogni… Ora") ma le colonne sono giuste, e
       rifiutare il taglio fondeva 120 m e 6 km in una cella sola. */
    const soli = titolari.filter(t =>
      t.left < x2 - TOLLERANZA_X && t.left + t.larg > x1 + TOLLERANZA_X).length === 1;
    if (tagliato && soli && !pezzi.every(p => /^[A-ZÀ-Ý0-9]/.test(p.trim()))) tagliato = false;

    /* Le parentesi invece valgono sempre, quanti che siano i frammenti: in un
       titolo sono bilanciate, quindi un taglio che ne spezza una è sbagliato per
       costruzione. Il Mazzo delle meraviglie ha "1d100" impilato sopra "(Mazzo
       da 13 carte)" — due frammenti, quindi la guardia delle maiuscole non
       scatta — e sotto ha sia i trattini centrati sia gli intervalli allineati a
       sinistra, cioè la stessa geometria di "Peso" con "0,5" e "kg": la prima
       colonna usciva spaccata fra "(Mazzo da" e "13 carte)", e la tabella intera
       collassava in una riga sola. */
    if (tagliato && pezzi.some(p => (p.match(/\(/g) || []).length !== (p.match(/\)/g) || []).length))
      tagliato = false;
    if (tagliato) colonne.push(...dentro);
  }
  return colonne.sort((a, b) => a - b);
}

/* Agglomera le ascisse dei frammenti nelle colonne che stanno sotto. */
function colonneDaAscisse(frammenti) {
  const col = [];
  for (const x of [...new Set(frammenti.map(f => f.left))].sort((a, b) => a - b))
    if (!col.length || x - col[col.length - 1] > TOLLERANZA_X) col.push(x);
  return col;
}

/* La colonna di un frammento la dice il suo bordo sinistro, che i dati sono
   allineati a sinistra. Tranne i valori numerici, che sono allineati a DESTRA e
   perciò cominciano un po' prima della colonna dichiarata dall'intestazione:
   "17,5 kg" sta a 319 sotto un "Peso" dichiarato a 330, e cadeva nella colonna
   dell'oggetto — dove poi il taglio delle celle fuse lo spezzava, lasciando
   "Ariete portatile 17,5" e un "kg" solo nella colonna del peso.
   Passando anche la larghezza il caso si chiude senza costanti nuove: il
   frammento passa alla colonna dopo se comincia PIÙ VICINO al suo inizio che a
   quello della colonna in cui cadrebbe, e se non la sfonda. "17,5 kg" comincia
   a 11px dal "Peso" dichiarato a 330 e a 218px dall'oggetto: è del peso. Le
   celle di prima colonna cominciano invece esattamente al loro margine, quindi
   non si muovono — regola più stretta di "il centro è già oltre", che spostava
   ogni etichetta più larga di mezza colonna ("Caratteristica", "Contundente").
   Vale anche per una cella FUSA che comincia allineata a destra: "32,5 kg
   1.500 mo" è un frammento solo che copre peso e costo, e chiedergli in più di
   non sfondare la colonna dopo lo bloccava proprio nel caso in cui deve
   spostarsi. Spostato, il taglio delle celle fuse lo divide al confine giusto. */
const indiceColonna = (colonne, x, larg) => {
  let idx = 0;
  for (let n = 0; n < colonne.length; n++) if (x >= colonne[n] - TOLLERANZA_X) idx = n;
  if (larg === undefined) return idx;
  const dopo = colonne[idx + 1];
  return dopo !== undefined && Math.abs(x - dopo) < Math.abs(x - colonne[idx]) ? idx + 1 : idx;
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

/* La divisione di una cella FUSA: tagliaAllAscissa più un aggancio al testo.
   La stima proporzionale presume che i caratteri siano larghi uguale, e sulle
   chiavi non è vero — "2–6 " sono quattro caratteri che occupano i 38px di sei
   di prosa, e in confusione il taglio scivolava di una parola ("2–6 Il" |
   "bersaglio non si muove"). A rimetterlo a posto è la convenzione che regge il
   resto del file: una cella comincia per maiuscola o per cifra, mai a metà
   frase. Se il pezzo di destra apre in minuscola si arretra di una parola —
   una sola, perché l'errore della stima è di una parola, non di mezza riga.
   Vale per le celle e non per le intestazioni: là lo stesso test serve a
   RIFIUTARE un confine sbagliato (raffinaConCelle, "Capacità di trasporto"), e
   agganciare il taglio glielo farebbe passare sempre. */
function dividiCella(testo, left, larg, x) {
  const div = tagliaAllAscissa(testo, left, larg, x);
  if (!div || !PROSEGUE.test(div[1])) return div;
  const indietro = div[0].lastIndexOf(" ");
  if (indietro <= 0) return div;
  return [div[0].slice(0, indietro), div[0].slice(indietro + 1) + " " + div[1]];
}

/* Una cella fusa che copre PIÙ DI DUE colonne. Nelle tabelle di avanzamento
   degli incantatori il PDF emette in un frammento solo lo slot e tutti i
   trattini che seguono ("2 — — — — — — — —", da x=597 a x=815, sopra nove
   colonne): dividiCella stima un confine per volta, e qui ne servirebbero otto
   — la riga usciva con un valore in una cella e sette celle vuote.
   Qui però non si stima niente, perché il CONTO TORNA: le parole sono tante
   quante le colonne coperte, quindi la corrispondenza è un'identità e non
   un'approssimazione. È anche la condizione che rende la regola innocua —
   quando il conto non torna la cella resta fusa com'era, e nessuna tabella già
   pubblicata si muove. */
function dividiSuColonne(colonne, i, left, larg, testo) {
  let fine = i;
  while (colonne[fine + 1] !== undefined && colonne[fine + 1] <= left + larg) fine++;
  if (fine - i < 2) return null;
  const pezzi = testo.split(/\s+/);
  return pezzi.length === fine - i + 1 ? pezzi : null;
}

/* Più frammenti nella stessa cella si accodano con uno spazio, ma non davanti a
   un segno di chiusura: nelle tabelle degli oggetti magici il nome di una
   creatura è in grassetto e il PDF stacca lì il frammento, quindi "elefante" e
   ";  con 2 compare un rinoceronte" arrivano separati e uscivano "elefante ;".
   È lo stesso criterio tipografico di serveSpazio, applicato un piano più su:
   quei due pezzi non si sono ricuciti perché hanno font diversi, non perché
   siano due frasi. Parentesi aperte e virgolette basse restano fuori: quelle lo
   spazio davanti lo vogliono. */
const unisciNellaCella = (avanti, testo) =>
  !avanti ? testo : /^[,;:.!?»)]/.test(testo) ? avanti + testo : avanti + " " + testo;

/* Dispone i frammenti nella griglia delle colonne date. Una riga la cui prima
   cella è vuota non è una riga: è il seguito a capo di quella sopra — nel PDF
   una cella lunga va a capo restando nella sua colonna. */
function grigliaDaFrammenti(frammenti, colonne) {
  const perRiga = [];
  /* Si ordina per COLONNA DI PAGINA e poi per top, che è l'ordine in cui si
     legge: una tabella a cui è finito lo spazio riprende in cima alla colonna
     successiva, quindi le sue ultime righe hanno un top piccolo e con la sola
     coppia pagina+top risalivano in mezzo alle prime — in "Azioni" le voci si
     interlacciavano e le celle si fondevano a due a due.
     Per la stessa ragione due frammenti sono la stessa riga solo se stanno
     nella stessa colonna: alla stessa altezza, nelle due colonne di una pagina,
     ci sono due righe diverse. */
  const ordinati = [...frammenti].sort((a, b) =>
    a.pag - b.pag || a.fascia - b.fascia || a.col - b.col || a.top - b.top || a.left - b.left);
  for (const f of ordinati) {
    const ult = perRiga[perRiga.length - 1];
    if (ult && stessaColonna(ult, f) && Math.abs(ult.top - f.top) <= TOLLERANZA_Y) ult.celle.push(f);
    else perRiga.push({ ...f, celle: [f] });
  }

  /* Il rientro dice "questa riga è il seguito di quella sopra" solo se in questa
     tabella distingue qualcosa. Quando ogni colonna è centrata o allineata a
     destra — "Avanzamento dei personaggi", dove sotto "Livello" c'è "1" e sotto
     "Punti esperienza" c'è "0" — TUTTE le celle cominciano dopo l'inizio della
     loro colonna, e il criterio si mangiava la tabella intera: quindici righe
     impilate in una, coi PE di tutti i livelli in una cella sola.
     Lo si riconosce dalla PRIMA riga di dati, che non può essere il seguito di
     niente: se è rientrata anche lei, il rientro qui è l'impaginazione della
     tabella e non un capoverso. */
  const rientro = ({ celle }) =>
    celle.every(c => c.left - colonne[indiceColonna(colonne, c.left)] > TOLLERANZA_X);
  const rientroParla = perRiga.length > 0 && !rientro(perRiga[0]);

  const righe = [];
  for (const gruppo of perRiga) {
    const { celle } = gruppo;
    const riga = colonne.map(() => "");
    for (const c of celle) {
      const i = indiceColonna(colonne, c.left, c.larg);
      const testo = testoDi(c.span).trim();
      /* Cella che sconfina nella colonna dopo mentre quella colonna, su questa
         riga, non ha frammenti suoi: è una cella fusa dal PDF, si divide.
         Non però se è una riga di SEZIONE, la cui etichetta corre per tutta la
         larghezza della tabella ("Armatura leggera (1 minuto per indossare o
         togliere)"): tagliarla al confine della colonna seguente la spezzava a
         metà, con la coda in una colonna che vuol dire un'altra cosa.
         Il segnale è il corsivo, non la geometria: nel PDF le righe di sezione
         sono in corsivo e al margine della tabella, i dati in tondo e rientrati.
         "Sola sulla riga" non basta a distinguerle — lo sono anche le celle
         davvero fuse ("Contundente Oggetti contundenti, stritolamento, caduta",
         "17 Pietra"), che invece vanno divise. */
      const sezione = celle.length === 1 && c.span.length && c.span.every(s => s.i);
      const seguente = sezione ? undefined : colonne[i + 1];
      const occupata = seguente !== undefined && celle.some(a => a !== c && indiceColonna(colonne, a.left, a.larg) === i + 1);
      /* Prima della divisione a due: se la cella ne copre più di due, il
         confine da stimare non è uno solo. */
      const multiplo = seguente !== undefined && !occupata
        ? dividiSuColonne(colonne, i, c.left, c.larg, testo) : null;
      if (multiplo) {
        multiplo.forEach((p, n) => { riga[i + n] = unisciNellaCella(riga[i + n], p); });
        continue;
      }
      const diviso = seguente !== undefined && !occupata && c.left + c.larg > seguente + TOLLERANZA_X
        ? dividiCella(testo, c.left, c.larg, seguente)
        : null;
      if (diviso) {
        riga[i] = unisciNellaCella(riga[i], diviso[0]);
        riga[i + 1] = unisciNellaCella(riga[i + 1], diviso[1]);
        continue;
      }
      riga[i] = unisciNellaCella(riga[i], testo);
    }
    /* Continuazione a capo: o la prima cella manca, o tutte le celle sono
       rientrate rispetto alla loro colonna (nel PDF il seguito di una cella
       lunga è indentato, quindi la riga non è vuota ma non inizia una voce) —
       e solo dove il rientro dice qualcosa, vedi rientroParla. */
    const rientrata = rientroParla && rientro(gruppo);
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
       sopra è il segnale più forte e vale da sola.
       Nemmeno con una parentesi aperta, che qualifica sempre ciò che precede:
       negli oggetti magici le varianti stanno a capo fra parentesi ("Cintura
       della forza dei giganti" / "(delle colline)", "Pozione di guarigione" /
       "(maggiore)") e uscivano come righe a sé, con le altre colonne vuote. */
    const prosegue = prec && riga.length > 1 && riga[0]
      && (/^[(a-zàèéìòù]/.test(riga[0]) || /[a-zàèéìòù]-$/.test(prec[0]));

    if (prec && (!riga[0] || rientrata || prosegue)) {
      for (let i = 0; i < riga.length; i++) {
        if (!riga[i]) continue;
        prec[i] = /[a-zàèéìòù]-$/.test(prec[i]) ? prec[i].slice(0, -1) + riga[i] : (prec[i] + " " + riga[i]).trim();
      }
    } else righe.push(riga);
  }
  return righe;
}

/* Riquadro a coppie etichetta/valore: gli strumenti di Equipaggiamento
   ("Caratteristica: Intelligenza / Utilizzo: … / Creazione: … / Peso: 4 kg") e,
   con altre etichette, le schede degli incantesimi.
 *
 * NON è una griglia, benché ne abbia l'aspetto: la prima riga affianca due
 * coppie ("Caratteristica: X" a sinistra, "Peso: Y" a destra) e da lì il
 * rilevatore di colonne deduceva due colonne, incolonnandoci poi anche le righe
 * di continuazione — che sono prosa andata a capo, non celle. Il risultato erano
 * valori scambiati fra le etichette ("Utilizzo:" con dentro la seconda metà di
 * un'altra voce).
 *
 * Il riconoscimento non è geometrico ma tipografico, come tutto il resto qui:
 * l'etichetta è nel font delle intestazioni di cella (GillSans-SemiBold 14) e
 * finisce coi due punti, il valore è GillSans normale. Le ascisse non servono —
 * le righe arrivano già in ordine di lettura, quindi ogni riga di valore
 * appartiene all'ultima etichetta vista, anche a cavallo di un cambio colonna.
 *
 * Va riconosciuto PRIMA di grigliaLibera, che altrimenti se lo prende. */
const ETICHETTA = /^[^\s:][^:]{0,30}:$/;

function scheda(righe, k) {
  if (righe[k].ruolo !== "intestazione-cella") return null;
  if (!ETICHETTA.test(testoDi(righe[k].span).trim())) return null;

  let fine = k;
  while (fine < righe.length && (righe[fine].ruolo === "gill" || righe[fine].ruolo === "intestazione-cella")) fine++;

  const voci = [];
  for (const r of righe.slice(k, fine)) {
    const testo = testoDi(r.span).trim();
    if (r.ruolo === "intestazione-cella" && ETICHETTA.test(testo)) {
      voci.push({ nome: testo.slice(0, -1), testo: [] });
      continue;
    }
    accoda(voci[voci.length - 1].testo, r.span);
  }

  /* Una coppia sola non è un riquadro (e un'etichetta senza valore vuol dire
     che quello che stiamo leggendo non è fatto così): meglio ricadere sulla
     griglia, che almeno non inventa una forma. */
  if (voci.length < 2 || voci.some(v => !testoDi(v.testo).trim())) return null;
  for (const v of voci) v.testo = ripulisci(v.testo);
  return { blocco: { t: "scheda", voci }, fine };
}

/* Il pallino apre una voce di elenco. Si toglie dal testo — nella pagina lo
   rimette la lista — ma la voce resta un array di span: nei riquadri degli
   oggetti magici le voci sono nomi di incantesimo in corsivo, e ridurle a
   stringa perderebbe il corsivo insieme al pallino. */
const aprePunto = span => /^\s*•/.test(testoDi(span));
const senzaPallino = span => {
  const out = span.map(s => ({ ...s }));
  out[0].s = out[0].s.replace(/^\s*•\s*/, "");
  return out;
};

/* Elenco puntato: le voci aprono col pallino al margine, i capoversi sono
   rientrati. Va riconosciuto prima delle griglie, sennò il rientro dei
   capoversi passa per una seconda colonna. */
function puntato(righe, k) {
  let fine = k;
  while (fine < righe.length && righe[fine].ruolo === "gill") fine++;
  const frammenti = righe.slice(k, fine);
  if (frammenti.filter(f => aprePunto(f.span)).length < 2) return null;

  const voci = [];
  for (const f of frammenti) {
    if (aprePunto(f.span)) voci.push(senzaPallino(f.span));
    else if (voci.length) accoda(voci[voci.length - 1], f.span);
  }
  return { blocco: { t: "punti", voci: voci.map(ripulisci).filter(v => testoDi(v).trim()) }, fine };
}

/* Le righe visive di un blocco: i frammenti arrivano già in ordine di lettura,
   quindi basta accorparli finché il top non cambia. Di ogni riga interessano
   solo i due bordi, che è ciò su cui si misura l'allineamento. */
function righeVisive(run) {
  const linee = [];
  for (const r of run) {
    const u = linee[linee.length - 1];
    if (u && r.pag === u.pag && Math.abs(r.top - u.top) <= TOLLERANZA_Y) {
      u.sin = Math.min(u.sin, r.left);
      u.des = Math.max(u.des, r.left + r.larg);
    } else linee.push({ pag: r.pag, top: r.top, sin: r.left, des: r.left + r.larg });
  }
  return linee;
}

const ASSE = 6;   // px entro cui due righe visive sono centrate sullo stesso asse

/* Composto centrato: ogni riga visiva ha lo stesso asse e i bordi sinistri no.
   Una griglia è allineata a sinistra dentro le sue colonne, quindi o i centri
   ballano o le sinistre coincidono — il testo centrato è l'unico caso in cui
   capita il contrario. Serve a distinguere un riquadro di formula da una
   tabella a due colonne, che ha la stessa geometria a occhio. */
function centrato(run) {
  const linee = righeVisive(run);
  if (linee.length < 2) return false;
  const centri = linee.map(l => (l.sin + l.des) / 2);
  return Math.max(...centri) - Math.min(...centri) <= ASSE
    && new Set(linee.map(l => l.sin)).size > 1;
}

/* Il riquadro di una formula: "CD del tiro salvezza sull'incantesimo = 8 + il
   modificatore di caratteristica da incantatore dell'incantatore + il bonus di
   competenza", che è UNA frase impaginata su tre righe centrate. Sia tabella()
   sia grigliaLibera() lo prendevano per una tabella a due colonne — etichetta in
   grassetto a sinistra, valore a destra — e ne incolonnavano le righe di
   continuazione, lasciando i trattini di sillabazione in mezzo alle parole.
 *
 * Lo riconoscono due segnali insieme, che da soli non bastano:
 *
 * - la composizione CENTRATA (vedi `centrato`). Non basta perché anche la
 *   tabella "Taglia | Acqua" del glossario è un blocco centrato.
 * - il grassetto che intitola UNA volta sola, lo stesso discriminante di
 *   tabella(): se ricompare più in basso è una colonna di chiavi. Qui in più
 *   deve aprire una riga visiva — se il grassetto ricompare sulla stessa riga
 *   sono le intestazioni affiancate di una griglia ("Taglia | Acqua | Taglia |
 *   Acqua"), non due riquadri.
 *
 * Due riquadri di fila si spezzano sul grassetto, che è come li impagina
 * "Creazione del personaggio": lì i quattro riquadri stanno a due a due dentro
 * lo stesso blocco di righe. */
function riquadroDiProsa(righe, k) {
  let fine = k;
  while (fine < righe.length && (righe[fine].ruolo === "gill" || righe[fine].ruolo === "intestazione-cella")) fine++;
  const run = righe.slice(k, fine);
  if (run.length < 3) return null;

  const apreRiga = n => n === 0 || run[n].pag !== run[n - 1].pag
    || Math.abs(run[n].top - run[n - 1].top) > TOLLERANZA_Y;
  const grassetti = run.flatMap((r, n) => r.ruolo === "intestazione-cella" ? [n] : []);
  if (grassetti[0] !== 0 || !grassetti.every(apreRiga)) return null;

  const blocchi = [];
  for (const [n, inizio] of grassetti.entries()) {
    const pezzo = run.slice(inizio, grassetti[n + 1] ?? run.length);
    if (!centrato(pezzo)) return null;
    const testo = [...pezzo[0].span];
    for (const r of pezzo.slice(1)) accoda(testo, r.span);
    blocchi.push({ t: "p", testo: ripulisci(testo) });
  }
  return { blocchi, fine };
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
      if (u && SILLABATA.test(u) && PROSEGUE.test(v)) unite[unite.length - 1] = u.slice(0, -1) + v;
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
  /* Dentro le descrizioni degli incantesimi le tabelle non hanno didascalia: la
     prosa le annuncia ("consultando la tabella sottostante") e la struttura la
     dichiara la sola riga di intestazione. Sono tabelle a tutti gli effetti —
     lasciarle a grigliaLibera le riduceva a coppie chiave/valore e ne
     rimescolava le celle, perdendo e duplicando testo. */
  const senzaDidascalia = cap.ruolo === "intestazione-cella";
  if (cap.ruolo !== "didascalia" && !senzaDidascalia) return null;

  /* La didascalia può andare a capo ("Incantatore multiclasse:" / "slot
     incantesimo per livello di incantesimo"). La seconda riga è nel font delle
     didascalie e non in quello delle intestazioni, quindi finiva fra i titoli di
     colonna — un frammento largo quanto tutta la tabella, che li fondeva tutti
     in uno solo: la tabella degli slot multiclasse usciva a due colonne invece
     di dieci.
     Va a capo, non di fianco: due didascalie sulla stessa riga visiva sono due
     tabelle affiancate (Temperatura e Vento in "controllare il clima"), e sono
     gli unici due casi del PDF. */
  let ultimaCap = k;
  while (!senzaDidascalia && righe[ultimaCap + 1]?.ruolo === "didascalia"
    && righe[ultimaCap + 1].pag === righe[ultimaCap].pag
    && !stessaRigaVisiva(righe[ultimaCap], righe[ultimaCap + 1])
    && righe[ultimaCap + 1].top - righe[ultimaCap].top <= SALTO_BANDA) ultimaCap++;
  const didascalia = righe.slice(k, ultimaCap + 1)
    .map(r => testoDi(r.span).trim()).join(" ");
  /* Le righe di intestazione si raccolgono guardando FIN DOVE arrivano, invece
     di fermarsi al primo font inatteso: in "Terreno di viaggio" solo "Terreno" e
     "Passo massimo" sono nel font delle intestazioni, mentre "Distanza degli
     incontri" e "CD per foraggiare" sono in GillSans normale come i dati. Ci si
     ferma all'ultima riga che contiene *almeno un* frammento d'intestazione:
     tutto ciò che sta fra la didascalia e quella riga è intestazione anche se
     il PDF non lo dice col font. */
  /* …ma il font da solo non basta: in "Strati prismatici" le celle si aprono
     con un attacco in grassetto nello STESSO font dei titoli ("1 | Rosso.
     Tiro salvezza fallito…"), e prendendolo per intestazione la tabella
     usciva a brandelli — tre colonne inventate, il testo rimescolato.
     Il discriminante è la PUNTEGGIATURA FINALE, la stessa convenzione con cui
     il documento apre le definizioni in mezzo alla prosa (vedi
     forseDefinizione): un titolo di colonna non finisce con un segno, il
     grassetto dentro una cella sì. Col punto sono gli attacchi di cella; con
     la virgola sono le chiavi degli elenchi annidati negli oggetti magici
     ("con 4, il Piano dell'Acqua; con 5, la Selva Fatata"), che quando cadono a
     inizio di riga visiva aprono una riga per conto loro e, prese per
     intestazioni, troncavano la tabella a metà cella.
     Il confronto esclude i puntini di sospensione, che invece un titolo può
     avere ("L'incantatore conosce il bersaglio in maniera..." in Scrutare). */
  const attaccoDiCella = r => /[^.][.,]$/.test(testoDi(r.span).trim());
  let ultima = -1;
  for (let j = senzaDidascalia ? k : ultimaCap + 1; j < righe.length && righe[j].pag === cap.pag
       && righe[j].top - cap.top <= 80; j++)
    if (righe[j].ruolo === "intestazione-cella" && !attaccoDiCella(righe[j])) ultima = j;
  if (ultima < 0) return null;

  /* …e poi fino in fondo alla sua riga VISIVA: i frammenti sono già ordinati per
     top e left, quindi le altre intestazioni della stessa riga ("Distanza degli
     incontri", "CD per cercare") vengono dopo l'ultima marcata dal font. Senza
     questo finivano fra le celle e le loro ascisse inventavano quattro colonne
     in più, una per ogni titolo. */
  while (ultima + 1 < righe.length && righe[ultima + 1].pag === righe[ultima].pag
    && Math.abs(righe[ultima + 1].top - righe[ultima].top) <= TOLLERANZA_Y) ultima++;

  let i = senzaDidascalia ? k : ultimaCap + 1;
  const intest = [];
  while (i <= ultima) { intest.push(righe[i]); i++; }

  /* Senza didascalia il font delle intestazioni è l'unico segnale, e da solo
     non distingue una tabella da una griglia chiave/valore (la scheda di una
     creatura evocata: "CA | 15", "PF | 10…", una chiave in grassetto PER OGNI
     riga). Il discriminante è che una tabella intitola le colonne UNA volta
     sola: se il grassetto ricompare più in basso, non è un'intestazione ma una
     colonna di chiavi, e la si lascia a grigliaLibera com'era. */
  if (senzaDidascalia) {
    if (intest.some(r => Math.abs(r.top - intest[0].top) > TOLLERANZA_Y)) return null;
    if (righe[i]?.ruolo !== "gill") return null;
  }

  /* Una tabella lunga prosegue nella pagina successiva, e lì il PDF RIPETE la
     riga di intestazione senza ripetere la didascalia. Quel blocco di
     intestazioni interrompeva la raccolta delle celle: la coda della tabella
     (in "Armi" tutti gli spadoni e le armi a distanza da guerra) usciva come
     griglia a sé, con le colonne ridedotte da capo su un campione più povero.
     Si riconosce perché ripete le STESSE intestazioni — non è una tabella
     nuova, è la stessa che continua — e si salta, riprendendo a raccogliere
     celle con la geometria già dichiarata dalla didascalia. */
  const firma = r => r.map(x => testoDi(x.span).trim().toLowerCase()).filter(Boolean).sort().join("|");
  const miaFirma = firma(intest);

  /* Un attacco di cella in grassetto ("Rosso.") è una CELLA, non la fine della
     tabella: fermandosi lì "Strati prismatici" si chiudeva dopo una riga e i
     sei strati restanti finivano in una griglia a parte, rimescolati.
   *
   * L'altra cella in grassetto senza punteggiatura che la denunci è il nome di
   * una creatura: negli oggetti magici il PDF li compone in GillSans-SemiBold
   * anche dentro le tabelle ("45–51 | Un cavallo da galoppo dotato di sella",
   * "compare un elefante; con 2 compare un rinoceronte"). Il segnale è che il
   * grassetto è ATTACCATO a del testo normale sulla stessa riga visiva: sono
   * due frammenti che si sarebbero ricuciti se non fosse per il font, cioè una
   * frase sola. La tabella della tunica delle toppe si troncava lì a metà e il
   * seguito ripartiva come tabella nuova, intitolata col nome del cavallo.
   *
   * A discriminare è la DISTANZA, non la direzione: in una griglia a chiave
   * grassa ("Caratteristiche primarie | Forza", i tratti di ogni classe) il
   * valore sta in un'altra colonna, a decine di pixel, e la chiave resta una
   * chiave. Chiedere solo "c'è del testo normale sulla stessa riga" faceva
   * diventare tabelle quelle griglie, con le chiavi impilate nell'intestazione.
   *
   * In nessun caso questo test può decidere dove FINISCONO le intestazioni: in
   * "Terreno di viaggio" metà dei titoli è in GillSans normale sulla stessa
   * riga visiva. Dopo le intestazioni però la domanda è un'altra — non "dove
   * finisce il cappello" ma "questa riga è una cella" — e lì vale. */
  const attaccate = (a, b) => stessaRigaVisiva(a, b) && b.left - (a.left + a.larg) < ATTACCATI;
  const dentroUnaCella = k =>
    (righe[k - 1]?.ruolo === "gill" && attaccate(righe[k - 1], righe[k]))
    || (righe[k + 1]?.ruolo === "gill" && attaccate(righe[k], righe[k + 1]));
  const eCella = k => righe[k].ruolo === "gill"
    || (righe[k].ruolo === "intestazione-cella" && (attaccoDiCella(righe[k]) || dentroUnaCella(k)));

  const celle = [];
  let scarto = 0;      // traslazione della coda rispetto alle colonne dichiarate
  for (;;) {
    while (i < righe.length && eCella(i)) {
      const r = righe[i++];
      celle.push(scarto ? { ...r, left: r.left - scarto } : r);
    }
    let j = i;
    const ripetute = [];
    while (j < righe.length && righe[j].ruolo === "intestazione-cella"
      && !attaccoDiCella(righe[j])) ripetute.push(righe[j++]);
    if (!ripetute.length || firma(ripetute) !== miaFirma) break;
    if (j >= righe.length || !eCella(j)) break;   // intestazioni senza celle: non è una coda
    /* Una coda è una tabella a cui è finito lo SPAZIO: le celle di prima
       arrivano in fondo alla loro colonna e le intestazioni ripetute aprono la
       successiva. Il confine non è la pagina — "Monili" è un d100 che riprende
       tre volte, due delle quali nella colonna accanto della stessa pagina, e
       usciva in quattro tabelle di cui tre senza titolo. Non è nemmeno una
       misura in pixel: lo dicono le righe stesse, che sotto l'ultima cella e
       sopra le intestazioni ripetute non ne hanno altre nella loro colonna.
       Serve tutt'e due: in "Azioni" le intestazioni si ripetono a metà della
       colonna destra, con della prosa sopra, e lì la tabella nuova comincia
       davvero. */
    const apreLaColonna = r => !righe.some(a => stessaColonna(a, r) && a.top < r.top - TOLLERANZA_Y);
    const chiudeLaColonna = r => !righe.some(a => stessaColonna(a, r) && a.top > r.top + TOLLERANZA_Y);
    if (!apreLaColonna(ripetute[0]) || !chiudeLaColonna(celle[celle.length - 1])) break;

    /* La coda può ricominciare in un'ALTRA colonna di pagina: "Budget di PE"
       sta nella colonna destra di p. 229 e riprende nella sinistra di p. 230,
       coi livelli 11-20 a ~350px più a sinistra. Con le ascisse di prima
       finivano tutti nella prima colonna, ogni riga restava piena per un quarto
       e lo spoglio delle note a piè di tabella se le portava via una per una,
       come paragrafi. Le intestazioni ripetute sono la stessa riga di prima:
       la loro traslazione è lo scarto da togliere alle celle che seguono. */
    const sin = r => Math.min(...r.map(x => x.left));
    scarto = sin(ripetute) - sin(intest);
    i = j;
  }
  if (!celle.length) return null;

  /* Le intestazioni di raggruppamento ("—— Difficoltà del combattimento ——",
     che sovrasta Facile/Media/Difficile) non sono colonne: coprono più colonne
     e il PDF le marca coi trattini di riempimento. Vanno tolte PRIMA di dedurre
     la struttura, non solo prima di assegnare i titoli: una sola di queste si
     sovrappone a tutte le colonne che sovrasta e le fonde in una — "Budget di
     PE" collassava in due colonne con dieci livelli in una cella. */
  const raggruppamento = r => /^[—–]|[—–]$/.test(testoDi(r.span).trim());
  const titolari = intest.filter(r => !raggruppamento(r));

  /* Le colonne le dettano le INTESTAZIONI, raggruppate per sovrapposizione:
     sono poche, e una tabella dichiara lì la sua struttura. Le celle no —
     numeri allineati a destra e testi rientrati producono ascisse sparse, e
     ogni ascissa in più è una colonna in più. */
  const gruppi = colonneDaIntervalli(titolari);
  /* Quando il PDF fonde TUTTE le intestazioni in un frammento solo ("Ordine
     Effetti") non resta che dedurre le colonne dalle celle. Ma le ascisse delle
     celle sono più di quelle vere — testi rientrati, numeri allineati a destra,
     chiavi corte centrate nella loro colonna — e in "Strati prismatici" ogni
     riga di testo finiva in una colonna diversa. Servono due vincoli.
   *
   * QUANTE: le dichiara il titolo, contando le parole che possono esserlo, cioè
   * quelle che cominciano per maiuscola o cifra. È la stessa regola di
   * raffinaConCelle applicata al caso di titolo unico. Il conteggio nudo delle
   * parole non basta: "1d10 Comportamento per il turno" ne ha cinque ma dichiara
   * due colonne, e le tre di troppo lasciavano passare l'ascissa spuria.
   *
   * QUALI: quelle con più celle sotto. La prima si tiene comunque, che è il
   * margine della tabella; fra le altre vince chi ne raccoglie di più. In
   * confusione le candidate sono x=102 (le celle fuse "9–10 Il bersaglio…"),
   * x=113 (la sola chiave "1", centrata nella stessa colonna) e x=143 (otto
   * righe di testo): tenere le prime due — che è ciò che faceva un taglio in
   * testa all'elenco — dava una colonna senza titolo e tutto il testo nell'altra. */
  let colonne;
  if (gruppi.length < 2) {
    const dedotte = colonneDaAscisse(celle);
    const quante = testoDi(titolari[0].span).trim().split(/\s+/)
      .filter(p => /^[A-ZÀ-Ý0-9]/.test(p)).length;
    const scelte = dedotte
      .map((x, n) => ({ x, sotto: celle.filter(c => indiceColonna(dedotte, c.left) === n).length }))
      .slice(1)
      .sort((a, b) => b.sotto - a.sotto)
      .slice(0, Math.max(0, quante - 1))
      .map(s => s.x);
    colonne = dedotte.slice(0, 1).concat(scelte).sort((a, b) => a - b);
  } else colonne = raffinaConCelle(gruppi, titolari, celle);

  const titoli = colonne.map(() => "");
  for (const r of [...titolari].sort((a, b) => a.top - b.top || a.left - b.left)) {
    /* L'intestazione si assegna col suo CENTRO, la cella col suo bordo sinistro:
       i dati sono allineati a sinistra, i titoli spesso centrati sulla colonna,
       e "CD del" (x=380) inizia a sinistra della colonna dei numeri (x=391) pur
       appartenendole — col bordo finiva nella colonna degli esempi. */
    const testo = testoDi(r.span).trim();

    /* Un'intestazione che si estende su più colonne è un frammento fuso dal PDF
       ("Peso Costo"): si taglia alle ascisse delle colonne che attraversa,
       arrotondando allo spazio più vicino, invece di finire tutta nella prima. */
    const da = indiceColonna(colonne, r.left + 1);
    const a = indiceColonna(colonne, r.left + r.larg - 1);
    if (a > da) {
      let resto = testo, x = r.left, larg = r.larg, tagliato = true;
      for (let n = da; n < a && tagliato; n++) {
        const div = tagliaAllAscissa(resto, x, larg, colonne[n + 1]);
        if (!div) { tagliato = false; break; }
        titoli[n] = (titoli[n] ? titoli[n] + " " : "") + div[0];
        [resto, larg, x] = [div[1], x + larg - colonne[n + 1], colonne[n + 1]];
      }
      if (tagliato) { titoli[a] = (titoli[a] ? titoli[a] + " " : "") + resto; continue; }
    }

    const idx = indiceColonna(colonne, r.left + r.larg / 2);   // su più righe: si concatena
    titoli[idx] = (titoli[idx] ? titoli[idx] + " " : "") + testo;
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

  /* I confini di troppo si richiudono guardando il RISULTATO, non la geometria:
     il raffinamento qui sopra apre un confine ogni volta che un valore più largo
     comincia più a sinistra ("1.000" e "Variabile" contro "25 mo"), e inseguire
     ogni allineamento del PDF è una battaglia persa.
     Il criterio è: due colonne adiacenti che quasi mai sono piene nella stessa
     riga non sono due colonne. Se lo fossero, le righe le userebbero entrambe —
     sono invece un'unica colonna i cui valori, allineati a destra, cadono ora di
     qua ora di là del confine. "Quasi" e non "mai": su quaranta righe ne basta
     una storta per bloccare la fusione, e allora la colonna resta spaccata.
     Si richiede che almeno una delle due non abbia titolo: due colonne che il
     PDF dichiara restano distinte anche se qui non capita che coesistano. */
  const SOGLIA_COESISTENZA = 0.05;
  for (let n = titoli.length - 2; n >= 0; n--) {
    if (titoli[n].trim() && titoli[n + 1].trim()) continue;
    const insieme = griglia.filter(r => r[n]?.trim() && r[n + 1]?.trim()).length;
    if (insieme > griglia.length * SOGLIA_COESISTENZA) continue;
    for (const r of griglia) {
      r[n] = [r[n]?.trim(), r[n + 1]?.trim()].filter(Boolean).join(" ");
      r.splice(n + 1, 1);
    }
    titoli[n] = titoli[n].trim() || titoli[n + 1].trim();
    titoli.splice(n + 1, 1);
  }

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
      /* Senza didascalia il titolo è vuoto: `cap` è la riga di intestazione,
         e prenderlo per titolo ripeteva la prima colonna sopra la tabella. */
      { t: "tabella", titolo: senzaDidascalia ? "" : didascalia, colonne: titoli, righe: griglia },
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
    if (corrente.t === "punti") {
      corrente.voci = corrente.voci.map(ripulisci).filter(v => testoDi(v).trim());
      if (corrente.voci.length) blocchi.push(corrente);
      corrente = null;
      return;
    }
    corrente.testo = ripulisci(corrente.testo);
    /* Seconda occasione per riconoscere una definizione: il nome può stare a
       cavallo di due righe, e sulla prima la corsa di grassetto non ha ancora
       il punto finale che la chiude. Ora il paragrafo è intero. */
    if (corrente.t === "p") corrente = forseDefinizione(corrente.testo) || corrente;
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
      /* Una didascalia che non apre una tabella può aprire una GRIGLIA: il
         riquadro "Tratti del <classe>" è una griglia chiave/valore — le chiavi
         in grassetto e nessuna riga di intestazione, quindi `tabella` non la
         riconosce — e la sua didascalia restava orfana, un paragrafo in
         grassetto sopra una tabella senza nome, dodici volte nel capitolo. */
      const gr = grigliaLibera(righe, k + 1);
      if (gr && gr.blocchi.length === 1 && gr.blocchi[0].t === "griglia") {
        chiudi();
        blocchi.push({ ...gr.blocchi[0], titolo: testoDi(r.span).trim() });
        k = gr.fine - 1;
        continue;
      }
    }

    if (r.ruolo === "gill" || r.ruolo === "intestazione-cella") {
      const sch = scheda(righe, k);
      if (sch) { chiudi(); blocchi.push(sch.blocco); k = sch.fine - 1; continue; }
      const pt = puntato(righe, k);
      if (pt) { chiudi(); blocchi.push(pt.blocco); k = pt.fine - 1; continue; }
      /* Prima delle griglie: un riquadro di formula ne ha la geometria e se lo
         prenderebbero entrambe, spezzando la frase in celle. */
      const riq = riquadroDiProsa(righe, k);
      if (riq) { chiudi(); blocchi.push(...riq.blocchi); k = riq.fine - 1; continue; }
      /* Prima di grigliaLibera: una tabella senza didascalia si riconosce dalla
         riga di intestazione, e grigliaLibera la accetterebbe comunque. */
      const tab2 = tabella(righe, k);
      if (tab2) { chiudi(); blocchi.push(...tab2.blocchi); k = tab2.fine - 1; continue; }
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
    const rompe = apreDefinizione(righe, k) || !corrente || salto > PASSO_RIGA;

    /* Un pallino apre sempre una voce. Nella prosa gli elenchi hanno il passo
       di riga normale — il PDF non stacca le voci una dall'altra — quindi il
       salto verticale non le separava e finivano incollate in un paragrafo
       solo: "• Chi è la tua famiglia? • Chi era il tuo più caro amico
       d'infanzia? • …". Le righe di continuazione, che il pallino non ce
       l'hanno, proseguono la voce aperta come farebbero in un paragrafo. */
    if (aprePunto(r.span)) {
      if (rompe || corrente.t !== "punti") { chiudi(); corrente = { t: "punti", voci: [] }; }
      corrente.voci.push(senzaPallino(r.span));
      continue;
    }
    if (corrente && corrente.t === "punti" && !rompe) {
      accoda(corrente.voci[corrente.voci.length - 1], r.span);
      continue;
    }

    if (rompe) {
      chiudi();
      corrente = { t: "p", testo: [...r.span] };
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

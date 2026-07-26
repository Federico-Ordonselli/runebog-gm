#!/usr/bin/env node
/* Verifica i rapporti di contrasto WCAG di TUTTI i temi di public/themes.css.

   Perché esiste: i temi si giudicano a occhio finché non sono cinque, e a
   dodici non si giudicano più — un accento che su Torbiera brilla, su
   Pergamena è a 3:1 e nessuno se ne accorge finché non prova quel tema con
   quella schermata. Qui il giudizio è un numero, e vale per tutti i temi
   insieme: chi ne aggiunge uno lo sa prima di pubblicarlo, non dopo.

   Come si usa:
     node scripts/verifica-contrasto.mjs            → tutti i temi
     node scripts/verifica-contrasto.mjs sottosuolo → un tema solo
   Esce con codice 1 se una coppia sta sotto la sua soglia, così può stare
   in CI il giorno che serve.

   Le COPPIE qui sotto sono quelle che l'interfaccia usa DAVVERO, ognuna
   trovata nel CSS e non immaginata: se ne aggiungi una, cita dove sta.
   Quello che questo script NON vede: il testo dentro le immagini, i
   gradienti (il fondo del sito è un radial-gradient fra --glow e --peat:
   qui si misura --peat, che è l'estremo peggiore), e l'opacità applicata
   dai componenti — .terr-mark disegna al 50%, e lì il contrasto vero è
   metà di quello riportato. Sono limiti, non sviste. */

import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../public/themes.css", import.meta.url), "utf8")
  // I commenti nominano dei token ("--ember-deep: il bianco regge…") e senza
  // toglierli il lettore ci casca: --on-ember spariva e --ember-deep usciva
  // spazzatura, cioè lo script taceva proprio sulla coppia che deve guardare.
  .replace(/\/\*[\s\S]*?\*\//g, "");

/* Il tema base è :root, e gli altri lo ereditano: un blocco che non
   ridichiara --track lo prende da lì, ed è una scelta esplicita di
   themes.css (i temi scuri se lo passano). Quindi la risoluzione ha due
   livelli, e var(--x) va seguito perché --moss-hov è definito così. */
function blocchi(css){
  const out = {};
  const re = /(:root|\[data-theme="([\w-]+)"\])\s*\{([^}]*)\}/g;
  let m;
  while((m = re.exec(css))){
    const nome = m[2] || "torbiera";
    const vars = out[nome] || (out[nome] = {});
    for(const v of m[3].matchAll(/(--[\w-]+):\s*([^;]+);/g)) vars[v[1]] = v[2].trim();
  }
  return out;
}
const B = blocchi(css);
const base = B.torbiera;

function risolvi(tema, chiave, prof = 0){
  const v = (B[tema][chiave] ?? base[chiave] ?? "").trim();
  if(prof > 4) return null;
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  if(m) return risolvi(tema, m[1], prof + 1);
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
}

const luminanza = hex => {
  const c = [1,3,5].map(i => parseInt(hex.slice(i, i+2), 16) / 255)
    .map(x => x <= 0.03928 ? x/12.92 : ((x + 0.055)/1.055) ** 2.4);
  return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
};
const rapporto = (a, b) => {
  const [alto, basso] = [luminanza(a), luminanza(b)].sort((p, q) => q - p);
  return (alto + 0.05) / (basso + 0.05);
};

/* 4.5 = testo normale (WCAG AA 1.4.3), 3 = contorni di componenti e testo
   grande (1.4.11). Dove la soglia è 3 su del testo, è perché quel testo è
   grande davvero — non per farla passare. */
const COPPIE = [
  ["--parchment",      "--peat",        4.5, "testo su fondo"],
  ["--parchment",      "--surface",     4.5, "testo su pannello"],
  ["--parchment-dim",  "--surface",     4.5, "testo smorzato su pannello"],
  // il placeholder dei campi: il commento in themes.css lo impone su --peat-sunk
  ["--parchment-mute", "--peat-sunk",   4.5, "placeholder nei campi"],
  ["--moss",           "--peat",        4.5, "accento su fondo"],
  ["--moss",           "--surface",     4.5, "accento su pannello"],
  // app.css: nav.tabs button.active, #ctx-menu button:hover, .pal-item.armed
  ["--moss",           "--surface-hi",  4.5, "accento sul pannello rialzato"],
  ["--wisp",           "--surface",     4.5, "link su pannello"],
  // srd.css: a.srd-capitoli__link:hover .srd-capitoli__titolo
  ["--wisp-lit",       "--surface-hov", 4.5, "titolo del capitolo in hover"],
  ["--lantern",        "--surface",     4.5, "evidenza su pannello"],
  ["--ember",          "--surface",     4.5, "distruttivo su pannello"],
  ["--arcane",         "--surface",     4.5, "arcano su pannello"],
  ["--on-ember",       "--ember-deep",  4.5, "testo sul bottone distruttivo"],
  ["--edge",           "--surface",     3,   "bordo su pannello"],
  ["--edge-lit",       "--surface",     3,   "bordo acceso su pannello"],
  ["--track",          "--peat",        3,   "strada sulla mappa"],
  ["--tunnel",         "--peat",        3,   "tunnel sulla mappa"],
  ["--dg-trap",        "--peat",        3,   "trappola sulla mappa"],
  ["--dg-lair",        "--peat",        3,   "tana sulla mappa"],
];

/* Le cinque famiglie devono restare DISTINGUIBILI fra loro, che è una
   domanda diversa dal contrasto sul fondo: un tema in cui accento e
   distruttivo sono lo stesso rosso passa tutte le soglie qui sopra e
   resta inservibile.

   Il rapporto WCAG qui NON serve, ed è stato provato e scartato: misura la
   luminanza, quindi dava per "uguali" un verde e un ciano della stessa
   chiarezza — 110 avvisi su temi che vanno benissimo, cioè rumore che
   avrebbe insegnato a ignorare l'avviso. Serve una distanza di COLORE:
   ΔE in Lab (CIE76, che per questo scopo basta).

   La soglia non è scelta, è MISURATA sui cinque temi originali: la coppia
   più vicina che esiste già è il rame e l'oro di Brace (ΔE 17,4), e il file
   dei temi la dichiara consapevolmente. Quindi 17 vuol dire "non peggio del
   caso peggiore già accettato". È un avviso e non un errore: due famiglie
   vicine si possono tenere, come fa Brace, ma dicendolo. */
const FAMIGLIE = ["--moss", "--wisp", "--lantern", "--ember", "--arcane"];
const VICINI = 17;

const lab = hex => {
  const [r, g, b] = [1,3,5].map(i => parseInt(hex.slice(i, i+2), 16) / 255)
    .map(x => x <= 0.03928 ? x/12.92 : ((x + 0.055)/1.055) ** 2.4);
  let X = (0.4124*r + 0.3576*g + 0.1805*b) / 0.95047;
  let Y =  0.2126*r + 0.7152*g + 0.0722*b;
  let Z = (0.0193*r + 0.1192*g + 0.9505*b) / 1.08883;
  const f = t => t > 0.008856 ? Math.cbrt(t) : 7.787*t + 16/116;
  [X, Y, Z] = [f(X), f(Y), f(Z)];
  return [116*Y - 16, 500*(X - Y), 200*(Y - Z)];
};
const distanza = (a, b) => {
  const [p, q] = [lab(a), lab(b)];
  return Math.hypot(p[0]-q[0], p[1]-q[1], p[2]-q[2]);
};

const soloQuesto = process.argv[2];
let guasti = 0, avvisi = 0;

for(const tema of Object.keys(B)){
  if(soloQuesto && tema !== soloQuesto) continue;
  const righe = [];
  for(const [a, b, soglia, cosa] of COPPIE){
    const [x, y] = [risolvi(tema, a), risolvi(tema, b)];
    if(!x || !y){ righe.push(`  ?              ${cosa}  (${a}/${b} non risolti)`); guasti++; continue; }
    const r = rapporto(x, y);
    if(r < soglia) guasti++;
    righe.push(`  ${r >= soglia ? "ok" : "NO"}  ${r.toFixed(2).padStart(5)}:1  (min ${soglia})  ${cosa}`);
  }
  for(let i = 0; i < FAMIGLIE.length; i++)
    for(let j = i + 1; j < FAMIGLIE.length; j++){
      const [x, y] = [risolvi(tema, FAMIGLIE[i]), risolvi(tema, FAMIGLIE[j])];
      if(!x || !y) continue;
      const d = distanza(x, y);
      if(d < VICINI){
        avvisi++;
        righe.push(`  ~~  ΔE ${d.toFixed(1).padStart(4)}  (min ${VICINI})  ${FAMIGLIE[i]} e ${FAMIGLIE[j]} si somigliano`);
      }
    }
  console.log(`\n=== ${tema} ===`);
  console.log(righe.join("\n"));
}

console.log(`\ncoppie sotto soglia: ${guasti}${avvisi ? `, famiglie vicine: ${avvisi}` : ""}`);
process.exit(guasti ? 1 : 0);

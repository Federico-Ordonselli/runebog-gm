/* Estrae il bestiario dall'SRD 5.2.1 in italiano (PDF ufficiale CC-BY-4.0) e
   rigenera public/app/srd-mostri.js. Uso:

     node scripts/estrai-srd-mostri.mjs percorso/IT_SRD_CC_v5.2.1.pdf

   Il PDF non è nel repo (9 MB): https://media.dndbeyond.com/compendium-images/srd/5.2/IT_SRD_CC_v5.2.1.pdf
   Richiede `pdftohtml` (poppler). Le schede mostro stanno alle pagine 294–405
   (Mostri A–Z + Animali).

   Strategia: pdftohtml -xml conserva font e posizione di ogni frammento di testo.
   La semantica sta nei font, non nel testo: #88191f taglia 23 = titolo di scheda,
   taglia 18 = sezione (Tratti/Azioni/…), Optima #4a0508 = righe statistiche
   etichettate, #5a5757 = riga tipo/taglia, #231f20 = corpo, GillSans #4a0508 =
   tabella caratteristiche (small caps spezzate in frammenti), #7b7879/#8b8989 =
   piè di pagina e intestazioni "MOD SALV" da scartare. I nomi di tratti e azioni
   sono <i><b>…</b></i> a inizio riga: è l'unico delimitatore affidabile dei
   paragrafi. Le colonne si separano a left=440 (pagina larga 891). */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pdf = process.argv[2];
if (!pdf) { console.error("uso: node scripts/estrai-srd-mostri.mjs <IT_SRD_CC_v5.2.1.pdf>"); process.exit(1); }

// Mostri A–Z + Animali, più la pagina della Mosca gigante: l'unica scheda fuori
// dal capitolo Mostri, incassata nell'oggetto magico "Statuine del potere
// meraviglioso" (la statuina di ebano la evoca e rimanda alla scheda lì accanto)
const INTERVALLI = [[294, 405], [282, 282]];
const COLONNA_DESTRA = 440;                 // ascissa di separazione delle colonne

const tmp = mkdtempSync(join(tmpdir(), "srd-"));
const xmlIntervalli = INTERVALLI.map(([f, l], i) => {
  execFileSync("pdftohtml", ["-xml", "-f", String(f), "-l", String(l), "-i", pdf, join(tmp, "estratto" + i)]);
  return readFileSync(join(tmp, "estratto" + i + ".xml"), "utf8");
});
rmSync(tmp, { recursive: true, force: true });

/* --- classificazione dei font: (taglia, colore) → ruolo --- */
function ruoloFont(size, family, color) {
  if (color === "#7b7879" || color === "#8b8989") return "scarta";      // piè di pagina, "MOD SALV"
  if (family.includes("Cambria")) return "scarta";                      // prosa del capitolo Oggetti magici
  if (color === "#88191f") return size >= 26 ? "intestazione" : size >= 21 ? "titolo" : "sezione";
  if (color === "#5a5757") return "tipo";
  if (color === "#4a0508") return family.includes("GillSans") ? "tabella" : "stat";
  return "corpo";                                                        // Optima #231f20
}

const unescapeXml = s => s.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"')
  .replaceAll("&apos;", "'").replaceAll("&#34;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");
const senzaTag = s => unescapeXml(s.replace(/<[^>]+>/g, "")).replace(/­/g, "");

/* --- raccolta dei frammenti in righe, colonna per colonna --- */
function estraiRighe(xml) {
  const righe = [];  // {ruolo, testo, frammenti:[{html,…}]}
  const font = {};   // gli id dei fontspec sono cumulativi dentro una singola estrazione
  for (const [, corpoPagina] of xml.matchAll(/<page[^>]*>([\s\S]*?)<\/page>/g)) {
    for (const m of corpoPagina.matchAll(/<fontspec id="(\d+)" size="(\d+)" family="([^"]+)" color="(#\w+)"\/>/g))
      font[m[1]] = ruoloFont(+m[2], m[3], m[4]);
    const items = [];
    for (const m of corpoPagina.matchAll(/<text top="(\d+)" left="(\d+)" width="\d+" height="\d+" font="(\d+)">([\s\S]*?)<\/text>/g)) {
      const ruolo = font[m[3]] ?? "corpo";
      if (ruolo === "scarta") continue;
      items.push({ top: +m[1], left: +m[2], col: +m[2] < COLONNA_DESTRA ? 0 : 1, ruolo, html: m[4] });
    }
    for (const col of [0, 1]) {
      const inCol = items.filter(i => i.col === col).sort((a, b) => a.top - b.top || a.left - b.left);
      let riga = null;
      for (const it of inCol) {
        if (!riga || it.top - riga.top > 6) { riga = { top: it.top, frammenti: [] }; righe.push(riga); }
        riga.frammenti.push(it);
      }
    }
  }
  for (const r of righe) {
    r.frammenti.sort((a, b) => a.left - b.left);
    // il ruolo della riga è quello più specifico tra i frammenti (la tabella
    // caratteristiche mescola small caps e valori su top leggermente diversi)
    const priorita = ["intestazione", "titolo", "sezione", "tipo", "stat", "tabella", "corpo"];
    r.ruolo = priorita.find(p => r.frammenti.some(f => f.ruolo === p));
    r.testo = r.frammenti.map(f => senzaTag(f.html)).join(" ").replace(/\s+/g, " ").trim();
  }
  return righe;
}
// confine sintetico tra un intervallo e l'altro: azzera lo stato del parser
const righe = xmlIntervalli.flatMap(x => [{ ruolo: "intestazione", testo: "(confine)", frammenti: [] }, ...estraiRighe(x)]);

/* --- macchina a stati sul flusso di righe --- */
const SEZIONI = { "Tratti": "traits", "Azioni": "actions", "Azioni bonus": "bonus", "Reazioni": "reactions", "Azioni leggendarie": "legendary" };
const ETICHETTE = ["CA", "Iniziativa", "PF", "Velocità", "Abilità", "Vulnerabilità", "Resistenze", "Immunità", "Sensi", "Lingue", "Attrezzatura", "GS"];
const blocchi = [];
let blocco = null, sezione = null, ultimaStat = null, scartate = [];

function nuovoBlocco(nome) {
  blocco = { nome, tipo: "", stat: {}, tab: "", sez: { traits: [], actions: [], bonus: [], reactions: [], legendary: [] } };
  sezione = null; ultimaStat = null; blocchi.push(blocco);
}
// unisce una riga alla precedente rispettando la sillabazione a fine riga
function unisci(base, aggiunta) {
  if (!base) return aggiunta;
  if (/[a-zà-ù]-$/.test(base)) return base.slice(0, -1) + aggiunta;
  return base + " " + aggiunta;
}

for (const r of righe) {
  if (!r.testo) continue;
  switch (r.ruolo) {
    case "intestazione": blocco = null; break;      // "Mostri A–Z", "Animali", capigruppo
    case "titolo": nuovoBlocco(r.testo); break;   // nessun titolo va a capo nel PDF
    case "tipo":
      // lo stesso stile grigio corsivo serve sia alla riga tipo/taglia sia al
      // preambolo delle Azioni leggendarie: dentro una sezione è un paragrafo
      if (blocco && sezione) { r.ruolo = "corpo"; corpo(r); }
      else if (blocco) blocco.tipo = unisci(blocco.tipo, r.testo);
      break;
    case "stat":
      if (!blocco) { scartate.push(r.testo); break; }
      // più campi possono condividere la riga e perfino lo stesso frammento
      // ("CA 12 Iniziativa +2 (12)"): ogni tratto in grassetto che coincide
      // con un'etichetta nota apre un campo nuovo
      for (const f of r.frammenti) {
        let bold = 0;
        for (const t of f.html.split(/(<\/?[a-z]+>)/)) {
          if (t === "<b>") { bold++; continue; }
          if (t === "</b>") { bold = Math.max(0, bold - 1); continue; }
          if (/^<\/?[a-z]+>$/.test(t)) continue;
          const testo = unescapeXml(t).replace(/­/g, "").replace(/\s+/g, " ").trim();
          if (!testo) continue;
          const parola = bold > 0 && testo.match(/^([A-Za-zà-ùÀ-Ù]+)/);
          const etichetta = parola && ETICHETTE.find(e => e === parola[1]);
          if (etichetta) {
            ultimaStat = etichetta;
            const resto = testo.slice(etichetta.length).trim();
            blocco.stat[etichetta] = unisci(blocco.stat[etichetta] ?? "", resto) ?? "";
          }
          else if (ultimaStat) blocco.stat[ultimaStat] = unisci(blocco.stat[ultimaStat], testo);
          else scartate.push(testo);
        }
      }
      break;
    case "tabella":
      if (blocco) blocco.tab += " " + r.testo;
      break;
    case "sezione": {
      const s = SEZIONI[r.testo];
      if (s) sezione = s; else scartate.push("SEZIONE IGNOTA: " + r.testo);
      break;
    }
    case "corpo": corpo(r); break;
  }
}
function corpo(r) {
  if (!blocco) { scartate.push(r.testo); return; }
  if (!sezione) { scartate.push(blocco.nome + " FUORI SEZIONE: " + r.testo); return; }
  const paragrafi = blocco.sez[sezione];
  // paragrafo nuovo = nome in grassetto corsivo a inizio riga con iniziale
  // maiuscola (le continuazioni tipo "tana)." restano attaccate), oppure
  // prima riga dopo l'intestazione di sezione
  const apreInGrassetto = /^\s*<i>\s*<b>|^\s*<b>\s*<i>/.test(r.frammenti[0].html) && /^[A-ZÀ-Ù0-9]/.test(r.testo);
  if (!paragrafi.length || apreInGrassetto) paragrafi.push(r.testo);
  else paragrafi[paragrafi.length - 1] = unisci(paragrafi[paragrafi.length - 1], r.testo);
}

/* --- dal blocco grezzo allo schema di srd-mostri.js --- */
const ASCII = s => (s ?? "").replace(/−/g, "-").replace(/ /g, " ").trim();
const problemi = [];
const mostri = blocchi.map(b => {
  const stat = Object.fromEntries(Object.entries(b.stat).map(([k, v]) => [k, ASCII(v)]));
  const pf = stat.PF?.match(/^(\d+)\s*(?:\((.+)\))?/) ?? [];
  const car = {};
  const salvezze = [];
  // le small caps spezzano i nomi in frammenti ("F or"): spazio tollerato,
  // maiuscole normalizzate. La salvezza può uscire senza segno (refuso del
  // PDF, es. Int del drago bianco giovane): se coincide in valore assoluto
  // col modificatore è una salvezza senza competenza, cioè uguale al mod.
  for (const m of ASCII(b.tab).matchAll(/([FDCIS]) ?(or|es|os|nt|ag|ar)\s*(\d+)\s*([+-]\d+)\s*([+-]?\d+)/gi)) {
    const nome = m[1].toUpperCase() + m[2].toLowerCase();
    car[nome] = +m[3];
    const salv = /^[+-]/.test(m[5]) ? m[5] : m[5] === m[4].slice(1) ? m[4] : "+" + m[5];
    if (salv !== m[4]) salvezze.push(`${nome} ${salv}`);
  }
  if (Object.keys(car).length !== 6) problemi.push(`${b.nome}: tabella caratteristiche incompleta (${JSON.stringify(b.tab.trim())})`);
  if (!pf[1]) problemi.push(`${b.nome}: PF non leggibili (${stat.PF})`);
  if (!b.tipo) problemi.push(`${b.nome}: riga tipo mancante`);
  // qualche scheda non ha Azioni (Boleto stridente: solo tratti e reazione;
  // la Mosca gigante non ha proprio sezioni: è solo una cavalcatura)
  if (!Object.values(b.sez).some(s => s.length) && !stat.CA) problemi.push(`${b.nome}: scheda senza contenuti`);
  const resist = ["Vulnerabilità", "Resistenze", "Immunità"]
    .filter(k => stat[k]).map(k => `${k} ${stat[k]}`).join("; ");
  const azioni = [
    b.sez.actions.join("\n"),
    b.sez.bonus.length ? "AZIONI BONUS:\n" + b.sez.bonus.join("\n") : "",
    b.sez.reactions.length ? "REAZIONI:\n" + b.sez.reactions.join("\n") : "",
  ].filter(Boolean).join("\n");
  return {
    name: b.nome, meta: b.tipo,
    ac: stat.CA ?? "", init: stat.Iniziativa ?? "",
    hp: +pf[1] || 0, hpRoll: pf[2] ?? "",
    speed: stat["Velocità"] ?? "",
    str: car.For ?? 10, dex: car.Des ?? 10, con: car.Cos ?? 10,
    int: car.Int ?? 10, wis: car.Sag ?? 10, cha: car.Car ?? 10,
    saves: salvezze.join(", "), skills: stat["Abilità"] ?? "", resist,
    senses: stat.Sensi ?? "", langs: stat.Lingue ?? "", cr: stat.GS ?? "",
    gear: stat.Attrezzatura ?? "",
    traits: b.sez.traits.join("\n"), actions: azioni, legendary: b.sez.legendary.join("\n"),
  };
});

if (problemi.length) { console.error("PROBLEMI:\n" + problemi.join("\n")); process.exit(1); }
console.log(`${mostri.length} schede estratte.`);
if (scartate.length) console.log(`Righe scartate (capigruppo/intro, da ricontrollare a campione):\n  ` + scartate.slice(0, 40).join("\n  "));

const intestazione = `/* Dati mostri: SRD 5.2.1 in italiano (regole 2024) © Wizards of the Coast — CC-BY-4.0.
   Traduzione ufficiale dal PDF IT_SRD_CC_v5.2.1 (dndbeyond.com/srd).
   L'attribuzione nelle schede mostro (srd-attrib) va mantenuta.
   File GENERATO da scripts/estrai-srd-mostri.mjs: non modificare a mano.
   Script classico, non modulo: espone window.SRD_MONSTERS, letto dal
   bestiario in mostri.js al momento della ricerca. */
`;
const uscita = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "app", "srd-mostri.js");
writeFileSync(uscita, intestazione + "window.SRD_MONSTERS=" + JSON.stringify(mostri) + ";\n");
console.log("Scritto " + uscita);

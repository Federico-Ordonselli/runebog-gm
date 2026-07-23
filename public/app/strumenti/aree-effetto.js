/* Le aree d'effetto sono temporanee: quattro footprint in quadretti (cerchio,
   cono, linea, quadrato) che il DM disegna trascinando e che spariscono al
   rilascio. Non toccano mai la campagna. Il sottotipo si sceglie coi tasti 1–4
   mentre il tool è attivo — non con altri pulsanti in toolbar: il gestore
   inoltra il tasto al tool (keyDown) prima delle scorciatoie. Le funzioni
   geometriche sono pure e separate dal disegno, così sono testabili sotto Node
   senza DOM. */

import { distanzaCelle } from "./righello.js";
import { svgEl, scalaSchermo, formattaNumero } from "./svg.js";

function misura(quadretti, metriPerCella){
  return { quadretti, metri: quadretti * metriPerCella };
}

export function geometriaCerchio(origine, trascinamento, metriPerCella = 1.5){
  const raggio = distanzaCelle(
    trascinamento.x - origine.x,
    trascinamento.y - origine.y,
  );
  return {
    tipo: "cerchio",
    centro: { ...origine },
    raggio,
    misura: misura(raggio, metriPerCella),
  };
}

export function geometriaQuadrato(origine, trascinamento, metriPerCella = 1.5){
  const dx = trascinamento.x - origine.x;
  const dy = trascinamento.y - origine.y;
  const lato = Math.max(Math.abs(dx), Math.abs(dy));
  const x2 = origine.x + (dx < 0 ? -lato : lato);
  const y2 = origine.y + (dy < 0 ? -lato : lato);
  return {
    tipo: "quadrato",
    punti: [
      { ...origine },
      { x: x2, y: origine.y },
      { x: x2, y: y2 },
      { x: origine.x, y: y2 },
    ],
    lato,
    misura: misura(lato, metriPerCella),
  };
}

export function geometriaLinea(origine, trascinamento, spessore = 1, metriPerCella = 1.5){
  const dx = trascinamento.x - origine.x;
  const dy = trascinamento.y - origine.y;
  const lunghezza = distanzaCelle(dx, dy);
  const nx = lunghezza ? -dy / lunghezza : 0;
  const ny = lunghezza ? dx / lunghezza : 0;
  const meta = spessore / 2;
  return {
    tipo: "linea",
    inizio: { ...origine },
    fine: { ...trascinamento },
    spessore,
    punti: [
      { x: origine.x + nx * meta, y: origine.y + ny * meta },
      { x: trascinamento.x + nx * meta, y: trascinamento.y + ny * meta },
      { x: trascinamento.x - nx * meta, y: trascinamento.y - ny * meta },
      { x: origine.x - nx * meta, y: origine.y - ny * meta },
    ],
    lunghezza,
    misura: misura(lunghezza, metriPerCella),
  };
}

export function geometriaCono(origine, trascinamento, metriPerCella = 1.5){
  const dx = trascinamento.x - origine.x;
  const dy = trascinamento.y - origine.y;
  const lunghezza = distanzaCelle(dx, dy);
  // Nel cono di D&D 5e la larghezza all'estremità eguaglia la lunghezza: il
  // triangolo usa quindi una base lunga quanto il raggio (semiapertura ≈ 26,6°).
  const nx = lunghezza ? -dy / lunghezza : 0;
  const ny = lunghezza ? dx / lunghezza : 0;
  const semibase = lunghezza / 2;
  return {
    tipo: "cono",
    vertice: { ...origine },
    centroBase: { ...trascinamento },
    punti: [
      { ...origine },
      { x: trascinamento.x + nx * semibase, y: trascinamento.y + ny * semibase },
      { x: trascinamento.x - nx * semibase, y: trascinamento.y - ny * semibase },
    ],
    lunghezza,
    aperturaGradi: 2 * Math.atan(0.5) * 180 / Math.PI,
    misura: misura(lunghezza, metriPerCella),
  };
}

/* I quattro sottotipi e il tasto che li sceglie mentre il tool è attivo. La
   scelta è una riga di tasti (1–4), non altri pulsanti: il gestore inoltra il
   tasto al tool attivo (keyDown) prima delle scorciatoie. */
const SOTTOTIPI = [
  { key: "1", id: "cerchio",  label: "cerchio"  },
  { key: "2", id: "cono",     label: "cono"     },
  { key: "3", id: "linea",    label: "linea"    },
  { key: "4", id: "quadrato", label: "quadrato" },
];

let sottotipo = "cerchio";
let da = null;       // origine del gesto, agganciata alla maglia (px mappa)
let ultimo = null;   // ultimo punto del trascinamento (px mappa): serve a ridisegnare al cambio di sottotipo
let gfx = null;

function nomeSottotipo(){
  return (SOTTOTIPI.find(s => s.id === sottotipo) || SOTTOTIPI[0]).label;
}

function annuncia(ctx){
  const scelta = SOTTOTIPI.map(s => `${s.key} ${s.label}`).join(" · ");
  ctx.announce(`Aree d'effetto — ${nomeSottotipo()}. Scegli con ${scelta}; `
    + "trascina per disegnare, Esc per uscire.");
}

function geometriaPer(ctx, a, b){
  const origine = { x: a.x / ctx.cell, y: a.y / ctx.cell };
  const trascinamento = { x: b.x / ctx.cell, y: b.y / ctx.cell };
  switch(sottotipo){
    case "quadrato": return geometriaQuadrato(origine, trascinamento, ctx.metersPerCell);
    case "linea": return geometriaLinea(origine, trascinamento, 1, ctx.metersPerCell);
    case "cono": return geometriaCono(origine, trascinamento, ctx.metersPerCell);
    default: return geometriaCerchio(origine, trascinamento, ctx.metersPerCell);
  }
}

function puntoMappa(p, cell){
  return `${p.x * cell} ${p.y * cell}`;
}

function percorsoForma(geometria, cell){
  if(geometria.tipo === "cerchio"){
    const cx = geometria.centro.x * cell;
    const cy = geometria.centro.y * cell;
    const r = geometria.raggio * cell;
    if(!r) return `M ${cx} ${cy}`;
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} `
      + `A ${r} ${r} 0 1 0 ${cx - r} ${cy}`;
  }
  return `M ${geometria.punti.map(p => puntoMappa(p, cell)).join(" L ")} Z`;
}

function disegna(ctx, a, b){
  const s = scalaSchermo(ctx.overlaySvg);
  const geometria = geometriaPer(ctx, a, b);
  const testo = `${formattaNumero(geometria.misura.quadretti)} q · `
    + `${formattaNumero(geometria.misura.metri)} m`;

  if(!gfx){
    const forma = svgEl("path", {
      style: "fill:var(--fen);fill-opacity:.18;stroke:var(--fen)",
    });
    const et = svgEl("text", {
      style: "fill:var(--ink);stroke:var(--bog);stroke-linejoin:round;paint-order:stroke;font-weight:600",
    });
    ctx.layer.append(forma, et);
    gfx = { forma, et };
  }

  gfx.forma.setAttribute("d", percorsoForma(geometria, ctx.cell));
  gfx.forma.setAttribute("stroke-width", 2.5 * s);
  gfx.et.setAttribute("x", b.x + 10 * s);
  gfx.et.setAttribute("y", b.y - 10 * s);
  gfx.et.setAttribute("font-size", 13 * s);
  gfx.et.setAttribute("stroke-width", 3.5 * s);
  gfx.et.textContent = testo;
}

function azzera(ctx){
  ctx.clear();
  da = null;
  ultimo = null;
  gfx = null;
}

export const areeEffettoTool = {
  id: "aree-effetto",
  label: "Aree d'effetto",
  icon: "◉",
  title: "Disegna un'area d'effetto temporanea",
  shortcut: "A",
  scope: "tutti",
  activate(ctx){
    annuncia(ctx);
  },
  deactivate(){
    da = null;
    ultimo = null;
    gfx = null;
    sottotipo = "cerchio";   // riparte sempre dal cerchio al prossimo uso
  },
  keyDown(ctx, ev){
    const scelto = SOTTOTIPI.find(s => s.key === ev.key);
    if(!scelto) return false;                       // non è un nostro tasto: lo lascia al gestore
    if(scelto.id !== sottotipo){
      sottotipo = scelto.id;
      if(da && ultimo) disegna(ctx, da, ultimo);    // ridisegna l'anteprima in corso col nuovo footprint
    }
    annuncia(ctx);
    return true;
  },
  pointerDown(ctx, ev, p){
    da = ctx.snapToGrid(p);
    ultimo = da;
    disegna(ctx, da, da);
    return true;
  },
  pointerMove(ctx, ev, p){
    if(da){ ultimo = p; disegna(ctx, da, p); }
  },
  pointerUp(ctx){ azzera(ctx); },
  cancel(ctx){ azzera(ctx); },
};

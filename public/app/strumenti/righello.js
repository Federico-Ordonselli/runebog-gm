/* Il righello: il primo tool, e il banco di prova che il contratto basta. Misura
   una distanza sulla mappa e la mostra in quadretti e metri. Tutto temporaneo —
   niente stato della campagna, niente save(): la grafica vive solo nell'overlay,
   che il gestore svuota da sé.

   La GEOMETRIA è una funzione pura, `distanzaCelle`: prende delta in quadretti e
   restituisce quadretti, così si testa sotto Node senza toccare il DOM (vedi
   test/strumenti/righello.test.mjs). Il disegno sta a parte e usa solo i callback
   del contratto: nessun listener proprio, quelli sono del gestore. */

import { svgEl, scalaSchermo, formattaNumero } from "./svg.js";

/* Come contare una diagonale. "euclideo" è la distanza vera (√2 per un
   quadretto), gli altri due sono i conteggi a griglia del regolamento:
     diagonale-uno → ogni diagonale vale 1 (max dei due assi);
     alternato     → la seconda diagonale vale 2 (5-10-5 piedi). */
export const METODO_DIAGONALE = "euclideo";

export function distanzaCelle(dxCelle, dyCelle, metodo = METODO_DIAGONALE){
  const ax = Math.abs(dxCelle), ay = Math.abs(dyCelle);
  const diag = Math.min(ax, ay), rette = Math.max(ax, ay) - diag;
  if(metodo === "diagonale-uno") return rette + diag;
  if(metodo === "alternato")     return rette + diag + Math.floor(diag / 2);
  return Math.hypot(dxCelle, dyCelle);           // euclideo, il default
}

let da = null;          // punto di partenza (agganciato alla griglia), in coordinate mappa
let gfx = null;         // gli elementi SVG della misura in corso

function disegna(ctx, a, b){
  const s = scalaSchermo(ctx.overlaySvg);        // unità-mappa per pixel: tiene tratto ed etichetta costanti allo zoom
  const dxC = (b.x - a.x) / ctx.cell, dyC = (b.y - a.y) / ctx.cell;
  const celle = distanzaCelle(dxC, dyC);
  const metri = celle * ctx.metersPerCell;
  const testo = `${formattaNumero(celle)} q · ${formattaNumero(metri)} m`;

  if(!gfx){
    const linea = svgEl("line", { style: "stroke:var(--fen)", "stroke-linecap": "round" });
    const c1 = svgEl("circle", { style: "fill:var(--fen)" });
    const c2 = svgEl("circle", { style: "fill:var(--fen)" });
    // Etichetta con alone (paint-order:stroke): leggibile su qualunque sfondo e
    // in tutti i temi senza un rettangolo da dimensionare a mano.
    const et = svgEl("text", {
      style: "fill:var(--ink);stroke:var(--bog);stroke-linejoin:round;paint-order:stroke;font-weight:600",
    });
    ctx.layer.append(linea, c1, c2, et);
    gfx = { linea, c1, c2, et };
  }
  gfx.linea.setAttribute("x1", a.x); gfx.linea.setAttribute("y1", a.y);
  gfx.linea.setAttribute("x2", b.x); gfx.linea.setAttribute("y2", b.y);
  gfx.linea.setAttribute("stroke-width", 2.5 * s);
  for(const [c, p] of [[gfx.c1, a], [gfx.c2, b]]){
    c.setAttribute("cx", p.x); c.setAttribute("cy", p.y); c.setAttribute("r", 3.5 * s);
  }
  gfx.et.setAttribute("x", b.x + 10 * s);
  gfx.et.setAttribute("y", b.y - 10 * s);
  gfx.et.setAttribute("font-size", 13 * s);
  gfx.et.setAttribute("stroke-width", 3.5 * s);
  gfx.et.textContent = testo;
}

export const righelloTool = {
  id: "righello",
  label: "Righello",
  icon: "📐",
  title: "Misura una distanza sulla mappa",
  shortcut: "R",
  scope: "tutti",
  activate(ctx){
    ctx.announce("Righello attivo: trascina sulla mappa per misurare; Esc per uscire.");
  },
  deactivate(){ da = null; gfx = null; },        // il layer lo svuota il gestore
  // La partenza si aggancia agli incroci della maglia; l'altro capo segue il
  // dito senza aggancio, così la misura è continua mentre trascini.
  pointerDown(ctx, ev, p){
    da = ctx.snapToGrid(p);
    disegna(ctx, da, da);
    return true;                                 // prendo il gesto: niente pan/drag
  },
  pointerMove(ctx, ev, p){
    if(da) disegna(ctx, da, p);
  },
  // Finita la misura la grafica sparisce, ma il tool resta acceso per la prossima.
  pointerUp(ctx){ ctx.clear(); da = null; gfx = null; },
  cancel(ctx){ ctx.clear(); da = null; gfx = null; },
};

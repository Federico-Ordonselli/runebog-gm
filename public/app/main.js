/* L'avvio dell'app: tema, stato, listener globali, primo disegno.
   È l'unico entry point: app.html carica solo questo modulo (più srd-mostri.js,
   script classico coi dati del bestiario). L'ordine conta: prima lo stato,
   poi i listener, poi il primo render. */

import { initStato, renderCampaignSelect, save, RO } from "./stato.js";
import { initViste } from "./viste.js";
import { initMappa, renderMap, planSvg, planPointXY } from "./mappa.js";
import { CELL, METRI_PER_CELLA } from "./modello.js";
import { initStrumentiMappa } from "./strumenti/index.js";
import { initMenu } from "./menu.js";
import { initRicerca } from "./ricerca.js";
import { initScorciatoie } from "./scorciatoie.js";
import { initChecklist } from "./checklist.js";
import { initEsporta } from "./esporta.js";
import { initDungeon } from "./dungeon.js";
import { initTavolo } from "./tavolo.js";

/* --- temi: scelti qui, ricordati, e validi anche sul sito (stessa chiave) --- */
const TEMI = ["torbiera","pergamena","cripta","brace","contrasto"];

function setTheme(nome){
  if(!TEMI.includes(nome)) nome = "torbiera";
  // "torbiera" è il default in themes.css: nessun attributo = tema di base.
  if(nome === "torbiera") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = nome;
  try{ localStorage.setItem("runebog-theme", nome); }catch(e){}
  const sel = document.getElementById("theme-select");
  if(sel) sel.value = nome;
}

/* --- larghezza del pannello dettagli ---
   Preferenza dell'interfaccia, non della campagna: sta in localStorage come il
   tema, non nel JSON — la stessa campagna aperta su due schermi diversi vuole
   due larghezze diverse, e il JSON viaggia (export, tavolo, cloud).
   Il valore vive come variabile CSS su :root: il clamp in vw resta al CSS, che
   sa quanto è largo il viewport anche dopo un resize della finestra. */
const DETAIL_MIN = 320, DETAIL_MAX = 760, DETAIL_DEF = 440;
const DETAIL_KEY = "runebog-detail-w";

function setDetailWidth(px, ricorda){
  const w = Math.round(Math.min(DETAIL_MAX, Math.max(DETAIL_MIN, px)));
  document.documentElement.style.setProperty("--detail-w", w + "px");
  const grip = document.getElementById("detail-grip");
  if(grip){
    grip.setAttribute("aria-valuenow", w);
    grip.setAttribute("aria-valuemin", DETAIL_MIN);
    grip.setAttribute("aria-valuemax", DETAIL_MAX);
  }
  if(ricorda) try{ localStorage.setItem(DETAIL_KEY, w); }catch(e){}
  return w;
}

function initDetailResize(){
  const grip = document.getElementById("detail-grip"), det = document.getElementById("detail");
  if(!grip || !det) return;

  let salvata = NaN;
  try{ salvata = parseInt(localStorage.getItem(DETAIL_KEY), 10); }catch(e){}
  setDetailWidth(Number.isFinite(salvata) ? salvata : DETAIL_DEF, false);

  /* Il gesto si ascolta su window: la maniglia è larga 5px e il puntatore ne esce
     al primo movimento, quindi i listener devono stare dove il puntatore va.
     Così basta un pointerId da confrontare e non serve setPointerCapture (che
     altrove, in mappa.js, è su un bersaglio grande come la tela). `attivo` è il
     gesto in corso: distingue il dito che trascina dagli altri di un multi-touch. */
  let attivo = null, x0 = 0, w0 = 0;
  grip.addEventListener("pointerdown", e=>{
    // Solo il tasto principale: col destro qui sopra si vuole il menu, non un drag.
    if(e.button !== 0 || attivo !== null) return;
    e.preventDefault();
    attivo = e.pointerId; x0 = e.clientX;
    // getBoundingClientRect e non la variabile CSS: se il max-width in vw sta
    // già tagliando, il trascinamento deve partire da quanto è largo davvero.
    w0 = det.getBoundingClientRect().width;
    grip.classList.add("dragging"); document.body.classList.add("resizing");
  });
  // Il pannello è a destra: tirare verso sinistra (clientX che cala) lo allarga.
  window.addEventListener("pointermove", e=>{
    if(e.pointerId !== attivo) return;
    setDetailWidth(w0 - (e.clientX - x0), false);
  });
  const fine = e=>{
    if(e.pointerId !== attivo) return;
    attivo = null;
    grip.classList.remove("dragging"); document.body.classList.remove("resizing");
    // Si scrive una volta a fine gesto, non a ogni pointermove.
    setDetailWidth(det.getBoundingClientRect().width, true);
  };
  window.addEventListener("pointerup", fine);
  window.addEventListener("pointercancel", fine);

  grip.addEventListener("dblclick", ()=> setDetailWidth(DETAIL_DEF, true));

  grip.addEventListener("keydown", e=>{
    const passo = e.shiftKey ? 40 : 10;
    let w = null;
    if(e.key === "ArrowLeft")  w = det.getBoundingClientRect().width + passo;
    if(e.key === "ArrowRight") w = det.getBoundingClientRect().width - passo;
    if(e.key === "Home")       w = DETAIL_DEF;
    if(w === null) return;
    e.preventDefault();
    setDetailWidth(w, true);
  });
}

/* ==================== avvio ==================== */
initStato();

// Allinea il menu a ciò che lo script inline in <head> ha già applicato prima
// del disegno (i moduli girano a DOM completo: niente listener da aspettare).
let salvato = "torbiera";
try{ salvato = localStorage.getItem("runebog-theme") || "torbiera"; }catch(e){}
setTheme(salvato);

initViste();
initMappa();
// Dopo initMappa (i cui gesti in fase bubble il gestore deve poter precedere in
// cattura) e prima del primo renderMap. readOnly da RO: al tavolo un tool vive
// solo se il suo scope lo prevede.
initStrumentiMappa({
  mapSvg: planSvg(),
  overlaySvg: document.getElementById("plan-tools-svg"),
  toolbar: document.getElementById("map-tools"),
  status: document.getElementById("map-tool-status"),
  doc: document,
  keyTarget: window,
  cell: CELL,
  metersPerCell: METRI_PER_CELLA,
  toMapPoint: planPointXY,
  readOnly: RO,
});
initMenu();
initRicerca();
initScorciatoie();
initChecklist();
initEsporta();
initDungeon();
initTavolo();
initDetailResize();

renderCampaignSelect();
if(window.__cloud){
  const cw = document.getElementById("camp-wrap"); if(cw) cw.style.display = "none";
  const tb = document.getElementById("topbar"), tabs = tb && tb.querySelector("nav.tabs");
  if(tb && tabs){                                  // in cloud le campagne stanno sul sito, non negli slot locali
    const back = document.createElement("a");
    back.href = "/"; back.className = "btn"; back.textContent = "← Le mie campagne";
    back.title = "Torna all'elenco delle campagne";
    back.style.textDecoration = "none";
    tb.insertBefore(back, tabs);
  }
}
save();
renderMap();

// per l'onchange inline del selettore tema
Object.assign(window, { setTheme });

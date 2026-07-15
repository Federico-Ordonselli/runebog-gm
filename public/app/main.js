/* L'avvio dell'app: tema, stato, listener globali, primo disegno.
   È l'unico entry point: app.html carica solo questo modulo (più srd-mostri.js,
   script classico coi dati del bestiario). L'ordine conta: prima lo stato,
   poi i listener, poi il primo render. */

import { initStato, renderCampaignSelect, save } from "./stato.js";
import { initViste } from "./viste.js";
import { initMappa, renderMap } from "./mappa.js";
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

/* ==================== avvio ==================== */
initStato();

// Allinea il menu a ciò che lo script inline in <head> ha già applicato prima
// del disegno (i moduli girano a DOM completo: niente listener da aspettare).
let salvato = "torbiera";
try{ salvato = localStorage.getItem("runebog-theme") || "torbiera"; }catch(e){}
setTheme(salvato);

initViste();
initMappa();
initMenu();
initRicerca();
initScorciatoie();
initChecklist();
initEsporta();
initDungeon();
initTavolo();

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

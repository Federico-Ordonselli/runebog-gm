/* Il cambio di vista (tab) e il dialogo di conferma condiviso.
   Tutte le conferme passano da openConfirm(testo, cb): un solo meccanismo,
   nessuno stato "in sospeso" sparso per i moduli. */

import { renderMap } from "./mappa.js";
import { renderQuests } from "./quest.js";
import { renderChecklist } from "./checklist.js";
import { renderPlayers } from "./giocatori.js";

export function showView(v){
  document.querySelectorAll(".view").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll("nav.tabs button").forEach(b=>{
    b.classList.remove("active"); b.setAttribute("aria-selected","false");
  });
  document.getElementById("view-"+v).classList.add("active");
  const tab = document.getElementById("tab-"+v);
  tab.classList.add("active"); tab.setAttribute("aria-selected","true");
  if(v==="map") renderMap();
  if(v==="quests") renderQuests();
  if(v==="check") renderChecklist();
  if(v==="players") renderPlayers();
}

/* Pattern ARIA dei tab: frecce per spostarsi tra i tab visibili (al tavolo la
   Checklist è nascosta via CSS e va saltata), Home/End per gli estremi. */
export function initViste(){
  document.querySelector("nav.tabs").addEventListener("keydown", e=>{
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key)) return;
    const tabs = [...document.querySelectorAll("nav.tabs button")].filter(b=>b.offsetParent!==null);
    const i = tabs.indexOf(document.activeElement);
    if(i===-1) return;
    e.preventDefault();
    const j = e.key==="Home" ? 0
            : e.key==="End"  ? tabs.length-1
            : (i + (e.key==="ArrowRight"?1:-1) + tabs.length) % tabs.length;
    tabs[j].focus(); tabs[j].click();
  });
}

let confirmCb = null;
export function openConfirm(testo, cb){
  document.getElementById("confirm-text").textContent = testo;
  confirmCb = cb;
  document.getElementById("confirm-dialog").showModal();
}
export function closeConfirm(yes){
  document.getElementById("confirm-dialog").close();
  const cb = confirmCb; confirmCb = null;
  if(cb) cb(yes);
}

// per gli onclick inline nei template e nell'HTML statico
Object.assign(window, { showView, closeConfirm });

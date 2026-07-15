/* Il cambio di vista (tab) e il dialogo di conferma condiviso.
   Tutte le conferme passano da openConfirm(testo, cb): un solo meccanismo,
   nessuno stato "in sospeso" sparso per i moduli. */

import { renderMap } from "./mappa.js";
import { renderQuests } from "./quest.js";
import { renderChecklist } from "./checklist.js";
import { renderPlayers } from "./giocatori.js";

export function showView(v){
  document.querySelectorAll(".view").forEach(s=>s.classList.remove("active"));
  document.querySelectorAll("nav.tabs button").forEach(b=>b.classList.remove("active"));
  document.getElementById("view-"+v).classList.add("active");
  document.getElementById("tab-"+v).classList.add("active");
  if(v==="map") renderMap();
  if(v==="quests") renderQuests();
  if(v==="check") renderChecklist();
  if(v==="players") renderPlayers();
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

/* Il diario delle quest: raccoglie i nodi di tipo quest da tutto l'albero,
   ordina per stato e separa le principali (★). Il titolo naviga al nodo. */

import { STATUSES, escapeHtml } from "./modello.js";
import { st, save, findNode } from "./stato.js";

export function renderQuests(){
  const wrap = document.getElementById("quests-list");
  const items = [];
  (function walk(n, parent){
    if(n.type==="quest") items.push({n, parent});
    n.children.forEach(c=>walk(c, n));
  })(st.state.root, null);
  const order = {"in corso":0, "da fare":1, "":2, "fatto":3};
  items.sort((a,b)=>
    (order[a.n.status||""] - order[b.n.status||""]) ||
    (a.n.title||"").localeCompare(b.n.title||"", "it"));
  const row = ({n, parent}) => `<div class="q-row ${n.status==="fatto"?"done":""}">
    <button class="q-star ${n.main?"on":""}" title="${n.main?"Togli da principali":"Segna come principale"}"
      onclick="toggleMainQuest('${n.id}')">★</button>
    <div class="q-body">
      <a class="q-title" onclick="goToNode('${n.id}')">${escapeHtml(n.title||"(senza nome)")}</a>
      <span class="q-loc">${escapeHtml(parent?.title||"")}</span>
      ${(n.notes||"").trim() ? `<div class="q-notes">${escapeHtml((n.notes.split("\n")[0]).slice(0,160))}</div>` : ""}
    </div>
    <select class="q-status" onchange="setQuestStatus('${n.id}', this.value)">
      ${STATUSES.map(s=>`<option value="${s}"${s===(n.status||"")?" selected":""}>${s||"—"}</option>`).join("")}
    </select>
  </div>`;
  const mains = items.filter(i=>i.n.main), rest = items.filter(i=>!i.n.main);
  wrap.innerHTML = `
    <h2 class="q-h">★ Quest principali</h2>
    ${mains.length ? mains.map(row).join("") :
      `<p class="q-empty">Nessuna quest principale: segna una quest con la ★ qui sotto o dal suo pannello sulla mappa.</p>`}
    <h2 class="q-h">Tutte le quest</h2>
    ${rest.length ? rest.map(row).join("") :
      `<p class="q-empty">Nessuna quest sulla mappa: trascina un segnalino Quest dalla barra della Mappa.</p>`}`;
}
export function toggleMainQuest(id){ const n=findNode(id); if(!n) return; n.main=!n.main; save(); renderQuests(); }
export function setQuestStatus(id, stt){ const n=findNode(id); if(!n) return; n.status=stt; save(); renderQuests(); }

// per gli onclick inline nei template
Object.assign(window, { toggleMainQuest, setQuestStatus });

/* Il diario delle quest: raccoglie i nodi di tipo quest da tutto l'albero,
   ordina per stato (o per scadenza) e separa le principali (★). Il titolo
   naviga al nodo. */

import { STATUSES, escapeHtml } from "./modello.js";
import { st, save, findNode } from "./stato.js";
import { scadenzaDi } from "./calendario.js";

/* Per stato o per scadenza: una preferenza della vista, non della campagna. */
let ordine = "stato";

export function renderQuests(){
  const wrap = document.getElementById("quests-list");
  const items = [];
  (function walk(n, parent){
    if(n.type==="quest") items.push({n, parent});
    n.children.forEach(c=>walk(c, n));
  })(st.state.root, null);
  const perStato = {"in corso":0, "da fare":1, "":2, "fatto":3};
  const perNome = (a,b) => (a.n.title||"").localeCompare(b.n.title||"", "it");
  // Per scadenza: prima quelle che scadono (le scadute in cima, sono le più
  // urgenti), poi quelle senza; le fatte in fondo comunque, come per stato.
  const perScadenza = (a,b) =>
    ((a.n.status==="fatto") - (b.n.status==="fatto")) ||
    ((a.n.scadenza ?? Infinity) - (b.n.scadenza ?? Infinity)) ||
    perNome(a,b);
  items.sort(ordine==="scadenza" ? perScadenza
    : (a,b) => (perStato[a.n.status||""] - perStato[b.n.status||""]) || perNome(a,b));
  const row = ({n, parent}) => {
    const s = scadenzaDi(n);
    return `<div class="q-row ${n.status==="fatto"?"done":""}">
    <button class="q-star ${n.main?"on":""}" title="${n.main?"Togli da principali":"Segna come principale"}"
      onclick="toggleMainQuest('${n.id}')">★</button>
    <div class="q-body">
      <a class="q-title" onclick="goToNode('${n.id}')">${escapeHtml(n.title||"(senza nome)")}</a>
      <div class="q-meta">
        ${parent?.title ? `<span class="q-loc">${escapeHtml(parent.title)}</span>` : ""}
        ${s ? `<span class="q-scad s-${s.stato}">⚑ ${escapeHtml(s.testo)}</span>` : ""}
      </div>
      ${(n.notes||"").trim() ? `<div class="q-notes">${escapeHtml((n.notes.split("\n")[0]).slice(0,160))}</div>` : ""}
    </div>
    <select class="q-status" onchange="setQuestStatus('${n.id}', this.value)">
      ${STATUSES.map(s=>`<option value="${s}"${s===(n.status||"")?" selected":""}>${s||"—"}</option>`).join("")}
    </select>
  </div>`;
  };
  const conScadenza = items.some(i => Number.isInteger(i.n.scadenza));
  const ordina = conScadenza ? `<label class="q-ordina">Ordina
      <select id="q-ordine" onchange="ordinaQuest(this.value)">
        <option value="stato"${ordine==="stato"?" selected":""}>per stato</option>
        <option value="scadenza"${ordine==="scadenza"?" selected":""}>per scadenza</option>
      </select></label>` : "";
  const mains = items.filter(i=>i.n.main), rest = items.filter(i=>!i.n.main);
  wrap.innerHTML = `
    ${ordina}
    <h2 class="q-h">★ Quest principali</h2>
    ${mains.length ? mains.map(row).join("") :
      `<p class="q-empty">Nessuna quest principale: segna una quest con la ★ qui sotto o dal suo pannello sulla mappa.</p>`}
    <h2 class="q-h">Tutte le quest</h2>
    ${rest.length ? rest.map(row).join("") :
      `<p class="q-empty">Nessuna quest sulla mappa: trascina un segnalino Quest dalla barra della Mappa.</p>`}`;
}
export function toggleMainQuest(id){ const n=findNode(id); if(!n) return; n.main=!n.main; save(); renderQuests(); }
export function setQuestStatus(id, stt){ const n=findNode(id); if(!n) return; n.status=stt; save(); renderQuests(); }
export function ordinaQuest(v){
  ordine = v==="scadenza" ? "scadenza" : "stato";
  renderQuests();
  document.getElementById("q-ordine")?.focus();
}

// per gli onclick inline nei template
Object.assign(window, { toggleMainQuest, setQuestStatus, ordinaQuest });

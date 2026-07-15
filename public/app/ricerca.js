/* La ricerca rapida in alto (Ctrl+K): cerca per titolo in tutto l'albero
   e naviga al risultato con goToNode. */

import { TYPES, escapeHtml } from "./modello.js";
import { st } from "./stato.js";
import { goToNode } from "./mappa.js";

export function initRicerca(){
  const inp = document.getElementById("quick-search");
  const box = document.getElementById("qs-results");
  let results = [], hi = -1;
  function close(){ box.classList.remove("show"); results=[]; hi=-1; }
  function run(){
    const q = inp.value.trim().toLowerCase();
    if(q.length<2){ close(); return; }
    results = [];
    (function walk(n, parent){
      if(n!==st.state.root && (n.title||"").toLowerCase().includes(q))
        results.push({n, parent});
      n.children.forEach(c=>walk(c, n));
    })(st.state.root, null);
    results = results.slice(0, 9);
    if(!results.length){ box.innerHTML = `<div class="ctx-head" style="padding:8px 10px">Nessun risultato</div>`; box.classList.add("show"); return; }
    hi = 0;
    box.innerHTML = results.map((r,i)=>{
      const t = TYPES[r.n.type]||TYPES.nota;
      return `<button class="${i===hi?"active":""}" data-i="${i}">
        <span class="type-badge" style="background:${t.color}"></span>
        ${escapeHtml(r.n.title||"(senza nome)")}
        <span class="qs-path">${escapeHtml(r.parent?.title||"")}</span>
      </button>`;
    }).join("");
    box.classList.add("show");
    box.querySelectorAll("button").forEach(b=>{
      b.addEventListener("pointerdown", ev=>{ ev.preventDefault(); pick(+b.dataset.i); });
    });
  }
  function pick(i){
    const r = results[i]; if(!r) return;
    close(); inp.value=""; inp.blur();
    goToNode(r.n.id);
  }
  inp.addEventListener("input", run);
  inp.addEventListener("keydown", e=>{
    if(e.key==="Escape"){ close(); inp.blur(); }
    else if(e.key==="ArrowDown"||e.key==="ArrowUp"){
      e.preventDefault();
      if(!results.length) return;
      hi = (hi + (e.key==="ArrowDown"?1:-1) + results.length) % results.length;
      box.querySelectorAll("button").forEach((b,i)=>b.classList.toggle("active", i===hi));
    }
    else if(e.key==="Enter"){ e.preventDefault(); pick(hi); }
  });
  inp.addEventListener("blur", ()=>setTimeout(close, 150));
}

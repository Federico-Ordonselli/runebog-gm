/* La ricerca rapida in alto (Ctrl+K): titoli, note (DM e giocatori), nemici,
   giocatori e voci della checklist — "Cerca in tutta la campagna" come promette
   il dialog "?". Ordine dei risultati: prima i titoli (il match più forte),
   poi le note con snippet, poi il resto; il click naviga alla vista giusta. */

import { TYPES, escapeHtml } from "./modello.js";
import { st, RO } from "./stato.js";
import { goToNode } from "./mappa.js";
import { showView } from "./viste.js";

/* Contesto attorno al match, col match in <mark>. Le tre parti sono escapate
   separatamente: il testo è dell'utente, il markup è solo il nostro. */
function snippet(text, q){
  const flat = text.replace(/\s+/g, " ");
  const i = flat.toLowerCase().indexOf(q);
  if(i < 0) return "";
  const from = Math.max(0, i - 24), to = i + q.length;
  return (from > 0 ? "…" : "") + escapeHtml(flat.slice(from, i)) +
    "<mark>" + escapeHtml(flat.slice(i, to)) + "</mark>" +
    escapeHtml(flat.slice(to, to + 52)) + (to + 52 < flat.length ? "…" : "");
}

export function initRicerca(){
  const inp = document.getElementById("quick-search");
  const box = document.getElementById("qs-results");
  let results = [], hi = -1;
  function close(){ box.classList.remove("show"); results=[]; hi=-1; }
  function run(){
    const q = inp.value.trim().toLowerCase();
    if(q.length<2){ close(); return; }
    const titoli=[], note=[], resto=[];
    (function walk(n, parent){
      if(n!==st.state.root){
        const color = (TYPES[n.type]||TYPES.nota).color;
        const label = n.title||"(senza nome)", path = parent?.title||"";
        if((n.title||"").toLowerCase().includes(q)){
          titoli.push({color, label, path, go:()=>goToNode(n.id)});
        }else{
          const testo = [n.notes, n.playerNotes].filter(Boolean).join(" · ");
          if(testo.toLowerCase().includes(q))
            note.push({color, label, path, snip:snippet(testo,q), go:()=>goToNode(n.id)});
        }
        for(const f of (n.monster?.foes||[])){
          if((f.name||"").toLowerCase().includes(q)){
            resto.push({color:TYPES.encounter.color, label:f.name, path:label, go:()=>goToNode(n.id)});
            break;   // un risultato per bolla, non uno per "Goblin 1…7"
          }
        }
      }
      n.children.forEach(c=>walk(c, n));
    })(st.state.root, null);
    for(const p of st.state.players||[]){
      const testo = [p.name, p.cls, p.notes].filter(Boolean).join(" · ");
      if(testo.toLowerCase().includes(q))
        resto.push({color:"var(--teal)", label:p.name||"(senza nome)", path:"Giocatori",
          snip:(p.name||"").toLowerCase().includes(q) ? "" : snippet(testo,q),
          go:()=>showView("players")});
    }
    // al tavolo la Checklist non esiste (tab dm-only): non offrire risultati ciechi
    if(!RO) for(const c of st.state.checklist||[]){
      if((c.text||"").toLowerCase().includes(q))
        resto.push({color:"var(--grigio)", label:c.text, path:"Checklist", go:()=>showView("check")});
    }
    results = [...titoli, ...note, ...resto].slice(0, 9);
    if(!results.length){ box.innerHTML = `<div class="ctx-head" style="padding:8px 10px">Nessun risultato</div>`; box.classList.add("show"); return; }
    hi = 0;
    box.innerHTML = results.map((r,i)=>`<button class="${i===hi?"active":""}" data-i="${i}">
      <span class="type-badge" style="background:${r.color}"></span>
      <span class="qs-main"><span>${escapeHtml(r.label)}</span>${r.snip?`<span class="qs-snip">${r.snip}</span>`:""}</span>
      <span class="qs-path">${escapeHtml(r.path)}</span>
    </button>`).join("");
    box.classList.add("show");
    box.querySelectorAll("button").forEach(b=>{
      b.addEventListener("pointerdown", ev=>{ ev.preventDefault(); pick(+b.dataset.i); });
    });
  }
  function pick(i){
    const r = results[i]; if(!r) return;
    close(); inp.value=""; inp.blur();
    r.go();
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

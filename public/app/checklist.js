/* La checklist di preparazione della sessione. */

import { uid } from "./modello.js";
import { st, save } from "./stato.js";

export function renderChecklist(){
  const list = document.getElementById("check-list");
  const done = st.state.checklist.filter(c=>c.done).length;
  document.getElementById("check-progress").textContent =
    st.state.checklist.length ? `${done} su ${st.state.checklist.length} completate` : "Nessuna voce ancora.";
  list.innerHTML = "";
  st.state.checklist.forEach(c=>{
    const div = document.createElement("div");
    div.className = "check-item"+(c.done?" done":"");
    const cb = document.createElement("input");
    cb.type="checkbox"; cb.checked=c.done;
    cb.onchange = ()=>{ c.done=cb.checked; save(); renderChecklist(); };
    const txt = document.createElement("input");
    txt.className="txt"; txt.value=c.text;
    txt.style.cssText="background:none;border:none;border-radius:0;padding:0";
    txt.oninput = ()=>{ c.text=txt.value; save(); };
    const del = document.createElement("button");
    del.className="icon-btn"; del.textContent="✕"; del.title="Elimina";
    del.onclick = ()=>{ st.state.checklist = st.state.checklist.filter(x=>x.id!==c.id); save(); renderChecklist(); };
    div.append(cb,txt,del);
    list.appendChild(div);
  });
}
export function addCheck(){
  const inp = document.getElementById("check-input");
  const v = inp.value.trim(); if(!v) return;
  st.state.checklist.push({id:uid(), text:v, done:false});
  inp.value=""; save(); renderChecklist(); inp.focus();
}
export function initChecklist(){
  document.getElementById("check-input").addEventListener("keydown",e=>{ if(e.key==="Enter") addCheck(); });
}

// per l'onclick inline del bottone Aggiungi
Object.assign(window, { addCheck });

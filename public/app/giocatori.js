/* Le schede dei giocatori: PF, classe e note al tavolo. */

import { uid, escapeHtml, escapeAttr } from "./modello.js";
import { st, save } from "./stato.js";
import { openConfirm, showView } from "./viste.js";
import { renderCanvas } from "./mappa.js";
import { placePlayer } from "./battaglia.js";

export function renderPlayers(){
  const grid = document.getElementById("players-grid");
  grid.innerHTML = "";
  if(!st.state.players.length){
    grid.innerHTML = `<p style="color:var(--ink-dim);grid-column:1/-1">Nessun giocatore ancora — aggiungine uno per tracciare PF e note durante la sessione.</p>`;
  }
  st.state.players.forEach(p=>{
    const card = document.createElement("div");
    card.className="pcard";
    const pct = p.hpMax>0 ? Math.max(0,Math.min(100, p.hp/p.hpMax*100)) : 0;
    card.innerHTML = `
      <div class="head">
        <input class="pname" value="${escapeAttr(p.name)}" placeholder="Nome PG">
      </div>
      <input class="pclass" value="${escapeAttr(p.cls)}" placeholder="Giocatore · Classe">
      <div class="hp-block">
        <button class="hp-btn" data-a="-1">−</button>
        <div class="hp-bar"><i class="${pct<=30?"low":""}" style="transform:scaleX(${pct/100})"></i></div>
        <button class="hp-btn" data-a="1">+</button>
        <span class="hp-num">${p.hp} / <input type="number" min="1" value="${p.hpMax}" title="PF massimi"></span>
      </div>
      <textarea placeholder="Condizioni, oggetti, legami…">${escapeHtml(p.notes)}</textarea>
      <div class="foot">
        <button class="btn tiny in-campo" title="Mette una pedina di questo PG sul livello aperto">⚔ In campo</button>
        <button class="icon-btn" title="Rimuovi giocatore">✕</button>
      </div>
    `;
    card.querySelector(".pname").oninput = e=>{ p.name=e.target.value; save(); };
    card.querySelector(".pclass").oninput = e=>{ p.cls=e.target.value; save(); };
    card.querySelectorAll(".hp-btn").forEach(b=>{
      // renderCanvas: la pedina del PG sul campo legge questi stessi PF, e la sua
      // barra deve scendere insieme al numero qui — sono un dato solo.
      b.onclick = ()=>{ p.hp = Math.max(0, Math.min(p.hpMax, p.hp + Number(b.dataset.a)));
                        save(); renderPlayers(); renderCanvas(); };
    });
    card.querySelector(".in-campo").onclick = ()=>{
      placePlayer(p.id);
      showView("map");                 // la pedina è sulla mappa: portaci l'occhio
    };
    card.querySelector(".hp-num input").onchange = e=>{
      p.hpMax = Math.max(1, Number(e.target.value)||1);
      p.hp = Math.min(p.hp, p.hpMax);
      save(); renderPlayers(); renderCanvas();
    };
    card.querySelector("textarea").oninput = e=>{ p.notes=e.target.value; save(); };
    card.querySelector(".foot .icon-btn").onclick = ()=>{
      openConfirm(`Rimuovere ${p.name||"questo giocatore"}?`, ok=>{
        if(!ok) return;
        st.state.players = st.state.players.filter(x=>x.id!==p.id);
        save(); renderPlayers();
      });
    };
    grid.appendChild(card);
  });
}
export function addPlayer(){
  st.state.players.push({id:uid(), name:"", cls:"", hp:20, hpMax:20, notes:""});
  save(); renderPlayers();
  const first = document.querySelector("#players-grid .pcard:last-child .pname");
  if(first) first.focus();
}

// per l'onclick inline del bottone Aggiungi giocatore
Object.assign(window, { addPlayer });

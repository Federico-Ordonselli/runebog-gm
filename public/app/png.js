/* L'elenco dei PNG (25 set 2026): tutti i nodi `png` dell'albero, con il posto
   in cui stanno, per andare da uno di loro senza ricordarsi il percorso. È il
   diario delle quest applicato ai personaggi, e ne riusa le righe (.q-row).

   Il filtro vive FUORI dall'elenco che si ridisegna: riscriverlo a ogni
   battuta toglierebbe il focus al campo mentre si scrive. Solo DM (la
   scheda è .dm-only): al tavolo la ricerca per nome consegnerebbe un indice
   di chi c'è, e se mostrarlo è una decisione ancora aperta. */

import { escapeHtml } from "./modello.js";
import { st } from "./stato.js";

let filtro = "";

/* Dove sta un PNG, detto come le briciole: dal primo livello sotto la radice
   fino al genitore. La radice è la campagna, e ripeterla su ogni riga non
   dice niente; compare solo se il PNG sta proprio lì. */
function raccogli(){
  const out = [];
  (function walk(n, catena){
    if(n.type === "png") out.push({n, dove: catena.length > 1 ? catena.slice(1) : catena});
    for(const c of n.children) walk(c, [...catena, n.title || "(senza nome)"]);
  })(st.state.root, []);
  return out;
}

const normalizza = s => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export function renderPng(){
  const wrap = document.getElementById("png-list");
  if(!wrap) return;
  const tutti = raccogli()
    .sort((a, b) => (a.n.title || "").localeCompare(b.n.title || "", "it"));
  const q = normalizza(filtro.trim());
  const visti = q ? tutti.filter(({n, dove}) =>
    normalizza(`${n.title} ${dove.join(" ")} ${n.notes}`).includes(q)) : tutti;
  const conto = document.getElementById("png-conto");
  if(conto) conto.textContent = !tutti.length ? "" :
    q ? `${visti.length} di ${tutti.length}` : `${tutti.length} PNG`;
  const riga = ({n, dove}) => {
    const nota = (n.notes || "").trim().split("\n")[0].slice(0, 160);
    return `<div class="q-row">
      <div class="q-body">
        <button type="button" class="q-title png-nome" onclick="goToNode('${n.id}')"
          title="Vai sulla mappa">${escapeHtml(n.title || "(senza nome)")}</button>
        <span class="q-loc">${escapeHtml(dove.join(" › "))}</span>
        ${nota ? `<div class="q-notes">${escapeHtml(nota)}</div>` : ""}
      </div>
    </div>`;
  };
  wrap.innerHTML = !tutti.length
    ? `<p class="q-empty">Nessun PNG sulla mappa: trascina un segnalino PNG dalla barra della Mappa.</p>`
    : visti.length ? visti.map(riga).join("")
    : `<p class="q-empty">Nessun PNG corrisponde a «${escapeHtml(filtro.trim())}».</p>`;
}

export function initPng(){
  const campo = document.getElementById("png-filtro");
  if(!campo) return;
  campo.addEventListener("input", () => { filtro = campo.value; renderPng(); });
}

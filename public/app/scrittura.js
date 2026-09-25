/* La scrittura sul posto (25 set 2026): doppio clic su una casella di testo o
   su un segnalino con la scheda (SCHEDA_TIPI) e si scrive lì, sopra quello
   che si sta scrivendo, invece che nel pannello laterale. È la metà
   "scrivere" della bolla come pagina: la scheda si legge sulla mappa, e si
   deve poter scrivere dove la si legge.

   - È una textarea HTML fuori da `plan-svg`, come `#plan-scale`: renderCanvas
     riscrive la tela a ogni disegno, e un editor dentro un foreignObject
     sparirebbe a ogni battuta insieme al cursore. Segue la cosa da scrivere
     con `riposizionaScrittura`, chiamata da renderCanvas e da planApplyVB
     (zoom e pan) — la posizione la dà il riquadro vero sullo schermo, quindi
     nessuna conversione di coordinate da tenere allineata.
   - Il testo è la marcatura di testo-ricco.js, come nel pannello, e la barra
     è la stessa (`barraFormattazione`): un comando solo, due posti.
   - Una sessione è UN Ctrl+Z (apriSessione/chiudiSessione in stato.js).
   - Si chiude con Esc, con "Fatto" o toccando fuori (focusout). La chiusura
     non ridisegna la tela: se la chiude un pointerdown su un'altra bolla, un
     renderCanvas distruggerebbe il nodo sotto il dito a metà gesto — e la
     tela è già aggiornata, perché si ridisegna a ogni battuta.
   - Su schermo stretto non sta sopra il riquadro ma in cima alla tela: la
     tastiera virtuale sale dal basso e coprirebbe proprio quello che si sta
     scrivendo. Posizione e altezza le dà `visualViewport`, cioè ciò che la
     tastiera lascia libero: su iPhone la tastiera non solo accorcia l'area
     visibile ma la sposta in giù (`offsetTop`), e un editor fissato in cima
     alla tela finirebbe sopra il bordo dello schermo. Lo spostamento arriva
     come `scroll` del visualViewport, non come `resize`. */

import { RO, save, selectNode, apriSessione, chiudiSessione } from "./stato.js";
import { planSvg, renderCanvas, adattaTesto, childOf } from "./mappa.js";
import { renderDetail, barraFormattazione, tastiTesto, editNode } from "./pannello.js";
import { isTesto, testoSize, testoAllinea, schedaDi, escapeAttr, TYPES, TESTO_ALLINEA } from "./modello.js";

let aperta = null;          // {id, n, box, ta}

const stretto = () => matchMedia("(max-width:760px), (max-height:480px)").matches;

export const scritturaAperta = () => aperta?.id ?? null;

export function apriScrittura(id){
  if(RO) return;
  const n = childOf(id); if(!n) return;
  chiudiScrittura();
  selectNode(id);
  renderCanvas(); renderDetail();

  const testo = isTesto(n);
  const nome = testo ? "casella di testo" : `${(TYPES[n.type]||TYPES.nota).label} ${n.title||""}`.trim();
  const box = document.createElement("div");
  box.id = "scrittura";
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", `Scrittura: ${nome}`);
  box.innerHTML = `<div class="scrittura-barra">
      ${barraFormattazione(id, "scrittura-area")}
      <div class="testo-strumenti scrittura-extra">
        <button class="btn tiny" type="button" onmousedown="event.preventDefault()" data-cmd="meno"
          title="Carattere più piccolo" aria-label="Carattere più piccolo">A−</button>
        <button class="btn tiny" type="button" onmousedown="event.preventDefault()" data-cmd="piu"
          title="Carattere più grande" aria-label="Carattere più grande">A+</button>
        <button class="btn tiny" type="button" onmousedown="event.preventDefault()" data-cmd="allinea"></button>
        <span class="sep"></span>
        <button class="btn tiny primary" type="button" onmousedown="event.preventDefault()" data-cmd="fatto"
          title="Fine (Esc)">Fatto</button>
      </div>
    </div>
    <textarea id="scrittura-area" spellcheck="true" aria-label="${escapeAttr(testo ? "Testo della casella" : "Descrizione")}"
      placeholder="${testo ? "Quello che vuoi leggere a colpo d'occhio sulla mappa"
                           : "Chi è, cosa vuole, cosa sa: si legge sotto il segnalino"}"></textarea>`;
  const ta = box.querySelector("textarea");
  ta.value = n.notes || "";
  document.getElementById("plan-wrap").append(box);
  aperta = {id, n, box, ta};
  apriSessione();
  aggiornaAllinea();

  ta.addEventListener("input", ()=>{
    if(!aperta) return;
    aperta.n.notes = ta.value;
    save();
    ridisegna();
  });
  ta.addEventListener("keydown", ev=>{
    if(ev.key === "Escape"){ ev.preventDefault(); ev.stopPropagation(); chiudiScrittura(true); return; }
    tastiTesto(ev, id);
  });
  box.addEventListener("click", ev=>{
    const b = ev.target.closest("[data-cmd]"); if(!b || !aperta) return;
    const c = b.dataset.cmd;
    if(c === "fatto") return chiudiScrittura(true);
    if(c === "meno" || c === "piu") window.cambiaCarattere(id, c === "piu" ? 1 : -1);
    if(c === "allinea"){
      const k = Object.keys(TESTO_ALLINEA), i = k.indexOf(testoAllinea(aperta.n));
      editNode(id, "textAlign", k[(i + 1) % k.length]);
      aggiornaAllinea();
    }
    ta.focus();
  });
  box.addEventListener("focusout", ev=>{
    if(aperta && !box.contains(ev.relatedTarget)) chiudiScrittura();
  });

  riposizionaScrittura();
  // Dopo l'evento che l'ha aperta: un Invio da tastiera finirebbe dentro
  // come a capo, e il focus di un clic arriverebbe dopo e lo porterebbe via.
  setTimeout(()=>{ if(aperta?.ta === ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } });
}

/* La battuta vale come editNode("notes") — salvataggio e annulla — ma senza
   il suo renderDetail: il pannello lo si ridisegna alla chiusura. */
function ridisegna(){
  renderCanvas();
  if(aperta && isTesto(aperta.n)) adattaTesto(aperta.n);
}

function aggiornaAllinea(){
  const b = aperta?.box.querySelector('[data-cmd="allinea"]'); if(!b) return;
  const al = testoAllinea(aperta.n);
  b.textContent = {left:"⇤", center:"↔", right:"⇥", justify:"☰"}[al];
  b.title = `Allineamento: ${TESTO_ALLINEA[al].toLowerCase()} (clic per cambiare)`;
  b.setAttribute("aria-label", b.title);
}

export function chiudiScrittura(conFocus = false){
  if(!aperta) return;
  const {id, box} = aperta;
  aperta = null;
  box.remove();
  chiudiSessione();
  renderDetail();
  if(conFocus) planSvg().querySelector(`.blk[data-block="${id}"]`)?.focus();
}

/* Dove sta l'editor: sopra il riquadro che si sta scrivendo (la scheda, o la
   casella), grande almeno quanto serve a scriverci. Un segnalino senza
   descrizione non ha ancora una scheda, e l'editor si apre dove comparirà,
   sotto il nome. Se la cosa non è più sulla tela (annulla, cambio di
   livello, eliminata) la scrittura si chiude: scrivere in un nodo che non si
   vede più vorrebbe dire scrivere in un documento che non c'è. */
/* Sotto i 16px iOS ingrandisce la pagina al focus e ce la lascia (vedi la
   regola @supports in app.css, che usa lo stesso test): lì il minimo sale. */
const SCRITTURA_MIN = globalThis.CSS?.supports?.("-webkit-touch-callout", "none") ? 16 : 14;
export function riposizionaScrittura(){
  if(!aperta) return;
  const n = childOf(aperta.id);
  const g = planSvg().querySelector(`.blk[data-block="${aperta.id}"]`);
  if(!n || n !== aperta.n || !g) return chiudiScrittura();
  const wrap = document.getElementById("plan-wrap").getBoundingClientRect();
  const {box, ta} = aperta;
  const k = planSvg().getScreenCTM()?.a || 1;
  const px = isTesto(n) ? testoSize(n) : schedaDi(n).px;
  ta.style.fontSize = Math.max(SCRITTURA_MIN, Math.min(28, px * k)) + "px";
  ta.style.textAlign = testoAllinea(n);

  if(stretto()){
    const vv = window.visualViewport;
    const cima = vv ? vv.offsetTop : 0, basso = vv ? vv.offsetTop + vv.height : innerHeight;
    const top = Math.max(8, cima - wrap.top + 8);
    const alto = Math.max(120, Math.min(wrap.height * .5, basso - wrap.top - top - 8));
    box.classList.add("in-cima");
    Object.assign(box.style, {left:"8px", top:`${top}px`, width:`${wrap.width - 16}px`, height:""});
    Object.assign(box.querySelector(".scrittura-barra").style, {left:"", maxWidth:""});
    ta.style.height = `${alto - box.querySelector(".scrittura-barra").offsetHeight - 6}px`;
    return;
  }
  box.classList.remove("in-cima");
  const bersaglio = g.querySelector(".scheda-fondo") || (isTesto(n) ? g.querySelector(".blk-shape") : null);
  let r;
  if(bersaglio) r = bersaglio.getBoundingClientRect();
  else{
    const gr = g.getBoundingClientRect(), w = schedaDi(n).w * k;
    r = {left: gr.left + gr.width/2 - w/2, top: gr.bottom + 6, width: w, height: 0};
  }
  const w = Math.min(wrap.width - 16, Math.max(280, r.width));
  const h = Math.min(wrap.height - 16, Math.max(120, r.height));
  const left = Math.max(8, Math.min(r.left - wrap.left, wrap.width - w - 8));
  const top = Math.max(8, Math.min(r.top - wrap.top, wrap.height - h - 8));
  // La barra sta sopra; se sopra non c'è posto, sotto.
  box.classList.toggle("barra-sotto", top < 52);
  Object.assign(box.style, {left:`${left}px`, top:`${top}px`, width:`${w}px`});
  ta.style.height = `${h}px`;
  // La barra è più larga della textarea: se sfora a destra della tela, la
  // si sposta a sinistra quanto basta (la tela taglia ciò che esce).
  const barra = box.querySelector(".scrittura-barra");
  barra.style.maxWidth = `${wrap.width - 16}px`;
  barra.style.left = "0px";
  const eccesso = left + barra.offsetWidth - (wrap.width - 8);
  if(eccesso > 0) barra.style.left = `${-Math.min(eccesso, left - 8)}px`;
}

window.visualViewport?.addEventListener("resize", riposizionaScrittura);
window.visualViewport?.addEventListener("scroll", riposizionaScrittura);

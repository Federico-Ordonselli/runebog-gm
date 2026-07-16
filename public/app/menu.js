/* Il menu contestuale della mappa: tasto destro col mouse, long-press su touch
   (il long-press lo rileva mappa.js, che chiama showCtxFor). */

import { TYPES, SHAPES, EDGE_TYPES, STATUS_COLORS, isMarker, defShape } from "./modello.js";
import { st, currentNode } from "./stato.js";
import { childOf, enterNode, duplicateSelected, addSpatialChild, arrangeGrid,
         planPointXY, renderCanvas } from "./mappa.js";
import { renderDetail, editNode, askDeleteNode, editEdge, deleteEdge } from "./pannello.js";

const ctxEl = () => document.getElementById("ctx-menu");
function closeCtx(){ ctxEl().classList.remove("show"); }

function openCtx(items, x, y){
  const el = ctxEl();
  el.innerHTML = items.map(it=>{
    if(it==="---") return "<hr>";
    if(it.head) return `<div class="ctx-head">${it.head}</div>`;
    const icon = it.dot ? `<span class="dot" style="background:${it.dot}"></span>`
               : it.bar ? `<span class="bar" style="border-color:${it.bar}${it.dash?";border-top-style:dashed":""}"></span>`
               : "";
    return `<button class="${it.danger?"danger":""}" data-act="${it.id}">${icon}${it.label}</button>`;
  }).join("");
  el.querySelectorAll("button").forEach((b,)=>{
    b.onclick = ()=>{ closeCtx(); const it = items.filter(i=>i!=="---"&&!i.head)[[...el.querySelectorAll("button")].indexOf(b)]; it.run(); };
  });
  el.classList.add("show");
  const r = el.getBoundingClientRect();
  el.style.left = Math.min(x, innerWidth  - r.width  - 8) + "px";
  el.style.top  = Math.min(y, innerHeight - r.height - 8) + "px";
}

function focusDetailTitle(){
  setTimeout(()=>{ const i=document.querySelector("#detail input"); if(i){ i.focus(); i.select(); } }, 50);
}

export function showCtxFor(target, cx, cy){
  const blkEl  = target.closest(".blk");
  const edgeEl = target.closest(".edge");

  if(blkEl){
    const n = childOf(blkEl.dataset.block); if(!n) return;
    if(!st.multiSel.has(n.id)) st.multiSel = new Set([n.id]);
    st.selectedId = n.id; st.selectedEdgeId = null; renderCanvas(); renderDetail();
    const items = [
      {id:"enter", label:"Entra →", run:()=>enterNode(n.id)},
      {id:"ren",   label:"Rinomina", run:()=>{ st.selectedId=n.id; renderDetail(); focusDetailTitle(); }},
      {id:"dup",   label:"Duplica", run:()=>{ st.selectedId=n.id; duplicateSelected(); }},
      "---",
      {head:"Stato"},
      ...Object.entries(STATUS_COLORS).map(([stt,col])=>({
        id:"st-"+stt, label: stt + (n.status===stt?"  ✓":""), dot:col,
        run:()=>editNode(n.id,"status", n.status===stt ? "" : stt)
      })),
      ...(!isMarker(n) ? [
        "---",
        {head:"Forma"},
        ...Object.entries(SHAPES).map(([k,s])=>({
          id:"sh-"+k, label: s.label + ((n.shape||defShape(n))===k?"  ✓":""),
          run:()=>editNode(n.id,"shape",k)
        }))
      ] : []),
      "---",
      {id:"del", label:"Elimina…", danger:true, run:()=>askDeleteNode(n.id)}
    ];
    openCtx(items, cx, cy);
    return;
  }

  if(edgeEl){
    const cur = currentNode();
    const e = (cur.edges||[]).find(x=>x.id===edgeEl.dataset.edge); if(!e) return;
    st.selectedEdgeId = e.id; st.selectedId = null; renderCanvas(); renderDetail();
    const items = [
      {head:"Tipo di collegamento"},
      ...Object.entries(EDGE_TYPES).map(([k,t])=>({
        id:"t-"+k, label: t.label + (e.type===k?"  ✓":""), bar:t.stroke, dash:!!t.dash,
        run:()=>editEdge(e.id,"type",k)
      })),
      "---",
      {id:"lab", label:"Etichetta…", run:()=>{ st.selectedEdgeId=e.id; renderDetail(); focusDetailTitle(); }},
      {id:"del", label:"Elimina", danger:true, run:()=>deleteEdge(e.id)}
    ];
    openCtx(items, cx, cy);
    return;
  }

  // tela vuota: crea qui
  const p = planPointXY(cx, cy);
  const items = [
    {head:"Nuova bolla qui"},
    ...Object.entries(SHAPES).map(([k,s])=>({
      id:"sh-"+k, label:s.label, dot:"var(--teal)",
      run:()=>addSpatialChild({shape:k}, p.x, p.y)
    })),
    "---",
    {head:"Nuovo segnalino qui"},
    ...["quest","encounter","png","nota","token"].map(t=>({
      id:"mk-"+t, label:TYPES[t].label, dot:TYPES[t].color,
      run:()=>addSpatialChild({marker:t}, p.x, p.y)
    })),
    "---",
    {id:"grid", label:"Riordina in griglia", run:arrangeGrid}
  ];
  openCtx(items, cx, cy);
}

export function initMenu(){
  addEventListener("pointerdown", e=>{ if(!e.target.closest("#ctx-menu")) closeCtx(); }, true);
  addEventListener("keydown", e=>{ if(e.key==="Escape") closeCtx(); });
  addEventListener("blur", closeCtx);
}

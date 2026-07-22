/* Il menu contestuale della mappa: tasto destro col mouse, long-press su touch
   (il long-press lo rileva mappa.js, che chiama showCtxFor). */

import { TYPES, SHAPES, EDGE_TYPES, STATUS_COLORS, isMarker, defShape,
         DOOR_TYPES, doorKind } from "./modello.js";
import { st, currentNode, newCampaign, askDeleteCampaign, doUndo, RO,
         selectNode, selectWall } from "./stato.js";
import { openKeys } from "./viste.js";
import { exportJSON } from "./esporta.js";
import { childOf, enterNode, duplicateSelected, addSpatialChild, arrangeGrid,
         planPointXY, renderCanvas, wallOf, setWallDoor, deleteWallSeg } from "./mappa.js";
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
  const wallEl = target.closest(".wall-seg");

  if(blkEl){
    const n = childOf(blkEl.dataset.block); if(!n) return;
    if(!st.multiSel.has(n.id)) selectNode(n.id);
    st.selectedId = n.id; st.selectedEdgeId = st.selectedWallId = null; renderCanvas(); renderDetail();
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

  /* Un muro: qui si decide se è pieno o è una porta. È lo stesso posto in cui
     si cambia tipo a un collegamento, ed è il gesto più corto — il pannello ha
     lo stesso comando, ma sta dall'altra parte dello schermo. */
  if(wallEl){
    const w = wallOf(wallEl.dataset.wall); if(!w) return;
    selectWall(w.id); renderCanvas(); renderDetail();
    const kind = doorKind(w);
    const items = [
      {head:"Tipo di muro"},
      {id:"t-pieno", label:"Muro pieno" + (kind?"":"  ✓"), bar:"var(--ink-dim)",
       run:()=>setWallDoor(w.id, "")},
      ...Object.entries(DOOR_TYPES).map(([k,d])=>({
        id:"t-"+k, label: d.label + (kind===k?"  ✓":""),
        bar: k==="segreta" ? "var(--viola)" : "var(--track)", dash: k==="segreta",
        run:()=>setWallDoor(w.id, k)
      })),
      "---",
      {id:"del", label:"Elimina", danger:true, run:()=>deleteWallSeg(w.id)}
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

/* Il menu "⋯" della topbar mobile: sotto i 760px le azioni rare in sessione
   (esporta/importa, tema, scorciatoie, gestione campagne) stanno qui, così la
   topbar scende a due righe e la tela si riprende lo schermo. I bottoni estesi
   restano nel markup: su desktop questo bottone è display:none. */
export function openTopbarMenu(ev){
  const cur = document.getElementById("theme-select")?.value || "torbiera";
  const TEMI = {torbiera:"Torbiera", pergamena:"Pergamena", cripta:"Cripta",
                brace:"Brace", contrasto:"Alto contrasto"};
  const items = [];
  /* Le regole stanno accanto al generatore di dungeon perché sono la stessa
     cosa: uno strumento che vive altrove nel sito e si apre in una scheda
     nuova, così la campagna aperta non si perde. Serve anche ai giocatori al
     tavolo — un incantesimo lo cerca chi lo lancia — e lì il menu è corto,
     quindi apre l'elenco invece di stare in coda a cinque temi. */
  const regole = {id:"srd", label:"Regole SRD 5.2.1 ↗",
                  run:()=>window.open("/srd","_blank","noopener")};
  if(!RO){
    items.push(
      // Sempre presente, non solo a stack pieno: è la via touch all'undo e deve
      // essere scopribile; a stack vuoto doUndo risponde "Niente da annullare".
      {id:"undo", label:"Annulla l'ultima modifica ↩", run:doUndo},
      "---",
      {id:"exp", label:"Esporta la campagna", run:()=>exportJSON()},
      {id:"imp", label:"Importa da file…", run:()=>document.getElementById("import-file").click()},
      // Il generatore sta anche nel pannello del livello, ma lì compare solo se
      // non c'è un segnalino selezionato: qui è raggiungibile sempre, da dentro
      // qualsiasi campagna. Scheda nuova: la campagna aperta non si perde.
      {id:"dg", label:"Genera un dungeon ↗", run:()=>window.open("/dungeon","_blank","noopener")},
      regole,
      "---"
    );
  }else items.push(regole, "---");
  items.push({head:"Tema"});
  for(const [k,label] of Object.entries(TEMI))
    // setTheme vive in main.js (l'entry point): importarlo da qui invertirebbe
    // il verso dell'avvio, quindi si passa dal window come gli onclick inline.
    items.push({id:"th-"+k, label: label + (cur===k?"  ✓":""), run:()=>window.setTheme(k)});
  items.push("---", {id:"keys", label:"Scorciatoie da tastiera", run:openKeys});
  if(!RO && !window.__cloud){
    items.push("---",
      {id:"newc", label:"Nuova campagna", run:newCampaign},
      {id:"delc", label:"Elimina campagna…", danger:true, run:askDeleteCampaign});
  }
  const r = ev.currentTarget.getBoundingClientRect();
  openCtx(items, r.left, r.bottom + 6);
}

export function initMenu(){
  addEventListener("pointerdown", e=>{ if(!e.target.closest("#ctx-menu")) closeCtx(); }, true);
  addEventListener("keydown", e=>{ if(e.key==="Escape") closeCtx(); });
  addEventListener("blur", closeCtx);
}

// per l'onclick inline del bottone "⋯" in topbar
Object.assign(window, { openTopbarMenu });

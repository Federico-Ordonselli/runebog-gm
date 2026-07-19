/* Scorciatoie da tastiera globali. Attive solo fuori dai campi di testo
   e, per quelle della mappa, solo con la vista Mappa aperta. */

import { gridShape, CELL } from "./modello.js";
import { st, save, doUndo, findNode } from "./stato.js";
import { showView, openKeys } from "./viste.js";
import { goUp, enterNode, planZoom, planFit, renderCanvas,
         requestDeleteSelection, duplicateSelected } from "./mappa.js";
import { renderDetail, deleteEdge } from "./pannello.js";

export function initScorciatoie(){
  addEventListener("keydown", e=>{
    // Ctrl+K prima del filtro sui campi: la ricerca deve rispondere anche
    // mentre si scrive in un input, sennò il power user la perde proprio
    // quando ha le mani sulla tastiera.
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){
      e.preventDefault(); showView("map");
      document.getElementById("quick-search").focus();
      return;
    }
    const t = e.target;
    if(t && t.matches && t.matches("input, textarea, select")) return;
    if(document.getElementById("ctx-menu").classList.contains("show")) return;
    // Ctrl+Z globale (dopo il filtro sui campi: lì comanda l'undo nativo del browser)
    if((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==="z"){
      e.preventDefault();
      doUndo();
      return;
    }
    // "?" apre l'elenco delle scorciatoie da qualunque vista (fuori dai campi:
    // lì il punto di domanda è testo che si sta scrivendo)
    if(e.key==="?"){ e.preventDefault(); openKeys(); return; }
    if(!document.getElementById("view-map").classList.contains("active")) return;
    const k = e.key;
    if(k==="Escape"){
      if(st.selectedId||st.selectedEdgeId||st.multiSel.size){
        // se il focus è su una bolla, va tolto: il ripristino del focus dopo il
        // render la ri-selezionerebbe subito
        if(t && t.closest && t.closest("#plan-svg")) t.blur();
        st.selectedId=null; st.selectedEdgeId=null; st.multiSel.clear(); renderCanvas(); renderDetail();
      }
      else goUp();
    }else if(k===" " && t && t.closest && t.closest(".blk")){
      // Space sulla bolla a fuoco = Ctrl+clic: entra/esce dalla selezione multipla
      e.preventDefault();
      const id = t.closest(".blk").dataset.block;
      if(st.multiSel.has(id)){
        st.multiSel.delete(id);
        if(st.selectedId===id) st.selectedId = [...st.multiSel].at(-1) || null;
      }else{
        st.multiSel.add(id); st.selectedId = id;
      }
      renderCanvas(); renderDetail();
    }else if(k==="Delete"||k==="Backspace"){
      e.preventDefault();
      if(st.selectedEdgeId) deleteEdge(st.selectedEdgeId);
      else requestDeleteSelection();
    }else if(k==="Enter"){
      if(st.selectedId) enterNode(st.selectedId);
    }else if((e.ctrlKey||e.metaKey) && k.toLowerCase()==="d"){
      e.preventDefault(); duplicateSelected();
    }else if(k==="+"||k==="="){
      planZoom(1.2);
    }else if(k==="-"){
      planZoom(1/1.2);
    }else if(k.toLowerCase()==="f"){
      planFit(true);
    }else if(k.startsWith("Arrow") && (st.multiSel.size || st.selectedId)){
      const ids = st.multiSel.size ? [...st.multiSel] : [st.selectedId];
      const step = e.shiftKey ? 1 : 10;
      let any = false;
      for(const id of ids){
        const n = findNode(id);
        if(!n || typeof n.x!=="number") continue;
        // Le forme in scala si spostano di quadretti interi, anche con Shift:
        // un ritocco da 1px le porterebbe fuori dalla maglia che le definisce.
        const s = gridShape(n) ? CELL : step;
        if(k==="ArrowLeft")  n.x-=s;
        if(k==="ArrowRight") n.x+=s;
        if(k==="ArrowUp")    n.y-=s;
        if(k==="ArrowDown")  n.y+=s;
        any = true;
      }
      if(any){ e.preventDefault(); save(); renderCanvas(); }
    }
  });
}

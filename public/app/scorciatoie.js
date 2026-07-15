/* Scorciatoie da tastiera globali. Attive solo fuori dai campi di testo
   e, per quelle della mappa, solo con la vista Mappa aperta. */

import { st, save, findNode } from "./stato.js";
import { showView } from "./viste.js";
import { goUp, enterNode, planZoom, planFit, renderCanvas,
         requestDeleteSelection, duplicateSelected } from "./mappa.js";
import { renderDetail, deleteEdge } from "./pannello.js";

export function initScorciatoie(){
  addEventListener("keydown", e=>{
    const t = e.target;
    if(t && t.matches && t.matches("input, textarea, select")) return;
    if(document.getElementById("ctx-menu").classList.contains("show")) return;
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="k"){
      e.preventDefault(); showView("map");
      document.getElementById("quick-search").focus();
      return;
    }
    if(!document.getElementById("view-map").classList.contains("active")) return;
    const k = e.key;
    if(k==="Escape"){
      if(st.selectedId||st.selectedEdgeId||st.multiSel.size){ st.selectedId=null; st.selectedEdgeId=null; st.multiSel.clear(); renderCanvas(); renderDetail(); }
      else goUp();
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
        if(k==="ArrowLeft")  n.x-=step;
        if(k==="ArrowRight") n.x+=step;
        if(k==="ArrowUp")    n.y-=step;
        if(k==="ArrowDown")  n.y+=step;
        any = true;
      }
      if(any){ e.preventDefault(); save(); renderCanvas(); }
    }
  });
}

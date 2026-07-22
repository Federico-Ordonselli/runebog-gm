/* Scorciatoie da tastiera globali. Attive solo fuori dai campi di testo
   e, per quelle della mappa, solo con la vista Mappa aperta. */

import { onGrid, CELL } from "./modello.js";
import { st, save, doUndo, findNode, clearSel } from "./stato.js";
import { showView, openKeys } from "./viste.js";
import { goUp, enterNode, planZoom, planFit, renderCanvas, wallOf,
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
      if(st.selectedId||st.selectedEdgeId||st.selectedWallId||st.multiSel.size||st.multiSelWalls.size){
        // se il focus è su una bolla, va tolto: il ripristino del focus dopo il
        // render la ri-selezionerebbe subito
        if(t && t.closest && t.closest("#plan-svg")) t.blur();
        clearSel(); renderCanvas(); renderDetail();
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
    }else if(k===" " && t && t.closest && t.closest(".wall-seg")){
      // Stessa cosa sui muri: la via da tastiera alla selezione multipla non
      // può esistere per le bolle e non per i muri.
      e.preventDefault();
      const id = t.closest(".wall-seg").dataset.wall;
      if(st.multiSelWalls.has(id)){
        st.multiSelWalls.delete(id);
        if(st.selectedWallId===id) st.selectedWallId = [...st.multiSelWalls].at(-1) || null;
      }else{
        st.multiSelWalls.add(id); st.selectedWallId = id;
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
    }else if(k.startsWith("Arrow") &&
             (st.multiSel.size || st.selectedId || st.multiSelWalls.size || st.selectedWallId)){
      const ids = st.multiSel.size ? [...st.multiSel] : (st.selectedId ? [st.selectedId] : []);
      const muri = (st.multiSelWalls.size ? [...st.multiSelWalls]
                  : (st.selectedWallId ? [st.selectedWallId] : []))
        .map(id=>wallOf(id)).filter(Boolean);
      const nodi = ids.map(id=>findNode(id)).filter(n=>n && typeof n.x==="number");
      if(!nodi.length && !muri.length) return;
      /* UN passo per tutta la selezione, deciso dal membro più vincolato. Chi
         sta sulla maglia si muove di quadretti interi anche con Shift — un
         ritocco da 1px porta una pianta fuori dalla maglia che la definisce, e
         un muro sui bordi delle celle non ha dove appoggiarsi a mezza cella —
         e un passo diverso per ciascuno deformerebbe il gruppo a ogni freccia. */
      const passo = (muri.length || nodi.some(onGrid)) ? CELL : (e.shiftKey ? 1 : 10);
      const dx = k==="ArrowLeft" ? -passo : k==="ArrowRight" ? passo : 0;
      const dy = k==="ArrowUp"   ? -passo : k==="ArrowDown"  ? passo : 0;
      if(!dx && !dy) return;
      for(const n of nodi){ n.x += dx; n.y += dy; }
      for(const w of muri){ w.x += dx; w.y += dy; }
      e.preventDefault(); save(); renderCanvas();
    }
  });
}

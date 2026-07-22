/* Esporta/Importa: lo stesso JSON {root, checklist, players} del salvataggio,
   come file. È il formato di scambio con il sito (colonna campaign.data). */

import { st, save, migrateState, resetUndo, clearSel } from "./stato.js";
import { openAlert, showView } from "./viste.js";

export function exportJSON(){
  const json = JSON.stringify(st.state, null, 2);
  const d = new Date().toISOString().slice(0,10);
  const blob = new Blob([json], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `runebog-campagna-${d}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
function applyImportedJSON(text){
  const data = JSON.parse(text);
  if(!data.root || !Array.isArray(data.checklist) || !Array.isArray(data.players))
    throw new Error("formato non valido");
  migrateState(data);
  st.state = data;
  resetUndo();                       // l'import sostituisce tutto: niente undo all'indietro
  st.path = [st.state.root.id]; clearSel();
  save();
  showView("map");
}
export function initEsporta(){
  document.getElementById("import-file").addEventListener("change", e=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{
      try{ applyImportedJSON(r.result); }
      catch(_){ openAlert("Questo file non è una campagna Runebog: serve il .json creato con Esporta."); }
      e.target.value = "";
    };
    r.readAsText(f);
  });
}

// per l'onclick inline del bottone Esporta
Object.assign(window, { exportJSON });

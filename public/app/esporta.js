/* Esporta/Importa: lo stesso JSON {root, checklist, players} del salvataggio,
   come file. È il formato di scambio con il sito (colonna campaign.data). */

import { st, save, migrateState, resetUndo, clearSel } from "./stato.js";
import { openAlert, showView } from "./viste.js";
import { parseCampaignJson, campaignErrorMessage } from "./formato-campagna.js";

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
/* L'import è un percorso di SCRITTURA, quindi qui il contratto morde: un file
   che non passa non entra, e non si perde niente perché la campagna aperta
   resta dov'era. È anche il vettore per cui il contratto esiste — JSON altrui,
   forma plausibile, contenuto ostile — e le tre righe di prima (`root`,
   `checklist`, `players` esistono) lasciavano passare un albero profondo
   diecimila livelli. */
function applyImportedJSON(text){
  const esito = parseCampaignJson(text);
  if(!esito.ok) throw new Error(campaignErrorMessage(esito.error));
  const data = esito.value;
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
      /* Il motivo si mostra: "non è una campagna Runebog" è vero per un file
         sbagliato e fuorviante per un export vero che sfora un limite — e in
         quel secondo caso è l'unica indicazione su cosa correggere. È testo
         controllato (messaggi fissi più un percorso troncato), e finisce in
         textContent, non in HTML. */
      try{ applyImportedJSON(r.result); }
      catch(err){ openAlert(`Importazione non riuscita. ${err.message}`); }
      e.target.value = "";
    };
    r.readAsText(f);
  });
}

// per l'onclick inline del bottone Esporta
Object.assign(window, { exportJSON });

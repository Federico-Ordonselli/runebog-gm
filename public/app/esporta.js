/* Esporta/Importa: lo stesso JSON {root, checklist, players} del salvataggio,
   come file. È il formato di scambio con il sito (colonna campaign.data). */

import { st, save, migrateState, resetUndo, clearSel,
         importAsNewCampaign } from "./stato.js";
import { openAlert, openConfirm, showView } from "./viste.js";
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
const contaBolle = n => 1 + n.children.reduce((s,c)=>s+contaBolle(c), 0);

/* L'import è un percorso di SCRITTURA, quindi qui il contratto morde: un file
   che non passa non entra, e non si perde niente perché la campagna aperta
   resta dov'era. È anche il vettore per cui il contratto esiste — JSON altrui,
   forma plausibile, contenuto ostile — e le tre righe di prima (`root`,
   `checklist`, `players` esistono) lasciavano passare un albero profondo
   diecimila livelli.

   La validazione viene PRIMA della domanda, e non è un dettaglio d'ordine: un
   file illeggibile non mette a rischio niente, quindi chiedere "sostituisco?"
   per poi fallire sarebbe uno spavento per nulla. Chi legge il dialogo sa già
   che il file è buono, e sta decidendo solo del proprio lavoro. */
function preparaImport(text){
  const esito = parseCampaignJson(text);
  if(!esito.ok) throw new Error(campaignErrorMessage(esito.error));
  const data = esito.value;
  migrateState(data);
  return data;
}
/* Sostituire la campagna aperta: è la strada del cloud, dove l'indirizzo è la
   campagna e uno slot nuovo non esiste. */
function replaceWithImported(data){
  st.state = data;
  resetUndo();                       // l'import sostituisce tutto: niente undo all'indietro
  st.path = [st.state.root.id]; clearSel();
  save();
  showView("map");
}
function applyImportedJSON(text){
  const data = preparaImport(text);
  // In locale non si distrugge niente: la campagna importata è una in più.
  if(importAsNewCampaign(data)) return;
  /* Qui invece il danno è identico a quello di "Elimina campagna", e la
     rassicurazione deve esserlo: quante bolle si stanno perdendo, quante ne
     arrivano, e il rimando all'Esporta come via d'uscita. */
  openConfirm(
    `Sostituire "${st.state.root.title||"senza nome"}" (${contaBolle(st.state.root)} bolle) ` +
    `con "${data.root.title||"senza nome"}" (${contaBolle(data.root)} bolle)? ` +
    `La campagna aperta viene sovrascritta e non si può annullare ` +
    `(fai prima un Esporta se hai dubbi).`,
    ok=>{ if(ok) replaceWithImported(data); });
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

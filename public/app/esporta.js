/* Esporta/Importa: lo stesso JSON {root, checklist, players} del salvataggio,
   come file. È il formato di scambio con il sito (colonna campaign.data). */

import { embedImages, uploadImages, replaceImageUrls, ARCHIVE_BYTES } from "./immagini.js";
import { st, save, migrateState, resetUndo, clearSel,
         importAsNewCampaign } from "./stato.js";
import { openAlert, openConfirm, showView } from "./viste.js";
import { parseCampaignJson, campaignErrorMessage } from "./formato-campagna.js";

let exporting = false;
export async function exportJSON(){
  if(exporting) return;
  exporting = true;
  const status = document.getElementById("savestate");
  try{
    const snapshot = await embedImages(st.state, {
      onProgress(done,total){ if(status) status.textContent = `Preparazione backup: immagini ${done}/${total}…`; },
    });
    const json = JSON.stringify(snapshot, null, 2);
    const d = new Date().toISOString().slice(0,10);
    const blob = new Blob([json], {type:"application/json"});
    if(blob.size > ARCHIVE_BYTES) throw new Error("Il backup supera 64 MiB.");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `runebog-campagna-${d}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),0);
    if(status) status.textContent = "Backup completo esportato ✓";
  }catch(error){
    if(status) status.textContent = "Esportazione non riuscita";
    openAlert(`Backup non creato: ${error.message} Riprova quando tutte le immagini sono disponibili.`);
  }finally{ exporting = false; }
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
  const esito = parseCampaignJson(text, {documentBytes:ARCHIVE_BYTES});
  if(!esito.ok) throw new Error(campaignErrorMessage(esito.error));
  const data = esito.value;
  migrateState(data, {documentBytes:ARCHIVE_BYTES});
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
async function applyImportedJSON(text){
  let data = preparaImport(text);
  if(!window.__cloud) data = await embedImages(data);
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
    async ok=>{
      if(!ok) return;
      const progress = document.createElement("dialog");
      const message = document.createElement("p");
      message.setAttribute("role", "status");
      progress.append(message); document.body.append(progress);
      progress.addEventListener("cancel",e=>e.preventDefault()); progress.showModal();
      let failure = null;
      try{
        const urls = await uploadImages(data, window.__cloud.id, {copyUrls:true,
          onProgress(done,total){ message.textContent=`Importazione immagini: ${done}/${total}…`; },
        });
        replaceImageUrls(data,urls);
        replaceWithImported(data);
      }catch(error){ failure = error; }
      finally{ progress.close(); progress.remove(); }
      if(failure) openAlert(`Importazione non riuscita: ${failure.message} La campagna aperta è stata conservata.`);
    });
}
export function initEsporta(){
  document.getElementById("import-file").addEventListener("change", e=>{
    const f = e.target.files[0]; if(!f) return;
    if(f.size > ARCHIVE_BYTES){ openAlert("Il backup supera 64 MiB."); e.target.value=""; return; }
    const r = new FileReader();
    r.onload = async ()=>{
      /* Il motivo si mostra: "non è una campagna Runebog" è vero per un file
         sbagliato e fuorviante per un export vero che sfora un limite — e in
         quel secondo caso è l'unica indicazione su cosa correggere. È testo
         controllato (messaggi fissi più un percorso troncato), e finisce in
         textContent, non in HTML. */
      try{ await applyImportedJSON(r.result); }
      catch(err){ openAlert(`Importazione non riuscita. ${err.message}`); }
      e.target.value = "";
    };
    r.readAsText(f);
  });
}

// per l'onclick inline del bottone Esporta
Object.assign(window, { exportJSON });

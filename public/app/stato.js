/* Lo stato dell'app e la sua persistenza: dove stiamo girando, l'oggetto `st`
   condiviso da tutti i moduli, il salvataggio (locale o cloud), le campagne
   multiple e le utilità sull'albero. */

import { uid, node, escapeHtml, sanitizeState, isMarker, snapNode,
         nodeBox, defShape, scalaSopra, SHAPES, SCALA } from "./modello.js";
import { openAlert, openConfirm, showView } from "./viste.js";
import {
  readCloudCache,
  writeCloudCache,
  makePendingCache,
  makeSyncedCache,
  classifyCloudRecovery,
  reconcileCloudAck,
  openCloudRecoveryDialog,
} from "./sync-cloud.js";
import {
  CURRENT_CAMPAIGN_SCHEMA_VERSION,
  prepareCampaignDocument,
  campaignErrorMessage,
} from "./formato-campagna.js";

/* ==================== dove stiamo girando ====================
   Due contesti col server, riconosciuti da cosa ha iniettato prima dei moduli:
     window.__cloud → il sito, con login: è il DM, scrive.
     window.__table → il tavolo dei giocatori: sola lettura, e lo stato che arriva
                      contiene GIÀ solo il rivelato (il filtro sta sul server, in
                      src/lib/share.ts: qui non c'è niente da nascondere perché
                      il resto non è mai stato spedito).
     nessuno dei due → standalone su localStorage (es. /app.html aperto diretto). */
export const TABLE = window.__table || null;
export const RO = !!TABLE;                // read-only: al tavolo non si modifica nulla

/* ==================== persistenza sicura ==================== */
const memStore = {};
export const store = {
  get(k){ try{ return localStorage.getItem(k); }catch(e){ return memStore[k] ?? null; } },
  set(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ memStore[k]=v; return false; } },
  del(k){ try{ localStorage.removeItem(k); }catch(e){ delete memStore[k]; } }
};
const SAVE_KEY = "runebog-gm-v1";
let persistent = true;

/* ==================== la revisione cloud ====================
   Da quale versione del server discende ciò che stiamo modificando. Ogni PATCH
   la dichiara e il server la verifica dentro la query che scrive (vedi
   src/app/api/campaigns/[id]/route.ts): senza, due schede aperte sulla stessa
   campagna si sovrascrivono a vicenda in silenzio.

   `cloudPaused` è il freno mentre il dialogo di recupero aspetta una scelta:
   finché l'utente non ha deciso quale versione continuare, ogni scrittura —
   verso il server e verso la cache — è una risposta data al posto suo. */
let cloudRevision = Number.isSafeInteger(window.__cloud?.revision) ? window.__cloud.revision : 0;
let cloudPaused = false;
let bootCloudCache = null;

/* ==================== lo stato condiviso ====================
   Un solo oggetto mutabile, importato ovunque: i binding ES importati non si
   possono riassegnare dal modulo che importa, quindi ciò che più moduli devono
   riassegnare (stato, navigazione, selezione) vive come proprietà di `st`. */
export const st = {
  state: null,          // {root, checklist, players} — il JSON della campagna
  path: [],             // percorso di navigazione (id)
  selectedId: null,     // blocco selezionato nel livello corrente
  selectedEdgeId: null, // collegamento selezionato nel livello corrente
  // Muro libero selezionato. I tre "selected*" sono mutuamente esclusivi: si
  // azzerano insieme, e il pannello li legge in quest'ordine.
  selectedWallId: null,
  multiSel: new Set(),  // selezione multipla di BOLLE (Ctrl+clic)
  /* I muri hanno un insieme loro invece di entrare in `multiSel`. Sono cose
     diverse — un muro non sta in `children`, non ha titolo, non si entra
     dentro — e sei moduli leggono `multiSel` dando per scontato che ci siano
     id di nodi (`childOf`, `findNode`). Mescolarli avrebbe voluto dire
     riscrivere quel codice per far entrare il caso secondario, con le bolle a
     pagarne il rischio. Il prezzo di questa scelta è uno solo: i due insiemi
     si azzerano SEMPRE insieme — e per questo l'azzeramento sta in clearSel()
     e non ricopiato in otto punti. */
  multiSelWalls: new Set(),
  detailOpen: false     // bottom sheet aperto manualmente (mobile)
};

/* L'unico modo di dire "niente di selezionato". Cinque campi che devono restare
   d'accordo: prima erano cinque assegnazioni ricopiate ovunque, e ogni posto
   che ne dimenticava uno lasciava acceso in oro qualcosa che il modello aveva
   già deselezionato. */
export function clearSel(){
  st.selectedId = null;
  st.selectedEdgeId = null;
  st.selectedWallId = null;
  st.multiSel.clear();
  st.multiSelWalls.clear();
}
/* Selezione singola: la stessa cosa detta per bolle e muri, così chi la usa non
   deve ricordarsi quale insieme tocca. */
export function selectNode(id){ clearSel(); st.selectedId = id; st.multiSel.add(id); }
export function selectWall(id){ clearSel(); st.selectedWallId = id; st.multiSelWalls.add(id); }

/* La campagna del primo avvio è un esempio-tutorial, non dati veri: una zona
   compilata che mostra la gerarchia (bolle dentro bolle, con mini-preview),
   i tre stati di preparazione, i tipi di collegamento, le note DM separate da
   quelle per i giocatori e il tracker PF di un encounter. Esplorarla È il
   tutorial; il "(esempio)" nel titolo dice che si può smontare senza rimorsi. */
export function defaultState(){
  const root = node("Guado dell'Airone (esempio)","zona");
  root.notes = "Campagna d'esempio: smontala pure. Doppio clic su una bolla per entrarci, "+
    "doppio clic sulla tela per crearne una nuova. Quando vuoi partire dalla tua, "+
    "il ＋ in alto crea una campagna vuota.";

  const locanda = node("Locanda della Biscia","luogo");
  locanda.shape="edificio"; locanda.x=60; locanda.y=120; locanda.status="da fare";
  locanda.notes = "Berta è un'informatrice della gilda: se i PG chiedono del traghettatore, li manda al faro.";
  locanda.shared = true;
  locanda.playerNotes = "Birra torbida, letti asciutti e una locandiera che sa tutto di tutti.";
  const sala = node("Sala comune","luogo");     sala.shape="stanza";   sala.x=40;    sala.y=40;
  const camere = node("Camere di sopra","luogo"); camere.shape="stanza"; camere.x=180; camere.y=40;
  locanda.children = [sala, camere];

  const mercato = node("Mercato del guado","luogo");
  mercato.shape="piazza"; mercato.x=340; mercato.y=-20; mercato.status="fatto";
  mercato.notes = "Palafitte e bancarelle: si vende di tutto, purché sia umido.";

  const faro = node("Faro sommerso","luogo");
  faro.shape="torre"; faro.x=620; faro.y=120; faro.status="in corso";
  faro.notes = "Metà torre affiora dalla palude. Dentro ci sono i ratti: i PF si segnano dalla scheda.";
  const ratti = node("Ratti della palude","encounter");
  ratti.x=70; ratti.y=60;
  ratti.monster = {                     // ratto gigante (SRD 5e, CC-BY-4.0)
    meta:"Bestia Piccola, senza allineamento", ac:"12", speed:"9 m",
    str:7, dex:15, con:11, int:2, wis:10, cha:4, cr:"1/8",
    actions:"Morso: +4 al tiro per colpire, 4 (1d4+2) danni perforanti.",
    hpDefault:7,
    foes:[{id:uid(), name:"Ratto 1", hp:7, hpMax:7},
          {id:uid(), name:"Ratto 2", hp:7, hpMax:7}]
  };
  faro.children = [ratti];

  const quest = node("Il traghettatore scomparso","quest");
  quest.x=380; quest.y=300; quest.status="in corso";
  quest.notes = "Sparito da tre notti, la barca ancora legata al pontile. La pista porta al faro. Ricompensa: 50 mo.";

  const berta = node("Berta, la locandiera","png");
  berta.x=140; berta.y=300;
  berta.notes = "Vende informazioni per birra. Voce ferma, memoria di ferro.";

  root.children = [locanda, mercato, faro, quest, berta];
  root.edges = [
    {id:uid(), a:locanda.id, b:mercato.id, type:"strada",  label:"", notes:""},
    {id:uid(), a:mercato.id, b:faro.id,    type:"ponte",   label:"", notes:""},
    {id:uid(), a:locanda.id, b:faro.id,    type:"segreto", label:"cunicolo sotto il guado", notes:""}
  ];
  return {
    schemaVersion: CURRENT_CAMPAIGN_SCHEMA_VERSION,
    root,
    checklist: [
      {id:uid(), text:"Leggere le note della Locanda della Biscia", done:true},
      {id:uid(), text:"Ripassare l'incontro al Faro sommerso", done:false},
      {id:uid(), text:"Stampare le schede dei personaggi", done:false}
    ],
    players: []
  };
}

/* ==================== campagne multiple ==================== */
const IDX_KEY = "gm-campaigns-v1";
const CUR_KEY = "gm-current-campaign";
const ckey = id => "gm-campaign-" + id;
let campaignsIdx = [];
let campaignId = null;

function loadCampaignsIdx(){ try{ return JSON.parse(store.get(IDX_KEY)) || []; }catch(_){ return []; } }
function persistIndex(){ store.set(IDX_KEY, JSON.stringify(campaignsIdx)); }
function emptyState(name){
  return {
    schemaVersion: CURRENT_CAMPAIGN_SCHEMA_VERSION,
    root: node(name || "Nuova campagna", "zona"), checklist: [], players: [],
  };
}
function persistCurrent(){
  if(window.__cloud || !campaignId) return;
  store.set(ckey(campaignId), JSON.stringify(st.state));
  const c = campaignsIdx.find(x=>x.id===campaignId);
  if(c){ c.name = st.state.root.title || "Campagna"; c.updatedAt = Date.now(); persistIndex(); }
}
export function renderCampaignSelect(){
  const s = document.getElementById("campaign-select");
  if(!s) return;
  s.innerHTML = campaignsIdx.map(c=>
    `<option value="${c.id}"${c.id===campaignId?" selected":""}>${escapeHtml(c.name)}</option>`).join("");
}
export function switchCampaign(id){
  if(id===campaignId || window.__cloud) return;
  clearTimeout(saveTimer); persistCurrent();
  campaignId = id; store.set(CUR_KEY, id);
  try{ const raw = store.get(ckey(id)); st.state = raw ? JSON.parse(raw) : emptyState(); }
  catch(_){ st.state = emptyState(); }
  migrateState(st.state);
  resetUndo();                       // l'undo non attraversa le campagne
  st.path = [st.state.root.id]; clearSel();
  renderCampaignSelect(); showView("map");
}
export function newCampaign(){
  if(window.__cloud) return;
  clearTimeout(saveTimer); persistCurrent();
  const id = uid();
  campaignsIdx.push({id, name:"Nuova campagna", updatedAt: Date.now()});
  campaignId = id; store.set(CUR_KEY, id);
  st.state = emptyState();
  resetUndo();
  persistCurrent(); renderCampaignSelect();
  st.path = [st.state.root.id]; clearSel();
  showView("map");
  setTimeout(()=>{ const i=document.querySelector("#detail input"); if(i){ i.focus(); i.select(); } }, 80);
}
/* L'import di un file entra in una campagna NUOVA invece di sostituire quella
   aperta. In locale uno slot non costa niente, quindi la domanda "vuoi
   sostituire?" non si fa proprio: si risponde di no per costruzione, e due
   clic su un file sbagliato smettono di essere una campagna persa. Chi voleva
   davvero rimpiazzare ha il selettore di campagne e l'Elimina, che la conferma
   ce l'ha già.
   Solo standalone: in cloud (`/play/[id]`) l'indirizzo È la campagna, non
   esistono slot, e lì l'import resta una sostituzione — con la conferma che
   esporta.js chiede prima di arrivare qui. */
export function importAsNewCampaign(data){
  if(window.__cloud) return false;
  clearTimeout(saveTimer); persistCurrent();       // la campagna di prima si chiude salvata
  const id = uid();
  campaignId = id; store.set(CUR_KEY, id);
  // Stesso fallback di persistCurrent, che riscrive comunque questo nome un
  // rigo più sotto: due default diversi qui darebbero due nomi in due istanti.
  campaignsIdx.push({id, name: data.root.title || "Campagna", updatedAt: Date.now()});
  st.state = data;
  resetUndo();                       // l'undo non attraversa le campagne
  persistCurrent(); renderCampaignSelect();
  st.path = [st.state.root.id]; clearSel();
  showView("map");
  /* Il selettore in topbar cambia da sé, ma è un cambiamento silenzioso in un
     angolo: senza una riga detta, chi importa non sa se ha aggiunto o
     sostituito. `#savestate` è già role=status, quindi la sente anche un
     lettore di schermo. */
  cloudStatus("Importata come campagna nuova ✓");
  return true;
}
export function askDeleteCampaign(){
  if(window.__cloud) return;
  if(campaignsIdx.length<=1){ openAlert("È l'unica campagna: creane un'altra prima di poterla eliminare."); return; }
  openConfirm(
    `Eliminare la campagna "${st.state.root.title||"senza nome"}"? Operazione definitiva (fai prima un Esporta se hai dubbi).`,
    ok=>{
      if(!ok) return;
      store.del(ckey(campaignId));
      campaignsIdx = campaignsIdx.filter(c=>c.id!==campaignId);
      persistIndex();
      const next = campaignsIdx[0].id;
      campaignId = null;                    // forza il ricaricamento
      switchCampaign(next);
    });
}

/* ==================== avvio dello stato ==================== */
export function initStato(){
  if(RO){
    st.state = TABLE.state;                       // il tavolo: già filtrato dal server
    document.documentElement.classList.add("ro");
  }else if(window.__cloud && window.__cloud.state){
    st.state = window.__cloud.state;              // il sito fornisce lo stato: niente slot locali
    bootCloudCache = readCloudCache(store, window.__cloud.id);
    /* La vecchia cache cloud stava sotto SAVE_KEY, una chiave sola per tutte le
       campagne: non si sa a quale appartiene, quindi non la si spedisce mai da
       sé. Si propone, dicendo che potrebbe essere di un'altra — l'utente ha il
       titolo davanti e può decidere, il codice no. */
    if(!bootCloudCache){
      try{
        const legacyState = JSON.parse(store.get(SAVE_KEY));
        if(legacyState?.root && Array.isArray(legacyState.checklist) && Array.isArray(legacyState.players)){
          bootCloudCache = {
            ...makePendingCache({
              campaignId: window.__cloud.id,
              state: legacyState,
              baseRevision: cloudRevision,
            }),
            legacy: true,
          };
        }
      }catch(_){}
    }
    document.documentElement.classList.add("cloud");   // solo qui c'è un server con cui condividere
  }else{
    campaignsIdx = loadCampaignsIdx();
    const legacy = store.get(SAVE_KEY);           // migrazione dal salvataggio singolo pre-campagne
    if(!campaignsIdx.length && legacy){
      const id0 = uid();
      store.set(ckey(id0), legacy);
      let nm = "Campagna";
      try{ nm = JSON.parse(legacy).root?.title || nm; }catch(_){}
      campaignsIdx = [{id: id0, name: nm, updatedAt: Date.now()}];
      persistIndex();
    }
    if(!campaignsIdx.length){
      const id0 = uid();
      const ds = defaultState();      // il nome nell'indice combacia col titolo dell'esempio
      campaignsIdx = [{id: id0, name: ds.root.title, updatedAt: Date.now()}];
      persistIndex();
      store.set(ckey(id0), JSON.stringify(ds));
    }
    campaignId = store.get(CUR_KEY);
    if(!campaignsIdx.some(c=>c.id===campaignId)) campaignId = campaignsIdx[0].id;
    try{
      const raw = store.get(ckey(campaignId));
      st.state = raw ? JSON.parse(raw) : emptyState();
    }catch(e){ st.state = emptyState(); }
  }
  migrateState(st.state);                         // migrazione salvataggi vecchi
  if(window.__cloud){
    // La cache viene dal localStorage: forma valida non vuol dire contenuto
    // sicuro, e passa dallo stesso imbuto di ogni altro caricamento.
    if(bootCloudCache) migrateState(bootCloudCache.state);
    const server = {
      state: st.state,
      revision: cloudRevision,
      updatedAt: window.__cloud.updatedAt || null,
    };
    const recupero = classifyCloudRecovery(bootCloudCache, {
      campaignId: window.__cloud.id,
      state: server.state,
      revision: server.revision,
    });
    if(recupero === "equivalent"){
      // Era già arrivata: nessuna domanda da fare, solo un'etichetta da correggere.
      writeCloudCache(store, makeSyncedCache({
        campaignId: window.__cloud.id,
        state: server.state,
        revision: server.revision,
      }));
      if(bootCloudCache.legacy) store.del(SAVE_KEY);
    }else if(recupero === "pending" || recupero === "conflict"){
      cloudPaused = true;
      /* Il dialogo aspetta la fine di main.js: i microtask girano quando lo
         stack si svuota, cioè dopo il primo renderMap(). Aprirlo qui lo
         mostrerebbe sopra una mappa non ancora disegnata, e "Recupera locale"
         ridisegnerebbe una vista che nessuno ha ancora costruito. */
      queueMicrotask(()=>showCloudRecovery(recupero, bootCloudCache, server));
    }
  }
  resetUndo();
  st.path = [st.state.root.id];
  addEventListener("pagehide", flushSave);
  // Tornare in rete non è un'azione dell'utente: se è rimasto del lavoro da
  // spedire, riparte da sé invece di aspettare la battitura successiva.
  addEventListener("online", ()=>{
    if(window.__cloud && !cloudPaused &&
       readCloudCache(store, window.__cloud.id)?.status === "pending") cloudPush();
  });
}

/* ==================== undo / redo ====================
   Lo stato è un JSON unico: uno snapshot è la sua serializzazione, annullare è un
   parse. Lo stack tiene le serializzazioni PRECEDENTI alle modifiche; una raffica
   di save() ravvicinati (digitazione in un campo) conta come una modifica sola,
   sennò Ctrl+Z toglierebbe una lettera alla volta.

   Il redo è lo stesso meccanismo con gli stack scambiati, e l'unica regola che
   deve reggere è la **storia lineare**: una modifica nuova dopo un annulla
   invalida il ramo rifatto (`noteChange` svuota `redoStack`). Senza, Ctrl+Y
   riporterebbe a un futuro che non discende più dal presente — cioè una perdita
   silenziosa, che è esattamente il guasto che l'undo esiste per evitare. */
const UNDO_CAP = 20;
const BURST_MS = 800;      // poco sopra il debounce di save: una pausa che fa
                           // scattare il salvataggio chiude anche la raffica
let undoStack = [];
let redoStack = [];
let lastSnap = null;       // serializzazione dello stato all'ultimo salvataggio compiuto
let lastEditAt = 0;

/* Il bottone ↶ della topbar (visibile solo su touch, via CSS) appare quando c'è
   qualcosa da annullare. Il check esatto richiederebbe di serializzare lo stato
   (fino a 4 MB) a ogni battitura, quindi è un proxy: stack non vuoto, escluso il
   caso del singolo snapshot identico a lastSnap — è quello che lascia il save()
   di avvio (main.js) e non annulla niente. I falsi positivi residui si
   auto-correggono: undo() scarta gli snapshot identici mentre cerca, e il
   refresh successivo nasconde il bottone. */
function refreshUndoBtn(){
  const b = document.getElementById("undo-btn");
  if(b) b.hidden = !undoStack.length ||
                   (undoStack.length === 1 && undoStack[0] === lastSnap);
  /* Il rifai non ha bisogno di proxy: `redoStack` si riempie solo dentro undo(),
     quindi "non vuoto" è la risposta esatta e non una stima. */
  const r = document.getElementById("redo-btn");
  if(r) r.hidden = !redoStack.length;
}
export function resetUndo(){
  undoStack = [];
  redoStack = [];
  lastSnap = st.state ? JSON.stringify(st.state) : null;
  lastEditAt = 0;
  refreshUndoBtn();
}
function noteChange(){
  const now = Date.now();
  if(lastSnap !== null && now - lastEditAt > BURST_MS && undoStack[undoStack.length-1] !== lastSnap){
    undoStack.push(lastSnap);
    if(undoStack.length > UNDO_CAP) undoStack.shift();
  }
  // Storia lineare: da qui in avanti il ramo rifatto non discende più da niente.
  redoStack.length = 0;
  lastEditAt = now;
  refreshUndoBtn();
}

/* Rimettere sotto i piedi dell'app uno stato serializzato: è il pezzo che undo e
   redo hanno davvero in comune, e stava tutto dentro undo(). Duplicarlo avrebbe
   voluto dire due elenchi di cose da ripulire, e quello del redo sarebbe
   invecchiato per primo — è la via meno battuta. */
function applySnapshot(json){
  clearTimeout(saveTimer);
  st.state = JSON.parse(json);
  migrateState(st.state);
  // percorso e selezione possono puntare a nodi che nello stato ripristinato
  // non esistono (es. undo di una creazione mentre ci si era entrati dentro)
  const valid = [];
  for(const id of st.path){ if(findNode(id)) valid.push(id); else break; }
  st.path = valid.length ? valid : [st.state.root.id];
  if(st.selectedId && !findNode(st.selectedId)) st.selectedId = null;
  st.multiSel = new Set([...st.multiSel].filter(id => findNode(id)));
  // un arco o un muro possono non esserci più — e un muro non si sa cercare
  // come findNode fa coi nodi, quindi si azzera invece di filtrare
  st.selectedEdgeId = st.selectedWallId = null;
  st.multiSelWalls.clear();
  doSave();                          // persiste subito, senza passare da noteChange
}

export function undo(){
  // `cloudPaused` va guardato anche qui e non solo in save(): undo() chiama
  // doSave() di suo, e riscriverebbe la copia locale che il dialogo sta
  // proponendo di recuperare — cioè una delle due versioni da scegliere.
  if(RO || cloudPaused || !st.state) return false;
  const cur = JSON.stringify(st.state);
  let target = null;
  if(lastSnap !== null && lastSnap !== cur){
    target = lastSnap;               // raffica in corso non ancora salvata: si torna a prima
  }else{
    while(undoStack.length){         // salta gli snapshot identici allo stato attuale
      const s = undoStack.pop();     // (save() chiamate senza modifiche reali)
      if(s !== cur){ target = s; break; }
    }
  }
  if(target === null) return false;
  redoStack.push(cur);               // dove si stava: è l'unica cosa che il redo deve sapere
  if(redoStack.length > UNDO_CAP) redoStack.shift();
  applySnapshot(target);
  return true;
}
export function redo(){
  if(RO || cloudPaused || !st.state) return false;
  const cur = JSON.stringify(st.state);
  let target = null;
  while(redoStack.length){           // stessa pulizia dell'undo: gli identici non sono un passo
    const s = redoStack.pop();
    if(s !== cur){ target = s; break; }
  }
  if(target === null) return false;
  /* Si torna indietro sull'undoStack, non su `lastSnap`: applySnapshot chiama
     doSave(), che riscrive lastSnap: senza questa riga il Ctrl+Z successivo non
     avrebbe più dove tornare e la coppia annulla/rifai non sarebbe reversibile. */
  undoStack.push(cur);
  if(undoStack.length > UNDO_CAP) undoStack.shift();
  applySnapshot(target);
  return true;
}
/* L'annulla con feedback: unico punto d'ingresso per Ctrl+Z (scorciatoie.js),
   la voce nel menu ⋯ e il bottone ↶ su touch — stessa esperienza da ovunque.
   Il rifai gli sta accanto per costruzione: se i due messaggi si scrivessero in
   due punti diversi, uno dei due direbbe "Niente da annullare" al momento
   sbagliato. */
function annunciaStoria(fatto, ok, ko){
  const el = document.getElementById("savestate");
  if(fatto){
    const attiva = document.querySelector(".view.active");
    showView(attiva ? attiva.id.replace("view-","") : "map");
    el.textContent = ok;
  }else{
    el.textContent = ko;
  }
  refreshUndoBtn();
}
export function doUndo(){ annunciaStoria(undo(), "Modifica annullata ↩", "Niente da annullare"); }
export function doRedo(){ annunciaStoria(redo(), "Modifica ripristinata ↪", "Niente da ripristinare"); }

/* ==================== salvataggio ==================== */
let saveTimer = null;
let cloudBusy = false, cloudDirty = false;

/* Il limite vero è la PATCH di /api/campaigns (4 MB, vedi route.ts); in locale il
   tetto di localStorage è vicino. Avvisare all'80% evita di scoprirlo a fallimento
   avvenuto, con le immagini ormai dentro. La lunghezza della stringa ≈ byte:
   il grosso del peso è base64, cioè ASCII. */
const MAX_BYTES = 4 * 1024 * 1024;
const mb = len => (len/1048576).toFixed(1).replace(".", ",");
function sizeWarning(len){
  if(len > MAX_BYTES)     return {msg:`${mb(len)} MB: oltre il limite di 4 MB — alleggerisci le immagini`, tone:"var(--ember)"};
  if(len > MAX_BYTES*0.8) return {msg:`${mb(len)} MB su 4 — le immagini pesano, occhio al limite`, tone:"var(--gold)"};
  return null;
}

/* `finale` = stiamo uscendo dalla pagina (vedi flushSave). La richiesta va
   marcata keepalive, sennò la navigazione la uccide a metà; la specifica le
   concede però 64 KB in tutto, e una campagna con immagini li supera di molto.
   Sopra quella soglia keepalive farebbe fallire la fetch invece di salvare, e
   allora si parte normale: è un tentativo, non una garanzia. */
const TETTO_KEEPALIVE = 60 * 1024;

function cloudStatus(msg, color = "var(--ink-dim)"){
  const el = document.getElementById("savestate");
  if(!el) return;
  el.textContent = msg;
  el.style.color = color;
}

/* Sostituire lo stato sotto i piedi dell'app è la stessa cosa che fa undo(), e
   ha lo stesso prezzo: percorso, selezione e undo appartenevano alla versione
   di prima e non sopravvivono. La vista corrente si ridisegna, non si cambia:
   chi stava nella checklist ci resta. */
function replaceCloudState(nuovo){
  st.state = nuovo;
  migrateState(st.state);
  resetUndo();
  st.path = [st.state.root.id];
  clearSel();
  const attiva = document.querySelector(".view.active");
  showView(attiva ? attiva.id.replace("view-","") : "map");
}

/* Le due versioni non si fondono. Un merge campo per campo di due alberi di
   campagna è indistinguibile, per l'utente, da una perdita silenziosa: sceglie
   lui, e "Esporta entrambe" gli permette di non scegliere alla cieca. */
function showCloudRecovery(kind, localCache, server){
  openCloudRecoveryDialog({
    kind,
    campaignId: window.__cloud.id,
    localCache,
    server,
    onKeepServer(){
      cloudPaused = false;
      cloudRevision = server.revision;
      replaceCloudState(server.state);
      writeCloudCache(store, makeSyncedCache({
        campaignId: window.__cloud.id,
        state: server.state,
        revision: server.revision,
      }));
      if(localCache.legacy) store.del(SAVE_KEY);
      cloudStatus("Versione cloud conservata ✓");
    },
    onRecoverLocal(){
      cloudPaused = false;
      // Ribasare sulla revisione mostrata nel dialogo è ciò che rende la
      // sovrascrittura ESPLICITA: la PATCH che segue non passa perché ha
      // ragione, passa perché l'utente ha appena guardato l'altra versione.
      cloudRevision = server.revision;
      replaceCloudState(localCache.state);
      persistent = writeCloudCache(store, makePendingCache({
        campaignId: window.__cloud.id,
        state: st.state,
        baseRevision: cloudRevision,
      }));
      if(localCache.legacy) store.del(SAVE_KEY);
      cloudStatus(persistent ? "Sincronizzazione in attesa…" : "Solo in memoria — usa Esporta",
                  "var(--gold)");
      cloudPush();
    },
  });
}

async function cloudPush(finale = false, json = null){
  if(!window.__cloud || cloudPaused) return;
  if(cloudBusy){ cloudDirty = true; return; }
  cloudBusy = true;
  // Lo snapshot che parte e la base che dichiara si fissano QUI: quando la
  // risposta arriva, `st.state` e `cloudRevision` possono essere già altri.
  const sentJson = json ?? JSON.stringify(st.state);
  const sentBase = cloudRevision;
  // Il body si compone attorno al JSON già serializzato invece di passare
  // l'oggetto a JSON.stringify: su una campagna con immagini è un giro da 4 MB
  // risparmiato a ogni salvataggio.
  const body = `{"data":${sentJson},"baseRevision":${sentBase}}`;
  const warn = sizeWarning(body.length);
  try{
    const res = await fetch(`/api/campaigns/${window.__cloud.id}`, {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      keepalive: finale && body.length < TETTO_KEEPALIVE,
      body
    });
    if(res.status === 413){
      cloudStatus(`Non salvato nel cloud: ${mb(body.length)} MB, il limite è 4 — copia locale conservata`,
                  "var(--ember)");
      return;
    }
    if(res.status === 400 || res.status === 422){
      /* Il server ha rifiutato la FORMA, non la revisione: ritentare non serve
         a niente, e la copia locale resta dov'è — è l'unica che contiene il
         lavoro. Il motivo si mostra perché è l'unica indicazione su cosa
         correggere: senza, l'unico segnale sarebbe un salvataggio che non
         avviene mai. */
      const problema = await res.json().catch(()=>({}));
      cloudStatus(
        `Non sincronizzato: ${problema.detail?.message || "formato non valido"} · copia locale conservata`,
        "var(--ember)");
      return;
    }
    if(res.status === 409){
      // Il server è andato avanti da un'altra parte. La copia locale NON si
      // tocca: è una delle due versioni fra cui si sta per scegliere.
      const conflitto = await res.json();
      const localCache = readCloudCache(store, window.__cloud.id) || makePendingCache({
        campaignId: window.__cloud.id,
        state: st.state,
        baseRevision: sentBase,
      });
      cloudPaused = true;
      cloudStatus("Conflitto rilevato — scegli quale versione conservare", "var(--ember)");
      showCloudRecovery("conflict", localCache, {
        state: conflitto.data,
        revision: conflitto.revision,
        updatedAt: conflitto.updatedAt,
      });
      return;
    }
    if(!res.ok) throw new Error(res.status);
    const ack = await res.json();
    if(!Number.isSafeInteger(ack.revision)) throw new Error("risposta senza revisione");
    cloudRevision = ack.revision;

    const esito = reconcileCloudAck({
      campaignId: window.__cloud.id,
      currentState: st.state,
      sentJson,
      currentJson: JSON.stringify(st.state),
      acknowledgedRevision: cloudRevision,
    });
    persistent = writeCloudCache(store, esito.cache);
    if(esito.retry){
      // Qualcosa è cambiato mentre la richiesta era in volo: la base nuova è
      // l'ACK appena ricevuto, ma lo stato corrente resta da spedire.
      cloudDirty = true;
      cloudStatus("Sincronizzazione in attesa…", "var(--gold)");
    }else{
      cloudStatus(warn ? `Salvato nel cloud ✓ · ${warn.msg}` : "Salvato nel cloud ✓",
                  warn ? warn.tone : "var(--ink-dim)");
    }
  }catch(_){
    cloudStatus(persistent ? "Salvato su questo dispositivo · sincronizzazione in attesa"
                           : "Solo in memoria — usa Esporta",
                "var(--gold)");
  }finally{
    cloudBusy = false;
    if(cloudDirty && !cloudPaused){ cloudDirty = false; cloudPush(); }
  }
}
function doSave(finale = false){
  const json = JSON.stringify(st.state);
  lastSnap = json;                                // da qui in poi l'undo torna a questo punto
  refreshUndoBtn();                               // lastSnap è cambiato: il proxy va rivalutato
  if(window.__cloud){
    /* La copia locale si scrive PRIMA di partire con la richiesta, e dice da
       quale revisione discende. È l'ordine che rende recuperabile una scheda
       chiusa a metà PATCH: se si scrivesse dopo la risposta, il caso da coprire
       sarebbe proprio quello in cui la risposta non arriva. */
    persistent = writeCloudCache(store, makePendingCache({
      campaignId: window.__cloud.id,
      state: st.state,
      baseRevision: cloudRevision,
    }));
    cloudStatus(persistent ? "Sincronizzazione in attesa…" : "Solo in memoria — usa Esporta",
                "var(--gold)");
    cloudPush(finale, json); return;
  }
  persistent = store.set(ckey(campaignId), json);
  const c = campaignsIdx.find(x=>x.id===campaignId);
  if(c){
    const nm = st.state.root.title || "Campagna";
    if(c.name !== nm){ c.name = nm; renderCampaignSelect(); }
    c.updatedAt = Date.now();
  }
  persistIndex();
  const el = document.getElementById("savestate");
  const warn = sizeWarning(json.length);
  el.textContent = !persistent ? "Solo in memoria — usa Esporta"
                 : warn ? `Salvato ✓ · ${warn.msg}` : "Salvato ✓";
  el.style.color = !persistent ? "var(--gold)" : warn ? warn.tone : "var(--ink-dim)";
}
export function save(){
  if(RO || cloudPaused) return;                   // il tavolo non salva; il dialogo aspetta una scelta
  noteChange();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 700);
}

/* Chiude la finestra dei 700 ms scrivendo subito. Finché dall'editor si usciva
   solo chiudendo la scheda quella finestra si perdonava da sé; ora il titolo in
   topbar è un link alla home, uscire è un clic, e lì dentro ci sta l'ultima
   modifica. `pagehide` e non `beforeunload`: il secondo su iOS non arriva, e
   copre comunque anche la chiusura della scheda e il tasto Indietro — la
   regola è una sola per ogni modo di andarsene, non una per il link nuovo. */
function flushSave(){
  if(!saveTimer) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  doSave(true);
}

/* ==================== utilità albero ==================== */
export function findNode(id, cur=st.state.root){
  if(cur.id===id) return cur;
  for(const c of cur.children){ const f=findNode(id,c); if(f) return f; }
  return null;
}
export function findParent(id, cur=st.state.root){
  if(cur.children.some(c=>c.id===id)) return cur;
  for(const c of cur.children){ const f=findParent(id,c); if(f) return f; }
  return null;
}
/* L'ultimo documento che ha attraversato migrateState senza passare il
   contratto, e perché. Lo legge il pannello di salvataggio per dirlo una volta
   invece di gridarlo a ogni ridisegno. */
export let ultimoDifettoFormato = null;

export function migrateState(s){
  /* Il contratto morde in SCRITTURA (import, POST, PATCH) e qui NO. Questo è
     l'imbuto che attraversa ogni caricamento — cloud, localStorage, undo,
     recupero offline — e lanciare di qui vorrebbe dire: campagna storta,
     schermo bianco, nessun modo di correggerla, perché per correggerla bisogna
     aprirla. Quindi si normalizza se si può, e se non si può si prosegue con le
     difese che c'erano già (sanitizeState, qui sotto), lasciando detto cosa non
     andava. Il salvataggio successivo riceverà un 422 dal server, che è dove il
     rifiuto costa una modifica e non una campagna.

     `prepareCampaignDocument` muta `s` in loco quando migra, quindi non c'è
     niente da riassegnare. Gira PRIMA delle migrazioni visuali qui sotto perché
     è lui a dare `type` e `id` ai nodi che non li hanno — e `isMarker`, due
     righe più giù, legge proprio `type`. */
  const esito = prepareCampaignDocument(s);
  ultimoDifettoFormato = esito.ok ? null : esito.error;
  if(!esito.ok)
    console.warn("Campagna non conforme al contratto:", campaignErrorMessage(esito.error));

  (function walk(n){
    if(!Array.isArray(n.edges)) n.edges=[];
    // tokenColor era il colore del solo segnalino "token"; ora `color` vale per
    // qualsiasi bolla (vedi nodeColor in modello.js). Le pedine già colorate
    // devono restare come il DM le aveva messe.
    if(n.tokenColor && !n.color) n.color = n.tokenColor;
    delete n.tokenColor;
    // I simboli si centrano nel quadretto (22 lug 2026), e qui la migrazione si
    // fa davvero invece di aspettare il primo tocco come per le forme in scala:
    // un simbolo si sposta al massimo di mezza cella e NON cambia dimensione,
    // quindi non può finire sopra una bolla che prima non toccava. L'unico modo
    // di sovrapporre qualcosa è avere due segnalini più vicini di un quadretto —
    // per questo l'import del dungeon dispone i PG a una cella l'uno dall'altro.
    if(isMarker(n)){ const q = snapNode(n); n.x = q.x; n.y = q.y; }
    (n.children||[]).forEach(walk);
  })(s.root);
  // vecchia "Pianta" separata → diventa una zona dentro la radice
  if(s.plan && Array.isArray(s.plan.blocks) && s.plan.blocks.length){
    const z = node("Pianta città (bozza)","zona"); z.shape="quartiere";
    z.children = s.plan.blocks.map(b=>({id:b.id, title:b.label||"", type:"luogo", status:"",
      notes:b.notes||"", img:null, children:[], edges:[], x:b.x, y:b.y, shape:b.shape}));
    z.edges = (s.plan.edges||[]).slice();
    s.root.children.push(z);
  }
  delete s.plan;
  // Ultimo passo: bonifica i campi interpolati negli attributi HTML (id, colore,
  // immagine, riferimenti). Qui perché migrateState è l'imbuto di OGNI caricamento
  // — import, cloud, localStorage — e l'import è il vettore: JSON altrui, forma
  // valida, contenuto ostile. Vedi sanitizeState in modello.js.
  sanitizeState(s);
}
export function removeNode(id, cur){
  const i = cur.children.findIndex(c=>c.id===id);
  if(i!==-1){ cur.children.splice(i,1); return true; }
  return cur.children.some(c=>removeNode(id,c));
}
export function currentNode(){ return findNode(st.path[st.path.length-1]) || st.state.root; }
export function pathNodes(){ return st.path.map(id=>findNode(id)).filter(Boolean); }

/* ==================== zoom indietro ====================
   Una campagna non è una città: è più città, in una regione, in un mondo. Verso
   il basso l'albero è sempre stato infinito (una bolla contiene una mappa che
   contiene una mappa), verso l'alto no — la radice si fissava alla creazione, e
   una campagna nata città restava città per sempre. Da qui la si allarga.

   Costa poco perché la radice è un nodo come gli altri: allargare la campagna è
   metterle un genitore, non cambiare lo schema. Il documento resta
   `{schemaVersion, root, …}` con la stessa forma, e nessuno degli altri moduli
   deve sapere che è successo qualcosa.

   La scala del livello nuovo NON si chiede: la dice SCALA_TERRITORIO, un
   gradino sopra quello attuale. Un menu con quattro voci sarebbe una domanda a
   cui il DM può rispondere male (un continente dentro una regione) e che
   comunque si corregge dal pannello, dove la scala della radice è un campo. */
/* Il segnaposto che un livello nuovo si porta finché il DM non lo rinomina.

   Non è "Nuova regione" perché il titolo della radice È il nome della campagna
   nell'elenco (doSave qui sopra): chiamarla così farebbe sparire "Guado
   dell'Airone" dal menu delle campagne, e da lì non la si riconoscerebbe più.
   Portando dentro il nome di prima l'elenco resta leggibile.

   Ma il prefisso precedente si TOGLIE, sennò tre zoom di fila danno "Mondo di
   Continente di Nazione di Guado dell'Airone": il nome che conta è quello che
   il DM ha scritto, non la pila di contenitori che ci sono cresciuti attorno.
   Chi avesse chiamato una campagna "Regione di Ferro" la vede diventare
   "Nazione di Ferro", che è comunque la cosa giusta. */
const PREFISSO_SCALA = new RegExp(`^(?:${SCALA.map(s=>SHAPES[s].label).join("|")}) di `, "i");
const titoloSopra = (scala, titolo) => {
  const nome = String(titolo||"").replace(PREFISSO_SCALA, "").trim();
  return nome ? `${SHAPES[scala].label} di ${nome}` : `${SHAPES[scala].label} senza nome`;
};

const contieneCondivisi = n => (n.children||[]).some(c => c.shared || contieneCondivisi(c));

export function zoomOut(){
  if(RO || !st.state) return false;
  const vecchia = st.state.root;
  const scala = scalaSopra(vecchia.shape || defShape(vecchia));
  if(!scala) return false;                 // sopra il mondo non c'è niente: è il capolinea

  /* Da radice a bolla: le serve tutto quello che una radice non aveva. La forma
     era implicita (defShape), e va scritta ora che qualcuno la disegnerà; la
     posizione non c'era, e la si mette al centro invece di lasciarla a
     ensureLayout, che la spedirebbe in cima a un cerchio da 220px per fare
     spazio a fratelli che non esistono. */
  vecchia.shape = vecchia.shape || defShape(vecchia);
  const b = nodeBox(vecchia);
  vecchia.x = Math.round(-b.w/2/10)*10;
  vecchia.y = Math.round(-b.h/2/10)*10;

  /* Al tavolo la radice è visibile per costruzione ("la radice c'è sempre: è il
     contenitore", projectForPlayers in src/lib/share.ts). Scendendo di un
     gradino smette di esserlo, e senza questa riga i giocatori aprirebbero il
     link e troverebbero un mondo vuoto al posto di tutto quello che avevano:
     ciò che sta sotto resta `shared`, ma diventa irraggiungibile. È la stessa
     catena di contenitori che revealNode risale (tavolo.js), applicata qui
     all'indietro — e solo se sotto c'era davvero qualcosa di rivelato: in una
     campagna senza niente al tavolo, rivelare la vecchia radice metterebbe sulla
     mappa dei giocatori una bolla che il DM non ha mai scelto di mostrare. */
  if(!vecchia.shared && contieneCondivisi(vecchia)) vecchia.shared = true;

  const su = node(titoloSopra(scala, vecchia.title), "zona");
  su.shape = scala;
  su.children = [vecchia];
  st.state.root = su;
  st.path = [su.id];                       // si esce guardando il livello nuovo: è quello che si è chiesto
  clearSel();
  save();                                  // passa da noteChange: lo zoom indietro si annulla con Ctrl+Z
  return true;
}

// Gli onclick inline nei template cercano funzioni globali: i moduli ES non ne
// creano, quindi le espongo esplicitamente.
Object.assign(window, { switchCampaign, newCampaign, askDeleteCampaign, doUndo, doRedo });

/* Lo stato dell'app e la sua persistenza: dove stiamo girando, l'oggetto `st`
   condiviso da tutti i moduli, il salvataggio (locale o cloud), le campagne
   multiple e le utilità sull'albero. */

import { uid, node, escapeHtml, sanitizeState } from "./modello.js";
import { openAlert, openConfirm, showView } from "./viste.js";

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

/* ==================== lo stato condiviso ====================
   Un solo oggetto mutabile, importato ovunque: i binding ES importati non si
   possono riassegnare dal modulo che importa, quindi ciò che più moduli devono
   riassegnare (stato, navigazione, selezione) vive come proprietà di `st`. */
export const st = {
  state: null,          // {root, checklist, players} — il JSON della campagna
  path: [],             // percorso di navigazione (id)
  selectedId: null,     // blocco selezionato nel livello corrente
  selectedEdgeId: null, // collegamento selezionato nel livello corrente
  multiSel: new Set(),  // selezione multipla (Ctrl+clic)
  detailOpen: false     // bottom sheet aperto manualmente (mobile)
};

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
  return { root: node(name || "Nuova campagna", "zona"), checklist: [], players: [] };
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
  st.path = [st.state.root.id]; st.selectedId = null; st.selectedEdgeId = null; st.multiSel.clear();
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
  st.path = [st.state.root.id]; st.selectedId = null; st.selectedEdgeId = null; st.multiSel.clear();
  showView("map");
  setTimeout(()=>{ const i=document.querySelector("#detail input"); if(i){ i.focus(); i.select(); } }, 80);
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
  resetUndo();
  st.path = [st.state.root.id];
}

/* ==================== undo ====================
   Lo stato è un JSON unico: uno snapshot è la sua serializzazione, annullare è un
   parse. Lo stack tiene le serializzazioni PRECEDENTI alle modifiche; una raffica
   di save() ravvicinati (digitazione in un campo) conta come una modifica sola,
   sennò Ctrl+Z toglierebbe una lettera alla volta. */
const UNDO_CAP = 20;
const BURST_MS = 800;      // poco sopra il debounce di save: una pausa che fa
                           // scattare il salvataggio chiude anche la raffica
let undoStack = [];
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
}
export function resetUndo(){
  undoStack = [];
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
  lastEditAt = now;
  refreshUndoBtn();
}
export function undo(){
  if(RO || !st.state) return false;
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
  clearTimeout(saveTimer);
  st.state = JSON.parse(target);
  migrateState(st.state);
  // percorso e selezione possono puntare a nodi che nello stato ripristinato
  // non esistono (es. undo di una creazione mentre ci si era entrati dentro)
  const valid = [];
  for(const id of st.path){ if(findNode(id)) valid.push(id); else break; }
  st.path = valid.length ? valid : [st.state.root.id];
  if(st.selectedId && !findNode(st.selectedId)) st.selectedId = null;
  st.multiSel = new Set([...st.multiSel].filter(id => findNode(id)));
  if(st.selectedEdgeId) st.selectedEdgeId = null;
  doSave();                          // persiste subito, senza passare da noteChange
  return true;
}
/* L'annulla con feedback: unico punto d'ingresso per Ctrl+Z (scorciatoie.js),
   la voce nel menu ⋯ e il bottone ↶ su touch — stessa esperienza da ovunque. */
export function doUndo(){
  const el = document.getElementById("savestate");
  if(undo()){
    const attiva = document.querySelector(".view.active");
    showView(attiva ? attiva.id.replace("view-","") : "map");
    el.textContent = "Modifica annullata ↩";
  }else{
    el.textContent = "Niente da annullare";
  }
  refreshUndoBtn();
}

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

async function cloudPush(){
  if(!window.__cloud) return;
  if(cloudBusy){ cloudDirty = true; return; }
  cloudBusy = true;
  const el = document.getElementById("savestate");
  const body = JSON.stringify({data: st.state});
  const warn = sizeWarning(body.length);
  try{
    const res = await fetch(`/api/campaigns/${window.__cloud.id}`, {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      body
    });
    if(res.status === 413){
      el.textContent = `Non salvato nel cloud: ${mb(body.length)} MB, il limite è 4 — alleggerisci le immagini`;
      el.style.color = "var(--ember)";
      return;
    }
    if(!res.ok) throw new Error(res.status);
    el.textContent = warn ? `Salvato nel cloud ✓ · ${warn.msg}` : "Salvato nel cloud ✓";
    el.style.color = warn ? warn.tone : "var(--ink-dim)";
  }catch(_){
    el.textContent = "Offline — salvato in locale";
    el.style.color = "var(--gold)";
  }finally{
    cloudBusy = false;
    if(cloudDirty){ cloudDirty = false; cloudPush(); }
  }
}
function doSave(){
  const json = JSON.stringify(st.state);
  lastSnap = json;                                // da qui in poi l'undo torna a questo punto
  refreshUndoBtn();                               // lastSnap è cambiato: il proxy va rivalutato
  if(window.__cloud){
    store.set(SAVE_KEY, json);                    // cache offline
    cloudPush(); return;
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
  if(RO) return;                                  // il tavolo non ha niente da salvare
  noteChange();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 700);
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
export function migrateState(s){
  (function walk(n){
    if(!Array.isArray(n.edges)) n.edges=[];
    // tokenColor era il colore del solo segnalino "token"; ora `color` vale per
    // qualsiasi bolla (vedi nodeColor in modello.js). Le pedine già colorate
    // devono restare come il DM le aveva messe.
    if(n.tokenColor && !n.color) n.color = n.tokenColor;
    delete n.tokenColor;
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

// Gli onclick inline nei template cercano funzioni globali: i moduli ES non ne
// creano, quindi le espongo esplicitamente.
Object.assign(window, { switchCampaign, newCampaign, askDeleteCampaign, doUndo });

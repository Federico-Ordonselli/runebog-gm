/* Lo stato dell'app e la sua persistenza: dove stiamo girando, l'oggetto `st`
   condiviso da tutti i moduli, il salvataggio (locale o cloud), le campagne
   multiple e le utilità sull'albero. */

import { uid, node, escapeHtml } from "./modello.js";
import { openConfirm, showView } from "./viste.js";

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

export function defaultState(){
  const root = node("Runebog","zona");
  root.notes = "Città sulle paludi. One-shot di compleanno — 11 luglio.";
  root.children = [
    node("Distretto 1","zona"),
    node("Distretto 2","zona"),
    node("Distretto 3","zona"),
    node("Distretto 4","zona"),
    node("Distretto 5","zona")
  ];
  return {
    root,
    checklist: [
      {id:uid(), text:"Stampare le schede dei personaggi", done:false},
      {id:uid(), text:"Ripassare gli encounter principali", done:false}
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
  persistCurrent(); renderCampaignSelect();
  st.path = [st.state.root.id]; st.selectedId = null; st.selectedEdgeId = null; st.multiSel.clear();
  showView("map");
  setTimeout(()=>{ const i=document.querySelector("#detail input"); if(i){ i.focus(); i.select(); } }, 80);
}
export function askDeleteCampaign(){
  if(window.__cloud) return;
  if(campaignsIdx.length<=1){ alert("È l'unica campagna: creane un'altra prima di poterla eliminare."); return; }
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
      campaignsIdx = [{id: id0, name: "La mia campagna", updatedAt: Date.now()}];
      persistIndex();
      store.set(ckey(id0), JSON.stringify(defaultState()));
    }
    campaignId = store.get(CUR_KEY);
    if(!campaignsIdx.some(c=>c.id===campaignId)) campaignId = campaignsIdx[0].id;
    try{
      const raw = store.get(ckey(campaignId));
      st.state = raw ? JSON.parse(raw) : emptyState();
    }catch(e){ st.state = emptyState(); }
  }
  migrateState(st.state);                         // migrazione salvataggi vecchi
  st.path = [st.state.root.id];
}

/* ==================== salvataggio ==================== */
let saveTimer = null;
let cloudBusy = false, cloudDirty = false;
async function cloudPush(){
  if(!window.__cloud) return;
  if(cloudBusy){ cloudDirty = true; return; }
  cloudBusy = true;
  const el = document.getElementById("savestate");
  try{
    const res = await fetch(`/api/campaigns/${window.__cloud.id}`, {
      method: "PATCH",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({data: st.state})
    });
    if(!res.ok) throw new Error(res.status);
    el.textContent = "Salvato nel cloud ✓";
    el.style.color = "var(--ink-dim)";
  }catch(_){
    el.textContent = "Offline — salvato in locale";
    el.style.color = "var(--gold)";
  }finally{
    cloudBusy = false;
    if(cloudDirty){ cloudDirty = false; cloudPush(); }
  }
}
export function save(){
  if(RO) return;                                  // il tavolo non ha niente da salvare
  clearTimeout(saveTimer);
  saveTimer = setTimeout(()=>{
    if(window.__cloud){
      store.set(SAVE_KEY, JSON.stringify(st.state));    // cache offline
      cloudPush(); return;
    }
    persistent = store.set(ckey(campaignId), JSON.stringify(st.state));
    const c = campaignsIdx.find(x=>x.id===campaignId);
    if(c){
      const nm = st.state.root.title || "Campagna";
      if(c.name !== nm){ c.name = nm; renderCampaignSelect(); }
      c.updatedAt = Date.now();
    }
    persistIndex();
    const el = document.getElementById("savestate");
    el.textContent = persistent ? "Salvato ✓" : "Solo in memoria — usa Esporta";
    el.style.color = persistent ? "var(--ink-dim)" : "var(--gold)";
  }, 700);
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
Object.assign(window, { switchCampaign, newCampaign, askDeleteCampaign });

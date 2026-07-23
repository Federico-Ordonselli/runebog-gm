/* Il gestore degli strumenti temporanei della mappa (righello, aree d'effetto,
   percorso, …). È l'UNICO proprietario di: registro dei tool, tool attivo,
   pulsanti, scorciatoie, listener Pointer Events in cattura, pointer capture del
   gesto in corso, e pulizia. Ogni tool possiede soltanto la propria geometria
   (punto di partenza, waypoint, raggio) e riceve un piccolo contesto stabile.

   PERCHÉ IN CATTURA. I gesti della mappa (pan, pinch, drag, collegamenti, muri)
   vivono in listener di FASE BUBBLE su #plan-svg (mappa.js). Un listener in
   cattura sullo stesso elemento gira prima: quando un tool prende il gesto,
   `stopImmediatePropagation()` impedisce all'evento di raggiungere la fase bubble
   e quindi la mappa. Senza tool attivo il gestore ritorna subito e la mappa si
   comporta esattamente come prima.

   PERCHÉ DIPENDENZE INIETTATE. Tutto ciò che tocca il DOM arriva da `opts`
   (elementi, `doc`, `keyTarget`): così il gestore gira anche sotto Node — dove
   non esiste il DOM — con fake minimi, ed è quello che fanno i test in
   test/strumenti/. Il gestore non importa mai `document` o `window`.

   NIENTE STATO DELLA CAMPAGNA. Un tool temporaneo non riceve `st`, non chiama
   `save()`, non tocca il JSON né share.ts. La grafica sta solo nell'overlay, che
   non entra mai nel salvataggio. I tool persistenti (aure salvate, fog of war,
   condizioni sulle pedine) hanno confini diversi e una revisione a parte: vedi
   CLAUDE.md, non passano da qui. */

/**
 * @typedef {Object} ToolMappa
 * @property {string} id                     Identificatore stabile e univoco.
 * @property {string} label                  Testo breve del pulsante.
 * @property {string} [title]                Tooltip esteso.
 * @property {string} [icon]                 Simbolo decorativo, non unica etichetta.
 * @property {string} [shortcut]             Un singolo tasto, senza modificatori.
 * @property {"tutti"|"dm"|"tavolo"} [scope] Chi vede il pulsante. Default "tutti".
 * @property {(ctx:ToolContext)=>void} [activate]
 * @property {(ctx:ToolContext)=>void} [deactivate]
 * @property {(ctx:ToolContext, ev:PointerEvent, p:{x:number,y:number})=>boolean} pointerDown
 * @property {(ctx:ToolContext, ev:PointerEvent, p:{x:number,y:number})=>void} [pointerMove]
 * @property {(ctx:ToolContext, ev:PointerEvent, p:{x:number,y:number})=>void} [pointerUp]
 * @property {(ctx:ToolContext, ev:KeyboardEvent)=>boolean} [keyDown]   Il tool attivo consuma il tasto (torna true) prima delle scorciatoie: gli serve per i suoi sottotipi (aree d'effetto: 1–4). Non riceve mai Escape, che spegne il tool.
 * @property {(ctx:ToolContext, reason:string)=>void} [cancel]
 */

/**
 * @typedef {Object} ToolContext
 * @property {any} mapSvg
 * @property {any} overlaySvg
 * @property {any} layer                     Il <g> del tool attivo.
 * @property {number} cell                   Lato del quadretto in px (CELL).
 * @property {number} metersPerCell          Metri per quadretto (numero).
 * @property {(clientX:number, clientY:number)=>{x:number,y:number}} toMapPoint
 * @property {(p:{x:number,y:number})=>{x:number,y:number}} snapToGrid
 * @property {(testo:string)=>void} announce
 * @property {()=>void} clear                Svuota il layer del tool.
 */

/* Registro e scorciatoie sono a livello di modulo: la registrazione (e le sue
   guardie sui duplicati) è pura e testabile senza inizializzare nulla. */
const registry = new Map();
const shortcuts = new Map();          // tasto minuscolo → id del tool

/* Stato runtime, riempito da initGestoreTool. `deps` sono le dipendenze iniettate. */
let deps = null;
let active = null;                    // il ToolMappa attivo, o null
let activeBtn = null;                 // il suo pulsante
let layer = null;                     // il suo <g> nell'overlay
let ctx = null;                       // il contesto passato ai callback
let pointerId = null;                 // il dito/mouse del gesto posseduto, o null

export function registraTool(tool){
  if(!tool || !tool.id) throw new Error("Tool mappa senza id");
  if(registry.has(tool.id)) throw new Error(`Tool mappa duplicato: ${tool.id}`);
  if(tool.shortcut){
    const k = tool.shortcut.toLowerCase();
    const gia = shortcuts.get(k);
    if(gia) throw new Error(`Scorciatoia "${tool.shortcut}" già usata da ${gia}, non per ${tool.id}`);
    shortcuts.set(k, tool.id);
  }
  registry.set(tool.id, tool);
}

/* Azzera tutto: lo usano i test fra un caso e l'altro. In produzione il gestore
   si inizializza una volta sola, quindi non serve altrove. */
export function _reset(){
  registry.clear(); shortcuts.clear();
  deps = active = activeBtn = layer = ctx = pointerId = null;
}

export function toolAttivo(){ return active ? active.id : null; }

export function initGestoreTool(opts){
  deps = opts;
  // Un tool si vede o no secondo il suo scope e se siamo al tavolo (sola lettura).
  for(const tool of registry.values()){
    if(!scopeVale(tool.scope, opts.readOnly)) continue;
    creaPulsante(tool);
  }
  // Un solo gruppo di listener, in cattura, sul proprietario naturale dei gesti.
  const svg = opts.mapSvg;
  svg.addEventListener("pointerdown", onPointerDown, true);
  svg.addEventListener("pointermove", onPointerMove, true);
  svg.addEventListener("pointerup", onPointerUp, true);
  svg.addEventListener("pointercancel", onPointerCancel, true);
  svg.addEventListener("lostpointercapture", onPointerCancel, true);
  // Un solo keydown in cattura: Escape esce dal tool PRIMA che scorciatoie.js lo
  // legga come deselezione/risalita; una scorciatoia accende/spegne il suo tool.
  const kt = opts.keyTarget || (typeof window !== "undefined" ? window : null);
  if(kt) kt.addEventListener("keydown", onKeyDown, true);
}

function scopeVale(scope, readOnly){
  const s = scope || "tutti";
  if(s === "tutti") return true;
  return readOnly ? s === "tavolo" : s === "dm";
}

function creaPulsante(tool){
  const btn = deps.doc.createElement("button");
  btn.className = "btn";
  btn.type = "button";
  btn.textContent = (tool.icon ? tool.icon + " " : "") + tool.label;
  if(tool.title) btn.setAttribute("title", tool.title
    + (tool.shortcut ? ` (${tool.shortcut.toUpperCase()})` : ""));
  btn.setAttribute("aria-pressed", "false");
  btn.dataset && (btn.dataset.tool = tool.id);
  btn.addEventListener("click", ()=> attivaTool(active === tool ? null : tool.id));
  deps.toolbar.appendChild(btn);
  tool._btn = btn;
}

/* Accende un tool (o lo spegne se id è null / è già quello attivo). Sequenza:
   annulla il gesto in corso, spegni il tool precedente, svuota l'overlay,
   aggiorna i pulsanti, crea un <g> dedicato, accendi il nuovo. */
export function attivaTool(id){
  annullaGesto("cambio-tool");
  if(active){
    proteggi(()=> active.deactivate?.(ctx), "deactivate");
    rimuoviLayer();
    if(activeBtn){ activeBtn.classList.remove("on"); activeBtn.setAttribute("aria-pressed", "false"); }
    deps.mapSvg.classList.remove("tool-attivo");
    active = null; activeBtn = null; ctx = null;
  }
  if(!id) return;
  const tool = registry.get(id);
  if(!tool || !scopeVale(tool.scope, deps.readOnly)) return;
  active = tool;
  activeBtn = tool._btn || null;
  layer = deps.doc.createElementNS("http://www.w3.org/2000/svg", "g");
  layer.setAttribute("data-tool-layer", id);
  deps.overlaySvg.appendChild(layer);
  ctx = creaContesto();
  deps.mapSvg.classList.add("tool-attivo");
  if(activeBtn){ activeBtn.classList.add("on"); activeBtn.setAttribute("aria-pressed", "true"); }
  proteggi(()=> tool.activate?.(ctx), "activate");
}

function creaContesto(){
  const cell = deps.cell;
  const snap = v => Math.round(v / cell) * cell;   // la stessa maglia di snapGrid, dal CELL iniettato
  return {
    mapSvg: deps.mapSvg,
    overlaySvg: deps.overlaySvg,
    layer,
    cell,
    metersPerCell: deps.metersPerCell,
    toMapPoint: deps.toMapPoint,
    snapToGrid: p => ({ x: snap(p.x), y: snap(p.y) }),
    announce: testo => { if(deps.status) deps.status.textContent = testo; },
    clear: () => { if(layer) layer.replaceChildren(); },
  };
}

function rimuoviLayer(){
  if(layer && layer.remove) layer.remove();
  layer = null;
}

/* --- Pointer Events. Senza tool attivo NON tocchiamo nulla: la mappa lavora
   come prima. Con un tool attivo, solo il pulsante principale lo raggiunge; il
   centrale resta alla mappa (pan) e il destro al menu contestuale. La rotella
   non è intercettata affatto, quindi lo zoom resta. --- */
function onPointerDown(ev){
  if(!active) return;
  if(ev.button === 1 || ev.button === 2) return;   // centrale = pan, destro = menu: alla mappa
  // Un secondo dito durante un gesto posseduto lo annulla e viene consumato:
  // non si trasferisce a metà gesto il primo dito a mappa.js, che non ne ha mai
  // ricevuto il pointerdown. L'utente rilascia e ricomincia un pinch da capo.
  if(pointerId !== null){
    if(ev.pointerId !== pointerId){ ev.preventDefault(); ev.stopImmediatePropagation(); annullaGesto("secondo-dito"); }
    return;
  }
  const p = deps.toMapPoint(ev.clientX, ev.clientY);
  let preso = false;
  proteggi(()=>{ preso = !!active.pointerDown(ctx, ev, p); }, "pointerDown");
  if(!preso) return;                               // il tool non vuole il gesto: la mappa continua
  ev.preventDefault();
  ev.stopImmediatePropagation();
  pointerId = ev.pointerId;
  if(deps.mapSvg.setPointerCapture) { try{ deps.mapSvg.setPointerCapture(pointerId); }catch(_){/* pointerId già rilasciato */} }
}

function onPointerMove(ev){
  if(!active || pointerId === null || ev.pointerId !== pointerId) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  const p = deps.toMapPoint(ev.clientX, ev.clientY);
  proteggi(()=> active.pointerMove?.(ctx, ev, p), "pointerMove");
}

function onPointerUp(ev){
  if(!active || pointerId === null || ev.pointerId !== pointerId) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  const p = deps.toMapPoint(ev.clientX, ev.clientY);
  const finito = pointerId;
  pointerId = null;
  if(deps.mapSvg.releasePointerCapture) { try{ deps.mapSvg.releasePointerCapture(finito); }catch(_){/* già rilasciato */} }
  // Il tool termina la geometria del gesto ma RESTA attivo per una misura dopo.
  proteggi(()=> active.pointerUp?.(ctx, ev, p), "pointerUp");
}

function onPointerCancel(ev){
  if(pointerId === null || (ev && ev.pointerId !== pointerId)) return;
  annullaGesto("pointercancel");
}

/* Chiude il gesto in corso (perdita capture, secondo dito, cambio tool) SENZA
   spegnere il tool: il tool ripulisce la sua grafica provvisoria in `cancel`. */
function annullaGesto(reason){
  if(pointerId === null) return;
  const finito = pointerId;
  pointerId = null;
  if(deps && deps.mapSvg.releasePointerCapture){ try{ deps.mapSvg.releasePointerCapture(finito); }catch(_){/* già rilasciato */} }
  if(active) proteggi(()=> active.cancel?.(ctx, reason), "cancel");
}

function onKeyDown(ev){
  const t = ev.target;
  if(t && t.matches && t.matches("input, textarea, select")) return;
  if(ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if(ev.key === "Escape"){
    if(!active) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();      // prima di scorciatoie.js, che leggerebbe Esc come deseleziona/risali
    attivaTool(null);
    return;
  }
  // Il tool attivo ha diritto al tasto PRIMA delle scorciatoie: gli serve per i
  // suoi sottotipi (le aree d'effetto leggono 1–4). Se lo consuma non tocchiamo
  // altro; se lo rifiuta si prosegue con la scorciatoia globale.
  if(active && active.keyDown){
    let preso = false;
    proteggi(()=>{ preso = !!active.keyDown(ctx, ev); }, "keyDown");
    if(preso){ ev.preventDefault(); ev.stopImmediatePropagation(); return; }
  }
  const id = shortcuts.get((ev.key || "").toLowerCase());
  if(!id) return;                       // tasto non nostro: non lo intercettiamo
  const tool = registry.get(id);
  if(!tool || !scopeVale(tool.scope, deps.readOnly)) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  attivaTool(active === tool ? null : id);
}

/* Un errore dentro un tool non deve lasciare la mappa bloccata: si logga, si
   spegne il tool e si liberano puntatore, cursore e pulsante. Pan e drag tornano
   subito utilizzabili. Nessuno stack trace all'utente. */
function proteggi(fn, dove){
  try{ fn(); }
  catch(err){
    console.error("Errore nello strumento mappa", active && active.id, dove, err);
    // Evita ricorsione se l'errore arriva proprio da deactivate/cancel.
    if(dove !== "deactivate" && dove !== "cancel"){
      pointerId = null;
      const tool = active;
      active = null; ctx = null;
      rimuoviLayer();
      if(activeBtn){ activeBtn.classList.remove("on"); activeBtn.setAttribute("aria-pressed", "false"); activeBtn = null; }
      if(deps){ deps.mapSvg.classList.remove("tool-attivo"); if(deps.status) deps.status.textContent = ""; }
      if(tool && tool !== active) proteggi(()=> tool.deactivate?.(null), "deactivate");
    }
  }
}

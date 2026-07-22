/* La modalità combattimento: griglia rigida, pedine sul campo, ordine d'iniziativa.

   Tre decisioni che spiegano tutto il resto del file:

   1. UNA BATTAGLIA VIVE SU UN LIVELLO, non sull'app. `n.battle` esiste solo sul
      nodo dove si combatte: la presenza dell'oggetto È la modalità accesa. Così
      il DM può tenere aperta una scaramuccia nella cripta mentre naviga la città,
      e chiudere una battaglia significa cancellare un campo, non ripulire stato
      globale sparso.

   2. LE PEDINE NON COPIANO I DATI, LI REFERENZIANO. Una pedina PG porta solo
      `playerId`, una pedina mostro solo `{nodeId, foeId}`: nome e PF si leggono
      alla fonte a ogni disegno. Duplicare i PF sulla pedina significherebbe due
      numeri per la stessa creatura, che divergono al primo colpo incassato
      dalla scheda invece che dalla pianta. Espandere un encounter resta perciò
      reversibile: le pedine sono viste, non copie.

   3. LA GRIGLIA C'ERA GIÀ. Il pattern SVG della tela è a 40px e il generatore di
      dungeon ci disegna sopra le stanze alla stessa scala: 1 quadretto = 5 piedi
      = 1,5 metri. La modalità combattimento non introduce una scala nuova, rende
      rigido l'aggancio a quella esistente (vedi CELL). */

import { node, uid, NODE_COLORS, escapeHtml, CELL, snapToCell } from "./modello.js";
import { st, save, findNode, findParent, currentNode, RO } from "./stato.js";
import { openConfirm } from "./viste.js";

/* 1 quadretto = 5 piedi = 1,5 m. La costante vive in modello.js (unica
   definizione della maglia), e con lei ci vive ora anche l'aggancio al centro
   della cella: non è più una regola della battaglia, è la regola di ogni
   simbolo sulla mappa (vedi snapNode). Qui restano riesportate per gli import
   esistenti. */
export { CELL, snapToCell };
export const METRI_PER_CELLA = "1,5 m";

/* --- lo stato della battaglia sul livello corrente --- */
export function battleOf(n = currentNode()){ return n && n.battle ? n.battle : null; }
export function battleOn(){ return !!battleOf(); }

const d20 = () => 1 + Math.floor(Math.random() * 20);
const modDes = v => Math.floor(((+v || 10) - 10) / 2);

/* --- chi sta combattendo ---------------------------------------------------
   L'elenco si ricostruisce dal livello a ogni tiro: i PG della campagna (sono
   al tavolo comunque, anche senza pedina) e ogni nemico di ogni encounter che
   sta su questa mappa. Le voci portano solo riferimenti, mai nomi copiati. */
function combattentiDelLivello(n){
  const out = [];
  for(const p of st.state.players)
    if((p.name || "").trim()) out.push({id:uid(), kind:"pg", playerId:p.id, init:0});
  for(const c of n.children){
    if(c.type !== "encounter" || !c.monster) continue;
    for(const f of (c.monster.foes || []))
      out.push({id:uid(), kind:"foe", nodeId:c.id, foeId:f.id,
                init:0, des:modDes(c.monster.dex)});
  }
  return out;
}

/* Risolve una voce dell'ordine nella creatura viva. Torna null se la fonte non
   c'è più (nemico cancellato, giocatore rimosso): l'ordine non si autopulisce
   di nascosto, la voce resta e si disegna barrata — sparire da sola durante un
   turno confonderebbe più che aiutare. */
export function combattente(e){
  // Al tavolo l'ordine arriva già risolto dal server (projectBattle in share.ts):
  // porta il nome, non i riferimenti — quelli sono id di nodi che i giocatori non
  // devono avere. Lì non c'è niente da cercare, la voce è già la risposta.
  if(e.name !== undefined) return {nome: e.name, pg: e.kind === "pg", giu: !!e.down};

  if(e.kind === "pg"){
    const p = st.state.players.find(x => x.id === e.playerId);
    return p ? {nome: p.name || "PG", pg: true, giu: p.hp <= 0} : null;
  }
  const n = findNode(e.nodeId);
  const f = n?.monster?.foes.find(x => x.id === e.foeId);
  return f ? {nome: f.name || "Nemico", pg: false, giu: f.hp <= 0} : null;
}

/* --- accendere e spegnere -------------------------------------------------- */
export function toggleBattle(){
  if(RO) return;
  const n = currentNode();
  if(n.battle){
    openConfirm("Chiudere il combattimento? L'ordine d'iniziativa va perso; le pedine restano sulla mappa.", ok => {
      if(!ok) return;
      delete n.battle;
      save(); ridisegna();
    });
    return;
  }
  n.battle = {round: 1, turn: 0, order: []};
  save(); ridisegna();
}

/* Qui c'era un allineamento delle pedine all'accensione della modalità: le
   pedine "già sparse" si agganciavano solo entrando in combattimento. Dal
   22 lug 2026 non esistono pedine sparse — ogni simbolo nasce, si muove e si
   carica agganciato al centro del quadretto (snapNode in modello.js), quindi
   quella riparazione non aveva più niente da riparare. Il combattimento non
   introduce una regola sua: alza il contrasto della griglia, e basta. */

/* --- iniziativa ------------------------------------------------------------ */
export function rollInitiative(){
  if(RO) return;
  const n = currentNode(), b = battleOf(n); if(!b) return;
  // I numeri già scritti a mano per i PG si tengono: al tavolo il d20 lo tirano
  // loro, e il DM li trascrive. Si ritira solo per i mostri, che sono suoi.
  const vecchi = new Map(b.order.filter(e => e.kind === "pg").map(e => [e.playerId, e.init]));
  b.order = combattentiDelLivello(n).map(e => {
    if(e.kind === "pg") return {...e, init: vecchi.get(e.playerId) || 0};
    return {...e, init: d20() + e.des};
  });
  ordina(b);
  b.round = 1; b.turn = 0;
  save(); ridisegna();
}

export function rollForPg(entryId){
  if(RO) return;
  const b = battleOf(); if(!b) return;
  const e = b.order.find(x => x.id === entryId); if(!e) return;
  e.init = d20();
  ordina(b); save(); ridisegna();
}

export function setInit(entryId, val){
  if(RO) return;
  const b = battleOf(); if(!b) return;
  const e = b.order.find(x => x.id === entryId); if(!e) return;
  e.init = Number(val) || 0;
  ordina(b); save(); ridisegna();
}

/* A parità di iniziativa vince la Destrezza più alta (regola 5e), poi il nome:
   senza l'ultimo criterio l'ordine ballerebbe a ogni ridisegno per via di
   sort() su chiavi uguali. */
function ordina(b){
  const attivo = b.order[b.turn]?.id;
  b.order.sort((x, y) =>
    (y.init - x.init) ||
    ((y.des || 0) - (x.des || 0)) ||
    String(combattente(x)?.nome || "").localeCompare(String(combattente(y)?.nome || "")));
  // il turno segue la creatura, non la posizione: riordinare non deve saltare il turno
  const i = b.order.findIndex(e => e.id === attivo);
  if(i >= 0) b.turn = i;
}

export function nextTurn(){
  if(RO) return;
  const b = battleOf(); if(!b || !b.order.length) return;
  b.turn++;
  if(b.turn >= b.order.length){ b.turn = 0; b.round++; }
  save(); ridisegna();
}
export function prevTurn(){
  if(RO) return;
  const b = battleOf(); if(!b || !b.order.length) return;
  b.turn--;
  if(b.turn < 0){ b.turn = b.order.length - 1; b.round = Math.max(1, b.round - 1); }
  save(); ridisegna();
}

/* --- voce 10: espandere un encounter in pedine ----------------------------- */
export function expandEncounter(nodeId){
  if(RO) return;
  const enc = findNode(nodeId); if(!enc || !enc.monster) return;
  const parent = findParent(nodeId) || currentNode();
  const foes = enc.monster.foes || [];
  if(!foes.length) return;

  // già in campo: non si duplica, si va a vederle
  const gia = new Set(parent.children
    .filter(c => c.foe?.nodeId === nodeId)
    .map(c => c.foe.foeId));
  const daFare = foes.filter(f => !gia.has(f.id));
  if(!daFare.length) return;

  // in fila accanto al segnalino che le genera, così si vede da dove vengono
  const bx = typeof enc.x === "number" ? enc.x : 0;
  const by = typeof enc.y === "number" ? enc.y : 0;
  daFare.forEach((f, i) => {
    const t = node("", "token");
    t.foe = {nodeId, foeId: f.id};
    t.color = NODE_COLORS[3];                    // l'ember della tavolozza: sono ostili
    t.x = snapToCell(bx + CELL + (i % 4) * CELL);
    t.y = snapToCell(by + Math.floor(i / 4) * CELL);
    parent.children.push(t);
  });
  save(); ridisegna();
}

/* Quante pedine di questo encounter sono già sul campo: serve al pannello per
   dire "3 di 4 in campo" invece di offrire un bottone che non fa niente. */
export function foesInCampo(nodeId){
  const enc = findNode(nodeId); if(!enc?.monster) return {in: 0, tot: 0};
  const parent = findParent(nodeId) || currentNode();
  const ids = new Set(parent.children.filter(c => c.foe?.nodeId === nodeId).map(c => c.foe.foeId));
  const foes = enc.monster.foes || [];
  return {in: foes.filter(f => ids.has(f.id)).length, tot: foes.length};
}

/* --- voce 8: mettere in campo un PG ---------------------------------------- */
export function placePlayer(playerId){
  if(RO) return;
  const cur = currentNode();
  const p = st.state.players.find(x => x.id === playerId); if(!p) return;
  const gia = cur.children.find(c => c.playerId === playerId);
  if(gia){                                       // già qui: selezionala invece di raddoppiarla
    st.selectedId = gia.id; st.multiSel = new Set([gia.id]);
    ridisegna();
    return;
  }
  const idx = st.state.players.indexOf(p);
  const inCampo = cur.children.filter(c => c.playerId).length;
  const t = node("", "token");
  t.playerId = playerId;
  t.color = NODE_COLORS[idx % NODE_COLORS.length];
  t.x = snapToCell(inCampo * CELL);
  t.y = snapToCell(0);
  cur.children.push(t);
  st.selectedId = t.id; st.multiSel = new Set([t.id]);
  save(); ridisegna();
}

export function placeAllPlayers(){
  if(RO) return;
  for(const p of st.state.players) if((p.name || "").trim()) placePlayer(p.id);
}

/* --- la pedina vista dalla mappa ------------------------------------------- */
/* Nome e PF di una pedina collegata si leggono alla fonte. Torna null per le
   pedine libere (una torcia, un masso): quelle hanno solo il loro titolo. */
export function tokenLink(c){
  if(c.playerId){
    const p = st.state.players.find(x => x.id === c.playerId);
    return p ? {nome: p.name || "PG", hp: p.hp, hpMax: p.hpMax, pg: true} : null;
  }
  if(c.foe){
    const n = findNode(c.foe.nodeId);
    const f = n?.monster?.foes.find(x => x.id === c.foe.foeId);
    return f ? {nome: f.name || "Nemico", hp: f.hp, hpMax: f.hpMax, pg: false} : null;
  }
  return null;
}

/* --- la barra dell'iniziativa ---------------------------------------------- */
/* Si disegna anche al tavolo (RO): lì è la stessa lista senza i comandi. I PF
   dei mostri non compaiono da nessuna delle due parti — al tavolo perché il
   server non li manda affatto (projectBattle in share.ts), qui perché la barra
   è un tabellone d'ordine, e i PF stanno nella scheda. */
export function renderBattleBar(){
  const bar = document.getElementById("battle-bar");
  if(!bar) return;
  const b = battleOf();
  // Il bottone in barra strumenti dice se QUESTO livello ha una battaglia aperta:
  // navigando altrove si spegne da solo, perché la battaglia sta sul nodo.
  const btn = document.getElementById("battle-btn");
  if(btn){ btn.classList.toggle("on", !!b); btn.setAttribute("aria-pressed", b ? "true" : "false"); }
  if(!b){ bar.classList.remove("show"); bar.innerHTML = ""; return; }
  bar.classList.add("show");

  // I numeri si interpolano dentro attributi (value=…): un JSON importato o una
  // riga di DB manomessa può portarci dentro qualsiasi cosa, quindi si coercono
  // qui invece di fidarsi che ci sia finito solo ciò che scrive setInit. Stessa
  // ragione del num() in src/lib/share.ts.
  const intero = (v, alt = 0) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : alt;

  const righe = b.order.map((e, i) => {
    const c = combattente(e);
    const attivo = i === b.turn;
    const morto = c && c.giu;
    const nome = c ? c.nome : "(rimosso)";
    const cls = ["ini-row", attivo ? "on" : "", morto ? "dead" : "",
                 c?.pg ? "pg" : "foe", c ? "" : "gone"].filter(Boolean).join(" ");
    // aria-current: chi usa un lettore di schermo deve sentire di chi è il turno,
    // non dedurlo dal colore della riga
    return `<div class="${cls}"${attivo ? ' aria-current="true"' : ""}>
      ${RO
        ? `<span class="ini-num">${intero(e.init)}</span>`
        : `<input class="ini-num" type="number" value="${intero(e.init)}" aria-label="Iniziativa di ${escapeHtml(nome)}"
             onchange="setInit('${e.id}', this.value)">`}
      <span class="ini-name">${escapeHtml(nome)}</span>
      ${c?.pg && !RO ? `<button class="btn tiny" title="Tira per questo PG" onclick="rollForPg('${e.id}')">🎲</button>` : ""}
    </div>`;
  }).join("");

  const vuoto = !b.order.length;
  bar.innerHTML = `
    <div class="ini-head">
      <span class="ini-round">Round ${intero(b.round, 1)}</span>
      <span class="ini-scala" title="Un quadretto della griglia">▦ ${METRI_PER_CELLA}</span>
      ${RO ? "" : `
        <button class="btn tiny" onclick="prevTurn()" title="Turno precedente">‹</button>
        <button class="btn tiny primary" onclick="nextTurn()" title="Turno successivo">Avanti ›</button>`}
    </div>
    ${vuoto
      ? `<p class="ini-vuoto">Nessuno in iniziativa.${RO ? "" : " Tira per popolare l'ordine con i PG e i nemici degli encounter di questo livello."}</p>`
      : `<div class="ini-list">${righe}</div>`}
    ${RO ? "" : `
      <div class="ini-actions">
        <button class="btn tiny" onclick="rollInitiative()">🎲 Tira iniziativa</button>
        <button class="btn tiny" onclick="placeAllPlayers()">Metti in campo i PG</button>
        <button class="btn tiny danger" onclick="toggleBattle()">Chiudi</button>
      </div>`}`;
}

/* Un solo punto ridisegna: la barra vive fuori dalla tela, quindi ogni comando
   che tocca la battaglia deve aggiornare entrambe. Import differito per non
   chiudere un ciclo a tempo di caricamento con mappa.js. */
function ridisegna(){
  import("./mappa.js").then(m => m.renderMap());
}

Object.assign(window, { toggleBattle, rollInitiative, rollForPg, setInit,
  nextTurn, prevTurn, expandEncounter, placePlayer, placeAllPlayers });

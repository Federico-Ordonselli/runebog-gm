/* La mappa spaziale: motore del viewBox, rendering SVG della tela, interazioni
   pointer (drag, pinch, long-press, collegamenti), sfondo del livello,
   navigazione tra livelli e operazioni sulla selezione. */

import { duplicaNodi } from "./duplica.js";
import { puntiArco, percorsoRelativo, semplificaTraccia, curvaArco } from "./percorsi.js";
import { normalizzaPercorso, CAMPAIGN_LIMITS } from "./formato-campagna.js";
import { testoRicco, testoSemplice } from "./testo-ricco.js";
import { TYPES, SHAPES, SHAPE_COLORS, EDGE_TYPES, markerR, STATUS_COLORS, nodeColor,
         isMarker, isTesto, testoSize, testoAllinea, testoAdatta, TESTO_BOX, defShape, nodeBox, nodeCenter, node, uid, escapeHtml, escapeAttr,
         gridShape, onGrid, snapGrid, snapNode,
         wallShape, wallBox, contentBox, wallOpening, wallPlan, WALL,
         wallSegsOf, wallSegEnds, newWallSeg, stretchWallSeg, WALL_MAX,
         corridoiDi, cellaCorridoio, chiaveCella, sagomaCorridoi, riquadroCorridoi, CORRIDOI_MAX,
         DOOR_TYPES, doorKind, wallLabel, shapeType, scalaSopra, scalaDentro,
         GRIGLIE, GRIGLIA_BASE, GRID_LIMITS, grigliaDi, isHex, inScala, nomeCelle, formattaMetri,
         passoMaglia, tasselloMaglia, normalizzaTaglia, TAGLIA_MAX, MARKER_R, CELL,
         scalaSegnalino, SCHEDA_TIPI, haScheda, schedaDi, SCHEDA_LIMITI } from "./modello.js";
import { apriScrittura, riposizionaScrittura } from "./scrittura.js";
import { st, save, findNode, findParent, removeNode, currentNode, pathNodes, RO,
         clearSel, selectNode, selectWall, zoomOut } from "./stato.js";
import { showView, openConfirm } from "./viste.js";
import { renderDetail, compressImage, openDetailSheet } from "./pannello.js";
import { showCtxFor } from "./menu.js";
import { battleOn, tokenLink, renderBattleBar } from "./battaglia.js";

/* La maglia del livello aperto: muri, aggancio e disegno la leggono da qui.
   Ciò che sta sulla tela è sempre figlio del livello aperto, quindi è anche la
   maglia di tutto quello che si trascina. */
export const maglia = () => grigliaDi(currentNode());

export function renderMap(){
  renderCrumbs();
  renderCanvas();
  renderDetail();
  renderBattleBar();     // vive fuori dalla tela: va aggiornata insieme, non da sola
  allineaPalette();      // la barra segue il livello; si ferma da sé se non c'è niente da scorrere
}

export function renderCrumbs(){
  const wrap = document.getElementById("crumbs");
  wrap.innerHTML = "";
  const nodes = pathNodes();
  nodes.forEach((n,i)=>{
    if(i>0){
      const sep = document.createElement("span");
      sep.className="sep"; sep.textContent="›";
      wrap.appendChild(sep);
    }
    if(i===nodes.length-1){
      const here = document.createElement("span");
      here.className="here serif"; here.textContent=n.title||"(senza nome)";
      wrap.appendChild(here);
    }else{
      const b = document.createElement("button");
      b.textContent = n.title||"(senza nome)";
      b.onclick = ()=>{ st.path = st.path.slice(0,i+1); st.selectedId=null; renderMap(); };
      wrap.appendChild(b);
    }
  });
  if(nodes.length>1){
    const back = document.createElement("button");
    back.textContent = "↩ Su";
    back.style.marginLeft="auto";
    back.onclick = goUp;
    wrap.appendChild(back);
  }else if(!RO && scalaSopra(st.state.root.shape || defShape(st.state.root))){
    /* Sopra la radice non c'è niente da raggiungere: c'è da crearlo. È lo stesso
       posto di "↩ Su" perché è la stessa domanda — cosa contiene questo? — e
       tenerli distinti nel testo evita l'unico guaio possibile: premere "su" per
       abitudine e trovarsi un livello nuovo nella campagna. Sparisce quando la
       radice è già un mondo (scalaSopra torna null): non si impilano contenitori
       senza nome sopra il mondo. */
    const su = document.createElement("button");
    su.textContent = "⤢ Zoom indietro";
    su.title = "La campagna è più larga di così: crea il livello che contiene questo";
    su.style.marginLeft = "auto";
    su.onclick = ()=>{
      if(!zoomOut()) return;
      renderMap();
      // Il nome è un segnaposto: il cursore ci finisce dentro, come per una
      // campagna nuova. Il ritardo aspetta che il pannello sia stato riscritto.
      setTimeout(()=>{ const i=document.querySelector("#detail input"); if(i){ i.focus(); i.select(); } }, 80);
    };
    wrap.appendChild(su);
  }
}

export function goUp(){
  if(st.path.length>1){
    selectNode(st.path[st.path.length-1]);
    st.path.pop(); renderMap();
  }
}

/* Una casella di testo non è un posto: "entrarci" (doppio clic, Invio, menu,
   pannello — quattro strade, un cancello solo) vuol dire scriverci. Dal 25
   set 2026 vale anche per i segnalini con la scheda (SCHEDA_TIPI): per un
   PNG o una quest la cosa da fare col doppio clic è leggerne e scriverne la
   descrizione, e ci si scrive sul posto (scrittura.js). Dentro ci si entra
   ancora, da "Entra →" nel menu e nel pannello, che chiamano `entra`.
   Al tavolo non si scrive: lì il doppio clic entra, come sempre. */
export function enterNode(id){
  const n = childOf(id);
  if(n && !RO && (isTesto(n) || SCHEDA_TIPI.has(n.type))){ apriScrittura(id); return; }
  entra(id);
}
export function entra(id){
  if(!childOf(id)) return;
  st.path.push(id); clearSel(); renderMap();
}

export function jumpTo(parentId, childId){
  if(st.path[st.path.length-1] !== parentId) st.path.push(parentId);
  // Come per il clic: la selezione È il bersaglio del salto. Lasciare la
  // multi-selezione vecchia faceva muovere alle frecce le bolle sbagliate
  // dopo un salto da ricerca o diario quest.
  clearSel();
  if(childId) selectNode(childId);
  renderMap();
}

/* ==================== motore: viewBox, uno per livello ==================== */
const planVBs = {};
let planVB = null;
let planDrag = null;

export function planSvg(){ return document.getElementById("plan-svg"); }
export function planPointXY(cx, cy){
  const svg = planSvg();
  const p = svg.createSVGPoint(); p.x = cx; p.y = cy;
  return p.matrixTransform(svg.getScreenCTM().inverse());
}
function planPoint(evt){ return planPointXY(evt.clientX, evt.clientY); }
/* Quanto vale un pixel dello schermo in unità della mappa, e dove cade
   l'origine. Il viewBox NON ha le proporzioni della tela (planFit lo vuole
   largo almeno 700×480), e col preserveAspectRatio di default ("meet") il
   browser lo scala per farlo stare e lo centra: un pixel vale
   max(w/W, h/H), non w/W. Fino al 25 set 2026 pan e pizzico usavano w/W, e
   su uno schermo largo la mappa scivolava sotto il mouse al 50–60% del
   gesto invece di seguirlo. Legge il riquadro della tela, cioè forza un
   layout: i gesti la chiamano una volta all'inizio, non a ogni movimento. */
function vistaPx(vb = planVB){
  const r = planSvg().getBoundingClientRect();
  const W = r.width || 1, H = r.height || 1, s = Math.max(vb.w / W, vb.h / H);
  return {s, W, H, left:r.left, top:r.top};
}
function planApplyVB(){
  const vb = `${planVB.x} ${planVB.y} ${planVB.w} ${planVB.h}`;
  planSvg().setAttribute("viewBox", vb);
  // La tela degli strumenti condivide ESATTAMENTE il viewBox della mappa: è
  // l'unico legame che il renderer ha con l'overlay (strumenti/gestore.js).
  // Optional chaining: standalone l'overlay c'è sempre (è in app.html), ma non
  // dipendere da quell'ordine costa una riga e non si rompe se manca.
  document.getElementById("plan-tools-svg")?.setAttribute("viewBox", vb);
  planVBs[currentNode().id] = planVB;
  aggiornaScala();
  riposizionaScrittura();      // la scrittura sul posto segue zoom e pan
}

/* ---------- la scala sullo schermo ----------
   Quanto è grande un quadretto lo diceva solo il title di ⚔ Combattimento e il
   pannello di una bolla in scala: guardando la tela non lo si sapeva, e a zoom
   diversi un quadretto è 15px o 90. La barra in basso è lunga ESATTAMENTE n
   quadretti dello schermo di adesso, con una tacca per quadretto, e dice
   quanti sono e quanti metri fanno.
   - È situazionale: compare solo dove la maglia è una misura — un livello in
     scala (edificio, stanza, piazza), uno che contiene piante o muri, o uno
     scontro aperto. Dentro un mondo o una regione 1,5 m non misura niente, e
     una scala lì direbbe il contrario.
   - n è 1, 2, 5, 10… il più piccolo per cui la barra supera 24px: sotto
     quella misura una barra non si legge, e allontanando lo zoom i quadretti
     si contano a gruppi come su una carta.
   - Sta in HTML fuori da plan-svg (che renderCanvas riscrive) e si aggiorna da
     planApplyVB, cioè a ogni zoom e pan, più un ResizeObserver per la
     finestra: la lunghezza vera dipende anche da quanto è larga la tela. */
const PASSI_SCALA = [1, 2, 5, 10, 20, 50, 100];
let scalaOsservata = false;
function scalaUtile(cur){
  // Una maglia dichiarata dal DM misura qualcosa per definizione: l'ha messa
  // lì per contare, anche su una mappa di viaggio senza piante.
  return battleOn() || !!cur.griglia || gridShape(cur) || wallSegsOf(cur).length>0
    || corridoiDi(cur).length>0 || cur.children.some(gridShape);
}
function aggiornaScala(){
  const el = document.getElementById("plan-scale");
  if(!el || !planVB) return;
  const svg = planSvg();
  if(!scalaOsservata && typeof ResizeObserver==="function"){
    scalaOsservata = true;
    new ResizeObserver(()=>aggiornaScala()).observe(svg);
  }
  const pxUnit = Math.min(svg.clientWidth/planVB.w, svg.clientHeight/planVB.h);
  if(!scalaUtile(currentNode()) || !(pxUnit>0)){ el.hidden = true; return; }
  const g = maglia(), cella = g.cella*pxUnit;
  const n = PASSI_SCALA.find(k => k*cella >= 24) ?? PASSI_SCALA[PASSI_SCALA.length-1];
  const len = Math.round(n*cella);
  // Una tacca per quadretto finché si distinguono (almeno 4px l'una).
  const tacche = cella>=4 && n>1
    ? Array.from({length:n-1}, (_,i)=>`<line x1="${((i+1)*cella).toFixed(1)}" y1="5" x2="${((i+1)*cella).toFixed(1)}" y2="9"/>`).join("")
    : "";
  const metri = formattaMetri(n*g.metri);
  const quadretti = nomeCelle(g, n);
  el.hidden = false;
  el.title = `${nomeCelle(g, 1)} = ${formattaMetri(g.metri)}`;
  el.innerHTML = `<svg width="${len+2}" height="10" aria-hidden="true" focusable="false">
      <g transform="translate(1,0)"><path d="M0 1V9H${len}V1"/>${tacche}</g></svg>
    <span aria-hidden="true">${n} ${GRIGLIE[g.forma].glifo} · ${metri}</span>
    <span class="sr-only">Scala: ${quadretti}, ${metri}</span>`;
}
export function planFit(rerender){
  const cur = currentNode();
  const kids = cur.children.filter(c=>typeof c.x==="number");
  // I muri contano quanto le bolle: un livello fatto solo di muri è un
  // battlemap, cioè il caso per cui i muri liberi esistono — e senza questo
  // "Adatta" gli dava la vista di default, come a un livello vuoto. Stessa
  // ragione per cui `vuoto` in renderCanvas li conta.
  const muri = wallSegsOf(cur);
  const pav = riquadroCorridoi(maglia(), corridoiDi(cur));
  if(!kids.length && !muri.length && !pav){ planVB = {x:-600,y:-400,w:1200,h:800}; planApplyVB(); return; }
  let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  kids.forEach(c=>{ const b=nodeBox(c);
    x1=Math.min(x1,c.x); y1=Math.min(y1,c.y);
    x2=Math.max(x2,c.x+b.w); y2=Math.max(y2,c.y+b.h+20); });
  muri.forEach(w=>{ const e=wallSegEnds(w, maglia());
    x1=Math.min(x1,e.x1); y1=Math.min(y1,e.y1);
    x2=Math.max(x2,e.x2); y2=Math.max(y2,e.y2); });
  if(pav){ x1=Math.min(x1,pav.x1); y1=Math.min(y1,pav.y1); x2=Math.max(x2,pav.x2); y2=Math.max(y2,pav.y2); }
  const pad=120, w=Math.max(700,x2-x1+pad*2), h=Math.max(480,y2-y1+pad*2);
  planVB = {x:x1-pad-(w-(x2-x1)-pad*2)/2, y:y1-pad-(h-(y2-y1)-pad*2)/2, w, h};
  planApplyVB();
  if(rerender) renderCanvas();
}
export function planZoom(f, cx, cy){
  if(!planVB) return;
  if(cx===undefined){ cx = planVB.x+planVB.w/2; cy = planVB.y+planVB.h/2; }
  planVB = {x:cx-(cx-planVB.x)/f, y:cy-(cy-planVB.y)/f, w:planVB.w/f, h:planVB.h/f};
  planApplyVB();
}

export const childOf = id => currentNode().children.find(c=>c.id===id);
export const wallOf = id => wallSegsOf(currentNode()).find(w=>w.id===id);

/* ---------- il gruppo che si trascina ----------
   Bolle e muri insieme, con le posizioni di partenza di ciascuno. Uno solo per
   tutti e due i gesti (trascinare una bolla, trascinare un muro): erano due
   strade separate, e due strade divergono — quella dei muri si scordava le
   bolle e viceversa. Due mappe di partenza e non una, perché un id di muro e
   un id di bolla vengono dalla stessa `uid()` e in teoria possono coincidere. */
function dragGroup(){
  const nodi = [...st.multiSel], muri = [...st.multiSelWalls];
  const startN = {}, startW = {};
  nodi.forEach(id=>{ const m=childOf(id); if(m) startN[id]={x:m.x, y:m.y}; });
  muri.forEach(id=>{ const w=wallOf(id); if(w) startW[id]={x:w.x, y:w.y}; });
  return {nodi, muri, startN, startW, size: nodi.length + muri.length};
}
/* Trasla tutto il gruppo tranne l'àncora, di cui aggiorna DATI e DOM (transform
   o aggiornaMuro). L'àncora la salta perché i suoi dati li ha già scritti chi
   trascina, con la regola d'aggancio che le compete — ma il suo <g> nel DOM è
   ancora fermo, quindi TOCCA AL CHIAMANTE ridisegnarla (il ramo "move" le mette
   il transform, "wallmove" chiama aggiornaMuro). Saltarla e basta la lascia
   ferma fino al renderCanvas del rilascio: è il bug delle bolle che non seguono
   il puntatore. Rigido: chi finisce fuori dalla propria maglia ci rientra al
   rilascio (riagganciaGruppo) — regola che le bolle seguivano già, e i muri non
   ne introducono una seconda. */
function moveGroupBy(g, ddx, ddy, ancora){
  const svg = planSvg();
  for(const id of g.nodi){
    if(id===ancora || !g.startN[id]) continue;
    const m = childOf(id); if(!m) continue;
    m.x = g.startN[id].x + ddx; m.y = g.startN[id].y + ddy;
    const el = svg.querySelector(`.blk[data-block="${id}"]`);
    if(el) el.setAttribute("transform",`translate(${m.x},${m.y})`);
  }
  for(const id of g.muri){
    if(id===ancora || !g.startW[id]) continue;
    const w = wallOf(id); if(!w) continue;
    w.x = g.startW[id].x + ddx; w.y = g.startW[id].y + ddy;
    aggiornaMuro(w);
  }
}
/* Al rilascio ognuno torna sulla propria maglia: le bolle con snapNode (angolo
   o centro-cella, lo decide la forma), i muri sugli incroci. Serve perché il
   gruppo si muove rigido con l'àncora, e l'àncora può essere una bolla libera
   che si muove di 10px per volta. */
function riagganciaGruppo(g){
  const mg = maglia();
  for(const id of g.nodi){
    const m = childOf(id); if(!m) continue;
    const q = snapNode(m, m.x, m.y, mg); m.x = q.x; m.y = q.y;
  }
  for(const id of g.muri){
    const w = wallOf(id); if(!w) continue;
    w.x = snapGrid(w.x, mg); w.y = snapGrid(w.y, mg);
  }
}
/* Tracciato e punto di mezzo di un collegamento: una funzione sola per il
   disegno e per l'aggiornamento durante il trascinamento. */
const geoArco = (e, a, b) => curvaArco(puntiArco(e.percorso, nodeCenter(a), nodeCenter(b)));
/* La traccia del dito → percorso dell'arco. Si buttano i punti dentro le due
   bolle (la strada parte dal bordo, il pezzo sotto la bolla non si vede) e si
   semplifica con una tolleranza in pixel dello SCHERMO: a qualunque zoom il
   tremolio della mano è lo stesso. Traccia quasi dritta → nessun punto. */
function percorsoDaTraccia(traccia, a, b, daB, svg){
  if(!a || !b) return [];
  const dentro = (q, n) => { const bx = nodeBox(n);
    return q.x>=n.x && q.x<=n.x+bx.w && q.y>=n.y && q.y<=n.y+bx.h; };
  const A = nodeCenter(a), B = nodeCenter(b);
  /* La corda si misura da dove il dito è PARTITO (la maniglia, nell'angolo
     della bolla) e non dal centro: sennò una traccia tirata dritta dalla
     maniglia risulterebbe storta di mezza bolla, e mai più dritta. */
  const [, inizio, ...resto] = traccia;
  const tr = resto.filter(q => !dentro(q, a) && !dentro(q, b));
  const fine = daB ? A : B;
  const via = semplificaTraccia([inizio, ...tr, fine], 10 * vistaPx().s).slice(1, -1);
  // ritracciando un arco esistente dall'altro capo, la traccia va rovesciata
  return normalizzaPercorso(percorsoRelativo(daB ? via.reverse() : via, A, B));
}
/* Le linee dei collegamenti che toccano una bolla mossa: durante il gesto la
   tela non si ridisegna, quindi si spostano a mano. */
function aggiornaArchiDi(ids){
  const svg = planSvg(), cur = currentNode();
  (cur.edges||[]).forEach(e=>{
    if(!ids.includes(e.a) && !ids.includes(e.b)) return;
    const a=childOf(e.a), b=childOf(e.b); if(!a||!b) return;
    const g = svg.querySelector(`.edge[data-edge="${e.id}"]`); if(!g) return;
    const {d, meta} = geoArco(e, a, b), mx = meta.x, my = meta.y;
    g.querySelectorAll(":scope > path").forEach(l=>l.setAttribute("d", d));
    const txt = g.querySelector("text");
    if(txt){ txt.setAttribute("x",mx); txt.setAttribute("y",my-12); }
    const cross = g.querySelector("g");
    if(cross) cross.querySelectorAll("line").forEach((l,i)=>{
      l.setAttribute("x1",mx-9); l.setAttribute("y1", i? my+9 : my-9);
      l.setAttribute("x2",mx+9); l.setAttribute("y2", i? my-9 : my+9);
    });
  });
}
/* La classe .sel di tutta la selezione, riaccesa a mano. Serve dove la tela NON
   si ridisegna (il pointerdown, che deve tenere vivo il nodo sotto il
   puntatore): l'elenco da spegnere comprende i muri, sennò resta acceso in oro
   un muro che il modello ha già deselezionato. */
function ridipingiSel(){
  const svg = planSvg();
  svg.querySelectorAll(".blk.sel,.edge.sel,.wall-seg.sel").forEach(x=>x.classList.remove("sel"));
  st.multiSel.forEach(id=>{
    const el = svg.querySelector(`.blk[data-block="${id}"]`); if(el) el.classList.add("sel");
  });
  st.multiSelWalls.forEach(id=>{
    const el = svg.querySelector(`.wall-seg[data-wall="${id}"]`); if(el) el.classList.add("sel");
  });
}
const canEditEdges = () => true;   // i collegamenti si creano a ogni livello, città inclusa

/* La misura di un muro si dice in quadretti E in metri: il quadretto è l'unità
   con cui lo si costruisce, il metro quella con cui si decide se ci passa un
   carro. È la stessa coppia che il pannello mostra per le stanze. */
export const misuraMuro = w => {
  const g = maglia();
  return `${nomeCelle(g, w.len)} · ${formattaMetri(w.len*g.metri)}`;
};
const ariaMuro = w =>
  `${wallLabel(w)} ${w.dir==="v" ? "verticale" : "orizzontale"}, ${misuraMuro(w)}`;

/* Lo stipite: il pezzo di muro che resta ai due capi del vano. Senza, una porta
   in mezzo a un perimetro sembrerebbe un buco e una porta isolata non si
   distinguerebbe da un tratto sottile. Mai più di un terzo del vano, sennò su
   una porta da un quadretto gli stipiti si toccherebbero. */
const JAMB = 7;
/* Il disegno di un muro: pieno, oppure vano con quel che ci sta dentro.
   La porta segreta è l'eccezione che conferma la regola del perimetro derivato
   (`.wall-secret`): non apre niente, ci mette un segno sopra — così al tavolo,
   dove il segno non arriva, resta un muro pieno e non un buco da spiegare. */
function doorMarkup(w, e, kind){
  const v = w.dir === "v";
  const ux = v ? 0 : 1, uy = v ? 1 : 0;              // versore lungo il muro
  const nx = v ? 1 : 0, ny = v ? 0 : 1;              // e la sua perpendicolare
  if(kind === "segreta")
    return `<line class="wall-seg__secret" x1="${e.x1+ux*4}" y1="${e.y1+uy*4}"
                  x2="${e.x2-ux*4}" y2="${e.y2-uy*4}"/>`;
  const L = w.len*maglia().cella;
  const g = Math.min(JAMB, L/3);
  const ax = e.x1+ux*g, ay = e.y1+uy*g, bx = e.x2-ux*g, by = e.y2-uy*g;
  const luce = L - 2*g;                     // il vano fra i due stipiti
  let out = `<line class="wall-seg__line" x1="${e.x1}" y1="${e.y1}" x2="${ax}" y2="${ay}"/>
             <line class="wall-seg__line" x1="${bx}" y1="${by}" x2="${e.x2}" y2="${e.y2}"/>`;
  /* L'anta, come nelle piante: PARALLELA al muro se la porta è chiusa,
     PERPENDICOLARE se è spalancata. Il contrasto è di orientamento e non di
     colore, quindi si legge anche in scala di grigi — e soprattutto una porta
     aperta smette di essere un buco: il vano vuoto è già il modo di dire
     "varco", e le due cose devono restare distinguibili. Il verso in cui si
     apre non è un dato: l'anta sta sempre dallo stesso lato. */
  /* Varco, finestra e grata tengono gli stessi stipiti e si distinguono per
     SEGNO, non per colore: il varco ha le spalle perpendicolari e il vano
     vuoto, la finestra la doppia linea sottile delle piante, la grata una
     fila di sbarre. */
  if(kind === "varco"){
    const r = 6;
    return out + `<line class="wall-seg__door" x1="${ax-nx*r}" y1="${ay-ny*r}" x2="${ax+nx*r}" y2="${ay+ny*r}"/>
      <line class="wall-seg__door" x1="${bx-nx*r}" y1="${by-ny*r}" x2="${bx+nx*r}" y2="${by+ny*r}"/>`;
  }
  if(kind === "finestra"){
    const r = 2.5;
    return out + `<line class="wall-seg__win" x1="${ax-nx*r}" y1="${ay-ny*r}" x2="${bx-nx*r}" y2="${by-ny*r}"/>
      <line class="wall-seg__win" x1="${ax+nx*r}" y1="${ay+ny*r}" x2="${bx+nx*r}" y2="${by+ny*r}"/>`;
  }
  if(kind === "grata")
    return out + `<line class="wall-seg__grata" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`;
  out += kind === "aperta"
    ? `<line class="wall-seg__door" x1="${ax}" y1="${ay}" x2="${ax+nx*luce}" y2="${ay+ny*luce}"/>`
    : `<line class="wall-seg__door" x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>`;
  if(kind === "aperta") return out;
  /* Il catenaccio è un TRATTO PERPENDICOLARE, non un colore diverso del
     battente: chiusa e chiusa a chiave devono distinguersi anche per chi non
     separa l'ambra dalla sabbia (stessa regola di statusDot). */
  if(kind === "chiave"){
    const mx = (e.x1+e.x2)/2, my = (e.y1+e.y2)/2, r = 7;
    out += `<line class="wall-seg__lock" x1="${mx-nx*r}" y1="${my-ny*r}" x2="${mx+nx*r}" y2="${my+ny*r}"/>`;
  }
  return out;
}
/* Il contenuto del <g> di un muro. Sta a parte perché lo scrivono in due:
   renderCanvas quando ricostruisce la tela, e aggiornaMuro durante il
   trascinamento. */
function wallSegInner(w, sel){
  const e = wallSegEnds(w, maglia()), kind = doorKind(w);
  let out = `<line class="wall-seg__hit" x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}"/>`;
  /* Sul muro selezionato, il quadretto in cui "Metti qui" apre il vano. */
  if(sel && !RO && w.len > 1){
    const C = maglia().cella, k = cellaToccata(w);
    out += w.dir === "v"
      ? `<rect class="wall-seg__cella" x="${w.x-7}" y="${w.y+k*C}" width="14" height="${C}" rx="2"/>`
      : `<rect class="wall-seg__cella" x="${w.x+k*C}" y="${w.y-7}" width="${C}" height="14" rx="2"/>`;
  }
  if(!kind || kind === "segreta")
    out += `<line class="wall-seg__line" x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}"/>`;
  if(kind) out += doorMarkup(w, e, kind);
  // Le maniglie compaiono solo sul muro selezionato: due pallini per ogni muro
  // del livello sarebbero una pianta illeggibile.
  if(sel && !RO)
    out += `<circle class="wall-seg__handle" data-end="a" cx="${e.x1}" cy="${e.y1}" r="7"/>
            <circle class="wall-seg__handle" data-end="b" cx="${e.x2}" cy="${e.y2}" r="7"/>`;
  return out;
}

/* Sposta un muro senza ricostruire la tela: renderCanvas() riscrive
   svg.innerHTML e distruggerebbe il nodo su cui è iniziato il pointerdown,
   cioè la stessa trappola già commentata per il doppio clic. Si riscrive tutto
   il gruppo e non le singole linee: da quando esistono le porte le linee di un
   muro non hanno più tutte la stessa geometria, e spostarle in blocco
   ammucchierebbe stipiti e battente sui due capi. Il pointer capture sta
   sull'<svg>, non su questo <g>: il gesto sopravvive al ridisegno. */
function aggiornaMuro(w){
  const g = planSvg().querySelector(`.wall-seg[data-wall="${w.id}"]`); if(!g) return;
  g.innerHTML = wallSegInner(w, g.classList.contains("sel"));
  g.setAttribute("aria-label", ariaMuro(w));
}

function ensureLayout(parent){
  if(!Array.isArray(parent.edges)) parent.edges = [];
  const missing = parent.children.some(c => typeof c.x !== "number");
  if(!missing) return;
  const n = Math.max(parent.children.length, 1);
  const R = Math.max(220, 90*Math.sqrt(n));
  parent.children.forEach((c,i)=>{
    if(typeof c.x === "number") return;
    const a = -Math.PI/2 + i*(2*Math.PI/n);
    const box = nodeBox(c);
    c.x = Math.round((Math.cos(a)*R - box.w/2)/10)*10;
    c.y = Math.round((Math.sin(a)*R - box.h/2)/10)*10;
  });
}

/* La costa di un continente: una sagoma FISSA, in coordinate 0..1 sul riquadro.
   Fissa e non generata dall'id perché renderCanvas ridisegna in continuo (anche
   col polling del tavolo): una costa casuale cambierebbe profilo a ogni battuta
   di tasto. Sono gli stessi vertici dell'icona nella palette di app.html,
   normalizzati sul loro riquadro: chi trascina quella sagoma deve ritrovare
   quella sagoma sulla tela. */
const COSTA = [
  [1,.5],    [.872,.715], [.733,.903], [.5,1],   [.3,.846],  [.089,.737],
  [0,.5],    [.119,.28],  [.305,.162], [.5,0],   [.73,.102], [.864,.29],
];

/* La costa si chiude su una CURVA e non su una spezzata: gli stessi sette
   vertici, portati a 380px, si leggono come un cristallo — a quella taglia gli
   spigoli sono la cosa che si vede per prima, e un continente non ha spigoli.
   La ricetta è Catmull-Rom convertita in Bézier, cioè la curva morbida che
   passa PER i punti dati invece che vicino: i vertici restano quelli
   dell'icona nella palette, che è il patto da non rompere. */
function curvaChiusa(punti, W, H){
  const P = punti.map(([u,v]) => [u*W, v*H]);
  const n = P.length, v = x => x.toFixed(1);
  let d = `M${v(P[0][0])},${v(P[0][1])}`;
  for(let i = 0; i < n; i++){
    const [p0,p1,p2,p3] = [P[(i-1+n)%n], P[i], P[(i+1)%n], P[(i+2)%n]];
    d += `C${v(p1[0]+(p2[0]-p0[0])/6)},${v(p1[1]+(p2[1]-p0[1])/6)}`
       + ` ${v(p2[0]-(p3[0]-p1[0])/6)},${v(p2[1]-(p3[1]-p1[1])/6)}`
       + ` ${v(p2[0])},${v(p2[1])}`;
  }
  return d + "Z";
}

/* La sagoma di una forma, senza niente attorno. UNA funzione, e la disegnano
   sia la tela sia le pastiglie della palette del livello vuoto: erano un
   quadratino CSS che diceva solo "tondo, rombo o quadro", cioè una terza
   descrizione delle stesse nove forme accanto a SHAPES e alla palette in
   app.html. Adesso quella palette non può più promettere una sagoma che la
   tela non disegna — è esattamente il divario che i territori avevano.

   Il principio della scala: più il territorio è largo, meno il suo contorno è
   una linea che qualcuno ha tracciato. Un mondo è un corpo visto da fuori (una
   sfera col suo meridiano), un continente ha una costa, una nazione ha un
   confine disegnato sopra la terra, una regione ha una linea amministrativa —
   tratteggiata, perché sul terreno non c'è — e un quartiere ha dei bordi veri,
   il rettangolo di sempre. La scala si legge quindi anche a colpo d'occhio,
   senza leggere il nome e senza confrontare due bolle per dimensione.

   Solo il primo elemento porta .blk-shape: è quello che riceve il ring di
   selezione, il focus da tastiera e l'alone di "condiviso". I segni interni
   sono decorazione e stanno in .terr-mark, sennò la lanterna si sdoppierebbe.

   I tratteggi sono PROPORZIONALI al riquadro e non in pixel fissi: la stessa
   funzione disegna una regione da 260px e un'icona da 20, e un "14 9" buono
   sulla tela lascerebbe l'icona con un trattino e mezzo. Si dichiara quanti
   trattini fare sul giro, così il ritmo è lo stesso a ogni taglia — e sono
   pochi (otto) sul confine di una nazione: a sedici, sull'icona, quella linea
   spariva e la nazione diventava indistinguibile dal quartiere. */
function silhouetteForma(s, box, col){
  const c = `style="--c:${col}"`;
  const W = box.w, H = box.h;
  const tratto = (giro, quanti) => {
    const passo = giro/quanti;
    return `stroke-dasharray="${(passo*.6).toFixed(2)} ${(passo*.4).toFixed(2)}"`;
  };
  /* Anche il raccordo va limitato dal riquadro, per la stessa ragione dei
     tratteggi: un rx da 18px su un'icona da 20×14 non arrotonda gli angoli, la
     trasforma in una pillola. Il tetto lascia intatte le bolle sulla tela, che
     sono tutte abbondantemente sopra la soglia. */
  const raccordo = max => Math.min(max, Math.min(W, H)/4);
  switch(s.disegno){
    case "globo":
      return `<ellipse class="blk-shape" cx="${W/2}" cy="${H/2}" rx="${W/2}" ry="${H/2}" ${c}/>
        <ellipse class="terr-mark" cx="${W/2}" cy="${H/2}" rx="${(W*.2).toFixed(1)}" ry="${H/2}" ${c}/>`;
    case "costa":
      return `<path class="blk-shape" d="${curvaChiusa(COSTA, W, H)}" ${c}/>`;
    case "confine":
      // Il confine corre defilato e non a metà: al centro ci stanno il titolo e
      // l'anteprima dei figli, e una linea in mezzo taglierebbe la bolla in due
      // invece di dire "di là comincia un'altra nazione".
      return `<rect class="blk-shape" width="${W}" height="${H}" rx="${raccordo(10)}" ${c}/>
        <line class="terr-mark" ${tratto(H*1.4, 8)} x1="${(W*.74).toFixed(1)}" y1="0" x2="${(W*.86).toFixed(1)}" y2="${H}" ${c}/>`;
    case "tratteggio":
      return `<rect class="blk-shape" ${tratto((W+H)*2, 16)} width="${W}" height="${H}" rx="${raccordo(18)}" ${c}/>`;
  }
  if(s.circle)  return `<ellipse class="blk-shape" cx="${W/2}" cy="${H/2}" rx="${W/2}" ry="${H/2}" ${c}/>`;
  if(s.diamond) return `<polygon class="blk-shape" points="${W/2},0 ${W},${H/2} ${W/2},${H} 0,${H/2}" ${c}/>`;
  return `<rect class="blk-shape" width="${W}" height="${H}" rx="${raccordo(10)}" ${c}/>`;
}

/* La sagoma di un segnalino (`sagoma` in TYPES, 25 set 2026), inscritta nel
   quadrato D×D del suo riquadro: aggancio, collegamenti e maniglie restano
   quelli del disco, cambia solo il contorno. Le quattro si distinguono per
   silhouette e non per colore — il colore è del DM, e due tipi possono
   finire dello stesso. Lo scudo e il foglio stanno un po' dentro il
   quadrato: a filo sembrerebbero più grandi del disco, che l'occhio misura
   sul diametro. La usano la tela, la palette e il livello vuoto. */
export function sagomaSegnalino(tipo, D, attr = ""){
  const f = v => (v * D).toFixed(1);
  switch((TYPES[tipo] || {}).sagoma){
    case "scudo":
      return `<path class="blk-shape" ${attr} d="M${f(.1)} ${f(.1)}Q${f(.5)} ${f(-.02)} ${f(.9)} ${f(.1)}L${f(.9)} ${f(.5)}C${f(.9)} ${f(.78)} ${f(.7)} ${f(.92)} ${f(.5)} ${D}C${f(.3)} ${f(.92)} ${f(.1)} ${f(.78)} ${f(.1)} ${f(.5)}Z"/>`;
    case "rombo":
      return `<polygon class="blk-shape" ${attr} points="${f(.5)},${f(-.04)} ${f(1.04)},${f(.5)} ${f(.5)},${f(1.04)} ${f(-.04)},${f(.5)}"/>`;
    case "foglio":
      // La piega è un segno a parte e non .blk-shape: selezione e alone di
      // "condiviso" devono accendere un contorno solo (come .terr-mark).
      return `<path class="blk-shape" ${attr} d="M${f(.14)} ${f(.04)}H${f(.64)}L${f(.86)} ${f(.26)}V${f(.96)}H${f(.14)}Z"/>
        <path class="sag-piega" ${attr} d="M${f(.64)} ${f(.04)}V${f(.26)}H${f(.86)}"/>`;
  }
  return `<circle class="blk-shape" ${attr} cx="${D/2}" cy="${D/2}" r="${D/2}"/>`;
}
/* L'icona di un segnalino nella palette e nel livello vuoto: la stessa
   funzione della tela, così le tre non possono divergere. */
export const icoSegnalino = (tipo, px = 14) => `<svg class="ico-sag${tipo === "token" ? " pieno" : ""}" width="${px}" height="${px}"
  viewBox="-1.5 -1.5 ${px + 3} ${px + 3}" style="--c:${TYPES[tipo]?.color || "var(--ink)"}" aria-hidden="true">${
  sagomaSegnalino(tipo, px)}</svg>`;

function shapeMarkup(n, box, col, aperture){
  const s = SHAPES[n.shape||defShape(n)] || {};
  // I muri sono l'unico caso che cambia la sagoma invece di aggiungersi: una
  // pianta murata ha angoli veri, il raccordo da 10px appartiene al simbolo.
  if(!wallShape(n)) return silhouetteForma(s, box, col);
  return `<rect class="blk-shape" width="${box.w}" height="${box.h}" rx="3" style="--c:${col}"/>${
    wallsMarkup(box, aperture||[])}`;
}
/* Lo spessore lo passa il markup, non il CSS: la sporgenza degli angoli è
   calcolata su WALL in modello.js, e un valore che diverge aprirebbe i cantoni. */
function wallsMarkup(box, aperture){
  const {runs, doors, marks} = wallPlan(box, aperture);
  const v = x => Math.round(x*10)/10;
  const line = (g, cls, sw="") =>
    `<line class="${cls}" x1="${v(g.x1)}" y1="${v(g.y1)}" x2="${v(g.x2)}" y2="${v(g.y2)}"${sw}/>`;
  return `<g class="walls" pointer-events="none" stroke-width="${WALL}">
    ${runs.map(g=>line(g,"wall")).join("")}
    ${doors.map(g=>line(g,"door",` stroke-width="2"`)).join("")}
    ${marks.map(g=>line(g,"wall-secret")).join("")}
  </g>`;
}
/* Le aperture di TUTTE le bolle murate del livello, in un giro solo sui
   collegamenti: servono i vicini, quindi non si possono calcolare dentro il
   disegno della singola bolla. Un arco ne apre due, una per capo. */
function doorOpenings(cur){
  const map = new Map();
  for(const e of (cur.edges||[])){
    const a = childOf(e.a), b = childOf(e.b);
    if(!a || !b || a === b) continue;
    const t = EDGE_TYPES[e.type] || EDGE_TYPES.strada;
    /* Con un percorso a mano la porta sta dove esce il PRIMO tratto, non la
       corda: una strada che parte verso nord non buca il muro a est. */
    const pts = puntiArco(e.percorso, nodeCenter(a), nodeCenter(b));
    for(const [n, P, Q] of [[a,pts[0],pts[1]],[b,pts.at(-1),pts.at(-2)]]){
      if(!wallShape(n)) continue;
      const o = wallOpening(wallBox(nodeBox(n)), Q.x-P.x, Q.y-P.y);
      if(!o) continue;
      o.dmOnly = !!t.dmOnly;              // un passaggio segreto non buca il muro
      if(!map.has(n.id)) map.set(n.id, []);
      map.get(n.id).push(o);
    }
  }
  return map;
}
/* Lo stato non viaggia mai solo sul colore (oro e verde si confondono per un
   daltonico deutan): "da fare" è un anello vuoto, "in corso" un disco pieno,
   "fatto" un disco con la spunta. */
function statusDot(x,y,st_){
  const col = STATUS_COLORS[st_]||"var(--grigio)";
  if(st_==="da fare")
    return `<circle cx="${x}" cy="${y}" r="5" style="fill:var(--bog);stroke:${col}" stroke-width="2.5" pointer-events="none"/>`;
  if(st_==="fatto")
    return `<g pointer-events="none"><circle cx="${x}" cy="${y}" r="5.5" style="fill:${col};stroke:var(--bog)" stroke-width="2"/>`+
           `<path d="M${x-2.6} ${y+0.2}l1.9 2 3.4-4" fill="none" style="stroke:var(--bog)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  return `<circle cx="${x}" cy="${y}" r="5.5" style="fill:${col};stroke:var(--bog)" stroke-width="2" pointer-events="none"/>`;
}

/* La maniglia d'angolo: la stessa delle bolle, e compare alle stesse
   condizioni (una sola cosa selezionata). */
const maniglia = (c, lato) => c.id===st.selectedId && st.multiSel.size<=1
  ? `<rect class="rs-handle" x="${lato-8}" y="${lato-8}" width="16" height="16" rx="3"/>` : "";

/* La scheda di un segnalino (haScheda, schedaDi in modello.js): un riquadro
   centrato sotto il nome, con la descrizione resa come nelle caselle di
   testo (testoRicco, stesse classi `.tr-*` in em). Sta DENTRO il gruppo del
   segnalino, quindi un clic sulla scheda seleziona e trascina il segnalino
   intero, e selezione, duplica e annulla non hanno niente di nuovo da sapere.
   Non entra in nodeBox: aggancio, collegamenti e taglia restano quelli del
   simbolo, e la scheda gli va dietro.
   Senza un'altezza scelta dal DM la scheda è alta quanto il testo fino al
   suo tetto: quanto, lo sa solo la resa, e lo misura adattaSchede dopo il
   disegno. Qui si usa l'ultima misura, per non sfarfallare. */
const cimaScheda = c => {
  const R = markerR(c), k = scalaSegnalino(c);
  return (c.children.length ? R*2+6+22*k : R*2+4+11*k) + 8*k;
};
const misureScheda = new Map();
function altezzaScheda(c, s){
  if(s.h) return s.h;
  if(testoAdatta(c)) return s.tetto;
  return misureScheda.get(c.id)?.h ?? s.tetto;
}
function schedaMarkup(c, col){
  const s = schedaDi(c), h = altezzaScheda(c, s), fit = testoAdatta(c);
  const px = fit ? (misureFit.get(c.id)?.px ?? s.px) : s.px;
  const x = markerR(c) - s.w/2, y = cimaScheda(c);
  const tagliata = misureScheda.get(c.id)?.tagliata ? " tagliata" : "";
  // Lo stato apre la scheda: in una quest è la prima cosa che si cerca.
  const stato = c.status ? `<div class="scheda-stato"><span class="scheda-pallino" style="background:${STATUS_COLORS[c.status]||"var(--grigio)"}"></span>${escapeHtml(c.status)}</div>` : "";
  return `<g class="scheda" transform="translate(${x},${y})">
    <rect class="scheda-fondo" width="${s.w}" height="${h}" rx="6" style="--c:${col}"/>
    <foreignObject width="${s.w}" height="${h}" pointer-events="none">
      <div xmlns="http://www.w3.org/1999/xhtml" class="testo-txt scheda-txt${fit?" testo-fit":""}${tagliata}" style="font-size:${px}px;text-align:${testoAllinea(c)}">${stato}${testoRicco(c.notes)}</div>
    </foreignObject>
    ${c.id===st.selectedId && st.multiSel.size<=1 ? `<rect class="rs-handle rs-scheda" x="${s.w-8}" y="${h-8}" width="16" height="16" rx="3"/>` : ""}
  </g>`;
}
/* Dopo il disegno: l'altezza delle schede senza altezza scelta, e quali
   tagliano il testo (quelle hanno una sfumatura in fondo, che dice "c'è
   dell'altro" invece di lasciar credere che il testo finisca lì). Si scrive
   negli attributi e non si ridisegna: la tela gira a ogni selezione, e un
   secondo renderCanvas dentro un gesto distruggerebbe il nodo sotto il dito.
   La misura resta in memoria per chiave, come quella di adattaCaratteri. */
function adattaSchede(cur){
  const svg = planSvg();
  for(const c of cur.children){
    if(!isMarker(c) || !haScheda(c) || typeof c.x !== "number") continue;
    const s = schedaDi(c), fit = testoAdatta(c);
    const chiave = `${s.w}|${s.h}|${s.px}|${fit}|${testoAllinea(c)}|${c.status}|${c.notes}`;
    if(misureScheda.get(c.id)?.chiave === chiave) continue;
    const g = svg.querySelector(`.blk[data-block="${c.id}"] .scheda`);
    const el = g?.querySelector(".scheda-txt");
    if(!el) continue;
    let h = altezzaScheda(c, s), tagliata = false;
    if(!fit){
      el.style.height = "auto";
      const naturale = Math.ceil(el.offsetHeight);
      el.style.height = "";
      if(!s.h) h = Math.max(SCHEDA_LIMITI.hMin, Math.min(s.tetto, naturale));
      tagliata = naturale > h + 1;
    }
    misureScheda.set(c.id, {chiave, h, tagliata});
    g.querySelector(".scheda-fondo").setAttribute("height", h);
    g.querySelector("foreignObject").setAttribute("height", h);
    g.querySelector(".rs-scheda")?.setAttribute("y", h-8);
    el.classList.toggle("tagliata", tagliata);
  }
}

/* Nome accessibile di una bolla: quello che un lettore di schermo annuncia
   arrivandoci con Tab. Tipo prima del titolo, come nel pannello di dettaglio. */
function ariaBlk(c){
  const link = c.type==="token" ? tokenLink(c) : null;
  // Una casella di testo si annuncia con ciò che c'è scritto: il titolo non ce l'ha.
  const nome = link ? link.nome : isTesto(c) ? (testoSemplice(c.notes).slice(0,80) || "vuota") : (c.title||"senza nome");
  let s = `${(TYPES[c.type]||TYPES.nota).label}: ${nome}`;
  // I PF vanno detti, non solo disegnati: la barra sotto la pedina non esiste
  // per chi usa un lettore di schermo.
  if(link && link.hpMax>0) s += ` · ${link.hp} PF su ${link.hpMax}`;
  if(c.status) s += ` · ${c.status}`;
  if(c.children.length) s += ` · contiene ${c.children.length} element${c.children.length===1?"o":"i"}`;
  if(!RO && c.shared) s += " · visibile ai giocatori";
  return escapeAttr(s);
}

/* anteprima in miniatura del contenuto di un blocco (i "collegamenti fatti" visti da fuori)

   `dentro` è il riquadro del CONTENUTO (contentBox), non quello della bolla: su
   una sagoma inscritta i due non coincidono, e impaginare sul secondo faceva
   uscire l'anteprima dal contorno. Gli 11 di margine e i 20 lasciati in cima al
   titolo si contano da lì.

   Sotto una certa taglia l'anteprima non esce affatto, e stringendo il riquadro
   il caso capita più spesso (una torre non ne ha più): va bene, perché a quelle
   dimensioni una mappa annidata è illeggibile comunque — ma è la ragione per cui
   il conteggio `◦ N`, che resta l'unico segno di "qui dentro c'è qualcosa", deve
   stare dentro la sagoma anche lui. */
function miniPreview(n, dentro){
  const kids = n.children.filter(c=>typeof c.x==="number");
  if(!kids.length) return "";
  let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  kids.forEach(c=>{ const b=nodeBox(c);
    x1=Math.min(x1,c.x); y1=Math.min(y1,c.y);
    x2=Math.max(x2,c.x+b.w); y2=Math.max(y2,c.y+b.h); });
  const availW = dentro.w-22, availH = dentro.h-42;
  if(availW<26 || availH<20) return "";
  const k = Math.min(availW/Math.max(60,x2-x1), availH/Math.max(60,y2-y1));
  const ox = dentro.x + 11 + (availW-(x2-x1)*k)/2 - x1*k;
  const oy = dentro.y + 31 + (availH-(y2-y1)*k)/2 - y1*k;
  let out = `<g class="mini" pointer-events="none">`;
  for(const e of (n.edges||[])){
    const a = kids.find(c=>c.id===e.a), b = kids.find(c=>c.id===e.b);
    if(!a||!b) continue;
    const A=nodeCenter(a), B=nodeCenter(b), t=EDGE_TYPES[e.type]||EDGE_TYPES.strada;
    out += `<line x1="${A.x*k+ox}" y1="${A.y*k+oy}" x2="${B.x*k+ox}" y2="${B.y*k+oy}" style="stroke:${t.stroke}" stroke-width="1.8"${t.dash?` stroke-dasharray="3 3"`:""}/>`;
  }
  for(const c of kids){
    const col = nodeColor(c);
    if(isTesto(c)) continue;   // una scritta, rimpicciolita, è un rettangolo vuoto che finge una stanza
    if(isMarker(c)){
      const C = nodeCenter(c);
      out += `<circle cx="${C.x*k+ox}" cy="${C.y*k+oy}" r="3" style="fill:${col}"/>`;
    }else{
      const b = nodeBox(c);
      out += `<rect x="${c.x*k+ox}" y="${c.y*k+oy}" width="${Math.max(5,b.w*k)}" height="${Math.max(5,b.h*k)}" rx="1.5" fill="none" style="stroke:${col}" stroke-width="1.6"/>`;
    }
  }
  return out + `</g>`;
}

/* L'empty state insegna cose diverse a seconda di dove sei: alla radice di una
   campagna nuova spiega il concetto (le bolle contengono altre mappe), nei
   livelli interni ricorda solo i gesti, al tavolo dei giocatori non propone
   modifiche — lì non c'è niente da trascinare. */
function emptyNodeMarkup(){
  // 19px come gli h2 del pannello e dei dialog: un gradino solo, non 18/19
  const h = t => `<p class="serif" style="font-size:19px">${t}</p>`;
  const p = t => `<p style="color:var(--ink-dim);font-size:13px;max-width:340px;text-align:center">${t}</p>`;
  if(RO) return h("Qui non c'è ancora niente da vedere.") +
              p("Il DM non ha ancora rivelato nulla di questo livello.");
  /* Le scelte stanno QUI, non solo nella barra in alto. Prima c'era un bottone
     unico, "+ Aggiungi bolla", che creava una forma fissa: da un livello vuoto
     sembrava obbligatorio passare da una bolla prima di poter mettere una quest
     o un encounter. E sotto i 760px la barra scorre in orizzontale con la
     scrollbar nascosta, quindi metà palette (i segnalini) è proprio invisibile.
     Generata da SHAPES e TYPES, le stesse sorgenti della barra: non possono
     divergere. */
  const chip = (kind, key, label, colore, ico) => `
    <button class="ep-chip" onclick="addAtCenter('${kind}','${key}')" title="Aggiungi: ${label}">
      ${ico}${label}
    </button>`;
  /* L'icona di una forma È la forma, disegnata da silhouetteForma: la stessa
     funzione della tela, quindi le due non possono divergere. Il viewBox ha un
     margine perché il tratto è centrato sul contorno e a filo di riquadro ne
     resterebbe fuori metà. I segnalini restano un pallino: sulla tela sono un
     disco con dentro un'iniziale, e a 12px l'iniziale non si legge. */
  const icoForma = (s, colore) => `<svg class="ep-ico ep-sil" viewBox="-1.5 -1.5 23 17"
      width="23" height="17" style="--c:${colore}" aria-hidden="true">${
      silhouetteForma(s, {w:20, h:14}, colore)}</svg>`;
  // Due gruppi e non uno, come nella barra in alto: nove forme in fila sarebbero
  // un muro, e soprattutto territori e costruzioni sono due domande diverse —
  // "quanto è largo questo pezzo di mondo" e "che cosa ci si costruisce".
  const forme = terr => Object.entries(SHAPES).filter(([,s])=>!!s.territorio===terr).map(([k,s])=>{
    const col = SHAPE_COLORS[k]||"var(--teal)";
    return chip("shape", k, s.label, col, icoForma(s, col));
  }).join("");
  const segnalini = ["quest","encounter","png","nota","token"].map(t=>
    chip("marker", t, TYPES[t].label, TYPES[t].color, icoSegnalino(t, 14))).join("");
  const palette = `<div class="empty-pal">
    <div class="ep-group"><span class="ep-lab">Territorio</span>${forme(true)}</div>
    <div class="ep-group"><span class="ep-lab">Luoghi</span>${forme(false)}</div>
    <div class="ep-group"><span class="ep-lab">Segnalini</span>${segnalini}</div>
  </div>`;

  if(st.path.length===1)
    return h("La campagna parte da qui.") +
           p("Ogni bolla è un pezzo di mondo o un luogo, e dentro può contenere un'altra mappa: "+
             "un mondo tiene continenti, una regione tiene città, una città tiene edifici. "+
             "Se questo livello è già troppo stretto, «⤢ Zoom indietro» qui sopra gli mette un mondo attorno.") +
           palette;
  return h("Questo livello è ancora vuoto.") +
         p("Mettici quello che vuoi: una stanza, una quest, un encounter. Scegli qui, trascina dalla barra in alto, o fai doppio clic sulla tela.") +
         palette;
}

export function renderCanvas(){
  const svg = planSvg();
  const cur = currentNode();
  ensureLayout(cur);
  // Un livello con dei muri non è vuoto: chi ha cominciato a tirare su un
  // perimetro non deve vedersi tornare davanti l'invito a creare la prima bolla.
  const vuoto = cur.children.length===0 && wallSegsOf(cur).length===0 && corridoiDi(cur).length===0;
  const emptyEl = document.getElementById("empty-node");
  emptyEl.classList.toggle("show", vuoto);
  if(vuoto) emptyEl.innerHTML = emptyNodeMarkup();
  const hint = document.getElementById("plan-hint");
  hint.style.display = cur.children.length || armedPal ? "" : "none";
  hint.textContent = planHintText();

  planVB = planVBs[cur.id] || null;
  if(!planVB) planFit(); else planApplyVB();

  /* La maglia è quella del livello (vedi maglia() qui sopra), e in combattimento si
     alza il contrasto: lì la griglia smette di essere una carta da parati e
     diventa la regola con cui si misurano portata e movimento. */
  const inBattaglia = battleOn();
  svg.classList.toggle("battaglia", inBattaglia);
  /* Il tassello lo decide la maglia del livello (tasselloMaglia in modello.js):
     quadretti o esagoni, e del lato che il DM ha scelto. La copia chiara sopra
     lo sfondo è lo stesso percorso spostato di un pixel, come la linea doppia
     dei quadretti. */
  const t = tasselloMaglia(maglia());
  let out = `<defs>
    <pattern id="grid" width="${t.w}" height="${t.h}" patternUnits="userSpaceOnUse">
      <path d="${t.d}" fill="none" stroke-width="${inBattaglia?1.4:1}"
        style="stroke:${inBattaglia?"color-mix(in srgb, var(--fen) 26%, transparent)":"var(--grid)"}"/>
    </pattern>
    <pattern id="grid-bg" width="${t.w}" height="${t.h}" patternUnits="userSpaceOnUse">
      <path d="${t.d}" fill="none" stroke="rgba(0,0,0,${inBattaglia?.55:.4})" stroke-width="1"/>
      <path d="${t.d}" transform="translate(1 1)" fill="none" stroke="rgba(255,255,255,${inBattaglia?.45:.3})" stroke-width="1"/>
    </pattern>
  </defs>
  <rect x="${planVB.x-6000}" y="${planVB.y-6000}" width="14000" height="14000" fill="url(#grid)" data-bg="1"/>`;

  // sfondo immagine del livello (mappa disegnata sotto le bolle)
  if(cur.bg && cur.bg.img){
    out += `<image id="bg-img" href="${cur.bg.img}" x="${cur.bg.x}" y="${cur.bg.y}" width="${cur.bg.w}" height="${cur.bg.h}"
      opacity="${cur.bg.opacity ?? 0.6}" preserveAspectRatio="none"
      style="pointer-events:${bgEdit ? "auto" : "none"};cursor:${bgEdit ? "move" : "default"}"/>`;
    /* La maglia si ridisegna SOPRA lo sfondo: su una mappa caricata è la scala
       con cui si misurano le distanze, e sotto l'immagine spariva. Il
       rettangolo `data-bg` qui sopra resta dov'è perché è lui a ricevere i
       clic sullo sfondo; questa copia è solo disegno, quindi non prende
       eventi — sennò in "Sposta/Ridim." coprirebbe l'immagine da trascinare.
       Il tratto non è `--grid`: quello è tarato sul fondo della tela (9%
       dell'accento) e su un'immagine sparisce. Sopra una mappa di colore
       qualunque regge solo una linea doppia, scura più chiara — per questo
       non segue il tema, come il colore scelto dal DM per una bolla. */
    out += `<rect id="bg-grid" x="${cur.bg.x}" y="${cur.bg.y}" width="${cur.bg.w}" height="${cur.bg.h}"
      fill="url(#grid-bg)" pointer-events="none"/>`;
    if(bgEdit) out += `
      <rect id="bg-frame" x="${cur.bg.x}" y="${cur.bg.y}" width="${cur.bg.w}" height="${cur.bg.h}"
        fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="8 6" pointer-events="none"/>
      <rect id="bg-handle" x="${cur.bg.x+cur.bg.w-14}" y="${cur.bg.y+cur.bg.h-14}" width="28" height="28" rx="5"
        fill="var(--gold)" stroke-width="2" style="stroke:var(--bog);cursor:nwse-resize"/>`;
  }

  /* I corridoi dipinti: sopra lo sfondo e sotto tutto il resto, e senza
     eventi — è la superficie su cui si posa, non una cosa da prendere. C'è
     sempre, anche vuoto: il pennello lo aggiorna per id mentre si trascina,
     senza ridisegnare la tela sotto il dito. */
  out += `<path id="corridoi" class="corridoi" d="${sagomaCorridoi(maglia(), corridoiDi(cur))}" pointer-events="none"/>`;

  // collegamenti del livello corrente
  for(const e of (cur.edges||[])){
    const a=childOf(e.a), b=childOf(e.b); if(!a||!b) continue;
    const t=EDGE_TYPES[e.type]||EDGE_TYPES.strada;
    const {d, meta} = geoArco(e, a, b), mx = meta.x, my = meta.y, sel = st.selectedEdgeId===e.id;
    out += `<g class="edge${sel?" sel":""}" data-edge="${e.id}" tabindex="0" role="button" aria-pressed="${sel}"
      aria-label="${escapeAttr(`${t.label}: ${a.title||"senza nome"} – ${b.title||"senza nome"}${e.label?` (${e.label})`:""}`)}">
      <path class="edge-hit" d="${d}"/>
      <path class="edge-line" d="${d}" fill="none"
        style="stroke:${t.stroke}" stroke-width="${t.w}"${t.dash?` stroke-dasharray="${t.dash}"`:""} stroke-linecap="round" stroke-linejoin="round"/>`;
    if(t.double)
      out += `<path d="${d}" fill="none" style="stroke:var(--bog)" stroke-width="2" pointer-events="none"/>`;
    if(t.blocked)
      out += `<g style="stroke:${t.stroke}" stroke-width="4" stroke-linecap="round" pointer-events="none">
        <line x1="${mx-9}" y1="${my-9}" x2="${mx+9}" y2="${my+9}"/>
        <line x1="${mx-9}" y1="${my+9}" x2="${mx+9}" y2="${my-9}"/></g>`;
    if(e.label)
      out += `<text x="${mx}" y="${my-12}" text-anchor="middle">${escapeHtml(e.label)}</text>`;
    out += `</g>`;
  }

  /* Muri liberi: sotto le bolle e i segnalini, sopra i collegamenti. È
     l'ordine del pavimento — un muro è architettura, ci si cammina in mezzo,
     quindi non deve mai coprire una pedina né rubarle il tocco. */
  for(const w of wallSegsOf(cur)){
    const sel = st.multiSelWalls.has(w.id) || st.selectedWallId===w.id;
    /* Le maniglie solo quando il muro è l'UNICA cosa selezionata: su una
       selezione multipla sarebbero due pallini per ogni muro, cioè una pianta
       illeggibile — e allungare un perimetro intero non vuol dire niente. */
    const solo = sel && st.multiSelWalls.size<=1 && st.multiSel.size===0;
    out += `<g class="wall-seg${sel?" sel":""}" data-wall="${w.id}" tabindex="0" role="button" aria-pressed="${sel}"
      aria-label="${escapeAttr(ariaMuro(w))}">${wallSegInner(w, solo)}</g>`;
  }

  // blocchi e segnalini
  const aperture = doorOpenings(cur);
  for(const c of cur.children){
    const col = nodeColor(c);
    const isSel = st.multiSel.has(c.id) || c.id===st.selectedId;
    const selCls = isSel ? " sel" : "";
    const shCls = (!RO && c.shared) ? " shared" : "";
    // tabindex/role/aria: le bolle si raggiungono con Tab; la selezione segue
    // il focus (vedi il focusin in initMappa) e aria-pressed la annuncia
    const a11y = `tabindex="0" role="button" aria-pressed="${isSel}" aria-label="${ariaBlk(c)}"`;
    if(c.type==="token"){
      const R = markerR(c), tcol = col, k = scalaSegnalino(c);
      // Una pedina collegata (a un PG o a un nemico) prende nome e PF dalla fonte:
      // sul campo e nella scheda c'è UN solo numero, non due che divergono.
      const link = tokenLink(c);
      const nome = link ? link.nome : (c.title||"");
      /* In combattimento il nome sotto la pedina sparisce: le celle sono larghe
         40px e i nomi no, quindi quattro goblin adiacenti producevano
         "Goblin 1Goblin 2Goblin 3Goblin 4" sovrapposti e illeggibili. A
         identificarle restano le iniziali dentro il disco (G1, G2…), il
         tabellone d'iniziativa e l'aria-label — tre vie, nessuna collisione. */
      const ini = (nome||"?").trim().split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "?";
      const pct = link && link.hpMax>0 ? Math.max(0, Math.min(1, link.hp/link.hpMax)) : null;
      const giu = link && link.hp<=0;
      const barra = pct===null ? "" :
        `<rect x="0" y="${R*2+3}" width="${R*2}" height="4" rx="2" style="fill:var(--panel-2)"/>
         <rect x="0" y="${R*2+3}" width="${(R*2*pct).toFixed(1)}" height="4" rx="2"
           style="fill:${pct>0.5?"var(--fen)":pct>0.25?"var(--gold)":"var(--ember)"}"/>`;
      out += `<g class="blk marker token${selCls}${shCls}${giu?" giu":""}" data-block="${c.id}" ${a11y} transform="translate(${c.x},${c.y})">
        <circle class="blk-shape" cx="${R}" cy="${R}" r="${R}" style="fill:${tcol};--c:var(--bog)"/>
        <text x="${R}" y="${R+4*k}" text-anchor="middle" style="font-size:${12*k}px;font-weight:700;fill:var(--bog)">${escapeHtml(ini)}</text>
        ${barra}
        ${inBattaglia ? "" :
          `<text x="${R}" y="${R*2+(pct===null?4:11)+11*k}" text-anchor="middle" style="font-size:${11*k}px;fill:var(--ink-dim)">${escapeHtml(nome)}</text>`}
        ${maniglia(c, R*2)}
      </g>`;
    }else if(isTesto(c)){
      /* Il testo va a capo da sé dentro un foreignObject: in SVG puro ogni riga
         sarebbe un <text> da misurare a mano. Il contenuto passa da testoRicco
         (escapa, poi aggiunge solo tag suoi) e grandezza e allineamento da
         testoSize/testoAllinea, che li riducono a valori noti — sono le sole
         cose del documento che entrano qui. Vuota, la casella dice cosa
         aspetta invece di sparire: una cornice trasparente non si ritrova.
         Con "Adatta alla casella" la grandezza vera la misura adattaCaratteri
         dopo il disegno; qui si usa l'ultima misurata, per non sfarfallare. */
      const box = nodeBox(c);
      const fit = testoAdatta(c) && c.notes;
      const px = fit ? (misureFit.get(c.id)?.px ?? testoSize(c)) : testoSize(c);
      const txt = c.notes ? testoRicco(c.notes) : `<span class="testo-vuoto">Scrivi dal pannello…</span>`;
      out += `<g class="blk testo${selCls}" data-block="${c.id}" ${a11y} transform="translate(${c.x},${c.y})">
        <rect class="blk-shape" width="${box.w}" height="${box.h}" rx="4" style="--c:${col}"/>
        <foreignObject width="${box.w}" height="${box.h}" pointer-events="none">
          <div xmlns="http://www.w3.org/1999/xhtml" class="testo-txt${fit?" testo-fit":""}" style="font-size:${px}px;color:${col};text-align:${testoAllinea(c)}">${txt}</div>
        </foreignObject>
        ${c.id===st.selectedId && st.multiSel.size<=1 ? `<rect class="rs-handle" x="${box.w-8}" y="${box.h-8}" width="16" height="16" rx="3"/>`:""}
      </g>`;
    }else if(isMarker(c)){
      const R = markerR(c), k = scalaSegnalino(c);
      // Lo scudo ha il baricentro più in alto del disco: l'iniziale sale con lui.
      const yIni = R + (TYPES[c.type]?.sagoma === "scudo" ? 2 : 4) * k;
      out += `<g class="blk marker${selCls}${shCls}" data-block="${c.id}" ${a11y} transform="translate(${c.x},${c.y})">
        ${sagomaSegnalino(c.type, R*2, `style="--c:${col}"`)}
        <text x="${R}" y="${yIni}" text-anchor="middle" style="font-size:${12*k}px;fill:${col};font-weight:700">${(TYPES[c.type]||TYPES.nota).label[0]}</text>
        <text x="${R}" y="${R*2+4+11*k}" text-anchor="middle" style="font-size:${11*k}px;fill:var(--ink-dim)">${escapeHtml(c.title||"")}</text>
        ${c.status?statusDot(R*2-2,3,c.status):""}
        ${c.children.length?`<text x="${R}" y="${R*2+6+22*k}" text-anchor="middle" style="font-size:${9*k}px;fill:var(--ink-dim)">◦ ${c.children.length}</text>`:""}
        ${!RO && haScheda(c) ? schedaMarkup(c, col) : ""}
        ${canEditEdges()?`<circle class="link-handle" cx="${R*2}" cy="0" r="8"/>`:""}
        ${maniglia(c, R*2)}
      </g>`;
    }else{
      const box = nodeBox(c);
      if(c.children.length) ensureLayout(c);
      /* Tutto ciò che si LEGGE sta nel riquadro del contenuto — titolo,
         anteprima, conteggio, pallino di stato — che su una sagoma inscritta è
         più stretto del riquadro della bolla. Le due maniglie no, e restano agli
         angoli: sono comandi, e un comando spostato sul contorno vero di un
         rombo diventa più difficile da prendere proprio dove il rombo è più
         piccolo. Il contorno che si vede non è il loro bersaglio, e a dirlo è
         già il fatto che sporgono (la maniglia dei collegamenti sta a cx=box.w,
         cioè mezza fuori). */
      const dentro = contentBox(c, box);
      const cx = dentro.x + dentro.w/2, cy = dentro.y + dentro.h/2;
      const prev = miniPreview(c, dentro);
      /* Senza anteprima titolo e conteggio sono UNA coppia impilata al centro,
         non un titolo al centro e un conteggio in fondo: su un riquadro basso
         (una torre ne ha 40px) il fondo cade addosso al titolo. Il caso non
         nasce oggi — bastava una bolla ridimensionata sotto i 48px — ma con le
         sagome inscritte lo raggiunge una torre delle dimensioni sue. */
      const yTitolo = prev ? dentro.y+18 : cy + (c.children.length ? -4 : 5);
      const yConta  = prev ? dentro.y+dentro.h-8 : cy+12;
      out += `<g class="blk${selCls}${shCls}" data-block="${c.id}" ${a11y} transform="translate(${c.x},${c.y})">
        ${shapeMarkup(c, box, col, aperture.get(c.id))}
        ${prev}
        <text x="${cx}" y="${yTitolo}" text-anchor="middle">${escapeHtml(c.title||"")}</text>
        ${c.children.length?`<text x="${cx}" y="${yConta}" text-anchor="middle" style="font-size:10px;fill:var(--ink-dim)">◦ ${c.children.length}</text>`:""}
        ${c.status?statusDot(dentro.x+dentro.w-4,dentro.y+4,c.status):""}
        ${canEditEdges()?`<circle class="link-handle" cx="${box.w}" cy="0" r="9"/>`:""}
        ${c.id===st.selectedId && st.multiSel.size<=1 ? `<rect class="rs-handle" x="${box.w-8}" y="${box.h-8}" width="16" height="16" rx="3"/>`:""}
      </g>`;
    }
  }
  // innerHTML distrugge l'elemento a fuoco: senza il ripristino, ogni freccia
  // premuta (che ri-renderizza) butterebbe l'utente tastiera fuori dalla mappa
  const af = document.activeElement;
  const focusSel = af && svg.contains(af)
    ? (af.closest(".blk") ? `.blk[data-block="${af.closest(".blk").dataset.block}"]`
     : af.closest(".edge") ? `.edge[data-edge="${af.closest(".edge").dataset.edge}"]` : null)
    : null;

  svg.innerHTML = out + `<polyline id="plan-temp" fill="none" stroke="var(--fen-dim)" stroke-width="3" stroke-dasharray="6 6" stroke-linejoin="round" stroke-linecap="round" visibility="hidden" pointer-events="none"/>
    <line id="guide-v" stroke="var(--gold)" stroke-width="1" stroke-dasharray="4 4" visibility="hidden" pointer-events="none"/>
    <line id="guide-h" stroke="var(--gold)" stroke-width="1" stroke-dasharray="4 4" visibility="hidden" pointer-events="none"/>`;

  adattaCaratteri(cur);
  adattaSchede(cur);
  riposizionaScrittura();

  if(focusSel){
    const el = svg.querySelector(focusSel);
    // il focus() di ripristino non deve ri-selezionare (ciclo col focusin)
    if(el){ suppressFocusSel = true; el.focus(); suppressFocusSel = false; }
  }
}

/* L'altezza di una casella di testo: la decide il DM tirando l'angolo, ma
   non può scendere sotto il testo — tagliare l'ultima riga di un appunto è
   il modo di perderlo. Fino al 24 set 2026 la decideva SOLO il testo, e una
   casella non si poteva allungare per farci stare una pergamena: ora cresce
   se il testo non ci sta e resta com'è se ce n'è d'avanzo. Si misura sulla
   resa vera, l'unica a sapere dove il testo va a capo; per questo si chiama
   DOPO un renderCanvas, e ne fa un secondo solo se l'altezza è cambiata.
   Con "Adatta alla casella" non c'è niente da fare: lì è il carattere a
   cambiare (adattaCaratteri). */
export function adattaTesto(n){
  if(testoAdatta(n) && n.notes) return;
  const el = planSvg().querySelector(`.blk.testo[data-block="${n.id}"] .testo-txt`);
  if(!el) return;
  el.style.height = "auto";
  const h = Math.max(40, Math.ceil(el.offsetHeight / 10) * 10);
  el.style.height = "";
  if(h > nodeBox(n).h){ n.h = h; renderCanvas(); }
}

/* "Adatta alla casella": il carattere più grande con cui il testo sta nella
   casella, in larghezza (niente parole spezzate: `.testo-fit` toglie
   overflow-wrap) e in altezza. Ricerca binaria sulla resa vera, quindi dopo
   il disegno e nello stesso fotogramma — niente sfarfallio. La misura si
   tiene in memoria per chiave (testo, riquadro, allineamento): la tela si
   ridisegna a ogni selezione, e rifarla ogni volta costerebbe per niente.
   Non entra nel documento: è una conseguenza, e dipende dai caratteri che
   ha il dispositivo. */
const misureFit = new Map();
function adattaCaratteri(cur){
  const svg = planSvg();
  for(const n of cur.children){
    // Anche le schede: "Adatta" vale per loro come per le caselle, e il
    // riquadro da riempire è quello della scheda, non il segnalino.
    const scheda = isMarker(n) && haScheda(n) && !RO;
    if(!(isTesto(n) || scheda) || !testoAdatta(n) || !n.notes || typeof n.x !== "number") continue;
    const b = scheda ? (s => ({w:s.w, h:altezzaScheda(n, s)}))(schedaDi(n)) : nodeBox(n);
    const chiave = `${b.w}x${b.h}|${testoAllinea(n)}|${n.status}|${n.notes}`;
    if(misureFit.get(n.id)?.chiave === chiave) continue;
    const el = svg.querySelector(`.blk[data-block="${n.id}"] .testo-txt`);
    if(!el) continue;
    const sta = px => { el.style.fontSize = px + "px";
      return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1; };
    let lo = 4, hi = 400;
    if(sta(hi)) lo = hi;
    else for(let i=0; i<14 && hi-lo > 0.5; i++){ const m = (lo+hi)/2; if(sta(m)) lo = m; else hi = m; }
    const px = Math.floor(lo*2)/2;
    el.style.fontSize = px + "px";
    misureFit.set(n.id, {chiave, px});
  }
}

const SNAP_DIST = 8;
function applySnap(n, exclude){
  const b = nodeBox(n);
  const others = currentNode().children.filter(c=>c!==n && typeof c.x==="number" && !(exclude && exclude.includes(c.id)));
  const myX=[n.x, n.x+b.w/2, n.x+b.w], myY=[n.y, n.y+b.h/2, n.y+b.h];
  let bestX=null, bestY=null, guideX=null, guideY=null;
  for(const o of others){
    const ob=nodeBox(o);
    const oxs=[o.x, o.x+ob.w/2, o.x+ob.w], oys=[o.y, o.y+ob.h/2, o.y+ob.h];
    for(let mi=0; mi<3; mi++) for(let oi=0; oi<3; oi++){
      const dx=oxs[oi]-myX[mi];
      if(Math.abs(dx)<=SNAP_DIST && (bestX===null||Math.abs(dx)<Math.abs(bestX))){ bestX=dx; guideX={x:oxs[oi], o}; }
      const dy=oys[oi]-myY[mi];
      if(Math.abs(dy)<=SNAP_DIST && (bestY===null||Math.abs(dy)<Math.abs(bestY))){ bestY=dy; guideY={y:oys[oi], o}; }
    }
  }
  if(bestX!==null) n.x += bestX;
  if(bestY!==null) n.y += bestY;
  return {guideX, guideY};
}
function drawGuides(n, g){
  const svg=planSvg();
  const gv=svg.querySelector("#guide-v"), gh=svg.querySelector("#guide-h");
  if(!n || !g){
    if(gv) gv.setAttribute("visibility","hidden");
    if(gh) gh.setAttribute("visibility","hidden");
    return;
  }
  const b=nodeBox(n);
  if(gv){
    if(g && g.guideX){ const o=g.guideX.o, ob=nodeBox(o);
      gv.setAttribute("x1",g.guideX.x); gv.setAttribute("x2",g.guideX.x);
      gv.setAttribute("y1",Math.min(n.y,o.y)-24); gv.setAttribute("y2",Math.max(n.y+b.h,o.y+ob.h)+24);
      gv.setAttribute("visibility","visible");
    } else gv.setAttribute("visibility","hidden");
  }
  if(gh){
    if(g && g.guideY){ const o=g.guideY.o, ob=nodeBox(o);
      gh.setAttribute("y1",g.guideY.y); gh.setAttribute("y2",g.guideY.y);
      gh.setAttribute("x1",Math.min(n.x,o.x)-24); gh.setAttribute("x2",Math.max(n.x+b.w,o.x+ob.w)+24);
      gh.setAttribute("visibility","visible");
    } else gh.setAttribute("visibility","hidden");
  }
}

/* dispone tutti i blocchi del livello in una griglia ordinata */
export function arrangeGrid(){
  const cur = currentNode();
  const items = [...cur.children.filter(c=>!isMarker(c)), ...cur.children.filter(isMarker)];
  if(!items.length) return;
  const GAP = 50, perRow = Math.max(2, Math.ceil(Math.sqrt(items.length)));
  let x=0, y=0, rowH=0;
  items.forEach((c,i)=>{
    const b = nodeBox(c);
    if(i%perRow===0 && i){ x=0; y+=rowH+GAP; rowH=0; }
    // Piante e simboli restano agganciati anche nell'ordinamento: il GAP di 50
    // assorbe lo spostamento (±20 max), quindi niente sovrapposizioni.
    const q = snapNode(c, x, y, maglia());
    c.x = q.x; c.y = q.y;
    x += b.w+GAP; rowH = Math.max(rowH, b.h);
  });
  save(); planFit(true); renderDetail();
}

export function addSpatialChild(opts, x, y){
  if(RO) return;
  const cur = currentNode();
  // Un muro non è una bolla e non entra in `children`: passa di qui perché è di
  // qui che passano i tre modi di posare una cosa (trascina, arma-e-tocca,
  // Invio dalla palette), e sdoppiarli avrebbe voluto dire tenerli allineati.
  if(opts.wall) return addWallSeg(x, y, opts.porta);
  if(opts.corridoi) return alternaCellaCorridoio(x, y);
  let c;
  if(opts.testo){ c = node("", "testo"); c.w = TESTO_BOX.w; c.h = TESTO_BOX.h; }
  else if(opts.marker) c = node("", opts.marker);
  else { c = node("", shapeType(opts.shape)); c.shape = opts.shape; }
  const mg = maglia();
  if(inScala(c, mg)){
    // Le forme architettoniche nascono già sulla maglia: sono piante in scala
    // (1 quadretto = 1,5 m), non simboli. Le dimensioni diventano esplicite e
    // in quadretti interi: i default di SHAPES restano quelli delle bolle
    // vecchie e non sono tutti multipli di cella.
    const d = nodeBox(c);
    c.w = Math.max(mg.cella, snapGrid(d.w, mg));
    c.h = Math.max(mg.cella, snapGrid(d.h, mg));
  }
  const b = nodeBox(c);
  // Nasce già agganciata, che sia una pianta o un simbolo: sennò il primo gesto
  // dopo l'aggiunta sarebbe sempre "trascinala per allinearla".
  if(onGrid(c, mg)){
    const q = snapNode(c, x-b.w/2, y-b.h/2, mg);
    c.x = q.x; c.y = q.y;
  }else{
    c.x = Math.round((x-b.w/2)/10)*10;
    c.y = Math.round((y-b.h/2)/10)*10;
  }
  cur.children.push(c);
  selectNode(c.id);
  save(); renderMap();
  // Una casella nuova è vuota e va scritta: è un'azione che chiede un campo,
  // quindi su telefono apre il foglio (le bolle no — lì si posa e basta).
  if(isTesto(c)) openDetailSheet();
  setTimeout(()=>{ const i=document.querySelector(isTesto(c) ? "#testo-area" : "#detail input"); if(i) i.focus(); }, 50);
}
/* Nasce lungo due quadretti e centrato sul punto toccato: uno solo è un
   trattino che non si capisce cos'è, e nascere con un capo sotto il dito
   costringerebbe a spostarlo prima ancora di guardarlo.
   Una porta invece nasce lunga UN quadretto, che è quanto è larga una porta:
   così la si posa e basta, invece di posare un muro, accorciarlo e poi
   dichiararlo. Nessun comando in più per riparare qualcosa che nasce storto. */
export function addWallSeg(x, y, porta){
  if(RO) return;
  const cur = currentNode();
  if(!Array.isArray(cur.wallSegs)) cur.wallSegs = [];
  const k = DOOR_TYPES[porta] ? porta : null;
  const mg = maglia();
  const w = newWallSeg(k ? x - mg.cella/2 : x - mg.cella, y, "h", k ? 1 : 2, mg);
  if(k) w.porta = k;
  cur.wallSegs.push(w);
  selectWall(w.id);
  save(); renderMap();
}
/* Muro pieno ⇄ porta: è un cambio di tipo, non un altro oggetto. Il segmento
   resta dov'è con la sua lunghezza — chi ha costruito il perimetro non deve
   rifarne un pezzo per metterci una porta. */
export function setWallDoor(id, kind){
  if(RO) return;
  const w = wallOf(id); if(!w) return;
  if(DOOR_TYPES[kind]) w.porta = kind; else delete w.porta;
  save(); renderCanvas(); renderDetail();
}
/* Il quadretto di un muro lungo su cui il DM ha toccato: lì "Metti qui"
   apre porta, varco o finestra spezzando il muro in tre. Con la penna i muri
   nascono lunghi un lato intero di stanza, e trasformare in porta tutto il
   lato non è quasi mai ciò che si vuole. Senza un tocco (selezione da
   tastiera) è il quadretto di mezzo. */
let cellaMuro = null;
export function cellaDelMuro(w, p){
  const C = maglia().cella, lungo = w.dir === "v" ? p.y - w.y : p.x - w.x;
  return Math.max(0, Math.min(w.len-1, Math.floor(lungo / C)));
}
export function toccaMuro(w, p){ cellaMuro = {id:w.id, k:cellaDelMuro(w, p)}; }
export function cellaToccata(w){
  return cellaMuro?.id === w.id ? Math.min(cellaMuro.k, w.len-1) : Math.floor((w.len-1)/2);
}
/* La porta resta un segmento intero (vedi DOOR_TYPES): qui il muro diventa
   fino a tre segmenti — prima, il vano da un quadretto, dopo — e le due parti
   laterali tengono il tipo che il muro aveva. */
export function inserisciNelMuro(id, kind){
  if(RO) return;
  const w = wallOf(id); if(!w) return;
  if(w.len < 2) return setWallDoor(id, kind);
  const k = cellaToccata(w), C = maglia().cella, prima = doorKind(w);
  const pezzo = (da, len, tipo) => {
    const s = {id:uid(), dir:w.dir, len,
               x: w.dir === "h" ? w.x + da*C : w.x, y: w.dir === "v" ? w.y + da*C : w.y};
    if(tipo) s.porta = tipo;
    return s;
  };
  const vano = pezzo(k, 1, DOOR_TYPES[kind] ? kind : null);
  const nuovi = [...(k > 0 ? [pezzo(0, k, prima)] : []), vano,
                 ...(k < w.len-1 ? [pezzo(k+1, w.len-1-k, prima)] : [])];
  const cur = currentNode();
  cur.wallSegs.splice(cur.wallSegs.indexOf(w), 1, ...nuovi);
  cellaMuro = null;
  selectWall(vano.id);
  save(); renderCanvas(); renderDetail();
}
export function deleteWallSeg(id){
  if(RO) return;
  togliMuri([id]);
  st.multiSelWalls.delete(id);
  if(st.selectedWallId===id) st.selectedWallId = [...st.multiSelWalls].at(-1) || null;
  save(); renderCanvas(); renderDetail();
}
/* Quello che nasce senza che tu abbia scelto una forma — doppio clic sulla tela,
   ＋ da tastiera — è il gradino sotto il livello in cui sei (scalaDentro in
   modello.js): dentro un mondo un continente, dentro un edificio una stanza.
   Prima era una stanza sempre, a ogni livello: si vedeva poco finché il livello
   più largo era una città, ma dentro un mondo una stanza è una risposta assurda
   a un doppio clic. */
export const formaImplicita = () => {
  const cur = currentNode();
  return scalaDentro(cur.shape || defShape(cur));
};
export function quickAddCenter(){
  addAtCenter("shape", formaImplicita());
}

/* ---- la palette si porta dove serve, invece di aspettare che la si scorra ----
 *
 * La barra è ordinata dalla scala più larga alla più stretta (Territorio,
 * Luoghi, Pianta, Segnalini), che è l'ordine giusto per leggerla e il rovescio
 * esatto di quanto si usano le cose: un mondo si fonda una volta, le pedine si
 * posano tutta la sera. Misurato il 6 ago 2026 a 390px: la striscia è 1872px su
 * 370 visibili (20%, 2 voci su 16), Territorio è a 0 e **Segnalini a 1348px,
 * cioè 3,6 schermate** — il gruppo che serve nella stanza dove si gioca è il
 * più lontano di tutti.
 *
 * La correzione non toglie e non nasconde niente: allo scattare del livello la
 * palette **scorre da sé** sul gruppo che lì dentro serve. Nessun comando in
 * più (l'app sa già cosa nasce dove: è `formaImplicita`), nessun `order` in CSS
 * (sfaserebbe l'ordine visivo da quello di Tab) e nessuna voce sottratta —
 * sbagliare bersaglio costa una passata di dito, non un errore.
 *
 * A quale gruppo appartenga una forma **non è scritto qui**: si chiede alla
 * palette, che lo dichiara già col `.pal-title` che precede le sue pastiglie.
 * Un secondo elenco si sarebbe disallineato in silenzio, e il difetto — la
 * barra che scorre nel posto sbagliato — non fa fallire niente.
 */

/* Il livello per cui la palette è già allineata. `renderMap` gira a ogni
   selezione e a ogni battuta: senza questa guardia la barra scorrerebbe sotto
   il dito di chi la sta scorrendo a mano. Nella chiave c'è anche la modalità
   combattimento, perché accenderla cambia la risposta senza cambiare livello. */
let paletteAllineataSu = null;

function gruppoDellaPalette(pal, corrisponde){
  let titolo = null;
  // In ordine di documento e non per figli diretti: dal 22 set 2026 ogni
  // gruppo sta in un suo .pal-gruppo (le tendine della barra a menu).
  for(const el of pal.querySelectorAll(".pal-title, .pal-item")){
    if(el.classList.contains("pal-title")){ titolo = el; continue; }
    if(!el.classList.contains("pal-item")) continue;
    let dati; try{ dati = JSON.parse(el.dataset.pal); }catch(_){ continue; }
    if(corrisponde(dati)) return titolo;
  }
  return null;
}

/* Cosa si posa, di solito, dentro il livello `cur`. */
function serveNelLivello(cur){
  const forma = cur.shape || defShape(cur);
  /* Sotto la stanza la scala si ferma (`scalaDentro` torna ancora "stanza"),
     ma quel che si posa dentro una stanza non è un'altra stanza: è il pavimento
     — e a scontro acceso sono le pedine. È l'unica risposta che `formaImplicita`
     non sa dare, ed è anche il caso che conta di più: durante un combattimento
     la palette non si scorre. */
  return forma !== "stanza" ? d => d.shape === scalaDentro(forma)
       : cur.battle ? d => d.marker === "token"
       : d => d.wall;
}

/* Nella barra a menu la palette non scorre: è fatta di tendine chiuse. Lì la
   stessa risposta si dice segnando il gruppo che serve, ed è per questo che
   gira prima delle guardie di allineaPalette — che valgono solo per la
   striscia che scorre. Niente guardia sul livello: toglie e rimette una
   classe su quattro elementi. */
function segnaGruppoSuggerito(pal){
  if(RO || !pal) return;
  const titolo = gruppoDellaPalette(pal, serveNelLivello(currentNode()));
  for(const g of pal.querySelectorAll(".pal-gruppo"))
    g.classList.toggle("suggerito", !!titolo && g.contains(titolo));
}

export function allineaPalette(){
  const pal = document.getElementById("pal-scroll");
  segnaGruppoSuggerito(pal);
  /* Su scrivania `#pal-scroll` è `display:contents`, cioè non esiste come
     contenitore: `clientWidth` è 0 e non c'è niente da allineare, perché la
     barra va a capo e si vede tutta. Al tavolo la palette non c'è affatto. */
  if(RO || !pal || !pal.clientWidth || pal.scrollWidth <= pal.clientWidth) return;

  const cur = currentNode();
  const chiave = cur.id + (cur.battle ? "⚔" : "");
  if(chiave === paletteAllineataSu) return;
  paletteAllineataSu = chiave;

  const corrisponde = serveNelLivello(cur);
  const titolo = gruppoDellaPalette(pal, corrisponde);
  if(!titolo) return;

  // Nella barra a menu il titolo è nascosto e a vedersi è il bottone del gruppo.
  const bersaglio = titolo.offsetParent ? titolo : titolo.parentElement.querySelector(".pal-apri") || titolo;
  const lento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  pal.scrollTo({left: bersaglio.offsetLeft - pal.offsetLeft, behavior: lento ? "auto" : "smooth"});
}
/* Crea al centro della vista corrente. La usano i pulsanti dell'empty state:
   lì non c'è un punto scelto dall'utente, quindi il centro è l'unica posizione
   che non sorprende. */
export const centroVista = () => planVB ? {x:planVB.x+planVB.w/2, y:planVB.y+planVB.h/2} : {x:0, y:0};
export function addAtCenter(kind, key){
  const {x:cx, y:cy} = centroVista();
  addSpatialChild(kind==="marker" ? {marker:key} : {shape:key}, cx, cy);
}

/* --- interazioni (pointer events) --- */
let armedPal = null, armedEl = null;   // elemento della palette "armato": il prossimo tocco sulla mappa lo piazza
let suppressFocusSel = false;          // vero solo durante il focus() di ripristino dopo un render

// Un solo posto decide il testo del suggerimento: renderCanvas lo riscrive a ogni
// ridisegno, quindi salvarne una copia altrove sarebbe fragile.
function planHintText(){
  if(armedPal?.corridoi)
    return "Trascina per dipingere i corridoi · partendo da una cella dipinta la cancelli · Esc per finire";
  if(penneMuri(armedPal))
    return "Tieni premuto e trascina per tracciare i muri · un clic ne posa uno · Esc per finire";
  return armedPal
    ? "Tocca la mappa per piazzare · Esc per annullare"
    : "◉ trascina, oppure tocca un elemento della palette e poi la mappa · Doppio clic: entra o scrivi / nuova bolla · Ctrl+clic: selezione multipla · Canc: elimina · ?: scorciatoie";
}

/* ---------- il pennello dei corridoi ----------
   Il primo tocco decide cosa fa tutto il gesto: su una cella vuota dipinge, su
   una dipinta cancella. Un gesto che alterna cella per cella lascerebbe a
   scacchi un corridoio ripassato. Fra due campioni del puntatore si
   interpola, sennò un trascinamento veloce salta le celle. */
function iniziaPennello(p){
  const cur = currentNode();
  const celle = new Map(corridoiDi(cur).map(c=>[chiaveCella(c), c]));
  const prima = cellaCorridoio(maglia(), p.x, p.y);
  const drag = {mode:"corridoi", celle, cancella: celle.has(chiaveCella(prima)), ultimo:p, moved:false};
  applicaPennello(drag, [prima]);
  return drag;
}
function pennella(drag, p){
  const g = maglia(), a = drag.ultimo;
  const passi = Math.max(1, Math.ceil(Math.hypot(p.x-a.x, p.y-a.y) / (g.cella/3)));
  const celle = [];
  for(let k=1; k<=passi; k++)
    celle.push(cellaCorridoio(g, a.x + (p.x-a.x)*k/passi, a.y + (p.y-a.y)*k/passi));
  drag.ultimo = p;
  applicaPennello(drag, celle);
}
function applicaPennello(drag, celle){
  let cambiato = false;
  for(const c of celle){
    const k = chiaveCella(c);
    if(drag.cancella){ if(drag.celle.delete(k)) cambiato = true; }
    else if(!drag.celle.has(k) && drag.celle.size < CORRIDOI_MAX){ drag.celle.set(k, c); cambiato = true; }
  }
  if(!cambiato) return;
  const cur = currentNode();
  if(drag.celle.size) cur.corridoi = [...drag.celle.values()]; else delete cur.corridoi;
  drag.moved = true;
  document.getElementById("corridoi")?.setAttribute("d", sagomaCorridoi(maglia(), corridoiDi(cur)));
}
/* Dal trascinamento HTML5 della voce di palette: una cella sola, dove cade. */
function alternaCellaCorridoio(x, y){
  if(RO) return;
  iniziaPennello({x, y});
  save(); renderMap();
}

/* ---------- la penna dei muri ----------
   Con "Muro" armato, tenere premuto e trascinare traccia i muri dietro al
   puntatore: un segmento per ogni tratto dritto, e l'angolo cade dove il
   dito lascia l'asse di almeno un quadretto. Gli estremi sono incroci della
   maglia, come per ogni muro, quindi un tratto storto diventa una scala di
   segmenti invece di un muro obliquo che il formato non sa dire. Un clic
   secco posa il muro da due quadretti di sempre. Resta armata dopo un
   tratto, come il pennello dei corridoi: una stanza si fa in più tratti. */
function iniziaPenna(p){
  const mg = maglia();
  return {mode:"penna", angolo:{x:snapGrid(p.x, mg), y:snapGrid(p.y, mg)},
          dir:null, muro:null, moved:false, p0:p};
}
function penna(drag, p){
  const mg = maglia(), C = mg.cella;
  const q = {x:snapGrid(p.x, mg), y:snapGrid(p.y, mg)};
  const K = drag.angolo;
  if(drag.dir){
    const fuori = drag.dir === "h" ? Math.abs(q.y - K.y) : Math.abs(q.x - K.x);
    if(fuori >= C){
      const svolta = drag.dir === "h" ? {x:q.x, y:K.y} : {x:K.x, y:q.y};
      stendiMuro(drag, svolta);
      drag.muro = null; drag.dir = null; drag.angolo = svolta;
      return penna(drag, p);
    }
  }else{
    const dx = Math.abs(q.x - K.x), dy = Math.abs(q.y - K.y);
    if(Math.max(dx, dy) < C) return;
    drag.dir = dx >= dy ? "h" : "v";
  }
  stendiMuro(drag, q);
}
function stendiMuro(drag, q){
  const cur = currentNode(), C = maglia().cella, K = drag.angolo;
  const d = drag.dir === "h" ? q.x - K.x : q.y - K.y;
  const len = Math.min(WALL_MAX, Math.round(Math.abs(d) / C));
  if(!len){
    if(drag.muro){ togliMuri([drag.muro.id]); drag.muro = null; }
  }else{
    if(!drag.muro){
      if(wallSegsOf(cur).length >= CAMPAIGN_LIMITS.wallsPerNode) return;
      drag.muro = {id:uid(), x:K.x, y:K.y, dir:drag.dir, len};
      (cur.wallSegs ||= []).push(drag.muro);
    }
    const w = drag.muro;
    w.dir = drag.dir; w.len = len;
    w.x = drag.dir === "h" && d < 0 ? K.x - len*C : K.x;
    w.y = drag.dir === "v" && d < 0 ? K.y - len*C : K.y;
  }
  drag.moved = true;
  if(!drag.raf){
    drag.raf = true;
    requestAnimationFrame(()=>{ drag.raf = false; if(planDrag === drag) renderCanvas(); });
  }
}
const penneMuri = o => !!(o?.wall && !o.porta);

function armPal(el, opts){
  if(armedEl){ armedEl.classList.remove("armed"); armedEl.setAttribute("aria-pressed","false"); }
  armedEl = el || null;
  armedPal = el ? opts : null;
  if(armedEl){ armedEl.classList.add("armed"); armedEl.setAttribute("aria-pressed","true"); }
  const svg = planSvg();
  if(svg){
    svg.classList.toggle("arming", !!armedPal && !armedPal.corridoi);
    svg.classList.toggle("pennello", !!armedPal?.corridoi);
  }
  const hint = document.getElementById("plan-hint");
  if(hint){
    hint.textContent = planHintText();
    if(armedPal) hint.style.display = "";
  }
}

export function initMappa(){
  /* L'Esc che disarma la palette si ferma qui: proseguendo, le scorciatoie lo
     leggerebbero come "risali di un livello" — e col pennello, che si spegne
     proprio con Esc, ogni fine lavoro portava fuori dalla stanza dipinta. */
  addEventListener("keydown", ev=>{
    if(ev.key === "Escape" && armedPal){ armPal(null); ev.stopImmediatePropagation(); }
  });
  addEventListener("resize", ()=>{ if(document.getElementById("view-map").classList.contains("active")) renderCanvas(); });

  const svg = planSvg();

  svg.addEventListener("contextmenu", ev=>{
    ev.preventDefault();
    if(RO) return;                                   // il menu è fatto solo di comandi da DM
    showCtxFor(ev.target, ev.clientX, ev.clientY);
  });

  /* Le pastiglie dei segnalini sono scritte a mano in app.html, ma la loro
     icona no: è la sagoma della tela (sagomaSegnalino), messa qui al posto
     del pallino, così palette e mappa non possono dire due cose diverse. */
  document.querySelectorAll('#plan-toolbar .pal-item[data-pal*="marker"]').forEach(el=>{
    let tipo; try{ tipo = JSON.parse(el.dataset.pal).marker; }catch(_){ return; }
    el.querySelector(".type-badge")?.insertAdjacentHTML("afterend", icoSegnalino(tipo, 14));
    el.querySelector(".type-badge")?.remove();
  });
  document.querySelectorAll("#plan-toolbar .pal-item").forEach(el=>{
    el.addEventListener("dragstart", ev=>{
      ev.dataTransfer.setData("text/plain", el.dataset.pal);
      ev.dataTransfer.effectAllowed = "copy";
    });
    // Il drag HTML5 non esiste su touch: senza questo, da tablet metà della
    // palette (piazza, torre, token, segnalini) è irraggiungibile. Tocca l'elemento
    // per "armarlo", poi tocca la mappa dove vuoi metterlo. Vale anche col mouse.
    el.addEventListener("click", ()=>{
      let opts; try{ opts = JSON.parse(el.dataset.pal); }catch(_){ return; }
      armPal(el === armedEl ? null : el, opts);
    });
    // Da tastiera "arma e tocca" non ha senso (non c'è un secondo tocco):
    // Invio/Spazio piazza subito al centro della vista, come quickAddCenter.
    el.addEventListener("keydown", ev=>{
      if(ev.key!=="Enter" && ev.key!==" ") return;
      // stopPropagation: sennò l'Invio risale alle scorciatoie globali, che vedono
      // il blocco appena creato selezionato e ci entrano dentro
      ev.preventDefault(); ev.stopPropagation();
      let opts; try{ opts = JSON.parse(el.dataset.pal); }catch(_){ return; }
      // Il pennello non si "posa" al centro: da tastiera lo si accende e spegne.
      if(opts.corridoi){ armPal(el === armedEl ? null : el, opts); return; }
      armPal(null);
      const cx = planVB ? planVB.x+planVB.w/2 : 0, cy = planVB ? planVB.y+planVB.h/2 : 0;
      addSpatialChild(opts, cx, cy);
    });
  });

  // La selezione segue il focus da tastiera (Tab tra le bolle = clic). I due flag
  // escludono i focus non-Tab: quello indotto dal clic (già gestito dal pointerdown,
  // che con Ctrl fa altro) e quello di ripristino dopo un render.
  let pointerFocus = false;
  svg.addEventListener("pointerdown", ()=>{
    pointerFocus = true; setTimeout(()=>{ pointerFocus = false; });
  }, true);
  svg.addEventListener("focusin", ev=>{
    if(suppressFocusSel || pointerFocus || !ev.target.closest) return;
    const blkEl = ev.target.closest(".blk");
    const edgeEl = blkEl ? null : ev.target.closest(".edge");
    if(blkEl){
      const id = blkEl.dataset.block;
      // già parte della selezione: al massimo diventa l'àncora, senza sciogliere
      // una selezione multipla costruita col Ctrl+clic
      if(st.multiSel.has(id)){ if(st.selectedId!==id){ st.selectedId = id; renderDetail(); } return; }
      selectNode(id);
      renderCanvas(); renderDetail();
    }else if(edgeEl){
      const id = edgeEl.dataset.edge;
      if(st.selectedEdgeId===id) return;
      clearSel(); st.selectedEdgeId = id;
      renderCanvas(); renderDetail();
    }else if(ev.target.closest(".wall-seg")){
      const id = ev.target.closest(".wall-seg").dataset.wall;
      // già parte della selezione: al massimo diventa l'àncora, come per le bolle
      if(st.multiSelWalls.has(id)){ if(st.selectedWallId!==id){ st.selectedWallId = id; renderDetail(); } return; }
      selectWall(id);
      renderCanvas(); renderDetail();
    }
  });
  svg.addEventListener("dragover", ev=>{ ev.preventDefault(); ev.dataTransfer.dropEffect="copy"; });
  svg.addEventListener("drop", ev=>{
    ev.preventDefault();
    let opts; try{ opts = JSON.parse(ev.dataTransfer.getData("text/plain")); }catch(_){ return; }
    if(!opts || (!opts.shape && !opts.marker && !opts.wall && !opts.testo)) return;
    const p = planPoint(ev);
    addSpatialChild(opts, p.x, p.y);
  });

  // Nessun doppio clic su questa tela passa dall'evento nativo: il pointer capture
  // e i renderCanvas() a metà sequenza lo rendono inaffidabile. Si contano a mano
  // entrambi — sui blocchi con lastTap (nel pointerdown), sullo sfondo con
  // lastBgTap (nel pointerup).
  let lastTap = {id:null, t:0};
  const pointers = new Map();          // dita attive (per il pinch)
  let lpTimer = null, lpStart = null, lpFired = false;   // long-press = tasto destro
  let lastBgTap = null;                // doppio clic/tap sullo sfondo, rilevato a mano
  let lastPointerType = "mouse";
  /* Qui c'era un listener "dblclick" per il caso mouse: non è mai stato eseguito.
     Il pointerup sullo sfondo chiama renderCanvas(), che riscrive svg.innerHTML e
     distrugge il <rect> su cui era iniziato il pointerdown; senza quel nodo il
     browser non può sintetizzare il click, e senza click non c'è dblclick. È lo
     stesso inganno che questo file documenta poco più sotto per il focus da
     tastiera. Il ramo touch funzionava proprio perché il doppio tap se lo contava
     da solo: ora se lo conta per tutti (vedi lastBgTap nel pointerup). */

  svg.addEventListener("pointerdown", ev=>{
    if(ev.button===1){                          // tasto centrale: pan ovunque, anche sopra i blocchi
      ev.preventDefault();
      planDrag = {mode:"pan", sx:ev.clientX, sy:ev.clientY, vb:{...planVB}, moved:false};
      svg.style.cursor = "grabbing";
      svg.setPointerCapture(ev.pointerId);
      return;
    }
    if(ev.button===2) return;                   // il destro lo gestisce il contextmenu
    lastPointerType = ev.pointerType || "mouse";

    // Palette armata: questo tocco piazza e basta — anche sopra un blocco esistente,
    // altrimenti "arma e tocca" fallirebbe proprio dove la mappa è già piena.
    if(penneMuri(armedPal) && !RO && ev.isPrimary !== false){
      ev.preventDefault();
      clearTimeout(lpTimer); lpStart = null;
      planDrag = iniziaPenna(planPoint(ev));
      svg.setPointerCapture(ev.pointerId);
      return;
    }
    if(armedPal && !armedPal.corridoi){
      ev.preventDefault();
      const opts = armedPal;
      const p0 = planPoint(ev);
      armPal(null);
      addSpatialChild(opts, p0.x, p0.y);
      planDrag = null;
      return;
    }
    if(ev.pointerType==="touch"){
      pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
      if(pointers.size===2){                    // due dita: pinch-zoom + pan, annulla tutto il resto
        clearTimeout(lpTimer); lpStart=null;
        drawGuides(null,null);
        const t=document.getElementById("plan-temp"); if(t) t.setAttribute("visibility","hidden");
        const [a,b] = [...pointers.values()];
        // Il primo dito stava dipingendo: quel che ha dipinto resta, e va salvato
        // adesso, perché il rilascio di un pizzico non salva niente.
        if(planDrag && (planDrag.mode==="corridoi" || planDrag.mode==="penna") && planDrag.moved) save();
        planDrag = {mode:"pinch",
          d0: Math.max(1, Math.hypot(a.x-b.x, a.y-b.y)),
          c0: {x:(a.x+b.x)/2, y:(a.y+b.y)/2},
          vb0: {...planVB}};
        svg.setPointerCapture(ev.pointerId);
        return;
      }
      // long-press = menu contestuale (iOS non emette contextmenu)
      clearTimeout(lpTimer);
      lpStart = {x:ev.clientX, y:ev.clientY, target:ev.target};
      lpTimer = setTimeout(()=>{
        lpFired = true;
        planDrag = null;
        drawGuides(null,null);
        const t=document.getElementById("plan-temp"); if(t) t.setAttribute("visibility","hidden");
        showCtxFor(lpStart.target, lpStart.x, lpStart.y);
        lpStart = null;
      }, 550);
    }
    /* Pennello dei corridoi: prende ogni tocco, anche sopra bolle e muri —
       un corridoio arriva fino alla porta, cioè sotto il bordo della stanza.
       Resta acceso finché non lo si spegne (Esc o di nuovo la sua voce). */
    if(armedPal?.corridoi && !RO){
      ev.preventDefault();
      clearTimeout(lpTimer); lpStart = null;
      planDrag = iniziaPennello(planPoint(ev));
      svg.setPointerCapture(ev.pointerId);
      return;
    }
    const handle = RO ? null : ev.target.closest(".link-handle");
    const rsEl   = RO ? null : ev.target.closest(".rs-handle");
    const blkEl  = ev.target.closest(".blk");
    const edgeEl = ev.target.closest(".edge");
    const wallEl = ev.target.closest(".wall-seg");
    const wHandle = RO ? null : ev.target.closest(".wall-seg__handle");
    const p = planPoint(ev);
    if(bgEdit && !blkEl && !edgeEl){
      const cur = currentNode();
      if(ev.target.id==="bg-handle" && cur.bg){
        planDrag = {mode:"bgresize", ratio: cur.bg.h/Math.max(1,cur.bg.w), moved:false};
        svg.setPointerCapture(ev.pointerId);
        return;
      }
      if(ev.target.id==="bg-img" && cur.bg){
        planDrag = {mode:"bgmove", dx:p.x-cur.bg.x, dy:p.y-cur.bg.y, moved:false};
        svg.setPointerCapture(ev.pointerId);
        return;
      }
    }
    if(rsEl && blkEl){                          // ridimensionamento dall'angolo
      const n = childOf(blkEl.dataset.block); if(!n) return;
      // Due maniglie su un segnalino con la scheda: quella del simbolo cambia
      // la taglia, quella della scheda il riquadro del testo.
      planDrag = {mode:"resize", id:n.id, scheda:rsEl.classList.contains("rs-scheda"), moved:false, raf:false};
      svg.setPointerCapture(ev.pointerId);
      return;
    }
    if(blkEl && !handle){                       // doppio tocco sul blocco = entra
      const now = performance.now();
      if(lastTap.id===blkEl.dataset.block && now-lastTap.t<400){
        lastTap = {id:null, t:0};
        /* Dopo il pointerdown il browser sposta il focus sul gruppo toccato:
           aperta subito, la scrittura lo perderebbe in quello stesso istante
           e si richiuderebbe da sola. Il timeout la apre dopo. */
        const id = blkEl.dataset.block;
        ev.preventDefault();
        setTimeout(()=>enterNode(id));
        return;
      }
      lastTap = {id:blkEl.dataset.block, t:now};
    }
    /* I muri prima delle bolle: un muro sta sotto, quindi un tocco che lo
       raggiunge non ha trovato niente sopra. La selezione NON ri-disegna la
       tela — si accende la classe a mano e si tiene il nodo vivo sotto il
       puntatore, sennò il trascinamento morirebbe sul nascere (stessa trappola
       del doppio clic). Le maniglie compaiono al rilascio: mentre trascini non
       servono, e al secondo tocco ci sono. */
    if(wallEl && !RO){
      const w = wallOf(wallEl.dataset.wall);
      if(!w){ planDrag = null; return; }
      if(ev.ctrlKey || ev.metaKey){            // Ctrl+clic: aggiungi/rimuovi dalla selezione
        if(st.multiSelWalls.has(w.id)){
          st.multiSelWalls.delete(w.id);
          if(st.selectedWallId===w.id) st.selectedWallId = [...st.multiSelWalls].at(-1) || null;
        }else{
          st.multiSelWalls.add(w.id); st.selectedWallId = w.id;
        }
        st.selectedEdgeId = null;
        renderCanvas(); renderDetail();
        return;                                // niente drag col Ctrl, come per le bolle
      }
      // Un muro già nella selezione la tiene: sennò trascinare un perimetro
      // costruito col Ctrl+clic lo scioglierebbe al primo tocco.
      if(!st.multiSelWalls.has(w.id)) selectWall(w.id);
      st.selectedWallId = w.id; st.selectedEdgeId = null;
      toccaMuro(w, planPoint(ev));
      ridipingiSel();
      const g = dragGroup();
      planDrag = wHandle
        // Allungare è un gesto sul singolo muro: il gruppo non c'entra — un
        // perimetro che si allunga tutto insieme non vuol dire niente.
        ? {mode:"wallend", id:w.id, end:wHandle.dataset.end, moved:false}
        : {mode:"wallmove", id:w.id, dx:p.x-w.x, dy:p.y-w.y, moved:false,
           g, collapse: g.size>1};
      renderDetail();
      svg.setPointerCapture(ev.pointerId);
      return;
    }
    if(handle && blkEl && canEditEdges()){
      const n = childOf(blkEl.dataset.block), c = nodeCenter(n);
      /* Il collegamento segue la traccia del dito: dritto se la si tira
         dritta, col percorso disegnato se la si fa girare (vedi percorsi.js). */
      planDrag = {mode:"link", from:n.id, traccia:[c, p]};
      const t = document.getElementById("plan-temp");
      t.setAttribute("points", `${c.x},${c.y} ${p.x},${p.y}`);
      t.setAttribute("visibility","visible");
    }else if(blkEl){
      const n = childOf(blkEl.dataset.block);
      // L'àncora passa alla bolla, ma i muri già selezionati RESTANO: è così
      // che si costruisce una selezione mista col Ctrl+clic, e che la si
      // trascina tutta insieme afferrandone una bolla.
      st.selectedEdgeId = st.selectedWallId = null;
      if(ev.ctrlKey || ev.metaKey){            // Ctrl+clic: aggiungi/rimuovi dalla selezione
        if(st.multiSel.has(n.id)){
          st.multiSel.delete(n.id);
          if(st.selectedId===n.id) st.selectedId = [...st.multiSel].at(-1) || null;
        }else{
          st.multiSel.add(n.id); st.selectedId = n.id;
        }
        lastTap = {id:null, t:0};
        renderCanvas(); renderDetail();
        return;                                // niente drag col Ctrl
      }
      // Una bolla fuori dalla selezione la ridefinisce (muri compresi); una già
      // dentro la tiene, e il gruppo si muove tutto insieme.
      const giaSola = st.selectedId===n.id && st.multiSel.size<=1 && !st.multiSelWalls.size;
      if(!st.multiSel.has(n.id)) selectNode(n.id);
      st.selectedId = n.id;
      if(RO){ renderCanvas(); renderDetail(); return; }   // al tavolo si guarda, non si sposta
      const g = dragGroup();
      planDrag = {mode:"move", id:n.id, dx:p.x-n.x, dy:p.y-n.y, el:blkEl, moved:false,
                  g, collapse: g.size>1, giaSola};
      blkEl.classList.add("dragging");
      ridipingiSel();
      renderDetail();
    }else if(edgeEl){
      clearSel(); st.selectedEdgeId = edgeEl.dataset.edge;
      renderCanvas(); renderDetail();
      return;                                  // niente capture: la tela è stata ricostruita
    }else{
      planDrag = {mode:"pan", sx:ev.clientX, sy:ev.clientY, vb:{...planVB}, moved:false};
      svg.style.cursor = "grabbing";
    }
    if(planDrag) svg.setPointerCapture(ev.pointerId);
  });

  svg.addEventListener("pointermove", ev=>{
    if(pointers.has(ev.pointerId)) pointers.set(ev.pointerId, {x:ev.clientX, y:ev.clientY});
    if(lpStart && Math.abs(ev.clientX-lpStart.x)+Math.abs(ev.clientY-lpStart.y)>10){
      clearTimeout(lpTimer); lpStart = null;
    }
    if(!planDrag) return;
    const p = planPoint(ev);
    if(planDrag.mode==="corridoi"){
      pennella(planDrag, p);
    }else if(planDrag.mode==="penna"){
      penna(planDrag, p);
    }else if(planDrag.mode==="move"){
      const n = childOf(planDrag.id); if(!n) return;
      // Chi sta sulla maglia ci resta anche mentre lo si trascina, e per lui
      // niente allineamento magnetico alle altre bolle: tirerebbe fuori
      // quadretto proprio ciò che dev'esserci dentro. La maglia è già un
      // allineamento, e più forte — due simboli in due celle sono allineati per
      // costruzione, senza che nessuno debba centrare la guida.
      if(onGrid(n, maglia())){
        const q = snapNode(n, p.x-planDrag.dx, p.y-planDrag.dy, maglia());
        n.x = q.x; n.y = q.y;
        drawGuides(null, null);
      }else{
        n.x = Math.round((p.x-planDrag.dx)/10)*10;
        n.y = Math.round((p.y-planDrag.dy)/10)*10;
        const g = applySnap(n, planDrag.g.nodi); // allineamento magnetico (escluso il gruppo trascinato)
        drawGuides(n, g);
      }
      planDrag.moved = true;
      // L'àncora aggiorna i suoi DATI da sé (con la propria regola d'aggancio),
      // ma il suo <g> nel DOM no: moveGroupBy la salta apposta. La ridisegniamo
      // qui — come wallmove fa con aggiornaMuro sul muro àncora — sennò la bolla
      // trascinata resta ferma fino al rilascio, quando renderCanvas la ripiazza.
      if(planDrag.el) planDrag.el.setAttribute("transform",`translate(${n.x},${n.y})`);
      const s = planDrag.g.startN[n.id];
      moveGroupBy(planDrag.g, n.x - s.x, n.y - s.y, n.id);
      aggiornaArchiDi(planDrag.g.nodi);
    }else if(planDrag.mode==="wallmove" || planDrag.mode==="wallend"){
      const w = wallOf(planDrag.id); if(!w) return;
      if(planDrag.mode==="wallmove"){
        // Il muro corre sui bordi delle celle, quindi si aggancia agli INCROCI
        // della maglia (snapGrid) e non al centro come i segnalini.
        w.x = snapGrid(p.x-planDrag.dx, maglia());
        w.y = snapGrid(p.y-planDrag.dy, maglia());
        // Il resto della selezione segue: qui l'àncora è un muro, ma il gruppo
        // è lo stesso di quando si trascina una bolla.
        const s = planDrag.g.startW[w.id];
        moveGroupBy(planDrag.g, w.x - s.x, w.y - s.y, w.id);
        aggiornaArchiDi(planDrag.g.nodi);
      }else{
        stretchWallSeg(w, planDrag.end, p.x, p.y, maglia());
      }
      planDrag.moved = true;
      aggiornaMuro(w);
    }else if(planDrag.mode==="resize"){
      const n = childOf(planDrag.id); if(!n) return;
      const mg = maglia();
      if(planDrag.scheda){
        /* La scheda è centrata sotto il simbolo, quindi cresce dai due lati:
           la larghezza è il doppio della distanza dal centro. L'altezza tirata
           a mano è una scelta, e da lì il riquadro non segue più il testo. */
        const L = SCHEDA_LIMITI, cx = n.x + markerR(n);
        n.scheda = {
          w: Math.max(L.wMin, Math.min(L.max, Math.round(2*Math.abs(p.x-cx)/10)*10)),
          h: Math.max(L.hMin, Math.min(L.max, Math.round((p.y-n.y-cimaScheda(n))/10)*10)),
        };
      }else if(isMarker(n)){
        /* Un segnalino cresce a taglie intere: il lato tirato dal puntatore
           diventa il numero di quadretti più vicino. L'angolo in alto a
           sinistra sta fermo durante il gesto e al rilascio si riaggancia. */
        const lato = Math.max(p.x-n.x, p.y-n.y);
        const t = Math.max(1, Math.min(TAGLIA_MAX, Math.round((lato + 10) / CELL)));
        if(t === normalizzaTaglia(n.taglia)) return;
        if(t > 1) n.taglia = t; else delete n.taglia;
      }else if(inScala(n, mg)){
        n.w = Math.max(mg.cella, snapGrid(p.x-n.x, mg));
        n.h = Math.max(mg.cella, snapGrid(p.y-n.y, mg));
      }else{
        n.w = Math.max(40, Math.round((p.x-n.x)/10)*10);
        n.h = Math.max(30, Math.round((p.y-n.y)/10)*10);
      }
      planDrag.moved = true;
      if(!planDrag.raf){
        planDrag.raf = true;
        requestAnimationFrame(()=>{ if(planDrag && planDrag.mode==="resize"){ renderCanvas(); planDrag.raf=false; } });
      }
    }else if(planDrag.mode==="pinch"){
      if(pointers.size<2) return;
      const [a,b] = [...pointers.values()];
      const d1 = Math.max(1, Math.hypot(a.x-b.x, a.y-b.y));
      const c1 = {x:(a.x+b.x)/2, y:(a.y+b.y)/2};
      const f = planDrag.d0 / d1;
      const vb0 = planDrag.vb0;
      // Il punto della mappa che stava sotto il centro delle due dita
      // all'inizio deve restarci sotto: si calcola una volta sola.
      if(!planDrag.v0){
        const v = vistaPx(vb0);
        planDrag.v0 = {...v,
          wx: vb0.x - (v.W*v.s - vb0.w)/2 + (planDrag.c0.x - v.left)*v.s,
          wy: vb0.y - (v.H*v.s - vb0.h)/2 + (planDrag.c0.y - v.top)*v.s};
      }
      const {W, H, left, top, wx, wy} = planDrag.v0;
      const w = Math.min(30000, Math.max(200, vb0.w*f));
      const h = vb0.h * (w/vb0.w);
      const s1 = Math.max(w/W, h/H);
      planVB = {x: wx - (c1.x - left)*s1 + (W*s1 - w)/2, y: wy - (c1.y - top)*s1 + (H*s1 - h)/2, w, h};
      planApplyVB();
    }else if(planDrag.mode==="bgmove"){
      const cur = currentNode(); if(!cur.bg) return;
      cur.bg.x = Math.round(p.x - planDrag.dx);
      cur.bg.y = Math.round(p.y - planDrag.dy);
      planDrag.moved = true; updateBgAttrs();
    }else if(planDrag.mode==="bgresize"){
      const cur = currentNode(); if(!cur.bg) return;
      cur.bg.w = Math.max(120, Math.round(p.x - cur.bg.x));
      cur.bg.h = Math.max(80,  Math.round(cur.bg.w * planDrag.ratio));
      planDrag.moved = true; updateBgAttrs();
    }else if(planDrag.mode==="link"){
      const tr = planDrag.traccia, ult = tr.at(-1);
      planDrag.s ??= vistaPx().s;
      if(Math.hypot(p.x-ult.x, p.y-ult.y) >= 3*planDrag.s) tr.push(p);
      else tr[tr.length-1] = p;
      document.getElementById("plan-temp").setAttribute("points",
        tr.map(q=>`${Math.round(q.x)},${Math.round(q.y)}`).join(" "));
    }else if(planDrag.mode==="pan"){
      const scale = planDrag.s ??= vistaPx(planDrag.vb).s;
      planVB.x = planDrag.vb.x - (ev.clientX-planDrag.sx)*scale;
      planVB.y = planDrag.vb.y - (ev.clientY-planDrag.sy)*scale;
      if(Math.abs(ev.clientX-planDrag.sx)+Math.abs(ev.clientY-planDrag.sy)>4) planDrag.moved = true;
      planApplyVB();
    }
  });

  svg.addEventListener("pointerup", ev=>{
    pointers.delete(ev.pointerId);
    clearTimeout(lpTimer); lpStart = null;
    if(lpFired){ lpFired = false; planDrag = null; return; }
    if(planDrag && planDrag.mode==="pinch"){
      if(pointers.size<2) planDrag = null;
      return;
    }
    if(!planDrag) return;
    if(planDrag.mode==="corridoi"){
      if(planDrag.moved) save();
      renderCanvas();                           // stato vuoto, scala e "Adatta" contano i corridoi
    }else if(planDrag.mode==="penna"){
      if(planDrag.moved){ clearSel(); save(); renderMap(); }
      else{ const p0 = planDrag.p0; armPal(null); addWallSeg(p0.x, p0.y); }
    }else if(planDrag.mode==="link"){
      document.getElementById("plan-temp").setAttribute("visibility","hidden");
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".blk");
      if(under && under.dataset.block !== planDrag.from){
        const cur = currentNode();
        const a = planDrag.from, b = under.dataset.block;
        /* Ritracciare un collegamento che c'è già ne ridisegna il percorso
           (anche dritto): è il modo di correggerlo senza cancellarlo, e
           tipo, etichetta e note restano. */
        const dup = (cur.edges||[]).find(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
        const e = dup || {id:uid(), a, b, type:"strada", label:"", notes:""};
        const percorso = percorsoDaTraccia(planDrag.traccia, childOf(e.a), childOf(e.b), planDrag.from===e.b, svg);
        if(percorso.length) e.percorso = percorso; else delete e.percorso;
        if(!dup) cur.edges.push(e);
        clearSel(); st.selectedEdgeId = e.id;
        save();
      }
      renderCanvas(); renderDetail();
    }else if(planDrag.mode==="move"){
      planDrag.el.classList.remove("dragging");
      drawGuides(null, null);
      if(!planDrag.moved && planDrag.collapse){    // clic secco su un membro: selezione singola
        selectNode(planDrag.id);
        renderCanvas(); renderDetail();
      }else if(!planDrag.moved && !planDrag.giaSola){
        /* Le maniglie (angolo, scheda) compaiono sulla sola cosa selezionata,
           ma il pointerdown non ridisegna — deve tenere vivo il nodo sotto il
           puntatore — e fino al 25 set 2026 un clic secco le lasciava sulla
           bolla di prima finché qualcos'altro non ridisegnava. Al rilascio il
           nodo non serve più. Solo se la selezione è cambiata: un clic sulla
           bolla già scelta non costa un disegno. */
        renderCanvas();
      }
      if(planDrag.moved){
        // Il gruppo si muove rigido con l'ancora: se l'ancora era una bolla
        // libera, i membri agganciati sarebbero atterrati fuori quadretto.
        riagganciaGruppo(planDrag.g);
        save(); renderCanvas();
      }
    }else if(planDrag.mode==="wallmove" || planDrag.mode==="wallend"){
      if(!planDrag.moved && planDrag.collapse){    // clic secco: come per le bolle
        selectWall(planDrag.id);
      }
      if(planDrag.moved && planDrag.g) riagganciaGruppo(planDrag.g);
      if(planDrag.moved) save();
      // Il render qui serve: fa comparire le maniglie sul muro appena scelto.
      renderCanvas(); renderDetail();
    }else if(planDrag.mode==="resize"){
      const n = childOf(planDrag.id);
      if(n && isTesto(n)) adattaTesto(n);
      if(n && isMarker(n) && !planDrag.scheda){ const q = snapNode(n, n.x, n.y, maglia()); n.x = q.x; n.y = q.y; }
      if(planDrag.moved) save();
      renderCanvas(); renderDetail();
    }else if(planDrag.mode==="bgmove"||planDrag.mode==="bgresize"){
      if(planDrag.moved) save();
    }else if(planDrag.mode==="pan"){
      svg.style.cursor = "default";
      if(!planDrag.moved){
        {                                       // doppio clic/tap sullo sfondo = nuovo blocco
          // 500ms è la soglia del doppio clic di sistema; col mouse il puntatore
          // non si sposta, col dito sì, quindi la tolleranza resta quella del tocco.
          const now = performance.now();
          const finestra = lastPointerType==="touch" ? 350 : 500;
          if(lastBgTap && now-lastBgTap.t<finestra && Math.hypot(ev.clientX-lastBgTap.x, ev.clientY-lastBgTap.y)<30){
            lastBgTap = null;
            const pp = planPointXY(ev.clientX, ev.clientY);
            addSpatialChild({shape: formaImplicita()}, pp.x, pp.y);
            planDrag = null;
            return;
          }
          lastBgTap = {t:now, x:ev.clientX, y:ev.clientY};
        }
        st.detailOpen = false;
        clearSel(); renderCanvas(); renderDetail();
      }
    }
    planDrag = null;
  });

  svg.addEventListener("pointercancel", ev=>{
    pointers.delete(ev.pointerId);
    clearTimeout(lpTimer); lpStart = null; lpFired = false;
    if(planDrag && (planDrag.mode==="pinch" || pointers.size===0)) planDrag = null;
  });

  svg.addEventListener("wheel", ev=>{
    ev.preventDefault();
    const p = planPoint(ev);
    planZoom(ev.deltaY<0 ? 1.12 : 1/1.12, p.x, p.y);
  }, {passive:false});
}

/* ==================== sfondo della pianta ==================== */
export let bgEdit = false;
function updateBgAttrs(){
  const cur = currentNode(); if(!cur.bg) return;
  const svg = planSvg();
  const im = svg.querySelector("#bg-img");
  if(im){ im.setAttribute("x",cur.bg.x); im.setAttribute("y",cur.bg.y);
          im.setAttribute("width",cur.bg.w); im.setAttribute("height",cur.bg.h); }
  for(const sel of ["#bg-grid","#bg-frame"]){
    const r = svg.querySelector(sel); if(!r) continue;
    r.setAttribute("x",cur.bg.x); r.setAttribute("y",cur.bg.y);
    r.setAttribute("width",cur.bg.w); r.setAttribute("height",cur.bg.h);
  }
  const h = svg.querySelector("#bg-handle");
  if(h){ h.setAttribute("x",cur.bg.x+cur.bg.w-14); h.setAttribute("y",cur.bg.y+cur.bg.h-14); }
}
export function pickBg(){
  const inp = document.createElement("input");
  inp.type="file"; inp.accept="image/*";
  inp.onchange = ()=>{
    const f = inp.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{ compressImage(r.result, (data)=>{
      const img = new Image();
      img.onload = ()=>{
        const cur = currentNode();
        const w = planVB ? planVB.w*0.85 : 1000;
        const h = w * img.naturalHeight / Math.max(1, img.naturalWidth);
        cur.bg = {
          img: data,
          x: Math.round((planVB ? planVB.x+planVB.w/2 : 0) - w/2),
          y: Math.round((planVB ? planVB.y+planVB.h/2 : 0) - h/2),
          w: Math.round(w), h: Math.round(h), opacity: 0.6
        };
        bgEdit = true;
        save(); renderCanvas(); renderDetail();
      };
      img.src = data;
    }); };
    r.readAsDataURL(f);
  };
  inp.click();
}
export function removeBg(){
  const cur = currentNode();
  delete cur.bg; bgEdit = false;
  save(); renderCanvas(); renderDetail();
}
export function toggleBgEdit(){ bgEdit = !bgEdit; renderCanvas(); renderDetail(); }
export function setBgOpacity(v){
  const cur = currentNode(); if(!cur.bg) return;
  cur.bg.opacity = +v;
  const im = planSvg().querySelector("#bg-img");
  if(im) im.setAttribute("opacity", v);
  save();
}

/* ==================== la maglia del livello ====================
   Un campo alla volta (forma, lato in px, metri per cella), dal pannello del
   livello. Un numero fuori dai limiti del contratto non si scrive: il pannello
   si ridisegna col valore di prima invece di salvare un documento che il
   server rifiuterebbe con 422. Tornati esattamente al default il campo sparisce,
   così il documento resta com'era per chi la maglia non l'ha mai toccata.

   I segnalini seguono SUBITO la maglia nuova (un simbolo si sposta al massimo
   di mezza cella e non cambia dimensione — la stessa ragione per cui
   migrateState li centra al caricamento). Piante e muri no: ridimensionarli le
   farebbe accavallare, e si agganciano al primo tocco come sempre. */
export function impostaGriglia(chiave, valore){
  if(RO) return;
  const cur = currentNode();
  const g = {...grigliaDi(cur)};
  if(chiave==="forma"){
    if(!GRIGLIE[valore]) return;
    g.forma = valore;
  }else if(chiave==="cella" || chiave==="metri"){
    const v = parseFloat(String(valore).replace(",", "."));
    const L = GRID_LIMITS;
    const [min, max] = chiave==="cella" ? [L.cellaMin, L.cellaMax] : [L.metriMin, L.metriMax];
    if(!Number.isFinite(v) || v < min || v > max){ renderDetail(); return; }
    g[chiave] = v;
  }else return;
  if(g.forma===GRIGLIA_BASE.forma && g.cella===GRIGLIA_BASE.cella && g.metri===GRIGLIA_BASE.metri) delete cur.griglia;
  else cur.griglia = g;
  for(const c of cur.children)
    if(isMarker(c)){ const q = snapNode(c, c.x, c.y, g); c.x = q.x; c.y = q.y; }
  save(); renderMap();
}

/* ==================== vai a un nodo (ricerca, diario quest) ====================
   Storicamente si chiamava revealNode ed era SOVRASCRITTA dall'omonima funzione
   di condivisione al tavolo (tavolo.js): cliccare una quest nel diario toglieva
   la condivisione invece di navigare. Il nome diverso chiude il bug. */
function nodePathChain(id){          // catena di antenati (id) dalla radice, escluso il nodo stesso
  let found = null;
  (function walk(n, acc){
    if(found) return;
    if(n.id===id){ found = acc; return; }
    for(const c of n.children) walk(c, [...acc, n.id]);
  })(st.state.root, []);
  return found;
}
export function goToNode(id){
  if(id===st.state.root.id){ st.path=[st.state.root.id]; clearSel(); }
  else{
    const chain = nodePathChain(id);
    if(!chain) return;
    st.path = chain; selectNode(id);
  }
  showView("map"); renderMap();
  const n = findNode(id);
  if(n && typeof n.x==="number" && planVB){    // centra la vista sul nodo
    const c = nodeCenter(n);
    planVB = {x:c.x-planVB.w/2, y:c.y-planVB.h/2, w:planVB.w, h:planVB.h};
    planApplyVB();
  }
}

/* ==================== eliminazione e duplicazione della selezione ==================== */
export const isEmptyNode = n => n.children.length===0 && !(n.notes||"").trim() && !n.img;
export function doDeleteNodes(ids, muri = []){
  for(const id of ids){
    if(id===st.state.root.id) continue;
    const par = findParent(id);
    if(par && Array.isArray(par.edges)) par.edges = par.edges.filter(e=>e.a!==id && e.b!==id);
    removeNode(id, st.state.root);
  }
  if(muri.length) togliMuri(muri);
  clearSel();
  save(); renderMap();
}
// Togliere i muri dall'array è l'unico passo condiviso fra chi cancella una
// selezione e chi cancella il muro singolo dal pannello: il resto (conferme,
// che cosa ridisegnare) è diverso e resta ai chiamanti.
function togliMuri(ids){
  const cur = currentNode(), set = new Set(ids);
  cur.wallSegs = wallSegsOf(cur).filter(w=>!set.has(w.id));
}
export function requestDeleteSelection(){
  const muri = st.multiSelWalls.size ? [...st.multiSelWalls]
             : (st.selectedWallId ? [st.selectedWallId] : []);
  const ids = st.multiSel.size ? [...st.multiSel] : (st.selectedId ? [st.selectedId] : []);
  const nodes = ids.map(id=>findNode(id)).filter(n=>n && n.id!==st.state.root.id);
  /* I muri se ne vanno senza chiedere: non contengono niente, e rifarli è un
     trascinamento. La conferma serve dove si perde del lavoro dentro una bolla
     — quindi la fa scattare la selezione di bolle, non quella di muri. */
  if(!nodes.length){
    if(muri.length){ togliMuri(muri); clearSel(); save(); renderMap(); }
    return;
  }
  if(nodes.every(isEmptyNode)){ doDeleteNodes(nodes.map(n=>n.id), muri); return; }
  // I muri della selezione vanno nominati: sparirebbero comunque, e una conferma
  // che non dice tutto quello che elimina è peggio di nessuna conferma.
  const eMuri = muri.length ? ` e ${muri.length} mur${muri.length===1?"o":"i"}` : "";
  openConfirm(nodes.length===1
    ? `Eliminare "${nodes[0].title||"bolla"}"${eMuri} e tutto il contenuto?`
    : `Eliminare ${nodes.length} bolle selezionate${eMuri} (e il loro contenuto)?`,
    ok=>{ if(ok) doDeleteNodes(nodes.map(n=>n.id), muri); });
}

/* Duplica TUTTA la selezione: le bolle, i muri, e i collegamenti fra le bolle
   duplicate. Prima copiava solo l'àncora anche con dieci bolle selezionate, e i
   muri non li copiava affatto — un perimetro si rifaceva un pezzo per volta. */
export function duplicateSelected(){
  if(RO) return;
  const cur = currentNode();
  const nodi = (st.multiSel.size ? [...st.multiSel] : (st.selectedId ? [st.selectedId] : []))
    .map(id=>childOf(id)).filter(Boolean);
  const muri = (st.multiSelWalls.size ? [...st.multiSelWalls]
              : (st.selectedWallId ? [st.selectedWallId] : []))
    .map(id=>wallOf(id)).filter(Boolean);
  if(!nodi.length && !muri.length) return;

  /* UNO scarto per tutto il gruppo, non uno per elemento: con scarti diversi
     (un quadretto per chi sta sulla maglia, 30px per gli altri) la copia di un
     gruppo misto usciva deformata rispetto all'originale. Basta che uno stia
     sulla maglia perché la maglia sia il denominatore comune — e i muri ci
     stanno sempre. */
  const mg = maglia();
  const suMaglia = (muri.length && !isHex(mg)) || nodi.some(n=>onGrid(n, mg));
  /* Sulla maglia lo scarto è un vettore di maglia (un passo a destra più uno
     in basso): in diagonale di un lato, negli esagoni, i segnalini
     uscirebbero dal centro. */
  const off = suMaglia
    ? (()=>{ const a = passoMaglia(mg,"ArrowRight"), b = passoMaglia(mg,"ArrowDown"); return {x:a.dx+b.dx, y:a.dy+b.dy}; })()
    : {x:30, y:30};

  const {copie: copieN, nodi: nuovoId} = duplicaNodi(nodi);
  copieN.forEach(copy=>{
    copy.x = (copy.x||0)+off.x; copy.y = (copy.y||0)+off.y;
    // Il "(copia)" solo quando se ne duplica una: su dieci bolle sarebbero dieci
    // titoli con la stessa coda, e a distinguerle basta che siano sfalsate.
    if(nodi.length===1) copy.title = (copy.title||"") + " (copia)";
    cur.children.push(copy);
  });
  /* I collegamenti fra le bolle duplicate: due stanze collegate, copiate
     insieme, devono restare collegate — sennò non è una copia del gruppo, sono
     due copie sciolte. Si itera su un'istantanea perché il ciclo scrive
     nell'array che sta leggendo. */
  for(const e of [...(cur.edges||[])]){
    if(!nuovoId.has(e.a) || !nuovoId.has(e.b)) continue;
    cur.edges.push({...e, id:uid(), a:nuovoId.get(e.a), b:nuovoId.get(e.b)});
  }
  if(!Array.isArray(cur.wallSegs)) cur.wallSegs = [];
  const copieW = muri.map(w=>{
    const c = {...w, id:uid(), x:w.x+off.x, y:w.y+off.y};
    cur.wallSegs.push(c);
    return c;
  });

  // La selezione passa alle copie: il gesto successivo (trascinare, rifare
  // Ctrl+D) riguarda quello che si è appena creato, non l'originale.
  clearSel();
  copieN.forEach(c=>st.multiSel.add(c.id));
  copieW.forEach(c=>st.multiSelWalls.add(c.id));
  if(copieN.length) st.selectedId = copieN[copieN.length-1].id;
  else st.selectedWallId = copieW[copieW.length-1].id;
  save(); renderMap();
}

/* La taglia dal pannello: il segnalino cresce attorno al proprio CENTRO, che
   è ciò che l'occhio segue (la maniglia sulla tela invece tiene fermo
   l'angolo, perché è l'angolo che il dito sta tirando). Poi si riaggancia. */
export function impostaTaglia(id, v){
  if(RO) return;
  const n = childOf(id); if(!n || !isMarker(n)) return;
  const t = normalizzaTaglia(v);
  if(typeof n.x === "number"){
    const r0 = markerR(n);
    if(t > 1) n.taglia = t; else delete n.taglia;
    const r1 = markerR(n);
    const q = snapNode(n, n.x + r0 - r1, n.y + r0 - r1, maglia());
    n.x = q.x; n.y = q.y;
  }else if(t > 1) n.taglia = t; else delete n.taglia;
  save(); renderCanvas(); renderDetail();
}

// per gli onclick inline nei template e nell'HTML statico
Object.assign(window, { enterNode, entra, impostaTaglia, jumpTo, planFit, planZoom, arrangeGrid, quickAddCenter, addAtCenter,
  pickBg, removeBg, toggleBgEdit, setBgOpacity, requestDeleteSelection, goToNode,
  deleteWallSeg, setWallDoor, inserisciNelMuro, impostaGriglia });

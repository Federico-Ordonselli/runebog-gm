/* La mappa spaziale: motore del viewBox, rendering SVG della tela, interazioni
   pointer (drag, pinch, long-press, collegamenti), sfondo del livello,
   navigazione tra livelli e operazioni sulla selezione. */

import { TYPES, SHAPES, SHAPE_COLORS, EDGE_TYPES, markerR, STATUS_COLORS, nodeColor,
         isMarker, defShape, nodeBox, nodeCenter, node, uid, escapeHtml, escapeAttr,
         gridShape, onGrid, snapGrid, snapNode,
         wallShape, wallBox, wallOpening, wallPlan, WALL,
         wallSegsOf, wallSegEnds, newWallSeg, stretchWallSeg,
         DOOR_TYPES, doorKind, wallLabel } from "./modello.js";
import { st, save, findNode, findParent, removeNode, currentNode, pathNodes, RO,
         clearSel, selectNode, selectWall } from "./stato.js";
import { showView, openConfirm } from "./viste.js";
import { renderDetail, compressImage } from "./pannello.js";
import { showCtxFor } from "./menu.js";
import { battleOn, tokenLink, renderBattleBar, CELL } from "./battaglia.js";

export function renderMap(){
  renderCrumbs();
  renderCanvas();
  renderDetail();
  renderBattleBar();     // vive fuori dalla tela: va aggiornata insieme, non da sola
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
  }
}

export function goUp(){
  if(st.path.length>1){
    selectNode(st.path[st.path.length-1]);
    st.path.pop(); renderMap();
  }
}

export function enterNode(id){
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
function planApplyVB(){
  planSvg().setAttribute("viewBox", `${planVB.x} ${planVB.y} ${planVB.w} ${planVB.h}`);
  planVBs[currentNode().id] = planVB;
}
export function planFit(rerender){
  const cur = currentNode();
  const kids = cur.children.filter(c=>typeof c.x==="number");
  // I muri contano quanto le bolle: un livello fatto solo di muri è un
  // battlemap, cioè il caso per cui i muri liberi esistono — e senza questo
  // "Adatta" gli dava la vista di default, come a un livello vuoto. Stessa
  // ragione per cui `vuoto` in renderCanvas li conta.
  const muri = wallSegsOf(cur);
  if(!kids.length && !muri.length){ planVB = {x:-600,y:-400,w:1200,h:800}; planApplyVB(); return; }
  let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  kids.forEach(c=>{ const b=nodeBox(c);
    x1=Math.min(x1,c.x); y1=Math.min(y1,c.y);
    x2=Math.max(x2,c.x+b.w); y2=Math.max(y2,c.y+b.h+20); });
  muri.forEach(w=>{ const e=wallSegEnds(w);
    x1=Math.min(x1,e.x1); y1=Math.min(y1,e.y1);
    x2=Math.max(x2,e.x2); y2=Math.max(y2,e.y2); });
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
/* Trasla tutto il gruppo tranne l'àncora, che l'ha già fatto per conto suo con
   la regola di aggancio che le compete. Rigido: chi finisce fuori dalla propria
   maglia ci rientra al rilascio (riagganciaGruppo) — è la regola che le bolle
   seguivano già, e i muri non ne introducono una seconda. */
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
  for(const id of g.nodi){
    const m = childOf(id); if(!m) continue;
    const q = snapNode(m); m.x = q.x; m.y = q.y;
  }
  for(const id of g.muri){
    const w = wallOf(id); if(!w) continue;
    w.x = snapGrid(w.x); w.y = snapGrid(w.y);
  }
}
/* Le linee dei collegamenti che toccano una bolla mossa: durante il gesto la
   tela non si ridisegna, quindi si spostano a mano. */
function aggiornaArchiDi(ids){
  const svg = planSvg(), cur = currentNode();
  (cur.edges||[]).forEach(e=>{
    if(!ids.includes(e.a) && !ids.includes(e.b)) return;
    const a=childOf(e.a), b=childOf(e.b); if(!a||!b) return;
    const A=nodeCenter(a), B=nodeCenter(b);
    const g = svg.querySelector(`.edge[data-edge="${e.id}"]`); if(!g) return;
    g.querySelectorAll(":scope > line").forEach(l=>{
      l.setAttribute("x1",A.x); l.setAttribute("y1",A.y);
      l.setAttribute("x2",B.x); l.setAttribute("y2",B.y);
    });
    const mx=(A.x+B.x)/2, my=(A.y+B.y)/2;
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
export const misuraMuro = w =>
  `${w.len} quadrett${w.len===1?"o":"i"} · ${String(w.len*1.5).replace(".", ",")} m`;
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
  const g = Math.min(JAMB, w.len*CELL/3);
  const ax = e.x1+ux*g, ay = e.y1+uy*g, bx = e.x2-ux*g, by = e.y2-uy*g;
  const luce = w.len*CELL - 2*g;                     // il vano fra i due stipiti
  let out = `<line class="wall-seg__line" x1="${e.x1}" y1="${e.y1}" x2="${ax}" y2="${ay}"/>
             <line class="wall-seg__line" x1="${bx}" y1="${by}" x2="${e.x2}" y2="${e.y2}"/>`;
  /* L'anta, come nelle piante: PARALLELA al muro se la porta è chiusa,
     PERPENDICOLARE se è spalancata. Il contrasto è di orientamento e non di
     colore, quindi si legge anche in scala di grigi — e soprattutto una porta
     aperta smette di essere un buco: il vano vuoto è già il modo di dire
     "varco", e le due cose devono restare distinguibili. Il verso in cui si
     apre non è un dato: l'anta sta sempre dallo stesso lato. */
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
  const e = wallSegEnds(w), kind = doorKind(w);
  let out = `<line class="wall-seg__hit" x1="${e.x1}" y1="${e.y1}" x2="${e.x2}" y2="${e.y2}"/>`;
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

function shapeMarkup(n, box, col, aperture){
  const s = SHAPES[n.shape||defShape(n)] || {};
  if(s.circle)  return `<ellipse class="blk-shape" cx="${box.w/2}" cy="${box.h/2}" rx="${box.w/2}" ry="${box.h/2}" style="--c:${col}"/>`;
  if(s.diamond) return `<polygon class="blk-shape" points="${box.w/2},0 ${box.w},${box.h/2} ${box.w/2},${box.h} 0,${box.h/2}" style="--c:${col}"/>`;
  const muri = wallShape(n) ? wallsMarkup(box, aperture||[]) : "";
  // una pianta ha angoli veri: il raccordo da 10px appartiene al simbolo, non al muro
  return `<rect class="blk-shape" width="${box.w}" height="${box.h}" rx="${muri?3:10}" style="--c:${col}"/>${muri}`;
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
    const A = nodeCenter(a), B = nodeCenter(b);
    for(const [n, P, Q] of [[a,A,B],[b,B,A]]){
      if(!wallShape(n)) continue;
      const o = wallOpening(wallBox(nodeBox(n)), Q.x-P.x, Q.y-P.y);
      if(!o) continue;
      o.secret = !!t.dmOnly;              // un passaggio segreto non buca il muro
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

/* Nome accessibile di una bolla: quello che un lettore di schermo annuncia
   arrivandoci con Tab. Tipo prima del titolo, come nel pannello di dettaglio. */
function ariaBlk(c){
  const link = c.type==="token" ? tokenLink(c) : null;
  let s = `${(TYPES[c.type]||TYPES.nota).label}: ${link ? link.nome : (c.title||"senza nome")}`;
  // I PF vanno detti, non solo disegnati: la barra sotto la pedina non esiste
  // per chi usa un lettore di schermo.
  if(link && link.hpMax>0) s += ` · ${link.hp} PF su ${link.hpMax}`;
  if(c.status) s += ` · ${c.status}`;
  if(c.children.length) s += ` · contiene ${c.children.length} element${c.children.length===1?"o":"i"}`;
  if(!RO && c.shared) s += " · visibile ai giocatori";
  return escapeAttr(s);
}

/* anteprima in miniatura del contenuto di un blocco (i "collegamenti fatti" visti da fuori) */
function miniPreview(n, box){
  const kids = n.children.filter(c=>typeof c.x==="number");
  if(!kids.length) return "";
  let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  kids.forEach(c=>{ const b=nodeBox(c);
    x1=Math.min(x1,c.x); y1=Math.min(y1,c.y);
    x2=Math.max(x2,c.x+b.w); y2=Math.max(y2,c.y+b.h); });
  const availW = box.w-22, availH = box.h-42;
  if(availW<26 || availH<20) return "";
  const k = Math.min(availW/Math.max(60,x2-x1), availH/Math.max(60,y2-y1));
  const ox = 11 + (availW-(x2-x1)*k)/2 - x1*k;
  const oy = 31 + (availH-(y2-y1)*k)/2 - y1*k;
  let out = `<g class="mini" pointer-events="none">`;
  for(const e of (n.edges||[])){
    const a = kids.find(c=>c.id===e.a), b = kids.find(c=>c.id===e.b);
    if(!a||!b) continue;
    const A=nodeCenter(a), B=nodeCenter(b), t=EDGE_TYPES[e.type]||EDGE_TYPES.strada;
    out += `<line x1="${A.x*k+ox}" y1="${A.y*k+oy}" x2="${B.x*k+ox}" y2="${B.y*k+oy}" style="stroke:${t.stroke}" stroke-width="1.8"${t.dash?` stroke-dasharray="3 3"`:""}/>`;
  }
  for(const c of kids){
    const col = nodeColor(c);
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
  const chip = (kind, key, label, colore, forma) => `
    <button class="ep-chip" onclick="addAtCenter('${kind}','${key}')" title="Aggiungi: ${label}">
      <span class="ep-ico ${forma}" style="--c:${colore}"></span>${label}
    </button>`;
  const bolle = Object.entries(SHAPES).map(([k,s])=>
    chip("shape", k, s.label, SHAPE_COLORS[k]||"var(--teal)",
         s.circle ? "tondo" : s.diamond ? "rombo" : "quadro")).join("");
  const segnalini = ["quest","encounter","png","nota","token"].map(t=>
    chip("marker", t, TYPES[t].label, TYPES[t].color, "punto")).join("");
  const palette = `<div class="empty-pal">
    <div class="ep-group"><span class="ep-lab">Bolle</span>${bolle}</div>
    <div class="ep-group"><span class="ep-lab">Segnalini</span>${segnalini}</div>
  </div>`;

  if(st.path.length===1)
    return h("La campagna parte da qui.") +
           p("Ogni bolla è una zona o un luogo, e dentro può contenere un'altra mappa. Scegli qui, trascina dalla barra in alto, o fai doppio clic sulla tela.") +
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
  const vuoto = cur.children.length===0 && wallSegsOf(cur).length===0;
  const emptyEl = document.getElementById("empty-node");
  emptyEl.classList.toggle("show", vuoto);
  if(vuoto) emptyEl.innerHTML = emptyNodeMarkup();
  const hint = document.getElementById("plan-hint");
  hint.style.display = cur.children.length ? "" : "none";
  hint.textContent = planHintText();

  planVB = planVBs[cur.id] || null;
  if(!planVB) planFit(); else planApplyVB();

  /* La maglia è sempre a CELL px (1 quadretto = 1,5 m), ma in combattimento si
     alza il contrasto: lì la griglia smette di essere una carta da parati e
     diventa la regola con cui si misurano portata e movimento. */
  const inBattaglia = battleOn();
  svg.classList.toggle("battaglia", inBattaglia);
  let out = `<defs>
    <pattern id="grid" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse">
      <path d="M${CELL} 0H0V${CELL}" fill="none" stroke-width="${inBattaglia?1.4:1}"
        style="stroke:${inBattaglia?"color-mix(in srgb, var(--fen) 26%, transparent)":"var(--grid)"}"/>
    </pattern>
  </defs>
  <rect x="${planVB.x-6000}" y="${planVB.y-6000}" width="14000" height="14000" fill="url(#grid)" data-bg="1"/>`;

  // sfondo immagine del livello (mappa disegnata sotto le bolle)
  if(cur.bg && cur.bg.img){
    out += `<image id="bg-img" href="${cur.bg.img}" x="${cur.bg.x}" y="${cur.bg.y}" width="${cur.bg.w}" height="${cur.bg.h}"
      opacity="${cur.bg.opacity ?? 0.6}" preserveAspectRatio="none"
      style="pointer-events:${bgEdit ? "auto" : "none"};cursor:${bgEdit ? "move" : "default"}"/>`;
    if(bgEdit) out += `
      <rect id="bg-frame" x="${cur.bg.x}" y="${cur.bg.y}" width="${cur.bg.w}" height="${cur.bg.h}"
        fill="none" stroke="var(--gold)" stroke-width="2" stroke-dasharray="8 6" pointer-events="none"/>
      <rect id="bg-handle" x="${cur.bg.x+cur.bg.w-14}" y="${cur.bg.y+cur.bg.h-14}" width="28" height="28" rx="5"
        fill="var(--gold)" stroke-width="2" style="stroke:var(--bog);cursor:nwse-resize"/>`;
  }

  // collegamenti del livello corrente
  for(const e of (cur.edges||[])){
    const a=childOf(e.a), b=childOf(e.b); if(!a||!b) continue;
    const A=nodeCenter(a), B=nodeCenter(b), t=EDGE_TYPES[e.type]||EDGE_TYPES.strada;
    const mx=(A.x+B.x)/2, my=(A.y+B.y)/2, sel = st.selectedEdgeId===e.id;
    out += `<g class="edge${sel?" sel":""}" data-edge="${e.id}" tabindex="0" role="button" aria-pressed="${sel}"
      aria-label="${escapeAttr(`${t.label}: ${a.title||"senza nome"} – ${b.title||"senza nome"}${e.label?` (${e.label})`:""}`)}">
      <line class="edge-hit" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>
      <line class="edge-line" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"
        style="stroke:${t.stroke}" stroke-width="${t.w}"${t.dash?` stroke-dasharray="${t.dash}"`:""} stroke-linecap="round"/>`;
    if(t.double)
      out += `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" style="stroke:var(--bog)" stroke-width="2" pointer-events="none"/>`;
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
      const R = markerR(c), tcol = col;
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
        <text x="${R}" y="${R+4}" text-anchor="middle" style="font-size:12px;font-weight:700;fill:var(--bog)">${escapeHtml(ini)}</text>
        ${barra}
        ${inBattaglia ? "" :
          `<text x="${R}" y="${R*2+(pct===null?15:22)}" text-anchor="middle" style="font-size:11px;fill:var(--ink-dim)">${escapeHtml(nome)}</text>`}
      </g>`;
    }else if(isMarker(c)){
      const R = markerR(c);
      out += `<g class="blk marker${selCls}${shCls}" data-block="${c.id}" ${a11y} transform="translate(${c.x},${c.y})">
        <circle class="blk-shape" cx="${R}" cy="${R}" r="${R}" style="--c:${col}"/>
        <text x="${R}" y="${R+4}" text-anchor="middle" style="font-size:12px;fill:${col};font-weight:700">${(TYPES[c.type]||TYPES.nota).label[0]}</text>
        <text x="${R}" y="${R*2+15}" text-anchor="middle" style="font-size:11px;fill:var(--ink-dim)">${escapeHtml(c.title||"")}</text>
        ${c.status?statusDot(R*2-2,3,c.status):""}
        ${c.children.length?`<text x="${R}" y="${R*2+28}" text-anchor="middle" style="font-size:9px;fill:var(--ink-dim)">◦ ${c.children.length}</text>`:""}
        ${canEditEdges()?`<circle class="link-handle" cx="${R*2}" cy="0" r="8"/>`:""}
      </g>`;
    }else{
      const box = nodeBox(c);
      if(c.children.length) ensureLayout(c);
      const prev = miniPreview(c, box);
      out += `<g class="blk${selCls}${shCls}" data-block="${c.id}" ${a11y} transform="translate(${c.x},${c.y})">
        ${shapeMarkup(c, box, col, aperture.get(c.id))}
        ${prev}
        <text x="${box.w/2}" y="${prev?18:box.h/2+5}" text-anchor="middle">${escapeHtml(c.title||"")}</text>
        ${c.children.length?`<text x="${box.w/2}" y="${box.h-8}" text-anchor="middle" style="font-size:10px;fill:var(--ink-dim)">◦ ${c.children.length}</text>`:""}
        ${c.status?statusDot(box.w-4,4,c.status):""}
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

  svg.innerHTML = out + `<line id="plan-temp" stroke="var(--fen-dim)" stroke-width="3" stroke-dasharray="6 6" visibility="hidden" pointer-events="none"/>
    <line id="guide-v" stroke="var(--gold)" stroke-width="1" stroke-dasharray="4 4" visibility="hidden" pointer-events="none"/>
    <line id="guide-h" stroke="var(--gold)" stroke-width="1" stroke-dasharray="4 4" visibility="hidden" pointer-events="none"/>`;

  if(focusSel){
    const el = svg.querySelector(focusSel);
    // il focus() di ripristino non deve ri-selezionare (ciclo col focusin)
    if(el){ suppressFocusSel = true; el.focus(); suppressFocusSel = false; }
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
    const q = snapNode(c, x, y);
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
  let c;
  if(opts.marker) c = node("", opts.marker);
  else { c = node("", opts.shape==="quartiere" ? "zona" : "luogo"); c.shape = opts.shape; }
  if(gridShape(c)){
    // Le forme architettoniche nascono già sulla maglia: sono piante in scala
    // (1 quadretto = 1,5 m), non simboli. Le dimensioni diventano esplicite e
    // in quadretti interi: i default di SHAPES restano quelli delle bolle
    // vecchie e non sono tutti multipli di cella.
    const d = nodeBox(c);
    c.w = Math.max(CELL, snapGrid(d.w));
    c.h = Math.max(CELL, snapGrid(d.h));
  }
  const b = nodeBox(c);
  // Nasce già agganciata, che sia una pianta o un simbolo: sennò il primo gesto
  // dopo l'aggiunta sarebbe sempre "trascinala per allinearla".
  if(onGrid(c)){
    const q = snapNode(c, x-b.w/2, y-b.h/2);
    c.x = q.x; c.y = q.y;
  }else{
    c.x = Math.round((x-b.w/2)/10)*10;
    c.y = Math.round((y-b.h/2)/10)*10;
  }
  cur.children.push(c);
  selectNode(c.id);
  save(); renderMap();
  setTimeout(()=>{ const i=document.querySelector("#detail input"); if(i) i.focus(); }, 50);
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
  const w = newWallSeg(k ? x - CELL/2 : x - CELL, y, "h", k ? 1 : 2);
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
export function deleteWallSeg(id){
  if(RO) return;
  togliMuri([id]);
  st.multiSelWalls.delete(id);
  if(st.selectedWallId===id) st.selectedWallId = [...st.multiSelWalls].at(-1) || null;
  save(); renderCanvas(); renderDetail();
}
export function quickAddCenter(){
  const opts = canEditEdges() ? {shape:"stanza"} : {shape:"quartiere"};
  addAtCenter(opts.shape ? "shape" : "marker", opts.shape || opts.marker);
}
/* Crea al centro della vista corrente. La usano i pulsanti dell'empty state:
   lì non c'è un punto scelto dall'utente, quindi il centro è l'unica posizione
   che non sorprende. */
export function addAtCenter(kind, key){
  const cx = planVB ? planVB.x+planVB.w/2 : 0, cy = planVB ? planVB.y+planVB.h/2 : 0;
  addSpatialChild(kind==="marker" ? {marker:key} : {shape:key}, cx, cy);
}

/* --- interazioni (pointer events) --- */
let armedPal = null, armedEl = null;   // elemento della palette "armato": il prossimo tocco sulla mappa lo piazza
let suppressFocusSel = false;          // vero solo durante il focus() di ripristino dopo un render

// Un solo posto decide il testo del suggerimento: renderCanvas lo riscrive a ogni
// ridisegno, quindi salvarne una copia altrove sarebbe fragile.
function planHintText(){
  return armedPal
    ? "Tocca la mappa per piazzare · Esc per annullare"
    : "◉ trascina, oppure tocca un elemento della palette e poi la mappa · Doppio clic: entra / nuova bolla · Ctrl+clic: selezione multipla · Canc: elimina · ?: scorciatoie";
}

function armPal(el, opts){
  if(armedEl){ armedEl.classList.remove("armed"); armedEl.setAttribute("aria-pressed","false"); }
  armedEl = el || null;
  armedPal = el ? opts : null;
  if(armedEl){ armedEl.classList.add("armed"); armedEl.setAttribute("aria-pressed","true"); }
  const svg = planSvg();
  if(svg) svg.classList.toggle("arming", !!armedPal);
  const hint = document.getElementById("plan-hint");
  if(hint) hint.textContent = planHintText();
}

export function initMappa(){
  addEventListener("keydown", ev=>{ if(ev.key === "Escape" && armedPal) armPal(null); });
  addEventListener("resize", ()=>{ if(document.getElementById("view-map").classList.contains("active")) renderCanvas(); });

  const svg = planSvg();

  svg.addEventListener("contextmenu", ev=>{
    ev.preventDefault();
    if(RO) return;                                   // il menu è fatto solo di comandi da DM
    showCtxFor(ev.target, ev.clientX, ev.clientY);
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
    if(!opts || (!opts.shape && !opts.marker && !opts.wall)) return;
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
    if(armedPal){
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
      planDrag = {mode:"resize", id:n.id, moved:false, raf:false};
      svg.setPointerCapture(ev.pointerId);
      return;
    }
    if(blkEl && !handle){                       // doppio tocco sul blocco = entra
      const now = performance.now();
      if(lastTap.id===blkEl.dataset.block && now-lastTap.t<400){
        lastTap = {id:null, t:0};
        enterNode(blkEl.dataset.block);
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
      planDrag = {mode:"link", from:n.id};
      const t = document.getElementById("plan-temp");
      t.setAttribute("x1",c.x); t.setAttribute("y1",c.y);
      t.setAttribute("x2",p.x); t.setAttribute("y2",p.y);
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
      if(!st.multiSel.has(n.id)) selectNode(n.id);
      st.selectedId = n.id;
      if(RO){ renderCanvas(); renderDetail(); return; }   // al tavolo si guarda, non si sposta
      const g = dragGroup();
      planDrag = {mode:"move", id:n.id, dx:p.x-n.x, dy:p.y-n.y, el:blkEl, moved:false,
                  g, collapse: g.size>1};
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
    if(planDrag.mode==="move"){
      const n = childOf(planDrag.id); if(!n) return;
      // Chi sta sulla maglia ci resta anche mentre lo si trascina, e per lui
      // niente allineamento magnetico alle altre bolle: tirerebbe fuori
      // quadretto proprio ciò che dev'esserci dentro. La maglia è già un
      // allineamento, e più forte — due simboli in due celle sono allineati per
      // costruzione, senza che nessuno debba centrare la guida.
      if(onGrid(n)){
        const q = snapNode(n, p.x-planDrag.dx, p.y-planDrag.dy);
        n.x = q.x; n.y = q.y;
        drawGuides(null, null);
      }else{
        n.x = Math.round((p.x-planDrag.dx)/10)*10;
        n.y = Math.round((p.y-planDrag.dy)/10)*10;
        const g = applySnap(n, planDrag.g.nodi); // allineamento magnetico (escluso il gruppo trascinato)
        drawGuides(n, g);
      }
      planDrag.moved = true;
      const s = planDrag.g.startN[n.id];
      moveGroupBy(planDrag.g, n.x - s.x, n.y - s.y, n.id);
      aggiornaArchiDi(planDrag.g.nodi);
    }else if(planDrag.mode==="wallmove" || planDrag.mode==="wallend"){
      const w = wallOf(planDrag.id); if(!w) return;
      if(planDrag.mode==="wallmove"){
        // Il muro corre sui bordi delle celle, quindi si aggancia agli INCROCI
        // della maglia (snapGrid) e non al centro come i segnalini.
        w.x = snapGrid(p.x-planDrag.dx);
        w.y = snapGrid(p.y-planDrag.dy);
        // Il resto della selezione segue: qui l'àncora è un muro, ma il gruppo
        // è lo stesso di quando si trascina una bolla.
        const s = planDrag.g.startW[w.id];
        moveGroupBy(planDrag.g, w.x - s.x, w.y - s.y, w.id);
        aggiornaArchiDi(planDrag.g.nodi);
      }else{
        stretchWallSeg(w, planDrag.end, p.x, p.y);
      }
      planDrag.moved = true;
      aggiornaMuro(w);
    }else if(planDrag.mode==="resize"){
      const n = childOf(planDrag.id); if(!n) return;
      if(gridShape(n)){
        n.w = Math.max(CELL, snapGrid(p.x-n.x));
        n.h = Math.max(CELL, snapGrid(p.y-n.y));
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
      const W = svg.clientWidth||1, H = svg.clientHeight||1;
      const vb0 = planDrag.vb0;
      const w = Math.min(30000, Math.max(200, vb0.w*f));
      const h = vb0.h * (w/vb0.w);
      const wx0 = vb0.x + (planDrag.c0.x/W)*vb0.w;
      const wy0 = vb0.y + (planDrag.c0.y/H)*vb0.h;
      planVB = {x: wx0 - (c1.x/W)*w, y: wy0 - (c1.y/H)*h, w, h};
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
      const t = document.getElementById("plan-temp");
      t.setAttribute("x2",p.x); t.setAttribute("y2",p.y);
    }else if(planDrag.mode==="pan"){
      const scale = planVB.w / svg.clientWidth;
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
    if(planDrag.mode==="link"){
      document.getElementById("plan-temp").setAttribute("visibility","hidden");
      const under = document.elementFromPoint(ev.clientX, ev.clientY)?.closest(".blk");
      if(under && under.dataset.block !== planDrag.from){
        const cur = currentNode();
        const a = planDrag.from, b = under.dataset.block;
        const dup = (cur.edges||[]).some(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
        if(!dup){
          const e = {id:uid(), a, b, type:"strada", label:"", notes:""};
          cur.edges.push(e);
          clearSel(); st.selectedEdgeId = e.id;
          save();
        }
      }
      renderCanvas(); renderDetail();
    }else if(planDrag.mode==="move"){
      planDrag.el.classList.remove("dragging");
      drawGuides(null, null);
      if(!planDrag.moved && planDrag.collapse){    // clic secco su un membro: selezione singola
        selectNode(planDrag.id);
        renderCanvas(); renderDetail();
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
      save(); renderCanvas(); renderDetail();
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
            addSpatialChild(canEditEdges()?{shape:"stanza"}:{shape:"quartiere"}, pp.x, pp.y);
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
  const fr = svg.querySelector("#bg-frame");
  if(fr){ fr.setAttribute("x",cur.bg.x); fr.setAttribute("y",cur.bg.y);
          fr.setAttribute("width",cur.bg.w); fr.setAttribute("height",cur.bg.h); }
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
  const off = muri.length || nodi.some(onGrid) ? CELL : 30;

  const nuovoId = {};                       // vecchio id → nuovo, per rimappare gli archi
  const copieN = nodi.map(src=>{
    const copy = JSON.parse(JSON.stringify(src));
    (function reid(n){
      n.id = uid();
      const map = {};
      n.children.forEach(ch=>{ const old = ch.id; reid(ch); map[old] = ch.id; });
      n.edges = (n.edges||[]).map(e=>({...e, id:uid(), a:map[e.a]||e.a, b:map[e.b]||e.b}));
    })(copy);
    nuovoId[src.id] = copy.id;
    copy.x = (copy.x||0)+off; copy.y = (copy.y||0)+off;
    // Il "(copia)" solo quando se ne duplica una: su dieci bolle sarebbero dieci
    // titoli con la stessa coda, e a distinguerle basta che siano sfalsate.
    if(nodi.length===1) copy.title = (copy.title||"") + " (copia)";
    cur.children.push(copy);
    return copy;
  });
  /* I collegamenti fra le bolle duplicate: due stanze collegate, copiate
     insieme, devono restare collegate — sennò non è una copia del gruppo, sono
     due copie sciolte. Si itera su un'istantanea perché il ciclo scrive
     nell'array che sta leggendo. */
  for(const e of [...(cur.edges||[])]){
    if(!nuovoId[e.a] || !nuovoId[e.b]) continue;
    cur.edges.push({...e, id:uid(), a:nuovoId[e.a], b:nuovoId[e.b]});
  }
  if(!Array.isArray(cur.wallSegs)) cur.wallSegs = [];
  const copieW = muri.map(w=>{
    const c = {...w, id:uid(), x:w.x+off, y:w.y+off};
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

// per gli onclick inline nei template e nell'HTML statico
Object.assign(window, { enterNode, jumpTo, planFit, planZoom, arrangeGrid, quickAddCenter, addAtCenter,
  pickBg, removeBg, toggleBgEdit, setBgOpacity, requestDeleteSelection, goToNode,
  deleteWallSeg, setWallDoor });

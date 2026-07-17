/* La mappa spaziale: motore del viewBox, rendering SVG della tela, interazioni
   pointer (drag, pinch, long-press, collegamenti), sfondo del livello,
   navigazione tra livelli e operazioni sulla selezione. */

import { TYPES, SHAPES, EDGE_TYPES, MARKER_R, STATUS_COLORS,
         isMarker, defShape, nodeBox, nodeCenter, node, uid, escapeHtml, escapeAttr } from "./modello.js";
import { st, save, findNode, findParent, removeNode, currentNode, pathNodes, RO } from "./stato.js";
import { showView, openConfirm } from "./viste.js";
import { renderDetail, compressImage } from "./pannello.js";
import { showCtxFor } from "./menu.js";

export function renderMap(){
  renderCrumbs();
  renderCanvas();
  renderDetail();
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
    st.selectedId = st.path[st.path.length-1]; st.selectedEdgeId = null;
    st.multiSel = new Set([st.selectedId]);
    st.path.pop(); renderMap();
  }
}

export function enterNode(id){
  st.path.push(id); st.selectedId = null; st.selectedEdgeId = null; st.multiSel.clear(); renderMap();
}

export function jumpTo(parentId, childId){
  if(st.path[st.path.length-1] !== parentId) st.path.push(parentId);
  st.selectedId = childId;
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
  const kids = currentNode().children.filter(c=>typeof c.x==="number");
  if(!kids.length){ planVB = {x:-600,y:-400,w:1200,h:800}; planApplyVB(); return; }
  let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  kids.forEach(c=>{ const b=nodeBox(c);
    x1=Math.min(x1,c.x); y1=Math.min(y1,c.y);
    x2=Math.max(x2,c.x+b.w); y2=Math.max(y2,c.y+b.h+20); });
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
const canEditEdges = () => true;   // i collegamenti si creano a ogni livello, città inclusa

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

function shapeMarkup(n, box, col){
  const s = SHAPES[n.shape||defShape(n)] || {};
  if(s.circle)  return `<ellipse class="blk-shape" cx="${box.w/2}" cy="${box.h/2}" rx="${box.w/2}" ry="${box.h/2}" style="--c:${col}"/>`;
  if(s.diamond) return `<polygon class="blk-shape" points="${box.w/2},0 ${box.w},${box.h/2} ${box.w/2},${box.h} 0,${box.h/2}" style="--c:${col}"/>`;
  return `<rect class="blk-shape" width="${box.w}" height="${box.h}" rx="10" style="--c:${col}"/>`;
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
  let s = `${(TYPES[c.type]||TYPES.nota).label}: ${c.title||"senza nome"}`;
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
    const col = (TYPES[c.type]||TYPES.nota).color;
    if(isMarker(c)){
      const C = nodeCenter(c);
      out += `<circle cx="${C.x*k+ox}" cy="${C.y*k+oy}" r="3" style="fill:${c.type==="token" ? (c.tokenColor||col) : col}"/>`;
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
  const btn = `<button class="btn primary" onclick="quickAddCenter()">+ Aggiungi bolla</button>`;
  if(st.path.length===1)
    return h("La campagna parte da qui.") +
           p("Ogni bolla è una zona o un luogo, e dentro può contenere un'altra mappa: trascinane una dalla barra, oppure fai doppio clic sulla tela.") +
           btn;
  return h("Questo livello è ancora vuoto.") +
         p("Trascina qui una bolla o un segnalino dalla barra, oppure fai doppio clic sulla tela.") +
         btn;
}

export function renderCanvas(){
  const svg = planSvg();
  const cur = currentNode();
  ensureLayout(cur);
  const emptyEl = document.getElementById("empty-node");
  emptyEl.classList.toggle("show", cur.children.length===0);
  if(cur.children.length===0) emptyEl.innerHTML = emptyNodeMarkup();
  const hint = document.getElementById("plan-hint");
  hint.style.display = cur.children.length ? "" : "none";
  hint.textContent = planHintText();

  planVB = planVBs[cur.id] || null;
  if(!planVB) planFit(); else planApplyVB();

  let out = `<defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M40 0H0V40" fill="none" style="stroke:var(--grid)" stroke-width="1"/>
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

  // blocchi e segnalini
  for(const c of cur.children){
    const col = (TYPES[c.type]||TYPES.nota).color;
    const isSel = st.multiSel.has(c.id) || c.id===st.selectedId;
    const selCls = isSel ? " sel" : "";
    const shCls = (!RO && c.shared) ? " shared" : "";
    // tabindex/role/aria: le bolle si raggiungono con Tab; la selezione segue
    // il focus (vedi il focusin in initMappa) e aria-pressed la annuncia
    const a11y = `tabindex="0" role="button" aria-pressed="${isSel}" aria-label="${ariaBlk(c)}"`;
    if(c.type==="token"){
      const R = MARKER_R+1, tcol = c.tokenColor || "#e8e3d8";
      const ini = (c.title||"?").trim().split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase() || "?";
      out += `<g class="blk marker token${selCls}${shCls}" data-block="${c.id}" ${a11y} transform="translate(${c.x},${c.y})">
        <circle class="blk-shape" cx="${R}" cy="${R}" r="${R}" style="fill:${tcol};--c:var(--bog)"/>
        <text x="${R}" y="${R+4}" text-anchor="middle" style="font-size:12px;font-weight:700;fill:var(--bog)">${escapeHtml(ini)}</text>
        <text x="${R}" y="${R*2+15}" text-anchor="middle" style="font-size:11px;fill:var(--ink-dim)">${escapeHtml(c.title||"")}</text>
      </g>`;
    }else if(isMarker(c)){
      const R = MARKER_R;
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
        ${shapeMarkup(c, box, col)}
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
    c.x=x; c.y=y;
    x += b.w+GAP; rowH = Math.max(rowH, b.h);
  });
  save(); planFit(true); renderDetail();
}

export function addSpatialChild(opts, x, y){
  if(RO) return;
  const cur = currentNode();
  let c;
  if(opts.marker) c = node("", opts.marker);
  else { c = node("", opts.shape==="quartiere" ? "zona" : "luogo"); c.shape = opts.shape; }
  const b = nodeBox(c);
  c.x = Math.round((x-b.w/2)/10)*10;
  c.y = Math.round((y-b.h/2)/10)*10;
  cur.children.push(c);
  st.selectedId = c.id; st.selectedEdgeId = null; st.multiSel = new Set([c.id]);
  save(); renderMap();
  setTimeout(()=>{ const i=document.querySelector("#detail input"); if(i) i.focus(); }, 50);
}
export function quickAddCenter(){
  const opts = canEditEdges() ? {shape:"stanza"} : {shape:"quartiere"};
  const cx = planVB ? planVB.x+planVB.w/2 : 0, cy = planVB ? planVB.y+planVB.h/2 : 0;
  addSpatialChild(opts, cx, cy);
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
      st.selectedId = id; st.selectedEdgeId = null; st.multiSel = new Set([id]);
      renderCanvas(); renderDetail();
    }else if(edgeEl){
      const id = edgeEl.dataset.edge;
      if(st.selectedEdgeId===id) return;
      st.selectedEdgeId = id; st.selectedId = null; st.multiSel.clear();
      renderCanvas(); renderDetail();
    }
  });
  svg.addEventListener("dragover", ev=>{ ev.preventDefault(); ev.dataTransfer.dropEffect="copy"; });
  svg.addEventListener("drop", ev=>{
    ev.preventDefault();
    let opts; try{ opts = JSON.parse(ev.dataTransfer.getData("text/plain")); }catch(_){ return; }
    if(!opts || (!opts.shape && !opts.marker)) return;
    const p = planPoint(ev);
    addSpatialChild(opts, p.x, p.y);
  });

  // Con il pointer capture il browser re-indirizza click/dblclick sull'SVG,
  // quindi il doppio clic sui blocchi è rilevato a mano nel pointerdown (lastTap):
  // qui gestiamo solo il doppio clic sullo sfondo.
  let lastHit = "bg";
  let lastTap = {id:null, t:0};
  const pointers = new Map();          // dita attive (per il pinch)
  let lpTimer = null, lpStart = null, lpFired = false;   // long-press = tasto destro
  let lastBgTap = null;                // doppio tap sullo sfondo
  let lastPointerType = "mouse";
  svg.addEventListener("dblclick", ev=>{
    if(lastPointerType==="touch") return;
    if(lastHit!=="bg") return;
    const p = planPoint(ev);
    const opts = canEditEdges() ? {shape:"stanza"} : {shape:"quartiere"};
    addSpatialChild(opts, p.x, p.y);
  });

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
    const p = planPoint(ev);
    lastHit = blkEl ? "blk" : edgeEl ? "edge" : "bg";
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
    if(handle && blkEl && canEditEdges()){
      const n = childOf(blkEl.dataset.block), c = nodeCenter(n);
      planDrag = {mode:"link", from:n.id};
      const t = document.getElementById("plan-temp");
      t.setAttribute("x1",c.x); t.setAttribute("y1",c.y);
      t.setAttribute("x2",p.x); t.setAttribute("y2",p.y);
      t.setAttribute("visibility","visible");
    }else if(blkEl){
      const n = childOf(blkEl.dataset.block);
      st.selectedEdgeId = null;
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
      if(!st.multiSel.has(n.id)) st.multiSel = new Set([n.id]);
      st.selectedId = n.id;
      if(RO){ renderCanvas(); renderDetail(); return; }   // al tavolo si guarda, non si sposta
      const group = [...st.multiSel];
      const start = {};
      group.forEach(id=>{ const m=childOf(id); if(m) start[id]={x:m.x, y:m.y}; });
      planDrag = {mode:"move", id:n.id, dx:p.x-n.x, dy:p.y-n.y, el:blkEl, moved:false,
                  group, start, collapse: group.length>1};
      blkEl.classList.add("dragging");
      svg.querySelectorAll(".blk.sel,.edge.sel").forEach(x=>x.classList.remove("sel"));
      group.forEach(id=>{ const el=svg.querySelector(`.blk[data-block="${id}"]`); if(el) el.classList.add("sel"); });
      renderDetail();
    }else if(edgeEl){
      st.selectedEdgeId = edgeEl.dataset.edge; st.selectedId = null; st.multiSel.clear();
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
      n.x = Math.round((p.x-planDrag.dx)/10)*10;
      n.y = Math.round((p.y-planDrag.dy)/10)*10;
      const g = applySnap(n, planDrag.group);  // allineamento magnetico (escluso il gruppo trascinato)
      drawGuides(n, g);
      planDrag.moved = true;
      const ddx = n.x - planDrag.start[n.id].x;
      const ddy = n.y - planDrag.start[n.id].y;
      for(const id of planDrag.group){         // il gruppo si muove rigido con l'ancora
        const m = childOf(id); if(!m || m===n) continue;
        m.x = planDrag.start[id].x + ddx;
        m.y = planDrag.start[id].y + ddy;
      }
      for(const id of planDrag.group){
        const el = svg.querySelector(`.blk[data-block="${id}"]`);
        const m = childOf(id);
        if(el && m) el.setAttribute("transform",`translate(${m.x},${m.y})`);
      }
      const cur = currentNode();
      (cur.edges||[]).forEach(e=>{
        if(!planDrag.group.includes(e.a) && !planDrag.group.includes(e.b)) return;
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
    }else if(planDrag.mode==="resize"){
      const n = childOf(planDrag.id); if(!n) return;
      n.w = Math.max(40, Math.round((p.x-n.x)/10)*10);
      n.h = Math.max(30, Math.round((p.y-n.y)/10)*10);
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
          st.selectedEdgeId = e.id; st.selectedId = null; st.multiSel.clear();
          save();
        }
      }
      renderCanvas(); renderDetail();
    }else if(planDrag.mode==="move"){
      planDrag.el.classList.remove("dragging");
      drawGuides(null, null);
      if(!planDrag.moved && planDrag.collapse){    // clic secco su un membro: selezione singola
        st.multiSel = new Set([planDrag.id]); st.selectedId = planDrag.id;
        renderCanvas(); renderDetail();
      }
      if(planDrag.moved){ save(); renderCanvas(); }
    }else if(planDrag.mode==="resize"){
      save(); renderCanvas(); renderDetail();
    }else if(planDrag.mode==="bgmove"||planDrag.mode==="bgresize"){
      if(planDrag.moved) save();
    }else if(planDrag.mode==="pan"){
      svg.style.cursor = "default";
      if(!planDrag.moved){
        if(lastPointerType==="touch"){          // doppio tap sullo sfondo = nuovo blocco
          const now = performance.now();
          if(lastBgTap && now-lastBgTap.t<350 && Math.hypot(ev.clientX-lastBgTap.x, ev.clientY-lastBgTap.y)<30){
            lastBgTap = null;
            const pp = planPointXY(ev.clientX, ev.clientY);
            addSpatialChild(canEditEdges()?{shape:"stanza"}:{shape:"quartiere"}, pp.x, pp.y);
            planDrag = null;
            return;
          }
          lastBgTap = {t:now, x:ev.clientX, y:ev.clientY};
        }
        st.detailOpen = false;
        st.selectedId=null; st.selectedEdgeId=null; st.multiSel.clear(); renderCanvas(); renderDetail();
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
  if(id===st.state.root.id){ st.path=[st.state.root.id]; st.selectedId=null; }
  else{
    const chain = nodePathChain(id);
    if(!chain) return;
    st.path = chain; st.selectedId = id;
  }
  st.selectedEdgeId = null;
  st.multiSel = new Set(st.selectedId ? [st.selectedId] : []);
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
export function doDeleteNodes(ids){
  for(const id of ids){
    if(id===st.state.root.id) continue;
    const par = findParent(id);
    if(par && Array.isArray(par.edges)) par.edges = par.edges.filter(e=>e.a!==id && e.b!==id);
    removeNode(id, st.state.root);
  }
  st.multiSel.clear(); st.selectedId = null; st.selectedEdgeId = null;
  save(); renderMap();
}
export function requestDeleteSelection(){
  const ids = st.multiSel.size ? [...st.multiSel] : (st.selectedId ? [st.selectedId] : []);
  const nodes = ids.map(id=>findNode(id)).filter(n=>n && n.id!==st.state.root.id);
  if(!nodes.length) return;
  if(nodes.every(isEmptyNode)){ doDeleteNodes(nodes.map(n=>n.id)); return; }
  openConfirm(nodes.length===1
    ? `Eliminare "${nodes[0].title||"bolla"}" e tutto il suo contenuto?`
    : `Eliminare ${nodes.length} bolle selezionate (e il loro contenuto)?`,
    ok=>{ if(ok) doDeleteNodes(nodes.map(n=>n.id)); });
}

export function duplicateSelected(){
  if(!st.selectedId) return;
  const cur = currentNode();
  const srcN = cur.children.find(c=>c.id===st.selectedId);
  if(!srcN) return;
  const copy = JSON.parse(JSON.stringify(srcN));
  (function reid(n){
    n.id = uid();
    const map = {};
    n.children.forEach(ch=>{ const old = ch.id; reid(ch); map[old] = ch.id; });
    n.edges = (n.edges||[]).map(e=>({...e, id:uid(), a:map[e.a]||e.a, b:map[e.b]||e.b}));
  })(copy);
  copy.x = (copy.x||0)+30; copy.y = (copy.y||0)+30;
  copy.title = (copy.title||"") + " (copia)";
  cur.children.push(copy);
  st.selectedId = copy.id; st.selectedEdgeId = null; st.multiSel = new Set([copy.id]);
  save(); renderMap();
}

// per gli onclick inline nei template e nell'HTML statico
Object.assign(window, { enterNode, jumpTo, planFit, planZoom, arrangeGrid, quickAddCenter,
  pickBg, removeBg, toggleBgEdit, setBgOpacity, requestDeleteSelection, goToNode });

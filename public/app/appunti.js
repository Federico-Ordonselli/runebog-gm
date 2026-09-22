/* Copia, taglia e incolla bolle fra livelli (22 set 2026).

   Gli appunti tengono un'ISTANTANEA della selezione presa al momento della
   copia: bolle con tutto il loro contenuto, i collegamenti fra le bolle
   copiate e i muri selezionati. Incollare la scrive nel livello in cui si è.

   Taglia + incolla è uno SPOSTAMENTO, non una copia: il primo incolla rimette
   le bolle con i loro id, così una pedina o una voce d'iniziativa che altrove
   puntava a quell'encounter continua a trovarlo. Dal secondo incolla in poi
   (o se quegli id esistono di nuovo, per esempio dopo un Ctrl+Z) escono copie
   con id nuovi, passando da duplicaNodi come il Duplica di sempre.

   Taglia toglie SUBITO, come una cancellazione, e Ctrl+Z la disfa. Rimandare
   la rimozione all'incolla permetterebbe di incollare una bolla dentro una
   sua sottobolla, cioè un albero che contiene sé stesso.

   Solo dentro la stessa campagna: in un'altra i PG a cui puntano le pedine non
   esistono, e le immagini caricate appartengono alla campagna d'origine. */

import { uid, snapGrid, snapNode, nodeBox, grigliaDi, vettoreMaglia } from "./modello.js";
import { st, save, currentNode, findNode, clearSel, RO, campagnaCorrente } from "./stato.js";
import { childOf, wallOf, doDeleteNodes, renderMap, centroVista } from "./mappa.js";
import { duplicaNodi } from "./duplica.js";
import { prepareCampaignDocument } from "./formato-campagna.js";
import { openAlert } from "./viste.js";

let appunti = null;   // {campagna, nodi, archi, muri, tagliati}

const annuncia = testo => { const el = document.getElementById("savestate"); if(el) el.textContent = testo; };
const conta = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`;

function selezione(){
  const nodi = (st.multiSel.size ? [...st.multiSel] : (st.selectedId ? [st.selectedId] : []))
    .map(id => childOf(id)).filter(Boolean);
  const muri = (st.multiSelWalls.size ? [...st.multiSelWalls]
              : (st.selectedWallId ? [st.selectedWallId] : []))
    .map(id => wallOf(id)).filter(Boolean);
  return {nodi, muri};
}

export const ciSonoAppunti = () => !!appunti && appunti.campagna === campagnaCorrente();

function prendi(tagliati){
  const {nodi, muri} = selezione();
  if(!nodi.length && !muri.length) return null;
  const ids = new Set(nodi.map(n => n.id));
  appunti = {
    campagna: campagnaCorrente(),
    nodi: structuredClone(nodi),
    // solo gli archi interni alla selezione: uno verso una bolla rimasta dov'era
    // porterebbe nel livello d'arrivo un collegamento con un capo nel vuoto
    archi: structuredClone((currentNode().edges || []).filter(e => ids.has(e.a) && ids.has(e.b))),
    muri: structuredClone(muri),
    tagliati,
  };
  return {nodi, muri};
}

const descrivi = ({nodi, muri}) =>
  [nodi.length && conta(nodi.length, "bolla", "bolle"), muri.length && conta(muri.length, "muro", "muri")]
    .filter(Boolean).join(" e ");

export function copiaSelezione(){
  if(RO) return;
  const presi = prendi(false);
  if(presi) annuncia(`Copiat${presi.nodi.length + presi.muri.length === 1 ? "o" : "i"}: ${descrivi(presi)} — Ctrl+V per incollare`);
}

export function tagliaSelezione(){
  if(RO) return;
  const presi = prendi(true);
  if(!presi) return;
  // Niente conferma, a differenza di Canc: niente va perso, sta negli appunti
  // e Ctrl+Z lo rimette dov'era.
  doDeleteNodes(presi.nodi.map(n => n.id), presi.muri.map(w => w.id));
  annuncia(`Tagliat${presi.nodi.length + presi.muri.length === 1 ? "o" : "i"}: ${descrivi(presi)} — Ctrl+V per incollare`);
}

function tuttiGliId(nodi, out = []){
  for(const n of nodi){ out.push(n.id); tuttiGliId(n.children || [], out); }
  return out;
}

/* Il riquadro del gruppo, per metterne il centro dove si incolla. */
function riquadro(nodi, muri, g){
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for(const n of nodi){
    if(typeof n.x !== "number" || typeof n.y !== "number") continue;
    const b = nodeBox(n);
    x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y);
    x2 = Math.max(x2, n.x + b.w); y2 = Math.max(y2, n.y + b.h);
  }
  for(const w of muri){
    const L = w.len * g.cella;
    x1 = Math.min(x1, w.x); y1 = Math.min(y1, w.y);
    x2 = Math.max(x2, w.x + (w.dir === "h" ? L : 0)); y2 = Math.max(y2, w.y + (w.dir === "v" ? L : 0));
  }
  return x1 === Infinity ? null : {x: (x1 + x2) / 2, y: (y1 + y2) / 2};
}

export function incolla(punto){
  if(RO) return;
  if(!appunti){ annuncia("Niente da incollare"); return; }
  if(appunti.campagna !== campagnaCorrente()){
    openAlert("Si incolla solo dentro la campagna da cui hai copiato: in un'altra i PG e le immagini a cui le bolle puntano non esistono.");
    return;
  }
  const cur = currentNode();

  /* Spostamento se è il primo incolla di un taglio e nessuno di quegli id è
     tornato nella campagna; altrimenti copie, con gli id rifatti. */
  const sposta = appunti.tagliati && !tuttiGliId(appunti.nodi).some(id => findNode(id));
  let nodi, archi;
  if(sposta){
    nodi = structuredClone(appunti.nodi);
    archi = structuredClone(appunti.archi);
  }else{
    const {copie, nodi: nuovoId} = duplicaNodi(appunti.nodi);
    nodi = copie;
    archi = appunti.archi.map(e => ({...e, id: uid(), a: nuovoId.get(e.a), b: nuovoId.get(e.b)}));
  }
  const muri = appunti.muri.map(w => ({...w, id: sposta ? w.id : uid()}));

  /* Il gruppo si sposta RIGIDO, di un vettore della maglia: così chi era
     agganciato alla maglia (piante, segnalini, muri) resta agganciato senza
     doverlo riagganciare, e il gruppo non si deforma. */
  const g = grigliaDi(cur);
  const centro = riquadro(nodi, muri, g);
  const dove = punto || centroVista();
  const v = centro ? vettoreMaglia(g, dove.x - centro.x, dove.y - centro.y) : {x:0, y:0};
  for(const n of nodi) if(typeof n.x === "number" && typeof n.y === "number"){ n.x += v.x; n.y += v.y; }
  for(const w of muri){ w.x += v.x; w.y += v.y; }
  /* Il vettore di maglia tiene agganciato chi arriva da un livello con la
     STESSA maglia; da un livello con un'altra (quadretti → esagoni, o un lato
     diverso) ognuno si riaggancia a quella di qui, come al rilascio di un
     trascinamento. Per chi era già al suo posto è un'identità. */
  for(const n of nodi){ const q = snapNode(n, n.x, n.y, g); n.x = q.x; n.y = q.y; }
  for(const w of muri){ w.x = snapGrid(w.x, g); w.y = snapGrid(w.y, g); }

  /* Si prova su una copia della campagna prima di toccare quella vera, come
     l'import del dungeon: un incolla che sfonda i limiti del documento
     verrebbe rifiutato al salvataggio, e lì il DM lo scoprirebbe tardi. */
  const candidata = structuredClone(st.state);
  const dentro = (function trova(n){
    if(n.id === cur.id) return n;
    for(const c of n.children){ const r = trova(c); if(r) return r; }
    return null;
  })(candidata.root);
  if(dentro){
    dentro.children.push(...structuredClone(nodi));
    (dentro.edges ||= []).push(...structuredClone(archi));
    if(muri.length) (dentro.wallSegs ||= []).push(...structuredClone(muri));
    const esito = prepareCampaignDocument(candidata);
    if(!esito.ok){ openAlert("Non incollato: " + esito.error.message); return; }
  }

  cur.children.push(...nodi);
  if(archi.length) (cur.edges ||= []).push(...archi);
  if(muri.length) (cur.wallSegs ||= []).push(...muri);
  if(sposta) appunti.tagliati = false;

  clearSel();
  nodi.forEach(n => st.multiSel.add(n.id));
  muri.forEach(w => st.multiSelWalls.add(w.id));
  if(nodi.length) st.selectedId = nodi.at(-1).id;
  else if(muri.length) st.selectedWallId = muri.at(-1).id;
  save(); renderMap();
  annuncia(`Incollat${nodi.length + muri.length === 1 ? "o" : "i"}: ${descrivi({nodi, muri})}`);
}

Object.assign(window, { copiaSelezione, tagliaSelezione, incolla });

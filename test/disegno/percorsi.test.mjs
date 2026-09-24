/* I collegamenti disegnati a mano (`e.percorso`, 24 set 2026): geometria in
   percorsi.js, bonifica UNA nel contratto, letta da app e tavolo. Il
   percorso finisce nell'attributo `d` di un <path>, quindi la bonifica è un
   invariante e non una rifinitura. */
import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const { puntiArco, percorsoRelativo, semplificaTraccia, curvaArco } =
  await import(repoUrl("public/app/percorsi.js"));
const { prepareCampaignDocument, normalizzaPercorso, ARCO_PUNTI_MAX } =
  await import(repoUrl("public/app/formato-campagna.js"));
const { sanitizeState } = await import(repoUrl("public/app/modello.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

const vicino = (a, b) => Math.abs(a - b) < 0.1;

test("il percorso è relativo alle estremità: segue le bolle quando si spostano", ()=>{
  const A = {x:0, y:0}, B = {x:100, y:0};
  const via = percorsoRelativo([{x:50, y:40}], A, B);
  assert.deepEqual(via, [[0.5, 0.4]]);
  // la stessa strada con B spostato e ruotato di 90°: il punto ruota con lei
  const [, P] = puntiArco(via, A, {x:0, y:200});
  assert.ok(vicino(P.x, -80) && vicino(P.y, 100), JSON.stringify(P));
  // andata e ritorno
  const Q = puntiArco(percorsoRelativo([{x:13, y:-7}], {x:5,y:5}, {x:60,y:90}), {x:5,y:5}, {x:60,y:90})[1];
  assert.ok(vicino(Q.x, 13) && vicino(Q.y, -7));
  assert.deepEqual(percorsoRelativo([{x:1,y:1}], A, A), [], "centri coincidenti: arco dritto");
});

test("una traccia dritta col tremolio torna dritta, uno spigolo resta", ()=>{
  const tremolio = Array.from({length:30}, (_, i)=>({x:i*10, y:(i%2 ? 2 : -2)}));
  assert.equal(semplificaTraccia(tremolio, 6).length, 2);
  const spigolo = [{x:0,y:0},{x:50,y:1},{x:100,y:0},{x:100,y:50},{x:101,y:100}];
  assert.deepEqual(semplificaTraccia(spigolo, 6).map(p=>[p.x,p.y]), [[0,0],[100,0],[101,100]]);
});

test("la curva passa per i punti e mette l'etichetta a metà strada", ()=>{
  const dritta = curvaArco([{x:0,y:0},{x:100,y:0}]);
  assert.equal(dritta.d, "M0 0L100 0");
  assert.deepEqual(dritta.meta, {x:50, y:0});
  const ansa = curvaArco([{x:0,y:0},{x:50,y:100},{x:100,y:0}]);
  assert.match(ansa.d, /^M0 0C[^C]* 50 100C[^C]* 100 0$/);
  // simmetrica: la metà sta sulla punta dell'ansa, non sulla corda
  assert.ok(vicino(ansa.meta.x, 50) && ansa.meta.y > 90, JSON.stringify(ansa.meta));
});

test("il contratto accetta coppie di numeri finiti e rifiuta il resto", ()=>{
  const doc = percorso => ({schemaVersion:1, checklist:[], players:[], root:{
    id:"r", title:"R", type:"zona", status:"", notes:"", img:null, x:null, y:null, shape:null,
    children:[
      {id:"a", title:"A", type:"luogo", status:"", notes:"", img:null, children:[], edges:[], x:0, y:0, shape:null},
      {id:"b", title:"B", type:"luogo", status:"", notes:"", img:null, children:[], edges:[], x:90, y:0, shape:null}],
    edges:[{id:"e", a:"a", b:"b", type:"strada", label:"", notes:"", percorso}]}});
  assert.equal(prepareCampaignDocument(doc([[0.5,-0.25]])).ok, true);
  for(const cattivo of [[[0.5]], [["1",2]], [[0,NaN]], [{u:0,v:0}], [[0, 1e6]]]){
    const r = prepareCampaignDocument(doc(cattivo));
    assert.equal(r.ok, false, JSON.stringify(cattivo));
    assert.match(r.error.path, /edges\[0\]\.percorso\[0\]/);
  }
  const troppi = Array.from({length:ARCO_PUNTI_MAX + 1}, (_, k)=>[k/100, 0]);
  assert.equal(prepareCampaignDocument(doc(troppi)).error.code, "too_many_items");
});

test("bonifica e tavolo: esce solo il percorso pulito", ()=>{
  assert.deepEqual(normalizzaPercorso([[0.1234567, -0],[null,1],"x",[1,'"/>'],[2,3,4],[Infinity,0]]), [[0.123, 0]]);
  const s = {root:{id:"r", edges:[{id:"e", a:"a", b:"b", percorso:[["x",1]]}, {id:"f", a:"a", b:"b", percorso:[[0.5,0.5]]}], children:[]}};
  sanitizeState(s);
  assert.equal("percorso" in s.root.edges[0], false);
  assert.deepEqual(s.root.edges[1].percorso, [[0.5,0.5]]);

  const nodo = (id, over={}) => ({id, title:id, type:"luogo", status:"", notes:"", img:null,
    children:[], edges:[], x:0, y:0, shape:null, shared:true, ...over});
  const data = {schemaVersion:1, checklist:[], players:[], root:nodo("r", {type:"zona", children:[nodo("a"), nodo("b", {x:100})],
    edges:[{id:"e", a:"a", b:"b", type:"strada", label:"", notes:"", percorso:[[0.5,0.3],[1,'<script>']]}]})};
  const out = projectForPlayers(data);
  assert.deepEqual(out.root.edges[0].percorso, [[0.5,0.3]]);
});

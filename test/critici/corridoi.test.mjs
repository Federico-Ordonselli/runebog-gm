/* I corridoi dipinti (`n.corridoi`, 24 set 2026): celle intere della maglia
   del livello. Finisce nell'attributo `d` di un <path>, quindi la bonifica è
   un invariante, e la regola è UNA (normalizzaCorridoi nel contratto) letta
   sia dall'app sia dal tavolo. */
import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "./_repo.mjs";

const { prepareCampaignDocument, normalizzaCorridoi, CAMPAIGN_LIMITS } =
  await import(repoUrl("public/app/formato-campagna.js"));
const { sanitizeState, sagomaCorridoi, cellaCorridoio, riquadroCorridoi, GRIGLIA_BASE } =
  await import(repoUrl("public/app/modello.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

const nodo = (over = {}) => ({id:"root", title:"R", type:"zona", status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...over});
const campagna = root => ({schemaVersion:1, root, checklist:[], players:[]});

test("il contratto accetta coppie di interi e rifiuta tutto il resto", ()=>{
  assert.equal(prepareCampaignDocument(campagna(nodo({corridoi:[[0,0],[-3,7]]}))).ok, true);
  for(const cattiva of [[[0.5,0]], [[0]], [["1",2]], [[0,0,0]], [{i:0,j:0}], [[0, 2e6]]]){
    const r = prepareCampaignDocument(campagna(nodo({corridoi:cattiva})));
    assert.equal(r.ok, false, JSON.stringify(cattiva));
    assert.match(r.error.path, /^\$\.root\.corridoi\[0\]/);
  }
  const troppe = Array.from({length:CAMPAIGN_LIMITS.corridoiPerNode + 1}, (_, k)=>[k, 0]);
  assert.equal(prepareCampaignDocument(campagna(nodo({corridoi:troppe}))).error.code, "too_many_items");
});

test("la bonifica tiene solo celle intere, senza doppioni e sotto il tetto", ()=>{
  assert.deepEqual(normalizzaCorridoi([[1,2],[1,2],["3",4],[NaN,1],null,[5,-0],'"/><script>',[7,8,9]]),
    [[1,2],[5,0]]);
  assert.deepEqual(normalizzaCorridoi("x"), []);
  const s = {root:nodo({corridoi:[[0,0],["x",1]], children:[nodo({id:"c", corridoi:"rotto"})]})};
  sanitizeState(s);
  assert.deepEqual(s.root.corridoi, [[0,0]]);
  assert.equal("corridoi" in s.root.children[0], false);
});

test("il tavolo riceve i corridoi bonificati", ()=>{
  const out = projectForPlayers(campagna(nodo({corridoi:[[2,3],["<svg>",1],[2,3]]})));
  assert.deepEqual(out.root.corridoi, [[2,3]]);
  assert.equal("corridoi" in projectForPlayers(campagna(nodo())).root, false);
});

test("sui quadretti le corse di una riga diventano un rettangolo solo", ()=>{
  const g = GRIGLIA_BASE, c = g.cella;
  const d = sagomaCorridoi(g, [[2,0],[0,0],[1,0],[5,0],[0,1]]);
  assert.equal((d.match(/M/g) || []).length, 3);
  assert.ok(d.includes(`M0 0h${3*c}`), d);
  assert.deepEqual(cellaCorridoio(g, -1, c*2 + 1), [-1, 2]);
  assert.deepEqual(riquadroCorridoi(g, [[0,0],[2,1]]), {x1:0, y1:0, x2:3*c, y2:2*c});
});

test("negli esagoni una cella è un esagono centrato sulla sua cella", ()=>{
  for(const forma of ["hex-punta", "hex-piatto"]){
    const g = {forma, cella:60, metri:1.5};
    const d = sagomaCorridoi(g, [[3,-2]]);
    const pt = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m=>[+m[1], +m[2]]);
    assert.equal(pt.length, 6, forma);
    const cx = pt.reduce((a,p)=>a+p[0], 0)/6, cy = pt.reduce((a,p)=>a+p[1], 0)/6;
    assert.deepEqual(cellaCorridoio(g, cx, cy), [3,-2], forma);
    // Ogni vertice sta a distanza cella/√3 dal centro.
    for(const [x,y] of pt) assert.ok(Math.abs(Math.hypot(x-cx, y-cy) - 60/Math.sqrt(3)) < 0.05, forma);
  }
});

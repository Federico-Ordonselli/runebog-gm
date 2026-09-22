/* La maglia di un livello (`n.griglia`, 22 set 2026): quadretti o esagoni, col
   lato e i metri che il DM sceglie.

   Tre cose si provano qui. La geometria degli esagoni, che a occhio sembra
   giusta anche quando un segnalino finisce a cavallo di due celle: andata e
   ritorno fra punto e cella, passo fra vicini, frecce che tornano da dove sono
   partite. Che la maglia di DEFAULT resti esattamente quella di prima, perché
   le campagne esistenti non hanno il campo e non devono accorgersi di niente.
   E che contratto, bonifica e proiezione del tavolo concordino su cosa è una
   maglia valida: se divergessero, il DM si vedrebbe rimbalzare con 422 un
   livello che l'app ha appena scritto, o i giocatori conterebbero con una
   maglia diversa dalla sua. */

import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const {
  GRIGLIE, GRIGLIA_BASE, CELL, grigliaDi, safeGriglia, isHex, snapNode, snapToCell, markerR,
  cellaEsagono, centroEsagono, centroCella, celleFra, passoMaglia, vettoreMaglia, tasselloMaglia,
  sanitizeState, wallSegEnds,
} = await import(repoUrl("public/app/modello.js"));
const { prepareCampaignDocument, CURRENT_CAMPAIGN_SCHEMA_VERSION, GRID_FORMS } =
  await import(repoUrl("public/app/formato-campagna.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

const ESAGONI = ["hex-punta", "hex-piatto"].map(forma => ({forma, cella:40, metri:1.5}));
const vicino = (a, b) => Math.abs(a - b) < 1e-6;

const documento = griglia => ({
  schemaVersion: CURRENT_CAMPAIGN_SCHEMA_VERSION,
  root: {id:"radice", title:"R", type:"zona", status:"", notes:"", img:null,
         children:[], edges:[], x:null, y:null, shape:"quartiere", shared:true,
         ...(griglia === undefined ? {} : {griglia})},
  checklist: [], players: [],
});

test("le forme dell'app sono esattamente quelle del contratto", () => {
  assert.deepEqual(Object.keys(GRIGLIE).sort(), [...GRID_FORMS].sort());
  assert.equal(GRIGLIA_BASE.forma, "quadrata");
});

test("senza il campo la maglia è quella storica, e aggancia come prima", () => {
  assert.deepEqual(grigliaDi({}), {forma:"quadrata", cella:CELL, metri:1.5});
  const m = {type:"quest", x:3, y:7};
  const r = markerR(m);
  assert.deepEqual(snapNode(m), {x:snapToCell(3, r), y:snapToCell(7, r)});
  assert.deepEqual(snapNode({type:"luogo", shape:"stanza"}, 23, 58), {x:40, y:40});
});

test("un lato diverso sposta anche piante e muri sulla sua maglia", () => {
  const g = {forma:"quadrata", cella:60, metri:1.5};
  assert.deepEqual(snapNode({type:"luogo", shape:"stanza"}, 35, 95, g), {x:60, y:120});
  assert.equal(wallSegEnds({x:0, y:0, dir:"h", len:2}, g).x2, 120);
});

for(const g of ESAGONI){
  test(`${g.forma}: punto → esagono → centro torna sempre allo stesso esagono`, () => {
    for(let q = -4; q <= 4; q++) for(let r = -4; r <= 4; r++){
      const c = centroEsagono(g, {q, r});
      // Un punto a un terzo del raggio dal centro, in una direzione qualunque.
      const p = cellaEsagono(g, c.x + 6, c.y - 5);
      assert.deepEqual(p, {q, r});
    }
  });

  test(`${g.forma}: i sei vicini stanno a un lato e a un esagono di distanza`, () => {
    const o = centroEsagono(g, {q:0, r:0});
    for(const [dq, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]){
      const p = centroEsagono(g, {q:dq, r:dr});
      assert.ok(vicino(Math.hypot(p.x - o.x, p.y - o.y), g.cella));
      assert.equal(celleFra(g, o, p), 1);
    }
    assert.equal(celleFra(g, o, centroEsagono(g, {q:3, r:-1})), 3);
  });

  test(`${g.forma}: le frecce restano sui centri e su-giù torna indietro`, () => {
    let p = centroEsagono(g, {q:2, r:1});
    const partenza = {...p};
    for(const k of ["ArrowDown","ArrowUp","ArrowUp","ArrowDown","ArrowRight","ArrowLeft",
                    "ArrowDown","ArrowDown","ArrowUp","ArrowUp","ArrowLeft","ArrowRight"]){
      const {dx, dy} = passoMaglia(g, k, p);
      assert.ok(vicino(Math.hypot(dx, dy), g.cella), `${k} è un passo fra vicini`);
      p = {x:p.x + dx, y:p.y + dy};
      const c = centroCella(g, p.x, p.y);
      assert.ok(vicino(c.x, p.x) && vicino(c.y, p.y), `${k} finisce su un centro`);
    }
    assert.ok(vicino(p.x, partenza.x) && vicino(p.y, partenza.y));
  });

  test(`${g.forma}: un segnalino si centra nell'esagono, una pianta resta libera`, () => {
    const m = {type:"token"}, r = markerR(m);
    const q = snapNode(m, 51, 12, g);
    const c = centroCella(g, q.x + r, q.y + r);
    assert.ok(vicino(c.x, q.x + r) && vicino(c.y, q.y + r));
    assert.deepEqual(snapNode({type:"luogo", shape:"stanza"}, 23, 58, g), {x:23, y:58});
  });

  test(`${g.forma}: un vettore di maglia porta un centro su un centro`, () => {
    const v = vettoreMaglia(g, 97, -61);
    const c = centroEsagono(g, {q:1, r:2});
    const d = centroCella(g, c.x + v.x, c.y + v.y);
    assert.ok(vicino(d.x, c.x + v.x) && vicino(d.y, c.y + v.y));
  });

  test(`${g.forma}: il tassello del disegno si ripete sul passo della maglia`, () => {
    const t = tasselloMaglia(g), h = g.cella * Math.sqrt(3);
    const [w, a] = g.forma === "hex-punta" ? [g.cella, h] : [h, g.cella];
    assert.ok(Math.abs(t.w - w) < 0.01 && Math.abs(t.h - a) < 0.01);
    assert.match(t.d, /^M[-\d. L]+(M[-\d. L]+)*$/);
  });
}

test("la bonifica tiene una maglia valida e butta quella inventata", () => {
  assert.equal(isHex(safeGriglia({forma:"hex-punta", cella:50, metri:9000})), true);
  assert.equal(safeGriglia({forma:"triangoli", cella:50, metri:1}), null);
  assert.deepEqual(safeGriglia({forma:"quadrata", cella:"50\" onload=x", metri:-3}),
    {forma:"quadrata", cella:CELL, metri:1.5});

  const doc = documento({forma:"quadrata", cella:60, metri:1.5});
  doc.root.wallSegs = [{id:"m", x:35, y:95, dir:"h", len:2}];
  sanitizeState(doc);
  assert.deepEqual([doc.root.wallSegs[0].x, doc.root.wallSegs[0].y], [60, 120],
    "i muri si agganciano alla maglia del LORO livello");
});

test("il contratto accetta la maglia nei limiti e rifiuta il resto", () => {
  assert.equal(prepareCampaignDocument(documento({forma:"hex-piatto", cella:40, metri:9000})).ok, true);
  assert.equal(prepareCampaignDocument(documento(undefined)).ok, true);
  for(const cattiva of [
    {forma:"triangoli", cella:40, metri:1.5},
    {forma:"quadrata", cella:5, metri:1.5},
    {forma:"quadrata", cella:40, metri:0},
    {forma:"quadrata", cella:40},
    "quadrata",
  ]) assert.equal(prepareCampaignDocument(documento(cattiva)).ok, false, JSON.stringify(cattiva));
});

test("al tavolo arriva la stessa maglia del DM, e solo se è valida", () => {
  const buona = {forma:"hex-punta", cella:48, metri:9000};
  assert.deepEqual(projectForPlayers(documento(buona)).root.griglia, buona);
  const ostile = projectForPlayers(documento({forma:"hex-punta", cella:48, metri:9000, extra:"<script>"}));
  assert.deepEqual(Object.keys(ostile.root.griglia).sort(), ["cella","forma","metri"]);
  assert.equal(projectForPlayers(documento({forma:"cerchi", cella:48, metri:1})).root.griglia, undefined);
  assert.equal(projectForPlayers(documento({forma:"quadrata", cella:1e9, metri:1})).root.griglia, undefined);
});

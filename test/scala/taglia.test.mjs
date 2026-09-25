/* La taglia di un segnalino (`n.taglia`, 25 set 2026): quanti quadretti
   occupa per lato. Si provano le tre cose che si rompono in silenzio: che
   senza il campo il segnalino resti ESATTAMENTE quello di prima (le campagne
   esistenti non lo hanno), che una taglia pari stia sull'incrocio e una
   dispari al centro della cella — sennò una creatura Grande finisce a
   cavallo di nove quadretti — e che contratto, bonifica e tavolo concordino
   sul numero, che finisce in un raggio e quindi in attributi SVG. */

import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const { CELL, MARKER_R, markerR, nodeBox, snapNode, celleSegnalino, sanitizeState } =
  await import(repoUrl("public/app/modello.js"));
const { prepareCampaignDocument, CURRENT_CAMPAIGN_SCHEMA_VERSION, normalizzaTaglia, TAGLIA_MAX, TESTO_SIZE_MAX } =
  await import(repoUrl("public/app/formato-campagna.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

const documento = figlio => ({
  schemaVersion: CURRENT_CAMPAIGN_SCHEMA_VERSION,
  root: {id:"radice", title:"R", type:"zona", status:"", notes:"", img:null,
         children:[{id:"png1", title:"Mastro Olmo", type:"png", status:"", notes:"segreto del DM",
                    img:null, children:[], edges:[], x:0, y:0, shape:null, shared:true, ...figlio}],
         edges:[], x:null, y:null, shape:"quartiere", shared:true},
  checklist: [], players: [],
});

test("normalizzaTaglia: intero fra 1 e il tetto, 1 per tutto il resto", () => {
  assert.equal(normalizzaTaglia(undefined), 1);
  assert.equal(normalizzaTaglia("x\" onerror=1"), 1);
  assert.equal(normalizzaTaglia(0), 1);
  assert.equal(normalizzaTaglia(2.4), 2);
  assert.equal(normalizzaTaglia(99), TAGLIA_MAX);
});

test("senza taglia il segnalino è quello di sempre", () => {
  assert.equal(markerR({type:"png"}), MARKER_R);
  assert.equal(markerR({type:"token"}), MARKER_R + 1);
  assert.deepEqual(nodeBox({type:"png"}), {w:MARKER_R*2, h:MARKER_R*2});
  assert.equal(celleSegnalino({type:"png"}, {forma:"quadrata", cella:20, metri:1}), 1,
    "su una maglia fitta il segnalino da uno non cambia aggancio");
});

test("taglia t sta in t×t quadretti con lo stesso margine", () => {
  for(let t = 1; t <= 4; t++){
    const r = markerR({type:"png", taglia:t});
    assert.equal(2*r + 10, t*CELL);
    assert.equal(celleSegnalino({type:"png", taglia:t}), t);
  }
});

test("pari sull'incrocio, dispari al centro della cella", () => {
  // Le coordinate sono l'angolo del riquadro: il centro di partenza è
  // (57 + r, 93 + r), e l'aggancio lo porta sul punto di maglia più vicino.
  const centro = n => { const q = snapNode(n, 57, 93), r = markerR(n); return {x:q.x + r, y:q.y + r}; };
  assert.deepEqual(centro({type:"png", taglia:2}), {x:80, y:120});    // da (92, 128)
  assert.deepEqual(centro({type:"png", taglia:3}), {x:100, y:140});   // da (112, 148)
  assert.deepEqual(centro({type:"token", taglia:4}), {x:120, y:160}); // da (133, 169)
});

test("negli esagoni anche una taglia pari sta al centro di un esagono", () => {
  const g = {forma:"hex-punta", cella:40, metri:1.5};
  const a = snapNode({type:"png", taglia:2}, 57, 93, g);
  const b = snapNode({type:"png", taglia:2}, a.x, a.y, g);
  assert.deepEqual(a, b, "riagganciare non la sposta più");
});

test("il contratto accetta le taglie dell'app e rifiuta il resto", () => {
  assert.equal(prepareCampaignDocument(documento({taglia:TAGLIA_MAX})).ok, true);
  assert.equal(prepareCampaignDocument(documento({taglia:TAGLIA_MAX + 1})).ok, false);
  assert.equal(prepareCampaignDocument(documento({taglia:2.5})).ok, false);
  assert.equal(prepareCampaignDocument(documento({taglia:"2"})).ok, false);
});

test("il contratto accetta il carattere massimo che il pannello concede", () => {
  const doc = documento({});
  doc.root.children[0] = {...doc.root.children[0], type:"testo", textSize:TESTO_SIZE_MAX};
  assert.equal(prepareCampaignDocument(doc).ok, true);
});

test("la bonifica toglie una taglia che non è un numero", () => {
  const s = documento({taglia:"\"><script>"});
  sanitizeState(s);
  assert.equal("taglia" in s.root.children[0], false);
  const t = documento({taglia:3});
  sanitizeState(t);
  assert.equal(t.root.children[0].taglia, 3);
});

test("al tavolo arriva la stessa taglia, e niente note del DM", () => {
  const out = projectForPlayers(documento({taglia:3}));
  const png = out.root.children[0];
  assert.equal(png.taglia, 3);
  assert.equal(JSON.stringify(out).includes("segreto del DM"), false);
  assert.equal("taglia" in projectForPlayers(documento({})).root.children[0], false);
});

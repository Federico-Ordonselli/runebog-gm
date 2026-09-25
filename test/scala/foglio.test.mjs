/* Il foglio di caselle e schede (`n.foglio`, 25 set 2026). Il valore finisce
   in una classe CSS, quindi le cose da provare sono quelle che si rompono in
   silenzio: che app e contratto conoscano gli stessi fogli (sennò il DM si
   vede rimbalzare con 422 una scelta fatta dal pannello), che la bonifica
   tolga ciò che il contratto rifiuta, che un nodo senza campo resti senza
   scelta — cioè segua le impostazioni — e che al tavolo il campo non esca. */

import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const { FOGLI, foglioDi, foglioValido, sanitizeState } = await import(repoUrl("public/app/modello.js"));
const { prepareCampaignDocument, CURRENT_CAMPAIGN_SCHEMA_VERSION, FOGLI: FOGLI_CONTRATTO } =
  await import(repoUrl("public/app/formato-campagna.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

const documento = (png, testo) => ({
  schemaVersion: CURRENT_CAMPAIGN_SCHEMA_VERSION,
  root: {id:"radice", title:"R", type:"zona", status:"", notes:"", img:null,
         children:[
           {id:"png1", title:"Mastro Olmo", type:"png", status:"", notes:"Mercante", img:null,
            children:[], edges:[], x:0, y:0, shape:null, shared:true, ...png},
           {id:"t1", title:"", type:"testo", status:"", notes:"Appunto", img:null,
            children:[], edges:[], x:100, y:0, w:200, h:80, shape:null, shared:true, ...testo},
         ],
         edges:[], x:null, y:null, shape:"quartiere", shared:true},
  checklist: [], players: [],
});

test("app e contratto conoscono gli stessi fogli, nello stesso ordine", () => {
  assert.deepEqual(Object.keys(FOGLI), [...FOGLI_CONTRATTO]);
});

test("il contratto accetta i fogli dell'elenco e rifiuta il resto", () => {
  for(const f of FOGLI_CONTRATTO)
    assert.equal(prepareCampaignDocument(documento({foglio:f}, {foglio:f})).ok, true, f);
  assert.equal(prepareCampaignDocument(documento({}, {})).ok, true, "senza campo va bene");
  for(const cattivo of ["papiro", "", null, 3, 'carta" onload="x', "__proto__"])
    assert.equal(prepareCampaignDocument(documento({}, {foglio:cattivo})).ok, false, JSON.stringify(cattivo));
});

test("la bonifica toglie il foglio sconosciuto e lascia quello buono", () => {
  const s = documento({foglio:"pergamena"}, {foglio:"<b>"});
  sanitizeState(s);
  assert.equal(s.root.children[0].foglio, "pergamena");
  assert.equal("foglio" in s.root.children[1], false);
});

test("senza scelta il foglio è null: decide la preferenza dello schermo", () => {
  assert.equal(foglioDi({}), null);
  assert.equal(foglioDi({foglio:"toString"}), null, "niente chiavi ereditate");
  assert.equal(foglioValido("constructor"), false);
  assert.equal(foglioDi({foglio:"bruciata"}), "bruciata");
});

test("al tavolo il foglio non esce", () => {
  const out = JSON.stringify(projectForPlayers(documento({foglio:"carta"}, {foglio:"bruciata"})));
  assert.equal(out.includes("foglio"), false);
});

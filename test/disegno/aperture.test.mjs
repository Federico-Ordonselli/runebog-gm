/* I tipi di apertura di un muro (porte, varco, finestra, grata) vivono in
   TRE elenchi: DOOR_TYPES (app), il contratto e DOOR_KINDS (share.ts). Uno
   che resta indietro fa rimbalzare con 422 un salvataggio legittimo, o fa
   uscire al tavolo un muro pieno dove il DM ha messo una finestra. */
import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const { DOOR_TYPES } = await import(repoUrl("public/app/modello.js"));
const { prepareCampaignDocument } = await import(repoUrl("public/app/formato-campagna.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

const nodo = (over = {}) => ({id:"root", title:"R", type:"zona", status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, shared:true, ...over});

test("ogni tipo dell'app è accettato dal contratto ed esce al tavolo (tranne i segreti)", ()=>{
  const tipi = Object.keys(DOOR_TYPES);
  for(const k of ["varco","finestra","grata"]) assert.ok(tipi.includes(k), k);
  const wallSegs = tipi.map((k, i) => ({id:"w"+i, x:i*40, y:0, dir:"h", len:1, porta:k}));
  const doc = {schemaVersion:1, checklist:[], players:[], root:nodo({wallSegs})};
  assert.equal(prepareCampaignDocument(structuredClone(doc)).ok, true);
  assert.equal(prepareCampaignDocument({...doc, root:nodo({wallSegs:[{...wallSegs[0], porta:"botola"}]})}).ok, false);
  const out = projectForPlayers(doc).root.wallSegs;
  tipi.forEach((k, i) => assert.equal(out[i].porta, DOOR_TYPES[k].dmOnly ? undefined : k, k));
});

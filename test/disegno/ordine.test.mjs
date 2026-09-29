/* Davanti e dietro sulla tela (29 set 2026): l'ordine di disegno è l'ordine
   di `children`, e riordina lo cambia in blocco per la selezione. */
import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const { riordina, posizioneNuovoTesto } = await import(repoUrl("public/app/modello.js"));

const figli = ids => ids.map(id => ({id, type: id.startsWith("t") ? "testo" : "png"}));
const ids = arr => arr.map(c => c.id);

test("in primo piano e in fondo spostano la selezione in blocco, col suo ordine", ()=>{
  const f = figli(["a","b","c","d","e"]);
  assert.deepEqual(ids(riordina(f, ["d","b"], "davanti")), ["a","c","e","b","d"]);
  assert.deepEqual(ids(riordina(f, ["d","b"], "dietro")),  ["b","d","a","c","e"]);
});

test("niente da spostare, verso ignoto o id estranei: stesso array", ()=>{
  const f = figli(["a","b"]);
  assert.equal(riordina(f, [], "davanti"), f);
  assert.equal(riordina(f, ["a","b"], "dietro"), f);
  assert.equal(riordina(f, ["zz"], "davanti"), f);
  assert.equal(riordina(f, ["a"], "a lato"), f);
});

test("una casella nuova nasce dietro alle bolle, davanti alle altre caselle", ()=>{
  assert.equal(posizioneNuovoTesto(figli([])), 0);
  assert.equal(posizioneNuovoTesto(figli(["t1","t2","a","b"])), 2);
  assert.equal(posizioneNuovoTesto(figli(["t1","t2"])), 2);
  // Una casella portata avanti dal DM resta davanti: conta il primo non-testo.
  assert.equal(posizioneNuovoTesto(figli(["a","t1"])), 0);
});

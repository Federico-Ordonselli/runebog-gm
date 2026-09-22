/* L'editor genera i dungeon con public/app/dungeon-motore.js, che è il motore
   del sito compilato da scripts/genera-motore-dungeon.mjs. Se qualcuno tocca
   engine.ts o srd-data.ts senza rigenerare, lo stesso seed darebbe un dungeon
   nel sito e un altro nell'app: qui si genera con tutti e due e si confronta.
   Il confronto è sul RISULTATO e non sul testo del file, così non dipende da
   come esbuild impagina — e prende anche un bestiario rimasto indietro. */
import test from "node:test";
import assert from "node:assert/strict";

const repo = p => new URL("../../" + p, import.meta.url).href;
const sito = await import(repo("src/lib/dungeon/engine.ts"));
const dati = await import(repo("src/lib/dungeon/srd-data.ts"));
const app = await import(repo("public/app/dungeon-motore.js"));

const senzaData = e => JSON.stringify({...e, createdAt:null});

test("il motore dell'app è quello del sito: stessi temi e stesso bestiario", ()=>{
  assert.deepEqual(app.THEMES, sito.THEMES);
  assert.deepEqual(app.MONSTERS, dati.MONSTERS);
  assert.deepEqual(app.MAGIC_ITEMS, dati.MAGIC_ITEMS);
});

test("stesso seed, stesso dungeon, nel sito e nell'app", ()=>{
  const temi = Object.keys(sito.THEMES);
  for(let i = 0; i < 24; i++){
    const params = {
      seed: 1000 + i*7919, name: "Prova " + i, roomCount: 6 + (i % 11),
      theme: temi[i % temi.length], level: 1 + (i*3 % 20), partySize: 1 + (i % 8),
      difficulty: ["facile","medio","difficile","mortale"][i % 4], ruleset: i % 2 ? "2024" : "2014",
    };
    const a = sito.exportForRunebog(sito.generateDungeon({...params}, dati.MONSTERS, dati.MAGIC_ITEMS));
    const b = app.exportForRunebog(app.generateDungeon({...params}, app.MONSTERS, app.MAGIC_ITEMS));
    assert.equal(senzaData(b), senzaData(a), `seed ${params.seed}`);
  }
});

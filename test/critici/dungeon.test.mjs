import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "./_repo.mjs";

const { generateDungeon, exportForRunebog } = await import(repoUrl("src/lib/dungeon/engine.ts"));
const { MONSTERS, MAGIC_ITEMS } = await import(repoUrl("src/lib/dungeon/srd-data.ts"));

const params = {
  seed:123456,
  name:"Test deterministico",
  roomCount:12,
  theme:"misto",
  level:5,
  partySize:4,
  difficulty:"medio",
  ruleset:"2024",
};

test("lo stesso seed produce lo stesso dungeon byte per byte", ()=>{
  const a = generateDungeon({...params}, MONSTERS, MAGIC_ITEMS);
  const b = generateDungeon({...params}, MONSTERS, MAGIC_ITEMS);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test("un seed diverso cambia il risultato", ()=>{
  const a = generateDungeon({...params}, MONSTERS, MAGIC_ITEMS);
  const b = generateDungeon({...params, seed:params.seed+1}, MONSTERS, MAGIC_ITEMS);
  assert.notEqual(JSON.stringify(a), JSON.stringify(b));
});

test("stanze, porte e connessioni restano dentro la griglia", ()=>{
  const d = generateDungeon({...params}, MONSTERS, MAGIC_ITEMS);
  for(const room of d.rooms){
    assert.ok(room.x >= 0 && room.y >= 0);
    assert.ok(room.x + room.w <= d.gridW);
    assert.ok(room.y + room.h <= d.gridH);
  }
  for(const door of d.doors){
    assert.ok(door.x >= 0 && door.x < d.gridW);
    assert.ok(door.y >= 0 && door.y < d.gridH);
    assert.ok(d.rooms.some(room=>room.id === door.room));
  }
  for(const [a,b] of d.connections){
    assert.ok(d.rooms.some(room=>room.id === a));
    assert.ok(d.rooms.some(room=>room.id === b));
  }
});

test("ogni mostro esportato proviene dal bestiario usato dal generatore", ()=>{
  const d = generateDungeon({...params}, MONSTERS, MAGIC_ITEMS);
  const exported = exportForRunebog(d);
  const names = new Set(MONSTERS.map(monster=>monster.name));
  for(const room of exported.rooms)
    for(const monster of room.encounter?.monsters || [])
      assert.ok(names.has(monster.name), `Mostro non trovato: ${monster.name}`);
});

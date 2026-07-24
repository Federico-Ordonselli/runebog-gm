import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "./_repo.mjs";

const { sanitizeState, CELL } = await import(repoUrl("public/app/modello.js"));

function state(){
  return {
    root:{
      id:"root');alert(1)//", title:"X", type:"zona", children:[], edges:[],
      img:'x" onerror="alert(1)', color:"red;position:fixed",
      wallSegs:[
        {id:"bad", x:null, y:0, dir:"h", len:2},
        {id:"huge", x:41, y:79, dir:"x", len:999999, porta:"inventata"},
      ],
      monster:{foes:[{id:"foe');x", name:"X", hp:1, hpMax:1}]},
      battle:{order:[{id:"turn');x", playerId:"pg');x"}]},
    },
    checklist:[],
    players:[{id:"pg');x", name:"Ada", cls:"", hp:1, hpMax:1, notes:""}],
  };
}

test("sanitizeState rende sicuri ID e riferimenti in modo coerente", ()=>{
  const value = state();
  value.root.playerId = value.players[0].id;
  sanitizeState(value);
  assert.match(value.root.id, /^[\w-]+$/);
  assert.equal(value.root.playerId, value.players[0].id);
  assert.equal(value.root.monster.foes[0].id.includes("'"), false);
  assert.equal(value.root.battle.order[0].playerId, value.players[0].id);
});

test("URL e colori ostili vengono rimossi", ()=>{
  const value = state();
  sanitizeState(value);
  assert.equal(value.root.img, null);
  assert.equal("color" in value.root, false);
});

test("muri incompleti cadono; gli altri vengono limitati e agganciati", ()=>{
  const value = state();
  sanitizeState(value);
  assert.equal(value.root.wallSegs.length, 1);
  const wall = value.root.wallSegs[0];
  assert.equal(wall.x % CELL, 0);
  assert.equal(wall.y % CELL, 0);
  assert.equal(wall.dir, "h");
  assert.equal(wall.len, 200);
  assert.equal("porta" in wall, false);
});

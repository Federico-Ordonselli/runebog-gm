import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "./_repo.mjs";

const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

function baseNode(over = {}){
  return {
    id:"root", title:"Radice", type:"zona", status:"",
    notes:"SEGRETO RADICE", playerNotes:"Nota pubblica radice", img:null,
    children:[], edges:[], x:null, y:null, shape:null,
    ...over,
  };
}

function sensitiveCampaign(){
  const hidden = baseNode({
    id:"hidden", title:"Boss nascosto", type:"encounter", shared:false,
    notes:"IL BOSS È UN DRAGO",
    monster:{
      ac:"99", actions:"ALITO SEGRETO", dex:18,
      foes:[{id:"foe-secret", name:"Drago", hp:5, hpMax:100}],
    },
    futureSecret:"NON DEVE USCIRE",
  });
  const visible = baseNode({
    id:"visible", title:"Sala visibile", type:"encounter", shared:true,
    notes:"NOTA DM VISIBILE", playerNotes:"Questa sala è fredda",
    monster:{
      ac:"17", actions:"ATTACCO RISERVATO", dex:12,
      foes:[{id:"foe-visible", name:"Goblin visibile", hp:30, hpMax:100}],
    },
    wallSegs:[
      {id:"porta-segreta", x:0, y:0, dir:"h", len:1, porta:"segreta"},
      {id:"porta-normale", x:40, y:0, dir:"h", len:1, porta:"chiusa"},
    ],
  });
  const token = baseNode({
    id:"token", title:"", type:"token", shared:true,
    foe:{nodeId:"hidden", foeId:"foe-secret"}, color:"#d0765a",
  });
  const root = baseNode({
    children:[hidden, visible, token],
    edges:[
      {id:"secret-edge", a:"visible", b:"token", type:"segreto", label:"CUNICOLO SEGRETO", notes:""},
      {id:"road-edge", a:"visible", b:"token", type:"strada", label:"Passaggio", notes:"NOTA ARCO DM"},
    ],
    battle:{
      round:2, turn:0,
      order:[{id:"turn-secret", kind:"foe", nodeId:"hidden", foeId:"foe-secret", init:18}],
    },
  });
  return {
    schemaVersion:1,
    root,
    checklist:[{id:"todo", text:"Uccidere il gruppo", done:false}],
    players:[{id:"pg", name:"Ada", cls:"Ladra", hp:12, hpMax:20, notes:"Scheda del giocatore"}],
    topLevelFutureSecret:"SEGRETO FUTURO",
  };
}

test("la proiezione non include nodi non condivisi o note DM", ()=>{
  const projected = projectForPlayers(sensitiveCampaign());
  // La proiezione dichiara la versione corrente per costruzione (P0.2):
  // è ricostruita campo per campo, non copiata dal documento del DM.
  assert.equal(projected.schemaVersion, 1);
  const json = JSON.stringify(projected);
  assert.equal(json.includes("Boss nascosto"), false);
  assert.equal(json.includes("IL BOSS È UN DRAGO"), false);
  assert.equal(json.includes("NOTA DM VISIBILE"), false);
  assert.equal(json.includes("Uccidere il gruppo"), false);
  assert.equal(json.includes("SEGRETO FUTURO"), false);
  assert.equal(json.includes("NON DEVE USCIRE"), false);
  assert.equal(projected.root.notes, "Nota pubblica radice");
});

test("passaggi e porte segrete non rivelano il segreto", ()=>{
  const projected = projectForPlayers(sensitiveCampaign());
  assert.deepEqual(projected.root.edges.map(x=>x.id), ["road-edge"]);
  assert.equal(projected.root.edges[0].notes, "");
  const room = projected.root.children.find(x=>x.id === "visible");
  const secretDoor = room.wallSegs.find(x=>x.id === "porta-segreta");
  const normalDoor = room.wallSegs.find(x=>x.id === "porta-normale");
  assert.equal("porta" in secretDoor, false, "la porta segreta appare come muro pieno");
  assert.equal(normalDoor.porta, "chiusa");
});

test("PF e statistiche dei nemici non escono, ma lo stato pubblico sì", ()=>{
  const projected = projectForPlayers(sensitiveCampaign());
  const json = JSON.stringify(projected);
  assert.equal(json.includes('"hp":5'), false);
  assert.equal(json.includes('"hpMax":100'), false);
  assert.equal(json.includes('"ac":"99"'), false);
  assert.equal(json.includes("ALITO SEGRETO"), false);
  assert.equal(json.includes("ATTACCO RISERVATO"), false);
  assert.equal(json.includes("malconcio"), true);
});

test("riferimenti riservati sono risolti a nomi, non spediti come ID", ()=>{
  const projected = projectForPlayers(sensitiveCampaign());
  const token = projected.root.children.find(x=>x.id === "token");
  assert.equal(token.title, "Drago");
  assert.equal("foe" in token, false);
  const entry = projected.root.battle.order[0];
  assert.equal(entry.name, "Drago");
  assert.equal("nodeId" in entry, false);
  assert.equal("foeId" in entry, false);
});

test("la proiezione è una whitelist anche per campi futuri", ()=>{
  const projected = projectForPlayers(sensitiveCampaign());
  assert.equal("topLevelFutureSecret" in projected, false);
  assert.equal("futureSecret" in projected.root, false);
  for(const child of projected.root.children)
    assert.equal("futureSecret" in child, false);
});

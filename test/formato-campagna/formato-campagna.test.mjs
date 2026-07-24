/* Il contratto del documento campagna.
   I casi "v0 senza …" non sono ipotesi: sono le forme che l'editor tratta oggi
   come legittime, misurate contro il codice che le rende (vedi i commenti in
   migrateV0ToV1). Ognuna deve MIGRARE, non essere rifiutata — un contratto che
   dichiara invalido ciò che l'app disegna da sempre rende inapribile il lavoro
   di chi ci ha giocato. */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  CURRENT_CAMPAIGN_SCHEMA_VERSION,
  CAMPAIGN_LIMITS,
  utf8ByteLength,
  scanJsonLimits,
  prepareCampaignDocument,
  parseCampaignJson,
} from "../../public/app/formato-campagna.js";

const fixture = async name =>
  JSON.parse(await readFile(new URL(`../fixtures/${name}`, import.meta.url), "utf8"));

function node(id, children = []){
  return {
    id, title:id, type:"zona", status:"", notes:"", img:null,
    children, edges:[], x:null, y:null, shape:null,
  };
}

function campaign(root = node("root")){
  return {schemaVersion:1, root, checklist:[], players:[]};
}

test("misura byte UTF-8 reali, non code unit JavaScript", ()=>{
  assert.equal("è".length, 1);
  assert.equal(utf8ByteLength("è"), 2);
  assert.equal(utf8ByteLength("🎲"), 4);
});

test("migra una fixture v0 reale allo schema corrente", async ()=>{
  const legacy = await fixture("campaign-v0-legacy.json");
  const result = prepareCampaignDocument(legacy);
  assert.equal(result.ok, true);
  assert.equal(result.migrated, true);
  assert.equal(result.fromVersion, 0);
  assert.equal(result.value.schemaVersion, CURRENT_CAMPAIGN_SCHEMA_VERSION);
  assert.equal(result.value.players[0].hp, 20);
  assert.equal(result.value.checklist[0].done, false);
  assert.equal(result.value.root.children[0].notes, "");
});

test("accetta la fixture completa v1", async ()=>{
  const current = await fixture("campaign-v1-complex.json");
  const result = prepareCampaignDocument(current);
  assert.equal(result.ok, true);
  assert.equal(result.migrated, false);
  assert.equal(result.stats.nodes, 3);
});

/* ---- le forme storiche che DEVONO passare, migrando ---- */

test("v0 senza opacity dello sfondo: è uno sfondo al 60%, non uno rotto", ()=>{
  // mappa.js e pannello.js scrivono entrambi `bg.opacity ?? 0.6`.
  const value = {root:{...node("root"), bg:{img:"https://e.it/a.png", x:0, y:0, w:10, h:10}},
                 checklist:[], players:[]};
  const result = prepareCampaignDocument(value);
  assert.equal(result.ok, true, result.error?.code);
  assert.equal(result.value.root.bg.opacity, 0.6);
});

test("v0 senza type: la bolla usciva come segnalino nota, la radice come zona", ()=>{
  // isMarker in modello.js è `!(type==="zona" || type==="luogo")`: senza type
  // dava true, e nodeColor ripiegava su TYPES.nota.
  const figlio = node("figlio"); delete figlio.type;
  const radice = node("root"); delete radice.type;
  radice.children = [figlio];
  const result = prepareCampaignDocument({root:radice, checklist:[], players:[]});
  assert.equal(result.ok, true, result.error?.code);
  assert.equal(result.value.root.type, "zona");
  assert.equal(result.value.root.children[0].type, "nota");
});

test("v0 senza id: checklist, giocatori, archi e nemici ne ricevono uno", ()=>{
  // Due voci senza id sono la STESSA voce per `x.id !== c.id` (checklist.js):
  // cancellarne una le cancellava entrambe.
  const radice = node("root");
  radice.edges = [{a:"root", b:"root", type:"strada", label:"", notes:""}];
  radice.monster = {foes:[{name:"Ratto", hp:7, hpMax:7}]};
  const result = prepareCampaignDocument({
    root: radice,
    checklist: [{text:"prima", done:false}, {text:"seconda", done:false}],
    players: [{name:"Ari"}],
  });
  assert.equal(result.ok, true, result.error?.code);
  const [a, b] = result.value.checklist;
  assert.ok(a.id && b.id && a.id !== b.id, "due voci, due id distinti");
  assert.ok(result.value.players[0].id);
  assert.ok(result.value.root.edges[0].id);
  assert.ok(result.value.root.monster.foes[0].id);
});

test("v0 senza titolo: resta senza titolo, non diventa invalida", ()=>{
  const radice = node("root"); delete radice.title;
  const result = prepareCampaignDocument({root:radice, checklist:[], players:[]});
  assert.equal(result.ok, true, result.error?.code);
  assert.equal(result.value.root.title, "");
});

test("un documento già v1 non viene ritoccato dalle migrazioni", ()=>{
  // I default valgono per il formato storico. Se mordessero anche a v1
  // sarebbero una riparazione continua che nasconde i difetti veri.
  const value = campaign();
  value.root.bg = {img:"https://e.it/a.png", x:0, y:0, w:10, h:10};
  const result = prepareCampaignDocument(value);
  assert.equal(result.ok, false);
  assert.equal(result.error.path, "$.root.bg.opacity");
});

test("rifiuta uno schema futuro senza tentare downgrade", ()=>{
  const value = campaign();
  value.schemaVersion = CURRENT_CAMPAIGN_SCHEMA_VERSION + 1;
  const result = prepareCampaignDocument(value);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "future_schema_version");
});

test("rifiuta JSON malformato in modo controllato", ()=>{
  const result = parseCampaignJson('{"root":');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_json");
});

test("rifiuta un campo ignoto estremamente profondo", ()=>{
  const value = campaign();
  let cursor = value;
  for(let i=0; i<CAMPAIGN_LIMITS.genericDepth+2; i++)
    cursor = cursor.unknown = {};
  const result = scanJsonLimits(value);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "json_too_deep");
});

test("rifiuta un albero campagna oltre la profondità ammessa senza ricorsione", ()=>{
  const root = node("n0");
  let cursor = root;
  for(let i=1; i<CAMPAIGN_LIMITS.treeDepth+3; i++){
    const child = node(`n${i}`);
    cursor.children.push(child);
    cursor = child;
  }
  const result = prepareCampaignDocument(campaign(root));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "tree_too_deep");
});

test("rifiuta ID duplicati", ()=>{
  const result = prepareCampaignDocument(campaign(node("root", [node("dup"), node("dup")])));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "duplicate_node_id");
});

test("rifiuta immagini con MIME non ammesso", ()=>{
  const value = campaign();
  value.root.img = "data:text/html;base64,PGgxPm5vPC9oMT4=";
  const result = prepareCampaignDocument(value);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_image_type");
});

test("rifiuta un'immagine che uscirebbe dall'attributo src", ()=>{
  /* Il contratto deve restare almeno stretto quanto `safeUrl` (modello.js,
     share.ts), sennò un documento sarebbe "valido" e comunque impresentabile —
     e prima o poi qualcuno tratterebbe la validità come permesso di stampare. */
  const value = campaign();
  value.root.img = 'https://e.it/a.png" onerror="alert(1)';
  const result = prepareCampaignDocument(value);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "invalid_image");
});

test("accetta lo sfondo che genera il dungeon (data:image/svg+xml;utf8)", ()=>{
  const value = campaign();
  value.root.bg = {
    img: "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    x:0, y:0, w:40, h:40, opacity:0.7,
  };
  assert.equal(prepareCampaignDocument(value).ok, true);
});

test("rifiuta muri capaci di produrre geometria non finita o enorme", ()=>{
  const value = campaign();
  value.root.wallSegs = [{id:"w", x:0, y:0, dir:"h", len:1000000000}];
  const result = prepareCampaignDocument(value);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "number_out_of_range");
  assert.equal(result.error.path, "$.root.wallSegs[0].len");
});

test("rifiuta testi oltre il limite del campo prima della proiezione", ()=>{
  const value = campaign();
  value.root.title = "x".repeat(CAMPAIGN_LIMITS.titleChars + 1);
  const result = prepareCampaignDocument(value);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "text_too_long");
});

test("rifiuta documenti oltre il limite usando byte reali", ()=>{
  const children = Array.from({length:17}, (_, i)=>{
    const child = node(`n-${i}`);
    child.notes = "🎲".repeat(Math.floor(CAMPAIGN_LIMITS.longTextChars / 2));
    return child;
  });
  const value = campaign(node("root", children));
  const result = prepareCampaignDocument(value);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, "document_too_large");
});

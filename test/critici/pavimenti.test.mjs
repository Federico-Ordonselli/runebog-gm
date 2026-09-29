/* I materiali del pavimento (`n.pavimenti`, 29 set 2026): un elenco di celle
   per materiale accanto ai corridoi. Il nome del materiale finisce in un
   url(#mat-…) e in un href, quindi è una whitelist, e la bonifica è UNA per
   app e tavolo. */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { repoUrl } from "./_repo.mjs";

const { prepareCampaignDocument, normalizzaPavimento, normalizzaCorridoi, MATERIALI, CAMPAIGN_LIMITS } =
  await import(repoUrl("public/app/formato-campagna.js"));
const { sanitizeState, celleDelPavimento, bordoCorridoi, GRIGLIA_BASE } =
  await import(repoUrl("public/app/modello.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

const nodo = (over = {}) => ({id:"root", title:"R", type:"zona", status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...over});
const campagna = root => ({schemaVersion:1, root, checklist:[], players:[]});

test("MATERIALI coincide con le texture in public/app/materiali", ()=>{
  const dir = fileURLToPath(repoUrl("public/app/materiali/"));
  const file = readdirSync(dir).filter(f => f.endsWith(".webp"))
    .map(f => f.replace(/\.webp$/, "")).sort();
  assert.deepEqual([...MATERIALI].sort(), file);
  for(const m of MATERIALI) assert.match(m, /^[a-z-]+$/, "il nome entra in un id e in un url");
});

test("il contratto accetta i materiali noti e rifiuta il resto", ()=>{
  assert.equal(prepareCampaignDocument(campagna(nodo({pavimenti:{"acqua-bassa":[[0,0]], lava:[[1,0]]}}))).ok, true);
  const casi = [
    [{"x) url(evil":[[0,0]]}, "invalid_floor_material"],
    [{__proto__:null, veleno:[[0,0]]}, "invalid_floor_material"],
    [[[0,0]], "invalid_floor"],
    [{erba:[[0,0,1]]}, "invalid_corridor_cell"],
    [{erba:[[0.5,0]]}, null],
  ];
  for(const [pav, codice] of casi){
    const r = prepareCampaignDocument(campagna(nodo({pavimenti:pav})));
    assert.equal(r.ok, false, JSON.stringify(pav));
    if(codice) assert.equal(r.error.code, codice, JSON.stringify(pav));
  }
  // Il tetto vale per tutte le celle insieme, corridoi compresi.
  const n = CAMPAIGN_LIMITS.corridoiPerNode;
  const corr = Array.from({length:n}, (_, k)=>[k, 0]);
  assert.equal(prepareCampaignDocument(campagna(nodo({corridoi:corr, pavimenti:{erba:[[0,5]]}}))).error.code, "too_many_items");
});

test("una cella sta in un elenco solo: vince il materiale, i corridoi per ultimi", ()=>{
  const p = normalizzaPavimento([[0,0],[1,0]], {lava:[[1,0],[2,0]], erba:[[2,0],[3,0]], ignoto:[[9,9]]});
  assert.deepEqual(p.corridoi, [[0,0]]);
  assert.deepEqual(p.pavimenti, {erba:[[2,0],[3,0]], lava:[[1,0]]});
  assert.deepEqual(normalizzaPavimento(undefined, "rotto"), {corridoi:[], pavimenti:{}});
});

test("una copia vecchia legge i corridoi e lascia stare i materiali", ()=>{
  // È la ragione della forma: la bonifica di ieri guarda solo `corridoi`.
  const n = nodo({corridoi:[[0,0]], pavimenti:{acqua:[[1,1]]}});
  assert.deepEqual(normalizzaCorridoi(n.corridoi), [[0,0]]);
});

test("sanitizeState bonifica i materiali; il bordo circonda tutto il pavimento", ()=>{
  const s = {root:nodo({corridoi:[[0,0]], pavimenti:{erba:[[0,0],[1,0],["x",2]], 'a"b':[[5,5]]}})};
  sanitizeState(s);
  assert.equal("corridoi" in s.root, false, "la cella doppia resta all'erba");
  assert.deepEqual(s.root.pavimenti, {erba:[[0,0],[1,0]]});
  assert.equal(celleDelPavimento(s.root).length, 2);
  // Fra erba e velato non c'è muro: il bordo è quello dell'unione.
  const misto = nodo({corridoi:[[0,0]], pavimenti:{erba:[[1,0]]}});
  assert.equal(bordoCorridoi(GRIGLIA_BASE, celleDelPavimento(misto)).length, 4);
});

test("il tavolo riceve i materiali bonificati", ()=>{
  const out = projectForPlayers(campagna(nodo({pavimenti:{"acqua-profonda":[[2,3]], "<script>":[[0,0]]}})));
  assert.deepEqual(out.root.pavimenti, {"acqua-profonda":[[2,3]]});
  assert.equal("pavimenti" in projectForPlayers(campagna(nodo())).root, false);
});

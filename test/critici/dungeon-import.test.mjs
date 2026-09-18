import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { repoUrl } from './_repo.mjs';

const model = await import(repoUrl('public/app/modello.js'));
const { generateDungeon, exportForRunebog } = await import(repoUrl('src/lib/dungeon/engine.ts'));
const { MONSTERS, MAGIC_ITEMS } = await import(repoUrl('src/lib/dungeon/srd-data.ts'));
const harness = { st:{}, alerts:[], saves:0, enters:0 };
globalThis.__dungeonTest = harness;
globalThis.window = { SRD_MONSTERS:[] };
// Solo i confini UI sono simulati; conversione, modello, validatori e
// creazione/rendering dei nemici sono gli stessi moduli dell'app.
async function moduleWithUIStubs(path, prelude, keep){
  let source = await readFile(new URL(repoUrl(path)), 'utf8');
  source = source.replace(/^import .* from "(.+)";$/gm, (line, rel)=>{
    const name=rel.split('/').pop();
    return keep.includes(name) ? line.replace(rel,repoUrl('public/app/'+name)) : '';
  });
  return import('data:text/javascript;base64,'+Buffer.from(prelude+'\n'+source).toString('base64'));
}
const foes = await moduleWithUIStubs('public/app/mostri.js', 'const foesInCampo=()=>0; const secOpen=()=>true; const secShow=()=>true;', ['modello.js']);
globalThis.__dungeonFoes = foes;
const { importDungeon } = await moduleWithUIStubs('public/app/dungeon.js', `
const { st } = globalThis.__dungeonTest;
const RO=false;
const currentNode=()=>st.state.root;
const save=()=>globalThis.__dungeonTest.saves++;
const enterNode=()=>globalThis.__dungeonTest.enters++;
const planFit=()=>{};
const openAlert=msg=>globalThis.__dungeonTest.alerts.push(msg);
const {newFoe,statblockSRD}=globalThis.__dungeonFoes;
`, ['modello.js','dungeon-muri.js','dungeon-nomi.js','dungeon-formato.js','formato-campagna.js']);

function exported(){
  return exportForRunebog(generateDungeon({seed:123456,name:'Prova',roomCount:12,theme:'misto',level:5,partySize:4,difficulty:'medio',ruleset:'2024'},MONSTERS,MAGIC_ITEMS));
}
function reset(){
  harness.st.state={schemaVersion:1,root:model.node('Campagna','zona'),checklist:[],players:[{id:'pg1',name:'Ada',cls:'',notes:'',hp:12,hpMax:12}]};
  harness.alerts=[]; harness.saves=0; harness.enters=0;
}

test('export reale importabile; nemici reali e pedine collegate ai PG',()=>{
  reset(); importDungeon(JSON.stringify(exported()));
  assert.deepEqual(harness.alerts,[]);
  assert.equal(harness.saves,1); assert.equal(harness.enters,1);
  const dungeon=harness.st.state.root.children[0];
  assert.equal(dungeon.children.find(n=>n.type==='token').playerId,'pg1');
  assert.ok(dungeon.children.some(r=>r.children.some(n=>n.monster?.foes.length)));
});

test('input ostili o fuori limite non modificano né salvano la campagna',()=>{
  const mutations = [
    d=>{const m=d.rooms.find(r=>r.encounter).encounter.monsters[0]; m.name='Non SRD'; m.hp='\"><img src=x onerror=alert(1)>';},
    d=>{d.rooms.find(r=>r.encounter).encounter.monsters[0].count=1000000000;},
    d=>{d.grid.width='\" onload=alert(1)';},
    d=>{d.grid.rows[0]='2'.repeat(501);},
    d=>{d.rooms[0].rect.w=-1;},
    d=>{d.rooms[0].features=[{}];},
    d=>{d.rooms[0].name='x'.repeat(501);}, // rifiuto del documento risultante
    d=>{d.connections=[['missing',d.rooms[0].id]];},
  ];
  for(const mutate of mutations){
    reset(); const before=JSON.stringify(harness.st.state);
    const data=exported(); mutate(data); importDungeon(JSON.stringify(data));
    assert.equal(harness.alerts.length,1);
    assert.equal(JSON.stringify(harness.st.state),before);
    assert.equal(harness.saves,0); assert.equal(harness.enters,0);
  }
});

test('i PF ostili non diventano markup neppure aggirando il percorso di import',()=>{
  const hostile='\"><img src=x onerror=alert(1)>';
  assert.equal(foes.newFoe('Prova',hostile).hp,1);
  const n=model.node('Prova','encounter');
  n.monster={foes:[{id:'foe1',name:'Prova',hp:hostile,hpMax:hostile}]};
  const html=foes.statblockHTML(n);
  assert.equal(html.includes('<img'),false);
  assert.equal(html.includes(hostile),false);
});


test('il limite cumulativo della campagna viene verificato prima di inserire il dungeon',()=>{
  reset();
  harness.st.state.root.children=Array.from({length:600},()=>model.node('Luogo','luogo'));
  const before=JSON.stringify(harness.st.state);
  importDungeon(JSON.stringify(exported()));
  assert.equal(harness.alerts.length,1);
  assert.equal(JSON.stringify(harness.st.state),before);
  assert.equal(harness.saves,0);
});

test('JSON malformato e troppo grande vengono rifiutati senza effetti',()=>{
  for(const text of ['{', ' '.repeat(4*1024*1024), 'null']){
    reset(); const before=JSON.stringify(harness.st.state);
    importDungeon(text);
    assert.equal(harness.alerts.length,1);
    assert.equal(JSON.stringify(harness.st.state),before);
  }
});

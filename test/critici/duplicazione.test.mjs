import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicaNodi } from '../../public/app/duplica.js';
import { node } from '../../public/app/modello.js';

function fixture(){
  const zona=node('Zona','zona'), incontro=node('Nemici','encounter'), pedina=node('Nemico','token');
  incontro.monster={foes:[{id:'nemico',name:'Orco',hp:12,hpMax:20}]};
  pedina.foe={nodeId:incontro.id,foeId:'nemico'};
  zona.children=[incontro,pedina];
  zona.battle={round:2,turn:1,order:[{id:'turno1',kind:'foe',...pedina.foe,init:18},{id:'turno2',kind:'pg',playerId:'pg',init:10}]};
  zona.edges=[{id:'arco',a:incontro.id,b:pedina.id}];
  zona.wallSegs=[{id:'muro',x:0,y:0,dir:'h',len:2}];
  return zona;
}
test('la zona copiata risolve PF e iniziativa senza l’originale',()=>{
  const originale=fixture(), prima=JSON.stringify(originale);
  const {copie:[c]}=duplicaNodi([originale]);
  const [incontro,pedina]=c.children, f=incontro.monster.foes[0];
  assert.equal(pedina.foe.nodeId,incontro.id); assert.equal(pedina.foe.foeId,f.id);
  assert.equal(c.battle.order[0].nodeId,incontro.id); assert.equal(c.battle.order[0].foeId,f.id);
  assert.equal(c.battle.order[1].playerId,'pg'); assert.equal(c.battle.turn,1);
  assert.equal(c.edges[0].a,incontro.id); assert.equal(c.edges[0].b,pedina.id);
  for(const [a,b] of [[c,originale],[f,originale.children[0].monster.foes[0]],[c.wallSegs[0],originale.wallSegs[0]],[c.battle.order[0],originale.battle.order[0]]]) assert.notEqual(a.id,b.id);
  f.hp=3; assert.equal(originale.children[0].monster.foes[0].hp,12);
  assert.equal(JSON.stringify(originale),prima);
});
test('più nodi selezionati insieme rimappano i riferimenti fra fratelli',()=>{
  const z=fixture(); const {copie:[e,p]}=duplicaNodi(z.children);
  assert.equal(p.foe.nodeId,e.id); assert.equal(p.foe.foeId,e.monster.foes[0].id);
});
test('duplicare solo una pedina conserva il riferimento all’incontro esterno',()=>{
  const z=fixture(); const {copie:[p]}=duplicaNodi([z.children[1]]);
  assert.deepEqual(p.foe,z.children[1].foe);
});

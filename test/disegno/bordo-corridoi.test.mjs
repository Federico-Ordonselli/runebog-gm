/* Il bordo del pavimento dipinto e il secchiello (29 set 2026): muri
   derivati dalle celle, tolti dove c'è una pianta o un muro libero. */
import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const { bordoCorridoi, riempiArea, GRIGLIA_BASE } = await import(repoUrl("public/app/modello.js"));
const g = GRIGLIA_BASE, C = g.cella;
const ordina = segs => segs.map(s => s.join(" ")).sort();

test("una cella sola ha quattro lati, una fila si fonde in due linee più i capi", ()=>{
  assert.equal(bordoCorridoi(g, [[0,0]]).length, 4);
  const fila = bordoCorridoi(g, [[0,0],[1,0],[2,0]]);
  assert.deepEqual(ordina(fila), ordina([[0,0,3*C,0],[0,C,3*C,C],[0,0,0,C],[3*C,0,3*C,C]]));
});

test("una cella cancellata in mezzo resta murata da sola", ()=>{
  const celle = [];
  for(let i=0;i<3;i++) for(let j=0;j<3;j++) if(i!==1 || j!==1) celle.push([i,j]);
  const segs = bordoCorridoi(g, celle);
  // il buco al centro: quattro lati da un quadretto attorno a (1,1)
  for(const s of [[C,C,2*C,C],[C,2*C,2*C,2*C],[C,C,C,2*C],[2*C,C,2*C,2*C]])
    assert.ok(ordina(segs).includes(s.join(" ")), s.join(" "));
});

test("regola 1: niente muro sul lato che confina con una pianta", ()=>{
  const stanza = {x:2*C, y:-C, w:3*C, h:3*C};
  const segs = bordoCorridoi(g, [[0,0],[1,0]], {stanze:[stanza]});
  assert.ok(!segs.some(s => s[0]===2*C && s[2]===2*C), "il lato verso la stanza resta aperto");
  assert.equal(segs.length, 3);
});

test("regola 2: niente muro dove c'è già un muro libero, porta compresa", ()=>{
  const porta = {id:"p", x:2*C, y:0, dir:"v", len:1, porta:"chiusa"};
  const segs = bordoCorridoi(g, [[0,0],[1,0]], {muri:[porta]});
  assert.ok(!segs.some(s => s[0]===2*C && s[2]===2*C));
  // un muro più corto del lato non lo copre (esagoni, maglie diverse)
  const corto = bordoCorridoi({...g, cella:C}, [[0,0]], {muri:[{id:"m", x:0, y:0, dir:"h", len:0.5}]});
  assert.equal(corto.length, 4);
});

test("negli esagoni i lati condivisi spariscono", ()=>{
  const hex = {forma:"hex-punta", cella:40, metri:1.5};
  assert.equal(bordoCorridoi(hex, [[0,0]]).length, 6);
  assert.equal(bordoCorridoi(hex, [[0,0],[1,0]]).length, 10);
});

test("il secchiello riempie l'interno di un perimetro chiuso di muri", ()=>{
  const muri = [
    {id:"n", x:0,   y:0,   dir:"h", len:3}, {id:"s", x:0, y:2*C, dir:"h", len:3},
    {id:"o", x:0,   y:0,   dir:"v", len:2}, {id:"e", x:3*C, y:0, dir:"v", len:2},
  ];
  const r = riempiArea(g, [], C*1.5, C*0.5, {muri});
  assert.equal(r.esito, "ok");
  assert.equal(r.nuove.length, 6);
  // e il bordo di quel pavimento è tutto coperto dai muri: niente doppioni
  assert.equal(bordoCorridoi(g, r.nuove, {muri}).length, 0);
});

test("un perimetro aperto non dipinge niente, una pianta non si riempie", ()=>{
  const muri = [{id:"n", x:0, y:0, dir:"h", len:3}];
  assert.deepEqual(riempiArea(g, [], 10, 10, {muri}, 50), {esito:"aperta", nuove:[]});
  assert.equal(riempiArea(g, [], 10, 10, {stanze:[{x:0,y:0,w:C*2,h:C*2}]}).esito, "pianta");
});

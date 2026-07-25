/* Le pareti che l'import del dungeon costruisce attorno alle stanze.
   È geometria pura (nessun DOM, nessuno stato), quindi si prova qui invece che
   a mano nel browser: gli errori di questa classe — un muro spostato di mezzo
   quadretto, una porta murata — sono invisibili in un JSON e ovvi solo dopo
   averci giocato sopra. */
import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const { muriDelleStanze } = await import(repoUrl("public/app/dungeon-muri.js"));
const { CELL, WALL_MIN, WALL_MAX } = await import(repoUrl("public/app/modello.js"));
const { CAMPAIGN_LIMITS } = await import(repoUrl("public/app/formato-campagna.js"));
const { generateDungeon, exportForRunebog } = await import(repoUrl("src/lib/dungeon/engine.ts"));
const { MONSTERS, MAGIC_ITEMS } = await import(repoUrl("src/lib/dungeon/srd-data.ts"));

/* Un muro in una riga, id escluso: gli id sono casuali e non sono il dato. */
const chiave = m => `${m.dir} ${m.x},${m.y} +${m.len}${m.porta ? " " + m.porta : ""}`;
const chiavi = muri => muri.map(chiave).sort();

/* Stanza 3×2 con l'angolo in (2,2), in mezzo alla roccia. */
const STANZA = {x:2, y:2, w:3, h:2};
const rocciaAttorno = (sopra = "00000000") => [
  "00000000",
  sopra,
  "00111000",
  "00111000",
  "00000000",
  "00000000",
];

test("una stanza isolata esce con quattro pareti intere", ()=>{
  const muri = muriDelleStanze(rocciaAttorno(), [STANZA]);
  assert.deepEqual(chiavi(muri), chiavi([
    {dir:"h", x:80,  y:80,  len:3},   // nord
    {dir:"h", x:80,  y:160, len:3},   // sud
    {dir:"v", x:80,  y:80,  len:2},   // ovest
    {dir:"v", x:200, y:80,  len:2},   // est
  ]));
});

test("una stanza sul bordo della griglia ha comunque le sue pareti", ()=>{
  // Fuori dalla mappa è roccia: senza, l'angolo in alto a sinistra resterebbe aperto.
  const muri = muriDelleStanze(["11", "11"], [{x:0, y:0, w:2, h:2}]);
  assert.equal(muri.length, 4);
  assert.equal(muri.filter(m=>m.porta).length, 0);
});

test("una porta a metà lato spezza la parete in due tratti e un quadretto", ()=>{
  const muri = muriDelleStanze(rocciaAttorno("00030000"), [STANZA]);
  const nord = muri.filter(m=>m.dir==="h" && m.y===80);
  assert.deepEqual(chiavi(nord), chiavi([
    {dir:"h", x:80,  y:80, len:1},
    {dir:"h", x:120, y:80, len:1, porta:"chiusa"},
    {dir:"h", x:160, y:80, len:1},
  ]));
});

test("una porta in testa al lato non lascia un muro lungo zero", ()=>{
  const muri = muriDelleStanze(rocciaAttorno("00300000"), [STANZA]);
  const nord = muri.filter(m=>m.dir==="h" && m.y===80);
  assert.deepEqual(chiavi(nord), chiavi([
    {dir:"h", x:80,  y:80, len:1, porta:"chiusa"},
    {dir:"h", x:120, y:80, len:2},
  ]));
  for(const m of muri) assert.ok(m.len >= WALL_MIN, `muro lungo ${m.len}`);
});

test("un corridoio che costeggia la stanza non la apre: solo la cella porta apre", ()=>{
  // Le celle 2 sono pavimento di corridoio, non soglie: il motore marca 3 una
  // cella per lato, ed è quella l'unica che deve diventare una porta. Qui la
  // stanza ha già la sua porta a sud, quindi il corridoio che le corre sopra
  // resta parete — un corridoio lungo il fianco non è un fianco aperto.
  const rows = ["00000000", "00222000", "00111000", "00111000", "00030000", "00000000"];
  const muri = muriDelleStanze(rows, [STANZA]);
  assert.deepEqual(chiavi(muri.filter(m=>m.dir==="h" && m.y===80)), chiavi([
    {dir:"h", x:80, y:80, len:3},
  ]));
  assert.equal(muri.filter(m=>m.porta).length, 1);
});

test("una porta per lato: quattro lati aperti restano quattro porte", ()=>{
  const rows = [
    "00000000",
    "00030000",
    "03111000",
    "00111300",
    "00030000",
    "00000000",
  ];
  const porte = muriDelleStanze(rows, [STANZA]).filter(m=>m.porta);
  assert.equal(porte.length, 4);
  for(const p of porte) assert.equal(p.len, 1);   // una porta è larga un quadretto
});

test("una stanza senza celle porta si apre dove passa il corridoio", ()=>{
  // Il caso vero: una soglia stretta fra due stanze viene marcata `3` per la
  // prima e l'altra resta con solo corridoio addosso. Senza la rete, quella
  // stanza esce sigillata — trovato a occhio col seed 20260725 (sotto).
  const muri = muriDelleStanze(rocciaAttorno("00020000"), [STANZA]);
  const porte = muri.filter(m=>m.porta);
  assert.equal(porte.length, 1, "una sola: quanto serve per entrare");
  assert.deepEqual(chiavi(porte), chiavi([{dir:"h", x:120, y:80, len:1, porta:"chiusa"}]));
});

test("la rete non si sostituisce alle porte vere: se ce n'è una, il corridoio resta muro", ()=>{
  // `3` sul lato nord e `2` addosso al lato sud: la porta è una, quella dichiarata.
  const rows = ["00000000", "00030000", "00111000", "00111000", "00222000", "00000000"];
  const porte = muriDelleStanze(rows, [STANZA]).filter(m=>m.porta);
  assert.deepEqual(chiavi(porte), chiavi([{dir:"h", x:120, y:80, len:1, porta:"chiusa"}]));
});

test("una stanza che nessun corridoio tocca resta murata, e va bene così", ()=>{
  // Non c'è niente da aprire: inventare una porta sulla roccia sarebbe peggio
  // del muro, perché prometterebbe un passaggio che non esiste.
  assert.equal(muriDelleStanze(rocciaAttorno(), [STANZA]).filter(m=>m.porta).length, 0);
});

test("un rettangolo che non è un rettangolo non produce pareti", ()=>{
  // Il JSON arriva dagli appunti: forma valida non vuol dire dato sano. Un lato
  // da un miliardo di quadretti non deve diventare un ciclo per cella.
  const malati = [null, undefined, {}, {x:0,y:0,w:0,h:3}, {x:0,y:0,w:1e9,h:1e9},
    {x:NaN,y:0,w:2,h:2}, {x:0,y:0,w:"3",h:"3"}, {x:0,y:0,w:WALL_MAX+1,h:2}];
  assert.deepEqual(muriDelleStanze(rocciaAttorno(), malati), []);
  // e una stanza sana in mezzo a quelle malate esce lo stesso
  assert.equal(muriDelleStanze(rocciaAttorno(), [...malati, STANZA]).length, 4);
});

test("una griglia mancante lascia le stanze murate, non le fa esplodere", ()=>{
  const muri = muriDelleStanze(undefined, [STANZA]);
  assert.equal(muri.length, 4);
  assert.equal(muri.filter(m=>m.porta).length, 0);
});

/* Il giro completo col motore vero: è l'unico controllo che vede insieme la
   griglia del generatore e la geometria di qui, cioè la coppia che un dungeon
   rotto rompe. Le taglie provate sono gli estremi che la UI concede (6 e 16
   stanze) più il default (11), che è quello con cui si sbatte davvero. */
const DUNGEON_PROVA = {name:"Prova", theme:"misto", level:5, partySize:4,
  difficulty:"medio", ruleset:"2024"};
const muriDiUnDungeon = (seed, roomCount) => {
  const dati = exportForRunebog(
    generateDungeon({...DUNGEON_PROVA, seed, roomCount}, MONSTERS, MAGIC_ITEMS));
  return {dati, muri: muriDelleStanze(dati.grid.rows, dati.rooms.map(r=>r.rect))};
};
/* Le porte di una stanza: i segmenti porta che stanno sul suo perimetro. Un
   segmento di un'altra stanza non ci finisce dentro, perché fra due stanze c'è
   sempre almeno un quadretto (è la regola con cui il motore le posa). */
const porteDi = (muri, {x, y, w, h}) => muri.filter(m => m.porta
  && m.x >= x*CELL && m.x <= (x+w)*CELL && m.y >= y*CELL && m.y <= (y+h)*CELL);

test("sui dungeon veri: muri sulla maglia, porte da un quadretto, sotto il limite del formato", ()=>{
  for(const roomCount of [6, 11, 16])
    for(let seed=1; seed<=25; seed++){
      const {muri} = muriDiUnDungeon(seed, roomCount);
      assert.ok(muri.length <= CAMPAIGN_LIMITS.wallsPerNode,
        `seed ${seed}/${roomCount}: ${muri.length} muri, oltre il limite del formato`);
      for(const m of muri){
        // Gli estremi stanno sugli incroci della maglia: un muro fuori quadretto
        // lascerebbe le pedine mezze dentro e mezze fuori dalla stanza.
        assert.equal(m.x % CELL, 0, `x fuori maglia: ${m.x}`);
        assert.equal(m.y % CELL, 0, `y fuori maglia: ${m.y}`);
        assert.ok(m.len >= WALL_MIN && m.len <= WALL_MAX, `len fuori limiti: ${m.len}`);
        if(m.porta) assert.equal(m.len, 1);
      }
    }
});

test("in nessun dungeon esce una stanza sigillata", ()=>{
  // La regressione con nome e cognome: 11 stanze, seed 20260725, la stanza in
  // basso al centro divideva la sua soglia con la vicina e usciva murata.
  for(const roomCount of [6, 11, 16])
    for(const seed of [20260725, ...Array.from({length:25}, (_, i)=>i+1)]){
      const {dati, muri} = muriDiUnDungeon(seed, roomCount);
      for(const stanza of dati.rooms)
        assert.ok(porteDi(muri, stanza.rect).length > 0,
          `seed ${seed}/${roomCount}: la stanza ${stanza.id} non ha porte`);
    }
});

/* La scala della campagna: mondo › continente › nazione › regione › quartiere ›
   edificio › stanza.

   Due cose si provano qui, e sono di natura diversa. La prima è che la catena
   sia percorribile nei due versi senza buchi né cappi: ci girano sopra lo zoom
   indietro (zoomOut in stato.js) e il doppio clic sulla tela, e nessuno dei due
   chiede niente al DM — se la scala dice una bugia, l'app la esegue in silenzio.
   La seconda è che le forme che l'app sa disegnare siano ESATTAMENTE quelle che
   il contratto accetta: una forma nota solo al disegno fa rimbalzare con 422 il
   salvataggio di una campagna legittima, e il DM lo scopre dopo averla
   costruita. L'elenco del validatore è privato al suo modulo, quindi lo si
   interroga come fa il server — validando un documento vero, forma per forma. */

import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const { SHAPES, SCALA, scalaSopra, scalaDentro, shapeType, SHAPE_COLORS, defShape } =
  await import(repoUrl("public/app/modello.js"));
const { prepareCampaignDocument, CURRENT_CAMPAIGN_SCHEMA_VERSION } =
  await import(repoUrl("public/app/formato-campagna.js"));

const documento = shape => ({
  schemaVersion: CURRENT_CAMPAIGN_SCHEMA_VERSION,
  root: {id:"radice", title:"R", type:"zona", status:"", notes:"", img:null,
         children:[], edges:[], x:null, y:null, shape},
  checklist: [], players: [],
});

test("ogni gradino della scala è una forma che esiste davvero", ()=>{
  for(const s of SCALA) assert.ok(SHAPES[s], `gradino senza forma: ${s}`);
  assert.equal(new Set(SCALA).size, SCALA.length, "un gradino ripetuto farebbe girare in tondo lo zoom");
});

test("la scala si risale fino al mondo e lì si ferma", ()=>{
  // Il capolinea NON è un dettaglio: è quello che spegne il bottone "Zoom
  // indietro". Senza, si impilerebbero contenitori senza nome sopra il mondo.
  assert.equal(scalaSopra("mondo"), null);
  assert.equal(scalaSopra("quartiere"), "regione");
  assert.equal(scalaSopra("regione"), "nazione");
  assert.equal(scalaSopra("nazione"), "continente");
  assert.equal(scalaSopra("continente"), "mondo");
  // partendo da qualsiasi gradino si arriva al mondo in un numero finito di passi
  for(const partenza of SCALA){
    let s = partenza, passi = 0;
    while(s !== null){ s = scalaSopra(s); assert.ok(++passi <= SCALA.length, `cappio da ${partenza}`); }
  }
});

test("la scala si scende fino alla stanza e lì si ferma", ()=>{
  assert.equal(scalaDentro("mondo"), "continente");
  assert.equal(scalaDentro("quartiere"), "edificio");
  assert.equal(scalaDentro("edificio"), "stanza");
  assert.equal(scalaDentro("stanza"), "stanza");     // sotto non si scende
});

test("le due direzioni sono l'una l'inversa dell'altra", ()=>{
  // È l'invariante che tiene onesta la lista unica: se un giorno tornassero due
  // elenchi separati, è qui che si vedrebbe.
  for(const s of SCALA){
    const su = scalaSopra(s);
    if(su !== null) assert.equal(scalaDentro(su), s, `${su} non ricade su ${s}`);
  }
});

test("fuori dalla scala si atterra su un gradino, mai nel vuoto", ()=>{
  // Piazza e torre non sono gradini, ma possono fare da radice in una campagna
  // importata: le due domande devono avere una risposta comunque.
  for(const s of ["piazza","torre",undefined,null,"inventata"]){
    assert.ok(SCALA.includes(scalaSopra(s)), `scalaSopra(${s}) fuori scala`);
    assert.ok(SCALA.includes(scalaDentro(s)), `scalaDentro(${s}) fuori scala`);
  }
});

test("un territorio nasce zona, una costruzione nasce luogo", ()=>{
  // addSpatialChild deriva il tipo dalla forma: sbagliarlo mette un edificio fra
  // le zone (e isMarker, che legge `type`, ne conta le conseguenze ovunque).
  for(const s of ["mondo","continente","nazione","regione","quartiere"])
    assert.equal(shapeType(s), "zona", s);
  for(const s of ["edificio","stanza","piazza","torre"])
    assert.equal(shapeType(s), "luogo", s);
  // e il default di una zona resta un gradino della scala, sennò scalaSopra
  // partirebbe da una forma che non c'è
  assert.ok(SCALA.includes(defShape({type:"zona"})));
  assert.ok(SCALA.includes(defShape({type:"luogo"})));
});

test("ogni forma disegnabile ha un colore dichiarato", ()=>{
  // La palette del livello vuoto ripiega su var(--teal) quando manca: un
  // territorio verde-acqua sembrerebbe un luogo, che è l'unica distinzione che
  // il colore porta.
  for(const s of Object.keys(SHAPES)) assert.ok(SHAPE_COLORS[s], `forma senza colore: ${s}`);
});

test("il contratto accetta tutte e sole le forme che l'app disegna", ()=>{
  for(const s of Object.keys(SHAPES)){
    const esito = prepareCampaignDocument(documento(s));
    assert.equal(esito.ok, true, `il validatore rifiuta la forma ${s}: ${esito.error?.code}`);
  }
  const esito = prepareCampaignDocument(documento("contea"));
  assert.equal(esito.ok, false);
  assert.equal(esito.error.code, "invalid_shape");
});

/* Il calendario di gioco (25 set 2026). Le cose da provare sono quelle che
   si rompono in silenzio: che giorno assoluto e data facciano andata e
   ritorno per ogni giorno di più anni (un errore di uno sposta tutti gli
   eventi di un giorno, e nessuno se ne accorge finché la festa non cade il
   giorno sbagliato); che la bonifica produca sempre un calendario che il
   contratto accetta; e che al tavolo non esca un evento solo del DM, né una
   scadenza che il DM non ha detto. */

import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const conti = await import(repoUrl("public/app/calendario-conti.js"));
const {
  calendarioPredefinito, normalizzaCalendario, normalizzaScadenza, prepareCampaignDocument,
  CURRENT_CAMPAIGN_SCHEMA_VERSION, CALENDARIO_LIMITI,
} = await import(repoUrl("public/app/formato-campagna.js"));
const { sanitizeState } = await import(repoUrl("public/app/modello.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

const harptos = () => ({
  mesi:[{nome:"Hammer",giorni:30},{nome:"",giorni:1},{nome:"Alturiak",giorni:30},{nome:"Ches",giorni:30}],
  settimana:["I","II","III","IV","V","VI","VII","VIII","IX","X"],
  annoIniziale:1492, era:"DR", oggi:1, eventi:[],
});

const documento = (extra = {}, quest = {}) => ({
  schemaVersion: CURRENT_CAMPAIGN_SCHEMA_VERSION,
  root:{id:"radice", title:"R", type:"zona", status:"", notes:"", img:null, x:null, y:null, shape:null, edges:[],
    children:[{id:"q1", title:"Il riscatto", type:"quest", status:"in corso", notes:"", img:null,
      x:0, y:0, shape:null, edges:[], children:[], shared:true, ...quest}]},
  checklist:[], players:[],
  ...extra,
});

test("giorno ↔ data fa andata e ritorno su tre anni, anche con un mese da un giorno", () => {
  for(const cal of [calendarioPredefinito(), harptos()]){
    const L = conti.lunghezzaAnno(cal);
    let prima = null;
    for(let g = 1; g <= 3 * L; g++){
      const d = conti.dataDi(cal, g);
      assert.ok(d.giorno >= 1 && d.giorno <= cal.mesi[d.mese].giorni, `giorno ${g}`);
      assert.equal(conti.giornoDi(cal, d.anno, d.mese, d.giorno), g, `giorno ${g}`);
      if(prima){
        // i giorni si susseguono: stesso mese e +1, oppure primo del mese dopo
        const dopo = conti.spostaMese(cal, prima.anno, prima.mese, 1);
        const stessoMese = d.anno === prima.anno && d.mese === prima.mese && d.giorno === prima.giorno + 1;
        const meseDopo = d.anno === dopo.anno && d.mese === dopo.mese && d.giorno === 1;
        assert.ok(stessoMese || meseDopo, `giorno ${g}`);
      }
      prima = d;
    }
  }
});

test("il giorno 1 è il primo del primo mese dell'anno iniziale", () => {
  const cal = harptos();
  assert.deepEqual(conti.dataDi(cal, 1), {anno:1492, mese:0, giorno:1});
  assert.equal(conti.formattaData(cal, 31), "1 Mese 2, 1492 DR");     // il nome vuoto ha un ripiego
  assert.equal(conti.formattaData(calendarioPredefinito(), 366), "1 Gennaio, anno 2");
  assert.equal(conti.giornoDi(cal, 1400, 0, 1), 1, "prima dell'inizio si torna al giorno 1");
  assert.equal(conti.giornoDi(cal, 1492, 0, 99), 30, "oltre la fine del mese ci si ferma all'ultimo");
});

test("spostaMese attraversa l'anno nei due versi", () => {
  const cal = harptos();
  assert.deepEqual(conti.spostaMese(cal, 1492, 3, 1), {anno:1493, mese:0});
  assert.deepEqual(conti.spostaMese(cal, 1492, 0, -1), {anno:1491, mese:3});
  assert.deepEqual(conti.spostaMese(cal, -2, 0, -9), {anno:-5, mese:3});
});

test("la settimana corre continua attraverso i mesi", () => {
  const cal = harptos();
  assert.equal(conti.giornoSettimana(cal, 1), 0);
  assert.equal(conti.giornoSettimana(cal, 31), 0);      // 30 giorni = tre decadi
  assert.equal(conti.giornoSettimana(cal, 32), 1);
});

test("le scadenze si dicono come le direbbe il DM", () => {
  assert.deepEqual(conti.scadenzaTesto(10, 15), {testo:"tra 5 giorni", stato:"lontana", giorni:5});
  assert.equal(conti.scadenzaTesto(10, 13).stato, "vicina");
  assert.equal(conti.scadenzaTesto(10, 11).testo, "scade domani");
  assert.equal(conti.scadenzaTesto(10, 10).testo, "scade oggi");
  assert.equal(conti.scadenzaTesto(10, 9).testo, "scaduta ieri");
  assert.deepEqual(conti.scadenzaTesto(10, 7), {testo:"scaduta da 3 giorni", stato:"scaduta", giorni:-3});
});

test("il calendario predefinito e ogni calendario bonificato passano il contratto", () => {
  const ostili = [
    {},
    {mesi:"dodici", settimana:null, oggi:-4, eventi:{}},
    {mesi:[{nome:7, giorni:"30"}, {nome:"Ok", giorni:5000}], annoIniziale:1.5, era:"x".repeat(99)},
    {eventi:[{id:"a", giorno:3, titolo:"x"}, {id:"a", giorno:4, titolo:"doppio"},
             {id:"x\" onclick=\"alert(1)", giorno:5, titolo:"id ostile"},
             {id:"b", giorno:0}, {id:"c", giorno:2.5}, null, {id:"d", giorno:9, visibile:"sì", note:3}]},
    {settimana:Array(50).fill("G"), mesi:Array(500).fill({nome:"M", giorni:1})},
  ];
  for(const cal of [calendarioPredefinito(), harptos(), ...ostili.map(normalizzaCalendario)]){
    const esito = prepareCampaignDocument(documento({calendario:cal}));
    assert.ok(esito.ok, JSON.stringify(esito.error));
  }
  const pulito = normalizzaCalendario(ostili[3]);
  assert.deepEqual(pulito.eventi.map(e => e.id), ["a", "d"], "doppioni, id ostili e giorni non interi cadono");
  assert.equal(pulito.eventi[1].visibile, undefined, "visibile vale solo se è true");
  const lungo = normalizzaCalendario(ostili[4]);
  assert.equal(lungo.mesi.length, CALENDARIO_LIMITI.mesi);
  assert.equal(lungo.settimana.length, CALENDARIO_LIMITI.settimana);
  assert.equal(normalizzaCalendario([]), null);
  assert.equal(normalizzaCalendario("x"), null);
});

test("il contratto rifiuta ciò che la bonifica toglierebbe", () => {
  const casi = [
    [{mesi:[]}, "empty_calendar"],
    [{settimana:[]}, "empty_week"],
    [{oggi:0}, "number_out_of_range"],
    [{mesi:[{nome:"M", giorni:1.5}]}, "expected_integer"],
    [{eventi:[{id:"e", giorno:1, titolo:""}, {id:"e", giorno:2, titolo:""}]}, "duplicate_event_id"],
    [{eventi:[{id:"e", giorno:1, titolo:"", visibile:"sì"}]}, "expected_boolean"],
  ];
  for(const [pezzo, codice] of casi){
    const esito = prepareCampaignDocument(documento({calendario:{...harptos(), ...pezzo}}));
    assert.equal(esito.ok, false, codice);
    assert.equal(esito.error.code, codice);
  }
  const scad = prepareCampaignDocument(documento({}, {scadenza:0}));
  assert.equal(scad.ok, false);
  const vis = prepareCampaignDocument(documento({}, {scadenza:4, scadenzaVisibile:1}));
  assert.equal(vis.ok, false);
  assert.ok(prepareCampaignDocument(documento({}, {scadenza:4, scadenzaVisibile:true})).ok);
});

test("una campagna senza calendario resta valida e senza campo", () => {
  const doc = documento();
  assert.ok(prepareCampaignDocument(doc).ok);
  sanitizeState(doc);
  assert.equal("calendario" in doc, false, "aprire non scrive il calendario");
  assert.deepEqual(conti.calendarioDi(doc), calendarioPredefinito());
});

test("la bonifica toglie scadenze che non sono giorni, e il flag senza scadenza", () => {
  const doc = documento({calendario:"rotto"}, {scadenza:"5", scadenzaVisibile:true});
  sanitizeState(doc);
  const q = doc.root.children[0];
  assert.equal(q.scadenza, undefined);
  assert.equal(q.scadenzaVisibile, undefined);
  assert.equal(doc.calendario, undefined);
  assert.equal(normalizzaScadenza(12), 12);
  assert.equal(normalizzaScadenza(-1), null);
});

test("al tavolo escono struttura, oggi e solo gli eventi visibili", () => {
  const cal = {...harptos(), oggi:40, eventi:[
    {id:"festa", giorno:45, titolo:"Festa del raccolto", note:"Tutti invitati", visibile:true},
    {id:"piano", giorno:41, titolo:"IL CULTO ATTACCA", note:"SEGRETO DEL DM"},
  ]};
  const tavolo = projectForPlayers(documento({calendario:cal}));
  assert.equal(tavolo.calendario.oggi, 40);
  assert.deepEqual(tavolo.calendario.mesi, cal.mesi);
  assert.deepEqual(tavolo.calendario.eventi,
    [{id:"festa", giorno:45, titolo:"Festa del raccolto", note:"Tutti invitati", visibile:true}]);
  const json = JSON.stringify(tavolo);
  assert.ok(!json.includes("CULTO") && !json.includes("SEGRETO") && !json.includes("piano"));
  assert.ok(prepareCampaignDocument(structuredClone(tavolo)).ok, "la proiezione è un documento valido");
});

test("senza calendario nel documento il tavolo non ne riceve uno", () => {
  assert.equal("calendario" in projectForPlayers(documento()), false);
});

test("la scadenza di una quest esce solo se il DM l'ha resa visibile", () => {
  const nascosta = projectForPlayers(documento({}, {scadenza:12}));
  assert.equal(nascosta.root.children[0].scadenza, undefined);
  const detta = projectForPlayers(documento({}, {scadenza:12, scadenzaVisibile:true}));
  assert.equal(detta.root.children[0].scadenza, 12);
  assert.equal(detta.root.children[0].scadenzaVisibile, undefined, "il flag è del DM, esce il giorno");
  const nonCondivisa = projectForPlayers(documento({}, {scadenza:12, scadenzaVisibile:true, shared:false}));
  assert.equal(nonCondivisa.root.children.length, 0);
});

test("le ricorrenze cadono dove le direbbe il DM", () => {
  const cal = harptos();                                    // 30 + 1 + 30 + 30 = 91 giorni
  const ev = (giorno, ripeti) => ({id:"e", giorno, titolo:"", ripeti});
  // ogni 3 giorni dal 5: 5, 8, 11…
  assert.deepEqual(conti.occorrenze(cal, ev(5, {ogni:3, unita:"giorni"}), 1, 12), [5, 8, 11]);
  // ogni settimana: la settimana di harptos è una decade
  assert.deepEqual(conti.occorrenze(cal, ev(2, {ogni:1, unita:"settimane"}), 10, 40), [12, 22, 32]);
  // ogni mese il 30: nel mese da un giorno cade sull'ultimo (il 31), non salta
  assert.deepEqual(conti.occorrenze(cal, ev(30, {ogni:1, unita:"mesi"}), 1, 91), [30, 31, 61, 91]);
  // ogni anno: stesso giorno dello stesso mese
  const festa = ev(conti.giornoDi(cal, 1492, 2, 15), {ogni:1, unita:"anni"});
  const volte = conti.occorrenze(cal, festa, 1, 3 * 91);
  assert.deepEqual(volte.map(g => conti.dataDi(cal, g)),
    [1492, 1493, 1494].map(anno => ({anno, mese:2, giorno:15})));
  // ogni 2 anni, e prima della prima volta non c'è niente
  assert.deepEqual(conti.occorrenze(cal, ev(10, {ogni:2, unita:"anni"}), 1, 5 * 91), [10, 192, 374]);
  assert.deepEqual(conti.occorrenze(cal, ev(50, {ogni:1, unita:"giorni"}), 1, 49), []);
  // senza ricorrenza: il giorno e basta
  assert.deepEqual(conti.occorrenze(cal, ev(7), 1, 91), [7]);
});

test("la prossima volta di un evento, da un giorno qualunque", () => {
  const cal = calendarioPredefinito();
  const ev = (giorno, ripeti) => ({id:"e", giorno, titolo:"", ripeti});
  assert.equal(conti.prossimaOccorrenza(cal, ev(10), 5), 10);
  assert.equal(conti.prossimaOccorrenza(cal, ev(10), 11), null, "passato e non si ripete");
  assert.equal(conti.prossimaOccorrenza(cal, ev(10, {ogni:7, unita:"giorni"}), 11), 17);
  assert.equal(conti.prossimaOccorrenza(cal, ev(10, {ogni:7, unita:"giorni"}), 17), 17);
  // il 31 gennaio ogni mese: a febbraio (28 giorni) cade il 28
  const g = conti.prossimaOccorrenza(cal, ev(31, {ogni:1, unita:"mesi"}), 32);
  assert.deepEqual(conti.dataDi(cal, g), {anno:1, mese:1, giorno:28});
  // ogni mille anni, da molto lontano: la risposta arriva e non gira a vuoto
  const lontano = conti.prossimaOccorrenza(cal, ev(1, {ogni:1000, unita:"anni"}), 2);
  assert.deepEqual(conti.dataDi(cal, lontano), {anno:1001, mese:0, giorno:1});
  assert.equal(conti.ricorrenzaTesto(ev(1, {ogni:1, unita:"anni"})), "ogni anno");
  assert.equal(conti.ricorrenzaTesto(ev(1, {ogni:2, unita:"settimane"})), "ogni 2 settimane");
  assert.equal(conti.ricorrenzaTesto(ev(1)), "");
});

test("legame e ricorrenza: la bonifica li pulisce, il contratto li controlla", () => {
  const pulito = normalizzaCalendario({...harptos(), eventi:[
    {id:"a", giorno:1, titolo:"", nodeId:"q1", ripeti:{ogni:2, unita:"mesi"}},
    {id:"b", giorno:1, titolo:"", nodeId:"x' onclick='1", ripeti:{ogni:2, unita:"ore"}},
    {id:"c", giorno:1, titolo:"", ripeti:{ogni:-3, unita:"anni"}},
  ]});
  assert.deepEqual(pulito.eventi[0].ripeti, {ogni:2, unita:"mesi"});
  assert.equal(pulito.eventi[0].nodeId, "q1");
  assert.equal(pulito.eventi[1].nodeId, undefined, "un id ostile cade");
  assert.equal(pulito.eventi[1].ripeti, undefined, "un'unità ignota non è una ricorrenza");
  assert.deepEqual(pulito.eventi[2].ripeti, {ogni:1, unita:"anni"});
  assert.ok(prepareCampaignDocument(documento({calendario:pulito})).ok);

  const casi = [
    [{nodeId:"a b"}, "invalid_id"],
    [{ripeti:{ogni:1, unita:"ore"}}, "invalid_repeat"],
    [{ripeti:{ogni:0, unita:"giorni"}}, "number_out_of_range"],
    [{ripeti:"anni"}, "expected_object"],
  ];
  for(const [pezzo, codice] of casi){
    const esito = prepareCampaignDocument(documento({calendario:{...harptos(),
      eventi:[{id:"e", giorno:1, titolo:"", ...pezzo}]}}));
    assert.equal(esito.ok, false, codice);
    assert.equal(esito.error.code, codice);
  }
});

test("al tavolo il legame esce solo verso una bolla rivelata", () => {
  const cal = {...harptos(), eventi:[
    {id:"e1", giorno:3, titolo:"Consegna", visibile:true, nodeId:"q1", ripeti:{ogni:1, unita:"anni"}},
    {id:"e2", giorno:4, titolo:"Asta", visibile:true, nodeId:"covo-segreto"},
  ]};
  const tavolo = projectForPlayers(documento({calendario:cal}));
  assert.equal(tavolo.calendario.eventi[0].nodeId, "q1");
  assert.deepEqual(tavolo.calendario.eventi[0].ripeti, {ogni:1, unita:"anni"});
  assert.equal(tavolo.calendario.eventi[1].nodeId, undefined);
  assert.ok(!JSON.stringify(tavolo).includes("covo-segreto"));
  const nascosta = projectForPlayers(documento({calendario:cal}, {shared:false}));
  assert.equal(nascosta.calendario.eventi[0].nodeId, undefined, "la quest non rivelata non si nomina");
  assert.ok(prepareCampaignDocument(structuredClone(tavolo)).ok);
});

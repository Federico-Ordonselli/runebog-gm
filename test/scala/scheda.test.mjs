/* La scheda di un segnalino e le sagome per tipo (25 set 2026). Si provano
   le cose che si rompono in silenzio: che un segnalino senza descrizione
   resti quello di sempre (le campagne esistenti), che le misure del
   riquadro — che finiscono in attributi SVG — passino da UNA regola sola
   su cui contratto e bonifica concordano, e che al tavolo della scheda non
   esca niente: né la descrizione del DM né le misure del riquadro. */

import test from "node:test";
import assert from "node:assert/strict";
import { repoUrl } from "../critici/_repo.mjs";

const { TYPES, SCHEDA_TIPI, haScheda, schedaDi, scalaSegnalino, isMarker, sanitizeState } =
  await import(repoUrl("public/app/modello.js"));
const { prepareCampaignDocument, CURRENT_CAMPAIGN_SCHEMA_VERSION, normalizzaScheda, SCHEDA_LIMITI } =
  await import(repoUrl("public/app/formato-campagna.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

const documento = figlio => ({
  schemaVersion: CURRENT_CAMPAIGN_SCHEMA_VERSION,
  root: {id:"radice", title:"R", type:"zona", status:"", notes:"", img:null,
         children:[{id:"png1", title:"Mastro Olmo", type:"png", status:"", notes:"# Segreto\nÈ il traditore",
                    img:null, children:[], edges:[], x:0, y:0, shape:null, shared:true, ...figlio}],
         edges:[], x:null, y:null, shape:"quartiere", shared:true},
  checklist: [], players: [],
});

test("normalizzaScheda: larghezza obbligatoria, altezza facoltativa, numeri nei limiti", () => {
  assert.equal(normalizzaScheda(undefined), null);
  assert.equal(normalizzaScheda("x"), null);
  assert.equal(normalizzaScheda({h:100}), null, "senza larghezza non c'è riquadro");
  assert.equal(normalizzaScheda({w:"300\" onload=1"}), null);
  assert.equal(normalizzaScheda({w:SCHEDA_LIMITI.wMin - 1}), null);
  assert.equal(normalizzaScheda({w:SCHEDA_LIMITI.max + 1}), null);
  assert.deepEqual(normalizzaScheda({w:240.4}), {w:240});
  assert.deepEqual(normalizzaScheda({w:240, h:130.6}), {w:240, h:131});
  assert.deepEqual(normalizzaScheda({w:240, h:NaN}), {w:240}, "un'altezza rotta torna 'secondo il testo'");
});

test("contratto e bonifica concordano sulla scheda", () => {
  assert.equal(prepareCampaignDocument(documento({scheda:{w:300, h:200}})).ok, true);
  assert.equal(prepareCampaignDocument(documento({scheda:{w:300}})).ok, true);
  for(const cattiva of [{w:10}, {w:"300"}, {h:200}, {w:300, h:5}, "grande"])
    assert.equal(prepareCampaignDocument(documento({scheda:cattiva})).ok, false, JSON.stringify(cattiva));

  const s = documento({scheda:{w:"x", h:200}});
  sanitizeState(s);
  assert.equal("scheda" in s.root.children[0], false, "ciò che il contratto rifiuta, la bonifica lo toglie");
  const t = documento({scheda:{w:300.2, h:10}});
  sanitizeState(t);
  assert.deepEqual(t.root.children[0].scheda, {w:300});
});

test("la scheda c'è solo dove c'è qualcosa da leggere", () => {
  assert.equal(haScheda({type:"png", notes:"Mercante"}), true);
  assert.equal(haScheda({type:"png", notes:"  \n "}), false, "un PNG senza descrizione resta un segnalino");
  assert.equal(haScheda({type:"png"}), false);
  assert.equal(haScheda({type:"token", notes:"x"}), false, "la pedina non ha scheda");
  assert.equal(haScheda({type:"testo", notes:"x"}), false, "la casella di testo È già il suo testo");
  for(const t of SCHEDA_TIPI) assert.ok(isMarker({type:t}), `${t} è un segnalino`);
});

test("le misure di partenza crescono con la taglia, quelle del DM no", () => {
  const uno = schedaDi({type:"png"}), due = schedaDi({type:"png", taglia:2});
  assert.equal(uno.h, null, "senza scelta l'altezza segue il testo");
  assert.ok(due.w > uno.w && due.tetto > uno.tetto && due.px > uno.px);
  assert.equal(Math.round(due.w / uno.w * 100), Math.round(scalaSegnalino({taglia:2}) * 100));
  assert.deepEqual(schedaDi({type:"png", taglia:3, scheda:{w:300, h:150}}).w, 300);
  assert.equal(schedaDi({type:"png", scheda:{w:300, h:150}}).h, 150);
  assert.equal(schedaDi({type:"png", textSize:30}).px, 30, "un carattere scelto batte la taglia");
});

test("ogni segnalino ha una sagoma, e quelli con la scheda sono tutti diversi", () => {
  const segnalini = Object.keys(TYPES).filter(t => isMarker({type:t}));
  const note = new Set(["tondo", "scudo", "rombo", "foglio"]);
  for(const t of segnalini) assert.ok(note.has(TYPES[t].sagoma), `${t}: sagoma ${TYPES[t].sagoma}`);
  const conScheda = [...SCHEDA_TIPI].map(t => TYPES[t].sagoma);
  assert.equal(new Set(conScheda).size, conScheda.length, "due tipi con la stessa sagoma si distinguono solo col colore");
});

test("al tavolo della scheda non esce niente", () => {
  const doc = documento({scheda:{w:300, h:200}, textSize:30, textAlign:"center", playerNotes:""});
  const out = JSON.stringify(projectForPlayers(doc));
  assert.ok(out.includes("Mastro Olmo"), "il nome sì");
  assert.ok(!out.includes("traditore"), "la descrizione del DM mai");
  assert.ok(!out.includes("\"scheda\""), "le misure del riquadro non servono a chi non lo vede");
});

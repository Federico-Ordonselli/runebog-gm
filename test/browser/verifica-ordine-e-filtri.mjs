/*
 * Davanti/dietro e filtro delle quest (29 set 2026, Dario): una casella di
 * testo grande che copre i PNG si manda in fondo (End, menu, pannello), un
 * PNG si porta in primo piano (Home), Ctrl+Z torna all'ordine di prima,
 * una casella nuova nasce dietro alle bolle; nel diario le caselle
 * Da fare / In corso / Fatte nascondono gli stati. Vuole `npm run dev`
 * acceso; resta fuori da `npm test` come le altre verifiche Chromium.
 */
import { apriBrowser, attendiServer, BASE, semeStandalone, validaDocumento } from "./campagna-di-prova.mjs";
import { CURRENT_CAMPAIGN_SCHEMA_VERSION } from "../../public/app/formato-campagna.js";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };
const uguale = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const nodo = (id, title, type, extra = {}) => ({id, title, type, status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...extra});
// La bacheca è l'ULTIMA: nasce sopra i PNG, com'era prima di questo lavoro.
const documento = () => validaDocumento({schemaVersion:CURRENT_CAMPAIGN_SCHEMA_VERSION, checklist:[], players:[],
  root:nodo("radice", "Valle", "zona", {children:[
    nodo("olmo", "Mastro Olmo", "png", {x:55, y:55}),
    nodo("berta", "Berta", "png", {x:135, y:55}),
    nodo("q1", "Il tunnel", "quest", {x:455, y:55, status:"in corso"}),
    nodo("q2", "La torre", "quest", {x:535, y:55, status:"fatto", main:true}),
    nodo("q3", "Il pozzo", "quest", {x:615, y:55}),
    nodo("bacheca", "", "testo", {x:20, y:20, w:280, h:200, notes:"# Personaggi da incontrare"}),
  ]})});
const salvato = p => p.evaluate(() => JSON.parse(localStorage.getItem("gm-campaign-prova")));
const ordine = async p => (await salvato(p)).root.children.map(c => c.id);
// Chi riceve il clic al centro di un PNG: il PNG stesso o la bacheca sopra?
const inCima = (p, id) => p.$eval(`[data-block="${id}"] .blk-shape`, el => {
  const r = el.getBoundingClientRect();
  return document.elementFromPoint(r.x + r.width/2, r.y + r.height/2)?.closest(".blk")?.dataset.block;
});

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  const contesto = await browser.newContext({viewport:{width:1280, height:900}});
  await semeStandalone(contesto, {documento:documento()});
  const p = await contesto.newPage();
  const errori = [];
  p.on("pageerror", e => errori.push(e.message));
  await p.goto(`${BASE}/app.html`);
  await p.locator('[data-block="bacheca"]').waitFor();

  controlla(await inCima(p, "olmo") === "bacheca", "prima: la bacheca copre il PNG");

  // End sulla bacheca selezionata
  await p.evaluate(() => { window.goToNode("bacheca"); });
  await p.locator('[data-block="bacheca"].sel').waitFor();
  await p.locator("#plan-svg").focus();
  await p.keyboard.press("End");
  await p.waitForTimeout(900);
  controlla(uguale(await ordine(p), ["bacheca","olmo","berta","q1","q2","q3"]), "End manda la bacheca in fondo all'elenco");
  controlla(await inCima(p, "olmo") === "olmo", "e il PNG torna cliccabile sopra la bacheca");

  // Ctrl+Z
  await p.keyboard.press("Control+z");
  await p.waitForTimeout(900);
  controlla((await ordine(p)).at(-1) === "bacheca", "Ctrl+Z rimette la bacheca sopra");

  // Menu contestuale sulla bacheca
  const box = await p.locator('[data-block="bacheca"] .blk-shape').boundingBox();
  await p.mouse.click(box.x + box.width - 10, box.y + box.height - 10, {button:"right"});
  await p.locator('#ctx-menu button:has-text("Manda in fondo")').click();
  await p.waitForTimeout(900);
  controlla((await ordine(p))[0] === "bacheca", "Manda in fondo dal tasto destro");

  // Home su un PNG: diventa l'ultimo
  await p.evaluate(() => { window.goToNode("berta"); });
  await p.locator('[data-block="berta"].sel').waitFor();
  await p.locator("#plan-svg").focus();
  await p.keyboard.press("Home");
  await p.waitForTimeout(900);
  controlla((await ordine(p)).at(-1) === "berta", "Home porta il PNG in primo piano");

  // Home non ruba il tasto ai comandi a fuoco (qui un bottone del pannello)
  const prima = await ordine(p);
  await p.locator('#detail button:has-text("Manda in fondo")').focus();
  await p.keyboard.press("Home");
  await p.waitForTimeout(900);
  controlla(uguale(await ordine(p), prima), "Home su un bottone del pannello non riordina");
  await p.locator('#detail button:has-text("Manda in fondo")').click();
  await p.waitForTimeout(900);
  controlla((await ordine(p))[0] === "berta", "Manda in fondo dal pannello");

  // Una casella nuova: dietro alle bolle, davanti alle caselle già posate
  await p.keyboard.press("Escape");
  // La pastiglia sta in una tendina chiusa: l'Invio le arriva diretto, che
  // è la strada di addSpatialChild da tastiera.
  await p.$eval('.pal-item[data-pal=\'{"testo":true}\']',
    el => el.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", bubbles:true})));
  await p.waitForTimeout(900);
  const dopo = await ordine(p);
  const nuova = dopo.find(id => !prima.includes(id));
  const primoNonTesto = (await salvato(p)).root.children.findIndex(c => c.type !== "testo");
  controlla(!!nuova && dopo.indexOf(nuova) === primoNonTesto - 1, `la casella nuova nasce subito sotto le bolle (${dopo.join(",")})`);

  // --- filtro delle quest ---
  await p.keyboard.press("Escape");
  await p.click("#tab-quests");
  await p.locator("#quests-list .q-row").first().waitFor();
  const titoli = () => p.$$eval("#quests-list .q-title", a => a.map(x => x.textContent));
  controlla(uguale(await titoli(), ["La torre", "Il tunnel", "Il pozzo"]), "tutte e tre, di partenza");
  controlla(uguale(await p.$$eval(".q-filtri .q-conta", s => s.map(x => x.textContent)), ["1","1","1"]), "i conteggi per stato");
  await p.click("#q-f-fatte");
  controlla(uguale(await titoli(), ["Il tunnel", "Il pozzo"]), "spenta Fatte: sparisce la torre");
  controlla(await p.evaluate(() => document.activeElement?.id) === "q-f-fatte", "il focus resta sulla casella");
  controlla((await p.textContent("#quests-list")).includes("Nessuna quest negli stati spuntati"),
    "la sezione principali vuota lo dice");
  await p.keyboard.press("Space");                               // riaccende da tastiera
  controlla((await titoli()).length === 3, "Spazio la riaccende");
  await p.click("#q-f-attesa"); await p.click("#q-f-fatte");
  controlla(uguale(await titoli(), ["Il tunnel"]), "solo In corso");
  await p.selectOption('#quests-list .q-row:has-text("Il tunnel") .q-status', "fatto");
  controlla((await titoli()).length === 0, "una quest che passa a fatto esce dal filtro");
  controlla(errori.length === 0, "nessun errore nella pagina" + (errori.length ? `: ${errori}` : ""));
  await contesto.close();

  // --- telefono: i bottoni nel pannello e le caselle da 44px ---
  const tel = await browser.newContext({viewport:{width:360, height:740}, hasTouch:true, isMobile:true});
  await semeStandalone(tel, {documento:documento()});
  const t = await tel.newPage();
  await t.goto(`${BASE}/app.html`);
  await t.locator('[data-block="bacheca"]').waitFor();
  await t.evaluate(() => { window.goToNode("bacheca"); });
  await t.click("#detail-fab");
  await t.locator('#detail button:has-text("Manda in fondo")').click();
  await t.waitForTimeout(900);
  controlla((await ordine(t))[0] === "bacheca", "al telefono dal pannello");
  await t.click("#tab-quests");
  const alte = await t.$$eval(".q-filtri label", l => l.map(x => x.getBoundingClientRect().height));
  controlla(alte.length === 3 && alte.every(h => h >= 44), `caselle del filtro da 44px (${alte})`);
  controlla(await t.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "niente scorrimento orizzontale");
  await tel.close();
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

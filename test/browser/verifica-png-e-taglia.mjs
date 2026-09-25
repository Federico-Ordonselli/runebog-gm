/*
 * La scheda PNG e la taglia dei segnalini (25 set 2026): elenco, luogo,
 * filtro, salto sulla mappa anche da tastiera; taglia dal documento, dal
 * pannello e dalla maniglia, con l'aggancio pari/dispari; le cinque schede
 * dentro un telefono da 360px; al tavolo la stessa taglia e niente scheda
 * PNG. Vuole `npm run dev` acceso; resta fuori da `npm test` come le altre
 * verifiche Chromium.
 */
import { apriBrowser, attendiServer, BASE, semeStandalone, semeTavolo, validaDocumento } from "./campagna-di-prova.mjs";
import { CURRENT_CAMPAIGN_SCHEMA_VERSION } from "../../public/app/formato-campagna.js";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };
const uguale = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const nodo = (id, title, type, extra = {}) => ({id, title, type, status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...extra});
const documento = () => validaDocumento({schemaVersion:CURRENT_CAMPAIGN_SCHEMA_VERSION, checklist:[], players:[],
  root:nodo("radice", "Valle dell'Airone", "zona", {shared:true, children:[
    nodo("olmo", "Mastro Olmo", "png", {x:15, y:15, notes:"Fabbro\nsa del tunnel", shared:true, taglia:3}),
    nodo("citta", "Borgo Salice", "zona", {shape:"quartiere", x:300, y:0, w:300, h:200, shared:true, children:[
      nodo("locanda", "Locanda", "luogo", {shape:"edificio", x:40, y:40, w:160, h:120, children:[
        nodo("berta", "Berta l'oste", "png", {x:55, y:55, notes:"Conosce tutti"}),
      ]}),
      nodo("zelda", "Zelda la guardia", "png", {x:215, y:15}),
    ]}),
  ]})});
const salvato = p => p.evaluate(() => JSON.parse(localStorage.getItem("gm-campaign-prova")));

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  const contesto = await browser.newContext({viewport:{width:1280, height:900}});
  await semeStandalone(contesto, {documento:documento()});
  const p = await contesto.newPage();
  const errori = [];
  p.on("pageerror", e => errori.push(e.message));
  await p.goto(`${BASE}/app.html`);
  await p.locator('[data-block="olmo"]').waitFor();

  // --- scheda PNG ---
  await p.click("#tab-png");
  await p.locator("#png-list .q-row").first().waitFor();
  controlla(uguale(await p.$$eval("#png-list .png-nome", b => b.map(x => x.textContent)),
    ["Berta l'oste", "Mastro Olmo", "Zelda la guardia"]), "tutti i PNG dell'albero, in ordine di nome");
  controlla(uguale(await p.$$eval("#png-list .q-loc", b => b.map(x => x.textContent)),
    ["Borgo Salice › Locanda", "Valle dell'Airone", "Borgo Salice"]), "il luogo senza ripetere la radice");
  await p.fill("#png-filtro", "tunnel");
  controlla(uguale(await p.$$eval("#png-list .png-nome", b => b.map(x => x.textContent)), ["Mastro Olmo"])
    && await p.textContent("#png-conto") === "1 di 3", "il filtro cerca anche nelle note");
  await p.fill("#png-filtro", "oste");
  await p.press("#png-filtro", "Tab");
  await p.keyboard.press("Enter");
  await p.locator('[data-block="berta"].sel').waitFor();
  controlla((await p.textContent("#crumbs")).includes("Locanda"), "Invio sul nome porta al PNG dentro la locanda");

  // --- taglia ---
  await p.evaluate(() => window.goToNode("olmo"));
  const disco = () => p.$eval('[data-block="olmo"]', g => ({tr:g.getAttribute("transform"), r:g.querySelector(".blk-shape").getAttribute("r")}));
  controlla(uguale(await disco(), {tr:"translate(5,5)", r:"55"}), "taglia 3 dal documento, centrata in una cella");
  await p.click('#detail button:has-text("Grande")');
  controlla(uguale(await disco(), {tr:"translate(45,45)", r:"35"}), "Grande dal pannello: centro sull'incrocio");
  const h = await p.locator('[data-block="olmo"] .rs-handle:not(.rs-scheda)').boundingBox();
  const zoom = await p.evaluate(() => document.getElementById("plan-svg").getScreenCTM().a);
  await p.mouse.move(h.x + h.width/2, h.y + h.height/2); await p.mouse.down();
  await p.mouse.move(h.x + h.width/2 + 90*zoom, h.y + h.height/2 + 90*zoom, {steps:8}); await p.mouse.up();
  await p.waitForTimeout(900);                                   // il salvataggio è ritardato di 700 ms
  const olmo = (await salvato(p)).root.children.find(c => c.id === "olmo");
  controlla((await disco()).r === "75" && olmo.taglia === 4 && (olmo.x + 75) % 40 === 0,
    "la maniglia porta a taglia 4 e al rilascio si riaggancia");
  await p.fill("#taglia-num", "1"); await p.press("#taglia-num", "Enter");
  await p.waitForTimeout(900);
  controlla(!("taglia" in (await salvato(p)).root.children.find(c => c.id === "olmo")),
    "tornare a 1 toglie il campo dal documento");
  controlla(errori.length === 0, "nessun errore nella pagina" + (errori.length ? `: ${errori}` : ""));
  await contesto.close();

  // --- telefono ---
  const tel = await browser.newContext({viewport:{width:360, height:740}, hasTouch:true, isMobile:true});
  await semeStandalone(tel, {documento:documento()});
  const m = await tel.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.locator('[data-block="olmo"]').waitFor();
  const riga = await m.$eval("nav.tabs", n => ({sw:n.scrollWidth, cw:n.clientWidth, pagina:document.documentElement.scrollWidth}));
  controlla(riga.sw <= riga.cw && riga.pagina <= 360, `le cinque schede stanno in 360px (${riga.sw}px)`);
  await tel.close();

  // --- tavolo ---
  const tav = await browser.newContext({viewport:{width:1280, height:900}});
  await semeTavolo(tav, {documento:documento()});
  const g = await tav.newPage();
  await g.route("**/api/tavolo/*", r => r.fulfill({status:304, headers:{ETag:'"r1"'}}));
  await g.goto(`${BASE}/app.html`);
  await g.locator('[data-block="olmo"]').waitFor();
  controlla(await g.$eval('[data-block="olmo"] .blk-shape', c => c.getAttribute("r")) === "55", "al tavolo la stessa taglia");
  controlla(!(await g.isVisible("#tab-png")), "al tavolo la scheda PNG non c'è");
  await tav.close();
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

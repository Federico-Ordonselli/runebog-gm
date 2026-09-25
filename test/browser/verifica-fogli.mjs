/*
 * I fogli di caselle e schede e la finestra Impostazioni (25 set 2026): il
 * foglio scelto per una bolla, quello delle impostazioni per le altre, il
 * carattere delle caselle nuove, la scelta dal pannello (un Ctrl+Z), le
 * misure delle schede che restano quelle del testo, e il tavolo dove i fogli
 * non arrivano. Salva una schermata in /tmp per guardarli. Vuole `npm run dev`
 * acceso; resta fuori da `npm test` come le altre verifiche Chromium.
 */
import { apriBrowser, attendiServer, BASE, semeStandalone, semeTavolo, validaDocumento } from "./campagna-di-prova.mjs";
import { CURRENT_CAMPAIGN_SCHEMA_VERSION } from "../../public/app/formato-campagna.js";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

const nodo = (id, title, type, extra = {}) => ({id, title, type, status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...extra});
const documento = () => validaDocumento({schemaVersion:CURRENT_CAMPAIGN_SCHEMA_VERSION, checklist:[], players:[],
  root:nodo("radice", "Borgo Salice", "zona", {shared:true, children:[
    nodo("olmo", "Mastro Olmo", "png", {x:95, y:55, shared:true, foglio:"pergamena",
      notes:"# Fabbro\nCarismatico, pieno di energia.\n- sa del **tunnel**\n- mente sul prezzo"}),
    nodo("q1", "Il ponte crollato", "quest", {x:495, y:55, status:"in corso", foglio:"bruciata", shared:true,
      notes:"## Scadenza\nIl ponte cede fra cinque giorni.\n- trovare il carpentiere\n- avvisare il borgomastro"}),
    nodo("n1", "Appunto", "nota", {x:895, y:55, notes:"Piove da tre giorni, il fiume sale."}),
    nodo("c1", "", "testo", {x:95, y:420, w:260, h:120, foglio:"carta", notes:"# Taverna\nIl **Cinghiale Zoppo**: birra annacquata."}),
    nodo("c2", "", "testo", {x:495, y:420, w:260, h:80, notes:"Casella senza foglio"}),
    nodo("cantina", "Cantina", "luogo", {x:895, y:420, shape:"edificio", children:[
      nodo("c3", "", "testo", {x:40, y:40, w:220, h:60, notes:"Tre botti\nUna è vuota"}),
    ]}),
  ]})});
const salvato = p => p.evaluate(() => JSON.parse(localStorage.getItem("gm-campaign-prova")));
const nodoSalvato = async (p, id) => (await salvato(p)).root.children.find(c => c.id === id);
const classiFoglio = p => p.evaluate(() => Object.fromEntries(["olmo", "q1", "n1", "c1", "c2"].map(id =>
  [id, document.querySelector(`[data-block="${id}"] .foglio`)?.className.replace("foglio ", "") ?? "pulito"])));
// Il testo ci sta: la scheda non taglia e l'altezza del riquadro segue il testo.
const misure = (p, id) => p.evaluate(id => {
  const el = document.querySelector(`[data-block="${id}"] .testo-txt`);
  const fondo = document.querySelector(`[data-block="${id}"] .scheda-fondo`) ?? document.querySelector(`[data-block="${id}"] .blk-shape`);
  return {h:Number(fondo.getAttribute("height")), scroll:el.scrollHeight, client:el.clientHeight,
          tagliata:el.classList.contains("tagliata")};
}, id);

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  const contesto = await browser.newContext({viewport:{width:1400, height:900}});
  await semeStandalone(contesto, {documento:documento()});
  const p = await contesto.newPage();
  const errori = [];
  p.on("pageerror", e => errori.push(e.message));
  await p.goto(`${BASE}/app.html`);
  await p.locator('[data-block="olmo"] .scheda').waitFor();
  await p.waitForTimeout(200);

  // --- il foglio di ogni bolla ---
  controlla(JSON.stringify(await classiFoglio(p)) === JSON.stringify(
    {olmo:"foglio-pergamena", q1:"foglio-bruciata", n1:"pulito", c1:"foglio-carta", c2:"pulito"}),
    `ognuno il suo foglio, gli altri pulito ${JSON.stringify(await classiFoglio(p))}`);
  const colori = await p.evaluate(() => ({
    c1: getComputedStyle(document.querySelector('[data-block="c1"] .testo-txt')).color,
    ink: getComputedStyle(document.documentElement).getPropertyValue("--foglio-ink").trim(),
    carta: getComputedStyle(document.querySelector('[data-block="c1"] .blk-shape')).fill,
  }));
  controlla(colori.c1 === "rgb(42, 34, 23)" && colori.ink === "#2a2217", `sul foglio si scrive con l'inchiostro del foglio (${colori.c1})`);
  controlla(colori.carta === "rgb(242, 237, 225)", `la carta è il fondo del rettangolo (${colori.carta})`);
  for(const id of ["olmo", "q1"]){
    const m = await misure(p, id);
    controlla(!m.tagliata && m.scroll <= m.client + 1 && m.h < 170, `${id}: la scheda è alta quanto il testo col padding del foglio (${JSON.stringify(m)})`);
  }
  const c1 = await misure(p, "c1");
  controlla(c1.scroll <= c1.client + 1, `la casella sulla carta contiene il suo testo (${JSON.stringify(c1)})`);

  // --- impostazioni ---
  await p.locator("#menubar [data-menu=visualizza]").click();
  await p.locator("#ctx-menu button", {hasText:"Impostazioni…"}).click();
  await p.locator("#impostazioni-dialog[open]").waitFor();
  controlla(await p.locator('#impostazioni-dialog [data-imp="foglio"]').count() === 4, "quattro fogli fra cui scegliere");
  await p.click('#impostazioni-dialog [data-imp="foglio"][data-valore="pergamena"]');
  const dopo = await classiFoglio(p);
  controlla(dopo.n1 === "foglio-pergamena" && dopo.c2 === "foglio-pergamena" && dopo.q1 === "foglio-bruciata",
    `le impostazioni cambiano solo chi non ha un foglio suo ${JSON.stringify(dopo)}`);
  controlla(await p.evaluate(() => document.activeElement?.dataset.valore) === "pergamena", "il focus resta sulla scelta fatta");
  const m1 = await misure(p, "n1");
  controlla(!m1.tagliata && m1.scroll <= m1.client + 1, `la nota ricalcola l'altezza col nuovo foglio (${JSON.stringify(m1)})`);
  const c2 = await misure(p, "c2");
  controlla(c2.scroll <= c2.client + 1, `la casella si allunga se col rotolo il testo non ci sta (${JSON.stringify(c2)})`);
  controlla(!("foglio" in await nodoSalvato(p, "n1")), "la preferenza non entra nel documento");
  await p.click('#impostazioni-dialog [data-imp="carattere"][data-valore="22"]');
  controlla(await p.evaluate(() => [localStorage.getItem("runebog-foglio"), localStorage.getItem("runebog-carattere")].join()) === "pergamena,22",
    "le preferenze stanno in localStorage");
  await p.keyboard.press("Escape");
  controlla(await p.locator("#impostazioni-dialog[open]").count() === 0, "Esc chiude la finestra");
  controlla(await p.locator('[data-block="olmo"].sel, [data-block="olmo"]').count() === 1, "e la mappa resta com'era");

  await p.evaluate(() => import("/app/mappa.js").then(m => m.addSpatialChild({testo:true}, 900, 450)));
  await p.waitForTimeout(900);
  const nuova = (await salvato(p)).root.children.find(c => c.type === "testo" && !["c1", "c2"].includes(c.id));
  controlla(nuova?.textSize === 22 && !("foglio" in nuova), `la casella nuova nasce col carattere delle impostazioni (${nuova?.textSize})`);

  // --- dal pannello, un Ctrl+Z ---
  await p.evaluate(() => { window.selectNode?.("c1"); });
  await p.locator('[data-block="c1"]').click({position:{x:20, y:10}});
  await p.locator("#detail button", {hasText:"Bruciata"}).click();
  await p.waitForTimeout(900);
  controlla((await nodoSalvato(p, "c1")).foglio === "bruciata", "il pannello scrive il foglio nella bolla");
  controlla(await p.locator("#detail", {hasText:"inchiostro del foglio"}).count() === 1, "sul foglio il colore del testo lascia il posto alla spiegazione");
  await p.locator("#detail button", {hasText:"Predefinito (pergamena)"}).click();
  await p.waitForTimeout(900);
  controlla(!("foglio" in await nodoSalvato(p, "c1")), "Predefinito toglie il campo");
  await p.locator("#plan-svg").click({position:{x:5, y:5}});
  await p.keyboard.press("Control+z");
  await p.waitForTimeout(900);
  controlla((await nodoSalvato(p, "c1")).foglio === "bruciata", "Ctrl+Z torna al foglio di prima");

  // --- una casella in un altro livello, mai toccata ---
  await p.evaluate(() => import("/app/mappa.js").then(m => m.entra("cantina")));
  await p.locator('[data-block="c3"]').waitFor();
  await p.waitForTimeout(200);
  const c3 = await misure(p, "c3");
  controlla(c3.scroll <= c3.client + 1 && c3.h > 60,
    `in un altro livello la casella si allunga da sé col foglio nuovo (${JSON.stringify(c3)})`);
  await p.evaluate(() => import("/app/mappa.js").then(m => m.goToNode("radice")));

  // --- ricaricando ---
  await p.reload();
  await p.locator('[data-block="olmo"] .scheda').waitFor();
  controlla((await classiFoglio(p)).n1 === "foglio-pergamena", "la preferenza sopravvive al ricaricamento");
  await p.evaluate(() => localStorage.setItem("runebog-foglio", "papiro\" onload=\"x"));
  await p.reload();
  await p.locator('[data-block="olmo"] .scheda').waitFor();
  controlla((await classiFoglio(p)).n1 === "pulito", "una preferenza sconosciuta torna a pulito");
  await p.evaluate(() => localStorage.setItem("runebog-foglio", "pergamena"));
  await p.reload();
  await p.locator('[data-block="olmo"] .scheda').waitFor();
  await p.waitForTimeout(300);
  await p.screenshot({path:"/tmp/runebog-fogli.png"});
  // Il ⋯ della barra completa, l'altra strada per le impostazioni.
  await p.evaluate(() => window.impostaBarra("classica"));
  await p.locator("#topbar-more").click();
  await p.locator("#ctx-menu button", {hasText:"Impostazioni…"}).click();
  controlla(await p.locator("#impostazioni-dialog[open]").count() === 1, "anche dal ⋯ si aprono le impostazioni");
  await p.keyboard.press("Escape");
  await p.evaluate(() => window.impostaBarra("menu"));
  controlla(errori.length === 0, `nessun errore nella pagina ${errori.join(" | ")}`);
  await contesto.close();

  // --- tavolo ---
  const tav = await browser.newContext({viewport:{width:1200, height:800}});
  await semeTavolo(tav, {documento:documento()});
  const g = await tav.newPage();
  await g.route("**/api/tavolo/*", r => r.fulfill({status:304, headers:{ETag:'"r1"'}}));
  await g.goto(`${BASE}/app.html`);
  await g.locator('[data-block="olmo"]').waitFor();
  controlla(await g.locator(".foglio").count() === 0, "al tavolo nessun foglio");
  await g.evaluate(() => window.apriImpostazioni());
  await g.locator("#impostazioni-dialog[open]").waitFor();
  controlla(await g.locator('#impostazioni-dialog [data-imp="foglio"]').count() === 0
    && await g.locator("#imp-tema").count() === 1, "al tavolo le impostazioni sono tema e barra");
  await tav.close();
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

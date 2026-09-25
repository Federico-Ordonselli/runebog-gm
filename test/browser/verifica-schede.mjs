/*
 * La bolla come pagina (25 set 2026): la scheda sotto PNG, quest, encounter
 * e note, le sagome per tipo, la scrittura sul posto col doppio clic (barra
 * flottante, Esc, un solo Ctrl+Z per sessione), la maniglia del riquadro,
 * "Entra →" dal menu, il telefono con la scrittura in cima alla tela, e il
 * tavolo senza schede. Vuole `npm run dev` acceso; resta fuori da `npm test`
 * come le altre verifiche Chromium.
 */
import { apriBrowser, attendiServer, BASE, semeStandalone, semeTavolo, validaDocumento } from "./campagna-di-prova.mjs";
import { CURRENT_CAMPAIGN_SCHEMA_VERSION } from "../../public/app/formato-campagna.js";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

const LUNGA = Array.from({length:40}, (_, i) => `- riga ${i + 1} della storia del ponte`).join("\n");
const nodo = (id, title, type, extra = {}) => ({id, title, type, status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...extra});
const documento = () => validaDocumento({schemaVersion:CURRENT_CAMPAIGN_SCHEMA_VERSION, checklist:[], players:[],
  root:nodo("radice", "Borgo Salice", "zona", {shared:true, children:[
    nodo("olmo", "Mastro Olmo", "png", {x:95, y:55, shared:true, notes:"# Fabbro\nSa del **tunnel**",
      children:[nodo("bottega", "Bottega", "luogo", {shape:"edificio"})]}),
    nodo("q1", "Il ponte crollato", "quest", {x:495, y:55, status:"in corso", notes:LUNGA, shared:true}),
    nodo("n1", "Appunto", "nota", {x:95, y:455, notes:"Piove da tre giorni"}),
    nodo("e1", "Lupi", "encounter", {x:495, y:455}),
    nodo("t1", "Ada", "token", {x:895, y:455, notes:"non è una scheda"}),
    nodo("c1", "", "testo", {x:895, y:40, w:200, h:80, notes:"Casella"}),
  ]})});
const salvato = p => p.evaluate(() => JSON.parse(localStorage.getItem("gm-campaign-prova")));
const nodoSalvato = async (p, id) => (await salvato(p)).root.children.find(c => c.id === id);
const centro = async (p, sel) => { const b = await p.locator(sel).boundingBox(); return {x:b.x + b.width/2, y:b.y + b.height/2}; };

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

  // --- lettura ---
  controlla(await p.$eval('[data-block="olmo"] .scheda-txt', d => !!d.querySelector(".tr-t1") && !!d.querySelector("b")),
    "la scheda del PNG rende la marcatura (titolo, grassetto)");
  controlla(await p.$eval('[data-block="q1"] .scheda-stato', d => d.textContent.trim()) === "in corso",
    "la quest dice il suo stato in testa alla scheda");
  controlla(await p.locator('[data-block="e1"] .scheda').count() === 0, "un encounter senza descrizione resta un segnalino");
  controlla(await p.locator('[data-block="t1"] .scheda').count() === 0, "la pedina non ha scheda");
  const altezze = await p.evaluate(() => ["olmo", "q1"].map(id =>
    Number(document.querySelector(`[data-block="${id}"] .scheda-fondo`).getAttribute("height"))));
  controlla(altezze[0] < 100 && altezze[1] === 170, `alta quanto il testo, fino al tetto (${altezze})`);
  controlla(await p.$eval('[data-block="q1"] .scheda-txt', d => d.classList.contains("tagliata")),
    "la scheda che taglia sfuma in fondo");

  // --- sagome ---
  const sagome = await p.evaluate(() => Object.fromEntries(["olmo", "q1", "e1", "n1", "t1"].map(id =>
    [id, document.querySelector(`[data-block="${id}"] .blk-shape`).tagName + (document.querySelector(`[data-block="${id}"] .sag-piega`) ? "+piega" : "")])));
  controlla(JSON.stringify(sagome) === JSON.stringify({olmo:"circle", q1:"path", e1:"polygon", n1:"path+piega", t1:"circle"}),
    `una sagoma per tipo ${JSON.stringify(sagome)}`);
  controlla(await p.locator('#plan-toolbar .pal-item[data-pal*="quest"] .ico-sag path').count() === 1,
    "la palette mostra la sagoma della tela");

  // --- scrittura sul posto ---
  const disco = await centro(p, '[data-block="olmo"] .blk-shape');
  await p.mouse.dblclick(disco.x, disco.y);
  await p.locator("#scrittura textarea:focus").waitFor();
  const posto = await p.evaluate(() => {
    const a = document.querySelector("#scrittura textarea").getBoundingClientRect();
    const s = document.querySelector('[data-block="olmo"] .scheda-fondo').getBoundingClientRect();
    return {dx:Math.abs(a.top - s.top), val:document.querySelector("#scrittura textarea").value};
  });
  controlla(posto.dx < 2 && posto.val === "# Fabbro\nSa del **tunnel**", "doppio clic: si scrive sopra la scheda, dal testo vero");
  controlla((await p.textContent("#crumbs")).includes("Mastro Olmo") === false, "il doppio clic non entra più nel PNG");
  await p.keyboard.type("\nPrima frase.");
  await p.waitForTimeout(1200);                                  // oltre la raffica di 800 ms
  await p.keyboard.type(" Seconda frase.");
  await p.waitForTimeout(100);
  controlla((await p.textContent('[data-block="olmo"] .scheda-txt')).includes("Seconda frase."),
    "la scheda si aggiorna mentre si scrive");
  // grassetto dalla barra flottante sulla selezione
  await p.$eval("#scrittura textarea", ta => { const i = ta.value.indexOf("Prima"); ta.setSelectionRange(i, i + 5); });
  await p.click('#scrittura button[title^="Grassetto"]');
  controlla((await p.inputValue("#scrittura textarea")).includes("**Prima**"), "la barra flottante formatta la selezione");
  controlla(await p.evaluate(() => document.activeElement?.id) === "scrittura-area", "la barra non ruba il focus");
  await p.keyboard.press("Escape");
  controlla(await p.locator("#scrittura").count() === 0, "Esc chiude la scrittura");
  controlla(await p.evaluate(() => document.activeElement?.dataset?.block) === "olmo", "e il focus torna al segnalino");
  controlla((await p.locator('[data-block="olmo"].sel').count()) === 1, "Esc non deseleziona");
  controlla((await nodoSalvato(p, "olmo")).notes.endsWith("**Prima** frase. Seconda frase."), "salvato alla chiusura");
  await p.keyboard.press("Control+z");
  await p.waitForTimeout(100);
  controlla((await nodoSalvato(p, "olmo")).notes === "# Fabbro\nSa del **tunnel**", "un solo Ctrl+Z toglie tutta la sessione");

  // Invio da tastiera apre la scrittura e non ci scrive un a capo
  await p.locator('[data-block="olmo"]').focus();
  await p.keyboard.press("Enter");
  await p.locator("#scrittura textarea:focus").waitFor();
  controlla(await p.inputValue("#scrittura textarea") === "# Fabbro\nSa del **tunnel**", "Invio apre la scrittura senza un a capo in più");
  // un clic fuori chiude
  await p.mouse.click(700, 800);
  controlla(await p.locator("#scrittura").count() === 0, "un clic sulla tela chiude la scrittura");

  // segnalino senza descrizione: la scrittura crea la scheda
  const lupi = await centro(p, '[data-block="e1"] .blk-shape');
  await p.mouse.dblclick(lupi.x, lupi.y);
  await p.locator("#scrittura textarea:focus").waitFor();
  await p.keyboard.type("Tre lupi affamati");
  await p.keyboard.press("Escape");
  controlla(await p.locator('[data-block="e1"] .scheda').count() === 1, "scrivere su un segnalino vuoto gli dà la scheda");

  // casella di testo
  const casella = await centro(p, '[data-block="c1"] .blk-shape');
  await p.mouse.dblclick(casella.x, casella.y);
  await p.locator("#scrittura textarea:focus").waitFor();
  controlla(await p.inputValue("#scrittura textarea") === "Casella", "anche la casella di testo si scrive sul posto");
  await p.keyboard.press("Escape");

  // --- maniglia del riquadro ---
  await p.mouse.click(disco.x, disco.y);
  const h = await centro(p, '[data-block="olmo"] .rs-scheda');
  const zoom = await p.evaluate(() => document.getElementById("plan-svg").getScreenCTM().a);
  await p.mouse.move(h.x, h.y); await p.mouse.down();
  await p.mouse.move(h.x + 60*zoom, h.y + 80*zoom, {steps:6}); await p.mouse.up();
  await p.waitForTimeout(900);
  const sc = (await nodoSalvato(p, "olmo")).scheda;
  controlla(sc && sc.w >= 330 && sc.w <= 350 && sc.h >= 130, `la maniglia allarga dai due lati e fissa l'altezza (${JSON.stringify(sc)})`);
  controlla((await nodoSalvato(p, "olmo")).taglia === undefined, "e non tocca la taglia");

  // --- Entra dal menu ---
  await p.mouse.click(disco.x, disco.y, {button:"right"});
  await p.click('#ctx-menu button:has-text("Entra")');
  await p.locator('[data-block="bottega"]').waitFor();
  controlla((await p.textContent("#crumbs")).includes("Mastro Olmo"), "«Entra →» dal menu entra nel PNG");
  controlla(errori.length === 0, "nessun errore nella pagina" + (errori.length ? `: ${errori}` : ""));
  await contesto.close();

  // --- telefono ---
  const tel = await browser.newContext({viewport:{width:390, height:760}, hasTouch:true, isMobile:true});
  await semeStandalone(tel, {documento:documento()});
  const m = await tel.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.locator('[data-block="olmo"] .scheda').waitFor();
  // Il doppio tocco sulla scheda: il tocco sui segnalini piccoli lo prova
  // verifica-tocco.mjs.
  const d = await centro(m, '[data-block="olmo"] .scheda-fondo');
  await m.touchscreen.tap(d.x, d.y); await m.waitForTimeout(80); await m.touchscreen.tap(d.x, d.y);
  await m.locator("#scrittura.in-cima textarea").waitFor();
  const r = await m.evaluate(() => {
    const w = document.getElementById("plan-wrap").getBoundingClientRect();
    const s = document.getElementById("scrittura").getBoundingClientRect();
    return {cima: s.top - w.top, larga: s.width, pagina: document.documentElement.scrollWidth,
            foglio: document.getElementById("detail").classList.contains("open")};
  });
  controlla(r.cima < 12 && r.larga > 360 && r.pagina <= 390, `su telefono la scrittura sta in cima alla tela (${JSON.stringify(r)})`);
  controlla(!r.foglio, "e non apre il foglio dei dettagli");
  /* La tastiera virtuale: Chromium emulato non la apre, quindi si finge
     quello che fa al visualViewport. Android lo accorcia; iPhone lo accorcia
     e lo sposta in giù per mostrare il campo, e l'avvisa con uno scroll. */
  for(const [nome, alto, cima, evento] of [["Android", 430, 0, "resize"], ["iPhone", 380, 320, "scroll"]]){
    const v = await m.evaluate(([alto, cima, evento]) => {
      const vv = window.visualViewport;
      Object.defineProperty(vv, "height", {configurable:true, get:() => alto});
      Object.defineProperty(vv, "offsetTop", {configurable:true, get:() => cima});
      vv.dispatchEvent(new Event(evento));
      const box = document.getElementById("scrittura").getBoundingClientRect();
      const ta = document.querySelector("#scrittura textarea").getBoundingClientRect();
      return {sopra: Math.round(box.top - cima), sotto: Math.round(cima + alto - ta.bottom), ta: Math.round(ta.height)};
    }, [alto, cima, evento]);
    controlla(v.sopra >= 0 && v.sotto >= 0 && v.ta >= 60,
      `${nome}: con la tastiera aperta barra e testo restano nell'area visibile (${JSON.stringify(v)})`);
  }
  await tel.close();

  // --- tavolo ---
  const tav = await browser.newContext({viewport:{width:1280, height:900}});
  await semeTavolo(tav, {documento:documento()});
  const g = await tav.newPage();
  await g.route("**/api/tavolo/*", r => r.fulfill({status:304, headers:{ETag:'"r1"'}}));
  await g.goto(`${BASE}/app.html`);
  await g.locator('[data-block="olmo"]').waitFor();
  controlla(await g.locator(".scheda").count() === 0, "al tavolo nessuna scheda");
  controlla(await g.$eval('[data-block="q1"] .blk-shape', e => e.tagName) === "path", "al tavolo la stessa sagoma");
  await tav.close();
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

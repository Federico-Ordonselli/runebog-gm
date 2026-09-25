/*
 * Il calendario di gioco (25 set 2026): la scheda del DM (oggi, avanzare,
 * eventi, struttura), le scadenze delle quest dal pannello al diario e alla
 * scheda sulla tela, l'annulla, il telefono, e il tavolo — che vede la
 * scheda solo se il DM l'ha usata, solo gli eventi visibili, e si aggiorna
 * col polling. Vuole `npm run dev` acceso; resta fuori da `npm test` come le
 * altre verifiche Chromium.
 */
import { apriBrowser, attendiServer, BASE, semeStandalone, semeTavolo, serviTavolo, giroDiPolling,
  validaDocumento } from "./campagna-di-prova.mjs";
import { CURRENT_CAMPAIGN_SCHEMA_VERSION } from "../../public/app/formato-campagna.js";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

const nodo = (id, title, type, extra = {}) => ({id, title, type, status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...extra});
const documento = (extra = {}, quest = {}) => validaDocumento({
  schemaVersion:CURRENT_CAMPAIGN_SCHEMA_VERSION, checklist:[], players:[],
  root:nodo("radice", "Valle dell'Airone", "zona", {shared:true, children:[
    nodo("riscatto", "Il riscatto", "quest", {x:15, y:15, status:"in corso", notes:"Pagare il culto", shared:true, ...quest}),
  ]}),
  ...extra,
});
const salvato = p => p.evaluate(() => JSON.parse(localStorage.getItem("gm-campaign-prova")));
const attendiSalvataggio = p => p.waitForTimeout(900);          // il salvataggio è ritardato di 700 ms
const testo = (p, sel) => p.textContent(sel).then(t => t.replace(/\s+/g, " ").trim());

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  const contesto = await browser.newContext({viewport:{width:1280, height:900}});
  await semeStandalone(contesto, {documento:documento()});
  const p = await contesto.newPage();
  const errori = [];
  p.on("pageerror", e => errori.push(e.message));
  await p.goto(`${BASE}/app.html`);
  await p.locator('[data-block="riscatto"]').waitFor();

  // --- guardare non scrive ---
  await p.click("#tab-cal");
  await p.locator(".cal-oggi").waitFor();
  controlla(await testo(p, ".cal-oggi") === "1 Gennaio, anno 1", "senza calendario vale il predefinito");
  await attendiSalvataggio(p);
  controlla(!("calendario" in await salvato(p)), "aprire la scheda non scrive il calendario nel documento");

  // --- far passare il tempo ---
  await p.click('button:has-text("+1 giorno")');
  await p.waitForFunction(() => document.querySelector(".cal-oggi")?.textContent.includes("2 Gennaio"));
  await p.fill("#cal-n", "30");
  await p.click('button:has-text("Fai passare")');
  await p.waitForFunction(() => document.querySelector(".cal-oggi")?.textContent.includes("1 Febbraio"));
  await attendiSalvataggio(p);
  controlla((await salvato(p)).calendario?.oggi === 32, "+1 e +30 portano al giorno 32, il primo di febbraio");
  controlla(await p.$eval(".cal-g.oggi .cal-num", e => e.textContent) === "1", "la griglia mostra febbraio con oggi evidenziato");

  // --- eventi ---
  await p.locator(".cal-g", {hasText: /^\s*5\b/}).first().click();
  await p.waitForFunction(() => document.getElementById("cal-giorno-titolo")?.textContent.includes("5 Febbraio"));
  controlla((await testo(p, ".cal-dist")) === "tra 4 giorni", "il giorno scelto dice quanto dista da oggi");
  await p.click('button:has-text("+ Evento in questo giorno")');
  await p.waitForFunction(() => document.activeElement?.classList.contains("cal-ev-titolo"));
  await p.keyboard.type("Festa del raccolto");
  await p.keyboard.press("Tab");
  await p.waitForTimeout(50);
  controlla(await p.evaluate(() => document.activeElement?.tagName) === "TEXTAREA",
    "il Tab dal titolo arriva alle note anche dopo il ridisegno");
  await p.keyboard.type("Tutti invitati");
  await p.keyboard.press("Tab");
  await p.waitForTimeout(50);
  await p.locator(".cal-ev input[type=checkbox]").first().check();
  await p.click('button:has-text("+ Evento in questo giorno")');
  await p.waitForFunction(() => document.querySelectorAll(".cal-ev").length === 2 && document.activeElement?.classList.contains("cal-ev-titolo"));
  await p.keyboard.type("Il culto attacca");
  await p.keyboard.press("Enter");
  await attendiSalvataggio(p);
  let cal = (await salvato(p)).calendario;
  controlla(cal.eventi.length === 2 && cal.eventi.every(e => e.giorno === 36)
    && cal.eventi[0].titolo === "Festa del raccolto" && cal.eventi[0].note === "Tutti invitati"
    && cal.eventi[0].visibile === true && !("visibile" in cal.eventi[1]),
    "due eventi il giorno 36: uno visibile con le note, uno solo del DM");
  controlla(await p.locator(".cal-g.scelto .cal-voce").count() === 2, "la cella del giorno mostra i due eventi");

  // --- struttura: cambiare un mese non sposta niente ---
  await p.click(".cal-struttura summary");
  await p.fill("#cal-m-n-0", "Martello");
  await p.keyboard.press("Tab");
  await p.waitForTimeout(50);
  controlla(await p.evaluate(() => document.activeElement?.id) === "cal-m-g-0",
    "il Tab dal nome del mese resta sul campo dei giorni");
  await p.keyboard.press("ControlOrMeta+a");
  await p.keyboard.type("20");
  await p.keyboard.press("Tab");
  await attendiSalvataggio(p);
  cal = (await salvato(p)).calendario;
  controlla(cal.oggi === 32 && cal.eventi[0].giorno === 36 && cal.mesi[0].nome === "Martello" && cal.mesi[0].giorni === 20,
    "accorciare il primo mese lascia oggi ed eventi agli stessi giorni");
  controlla(await testo(p, ".cal-oggi") === "12 Febbraio, anno 1", "e ne cambia la data");
  for(const [campo, valore] of [["#cal-sett", "I, II, III, IV, V, VI, VII, VIII, IX, X"], ["#cal-anno", "1492"], ["#cal-era", "DR"]]){
    await p.fill(campo, valore);
    await p.press(campo, "Tab");
    await p.waitForTimeout(50);
  }
  await p.waitForFunction(() => document.querySelector(".cal-oggi")?.textContent.includes("1492 DR"));
  controlla(await p.locator(".cal-sett").count() === 10, "una settimana di dieci giorni fa dieci colonne");
  controlla((await p.textContent(".cal-mese-titolo")).includes("1492 DR"), "anno iniziale ed era nel titolo del mese");

  // --- scadenza di una quest ---
  await p.evaluate(() => window.goToNode("riscatto"));
  await p.locator("#q-scad-riscatto").waitFor();
  await p.fill("#q-scad-riscatto", "5");
  await p.press("#q-scad-riscatto", "Enter");
  await attendiSalvataggio(p);
  const quest = () => salvato(p).then(d => d.root.children[0]);
  controlla((await quest()).scadenza === 37, "«tra 5 giorni» diventa il giorno 37");
  controlla((await testo(p, "#q-scad-d-riscatto")).includes("tra 5 giorni"), "il pannello dice quanto manca");
  controlla((await testo(p, '[data-block="riscatto"] .scheda-stato')).includes("tra 5 giorni"),
    "la scheda della quest sulla tela porta i giorni rimasti");
  await p.locator('#detail .opt:has-text("La vedono") input').check();
  await attendiSalvataggio(p);
  controlla((await quest()).scadenzaVisibile === true, "la scadenza si può dire ai giocatori");

  await p.click("#tab-cal");
  await p.fill("#cal-n", "10");
  await p.click('button:has-text("Fai passare")');
  await p.waitForTimeout(100);
  await p.click("#tab-quests");
  controlla((await testo(p, "#quests-list .q-scad")) === "⚑ scaduta da 5 giorni", "il diario la dice scaduta");
  await p.selectOption("#q-ordine", "scadenza");
  controlla(await p.evaluate(() => document.activeElement?.id) === "q-ordine", "l'ordine per scadenza tiene il focus");

  // --- annulla ---
  await p.click("#tab-cal");
  const primaDiAnnullare = await testo(p, ".cal-oggi");
  await p.keyboard.press("ControlOrMeta+z");
  await p.waitForTimeout(100);
  controlla(await testo(p, ".cal-oggi") !== primaDiAnnullare && (await testo(p, ".cal-oggi")).startsWith("12 "),
    "Ctrl+Z riporta indietro il giorno");
  controlla(errori.length === 0, "nessun errore nella pagina" + (errori.length ? `: ${errori}` : ""));
  const docDM = await salvato(p);
  await contesto.close();

  // --- telefono ---
  const tel = await browser.newContext({viewport:{width:360, height:740}, hasTouch:true, isMobile:true});
  await semeStandalone(tel, {documento:docDM});
  const m = await tel.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.locator('[data-block="riscatto"]').waitFor();
  await m.locator("#tab-cal").scrollIntoViewIfNeeded();
  await m.tap("#tab-cal");
  await m.locator(".cal-griglia").waitFor();
  const larghezza = await m.evaluate(() => ({pagina: document.documentElement.scrollWidth,
    vista: document.getElementById("view-cal").scrollWidth}));
  controlla(larghezza.pagina <= 360 && larghezza.vista <= 360, `il calendario sta in 360px (${larghezza.vista}px)`);
  const tocco = await m.$eval(".cal-g", b => b.getBoundingClientRect().height);
  controlla(tocco >= 44, `le celle si toccano col dito (${Math.round(tocco)}px)`);
  const schede = await m.$eval("nav.tabs", n => ({sw:n.scrollWidth, cw:n.clientWidth}));
  console.log(`       (le sei schede: ${schede.sw}px su ${schede.cw})`);
  await tel.close();

  // --- tavolo senza calendario ---
  const vuoto = await browser.newContext({viewport:{width:1280, height:900}});
  await semeTavolo(vuoto, {documento:documento()});
  const v = await vuoto.newPage();
  await v.route("**/api/tavolo/*", r => r.fulfill({status:304, headers:{ETag:'"r1"'}}));
  await v.goto(`${BASE}/app.html`);
  await v.locator('[data-block="riscatto"]').waitFor();
  controlla(!(await v.isVisible("#tab-cal")), "al tavolo, se il DM non l'ha mai usato, la scheda non c'è");
  await vuoto.close();

  // --- tavolo col calendario ---
  const tav = await browser.newContext({viewport:{width:1280, height:900}});
  await semeTavolo(tav, {documento:docDM});
  const g = await tav.newPage();
  const errTav = [];
  g.on("pageerror", e => errTav.push(e.message));
  const server = await serviTavolo(g, {documento:docDM});
  await g.goto(`${BASE}/app.html`);
  await g.locator('[data-block="riscatto"]').waitFor();
  await g.click("#tab-cal");
  await g.locator(".cal-oggi").waitFor();
  const oggiTavolo = await testo(g, ".cal-oggi");
  controlla(oggiTavolo === "12 Febbraio, 1492 DR", `al tavolo lo stesso oggi (${oggiTavolo})`);
  controlla(!(await g.isVisible(".cal-avanza")) && !(await g.isVisible(".cal-struttura")),
    "al tavolo niente comandi e niente struttura");
  await g.evaluate(() => window.calScegli(36, true));
  const giorno = await testo(g, ".cal-giorno");
  controlla(giorno.includes("Festa del raccolto") && giorno.includes("Tutti invitati") && !giorno.includes("culto"),
    "al tavolo l'evento visibile con le note, e non quello del DM");
  controlla((await testo(g, ".cal-prossimi")).includes("Il riscatto"), "la scadenza detta ai giocatori compare al tavolo");
  const avanti = structuredClone(docDM);
  avanti.calendario.oggi += 3;
  server.scrivi(avanti);
  await giroDiPolling(g);
  await g.waitForFunction(() => document.querySelector(".cal-oggi")?.textContent.includes("15 "), null, {timeout:3000})
    .catch(() => {});
  controlla((await testo(g, ".cal-oggi")).startsWith("15 "), "il giorno che avanza arriva al tavolo col polling");
  controlla(errTav.length === 0, "nessun errore al tavolo" + (errTav.length ? `: ${errTav}` : ""));
  await tav.close();
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

/*
 * La barra a menu e il ritorno alla barra completa (barra-menu.js, 22 set
 * 2026). Vuole `npm run dev` acceso; resta fuori da `npm test` come le altre
 * verifiche Chromium.
 */

import {
  apriBrowser, attendiServer, BASE, documentoDiProva, semeStandalone, semeTavolo, serviTavolo,
} from "./campagna-di-prova.mjs";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => {
  console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`);
  esito ? ok++ : ko++;
};
const visibile = (pagina, sel) => pagina.locator(sel).first().isVisible();

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();

try {
  console.log("\nscrivania");
  {
    const contesto = await browser.newContext({viewport:{width:1440, height:900}});
    await semeStandalone(contesto, {documento:documentoDiProva()});
    const pagina = await contesto.newPage();
    const errori = [];
    pagina.on("pageerror", e => errori.push(e.message));
    await pagina.goto(`${BASE}/app.html`);
    await pagina.locator(".blk").first().waitFor();

    controlla(await visibile(pagina, "#menubar [data-menu=file]"), "la barra a menu è il default");
    for(const sel of ["#camp-wrap", "#theme-wrap", "#topbar-more", ".pal-item", "button.zoom"])
      controlla(!await visibile(pagina, sel), `${sel} è nascosto nella barra a menu`);
    controlla(!await visibile(pagina, "#menubar-tutto"), "il ☰ del telefono non compare su scrivania");

    // Un menu si apre e si richiude col suo bottone.
    const file = pagina.locator("#menubar [data-menu=file]");
    await file.click();
    controlla(await visibile(pagina, "#ctx-menu.show"), "File apre il menu");
    controlla(await file.getAttribute("aria-expanded") === "true", "aria-expanded segue l'apertura");
    await file.click();
    controlla(!await visibile(pagina, "#ctx-menu.show"), "un secondo clic su File lo richiude");

    // Nuova campagna dal menu: la stessa funzione del vecchio ＋.
    await file.click();
    await pagina.locator("#ctx-menu button", {hasText:"Nuova campagna"}).click();
    const campagne = await pagina.evaluate(() => JSON.parse(localStorage.getItem("gm-campaigns-v1")).length);
    controlla(campagne === 2, "File › Nuova campagna crea una campagna");
    await file.click();
    controlla(await pagina.locator("#ctx-menu .ctx-head", {hasText:"Apri campagna"}).count() === 1,
      "con due campagne File le elenca");
    await pagina.locator("#ctx-menu button", {hasText:"Campagna di prova"}).click();
    await pagina.locator(".blk").first().waitFor();

    // Tastiera: Invio apre e mette il focus nel menu, le frecce passano ai vicini.
    await file.focus();
    await pagina.keyboard.press("Enter");
    controlla(await pagina.evaluate(() => document.activeElement?.closest("#ctx-menu") != null),
      "aperto da tastiera, il focus entra nel menu");
    await pagina.keyboard.press("ArrowRight");
    controlla(await pagina.locator("#menubar [data-menu=modifica]").getAttribute("aria-expanded") === "true",
      "freccia destra apre Modifica");
    await pagina.keyboard.press("Escape");
    controlla(!await visibile(pagina, "#ctx-menu.show"), "Escape chiude");
    controlla(await pagina.evaluate(() => document.activeElement?.dataset.menu === "modifica"),
      "e il focus torna all'intestazione");

    // "Nuova campagna" dà il focus al titolo con 80 ms di ritardo: se nel
    // frattempo si è tornati a un'altra campagna e si naviga la barra, quel
    // focus non deve arrivare. Sotto carico succedeva da sé a metà di questa
    // prova (circa un giro su nove); qui il caso si prova senza aspettarlo.
    const rubato = await pagina.evaluate(async () => {
      const prima = localStorage.getItem("gm-current-campaign");
      window.newCampaign();
      window.switchCampaign(prima);
      document.querySelector("#menubar [data-menu=file]").focus();
      await new Promise(r => setTimeout(r, 250));
      return document.activeElement?.dataset.menu ?? document.activeElement?.tagName;
    });
    controlla(rubato === "file", `il focus ritardato di Nuova campagna non arriva a cose cambiate (${rubato})`);

    // Strumenti elenca i tool letti dal gestore, con la loro scorciatoia.
    await pagina.locator("#menubar [data-menu=strumenti]").click();
    const voci = await pagina.locator("#ctx-menu button").allTextContents();
    controlla(voci.some(v => v.includes("Righello") && v.endsWith("R")), "Strumenti porta il righello con R");
    await pagina.locator("#ctx-menu button", {hasText:"Righello"}).click();
    controlla(await pagina.locator("#map-tools [data-tool=righello]").getAttribute("aria-pressed") === "true",
      "la voce accende lo stesso tool del bottone");
    await pagina.keyboard.press("Escape");

    // La palette a tendina: arma e posa, come la striscia.
    const primaDi = await pagina.locator(".blk").count();
    await pagina.locator("[data-gruppo=segnalini] .pal-apri").click();
    controlla(await visibile(pagina, "[data-gruppo=segnalini] .pal-voci"), "Segnalini apre la tendina");
    await pagina.locator("[data-gruppo=segnalini] .pal-item", {hasText:"Quest"}).click();
    controlla(!await visibile(pagina, "[data-gruppo=segnalini] .pal-voci"), "scelta la pastiglia, la tendina si chiude");
    controlla(await pagina.locator("[data-gruppo=segnalini]:has(.pal-item.armed)").count() === 1,
      "il gruppo dice cosa è armato");
    const tela = await pagina.locator("#plan-svg").boundingBox();
    await pagina.mouse.click(tela.x + 120, tela.y + 120);
    controlla(await pagina.locator(".blk").count() === primaDi + 1, "il tocco sulla mappa la posa");

    // Trascinata dalla tendina aperta.
    await pagina.locator("[data-gruppo=segnalini] .pal-apri").click();
    await pagina.locator("[data-gruppo=segnalini] .pal-item", {hasText:"Nota"})
      .dragTo(pagina.locator("#plan-svg"), {targetPosition:{x:200, y:420}});
    controlla(await pagina.locator(".blk").count() === primaDi + 2, "trascinata dalla tendina, si posa");
    controlla(!await visibile(pagina, "[data-gruppo=segnalini] .pal-voci"), "e la tendina si chiude");

    controlla(await pagina.locator(".pal-gruppo.suggerito").count() === 1, "un gruppo è segnato come suggerito");

    // Barra completa e ritorno, che sopravvive al ricaricamento.
    await pagina.locator("#menubar [data-menu=visualizza]").click();
    await pagina.locator("#ctx-menu button", {hasText:"Barra completa"}).click();
    controlla(await visibile(pagina, ".pal-item") && await visibile(pagina, "#camp-wrap")
      && !await visibile(pagina, "#menubar"), "Barra completa rimette la palette stesa e i bottoni");
    await pagina.reload();
    await pagina.locator(".blk").first().waitFor();
    controlla(await pagina.evaluate(() => document.documentElement.classList.contains("ui-classica")),
      "la scelta sopravvive al ricaricamento");
    await pagina.locator("#topbar-more").click();
    await pagina.locator("#ctx-menu button", {hasText:"Passa alla barra a menu"}).click();
    controlla(await visibile(pagina, "#menubar [data-menu=file]") && !await visibile(pagina, ".pal-item"),
      "dal ⋯ si torna alla barra a menu");

    controlla(errori.length === 0, `nessun errore in pagina${errori.length ? ": " + errori.join("; ") : ""}`);
    await contesto.close();
  }

  console.log("\ntelefono");
  {
    const contesto = await browser.newContext({viewport:{width:390, height:844}, hasTouch:true});
    await semeStandalone(contesto, {documento:documentoDiProva()});
    const pagina = await contesto.newPage();
    await pagina.goto(`${BASE}/app.html`);
    await pagina.locator(".blk").first().waitFor();
    controlla(await visibile(pagina, "#menubar-tutto") && !await visibile(pagina, "#menubar [data-menu=file]"),
      "su telefono c'è il ☰ al posto delle intestazioni");
    const alta = await pagina.locator("#topbar").evaluate(el => el.getBoundingClientRect().height);
    controlla(alta < 130, `la topbar resta su due righe (${Math.round(alta)}px)`);
    await pagina.locator("#menubar-tutto").tap();
    const titoli = await pagina.locator("#ctx-menu .ctx-head").allTextContents();
    controlla(["File","Modifica","Visualizza","Strumenti","Aiuto"].every(t => titoli.includes(t)),
      "il ☰ mostra le cinque sezioni");
    await contesto.close();
  }

  console.log("\ntavolo");
  {
    const contesto = await browser.newContext({viewport:{width:1280, height:800}});
    await semeTavolo(contesto);
    await serviTavolo(contesto);
    const pagina = await contesto.newPage();
    await pagina.goto(`${BASE}/app.html`);
    await pagina.locator("#plan-svg").waitFor();
    await pagina.waitForTimeout(500);
    controlla(!await visibile(pagina, "#menubar [data-menu=file]")
      && !await visibile(pagina, "#menubar [data-menu=modifica]"), "al tavolo File e Modifica non ci sono");
    controlla(await visibile(pagina, "#menubar [data-menu=visualizza]"), "Visualizza sì");
    controlla(!await visibile(pagina, ".pal-apri"), "la palette non c'è");
    await contesto.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

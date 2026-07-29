/*
 * La fixture si verifica da sé: `node test/browser/verifica-fixture.mjs` con
 * `npm run dev` acceso. Non è un test dell'app — non entra in `npm test`, e le
 * cose che guarda sono quelle che la fixture promette: le tre chiavi dello
 * standalone arrivano dove l'app le cerca, il ponte del tavolo regge, il filtro
 * del server ha davvero tolto le note DM, e un giro di polling forzato
 * ridisegna.
 *
 * Vale anche da esempio: una verifica vera si scrive così, con le proprie
 * asserzioni al posto di queste.
 */

import {
  apriBrowser, attendiServer, BASE, documentoDiProva, giroDiPolling,
  ID, semeStandalone, semeTavolo, serviTavolo,
} from "./campagna-di-prova.mjs";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => {
  console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`);
  esito ? ok++ : ko++;
};

await attendiServer();
const { browser, contesto } = await apriBrowser();

try {
  /* --- vista DM: seminata su localStorage ---------------------------------- */
  console.log("\nStandalone (vista DM)");
  const documento = documentoDiProva({battaglia: true, pedine: true, muri: 2});
  await semeStandalone(contesto, {documento, tema: "brace"});
  const dm = await contesto.newPage();
  await dm.goto(`${BASE}/app.html`);
  await dm.waitForSelector(`.blk[data-block="${ID.locanda}"]`);

  controlla(await dm.locator(`.blk[data-block="${ID.locanda}"]`).count() === 1,
    "la bolla seminata è sulla tela con il suo id deterministico");
  controlla((await dm.locator("#crumbs").textContent()).includes("Campagna di prova"),
    "il titolo della campagna arriva dall'indice di localStorage");
  controlla(await dm.locator(".ini-row").count() === 4,
    "il tabellone d'iniziativa ha le quattro voci di root.battle (2 PG + 2 nemici)");
  controlla(await dm.locator(".ini-row.pg .ini-tipo").first().textContent() === "◆",
    "le voci dei PG si risolvono: i riferimenti puntano a players esistenti");
  controlla(await dm.locator(`.wall-seg[data-wall="${ID.muro(1)}"] .wall-seg__door`).count() > 0,
    "il primo muro è disegnato come porta");
  controlla(await dm.evaluate(() => document.documentElement.dataset.theme) === "brace",
    "il tema seminato è quello applicato");
  await dm.close();

  /* --- tavolo: ponte iniettato + polling ----------------------------------- */
  console.log("\nTavolo (sola lettura)");
  const tavolo = await browser.newContext({viewport: {width: 1280, height: 900}});
  await semeTavolo(tavolo, {documento});
  const dm2 = await serviTavolo(tavolo, {documento});
  const pg = await tavolo.newPage();
  await pg.goto(`${BASE}/app.html`);
  await pg.waitForSelector(`.blk[data-block="${ID.locanda}"]`);

  controlla(await pg.evaluate(() => document.documentElement.classList.contains("ro")),
    "l'app riconosce window.__table e si mette in sola lettura");
  controlla(await pg.evaluate(() => !JSON.stringify(window.__table.state).includes("NOTA DM")),
    "nessuna nota DM ha attraversato la proiezione");
  controlla(await pg.evaluate(() => JSON.stringify(window.__table.state).includes("Birra torbida")),
    "le note per i giocatori invece ci sono");
  controlla(await pg.locator(`.blk[data-block="${ID.incontro}"]`).count() === 0,
    "l'encounter non condiviso non è sulla tela dei giocatori");

  const rinominata = documentoDiProva({battaglia: true, pedine: true, muri: 2, nome: "Guado dell'Airone"});
  dm2.scrivi(rinominata);
  await giroDiPolling(pg);
  await pg.waitForFunction(() => document.getElementById("crumbs").textContent.includes("Guado dell'Airone"),
    null, {timeout: 3000}).catch(() => {});
  controlla((await pg.locator("#crumbs").textContent()).includes("Guado dell'Airone"),
    "un giro di polling forzato porta la scrittura del DM sul tavolo");

  const prima = dm2.giri;
  await giroDiPolling(pg);
  const dopo = dm2.giri;
  controlla(dopo.invariati === prima.invariati + 1 && dopo.scaricati === prima.scaricati,
    "senza scritture del DM il giro si chiude con un 304, non con un documento");
  controlla((await pg.locator("#savestate").textContent()).includes("Aggiornato"),
    "e il 304 lascia il tavolo 'Aggiornato', non 'Offline'");
  await tavolo.close();
} finally {
  await browser.close();
}

console.log(`\n${ok}/${ok + ko}`);
process.exit(ko ? 1 : 0);

/*
 * Regressione del pannello dettagli su schermi stretti. Vuole `npm run dev`
 * acceso; resta fuori da `npm test` come le altre verifiche Chromium.
 */

import {
  apriBrowser, attendiServer, BASE, documentoDiProva, ID, semeStandalone,
} from "./campagna-di-prova.mjs";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => {
  console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`);
  esito ? ok++ : ko++;
};

await attendiServer();
const {browser} = await apriBrowser();

try {
  for(const [nome, opzioni] of [
    ["telefono", {viewport:{width:390,height:844}, hasTouch:true}],
    ["finestra desktop stretta", {viewport:{width:760,height:720}}],
  ]){
    console.log(`\n${nome}`);
    const contesto = await browser.newContext(opzioni);
    await semeStandalone(contesto, {documento:documentoDiProva()});
    const pagina = await contesto.newPage();
    await pagina.goto(`${BASE}/app.html`);
    const bolla = pagina.locator(`.blk[data-block="${ID.locanda}"]`);
    await bolla.waitFor();

    if(opzioni.hasTouch) await bolla.tap({force:true});
    else await bolla.click({force:true});
    controlla(!await pagina.locator("#detail").evaluate(el=>el.classList.contains("open")),
      "selezionare la bolla non apre il pannello");

    await bolla.click({button:"right", force:true});
    const menu = pagina.locator("#ctx-menu.show");
    await menu.waitFor();
    const misura = await menu.evaluate(el=>({
      height:el.getBoundingClientRect().height,
      top:el.getBoundingClientRect().top,
      clientHeight:el.clientHeight,
      scrollHeight:el.scrollHeight,
      viewport:innerHeight,
    }));
    controlla(misura.top >= 8 && misura.height <= misura.viewport * .6 + 2,
      "il menu resta dentro il 60% dello schermo");
    controlla(misura.scrollHeight > misura.clientHeight,
      "le azioni eccedenti restano raggiungibili scorrendo");
    controlla(!await pagina.locator("#detail").evaluate(el=>el.classList.contains("open")),
      "il menu contestuale non apre anche il pannello");

    await menu.getByRole("button", {name:"Rinomina"}).click();
    controlla(await pagina.locator("#detail").evaluate(el=>el.classList.contains("open")),
      "Rinomina apre esplicitamente il pannello");
    await pagina.waitForFunction(()=>document.querySelector("#detail input")===document.activeElement,
      null, {timeout:1000}).catch(()=>{});
    controlla(await pagina.locator("#detail input").first().evaluate(el=>el===document.activeElement),
      "Rinomina porta il focus al titolo");

    await contesto.close();
  }
} finally {
  await browser.close();
}

console.log(`\n${ok}/${ok + ko}`);
process.exit(ko ? 1 : 0);

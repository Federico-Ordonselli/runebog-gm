/*
 * Il pennello dei corridoi (n.corridoi, 24 set 2026): dipinge trascinando,
 * cancella partendo da una cella dipinta, si spegne con Esc senza risalire di
 * livello, e si annulla con Ctrl+Z. Vuole `npm run dev` acceso; resta fuori
 * da `npm test` come le altre verifiche Chromium.
 */
import { apriBrowser, attendiServer, BASE, documentoDiProva, semeStandalone } from "./campagna-di-prova.mjs";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  const contesto = await browser.newContext({viewport:{width:1440, height:900}});
  await semeStandalone(contesto, {documento:documentoDiProva()});
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on("pageerror", e => errori.push(e.message));
  await pagina.goto(`${BASE}/app.html`);
  await pagina.locator(".blk").first().waitFor();

  const celle = () => pagina.evaluate(() => (document.getElementById("corridoi")?.getAttribute("d") || "").split("M").length - 1);

  // Si arma dalla tendina Pianta della barra a menu.
  await pagina.locator('.pal-gruppo[data-gruppo=pianta] .pal-apri').click();
  await pagina.locator('.pal-item[data-pal*=corridoi]').click();
  controlla(await pagina.locator('#plan-svg.pennello').count() === 1, "la voce accende il pennello");

  // Trascino in uno spazio vuoto per 5 celle in orizzontale.
  const box = await pagina.locator("#plan-svg").boundingBox();
  const pt = await pagina.evaluate(() => {
    const svg = document.getElementById("plan-svg"), vb = svg.viewBox.baseVal;
    return {scala: svg.clientWidth / vb.width};
  });
  const passo = 40 * pt.scala;
  const x0 = box.x + 40, y0 = box.y + box.height - 60;
  await pagina.mouse.move(x0, y0);
  await pagina.mouse.down();
  await pagina.mouse.move(x0 + passo * 5, y0, {steps:3});
  await pagina.mouse.up();
  controlla(await celle() === 1, "una corsa orizzontale è un rettangolo solo");
  const d1 = await pagina.evaluate(() => document.getElementById("corridoi").getAttribute("d"));
  const larghezza = Number(/h([\d.]+)/.exec(d1)?.[1]);
  controlla(larghezza >= 200, `nessuna cella saltata trascinando veloce (${larghezza}px)`);

  // Il pennello resta acceso: cancello partendo da una cella dipinta. Prima
  // una pausa oltre BURST_MS (stato.js), sennò i due gesti sono un annulla solo.
  await pagina.waitForTimeout(1000);
  await pagina.mouse.move(x0 + passo * 2, y0);
  await pagina.mouse.down();
  await pagina.mouse.move(x0 + passo * 2.2, y0);
  await pagina.mouse.up();
  controlla(await celle() === 2, "partendo da una cella dipinta si cancella (la corsa si spezza in due)");

  // Esc spegne il pennello e NON risale di livello.
  const prima = await pagina.evaluate(() => document.title + location.hash + (document.querySelector("#crumbs")?.textContent || ""));
  await pagina.keyboard.press("Escape");
  const dopo = await pagina.evaluate(() => document.title + location.hash + (document.querySelector("#crumbs")?.textContent || ""));
  controlla(await pagina.locator('#plan-svg.pennello').count() === 0, "Esc spegne il pennello");
  controlla(prima === dopo, "Esc non porta fuori dal livello");

  // Salvato e annullabile.
  await pagina.waitForTimeout(900);
  const s = await pagina.evaluate(() => {
    for(const k of Object.keys(localStorage)){ try{ const v = JSON.parse(localStorage.getItem(k)); if(v?.root) return v; }catch(_){} }
    return null;
  });
  controlla(Array.isArray(s?.root?.corridoi) && s.root.corridoi.length >= 4, `salvato nel documento (${s?.root?.corridoi?.length} celle)`);
  await pagina.keyboard.press("Control+z");
  await pagina.waitForTimeout(100);
  controlla(await celle() === 1, "Ctrl+Z riporta la corsa intera");

  await pagina.screenshot({path: process.env.SCATTO || "/tmp/corridoi.png"});
  controlla(errori.length === 0, `nessun errore in pagina ${errori.join(" | ")}`);
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

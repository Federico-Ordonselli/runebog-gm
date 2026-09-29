/*
 * Il bordo del pavimento dipinto e il secchiello (29 set 2026): il bordo è
 * muro dove il pavimento confina col vuoto, non dove confina con una pianta
 * o con un muro libero; il secchiello riempie un perimetro chiuso, rifiuta
 * uno aperto, e un buco cancellato col pennello si mura da sé. Vuole
 * `npm run dev` acceso; resta fuori da `npm test` come le altre verifiche.
 */
import { apriBrowser, attendiServer, BASE, documentoDiProva, semeStandalone } from "./campagna-di-prova.mjs";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

const C = 40;
const doc = documentoDiProva();
// Due celle di corridoio che arrivano al lato sinistro della locanda (x=80).
doc.root.corridoi = [[0,3],[1,3]];
// Un perimetro chiuso di 4×3 quadretti, lontano da tutto.
doc.root.wallSegs = [
  {id:"pn", x:-10*C, y:0,   dir:"h", len:4}, {id:"ps", x:-10*C, y:3*C, dir:"h", len:4},
  {id:"po", x:-10*C, y:0,   dir:"v", len:3}, {id:"pe", x:-6*C,  y:0,   dir:"v", len:3, porta:"chiusa"},
];

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  const contesto = await browser.newContext({viewport:{width:1440, height:900}});
  await semeStandalone(contesto, {documento:doc});
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on("pageerror", e => errori.push(e.message));
  await pagina.goto(`${BASE}/app.html`);
  await pagina.locator(".blk").first().waitFor();

  const bordo = () => pagina.evaluate(() => document.getElementById("corridoi-bordo")?.getAttribute("d") || "");
  const nCelle = () => pagina.evaluate(() => {
    for(const k of Object.keys(localStorage)){ try{ const v = JSON.parse(localStorage.getItem(k)); if(v?.root) return v.root.corridoi?.length ?? 0; }catch(_){} }
    return -1;
  });
  const schermo = (x, y) => pagina.evaluate(([x, y]) => {
    const svg = document.getElementById("plan-svg"), m = svg.getScreenCTM();
    const p = new DOMPoint(x, y).matrixTransform(m);
    return {x:p.x, y:p.y};
  }, [x, y]);

  const d0 = await bordo();
  controlla(d0.length > 0, "il corridoio dipinto ha il suo bordo");
  controlla(!/M80 120L80 160/.test(d0), "regola 1: il lato che tocca la locanda resta aperto");
  controlla(/M0 120L0 160/.test(d0), "il capo libero del corridoio è murato");

  // Secchiello nel perimetro chiuso.
  await pagina.locator('.pal-gruppo[data-gruppo=pavimento] .pal-apri').click();
  await pagina.locator('.pal-item[data-pal*=riempi]').click();
  controlla(await pagina.locator('#plan-svg.pennello').count() === 1, "la voce accende il secchiello");
  let p = await schermo(-8.5*C, 1.5*C);
  await pagina.mouse.click(p.x, p.y);
  await pagina.waitForTimeout(900);
  controlla(await nCelle() === 14, `il perimetro 4×3 si riempie (${await nCelle()} celle in tutto)`);
  const d1 = await bordo();
  controlla(!d1.includes("-400") && !d1.includes("-240"), "regola 2: dentro i muri e sulla porta non c'è bordo");

  // Fuori dal perimetro: area aperta, niente cambia.
  p = await schermo(-8.5*C, -1.5*C);          // appena sopra il perimetro, dentro la vista
  await pagina.mouse.click(p.x, p.y);
  await pagina.waitForTimeout(300);
  controlla(await nCelle() === 14, "un'area aperta non dipinge niente");
  const msg = await pagina.locator("#savestate").textContent();
  controlla(/non è chiuso/.test(msg || ""), `e lo dice (${msg})`);

  // Esc spegne, poi il pennello cancella la cella centrale del pavimento.
  await pagina.keyboard.press("Escape");
  await pagina.locator('.pal-gruppo[data-gruppo=pavimento] .pal-apri').click();
  await pagina.locator(`.pal-item[data-pal='{"corridoi":true}']`).click();
  p = await schermo(-8.5*C, 1.5*C);
  await pagina.mouse.move(p.x, p.y);
  await pagina.mouse.down();
  await pagina.mouse.up();
  const d2 = await bordo();
  controlla(/M-360 40L-320 40/.test(d2) && /M-320 40L-320 80/.test(d2), "il buco cancellato si mura da sé");
  await pagina.keyboard.press("Escape");

  await pagina.screenshot({path: process.env.SCATTO || "/tmp/bordo-corridoi.png"});
  controlla(errori.length === 0, `nessun errore in pagina ${errori.join(" | ")}`);
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

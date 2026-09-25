/*
 * Il pan e il pizzico tengono sotto il dito il punto afferrato (25 set 2026).
 * Il viewBox non ha le proporzioni della tela, e il browser lo scala con
 * max(w/W, h/H): calcolando w/W la mappa scivolava al 50–60% del gesto su
 * uno schermo largo ("non si aggancia al punto, scivola lentamente"). Si
 * prova su tre proporzioni di finestra, col mouse e con due dita (CDP).
 * Vuole `npm run dev` acceso; resta fuori da `npm test`.
 */
import { apriBrowser, attendiServer, BASE, documentoDiProva, semeStandalone } from "./campagna-di-prova.mjs";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

// Il punto della mappa sotto un punto dello schermo, con la trasformazione
// vera del browser: è il riferimento contro cui si misura il gesto.
const mondo = (p, x, y) => p.evaluate(([x, y]) => {
  const svg = document.getElementById("plan-svg"), q = svg.createSVGPoint();
  q.x = x; q.y = y; const m = q.matrixTransform(svg.getScreenCTM().inverse());
  return {x:m.x, y:m.y};
}, [x, y]);
const vuoto = p => p.evaluate(() => {
  const svg = document.getElementById("plan-svg"), r = svg.getBoundingClientRect();
  for(let y = r.top + r.height*0.7; y > r.top + 20; y -= 13) for(let x = r.left + r.width*0.3; x < r.right - 20; x += 17){
    const el = document.elementFromPoint(x, y);
    if(el && svg.contains(el) && !el.closest(".blk") && !el.closest(".edge")) return {x, y};
  }
});

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  for(const viewport of [{width:1600, height:700}, {width:900, height:1000}, {width:1280, height:900}]){
    const contesto = await browser.newContext({viewport});
    await semeStandalone(contesto, {documento:documentoDiProva()});
    const p = await contesto.newPage();
    await p.goto(`${BASE}/app.html`);
    await p.locator(".blk").first().waitFor();
    const a = await vuoto(p), prima = await mondo(p, a.x, a.y);
    await p.mouse.move(a.x, a.y); await p.mouse.down();
    await p.mouse.move(a.x + 150, a.y + 60, {steps:10}); await p.mouse.up();
    const dopo = await mondo(p, a.x + 150, a.y + 60);
    const scarto = Math.hypot(dopo.x - prima.x, dopo.y - prima.y);
    controlla(scarto < 1, `${viewport.width}×${viewport.height}: il punto afferrato resta sotto il mouse (scarto ${scarto.toFixed(1)})`);
    await contesto.close();
  }

  // Due dita: si allontanano (zoom) e si spostano insieme (pan).
  const contesto = await browser.newContext({viewport:{width:900, height:700}, hasTouch:true, isMobile:true});
  await semeStandalone(contesto, {documento:documentoDiProva()});
  const p = await contesto.newPage();
  await p.goto(`${BASE}/app.html`);
  await p.locator(".blk").first().waitFor();
  const cdp = await contesto.newCDPSession(p);
  const c = await vuoto(p);
  const tocca = (type, pts) => cdp.send("Input.dispatchTouchEvent", {type,
    touchPoints: pts.map(([x, y], id) => ({x, y, id, radiusX:5, radiusY:5, force:1}))});
  const prima = await mondo(p, c.x, c.y);
  await tocca("touchStart", [[c.x - 40, c.y], [c.x + 40, c.y]]);
  for(let i = 1; i <= 10; i++)
    await tocca("touchMove", [[c.x - 40 - i*6 + i*3, c.y + i*4], [c.x + 40 + i*6 + i*3, c.y + i*4]]);
  await tocca("touchEnd", []);
  const dopo = await mondo(p, c.x + 30, c.y + 40);
  const scarto = Math.hypot(dopo.x - prima.x, dopo.y - prima.y);
  controlla(scarto < 2, `pizzico: il punto fra le dita resta fra le dita (scarto ${scarto.toFixed(1)})`);
  await contesto.close();
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

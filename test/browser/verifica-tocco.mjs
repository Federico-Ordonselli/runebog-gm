/*
 * Il dito sui segnalini piccoli (25 set 2026). A mappa rimpicciolita un
 * segnalino è largo 9–18px e la maniglia dei collegamenti, raggio 11 al
 * tocco, è più grande di lui: la regolazione del tocco di Chrome consegnava
 * il pointerdown alla maniglia (invisibile, col segnalino non selezionato),
 * e il tocco non selezionava niente. Qui si prova che il tocco e il doppio
 * tocco arrivano al segnalino, e che la maniglia si prende ancora, col
 * segnalino selezionato, toccandola davvero. I tocchi passano da CDP con un
 * raggio da dito: con un raggio da punta di spillo la regolazione non
 * scatta e la prova passerebbe anche sul codice rotto. Vuole `npm run dev`
 * acceso; resta fuori da `npm test` come le altre verifiche Chromium.
 */
import { apriBrowser, attendiServer, BASE, semeStandalone, validaDocumento } from "./campagna-di-prova.mjs";
import { CURRENT_CAMPAIGN_SCHEMA_VERSION } from "../../public/app/formato-campagna.js";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

const nodo = (id, title, type, extra = {}) => ({id, title, type, status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...extra});
const documento = () => validaDocumento({schemaVersion:CURRENT_CAMPAIGN_SCHEMA_VERSION, checklist:[], players:[],
  root:nodo("radice", "Borgo", "zona", {children:[
    nodo("a", "Olmo", "png", {x:95, y:95}), nodo("b", "Ponte", "quest", {x:495, y:95, notes:"Il ponte cede"}),
    nodo("c", "Nota", "nota", {x:895, y:95}), nodo("d", "Lupi", "encounter", {x:95, y:495}),
  ]})});

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  const contesto = await browser.newContext({viewport:{width:390, height:844}, hasTouch:true, isMobile:true});
  await semeStandalone(contesto, {documento:documento()});
  const p = await contesto.newPage();
  const errori = [];
  p.on("pageerror", e => errori.push(e.message));
  const cdp = await contesto.newCDPSession(p);
  const dito = (type, pts) => cdp.send("Input.dispatchTouchEvent", {type,
    touchPoints: pts.map(([x, y], id) => ({x, y, id, radiusX:12, radiusY:12, force:1}))});
  const tocca = async (x, y) => { await dito("touchStart", [[x, y]]); await dito("touchEnd", []); };
  const apri = async () => {
    await p.goto(`${BASE}/app.html`);
    await p.locator('[data-block="a"]').waitFor();
    // Rimpicciolita attorno al centro della campagna: tutti e quattro in vista.
    await p.evaluate(() => import("/app/mappa.js").then(m => { m.planFit(); m.planZoom(0.8); }));
    await p.waitForTimeout(250);
  };
  const centro = async id => { const b = await p.locator(`[data-block="${id}"] .blk-shape`).boundingBox();
    return {x:b.x + b.width/2, y:b.y + b.height/2, w:b.width}; };
  const selezionati = () => p.evaluate(() => [...document.querySelectorAll(".blk.sel")].map(g => g.dataset.block).join());

  for(const id of ["a", "b", "c", "d"]){
    await apri();
    const c = await centro(id);
    await tocca(c.x, c.y);
    await p.waitForTimeout(150);
    controlla(await selezionati() === id, `${id}: un tocco seleziona il segnalino largo ${Math.round(c.w)}px`);
    await p.waitForTimeout(80);
    await tocca(c.x, c.y);                       // il secondo del doppio tocco, a segnalino selezionato
    await p.waitForTimeout(300);
    controlla(await p.locator("#scrittura textarea").count() === 1, `${id}: il doppio tocco apre la scrittura sul posto`);
  }

  // La maniglia si prende ancora: segnalino selezionato, dito sulla maniglia.
  await apri();
  const a = await centro("a");
  await tocca(a.x, a.y);
  await p.waitForTimeout(150);
  const h = await p.locator('[data-block="a"] .link-handle').boundingBox();
  const d = await centro("d");
  const [hx, hy] = [h.x + h.width/2, h.y + h.height/2];
  await dito("touchStart", [[hx, hy]]);
  for(let i = 1; i <= 10; i++) await dito("touchMove", [[hx + (d.x - hx)*i/10, hy + (d.y - hy)*i/10]]);
  await dito("touchEnd", []);
  await p.waitForTimeout(900);
  const archi = await p.evaluate(() => JSON.parse(localStorage.getItem("gm-campaign-prova")).root.edges);
  controlla(archi.length === 1 && archi[0].a === "a" && archi[0].b === "d",
    `dalla maniglia si collega col dito (${JSON.stringify(archi.map(e => e.a + "→" + e.b))})`);

  controlla(errori.length === 0, `nessun errore nella pagina ${errori.join(" | ")}`);
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

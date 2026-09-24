/*
 * Caselle di testo formattate e collegamenti disegnati a mano (24 set 2026).
 * Testo: titoli ed elenchi resi, bottoni del pannello, altezza scelta dal DM
 * che non torna indietro, "Adatta alla casella" che fa stare il testo.
 * Collegamenti: una traccia ondulata diventa un percorso curvo, una dritta
 * resta dritta, il percorso segue la bolla spostata, "Raddrizza" lo toglie.
 * Vuole `npm run dev` acceso; fuori da `npm test` come le altre verifiche.
 */
import { apriBrowser, attendiServer, BASE, documentoDiProva, semeStandalone, ID } from "./campagna-di-prova.mjs";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

const doc = documentoDiProva({nemici:0});
const nodo = (id, title, type, extra) => ({id, title, type, status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...extra});
doc.root.children.push(
  nodo("torre", "Torre", "luogo", {shape:"edificio", x:560, y:120, w:160, h:80}),
  nodo("cartiglio", "", "testo", {x:80, y:360, w:240, h:80,
    notes:"# Missioni\n- Trova il **traghettatore**\n  - sotto il pontile\n1. Paga il pedaggio"}));

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

  const salvato = async () => { await pagina.waitForTimeout(900);
    return pagina.evaluate(() => JSON.parse(localStorage.getItem("gm-campaign-prova"))); };
  const figlio = (d, id) => d.root.children.find(c => c.id === id);
  const schermo = (x, y) => pagina.evaluate(([x, y]) => {
    const svg = document.getElementById("plan-svg"), p = svg.createSVGPoint();
    p.x = x; p.y = y; const q = p.matrixTransform(svg.getScreenCTM());
    return {x:q.x, y:q.y};
  }, [x, y]);

  /* ---- testo ---- */
  const txt = pagina.locator('.blk.testo[data-block=cartiglio] .testo-txt');
  controlla(await txt.locator(".tr-t1").count() === 1, "il titolo è reso come titolo");
  controlla(await txt.locator(".tr-li").count() === 3 && await txt.locator(".tr-in1").count() === 1,
    "tre voci d'elenco, una rientrata");
  controlla(await txt.locator("b").textContent() === "traghettatore", "il grassetto in linea");
  const [pT, pP] = await txt.evaluate(el => [".tr-t1", ".tr-p, .tr-li"].map(s =>
    parseFloat(getComputedStyle(el.querySelector(s)).fontSize)));
  controlla(pT > pP * 1.5, `il titolo è più grande del testo (${pT} vs ${pP}px)`);

  await pagina.locator('.blk.testo[data-block=cartiglio]').click();
  const area = pagina.locator("#testo-area");
  await area.waitFor();
  await area.fill("Riepilogo\nuno\ndue");
  await area.evaluate(el => el.setSelectionRange(10, 17));
  await pagina.locator('.testo-strumenti button[title="Elenco puntato"]').click();
  await area.evaluate(el => el.setSelectionRange(0, 9));
  await pagina.locator('.testo-strumenti button[title="Titolo"]').click();
  await area.evaluate(el => el.setSelectionRange(2, 11));
  await pagina.keyboard.press("Control+b");
  let d = await salvato();
  controlla(figlio(d, "cartiglio").notes === "# **Riepilogo**\n- uno\n- due",
    `bottoni e Ctrl+B scrivono la marcatura (${JSON.stringify(figlio(d, "cartiglio").notes)})`);

  // l'altezza scelta dal DM resta anche se il testo ci sta largo
  const box = await pagina.locator('.blk.testo[data-block=cartiglio] .rs-handle').boundingBox();
  await pagina.mouse.move(box.x + 8, box.y + 8);
  await pagina.mouse.down();
  await pagina.mouse.move(box.x + 8 + 120, box.y + 8 + 260, {steps:6});
  await pagina.mouse.up();
  d = await salvato();
  const c = figlio(d, "cartiglio");
  controlla(c.h >= 300, `la casella si allunga e resta lunga (h=${c.h})`);

  // Adatta alla casella: il carattere cresce e il testo ci sta
  const px0 = await txt.evaluate(el => parseFloat(el.style.fontSize));
  await pagina.getByLabel("Adatta il testo alla casella").check();
  await pagina.waitForTimeout(100);
  const [px1, sta] = await txt.evaluate(el => [parseFloat(el.style.fontSize),
    el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1]);
  controlla(px1 > px0 * 1.5 && sta, `con "Adatta" il carattere segue la casella (${px0} → ${px1}px) e il testo ci sta`);

  /* ---- collegamenti ---- */
  await pagina.keyboard.press("Escape");
  const centro = (n) => ({x:n.x + n.w/2, y:n.y + n.h/2});
  const loc = figlio(d, ID.locanda), torre = figlio(d, "torre");
  const traccia = async (daId, punti, a) => {
    await pagina.locator(`.blk[data-block=${daId}]`).hover();
    const h = await pagina.locator(`.blk[data-block=${daId}] .link-handle`).boundingBox();
    await pagina.mouse.move(h.x + h.width/2, h.y + h.height/2);
    await pagina.mouse.down();
    for(const p of punti){ const s = await schermo(p.x, p.y); await pagina.mouse.move(s.x, s.y, {steps:4}); }
    const s = await schermo(a.x, a.y); await pagina.mouse.move(s.x, s.y, {steps:4});
    await pagina.mouse.up();
  };
  const A = centro(loc), B = centro(torre);
  const onda = Array.from({length:9}, (_, i) => ({x:A.x + 90 + i*40, y:A.y + (i%2 ? 90 : -30)}));
  await traccia(ID.locanda, onda, B);
  d = await salvato();
  let arco = d.root.edges.find(e => (e.a === ID.locanda && e.b === "torre"));
  controlla(arco && arco.percorso?.length >= 3, `una traccia ondulata lascia un percorso (${arco?.percorso?.length} punti)`);
  const dAttr = () => pagina.locator(`.edge[data-edge="${arco.id}"] .edge-line`).getAttribute("d");
  controlla(/C/.test(await dAttr()), "il collegamento si disegna come curva");

  // la bolla spostata si porta dietro il percorso
  const prima = await dAttr();
  const t = await pagina.locator('.blk[data-block=torre]').boundingBox();
  await pagina.mouse.move(t.x + t.width/2, t.y + t.height/2);
  await pagina.mouse.down();
  await pagina.mouse.move(t.x + t.width/2, t.y + t.height/2 + 200, {steps:5});
  await pagina.mouse.up();
  const dopo = await dAttr();
  controlla(dopo !== prima && /C/.test(dopo), "spostando una bolla il percorso la segue");

  // ritracciare dritto lo stesso collegamento lo raddrizza, senza doppioni
  d = await salvato();
  await traccia("torre", [], centro(figlio(d, ID.locanda)));
  d = await salvato();
  const archi = d.root.edges.filter(e => [e.a, e.b].includes("torre"));
  controlla(archi.length === 1 && !archi[0].percorso, "ritracciato dritto: un arco solo, senza percorso");

  // e ridisegnato curvo, il pannello lo raddrizza
  await traccia(ID.locanda, onda, centro(figlio(d, "torre")));
  await pagina.getByRole("button", {name:"Raddrizza"}).click();
  d = await salvato();
  controlla(!d.root.edges.find(e => e.id === arco.id).percorso, "Raddrizza toglie il percorso");

  controlla(errori.length === 0, `nessun errore nella pagina${errori.length ? ": " + errori.join(" | ") : ""}`);
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

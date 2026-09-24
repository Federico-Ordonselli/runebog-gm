/*
 * La penna dei muri e le aperture nel quadretto (24 set 2026): con "Muro"
 * armato, tenere premuto e trascinare traccia un segmento per tratto dritto
 * (angolo dove il puntatore lascia l'asse), la penna resta armata, un clic
 * secco posa il muro da due e la spegne; sul muro lungo "Metti qui" lo spezza
 * in tre con il vano nel quadretto toccato. Vuole `npm run dev` acceso.
 */
import { apriBrowser, attendiServer, BASE, documentoDiProva, semeStandalone } from "./campagna-di-prova.mjs";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  const contesto = await browser.newContext({viewport:{width:1440, height:900}});
  await semeStandalone(contesto, {documento:documentoDiProva({nemici:0})});
  const pagina = await contesto.newPage();
  const errori = [];
  pagina.on("pageerror", e => errori.push(e.message));
  await pagina.goto(`${BASE}/app.html`);
  await pagina.locator(".blk").first().waitFor();

  const salvato = async () => { await pagina.waitForTimeout(900);
    return pagina.evaluate(() => JSON.parse(localStorage.getItem("gm-campaign-prova")).root.wallSegs || []); };
  const schermo = (x, y) => pagina.evaluate(([x, y]) => {
    const svg = document.getElementById("plan-svg"), p = svg.createSVGPoint();
    p.x = x; p.y = y; const q = p.matrixTransform(svg.getScreenCTM());
    return {x:q.x, y:q.y};
  }, [x, y]);
  const arma = async () => {
    await pagina.locator('.pal-gruppo[data-gruppo=pianta] .pal-apri').click();
    await pagina.locator(`.pal-item[data-pal='{"wall":true}']`).click();
  };
  const tratto = async punti => {
    const [a, ...resto] = punti;
    let s = await schermo(a.x, a.y);
    await pagina.mouse.move(s.x, s.y); await pagina.mouse.down();
    for(const p of resto){ s = await schermo(p.x, p.y); await pagina.mouse.move(s.x, s.y, {steps:8}); }
    await pagina.mouse.up();
  };

  // Una L: 6 quadretti a destra, poi 3 in giù, con un po' di tremolio.
  await arma();
  await tratto([{x:-158, y:242}, {x:-40, y:246}, {x:82, y:238}, {x:85, y:300}, {x:78, y:362}]);
  let muri = await salvato();
  const L = muri.map(w => `${w.dir}${w.len}@${w.x},${w.y}`).sort();
  controlla(muri.length === 2 && L.includes("h6@-160,240") && L.includes("v3@80,240"),
    `la penna traccia una L di due segmenti agganciati (${L.join(" ")})`);
  controlla(await pagina.locator("#plan-svg.arming").count() === 1, "dopo un tratto la penna resta armata");

  // Tornando indietro sullo stesso asse il muro si accorcia, non si sdoppia.
  await tratto([{x:-160, y:0}, {x:0, y:0}, {x:-40, y:2}]);
  muri = await salvato();
  controlla(muri.some(w => w.dir === "h" && w.len === 3 && w.x === -160 && w.y === 0) && muri.length === 3,
    "avanti e indietro lascia un muro solo, lungo quanto l'ultimo punto");

  // Clic secco: il muro da due di sempre, e la penna si spegne.
  const s = await schermo(400, 40);
  await pagina.mouse.click(s.x, s.y);
  muri = await salvato();
  controlla(muri.length === 4 && muri.some(w => w.len === 2 && w.y === 40), "un clic posa il muro da due quadretti");
  controlla(await pagina.locator("#plan-svg.arming").count() === 0, "e spegne la penna");

  // Tocco il quadretto 3 del muro lungo 6 e ci metto una porta dal pannello.
  const q = await schermo(-160 + 2.5*40, 240);
  await pagina.mouse.click(q.x, q.y);
  controlla(await pagina.locator(".wall-seg.sel .wall-seg__cella").count() === 1, "il quadretto toccato è evidenziato");
  await pagina.getByRole("button", {name:"Porta chiusa"}).click();
  muri = await salvato();
  const riga = muri.filter(w => w.dir === "h" && w.y === 240).sort((a, b) => a.x - b.x)
    .map(w => `${w.x}:${w.len}${w.porta ? ":" + w.porta : ""}`);
  controlla(riga.join(" ") === "-160:2 -80:1:chiusa -40:3", `il muro si spezza con la porta nel quadretto 3 (${riga.join(" ")})`);

  // Sul muro verticale il menu contestuale offre il quadretto toccato.
  const v = await schermo(80, 240 + 2.5*40);
  await pagina.mouse.click(v.x, v.y, {button:"right"});
  await pagina.locator("#ctx-menu").getByText("Finestra").click();
  muri = await salvato();
  const col = muri.filter(w => w.dir === "v" && w.x === 80).sort((a, b) => a.y - b.y)
    .map(w => `${w.y}:${w.len}${w.porta ? ":" + w.porta : ""}`);
  controlla(col.join(" ") === "240:2 320:1:finestra", `dal menu la finestra va in fondo al muro verticale (${col.join(" ")})`);
  controlla(await pagina.locator(".wall-seg__win").count() === 2, "la finestra si disegna con la doppia linea");

  // Ctrl+Z toglie la finestra in un colpo.
  await pagina.keyboard.press("Escape");
  await pagina.keyboard.press("Control+z");
  muri = await salvato();
  controlla(muri.some(w => w.dir === "v" && w.len === 3 && !w.porta), "Ctrl+Z ricompone il muro");

  controlla(errori.length === 0, `nessun errore nella pagina${errori.length ? ": " + errori.join(" | ") : ""}`);
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

/*
 * I materiali del pavimento (n.pavimenti, 29 set 2026): la tendina Pavimento
 * ha un pennello per materiale generato da MATERIALI; ripassare con un altro
 * materiale cambia la cella, ripassare col suo la cancella; Riempi usa
 * l'ultimo materiale scelto; le texture si caricano davvero e sopra c'è la
 * maglia; al tavolo arrivano. Vuole `npm run dev` acceso; resta fuori da
 * `npm test` come le altre verifiche Chromium.
 */
import { apriBrowser, attendiServer, BASE, documentoDiProva, semeStandalone,
         semeTavolo, serviTavolo, ID } from "./campagna-di-prova.mjs";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

const C = 40;
const doc = documentoDiProva();
// Un perimetro chiuso di 4×3 quadretti, a sinistra della locanda.
doc.root.wallSegs = [
  {id:"pn", x:-10*C, y:0,   dir:"h", len:4}, {id:"ps", x:-10*C, y:3*C, dir:"h", len:4},
  {id:"po", x:-10*C, y:0,   dir:"v", len:3}, {id:"pe", x:-6*C,  y:0,   dir:"v", len:3},
];

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  const contesto = await browser.newContext({viewport:{width:1440, height:900}});
  await semeStandalone(contesto, {documento:doc});
  const pagina = await contesto.newPage();
  const errori = [], mancanti = [];
  pagina.on("pageerror", e => errori.push(e.message));
  pagina.on("response", r => { if(r.url().includes("/app/materiali/") && r.status() >= 400) mancanti.push(r.url()); });
  await pagina.goto(`${BASE}/app.html`);
  await pagina.locator(".blk").first().waitFor();

  const documento = () => pagina.evaluate(() => {
    for(const k of Object.keys(localStorage)){ try{ const v = JSON.parse(localStorage.getItem(k)); if(v?.root) return v; }catch(_){} }
    return null;
  });
  const quante = async m => (await documento())?.root?.pavimenti?.[m]?.length ?? 0;
  const schermo = (x, y) => pagina.evaluate(([x, y]) => {
    const p = new DOMPoint(x, y).matrixTransform(document.getElementById("plan-svg").getScreenCTM());
    return {x:p.x, y:p.y};
  }, [x, y]);
  const scegli = async pal => {
    await pagina.locator('.pal-gruppo[data-gruppo=pavimento] .pal-apri').click();
    await pagina.locator(`.pal-item[data-pal='${pal}']`).click();
  };
  const trascina = async (celle) => {
    const punti = [];
    for(const [i, j] of celle) punti.push(await schermo((i + .5) * C, (j + .5) * C));
    await pagina.mouse.move(punti[0].x, punti[0].y);
    await pagina.mouse.down();
    for(const p of punti.slice(1)) await pagina.mouse.move(p.x, p.y, {steps:4});
    await pagina.mouse.up();
    await pagina.waitForTimeout(1000);           // oltre BURST_MS: un gesto, un annulla
  };

  const voci = await pagina.locator('.pal-gruppo[data-gruppo=pavimento] .pal-item').count();
  controlla(voci === 14, `la tendina Pavimento ha Riempi, Velato e i 12 materiali (${voci})`);

  // Acqua bassa su tre celle sotto il perimetro.
  await scegli('{"corridoi":true,"materiale":"acqua-bassa"}');
  await trascina([[-10,5],[-9,5],[-8,5]]);
  controlla(await quante("acqua-bassa") === 3, "il pennello dell'acqua dipinge tre celle d'acqua");
  controlla(await pagina.locator("#mat-acqua-bassa image").count() === 1, "la texture entra nei defs");
  controlla(((await pagina.getAttribute("#pav-griglia", "d")) || "").length > 0, "sopra il materiale c'è la maglia doppia");

  // Lava sulla cella di mezzo: cambia materiale, non cancella.
  await pagina.keyboard.press("Escape");
  await scegli('{"corridoi":true,"materiale":"lava"}');
  await trascina([[-9,5]]);
  controlla(await quante("lava") === 1 && await quante("acqua-bassa") === 2, "ripassare con la lava cambia la cella");
  // Di nuovo con la lava sulla stessa cella: la cancella.
  await trascina([[-9,5]]);
  controlla(await quante("lava") === 0 && await quante("acqua-bassa") === 2, "ripassare col suo materiale la cancella");

  // Riempi usa l'ultimo pennello: la lava.
  await pagina.keyboard.press("Escape");
  await scegli('{"riempi":true}');
  const hint = await pagina.locator("#plan-hint").textContent();
  controlla(/Lava/.test(hint || ""), `l'aiuto dice con cosa riempie (${hint?.trim()})`);
  const p = await schermo(-8.5*C, 1.5*C);
  await pagina.mouse.click(p.x, p.y);
  await pagina.waitForTimeout(1000);
  controlla(await quante("lava") === 12, `il secchiello riempie il perimetro di lava (${await quante("lava")})`);
  await pagina.keyboard.press("Escape");

  // Erba accanto all'acqua: compare la riva, e non è un muro.
  await scegli('{"corridoi":true,"materiale":"erba"}');
  await trascina([[-11,5],[-11,6],[-10,6],[-9,6],[-8,6]]);
  await pagina.keyboard.press("Escape");
  const riva = (await pagina.getAttribute("#riva", "d")) || "";
  controlla(riva.length > 0, "fra acqua ed erba compare la riva");
  controlla(!/M-400 200L-400 240/.test((await pagina.getAttribute("#corridoi-bordo", "d")) || ""),
    "e fra i due materiali non c'è muro");

  // Le immagini si caricano davvero.
  const caricate = await pagina.evaluate(async () => {
    const r = await Promise.all(["lava","acqua-bassa"].map(m => fetch(`/app/materiali/${m}.webp`).then(x => x.ok)));
    return r.every(Boolean);
  });
  controlla(caricate && mancanti.length === 0, `le texture rispondono ${mancanti.join(" ")}`);

  /* Il documento salvato riaperto da capo: passa da migrateState e dalla
     bonifica, cioè dal percorso di ogni caricamento. Non con reload():
     semeStandalone è uno script d'avvio e ri-seminerebbe il documento
     iniziale. */
  const salvato = await documento();
  const riaperto = await browser.newContext({viewport:{width:1440, height:900}});
  await semeStandalone(riaperto, {documento:salvato});
  const pr = await riaperto.newPage();
  pr.on("pageerror", e => errori.push("riaperto: " + e.message));
  await pr.goto(`${BASE}/app.html`);
  await pr.locator(".blk").first().waitFor();
  controlla(((await pr.getAttribute("#pav-lava", "d")) || "").length > 0
    && ((await pr.getAttribute("#pav-acqua-bassa", "d")) || "").length > 0, "riaperto, il pavimento è ancora lì");
  await pr.screenshot({path: process.env.SCATTO || "/tmp/materiali.png"});
  await riaperto.close();

  // Al tavolo.
  const tavolo = await browser.newContext({viewport:{width:1280, height:900}});
  await semeTavolo(tavolo, {documento:salvato});
  await serviTavolo(tavolo, {documento:salvato});
  const pg = await tavolo.newPage();
  pg.on("pageerror", e => errori.push("tavolo: " + e.message));
  await pg.goto(`${BASE}/app.html`);
  await pg.waitForSelector(`.blk[data-block="${ID.locanda}"]`);
  controlla(((await pg.getAttribute("#pav-lava", "d")) || "").length > 0
    && await pg.locator("#mat-lava").count() === 1, "al tavolo i giocatori vedono la lava");
  controlla(await pg.locator('.pal-gruppo[data-gruppo=pavimento]').isHidden(), "al tavolo la tendina non c'è");
  await tavolo.close();

  controlla(errori.length === 0, `nessun errore in pagina ${errori.join(" | ")}`);
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

/*
 * Eventi legati a una bolla ed eventi che si ripetono (25 set 2026): dal
 * pannello di un PNG nasce un evento già legato, che nel calendario si
 * sposta di data, si ripete ogni N anni, porta alla bolla, e dal pannello si
 * ritrova. Al tavolo il legame porta a una bolla rivelata e non nomina
 * quelle nascoste. Vuole `npm run dev` acceso; resta fuori da `npm test`
 * come le altre verifiche Chromium.
 */
import { apriBrowser, attendiServer, BASE, semeStandalone, semeTavolo, serviTavolo,
  validaDocumento } from "./campagna-di-prova.mjs";
import { CURRENT_CAMPAIGN_SCHEMA_VERSION, calendarioPredefinito } from "../../public/app/formato-campagna.js";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => { console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`); esito ? ok++ : ko++; };

const nodo = (id, title, type, extra = {}) => ({id, title, type, status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...extra});
const documento = () => validaDocumento({
  schemaVersion:CURRENT_CAMPAIGN_SCHEMA_VERSION, checklist:[], players:[],
  calendario:{...calendarioPredefinito(), oggi:10},
  root:nodo("radice", "Valle dell'Airone", "zona", {shared:true, children:[
    nodo("mercante", "Orsola la mercante", "png", {x:15, y:15, shared:true}),
    nodo("covo", "Covo dei ladri", "luogo", {x:200, y:15}),
  ]}),
});
const salvato = p => p.evaluate(() => JSON.parse(localStorage.getItem("gm-campaign-prova")));
const attendiSalvataggio = p => p.waitForTimeout(900);          // il salvataggio è ritardato di 700 ms
const testo = (p, sel) => p.textContent(sel).then(t => t.replace(/\s+/g, " ").trim());
const fuoco = p => p.evaluate(() => document.activeElement?.id);

await attendiServer(`${BASE}/app.html`);
const {browser} = await apriBrowser();
try {
  const contesto = await browser.newContext({viewport:{width:1280, height:900}});
  await semeStandalone(contesto, {documento:documento()});
  const p = await contesto.newPage();
  const errori = [];
  p.on("pageerror", e => errori.push(e.message));
  await p.goto(`${BASE}/app.html`);
  await p.locator('[data-block="mercante"]').waitFor();

  // --- dal pannello della bolla ---
  await p.evaluate(() => window.goToNode("mercante"));
  await p.locator('#detail button:has-text("+ Evento per questa bolla")').click();
  await p.waitForFunction(() => document.getElementById("view-cal")?.classList.contains("active")
    && document.activeElement?.classList.contains("cal-ev-titolo"));
  controlla(true, "«+ Evento per questa bolla» apre il calendario sul titolo del nuovo evento");
  await p.keyboard.type("Fiera del grano");
  await p.keyboard.press("Enter");
  await attendiSalvataggio(p);
  let ev = (await salvato(p)).calendario.eventi[0];
  const id = ev.id;
  controlla(ev.nodeId === "mercante" && ev.giorno === 10 && ev.titolo === "Fiera del grano",
    "l'evento nasce oggi, legato al PNG");
  controlla((await p.inputValue(`#cal-ev-b-${id}`)) === "mercante", "il campo Bolla lo dice");

  // --- la data ---
  await p.fill(`#cal-ev-dg-${id}`, "20");
  await p.press(`#cal-ev-dg-${id}`, "Tab");
  await p.waitForTimeout(50);
  controlla(await fuoco(p) === `cal-ev-dm-${id}`, "il Tab dal giorno arriva al mese anche dopo il ridisegno");
  await p.selectOption(`#cal-ev-dm-${id}`, "2");
  await p.waitForTimeout(50);
  await attendiSalvataggio(p);
  ev = (await salvato(p)).calendario.eventi[0];
  controlla(ev.giorno === 31 + 28 + 20, `giorno 20 di marzo = giorno ${31 + 28 + 20} (${ev.giorno})`);
  controlla((await testo(p, "#cal-giorno-titolo")).startsWith("20 Marzo"), "la vista segue l'evento spostato");
  controlla(await fuoco(p) === `cal-ev-dm-${id}`, "il focus resta sul mese");

  // --- la ricorrenza ---
  await p.selectOption(`#cal-ev-r-${id}`, "anni");
  await p.waitForTimeout(50);
  await p.locator(`#cal-ev-o-${id}`).waitFor();
  await p.fill(`#cal-ev-o-${id}`, "2");
  await p.press(`#cal-ev-o-${id}`, "Tab");
  await attendiSalvataggio(p);
  ev = (await salvato(p)).calendario.eventi[0];
  controlla(ev.ripeti?.unita === "anni" && ev.ripeti?.ogni === 2, "si ripete ogni 2 anni");
  controlla((await testo(p, `.cal-ripeti`)).includes("ogni 2 anni"), "e lo dice sotto il campo");
  controlla((await p.textContent('.cal-ev .btn.danger')).includes("tutte le volte"),
    "eliminare dice che toglie tutte le volte");

  const inAnno = async anno => {
    await p.evaluate(a => window.calScegli((a - 1) * 365 + 31 + 28 + 20, true), anno);
    return p.locator(".cal-g.scelto .cal-voce").allTextContents();
  };
  controlla((await inAnno(3)).includes("↻ Fiera del grano"), "cade il 20 marzo dell'anno 3");
  controlla(!(await inAnno(2)).length, "e non dell'anno 2");
  controlla((await testo(p, ".cal-prossimi")).includes("↻ Fiera del grano"), "compare in «In arrivo»");

  // --- dal calendario alla bolla, e ritorno ---
  await p.evaluate(() => window.calScegli(79, true));
  await p.locator(`.cal-ev button:has-text("Mostra sulla mappa")`).first().click();
  await p.waitForFunction(() => document.getElementById("view-map")?.classList.contains("active"));
  controlla(true, "«Mostra sulla mappa» porta alla bolla");
  const pannello = await testo(p, "#detail");
  controlla(pannello.includes("Nel calendario") && pannello.includes("20 Marzo, anno 1")
    && pannello.includes("ogni 2 anni"), "il pannello del PNG elenca l'evento con la sua prossima data");
  await p.locator("#detail .cal-prossimo").click();
  await p.waitForFunction(() => document.getElementById("view-cal")?.classList.contains("active"));
  controlla((await testo(p, "#cal-giorno-titolo")).startsWith("20 Marzo, anno 1")
    && await fuoco(p) === "cal-giorno-titolo", "e da lì si torna al giorno dell'evento, col focus sul titolo");

  // --- un evento del DM legato al covo, che al tavolo non va nominato ---
  await p.click('button:has-text("+ Evento in questo giorno")');
  await p.waitForFunction(() => document.querySelectorAll(".cal-ev").length === 2);
  const id2 = await p.evaluate(() => document.activeElement.id.slice("cal-ev-t-".length));
  await p.keyboard.type("Colpo alla fiera");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(50);
  await p.selectOption(`#cal-ev-b-${id2}`, "covo");
  await p.waitForTimeout(50);
  await p.locator(`#cal-ev-v-${id2}`).check();
  await p.locator(`#cal-ev-v-${id}`).check();
  await attendiSalvataggio(p);
  const docDM = await salvato(p);
  controlla(docDM.calendario.eventi[1].nodeId === "covo" && docDM.calendario.eventi.every(e => e.visibile),
    "secondo evento legato al covo, entrambi visibili");

  // --- annulla (fuori da un campo: dentro, Ctrl+Z è del campo) ---
  await p.click("#tab-cal");
  await p.keyboard.press("ControlOrMeta+z");
  await attendiSalvataggio(p);
  controlla(!(await salvato(p)).calendario.eventi[0].visibile, "Ctrl+Z toglie l'ultima spunta");
  controlla(errori.length === 0, "nessun errore nella pagina" + (errori.length ? `: ${errori}` : ""));
  await contesto.close();

  // --- telefono: i campi dell'evento stanno nello schermo ---
  const tel = await browser.newContext({viewport:{width:360, height:740}, hasTouch:true, isMobile:true});
  await semeStandalone(tel, {documento:docDM});
  const m = await tel.newPage();
  await m.goto(`${BASE}/app.html`);
  await m.locator('[data-block="mercante"]').waitFor();
  await m.evaluate(() => { window.showView("cal"); window.calScegli(79, true); });
  await m.locator(".cal-data").first().waitFor();
  const largo = await m.evaluate(() => document.getElementById("view-cal").scrollWidth);
  controlla(largo <= 360, `data, ricorrenza e bolla stanno in 360px (${largo}px)`);
  await tel.close();

  // --- tavolo ---
  const tav = await browser.newContext({viewport:{width:1280, height:900}});
  await semeTavolo(tav, {documento:docDM});
  const g = await tav.newPage();
  const errTav = [];
  g.on("pageerror", e => errTav.push(e.message));
  await serviTavolo(g, {documento:docDM});
  await g.goto(`${BASE}/app.html`);
  await g.locator('[data-block="mercante"]').waitFor();
  const stato = await g.evaluate(() => JSON.stringify(window.__table.state));
  controlla(!stato.includes("covo"), "al tavolo l'id del covo non arriva, nemmeno dal legame");
  await g.click("#tab-cal");
  await g.evaluate(() => window.calScegli(79, true));
  const giorno = await testo(g, ".cal-giorno");
  controlla(giorno.includes("Fiera del grano") && giorno.includes("ogni 2 anni") && giorno.includes("→ Orsola la mercante"),
    "al tavolo l'evento dice ogni quanto e porta al PNG rivelato");
  controlla(giorno.includes("Colpo alla fiera") && (await g.locator(".cal-giorno .cal-bolla").count()) === 1,
    "l'evento legato al covo si legge, senza link");
  await g.locator(".cal-giorno .cal-bolla").click();
  await g.waitForFunction(() => document.getElementById("view-map")?.classList.contains("active"));
  controlla((await testo(g, "#detail")).includes("Nel calendario"), "e il pannello del PNG al tavolo lo elenca");
  controlla(errTav.length === 0, "nessun errore al tavolo" + (errTav.length ? `: ${errTav}` : ""));
  await tav.close();
} finally {
  await browser.close();
}
console.log(`\n${ok} ok, ${ko} KO`);
process.exit(ko ? 1 : 0);

/*
 * Quanto costa muoversi su una campagna carica (25 set 2026). Non è una
 * verifica: non ha soglie, stampa numeri. È nata per la segnalazione "lo
 * spostamento nelle bolle è lento", e la prima misura ha detto dove NON è il
 * problema — il pan riscrive solo il viewBox e resta a 60 fps anche con 120
 * caselle — e dove sì: ogni clic che ridisegna la tela (selezione, salto,
 * entrare e uscire) ricrea da capo tutti i `foreignObject` delle caselle di
 * testo, e il layout cresce con loro (a CPU ×4: ~70 ms con 40 caselle, ~150
 * con 120). Il profilo lo attribuisce ad allineaPalette, che è solo la prima
 * a leggere una misura dopo il disegno: disattivarla non cambia il totale.
 *
 *   TESTI=120 CPU=4 node test/browser/misura-ridisegno.mjs   (npm run dev acceso)
 *   PROFILO=1 aggiunge le funzioni più costose del ridisegno.
 */
import { apriBrowser, attendiServer, BASE, semeStandalone, validaDocumento } from "./campagna-di-prova.mjs";
import { CURRENT_CAMPAIGN_SCHEMA_VERSION } from "../../public/app/formato-campagna.js";

const TESTI = Number(process.env.TESTI ?? 40), CPU = Number(process.env.CPU ?? 4);
const nodo = (id, title, type, extra = {}) => ({id, title, type, status:"", notes:"", img:null,
  children:[], edges:[], x:null, y:null, shape:null, ...extra});
const testo = "# Missione\n## La cripta\n- trovare la chiave\n- **non** svegliare il custode\n  - rientro\n1. uno\n2. due\n---\n*corsivo* e ~~barrato~~ con un testo lungo che va a capo più volte dentro la casella.";
const figli = [];
for(let i = 0; i < TESTI; i++) figli.push(nodo(`t${i}`, "", "testo",
  {x:(i%8)*260, y:Math.floor(i/8)*220, w:240, h:200, notes:testo, textFit:i%2===0}));
for(let i = 0; i < 30; i++) figli.push(nodo(`p${i}`, `PNG ${i}`, "png", {x:(i%10)*200+15, y:-400+Math.floor(i/10)*120+15}));
for(let i = 0; i < 10; i++) figli.push(nodo(`z${i}`, `Luogo ${i}`, "luogo", {shape:"edificio", x:i*220, y:-800, w:200, h:160,
  children:[nodo(`z${i}a`, "Stanza", "luogo", {shape:"stanza", x:0, y:0, w:80, h:80})]}));
const documento = validaDocumento({schemaVersion:CURRENT_CAMPAIGN_SCHEMA_VERSION,
  root:nodo("radice", "Prova pesante", "zona", {children:figli}), checklist:[], players:[]});

await attendiServer(`${BASE}/app.html`);
const {browser, contesto} = await apriBrowser();
try {
  await semeStandalone(contesto, {documento});
  const p = await contesto.newPage();
  await p.goto(`${BASE}/app.html`);
  await p.locator('[data-block="p0"]').waitFor();
  const cdp = await contesto.newCDPSession(p);
  await cdp.send("Emulation.setCPUThrottlingRate", {rate:CPU});
  console.log(`${TESTI} caselle di testo, CPU ×${CPU}`);

  // Pan: fotogrammi durante il gesto, trascinando da un punto vuoto della tela.
  const vuoto = await p.evaluate(() => {
    const svg = document.getElementById("plan-svg"), r = svg.getBoundingClientRect();
    for(let y = r.bottom - 20; y > r.top; y -= 17) for(let x = r.left + 20; x < r.right; x += 23){
      const el = document.elementFromPoint(x, y);
      if(el && svg.contains(el) && !el.closest(".blk")) return {x, y};
    }
  });
  await p.evaluate(() => { window.__fr = []; let prima = performance.now(); window.__on = true;
    const giro = t => { window.__fr.push(t - prima); prima = t; if(window.__on) requestAnimationFrame(giro); };
    requestAnimationFrame(giro); });
  await p.mouse.move(vuoto.x, vuoto.y); await p.mouse.down();
  for(let i = 0; i < 60; i++) await p.mouse.move(vuoto.x - i*6, vuoto.y - i*4);
  await p.mouse.up();
  const fr = (await p.evaluate(() => { window.__on = false; return window.__fr; })).slice(2);
  console.log(`pan: fotogramma medio ${(fr.reduce((a, b) => a + b, 0) / fr.length).toFixed(1)} ms, sopra 50 ms: ${fr.filter(x => x > 50).length}`);

  if(process.env.PROFILO){
    await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", {interval:200});
    await cdp.send("Profiler.start");
    await p.evaluate(async () => { for(let i = 0; i < 10; i++){ window.goToNode(i % 2 ? "p5" : "p6");
      await new Promise(r => requestAnimationFrame(() => setTimeout(r))); } });
    const {profile} = await cdp.send("Profiler.stop");
    const perId = new Map(profile.nodes.map(n => [n.id, n])), tot = {};
    profile.samples.forEach((id, i) => { const f = perId.get(id).callFrame;
      const k = `${f.functionName || "(anonima)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`;
      tot[k] = (tot[k] || 0) + (profile.timeDeltas[i] || 0); });
    for(const [k, v] of Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 10))
      console.log(`  ${(v / 10000).toFixed(1).padStart(6)} ms a ridisegno  ${k}`);
  }

  // Ridisegni interi: dal gesto al fotogramma dopo, media di otto giri.
  const tempi = await p.evaluate(async () => {
    const out = {};
    const giro = async (nome, f) => { const t = [];
      for(let i = 0; i < 8; i++){ const a = performance.now(); f();
        await new Promise(r => requestAnimationFrame(() => setTimeout(r))); t.push(performance.now() - a); }
      out[nome] = `${(t.reduce((x, y) => x + y) / t.length).toFixed(1)} ms`; };
    await giro("seleziona e centra un PNG", () => window.goToNode(`p${Math.floor(Math.random()*30)}`));
    await giro("entra in un luogo e torna", () => { window.enterNode("z2"); window.goToNode("radice"); });
    return out;
  });
  for(const [k, v] of Object.entries(tempi)) console.log(`${k}: ${v}`);
} finally {
  await browser.close();
}

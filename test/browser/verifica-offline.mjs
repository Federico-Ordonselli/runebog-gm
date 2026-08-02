/*
 * La copia offline si verifica staccando la rete: `node
 * test/browser/verifica-offline.mjs`.
 *
 * **Serve `npm run build && npm run start`, non `npm run dev.`** Due ragioni,
 * ed entrambe fanno fallire la verifica in modo confuso se si sbaglia: in dev
 * le pagine dell'SRD si compilano su richiesta, e scaricarne 61 in un
 * `cache.addAll` va in timeout; e `/sw.js` è una rotta `force-static`, cioè in
 * produzione è un asset e in dev è una funzione — la cosa da provare è la
 * prima.
 *
 * Come `verifica-fixture.mjs`: sta fuori da `npm test`, che elenca le cartelle
 * una per una. Qui girano playwright-core, un Chromium e un server.
 *
 * Le tre cose che guarda sono quelle che a occhio non si vedono:
 *   1. l'editor regge davvero senza rete (e i moduli ES hanno girato);
 *   2. gli invarianti di sicurezza — /play, /tavolo e /api non entrano MAI in
 *      cache, nemmeno dopo essere passati;
 *   3. l'aggiornamento, che è l'unico percorso che nessun clic incontra: un
 *      deploy nuovo mentre l'utente ha già le regole scaricate, e lo stesso
 *      deploy con la rete che cade a metà.
 */

import { apriBrowser, attendiServer, BASE } from "./campagna-di-prova.mjs";

let ok = 0, ko = 0;
const controlla = (esito, cosa) => {
  console.log(`${esito ? "  ok  " : "  KO  "} ${cosa}`);
  esito ? ok++ : ko++;
};

const depositi = (pag) => pag.evaluate(() => caches.keys());
const voci = (pag, prefisso) =>
  pag.evaluate(async (p) => {
    const n = (await caches.keys()).find((x) => x.startsWith(p));
    return n ? (await (await caches.open(n)).keys()).length : 0;
  }, prefisso);

/* Un deploy si finge cambiando l'URL dello script, NON con
   unregister()+register(): quella coppia, con un client ancora controllato,
   resuscita la registrazione invece di installarne una nuova (è quel che dice
   la specifica), e l'activate non gira — la verifica passerebbe guardando il
   lavoro di prima. */
const comeUnDeploy = (pag) =>
  pag.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    if (r) await r.unregister();
    await navigator.serviceWorker.register("/sw.js?deploy=" + Date.now());
    await navigator.serviceWorker.ready;
  });

const attendi = async (pag, condizione, giri = 60) => {
  for (let i = 0; i < giri; i++) {
    if (condizione(await depositi(pag))) return true;
    await pag.waitForTimeout(500);
  }
  return false;
};

await attendiServer();
const { browser, contesto } = await apriBrowser();
const pag = await contesto.newPage();

try {
  console.log("\n1. L'editor si precarica da sé, le regole no");
  await pag.goto(BASE + "/app.html", { waitUntil: "networkidle" });
  await pag.evaluate(() => navigator.serviceWorker.ready);
  await attendi(pag, (d) => d.some((n) => n.startsWith("runebog-app-")));
  const primi = await depositi(pag);
  controlla(primi.some((n) => n.startsWith("runebog-app-")), "deposito dell'editor: " + primi.join(", "));
  controlla(!primi.some((n) => n.startsWith("runebog-regole-")), "le regole NON si scaricano da sé: 1,3 MB si chiedono");
  controlla((await voci(pag, "runebog-app-")) > 25, `precaricati ${await voci(pag, "runebog-app-")} file`);

  console.log("\n2. Senza rete");
  await contesto.setOffline(true);
  const r1 = await pag.goto(BASE + "/app.html", { waitUntil: "domcontentloaded" });
  controlla(r1?.status() === 200, "/app.html risponde 200 con la rete staccata");
  await pag.waitForTimeout(1200);
  const vivo = await pag.evaluate(() => ({
    tela: !!document.querySelector("#plan-svg"),
    temi: document.querySelectorAll("#theme-select option").length,
    mostri: Object.keys(window.SRD_MONSTERS || {}).length,
  }));
  controlla(vivo.tela, "la tela c'è");
  controlla(vivo.temi >= 12, `i moduli ES hanno girato (${vivo.temi} temi nel select)`);
  controlla(vivo.mostri > 300, `il bestiario è offline (${vivo.mostri} schede)`);
  await contesto.setOffline(false);

  console.log("\n3. Invariante: /play, /tavolo e /api non entrano in cache");
  const trapelati = await pag.evaluate(async () => {
    await fetch("/tavolo/token-inventato").catch(() => {});
    await fetch("/api/campaigns").catch(() => {});
    const fuori = [];
    for (const n of await caches.keys())
      fuori.push(...(await (await caches.open(n)).keys()).map((r) => new URL(r.url).pathname));
    return fuori.filter((p) => p.startsWith("/play/") || p.startsWith("/tavolo/") || p.startsWith("/api/"));
  });
  controlla(trapelati.length === 0, "niente in cache: " + (trapelati.join(", ") || "nessuno"));

  console.log("\n4. Il secondo livello: le regole si chiedono da /srd");
  const srd = await contesto.newPage();
  await srd.goto(BASE + "/srd", { waitUntil: "networkidle" });
  const bottone = srd.locator(".srd-offline button").first();
  controlla(await bottone.isVisible(), "il bottone dice quanto costa: " + (await bottone.textContent()));
  await bottone.click();
  await srd.locator(".srd-offline", { hasText: "sul dispositivo" }).waitFor({ timeout: 120000 });
  const quante = await voci(srd, "runebog-regole-");
  controlla(quante >= 61, `${quante} voci nel deposito delle regole`);
  controlla(
    /Le \d+ pagine/.test(await srd.locator(".srd-offline").innerText()),
    "e il conteggio è quello vero: " + (await srd.locator(".srd-offline").innerText()).replace(/\s+/g, " ").slice(0, 60),
  );

  console.log("\n5. Le regole senza rete");
  await contesto.setOffline(true);
  for (const rotta of ["/srd/glossario-delle-regole", "/srd/mostri/draghi-da-gs-16", "/srd/classi/mago"]) {
    const r = await srd.goto(BASE + rotta, { waitUntil: "domcontentloaded" });
    const car = await srd.evaluate(() => document.body.innerText.length);
    controlla(r?.status() === 200 && car > 5000, `${rotta} — ${car} caratteri`);
  }
  /* Il controspecchio: la copia è quella dichiarata e non di più. Senza questo,
     un service worker che ripiegasse su qualcosa farebbe passare i controlli
     sopra senza aver davvero salvato niente di preciso. */
  const fuori = await srd.goto(BASE + "/dungeon", { waitUntil: "domcontentloaded" }).catch(() => null);
  controlla(!fuori || fuori.status() !== 200, "/dungeon resta irraggiungibile offline: nessun falso positivo");
  await contesto.setOffline(false);

  console.log("\n6. Un deploy nuovo mentre le regole sono già scaricate");
  await srd.goto(BASE + "/srd", { waitUntil: "networkidle" });
  await srd.evaluate(async () => {
    for (const n of await caches.keys()) if (n.startsWith("runebog-regole-")) await caches.delete(n);
    const c = await caches.open("runebog-regole-superato");
    await c.add("/srd/talenti");
  });
  await comeUnDeploy(srd);
  const buttato = await attendi(srd, (d) => !d.includes("runebog-regole-superato"));
  controlla(buttato, "il deposito superato è stato buttato");
  controlla((await voci(srd, "runebog-regole-")) >= 61, "e quello nuovo è pieno: riprese, non solo cancellate");

  console.log("\n7. Lo stesso deploy con la rete che cade a metà");
  /* Il caso "aggiornamento offline" non esiste: senza rete il browser non
     scarica nemmeno lo script del worker nuovo, quindi la migrazione non parte
     e la copia vecchia è intoccata per costruzione. Il caso rischioso è questo,
     e la regola che deve reggere è doppia: la copia vecchia sopravvive E resta
     LEGGIBILE. La prima da sola proteggerebbe dei byte che nessuno legge. */
  await srd.evaluate(async () => {
    for (const n of await caches.keys()) if (n.startsWith("runebog-regole-")) await caches.delete(n);
    const c = await caches.open("runebog-regole-superato");
    await c.add("/srd/talenti");
  });
  await contesto.route("**/srd/**", (r) =>
    r.request().url().includes("/sw.js") ? r.continue() : r.abort(),
  );
  await comeUnDeploy(srd).catch(() => {});
  await srd.waitForTimeout(3000);
  controlla((await depositi(srd)).includes("runebog-regole-superato"), "la copia vecchia sopravvive");
  await contesto.unroute("**/srd/**");
  await contesto.setOffline(true);
  const superstite = await srd.goto(BASE + "/srd/talenti", { waitUntil: "domcontentloaded" }).catch(() => null);
  controlla(superstite?.status() === 200, "e si legge ancora: la guardia protegge il DM, non dei byte");
} catch (e) {
  console.log("  KO  eccezione:", e.message.split("\n")[0]);
  ko++;
} finally {
  console.log(`\n${ok} ok, ${ko} KO`);
  await browser.close();
  process.exitCode = ko ? 1 : 0;
}

/*
 * La fixture delle verifiche in Chromium: costruisce una campagna valida e la
 * SEMINA. Non contiene asserzioni, ed è la divisione che le dà senso — le
 * asserzioni sono usa-e-getta per definizione (ogni verifica guarda un'altra
 * cosa), mentre le righe che preparano il terreno si ripetono identiche e
 * costano più del resto messo insieme: chiavi di localStorage, forma del
 * documento, ponte del tavolo, browser da trovare.
 *
 * STA FUORI DA `npm test`, ed è una decisione e non un dettaglio: quello è
 * `node --test` puro, senza dipendenze e senza DOM, e gira in CI a ogni push.
 * Questo vuole `playwright-core`, un binario Chromium e un dev server in
 * ascolto. Lo script di test elenca le cartelle una per una, quindi
 * `test/browser/` non ci finisce dentro da sé: chi aggiunge una cartella a quel
 * glob deve saperlo.
 *
 * Uso tipico di una verifica (che si scrive nello scratchpad e si butta):
 *
 *   import { apriBrowser, attendiServer, documentoDiProva,
 *            semeStandalone, ID } from "./test/browser/campagna-di-prova.mjs";
 *   await attendiServer();                                  // npm run dev a parte
 *   const { browser, contesto } = await apriBrowser();
 *   await semeStandalone(contesto, {documento: documentoDiProva({battaglia:true})});
 *   const pagina = await contesto.newPage();
 *   await pagina.goto("http://localhost:3000/app.html");
 *   … asserzioni …
 *   await browser.close();
 *
 * Il dev server NON lo avvia questo modulo: `npm run dev` è un processo lungo
 * che va guardato mentre gira, e una verifica che se lo accende da sé lascia
 * una porta occupata ogni volta che fallisce a metà.
 */

import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const RADICE_REPO = new URL("../../", import.meta.url);
const repoUrl = relativo => new URL(relativo, RADICE_REPO).href;

/* Il contratto del documento e la proiezione del tavolo si importano dal
   sorgente vero (Node spoglia i tipi di share.ts), non si riscrivono qui: una
   fixture che si costruisce la sua idea di documento valido prova la resa di
   qualcosa che il server non produrrebbe mai. È la stessa scelta di
   test/critici/, per la stessa ragione. */
const { prepareCampaignDocument, campaignErrorMessage, CURRENT_CAMPAIGN_SCHEMA_VERSION } =
  await import(repoUrl("public/app/formato-campagna.js"));
const { projectForPlayers } = await import(repoUrl("src/lib/share.ts"));

export const BASE = "http://localhost:3000";

/* ==================== il documento ==================== */

/* Gli id sono DETERMINISTICI, al contrario di quelli dell'app (`uid()` è
   casuale): una verifica deve poter nominare la bolla che sta guardando
   (`[data-block="locanda"]`), e un id nuovo a ogni giro obbliga a ripescarlo
   dal DOM prima di poterlo usare. Restano dentro la forma che il contratto
   ammette (lettere, numeri, `_`, `-`). */
export const ID = Object.freeze({
  radice: "radice",
  locanda: "locanda",
  sala: "sala",
  incontro: "incontro",
  pg: i => `pg${i}`,
  nemico: i => `nemico${i}`,
  pedina: i => `pedina-pg${i}`,
  vocePg: i => `ini-pg${i}`,
  voceNemico: i => `ini-nemico${i}`,
  muro: i => `muro${i}`,
});

const CELLA = 40;   // CELL di modello.js: qui serve solo a posare le cose su quadretti interi

const nodo = (id, title, type = "zona", extra = {}) => ({
  id, title, type, status: "", notes: "", img: null,
  children: [], edges: [], x: null, y: null, shape: null, ...extra,
});

/**
 * Il documento minimo che serve quasi sempre: una radice `zona` condivisa, una
 * bolla `luogo` a forma di edificio con dentro una stanza, e — a richiesta —
 * l'encounter, la battaglia, le pedine e qualche muro.
 *
 * Le note DM (`notes`) e quelle per i giocatori (`playerNotes`) ci sono
 * ENTRAMBE e dicono di esserlo: è la coppia su cui si verifica il filtro del
 * tavolo, e riempirne una sola rende la verifica cieca proprio dove conta.
 *
 * @param {object} [opts]
 * @param {string} [opts.nome]        titolo della radice (è il nome della campagna)
 * @param {number} [opts.giocatori]   quanti PG in `players`
 * @param {number} [opts.nemici]      quanti nemici nell'encounter; 0 = niente encounter
 * @param {boolean} [opts.battaglia]  `root.battle` con l'ordine già costruito
 * @param {boolean} [opts.pedine]     una pedina per PG sul livello della radice
 * @param {boolean} [opts.condiviso]  `shared:true` su radice e locanda (serve al tavolo)
 * @param {number} [opts.muri]        muri liberi sul livello della radice; il primo è una porta
 */
export function documentoDiProva({
  nome = "Campagna di prova",
  giocatori = 2,
  nemici = 2,
  battaglia = false,
  pedine = false,
  condiviso = true,
  muri = 0,
} = {}) {
  const radice = nodo(ID.radice, nome, "zona", {
    notes: "NOTA DM RADICE: non deve mai comparire al tavolo.",
    playerNotes: "Nota per i giocatori sulla radice.",
    shared: condiviso,
  });

  /* Una forma in scala (`grid:true`): posizione E dimensioni in quadretti
     interi, sennò la si vede saltare al primo tocco — snapNode la aggancia
     appena qualcuno la trascina, e una verifica sulle coordinate misurerebbe
     la riparazione invece del caso. */
  const locanda = nodo(ID.locanda, "Locanda della Biscia", "luogo", {
    shape: "edificio", x: 2 * CELLA, y: 3 * CELLA, w: 4 * CELLA, h: 2 * CELLA,
    notes: "NOTA DM LOCANDA: il traghettatore è sotto il pontile.",
    playerNotes: "Birra torbida e letti asciutti.",
    shared: condiviso,
    children: [nodo(ID.sala, "Sala comune", "luogo", {
      shape: "stanza", x: CELLA, y: CELLA, w: 2 * CELLA, h: 2 * CELLA,
    })],
  });
  radice.children.push(locanda);

  const players = [];
  for (let i = 1; i <= giocatori; i++)
    players.push({id: ID.pg(i), name: `PG ${i}`, cls: "Ladro", hp: 18, hpMax: 24, notes: ""});

  if (nemici > 0) {
    const incontro = nodo(ID.incontro, "Ratti della palude", "encounter", {
      x: 8 * CELLA, y: 3 * CELLA,
      notes: "NOTA DM INCONTRO: i ratti fuggono sotto metà PF.",
      monster: {
        meta: "Bestia Piccola, senza allineamento", ac: "12", speed: "9 m",
        str: 7, dex: 15, con: 11, int: 2, wis: 10, cha: 4, cr: "1/8",
        actions: "Morso: +4 al tiro per colpire, 4 (1d4+2) danni perforanti.",
        hpDefault: 7,
        foes: Array.from({length: nemici}, (_, k) => ({
          id: ID.nemico(k + 1), name: `Ratto ${k + 1}`, hp: 7, hpMax: 7,
        })),
      },
    });
    radice.children.push(incontro);
  }

  if (pedine) {
    /* Una pedina REFERENZIA la sua fonte e non ne copia nome e PF (vedi
       battaglia.js): `playerId` per un PG, `foe:{nodeId, foeId}` per un
       nemico. Copiarli qui darebbe una fixture che si disegna bene e non
       prova niente — il numero letto alla fonte è tutta la regola. */
    for (let i = 1; i <= giocatori; i++)
      radice.children.push(nodo(ID.pedina(i), "", "token", {
        playerId: ID.pg(i), x: (i - 1) * CELLA, y: 0, color: "#8fd4a8",
      }));
  }

  if (battaglia) {
    /* `n.battle` sta sul nodo del livello dove si combatte: la sua presenza È
       la modalità accesa. Qui è la radice, che è anche il livello dove sta
       l'encounter — l'ordine può referenziare solo nemici di questo livello. */
    const ordine = [];
    for (let i = 1; i <= giocatori; i++)
      ordine.push({id: ID.vocePg(i), kind: "pg", playerId: ID.pg(i), init: 20 - i});
    for (let i = 1; i <= nemici; i++)
      ordine.push({id: ID.voceNemico(i), kind: "foe", nodeId: ID.incontro, foeId: ID.nemico(i),
                   init: 10 - i, des: 2});
    radice.battle = {round: 1, turn: 0, order: ordine};
  }

  if (muri > 0) {
    /* Gli estremi di un muro stanno sugli INCROCI della maglia, non al centro
       della cella come i segnalini. Il primo si dichiara porta: una porta è un
       muro dichiarato porta, larga un quadretto, non un buco fra due muri. */
    radice.wallSegs = Array.from({length: muri}, (_, k) => ({
      id: ID.muro(k + 1), x: (2 + k) * CELLA, y: 8 * CELLA, dir: "h", len: 1,
      ...(k === 0 ? {porta: "chiusa"} : {}),
    }));
  }

  const documento = {schemaVersion: CURRENT_CAMPAIGN_SCHEMA_VERSION, root: radice, checklist: [], players};
  return validaDocumento(documento);
}

/**
 * Passa il documento dal contratto vero e lo restituisce, oppure lancia.
 * Serve perché una fixture invecchia in silenzio: il giorno che il contratto
 * stringe un campo, una verifica seminata con un documento non più valido
 * continua a disegnare qualcosa di plausibile in locale mentre il server lo
 * rifiuterebbe con 422. Meglio fallire qui, dove il messaggio dice quale campo.
 * Il documento nasce già alla versione corrente, quindi la migrazione — che
 * `prepareCampaignDocument` farebbe IN LOCO — non ha niente da fare.
 */
export function validaDocumento(documento) {
  const esito = prepareCampaignDocument(documento);
  if (!esito.ok)
    // campaignErrorMessage porta già dentro il percorso del campo: è il
    // messaggio che il DM vede accanto a "copia locale conservata".
    throw new Error(`documento di prova non valido: ${campaignErrorMessage(esito.error)}`);
  return documento;
}

/* ==================== il seme ==================== */

/* addInitScript gira prima degli script della pagina a OGNI navigazione: è
   l'unico momento in cui localStorage è già raggiungibile e l'app non ha
   ancora deciso che campagna aprire. Va bene su una pagina o su un contesto —
   sul contesto vale per tutte le schede che ci nascono, ed è quello che serve
   quando la verifica apre vista DM e tavolo affiancati. */

/**
 * Semina lo standalone (vista DM su localStorage): l'indice, la campagna
 * corrente e il documento. Tre chiavi, e vanno scritte tutte e tre — l'app
 * scrive `gm-current-campaign` solo al primo cambio di campagna, quindi un
 * profilo vergine ha l'indice ma non la corrente, ed è la trappola in cui si
 * cade leggendo l'id da lì.
 */
export function semeStandalone(dove, {documento = documentoDiProva(), tema = null, id = "prova"} = {}) {
  const voce = {id, name: documento.root.title || "Campagna", updatedAt: Date.now()};
  return dove.addInitScript(([voce, documento, tema]) => {
    localStorage.setItem("gm-campaigns-v1", JSON.stringify([voce]));
    localStorage.setItem("gm-current-campaign", voce.id);
    localStorage.setItem("gm-campaign-" + voce.id, JSON.stringify(documento));
    if (tema) localStorage.setItem("runebog-theme", tema);
  }, [voce, documento, tema]);
}

/**
 * Semina il tavolo (sola lettura): il ponte `window.__table` che la route
 * `/tavolo/[token]` inietta in `app.html`.
 *
 * Lo stato lo produce la proiezione VERA (`projectForPlayers`), non una copia
 * scritta a mano: al tavolo la metà interessante è proprio ciò che il server
 * toglie, e uno stato inventato verificherebbe la resa di un documento che non
 * esiste. Chi vuole provare la resa di un caso limite passa `stato` a mano e
 * lo dichiara.
 */
export function semeTavolo(dove, {documento = documentoDiProva(), token = "token-di-prova",
                                  nome = null, stato = null} = {}) {
  const ponte = {
    token,
    name: nome ?? documento.root.title ?? "Campagna",
    state: stato ?? projectForPlayers(documento),
  };
  if (!ponte.state)
    throw new Error("la proiezione è nulla: al tavolo non arriverebbe niente (radice senza `shared`?)");
  return dove.addInitScript(ponte => { window.__table = ponte; }, ponte);
}

/**
 * Risponde al polling del tavolo senza database: `GET /api/tavolo/:token`
 * proiettato al volo, con l'ETag che è `revision` — non un hash del corpo,
 * come nella rotta vera. Torna una manopola per far avanzare il DM.
 *
 * Serve perché una pagina seminata con `semeTavolo` da sola scrive "Offline"
 * dopo cinque secondi: il ponte c'è, il server dietro no.
 *
 * L'ETag si scrive nel formato della rotta (`"r5"`, virgolette comprese) e non
 * come numero nudo: al client non cambia niente — rimanda indietro quello che
 * ha ricevuto, qualunque cosa sia — ma una fixture che dice "come nella rotta
 * vera" e ne emette un'altra è la deriva silenziosa che questo file esiste per
 * non avere. Verificato contro il database vero il 31 lug 2026.
 */
export async function serviTavolo(dove, {documento = documentoDiProva(), revisione = 1} = {}) {
  let stato = projectForPlayers(documento);
  let rev = revisione;
  /* Quanti giri hanno scaricato il documento e quanti si sono chiusi con un
     304: è la domanda a cui il polling condizionale deve rispondere, e dal DOM
     non si vede — un tavolo aggiornato e un tavolo che riscarica dodici volte
     al minuto si disegnano uguali. */
  const giri = {scaricati: 0, invariati: 0};
  const etag = () => `"r${rev}"`;
  await dove.route("**/api/tavolo/*", route => {
    const inviato = route.request().headers()["if-none-match"];
    if (inviato === etag()) {
      giri.invariati++;
      return route.fulfill({status: 304, headers: {ETag: etag()}});
    }
    giri.scaricati++;
    route.fulfill({
      status: 200,
      headers: {ETag: etag(), "Content-Type": "application/json", "Cache-Control": "private, no-store"},
      body: JSON.stringify({state: stato}),
    });
  });
  return {
    /** Il DM ha salvato: nuova proiezione e revisione avanti di uno. */
    scrivi(nuovoDocumento) { stato = projectForPlayers(validaDocumento(nuovoDocumento)); rev++; },
    /** Una revisione che avanza su un documento identico: è il caso che la
        rotta ammette apposta (il DM ha scritto una nota sua), e il client deve
        accorgersene e NON ridisegnare. */
    tocca() { rev++; },
    get revisione() { return rev; },
    /** `{scaricati, invariati}`: i giri chiusi con un 200 e quelli con un 304. */
    get giri() { return {...giri}; },
  };
}

/**
 * Forza un giro di polling invece di aspettare i 5 secondi: `initTavolo`
 * registra già un listener su `visibilitychange`, e quello è il modo di
 * bussare senza toccare il codice dell'app. La `fetch` parte subito ma
 * risponde dopo, quindi la verifica attende il ridisegno con una `waitFor`
 * sua — questo helper garantisce solo che il giro sia partito.
 */
export async function giroDiPolling(pagina) {
  await pagina.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await pagina.waitForTimeout(150);
}

/* ==================== il browser ==================== */

/**
 * Il Chromium della cache di Playwright, non Chrome di sistema — che su questa
 * macchina non c'è (è il motivo per cui il browser MCP non parte). Il numero di
 * build NON si scrive a mano: si prende il più recente, sennò la fixture smette
 * di funzionare al primo aggiornamento di Playwright con un errore che parla di
 * un file mancante e non del perché.
 */
export function chromiumDellaCache() {
  const base = path.join(os.homedir(), ".cache", "ms-playwright");
  const build = elenca(base)
    .filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]));
  for (const dir of build) {
    for (const dentro of ["chrome-linux64/chrome", "chrome-linux/chrome", "chrome-mac/Chromium.app/Contents/MacOS/Chromium"]) {
      const eseguibile = path.join(base, dir, dentro);
      if (existsSync(eseguibile)) return eseguibile;
    }
  }
  throw new Error(`nessun Chromium in ${base}: installalo con "npx playwright install chromium"`);
}

/** `playwright-core` non è una dipendenza del progetto (in CI non serve, e
 *  trascinare un browser nel lockfile per una verifica manuale è caro): si
 *  cerca prima fra i moduli, poi nella cache di npx, che è dove sta qui. */
async function caricaPlaywright() {
  try { return await import("playwright-core"); } catch (_) {}
  const npx = path.join(os.homedir(), ".npm", "_npx");
  for (const dir of elenca(npx)) {
    const modulo = path.join(npx, dir, "node_modules", "playwright-core", "index.mjs");
    if (existsSync(modulo)) return await import(pathToFileURL(modulo).href);
  }
  throw new Error('playwright-core non trovato: "npx playwright-core@latest --version" lo mette nella cache di npx');
}

/**
 * Apre il browser e un contesto già dimensionato. Il contesto si restituisce
 * perché è lì che vanno gli init script: seminare su di lui vale anche per le
 * schede aperte dopo, che è il caso quando si confrontano vista DM e tavolo.
 */
export async function apriBrowser({headless = true, viewport = {width: 1280, height: 900}, ...resto} = {}) {
  const { chromium } = await caricaPlaywright();
  const browser = await chromium.launch({headless, executablePath: chromiumDellaCache(), ...resto});
  const contesto = await browser.newContext({viewport});
  return {browser, contesto};
}

/**
 * Aspetta che `npm run dev` risponda. La prima compilazione di Next è lenta e
 * la verifica che parte troppo presto fallisce con un errore di rete che
 * sembra un guasto dell'app.
 */
export async function attendiServer(url = BASE, {tentativi = 60, attesa = 1000} = {}) {
  for (let i = 0; i < tentativi; i++) {
    try {
      const res = await fetch(url, {method: "HEAD"});
      if (res.status < 500) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, attesa));
  }
  throw new Error(`${url} non risponde: il dev server è acceso? ("npm run dev")`);
}

function elenca(dir) {
  try { return readdirSync(dir); } catch (_) { return []; }
}

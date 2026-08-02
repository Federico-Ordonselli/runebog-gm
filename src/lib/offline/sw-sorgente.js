/* Il corpo del service worker — e NON è servito da qui.
 *
 * `src/app/sw.js/route.ts` lo legge a build time, gli antepone un `MANIFESTO`
 * (la lista dei file e le due versioni) e pubblica il risultato su `/sw.js`.
 * Il motivo è tutto nel manifesto: in `public/` non c'è build hashing, quindi
 * `mappa.js` si chiama sempre `mappa.js`, e una lista scritta a mano resterebbe
 * indietro **in silenzio** — l'utente inchiodato all'editor di tre deploy fa,
 * senza un modo di accorgersene. La lista si legge dal disco e la versione è un
 * hash del contenuto: cambia esattamente quando cambia un file.
 *
 * Due depositi separati, perché cambiano a ritmi diversi e costano diverso:
 *   - APP     l'editor, ~225 KB, precaricato all'installazione. È gratis: chi
 *             apre /app.html quei file li ha appena scaricati tutti, qui si
 *             chiede solo al browser di non buttarli.
 *   - REGOLE  le 61 pagine dell'SRD, ~1,5 MB, solo su richiesta esplicita.
 *             Toccare `mappa.js` non deve far riscaricare il glossario. Lì
 *             dentro finiscono anche i chunk di Next che servono alla ricerca
 *             (vedi `chunkDiNext` e `iChunkDellaRicerca`): sono la stessa
 *             spesa, accettata dallo stesso bottone.
 *
 * Fuori dalla cache, sempre: /play, /tavolo, /api. Vedi `fuoriDallaCache`.
 */

const PREFISSO_APP = "runebog-app-";
const PREFISSO_REGOLE = "runebog-regole-";
const CACHE_APP = PREFISSO_APP + MANIFESTO.versioneApp;
const CACHE_REGOLE = PREFISSO_REGOLE + MANIFESTO.versioneRegole;

/* La pagina che si mostra quando una navigazione non arriva da nessuna parte.
   Sta in public/, quindi è già nell'elenco dell'editor e si precarica con lui:
   non c'è una terza lista da tenere allineata. */
const RIPIEGO = "/offline.html";

/* Il verso in cui si sbaglia è dichiarato: offline che non funziona è un
   fastidio, offline che funziona con dati vecchi è una perdita silenziosa.
   Queste tre famiglie di indirizzi portano stato, non contenuto:

   - /play/[id] e /tavolo/[token] sono lo STESSO app.html con lo stato iniettato
     dentro l'HTML (window.__cloud / window.__table). Una copia in cache è lo
     snapshot di una revisione vecchia servito come se fosse fresco — e il
     tavolo è per contratto `private, no-store`, un link segreto che non deve
     fermarsi da nessuna parte, service worker compreso.
   - /api/* ha già il suo ETag su `revision` (il polling condizionale del
     tavolo): un secondo strato di cache è il modo di far mentire quel
     meccanismo.

   Qui non si risponde e non si ripiega: si lascia proprio fare al browser. */
const fuoriDallaCache = (p) =>
  p.startsWith("/play/") || p.startsWith("/tavolo/") || p.startsWith("/api/");

const inElenco = (elenco, p) => elenco.indexOf(p) !== -1;

/* --- installazione: solo l'editor -------------------------------------- */

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_APP);
      /* `addAll` è atomico: se un file manca all'appello l'installazione
         fallisce invece di lasciare una copia offline incompleta che sembra
         completa. Per la stessa ragione /icon.svg non è in elenco — lo genera
         Next da src/app/icon.svg, non sta su disco in public/, e un favicon
         mancante non vale il rischio di far cadere tutto. */
      await cache.addAll(MANIFESTO.app);
      /* Senza skipWaiting una versione nuova resta in attesa finché non si
         chiudono TUTTE le schede: su uno strumento che si tiene aperto per
         un'intera sessione di gioco vuol dire mai. */
      await self.skipWaiting();
    })(),
  );
});

/* --- attivazione: si butta il vecchio, ma le regole solo dopo averle riprese */

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    (async () => {
      const nomi = await caches.keys();

      await Promise.all(
        nomi
          .filter((n) => n.startsWith(PREFISSO_APP) && n !== CACHE_APP)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();

      /* Le regole no: cancellare prima e riscaricare poi vuol dire che un
         aggiornamento preso mentre la rete non c'è lascia il DM senza regole,
         cioè esattamente nella situazione per cui le aveva scaricate. La copia
         vecchia si butta solo quando la nuova è arrivata davvero. */
      const superate = nomi.filter(
        (n) => n.startsWith(PREFISSO_REGOLE) && n !== CACHE_REGOLE,
      );
      if (!superate.length) return;
      try {
        await scaricaLeRegole();
      } catch (e) {
        return; // niente rete: si tiene la copia vecchia, che è meglio di zero
      }
      await Promise.all(superate.map((n) => caches.delete(n)));
    })(),
  );
});

/* --- le strategie ------------------------------------------------------- */

/* L'editor: si serve dalla cache e si riconvalida dietro. I nomi dei file sono
   stabili, quindi senza la riconvalida una modifica presa fra due deploy non
   arriverebbe mai. `waitUntil` tiene vivo il worker finché la richiesta di
   sfondo non è finita, sennò il browser può ucciderlo prima del `put`. */
function riconvalidando(ev, nome) {
  return (async () => {
    const cache = await caches.open(nome);
    const salvata = await cache.match(ev.request, { ignoreVary: true });
    const rete = fetch(ev.request)
      .then((res) => {
        if (res && res.ok) cache.put(ev.request, res.clone());
        return res;
      })
      .catch(() => null);
    ev.waitUntil(rete);
    return salvata || (await rete) || Response.error();
  })();
}

/* Le regole: prima la cache e basta. Il deposito è versionato sul contenuto dei
   JSON da cui quelle pagine nascono, quindi una copia che c'è è per costruzione
   la copia giusta — riconvalidarla sarebbe 1,4 MB di rete per non cambiare
   niente.
 *
 * `caches.match` senza nome cerca in TUTTI i depositi, e qui è il punto: se
 * l'attivazione non ha potuto riprendere le regole (nessuna rete) la copia
 * superata è l'unica che c'è. Leggendo solo dal deposito corrente, la regola
 * "non si butta finché la nuova non è arrivata" avrebbe protetto dei byte che
 * nessuno legge — cioè niente. Il rovescio è dichiarato: senza rete si leggono
 * regole di una versione precedente, che per un testo fermo come l'SRD è
 * incomparabilmente meglio di un errore, e dura finché la rete non torna. */
function primaLaCache(ev, conRipiego) {
  return (async () => {
    const salvata = await caches.match(ev.request, { ignoreVary: true });
    if (salvata) return salvata;
    try {
      return await fetch(ev.request);
    } catch (e) {
      return (conRipiego && (await paginaDiRipiego())) || Response.error();
    }
  })();
}

/* I chunk di Next: cache-first, e la cache è quella delle REGOLE.
 *
 * Le pagine dell'SRD sono prosa resa dal server e si leggono senza idratazione
 * — ma la ricerca su /srd è un componente client, quindi senza i suoi chunk il
 * campo c'è e non trova niente. Fino al 2 ago 2026 reggeva per FORTUNA: i chunk
 * stavano nella cache HTTP del browser, che li sfratta quando vuole. Misurato
 * svuotando la sola cache HTTP: la pagina si legge, la ricerca dà 0 risultati.
 * Un difetto che passa ogni prova, perché la prova arriva sempre a cache calda.
 *
 * Non si può precaricare dal manifesto: la rotta /sw.js gira DURANTE il build e
 * i chunk delle altre pagine non esistono ancora. A runtime non c'è però
 * disallineamento possibile — quei nomi sono hash del contenuto, quindi la
 * copia in cache di un chunk è per costruzione la copia giusta, e l'HTML salvato
 * cita esattamente i chunk che si sono presi.
 *
 * Si SCRIVE solo se il deposito delle regole esiste già: chi non ha accettato
 * il costo delle regole non paga byte per una ricerca che non ha chiesto. Si
 * LEGGE invece da tutti i depositi, per la stessa ragione di `primaLaCache`. */
function chunkDiNext(ev) {
  return (async () => {
    const salvato = await caches.match(ev.request, { ignoreVary: true });
    if (salvato) return salvato;
    let res;
    try {
      res = await fetch(ev.request);
    } catch (e) {
      return Response.error();
    }
    if (res && res.ok && (await caches.has(CACHE_REGOLE))) {
      const cache = await caches.open(CACHE_REGOLE);
      ev.waitUntil(cache.put(ev.request, res.clone()));
    }
    return res;
  })();
}

const paginaDiRipiego = () => caches.match(RIPIEGO, { ignoreVary: true });

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;

  let url;
  try {
    url = new URL(req.url);
  } catch (e) {
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (fuoriDallaCache(url.pathname)) return;

  if (inElenco(MANIFESTO.app, url.pathname)) {
    ev.respondWith(riconvalidando(ev, CACHE_APP));
    return;
  }

  if (url.pathname === MANIFESTO.indiceRicerca) {
    ev.respondWith(primaLaCache(ev));
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    ev.respondWith(chunkDiNext(ev));
    return;
  }

  /* Solo le NAVIGAZIONI, e il vincolo non è cosmetico: le pagine dell'SRD sono
     Next, quindi lo stesso indirizzo viene chiesto anche come payload RSC (il
     prefetch di un link, con `?_rsc=` e un altro corpo). Servire un RSC dove il
     browser aspetta un documento è una pagina bianca. `mode === "navigate"` li
     esclude tutti senza dover riconoscere una query. */
  if (req.mode !== "navigate") return;

  if (inElenco(MANIFESTO.regole, url.pathname)) {
    ev.respondWith(primaLaCache(ev, true));
    return;
  }

  /* Ogni altra navigazione: la rete, e se la rete non c'è la pagina di ripiego.
     Non si mette in cache NIENTE di quel che passa di qui — la home, l'elenco
     campagne e /dungeon sono pagine che vogliono database, sessione o chunk
     hashati, e una loro copia servita come fresca è la perdita silenziosa che
     questa cache esiste per evitare. Qui si aggiunge solo una risposta a chi
     offline non ne aveva nessuna.

     /play, /tavolo e /api non ci arrivano: sono usciti sopra, e continuano a
     non ricevere nemmeno un ripiego. Lì la regola resta "si lascia proprio fare
     al browser", che è una riga sola da tenere a mente invece di due. */
  ev.respondWith(ripiegando(ev));
});

function ripiegando(ev) {
  return (async () => {
    try {
      /* Si passa `ev.request` così com'è, e non un URL o una Request nuova: una
         navigazione ha `redirect:"manual"`, quindi la risposta a un 3xx è
         opaqueredirect e il browser segue lui il salto. Ricostruendo la
         richiesta si perde quel modo, e rispondere a una navigazione con una
         risposta già seguita è un errore di rete — cioè la home di ogni utente
         loggato, che qui fa redirect verso l'ultima campagna. Verificato il
         2 ago 2026 su /srd/ e /srd/classi/ (le due 308 di Next). */
      return await fetch(ev.request);
    } catch (e) {
      /* Solo se la rete CADE: un 404 o un 500 sono risposte del sito, e
         coprirle con "sei senza rete" sarebbe una diagnosi sbagliata. */
      return (await paginaDiRipiego()) || Response.error();
    }
  })();
}

/* --- il livello a richiesta: le regole ---------------------------------- */

async function scaricaLeRegole() {
  const cache = await caches.open(CACHE_REGOLE);
  /* Atomico come il precache dell'editor, e per lo stesso motivo: mezze regole
     offline sono peggio di nessuna, perché non si vede quale metà manca. */
  await cache.addAll(MANIFESTO.regole.concat([MANIFESTO.indiceRicerca]));
  await iChunkDellaRicerca(cache);
}

/* I chunk che servono alla RICERCA, presi qui e non lasciati al caso.
 *
 * La regola a runtime (`chunkDiNext`) da sola non basta, ed è un problema di
 * ordine: quei file il browser li ha scaricati aprendo /srd, cioè PRIMA che
 * esistesse il deposito in cui scriverli — e non li richiede più. Il DM che
 * preme il bottone e stacca la rete si troverebbe le regole intere e la ricerca
 * muta, che è esattamente il difetto che si sta chiudendo.
 *
 * I nomi si leggono dall'HTML appena salvato invece di essere dichiarati nel
 * manifesto: la rotta /sw.js gira durante il build e i chunk delle altre pagine
 * non esistono ancora. Leggerli dalla pagina è anche l'unico modo che non può
 * disallinearsi — sono i chunk che quella copia cita, non quelli che citava il
 * build.
 *
 * Solo /srd: la ricerca sta lì. Le 60 pagine di regole sono prosa resa dal
 * server e si leggono senza idratazione, quindi i loro chunk non valgono i byte.
 * E best-effort a differenza delle pagine, che sono atomiche: un chunk che
 * manca costa la ricerca, non le regole. */
async function iChunkDellaRicerca(cache) {
  const res = await cache.match("/srd", { ignoreVary: true });
  if (!res) return;
  const html = await res.text();
  /* La classe esclude la barra rovescia perché nel payload RSC gli indirizzi
     compaiono fra virgolette scappate: senza, il nome del file si porterebbe
     dietro mezzo documento. */
  const nomi = [...new Set(html.match(/\/_next\/static\/[^"'\\\s)]+/g) || [])];
  await Promise.all(nomi.map((n) => cache.add(n).catch(() => {})));
}

/* `pagine` esce SEMPRE, anche quando il deposito non c'è: è una proprietà del
   manifesto, non della cache. Legandolo all'esistenza del deposito la pagina lo
   imparava solo insieme a un deposito che ancora non aveva, cioè mai prima di
   doverlo scrivere — e annunciava "Le 0 pagine delle regole sono sul
   dispositivo". Un difetto che si vede una volta sola, la prima. */
async function statoDelleRegole() {
  const pagine = MANIFESTO.regole.length;
  const nomi = await caches.keys();
  if (nomi.indexOf(CACHE_REGOLE) === -1) return { presenti: false, pagine };
  const chiavi = await (await caches.open(CACHE_REGOLE)).keys();
  /* La soglia può essere esatta perché `addAll` è atomico: o ci sono tutte le
     pagine o il deposito non è mai stato scritto. Un ">= metà" qui coprirebbe
     un caso che non esiste, e coprirebbe anche il caso rotto. Il `>=` invece
     serve, perché nello stesso deposito stanno anche i chunk della ricerca. */
  return { presenti: chiavi.length >= pagine, pagine };
}

/* Il dialogo con la pagina è di tre parole. `ev.source` è il client che ha
   scritto, quindi la risposta torna a lui e la pagina non ha bisogno di sapere
   come si chiamano i depositi — che è anche ciò che permette di cambiarne lo
   schema di nomi senza toccare la UI. */
self.addEventListener("message", (ev) => {
  const tipo = (ev.data || {}).tipo;
  const rispondi = (m) => ev.source && ev.source.postMessage(m);

  if (tipo === "stato") {
    ev.waitUntil(
      statoDelleRegole().then((s) => rispondi({ tipo: "stato", ...s })),
    );
  } else if (tipo === "scarica-regole") {
    ev.waitUntil(
      scaricaLeRegole().then(
        () => rispondi({ tipo: "regole-fatto", pagine: MANIFESTO.regole.length }),
        () => rispondi({ tipo: "regole-errore" }),
      ),
    );
  } else if (tipo === "dimentica-regole") {
    /* Una copia da 1,3 MB che non si può togliere è una copia che non si può
       accettare a cuor leggero. */
    ev.waitUntil(
      caches.delete(CACHE_REGOLE).then(() => rispondi({ tipo: "regole-tolte" })),
    );
  }
});

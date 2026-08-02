# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Mantieni aggiornato questo file**: quando cambiano comandi, architettura, convenzioni o
invarianti di sicurezza, aggiorna la sezione corrispondente nello stesso commit.

## Lingua e convenzioni

Tutto in **italiano**: commenti, commit, README, UI. Commit in stile conventional commit
con scope italiano (`feat(tavolo):`, `fix(sicurezza):`, `ci:`), corpo che spiega il perché.
I commenti nel codice dichiarano vincoli e decisioni, non parafrasano la riga sotto —
vedi le intestazioni di `src/lib/share.ts` o `src/lib/inline-json.ts` come modello.

`TODO.md` è il registro dei lavori: le voci completate restano spuntate con data e
riferimenti ai file. Quando finisci un lavoro significativo, aggiungilo lì.

## Comandi

```bash
npm run dev          # sviluppo su http://localhost:3000 (serve .env, vedi .env.example)
npx tsc --noEmit     # typecheck — è il controllo principale, non c'è ESLint
npm test             # test puri con node:test (test/{strumenti,sync,formato-campagna,dungeon,scala,critici})
npm run build        # build di produzione (fa anche typecheck)
npm run temi:contrasto   # rapporti WCAG di tutti i temi (esce 1 se una coppia è sotto soglia)
```

I test sono pochi e **puri** (`node --test`, nessuna dipendenza, nessun DOM): oggi
coprono il gestore degli strumenti mappa e la geometria del righello
(`test/strumenti/`), il formato della cache cloud e la classificazione dei
conflitti (`test/sync/`), il contratto del documento campagna
(`test/formato-campagna/`), le pareti che l'import del dungeon costruisce
(`test/dungeon/`), la scala della campagna e l'accordo fra le due liste di forme
(`test/scala/`), più gli **invarianti critici** (`test/critici/`):
`jsonForScript`, la proiezione del tavolo come whitelist (segreti marcati che non
devono comparire nel JSON, nemmeno da campi futuri), `sanitizeState`, determinismo
e coerenza del generatore di dungeon. Questi ultimi importano `share.ts`,
`inline-json.ts` e l'engine **direttamente come `.ts`**: Node li spoglia dei tipi,
quindi quei moduli devono restare a sintassi cancellabile (niente `enum`,
`namespace`, parameter properties) e con **import con estensione** — è il motivo
per cui `share.ts` importa `../../public/app/formato-campagna.js` e non il wrapper.
Il warning `MODULE_TYPELESS_PACKAGE_JSON` è atteso: non aggiungere
`"type":"module"` a `package.json` solo per zittirlo. Il resto dell'app si
verifica a mano nel browser. La CI
(`.github/workflows/ci.yml`) esegue typecheck + `npm test` + build su ogni push e
PR, con `DATABASE_URL` fittizio: il client Neon viene creato all'import di
`src/db/index.ts`, quindi il build richiede la variabile anche se nessuna pagina statica
interroga il database.

**La verifica a mano ha una fixture** (`test/browser/campagna-di-prova.mjs`, 29 lug
2026): costruisce una campagna valida e la semina, che è la parte che si ripeteva
identica a ogni giro — le asserzioni no, quelle restano usa-e-getta perché ogni
verifica guarda un'altra cosa. `documentoDiProva` (id **deterministici**, così
un'asserzione può nominare la bolla che guarda) passa dal contratto vero e
`semeTavolo` produce lo stato con `projectForPlayers` di `share.ts`: una fixture
che si costruisce la sua idea di documento valido invecchia in silenzio e prova
la resa di qualcosa che il server non manderebbe mai. `serviTavolo` risponde al
polling senza database (ETag = `revision`, come la rotta) perché il ponte da
solo lascia il tavolo "Offline" dopo cinque secondi. Si prova da sé con
`node test/browser/verifica-fixture.mjs`, con `npm run dev` acceso.
Accanto c'è `verifica-offline.mjs` (2 ago 2026), che invece vuole `npm run start`
su un build di produzione — la ragione sta nella sezione "La copia offline".
`test/browser/` **sta fuori da `npm test`**, che elenca le cartelle una per una:
lì dentro girerebbero `playwright-core`, un binario Chromium e un dev server, e
in CI romperebbe il typecheck-test-build di ogni push. Chi allarga quel glob
deve saperlo.

**Schema DB**: migrazioni SQL versionate in `drizzle/` (baseline `0000_iniziale`,
lug 2026). Flusso: modifica `src/db/schema.ts` → `npm run db:generate` (committa il
file SQL generato) → `npm run db:migrate`. MAI `drizzle-kit push`: su questo schema
propone di togliere NOT NULL dalle chiavi primarie (errore 42P16) e di troncare la
tabella `user` — per questo lo script `db:push` è stato rimosso.

## Architettura: due mondi, un JSON

Il repo contiene **due applicazioni** che condividono un formato dati:

1. **Il sito** (Next.js 15 App Router, `src/`): login, lista campagne, API REST,
   pagine pubbliche. Auth.js v5 (Google OAuth + credenziali), Neon Postgres via Drizzle.
2. **L'app** (`public/app.html` + `public/app/`): l'editor di mappe vero e proprio.
   Vanilla JS in moduli ES, niente framework, niente build: `app.html` è solo markup,
   `app/app.css` gli stili, `app/srd-mostri.js` il bestiario SRD in italiano
   (script classico, `window.SRD_MONSTERS`; file GENERATO — si rigenera con
   `node scripts/estrai-srd-mostri.mjs <PDF>` dal PDF ufficiale IT_SRD_CC_v5.2.1,
   non si modifica a mano), `app/main.js` l'entry point dei moduli per dominio
   (`stato`, `mappa`, `pannello`, `mostri`, `tavolo`, …) più `app/dungeon-nomi.js`,
   che è dati e non dominio. Lo stato condiviso tra moduli vive nell'oggetto `st`
   esportato da `app/stato.js` (i binding ES importati non sono riassegnabili). Le funzioni usate dagli `onclick` inline nei template vengono esposte
   su `window` con l'`Object.assign` in fondo a ogni modulo. Le versioni
   standalone/desktop sono state ritirate: questa è l'unica copia del sorgente.

Il ponte è **un unico oggetto JSON serializzabile** (`{schemaVersion, root, checklist,
players}`) che contiene l'intero stato di una campagna: stessa forma per Esporta/Importa,
per la colonna JSONB `campaign.data`, e per l'iniezione nel browser. La forma iniziale è
definita una sola volta in `src/lib/campaigns.ts`.

**Il contratto del documento** (`public/app/formato-campagna.js`, riesportato al sito
da `src/lib/formato-campagna.ts`): un solo modulo, senza dipendenze, decide cosa è una
campagna valida — limiti, forme, `schemaVersion` e migrazioni nominate (v0 è il formato
storico senza il campo; i default di `migrateV0ToV1` sono **misurati** contro ciò che i
render facevano già, non inventati). Valida la FORMA e non sostituisce la bonifica:
`sanitizeState` nell'app e le proiezioni di `share.ts` restano. Regola:
**rigido in scrittura, tollerante in lettura.**

- Morde nei percorsi di **scrittura**: l'import (`esporta.js`), `POST /api/campaigns` e
  la PATCH — 422 col motivo in `detail.message` (413 per `document_too_large`), che il
  client mostra accanto a "copia locale conservata". Il rifiuto non perde mai lavoro:
  la cache locale è scritta prima della richiesta (vedi Revisione qui sotto). Nel JSONB
  entra `prepared.value`, cioè il documento già migrato; anche `newCampaignData` passa
  dalla validazione nel POST, così la fabbrica non può divergere dal contratto.
- NON morde nei percorsi di **lettura**: `migrateState` è l'imbuto di ogni caricamento
  (cloud, localStorage, undo, recupero) e non lancia — normalizza se può, lascia il
  difetto in `ultimoDifettoFormato` e prosegue con le difese esistenti. Le due route
  del tavolo tentano la normalizzazione e ripiegano sulla riga grezza: un 422 lì
  chiuderebbe fuori i giocatori per un difetto che solo il DM può correggere.
- `prepareCampaignDocument` **muta il documento in loco** quando migra: i chiamanti
  che tengono il riferimento (come `migrateState`) non hanno niente da riassegnare.
- `projectForPlayers` dichiara `schemaVersion` corrente **per costruzione**: la
  proiezione è ricostruita campo per campo da `share.ts`, e le sue whitelist
  (`safeId`, `safeUrl`, `safeColor`) sono già allineate alle regole del validatore —
  i tre elenchi si toccano insieme (vedi il commento su `FUORI_DALL_ATTRIBUTO`).
- Uno schema **futuro** si rifiuta senza tentare downgrade; i limiti generici della
  scansione (`genericValues`) sono una rete di sicurezza, non un limite di prodotto,
  e un test impone che non contraddicano mai i limiti dichiarati (`nodes`).

Flusso cloud: `/play/[id]` (route handler, non pagina React) legge la riga e serve
`app.html` iniettando `<script>window.__cloud = {id, state, revision, updatedAt}</script>`;
l'app rileva `window.__cloud` all'avvio e salva con `PATCH /api/campaigns/:id` (limite
4 MB, coalescing delle scritture, cache su localStorage se offline). Senza `__cloud`
l'app gira standalone su localStorage. **Ancora dell'iniezione**: le route inseriscono
il bridge prima della prima occorrenza letterale dell'apertura di tag script senza
attributi in `app.html` (quello del tema, in `<head>`) — quella stringa non deve
comparire prima, nemmeno dentro un commento HTML.

`/tavolo/[token]` è la variante in sola lettura per i giocatori (vedi Sicurezza).

**Il polling del tavolo è condizionale** (`GET /api/tavolo/[token]`, `pollTable` in
`tavolo.js`, 29 lug 2026): ogni 5 secondi, per ogni giocatore seduto. Finché la
risposta è stata sempre un 200 col documento dentro, quel ritmo si pagava **tre**
volte — la proiezione ricostruita da capo sul server, il documento intero sul filo
(una campagna vicina al tetto di 4 MB fa 44 MB al minuto per giocatore), e due
`JSON.stringify` sul telefono di chi gioca — e quasi sempre per niente, perché fra
una battuta e l'altra il DM non scrive.

- **L'ETag è `revision`, non un hash del corpo.** Il contatore è già il modo in cui
  questo repo dice "la copia da cui parti è ancora quella corrente", ed è
  incrementato **dentro** la query che scrive `data`; un hash vorrebbe proiettare
  tutto per poterlo calcolare, cioè risparmierebbe la rete e non il server. Le
  rotte di condivisione toccano solo `shareToken`: a un link rigenerato risponde
  il 404, che è la risposta giusta.
- **Il confronto di `If-None-Match` è debole** (`stessaRevisione` nella rotta):
  ignora il prefisso `W/` e accetta l'elenco separato da virgole, che è quanto
  chiede RFC 9110 §13.1.2 — chiunque stia in mezzo ha il permesso di indebolire
  un ETag forte, e un `===` sulla stringa intera leggerebbe `W/"r5"` come diverso
  da `"r5"`, cioè risponderebbe 200 per sempre. È l'unico guasto di questa rotta
  che **non si vede**: il tavolo continua a funzionare e riscarica tutto.
  Misurato il 31 lug 2026: l'edge di Vercel l'ETag lo lascia identico anche
  comprimendo in brotli, quindi il confronto debole non ripara niente — serve a
  non dipendere da quella misura.
- **Il verso in cui si sbaglia è dichiarato**: la revisione cambia anche quando il
  DM ha scritto qualcosa che al tavolo non arriva (una nota sua), e allora esce un
  200 con un documento identico — lo spreco resta, e a coprirlo è il confronto che
  il client fa già. Il contrario, una revisione ferma su un documento cambiato, non
  può capitare: sarebbe l'unico guasto che si vede come un tavolo che smette di
  aggiornarsi.
- Nel client il **304 va gestito prima di `!res.ok`**, che con `ok` falso lo
  leggerebbe come rete caduta e scriverebbe "Offline" a un tavolo che sta benissimo.
  L'`If-None-Match` lo mette il codice e non la cache HTTP, perché la risposta resta
  `private, no-store`: il link è segreto e non deve fermarsi da nessuna parte —
  motivo per cui non c'è nemmeno una copia intermedia che possa rispondere al posto
  del server.
- Il ponte iniettato porta `{token, name, state}` e **non** la revisione, quindi il
  primo giro scarica comunque: una volta per apertura, quando il browser sta già
  facendo tutto il resto.

**Revisione, cache offline e conflitti** (`campaign.revision`, `public/app/sync-cloud.js`,
il blocco cloud di `stato.js`): `revision` è un contatore monotono e ogni PATCH dichiara
la `baseRevision` da cui parte. **La condizione sta dentro l'UPDATE**, insieme a quella
di proprietà (`WHERE id AND user_id AND revision = base`): leggere prima e scrivere poi
lascia fra le due query una finestra in cui un'altra scheda scrive, e l'ultimo arrivato
sovrascrive in silenzio. Zero righe aggiornate **è** il 409; la lettura che distingue
"non è tua" da "sei indietro" avviene **dopo** il tentativo, quando non c'è più niente
da decidere. Una PATCH senza `baseRevision` è 400 e non revisione 0 — `Number(null)` è 0,
e 0 vuol dire "sovrascrivi qualunque cosa ci sia". Il 409 riporta la versione del server:
il client deve poterla mostrare accanto alla propria senza una seconda richiesta, cioè
senza ridipendere dalla rete che ha appena fallito.

- **Una cache per campagna** (`runebog-cloud-v1:<id>`), non la vecchia `runebog-gm-v1`
  che era una chiave sola per tutte: apriva la B e ci scriveva sopra la A. La copia
  porta `baseRevision` e `status`, e bastano a distinguere i tre casi che prima erano
  uno (`classifyCloudRecovery`): già arrivata (si marca), server fermo dov'era (recupero
  senza perdite), server avanzato (conflitto). La vecchia chiave **non si spedisce mai
  da sé** — non si sa a quale campagna appartenga: si propone dicendolo (`legacy`).
- **Si scrive in locale PRIMA di partire con la richiesta.** È l'ordine che rende
  recuperabile una scheda chiusa a metà PATCH: scrivendo dopo la risposta, il caso
  scoperto sarebbe proprio quello in cui la risposta non arriva.
- **Un 200 marca sincronizzato lo snapshot SPEDITO**, non lo stato corrente
  (`reconcileCloudAck`): fra la partenza e l'ACK l'utente ha continuato a scrivere, e
  quelle battute restano pendenti con la nuova base. È la parte che si rompe solo con
  la rete lenta, cioè mai durante una prova a mano — per questo è una funzione pura e
  testata invece di stare dentro la `fetch`.
- **Niente merge automatico.** Fondere due alberi campagna campo per campo è, visto
  dall'utente, indistinguibile da una perdita silenziosa. Il dialogo ha tre azioni e
  nessun Annulla, perché non esiste un default onesto; "Esporta entrambe" apposta **non**
  chiude — mette al sicuro le due versioni senza scegliere. Mentre aspetta, `cloudPaused`
  ferma il salvataggio: anche in `undo()`, che chiama `doSave()` per conto suo e
  riscriverebbe la copia che il dialogo sta proponendo di recuperare.
- `main.js` **non** salva all'avvio in cloud: creerebbe una revisione a ogni apertura,
  e ogni altra scheda si troverebbe in conflitto senza aver toccato niente.
- Il modulo non importa `stato.js`: stato, `store` e callback arrivano da fuori, ed è
  ciò che rende la classificazione provabile con `node:test` (`test/sync/`). Quel che
  resta in `stato.js` (fetch, debounce, dialogo) è tenuto sottile apposta e si prova a
  mano — la procedura è in `TODO.md`.

**Annulla, rifai, e l'import che non distrugge** (`undo`/`redo`/`applySnapshot` in
`stato.js`, `esporta.js`): lo stato è un JSON unico, quindi uno snapshot è una
`JSON.stringify` e tornarci è una `parse`. Il redo è lo **stesso meccanismo con gli
stack scambiati** e `applySnapshot` è il pezzo che i due condividono — percorso,
selezioni e muri che nello stato ripristinato possono non esistere più.

- **Storia lineare**: `noteChange` svuota `redoStack`. Una modifica nuova dopo un
  annulla stacca il ramo rifatto, e senza quella riga Ctrl+Y riporterebbe a un futuro
  che non discende più dal presente — cioè una perdita silenziosa, esattamente il
  guasto per cui l'undo esiste.
- `redo()` rimette lo stato corrente sull'**undoStack** e non si appoggia a `lastSnap`:
  `applySnapshot` chiama `doSave()`, che `lastSnap` lo riscrive, e senza quella riga il
  Ctrl+Z successivo non avrebbe più dove tornare.
- Il bottone ↷ compare **solo dopo un annulla** e la sua condizione è esatta
  (`redoStack` si riempie soltanto dentro `undo()`), mentre quella di ↶ è per forza un
  proxy: il check vero vorrebbe serializzare fino a 4 MB a ogni battitura.
- **L'import entra in una campagna nuova** (`importAsNewCampaign`) invece di sostituire
  quella aperta: in locale uno slot non costa niente, quindi alla domanda "vuoi
  sostituire?" si risponde di no per costruzione, e non la si fa. In cloud
  (`/play/[id]`) l'indirizzo È la campagna e slot non ce ne sono: lì l'import
  sovrascrive, e la conferma conta le bolle da una parte e dall'altra. La validazione
  del contratto viene **prima** della conferma — un file illeggibile non mette a
  rischio niente, e chiedere per poi fallire è uno spavento per nulla.

**Il pannello di un encounter è ordinato per il tavolo** (`statblockHTML` in
`mostri.js`, montato subito sotto il titolo da `pannello.js`): PF, azioni, dadi — le
tre cose che si toccano giocando — e sotto, in **una** sezione richiudibile,
l'anagrafica del mostro. Non è l'ordine di una scheda stampata, ed è voluto: il resto
del pannello (tipo, note, colore) è preparazione, e al tavolo non si scorre. Due
conseguenze da tenere:

- **Riempire una sezione chiusa è indistinguibile dal non far niente**: `applySRD` crea
  il primo nemico, e la regola d'apertura ("aperta se non ci sono nemici") chiuderebbe
  la scheda proprio a chi ha appena scelto il mostro. Da lì `secShow` in `pannello.js`
  — il `force` di `secOpen` risponde a una condizione dello stato e non sa distinguere
  "c'era già" da "è arrivato ora".
- L'attribuzione CC-BY sta **fuori** dalla sezione richiudibile: è una condizione della
  licenza, e una licenza dietro un `<summary>` chiuso non è resa.

**Modalità combattimento** (`public/app/battaglia.js`): `n.battle` sta sul nodo del
livello dove si combatte — la sua presenza è la modalità accesa, non c'è stato globale.
Le pedine **referenziano** la loro fonte (`playerId`, oppure `{nodeId, foeId}`) e non
ne copiano nome e PF: c'è un solo numero per creatura, letto alla fonte a ogni disegno.
La griglia è quella che c'era già — `CELL` (40px, 1 quadretto = 1,5 m) è definita una
sola volta in `modello.js`: `battaglia.js` la riesporta, il pattern `#grid` in `mappa.js`
e `DG_SCALE` in `dungeon.js` la importano.

- **Nel tabellone d'iniziativa ogni distinzione ha due canali** (29 lug 2026), che
  è la regola che `.ini-row.on` seguiva già da sola: il turno corrente si dice con
  fondo, grassetto **e** `▸`. Da che parte sta una riga lo diceva invece il solo
  colore della striscia, e `--fen`/`--ember` su Brace sono la coppia di famiglie
  più vicina dei dodici temi (ΔE 17,4, dichiarato in `themes.css`) — due righe
  identiche per chi non distingue quei rossi. Ora c'è anche un glifo (`.ini-tipo`:
  ◆ per i PG, ▲ per i nemici), e sono due **silhouette**: ◆ e ◇ sarebbero di nuovo
  un canale solo, il peso. Il glifo prende lo stesso token della striscia, perché
  è lo stesso segnale detto due volte e non un secondo codice da imparare.
  - **Il caso che conta è il tavolo**, non la vista DM: lì il 🎲 che marcava i PG
    non c'è (è un comando, e al tavolo non si comanda), quindi la striscia
    restava davvero sola. Regge perché `projectBattle` (`share.ts`) manda già
    `kind`, che è l'unica cosa di cui il glifo ha bisogno.
  - Il glifo è `aria-hidden` e la parola sta in un `.sr-only` che **apre** la
    riga: un lettore di schermo annuncerebbe "rombo nero", che non è
    l'informazione, e il lato va sentito prima del nome.
  - Costa 15px alla colonna del nome (98 → 83px nella vista DM, dove il 🎲
    occupa il fondo; al tavolo restano 122px). Da lì il `title` sul nome.
  - **Su schermo stretto e in piedi il tabellone cambia asse** (29 lug 2026):
    non è più una colonna da 216px che galleggia a sinistra ma una **fascia
    larga quanto la tela**. A 360px quella colonna era il 60% della larghezza e
    il 95% dell'altezza nella vista DM — un pannello che nasconde la mappa,
    proprio durante uno scontro — e col dito peggiorava invece di migliorare,
    perché `pointer:coarse` porta il 🎲 a 44px e il nome scende a 72. Nessuna
    larghezza è quella giusta a 360px: la fascia paga in **altezza**, che è
    l'unica delle due dimensioni limitabile senza troncare niente (54% in vista
    DM, 31% al tavolo, e il nome sale a 194/250px).
    - Il tetto è su `.ini-list` (112px: **due voci** in vista DM, quattro al
      tavolo) e non sulla barra: durante uno scontro le voci che si guardano
      sono chi tocca e chi viene dopo, il resto dell'ordine è consultazione. La
      terza riga tagliata a metà è ciò che dice che si scorre.
    - `.ini-actions` va su **una riga sola scorrevole** (la ricetta di
      `#plan-toolbar`): tira, metti in campo e chiudi sono comandi della
      battaglia, non del turno, e su due righe da 44 costavano 94px.
    - La condizione è `(max-width:760px) and (orientation:portrait)`, e
      l'orientamento non è di contorno: un telefono **coricato** è ~740×360,
      quindi rientrerebbe nella sola larghezza, ma lì la colonna è il 29% —
      nessun difetto — e la fascia mangerebbe l'altezza, che coricati è la
      dimensione scarsa.
  - Una voce la cui fonte non c'è più **non dichiara un lato**: prima prendeva
    `foe` per esclusione e si disegnava rossa, cioè annunciava un nemico dove
    c'è un buco. Tiene però un `.ini-tipo` vuoto, sennò la sua riga rientra e la
    fila dei glifi smette di essere una fila. Al tavolo il caso non esiste:
    `projectBattle` quelle voci le filtra.

**La scala della campagna** (`SCALA`, `scalaSopra`, `scalaDentro` in `modello.js`,
25 lug 2026): `mondo › continente › nazione › regione › quartiere › edificio ›
stanza`. Verso il basso l'albero è sempre stato infinito — una bolla contiene una
mappa che contiene una mappa — ma il vocabolario si fermava a `quartiere` e la
radice si fissava alla creazione: una campagna nata città restava città, e per
allargarla bisognava esportare il JSON e riscriverlo a mano.

- **Allargare la campagna non è un cambio di schema**: la radice è un nodo come
  gli altri, quindi lo zoom indietro (`zoomOut` in `stato.js`) le mette un
  genitore e riassegna `state.root`. Il documento resta `{schemaVersion, root, …}`
  con la stessa forma e nessun altro modulo si accorge di niente.
- **UNA lista letta nei due versi**, non due elenchi: "cosa c'è sopra?" e "cosa
  nasce dentro?" sono la stessa domanda, e un test impone che `scalaDentro` sia
  l'inversa di `scalaSopra`. Sopra `mondo` non c'è niente (`null`), ed è quello
  che spegne il bottone invece di impilare contenitori senza nome; sotto `stanza`
  non si scende. Piazza e torre restano **fuori**: non sono un gradino, e
  metterle nella lista avrebbe voluto dire decidere se una piazza sta sopra o
  sotto una torre.
- **Nessuna delle due risposte si chiede al DM.** Lo zoom indietro sa già che
  sopra una regione c'è una nazione; il doppio clic sulla tela crea il gradino
  sotto il livello corrente (`formaImplicita` in `mappa.js`) — prima creava una
  stanza a ogni livello, che dentro un mondo è una risposta assurda. Si corregge
  dal campo **Scala** del pannello, che è visibile solo sulla radice: lì la forma
  non è "come la disegno" (nessuno disegna la radice: ci si è dentro) ma "quanto
  è larga la campagna".
- **La vecchia radice eredita `shared`** se sotto aveva qualcosa di rivelato.
  Al tavolo la radice è visibile per costruzione (`projectForPlayers` in
  `share.ts`: "è il contenitore"); scendendo di un gradino smette di esserlo, e
  senza quella riga i giocatori troverebbero un mondo vuoto al posto di tutto
  quello che avevano — è la catena di contenitori di `revealNode` (`tavolo.js`)
  applicata all'indietro. Solo se c'era qualcosa da vedere: rivelare una radice
  sotto cui non è mai stato condiviso niente metterebbe al tavolo una bolla che
  il DM non ha scelto di mostrare.
- Il titolo del livello nuovo è un segnaposto che **porta dentro il nome di
  prima** (`Regione di Guado dell'Airone`) e ne toglie il prefisso precedente: il
  titolo della radice **è** il nome della campagna nell'elenco, quindi "Nuova
  regione" la farebbe sparire dal menu, e senza lo strip tre zoom danno "Mondo di
  Continente di Nazione di X".
- `territorio:true` in `SHAPES` è ciò che rende una forma una `zona` invece di un
  `luogo` (`shapeType`, letto da `addSpatialChild`): era il confronto letterale
  `shape==="quartiere"` dentro `mappa.js`. I cinque territori hanno **un colore
  solo**: il colore dice che cosa è una bolla (un pezzo di mondo, non una
  costruzione), e cinque verdi sarebbero quattro token nuovi da far reggere in
  cinque temi. A dire quanto è largo un territorio sono la dimensione, il nome
  e la **sagoma**.
- **Ogni gradino ha la sua sagoma** (`disegno` in `SHAPES`, `silhouetteForma` in
  `mappa.js`, 26 lug 2026), e la regola è che più il territorio è largo, meno il
  suo contorno è una linea che qualcuno ha tracciato: il mondo è un corpo visto
  da fuori (ellisse più meridiano), il continente ha una costa, la nazione ha un
  confine tratteggiato disegnato sopra la terra, la regione ha una linea
  amministrativa, il quartiere ha bordi veri — il rettangolo di sempre, che è
  anche `defShape` di ogni zona e per questo non cambia aspetto da solo.
  - La conoscenza sta in `SHAPES` e **non** in un confronto sul nome dentro il
    renderer: è lo stesso errore di `shape==="quartiere"`, ripetuto sul disegno.
  - **Una funzione sola disegna qualunque forma**, e la usano sia la tela sia le
    pastiglie del livello vuoto — che prima erano un quadratino CSS
    "tondo/rombo/quadro", cioè una terza descrizione delle stesse nove forme. La
    palette in `app.html` resta scritta a mano (va allineata a occhio) e fino a
    questo lavoro **prometteva cinque profili che la tela non disegnava**: cinque
    rettangoli identici. È il divario che questa funzione chiude.
  - **Tratteggi e raccordi sono proporzionali al riquadro**, non in pixel: la
    stessa funzione disegna una regione da 260px e un'icona da 20, e un `rx=18`
    buono sulla tela trasforma l'icona in una pillola. Il confine della nazione
    ha pochi trattini apposta (otto sul giro): a sedici, sull'icona, spariva e la
    nazione diventava indistinguibile dal quartiere.
  - La costa è una **curva** chiusa (Catmull-Rom → Bézier) su vertici fissi, non
    una spezzata e non una sagoma generata dall'id: `renderCanvas` ridisegna in
    continuo, quindi una costa casuale cambierebbe profilo a ogni battuta. I
    vertici sono a raggio variabile attorno al centro, con dei golfi: provata
    prima tutta convessa, la curva usciva un uovo indistinguibile dal mondo, che
    nella scala gli sta accanto.
  - Il segno interno (meridiano, confine) è `.terr-mark` e **non** `.blk-shape`:
    quella classe porta selezione, focus e alone di "condiviso", e due elementi
    la accenderebbero due volte.
  - **Una sagoma inscritta ha un dentro più stretto del suo riquadro**
    (`dentro` in `SHAPES`, `contentBox` in `modello.js`, 29 lug 2026), e tutto
    ciò che si LEGGE — titolo, anteprima dei figli, conteggio `◦ N`, pallino di
    stato — si impagina lì. Impaginato sul riquadro sbordava dal contorno (fino
    a 8 angoli su 16 dell'anteprima, e il titolo di una torre per intero): la
    bolla si leggeva come se il contenuto le stesse traboccando. È la stessa
    conoscenza di `disegno` chiesta da un secondo posto, quindi sta nello
    stesso campo e non in un confronto sul nome dentro `mappa.js`.
    - I numeri sono **geometria**: ellisse 1/√2 per lato, rombo 1/2. Per la
      costa non c'è formula e sono **misurati sulla curva** (non sui vertici:
      fra un punto e l'altro la Catmull-Rom esce e rientra) col rettangolo di
      area massima, che viene centrato in (0,494, 0,515) — per questo `dentro`
      sono due numeri e non quattro, e per questo un test impone che
      `contentBox` esca centrato.
    - **Le maniglie no**: restano agli angoli del riquadro perché sono comandi,
      e sul contorno vero di un rombo si prenderebbero peggio. Il pallino di
      stato invece è informazione e segue il contenuto.
    - **Muri accesi = sagoma piena**, quindi `contentBox` torna il riquadro
      intero: `shapeMarkup` in quel caso disegna un rettangolo, e stringere il
      contenuto per una silhouette che nessuno sta disegnando sarebbe la
      divergenza che questo campo esiste per evitare.
    - Il verso in cui si sbaglia è dichiarato da `test/scala/`: ogni sagoma
      deve dirsi **inscritta o piena**, e una nuova che non ricade in nessuno
      dei due elenchi fa fallire il test. Il difetto vero non fallisce niente —
      si vede soltanto guardando una bolla.
- L'elenco delle forme è in **due posti** — `SHAPES` (`modello.js`) e la whitelist
  del contratto (`formato-campagna.js`) — e `test/scala/` impone che coincidano:
  una forma che l'app disegna ma il validatore non conosce fa rimbalzare con 422
  il salvataggio di una campagna legittima, e il DM lo scopre dopo averla
  costruita. La palette in `app.html` va allineata a mano; quella del livello
  vuoto (`emptyNodeMarkup`) si genera da `SHAPES`.

**Chi sta sulla maglia, e come** (`onGrid`/`snapNode` in `modello.js`, l'unico
posto che lo decide). Ci si sta in due modi, perché sono due cose diverse:

- Le forme con `grid:true` in `SHAPES` (edificio, stanza, piazza) sono **piante
  in scala**: si aggancia l'**angolo** (`snapGrid`) e anche le dimensioni sono
  quadretti interi, a ogni interazione (creazione, drag, resize, frecce, input
  del pannello).
- I **segnalini** (`isMarker`: quest, encounter, PNG, nota, pedina) sono simboli
  più stretti di un quadretto e ci stanno **dentro**: si aggancia il loro
  **centro** al centro della cella (`snapToCell`). Agganciarne l'angolo li
  lascerebbe a cavallo di quattro celle, sbilanciati di 5px in alto a sinistra —
  "sta in un quadretto" vero per le coordinate e falso per l'occhio.
  Il raggio che decide l'aggancio è quello **disegnato** (`markerR`: la pedina è
  un pixel più grande del segnalino, e `mappa.js` legge di lì per disegnare il
  disco): con un raggio sbagliato il centro geometrico finisce nella cella
  giusta e il disco no.

Fuori restano solo **quartiere e torre**, che non sono in scala. Chi è agganciato
non riceve l'allineamento magnetico alle altre bolle: lo tirerebbe fuori dal
quadretto, e la maglia è già un allineamento più forte. Le due migrazioni sono
diverse **e devono restarlo**: i segnalini si centrano da sé al caricamento
(`migrateState`), perché un simbolo si sposta al massimo di mezza cella e non
cambia dimensione; le forme in scala no — ridimensionarle a quadretti interi le
farebbe accavallare, quindi si agganciano al primo tocco. L'unico modo di
sovrapporre due segnalini è averli più vicini di un quadretto: per questo
l'import del dungeon dispone i PG a una cella l'uno dall'altro e non a 36px.
Il combattimento **non introduce una regola sua** (alza il contrasto della
griglia, e basta): l'allineamento delle pedine all'accensione è stato tolto il
22 lug 2026 perché non aveva più niente da allineare.

**Muri liberi** (`wallSegs` in `modello.js`, disegno e gesto in `mappa.js`): sono
la *seconda* cosa chiamata muro, e non c'entra con la prima. Il perimetro qui
sotto è **derivato** — il contorno di una bolla, con le porte dove passa un
collegamento — e serve a leggere una pianta a colpo d'occhio. Un muro libero è un
**dato**: un segmento che il DM posa, trascina e allunga, e con cui costruisce il
perimetro su cui si gioca (stanze a L, corridoi, tramezzi). Le porte lì sono i
buchi che si lasciano fra un muro e l'altro, e non c'è niente da dichiarare.

- Vivono in `n.wallSegs` sul nodo del **livello**, come `n.edges`: sono il
  pavimento, non la sagoma di una bolla. Da non confondere con `n.walls`, che è
  il flag acceso/spento del perimetro — **lo stesso nodo può avere entrambi.**
- Forma: `{id, x, y, dir:"h"|"v", len}`, con `len` in quadretti interi. Gli
  estremi si agganciano agli **incroci** della maglia (`snapGrid`), non al centro
  della cella come i segnalini: su un battlemap le pedine stanno nelle celle e i
  muri fra una cella e l'altra.
- Un gesto solo allunga **e** ruota (`stretchWallSeg`): l'altro capo sta fermo e
  l'asse lo decide lo spostamento più lungo. Niente comando "ruota" — sarebbe un
  bottone per una cosa che il dito sta già dicendo.
- **Una porta è un muro dichiarato porta** (`w.porta`, valori in `DOOR_TYPES`:
  aperta, chiusa, chiave, segreta), non un buco fra due muri. Il buco resta il
  modo di fare un varco, ma non sa dire "c'è un battente" né "è chiusa a
  chiave", e al tavolo un varco e una porta si leggono uguali. È il **segmento
  intero** a dichiararsi porta — darle un'ascissa dentro il muro sarebbe un
  secondo sistema di coordinate per una cosa che la maglia dice già. Dalla
  palette nasce lunga **un quadretto**, che è quanto è larga una porta: posarla
  e basta, invece di posare un muro e poi accorciarlo.
  Nel disegno l'anta è **parallela** al muro se è chiusa e **perpendicolare** se
  è spalancata (`doorMarkup` in `mappa.js`): il contrasto è di orientamento, non
  di colore, quindi regge in tutti e cinque i temi e per un daltonico — e
  soprattutto una porta aperta smette di essere un buco. Il catenaccio della
  chiusa a chiave è un tratto perpendicolare, per la stessa ragione. La segreta
  non apre niente: muro pieno più il segno viola tratteggiato, come
  `.wall-secret` del perimetro derivato.
  `aggiornaMuro` riscrive **tutto il gruppo** durante il trascinamento: da
  quando esistono le porte le linee di un muro non hanno più tutte la stessa
  geometria, e spostarle in blocco ammucchierebbe stipiti e battente sui capi.
  Si può perché il pointer capture sta sull'`<svg>`, non su quel `<g>`.
- La classe CSS è `.wall-seg`, **non** `.wall`: quella è già dei tratti del
  perimetro, e un `closest(".wall")` intercettava i clic sul bordo delle bolle.
- `st.selectedWallId` è il terzo selezionato, mutuamente esclusivo con
  `selectedId` e `selectedEdgeId`. **L'azzeramento sta in un posto solo**
  (`clearSel()` in `stato.js`, più `selectNode`/`selectWall` per la selezione
  singola): erano cinque assegnazioni ricopiate in otto punti, e ogni punto che
  ne dimenticava una lasciava acceso in oro qualcosa di deselezionato. Dove la
  tela **non** si ridisegna (il pointerdown, che deve tenere vivo il nodo sotto
  il puntatore) la classe `.sel` si riaccende a mano con `ridipingiSel()`, il
  cui elenco da spegnere comprende `.wall-seg.sel`.
- **La selezione multipla dei muri è un insieme suo** (`st.multiSelWalls`) e non
  entra in `st.multiSel`: sei moduli leggono quello dando per scontato che
  contenga id di **nodi** (`childOf`, `findNode`), e mescolarli avrebbe voluto
  dire riscrivere quel codice per il caso secondario, con le bolle a pagarne il
  rischio. I due insiemi convivono — una selezione può essere mista — e si
  azzerano sempre insieme, che è tutto il prezzo della scelta.
  Il trascinamento è **uno solo** per entrambe le àncore (`dragGroup`,
  `moveGroupBy`, `riagganciaGruppo`): afferrando una bolla o un muro si muove lo
  stesso gruppo. Il gruppo si sposta rigido e ognuno **si riaggancia alla
  propria maglia al rilascio** — la regola che le bolle seguivano già, perché
  l'àncora può essere una bolla libera che si muove di 10px. Per la stessa
  ragione le frecce usano **un passo solo** per tutta la selezione (`CELL` se un
  membro sta sulla maglia): un passo per elemento deformerebbe il gruppo a ogni
  battuta. Le maniglie compaiono solo quando il muro è l'unica cosa selezionata:
  allungare un perimetro intero non vuol dire niente.
  `duplicateSelected` copia **tutta** la selezione — bolle, muri e i
  collegamenti fra le bolle duplicate — con **uno** scarto per tutto il gruppo,
  sennò un gruppo misto esce deformato rispetto all'originale.
- **Le coordinate di un muro sono untrusted e non hanno rete**: quelle di una
  bolla le ricalcola `ensureLayout` se non sono numeri, un muro no, e finiscono
  in attributi SVG. `safeWallSeg` (client) e la proiezione in `share.ts`
  (server) devono restare d'accordo: ciò che non è un numero **dichiarato** fa
  cadere il segmento invece di essere corretto a 0,0 — attenzione che
  `Number(null)` è 0 e che `JSON.stringify` scrive `null` al posto di un NaN,
  quindi il caso capita per davvero. `len` ha un tetto (`WALL_MAX`, 200): un muro
  da un miliardo di quadretti pianta il browser dei giocatori, che è l'unico
  posto dove nessuno può chiudere la scheda e rimediare.

**Muri e porte** (`wallPlan` e dintorni in `modello.js`, disegno in `mappa.js`): il
muro è il perimetro spezzato dalle porte, e **le porte non sono un dato** — stanno
dove il raggio centro→centro di un collegamento buca il perimetro, ricalcolate a
ogni disegno. Non esiste uno stato "porte" che possa divergere dalla mappa: spostare
una stanza sposta la porta, togliere un arco richiude il muro. `walls` in `SHAPES`
vale `true` (muri accesi di default: solo `stanza`, la forma che esce dal generatore
di dungeon) oppure `"opt"` (possibili ma spenti: `edificio`, che è anche la forma
implicita di ogni `luogo` senza `shape` — accenderli lì avrebbe messo pareti dentro
ogni bolla già disegnata). Il campo `n.walls` è la scelta esplicita del DM e batte
il default. Il muro corre **dentro** la forma (`WALL_INSET`), sennò coprirebbe il
contorno di `.blk-shape`, che porta la selezione e l'alone di "condiviso".

**Strumenti temporanei della mappa** (`public/app/strumenti/`): oggi il **righello**
(R) e le **aree d'effetto** (A, quattro footprint scelti coi tasti 1–4) — l'elenco
installato è `TOOLS` in `strumenti/index.js` e non questa riga. Restano da scrivere
percorso a waypoint, coordinate (vorrebbe un `hoverMove` nel contratto, che oggi non
c'è) e mirino. Sono **temporanei**: disegnano su una tela a parte e non toccano mai
la campagna.
- **Due SVG, non uno.** `#plan-tools-svg` sta sopra `#plan-svg` in `app.html` e
  non viene **mai** riscritto: `renderCanvas()` rifà `plan-svg.innerHTML` a ogni
  disegno, compreso il polling del tavolo, quindi un overlay dentro la tela
  sparirebbe da sé. `pointer-events:none`: gli eventi restano a `plan-svg`. Niente
  `z-index` di proposito — l'ordine del DOM lo tiene sopra la mappa e sotto hint/
  battle-bar/fab (sta subito dopo `plan-svg` e **prima** di quelli). Il legame col
  renderer è una riga sola: `planApplyVB()` scrive lo stesso `viewBox` su entrambi.
- **Un solo gestore** (`gestore.js`) possiede registro, tool attivo, pulsanti,
  scorciatoie, listener Pointer Events **in cattura** su `plan-svg` e pointer
  capture del gesto. I gesti della mappa (pan, pinch, drag, muri) sono in fase
  **bubble**: il gestore in cattura li precede e con `stopImmediatePropagation()`
  li blocca **solo** quando un tool prende il gesto (`pointerDown` → `true`). Senza
  tool attivo ogni handler ritorna subito: la mappa è identica a prima. Centrale =
  pan, destro = menu, rotella = zoom restano alla mappa; un secondo dito annulla
  il gesto del tool; `Escape` esce dal tool **prima** che `scorciatoie.js` lo
  legga come deseleziona/risali. Un errore dentro un tool si logga, lo spegne e
  libera puntatore/cursore/pulsante — pan e drag non restano mai bloccati.
- **Dipendenze iniettate.** Il gestore non tocca `document`/`window` direttamente:
  tutto arriva da `opts` (elementi, `doc`, `keyTarget`), così gira sotto Node coi
  fake dei test. `main.js` lo inizializza **dopo** `initMappa` (i cui listener
  bubble deve poter precedere) e **prima** del primo `renderMap`, con `readOnly`
  da `RO`.
- **Il contratto di un tool** (JSDoc in `gestore.js`): `id`, `label`, `shortcut`
  (un tasto), `scope` (`tutti`|`dm`|`tavolo`), e i callback `pointerDown` (torna
  `true` per prendere il gesto), `pointerMove`/`pointerUp`/`activate`/`deactivate`/
  `cancel`, più `keyDown(ctx,ev)` (torna `true` per consumare il tasto). Riceve un
  `ToolContext` piccolo (`toMapPoint`, `snapToGrid`, `cell`, `metersPerCell`,
  `layer`, `announce`, `clear`) — **mai** `st`, `save` o `share.ts`. La geometria
  del righello è una funzione pura (`distanzaCelle`), testata senza DOM. `keyDown`
  è la via dei **sottotipi** di un tool: le aree d'effetto scelgono cerchio/cono/
  linea/quadrato coi tasti 1–4 senza aggiungere pulsanti. Il gestore lo inoltra al
  tool attivo **prima** delle scorciatoie globali; Escape non ci arriva mai (spegne
  il tool), e un tasto rifiutato (`false`) prosegue verso la scorciatoia.
- **Aggiungere un tool** = un file sotto `strumenti/`, un import e una riga in
  `TOOLS` dentro `strumenti/index.js`. Nient'altro: non `app.html`, non `mappa.js`,
  non `tavolo.js`, non le API. Un tool **persistente** (aure salvate, fog of war,
  condizioni sulle pedine, ping condiviso) non passa da qui: prima vogliono schema
  dati, migrazione, salvataggio cloud, proiezione server-side del tavolo e
  autorizzazioni. Il registro dei tool non è la scorciatoia per saltare quei confini.

**Preferenze dell'interfaccia vs stato della campagna**: tema (`runebog-theme`) e
larghezza del pannello dettagli (`runebog-detail-w`) stanno in `localStorage`, non nel
JSON — che viaggia tra export, cloud e tavolo, mentre queste dipendono dallo schermo che
si ha davanti. Entrambe sono gestite in `main.js`; la larghezza è la variabile CSS
`--detail-w` su `:root`, così il clamp in `vw` resta al CSS, che segue i resize della
finestra.

**La copia offline** (`/sw.js`, 2 ago 2026): l'app offline lo era già — `/app.html`
senza `window.__cloud` non fa una richiesta di rete dopo il caricamento, lo stato sta
su `localStorage` e non c'è build né framework. Mancava solo che il browser tenesse
i file. Un **service worker**, quindi, e non un pacchetto da scaricare: `main.js` è
`type="module"` e da `file://` l'origine è opaca, cioè gli import ES cadono per CORS —
un HTML scaricato si aprirebbe bianco, e farlo funzionare vorrebbe dire un bundler,
cioè quel build che questo repo non ha di proposito (le versioni standalone sono
state ritirate perché erano una seconda copia del sorgente).

- **Il worker è generato, non scritto a mano.** `src/app/sw.js/route.ts` è
  `force-static` — stesso mestiere e stesso trucco di rotta (il punto nel nome) di
  `/srd/ancore.json`, quindi in produzione è un asset. Il corpo sta in
  `src/lib/offline/sw-sorgente.js`, leggibile e diffabile; la rotta gli antepone solo
  il `MANIFESTO`. Il motivo è tutto lì: in `public/` **non c'è build hashing**, quindi
  una lista di file scritta a mano e una versione da alzare a mano restano indietro
  **in silenzio** — l'utente inchiodato all'editor di tre deploy fa senza un modo di
  accorgersene. La lista si legge dal disco, le pagine SRD si ricavano da
  `tutteLeAncore()` (lo stesso registro della ricerca, che esiste proprio perché
  quella mappa la decidono i divisori) e le due versioni sono **hash del contenuto**.
- **Due livelli, e la differenza non è tecnica ma di costo.** L'editor (38 file,
  225 KB gzip) si precarica **da sé** all'apertura di `/app.html`: chi è lì quei
  file li ha appena scaricati tutti, quindi non aggiunge byte — un bottone lì sarebbe
  un comando per riparare qualcosa che nasce storto. Le 61 pagine dell'SRD sono
  1,38 MB e si **chiedono**, dal bottone in fondo a `/srd` che porta la misura scritta
  sopra. Depositi separati: toccare `mappa.js` non deve far riscaricare il glossario.
- **Solo in standalone** (`public/app/offline.js`): `/play/[id]` e `/tavolo/[token]`
  servono questo stesso `app.html` con lo stato iniettato dentro l'HTML, e non
  registrano niente. Installare da un link condiviso lascerebbe un worker sul telefono
  di un giocatore per una cache che non lo riguarda.
- **La porta d'ingresso è una pagina, non un redirect** (`public/offline.html`,
  `ripiegando` nel worker, 2 ago 2026). Chi ha `runebog.app` nei preferiti offline
  prendeva `ERR_INTERNET_DISCONNECTED`: `/` è la home del sito, che vuole auth e
  database, mentre la copia sta su `/app.html` — cioè il lavoro funzionava solo per
  chi conosce l'indirizzo interno. Ora ogni navigazione che **cade** (solo un errore
  di rete: un 404 è una risposta del sito, e coprirla sarebbe una diagnosi sbagliata)
  riceve quella pagina, che dice cosa c'è sul dispositivo e porta all'editor.
  - **Non** un redirect: offline `/app.html` è lo standalone su `localStorage`,
    un'altra cosa dalle campagne cloud che quel DM si aspetta di trovare, e
    scambiarle senza dirlo sarebbe la perdita silenziosa che tutto il resto evita.
  - Sta in `public/` e non è una rotta Next per due motivi che vanno insieme: il
    manifesto legge `public/` per intero, quindi si precarica da sé; e non tira
    dentro un solo chunk di `/_next/static`, che offline è proprio ciò che può
    mancare. Una pagina di ripiego che si apre senza stili non ripiega.
  - Il link alle regole compare solo se le regole ci sono (`caches.match("/srd")`,
    con `ignoreVary` perché le pagine di Next rispondono con un `Vary`): un link
    che riporta qui è peggio di un link che non c'è.
  - La vede solo chi ha già una copia offline — il worker si registra da
    `/app.html` o dal bottone delle regole, mai dalle pagine del sito — ed è
    coerente: a chi non ha niente non avrebbe niente da dire.
  - Si passa **`ev.request` così com'è** a `fetch`: una navigazione ha
    `redirect:"manual"`, quindi un 3xx torna opaqueredirect e il salto lo fa il
    browser. Ricostruendo la richiesta si perde quel modo e rispondere a una
    navigazione con una risposta già seguita è un errore di rete — cioè la home di
    ogni utente loggato, che qui fa `redirect` verso l'ultima campagna.
- **I chunk di Next stanno nel deposito delle regole** (`chunkDiNext`,
  `iChunkDellaRicerca`, 2 ago 2026). Le pagine SRD sono prosa resa dal server e si
  leggono senza idratazione, ma la ricerca su `/srd` è un componente client: senza i
  suoi chunk il campo c'è e non trova niente. Fino a questa data reggeva per
  **fortuna** — quei file stavano nella cache HTTP, che il browser sfratta quando
  vuole (misurato svuotando la sola cache HTTP: la pagina si legge, la ricerca dà 0
  risultati). Un difetto che passa ogni prova, perché la prova arriva a cache calda.
  - Non si possono precaricare dal **manifesto**: `/sw.js` gira *durante* il build e
    i chunk delle altre pagine non esistono ancora. A runtime non c'è però
    disallineamento possibile — sono hash del contenuto, quindi una copia in cache è
    per costruzione la copia giusta e l'HTML salvato cita esattamente quei nomi.
  - La regola a runtime da sola **non basta**, ed è un problema di ordine: i chunk di
    `/srd` il browser li ha presi aprendo la pagina, cioè prima che esistesse il
    deposito in cui scriverli, e non li richiede più. Da lì `iChunkDellaRicerca`, che
    li rilegge **dall'HTML appena salvato** — solo quelli di `/srd`, dove sta la
    ricerca — e best-effort, a differenza delle pagine che sono atomiche: un chunk
    che manca costa la ricerca, non le regole.
  - Si **scrive** solo se il deposito delle regole esiste già (chi non ha accettato
    quel costo non paga byte per una ricerca che non ha chiesto) e si **legge** da
    tutti i depositi, come per le regole. Sono 149 KB sui 1,38 MB delle pagine: il
    bottone dice 1,5 MB, ed è il totale vero.
- **Installabile** (`src/app/manifest.ts`, `public/icone/`, 2 ago 2026): è il passo che
  rende vero il caso d'uso — un tablet al tavolo — invece di una scheda di browser.
  `start_url` è la **home** e non `/app.html`, per la stessa ragione per cui il ripiego
  non è un redirect. Le icone sono **generate** da `src/app/icon.svg` con
  `node scripts/genera-icone.mjs` e non si modificano a mano; la `maskable` è un
  disegno diverso (sfondo ai bordi, soggetto nel cerchio di sicurezza) e non un
  ritaglio. `app.html` porta a mano il `<link rel="manifest">` e i tre tag di iOS,
  che il manifesto non lo legge: lì Next non passa. Colori del manifesto e barra di
  stato sono quelli di Torbiera e stonano sui temi chiari — rovescio dichiarato, sono
  file statici e il tema sta in `localStorage`.
- **Invariante: `/play`, `/tavolo` e `/api` non entrano mai in cache** (`fuoriDallaCache`).
  Lì non si risponde e non si ripiega — **nemmeno con la pagina di ripiego**: la regola
  resta una sola riga da tenere a mente invece di due. Una copia di
  `/play/[id]` è lo snapshot di una revisione vecchia servito come fresco; il tavolo è
  per contratto `private, no-store`, un link segreto che non deve fermarsi da nessuna
  parte; `/api` ha già il suo ETag su `revision`, e un secondo strato di cache è il
  modo di farlo mentire. **Il verso in cui si sbaglia è dichiarato**: offline che non
  funziona è un fastidio, offline che funziona con dati vecchi è una perdita silenziosa.
- **Solo le navigazioni** entrano nel deposito delle regole (`req.mode === "navigate"`):
  le pagine SRD sono Next, quindi lo stesso indirizzo viene chiesto anche come payload
  RSC dal prefetch di un link, e servire un RSC dove il browser aspetta un documento è
  una pagina bianca.
- **L'aggiornamento delle regole si migra, non si azzera**, e la guardia è doppia. La
  copia superata si butta **solo dopo** che la nuova è arrivata, sennò un deploy preso
  con la rete che cade lascia il DM senza regole — cioè nella situazione per cui le
  aveva scaricate. E la lettura passa da `caches.match` **senza nome**, che attraversa
  tutti i depositi: leggendo solo dal corrente, quella regola avrebbe protetto dei byte
  che nessuno legge. Il rovescio è dichiarato — senza rete si leggono regole di una
  versione precedente, che per un testo fermo come l'SRD è meglio di un errore.
- Si prova con `node test/browser/verifica-offline.mjs` e **`npm run start`, non
  `npm run dev`**: in dev le pagine SRD si compilano su richiesta e scaricarne 61 va in
  timeout, e `/sw.js` sarebbe una funzione invece dell'asset che si vuole provare. La
  verifica finge un deploy cambiando l'**URL** dello script: `unregister()` +
  `register()` con un client ancora controllato resuscita la registrazione invece di
  installarne una nuova, l'`activate` non gira e la prova passerebbe guardando il
  lavoro di prima. La ricerca invece va provata **a cache HTTP svuotata**
  (`Network.clearBrowserCache` via CDP, Cache Storage intatta): a cache calda
  funziona anche quando è rotta, ed è così che il difetto è passato inosservato.
- Fuori restano login, campagne cloud e `/dungeon` (React con chunk hashati:
  precaricarlo vorrebbe enumerare l'output del build). Offline quei tre indirizzi
  rispondono comunque, con la pagina di ripiego: la verifica lo controlla guardando
  il **contenuto** e non lo stato, sennò un 200 basterebbe a farla passare.

**Temi** (dodici, lug 2026): `public/themes.css` è la sorgente unica dei token
colore, letta sia dal sito (link in `layout.tsx`) sia da `app.html`. I nomi sono
per ruolo (`--moss` = accento primario), non per tinta: i temi si cambiano lì e
in nessun altro posto.

- **L'elenco dei temi sta in `public/app/temi.js`**, modulo di soli dati senza
  import: `main.js` ci riempie il `<select>` della topbar e `menu.js` le voci del
  menu "⋯". Erano tre elenchi scritti a mano (le `<option>` in `app.html`, l'array
  di validazione, la mappa id→etichetta): a cinque temi reggeva, a dodici il modo
  di romperli è **silenzioso** — un tema aggiunto al CSS e dimenticato lì non
  compare, uno tolto dal CSS si sceglie e non fa niente. Resta da allineare a mano
  solo `themes.css`, che i colori li ha davvero.
- I temi si raggruppano **per fondo** (scuri, chiari, accessibilità): è il criterio
  con cui si sceglie davvero, cioè la luce che si ha in stanza. "Alto contrasto"
  sta per conto suo — è un'esigenza, non un'atmosfera.
- **Il bordo ha due token e non è una sfumatura**: `--edge`/`--edge-soft` sono
  separatori **decorativi** (righe fra sezioni, cornici) e stanno bassi apposta,
  perché una griglia marcata è rumore; `--edge-ui` è il contorno di un
  **componente** — campi, tendine, bottoni — dove il bordo dice dove finisce la
  cosa su cui si clicca, e WCAG 1.4.11 gli chiede 3:1. Va misurato su **tutte**
  le superfici su cui compare: il pannello (i bottoni), il fondo incassato (gli
  input) e la **tela** (i livelli che ci galleggiano sopra). Nell'app l'alias è
  `--line-ui`; il verificatore controlla `--edge-ui` e **non** `--edge`, che la
  norma non copre. Fino al 26 lug 2026 era un token solo, quello decorativo, e i
  campi erano bordati a 1,3:1 in undici temi su dodici; la correzione di quel
  giorno si fermò a campi e bottoni, e il 28 lug ha coperto gli altri ~17 punti
  (`.pal-item`, `.ep-chip`, `.check-item`, `.pcard`, `.foe-card`, `.q-row`,
  `.child`, `kbd`, `#qs-kbd`, `#ctx-menu`, `#qs-results`, `#srd-results`,
  `.hp-btn`, `#battle-bar`, `.foe-ro`, `.only-dm`, più `.campaign` nel sito).
  - **A decidere è il ruolo, non il selettore**: `--line-ui` se il bordo
    delimita una cosa che si opera, oppure un livello che **galleggia** e non ha
    altro che lo stacchi da ciò che sta sotto; `--line` se separa due zone della
    stessa superficie (bordo della topbar, `.detail-actions`, `.share-field`,
    `#ctx-menu hr`). I `<dialog>` sono l'eccezione che dice la regola e restano
    su `--line`: hanno un `::backdrop` che scurisce tutto il resto, quindi a
    staccarli è il riempimento e non il contorno.
  - **`--edge-ui` non è solo per i bordi**: dal 29 lug 2026 è anche il
    riempimento **a riposo** di due comandi che di contorno non ne hanno — la
    striscia di `#detail-grip` e la `★` spenta di `.q-star`. Su `--line`
    stavano a 1,37:1 (Torbiera), cioè comandi che si scoprono solo per caso.
    Non è una severità inventata: WCAG 1.4.11 chiede 3:1 all'informazione
    visiva che **identifica** un componente, non solo ai contorni, e per questi
    due non c'è altro (la maniglia è `role="separator" tabindex="0"`, cioè un
    widget). L'eccezione della norma vale per i componenti **inattivi**, e
    "spento" non è "disabilitato". Un riempimento però ha **una** adiacenza,
    quindi non vale lo sconto del bordo qui sotto: la maniglia sta fra pannello
    e tela e le deve reggere entrambe. Nessuna coppia nuova in `COPPIE` — le
    tre superfici (`--surface`, `--peat`, `--glow`) erano già misurate, e le
    righe lo **dicono**, com'è già per l'anello di focus.
  - Un bordo ha **due adiacenze** e ne basta una a 3:1, che è ciò che la norma
    chiede: `#srd-results` è a 2,7:1 contro il proprio riempimento (`--panel-2`)
    e regge sul pannello che ha sotto. Per questo `--edge-ui`/`--surface-hi`
    **non** è in `COPPIE`: sarebbe una severità inventata, e l'elenco vuole
    coppie trovate nel CSS.
- Un tema che non ridichiara un token **eredita quello di `:root`**, cioè di
  Torbiera — non il proprio omologo. Gilda ha un `--edge` che passerebbe da sé,
  ma senza dichiarare anche `--edge-ui` si prendeva quello verde di Torbiera e
  scendeva a 2,78:1 sul navy. Vale per ogni token nuovo aggiunto a `:root`.
- **`npm run temi:contrasto` misura tutti i temi insieme** e esce con codice 1 se
  una coppia sta sotto la sua soglia WCAG (4.5:1 sul testo, 3:1 sui contorni). Le
  coppie sono quelle che l'interfaccia usa **davvero**, ognuna trovata nel CSS e
  citata nel commento accanto: aggiungerne una senza dire dove sta è come non
  averla. È il controllo che rende scrivibile un tema nuovo — a dodici temi
  l'occhio non li copre più, e un accento che su Torbiera brilla su Pergamena è
  a 3:1 senza che nessuno lo noti. Il rovescio: `COPPIE` è **scritto a mano**,
  quindi lo script misura ciò che qualcuno si è ricordato di dichiarare. Un
  guasto fuori da quell'elenco passa con 12/12 verdi (28 lug 2026: l'anello di
  focus, sotto soglia in cinque temi, con lo script pulito; e i ~17 bordi di
  componente rimasti su `--edge`, che nessuna coppia guardava).
- **Un gradiente si misura agli estremi, e quale sia il peggiore lo decide il
  token**: il fondo è un radial fra `--glow` e `--peat`, e per il testo chiaro
  il caso brutto è `--peat`, il più vicino. Per un **mezzotono** come
  `--edge-ui` è l'opposto — è `--glow` a stargli accanto in luminanza, e infatti
  Torbiera, Cripta e Brace passavano su `--peat` (3,34–3,45) e cadevano sul glow
  (2,85–2,96) **proprio dove `#battle-bar` si apre**, a 12px dall'angolo in alto
  a sinistra. Fino al 28 lug 2026 l'intestazione dello script dichiarava che
  l'estremo peggiore è `--peat` e basta: vero finché a guardare il fondo era
  solo del testo, falso appena ci si è affacciato un bordo.
- **`--moss-deep` è un riempimento, e un riempimento ha UNA adiacenza**: ciò
  che ci sta dietro. Non vale quindi lo sconto dei bordi ("ne basta una delle
  due"), e le superfici sono tre — la barra PF (`.hp-bar i`, sul fondo
  incassato), la spunta della checklist (`accent-color`) e la maniglia di
  collegamento, entrambe sul pannello. La severa è il **pannello**, la più
  chiara. Fino al 29 lug 2026 nessuna riga di `COPPIE` lo guardava e stava
  sotto 3:1 in cinque temi (Sottosuolo 1,94): ora ci sono le due righe, e i
  cinque valori sono stati avvicinati al **proprio `--moss`** (9–39%) invece
  che sostituiti — la variante scura deve restare la tinta dell'accento.
- **Una barra PF è un incavo: quello che si vede è il riempimento** (`.hp-bar`
  in `app.css`, una ricetta sola per i PG e per i mostri dal 29 lug 2026).
  La pista sta a 1,03–1,28:1 sul pannello in tutti e dodici i temi e va bene
  così — il massimo è scritto nei due campi accanto, e alzarla a 3:1 vorrebbe
  dire riprogettare la barra per una soglia che nessuno chiede. La coppia che
  conta è il **riempimento contro la pista**, ed è per questo che l'incavo
  (`--bog-2`) è la pista giusta: era `--line` sui mostri, cioè un mezzotono, e
  le tre fasce ci cadevano sotto 3:1 in sei casi su trentasei (dodici temi ×
  tre fasce), cioè la barra spariva a pochi PF.
  - **I colori delle fasce stanno nel CSS**, non in uno `style` inline scritto
    dal JS (`hpFascia` in `mostri.js` torna una classe): un colore inline non
    lo trova nessun grep sul CSS, quindi nessuno lo dichiara in `COPPIE` — ed
    è letteralmente il motivo per cui quelle tre fasce non erano misurate.
    Regola generale: un colore che il JS decide è un colore che il
    verificatore dei temi non vedrà mai.
  - Le **soglie** invece restano due (30% per i PG, 25/50% per i mostri): sono
    regole di prodotto diverse, non due copie della stessa, e unificarle
    cambierebbe quando la barra di un PG diventa rossa.
- **Sopra un riempimento d'accento non ci va del testo.** Un glifo chiaro su
  `--moss-deep` sta a 2,1–3,8:1 anche nei temi che passano la soglia dei
  riempimenti, perché la soglia del testo è 4,5. I due casi noti sono
  `.btn.primary` e `#detail-fab` (il bottone flottante che su telefono è
  l'unico modo di aprire il pannello dettagli, corretto il 29 lug 2026): stanno
  entrambi su `--moss` pieno. Il FAB è il promemoria che una regola dentro una
  media query mobile non si vede misurando da desktop.
- **L'anello di focus è l'accento PIENO** (`--moss`, nell'app `--fen`), mai
  `--moss-deep`: quella è la variante scura per riempimenti e barre, e come
  *contorno* stava a 1,94:1 su Sottosuolo. Le coppie che lo reggono sono quelle
  dell'accento su fondo e su pannello, a soglia 4,5 — più severa dei 3 che WCAG
  1.4.11 chiede a un focus, quindi non serve una riga in più in `COPPIE`, serve
  che quelle righe lo **dicano** (il commento le cita). Caso da tenere a mente:
  `#detail-grip` ha `outline:none` e l'indicatore *è* la striscia che si
  accende, quindi lì il colore non ha un secondo segnale a cui appoggiarsi.
- Lo script controlla anche che le **cinque famiglie** (`--moss` accento, `--wisp`
  link, `--lantern` evidenza, `--ember` distruttivo, `--arcane` arcano) restino
  distinguibili **fra loro**, che è una domanda diversa dal contrasto sul fondo:
  un tema in cui accento e distruttivo sono lo stesso rosso passa ogni soglia e
  resta inservibile. Si misura in **ΔE Lab e non col rapporto WCAG** — quello
  guarda la luminanza e dava per uguali un verde e un ciano della stessa
  chiarezza, 110 avvisi su temi che vanno benissimo. La soglia (17) è **misurata**
  sui temi originali: la coppia più vicina già accettata è il rame e l'oro di
  Brace, ΔE 17,4. È un avviso e non un errore — due famiglie vicine si possono
  tenere, come fa Brace, ma dicendolo.
- Quando una palette arriva da fuori con tre colori, quelli **restano dove la
  proposta li destinava** e il resto si deriva; e prima di correggere un valore
  "che sembra basso" **va misurato**: l'oro di Taverna e l'arancione di Gilda
  erano stati schiariti per prudenza e passavano già (5,2:1 e 5,5:1), mentre il
  teal di Alba (3,74:1) e il viola di Sottosuolo (4,28:1) andavano davvero
  corretti. Il valore giusto è quello che passa, non quello che rassicura.

**Generatore di dungeon**: motore puro e deterministico (seed-based) in
`src/lib/dungeon/engine.ts`, dataset SRD in `src/lib/dungeon/srd-data.ts`, UI in
`src/app/dungeon/`. L'export (schema `1.1`) è importabile nell'app come bolla `luogo`.
I nomi dei mostri in `srd-data.ts` DEVONO combaciare con le schede italiane di
`public/app/srd-mostri.js`: all'import `dungeon.js` aggancia la scheda per nome
(`statblockSRD()` in `mostri.js`, la stessa ricetta del bestiario) — gli export
legacy in inglese passano dalla mappa `public/app/dungeon-nomi.js`. Il motore
sceglie i mostri per tag e GS, mai per nome: rinominare è sicuro, disallineare no.

Le stanze importate portano le loro **pareti vere** (`public/app/dungeon-muri.js`,
25 lug 2026): muri liberi sul nodo del livello — cioè sulla bolla-dungeon, che è
il livello dove stanno le stanze — e non il perimetro derivato, che infatti
`dungeon.js` spegne (`rn.walls = false`). I due non si sommano: quello corre 5px
dentro la sagoma e apre le porte dove passa il raggio centro→centro di un arco,
cioè quasi mai dove sta la porta del dungeon. Sono **derivate all'import** dalla
griglia dell'export (celle `3`), non emesse dal motore: un campo nuovo vorrebbe
uno schema nuovo e due verità da allineare, e lascerebbe senza muri ogni export
già salvato. Sono ~122 muri per un dungeon da 16 stanze, il massimo che la UI
concede, contro i 3000 di `wallsPerNode`. Due cose che sono guardie:

- **Una stanza sigillata non fallisce niente**: sembra funzionare finché
  qualcuno non prova a entrarci. Capita perché il motore marca le celle `3`
  guardando DALLA cella di corridoio e si ferma alla prima stanza che tocca —
  una soglia stretta fra due stanze finisce a una sola. Col perimetro derivato
  non si vedeva (le porte venivano dagli archi, che ci sono sempre); con le
  pareti vere è un muro pieno. `apriUnPassaggio` promuove la prima cella di
  corridoio adiacente, e un test lo impone su 78 dungeon.
- Il quadrato d'oro che segnava le porte nello **sfondo** è stato tolto: stava
  sulla cella di corridoio, cioè accanto alla porta disegnata sulla parete —
  due segni per una porta sola, in due posti diversi.

**Sezione regole** (`/srd`): i capitoli dell'SRD 5.2.1 in italiano. I JSON di
`src/lib/srd/capitoli/` sono GENERATI da `scripts/estrai-srd-regole.mjs` (fratello
di `estrai-srd-mostri.mjs`: stesso PDF, stessa strategia) e non si modificano a
mano — si rigenerano con `node scripts/estrai-srd-regole.mjs <PDF> [id-capitolo]`.
Il PDF sorgente **non è nel repo** (opera di terzi, ~10 MB, `*.pdf` è in
`.gitignore`): va tenuto in locale nella root del progetto. Un capitolo si
pubblica solo dopo `node scripts/verifica-srd-regole.mjs <PDF> <id-capitolo>`,
che lo confronta con `pdftotext` — i difetti di questo parser non si vedono a
occhio: una lettera persa lascia una parola plausibile e un titolo mancato
lascia prosa in grassetto.
La verifica però **non vede la struttura delle tabelle**: un capitolo con le
colonne fuse ("11 Stoffa, carta, corda" in una cella sola) passa 10/10, perché
il testo c'è tutto e le righe restano rettangolari. Quindi ogni volta che si
tocca l'estrattore vanno **rigenerati anche i capitoli già pubblicati** e
letto il diff: è l'unico controllo che coglie questa classe di guasti.
**Tre capitoli sono serviti su più pagine** — quelli elencati in
`CAPITOLI_A_PIU_PAGINE`, che per questo sono esclusi dai `generateStaticParams`
di `[capitolo]`. Il JSON però resta **uno** in tutti e tre i casi: è importato
lato server e al browser non arriva mai, quindi a pesare è l'HTML reso —
spezzare le pagine basta, spezzare il file no. Il tetto è il glossario, 331 KB
di HTML in una pagina sola:

- **Classi**: `/srd/classi` è la scelta della classe, `/srd/classi/[classe]`
  (dodici rotte) la classe intera. Qui il taglio lo dichiara la **struttura**,
  non un corsivo: il capitolo non ha introduzione — nel PDF comincia
  direttamente col Barbaro — e ha esattamente un `h2` per classe, quindi
  `dividiClassi` sono i dodici `h2`. L'indice non ha prosa da mostrare, perciò
  porta la carta d'identità di ogni classe (`cartaClasse`: caratteristica
  primaria, Dado Vita, sottoclasse), letta **per etichetta** dentro il riquadro
  "Tratti del <classe>" — se il capitolo cambia forma la carta perde una riga,
  non inventa un dato.
- **Incantesimi** e **Oggetti magici**: lì il taglio lo dichiara **la riga in
  corsivo sotto il nome**, che è anche il solo segnale che distingue una voce
  vera da un sottotitolo qualsiasi.
  - `/srd/incantesimi` è l'elenco per livello più le regole di lancio,
    `/srd/incantesimi/[livello]` (dieci rotte, `trucchetti` e
    `livello-1`…`livello-9`) le descrizioni. Il corsivo dice il livello
    (355 `h4`, 339 incantesimi); il taglio è `dividiIncantesimi`.
  - `/srd/oggetti-magici` è l'elenco per categoria più le regole,
    `/srd/oggetti-magici/[categoria]` le descrizioni. Il corsivo dice la
    categoria (268 `h4`, 258 oggetti); il taglio è `dividiOggetti` e il registro
    delle pagine è `SEZIONI_OGGETTI`. Gli oggetti meravigliosi sono metà del
    capitolo e stanno su due pagine (A–L, M–Z): è l'unica sezione spezzata, e
    per peso — 942 KB tutto insieme.

`src/lib/srd/index.ts` tiene il tipo del documento e il registro `CAPITOLI`, dove
il flag `pronto` dice se il JSON esiste: la sezione cresce un capitolo alla volta,
l'indice elenca anche quelli mancanti e `generateStaticParams` pubblica solo i
pronti — **tutti e dieci, da luglio 2026**: il flag resta perché la forma del
registro è quella e un domani ci saranno altre edizioni. Il testo esce come
array di span (`{s, i?, b?}`), **non** come HTML: le pagine lo rendono con
elementi React, così non c'è markup da sanificare. Vale anche per le voci di un
elenco puntato (`punti`), che sono `Span[][]` e non stringhe — negli oggetti
magici le voci sono nomi di incantesimo in corsivo, e ridurle a testo perdeva il
corsivo insieme al pallino.
L'attribuzione CC-BY (`ATTRIBUZIONE_SRD`) va resa in fondo a ogni pagina — è una
condizione della licenza, non una cortesia — e la rende il componente condiviso
`src/app/srd/attribuzione.tsx`: stava ricopiata in fondo a otto template, e una
riga che la licenza impone su tutte le pagine non deve dipendere dal fatto che
chi aggiunge la nona se ne ricordi. Il testo **non è scritto a mano**: si legge
dal JSON delle informazioni legali, perché la copia battuta a tastiera divergeva
dall'originale in cinque punti (apostrofi e virgolette dritti al posto dei
tipografici) — in una dichiarazione di licenza la parola giusta è quella del
documento, non una plausibile. Se quel paragrafo sparisce dal JSON il build si
ferma con un errore esplicito, invece di pubblicare 43 pagine senza attribuzione.

**Le informazioni legali** (`/srd/informazioni-legali`, pagina 1 del PDF) sono i
termini con cui l'SRD è concesso in licenza, e passano dallo stesso estrattore
per la stessa ragione per cui ci passano i capitoli: il testo di una licenza si
estrae, non si ricopia — una parola diversa dall'originale, lì, è un problema
legale e non un refuso. **Non stanno in `CAPITOLI`** e hanno un caricatore
proprio (`caricaInformazioniLegali`): dentro il registro sarebbero un capitolo di
regole nell'indice e, peggio, `[capitolo]` ne servirebbe una seconda copia a un
altro indirizzo. Ci si arriva dall'attribuzione in fondo a ogni pagina, che è il
punto in cui viene da chiedersi con che licenza, di preciso. Due dettagli che
sono guardie:

- `senzaTitoli` nell'estrattore e `SENZA_TITOLI` nel verificatore **dichiarano**
  l'unico documento in cui zero titoli è il risultato giusto (l'unico rosso è il
  titolo di pagina, che diventa il titolo del documento). La guardia "zero titoli
  = rosso non riconosciuto" resta così accesa per tutti gli altri, invece di
  essere allentata per comodità; e chi un domani ne aggiunge un secondo se ne
  accorge da una verifica che fallisce, che è il verso giusto in cui sbagliare.
- Gli indirizzi web diventano link con `collegaIndirizzi` (`blocchi.tsx`), che è
  un `Rimandi` come gli altri ma **non** è una proprietà di `Blocchi`: nei dieci
  capitoli di regole non compare un solo "http". La punteggiatura finale resta
  fuori dall'href — nell'SRD gli indirizzi chiudono la frase, e un link che c'è e
  si apre su un 404 è il modo peggiore di sbagliare. Un URL è poi un token che il
  browser non sa dove mandare a capo, quindi il link porta anche `srd-indirizzo`
  (`overflow-wrap: anywhere`): senza, a 390 px la pagina scorreva in orizzontale.

**Mostri** (`/srd/mostri`, `src/lib/srd/mostri.ts`): il bestiario, e **non è un
capitolo**. Le 331 schede vivono in `public/app/srd-mostri.js` — lo stesso file
che carica l'app del DM, `window.SRD_MONSTERS` — e il sito lo LEGGE di lì con un
`readFileSync` a build time, invece di generare un `mostri.json` suo dal PDF.
Due file dallo stesso PDF sarebbero due copie, e questo repo l'ha già pagato una
volta (l'attribuzione CC-BY ricopiata a mano, divergente in cinque punti): due
copie si allontanano da sole, e chi rigenera il bestiario per l'app non ha modo
di sapere che il sito ne tiene un'altra. Per questo i mostri **non stanno in
`CAPITOLI`** (quel registro elenca i capitoli in `capitoli/*.json`, e
`[capitolo]` proverebbe a caricarne uno che non esiste) e hanno pagine loro.
- Il taglio è **per tipo di creatura** (`TIPI_CREATURA`), che è la
  classificazione dichiarata dalla riga sotto il nome ("Aberrazione Grande, …")
  e il modo in cui un GM cerca. Come per gli oggetti magici, due tipi si spezzano
  **solo per peso** (`SEZIONI_MOSTRI`, sedici sezioni su quattordici tipi): a
  pesare è il numero di schede (~4,6 KB di HTML l'una), e servite intere Bestie
  faceva 578 KB e Draghi 458, contro i 347 del glossario che è il tetto noto.
  Bestie si spezza A–L / M–Z (i nomi coprono l'alfabeto); Draghi no — 40 su 45
  cominciano per "D" — e lì il taglio è il **grado di sfida**, che per un drago è
  l'età. Un criterio unico per forza avrebbe rotto uno dei due.
- **`sezioneDi`/`hrefMostro`** sono l'unico posto che sa dov'è finito un mostro:
  l'indirizzo di una scheda non si costruisce a mano, per la stessa ragione delle
  ancore qui sotto. L'indice `/srd/mostri` **fa fallire la build** se una scheda
  non ha un tipo noto (`mostriSenzaTipo`): 331 pubblicate devono restare 331, e
  una creatura che sparisce da un bestiario non rompe niente — sembra funzionare.
- Le schede sono **di lettura**, non di modifica (l'app ha già la versione a
  campi, `statblockHTML` in `public/app/mostri.js`): stesse etichette, così chi
  passa dall'una all'altra si ritrova. I nomi in grassetto di tratti e azioni,
  persi nell'estratto piatto, si ricostruiscono dal punto fermo (`vociDi`): il
  tetto a 60 caratteri separa 1348 casi da 1 (misurato), e il caso perso resta
  prosa intera invece di uscire con mezza frase in grassetto.
- **Nella ricerca sì, nei rimandi no** (`ancoreMostri`, separata da
  `tutteLeAncore`): chi cerca "goblin" al tavolo lo cerca nella ricerca
  trasversale, ma un «Vedi anche "…"» dell'SRD cita regole, non creature. A
  imporlo sono tre nomi — Druido, Mago, Mosca gigante — oggi univoci come titolo
  e quindi resi come link: buttare le schede nella stessa mappa li renderebbe
  ambigui e quei tre link sparirebbero, un guasto che non fallisce nessuna build.

**Il registro delle ancore** (`src/lib/srd/ancore.ts`) dice, per ognuno dei 1530
titoli, l'indirizzo della pagina che lo serve: **un id di titolo non basta a
costruire un link**, perché tre capitoli stanno su più pagine e a decidere quale
porti quale titolo sono i divisori, non l'id del capitolo. Per questo il registro
si costruisce facendo girare `dividiClassi`/`dividiIncantesimi`/`dividiOggetti`,
gli stessi che usano le pagine: una tabella scritta a mano sarebbe una seconda
verità, e il giorno che si spezza un altro capitolo il link atterrerebbe sulla
pagina giusta ma in cima, senza agganciare niente — che è il modo peggiore di
rompersi, perché sembra funzionare. Le classi sono il caso da tenere a mente:
l'h2 di una classe **è** la pagina (`[classe]/page.tsx` non lo rende), quindi il
suo href non ha frammento. Ne vivono due cose:

- **La ricerca trasversale** (`/srd`, `cerca.tsx`) sui titoli di tutti i
  capitoli. L'indice è servito da `/srd/ancore.json` — una route handler
  `force-static`, quindi un asset e non una funzione — e si scarica **alla prima
  interazione col campo**, non al caricamento: chi apre /srd per scegliere un
  capitolo non paga niente, chi cerca paga 82 KB (21 gzip) una volta sola e poi
  li ha in cache. Stessa ragione per cui il bestiario è un file a sé.
  L'etichetta di un risultato è la **pagina**, non il capitolo: senza, i dodici
  "Livello 4: Aumento dei punteggi di caratteristica" sarebbero dodici righe
  identiche. Il tetto dell'elenco è `min(26rem, 60vh)` e il `vh` non è
  decorativo — il rem di questo sito scala con la *larghezza*, quindi su un
  telefono coricato 26rem sono più alti dello schermo.
- **I rimandi «Vedi anche "…"»** resi come link (89 blocchi del glossario, 129
  link). Le posizioni arrivano sul **testo piatto** del blocco e `blocchi.tsx` le
  riproietta sugli span, perché il rimando li attraversa sempre: «Vedi anche» è
  in corsivo e i termini no, in 90 casi su 90. Due regole a decidere dove punta:
  il rimando cita prima il capitolo e poi la sezione (`Vedi anche
  "Equipaggiamento" ("Armi")`), e quel capitolo è un **vincolo, non un
  suggerimento** — senza, "Armi" finiva negli oggetti magici, dove pure esiste;
  e il suffisso fra quadre non fa parte del nome, che il glossario intitola
  "Afferrato [condizione]" e il rimando cita "Afferrato". Fuori da un contesto
  dichiarato si collega solo ciò che è univoco in tutta la sezione: un link alla
  voce sbagliata è peggio di un rimando che resta testo. **41 termini su 170
  restano testo** ed è corretto così: 32 sono titoli di sezione stampati sulle
  tavole illustrate del PDF (pp. 5, 6, 12, 16, 118: `pdffonts` dice zero font),
  quindi non esistono come testo in nessun capitolo — ma il nome del capitolo
  accanto è comunque un link, e il rimando porta comunque da qualche parte.

Nel PDF la semantica sta nei font, non nel testo (come per il bestiario): il rosso
a taglia 39/27/21/18 sono i livelli di titolo, Cambria = prosa, GillSans = celle
ed elenchi. Trappole già pagate:

- Gli id dei fontspec sono **cumulativi nel documento** (mai azzerarli a ogni pagina).
- Il **rientro non separa i paragrafi**: il documento alterna rientro sospeso e
  rientro di prima riga, a volte nella stessa pagina, quindi si rompe sul
  grassetto di apertura e sul salto verticale. Il salto è stretto
  (`PASSO_RIGA`, 22px contro i 18–19 di una riga): il PDF stacca la riga in
  corsivo che dichiara livello, categoria o rarità con appena 23px, e con la
  soglia a 23 si incollava alla descrizione. Su 212 casi nel PDF nessun salto da
  23 prosegue una frase — è la misura ad aver fissato il numero, non l'occhio.
- **I colori non si confrontano per uguaglianza.** Lo stesso rosso è uscito
  `#88191f` e poi `#8b2321` da un PDF riscaricato: il codice esatto dipende da
  come poppler quantizza, non dal documento. Si riconoscono per *relazione tra i
  canali* (`rossoTitolo`, `grigioServizio`) — con la costante sbagliata un
  capitolo perde TUTTI i titoli e il JSON esce plausibile.
- **I font sono subsettati e mettono la "f" nella Private Use Area** quando fa
  parte di una legatura che il font compone da sé: "effetto" è `e` + U+E01D
  U+E01D + `etto`, con quattro codici diversi per la stessa lettera. La mappa
  `PUA` li scioglie e `PUA_IGNOTI` fa fallire lo script su un codice nuovo,
  invece di lasciare "eetto" — una parola plausibile con una lettera in meno,
  invisibile in un diff.
- Le legature (ﬁ, ﬂ, ﬃ) si sciolgono **in uscita**, non all'estrazione: durante
  il parsing sono il segnale che distingue una parola spezzata da due frasi
  accostate. Per lo stesso motivo `slug` normalizza in **NFKD** e non NFD.
  Restando intere fino alla fine, però, ogni test su "minuscola" deve
  comprenderle — sono minuscole ma non stanno in `[a-z]`. Le due classi
  condivise sono `SILLABATA` e `PROSEGUE`, e servono **entrambe**, perché il PDF
  spezza la riga sia prima della legatura ("modi-" / "ﬁcatore") sia dopo
  ("modiﬁ-" / "catore"): senza, la sillabazione non si ricuciva e usciva
  "modi- ficatore", una parola con dentro uno spazio e un trattino.
- **Il nome di una definizione può stare a cavallo di due righe.** Il grassetto
  di apertura è il solo delimitatore affidabile di paragrafo, ma pretendere il
  punto finale sulla PRIMA riga perdeva la rottura ogni volta che il nome è
  lungo: in Incantesimi «Usando uno slot di livello supe-» / «riore.» apriva 97
  blocchi intitolati `riore`. I due ruoli sono separati — `apreDefinizione`
  insegue la corsa di grassetto in avanti per decidere dove spezzare, `chiudi`
  promuove il paragrafo a `def` quando il grassetto è completo. Un grassetto che
  apre in minuscola non è mai un nome: è la coda di una sillabazione.
- **Una tabella può non avere didascalia.** Dentro le descrizioni degli
  incantesimi le annuncia la prosa («consultando la tabella sottostante») e la
  struttura la dichiara la sola riga di intestazione. Si accettano prima di
  `grigliaLibera`, che altrimenti le riduce a coppie chiave/valore rimescolate.
  Il discriminante contro le griglie chiave/valore vere (le schede delle
  creature evocate: `CA | 15`, `PF | 10…`) è che una tabella intitola le colonne
  **una volta sola**: se il grassetto ricompare più in basso è una colonna di
  chiavi, non un'intestazione.
- **Il font delle intestazioni non basta a riconoscere un'intestazione**: le
  celle si aprono con un attacco in grassetto nello stesso font («1 | *Rosso.*
  Tiro salvezza fallito…»). Il discriminante è il **punto finale** — un titolo
  di colonna non ce l'ha, un attacco di cella sì — escludendo i puntini di
  sospensione, che un titolo può avere («…in maniera...» in Scrutare). Vale in
  entrambi i sensi: quei frammenti non sono intestazioni **e** sono celle, e
  fermare lì la raccolta chiudeva «Strati prismatici» dopo una riga sola.
  La regola per riga visiva («l'intestazione finisce dove la riga non si apre
  nel font dei titoli») è stata provata e scartata: distrugge «Terreno di
  viaggio», dove metà dei titoli è in GillSans normale — e il verificatore dava
  10/10 lo stesso.
- **Lo stesso font sta anche DENTRO le celle**, e non solo in testa: negli
  oggetti magici il PDF ci compone le chiavi degli elenchi annidati («…tirando
  un 1d10: con **1**, *allucinazione*; con **2**, *folata di vento*») e i nomi
  delle creature («45–51 | **Un cavallo da galoppo** dotato di sella»). A
  decidere è la **distanza**, non il font, e in due punti diversi: a metà riga
  il grassetto si ricuce col resto (`proseguiIlRuolo` — il ruolo di una riga lo
  dichiara il frammento che la apre), a inizio riga è una cella se è
  **attaccato** a del testo normale (`dentroUnaCella` in `tabella`, soglia
  `ATTACCATI`). La ricucitura vale in **una direzione sola**, e l'ha detto la
  misura: dei 1671 frammenti attaccati con ruoli diversi, 1602 sono nell'altro
  verso — gli attacchi di cella e le etichette delle schede, che devono restare
  righe a sé perché è il punto finale a qualificarli. E «c'è del testo normale
  sulla stessa riga», senza il vincolo di distanza, è stato provato e scartato:
  prende le griglie a chiave grassa dei tratti di classe («Caratteristiche
  primarie | Forza»), dove il valore sta in un'altra colonna.
- **Non tutto ciò che sembra una tabella lo è.** I riquadri a coppie
  etichetta/valore (gli strumenti di Equipaggiamento, e domani le schede
  incantesimo) affiancano due coppie sulla prima riga per risparmiare carta:
  il rilevatore di colonne ci leggeva due colonne e ci incolonnava anche le
  righe di continuazione, che sono prosa andata a capo. Escono come blocco
  `scheda`, riconosciuto **prima** di `grigliaLibera` e non per geometria ma
  per font: etichetta = intestazione di cella (GillSans-SemiBold 14) coi due
  punti finali, valore = GillSans normale. Le ascisse non servono, perché le
  righe arrivano già in ordine di lettura — così il riquadro si ricompone anche
  quando prosegue nella colonna successiva.
- **Nemmeno un riquadro di formula è una tabella.** "CD del tiro salvezza
  sull'incantesimo = 8 + il modiﬁcatore…" è una frase sola impaginata su tre
  righe centrate, e ha la stessa geometria di una tabella a due colonne:
  `tabella` e `grigliaLibera` se la prendevano e ne incolonnavano le righe di
  continuazione. La riconoscono due segnali insieme (`riquadroDiProsa`, prima
  delle griglie): la **composizione centrata** — ogni riga visiva ha lo stesso
  asse e i bordi sinistri no, mentre una griglia è allineata a sinistra dentro
  le sue colonne — e il **grassetto che intitola una volta sola**, che qui deve
  anche aprire una riga visiva. Il primo da solo non basta (anche la tabella
  "Taglia | Acqua" del glossario è centrata), il secondo nemmeno. Due riquadri
  di fila si spezzano sul grassetto: è come li impagina "Creazione del
  personaggio", dove stanno a due a due nello stesso blocco di righe.
- **I valori numerici sono allineati a destra**, quindi un frammento comincia
  prima della colonna che l'intestazione dichiara ("17,5 kg" a x=319 sotto un
  "Peso" a 330). `indiceColonna` riceve anche la larghezza e lo sposta alla
  colonna dopo quando comincia *più vicino* al suo inizio che a quello della
  colonna in cui cadrebbe. Regole più larghe sono state provate e scartate: "il
  centro è già oltre" sposta ogni etichetta più larga di mezza colonna, e
  pretendere che il frammento non sfondi la colonna dopo blocca proprio le
  celle fuse che devono spostarsi ("32,5 kg 1.500 mo").
- **Una coda è una tabella a cui è finito lo SPAZIO**, non una tabella che cambia
  pagina: il PDF ne ripete l'intestazione senza la didascalia, e quel blocco
  fermava la raccolta delle celle. Si riconosce dalle stesse intestazioni più due
  condizioni che servono entrambe: le celle di prima chiudono la loro colonna di
  pagina e le intestazioni ripetute ne aprono un'altra — e non lo dice un numero
  di pixel ma le righe stesse, che sopra e sotto non ne hanno altre in quella
  colonna. In "Azioni" le intestazioni si ripetono a metà della colonna destra,
  con della prosa sopra, e lì comincia una tabella nuova. La coda va poi
  **traslata**: può ricominciare in un'altra colonna, e lo scarto lo dà la
  posizione delle intestazioni ripetute.
  Il vincolo "solo a pagina nuova" è stato provato e ritirato: spezzava "Monili"
  (un d100 che riprende due volte nella colonna accanto) in quattro tabelle, e
  con lui restavano rotti "Strati prismatici", "Esempi di tiri salvezza" e
  "Azioni", dove il testo delle due metà usciva interlacciato cella per cella.
- **L'ordine di lettura di una griglia è per colonna di pagina, poi per top**
  (`grigliaDaFrammenti`): una coda ricomincia in cima alla colonna successiva,
  quindi le sue righe hanno un top piccolo e con la sola coppia pagina+top
  risalivano in mezzo alle prime. Per la stessa ragione due frammenti sono la
  stessa riga solo se stanno nella stessa colonna (`stessaColonna`): alla stessa
  altezza, nelle due colonne di una pagina, ci sono due righe diverse.
- **Il rientro segnala una continuazione solo se in quella tabella distingue
  qualcosa.** Dove ogni colonna è centrata o allineata a destra ("Avanzamento dei
  personaggi": sotto "Livello" c'è "1", sotto "Punti esperienza" c'è "0") tutte
  le celle cominciano dopo l'inizio della loro colonna, e il criterio mangiava la
  tabella intera — quindici righe impilate in una. Lo dice la **prima riga di
  dati**, che non può essere il seguito di niente: se è rientrata anche lei, lì
  il rientro è impaginazione.
- **La didascalia può andare a capo** ("Incantatore multiclasse:" / "slot
  incantesimo per livello di incantesimo"): la seconda riga è nel font delle
  didascalie, non in quello delle intestazioni, e finiva fra i titoli di colonna
  — un frammento largo quanto la tabella, che li fondeva tutti in uno. Va a capo
  e non di fianco: due didascalie sulla stessa riga visiva sono due tabelle
  affiancate (Temperatura e Vento in *controllare il clima*), e nel PDF i due
  casi sono uno per tipo.
- **Le righe di sezione dentro una tabella** ("Armatura leggera (1 minuto per
  indossare o togliere)") si riconoscono dal **corsivo**, non dalla geometria:
  "sola sulla riga" le confonde con le celle davvero fuse, che invece vanno
  divise. Il verificatore non le conta fra le celle mancanti — erano 46 su 52 in
  Equipaggiamento e nascondevano i buchi veri.
- **Le colonne di una tabella le dichiarano le intestazioni, non le celle**, e si
  raggruppano per *sovrapposizione* degli intervalli, non per ascissa: i titoli
  sono pochi, spesso centrati e spezzati su più righe (che così si ricompongono),
  mentre le celle hanno ascisse sparse — i numeri sono allineati a destra, e ogni
  ascissa in più diventava una colonna in più ("0,5" e "kg" in due colonne).
  Le celle servono solo a **raffinare** un gruppo, quando il PDF fonde due titoli
  in un frammento solo ("CA Materiale" sopra i numeri E i materiali). Il confine
  si adotta a tre condizioni, e servono tutte: sotto il gruppo devono esserci
  **almeno due** colonne di celle (una sola vuol dire che il gruppo è già una
  colonna con le celle spostate — "Distanza degli incontri" a x=335 coi suoi dati
  a x=359), e il titolo deve avere **uno spazio dove spezzarsi** ("CA Materiale"
  sì, "Peso" no). La geometria da sola non basta: "Peso" sopra "0,5"/"kg" e "CA
  Materiale" sopra "11"/"Stoffa" sono indistinguibili, e a decidere è il titolo.
  Terza condizione, se il gruppo è coperto da **un solo** frammento: ogni pezzo
  che ne esce deve poter essere un titolo, cioè cominciare per maiuscola o cifra
  ("Capacità di trasporto" no — lasciava una colonna vuota e una intitolata "di
  trasporto"). Solo col frammento unico: quando i titoli sono più d'uno le
  sottocolonne sono dichiarate, e sopra ci passa un raggruppamento che le
  scavalca ("Distanza percorsa ogni…" sopra Minuto e Ora).
  Le **parentesi** invece valgono sempre, quanti che siano i frammenti: in un
  titolo sono bilanciate, quindi un taglio che ne lascia una spaiata è sbagliato
  per costruzione. Serve perché un titolo può essere impilato su due righe —
  "1d100" sopra "(Mazzo da 13 carte)" sono due frammenti, quindi la guardia
  sulle maiuscole non scatta — e sotto ci sono sia i trattini centrati sia gli
  intervalli allineati a sinistra, cioè la geometria di "Peso" con "0,5" e "kg":
  la colonna si spaccava fra "(Mazzo da" e "13 carte)" e il Mazzo delle
  meraviglie collassava in una riga sola.
  Il titolo si assegna col proprio centro, che i titoli sono centrati e i dati no. Le righe d'intestazione si raccolgono fino
  all'ultima che contiene *almeno un* frammento nel font delle intestazioni, e
  poi fino in fondo alla sua riga visiva: in "Terreno di viaggio" metà dei titoli
  è in GillSans normale come i dati.
  Quando invece il PDF fonde **tutte** le intestazioni in un frammento solo
  ("1d10 Comportamento per il turno") le colonne si deducono dalle celle, ma con
  due vincoli separati. *Quante*: le dichiara il titolo, contando le parole che
  possono esserlo (maiuscola o cifra) — il conteggio nudo ne dava cinque dove il
  titolo ne dichiara due. *Quali*: quelle con più celle sotto, tenendo comunque
  la prima, che è il margine della tabella. Tagliare in testa all'elenco delle
  ascisse non basta, perché la colonna di troppo può essere fra le prime: in
  *confusione* la chiave "1" è centrata a x=113 dentro la stessa colonna delle
  celle fuse a x=102, e quell'ascissa faceva una terza colonna senza titolo.
- **La stima proporzionale che divide una cella fusa sbaglia di una parola**
  quando la chiave è più larga della prosa ("2–6 " sono quattro caratteri larghi
  come sei), e usciva `2–6 Il | bersaglio non si muove`. `dividiCella` la
  riaggancia col solito criterio: una cella comincia per maiuscola o cifra, mai
  a metà frase, quindi se il pezzo di destra apre in minuscola si arretra di una
  parola. Vale per le celle e **non** per le intestazioni: là lo stesso test
  serve a *rifiutare* un confine sbagliato (`raffinaConCelle`, "Capacità di
  trasporto"), e agganciare il taglio glielo farebbe passare sempre.
- **Una riga che apre con una parentesi non è una voce nuova**: la parentesi
  qualifica sempre ciò che precede, quindi è la continuazione della cella sopra
  ("Cintura della forza dei giganti" / "(delle colline)", "Pozione di
  guarigione" / "(maggiore)"). Sta in `prosegue`, accanto alla minuscola.
- **Lo spazio non si mette davanti a un segno di chiusura**, e non solo
  ricucendo i frammenti: anche quando due righe finiscono nella stessa cella
  (`unisciNellaCella`). Il PDF stacca il frammento al cambio di font, quindi un
  nome di creatura in grassetto e il suo punto e virgola arrivano separati e
  uscivano "elefante ;". Parentesi aperte e virgolette basse restano fuori: lo
  spazio davanti lo vogliono.
- **Una cella fusa può coprire più di due colonne.** Nelle tabelle di
  avanzamento degli incantatori il PDF emette lo slot e tutti i trattini che lo
  seguono in un frammento solo ("2 — — — — — — — —", da x=597 a x=815, sopra
  nove colonne): `dividiCella` stima un confine per volta e la riga usciva con
  un valore e sette celle vuote. `dividiSuColonne` non stima niente — divide
  solo se il **conto torna**, cioè se le parole sono tante quante le colonne
  coperte, e allora la corrispondenza è un'identità. Quando non torna la cella
  resta fusa: è la condizione che rende la regola innocua.
- **La pagina non è a due colonne: è a fasce.** Una tabella a piena pagina
  attraversa la separazione fra le colonne di testo e spezzarla a metà la
  distruggeva. La riconosce un frammento che **invade il corridoio vuoto** fra
  le colonne (`GUTTER`, 435–470): sono margini tipografici, non stime — sui
  39.077 frammenti del documento nel mezzo ne cadono 37, tutti in tabelle a
  piena pagina. Chiedere invece che il frammento *scavalchi la mezzeria*
  (x=440) è stato provato e non basta: "Privilegi del bardo" ha quattordici
  colonne e nessuna cella che ci passi sopra, e usciva tagliata in due —
  quattro colonne da una parte e le altre dieci lette per colonnine come un
  elenco. L'ordine di lettura si calcola per fascia (`bandeFullWidth`,
  `fasciaDi`), sennò la tabella esce prima della prosa che la introduce.
- **La banda si propaga alle righe contigue con un ruolo da tabella** — così ci
  rientrano didascalia e intestazioni, che stanno sopra il primo
  attraversamento — **ma non deve scavalcare le righe dove la pagina è a due
  colonne davvero.** All'apertura di ogni classe il riquadro "Tratti del
  <classe>" è una tabella alta mezza pagina nella colonna sinistra, con la
  tabella dei privilegi sotto: le sue righe hanno tutte un ruolo da tabella e
  distano meno di `SALTO_BANDA` l'una dall'altra, quindi la banda risaliva fino
  in cima e le due colonne uscivano interlacciate riga per riga ("Dado Vita |
  D10 per ogni livello da guerriero cati nella tabella Privilegi del
  guerriero."). Le riconosce `righeADueColonne`, e il criterio **non è una
  distanza**: la didascalia di una tabella a piena pagina comincia 19 px sotto
  la prosa e le ultime righe di quel riquadro ne distano 18: tarare lì sarebbe
  tarare sul rumore. È la **continuità** — una riga prosegue ciò che ha sopra
  nella sua colonna, quindi eredita; una didascalia no, perché apre una tabella
  e non è mai il seguito di niente. Le righe si contano **dentro** la colonna:
  raggrupparle per sola ordinata a cavallo del gutter fondeva le due colonne
  affiancate in una riga sola, che sembrava larga quanto la pagina — cioè
  esattamente ciò che si sta cercando di escludere.
- **Si ordina per riga visiva, non per top esatto** (`TOLLERANZA_RIGA`): il top è
  la posizione del glifo, e apici e frazioni la spostano di un paio di pixel —
  "Passo veloce" (199), "= Chilometri al giorno × 1" (201) e "⅓" (199) sono una
  riga sola, e ordinando per top la frazione scavalcava la formula.
- Le note a piè di tabella (le legende di `*` e `†`) escono dalla griglia come
  paragrafi: si riconoscono dalla forma (molto meno piene delle righe sopra) e
  non dal marcatore, che l'ordine dei frammenti può spostare in coda. Il
  confronto è largo (`>=` metà colonne) perché in una tabella a doppia colonna
  con voci dispari l'ultima riga ne riempie esattamente metà ed è un dato.

**Costanti pubblicate** (email di contatto, URL donazioni, URL repo): una sola
definizione in `src/lib/site.ts`, mai hardcodate nelle pagine.

## Invarianti di sicurezza

Non negoziabili; se tocchi queste aree, mantienili:

- **JSON dentro `<script>` inline**: sempre tramite `jsonForScript()`
  (`src/lib/inline-json.ts`), mai `JSON.stringify` nudo — un titolo di bolla contenente
  `</script>` diventerebbe XSS.
- **Il tavolo dei giocatori filtra sul server** (`src/lib/share.ts`): ai giocatori esce
  solo ciò che `projectForPlayers` costruisce esplicitamente (`shared === true`, campo
  `playerNotes` separato dalle note DM). Mai spedire lo stato completo e nascondere lato
  client.
- **I collegamenti riservati al DM non escono** (`DM_ONLY_EDGES` in `src/lib/share.ts`):
  oggi il tipo `segreto`. Il filtro sulle estremità visibili non basta — due bolle
  rivelate e collegate da un passaggio segreto ne mostrerebbero l'esistenza e
  l'etichetta. Il flag `dmOnly` in `EDGE_TYPES` (`public/app/modello.js`) serve solo
  a dirlo nel pannello: a decidere è il server, e i due elenchi vanno tenuti allineati.
  Le porte del perimetro derivato seguono da sé: il client le ricava dagli archi che
  ha in mano, quindi un arco che il server non manda non apre nessun muro. Un
  `segreto` non apre il muro nemmeno per il DM (lascia un segno sopra la parete):
  così non c'è un buco la cui assenza al tavolo vada spiegata, e la regola resta
  una sola.
- **Una porta segreta esce come muro pieno** (`DM_ONLY_DOORS` in `src/lib/share.ts`,
  allineato a `DOOR_TYPES` in `public/app/modello.js`): il segmento parte lo stesso,
  ma senza il campo `porta`. È DM_ONLY_EDGES visto dall'altro lato — lì il dato
  sparisce, qui deve restare, perché toglierlo aprirebbe nel perimetro un buco che è
  esattamente l'informazione da nascondere. I tipi ammessi si dichiarano (`DOOR_KINDS`)
  e non si deducono: chi aggiunge un tipo al client lo vede sparire al tavolo finché
  non aggiorna anche il server, che è il verso giusto in cui sbagliare.
- **I riferimenti si risolvono sul server**: l'ordine d'iniziativa e le pedine puntano
  a nodi (`nodeId`, `foeId`, `playerId`); `projectBattle`/`nomePedina` in `share.ts` ne
  fanno uscire solo il **nome**. Spedire il riferimento consegnerebbe ai giocatori gli
  id di nodi che non possono vedere. Dei mostri esce `down`, mai un PF né la Destrezza.
- **Il JSON importato è untrusted anche nell'app del DM** (`sanitizeState` in
  `public/app/modello.js`, chiamata da `migrateState`): forma valida non vuol dire
  contenuto sicuro. `img`/`bg.img`/`color`/`id` finiscono dentro attributi HTML nei
  render (`src`, `style`, `onclick`, `data-block`) e `escapeHtml` non li copre — un
  `img:'x" onerror=…'` o un `id:"');…//"` in una campagna altrui sarebbe XSS
  nell'origine del sito. Le regole (`safeId`/`safeColor`/`safeUrl`) sono le stesse di
  `share.ts`: client e server devono concordare su cosa è un valore sicuro. `safeId`
  va applicato a un id **e** a ogni riferimento che lo punta (edge.a/b, playerId,
  foe.\*, order.\*), sennò i lookup `x.id===ref` si disallineano.
- **Ogni route API verifica** che la campagna appartenga all'utente autenticato.
- **Password**: scrypt della stdlib con `maxmem` esplicito (`src/lib/password.ts`);
  token di reset monouso, scadenza 1h, nel DB solo lo SHA-256; la richiesta di reset
  risponde sempre allo stesso modo, che l'account esista o no.
- **Due licenze, e vanno in versi opposti** (29 lug 2026). Il **codice** è
  `PolyForm Noncommercial 1.0.0` — vieta l'uso commerciale — e prima di quella
  data era MIT: quella concessione resta valida per le versioni già
  distribuite, quindi il `LICENSE` lo dichiara invece di far finta di niente.
  I **contenuti SRD** (schede mostro, capitoli, informazioni legali) sono
  **CC-BY-4.0**, che l'uso commerciale invece lo *permette*, e questo repo non
  lo restringe: l'attribuzione va mantenuta ed è una condizione della licenza,
  non una cortesia.
  - Il nome della licenza del codice, come va scritto agli utenti, sta in
    `CODE_LICENSE` (`src/lib/site.ts`) e **non** nelle pagine: una pagina che
    ne dichiara una diversa da `LICENSE` non è un refuso, è una concessione
    pubblica che nessuno voleva dare.
  - Il testo della licenza in `LICENSE` è **identico byte per byte** a quello
    ufficiale di PolyForm: la nota d'ambito (il codice sì, l'SRD no) sta fuori
    dal testo e dichiara di starne fuori. Vale la regola già scritta per
    l'attribuzione SRD — il testo di una licenza si prende dalla fonte, non si
    ricopia, perché lì una parola diversa è un problema legale e non un refuso.

## Trappole note

- Le sessioni sono JWT (requisito del provider Credentials): non revocabili lato server.
- Il rate limiting (`src/lib/rate-limit.ts`) è in memoria, per processo.
- Non usare `npx auth secret` per generare `AUTH_SECRET`: quel pacchetto è la CLI di
  better-auth, non di Auth.js. Vedi `.env.example` per il comando giusto.
- **Il colore di una bolla lo decide solo `nodeColor()`** (`public/app/modello.js`):
  scelta esplicita del DM (`color`, hex — non segue il tema, è voluto), poi il default
  della forma (`SHAPE_COLORS`) o del tipo (`TYPES`, per i segnalini). Non ricalcolarlo
  a mano nei render: era sparso in quattro punti e i default per forma non esistevano.
  Il vecchio campo `tokenColor` è migrato da `migrateState`, ma `share.ts` deve
  continuare a leggerlo finché ci sono campagne mai risalvate nel JSONB.
- **Niente doppio clic nativo sulla tela**: `renderCanvas()` riscrive `svg.innerHTML`
  a metà sequenza di input e distrugge il nodo del pointerdown, quindi il browser non
  sintetizza `click` e l'evento `dblclick` non arriva mai (un listener così è rimasto
  morto a lungo). I doppi clic si contano a mano: `lastTap` sui blocchi, `lastBgTap`
  sullo sfondo. Stessa trappola del focus da tastiera, già commentata in `mappa.js`.
- **`#empty-node` copre l'intera tela** (`inset:0`): il suo `pointer-events:none` non
  è cosmetico: senza, un livello vuoto non riceve né drop dalla palette, né tocchi,
  né doppi clic. Se aggiungi elementi cliccabili lì dentro, ridagli `pointer-events:auto`.
- **Le scorciatoie della mappa non possiedono Invio, Spazio e Canc**
  (`scorciatoie.js`, 28 lug 2026): quei tasti appartengono al comando che ha il
  focus. Il filtro copriva `input/textarea/select` e si fermava lì, quindi su un
  bottone del pannello Invio entrava nella bolla selezionata e Canc la
  cancellava — un comando raggiunto con Tab si poteva mettere a fuoco e **non
  premere**. La palette si era difesa da sola con uno `stopPropagation()`
  (`mappa.js`, "arma e tocca"), che è il segno che la toppa andava alla
  sorgente: una toppa per elemento vuol dire che ogni elemento nuovo nasce
  rotto. La **tela è esclusa** dal filtro apposta — bolle e muri hanno
  `tabindex` e `role=button`, ma lì quei due tasti li vuole proprio quell'elenco;
  frecce, zoom, F ed Esc restano globali, che non sono tasti che un comando
  consuma.
- **Con un dialogo aperto la pagina sotto è inerte**: le scorciatoie escono
  subito su `dialog[open]` (in quest'app i sei dialoghi sono tutti `showModal()`,
  quindi `[open]` implica modale). Senza, l'Escape che chiude il dialogo
  proseguiva e deselezionava anche la bolla: il pannello si ridisegnava e il
  ritorno del focus garantito da `showModal()` veniva disfatto un istante dopo.
  È la stessa guardia che c'era già per `#ctx-menu`.
- **Un modale si fa con `<dialog>` e `showModal()`**, non con un `<div>` e una
  classe: Escape, la trappola del focus e il ritorno del focus a chi ha aperto
  li dà il browser. Il lightbox delle immagini è stato l'ultimo a passare (28 lug
  2026): da `<div>` si apriva solo col mouse — il trigger era un tag immagine con
  un `onclick`, che non prende il focus — e una volta aperto non si chiudeva più
  da tastiera. Il trigger va reso un `<button>`, sennò il modale è a posto e
  irraggiungibile.
- **Un `aria-label` sul bottone copre l'`alt` dell'immagine che contiene**
  (29 lug 2026): la miniatura di riferimento nel pannello sta dentro il bottone
  che apre il lightbox, quindi il suo `alt` non viene annunciato — a nominare
  la bolla dev'essere l'etichetta del bottone. L'`alt` conta comunque in due
  casi, ed è il motivo per cui `nomeImmagine` (`pannello.js`) lo scrive in tre
  punti: nel lightbox l'immagine non sta in nessun bottone, e nel pannello è
  ciò che si legge quando l'immagine non carica (un base64 troncato da un
  import), dove un `alt=""` lascerebbe un bottone vuoto. Regola generale:
  correggere un `alt` che nessuno legge è un diff che sembra una correzione
  d'accessibilità e non cambia una parola di ciò che si sente.
- **`prefers-reduced-motion` va dichiarato DUE volte**: `src/app/globals.css`
  per il sito e `public/app/app.css` per l'editor. `app.html` carica soltanto
  `themes.css` e `app.css`, quindi la regola del sito non lo raggiunge — e
  l'editor è la metà dove il movimento si vede davvero (il pannello dettagli che
  sale dal fondo su mobile). Vale per ogni regola d'uso, non solo per questa: i
  *colori* hanno una sorgente unica (`themes.css`), le *regole* no, ed è così
  che le due metà si allontanano in silenzio.
  **`pointer:coarse` era lo stesso caso e si era già allontanato** (corretto il
  29 lug 2026): l'editor aveva i bersagli da 44px da tempo, il sito **nessuna**
  regola. Ora `globals.css` ne ha una per `.btn`, `.tab` e `.linkbtn`.
- **I bersagli da 44px si dichiarano per RUOLO, non per classe.** La regola
  dell'editor cresceva elencando classi (`.btn`, `.icon-btn`, `.hp-btn`,
  `.pal-item`), quindi ogni comando che non ne portava una nasceva sotto soglia
  in silenzio — e la falla più larga erano i **campi**, che non erano nominati
  affatto: `input:not([type=checkbox]), select, textarea` è la riga che
  mancava (`#campaign-select` stava a 120×29, `input.ini-num` a 38×24). Le
  caselle di spunta restano a 24 ed è un'eccezione dichiarata: il `:not()`
  serve a non ribaltarla. Chi aggiunge un comando **misuri col dito emulato**
  (`hasTouch` in Playwright): senza, `pointer:coarse` non scatta e si misura un
  telefono che non esiste.
  - **Il rovescio della regola: un bersaglio più piccolo di quel che si vede**
    (31 lug 2026). In una striscia che non va a capo i figli si restringono per
    difetto, e un bottone schiacciato a `min-width:44px` tiene la sua etichetta
    **fuori** dal bordo: 44px di bersaglio sotto ~100px di scritta, cioè toccare
    la parola non fa niente. `.pal-item` aveva `flex:none`, i bottoni della
    barra no. Chi mette un comando dentro un contenitore `flex-wrap:nowrap` gli
    dia `flex:none`, sennò i 44px sono veri e inutili.
- **La barra della mappa sono DUE strisce su telefono** (`#pal-scroll` e
  `#plan-cmds` in `app.html`, 31 lug 2026): la palette è roba da **posare**, i
  comandi (Ordina, Adatta, righello, aree d'effetto, ⚔ Combattimento) agiscono
  su vista e sessione. Mescolati in un unico scorrimento, ⚔ Combattimento
  stava al **pixel 2266** di una barra larga 390 — cinque schermate di palette —
  e per quattro di quei comandi su telefono non esiste un'altra via, perché le
  loro alternative sono i tasti F, R e A. Ora sono a 1,4 schermate.
  - Su scrivania i due contenitori sono **`display:contents`**, cioè non
    esistono: i figli restano diretti e la barra va a capo come sempre. È il
    modo di aggiungere una struttura che serve a un solo gradino senza toccare
    gli altri — verificato che altezza e tela restino identiche.
  - `＋` e `－` **spariscono su telefono** (`.btn.zoom`): lo zoom si fa a
    pizzico (`planDrag` mode `"pinch"`) e con la rotella. Sono gli unici due
    comandi con un gesto equivalente, quindi gli unici togliibili.
  - Al tavolo `#pal-scroll` va nascosto a parte (`html.ro`): le pastiglie sono
    già nascoste una per una, ma il contenitore vuoto si prende comunque la sua
    riga da `flex:1 0 100%`.
  L'eccezione vera sono i **link dentro la prosa**, che WCAG 2.5.8 esenta e che
  a 44px spezzerebbero l'interlinea delle pagine SRD. Un **elenco di nomi in
  colonna** però non è un link in linea: `.srd-nomi` (fino a 331 voci, il
  bestiario) stava a 24,6px di passo, cioè sopra il minimo di 24 per meno di un
  pixel, e la sua regola sta in `srd.css` accanto all'elenco.
- **"Mobile" è una soglia di LARGHEZZA, e un telefono coricato è largo**
  (`@media (max-height:480px)` in `app.css`, 29 lug 2026). Tutti i gradini
  dell'editor guardano `max-width`, e il più basso è 760px: un iPhone 14 Pro
  coricato è **852×393**, quindi prendeva il layout da scrivania su uno
  schermo alto 393 — la palette andava a capo, si prendeva 425px e la tela
  usciva alta **zero**. Chi tocca quei gradini misuri sempre anche coricato,
  col dito emulato.
  - La condizione è l'**altezza** e non l'orientamento (che è invece quella
    giusta per la fascia d'iniziativa): lì il difetto era la larghezza di un
    pannello, qui è quanto verticale mangia il cromo. 480px sta sopra ogni
    telefono coricato e sotto ogni tablet.
  - Il blocco taglia **spazio**, mai comandi: i 44px restano, e la palette
    diventa una riga sola scorrevole invece di rimpicciolirsi. Il pannello
    dettagli resta **di fianco** e non diventa un foglio dal basso — su 393px
    d'altezza un foglio al 62% rifarebbe il difetto che il blocco corregge —
    ma il suo tetto scende da 60vw a **40vw**, perché 440px fissi su 852 sono
    metà schermo. Quel tetto vale solo da 761px in su (`min-width` nella
    condizione): sotto, il pannello *è* il foglio dal basso e un tetto in vw
    lo ridurrebbe a una colonna in un angolo.
- **Il salvataggio è ritardato di 700 ms** (`save()` in `stato.js`, per non
  scrivere a ogni battitura) e a chiudere quella finestra è il `pagehide`
  registrato da `initStato`. Serve perché dall'editor si esce con un clic: il
  titolo in topbar è un link alla home. `pagehide` e non `beforeunload`, che su
  iOS non arriva, e vale per ogni modo di andarsene — link, tasto Indietro,
  scheda chiusa. In locale la scrittura è sincrona e finisce lì; nel cloud la
  PATCH viene marcata `keepalive`, che però la specifica concede solo sotto i
  64 KB — sopra resta un tentativo, non una garanzia. Non è più una perdita:
  la cache locale è già stata scritta prima della richiesta, quindi alla
  riapertura il lavoro si ripropone (vedi Revisione, cache offline e conflitti).
- Le immagini stanno in base64 dentro il JSON della campagna: occhio al limite di 4 MB.
- `package.json` ha tre **overrides npm** nati da alert Dependabot (lug 2026): postcss
  ≥8.5.10 (Next lo pinna vulnerabile), sharp ^0.35 (CVE di libvips; Next 15.5 lo vuole
  ancora ^0.34, e nel sito `next/image` non è usato da nessuna parte, quindi il rischio
  di rottura è nullo) ed esbuild ^0.25 sotto `@esbuild-kit` (dipendenza abbandonata
  trascinata da drizzle-kit). Quando Next o drizzle-kit si aggiornano, ricontrolla se
  sono diventati superflui. Se cambi gli overrides: npm NON li riapplica a risoluzioni
  già nel lockfile — va rigenerato (`rm -rf node_modules package-lock.json
  && npm install`).
- Il registro migrazioni è `drizzle.__drizzle_migrations` (schema `drizzle`, non
  `public`): il baseline `0000_iniziale` è stato inserito a mano perché il DB esisteva
  già — se `db:migrate` volesse riapplicarlo, qualcosa non va nel registro, non nello
  schema.
- Il progetto Neon (`Runebog_GM`, id `gentle-meadow-05053328`) ha **due branch**:
  `production` (default, usato dal sito su Vercel) e `dev` (usato dal `.env` locale).
  `npm run db:migrate` applica solo al branch del `DATABASE_URL` corrente: **ogni
  migrazione va applicata a entrambi**, sennò si ripete il guasto del 15 lug 2026
  (colonna `share_token` solo su dev, produzione rotta con errore 42703). Entrambi i
  branch hanno il baseline nel registro migrazioni.

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
npm run build        # build di produzione (fa anche typecheck)
```

Non ci sono ancora test. La CI (`.github/workflows/ci.yml`) esegue typecheck + build su
ogni push e PR, con `DATABASE_URL` fittizio: il client Neon viene creato all'import di
`src/db/index.ts`, quindi il build richiede la variabile anche se nessuna pagina statica
interroga il database.

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

Il ponte è **un unico oggetto JSON serializzabile** (`{root, checklist, players}`) che
contiene l'intero stato di una campagna: stessa forma per Esporta/Importa, per la colonna
JSONB `campaign.data`, e per l'iniezione nel browser. La forma iniziale è definita una
sola volta in `src/lib/campaigns.ts`.

Flusso cloud: `/play/[id]` (route handler, non pagina React) legge la riga e serve
`app.html` iniettando `<script>window.__cloud = {id, state}</script>`; l'app rileva
`window.__cloud` all'avvio e salva con `PATCH /api/campaigns/:id` (limite 4 MB,
coalescing delle scritture, fallback su localStorage se offline). Senza `__cloud`
l'app gira standalone su localStorage. **Ancora dell'iniezione**: le route inseriscono
il bridge prima della prima occorrenza letterale dell'apertura di tag script senza
attributi in `app.html` (quello del tema, in `<head>`) — quella stringa non deve
comparire prima, nemmeno dentro un commento HTML.

`/tavolo/[token]` è la variante in sola lettura per i giocatori (vedi Sicurezza).

**Modalità combattimento** (`public/app/battaglia.js`): `n.battle` sta sul nodo del
livello dove si combatte — la sua presenza è la modalità accesa, non c'è stato globale.
Le pedine **referenziano** la loro fonte (`playerId`, oppure `{nodeId, foeId}`) e non
ne copiano nome e PF: c'è un solo numero per creatura, letto alla fonte a ogni disegno.
La griglia è quella che c'era già — `CELL` (40px, 1 quadretto = 1,5 m) è definita una
sola volta in `modello.js`: `battaglia.js` la riesporta, il pattern `#grid` in `mappa.js`
e `DG_SCALE` in `dungeon.js` la importano. Le forme con `grid:true` in `SHAPES`
(edificio, stanza, piazza) vivono sulla maglia: posizione e dimensioni in quadretti
interi a ogni interazione (creazione, drag, resize, frecce, input del pannello) —
quartieri, torri e segnalini restano liberi, e le bolle esistenti fuori scala non
migrano da sole: si agganciano al primo tocco.

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

**Preferenze dell'interfaccia vs stato della campagna**: tema (`runebog-theme`) e
larghezza del pannello dettagli (`runebog-detail-w`) stanno in `localStorage`, non nel
JSON — che viaggia tra export, cloud e tavolo, mentre queste dipendono dallo schermo che
si ha davanti. Entrambe sono gestite in `main.js`; la larghezza è la variabile CSS
`--detail-w` su `:root`, così il clamp in `vw` resta al CSS, che segue i resize della
finestra.

**Temi**: `public/themes.css` è la sorgente unica dei token colore, letta sia dal sito
(link in `layout.tsx`) sia da `app.html`. I nomi sono per ruolo (`--moss` = accento
primario), non per tinta: i temi si cambiano lì e in nessun altro posto.

**Generatore di dungeon**: motore puro e deterministico (seed-based) in
`src/lib/dungeon/engine.ts`, dataset SRD in `src/lib/dungeon/srd-data.ts`, UI in
`src/app/dungeon/`. L'export (schema `1.1`) è importabile nell'app come bolla `luogo`.
I nomi dei mostri in `srd-data.ts` DEVONO combaciare con le schede italiane di
`public/app/srd-mostri.js`: all'import `dungeon.js` aggancia la scheda per nome
(`statblockSRD()` in `mostri.js`, la stessa ricetta del bestiario) — gli export
legacy in inglese passano dalla mappa `public/app/dungeon-nomi.js`. Il motore
sceglie i mostri per tag e GS, mai per nome: rinominare è sicuro, disallineare no.

**Sezione regole** (`/srd`): i capitoli dell'SRD 5.2.1 in italiano. I JSON di
`src/lib/srd/capitoli/` sono GENERATI da `scripts/estrai-srd-regole.mjs` (fratello
di `estrai-srd-mostri.mjs`: stesso PDF, stessa strategia) e non si modificano a
mano — si rigenerano con `node scripts/estrai-srd-regole.mjs <PDF> [id-capitolo]`.
`src/lib/srd/index.ts` tiene il tipo del documento e il registro `CAPITOLI`, dove
il flag `pronto` dice se il JSON esiste: la sezione cresce un capitolo alla volta,
l'indice elenca anche quelli mancanti e `generateStaticParams` pubblica solo i
pronti. Il testo esce come array di span (`{s, i?, b?}`), **non** come HTML: le
pagine lo rendono con elementi React, così non c'è markup da sanificare.
L'attribuzione CC-BY (`ATTRIBUZIONE_SRD`) va resa in fondo a ogni pagina — è una
condizione della licenza, non una cortesia.

Nel PDF la semantica sta nei font, non nel testo (come per il bestiario): `#88191f`
a taglia 39/27/21/18 sono i livelli di titolo, Cambria = prosa, GillSans = celle
ed elenchi. Due trappole già pagate: gli id dei fontspec sono **cumulativi nel
documento** (mai azzerarli a ogni pagina), e il **rientro non separa i paragrafi**
— il documento alterna rientro sospeso e rientro di prima riga, a volte nella
stessa pagina, quindi si rompe sul grassetto di apertura e sul salto verticale.

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
  Le porte dei muri seguono da sé: il client le ricava dagli archi che ha in mano,
  quindi un arco che il server non manda non apre nessun muro. Un `segreto` non apre
  il muro nemmeno per il DM (lascia un segno sopra la parete): così non c'è un buco
  la cui assenza al tavolo vada spiegata, e la regola resta una sola.
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
- I dati SRD dei mostri sono **CC-BY-4.0** (non MIT): l'attribuzione nelle schede
  mostro va mantenuta.

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
- Le immagini stanno in base64 dentro il JSON della campagna: occhio al limite di 4 MB.
- `package.json` ha due **overrides npm** nati da alert Dependabot (lug 2026): postcss
  ≥8.5.10 (Next lo pinna vulnerabile) ed esbuild ^0.25 sotto `@esbuild-kit` (dipendenza
  abbandonata trascinata da drizzle-kit). Quando Next o drizzle-kit si aggiornano,
  ricontrolla se sono diventati superflui. Se cambi gli overrides: npm NON li riapplica
  a risoluzioni già nel lockfile — va rigenerato (`rm -rf node_modules package-lock.json
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

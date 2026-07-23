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
npm test             # test puri con node:test (test/strumenti/*.test.mjs)
npm run build        # build di produzione (fa anche typecheck)
```

I test sono pochi e **puri** (`node --test`, nessuna dipendenza, nessun DOM): oggi
coprono il gestore degli strumenti mappa e la geometria del righello (vedi
`test/strumenti/`, il resto dell'app si verifica a mano nel browser). La CI
(`.github/workflows/ci.yml`) esegue typecheck + `npm test` + build su ogni push e
PR, con `DATABASE_URL` fittizio: il client Neon viene creato all'import di
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
e `DG_SCALE` in `dungeon.js` la importano.

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

**Strumenti temporanei della mappa** (`public/app/strumenti/`): righello e simili
(aree d'effetto, percorso, coordinate, mirino — solo il righello è implementato).
Sono **temporanei**: disegnano su una tela a parte e non toccano mai la campagna.
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
- **Il salvataggio è ritardato di 700 ms** (`save()` in `stato.js`, per non
  scrivere a ogni battitura) e a chiudere quella finestra è il `pagehide`
  registrato da `initStato`. Serve perché dall'editor si esce con un clic: il
  titolo in topbar è un link alla home. `pagehide` e non `beforeunload`, che su
  iOS non arriva, e vale per ogni modo di andarsene — link, tasto Indietro,
  scheda chiusa. In locale la scrittura è sincrona e finisce lì; nel cloud la
  PATCH viene marcata `keepalive`, che però la specifica concede solo sotto i
  64 KB — sopra resta un tentativo, non una garanzia.
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

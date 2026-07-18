# To-do

- [x] **Generatore di dungeon accessibile da ogni campagna** — fatto (18 lug 2026).
  Il link stava solo nel footer della home, cioè fuori dalla campagna: ora c'è un
  `<a class="btn primary" href="/dungeon" target="_blank">` dentro la sezione
  "Generatore di dungeon" del pannello (`pannello.js`) e la voce "Genera un dungeon ↗"
  nel menu ⋯ (`menu.js`), che lo copre anche quando il pannello mostra un segnalino.
  Scheda nuova, così la campagna aperta non si perde. Regola `a.btn` in `app.css`:
  un `<a>` non eredita da `<button>` né box né allineamento.
- [x] **"Elimina il mio account" spostato in fondo** — fatto (18 lug 2026).
  Da sopra la lista campagne (dove si clicca in fretta) al posto lasciato libero dal
  generatore, tra le voci di servizio del footer (`src/app/page.tsx`).
- [x] **I passaggi segreti non escono più al tavolo** — fatto (18 lug 2026). Era un
  leak: `share.ts` filtrava le strade solo per estremità visibili, quindi bastava
  rivelare le due bolle collegate perché il tavolo leggesse il collegamento *e la
  sua etichetta* ("cunicolo sotto il guado"). Ora `DM_ONLY_EDGES` in `src/lib/share.ts`
  li scarta per tipo, e il pannello del collegamento lo dice al DM (flag `dmOnly`
  su `EDGE_TYPES.segreto` in `modello.js` — server e client vanno aggiornati insieme).
  Verificato: 6/6 sulla proiezione (strada normale passa, segreto no, etichetta
  assente, note DM assenti) + 11/11 in Chromium sulle tre voci.
- poter personalzizare il colore delle bolle e mettere quartiere edificio e stanza colori di default diversi fra loro
- quando apri un livello puoi aggiungere solo una bolla, invece dovresti poter trascinare da quartiere a token qualsiasi cosa
- poter salvare i personaggi dei player della campagna in modo da poterli vedere velocemente e poterli posizionare
- poter mettere modalita combattimento cosi rendi i quadratini piu rigidi, quindi che un personaggio sta precisamente in un quadratino di lato 1.5 metri, condividi l'iniziativa con il tavolo sia dei mostri che dei pg, e importante il poter rollare iniziativa per l'encounter direttamente dalla app (lato dm)
- poter espandere l'encounter in modo che se lencounter sono 4 goblin, se lo espando ho 4 token goblin che posso posizionare sul campo di battaglia


Dal report UX del 15 lug 2026 (`.impeccable/critique/`, baseline 29/40), in ordine:

- [x] **Giro fix dal re-critique del 16 lug** — completato (17 lug 2026) con i tre
  passi qui sotto (scope concordato: tutti e 5 i priority,
  partendo dai bug visivi rapidi; niente cambi al modello Tipo×Forma / modalità sessione):
  1. [x] `/impeccable polish` — fatto (17 lug 2026), i 4 bug visivi, tutto in
     `public/app/app.css`:
     - `.q-status{width:auto}`: il reset `input,select{width:100%}` non fa più
       occupare al select l'intera riga — la vista Quest torna leggibile.
     - Danger ember **a riposo**: `.btn.danger` con colore+bordo a riposo (contrasto
       misurato 5.82:1 in Torbiera, 6.01:1 in Pergamena) e `#ctx-menu button.danger`
       piazzato dopo la regola `:hover` generica così l'ember vince anche al passaggio.
       Nel confirm "Elimina" ≠ "Annulla" anche su touch.
     - `.hp-num input` 34→52px: tre cifre di PF senza troncare ("24" non è più "2·").
     - **Topbar a gradini**: `h1` e `#savestate` in `nowrap` (con `min-width:0` +
       ellipsis sui messaggi lunghi tipo l'avviso 4 MB — il testo integrale lo
       annuncia il `role=status`); la fila piena misura ~1520px, quindi tre gradini:
       ≤1550px via il sottotitolo e ricerca a 150px; ≤1400px le azioni rare passano
       al menu ⋯ (lo stesso del mobile); 761–1200px due righe ordinate con
       `flex-wrap` + pseudo-elemento a `flex-basis:100%`, e `body` a flex perché
       `main{height:calc(100vh-53px)}` assumeva la topbar a una riga.
     - Rimosso il CSS morto `.rune-ring` segnalato dal critique.
     - Verificato con Chromium 21/21: vista Quest, PF, confirm e ctx-menu in due
       temi con sonde WCAG, topbar a 9 larghezze da 1920 a 770px (overflow, righe,
       ellipsis del messaggio lungo, `main` in viewport), console pulita.
  2. [x] `/impeccable harden` — fatto (17 lug 2026), i due filoni:
     - **Undo su touch**: `doUndo()` in `stato.js` è l'unico punto d'ingresso
       (Ctrl+Z, menu, bottone) con lo stesso feedback in `#savestate`. Bottone ↶
       in topbar visibile solo su `pointer:coarse` ≥761px e solo quando c'è
       qualcosa da annullare (`hidden` governato da `refreshUndoBtn`, proxy su
       `undoStack` che esclude lo snapshot del save() di avvio; niente classe
       `dm-only`, la regola dei gradini lo nasconderebbe sotto i 1400px). Sul
       telefono la riga 2 è piena (tre righe di topbar): lì la via è la voce
       "Annulla l'ultima modifica ↩" nel menu ⋯, presente ovunque (`menu.js`).
     - **Ricerca Ctrl+K estesa** (`ricerca.js` riscritta): titoli, note DM +
       note per i giocatori (snippet con `<mark>` su fondo `--gold` traslucido),
       nemici (`monster.foes`, un risultato per bolla), giocatori (nome/classe/
       note → vista Giocatori), checklist (→ vista Checklist, esclusa al tavolo
       dove il tab non esiste). Ordine: titoli, poi note, poi il resto; il
       dialog "?" che promette "Cerca in tutta la campagna" ora dice il vero.
     - Verificato con Chromium 23/23 su tre contesti (desktop fine pointer,
       iPad touch 1024, telefono 390): cinque sorgenti con navigazione da
       tastiera, Ctrl+Z invariato (e ancora lasciato al browser dentro i campi),
       ciclo completo del ↶ (appare/annulla/sparisce), voce nel menu ⋯ su
       tablet e telefono, topbar senza overflow, console pulita; regressione
       suite polish 21/21.
  3. [x] `/impeccable onboard` — fatto (17 lug 2026), primo avvio senza dati personali:
     - **Esempio-tutorial al posto dei distretti vuoti**: `defaultState()` (stato.js)
       ora costruisce "Guado dell'Airone (esempio)" — locanda con due stanze dentro
       (mini-preview visibile), mercato/faro/locanda nei tre stati di preparazione,
       tre tipi di collegamento (strada, ponte, segreto con etichetta), quest nel
       diario, PNG, encounter col tracker PF (2 ratti SRD), note DM ≠ note giocatori
       su una bolla condivisa, checklist 3 voci di cui 1 fatta. Esplorarlo è il
       tutorial; "(esempio)" nel titolo dice che si può smontare. Il nome nell'indice
       campagne combacia col titolo fin dal primo avvio.
     - **Empty state contestuale** (`emptyNodeMarkup()` in mappa.js, markup tolto da
       app.html): alla radice di una campagna nuova spiega il concetto ("Ogni bolla…
       può contenere un'altra mappa"), nei livelli interni ricorda i gesti, al tavolo
       dei giocatori niente inviti a modificare ("Il DM non ha ancora rivelato nulla").
     - Verificato con Chromium 24/24 su tre contesti (primo avvio a localStorage
       vuoto, campagna nuova vuota, tavolo simulato): niente "Distretto"/"compleanno",
       5 bolle + 3 collegamenti, stati e condivisione negli aria-label, tracker PF,
       quest e checklist nelle viste, console pulita.

- [x] **Rilanciare `/impeccable critique`** — fatto (16 lug 2026), dual-agent, snapshot
  `.impeccable/critique/2026-07-16T14-51-37Z__public-app-html.md`. Punteggio **29/40**,
  piatto sulla baseline ma con composizione tutta nuova: i P1 del 15 lug (contrasti,
  tastiera, undo assente, onboarding) sono risolti — contrasti e tela accessibile ora
  sono punti di forza misurati live. Emersi 2 P1 nuovi (vista Quest rotta, undo
  inesistente su touch) e 3 P2 (danger invisibile a riposo, primo avvio coi dati dello
  sviluppatore, ricerca che promette "tutta la campagna" ma matcha solo i titoli) —
  dettagli e fix nel giro qui sopra.

- [x] **Rifinitura (giro `/impeccable polish`)** — fatto (16 lug 2026), le quattro voci
  minori rimaste dal report UX:
  - **Favicon di `app.html`**: `link rel="icon"` verso `/icon.svg` (l'icona del sito,
    `src/app/icon.svg`, che Next già serve) — via il 404 di `favicon.ico`.
  - **Mini-preview più contrastata** (`mappa.js`): gruppo a piena opacità (era 0.85),
    stroke dei collegamenti 1.5→1.8 e delle bolle figlie 1.2→1.6, marker r 2.6→3.
  - **% testuale sulla barra XP del dungeon** (`generator.tsx` + `dungeon.css`): il
    superamento del budget non vive più solo nel colore — `.dg-bar__pct` a fianco
    della barra, `tabular-nums` + `min-width` perché 2 o 3 cifre non spostino nulla.
  - **Barre HP a `scaleX`** (`app.css`, `giocatori.js`, `mostri.js`): riempimento
    largo 100% scalato con `transform` (origin a sinistra) invece della transizione
    su `width` — anima sul compositor, niente rilayout a ogni tick di PF.
  - Verificato: `npx tsc` ok, Chromium 11/11 (favicon 200, opacità/stroke della
    mini-preview, `scaleX` su entrambe le barre con update in place al click su −,
    % presente su /dungeon, console pulita). I finding residui del detector su
    `app.html`/`app.css` sono i falsi positivi già classificati nella baseline
    (img del lightbox con src da JS, scala densa da tool, swatch del menu
    contestuale); il `layout-transition` su `.hpbar-fill` ora matcha solo la
    parola `width:100%`, la transizione è su `transform`.

- [x] **Layout (giro `/impeccable layout`)** — fatto (16 lug 2026), dual-agent
  (assessment strutturale + detector meccanico; il detector era pulito, tutti i
  finding veri sono dell'assessment):
  - **Topbar mobile da ~4 righe (~200px) a 2 (111px misurati a 390px)**: le azioni
    rare in sessione (Esporta/Importa, tema, scorciatoie, ＋/🗑 campagna) vivono nel
    menu "⋯" (`openTopbarMenu` in `menu.js`, riusa `openCtx`; al tavolo dei giocatori
    restano solo tema e scorciatoie). Righe via `order` nel media query, DOM invariato.
  - **Progressive disclosure nel pannello** (`pannello.js`, `mostri.js`): `<details>`
    per Sfondo della pianta, Generatore di dungeon, Immagine di riferimento (aperta
    se c'è un'immagine) e "Resto della scheda" mostro (TS/abilità/res/linguaggi/
    tratti/leggendarie). Lo stato di apertura sopravvive ai re-render (`openSecs`).
    Sempre visibili: Note, Al tavolo, Azioni, tracker PF.
  - **Card dungeon**: via la side-stripe `border-left:4px` (pattern bandito, colore
    del tipo già sul badge) — ora l'indice `#n` è colorato; `dg-stat__k`/`dg-badge`
    0.62→0.7rem (erano sotto i 10px).
  - Pulizie di contorno: foe-list de-nestata (era card dentro card), gradino 18/19px
    fuso su 19, `.hint-sm` 11.5→12px, ricette bottoni unificate (tab 7×13 come `.btn`,
    `.pal-item` 7×10 come i menu), gemelli 26/28px allineati, ~35 righe di CSS morto
    rimosse (`#canvas*`, `#view-plan`, `#plan-side`), aria extra sul confine "Al tavolo".
  - Rimandati consapevolmente: token di spaziatura `--sp-*`, consolidamento completo
    della scala tipografica a 6 gradini, raggruppamento del cluster destro della
    topbar desktop (candidati per il giro polish o oltre).
  - Verificato: `npx tsc` ok, Chromium 27/27 (pannello e statblock desktop, topbar
    e menu ⋯ mobile touch con cambio tema, /dungeon senza stripe).

- [x] **Microcopy (giro `/impeccable clarify`)** — fatto (16 lug 2026), dal report UX:
  - Nomenclatura unificata su **bolla** (la parola della landing, di `/dungeon` e di
    CLAUDE.md): palette, empty state, pannello, menu contestuale, conferme di
    eliminazione e dialog del tavolo non dicono più "blocco" (`app.html`, `menu.js`,
    `pannello.js`, `mappa.js`, `tavolo.js`). "Posto di blocco" in `pannello.js` resta:
    è un'altra parola.
  - `alert()` nativi → `openAlert()` in `viste.js` + `#alert-dialog`: sostituite le 7
    chiamate in `stato.js`, `tavolo.js`, `dungeon.js`, `esporta.js`; l'import fallito
    non mostra più l'errore JSON in inglese. Scoperto di passaggio: il reset
    `*{margin:0}` di `app.css` toglieva il centraggio nativo dei `<dialog>` (si
    aprivano in alto a sinistra) — ora `dialog{margin:auto}`.
  - Ricerca: placeholder "Cerca…" + badge `Ctrl K` separato (`#qs-kbd`, sparisce con
    focus/testo digitato e su puntatore grosso) — niente più "Cerca… (Ctrl" troncato.
  - Elenco scorciatoie: `#keys-dialog` raggiungibile col tasto `?` (fuori dai campi),
    col bottone "?" in topbar e citato nell'hint della mappa.
  - Verificato con Chromium: 19/19 controlli su desktop e mobile touch (nomenclatura,
    dialog, badge, "?" nei campi resta testo).

- [x] **Landing e funnel (giro `/impeccable onboard`)** — fatto (15 lug 2026), il P2
  "landing senza prodotto né porta senza account" del report UX:
  - Anteprima dell'editor sulla landing: vignetta SVG disegnata coi token di
    `themes.css` (`src/app/anteprima-editor.tsx`), non uno screenshot — stessa
    grammatica visiva di `mappa.js` (bolla-zona con mini-preview dei figli,
    strada/ponte/segreto, status dot forma+colore, glow di lanterna sul
    condiviso) e la mini-preview mostra cosa significa "mappe gerarchiche".
  - L'intera vignetta è un link a `/app.html` con CTA "Provala senza account →"
    (l'editor standalone su localStorage esisteva già, mancava la porta); nota
    sotto: la zona contiene i luoghi, senza account si salva sul dispositivo.
  - Verificato con Chromium: desktop e mobile (dove la CTA precede i form di
    registrazione), clic → l'app parte con i distretti demo.

- [x] **Robustezza editor (giro `/impeccable harden`)** — fatto (15 lug 2026), i due
  P1 del report UX:
  - **Undo**: snapshot-stack di serializzazioni JSON in `stato.js` (cap 20), alimentato
    da `save()`; una raffica di modifiche ravvicinate (digitazione) conta come una sola.
    Ctrl+Z in `scorciatoie.js`, con feedback in `#savestate` e ripulitura di
    path/selezione dai nodi che non esistono più. Stack azzerato a cambio campagna,
    nuova campagna e import.
  - **Mappa da tastiera**: bolle e collegamenti SVG con `tabindex`/`role`/`aria-label`/
    `aria-pressed` (`mappa.js`); la selezione segue il focus (Tab = clic, il pannello
    dettagli si aggiorna), il focus sopravvive ai re-render via `innerHTML`, Space =
    Ctrl+clic sulla bolla a fuoco. Palette attivabile da tastiera: Invio/Spazio piazza
    al centro della vista (con `stopPropagation`, sennò l'Invio risaliva alle
    scorciatoie globali ed entrava nel blocco appena creato — bug trovato in verifica).
  - **A11y di contorno**: `aria-live`/`role=status` su `#savestate`, pattern ARIA
    completo sui tab (`role="tab"`+`aria-selected`+frecce in `viste.js`, `tabpanel`
    sulle sezioni), Ctrl+K funziona anche col focus nei campi.
  - **Limite 4 MB**: avviso proattivo in `#savestate` sopra l'80% (`3,5 MB su 4…`),
    messaggio esplicito oltre il limite e sul 413 del cloud (prima diceva "Offline").
  - Verificato end-to-end con Chromium guidato solo da tastiera: 26/26 controlli
    (selezione/nudge/undo/palette/tab/Ctrl+K) + 2 sugli avvisi di peso.

- [x] **Contrasto e palette a token (giro `/impeccable colorize`)** — fatto (15 lug 2026),
  dal report UX in `.impeccable/critique/` (baseline 29/40, dual-agent):
  - CTA `.btn.primary` dell'app allineata alla ricetta del sito (`--fen` pieno):
    era sotto 4.5:1 nei tre temi scuri (`public/app/app.css`).
  - Nuovo token `--moss-hov` per l'hover dell'accento: nei temi scuri schiarisce,
    in Pergamena scurisce (schiarire toglieva contrasto); usato da app e sito.
  - `--parchment-mute` (placeholder) schiarito/scurito nei 4 temi atmosferici:
    ora ≥4.5:1 su `--peat-sunk` (prima 3.6–4.0).
  - Stroke dei collegamenti mappa a token: nuovi `--track`/`--tunnel` per tema,
    bloccata/ponte/segreto riusano `--ember`/`--wisp`/`--arcane`
    (`modello.js`; in Pergamena la strada era a 1.58:1, invisibile). Vincolo
    documentato: gli stroke vanno in `style=`, gli attributi SVG non risolvono `var()`.
  - Griglia della tela a token `--grid` (deriva da `--moss` via `color-mix`),
    barra PF dei nemici su `--fen`/`--gold`/`--ember` (`mostri.js`),
    `--on-ember` al posto del `#fff` in `globals.css`.
  - Status dot: lo stato non è più solo colore — "da fare" anello, "in corso"
    disco, "fatto" disco con spunta (`mappa.js`).
  - Verificato a schermo (Torbiera + Pergamena) con sonde di contrasto sui
    computed style. I punti restanti del report sono le voci aperte qui sopra.

- [x] **Migrazioni drizzle-kit al posto di db:push** — fatto (15 lug 2026): schema
  versionato in `drizzle/` con baseline `0000_iniziale` (generata dallo schema attuale e
  marcata come già applicata inserendo a mano la riga in `drizzle.__drizzle_migrations`,
  stesso hash sha256 che calcola il migrator). Script `db:push` rimosso, al suo posto
  `db:generate` + `db:migrate`. Verificato: `migrate` è no-op sul DB attuale, `generate`
  non rileva drift. Aggiornati README e CLAUDE.md.

- [x] **Riparare il DB: colonna `share_token` mancante** — fatto (15 lug 2026): la
  tabella `campaign` su Neon era rimasta indietro rispetto a `src/db/schema.ts` e ogni
  insert/select falliva con 42703 (sito bloccato dopo il login). Applicato SQL esplicito
  (`db:push` è rotto, vedi CLAUDE.md): `ADD COLUMN share_token text` + constraint
  `campaign_share_token_unique`, nome identico a quello che genererebbe drizzle-kit.
  Secondo round: il primo fix era finito solo sul branch Neon `dev` (quello del `.env`
  locale) — riapplicato su `production` (baseline migrazioni incluso), che è il branch
  usato dal sito. D'ora in poi ogni migrazione va su entrambi i branch.

- [x] **Chiudere le 3 vulnerabilità Dependabot** — fatto (15 lug 2026): drizzle-orm
  0.38 → 0.45.2 (high, SQL injection — non eravamo sfruttabili: schema statico, nessun
  identificatore SQL dall'utente), postcss forzato a ≥8.5.10 con override npm (Next lo
  pinna vulnerabile), drizzle-kit → 0.31.10 + override esbuild ^0.25 sotto
  `@esbuild-kit` (solo dev). `npm audit` a zero; gli override sono da ricontrollare
  quando Next/drizzle-kit si aggiornano.

- [x] **Spezzare app.html in moduli ES** — fatto (14 lug 2026): ritirate le versioni
  standalone/desktop, `public/app.html` è solo markup (~160 righe); CSS in
  `public/app/app.css`, bestiario in `public/app/srd-mostri.js` (~350 KB, ora cacheabile
  dal browser), JS in 16 moduli ES per dominio sotto `public/app/` (entry `main.js`,
  stato condiviso nell'oggetto `st` di `stato.js`).
  - Bug corretto scoprendolo: `revealNode` era definita due volte e la versione
    "condividi al tavolo" sovrascriveva quella di navigazione — cliccare una quest nel
    diario o un risultato della ricerca toglieva la condivisione invece di navigare.
    La navigazione ora è `goToNode` (`mappa.js`).
  - Rimossi i rami `window.desktop` (export/import con dialog nativo) e il monkey-patch
    di `renderDetail`; conferme unificate su `openConfirm(testo, cb)` (`viste.js`).

- [x] **Integrare il generatore di dungeon** — fatto: pagina `/dungeon` (14 lug 2026).
  - Motore puro in `src/lib/dungeon/engine.ts`, dataset SRD in `src/lib/dungeon/srd-data.ts`,
    UI in `src/app/dungeon/`. Parità verificata col jsx originale (60/60 seed identici).
  - `dungeon-generator.jsx` nella root è ora ridondante: si può eliminare.
- [x] **Pubblicare il codice** — fatto (14 lug 2026): repo GitHub reso pubblico, link
  "Codice sorgente" nel footer della home (`REPO_URL` in `src/lib/site.ts`) e frase sul
  codice verificabile in fondo a `/privacy`.
- [x] **Importare l'export del generatore nell'app** — fatto (14 lug 2026): pannello del livello →
  "Incolla dungeon" / "Da file…". Il dungeon diventa una bolla `luogo` con stanze posizionate,
  corridoi come sfondo pianta + archi tunnel, incontri con `foes` per il tracking PF,
  e i PG di `state.players` come token trascinabili all'ingresso (schema export `1.1`).

# To-do

## Fase 4: calendario di gioco (25 settembre 2026)

Dario: un calendario del mondo con mesi personalizzabili, il giorno
corrente, e scadenze delle quest scritte come «tra N giorni». I giocatori
vedono calendario, giorno e mesi; degli eventi solo quelli segnati visibili.

- [x] **Il dato** (`documento.calendario`): mesi `{nome, giorni}`,
  settimana, anno iniziale, era, `oggi`, eventi `{id, giorno, titolo, note?,
  visibile?}`. I giorni sono un intero assoluto: cambiare la lunghezza di un
  mese sposta la data, non il giorno. **Nessun salto di `schemaVersion`**,
  diversamente dalla roadmap: il campo è facoltativo come `griglia` e
  `taglia` (assente = `calendarioPredefinito()`), così la portable e gli
  editor in cache non rifiutano i file nuovi. Contratto, bonifica unica
  (`normalizzaCalendario`, letta da `sanitizeState` e `share.ts`) e conti
  puri in `calendario-conti.js`. Guardare la scheda non scrive il campo:
  lo scrive il primo gesto che modifica.
- [x] **Scheda Calendario** (`calendario.js`): oggi, −1/+1/«Fai passare N»,
  mese a griglia sulla settimana del calendario, il giorno scelto con
  eventi e scadenze, «In arrivo», e la struttura (mesi, settimana, anno,
  era) in una sezione richiudibile. Ogni gesto è un Ctrl+Z. Su telefono le
  celle mostrano punti invece dei titoli; le sei schede stanno in 335px su
  360 (margine delle schede 7→3px).
- [x] **Scadenze delle quest** (`n.scadenza` giorno assoluto,
  `n.scadenzaVisibile`): dal pannello «tra N giorni», nel diario (ordinabile
  per scadenza), nella testata della scheda sulla tela, nel calendario e nel
  nome accessibile della bolla. Una quest fatta non scade più.
- [x] **Al tavolo**: la scheda c'è solo se il documento ha un calendario;
  escono struttura, oggi e gli eventi visibili (titolo e note), mai gli
  altri né il loro numero. La scadenza esce solo se la quest è rivelata e
  il DM l'ha detta. Il polling ridisegna anche la vista aperta, non solo la
  mappa.
- [x] Test `test/calendario/calendario.test.mjs` (12, nel glob di
  `npm test`), verifica `node test/browser/verifica-calendario.mjs` (30
  controlli, telefono e tavolo compresi).
- [ ] Non fatti: eventi legati a una bolla (`nodeId` della roadmap) ed
  eventi ricorrenti.

## Rimasti indietro dalle fasi 2 e 3 (25 settembre 2026)

- [x] **La verifica della barra a menu falliva un giro su nove sotto
  carico**, anche prima della Fase 3. Non era la prova: "Nuova campagna" dà
  il focus al titolo con 80 ms di ritardo, e su una macchina carica quel
  focus arrivava dopo che si era già tornati a un'altra campagna e si
  navigava la barra da tastiera. Ora rinuncia se la campagna è cambiata o
  c'è un menu aperto (`newCampaign` in `stato.js`); la verifica prova il caso
  senza aspettare il carico.
- [x] `verifica-barra-menu` e `verifica-pannello-mobile` aspettano
  `/app.html` e non la home, che senza `.env` risponde 500: provano solo
  l'editor.

## Fase 3: impostazioni e fogli (25 settembre 2026)

Dario: «alle caselle di testo puoi dare una texture tipo foglio di carta,
pergamena srotolata, bruciata», e una pagina di impostazioni per
personalizzare.

- [x] **Quattro fogli** per caselle di testo e schede dei segnalini: pulito,
  carta, pergamena srotolata (due rotoli), bruciata (contorno frastagliato
  con `clip-path` e brace ai bordi). Solo CSS dentro il `foreignObject`
  (`.foglio-*` in `app.css`), nessun filtro SVG per bolla. Sul foglio
  l'inchiostro è del foglio: i colori delle bolle sono pastelli per i temi
  scuri. Il contenitore non ha margini verticali, quindi le misure di
  `adattaSchede`/`adattaTesto` restano quelle del testo.
- [x] **Il foglio per bolla** sta nel documento (`n.foglio`, elenco chiuso
  `FOGLI` nel contratto, `foglioDi` in `modello.js`, bonifica); assente =
  segue le impostazioni. Si sceglie dal pannello di casella e scheda
  ("Predefinito" toglie il campo). Al tavolo non arriva: caselle e schede
  sono del DM, e un test lo impone comunque.
- [x] **Finestra Impostazioni** (`impostazioni.js`, `#impostazioni-dialog`),
  da Visualizza e dal ⋯: tema, barra a menu o completa, foglio predefinito,
  carattere delle caselle nuove. Richiama `setTheme` e `impostaBarra`, non
  ne fa una seconda strada. Le preferenze stanno in `localStorage`
  (`preferenze.js`: `runebog-foglio`, `runebog-carattere`); al tavolo
  restano tema e barra.
- [x] Colori dei fogli in `themes.css`, uguali in tutti i temi; sei coppie
  nuove in `npm run temi:contrasto` (la peggiore 4,89:1, lo stato sul
  margine bruciato).
- [x] Test `test/scala/foglio.test.mjs`, verifica
  `node test/browser/verifica-fogli.mjs` (26 controlli, tavolo compreso).
- [x] **Caselle tagliate in fondo** (25 set 2026): cambiando foglio dalle
  impostazioni, le caselle degli altri livelli restavano col testo tagliato
  finché non le si modificava. Ora dopo ogni disegno `adattaCaselle`
  (`mappa.js`) allunga quelle in cui il testo non ci sta, in qualunque
  livello e per qualunque causa, riscrivendo gli attributi senza ridisegnare.
  La verifica `verifica-fogli.mjs` lo prova in un livello mai aperto.

## Fase 2: la bolla come pagina (25 settembre 2026)

Il tester vuole girare per la mappa e leggere tutto sulle bolle, senza
aprire il pannello laterale, e scriverci sopra direttamente.

- [x] **Scheda sotto il segnalino.** PNG, quest, encounter e note con una
  descrizione la mostrano in un riquadro sotto il nome, resa come le
  caselle di testo (`testoRicco`). Lo stato della quest apre la scheda.
  Alta quanto il testo fino a un tetto, poi sfuma in fondo; misure di
  partenza ricavate dalla taglia, quindi nessuna migrazione. La maniglia
  del riquadro lo allarga dai due lati e ne fissa l'altezza (`n.scheda`,
  `normalizzaScheda` nel contratto). Carattere, allineamento e "Adatta"
  come nelle caselle. Pedina esclusa; al tavolo niente schede
  (`schedaMarkup`/`adattaSchede` in `mappa.js`, `haScheda`/`schedaDi` in
  `modello.js`).
- [x] **Scrittura sul posto** (`public/app/scrittura.js`). Doppio clic o
  Invio su una scheda o una casella: una textarea sopra il riquadro con la
  barra di formattazione flottante (la stessa del pannello,
  `barraFormattazione`), più A−/A+, allineamento e Fatto. Esc o un clic
  fuori chiudono; una sessione è un solo Ctrl+Z (`apriSessione` in
  `stato.js`). Su telefono sta in cima alla tela, fuori dalla tastiera.
  Dentro un PNG o una quest si entra da "Entra →" (menu e pannello, `entra`).
- [x] **Una sagoma per tipo**: PNG tondo, quest scudo, encounter rombo,
  nota foglio con la piega; la pedina resta un disco pieno. Stessa funzione
  per tela, palette e livello vuoto (`sagomaSegnalino`).
- [x] **Le maniglie non comparivano al clic**: il pointerdown non ridisegna
  e il rilascio senza trascinamento nemmeno, quindi le maniglie restavano
  sulla bolla di prima. Ora il rilascio ridisegna se la selezione è cambiata.
- [x] Test `test/scala/scheda.test.mjs`, verifica
  `node test/browser/verifica-schede.mjs` (30 controlli, telefono e tavolo
  compresi).
- [x] **Su telefono, a zoom basso, il tocco su un segnalino prendeva la
  maniglia dei collegamenti** (corretto il 25 set 2026): la maniglia, raggio
  11 al tocco, è più grande di un segnalino, e la regolazione del tocco di
  Chrome le consegnava il pointerdown anche invisibile. Ora col dito la
  maniglia non si tocca finché la bolla non è selezionata (CSS), e il
  pointerdown la scarta se sotto le coordinate vere del dito c'è altro.
  Verifica `node test/browser/verifica-tocco.mjs` (rossa sul codice di
  prima: 8 KO su 10), che tocca con un raggio da dito via CDP.
- [x] **La tastiera virtuale su iPhone** sposta l'area visibile oltre che
  accorciarla (`visualViewport.offsetTop`), e l'editor in cima alla tela
  finiva sopra il bordo dello schermo; lo spostamento arriva come `scroll`,
  che nessuno ascoltava. Ora l'editor segue l'area visibile.
  `verifica-schede.mjs` finge le due tastiere (Android e iPhone).
- [ ] Da provare comunque su un telefono vero: la simulazione riproduce ciò
  che le tastiere fanno al `visualViewport`, non le tastiere.

## Fase 1 delle richieste di un tester (25 settembre 2026)

Roadmap in quattro fasi: la bolla come pagina, impostazioni e texture,
calendario di gioco vengono dopo. Qui la prima.

- [x] **Scheda PNG** accanto a Mappa, Quest, Checklist, Giocatori: tutti i
  nodi `png` dell'albero con il luogo che li contiene e la prima riga delle
  note, filtro per nome/luogo/note, il nome porta alla bolla (`goToNode`).
  Solo DM per ora (`public/app/png.js`).
- [x] **Segnalini ridimensionabili** (`n.taglia`, 1–8 quadretti per lato):
  dal pannello (Normale/Grande/Enorme/Mastodontica o numero) e dalla
  maniglia d'angolo sulla tela. Disco, sigla e nome crescono insieme; le
  taglie pari si agganciano all'incrocio, le dispari al centro della cella.
  Contratto, bonifica e tavolo leggono tutti `normalizzaTaglia`.
  Test `test/scala/taglia.test.mjs`, verifica
  `node test/browser/verifica-png-e-taglia.mjs`.
- [x] **Il contratto rifiutava il carattere massimo delle caselle**: diceva
  200 e il pannello concede 240, quindi una casella a 240 faceva rimbalzare
  con 422 il salvataggio in cloud. Ora `TESTO_SIZE_MAX` sta nel contratto e
  l'app lo importa.
- [x] **Schede su telefono**: le regole `.tabs button` dei gradini mobili non
  si sono mai applicate (perdevano contro `nav.tabs button`). Corrette, e le
  cinque schede stanno in 308px su 360.
- [x] **La mappa "scivolava" nel pan**: non era lentezza. Pan e pizzico
  convertivano i pixel con `larghezza viewBox / larghezza tela`, ma il
  viewBox non ha le proporzioni della tela e il browser lo scala con
  max(w/W, h/H): su uno schermo largo la mappa seguiva il mouse al 50–60%.
  Il pizzico in più ignorava la posizione della tela nella pagina. Ora c'è
  una sola conversione (`vistaPx` in `mappa.js`), calcolata all'inizio del
  gesto. Verifica `node test/browser/verifica-pan.mjs` (rossa sul codice
  vecchio a 1600×700 e col pizzico). Il video del tester era su un
  ultrawide, dove seguiva a circa un decimo: la verifica prova anche
  3440×1000.
- [x] **Portable 0.2.6** col pan corretto: versione, download e checksum
  aggiornati in `src/lib/site.ts`; smoke e tavolo del desktop verdi.
- [x] **Costo del ridisegno misurato** (`test/browser/misura-ridisegno.mjs`):
  ogni clic che ridisegna la tela ricrea tutti i `foreignObject` delle
  caselle (CPU ×4: ~70 ms con 40 caselle, ~150 con 120). Non è ciò che il
  tester sentiva; resta un margine da prendere se le campagne crescono.

## Penna dei muri e aperture (24 settembre 2026)

- [x] **Tracciare i muri tenendo premuto.** Con "Muro" della palette armato,
  trascinare disegna i muri dietro al mouse: un segmento per tratto dritto,
  angoli a squadra sulla maglia; la penna resta armata fino a Esc, un clic
  secco posa il muro da due come prima (`penna` in `mappa.js`).
- [x] **Porta (e altro) in un punto del muro.** Su un muro lungo pannello e
  menu contestuale mettono l'apertura nel quadretto toccato, spezzando il
  muro in tre (`inserisciNelMuro`); il tipo del muro intero resta nel
  pannello. Nuovi tipi: varco, finestra, grata, disegnati con segni diversi
  e ammessi da contratto e tavolo. Test `test/disegno/aperture.test.mjs`,
  verifica `node test/browser/verifica-penna-muri.mjs`.
- [x] **Portable 0.2.5** con penna dei muri e aperture: versione, download
  e checksum aggiornati in `src/lib/site.ts`; smoke del desktop verde.

## Testo formattato e collegamenti a mano (24 settembre 2026)

Richieste di un tester: un riepilogo delle missioni leggibile sulla mappa
generale senza zoomare all'infinito, "simile a Word", e strade che seguono
il percorso disegnato invece della riga più corta.

- [x] **Formattazione dentro la casella di testo.** Titolo, sottotitolo,
  intestazione, testo piccolo, elenchi puntati e numerati (con rientro),
  linea di separazione, grassetto, corsivo, barrato. Il testo resta una
  stringa in `notes` con una marcatura da tastiera (`# `, `- `, `1. `,
  `**…**`…) resa da `public/app/testo-ricco.js`, che escapa prima e
  aggiunge solo tag suoi: niente HTML da sanificare, niente migrazione. Nel
  pannello una barra di bottoni la scrive sulla selezione (Ctrl+B/Ctrl+I).
- [x] **Il testo segue la casella.** L'altezza la sceglie il DM tirando
  l'angolo e cresce solo se il testo non ci sta (prima la imponeva il
  testo). "Adatta il testo alla casella" (`textFit`) fa il contrario: il
  carattere più grande che ci sta, misurato sulla resa (`adattaCaratteri` in
  `mappa.js`). Grandezze fino a 240px (prima 48) con un campo numerico, e
  allineamento (`textAlign`).
- [x] **Collegamenti disegnati a mano.** Trascinando dalla maniglia ◦ la
  traccia diventa il percorso (`e.percorso`, punti relativi alle due
  estremità, semplificati con Ramer–Douglas–Peucker e disegnati come
  Catmull-Rom): segue le bolle spostate, una traccia dritta resta dritta.
  Ritracciare un collegamento esistente ne ridisegna il percorso;
  "Raddrizza" nel pannello lo toglie. Contratto e bonifica in
  `formato-campagna.js` (`normalizzaPercorso`), al tavolo esce. Le porte
  del perimetro derivato si aprono dove esce il primo tratto.
  Test: `test/disegno/`; nel browser
  `node test/browser/verifica-testo-e-percorsi.mjs` (vuole `npm run dev`).
- [x] **Portable 0.2.4** con queste due novità: versione, download e
  checksum aggiornati in `src/lib/site.ts`; smoke del desktop verde.

## Corridoi dipinti (24 settembre 2026)

- [x] **I corridoi del generatore si possono disegnare anche a mano.** Nuova
  voce "Corridoio" nel gruppo Pianta: accende un pennello che resta acceso
  (Esc o di nuovo la voce lo spengono); trascinando si dipingono celle della
  maglia velate, partendo da una cella dipinta si cancellano. Il dato è
  `n.corridoi` sul nodo del livello, coppie di interi in celle (quadretti o
  coordinate assiali negli esagoni). Contratto e bonifica condivisi
  (`normalizzaCorridoi` in `formato-campagna.js`, usata da `sanitizeState` e
  da `share.ts`: al tavolo i corridoi escono). Il generatore di dungeon
  scrive i corridoi qui invece che in un'immagine di sfondo, quindi ora si
  correggono; i dungeon già importati tengono lo sfondo. Esc con la palette
  armata non risale più di livello. Test: `test/critici/corridoi.test.mjs`;
  verifica nel browser `node test/browser/verifica-corridoi.mjs` (vuole
  `npm run dev`; aspetta `/app.html`, quindi gira anche senza `.env`).

## Palette e temi (23 settembre 2026)

- [x] **Provare una light mode con la palette fornita.** Aggiunto il tema
  Bruma, lasciando Alba disponibile per confronto. La seconda palette di
  prova usa `#f3fffe`, `#d1f2ee`, `#b7e6df`, `#e6f2ff` e `#f9eaf0` per
  superfici e stati; testo e accenti sono derivati più scuri per leggibilità.
  Prova locale, da valutare visivamente prima di considerarla definitiva.
- [x] **Rimuovere Brace e Taverna.** Tolte da `temi.js` e `themes.css`;
  le preferenze già salvate su quei nomi tornano a Torbiera al caricamento,
  sia nell'editor sia nelle pagine del sito.
- [x] **Ridurre l'affaticamento visivo dei temi.** Nei nove temi ordinari
  i fondi scuri sono meno vicini al nero, quelli chiari evitano il bianco
  puro, e testo e accenti principali hanno tinte più morbide. Le famiglie
  cromatiche restano riconoscibili; "Alto contrasto" conserva la sua funzione
  di accessibilità. I token condivisi in `public/themes.css` aggiornano sito
  ed editor insieme. Verifica: `npm run temi:contrasto` (nessuna coppia sotto
  soglia, nessuna famiglia troppo vicina) e controllo visivo dell'editor.

## Riscontri del primo tester (22 settembre 2026)

Primo giro di prova di un DM esterno: pulsanti e caricamento immagini
funzionano. Quattro punti, verificati contro il codice.

- [x] **Il generatore di dungeon non si trova, e sul desktop non c'è.**
  Fatto il 22 settembre: si genera dentro l'editor (menu "⋯" → "Genera un
  dungeon…", o il bottone nella sezione del pannello), con un dialogo che
  riprende i parametri di `/dungeon` e il numero di PG della campagna. Il
  motore è `public/app/dungeon-motore.js`, generato dal sito; un test
  confronta i due motori su 24 dungeon. Provato in Chromium (11 stanze, 80
  muri, 3 pedine, annullabile con Ctrl+Z) e nello smoke test del desktop.
  Incolla/Da file restano per gli export della pagina. Descrizione originale:
  Il tester non è riuscito a creare un dungeon. Il percorso esiste
  (menu "⋯" → "Genera un dungeon ↗", e la sezione "Generatore di dungeon" del
  pannello) ma è in due passi: si genera su `/dungeon` in un'altra scheda, si
  copia il JSON e si torna a incollarlo. Sul **desktop** `/dungeon` è una
  pagina Next che il pacchetto Electron non contiene, e
  `setWindowOpenHandler` in `desktop/main.cjs` apre fuori solo gli `https://`:
  il bottone non fa niente. Da chiarire quale versione ha provato. Il motore è
  puro (`src/lib/dungeon/engine.ts`): generarlo dentro l'editor toglierebbe
  sia il giro di copia-incolla sia la dipendenza dal sito.
- [x] **Sfondo sotto la griglia, non sopra.** Fatto il 22 settembre:
  `#bg-grid` in `renderCanvas` ridisegna la maglia sopra l'immagine con
  `pointer-events="none"` e segue sposta/ridimensiona (`updateBgAttrs`). Usa
  un pattern suo (`#grid-bg`, linea doppia scura+chiara): `--grid` è il 9%
  dell'accento e su un'immagine spariva. Verificato in Chromium su fondo
  nero, rosso e bianco; in "Sposta/Ridim." il clic arriva ancora
  all'immagine. Restano aperti i due punti "da valutare" qui sotto.
  Lo sfondo per livello esiste già
  (sezione "Sfondo della pianta": carica, sposta/ridimensiona, opacità), ed è
  esattamente la richiesta "bolla città con la mappa della città dentro". Ma
  in `renderCanvas` (`mappa.js`) l'`<image id="bg-img">` è disegnata **dopo**
  il rettangolo della maglia, quindi la copre: il tester vuole la griglia
  sopra la mappa per misurarci le distanze. La maglia va ridisegnata sopra lo
  sfondo con `pointer-events:none`, lasciando il rettangolo `data-bg` sotto
  (è lui che riceve i clic sullo sfondo). Da valutare: l'aggancio di una
  dimensione dell'immagine a quadretti interi, e rendere la sezione più
  scopribile — il tester ha chiesto una funzione che c'era.
- [x] **Aprire un'immagine in una finestra propria** — fatto il 22 settembre:
  bottone "In finestra ↗" nella sezione dell'immagine di riferimento,
  `apriInFinestra` in `pannello.js`. Una finestra sola per nome
  (`runebog-immagine`): l'immagine dopo arriva dove la prima è stata
  trascinata. Si scrive dentro un about:blank invece di navigare all'URL, così
  valgono sia i `data:` sia `/immagini/[chiave]`. Il desktop ammette solo
  quella finestra (`setWindowOpenHandler`), e lo smoke test lo controlla.
  Verificato in Chromium: si apre, la seconda immagine rimpiazza la prima
  nella stessa finestra, l'editor resta attivo. Testo originale:
  **Aprire un'immagine in una finestra propria**, trascinabile su un
  secondo schermo mentre si continua a lavorare. Oggi c'è solo il lightbox
  modale (`pannello.js`), che blocca l'editor. Un `window.open` con la sola
  immagine; per le immagini ancora in base64 (standalone) serve un URL `blob:`,
  perché i browser bloccano la navigazione verso `data:`. Sul desktop il
  `setWindowOpenHandler` va aperto a queste finestre. Parente stretto del
  tavolo dei giocatori, che è già "la cosa da mostrare sull'altro schermo".
- [x] **Caselle di testo sulla mappa** — fatto il 22 settembre: tipo di
  nodo `testo` (`isTesto`, `TESTO_BOX`, `testoSize` in `modello.js`), voce
  "Testo" nella palette, resa con `foreignObject` in `renderCanvas`, pannello
  suo (`testoDetailHTML`: testo, quattro grandezze, colore). Il testo è
  `notes`, l'altezza segue il contenuto (`adattaTesto`), la larghezza si
  tira. `enterNode` è il cancello unico: "entrare" in una casella mette il
  cursore nel testo. Solo DM: `DM_ONLY_NODES` in `share.ts` la toglie anche se
  `shared`, con test in `test/critici/proiezione-tavolo.test.mjs`. Contratto:
  `testo` fra i tipi, `textSize` numerico. Verificato in Chromium su scrivania
  e a 390px col tocco. Da decidere se e come mostrarle al tavolo.
  Richiesta originale: **Caselle di testo sulla mappa**: testo libero visibile sulla tela
  (dentro la bolla di un PNG, per esempio), senza dover aprire una nota.
  È un tipo nuovo **persistente**, quindi tocca tutti i confini: forma in
  `SHAPES` e nella whitelist di `formato-campagna.js` (il test di `test/scala/`
  lo impone), `sanitizeState`, proiezione in `share.ts` (condivisa o solo DM),
  e il disegno che deve restare leggibile a ogni zoom.
- [x] **Scala del quadretto per livello.** Fatto il 22 settembre insieme
  agli esagoni (voce sotto): `n.griglia = {forma, cella, metri}` sul nodo del
  livello, letto solo da `grigliaDi` (`modello.js`), che senza campo torna la
  maglia storica (quadrata, 40px, 1,5 m) — nessuna migrazione. Oltre ai metri
  si sceglie anche il lato in px, per allineare la maglia a uno sfondo
  caricato: piante e muri si agganciano alla maglia del LORO livello, e `len`
  di un muro è in celle di quella maglia. Righello, aree d'effetto, barra della
  scala e tabellone d'iniziativa leggono il livello aperto (`deps.griglia` in
  `main.js`, getter nel `ToolContext`). Limiti una volta sola in
  `formato-campagna.js` (`GRID_FORMS`, `GRID_LIMITS`), usati da contratto,
  `safeGriglia` e `projectGriglia` in `share.ts`. Descrizione originale:
  "Dentro ogni bolla decidere quanto misura un quadretto", di default 1,5 m.
- [x] **Griglia esagonale per livello.** Fatto il 22 settembre: sezione
  "Griglia" nel pannello del livello, con punta in alto e lato piatto in alto.
  Matematica assiale in `modello.js` (`cellaEsagono`, `centroEsagono`,
  `celleFra`, `passoMaglia`, `vettoreMaglia`, `tasselloMaglia`); il lato
  piatto è la stessa maglia trasposta. Deciso cosa vale sugli esagoni:
  segnalini e pedine al centro dell'esagono, righello e aree in esagoni
  (intere), frecce/duplica/incolla per vettori di maglia; **piante e muri
  restano liberi** (`inScala` è falso), perché una stanza rettangolare non ha
  incroci ortogonali dove appoggiarsi. Il dungeon importato è un livello suo
  e nasce a quadretti. Test in `test/scala/griglia.test.mjs`; provato in
  Chromium (disegno, frecce che tornano allo stesso esagono, righello "3 es",
  riapertura e tavolo con la stessa maglia del DM).
- [x] **Barra a menu al posto della barra piena di bottoni.** Fatto il 22
  settembre in `public/app/barra-menu.js`: File, Modifica, Visualizza,
  Strumenti, Aiuto in topbar (su telefono e coricato un solo ☰ con le cinque
  sezioni in fila) e la palette raggruppata in quattro tendine, col gruppo
  utile nel livello segnato in grassetto. Nessun comando nuovo né perso: ogni
  voce chiama la funzione del bottone che sostituisce, e la barra completa di
  prima resta a un clic (Visualizza › Barra completa; ritorno dal ⋯),
  ricordata in `runebog-ui`. Di passaggio: l'Escape che chiudeva un menu
  arrivava anche alle scorciatoie della mappa. Verifica in
  `test/browser/verifica-barra-menu.mjs` (35 controlli: scrivania, telefono,
  tavolo).
- [x] **Copia, taglia e incolla le bolle, anche fra livelli.** Fatto il 22
  settembre in `public/app/appunti.js`: Ctrl+C/X/V, "Copia"/"Taglia" nel menu
  di una bolla (tutta la selezione), "Incolla qui" nel menu della tela.
  Taglia toglie subito; il primo incolla di un taglio è uno SPOSTAMENTO e
  tiene gli id, così pedine e iniziativa che puntavano lì restano valide; gli
  incolla successivi sono copie via `duplicaNodi`. Gruppo spostato di quadretti
  interi, validato su una copia della campagna prima di scriverlo. Solo nella
  stessa campagna (un'altra la rifiuta con un messaggio). Verificato in
  Chromium: taglia della locanda con la sua sala e incolla in un'altra bolla
  con gli stessi id, secondo incolla con id nuovi, Ctrl+Z, due bolle collegate
  copiate con l'arco e i nemici rimappati. Descrizione originale: "Come su
  Windows": una bolla con tutte le sottobolle, o più bolle selezionate nello
  stesso livello, portate in un'altra bolla o città. La base c'è già:
  `duplicaNodi` (`duplica.js`) rimappa id, nemici, archi, muri e iniziativa
  sull'intera selezione, e `duplicateSelected` la usa nello stesso livello.
  Mancano gli appunti (in memoria, o in `localStorage` per incollare in
  un'altra campagna), Ctrl+C/X/V, le voci nel menu contestuale e l'incolla nel
  livello corrente. Da decidere:
  - **Taglia** toglie subito, e Ctrl+Z rimedia. Con la rimozione rimandata
    all'incolla si potrebbe incollare una bolla dentro una sua sottobolla,
    cioè un ciclo nell'albero.
  - **Riferimenti che escono dalla selezione**: una pedina che punta a un
    nemico non copiato, un arco verso una bolla rimasta dov'era. Nello stesso
    livello `duplicateSelected` li tiene; altrove vanno lasciati cadere.
  - **Fra due campagne**: i `playerId` non esistono nell'altra, e le immagini
    cloud appartengono alla campagna d'origine (vanno ricopiate come fa
    l'import cloud).

## Fix dalla code review del 18 settembre 2026

**Chiusi tutti i fix della review** (18–19 settembre), compresa la verifica
browser delle pedine importate. Completato anche il lavoro sulle immagini
fuori dal JSON: dettagli nella sezione dedicata. I test usano dati sintetici;
nessuna modifica ai database dell’app, nessuna migrazione nuova.

Verifica finale del 19 settembre: `npm test`, `npx tsc --noEmit` e build di
produzione superati; 23 controlli su PostgreSQL reale e 73 controlli browser
(13 funzionalità, 27 conflitti cloud, 6 aggiornamento fra due build SRD,
27 regressione offline). Le API cloud dei test browser sono simulate;
gli handler immagini sono verificati separatamente su PostgreSQL sintetico.

- [x] **P1 — Validare l'import dungeon per impedire XSS.**
  `public/app/dungeon.js`, `importDungeon` / `dungeonFromExport`, e
  `public/app/mostri.js`, `newFoe` / `foeCard`: per un mostro non presente
  nella SRD, `m.hp` arriva senza validazione negli attributi HTML dei PF.
  Riprodotta l'iniezione nel markup con un valore contenente una chiusura
  d'attributo e un elemento `img` con `onerror`. Validare tipi e limiti
  dell'export prima della conversione, verificare il documento risultante
  prima di inserirlo nello stato e proteggere le interpolazioni HTML.
  Verifica: file ostile rifiutato senza mutare la campagna o eseguire codice;
  export legittimo del generatore ancora importabile. Aggiungere una
  regressione sul percorso di importazione, non solo sul validatore isolato.
  Implementato il 18 settembre: `dungeon-formato.js` controlla tipi, griglia,
  quantità e dimensioni prima della conversione; la campagna candidata viene
  validata interamente su una copia prima dell'inserimento. PF normalizzati
  anche nella creazione e nel rendering dei nemici (compreso il totale).
  `test/critici/dungeon-import.test.mjs`: export reale, payload XSS, quantità
  e geometrie ostili, limite cumulativo e JSON malformato/fuori misura; i
  rifiuti lasciano stato e salvataggio intatti. Moduli applicativi reali con
  confini UI simulati; nessuna verifica browser dell'esecuzione di script.

- [x] **P1 — Conservare lo stato della scheda che riceve un conflitto cloud.**
  `public/app/stato.js`, ramo `409` di `cloudPush`, e
  `public/app/sync-cloud.js`: la copia locale proposta viene riletta da una
  chiave `localStorage` condivisa fra schede. L'ACK della scheda A può averla
  sostituita prima che B gestisca il 409: il dialogo di B propone A come
  locale e come cloud, perdendo B alla scelta; anche «Esporta entrambe»
  esporta le versioni sbagliate. Riprodotto con risposte simulate.
  Costruire il recupero dallo snapshot corrente della scheda e separare le
  copie pendenti delle diverse schede. Verifica: due schede dello stesso
  browser, ACK di A prima del 409 di B; controllare contenuto dell'export,
  recupero di B e conservazione di A, anche dopo chiusura e riapertura.
  È un caso aggiuntivo rispetto alle verifiche del 6 agosto riportate sotto.
  Chiuso il 19 settembre: il 409 fotografa lo stato corrente della scheda,
  incluse le modifiche durante la PATCH e nel debounce. Le copie pendenti
  hanno chiavi immutabili e indipendenti; l'ACK elimina solo la copia della
  propria scheda, e la riapertura propone le copie residue una per volta.
  Restano leggibili le vecchie cache. Il dialogo ferma anche il timer già
  accodato, e a quota piena si conserva l'ultima copia persistita segnalando
  che l'ultima modifica è solo in memoria. Il successore viene scritto prima
  di eliminare il precedente: serve spazio temporaneo per entrambe le copie.
  Verifiche: `npm test`, `npx tsc --noEmit`, build con database fittizio;
  `node test/browser/verifica-conflitti-cloud.mjs`, **27 controlli Chromium**,
  con due pagine nello stesso contesto e API simulate, senza database reale.
  Coperti export A/B, ultima battuta durante la richiesta, pausa del debounce,
  entrambe le scelte, chiusura e riapertura in un nuovo contesto con il solo
  storage persistito, due copie offline e modifica durante l'ACK. Come già
  chiarito il 6 agosto, «Recupera locale» sostituisce A nel cloud esplicitamente;
  «Esporta entrambe» e «Conserva cloud» lasciano A sul server.

- [x] **P2 — Rimappare i riferimenti quando si duplica una zona.**
  `public/app/mappa.js`, `duplicateSelected`: cambiano gli ID dei nodi e
  degli archi, ma `foe.nodeId` e i riferimenti in `battle.order` continuano
  a puntare agli incontri originali. Riprodotto duplicando un contenitore
  con incontro, pedina e iniziativa. Creare una mappa degli ID per tutta la
  selezione e aggiornare in un secondo passaggio i riferimenti interni,
  conservando quelli intenzionalmente esterni (per esempio i PG).
  Verifica: PF e iniziativa della copia risolvono i mostri copiati e restano
  corretti dopo la cancellazione dell'originale; coprire anche più nodi
  selezionati insieme.
  Chiuso il 19 settembre: `duplica.js` assegna gli ID in due passaggi sull’intera
  selezione, compresi nemici, iniziativa e muri. Test unitari sui riferimenti
  fra fratelli e su quelli esterni; Chromium prova `duplicateSelected` e
  risolve nome/PF/iniziativa dopo aver cancellato l’originale.

- [x] **P2 — Rendere atomico il consumo dei token di reset password.**
  `src/lib/reset-token.ts`, `consumeResetToken`: SELECT e DELETE separati
  permettono a due richieste simultanee di consumare lo stesso token.
  Usare una sola `DELETE … WHERE … RETURNING`, con controllo della scadenza,
  e valutare una transazione con l'aggiornamento della password in
  `src/app/auth-actions.ts`. Verifica contro un database di prova: due
  richieste concorrenti con lo stesso token, una sola autorizzata; token
  scaduto o già consumato rifiutato. Rilievo da lettura del codice, non
  ancora riprodotto su database al momento della review.
  Chiuso il 19 settembre: `reset-token-sql.ts` usa DELETE con RETURNING e,
  nel reset completo, una CTE con UPDATE nello stesso statement. L’hash viene
  calcolato dopo un preflight economico e prima del consumo definitivo.
  PostgreSQL 17 usa-e-getta: due consumi concorrenti e otto reset concorrenti,
  un solo vincitore; scaduti/usati rifiutati; un UPDATE fallito conserva il
  token e il retry funziona. Nessuna transazione interattiva sul driver Neon.

- [x] **P2 — Collegare ai giocatori le pedine create dall'import dungeon.**
  `public/app/dungeon.js`, ciclo `pcs.forEach`: viene copiato il nome ma
  manca `tk.playerId = pl.id`. Aggiungere il riferimento usato da
  `tokenLink` e `placePlayer` in `public/app/battaglia.js`.
  Verifica: dopo l'import nome e PF seguono la scheda PG; «Metti in campo
  i PG» riconosce le pedine esistenti e non ne crea duplicati.
  Implementato insieme al P1: `tk.playerId = pl.id`, con regressione sul
  documento importato. Verificato il 19 settembre in Chromium: nome e PF
  seguono la scheda PG; «Metti in campo» non aggiunge una seconda pedina.

- [x] **P2 — Invalidare la cache SRD anche quando cambia l'interfaccia.**
  `src/app/sw.js/route.ts`, `versioneRegole`, e
  `src/lib/offline/sw-sorgente.js`, `primaLaCache`: l'impronta include dati
  e URL, ma non componenti, ricerca e stili. Un deploy solo dell'interfaccia
  può lasciare gli utenti sulla vecchia pagina anche online.
  Includere le sorgenti pertinenti o un identificatore del relativo build
  nella versione. Verifica browser su due build: scaricare le regole nella
  prima, modificare soltanto l'interfaccia nella seconda e controllare che
  HTML e risorse vengano aggiornati mantenendo il funzionamento offline.
  Chiuso il 19 settembre: `versione-regole.ts` include componenti, ricerca,
  stili/layout condivisi e lockfile, oltre a dati e URL. Il worker preferisce
  la cache corrente e riscarica con `cache: reload`.
  Due build reali che cambiano solo pagina/CSS: nuova cache, HTML e CSS nuovi
  online e offline. La prova ha trovato anche un difetto precedente: i chunk
  dei capitoli mancavano e Next sostituiva il testo SSR con un errore. Ora si
  raccolgono i chunk da tutte le pagine, con deduplicazione; un download
  incompleto conserva la versione precedente. `verifica-aggiornamento-srd.mjs`.

## Prossimi passi, in ordine

Scritti per essere ripresi **a freddo**: ognuno dice dove si tocca e quale
ostacolo è già stato misurato, così non si rifà l'indagine. L'ordine è di
consiglio, non di vincolo. Le voci per esteso stanno nelle sezioni sotto.

- [x] **P1 — Non coprire la mappa quando si seleziona una bolla su schermo
  stretto.** Su telefono e in una finestra desktop larga al massimo 760px, il
  `pointerdown` seleziona subito la bolla e `mobileDetailSync()` apre
  automaticamente `#detail`: il bottom sheet arriva al 62% dell'altezza e
  rende difficile continuare a usare la tela. Con un long-press si aggiunge
  anche il menu contestuale sopra al pannello. La selezione deve restare
  visibile sulla mappa senza aprire il foglio; i dettagli si aprono solo con
  un gesto esplicito (il pulsante flottante esiste già). Le azioni esplicite
  del menu contestuale che richiedono il pannello, come «Rinomina» ed
  «Etichetta», devono invece aprirlo prima di portare il focus al campo.
  Toccare `public/app/pannello.js` (`mobileDetailSync`) e
  `public/app/menu.js` (azioni che entrano nel dettaglio), senza cambiare il
  pannello laterale desktop. Verifica: tap, trascinamento e long-press su bolla,
  collegamento e muro a 390px e 760px; finestra desktop stretta con mouse;
  apertura/chiusura esplicita, focus di «Rinomina»/«Etichetta» e tela ancora
  utilizzabile con il pannello chiuso.
  Chiuso il 19 settembre 2026: `mobileDetailSync()` segue soltanto
  `detailOpen`, quindi tap e selezione aggiornano il contenuto senza aprire il
  foglio; «Rinomina» ed «Etichetta» passano da `openDetailSheet()`. Il menu
  contestuale è confinato alla finestra e, fino a 760px, al 60% dell'altezza,
  con scorrimento interno. Aggiunta
  `test/browser/verifica-pannello-mobile.mjs`; 12/12 controlli a 390px touch e
  760px mouse. La fixture Chromium ora riconosce anche la cache e il bundle
  correnti di Playwright su macOS. `npm test` (124), `npx tsc --noEmit` e build
  di produzione superati.

**Chiusa: la copia offline** (2 ago 2026), comprese le tre lacune che il primo
giro aveva lasciato aperte: la porta d'ingresso senza rete, la ricerca che
reggeva per fortuna e l'installazione a schermo intero. I due commit
(`14cdc41`, `4280c90`) sono su **`main` e spinti**, quindi **pubblicati su
runebog.app**. Vedi "Il 2 agosto 2026, in breve" qui sotto.

**Chiuse: le due verifiche che aspettavano un database** (6 ago 2026),
l'atomicità del 409 e il 422 con una sessione vera. Erano ferme dal 24 e dal 25
luglio con lo stesso ostacolo, e il branch Neon usa-e-getta lo toglie. 39/39, un
difetto trovato e corretto per strada, e **una riga di questo file che diceva
una cosa falsa**. Vedi "Il 6 agosto 2026, in breve" qui sotto.

**L'audit del 28 lug 2026 (16/20) è chiuso per intero**: i tre P1, tutti i P2
(bordi di componente il 28 lug; i due canali del tabellone d'iniziativa, il
polling del tavolo, la fascia d'iniziativa e i bersagli da 44px il 29) e i due
P3 (il nome dell'immagine di riferimento e il riempimento d'accento, che si è
portato dietro il bottone flottante). Il 29 lug sono chiuse anche le due code
che restavano in questo elenco: i **due comandi che a riposo non si vedevano**
(maniglia del pannello e ★ delle quest) e il **telefono coricato**, dove la
misura ha rivelato un difetto molto più grande di quello che la voce
descriveva — sopra i 760px di larghezza la tela usciva alta zero — poi chiuso
anche nel pannello dettagli (tetto a 40vw). Le voci per esteso stanno in
"Cosa resta dell'audit", in fondo al file. La sezione regole è completa
(dieci capitoli più il bestiario).

Il 29 lug è chiuso anche **il contenuto che usciva dalla sagoma** (`dentro` in
`SHAPES`, `contentBox` in `modello.js`): la voce per esteso, con quel che la
misura ha spostato, sta in "La scala della campagna".

Chiusa lo stesso giorno anche **la barra PF dei mostri**: una ricetta sola per
le due barre, le fasce spostate dallo `style` inline al CSS e due coppie nuove
in `COPPIE`. La misura ha spostato il bersaglio — non era la pista contro il
pannello ma il **riempimento contro la pista**, sotto 3:1 in sei casi su
trentasei e proprio a pochi PF. Voce per esteso in fondo.

### Il 6 agosto 2026, in breve

**La palette si porta dove serve.** Seconda parte della giornata, ed è di nuovo
la rimisura ad aver spostato il difetto: i numeri di questa voce (2368px, 16%)
erano quelli di prima che i comandi uscissero dallo scorrimento. Rifatti col
dito a 390×844: **1872px su 370 visibili (20%), 5,1 schermate, 2 voci su 16** —
ma soprattutto Territorio a 0 e **Segnalini a 3,6 schermate**, cioè la barra è
ordinata al rovescio di quanto si usano le cose. Ora `allineaPalette`
(`mappa.js`) la porta da sé sul gruppo del livello: **zero** passate di dito
dove prima ne servivano 3,6. 15/15, con la scrivania come gruppo di controllo.
Voce per esteso in "La scala della campagna".

**Decisi i tre confini che restavano sulle immagini fuori dal JSON**: mai
cancellare in sincrono (l'undo referenzia ancora ciò che è stato appena
cancellato), URL non indovinabile invece dell'autorizzazione (sennò si perde la
cache, che è il guadagno vero) e — dopo il vincolo posto lo stesso giorno, **solo
cose gratis** — le immagini **in Neon**, in una tabella loro, servite da
`/immagini/[chiave]`. Vercel Blob era stato consigliato ed è ritirato.

- **La domanda "dove" era mal posta**, e per questo la risposta sembrava
  costare: le immagini **sono già in Neon oggi**, in base64 dentro
  `campaign.data`. Una tabella loro non aggiunge un byte allo storage — semmai
  ne toglie, perché il +33% del base64 in `bytea` non si paga (quanto se ne
  recuperi davvero non è misurato: il JSONB passa da TOAST).
- **Il guadagno non dipendeva mai da dove stanno i byte**: dipende dal fatto che
  il documento smetta di portarsele addosso e che l'immagine abbia un URL
  **immutabile**, quindi memorizzabile in cache per sempre. Tutte e due si hanno
  senza dipendenze nuove.
- Fuori da `/api` di proposito, così la copia offline potrà un domani tenerle:
  l'invariante esclude `/play`, `/tavolo` e `/api` perché quelle risposte
  **invecchiano**, e un'immagine a chiave immutabile no.
- **Con essi cade l'ultima decisione in sospeso del backlog**, e non resta niente
  da provvedere. Voce per esteso in "Immagini fuori dal JSON".

**E i primi due passi sono fatti.** La **rotta** `/immagini/[chiave]` è in piedi
e provata contro il database vero (9 casi, compresi i tre condizionali e il MIME
ostile), `IMMAGINE_LOCALE` è **una regola sola** condivisa dai tre posti che
decidono cosa è un riferimento sicuro, e il confronto debole di `If-None-Match`
si è spostato in `src/lib/etag.ts` ora che ha due chiamanti. È saltata fuori
un'esposizione che nessuno dei cinque confini nominava — il `Content-Type` lo
decide una riga di database, quindi va controllato **in uscita** — e sta nella
voce.

**Il primo passo**: `drizzle/0002_immagini-fuori-dal-json.sql`
(tabella `campaign_image`), applicata a **entrambi** i branch Neon col backup di
produzione prima (`backup-pre-immagini`). Le due cascate — utente e campagna —
sono state **provate** su un branch usa-e-getta, non dedotte dal vincolo.
Nessuna riga di codice usa ancora la tabella, quindi il deploy non è vincolato a
niente e un rollback del solo codice è innocuo: la tabella in più non dà
fastidio, **non toglierla** durante un'emergenza.



**Le due verifiche che aspettavano un database.** `npx tsc --noEmit`,
`npm test` (99), `npm run build` e `npm run temi:contrasto` puliti,
l'autoverifica della fixture 13/13. Nessuna migrazione. La verifica è
usa-e-getta (scratchpad, buttata): **39 controlli** su un branch Neon
`verifica-409-422` creato da `dev` con `expiresAt`, con `npm run dev` puntato
lì, un account registrato dal form vero e sei campagne cloud.

- **Il 409 con due schede, e tutte e tre le azioni.** «Esporta entrambe» non
  chiude e non sceglie (il backup contiene entrambe le versioni); «Conserva
  cloud» non fa avanzare la revisione e rimarca la copia locale come
  sincronizzata; «Recupera locale» ribasa e riscrive. Con il dialogo aperto una
  modifica ulteriore **non parte** (`cloudPaused`): provato aspettando 2,5 s e
  rileggendo il server.
  - **Questo file diceva una cosa falsa**, ed è la misura ad averlo detto: la
    voce chiedeva che «la versione di A resti intatta qualunque delle tre azioni
    si scelga». Con «Recupera locale» la versione di A **viene sovrascritta** —
    è tutto il senso di quell'azione, ed è esplicita perché l'utente ha appena
    guardato l'altra versione. Le azioni che lasciano il server intatto sono
    due, non tre. La frase giusta è che **nessuna delle tre sovrascrive in
    silenzio**.
- **La corsa vera, che due schede non sanno riprodurre**: otto PATCH
  concorrenti dalla stessa `baseRevision` → **una** 200, **sette** 409, e la
  revisione avanza di uno solo. Con la **controprova**: riscritta la PATCH come
  "leggi-poi-scrivi" (la forma che quel `where` esiste per evitare), le stesse
  otto richieste danno **sei 200** e la revisione salta a 6, cioè cinque
  sovrascritture silenziose. È il controllo che un giro con due schede non può
  dare, perché a mano le due PATCH non partono mai davvero insieme.
- **Il 422 con la sessione vera**: un titolo di 501 caratteri esce come
  «Non sincronizzato: Massimo 500 caratteri ($.root.title) · copia locale
  conservata», la cache locale contiene davvero il documento rifiutato ed è
  marcata `pending`, il server non si muove. **Controprova**: a 500 caratteri lo
  stesso salvataggio passa e la revisione avanza — il rifiuto viene dalla
  lunghezza, non da un percorso di salvataggio rotto.
- **Provato anche il resto di quell'elenco**: offline + scheda chiusa +
  riapertura (esce il dialogo del **recupero**, non del conflitto, e il lavoro
  arriva nel cloud); la copia locale di una campagna **non** viene proposta per
  un'altra; una modifica fatta **durante** la PATCH con la rete rallentata a
  2,5 s produce due scritture sequenziali e non si perde.
- **Il difetto trovato per strada, e nessuno l'avrebbe visto a occhio**
  (`sync-cloud.js`): il dialogo della cache `legacy` dice «**controlla il
  titolo** prima di recuperarla», e un titolo non lo mostrava — l'unico modo di
  controllarlo era recuperare la copia, cioè fare esattamente la cosa di cui si
  è incerti. Ora la didascalia porta i due titoli accanto alle due date. È il
  caso che questo file segnalava come «vale la pena guardarlo con un account
  vero prima di dormirci sopra»: guardato, ed era rotto.
- **Due trappole dell'ambiente, per chi rifà il giro**: dopo la registrazione la
  scheda resta quella di prima finché non si **ricarica** (il server action fa
  `signIn` + `redirect`, il cookie c'è ma in dev l'RSC no), e le campagne di
  prova conviene crearle da `POST /api/campaigns` invece che dal bottone, sennò
  si sta provando il comportamento di Next e non quello che interessa.

### Il 2 agosto 2026, in breve

**La copia offline.** `npx tsc --noEmit`, `npm test` (99), `npm run build` e
`npm run temi:contrasto` puliti; `node test/browser/verifica-offline.mjs` 19/19.
Nessuna migrazione. Il ragionamento per esteso sta in CLAUDE.md, "La copia
offline"; qui restano le cose che la misura ha spostato.

> **Stato: su `main`, spinto** (il branch `copia-offline` è stato integrato e
> non esiste più). Primo giro
> (`14cdc41`) — nuovi: `src/app/sw.js/route.ts`, `src/lib/offline/sw-sorgente.js`,
> `public/app/offline.js`, `src/app/srd/offline-regole.tsx`,
> `test/browser/verifica-offline.mjs`. Modificati: `public/app/main.js` (chiama
> `initOffline` per ultimo), `public/app/menu.js` (la riga di stato nel menu ⋯),
> `src/app/srd/page.tsx` e `src/app/srd/srd.css` (il bottone in fondo a /srd),
> più CLAUDE.md e questo file.
>
> Secondo giro (la testa del branch), le tre lacune — nuovi: `public/offline.html` (la pagina di
> ripiego), `src/app/manifest.ts`, `scripts/genera-icone.mjs` e `public/icone/`
> (generata: non si tocca a mano). Modificati: `sw-sorgente.js` (`ripiegando`,
> `chunkDiNext`, `iChunkDellaRicerca`), `public/app.html` (manifesto e i tre tag
> di iOS), `src/app/layout.tsx`, `offline-regole.tsx` (la misura sul bottone:
> 1,3 → 1,5 MB) e la verifica.
>
> **La verifica vuole `npm run build && npm run start`, non `npm run dev`** — in
> dev le pagine SRD si compilano su richiesta e scaricarne 61 va in timeout, e
> `/sw.js` sarebbe una funzione invece dell'asset che si vuole provare. È la
> trappola che costa mezz'ora se non la si sa.

- **Il lavoro era molto meno di quanto sembrasse**: l'app offline lo era già —
  `/app.html` in standalone non fa una richiesta di rete dopo il caricamento —
  e mancava solo che il browser tenesse i file. Misurato: **225 KB gzip**
  l'editor intero (38 file), **1,38 MB** le 61 pagine SRD più **149 KB** di
  chunk perché anche la ricerca funzioni.
- **Il pacchetto da scaricare è stato provato e scartato**, e non per gusto: i
  moduli ES da `file://` cadono per CORS (origine opaca), quindi un HTML
  scaricato si apre bianco. Servirebbe un bundler, cioè il build che qui non
  c'è.
- **Due difetti trovati dalla prova, nessuno dei due visibile a occhio.**
  «Le **0** pagine delle regole sono sul dispositivo»: `pagine` usciva solo
  insieme a un deposito che ancora non esisteva, cioè mai prima di doverlo
  scrivere — si vede una volta sola, la prima. E soprattutto: la copia vecchia
  delle regole **sopravviveva senza essere letta**, perché la lettura andava al
  solo deposito corrente. La guardia "non buttare finché la nuova non è
  arrivata" proteggeva dei byte, non il DM. Corretto con `caches.match` senza
  nome.
- **Un deploy non si finge con `unregister()` + `register()`**: con un client
  ancora controllato quella coppia resuscita la registrazione, l'`activate` non
  gira e la verifica passa guardando il lavoro di prima (misurato: il deposito
  dell'editor cancellato a mano non veniva mai ricreato). Si cambia l'**URL**
  dello script.
- **Resta fuori**: `/dungeon` (chunk hashati: precaricarlo vorrebbe enumerare
  l'output del build), il login e le campagne cloud. Offline quei tre indirizzi
  rispondono comunque con la pagina di ripiego, che lo dice.
- **Da tenere d'occhio**: in offline puro `localStorage` è l'unica copia della
  campagna, e con le immagini in base64 il tetto dei ~5 MB si sente prima del
  limite di 4 MB del cloud.

#### Le tre lacune, chiuse lo stesso giorno

Erano misurate in ordine di valore, e in quell'ordine sono state chiuse. Il
ragionamento per esteso sta in CLAUDE.md, "La copia offline"; qui resta quel che
la misura ha spostato.

1. **La porta d'ingresso** (`public/offline.html`): una pagina di ripiego per le
   navigazioni che cadono, **non** un redirect — offline `/app.html` è lo
   standalone su `localStorage`, un'altra cosa dalle campagne cloud, e
   scambiarle senza dirlo sarebbe la perdita silenziosa che tutto il resto
   evita. Sta in `public/` e non è una rotta Next: così il manifesto la
   precarica da sé e la pagina non dipende da un solo chunk di Next, che offline
   è proprio ciò che può mancare.
   - **Il rischio vero era un altro, e andava provato**: con il worker in mezzo,
     una navigazione che il server reindirizza. Si passa `ev.request` così com'è
     a `fetch` (una navigazione ha `redirect:"manual"`, quindi il 3xx torna
     opaqueredirect e il salto lo fa il browser); ricostruire la richiesta
     avrebbe rotto la home di **ogni utente loggato**, che fa `redirect` verso
     l'ultima campagna. Verificato sulle due 308 di Next (`/srd/`,
     `/srd/classi/`).
   - Il ripiego **non** copre `/play`, `/tavolo` e `/api`: lì la regola resta
     "si lascia fare al browser", una riga sola invece di due.
2. **La ricerca** (`chunkDiNext`, `iChunkDellaRicerca`): cache-first sui chunk,
   dentro il deposito delle regole. La regola a runtime **da sola non bastava**,
   ed è stato l'imprevisto del giro: quei file il browser li ha già presi
   aprendo `/srd`, cioè prima che esistesse il deposito in cui scriverli, e non
   li richiede più — chi premeva il bottone e staccava la rete si trovava le
   regole intere e la ricerca muta. Da lì la lettura dei nomi **dall'HTML appena
   salvato**, che è anche l'unica fonte che non può disallinearsi.
   - Costo misurato: 149 KB, che portano il bottone da 1,3 a **1,5 MB**. Una
     domanda a cui si può rispondere è una domanda che dice quanto costa
     davvero.
   - Si prova solo **svuotando la cache HTTP** (`Network.clearBrowserCache` via
     CDP, Cache Storage intatta): a cache calda funziona anche quando è rotta.
3. **L'installazione** (`src/app/manifest.ts`, `public/icone/`): `start_url` è la
   **home** e non `/app.html`, per la stessa ragione del punto 1. Le icone si
   generano da `src/app/icon.svg` (`node scripts/genera-icone.mjs`) invece di
   essere ridisegnate: una seconda icona diventa una seconda idea di come si
   chiama questo prodotto. `app.html` porta a mano manifesto e tag di iOS —
   Next lì non passa — e i colori restano quelli di Torbiera: sono file statici,
   il tema sta in `localStorage`.

### Il 31 luglio 2026, in breve

Tutto spinto su `main` (`9822310` → `c7b47f7`, quindi **pubblicato su
runebog.app**), con `npx tsc --noEmit`, `npm test` (99) e `npm run build`
puliti. Nessuna migrazione: lo schema non è stato toccato. Tre cose chiuse e
due decise.

- **L'ETag del polling del tavolo**, che era il primo di questo elenco e
  sembrava bloccato: l'ostacolo annotato ("crearne una sarebbe scrivere sui
  dati di qualcun altro") si scioglie con un **branch Neon usa-e-getta**, che
  di `dev` è una copia isolata — la ricetta sta qui sotto, in "Come si
  riprende una di queste voci", e vale per le altre due verifiche che
  aspettano un database. 15/15 contro il database vero, e per strada sono
  saltati fuori due difetti che nessuna prova a mano avrebbe visto: l'ETag
  della fixture in un formato diverso da quello della rotta, e il confronto di
  `If-None-Match` fatto con `===` invece che debole — **l'unico guasto di
  quella rotta che non si vede**, perché il tavolo funziona lo stesso. Voci
  per esteso in "Sincronizzazione cloud".
- **I comandi della mappa fuori dallo scorrimento della palette**: su telefono
  ⚔ Combattimento stava al pixel 2266 di una barra larga 390, e per quattro di
  quei comandi non esiste un'altra via (le loro alternative sono i tasti F, R
  e A). Anche qui la misura ha spostato il difetto — la voce parlava della
  palette — e ha scoperto il caso peggiore: bottoni schiacciati a 44px con
  l'etichetta **fuori** dal bersaglio. Voce per esteso in "La scala della
  campagna".
- **Le immagini rimisurate con l'encoder vero** (Chromium, non `sharp`): il
  caso normale è ~6 battlemap per documento, non "una campagna enorme", e
  Chrome codifica il 16–18% più pesante di `sharp` su tutto ciò che ha texture.
- **Deciso: l'export resta autosufficiente** — le immagini si re-incorporano
  in base64 all'esporta. È il primo dei cinque confini, quello che decideva lo
  schema. Le tre conseguenze da tenere stanno nella voce.
- **Deciso (misurato): i 4 MB non li impone più Vercel.** Restano una scelta
  di questo repo, e valgono **solo in salita**.

~~**Cosa aspetta una decisione tua**~~ — **niente, dal 6 ago 2026.** I confini
3, 4 e 5 delle immagini sono decisi (mai cancellare in sincrono; URL non
indovinabile; le immagini in Neon, servite da `/immagini/[chiave]`) e la palette
è **fatta**. Da qui in avanti c'è solo da costruire, e non c'è **niente da
provvedere**: nessun servizio nuovo, nessuna variabile d'ambiente, nessuna
spesa. Vincolo posto quel giorno e da tenere: **solo cose gratis.**

**I branch Neon usa-e-getta si cancellano da sé, ed è misurato**:
`verifica-etag-tavolo` non c'era più il 6 ago, com'era scritto. Quello del 6 ago
è `verifica-409-422` (`br-red-fog-asbwruss`, da `dev`), che scade il 7 ago a
mezzogiorno.

Da qui in avanti, in ordine di consiglio:

1. **Le immagini fuori dal JSON** — l'indagine è fatta (30 lug, rimisurata il
   31, sezione sua) e **tutti e cinque i confini sono decisi** (il 1 il 31 lug,
   il 3, 4 e 5 il 6 ago): non resta niente da decidere, resta da costruire.
   Scioglie il tetto di 4 MB della PATCH e alleggerisce ogni apertura
   dell'editor, che oggi riscarica le immagini a ogni giro e non può metterle in
   cache; la quota di `localStorage` invece **non** si scioglie in standalone,
   dove le immagini restano per forza in base64. Il tetto è più vicino di quanto
   dicesse la voce — ~6 battlemap riempiono un documento. Le immagini restano
   **in Neon** (dove già stanno, in base64 dentro il JSONB): niente da
   provvedere, si parte dalla migrazione.

~~2. La palette su telefono~~ — **fatta il 6 ago 2026**, e la rimisura ha di
nuovo spostato il difetto: non era la lunghezza della striscia ma il suo
**ordine**, che va dalla scala più larga alla più stretta, cioè al rovescio di
quanto si usano le cose. Ora la barra si porta da sé sul gruppo che serve al
livello. Voce per esteso in "La scala della campagna".

~~3. Due verifiche che ora si possono fare~~ — **fatte il 6 ago 2026**, 39/39,
con un difetto corretto per strada. Restano quindi **due sole voci**, e sono
entrambe ferme su una decisione tua, non su un ostacolo tecnico.

La migrazione `0001_revisione-campagna` è applicata a **entrambi** i branch Neon
(25 lug 2026: `dev` durante la verifica di P0.2, `production` prima del deploy,
col branch di backup `backup-pre-revision` creato prima): niente blocca il push.
Le prove manuali post-deploy sono in "Sincronizzazione cloud".

**La fixture delle verifiche in Chromium è estratta** (29 lug 2026):
`test/browser/campagna-di-prova.mjs` costruisce e semina la campagna, e accanto
c'è l'autoverifica che lo dimostra. La voce per esteso sta in "Test degli
invarianti critici".

Minori, già annotati al loro posto:
`nodeBox` dà 30×30 a ogni segnalino ma il disco della pedina ne misura 32, un
pixel fra centro geometrico e centro disegnato (per questo `markerR` è una
funzione); il sito non ha condizioni d'uso proprie; un titolo lungo sborda in
orizzontale da una bolla piccola, che è troncamento del testo e non geometria
della forma (in "La scala della campagna"); le rifiniture della sezione regole
in fondo alla sua sezione.

**Come si riprende una di queste voci** (vale per tutte, ed è il giro che le
ultime tre hanno seguito): si **rimisura prima di correggere** — due volte su
tre la misura ha spostato il lavoro, e una volta ha detto che la voce si
sbagliava; le verifiche in Chromium si scrivono nello scratchpad partendo da
`test/browser/campagna-di-prova.mjs` e si buttano, tenendo nel TODO solo il
numero di controlli e cosa provavano; ogni verifica porta un **gruppo di
controllo** (dove il cambiamento NON deve arrivare) e una **controprova**
(rimettere il valore vecchio e guardare cadere le asserzioni), sennò un verde
non dice quale delle due cose è successa. Col dito si misura con `hasTouch`,
sennò `pointer:coarse` non scatta.

**E se la voce dice "serve il database vero"**: si fa un **branch Neon
usa-e-getta** da `dev` (con `expiresAt`, così si cancella da sé), ci si semina
quel che serve e si punta lì il `DATABASE_URL` di `npm run dev` — Next non
sovrascrive una variabile già in `process.env`. È una copia isolata: scrivere,
ruotare un token o rifare una riga non tocca nessun dato di nessuno, e cade
l'ostacolo che teneva ferme queste voci. La migrazione **non** va applicata al
branch di prova, che se l'è già portata dietro da `dev`. La ricetta ha ormai
tolto di mezzo **tre** voci ferme (l'ETag del tavolo il 31 lug, l'atomicità del
409 e il 422 il 6 ago): quando una voce dice «servirebbe un DB di prova», quello
non è più un ostacolo ma un giro di quindici minuti.

**E la sessione vera si registra dal form**, non si semina a mano: `signUpAction`
fa `signIn` e `redirect`, quindi il cookie c'è ma in dev la scheda va
**ricaricata** prima di vedersi loggata — senza il reload si sta guardando la
pagina di prima e sembra che la registrazione non sia passata. Le campagne di
prova si creano poi da `POST /api/campaigns`, che è la rotta vera: il bottone
della home passa da un server action con `redirect()`, e guardare l'URL
proverebbe il comportamento di Next invece di quello che interessa.

## SRD 5.2.1 in italiano (regole 2024)

Fonte: il PDF ufficiale in italiano `IT_SRD_CC_v5.2.1.pdf` (dndbeyond.com/srd,
CC-BY-4.0). Il sito è **italiano-first**: prima tutto in italiano aggiornato alle
regole 2024; l'SRD 5.1 (2014) e la versione inglese vengono dopo.

- [x] **Bestiario in italiano** — fatto (18 lug 2026). Le 331 schede di
  `public/app/srd-mostri.js` (prima: nomi/meta/tratti/azioni in inglese, campi
  numerici a tratti corrotti dalla vecchia conversione — l'Octopus aveva Cos 0 e
  salvezze "+30") ora sono la traduzione ufficiale estratta dal PDF con
  `scripts/estrai-srd-mostri.mjs`: pp. 294–405 (Mostri A–Z + Animali) più la
  p. 282 per la Mosca gigante, l'unica scheda incassata in un oggetto magico.
  Il parser legge l'XML di `pdftohtml`: la semantica sta nei font (colore
  #88191f = titoli/sezioni, Optima #4a0508 = statistiche, `<i><b>` a inizio riga
  = nome di tratto/azione), le colonne si separano a x=440, gli id dei fontspec
  sono cumulativi nel documento. Refuso del PDF gestito (salvezza senza segno
  nell'Int del drago bianco giovane); schede senza azioni legittime (Boleto
  stridente, Mosca gigante). Schema invariato più due campi del formato 2024:
  `init` (Iniziativa) e `gear` (Attrezzatura), ora editabili nella scheda
  (`mostri.js`); azioni bonus e reazioni restano ripiegate in `actions` coi
  marcatori. Verificato: 18/18 in Chromium (ricerca, applica Goblin capo e
  Aboleth, campi in italiano, attribuzione CC-BY, console pulita), `tsc` ok.
- [x] **L'estrattore dei mostri riconosce i colori per relazione tra i canali**
  — fatto (25 lug 2026, stesso giorno della scoperta). Con poppler 26.07 gli
  stessi inchiostri uscivano `#8b2321`/`#510000`/`#616366`/`#221f21` dove
  `ruoloFont` pretendeva `#88191f`/`#4a0508`/`#5a5757`/`#231f20` per uguaglianza
  esatta: ogni frammento cadeva su "corpo" e il bestiario usciva **vuoto**
  (446 byte), senza un errore. Portata la lezione dell'estrattore delle regole:
  cinque classificatori a fasce disgiunte (`grigioServizio`, `grigioTipo`,
  `rossoTitolo` identico a quello delle regole, `rossoStat`), misurati
  sull'intero corpus. Verifica: rigenerato con poppler 26.07 → **byte-identico**
  al file committato a luglio con la resa vecchia, che è la prova che le fasce
  coprono entrambe le quantizzazioni.
- [x] **Allineare il generatore di dungeon al bestiario italiano** — fatto
  (19 lug 2026). I 334 mostri di `src/lib/dungeon/srd-data.ts` erano il dataset
  5.1 in inglese: ora sono 312 voci coi nomi delle schede italiane 5.2.1 e
  `ac`/`hp`/`hpDice`/`cr`/`xp` sincronizzati dal bestiario (`srd-mostri.js`),
  così la card di /dungeon e la scheda agganciata dicono gli stessi numeri.
  Non era una traduzione 1:1: il 2024 rinomina per ruolo (Goblin → "Goblin
  guerriero", Thug → "Bruto", Merfolk → "Marinide schermagliatore"), fonde le
  varianti-forma (licantropi ×3 e vampiro ×3 → scheda unica) e toglie mostri
  dall'SRD (Drow, Orc, Duergar, Lizardfolk, gnomo delle profondità, sciami
  specifici → "Sciame di insetti"): le voci senza controparte sono cadute.
  `type`/`size`/`speed`/`tags` restano dal dataset 5.1 (servono solo al motore,
  che sceglie per tag e GS, mai per nome). L'import (`public/app/dungeon.js`)
  ora **aggancia davvero la scheda**: cerca il nome in `window.SRD_MONSTERS` e
  applica lo statblock completo con la stessa ricetta del bottone del bestiario
  (`statblockSRD()` estratta in `mostri.js`, un solo punto per i due percorsi);
  i dungeon esportati prima di oggi (nomi inglesi) passano dalla mappa legacy
  `public/app/dungeon-nomi.js` (272 voci EN→IT), e un mostro senza scheda 2024
  ripiega sui dati grezzi dell'export come prima. Verificato: 15/15 in Chromium
  (export nuovo e legacy, PF pedine = scheda, tratti/azioni identici alla
  scheda, Orc in fallback, console pulita), `tsc` ok, motore rigenerato in node
  con tutti i mostri estratti dotati di scheda.
- [x] **Sezione regole sul sito** — fatta (22 lug 2026), capitoli dell'SRD
  consultabili in italiano (`/srd`): Come si gioca, Creazione del personaggio,
  Classi, Origini dei personaggi, Talenti, Equipaggiamento, Incantesimi,
  Glossario delle regole, Strumenti di gioco, Oggetti magici, il bestiario e le
  Informazioni legali. Con la dichiarazione di attribuzione richiesta dalla
  licenza in fondo a ogni pagina. **Tutti e dieci i capitoli pubblicati dal 21
  lug 2026**, le Informazioni legali dal 22, i **mostri** dal 22 (voce sotto).
  - [x] **Impianto + Glossario delle regole** — fatto (19 lug 2026). Estrattore
    generico `scripts/estrai-srd-regole.mjs` (fratello di quello del bestiario:
    la semantica sta nei font), registro dei capitoli in `src/lib/srd/index.ts`
    col flag `pronto`, pagine `/srd` e `/srd/[capitolo]` (`blocchi.tsx`,
    `indice.tsx`, `srd.css`). Il testo esce come array di span, non come HTML:
    niente markup da sanificare. Sei tipi di blocco (titoli, prosa, definizioni,
    tabelle, griglie chiave/valore, elenchi a colonne e puntati). Trappole
    risolte: fontspec cumulativi tra le pagine; il rientro NON separa i
    paragrafi (il PDF alterna i due stili) quindi si rompe sul grassetto e sul
    salto verticale; la fusione dei frammenti a 12px mangiava le colonne delle
    tabelle (ora 6px); celle e intestazioni fuse dal PDF si ritagliano
    all'ascissa della colonna successiva, arrotondando allo spazio.
    Verificato: 12.284 parole su 12.294 del PDF (99,9%), zero parole fuse, zero
    trattini di sillabazione sospesi, 9/9 tabelle corrette, 156 ancore univoche,
    filtro dell'indice insensibile ad accenti e maiuscole, nessuno scorrimento
    orizzontale a 390px, console pulita, `tsc` e `build` ok.
  - [x] **Estrattore riparato sul PDF riscaricato + verificatore** — fatto
    (19 lug 2026), venuto fuori attaccando il punto 1 qui sotto. Il PDF
    riscaricato usciva da `pdftohtml` con **il rosso dei titoli reso `#8b2321`
    invece di `#88191f`**: l'estrattore lo confrontava per uguaglianza, quindi
    ogni capitolo perdeva TUTTI i titoli — zero ancore, zero navigazione — e il
    JSON usciva plausibile, con la prosa in grassetto al posto dei titoli.
    Rigenerando il glossario si perdevano le sue 156 ancore in silenzio.
    Colori riconosciuti ora per relazione tra i canali (`rossoTitolo`,
    `grigioServizio`: anche i grigi del piè di pagina erano cambiati, e "202"
    ricompariva come paragrafo). Guardie contro il fallimento muto: un capitolo
    senza titoli non viene scritto e lo script esce con errore.
    Scoperto di seguito che **i font subsettati mettono la "f" nella Private Use
    Area** (quattro codici per la stessa lettera; "effetto" è `e`+U+E01D×2+`etto`):
    sparivano lettere lasciando parole plausibili — "s~~f~~uggire", "~~f~~orma",
    "su~~f~~ficientemente". Mappa `PUA` + `PUA_IGNOTI` che fa fallire su un codice
    nuovo. Poi: legature sciolte in uscita (e `slug` in NFKD, sennò l'ancora di
    "Deﬁnizione" era `de-nizione`), spazi ricostruiti dal gap orizzontale con la
    legatura che alza la soglia invece di azzerarla ("Infiamme"/"Lucefioca") e la
    punteggiatura che lo impone ("Terreno,flora"), sillabazione a fine riga
    (il trattino è un frammento a sé: fondendo gli span *durante* la ricucitura
    `accoda` torna a vederlo, prima usciva "perso- naggi").
    Tabelle: le colonne ora le dettano le **celle** e non le intestazioni (una
    intestazione centrata su tre righe inventava due colonne fantasma), i titoli
    si assegnano col centro, le intestazioni di raggruppamento ("—— Difficoltà
    del combattimento ——") si scartano, e le celle che vanno a capo senza rientro
    si riconoscono come continuazione.
    Nuovo `scripts/verifica-srd-regole.mjs <PDF> <id>`: 10 controlli contro
    `pdftotext` (copertura del testo, titoli, ancore univoche e ben formate,
    PUA, legature, sillabazione, parole fuse, tabelle rettangolari, quota di
    celle vuote). È la condizione per mettere `pronto: true`.
    Verificato: glossario 10/10 e **testo identico** al file versionato blocco
    per blocco (450 su 450), con in più una cella ricomposta meglio
    ("Grande (carro, tavolo da pranzo)", prima spezzata); `tsc` e `build` ok.
  - [x] **Il blocco «scheda» (coppie etichetta/valore)** — fatto (20 lug 2026),
    ed è la stessa forma che servirà alle schede incantesimo, quindi il tipo,
    il rendering React e il CSS sono già in casa quando toccherà a Incantesimi.
    Guardare i dati prima di scrivere codice ha di nuovo pagato: i ~25 riquadri
    degli strumenti non erano schede *da modellare*, erano schede **già
    rovinate**. Il rilevatore di tabelle vedeva due coppie affiancate sulla
    prima riga ("Caratteristica: X" a x=470, "Peso: Y" a x=686), dichiarava due
    colonne e ci incolonnava anche le righe di continuazione — che sono prosa
    andata a capo, non celle: i valori uscivano scambiati fra le etichette.
    Un tipo nuovo a valle non avrebbe recuperato niente; il blocco va
    riconosciuto **prima** di `grigliaLibera`.
    Il riconoscimento non è geometrico ma tipografico, come tutto il resto qui:
    etichetta = font delle intestazioni di cella (GillSans-SemiBold 14) e due
    punti finali, valore = GillSans normale. Le ascisse non servono: le righe
    arrivano già in ordine di lettura, quindi ogni riga di valore appartiene
    all'ultima etichetta vista — anche a cavallo di un cambio di colonna, che
    prima spezzava in due il riquadro dei "Strumenti da soffiatore".
    Reso come `<dl>` (è letteralmente una lista di descrizioni), a due colonne
    sopra i 30rem e impilato sotto: l'affiancamento del PDF risparmiava carta,
    a schermo costringerebbe a scorrere. `Peso` resta al secondo posto, dov'è
    nel PDF.
    Verificato: 25 riquadri su 25 corretti e identici al PDF (`pdftotext
    -layout`), equipaggiamento da 7/10 a **9/10**, i tre capitoli pubblicati
    rigenerati e **byte-identici** (è il controllo che il verificatore non sa
    fare), 390px e 1200px in Chromium senza scorrimento orizzontale né PUA né
    legature, console pulita, `tsc` ok.
  - [x] **I restanti sette capitoli** — tutti pubblicati (20–21 lug 2026), uno
    alla volta. L'ordine non è stato quello del PDF ma quello del valore al
    tavolo incrociato con la difficoltà di estrazione — un capitolo si pubblica
    mettendo `pronto: true` nel registro di `src/lib/srd/index.ts` dopo che
    `node scripts/verifica-srd-regole.mjs <PDF> <id>` passa:
    1. [x] **Strumenti di gioco** (pp. 220–231) e **Come si gioca** (pp. 5–20) —
       pubblicati (20 lug 2026), 10/10 al verificatore entrambi, insieme al
       glossario. Esito del banco di prova: il glossario *era* in parte un caso
       fortunato (vedi la voce sopra), ma sulla prosa il parser regge — copertura
       99,2% e 99,3% del testo di `pdftotext`, 80 e 54 titoli.
       Il difetto che li teneva fuori era uno solo, e comune a tutti e tre:
       **le tabelle a piena pagina**. "Terreno di viaggio" (6 colonne, x=95→803),
       "Azioni" ed "Esempi di effetti dello stress mentale" attraversano la
       separazione fra le colonne di testo (`COLONNA_DESTRA`=440) e venivano
       spezzate a metà. Ora la pagina si legge **a fasce**: la banda si riconosce
       da un frammento che attraversa il gutter (nella prosa a due colonne non
       succede mai — zero su 2484 frammenti del glossario, quindi il rilevatore
       non può far regredire ciò che già funzionava) e si propaga alle righe
       contigue con ruolo da tabella.
       Sono seguiti, tutti scoperti da lì: le righe d'intestazione raccolte fino
       in fondo alla riga visiva (in "Terreno di viaggio" metà dei titoli è in
       GillSans normale come i dati, e le loro ascisse inventavano quattro
       colonne in più); l'ordinamento per **riga visiva** e non per top esatto
       (apici e frazioni spostano il top di 2px: "⅓" scavalcava la formula di
       "Passo veloce"); le note a piè di tabella staccate come paragrafi; le
       continuazioni di cella riconosciute anche quando tutte le colonne sono
       piene ("Disimpe-" / "gno" nella tabella Azioni).
       Ancore univoche per capitolo (i titoli ripetuti si numerano: "Bonus di
       competenza" compare tre volte in "Come si gioca", e due `id` uguali
       facevano atterrare ogni link sulla prima).
       Corretto un **bug latente del layout**, rivelato dalla prima tabella a sei
       colonne: `.srd-corpo` è un grid a colonna singola sotto 56rem e i grid item
       hanno `min-width: auto`, quindi la tabella allargava la colonna e con essa
       l'indice, e a 390px scorreva la pagina invece della sola tabella
       (`grid-template-columns: minmax(0, 1fr)` — la riga a due colonne lo faceva
       già). Non dipendeva dai capitoli nuovi: il glossario passava solo perché
       le sue tabelle sono più strette.
       Verificato: 10/10 sui tre capitoli, glossario ancora **identico** al file
       pubblicato (450 blocchi, 12.739 parole, 156 ancore invariate) più due celle
       ricomposte meglio, 36/36 in Chromium (ancore univoche nel DOM, niente PUA
       né legature né sillabazioni a schermo, attribuzione CC-BY, tabelle
       coerenti, nessuno scorrimento orizzontale a 390px, console pulita),
       `tsc` e `build` ok.
    2. [x] **Equipaggiamento** (pp. 101–117) — pubblicato (20 lug 2026), 10/10
       al verificatore. Le tabelle fitte hanno retto senza passare a
       `pdftotext -bbox-layout`: la geometria per parola non serviva, servivano
       tre regole in più, tutte trovate guardando i dati e non ipotizzandole.
       - **I valori numerici sono allineati a destra**, quindi cominciano prima
         della colonna che l'intestazione dichiara ("17,5 kg" a x=319 sotto un
         "Peso" dichiarato a 330). Assegnati al bordo sinistro finivano nella
         colonna precedente, dove il taglio delle celle fuse li spezzava:
         "Ariete portatile 17,5" e un "kg" solo nel peso. Ventidue righe in
         sette tabelle, **nessuna visibile al verificatore**. Ora `indiceColonna`
         riceve anche la larghezza e sposta il frammento se comincia più vicino
         all'inizio della colonna dopo che a quello in cui cadrebbe.
       - **Le code di tabella**: il PDF spezza le tabelle lunghe a fine pagina e
         ripete l'intestazione senza la didascalia. Si riconoscono dalle stesse
         intestazioni, e valgono solo a pagina nuova (a metà per colonna la
         ripetizione c'è ma non è una coda). La coda può ricominciare in
         un'altra colonna di pagina: la traslazione delle intestazioni ripetute
         è lo scarto da togliere alle celle.
       - **Le righe di sezione** dentro una tabella ("Armatura leggera (1 minuto
         per indossare o togliere)") si riconoscono dal **corsivo**, non dalla
         geometria: "sola sulla riga" le confonde con le celle davvero fuse
         ("Contundente Oggetti contundenti…"), che invece vanno divise.
       Il verificatore non conta più le righe di sezione fra le celle mancanti:
       in Equipaggiamento erano 46 su 52 e nascondevano i buchi veri dietro una
       percentuale che non si poteva far scendere. La condizione è stretta
       (tutte le celle dopo la prima vuote) e una riga piena a metà continua a
       contare — è quella che ha fatto trovare la colonna fantasma di
       "Cavalcature e altri animali" ("Capacità di trasporto" spezzato in due).
       **Debito noto, 4 righe su ~660 celle**, accettate consapevolmente al
       momento di pubblicare:
       - `Armi` / Martello da guerra: "1d8 contundenti Versatile (1d10)" resta
         fuso in Danni e Proprietà è vuota (la cella fusa non viene divisa).
       - `Armature` / Armatura a piastre: Peso "32,5 kg 1.500" e Costo "mo" —
         `tagliaAllAscissa` stima il confine una parola più in là.
       - `Vitto e alloggio`, 2 righe: è una tabella Oggetto|Costo ripetuta due
         volte affiancata, e le due coppie si confondono.
       Verificato: 25 riquadri su 25 identici al PDF, tabella Armi completa
       (44 righe, comprese le armi a distanza da guerra che prima mancavano),
       8/8 in Chromium fra i quattro capitoli a 1200px e 390px (158 ancore
       univoche, nessuno scorrimento orizzontale, niente PUA né legature né
       sillabazioni, attribuzione CC-BY, console pulita), `tsc` e `build` ok.
       Storia utile a chi tocca l'estrattore: tre formulazioni di
       `indiceColonna` sono state provate e scartate **leggendo il diff dei
       capitoli pubblicati**, non ragionando. Il verificatore ha dato 10/10 a
       ognuna.
       Il lavoro fatto qui aveva già **rovesciato la regola delle
       colonne** (20 lug 2026): le detta l'intestazione, raggruppata per
       sovrapposizione degli intervalli e non per ascissa, perché le ascisse
       delle celle sono sparse (numeri allineati a destra) e ognuna diventava
       una colonna — sotto "Peso" i valori "0,5" e "kg" finivano in due colonne
       e `tagliaAllAscissa`, nato per dividere le celle fuse, tagliava celle
       sane. Le celle ora servono solo a **raffinare** un gruppo quando il PDF
       fonde due titoli in un frammento ("CA Materiale"), a due condizioni che
       servono entrambe: almeno due colonne di celle sotto il gruppo, e uno
       spazio nel titolo dove spezzarlo. La geometria da sola non distingue
       "Peso" sopra "0,5"/"kg" da "CA Materiale" sopra "11"/"Stoffa": decide il
       titolo.
       Lezione sul metodo: la prima stesura passava **10/10 al verificatore
       mentre fondeva le colonne del glossario già pubblicato** ("11 Stoffa,
       carta, corda" in una cella). Il verificatore non vede la struttura delle
       tabelle — il testo c'è tutto e le righe restano rettangolari. L'unico
       controllo che coglie questa classe di guasti è rigenerare i capitoli
       pubblicati e leggere il diff, ed è ora scritto in CLAUDE.md.
       Verificato: `strumenti-di-gioco` identico al pubblicato, glossario e
       `come-si-gioca` migliorati (in "Bonus di competenza" le quattro righe
       tornano righe invece di una sola con i valori impilati; sei intestazioni
       fuse si separano), 10/10 su tutti e tre, `tsc` e `build` ok.
       Il seguito di questo lavoro è nel punto 2 qui sopra, che nel frattempo è
       stato chiuso: i riquadri degli strumenti sono risolti dal blocco `scheda`,
       e con loro sono sparite le tre sillabazioni incollate male a cavallo di
       colonna ("com- Intelligenza", "can- Strumenti", "vin- Dadi"), che erano un
       sintomo dello stesso guasto.
    3. [x] **Incantesimi** (pp. 118–201, il capitolo più lungo) — pubblicato
       (20 lug 2026), 9/10 al verificatore. Le due previsioni erano giuste: il
       blocco `scheda` ha riconosciuto 338 schede incantesimo **senza una riga
       di codice nuova** (le etichette finiscono davvero coi due punti nel font
       delle intestazioni), e le 84 pagine vanno spezzate. Non il JSON però: è
       importato lato server e al browser non arriva mai, quindi a pesare è
       l'HTML — si spezzano le pagine e la sorgente resta una.
       `/srd/incantesimi` elenca i 339 incantesimi per livello (l'elenco
       **prima** delle regole di lancio: chi apre la pagina cerca un
       incantesimo) e `/srd/incantesimi/[livello]` ne dà le descrizioni. Ogni
       pagina di livello sta sotto i 244 KB di HTML, meno del glossario già
       pubblicato (328 KB); tutte insieme sarebbero state 1,4 MB.
       Tre difetti dell'estrattore, tutti trovati guardando i dati:
       - **97 definizioni su 109 si chiamavano `riore`.** «Usando uno slot di
         livello supe-» / «riore.» — il nome di una definizione può stare a
         cavallo di due righe, e `forseDefinizione` pretendeva il punto finale
         sulla prima. Faceva due lavori: spezzare i paragrafi ed estrarre il
         nome. Ora sono separati (`apreDefinizione` insegue il grassetto in
         avanti, `chiudi` promuove il paragrafo quando il grassetto è completo).
         Ha corretto anche il glossario già pubblicato, dove due
         sotto-definizioni si chiamavano `attacchi`.
       - **Le tabelle senza didascalia**: nelle descrizioni degli incantesimi la
         tabella la annuncia la prosa, e la struttura la dichiara la sola riga
         d'intestazione. `grigliaLibera` le riduceva a coppie chiave/valore
         rimescolate. Guadagno inatteso sui capitoli già pubblicati: in
         Equipaggiamento una tabella aveva perso **tutte** le colonne Peso e
         Costo (celle vuote), e il soffio del drago in Strumenti di gioco aveva
         i valori impilati fuori posto.
       - **Gli attacchi di cella in grassetto** («1 | *Rosso.* Tiro salvezza
         fallito…») sono nello stesso font dei titoli di colonna: venivano presi
         per intestazioni e «Strati prismatici» usciva a brandelli, con testo
         perso e duplicato (`fulTiro`). Li distingue il **punto finale**.
       Lezione sul metodo, di nuovo: la prima formulazione («l'intestazione
       finisce dove la riga non si apre nel font dei titoli») dava 9/10 su
       Incantesimi **mentre distruggeva «Terreno di viaggio»**, la tabella a sei
       colonne più difficile del repo — e il verificatore le dava 10/10. Solo il
       diff dei capitoli pubblicati l'ha vista.
       Verificato: i quattro capitoli già pubblicati rigenerati, tutti 10/10 e
       ogni differenza un miglioramento (nessuna regressione); 21/22 in Chromium
       (339 incantesimi elencati, 42 al 3º livello, ancore univoche, scheda di
       palla di fuoco completa, nessun PUA né legatura né sillabazione a
       schermo, attribuzione CC-BY, nessuno scorrimento orizzontale a 1200px e
       390px, console pulita — il 22º è il 404 che provoca il test stesso);
       `tsc` e `build` ok, 10 rotte di livello prerese.
       **Debito noto**, accettato consapevolmente al momento di pubblicare:
       - **La prima frase del capitolo non è nel PDF.** Pagina 118 è una tavola
         illustrata: `pdffonts` dice zero font, `pdfimages` una sola immagine a
         piena pagina. Il capitolo comincia a metà frase («…regole di lancio
         degli incantesimi, oppure può essere lanciato come rituale»), e non c'è
         niente da estrarre — non è un difetto del parser.
       - **Cinque griglie restano imperfette** su 1698 blocchi: le quattro
         schede delle creature evocate (Oggetto animato, Insetto gigante,
         Spirito draconico, Cavalcatura ultraterrena), dove la griglia dei
         punteggi di caratteristica esce a pezzi (`es ag`, `C os`), e la tabella
         di Scrutare, dove i modificatori (allineati a destra) finiscono in
         fondo invece che nelle celle. Il testo c'è tutto, è la struttura a
         mancare. Le schede di creatura sono un blocco a sé che
         `estrai-srd-mostri.mjs` sa già leggere: se e quando diventano
         fastidiose, la ricetta è lì.
       - ~~Tre sillabazioni sospese («modi- ficatore») nei due riquadri delle
         formule e in un riquadro di prosa~~ — risolto il 21 lug 2026, vedi
         sotto.
    3b. [x] **Incantesimi, seconda passata** (21 lug 2026) — tre difetti visti a
       schermo dopo la pubblicazione. Incantesimi passa da 9/10 a **10/10**, gli
       altri quattro capitoli restano 10/10.
       - **I due riquadri delle formule** («CD del tiro salvezza
         sull'incantesimo = 8 + il modiﬁcatore…») uscivano come tabelle a due
         colonne, con la frase spezzata in celle e i trattini di sillabazione a
         metà parola. Ora sono paragrafi: `riquadroDiProsa` li riconosce dalla
         composizione centrata più il grassetto che intitola una volta sola
         (vedi CLAUDE.md). Misurato prima di scrivere la regola: sui dieci
         capitoli del PDF non prende nient'altro.
       - **Le legature mancavano dalle classi di sillabazione.** `ﬁ` e `ﬂ` sono
         minuscole ma non stanno in `[a-z]`, quindi «modiﬁ-» + «catore» non si
         ricuciva. Ora `SILLABATA`/`PROSEGUE` le comprendono da entrambi i lati.
         Era anche la causa del terzo caso, nella descrizione di *Schianto*.
       - **La tabella di *confusione*** aveva tre colonne invece di due (una
         senza titolo) e tutto il testo in una cella sola: l'intestazione è un
         frammento fuso e le colonne si deducevano dalle celle senza distinguere
         un'ascissa vera da una chiave centrata. Ora il titolo dice **quante**
         colonne e le celle **quali**. `dividiCella` corregge in più lo
         scivolamento di una parola nel taglio delle celle fuse — che ha
         raddrizzato anche «Prepararsi | Ti prepari…» in Come si gioca e
         «32,5 kg | 1.500 mo» in Equipaggiamento, due celle sbagliate da sempre.
       Resa: la **scheda incantesimo** sotto i 34rem torna a scorrere nel testo
       («Tempo di lancio: azione», la forma del PDF) invece di impilare etichetta
       e valore — su un telefono quattro coppie facevano otto righe. E una cella
       di tabella senza spazi non si spezza più (`srd-tab__unita`): «9–10» usciva
       su due righe, perché il trattino d'intervallo è un a capo legittimo.
       Verificato: 16/16 in Chromium (le due formule confrontate parola per
       parola, le chiavi di confusione, la scheda incolonnata a 1280px e in
       linea a 390px, nessun residuo del PDF su **tutte e dieci** le pagine di
       livello, nessuno scorrimento orizzontale a 1280/768/390px, console
       pulita), i quattro capitoli già pubblicati rigenerati e ogni differenza
       letta (due sole, entrambe correzioni), `tsc` e `build` ok.
       **Resta** il debito delle cinque griglie qui sopra, più due cose viste
       adesso e non toccate: ~~«Strati prismatici» esce come due tabelle (la coda
       riprende nella colonna accanto, non a pagina nuova)~~ — risolto il 21 lug
       2026 col punto 6 qui sotto — e la tabella Temperatura/Vento di
       *controllare il clima*, che fonde le intestazioni delle due metà
       affiancate («Vento Grado»).
    4. [x] **Oggetti magici** (pp. 232–288) — pubblicato (21 lug 2026), 10/10 al
       verificatore, 258 oggetti su dieci pagine. Il capitolo ha portato un
       difetto nuovo e uno di forma.
       Il difetto nuovo: **il PDF compone in GillSans-SemiBold anche cose che
       stanno dentro una cella** — le chiavi degli elenchi annidati («…tirando
       un 1d10: con **1**, *allucinazione*; con **2**, *folata di vento*») e i
       nomi delle creature («45–51 | **Un cavallo da galoppo** dotato di
       sella»). È lo stesso font dei titoli di colonna, quindi la raccolta delle
       celle si fermava lì: il Cappello dei molti incantesimi usciva con un
       «4 ,» in colonna 1 e la mezza frase accanto, la Tunica degli oggetti
       utili si troncava a metà e il seguito ripartiva come tabella nuova
       intitolata col nome del cavallo. Due regole, e a decidere è sempre la
       **distanza**, non il font:
       - a metà riga il grassetto si ricuce col resto (`proseguiIlRuolo`): il
         ruolo di una riga lo dichiara il frammento che la apre. Vale in una
         direzione sola, e l'ha detto la misura — nel PDF i frammenti attaccati
         con ruoli diversi sono 1671, di cui **1602 nell'altro verso** (gli
         attacchi di cella «*Rosso.* Tiro salvezza…» e le etichette delle
         schede), che devono restare righe a sé.
       - a inizio riga il grassetto è una cella se è **attaccato** a del testo
         normale (`dentroUnaCella`): sono due frammenti che si sarebbero
         ricuciti se non fosse per il font. Guardare solo «c'è del testo normale
         sulla stessa riga» è stato provato e scartato — prende anche le griglie
         a chiave grassa dei tratti di classe («Caratteristiche primarie |
         Forza»), dove il valore sta in un'altra colonna e la chiave è una
         chiave. Con la distanza il risultato su Oggetti magici è identico e
         `classi` non si muove.
       Il difetto di forma: **un titolo di colonna impilato su due righe**.
       «1d100» sopra «(Mazzo da 13 carte)» sono due frammenti, quindi la guardia
       sulle maiuscole di `raffinaConCelle` non scattava, e sotto ci sono sia i
       trattini centrati sia gli intervalli allineati a sinistra — la stessa
       geometria di «Peso» con «0,5» e «kg». La prima colonna si spaccava fra
       «(Mazzo da» e «13 carte)» e il Mazzo delle meraviglie **collassava in una
       riga sola**. Ora un taglio che lascia una parentesi spaiata si rifiuta
       sempre: in un titolo le parentesi sono bilanciate. La tabella è tornata
       22 righe × 3 colonne.
       Altre due, minori: lo spazio non si mette davanti a un segno di chiusura
       quando due frammenti finiscono nella stessa cella («elefante ;»), e una
       riga che apre con una parentesi è la continuazione di quella sopra, mai
       una voce nuova («Cintura della forza dei giganti» / «(delle colline)»,
       «Pozione di guarigione» / «(maggiore)»).
       **Dieci pagine, non una**: resa intera la pagina fa 942 KB di HTML, il
       triplo del glossario. Il taglio è la **categoria**, che la riga in corsivo
       dichiara esattamente come il livello di un incantesimo — `dividiOggetti`
       è il gemello di `dividiIncantesimi`, e il registro sta in
       `SEZIONI_OGGETTI`. Gli oggetti meravigliosi sono 127 su 258 e da soli
       sfondavano il tetto: spezzati a metà alfabeto (A–L / M–Z), l'unico taglio
       che il capitolo stesso suggerisce. La più pesante ora è 273 KB, sotto il
       glossario (331 KB). Il JSON resta uno.
       Verificato: 34/34 in Chromium (258 oggetti elencati una volta sola, i
       conteggi delle dieci sezioni combaciano con gli elenchi, ancore univoche
       su ogni pagina, nessun residuo del PDF a schermo, le tre tabelle che
       erano rotte lette cella per cella, niente scorrimento orizzontale a
       1280px e 390px, nessuna richiesta fallita, console pulita); i cinque
       capitoli già pubblicati rigenerati e **quattro byte-identici** — il
       quinto, Equipaggiamento, cambia di una riga in una griglia già
       degenere (la tabella dei veicoli), dove due frammenti d'intestazione si
       ricompongono meglio; `tsc` e `build` ok.
       **Debito noto**, accettato al momento di pubblicare: restano 4 celle
       vuote su 804 (0,5%), tutte dove il PDF emette un frammento unico per due
       colonne e la divisione resta stimata — «Golem di pietra 90 giorni» fuso
       in una cella, e i due riquadri Rarità/Valore e Tempi/Costi che affiancano
       la stessa tabella due volte (lo stesso caso di «Vitto e alloggio» in
       Equipaggiamento).
       Da sapere: `estrai-srd-mostri.mjs` **scarta** il font Cambria, perché lì
       è la prosa di questo capitolo che sporca le schede mostro; in
       `estrai-srd-regole.mjs` Cambria è invece il corpo del testo. I due
       script dicono il contrario ed è corretto così — non allinearli.
    5. [x] **Classi** (pp. 32–92) — pubblicato (21 lug 2026), 10/10 al
       verificatore e **zero celle vuote su 4.616**, il primo capitolo senza
       debito nelle tabelle. Era il più irregolare, e i tre difetti che ha
       portato erano tutti nel rilevatore delle **bande a piena pagina**.
       - **La banda risaliva dentro la pagina a due colonne.** All'apertura di
         ogni classe il riquadro "Tratti del <classe>" è una tabella alta mezza
         pagina nella colonna sinistra, con la tabella dei privilegi sotto: le
         sue righe hanno tutte un ruolo da tabella e distano meno di
         `SALTO_BANDA`, quindi la propagazione arrivava fino in cima e le due
         colonne uscivano **interlacciate riga per riga** ("Dado Vita | D10 per
         ogni livello da guerriero cati nella tabella Privilegi del
         guerriero."). Dodici aperture di classe su dodici, illeggibili.
         Il criterio giusto **non è una distanza**: la didascalia di una tabella
         a piena pagina comincia 19 px sotto la prosa, e le ultime righe del
         riquadro ne distano 18 — con la soglia a 19 si perdeva la tabella
         "Armature" di Equipaggiamento, con quella a 18 si tarava sul rumore.
         A separarle è la **continuità** (`righeADueColonne`): una riga prosegue
         ciò che ha sopra nella sua colonna e quindi eredita, una didascalia no
         perché apre una tabella e non è mai il seguito di niente.
         Errore intermedio, che vale la pena ricordare: le righe vanno contate
         **dentro** la colonna. Raggruppate per sola ordinata, a cavallo del
         gutter, le due colonne affiancate diventavano una riga sola larga
         quanto la pagina — cioè proprio la cosa da escludere.
       - **Il segnale di una tabella a piena pagina non è "attraversa la
         mezzeria".** "Privilegi del bardo" ha quattordici colonne e nessuna
         cella che passi sopra x=440: usciva tagliata in due, quattro colonne
         come tabella e le altre dieci lette per colonnine come se fossero un
         elenco (tutta la colonna "Trucchetti" in una cella). Il segnale è
         **invadere il corridoio vuoto** fra le colonne (`GUTTER`, 435–470), che
         non è una stima: sui 39.077 frammenti del documento 434 bordi destri
         cadono a 434–435 e 10.242 bordi sinistri a 470, e nei 34 px in mezzo ne
         cadono 37 in tutto — tutti dentro tabelle a piena pagina.
       - **Una cella fusa può coprire più di due colonne.** Nelle tabelle di
         avanzamento degli incantatori il PDF emette lo slot e tutti i trattini
         che lo seguono in un frammento solo ("2 — — — — — — — —", da x=597 a
         x=815, sopra nove colonne), e `dividiCella` sa stimare un confine per
         volta: la riga usciva con un valore e sette celle vuote (176 su 4.628).
         `dividiSuColonne` non stima niente — divide solo se il **conto torna**,
         parole quante le colonne coperte, e allora la corrispondenza è
         un'identità. Quando non torna la cella resta fusa: è la condizione che
         rende la regola innocua.
       Due difetti di forma, che valgono per tutta la sezione:
       - **La didascalia di una griglia restava orfana**: il riquadro "Tratti
         del <classe>" è una griglia chiave/valore, senza riga di intestazione,
         quindi `tabella` non lo riconosce e il suo nome finiva come paragrafo
         in grassetto sopra una tabella anonima, dodici volte.
       - **I pallini della prosa non erano un segnale.** Nel PDF gli elenchi
         hanno il passo di riga normale, quindi il salto verticale non separava
         le voci e finivano incollate in un paragrafo solo ("• Chi è la tua
         famiglia? • Chi era il tuo più caro amico d'infanzia? • …"). Ora un
         pallino apre sempre una voce. Le voci di `punti` sono diventate
         `Span[][]` invece che stringhe, perché negli oggetti magici sono nomi
         di incantesimo in corsivo: la conversione ha anche restituito il
         grassetto ai gruppi di mostri di "Strumenti di gioco", che prima si
         perdeva.
       **Dodici pagine, non una**: 340 KB di testo resi insieme sarebbero quasi
       un mega di HTML. Qui però il taglio non è una riga in corsivo come per
       incantesimi e oggetti magici, ma la **struttura** — il capitolo non ha
       introduzione (nel PDF comincia direttamente col Barbaro) e ha esattamente
       un `h2` per classe. `dividiClassi` sono i dodici `h2`; la pagina più
       pesante è il druido, 176 KB, contro i 332 KB del glossario.
       Non avendo prosa da mostrare, `/srd/classi` porta la **carta d'identità**
       di ogni classe (`cartaClasse`): caratteristica primaria, Dado Vita e
       sottoclasse, letti per *etichetta* dentro il riquadro "Tratti del
       <classe>" — se il capitolo cambia forma la carta perde una riga, non
       inventa un dato.
       Verificato: le dieci pagine SRD toccate rigenerate, tutte 10/10; i
       quattro capitoli non toccati byte-identici, e i sei che cambiano
       cambiano **in meglio** — letto il diff riga per riga: Equipaggiamento
       recupera le cinque colonne perdute della tabella dei veicoli (era il
       debito annotato al punto 4) e ricompone il paragrafo che quella griglia
       degenere spezzava in due. Confronto dell'ordine di lettura con
       `pdftotext` sui 21.061 bigrammi di prosa del capitolo: 69 divergenze,
       tutte casi in cui **pdftotext sbaglia** — le sue colonne interlacciate e
       le parole con la "f" in Private Use Area, che lui perde ("Così acendo").
       In Chromium: le tre pagine nuove senza scorrimento orizzontale a 1280px
       e 390px, console pulita, nessuna richiesta fallita; `tsc` e `build` ok,
       dodici rotte prerese.
       **Debito noto**: nessuna cella vuota, ma la tabella dei privilegi del
       mago e del bardo ha quattordici/quindici colonne e a 1280px scorre dentro
       il suo riquadro — è il comportamento previsto per le tabelle larghe, però
       questa è la più larga della sezione e forse merita una resa sua.
       Resta anche un `elenco` di una voce sola in "Strumenti di gioco" che
       tiene il pallino nel testo e si spezza in tre righe ("• 2 draghi rossi
       adulti…"): `puntato` ne pretende almeno due per riconoscere un elenco, e
       lì il PDF ne ha uno solo. Difetto **preesistente**, non toccato.
    6. [x] **Creazione del personaggio** (pp. 21–31), **Origini dei personaggi**
       (pp. 93–97) e **Talenti** (pp. 98–100) — pubblicati insieme (21 lug 2026),
       10/10 tutti e tre. Brevi sì, ma non senza sorprese: i tre passavano 10/10
       **al primo colpo** e avevano tre tabelle su quindici distrutte. È il caso
       da manuale di ciò che il verificatore non vede, e lo si trova solo
       rileggendo i dati.
       - **Il rientro non vuol dire niente in una tabella tutta allineata a
         destra.** In "Avanzamento dei personaggi" sotto "Livello" c'è "1" e
         sotto "Punti esperienza" c'è "0": ogni cella comincia dopo l'inizio
         della sua colonna, cioè è "rientrata", e il rientro è il segnale con cui
         si riconosce una riga che è il seguito di quella sopra. Quindici righe
         impilate in una, coi PE di tutti i livelli in una cella. Lo dice la
         PRIMA riga di dati, che non può essere il seguito di niente: se è
         rientrata anche lei, in quella tabella il rientro è impaginazione.
         Ha raddrizzato anche "Costi in punti", "Punteggi e modificatori" e due
         tabelle di `classi`.
       - **La didascalia può andare a capo** ("Incantatore multiclasse:" / "slot
         incantesimo per livello di incantesimo"): la seconda riga è nel font
         delle didascalie e finiva fra i titoli di colonna — un frammento largo
         quanto la tabella, che li fondeva tutti. Venti righe per dieci colonne
         uscivano a due. Va a capo e non di fianco: le uniche due didascalie
         consecutive del PDF sono questa e Temperatura/Vento di *controllare il
         clima*, che stanno sulla stessa riga visiva e sono due tabelle.
       - **Una coda è una tabella a cui è finito lo spazio, non una tabella che
         cambia pagina.** "Monili" è un d100 che riprende tre volte, due delle
         quali nella colonna accanto della stessa pagina, e usciva in quattro
         tabelle di cui tre senza titolo. Il confine non è la pagina e non è una
         misura in pixel: lo dicono le righe stesse, che sotto l'ultima cella e
         sopra le intestazioni ripetute non ne hanno altre nella loro colonna.
         Serve tutt'e due — in "Azioni" le intestazioni si ripetono a metà della
         colonna destra, con della prosa sopra, e lì comincia una tabella nuova.
         Con la coda arriva l'ordine di lettura: `grigliaDaFrammenti` ordinava
         per pagina e top, e una coda nella colonna accanto ha un top piccolo,
         quindi risaliva in mezzo alle prime righe. Ora si ordina per colonna di
         pagina, e due frammenti sono la stessa riga solo se stanno nella stessa
         colonna. **Ha chiuso tre debiti annotati**: «Strati prismatici» era due
         tabelle, «Esempi di tiri salvezza» pure, e in «Azioni» il testo delle
         due metà era interlacciato cella per cella («Effettui una prova di
         Storia, Indagare, Natura o Religione). c…»).
       - **La soglia del salto di paragrafo era di un pixel troppo alta.**
         `PASSO_RIGA` valeva 23 e a 23 esatti il PDF stacca la riga in corsivo
         che dichiara categoria e rarità dalla descrizione: "Talento Origini" si
         incollava alla frase dopo in un talento su due. Misurati tutti i salti
         del PDF fra 19 e 26: quelli da 23 sono 212 e **nessuno** prosegue una
         frase, né per sillabazione né aprendo in minuscola. A 22 tutti e 258 gli
         oggetti magici hanno la loro riga di rarità staccata, come già l'avevano
         gli incantesimi.
       Verificato: 26/26 in Chromium (i tre capitoli con ancore univoche, nessun
       residuo del PDF a schermo, niente scorrimento orizzontale a 1280 e 390px,
       le sei tabelle riparate lette riga per riga, console pulita); tutti e nove
       i capitoli 10/10 al verificatore; i sei già pubblicati rigenerati e ogni
       differenza letta — sono tutte tabelle che si uniscono o righe in corsivo
       che si staccano, nessuna regressione; `tsc` e `build` ok. Le tre pagine
       stanno in una sola rotta ciascuna (186, 92 e 51 KB di HTML).
  - [x] **La sezione regole è raggiungibile dall'editor** (21 lug 2026). Era
    pubblicata ma linkata da un punto solo di tutto il sito, in fondo alla home:
    dall'editor — cioè da dove serve, a metà sessione — non ci si arrivava
    (zero occorrenze di `/srd` in `public/`). Ora "Regole SRD 5.2.1 ↗" sta nel
    menu `⋯`, accanto a "Genera un dungeon ↗" perché è la stessa cosa: uno
    strumento che vive altrove e si apre in una scheda nuova. Fuori dal blocco
    `!RO`, che un incantesimo lo cerca chi lo lancia.
    Il titolo in topbar è diventato un link alla home (prima l'unica uscita era
    il tasto Indietro). Questo però apriva un buco: `save()` è ritardato di
    700 ms, e uscire con un clic dentro quella finestra perdeva l'ultima
    modifica. Chiuso con un `flushSave` su `pagehide` — che copre anche la
    chiusura della scheda e l'Indietro, cioè il difetto "niente flush alla
    chiusura" della critique del 17 lug.
    Verificato in Chromium: 10/10 (link vero a `/`, non sottolineato a riposo,
    la voce apre `/srd` in una scheda nuova lasciando l'editor dietro, il
    salvataggio in sospeso finisce su disco al `pagehide` mentre prima no) più
    il menu del tavolo (regole sì, Esporta/Importa/Annulla no) e la geometria
    della topbar identica a 390/900/1280/1600/1920px col padding del bersaglio.
    Il bottone `⋯` era nascosto sopra i 1400px — lì i suoi contenuti sono
    bottoni veri in topbar — e la voce delle regole, che in topbar non ci sta,
    non era raggiungibile proprio sul desktop. Ora è visibile a ogni larghezza.
    I 34px in più cadevano tutti nella fascia 1551–1650, dove il sottotitolo
    dell'h1 e la ricerca larga tornano insieme: a 1600px il margine passava da
    13px a zero e il selettore della campagna si stringeva di 35px. Risolto
    alzando il primo gradino da 1550 a 1600, cioè nascondendo il sottotitolo
    (già dichiarato decorativo) dove serve lo spazio. Misurato l'A/B a
    1401/1450/1550/1600/1700/1920px: ora l'unica cosa che cambia è lo spacer,
    nient'altro si comprime e l'altezza della barra non varia mai.
    Da correggere un'ipotesi sbagliata scritta prima di misurare: in **cloud
    c'è più spazio, non meno**. Il bottone "Tavolo" in più costa meno di quanto
    faccia risparmiare il selettore di campagna, che lì è nascosto perché le
    campagne le gestisce il sito.
  - [x] **Mostri: il bestiario sul sito** (`/srd/mostri`) — fatto (22 lug 2026).
    Le 331 schede vivevano solo nell'app; ora si consultano anche dal sito, per
    tipo di creatura e per grado di sfida, e la ricerca trasversale le trova.
    Le due decisioni difficili erano annotate, e le ho prese misurando:
    - **Da dove legge la pagina.** Non un `mostri.json` generato a parte, ma
      `public/app/srd-mostri.js` **letto direttamente** (`readFileSync` a build
      time in `src/lib/srd/mostri.ts`): lo stesso file dell'app. Due file dallo
      stesso PDF sarebbero due copie, e questo repo l'ha già pagata una volta
      (l'attribuzione ricopiata a mano, divergente). I mostri **non stanno in
      `CAPITOLI`**: quel registro è dei capitoli in `capitoli/*.json`, e
      `[capitolo]` proverebbe a caricare un JSON che non c'è.
    - **Se entrano nella ricerca.** Sì — ma solo lì, non nei rimandi (funzione
      `ancoreMostri` separata da `tutteLeAncore`). La misura ha deciso: tre nomi
      (Druido, Mago, Mosca gigante) esistono come titolo in Classi/Oggetti e
      oggi sono univoci, quindi resi come link «Vedi anche»; mescolare le schede
      nella stessa mappa li renderebbe ambigui e quei tre link sparirebbero —
      una regressione che non fallisce nessuna build. L'indice `/srd/ancore.json`
      passa da 1530 a 1861 voci (94 KB, +12 KB), e si scarica solo a chi cerca.
    - **Il taglio delle pagine** è per tipo di creatura (la classificazione che
      il PDF dichiara sotto il nome), con Bestie e Draghi spezzati **solo per
      peso** — servite intere facevano 578 e 458 KB di HTML contro i 347 del
      glossario. Bestie A–L / M–Z; Draghi per GS, che per un drago è l'età,
      perché l'alfabeto li lascerebbe tutti sotto la "D". A pesare è il numero
      di schede (~4,6 KB l'una), non la loro lunghezza: le sedici pagine stanno
      ora tutte sotto il tetto del glossario, la più pesante 313 KB.
    - **Le schede sono di lettura**, non di modifica (l'app ha già la versione a
      campi): stesse etichette. I nomi in grassetto di tratti e azioni, persi
      nell'estratto piatto, si ricostruiscono dal punto fermo — tetto a 60
      caratteri, che separa 1348 righe da 1 (misurato, non tarato a occhio).
    Guardia contro il guasto muto tipico di questa sezione: `/srd/mostri` **fa
    fallire la build** se una scheda non ha un tipo noto (`mostriSenzaTipo`) —
    331 pubblicate devono restare 331, e un mostro che sparisce non rompe niente.
    Verificato in Chromium (18/18): indice con 16 sezioni, Bestie/Draghi
    spezzati, le ancore dal nome che portano alla scheda, Tratti/Azioni/Azioni
    leggendarie coi nomi in grassetto, le sei caratteristiche in tabella col
    modificatore, ricerca che trova un goblin nei mostri **e** «Afferrato» nelle
    regole, i rimandi del glossario ancora tutti link, nessuno scorrimento
    orizzontale a 390px, console pulita; `tsc` e `build` (70 pagine) ok.
  - [ ] **Rifiniture note della sezione regole**, da fare quando danno fastidio:
    - Sette celle restano vuote in tutta la sezione (tre in Equipaggiamento,
      quattro in Oggetti magici) dove è il PDF a emettere un frammento unico per
      due colonne: il testo c'è tutto, ma lì la divisione è **stimata**. Ora che
      i capitoli ci sono tutti si può valutare `pdftotext -bbox-layout`.
    - La tabella dei privilegi di un incantatore ha quattordici o quindici
      colonne e a 1280px scorre dentro il suo riquadro: è il comportamento
      previsto per le tabelle larghe, ma queste sono le più larghe della sezione
      e forse meritano una resa loro (gli slot per livello come una riga a sé?).
    - Nella ricerca trasversale il rango è sui **titoli**, non sul corpo: chi
      cerca una frase che sta dentro una descrizione non la trova. Il corpo sono
      1,7 MB di JSON e non può viaggiare al browser come l'indice dei titoli
      (82 KB): vorrebbe una route handler che cerca lato server, cioè la prima
      cosa dinamica di tutta la sezione. Da fare solo se qualcuno la chiede
      davvero — al tavolo si cerca un nome, non una frase.
    - **A destra della prosa restano 178px sempre vuoti** (misurato il 30 lug
      2026, nessuna riga toccata). `.srd-testo` si ferma a 34rem dentro una
      colonna `minmax(0, 1fr)`, quindi lo scarto non dipende dallo schermo: è
      178px a **qualunque** larghezza da 1280px in su, più il margine fuori dal
      contenitore (32px a 1366, 69 a 1440, 309 a 1920). Non è un difetto — la
      misura di lettura è voluta e `srd.css:4-6` la dichiara — ma è lo spazio
      che c'è, se un domani serve: note a margine, i rimandi «Vedi anche»
      portati fuori dalla prosa, un sommario della sola sezione corrente.
      Tre cose che la misura ha già deciso, per non rifare l'indagine:
      - **Il vuoto è a destra e basta.** A sinistra c'è l'indice sticky da
        15rem (`.srd-corpo`, `srd.css:22`), che quello spazio se l'è già
        preso: a 1440px fuori dal contenitore restano 69px per lato, dove non
        ci sta niente. Qualunque cosa a sinistra vuol dire spostare l'indice o
        stringere la prosa, cioè disfare la misura di lettura per fare posto a
        qualcosa che si legge meno di quella.
      - **Il rem scala con la larghezza**, quindi il contenitore si ferma a
        62rem × 21px = 1302px e non cresce più: da 1920px in su il vuoto
        aumenta **fuori** e non dentro. Una colonna nuova va quindi agganciata
        al contenitore, non al viewport, sennò sotto i 1600px non ha dove
        stare.
      - **Non ci vanno banner pubblicitari**, e non è una questione di gusto:
        `/privacy` afferma testualmente «non c'è pubblicità», e
        `src/lib/site.ts:9` dice che perfino il widget Ko-fi è stato scartato
        per non caricare script di terzi «contraddicendo quanto promette
        /privacy». Il giorno che si cambia idea, quella frase va riscritta
        **nello stesso commit** — è la stessa classe di problema per cui
        esiste `CODE_LICENSE`: una pagina che afferma una cosa che il sito non
        fa più non è un refuso, è una promessa rotta.
  - [x] **Registro delle ancore, ricerca trasversale e rimandi come link** —
    fatto (21 lug 2026). Due rifiniture aperte chiedevano la stessa cosa che non
    esisteva: sapere, dato un titolo, **su quale pagina** è finito. Non è
    derivabile dall'id — tre capitoli stanno su più pagine e a decidere sono i
    divisori — quindi `src/lib/srd/ancore.ts` costruisce il registro facendo
    girare `dividiClassi`/`dividiIncantesimi`/`dividiOggetti`, gli stessi che
    usano le pagine. Una tabella a parte sarebbe stata una seconda verità.
    - **Ricerca trasversale** su `/srd`: i 1530 titoli dei dieci capitoli.
      L'indice è `/srd/ancore.json` (route handler `force-static`, quindi un
      asset) e si scarica **alla prima interazione col campo** — chi apre /srd
      per scegliere un capitolo non paga niente, e /srd resta 1,28 kB. Sono
      82 KB grezzi, 21,7 gzip, 18,3 brotli, in cache dopo la prima ricerca.
      L'etichetta di un esito è la **pagina** e non il capitolo: cercando
      "attacco extra" escono cinque "Livello 5: Attacco extra" che senza
      "Classi › Barbaro / Guerriero / Monaco / Paladino / Ranger" sarebbero
      cinque righe identiche, cioè nessun risultato. Rango a tre gradini
      (prefisso, inizio di parola, dentro la parola), sennò cercando "arma"
      vinceva l'ordine dei capitoli invece della voce "Arma". Invio salta al
      primo esito, e il filtro di un capitolo che non trova niente porta qui
      con la parola già scritta (`/srd?q=…`), che è il momento in cui si scopre
      di stare cercando nel capitolo sbagliato.
    - **I 90 rimandi del glossario diventano 129 link.** Le posizioni si
      calcolano sul testo piatto del blocco e `blocchi.tsx` le riproietta sugli
      span, perché il rimando li attraversa **sempre** (misurato: 90 su 90 —
      «Vedi anche» è in corsivo, i termini no). Tre regole trovate guardando i
      dati, non ipotizzate:
      - il capitolo citato è un **vincolo, non un suggerimento**: in «Vedi anche
        "Equipaggiamento" ("Armi")» il ripiego "univoco altrove" mandava agli
        oggetti magici, dove "Armi" pure esiste. Sei link su 135 puntavano al
        capitolo sbagliato con l'aria di funzionare;
      - il suffisso fra quadre non fa parte del nome ("Afferrato [condizione]"
        citato come "Afferrato"): senza, 17 rimandi restavano testo;
      - fuori da un contesto dichiarato si collega solo ciò che è univoco in
        tutta la sezione.
      **41 termini su 170 restano testo**, ed è la risposta giusta: 32 sono
      titoli di sezione stampati sulle **tavole illustrate** del PDF (pp. 5, 6,
      12, 16, 118 — `pdffonts` dice zero font, come già annotato per la prima
      frase di Incantesimi), quindi non esistono come testo da nessuna parte.
      Il capitolo accanto resta un link, quindi il rimando porta comunque da
      qualche parte.
    Verificato: 1530 ancore su 1530 controllate **contro l'HTML generato** —
    ogni href atterra su una pagina che esiste e che contiene quell'id, zero
    eccezioni; i 129 link del glossario idem. Le 42 pagine della sezione
    ricostruite da `HEAD` in un worktree e confrontate a testo visibile: **tutte
    e 42 identiche**, i link sono comparsi senza spostare un carattere di prosa
    (controllo necessario perché `Testo` rende la prosa di tutta la sezione).
    29/29 in Chromium (l'indice non si scarica finché non si cerca, sei ricerche
    coi loro esiti, l'esito che atterra sull'ancora giusta, Invio, i rimandi
    interni e di capitolo, la via d'uscita dal filtro di capitolo, 390px in
    verticale e coricato, console pulita, nessuna richiesta fallita); `tsc` e
    `build` ok, 52 pagine statiche.
    Difetto trovato dalla misura e corretto: il tetto dell'elenco dei risultati
    era `26rem`, ma il rem di questo sito scala con la **larghezza**
    (`clamp(17px, 15.3px + 0.45vw, 21px)`), quindi su un telefono coricato
    (780×390) l'elenco era più alto della finestra — ora `min(26rem, 60vh)`.
  - [x] **Pagina «Informazioni legali» e attribuzione derivata** — fatto
    (22 lug 2026). La p. 1 del PDF sono i termini con cui l'SRD è concesso in
    licenza, e passa dallo stesso estrattore per la stessa ragione per cui ci
    passano i capitoli: il testo di una licenza si estrae, non si ricopia a mano
    — una parola diversa dall'originale, lì, è un problema legale e non un
    refuso. Nuova pagina `/srd/informazioni-legali`
    (`src/app/srd/informazioni-legali/page.tsx`), JSON generato
    `src/lib/srd/capitoli/informazioni-legali.json` (4 paragrafi, 2 KB).
    - **Non è un capitolo** e non sta in `CAPITOLI`: dentro il registro sarebbe
      una voce di regole nell'indice e, peggio, `[capitolo]` ne servirebbe una
      seconda copia a un altro indirizzo. Ha un caricatore suo
      (`caricaInformazioniLegali`) e ci si arriva dall'attribuzione in fondo a
      ogni pagina — il punto in cui viene da chiedersi con che licenza, di
      preciso. Niente indice laterale, perché non ha titoli: un indice di
      quattro paragrafi sarebbe più lungo dei paragrafi.
    - **Trovata una seconda verità e tolta.** `ATTRIBUZIONE_SRD` era battuta a
      tastiera e divergeva dall'originale in **cinque posizioni** su 367
      caratteri (apostrofi e virgolette dritti al posto dei tipografici): stessa
      lunghezza, invisibile a occhio. Ora si legge dal JSON estratto, e se quel
      paragrafo sparisce il build **si ferma** con un errore che dice cosa
      ricontrollare, invece di pubblicare 43 pagine senza attribuzione.
    - La riga stava ricopiata in fondo a **otto** template: ora è il componente
      `src/app/srd/attribuzione.tsx`. Una riga che la licenza impone su tutte le
      pagine non deve dipendere dal fatto che chi aggiunge la nona se ne ricordi.
    - `senzaTitoli` (estrattore) e `SENZA_TITOLI` (verificatore) **dichiarano**
      l'unico documento in cui zero titoli è il risultato giusto. La guardia
      "zero titoli = rosso non riconosciuto" resta accesa per tutti gli altri
      invece di essere allentata per comodità, e chi un domani ne aggiunge un
      secondo se ne accorge da una verifica che fallisce.
    - Gli indirizzi web diventano link (`collegaIndirizzi` in `blocchi.tsx`):
      riusa la firma dei rimandi, quindi la proiezione sugli span era già
      scritta. Non è però una proprietà di `Blocchi`, e lo dice la misura — nei
      dieci capitoli non compare **un solo** "http". La punteggiatura resta
      fuori dall'href: nell'SRD gli indirizzi chiudono la frase, e un link che
      c'è e si apre su un 404 è il modo peggiore di sbagliare.
    Verificato: `verifica-srd-regole.mjs` 10/10 (copertura 95,9%, e le 7 parole
    "mancanti" sono esattamente titolo, piè di pagina e numero — sul corpo è
    100%); i dieci capitoli già pubblicati **rigenerati a diff vuoto**; 43 pagine
    SRD con esattamente un'attribuzione ciascuna (42 col rimando, 1 senza);
    1530/1530 ancore risolte e 129 rimandi interni invariati; indice di ricerca
    invariato (1530 ancore, 41 pagine — la pagina legale non ci entra); `tsc` e
    `build` ok, 53 pagine statiche. 21/21 in Chromium.
    Difetto trovato dalla misura e corretto: a 390px la pagina scorreva in
    orizzontale. L'URL della licenza è un token che il browser non sa dove
    spezzare — ora i link esterni portano `srd-indirizzo`
    (`overflow-wrap: anywhere`).
    Resta aperto: il sito non ha una pagina di condizioni d'uso proprie, e la
    nota in cima a questa distingue i due materiali a parole (contenuti SRD in
    CC-BY, software in MIT) rimandando al repo. Basta finché il sito non
    raccoglie niente oltre l'account; il giorno che serve, quella nota è il
    posto da cui linkarla.
- [ ] **SRD 5.1 (2014) in italiano** — in futuro, come edizione alternativa
  affiancata alla 5.2.1 (selettore di edizione, non una sostituzione).
- [ ] **Traduzione inglese** — in futuro, dopo il completamento dell'italiano:
  i18n del sito e dei contenuti SRD (l'SRD inglese 5.2.1 è già disponibile
  come fonte ufficiale).

## Strumenti della mappa

- [x] **Architettura estendibile per gli strumenti + righello** — fatto
  (23 lug 2026). Nuovo `public/app/strumenti/` (`gestore.js`, `svg.js`,
  `righello.js`, `index.js`) e un secondo SVG `#plan-tools-svg` sopra la tela,
  mai riscritto da `renderCanvas()` (che rifà `plan-svg.innerHTML` a ogni
  disegno, polling del tavolo compreso): `pointer-events:none`, viewBox
  sincronizzato nell'unico punto che già lo scrive (`planApplyVB` in `mappa.js`),
  niente `z-index` — lo tiene l'ordine del DOM. Il gestore è l'unico proprietario
  di registro, tool attivo, pulsanti (`#map-tools` in `app.html`), scorciatoie e
  listener Pointer Events **in cattura** su `plan-svg`: precede i gesti della
  mappa (bubble) e li blocca con `stopImmediatePropagation()` **solo** quando un
  tool prende il gesto; senza tool attivo la mappa è identica a prima. Dipendenze
  DOM iniettate via `opts` (così gira sotto Node coi fake). Il righello (scope
  `tutti`, scorciatoia R, geometria pura `distanzaCelle`) è il tool di
  riferimento: misura in quadretti e metri, non tocca lo stato né `save()`.
  `METRI_PER_CELLA` è diventata un numero in `modello.js` (prima `battaglia.js`
  inventava la stringa `"1,5 m"`), formattata con l'unità solo nella UI.
  Documentato in `CLAUDE.md` (sezione "Strumenti temporanei della mappa" +
  contratto). Test: `test/strumenti/*.test.mjs` (`node:test`, ora `npm test` in
  CI) — 16 casi sul gestore e sulla geometria; verifica in Chromium (DM: viewBox
  sincronizzato, righello disegna, misura sparisce a rilascio, tool resta attivo,
  Esc spegne, pan della mappa intatto senza tool, console pulita; tavolo RO:
  righello presente e misura), `tsc` e `npm test` ok.
  - [x] **Aree d'effetto, quattro footprint** — fatto (23 lug 2026).
    Geometrie pure per cerchio, cono, linea e quadrato, tutte cablate al gesto.
    Il gestore ha ora un callback `keyDown(ctx,ev)→bool` nel contratto (inoltra
    il tasto al tool attivo prima delle scorciatoie, mai Escape); le aree scelgono
    il sottotipo coi tasti 1–4 e ridisegnano l'anteprima in corso al cambio.
  - Prossimi tool, un file per volta: percorso a waypoint, coordinate (tool passivo,
    servirebbe un callback `hoverMove` da aggiungere al contratto), mirino/raggio.
    Tutti temporanei, stesso contratto. I tool **persistenti** (aure salvate, fog
    of war, condizioni sulle pedine, ping condiviso) non passano dal registro
    finché non hanno schema dati, migrazione, salvataggio cloud, proiezione
    server-side del tavolo e autorizzazioni.

## Sincronizzazione cloud

- [x] **Recupero offline e conflitti di salvataggio (P0.1)** — fatto
  (24 lug 2026). Prima: la PATCH leggeva la riga, controllava la proprietà e poi
  scriveva, quindi due schede sulla stessa campagna si sovrascrivevano in
  silenzio; e la cache offline stava sotto `runebog-gm-v1`, **una chiave sola per
  tutte le campagne**, senza sapere da quale versione del server discendesse — al
  ritorno online l'unico gesto possibile era spedire e sperare.
  Ora `campaign.revision` è un contatore monotono (migrazione
  `drizzle/0001_revisione-campagna.sql`) e la condizione sta **dentro l'UPDATE**
  insieme a quella di proprietà: zero righe aggiornate è il 409, e il 409 riporta
  la versione del server perché il client possa mostrarla senza ridipendere dalla
  rete che ha appena fallito. Una PATCH senza `baseRevision` è 400, non revisione
  0. Frontend: `public/app/sync-cloud.js` (formato della cache, classificazione,
  riconciliazione dell'ACK, dialogo), il blocco cloud di `stato.js`, `/play/[id]`
  che inietta anche `revision` e `updatedAt`, `main.js` che non salva più
  all'avvio in cloud. Tre azioni e nessun Annulla — conserva cloud, recupera
  locale, esporta entrambe — e **nessun merge automatico**. Test:
  `test/sync/cloud-sync.test.mjs`, 13 casi puri (ora in `npm test` e in CI);
  `tsc` e `npm run build` ok. Documentato in `CLAUDE.md`.

  **Resta da fare**, e sono cose misurate, non ipotesi:

  - **La migrazione va applicata a ENTRAMBI i branch Neon** (`production` e
    `dev`, vedi Trappole in `CLAUDE.md`) **prima** che il codice nuovo giri: una
    route che scrive `revision` su un DB senza la colonna dà 42703, e il guasto
    del 15 lug 2026 è esattamente questo. Ordine: backup → migrazione su
    entrambi → deploy → smoke test. Un rollback del solo codice è innocuo, la
    colonna in più non dà fastidio: **non toglierla** durante un'emergenza.
  - [x] **L'atomicità non ha un test automatico** — **verificata il 6 ago 2026**,
    e resta senza test automatico apposta: servirebbe un DB, e i test di questo
    repo sono puri per scelta. La prova è però ormai una ricetta di quindici
    minuti (branch Neon usa-e-getta, `npm run dev` puntato lì, account
    registrato dal form), e va rifatta se si tocca la route. **39/39 controlli**,
    con la verifica scritta nello scratchpad e buttata.
    - Provato tutto l'elenco che stava qui: le due schede e il 409, offline +
      chiusura + riapertura, la cache di una campagna non proposta per un'altra,
      la modifica **durante** la PATCH con la rete rallentata a 2,5 s (due
      scritture sequenziali, la seconda non si perde).
    - **La frase di questa voce era sbagliata**, e l'ha detto la misura: chiedeva
      che «la versione di A resti intatta qualunque delle tre azioni si scelga».
      Con **«Recupera locale» la versione di A viene sovrascritta** — è il senso
      di quell'azione, ed è esplicita perché l'utente ha appena guardato l'altra
      versione (`onRecoverLocal` ribasa su `server.revision`). Intatta la lasciano
      **due** azioni su tre; la proprietà vera, quella che vale per tutte e tre, è
      che **nessuna sovrascrive in silenzio**.
    - **Due schede non provano l'atomicità**, e questo è il buco che la voce non
      vedeva: a mano le due PATCH non partono mai davvero insieme, quindi anche
      un "leggi-poi-scrivi" passerebbe il giro. Il controllo che conta sono **N
      PATCH concorrenti dalla stessa base**: otto → una 200, sette 409, revisione
      +1. **Controprova** (riscritta la PATCH come leggi-poi-scrivi e poi
      revertita): **sei 200 su otto** e la revisione a 6, cioè cinque
      sovrascritture silenziose. Chi tocca quel `where` rifaccia questa, non le
      due schede.
  - [x] **La cache legacy si vedrà una volta sola per utente** — guardata con un
    account vero il 6 ago 2026, **ed era rotta**. Chi ha più campagne cloud ha
    sotto `runebog-gm-v1` l'ultima aperta, quindi aprendone un'altra riceve il
    dialogo con dentro il titolo sbagliato: il testo lo dice e chiede di
    «**controllare il titolo** prima di recuperarla», ma il dialogo **un titolo
    non lo mostrava**. L'unico modo di controllarlo era recuperare la copia,
    cioè fare esattamente la cosa di cui si è incerti.
    - Corretto in `sync-cloud.js`: la didascalia porta ora i due titoli accanto
      alle due date (`nomeCampagna`, taglio a 60 caratteri perché `titleChars`
      ne ammette 500 e quella riga è una didascalia). Nel conflitto i due titoli
      sono spesso uguali e si mostrano lo stesso: «sono la stessa campagna» è a
      sua volta la risposta a una domanda che lì ci si fa.
    - **È un difetto che nessuna prova a occhio poteva trovare**, perché la
      cache legacy non ce l'ha nessuna installazione nuova: bisogna seminarla a
      mano. Verificato che dopo la scelta la vecchia chiave se ne va davvero e
      non ricompare sulla campagna successiva.
    - Il resto della voce resta vero: si vede **una volta sola per utente**, e il
      dialogo non spedisce mai quella copia da sé.
  - **Il tetto di localStorage non è quello della PATCH**: una campagna vicina ai
    4 MB può far fallire la scrittura della cache (quota ~5 MB per origine) e
    l'app lo dichiara ("Solo in memoria — usa Esporta"), ma vuol dire che proprio
    le campagne più pesanti sono quelle senza rete di recupero. Le immagini fuori
    dal JSON risolverebbero entrambi i limiti insieme — voce sua qui sotto.

## Immagini fuori dal JSON

**Completato il 19 settembre 2026.** I paragrafi sotto conservano l’indagine e
le decisioni precedenti; l’implementazione finale aggiunge:

- `POST /api/campaigns/[id]/images`: upload autenticato nella tabella già
  esistente, corpo letto con limite anche senza Content-Length, MIME ammessi,
  URL casuale immutabile. Quote, inclusi gli orfani: **500 immagini / 32 MiB
  per campagna**, **2000 / 128 MiB per utente**. Lock e inserimento nella stessa
  transazione impediscono che upload paralleli superino la quota.
- `public/app/immagini.js` e salvataggio cloud: upload dei data URL, poi PATCH
  con riferimenti. La prima apertura migra le campagne vecchie senza riscrivere
  il database in massa. Le modifiche durante l’upload restano nella scheda e
  vengono inviate dopo l’ACK; gli upload già riusciti si riusano nei retry
  della sessione, solo nella stessa campagna. Lo standalone mantiene i data URL.
- Export normale **e dei conflitti**: snapshot completo, immagini reincorporate,
  avanzamento e nessun download se manca una figura. L’import cloud ricopia le
  figure nella campagna destinataria e non sostituisce il documento se fallisce.
  Il backup ammette **64 MiB** (128 per le due copie del conflitto), mentre il
  limite del documento cloud resta **4 MiB**. Si contano anche gli URL ripetuti
  prima di espanderli, per non creare JSON enormi in memoria. La quota locale
  dello standalone rimane quella del browser.
- La PATCH verifica che i riferimenti locali esistano e appartengano alla
  campagna, sotto lock; riferimenti mancanti/altrui danno 422. Creare una nuova
  campagna via API con riferimenti locali non ancora caricati viene rifiutato.
- Spazzino in upload/PATCH, con **30 giorni di grazia**: segna gli orfani,
  azzera la data se l’immagine torna referenziata e cancella solo gli scaduti.
  Mai cancellazione alla rimozione di un nodo. Per le campagne inattive:
  `node --env-file=.env scripts/pulisci-immagini.mjs` conta soltanto;
  `--apply` esegue la manutenzione. Non è stato lanciato sui dati dell’app.
- Cascate e query provate su PostgreSQL 17 in Docker, database usa-e-getta.
  Gli handler HTTP sono provati con Drizzle e quel database, sostituendo solo
  sessione e trasporto Neon. Chromium copre migrazione, errore upload, modifica
  durante l’upload, backup normale/conflitti, import cloud/standalone e immagini
  mancanti. Nessun nuovo servizio, dipendenza o migrazione.


- [x] **Le immagini in base64 pesano su tutto ciò che il documento attraversa**
  — indagine del 30 lug 2026, nessuna riga toccata. Era un inciso di mezza riga
  nella sezione qui sopra; questa è la misura, perché il primo passo onesto è
  sapere quanto costa davvero, non scrivere lo schema.

  **Dove stanno oggi**: `n.img` e `n.bg.img`, prodotte da `compressImage`
  (`pannello.js:470-482`, gemella in `mappa.js` per lo sfondo) che ridimensiona
  a 1400px per lato e ricodifica in JPEG 0,82. Il documento le contiene, quindi
  le porta in ogni posto in cui va.

  **I due tetti che si toccano**, entrambi letti dal codice:
  - `documentBytes` è 4 MiB − 4096 e `imageBytes` è 3,75 MiB
    (`formato-campagna.js:28-29`): **una sola immagine può prendersi il 96% del
    documento**, e il resto della campagna sta in quel che avanza.
  - La quota di `localStorage` è ~5 MB per origine. Quando `writeCloudCache`
    (`sync-cloud.js:89`) viene rifiutata, l'app lo dichiara ("Solo in memoria —
    usa Esporta", `stato.js:566,652,673,687`): sono proprio le campagne più
    pesanti a restare senza rete di recupero.
  - Il codice lo aveva già previsto: `src/app/api/campaigns/[id]/route.ts`
    diceva «immagini enormi → storage esterno in v2».

  **I tetti stanno tutti in SALITA** (verificato il 31 lug 2026): `MAX_BYTES`
  nella PATCH, `requestBytes`, `documentBytes` e `imageBytes` mordono sulla
  scrittura o su cosa si conserva. **In discesa non c'è nessun controllo** —
  né `GET /api/tavolo/[token]`, né `/tavolo/[token]`, né `/play/[id]` guardano
  quanto stanno spedendo: servono quel che trovano nella riga.
  - A tenere sotto controllo il traffico è solo il fatto che **sopra i 4 MB non
    ci si scrive**, quindi sopra i 4 MB non ci si legge. È un'implicazione, non
    una regola, e questo lavoro **la scioglie**: un documento da 48 KB potrà
    puntare a quaranta figure da 600 KB, cioè 24 MB per apertura, passando la
    validazione senza fatica. Il limite non va spostato, va **sostituito** — e
    la sostituzione non è un numero più grande sul documento: è che le immagini
    diventano risorse a sé, quindi memorizzabili in cache e scaricate una volta
    invece che a ogni apertura. È il guadagno vero, e **il confine 4 può
    mangiarselo**: se le immagini condivise finiscono dietro un'autorizzazione
    tornano non memorizzabili, e si è pagato lo schema senza incassare niente.
  - **I 4 MB non sono più imposti da Vercel.** Il commento accanto a
    `MAX_BYTES` li spiegava col limite della piattaforma sui corpi delle
    richieste (~4,5 MB), che nel frattempo è stato alzato a 100 MB: sono una
    scelta di questo repo — Neon, i ~5 MB per origine di `localStorage`, il
    tempo di parse — e vanno difesi come tale. Corretto il 31 lug 2026, perché
    chi un domani discute quel numero deve partire dal motivo giusto. Il limite
    sul lato **risposta** non è stato verificato: la documentazione non lo
    restituisce, e non lo si dichiara per sentito dire.

  **Cosa ha aggiunto la misura**, e sono due cose:
  - **Quante immagini ci stiano in una campagna non è prevedibile.** Il base64
    costa un +33% esatto (aritmetica, non stima), ma il peso di un JPEG dipende
    dal contenuto: ai parametri di `compressImage` un riquadro piatto fa 15 KB
    in base64, un gradiente 38 KB e del rumore pieno 1,55 MB — cioè **da 264
    immagini a due** dentro lo stesso tetto. Misurato con `sharp` su contenuti
    sintetici, che **non è l'encoder di Chrome**: dice l'ordine di grandezza e
    soprattutto la dispersione, non il numero dell'app.
  - **Rifatta in Chromium** (31 lug 2026), chiamando `compressImage` di
    `pannello.js` — la funzione spedita, l'encoder vero — su tre immagini da
    2400px che coprono le famiglie di contenuto vere: una mappa disegnata
    (regioni piatte e linee), una battlemap su pergamena (le stesse regioni più
    una texture su tutta la superficie), uno scan a dettaglio fitto.

    | famiglia | in base64 | ne stanno nel documento |
    |---|---|---|
    | mappa disegnata | 153 KB | 26 |
    | battlemap su pergamena | **607 KB** | **6** |
    | scan / fotografia | 931 KB | 4 |

    Tre cose che la misura col solo `sharp` non poteva dire:
    - **Chrome codifica più pesante di sharp**: −2% sul piatto ma **+16/+18%**
      su tutto ciò che ha texture. I numeri del 30 lug **sottostimavano** il
      caso normale, che è appunto quello con la texture.
    - **La dispersione vera è ×7, non ×132.** Fra due contenuti *plausibili* si
      passa da 26 immagini a 4; il ×132 veniva dagli estremi sintetici (un
      riquadro a tinta unita e del rumore puro), che nessuno carica.
    - **Il caso normale è ~6 immagini**, e questo cambia la riga "non è urgente"
      qui sotto: il tetto non lo si tocca solo per sbaglio: lo si tocca con
      **sei battlemap**, che è una campagna piccola. La riga resta perché
      nessuno l'ha segnalato, non perché il tetto sia lontano.
  - **Il costo peggiore non è il salvataggio: è l'apertura.** `/play/[id]`
    inietta il documento intero dentro l'HTML e risponde `private, no-store`
    (`src/app/play/[id]/route.ts:33`), per una ragione che resta valida — una
    copia in cache rimetterebbe in circolo una revisione già superata. Quindi le
    immagini viaggiano a **ogni** apertura dell'editor e non possono stare in
    nessuna cache, mai. Al tavolo invece il caso è già mitigato dall'ETag del
    29 lug: ripartono solo quando il DM ha salvato.

  **I cinque confini da decidere PRIMA di scrivere una riga.** Il primo non è un
  dettaglio di implementazione: è la domanda che decide lo schema.
  1. ~~**L'export smette di essere autosufficiente.**~~ **Deciso il 31 lug
     2026: l'export resta autosufficiente**, cioè le immagini si
     **re-incorporano in base64 al momento dell'esporta**. Un file di campagna
     continua ad aprirsi ovunque — su un altro computer, standalone, fra un
     anno — e questa è la proprietà che non si baratta: un export che rimanda a
     un server è un backup che scade, e un backup che scade non è un backup.
     Cosa ne discende, e va tenuto:
     - **La forma del documento esportato non cambia**, quindi nemmeno il suo
       `schemaVersion`: quel che cambia è dove le immagini stanno **a riposo**
       (nel JSONB e in `localStorage`), non cosa c'è nel file. Un lettore di
       oggi apre un export di domani.
     - **L'esporta diventa un'operazione di rete**, e prima non lo era: deve
       riscaricare ogni immagine per rimetterla dentro. Vuole quindi un suo
       stato di avanzamento e un suo modo di fallire — offline, oppure
       un'immagine che non c'è più — e "fallire" qui non può voler dire
       scrivere un file a cui mancano delle figure senza dirlo.
     - **L'import deve accettare entrambe le forme** (`data:` e `https://`),
       che è già vero per `safeUrl` ma non per chi le legge: un import con URL
       è quel che si ottiene copiando il JSONB a mano, e non deve rompersi.
  2. **`safeUrl` accetta già `https://`** (`modello.js:450-455`, `share.ts:100`,
     e la whitelist del contratto a `formato-campagna.js:312`, che deve restare
     almeno stretta quanto le altre due): un URL esterno non è un campo nuovo e
     il modello lo regge già. Quel che cambia è che il documento comincia a
     **puntare** a una risorsa invece di contenerla, cioè un riferimento che si
     può rompere — e finora in questo repo i riferimenti si risolvono sul
     server per costruzione.
  3. ~~**Chi cancella.**~~ **Deciso il 6 ago 2026: mai in sincrono con un gesto
     dell'utente.** Gli snapshot di `undo` sono `JSON.stringify` dello stato,
     quindi uno snapshot di dieci minuti fa **referenzia ancora** l'immagine di
     una bolla appena cancellata: buttarla all'istante rompe l'annulla, cioè
     proprio la funzione che esiste per rimediare. Due regole sole:
     - la **campagna cancellata** porta via i suoi blob. La riga `user` ha già
       `ON DELETE CASCADE` per il diritto alla cancellazione (GDPR art. 17): i
       blob devono seguirla, sennò un account cancellato lascia in giro le sue
       mappe, che è la promessa che `deleteAccountAction` fa.
     - gli **orfani** si spazzano con un **periodo di grazia** — confronto fra
       ciò che il documento referenzia e ciò che è depositato, e si butta solo
       quel che è orfano da più di N giorni, con N largamente sopra una sessione
       di editing. Così l'undo non può romperlo.
     - **Il rovescio, ed è vero**: finché lo spazzino non c'è, gli orfani si
       accumulano **senza tetto**. Oggi quel tetto lo dà il documento; togliendo
       le immagini dal documento lo si toglie anche a quello, e chi risostituisce
       la stessa battlemap venti volte lascia venti blob da 600 KB.
  4. ~~**L'autorizzazione al tavolo.**~~ **Deciso il 6 ago 2026: URL non
     indovinabile, pubblico e memorizzabile in cache.** È il confine che poteva
     mangiarsi tutto il guadagno — dietro un'autorizzazione le immagini tornano
     non memorizzabili, e il guadagno vero non è un documento più piccolo ma una
     figura scaricata **una volta** invece che a ogni apertura dell'editor.
     - È **il modello di fiducia che questo repo ha già scelto**:
       `/tavolo/[token]` è un link segreto, non un'area autenticata. Chiedere
       alle immagini una difesa più forte di quella del tavolo che le contiene
       non protegge niente.
     - L'URL di un'immagine **non condivisa non lascia mai il server**:
       `projectForPlayers` costruisce la proiezione campo per campo, quindi ai
       giocatori arriva l'indirizzo solo di ciò che è `shared === true`. Il
       filtro esiste già e non cambia — ma da quel giorno **è anche il filtro
       che decide chi può leggere un file**, non solo cosa si vede sulla tela.
     - **Il rovescio, dichiarato**: un URL uscito al tavolo **resta valido anche
       dopo che si rigenera il link di condivisione**. Oggi ruotare `shareToken`
       chiude fuori tutti di colpo; con le immagini fuori chiuderebbe fuori
       tutti tranne chi si è salvato l'indirizzo di una figura. Renderle
       revocabili vorrebbe dire ri-chiavare ogni URL del documento a ogni
       rotazione — caro, e per un valore che non pareggia il prezzo.
  5. ~~**Dove.**~~ **Deciso il 6 ago 2026: in Neon, in una tabella sua, servite
     da una rotta `/immagini/[chiave]`.** Nessuna dipendenza nuova e nessuna
     voce di spesa — vincolo posto quel giorno: solo cose gratis (Vercel Blob
     era stato consigliato e **ritirato**, l'organizzazione Neon è sul piano
     `free`).
     - **La domanda "dove" era mal posta, e per questo la risposta sembrava
       costare**: le immagini **sono già in Neon oggi**, in base64 dentro
       `campaign.data`. Spostarle in una tabella loro non aggiunge un byte allo
       storage — semmai ne toglie, perché il base64 costa un +33% esatto che in
       `bytea` non si paga. Quanto se ne recuperi davvero **non è misurato**:
       il JSONB passa da TOAST, che una parte di quel gonfiore la comprimeva
       già. Il punto regge comunque nel verso che conta: **non può costare più
       di adesso.**
     - **Il guadagno non dipendeva mai da dove stanno i byte**, ma da due cose
       che questa forma dà entrambe: il documento smette di **portarsele
       addosso** (PATCH, `localStorage`, e l'HTML di ogni apertura di
       `/play/[id]`), e l'immagine diventa una risorsa con un URL **immutabile**,
       quindi `public, max-age=31536000, immutable` e scaricata una volta. È il
       CDN a servirla dopo il primo giro, non la funzione.
     - **La chiave è casuale, non un hash del contenuto.** Il content-addressing
       dedupllicherebbe, ma farebbe condividere lo stesso oggetto fra due utenti,
       e allora cancellare torna a essere un conteggio di riferimenti — cioè
       riapre il confine 3 dal lato peggiore. Una chiave casuale tiene la
       proprietà 1:1 e rende la cascata banale.
     - **La rotta sta FUORI da `/api`**, ed è una scelta, non un dettaglio:
       l'invariante della copia offline dice che `/play`, `/tavolo` e `/api` non
       entrano mai in cache. Lì la ragione è che quelle risposte **invecchiano**;
       un'immagine a chiave immutabile no, per costruzione. Fuori da `/api` la
       regola resta una riga sola e si apre la porta a una copia offline che
       tenga anche le figure — cosa che con un deposito esterno non sarebbe
       possibile affatto.
     - **Il rovescio, dichiarato**: ogni miss di cache è un'invocazione di
       funzione più una lettura di Neon, e il piano free ha ore di compute e
       autosospensione. Per lo strumento di un DM è niente; se un giorno lo
       diventasse, la sostituzione è **una rotta sola** da riscrivere, perché il
       documento contiene già solo URL.

  **Una conseguenza che nessuno dei cinque confini nominava**: se le immagini
  escono dal JSON, **le due metà del prodotto divergono**. In cloud stanno
  fuori; in **standalone** — dove non c'è nessun server a cui caricarle —
  restano per forza in base64. Non è un problema (il confine 1 impone già che
  l'import accetti entrambe le forme, e la lettura è tollerante), ma vuol dire
  che `compressImage` avrà due destinazioni e soprattutto che **la quota di
  `localStorage` non si scioglie per chi lavora offline**. Questa sezione oggi
  dice che il lavoro risolve "entrambi i limiti insieme": per lo standalone è
  falso, e con la copia offline del 2 agosto lo standalone non è più il caso
  marginale che era.

  **Non è urgente, ma il tetto è più vicino di così**: nessuno ha segnalato di
  aver sbattuto contro i 4 MB e la lettura tollerante non ha niente da temere,
  però la misura in Chromium dice che a riempire il documento bastano **sei
  battlemap** — non "una campagna enorme". È l'unica voce rimasta che tolga un
  limite invece di rifinire.

  **Tutti e cinque i confini sono decisi** (1 il 31 lug, 3-4-5 il 6 ago), quindi
  da qui in poi non c'è più niente da decidere: c'è da costruire, e **non c'è
  niente da provvedere** — nessun servizio nuovo, nessuna variabile d'ambiente
  nuova, nessuna spesa. L'ordine: ~~migrazione con la tabella delle immagini~~
  (**fatta il 6 ago 2026**, vedi qui sotto) →
  la rotta `/immagini/[chiave]` con la cache immutabile → il caricamento in
  `compressImage` (le due gemelle, `pannello.js` e `mappa.js`) → l'esporta che
  re-incorpora (con avanzamento e un modo di fallire che non scriva un file a
  cui mancano figure) → la cancellazione a cascata → lo spazzino col periodo di
  grazia.

  **Un URL relativo oggi NON passa**, ed è la cosa che questa decisione porta
  con sé (verificato il 6 ago 2026 su tutti e tre i posti): `safeUrl`
  (`modello.js:450`, `share.ts:100`) pretende `data:image/` oppure `https?://`,
  e `validateImage` nel contratto (`formato-campagna.js:320`) fa lo stesso —
  un `/immagini/abc` cade nel ramo `data:` ed esce `invalid_image_type`, cioè
  **422 al salvataggio**. Le due strade:
  - **URL assoluti** (`https://runebog.app/immagini/…`): zero righe da toccare,
    ma incolla l'**origine dentro il documento** — su `localhost` e sulle
    preview le figure verrebbero dalla produzione, e il JSONB porterebbe un
    nome di dominio che un domani cambia.
  - **URL relativi**, allargando i tre elenchi con una regola **ancorata e
    stretta** (`^/immagini/[A-Za-z0-9_-]+$`): il documento resta indipendente
    dall'origine, che è la proprietà per cui l'export è autosufficiente
    (confine 1). Costa toccare la tripletta di sicurezza — e quella si tocca
    tutta insieme, con un test in `test/critici/` che provi al negativo che
    `/immagini/../qualcos'altro` e un `//evil.example` non passino.

  **Scelta la seconda** (6 ago 2026): il prezzo è un test da scrivere una volta,
  il prezzo della prima sarebbe un dominio scritto dentro ogni riga del JSONB.
  `IMMAGINE_LOCALE` (`^/immagini/[A-Za-z0-9_-]{1,64}$`) è **esportata dal
  contratto e importata** da `modello.js` e da `share.ts`: dei tre elenchi di
  `safeUrl` questa riga non è ricopiata, ed è l'unica su cui client e server non
  possono permettersi di divergere senza che il DM si veda rimbalzare con 422
  una campagna legittima. `..`, `//altro.host`, query e frammenti cadono **per
  costruzione** — nessuno dei loro caratteri sta nella classe — invece che per
  un controllo in più che qualcuno può dimenticare.

  ### [x] Il primo passo: la migrazione (6 ago 2026)

  `drizzle/0002_immagini-fuori-dal-json.sql`, tabella `campaign_image`.
  **Applicata a ENTRAMBI i branch Neon**, col backup di produzione prima
  (`backup-pre-immagini`, `br-icy-voice-ass1lhdg`), che è la procedura scritta
  qui sopra e quella che il guasto del 15 lug 2026 aveva insegnato.
  `npx tsc --noEmit`, `npm test` (99) e `npm run build` puliti; nessuna riga di
  codice usa ancora la tabella, quindi il deploy non è vincolato a niente.

  - **La forma**: `id` (chiave casuale, `crypto.randomUUID()`), `campaign_id`
    con `ON DELETE cascade`, `mime`, `bytes` in **`bytea`**, `created_at` e
    `orphan_since`. Due indici, uno per parte del lavoro dello spazzino: per
    campagna (il diff col documento) e per `orphan_since` (il passaggio che
    cancella).
  - **`orphan_since` è il periodo di grazia in forma di colonna**: si segna
    quando lo spazzino vede un'immagine non più referenziata, si cancella a un
    passaggio successivo, e **si riazzera se torna referenziata** — che è
    esattamente cosa succede premendo Ctrl+Z. Senza quella colonna la politica
    "mai cancellare in sincrono" non avrebbe dove stare, e l'undo tornerebbe a
    poter perdere un'immagine.
  - **Le due cascate sono state PROVATE, non dedotte da `confdeltype`**, sul
    branch usa-e-getta: cancellando l'**utente** spariscono campagna e immagine
    (è la promessa che `deleteAccountAction` fa per il GDPR art. 17);
    cancellando la **sola campagna** l'immagine se ne va e l'utente resta.
    Verificato che le due metà della catena `user → campaign → campaign_image`
    tengono entrambe, perché a reggere la promessa serve la seconda quanto la
    prima.
    - Trappola, per chi ripete la prova: mettere `DELETE` e conteggio nella
      **stessa** istruzione (in una CTE) dà un falso rosso — le CTE leggono lo
      snapshot d'inizio istruzione, quindi la riga risulta ancora lì. Va
      contata in una query separata.
  - **Nessun dato è stato toccato**: produzione aveva 9 campagne prima e dopo,
    e la tabella nasce vuota su tutt'e due i branch.

  ### [x] Il secondo passo: la rotta (6 ago 2026)

  `src/app/immagini/[chiave]/route.ts`, più `IMMAGINE_LOCALE` nelle tre
  whitelist e `src/lib/etag.ts`. `npx tsc --noEmit`, `npm test` (**104**, +5) e
  `npm run build` puliti; la rotta esce dinamica, com'è giusto.

  - **Provata contro il database vero** (branch usa-e-getta, righe seminate a
    mano), 9 casi: 200 con `immutable`+ETag+CSP+`nosniff`; **304** sul
    condizionale forte, su quello **indebolito** (`W/"…"`) e nell'elenco
    separato da virgole; 200 su un ETag diverso; **404** su MIME ostile, chiave
    inesistente (con `no-store`), chiave fuori forma e risalita del percorso.
  - **Una difesa nuova, per un'esposizione nuova**: il `Content-Type` lo decide
    una riga di database, quindi si controlla **in uscita** contro i tipi del
    contratto — una riga che dicesse `text/html` farebbe di questa rotta una XSS
    nell'origine del sito. Provato con una riga ostile in tabella: 404. Finché
    le immagini erano `data:` dentro il documento il caso non poteva esistere; è
    nato con l'averle messe su un URL nostro, ed è la prima conseguenza di
    questo lavoro che non stava in nessuno dei cinque confini.
    - Insieme: `default-src 'none'; sandbox` e `nosniff`, perché fra i tipi
      ammessi c'è `image/svg+xml` — inerte dentro un `<img>`, un documento che
      esegue script se **navigato**. La difesa sta nella rotta e non nel togliere
      l'SVG dal contratto, che è un problema di un'altra scala.
  - **`src/lib/etag.ts`**: il confronto debole di `If-None-Match` aveva un
    chiamante, ora ne ha due, e una regola che si sbaglia in silenzio non si
    ricopia. Il commento sul perché (RFC 9110 §13.1.2, e la misura del 31 lug
    sull'edge di Vercel) si è spostato lì.
  - **Il service worker non va toccato**, verificato leggendolo: `/immagini/…`
    non è nel manifesto, non è `/_next/static/` e un `<img>` non è
    `mode: "navigate"`, quindi il worker la lascia passare e risponde la cache
    HTTP — che con `immutable` è esattamente il comportamento voluto. Metterle
    anche in Cache Storage resta un passo a sé, quando si vorrà una copia
    offline con le figure.
  - **Controprova** del test: allargata `IMMAGINE_LOCALE` a `^/immagini/.+$`,
    tre test cadono (la regex, il contratto e la proiezione del tavolo);
    rimessa stretta, 104/104.

  **Cosa restava al 6 agosto** (completato il 19 settembre, vedi sopra): il caricamento in
  `compressImage` — le due gemelle in `pannello.js` e `mappa.js` — che deve
  diventare un'operazione di rete e quindi avere un suo modo di fallire;
  l'esporta che re-incorpora in base64, con avanzamento, e che **non** deve
  scrivere un file a cui mancano figure senza dirlo; la migrazione dei documenti
  già esistenti, che oggi hanno le immagini in `data:` e vanno lasciati
  funzionare (la lettura è tollerante: le due forme convivono per contratto);
  e lo spazzino degli orfani col periodo di grazia.

## Formato del documento campagna

- [x] **Schema versionato e validazione coerente (P0.2)** — fatto (25 lug 2026).
  Prima l'unica difesa in scrittura erano tre righe (`root`, `checklist`,
  `players` esistono): un albero profondo diecimila livelli, un id duplicato o
  un'immagine `data:text/html` passavano. Ora c'è **un solo contratto**,
  `public/app/formato-campagna.js` (riesportato al sito da
  `src/lib/formato-campagna.ts`): limiti, forme, `schemaVersion` e migrazioni
  nominate v0→v1 coi default **misurati** contro i render (`bg.opacity` 0.6,
  `type` zona/nota, id generati dove `x.id !== c.id` li richiede). Regola scelta
  insieme: **rigido in scrittura, tollerante in lettura** — import, POST e PATCH
  rifiutano con 422 e il motivo (413 per `document_too_large`), mentre
  `migrateState` e le due route del tavolo non falliscono mai per formato:
  normalizzano se possono e ripiegano sulle difese esistenti
  (`ultimoDifettoFormato`, `sanitizeState`, `projectForPlayers`).
  `projectForPlayers` dichiara `schemaVersion` per costruzione; `newCampaignData`
  nasce a versione corrente e viene validato anche lui nel POST.
  Test: `test/formato-campagna/` (22 casi puri, fixture v0 e v1 in
  `test/fixtures/`), in `npm test` e in CI. Verificato in Chromium (7/7:
  standalone nasce a `schemaVersion` 1, import invalido rifiutato col motivo e
  campagna intatta, import v0 migrato, console pulita) e via HTTP sul branch
  Neon `dev`: le tre campagne v0 reali escono dal tavolo a 200 con
  `schemaVersion: 1` nella proiezione. `tsc`, `npm test` 58/58 e build ok.

  **Resta da fare:**

  - [x] **La prova del 422 con una sessione vera** — **fatta il 6 ago 2026**,
    dentro la verifica delle 39 (branch Neon usa-e-getta, account registrato dal
    form vero). Resta non automatizzata apposta: vuole un DB e una sessione JWT,
    e i test di questo repo sono puri per scelta.
    - Il documento invalido è un titolo di **501 caratteri** (`titleChars` è
      500), forzato sullo stato dell'editor. Esce
      «Non sincronizzato: **Massimo 500 caratteri ($.root.title)** · copia locale
      conservata»: il **motivo col percorso**, che è l'unica indicazione su cosa
      correggere.
    - **La copia locale c'è ed è quella giusta**: contiene davvero il documento
      rifiutato ed è marcata `pending`, non sincronizzata. Il server non si
      muove — né revisione né titolo.
    - **Controprova**: a 500 caratteri lo stesso salvataggio passa e la revisione
      avanza. Senza, un verde direbbe solo che qualcosa non ha salvato.
  - **Le campagne v0 nel JSONB restano v0 finché qualcuno non le risalva**: la
    lettura è tollerante apposta, quindi non c'è fretta — ma finché esistono,
    `share.ts` deve continuare a leggere `tokenColor` e le route del tavolo a
    tenere il ripiego sulla riga grezza. Una tantum si può decidere una
    migrazione batch del JSONB, che oggi NON esiste di proposito.
  - ~~Le cartelle di staging rompevano `tsc` e build~~ — risolto (25 lug 2026):
    a integrazione finita i tre pacchetti Codex sono stati spostati fuori dal
    repo, in `~/progetti/runebog-pacchetti-codex/`, senza toccare `tsconfig`.

## Test degli invarianti critici

- [x] **Suite `test/critici/` (P0.3)** — fatto (25 lug 2026). Quindici test puri
  sugli invarianti che, regrediti, esporrebbero segreti o eseguirebbero contenuto
  importato: `jsonForScript` (chiusura `</script>`, U+2028/29, round trip);
  la proiezione del tavolo come **whitelist provata al negativo** — una campagna
  con segreti marcati (`"IL BOSS È UN DRAGO"`, PF esatti, id riservati, un campo
  `futureSecret` che oggi non esiste) proiettata e cercata nel JSON: niente deve
  comparire, mentre `malconcio`, la porta segreta resa muro pieno e i riferimenti
  risolti in nomi sì; `sanitizeState` (id e riferimenti bonificati coerenti, URL
  e colori ostili rimossi, muri invalidi caduti e validi agganciati);
  il generatore di dungeon (stesso seed = stesso dungeon byte per byte, geometria
  dentro la griglia, ogni mostro esportato presente nel bestiario sorgente).
  I test importano `share.ts`, `inline-json.ts` e l'engine **come `.ts`** via
  type stripping di Node: il vincolo che ne segue (sintassi cancellabile, import
  con estensione) è documentato in `CLAUDE.md` — è il motivo per cui `share.ts`
  ora importa `formato-campagna.js` direttamente e non dal wrapper.
  73/73 in `npm test` (58 esistenti + 15), `tsc` e build ok, CI invariata.

  **Resta fuori copertura, dichiaratamente** (dal README del pacchetto: questi
  sono test puri, non E2E — non descriverli come tali): localStorage reale,
  `pagehide`, richieste concorrenti vere, gesti browser, rendering, auth.
  I prossimi consigliati, in ordine: POST/PATCH con DB isolato (200/409/413/422);
  export → import → export della fixture legacy; browser: offline/chiusura/
  recupero, due schede sulla stessa revisione, tavolo con polling e revoca link.
  Per i browser test, scegliere un runner solo quando c'è una strategia stabile
  per DB e autenticazione di prova.

- [x] **Fixture delle verifiche in Chromium** — fatto (29 lug 2026).
  `test/browser/campagna-di-prova.mjs`: la campagna si costruisce e si semina di
  lì, le asserzioni no — quelle restano usa-e-getta, perché ogni verifica guarda
  un'altra cosa. Cinque cose, che erano le ~40 righe ricopiate ogni volta:
  `documentoDiProva()` (radice `zona` condivisa, un `luogo`/`edificio` con dentro
  una `stanza`, e a richiesta encounter, `root.battle`, pedine e muri con una
  porta), `semeStandalone` (le tre chiavi di `localStorage` più il tema),
  `semeTavolo` (il ponte `window.__table`), `serviTavolo` (la rotta del polling
  senza database) e `apriBrowser`/`attendiServer`.
  - **Gli id sono deterministici** (`locanda`, `pg1`, `ini-nemico2`), al
    contrario di `uid()`: un'asserzione deve poter nominare la bolla che guarda
    senza prima ripescarla dal DOM.
  - **Il documento passa dal contratto vero** (`prepareCampaignDocument`) e la
    proiezione del tavolo è `projectForPlayers` importata da `share.ts`, non una
    copia scritta a mano. Una fixture invecchia in silenzio: il giorno che il
    contratto stringe un campo, seminata a mano continuerebbe a disegnare
    qualcosa di plausibile mentre il server risponde 422.
  - **`serviTavolo` esiste perché il `visibilitychange` da solo non basta**:
    senza un server dietro il polling scrive "Offline" dopo cinque secondi. Lo
    stub tiene l'ETag = `revision` come la rotta vera, quindi si prova anche il
    304 e il caso "revisione avanzata, documento identico"; conta i giri
    (`{scaricati, invariati}`), che dal DOM non si vedono — un tavolo aggiornato
    e uno che riscarica dodici volte al minuto si disegnano uguali. Dal 31 lug
    2026 lo scrive anche nel **formato** della rotta (`"r1"`, virgolette
    comprese) e non come numero nudo: al client non cambia niente, ma "come la
    rotta vera" o è vero o non va scritto.
  - **Il numero di build di Chromium non è scritto a mano**: si prende il più
    recente dalla cache di Playwright, sennò la fixture muore al primo
    aggiornamento con un errore che parla di un file mancante e non del perché.
    `playwright-core` si cerca prima fra i moduli e poi nella cache di npx: non è
    una dipendenza del progetto, e trascinare un browser nel lockfile per una
    verifica manuale è caro.
  - **Sta fuori da `npm test`** (che elenca le cartelle una per una): quello è
    `node --test` puro e gira in CI, questo vuole un binario e un dev server.
  - Verificato: `node test/browser/verifica-fixture.mjs` 13/13 con `npm run dev`
    acceso (bolla e id sulla tela, titolo dall'indice, quattro voci d'iniziativa
    coi riferimenti risolti, porta disegnata, tema applicato; al tavolo `.ro`,
    nessuna nota DM nella proiezione, note giocatori presenti, encounter non
    condiviso assente, polling forzato che ridipinge, giro successivo a 304).
    `tsc` e `npm test` (97/97) invariati.

## Mappe in scala

La maglia esiste già ed è una sola — `CELL` 40px = 1 quadretto = 1,5 m (5 piedi),
identica tra pattern `#grid` in `mappa.js`, battaglia e `DG_SCALE` in `dungeon.js` —
ma oggi le bolle non la rispettano: sono simboli, non piante.

- [x] **Le stanze del generatore nascono con le pareti** — fatto (25 lug 2026).
  Il dungeon importato aveva le stanze come rettangoli colorati col perimetro
  *derivato*: si legge a colpo d'occhio ma non ci si gioca sopra, perché le
  porte stanno dove passa il raggio centro→centro di un arco e non dove il
  generatore ha messo la soglia. Ora l'import costruisce **muri veri**
  (`public/app/dungeon-muri.js`, chiamato da `dungeon.js`) sul nodo del livello
  — la bolla-dungeon — e spegne il perimetro derivato delle stanze
  (`rn.walls = false`), sennò sarebbero due piante della stessa stanza a 5px
  l'una dall'altra. Le porte sono le celle `3` della griglia, un quadretto
  l'una, `porta:"chiusa"` come quella della palette; il quadrato d'oro che le
  segnava nello sfondo è stato tolto (stava sulla cella di corridoio, cioè
  accanto alla porta vera: due segni per una porta sola).
  **Derivate all'import e non emesse dal motore**: la griglia dice già dove sono
  le pareti, quindi un campo nuovo vorrebbe uno schema nuovo, due verità da
  allineare, e lascerebbe senza muri ogni export già salvato — così invece anche
  un JSON di giugno nasce murato. Misurato: 44 muri per un dungeon da 6 stanze,
  122 per uno da 16 (il massimo che la UI concede), contro i 3000 di
  `wallsPerNode`.
  **Guasto trovato mentre si verificava, non dopo**: renderizzando l'output di
  un seed a caso (20260725, 11 stanze) una stanza usciva *sigillata*. Il motore
  marca le celle `3` guardando dalla cella di corridoio e si ferma alla prima
  stanza che tocca, quindi una soglia stretta fra due stanze finisce a una sola
  e l'altra resta murata pur avendo il corridoio addosso — col perimetro
  derivato non si vedeva, perché le porte venivano dagli archi. `apriUnPassaggio`
  promuove la prima cella di corridoio adiacente, una sola. Test nuovi in
  `test/dungeon/` (13, geometria pura più il giro completo col motore vero su 78
  dungeon: muri sulla maglia, porte da un quadretto, nessuna stanza sigillata,
  totale sotto il limite del formato); `tsc` e `npm test` (89) ok.
  Resta da provare a mano in Chromium: l'import dagli appunti e da file, i muri
  che si selezionano e si trascinano come quelli posati a mano, e il tavolo con
  la bolla-dungeon condivisa.

- [x] **Muri per le stanze** — fatto (19 lug 2026). Il muro è il perimetro
  spezzato dalle porte (`wallPlan` in `public/app/modello.js`, disegno in
  `shapeMarkup`/`wallsMarkup` di `mappa.js`, tinte in `app.css`), e **le porte
  non sono un dato**: stanno dove il raggio centro→centro di un collegamento
  buca il perimetro, ricalcolate a ogni disegno — spostare una stanza sposta la
  porta, togliere un arco richiude il muro, e non c'è uno stato "porte" che
  possa divergere. Default acceso solo su `stanza` (`walls:true` in `SHAPES`);
  su `edificio` i muri sono possibili ma spenti (`walls:"opt"`) perché
  `edificio` è la forma implicita di ogni `luogo` senza `shape`, e accenderli lì
  avrebbe messo pareti dentro ogni bolla già disegnata — stesso principio di
  "niente migrazione" delle forme in scala. Casella "Muri e porte" nel pannello,
  `n.walls` batte il default e viaggia al tavolo solo se scritto esplicitamente
  (`share.ts`). Un passaggio segreto **non apre** il muro: lascia un segno sopra
  la parete, così al tavolo — dove `DM_ONLY_EDGES` toglie proprio quell'arco —
  non resta un buco da spiegare. Il muro corre dentro la forma (`WALL_INSET`),
  sennò coprirebbe il contorno che porta selezione e alone di "condiviso".
  Verificato in Chromium: 23/23 sulla mappa (porte sui lati giusti, segreto
  chiuso su entrambi i capi, perimetro spezzato, default per forma, casella che
  accende/spegne, porta che scorre spostando la bolla, console pulita) e 6/6 sul
  generatore (11 stanze generate → 11 murate, 21 porte allineate ai corridoi,
  nessuna stanza sigillata, sfondo pianta intatto), `tsc` ok.
- [x] **Quadretti esattamente 1,5 m** — fatto (19 lug 2026), scope concordato:
  scala **solo per le forme architettoniche** (edificio, stanza, piazza — flag
  `grid:true` in `SHAPES`), quartieri/torri/segnalini liberi, e **niente
  migrazione**: le bolle esistenti fuori scala non si spostano da sole, si
  agganciano al primo tocco. Posizione e dimensioni in quadretti interi in ogni
  punto d'ingresso: creazione (dimensioni esplicite agganciate — i default di
  `SHAPES` non si toccano, sennò le bolle vecchie senza `w/h` migravano via
  `nodeBox`), trascinamento (senza allineamento magnetico, come le pedine:
  tirerebbe fuori maglia), resize, frecce (passo = 1 quadretto anche con
  Shift), input del pannello (step 40 + arrotondamento), duplica (+1 cella),
  Ordina (il GAP 50 assorbe l'arrotondamento ±20), atterraggio dei gruppi
  trascinati da un'ancora libera. Il pannello mostra la misura vera:
  "2×2 quadretti · 3×3 m". `CELL` ora è definita una sola volta in
  `modello.js` (battaglia la riesporta, `#grid` e `DG_SCALE` la importano).
  Scovato dal test un bug pre-esistente: `jumpTo` (ricerca, diario quest) non
  azzerava `multiSel`, quindi le frecce dopo un salto muovevano la selezione
  vecchia — ora il salto seleziona come il clic. Verificato: 12/12 in Chromium
  (creazione delle 4 forme, hint, input, nudge, drag, demo intatta dopo
  reload, console pulita) + regressione aggancio schede 15/15, `tsc` ok.
- [x] **Anche i segnalini stanno nel quadretto** — fatto (22 lug 2026). Quest,
  encounter, PNG, note e pedine cadevano dove capitava: erano l'ultima cosa
  libera su una mappa che nel frattempo è diventata in scala, e con la griglia
  sempre disegnata sotto si vedeva. Ora si agganciano, ma con la regola giusta
  per quello che sono: un simbolo è largo 30px in un quadretto da 40, quindi si
  aggancia il suo **centro** al centro della cella e non l'angolo alla riga —
  agganciare l'angolo l'avrebbe lasciato a cavallo di quattro celle, cioè "in un
  quadretto" per le coordinate e storto per l'occhio.
  - La regola stava già scritta, ma in un posto solo: `snapToCell` era in
    `battaglia.js` e valeva per le pedine in combattimento. Non era una regola
    della battaglia, era la regola di ogni simbolo sulla mappa: è passata in
    `modello.js` accanto a `snapGrid`, e `onGrid`/`snapNode` sono ora l'unico
    posto che decide dove va una bolla. I sette punti d'ingresso (creazione,
    trascinamento, atterraggio del gruppo, Ordina, frecce, duplica, import del
    dungeon) chiedono a lui invece di ripetere la scelta ciascuno per sé — prima
    erano tre rami `if` copiati, uno dei quali (`battleOn() && type==="token"`)
    esisteva solo perché la regola era nel modulo sbagliato.
  - Il raggio dell'aggancio è quello **disegnato** (`markerR`): la pedina è un
    pixel più grande del segnalino, e `mappa.js` ora legge di lì per disegnare il
    disco invece di ricalcolare `MARKER_R+1` a mano. Con un raggio sbagliato il
    centro geometrico finisce nella cella giusta e il disco no.
  - **Qui la migrazione si fa** (in `migrateState`), al contrario delle forme in
    scala: un simbolo si sposta al massimo di mezza cella e non cambia
    dimensione, quindi non può finire sopra una bolla che prima non toccava.
    L'unico modo di sovrapporne due è averli più vicini di un quadretto — e
    succedeva davvero: l'import del dungeon disponeva i PG a 36px l'uno
    dall'altro, sotto la cella, quindi ora li dispone a una cella.
  - Tolto `allineaPedineAllaGriglia`: allineava le pedine accendendo il
    combattimento, e non ha più niente da allineare. Era la stessa invariante
    detta due volte, una delle quali solo a modalità accesa.
  Verificato in Chromium: 19/19 sulla mappa (i cinque tipi di segnalino centrati
  dopo la migrazione, i cinque dischi **disegnati** col centro a 20px dal bordo
  cella, drag, frecce, creazione, la stanza che NON migra da sola ma si aggancia
  al primo tocco, la torre che resta libera, console pulita) e 6/6 sulla
  battaglia (accensione, griglia in modo battaglia, pedine nel quadretto,
  spegnimento); screenshot riletto a scala 1:1; `tsc` ok.
  Resta aperto: `nodeBox` dà 30×30 a ogni segnalino, ma il disco della pedina ne
  misura 32 — un pixel di scarto fra il centro geometrico (che muove archi e
  `nodeCenter`) e il centro disegnato. Non si vede e non l'ho toccato, ma è il
  motivo per cui `markerR` esiste come funzione invece che come costante.

- [x] **Muri nella selezione multipla e nel duplica** — fatto (22 lug 2026). Un
  perimetro si posava un pezzo per volta: Ctrl+D valeva solo per le bolle e i
  muri non entravano nella selezione multipla. Ora Ctrl+clic (e Spazio da
  tastiera) li aggiunge, la selezione può essere **mista**, e afferrandone uno
  qualsiasi si muove tutto insieme.
  - La scelta era fra selezione **tipata** (`{tipo, id}`) e **insieme separato**.
    Vinto il secondo (`st.multiSelWalls`): sei moduli leggono `st.multiSel`
    dando per scontato che contenga id di nodi, e riscriverli avrebbe messo le
    bolle — la funzione principale — a rischio per far entrare il caso
    secondario. Il prezzo è "i due insiemi si azzerano insieme", e si paga una
    volta sola: l'azzeramento vive in `clearSel()` invece che ricopiato in otto
    punti, che era già il modo in cui questo codice si rompeva.
  - Il trascinamento è **uno** per entrambe le àncore (`dragGroup` /
    `moveGroupBy` / `riagganciaGruppo`), non due strade parallele: due strade
    divergono, e quella dei muri si sarebbe scordata le bolle.
  - Due difetti di gruppo trovati ragionando sulla forma, non su un caso rotto:
    le frecce usavano un passo **per elemento** (quadretto per gli agganciati,
    10px per i liberi), quindi un gruppo misto si deformava a ogni battuta —
    ora il passo è uno solo per tutta la selezione; e `duplicateSelected`
    copiava un elemento solo anche con dieci selezionati, senza i collegamenti
    fra le bolle copiate: due stanze collegate uscivano come due copie sciolte.
  Verificato in Chromium: 11/11 sui muri (Ctrl+clic, pannello "N elementi",
  frecce, trascinamento di gruppo, Ctrl+D, Canc senza conferma, selezione mista
  trascinata dalla bolla, Esc) e 10/10 di regressione sulle bolle (gruppo,
  duplica con l'arco, passo 10/1 di una bolla libera, clic secco che collassa la
  selezione, "(copia)" solo sul singolo, conferma su bolla piena); `tsc` e
  `build` ok.

- [x] **Le porte sui muri liberi** — fatto (22 lug 2026). Finché una porta era
  solo il buco fra due muri, al tavolo non si distingueva da un varco e non
  c'era modo di dire "chiusa a chiave". Ora una porta è **un muro dichiarato
  porta**: `w.porta` fra `aperta`, `chiusa`, `chiave`, `segreta` (`DOOR_TYPES`
  in `modello.js`), si sceglie dal pannello o col tasto destro, e dalla palette
  («Pianta: Porta») nasce già lunga un quadretto — che è quanto è larga una
  porta. Il buco resta e va benissimo per un'arcata: le due cose ora si
  distinguono, che era il punto.
  - Porta = **segmento intero**, non una posizione dentro il segmento. Il
    perimetro si costruisce a quadretti, quindi la porta è il quadretto in cui
    sta; darle un'ascissa propria sarebbe un secondo sistema di coordinate per
    una cosa che la maglia dice già, e due sistemi divergono.
  - Il disegno l'ha deciso la convenzione delle piante, non il colore: anta
    **parallela** al muro = chiusa, **perpendicolare** = spalancata. Il primo
    tentativo lasciava il vano della porta aperta vuoto, e a guardarlo era di
    nuovo un buco — cioè il difetto che si stava riparando. Il catenaccio della
    chiusa a chiave è un tratto perpendicolare per la stessa ragione: forma,
    non tinta (stessa regola di `statusDot`).
  - **Sicurezza**: `DM_ONLY_DOORS` in `share.ts`. Una segreta al tavolo esce
    come **muro pieno** — il segmento parte, il campo `porta` no. È
    `DM_ONLY_EDGES` visto dall'altro lato: lì il dato sparisce, qui deve
    restare, perché toglierlo aprirebbe nel perimetro il buco che si sta
    nascondendo. I tipi ammessi sono dichiarati (`DOOR_KINDS`), quindi un tipo
    nuovo lato client sparisce al tavolo finché non si aggiorna il server.
  Due cose trovate guardando lo schermo e non nel codice: il segno della segreta
  a 4px su un muro da 6 lasciava un filo viola che il DM doveva **cercarsi**
  sulla propria mappa (ora copre il muro), e `planFit` ignorava i muri — un
  livello fatto **solo** di muri, cioè il battlemap per cui i muri liberi
  esistono, riceveva da "Adatta" la vista di default come un livello vuoto.
  Verificato in Chromium sui temi Bog, Pergamena e Brace (i quattro tipi
  leggibili a 1:1 in tutti e tre), pannello e menu contestuale, `projectForPlayers`
  chiamata davvero (chiusa esce, segreta esce come muro pieno, tipo inventato
  cade), `tsc` ok.
  Resta aperto: il verso di apertura dell'anta non è un dato — sta sempre dallo
  stesso lato. Aggiungerlo vuol dire un campo in più e un comando per girarlo,
  e al tavolo non cambia niente di ciò che si decide.

- [x] **Muri liberi: un perimetro per giocarci** — fatto (22 lug 2026). I muri
  c'erano già ma erano **derivati**: il contorno rettangolare di una bolla, con
  le porte dove passa un collegamento. Si leggono bene e non ci si gioca — è
  sempre un rettangolo, ed è il rettangolo di *una* bolla. Ora c'è la seconda
  cosa: il muro come **dato**, un segmento che si posa dalla palette («Pianta:
  Muro»), si trascina, si allunga tirando un capo. Con quelli si fanno stanze a
  L, corridoi e tramezzi, e le porte sono i buchi che si lasciano.
  - Vivono in `n.wallSegs` sul nodo del **livello**, come `n.edges`: sono il
    pavimento, non la sagoma di una bolla. `{id, x, y, dir, len}` con `len` in
    quadretti. Gli estremi vanno sugli **incroci** della maglia, non al centro
    della cella come i segnalini: su un battlemap le pedine stanno nelle celle e
    i muri fra una cella e l'altra.
  - Un gesto solo allunga **e** ruota (`stretchWallSeg`): l'altro capo sta fermo
    e l'asse lo decide lo spostamento più lungo. Niente comando "ruota".
  - Scelte del taglio: nessun campo da riempire nel pannello (un muro non ha
    nome né note: è geometria — c'è la misura in quadretti e metri e il tasto per
    toglierlo), e Canc lo elimina **senza conferma**, perché non contiene niente
    e rifarlo è un trascinamento.
  Tre difetti trovati dai test, non a occhio, e tutti e tre di una classe che a
  guardare lo schermo non si vede:
  - la classe CSS `wall` era **già presa** dai tratti del perimetro, quindi
    `closest(".wall")` intercettava i clic sul bordo di ogni bolla. Ora
    `.wall-seg`;
  - cliccando una bolla il muro selezionato **restava acceso in oro**: lì la
    tela non si ridisegna (il nodo sotto il puntatore deve sopravvivere al
    gesto) e la classe `.sel` si toglie a mano, da un elenco che non conosceva i
    muri;
  - un `null` dentro `wallSegs` faceva **crollare la proiezione del tavolo** —
    un 500 sulla pagina dei giocatori, da un JSON importato. Il client la
    guardia ce l'aveva, il server no: è esattamente il caso in cui "client e
    server devono concordare su cosa è un valore sicuro" non era vero.
  E una divergenza fra il commento e il codice: la regola dichiarata era «una
  coordinata non numerica fa cadere il muro», ma `Number(null)` è 0, quindi un
  muro senza coordinate ricompariva a 0,0 invece di sparire. Capita davvero:
  `JSON.stringify` scrive `null` al posto di un NaN.
  Verificato: 18/18 sulla mappa (posa, selezione con due maniglie, spostamento
  sugli incroci, allungamento, rotazione tirando di traverso, frecce,
  eliminazione, e il bordo di una stanza che seleziona la bolla e non un muro),
  6/6 sui muri ostili nell'app del DM (nessun attributo estraneo, nessun gestore
  eseguito, stato salvato bonificato), 10/10 su `projectForPlayers` chiamata
  davvero con dati ostili, 5/5 al tavolo in sola lettura (si vedono, niente
  maniglie, non si spostano); 19/19 e 6/6 le suite esistenti senza regressioni;
  `tsc` e `build` ok.
  Resta aperto: i muri non si duplicano (Ctrl+D vale solo per le bolle) e non
  entrano nella selezione multipla, quindi un perimetro lungo si costruisce un
  pezzo per volta. Non l'ho fatto perché la selezione multipla oggi è un
  `Set` di id di **nodi** e la scorciatoia dà per scontato `childOf`: farcela
  entrare vuol dire toccare il gruppo di trascinamento, non aggiungere un ramo.

- [x] **Pannello dettagli più largo e ridimensionabile** — fatto (19 lug 2026).
  Da 380px fissi (`max-width:42vw`) a 440px di default con maniglia di
  trascinamento tra tela e pannello (`#detail-grip` in `app.html`, gesto e
  persistenza in `main.js`): il contenuto è dove si legge davvero — note,
  descrizione per i giocatori, statblock SRD — e a 380px le coppie di campi
  affiancate (larghezza/altezza, tipo/stato) andavano strette. Limiti 320–760px
  più il tetto in `max-width:60vw`, che resta al CSS perché segue i resize della
  finestra: la larghezza ricordata su un monitor grande non deve mangiare la tela
  su un portatile. La misura è una preferenza dell'**interfaccia**, non della
  campagna: `localStorage` (`runebog-detail-w`) come il tema, non il JSON — che
  viaggia tra export, cloud e tavolo. Scritta una volta a fine gesto, non a ogni
  `pointermove`. Equivalente da tastiera (frecce, Shift = passo 40, Home =
  default) perché la maniglia è un `role="separator"` con `aria-valuenow`, e
  doppio clic per tornare al default; su mobile il pannello è un bottom sheet e
  la maniglia sparisce. Listener del drag su `window` e non sulla maniglia: è
  larga 5px e il puntatore ne esce subito (per lo stesso motivo il bersaglio è
  allargato a 11px con uno `::before` debordante). Verificato in Chromium:
  default 440, drag → 602 salvato e ritrovato dopo reload, frecce e Home,
  clamp a 760 e a 320, maniglia invisibile a 390px di viewport, `tsc` ok.

- [x] **XSS da JSON importato bonificato lato DM** — fatto (18 lug 2026). Il tavolo
  dei giocatori era già coperto da `share.ts` sul server, ma nell'app del DM i campi
  `img`, `bg.img`, `color`/`tokenColor` e gli `id` finivano grezzi dentro attributi
  HTML (`src`, `href`, `style`, `onclick`, `data-block`) in `pannello.js`/`mappa.js`.
  Il vettore è l'Importa: un JSON altrui (o una bolla-dungeon condivisa) di forma
  valida ma contenuto ostile — `img:'x" onerror=…'`, `id:"');…//"` — eseguiva codice
  nell'origine `runebog.app` con la sessione del DM (nessuna CSP a mitigare). Fix:
  `sanitizeState()` in `public/app/modello.js` (stesse regole `safeId`/`safeColor`/
  `safeUrl` di `share.ts`), chiamata da `migrateState` — l'imbuto di ogni caricamento
  (import, cloud, localStorage). `safeId` deterministico e idempotente su id e su ogni
  riferimento che lo punta (edge.a/b, playerId, foe.\*, order.\*): i lookup `x.id===ref`
  restano allineati, gli id legittimi (`uid()`=`[a-z0-9]{8}`) passano immutati.
  Verificato: 10/10 sulla funzione con payload ostili + in Chromium l'import ostile
  non fa scattare l'XSS, la bolla si disegna con l'id spuntato, il colore hex resta.

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
- [x] **L'empty state offre tutte le scelte, non "una bolla"** — fatto (18 lug 2026),
  seguito alla segnalazione che in una bolla nuova sembrava obbligatorio creare una
  bolla prima di poter mettere una quest o un encounter. Il trascinamento dalla barra
  già funzionava (fix `pointer-events` più sotto), ma restava l'impressione contraria
  perché l'unico comando visibile era "+ Aggiungi bolla", che crea una forma fissa.
  Causa aggiuntiva scoperta verificando: **sotto i 760px `#plan-toolbar` scorre in
  orizzontale con la scrollbar nascosta** (`scrollbar-width:none`), quindi su telefono
  metà palette — tutti i segnalini — è fuori schermo *senza alcun segno che esista*, e
  lì anche `#plan-hint` è `display:none`. Misurato: su 390px "Encounter" sta oltre il
  bordo destro della barra.
  Ora l'empty state contiene le stesse dieci scelte, generate da `SHAPES`+`SHAPE_COLORS`
  e `TYPES` (le sorgenti della barra: non possono divergere), con l'icona che ripete la
  forma e il colore che si otterrà. `addAtCenter(kind,key)` in `mappa.js` le crea al
  centro della vista.
  Attenzione al `pointer-events`: sta sui **chip**, non su `.empty-pal` — rendendo
  cliccabile il contenitore si riassorbivano i doppi clic sullo sfondo, cioè la stessa
  trappola di `#empty-node` in scala ridotta (colto dalla suite della voce 7).
  Verificato: 20/20, incluse tutte e dieci le scelte controllate sullo stato salvato e
  il caso telefono; suite precedenti tutte verdi.
- [x] **Colore delle bolle: default per forma + personalizzabile** — fatto (18 lug 2026).
  Prima il colore veniva dal TIPO, e siccome edificio e stanza sono entrambi "luogo"
  erano lo stesso teal: una pianta di dungeon era una distesa di rettangoli identici.
  Ora `SHAPE_COLORS` in `modello.js` dà un default per forma (quartiere verde,
  edificio teal, stanza sabbia, piazza ocra, torre viola — token esistenti, così i
  cinque temi restano coerenti senza aggiungerne), e `nodeColor()` è l'unico punto
  che decide il colore di una bolla: prima la logica era sparsa in quattro punti di
  `mappa.js` col token come caso speciale hardcodato.
  La tavolozza nel pannello ora vale per **ogni** bolla, non solo per i token, col
  campione "Predefinito" (barra diagonale) per tornare indietro — senza, colorare
  sarebbe stata una porta a senso unico. Il campo `tokenColor` diventa `color`:
  `migrateState` migra le campagne esistenti al caricamento e `share.ts` legge
  ancora il nome vecchio, perché una campagna nel JSONB non risalvata dal DM ce
  l'ha ancora. Default = token di tema, scelta esplicita = hex (che infatti non
  segue il tema: è voluto, ed è anche il vincolo di `safeColor`).
- [x] **Si può piazzare qualsiasi cosa in un livello vuoto** — fatto (18 lug 2026).
  La palette con tutte e dieci le voci c'era già; il problema era che `#empty-node`
  (`position:absolute; inset:0`) copriva la tela **intercettando i puntatori**, così
  su un livello vuoto non passava niente all'SVG: né drop dalla palette, né
  "arma e tocca", né doppio clic — cioè i tre gesti che il suo stesso testo
  suggerisce. Restava solo il bottone "+ Aggiungi bolla", che aggiunge una forma
  fissa: da fuori sembrava che un livello nuovo accettasse una bolla e basta.
  Fix: `pointer-events:none` sul pannello, `auto` sui figli cliccabili.
  Emerso durante la verifica, stessa area: il **doppio clic col mouse sullo sfondo
  non funzionava nemmeno sui livelli pieni**. Il listener `dblclick` era codice morto
  — il pointerup sullo sfondo chiama `renderCanvas()`, che riscrive `svg.innerHTML`
  e distrugge il nodo su cui era iniziato il pointerdown, quindi il browser non
  sintetizza il click e senza click non c'è dblclick. Ora il doppio clic se lo conta
  a mano anche il mouse (`lastBgTap`, finestra 500ms), come già faceva il tocco;
  listener morto e variabile `lastHit` (scritta e mai letta) rimossi.
  Verificato: 22/22 sulle due voci + 10/10 trascinando ogni pezzo della palette in
  un livello vuoto. Controprova della causa: rimettendo `pointer-events:auto`
  Playwright si rifiuta di completare il drop e indica come ostacolo proprio il
  paragrafo che spiega come trascinare.
- [x] **Blocco combattimento (voci 8, 9, 10)** — fatto (18 lug 2026), modulo nuovo
  `public/app/battaglia.js` più gli innesti in mappa/pannello/mostri/giocatori e
  la proiezione al tavolo in `share.ts`. Le tre voci sono state fatte insieme
  perché la 9 detta il modello da cui dipendono le altre due.

  Tre decisioni portanti (documentate in testa a `battaglia.js`):
  1. **Una battaglia vive su un livello**, non sull'app: `n.battle` esiste solo
     sul nodo dove si combatte, e la sua presenza È la modalità accesa. Si può
     tenere aperta una scaramuccia nella cripta navigando la città, e chiudere
     significa cancellare un campo, non ripulire stato globale.
  2. **Le pedine referenziano, non copiano**: una pedina PG porta `playerId`, una
     di mostro `{nodeId, foeId}`; nome e PF si leggono alla fonte a ogni disegno.
     Ferire il goblin dalla scheda o guardarlo sulla pianta è lo stesso numero —
     copiarli avrebbe prodotto due PF che divergono al primo colpo. Per questo
     espandere un encounter è reversibile: le pedine sono viste.
  3. **La griglia c'era già**: il pattern SVG è a 40px e `dungeon.js` documenta
     "1 quadrato = 40px" = 5 piedi = 1,5 m. La modalità non introduce una scala,
     rende rigido l'aggancio a quella esistente (`CELL`, `snapToCell`).

  - **Voce 9**: bottone ⚔ in barra strumenti, griglia a contrasto alzato, pedine
    agganciate al centro della cella (anche quelle già sparse, all'accensione) e
    niente allineamento magnetico in battaglia — tirerebbe fuori griglia proprio
    ciò che dev'esserci dentro. Tabellone d'iniziativa flottante sulla tela con
    round, turno corrente, avanti/indietro. `Tira iniziativa` tira d20+DES **per
    i mostri** (sono del DM) e conserva i numeri dei PG, che al tavolo tirano da
    sé; c'è un 🎲 per PG se il DM vuole tirare per loro. Pari merito risolto con
    la Destrezza (regola 5e) e poi col nome, sennò l'ordine ballerebbe a ogni
    ridisegno; il turno segue la creatura, non l'indice.
  - **Voce 10**: `Espandi in pedine` nella scheda mostro, con lo stato "3 di 4 in
    campo" e disabilitato quando non c'è altro da fare. Non duplica mai.
  - **Voce 8**: `⚔ In campo` su ogni scheda PG (e `Metti in campo i PG` in
    massa dal tabellone); rimetterlo in campo seleziona la pedina esistente
    invece di raddoppiarla. I PF cambiati nella scheda muovono la barra sulla
    pedina, e viceversa.
  - **Al tavolo**: l'ordine completo coi numeri, come da scelta. I riferimenti si
    risolvono **sul server** (`projectBattle` in `share.ts`) e ne escono solo i
    nomi: spedirli grezzi consegnerebbe id di nodi invisibili. Dei mostri esce
    `down` (già pubblico via `projectCombat`), mai un PF né il modificatore di
    Destrezza. Stessa ragione per cui il *titolo* di una pedina collegata lo
    risolve il server: senza, al tavolo le pedine sarebbero mute.
  - In battaglia il nome sotto la pedina sparisce: celle da 40px e nomi più
    larghi davano "Goblin 1Goblin 2Goblin 3Goblin 4" sovrapposti. Restano le
    iniziali nel disco (G1, G2…), il tabellone e l'aria-label.
  - Verificato: 31/31 in Chromium sullo scenario completo (2 PG + encounter di 4
    goblin) e 18/18 sulla proiezione al tavolo, metà dei quali sono controlli su
    ciò che NON deve uscire. Suite precedenti senza regressioni (6/6, 11/11,
    22/22, 11/11).


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
    parola `width:100%`, la transizione è su `transform`. (Quella classe non
    esiste più dal 29 lug 2026: è `.hp-bar i`, unificata con la barra dei PG.)

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

## La scala della campagna

Una campagna non è una città: è più città, in una regione, in un mondo. Verso il
basso l'albero è sempre stato infinito (una bolla contiene una mappa che contiene
una mappa) e più città si potevano già fare oggi, mettendone cinque nella radice —
a mancare erano il **vocabolario**, che si fermava a `quartiere`, e la
possibilità di salire **sopra** la radice, che si fissava alla creazione.

- [x] **Zoom indietro: regioni, nazioni, continenti, mondi** — fatto (25 lug 2026).
  Nuova scala `SCALA` in `modello.js` (`mondo › continente › nazione › regione ›
  quartiere › edificio › stanza`), letta nei due versi da `scalaSopra` e
  `scalaDentro`. Costa poco perché **la radice è un nodo come gli altri**:
  `zoomOut()` (`stato.js`) le mette un genitore e riassegna `state.root`, il
  documento resta `{schemaVersion, root, …}` con la stessa forma e nessun altro
  modulo si accorge di niente — nessuna migrazione, nessun campo nuovo.
  Il bottone «⤢ Zoom indietro» sta nel posto di «↩ Su» (stessa domanda: cosa
  contiene questo?) ma con un testo diverso, perché premere "su" per abitudine
  non deve creare un livello; sparisce quando la radice è già un mondo.
  Quattro decisioni che sono guardie, tutte in `CLAUDE.md`:
  - **Una lista sola**, non due: un test impone che `scalaDentro` sia l'inversa
    di `scalaSopra`, sennò al primo gradino aggiunto i due elenchi divergono.
  - **Non si chiede niente al DM** (né la scala del livello nuovo né quella del
    doppio clic): un menu di sette voci è una domanda a cui si può rispondere
    male, per una cosa che la forma del livello dice già. Si corregge dal campo
    **Scala** del pannello, visibile solo sulla radice.
  - **La vecchia radice eredita `shared`** se sotto aveva qualcosa di rivelato:
    al tavolo la radice è visibile per costruzione, e scendendo di un gradino
    smetteva di esserlo — i giocatori avrebbero trovato un mondo vuoto al posto
    di tutto. È la catena di `revealNode` applicata all'indietro.
  - Il titolo nuovo porta dentro quello vecchio e **toglie il prefisso
    precedente**: il titolo della radice è il nome della campagna nell'elenco, e
    senza lo strip tre zoom davano "Mondo di Continente di Nazione di X" (visto
    davvero nella prima verifica in Chromium).
  Corretto per la stessa ragione il doppio clic sulla tela: creava una `stanza` a
  **ogni** livello (`canEditEdges()` è `() => true` da sempre, quindi il ramo
  `quartiere` era morto), e dentro un mondo è una risposta assurda. Ora crea il
  gradino sotto il livello corrente (`formaImplicita` in `mappa.js`).
  Test: `test/scala/` (8 casi) — percorribilità della catena nei due versi,
  capolinea al mondo e alla stanza, forme fuori scala, e l'accordo fra `SHAPES`
  e la whitelist del contratto, interrogata validando un documento vero.
  Verifica in Chromium: cinque zoom fino al mondo, rinomina col fuoco già nel
  campo, discesa fino alla città di partenza intatta, Ctrl+Z che disfa, zero
  errori in console.

- [x] **Un disegno per gradino: mondo, continente, nazione, regione** — fatto
  (26 lug 2026). La palette in alto prometteva cinque profili (globo, costa,
  confine, tratteggio, pieno) e la tela ne disegnava **uno**: `shapeMarkup`
  mandava tutti e cinque i territori sullo stesso rettangolo arrotondato, dello
  stesso verde. Adesso la sagoma è un campo di `SHAPES` (`disegno`) e la disegna
  `silhouetteForma` in `mappa.js` — un campo e non un confronto sul nome dentro
  il renderer, che è l'errore già pagato con `shape==="quartiere"`.
  La regola: più il territorio è largo, meno il contorno è una linea che
  qualcuno ha tracciato. Mondo = ellisse più meridiano, continente = costa,
  nazione = rettangolo più un confine tratteggiato defilato (defilato perché al
  centro ci stanno titolo e anteprima dei figli), regione = tratteggiata,
  quartiere = il rettangolo di sempre — che è anche `defShape` di ogni zona,
  quindi nessuna campagna esistente cambia aspetto da sola.
  **Il colore resta uno solo** per tutti e cinque: era già una decisione
  motivata (cinque verdi = quattro token nuovi da far reggere in cinque temi), e
  la sagoma dice la stessa cosa gratis, anche in monocromia.
  Quattro cose imparate facendole:
  - **La stessa funzione disegna anche le pastiglie** del livello vuoto, che
    erano un quadratino CSS tondo/rombo/quadro — cioè una terza descrizione
    delle nove forme accanto a `SHAPES` e alla palette di `app.html`. Chiude la
    voce "cinque quadrati identici" che stava qui sotto fra i lavori residui.
  - **Tratteggi e raccordi vanno in proporzione al riquadro**: un `rx=18` giusto
    su una regione da 260px trasforma in una pillola un'icona da 20×14, e un
    tratteggio a sedici trattini lì sparisce (il confine ne fa otto apposta:
    a sedici la nazione era indistinguibile dal quartiere).
  - **La costa è una curva e i suoi vertici hanno dei golfi.** Provata prima
    come spezzata: a 380px si legge come un cristallo. Poi smussata con
    Catmull-Rom ma su vertici tutti convessi: usciva un uovo indistinguibile dal
    mondo, che nella scala gli sta **accanto** — il confronto che conta non è
    con il rettangolo, è con il gradino vicino.
  - La sagoma è **fissa**, non derivata dall'id: `renderCanvas` ridisegna in
    continuo (anche col polling del tavolo), quindi una costa casuale cambierebbe
    profilo a ogni battuta di tasto.
  Verifica in Chromium: le cinque bolle sulla tela, le due palette a confronto,
  tema Torbiera e Pergamena. `npx tsc --noEmit` e `npm test` (97) puliti.
  Allargata `.empty-pal` a 640px: con le sagome le pastiglie sono più larghe e
  il quinto territorio andava a capo da solo, mentre quei cinque sono una scala
  e una scala si legge in fila.

Cosa **resta** da fare, misurato:

- [x] **La barra della palette su telefono** — rimisurata e **fatta** il 31 lug
  2026, col dito emulato, e **la misura ha spostato il difetto**: non è la
  palette a essere lunga, sono i **comandi a condividere il suo scorrimento**.
  - I numeri, a 390×844: `#plan-toolbar` è largo 390px su **2368px** di
    contenuto, cioè se ne vede il **16%** — non "metà", come diceva questa voce
    — e le voci raggiungibili senza scorrere sono **2 su 16** (Mondo e
    Continente; la terza, Nazione, è tagliata a metà dal bordo). A 375px è
    identico; coricato a 852×393 si sale al 21%, 3 su 16. Su scrivania la barra
    va a capo e si vede tutta, quindi il difetto è solo del telefono.
  - **Quel che c'è oltre il 1890° pixel non è palette**: `＋`, `－`, Ordina,
    Adatta, il righello, le aree d'effetto e ⚔ Combattimento. Sono comandi
    della vista e della sessione, non forme da posare, e stanno **in fondo** a
    una striscia da sei schermate.
  - **Quattro di quei comandi non hanno un secondo ingresso su telefono.**
    `arrangeGrid` sta anche nel menu contestuale (`menu.js:131`) e lo zoom si
    fa a pinza, ma **Adatta, Righello, Aree d'effetto e Combattimento** vivono
    solo lì: le loro altre vie sono scorciatoie da tastiera (F, R, A), che su
    un telefono non esistono. Cioè oggi la modalità combattimento, su un
    telefono, si raggiunge solo scorrendo cinque schermate di palette.
  - **Le tre strade, col loro costo misurato** (a 390px):
    - *Togliere le parole dalle pastiglie*: 2368 → 1607px, dal 16% al 24%.
      **Da scartare**, e non per il guadagno scarso: cinque segnalini (Quest,
      Encounter, PNG, Nota, Token) hanno per icona un quadratino colorato, e
      senza la parola resterebbero distinti dal **solo colore** — esattamente
      la regola dei due canali che il tabellone d'iniziativa segue.
    - *Due righe scorrevoli*: ~1184px, 3,0 schermate. Dimezza e basta.
    - *Un gruppo per volta* (i quattro `pal-title` esistono già e su scrivania
      sono già come la barra si legge): il gruppo più largo è Territorio con
      **516px, 1,3 schermate**. È il solo che cambia ordine di grandezza.
  - **La strada più corta però non è nessuna delle tre**: separare i comandi
    dalla palette. Sono sei elementi, ci stanno tutti su una riga da 390px, e
    la palette può continuare a scorrere per conto suo — è la stessa ricetta di
    `.ini-actions`, dove "tira, metti in campo e chiudi sono comandi della
    battaglia, non del turno". Costa un contenitore in `app.html` attorno alla
    sola palette, quindi non è CSS puro e va guardata su scrivania, dove oggi
    tutto va a capo insieme in tre righe.
  - **Fatta la separazione** (`#pal-scroll` e `#plan-cmds` in `app.html`, le due
    media query in `app.css`). Su scrivania i due contenitori sono
    `display:contents`, cioè **non esistono**: pastiglie e bottoni restano figli
    diretti di `#plan-toolbar` e vanno a capo tutti insieme come prima. Su
    telefono diventano due strisce che scorrono per conto loro.
    - **Un difetto peggiore trovato disegnando la correzione**: `.pal-item`
      aveva `flex:none`, i **bottoni no**, quindi dentro un contenitore che non
      va a capo venivano schiacciati fino a `min-width:44px` e l'etichetta
      finiva **fuori** dal bordo — bersaglio da 44px, scritta da ~100, e
      toccare la parola "Combattimento" non faceva niente. È il rovescio della
      regola dei 44px: lì il bersaglio è troppo piccolo, qui è più piccolo di
      quel che si vede. Il conto dei 2368px era quindi già coi bottoni
      compressi: a decomprimerli la striscia si allungava ancora.
    - **＋ e － spariscono su telefono** (`.btn.zoom`), e sono gli unici due che
      si potevano togliere: lo zoom su un touch si fa a pizzico (`planDrag`
      mode `"pinch"`, `mappa.js:1054`) e con la rotella dove c'è un mouse.
      Duplicavano un gesto nativo prendendosi 104px dei 604 della striscia,
      cioè lo spazio che serviva a chi un gesto equivalente non ce l'ha.
    - **Al tavolo il contenitore della palette sparisce** (`html.ro
      #pal-scroll`): lì le pastiglie sono già nascoste una per una, e senza
      quella riga il contenitore vuoto si prendeva una riga da `flex:1 0 100%`.
      Misurato: barra 61px e tela 631px al tavolo, contro 111/577 in vista DM.
    - **Il bersaglio non è "tutti i comandi visibili"**: sette non stanno in
      390px senza rimpicciolirli, e rimpicciolirli è il difetto di partenza. È
      "tutti a **una** passata di dito", e i numeri sono questi:

      | | prima | dopo |
      |---|---|---|
      | dov'è ⚔ Combattimento | pixel **2266** di 2368 | pixel **370** di 500 |
      | larghezza da scorrere per i comandi | 6,1 schermate | **1,4** (1,0 coricato) |
      | comandi visibili senza scorrere | 0 su 7 | **4 su 5** (3 a 375px) |
      | etichette fuori dal loro bersaglio | 3 | **0** |
      | barra / tela a 390×844 | 74 / 614px | 111 / 577px |

    - **Costa 37px di tela**, ed è la stessa scelta della fascia d'iniziativa:
      l'altezza è l'unica delle due dimensioni limitabile senza troncare niente.
      Vale anche nel blocco `max-height:480px`, che dichiara «taglia spazio, mai
      comandi» — un comando irraggiungibile è tagliato, non risparmiato.
    - **Verifica** (scratchpad, buttata): 18 controlli su quattro schermi, con
      la **scrivania come gruppo di controllo** — barra 183px e tela 619px
      identiche prima e dopo, verificato con `git stash` e ricontrollato dopo il
      `pop`. Più `npx tsc --noEmit`, `npm test` (99) e l'autoverifica della
      fixture (13/13).
  - [x] **Resta la palette** — **fatta il 6 ago 2026**, e come sempre la
    rimisura ha spostato il bersaglio. I numeri di questa voce (2368px, 16%)
    erano quelli di **prima** che i comandi uscissero dallo scorrimento:
    rifatti a 390×844 col dito, la striscia è **1872px su 370 visibili (20%)**,
    5,1 schermate, 2 voci su 16.
    - **Il difetto non era la lunghezza, era l'ordine.** La barra va da
      Territorio a Segnalini, cioè dalla scala più larga alla più stretta —
      giusto per leggerla, e il rovescio esatto di quanto si usano le cose. Un
      mondo si fonda una volta; le pedine si posano tutta la sera. Misurato:
      Territorio è a **0**, Luoghi a 655, Pianta a 1100 e **Segnalini a 1348px,
      3,6 schermate** — il gruppo che serve nella stanza dove si gioca era il
      più lontano di tutti. Nessuna delle tre strade misurate guardava lì.
    - **La correzione non toglie e non nasconde niente**: al cambio di livello
      la palette **scorre da sé** sul gruppo che lì dentro serve
      (`allineaPalette` in `mappa.js`, chiamata in fondo a `renderMap`). Niente
      comando in più — l'app sapeva già cosa nasce dove (`formaImplicita`,
      `scalaDentro`) — e sbagliare bersaglio costa una passata di dito, non un
      errore: è la ragione per cui questa strada batte "un gruppo per volta",
      dove una mappatura sbagliata **nasconde** quel che serve.
    - **A quale gruppo appartiene una forma non è scritto nel JS**: si chiede
      alla palette, che lo dichiara già col `.pal-title` che precede le sue
      pastiglie. Un secondo elenco si sarebbe disallineato in silenzio, e il
      difetto — la barra che scorre nel posto sbagliato — non fa fallire niente.
      È la stessa ragione per cui `emptyNodeMarkup` si genera da `SHAPES`.
    - **L'unica risposta che la scala non sa dare è la stanza**, e lì sta
      l'eccezione dichiarata: `scalaDentro("stanza")` torna ancora "stanza", ma
      dentro una stanza non nasce un'altra stanza — si disegna il pavimento
      (Pianta), e **a scontro acceso** si posano le pedine (Segnalini). Il
      secondo caso è il più importante di tutti: durante un combattimento la
      palette non si scorre. Lo dice `n.battle`, che è già il modo in cui questo
      repo dice "qui si sta giocando", quindi non è uno stato nuovo.
    - Guardia: la barra si allinea **solo al cambio di livello** (chiave
      `id + battle`), sennò `renderMap` — che gira a ogni selezione — la
      farebbe scorrere sotto il dito di chi la sta scorrendo a mano.

      | | prima | dopo |
      |---|---|---|
      | per posare una pedina in una stanza | 1348px, **3,6 schermate** | **0** |
      | per posare un muro in una stanza | 1100px, 3,0 schermate | **0** |
      | per posare un edificio in un quartiere | 655px, 1,8 schermate | **0** |
      | voci del gruppo giusto senza scorrere | 0 | **2–3** |

    - **Quel che NON cambia, e va detto**: la striscia è ancora lunga 1872px e
      se ne vede sempre il 20%. Cambia **quale** 20% ti trovi davanti. Se un
      giorno servisse anche accorciarla, le due strade misurate restano valide —
      due righe scorrevoli (~1184px) o un gruppo per volta (516px) — e queste
      due sono scartate con la ragione scritta, per non riproporle: **icone
      senza parole** rompe cinque segnalini che hanno per icona un quadratino
      colorato, e **riordinare con `order` in CSS** sfasa l'ordine visivo da
      quello del DOM, cioè da quello di lettura e di Tab.
    - **Verifica** (scratchpad, buttata): 15 controlli su quattro contesti, con
      la **scrivania come gruppo di controllo** (`display:contents`, barra 183px
      e tela 619px identiche, niente scorre) e il **tavolo** (console pulita,
      palette nascosta). **Controprova**: un ridisegno sullo stesso livello non
      disfa uno scorrimento fatto a mano, e due livelli dello stesso gruppo non
      muovono la barra — sennò un verde direbbe solo «qualcosa scorre».
- **Le icone della palette in `app.html` restano scritte a mano** e vanno
  allineate a occhio a `silhouetteForma`: sono markup statico, non generato.
  Oggi combaciano (la costa è il `path` generato dalla funzione stessa per un
  riquadro 18×14, incollato lì), ma è l'unico posto dove la sagoma può tornare a
  divergere. Se un giorno desse fastidio, la strada è generare quella barra da
  `SHAPES` all'avvio, come già fa `emptyNodeMarkup`.
- **Niente vieta un mondo dentro una stanza**: il menu "Forma sulla pianta" di
  una bolla figlia elenca tutte e nove le forme. Non fa danno (un mondo è una
  bolla come un'altra) e un vincolo gerarchico vero sarebbe una gabbia in un
  editor che vive di alberi liberi — ma se un giorno desse fastidio, il posto è
  `shapeOpts` in `pannello.js`.
- [x] **Il contenuto di una bolla esce dalla sua sagoma** (29 lug 2026, trovato
  sul campo su una bolla continente e chiuso lo stesso giorno). `miniPreview` (`mappa.js` ~489) impaginava
  l'anteprima dei figli nel **riquadro** (`box.w-22` × `box.h-42`, inserti 11 e
  31), ma dal 26 lug la sagoma disegnata è **inscritta** in quel riquadro:
  ellisse, costa, rombo. Tutto ciò che sta negli angoli finisce fuori dal
  contorno, e la bolla si legge come se il suo contenuto le stesse traboccando.
  - **Misurato** chiedendo al browser `isPointInFill` sulla sagoma vera (non su
    una mia approssimazione), quattro figli per bolla, sedici angoli ciascuna:
    **torre/rombo 8 angoli su 16 fuori**, continente/costa 5, mondo/globo 4,
    piazza/cerchio 4. Il rombo è il caso limite — i quattro rettangoli stanno
    quasi tutti fuori dalla figura.
  - **La direzione decisa** (Federico, 29 lug): le bolle interne si devono
    vedere **molto più piccole**, cioè l'anteprima va impaginata nel rettangolo
    **inscritto** nella sagoma e non nel riquadro. I fattori sono geometria e
    non gusto: ellisse 1/√2 ≈ 0,707 per lato (area al 50%), rombo 0,5 (area al
    25%), rettangolo 1 (quartiere, nazione, regione: non cambia niente). Per la
    **costa** vanno ricavati dai vertici di `COSTA` — è l'unica sagoma con dei
    golfi, quindi il rettangolo inscritto non è simmetrico e va calcolato, non
    stimato a occhio.
  - **Il fattore sta in `SHAPES`, non in un confronto sul nome dentro il
    renderer**: è la regola già scritta accanto a `disegno` ("il renderer
    dispaccia su `disegno` e non sa i nomi"), e questa è la seconda volta che
    la stessa conoscenza serve a due posti diversi. Un campo accanto a
    `disegno` (per esempio `dentro:[fw,fh]`) lo tiene in uno.
  - **Non è solo l'anteprima**: nello stesso `<g>` stanno il **titolo** (y=18,
    sopra il bordo superiore della curva e del rombo — nello scatto "Torre di
    Prova" galleggia fuori dalla figura), il conteggio `◦ N` (y=`box.h-8`) e le
    due maniglie (`link-handle` a `(box.w,0)`, `rs-handle` a
    `(box.w-8,box.h-8)`), tutti posati sul riquadro. Titolo e conteggio vanno
    corretti insieme, sennò si corregge la metà che si è notata per prima. Le
    maniglie sono un caso a parte e forse vanno lasciate dove sono: sono
    comandi, e un comando sul contorno vero di un rombo è più difficile da
    prendere che uno all'angolo del riquadro. Da decidere, dicendolo.
  - **Effetto collaterale da tenere**: `miniPreview` esce vuota sotto
    26×20px di spazio disponibile, quindi rimpicciolendo l'area più bolle
    ricadranno sul solo `◦ N` — che va bene (una mappa annidata a quella taglia
    è illeggibile comunque), ma allora quel conteggio deve stare **dentro** la
    sagoma, che oggi non è garantito.
  - La riproduzione è già scritta e si rifà in un minuto: un livello con
    continente, mondo, torre e piazza, quattro figli `quartiere` ciascuna agli
    angoli, e il conteggio degli angoli fuori sagoma con `isPointInFill`.

  **Com'è andata.** `dentro:[larghezza,altezza]` in `SHAPES` accanto a `disegno`
  e `contentBox` in `modello.js` (il riquadro inscritto, centrato, in frazioni
  del riquadro della bolla); `mappa.js` ci impagina titolo, anteprima, conteggio
  e pallino di stato, e `test/scala/` impone che ogni sagoma si dichiari
  inscritta o piena — una sagoma nuova non ricade in nessuno dei due elenchi e
  il test fallisce, che è il verso giusto, perché il difetto vero non fa fallire
  niente. Verificato in Chromium con **33 controlli**: le quattro sagome
  inscritte a zero angoli fuori, un gruppo di controllo di cinque sagome piene
  (quartiere, nazione, regione, edificio, più una stanza rimpicciolita) ferme al
  pixel di prima, e la controprova — fattori rimessi a `[1,1]`, tornano fuori 23
  angoli. Tre cose che la misura ha spostato rispetto alla voce qui sopra:
  - **La costa non ha avuto bisogno di un centro suo**, contro quel che questa
    voce dava per scontato. Il rettangolo di area massima, calcolato sulla
    **curva** vera (i vertici da soli sono l'approssimazione sbagliata: fra un
    punto e l'altro la Catmull-Rom esce e rientra), viene centrato in **(0,494,
    0,515)**, e obbligarlo al centro esatto costa il 5% di area — 0,346 contro
    0,363. I golfi rendono asimmetrico il contorno, non il suo interno: il campo
    resta **due numeri** e non quattro. I fattori sono `[0,66, 0,52]`, e sono un
    massimo e non un margine di prudenza — a `0,68` o a `0,54` il rettangolo è
    già fuori dalla curva.
  - **Titolo e conteggio si accavallavano**, e non per colpa delle sagome:
    senza anteprima il titolo sta al centro e il conteggio in fondo, che su un
    riquadro basso sono lo stesso posto. Il caso c'era già per ogni bolla
    ridimensionata sotto i 48px, ma non lo raggiungeva nessuna forma di
    default; stringendo il riquadro lo raggiunge una torre delle dimensioni sue.
    Adesso, senza anteprima, i due sono **una coppia impilata** al centro.
  - **Le maniglie restano agli angoli del riquadro**, che era la decisione da
    prendere dicendolo: sono comandi, e portarle sul contorno vero di un rombo
    le rimpicciolisce proprio dove il rombo è più stretto. Che il riquadro non
    sia il loro bersaglio lo dice già il fatto che sporgono (`link-handle` sta a
    `cx=box.w`, cioè mezza fuori). Il **pallino di stato** invece è informazione
    e si è mosso col resto: resta a cavallo dell'angolo com'era — su un
    rettangolo ne sporge di 1,5px — e il verificatore lo misura contro quella
    linea di partenza, non contro zero.

  **Resta aperto, e non è delle sagome**: un titolo lungo sborda in orizzontale
  da una bolla piccola (una torre da 80px non tiene "Torre di Prova"), identico
  su una stanza rettangolare. Ha a che fare col troncamento del testo, non con
  la geometria della forma, e va affrontato come tale — misurato: dopo la
  correzione la torre ha ancora 2 angoli su 4 del titolo fuori, ed è tutto lì.

## Temi

Cinque temi si giudicano a occhio. Dodici no — e il modo in cui un tema si
rompe è silenzioso: un accento che su Torbiera brilla, su un fondo chiaro sta
a 3:1, e nessuno se ne accorge finché non apre proprio quel tema con proprio
quella schermata.

- [x] **Sette palette nuove** — fatto (26 lug 2026). Da un elenco di palette
  proposte dall'esterno: Notturno (nero/ciano), Gilda (navy/arancione),
  Alba (bianco/teal), Segnale (carboncino/giallo), Inchiostro (carta/cremisi),
  Sottosuolo (obsidiana/viola), Taverna (noce/oro). Si passa da 5 a 12, da 1
  tema chiaro a 3.
  Tre delle sette **duplicano** per struttura Pergamena, Cripta e Brace, ed è
  stato detto prima di farle: la richiesta è stata confermata, quindi ci sono.
  Quello che cambia davvero è il numero di temi chiari e il fatto che ora
  esistano accenti che prima nessun tema aveva (il viola primario, il giallo
  ad alta visibilità).
  - **Una palette da tre colori non veste trenta token**: fondo, testo e
    accento arrivano dalla proposta, il resto è derivato, e ogni tema dichiara
    in `themes.css` da dove viene e che cosa ha dovuto cambiare.
  - **Prima di correggere un valore, misurarlo**: l'oro di Taverna e
    l'arancione di Gilda erano stati schiariti per prudenza e passavano già
    (5,2:1 e 5,5:1); il teal di Alba (3,74:1) e il viola di Sottosuolo
    (4,28:1) andavano corretti davvero. Il valore giusto è quello che passa.
  - **L'elenco dei temi è diventato uno solo** (`public/app/temi.js`): erano
    tre (le `<option>` in `app.html`, l'array in `main.js`, la mappa in
    `menu.js`). Il `<select>` e il menu "⋯" si generano da lì, raggruppati per
    fondo. È l'unico modo in cui aggiungere il tredicesimo tema non richiede
    di ricordarsi tre posti.
  - **`npm run temi:contrasto`** (`scripts/verifica-contrasto.mjs`) misura
    tutti i temi insieme: 19 coppie che l'interfaccia usa davvero, più la
    distanza ΔE fra le cinque famiglie di accento. Due cose imparate
    scrivendolo: i commenti del CSS nominano dei token e il lettore ci
    cascava (`--on-ember` spariva, cioè taceva proprio sulla coppia da
    guardare); e il rapporto WCAG **non** serve a dire se due accenti si
    somigliano — misura la luminanza, e dava 110 avvisi su temi riusciti.
  Verifica in Chromium: i sette temi aperti sull'app vera, topbar, palette,
  pannello e tela. `npx tsc --noEmit` e i 97 test puliti.

- [x] **I bordi dei componenti passano 3:1** — fatto (26 lug 2026), difetto
  **preesistente** e non introdotto dalle palette. `--edge` bordava sia i
  separatori decorativi sia i componenti veri (`input,textarea,select` e `.btn`
  in `app.css`, `.btn` e `.input` in `globals.css`): a 1,3:1 su Brace, e sotto
  soglia in undici temi su dodici. WCAG 1.4.11 chiede 3:1 al contorno di un
  componente, non a una riga divisoria, quindi la correzione è **separare i due
  ruoli** invece di alzare tutto: alzare `--edge` avrebbe toccato 51 usi, quasi
  tutti separatori, trasformando in griglia dei temi curati.
  - Token nuovo `--edge-ui` (alias `--line-ui` nell'app), calcolato tema per
    tema come il **minimo** che regge 3:1 su entrambe le superfici su cui
    compare — il pannello per i bottoni, il fondo incassato per i campi. È un
    bordo, non un tratto di penna.
  - Due temi passavano già e sono rimasti come sono: Alto contrasto, e Gilda —
    il cui `--edge` è lo slate della palette proposta, che la destinava proprio
    a testo e bordi. Vanno comunque **dichiarati**: senza, ereditano
    `--edge-ui` da `:root`, cioè quello di Torbiera, e Gilda scendeva a 2,78:1.
    È la trappola da ricordare per ogni token nuovo aggiunto a `:root`.
  - Corretto insieme l'unico difetto di **testo** che restava: su Pergamena
    `--wisp-lit` era più chiaro di `--wisp`, unico fra i temi chiari, e il
    titolo di un capitolo SRD in hover stava a 3,01:1. Sui fondi chiari lo
    stato "acceso" scurisce, come già fa `--moss-hov`.
  `npm run temi:contrasto` ora esce **0 coppie sotto soglia** su dodici temi.
  Verifica in Chromium su Torbiera, Pergamena, Gilda e Alba: i bordi di campi e
  bottoni si leggono, i separatori restano discreti.

Cosa **resta** da fare, misurato:

- **Il sito non ha un selettore di tema**: la chiave `runebog-theme` è
  condivisa e `layout.tsx` applica quello salvato, ma per cambiarlo bisogna
  passare dall'app. Con dodici temi (e tre chiari) inizia a pesare.

## Il lavoro del DM non si perde (i tre P1 della critique)

- [x] **I tre P1 aperti dalla critique del 17 lug** — fatto (28 lug 2026). Erano
  fermi da tre giri (29/40 in tutte e tre le critique), e due dei tre sono lo
  stesso guasto visto da due lati: **il lavoro dell'utente non ha rete**.

- [x] **L'import non sostituisce più la campagna aperta** (`esporta.js`,
  `importAsNewCampaign` in `stato.js`). Due clic e un file sbagliato erano una
  campagna persa, con l'undo azzerato dall'import stesso.
  La correzione **non è un dialogo di conferma**, o almeno non in locale: uno
  slot di campagna non costa niente, quindi la campagna importata è una **in
  più** e la domanda non si fa proprio — si risponde di no per costruzione.
  Chi voleva davvero rimpiazzare ha il selettore e l'Elimina, che la conferma
  ce l'ha già.
  - **La conferma resta dov'è inevitabile**: in cloud (`/play/[id]`) l'indirizzo
    È la campagna e slot non ce ne sono, quindi lì l'import sovrascrive e il
    dialogo conta le bolle da una parte e dall'altra, con lo stesso rimando
    all'Esporta di "Elimina campagna" — stesso danno, stessa rassicurazione.
  - **La validazione viene prima della domanda**: un file illeggibile non mette
    a rischio niente, e chiedere "sostituisco?" per poi fallire sarebbe uno
    spavento per nulla. Chi legge il dialogo sa già che il file è buono.
  - Il cambio di campagna è silenzioso di suo (cambia una `<option>` in
    topbar), quindi `#savestate` lo dice: "Importata come campagna nuova ✓",
    che essendo `role=status` arriva anche a un lettore di schermo.

- [x] **Redo** (`redo`/`doRedo` in `stato.js`, Ctrl+Maiusc+Z e Ctrl+Y). Un
  Ctrl+Z di troppo distruggeva lavoro senza rimedio: il contratto dell'annulla
  era rotto a metà.
  - È lo **stesso meccanismo con gli stack scambiati** — lo stato è un JSON
    unico, quindi uno snapshot è una `stringify` e tornarci è una `parse` — e
    l'unica regola che deve reggere è la **storia lineare**: `noteChange` svuota
    `redoStack`, sennò dopo una modifica nuova il rifai riporterebbe a un futuro
    che non discende più dal presente, cioè una perdita silenziosa, che è
    esattamente il guasto per cui l'undo esiste.
  - `applySnapshot` è il pezzo che i due condividono (percorso, selezioni e muri
    da ripulire): stava tutto dentro `undo()`, e copiarlo avrebbe voluto dire
    due elenchi da tenere allineati, di cui quello del redo — la via meno
    battuta — sarebbe invecchiato per primo.
  - `redo()` rimette lo stato corrente sull'**undoStack** e non si affida a
    `lastSnap`: `applySnapshot` chiama `doSave()`, che `lastSnap` lo riscrive, e
    senza quella riga il Ctrl+Z successivo non avrebbe più dove tornare.
  - Due scorciatoie e non una: Ctrl+Maiusc+Z è la convenzione di macOS e degli
    editor grafici, Ctrl+Y quella di Windows, e chi arriva da una delle due
    prova la sua e basta. Il bottone ↷ in topbar segue la regola di ↶ (solo
    touch, ≥761px) e compare **solo dopo un annulla**: `redoStack` si riempie
    soltanto dentro `undo()`, quindi lì "non vuoto" è la risposta esatta e non
    il proxy che ↶ deve accontentarsi di essere.

- [x] **Il pannello di un encounter comincia dal combattimento**
  (`statblockHTML` in `mostri.js`, punto di innesto in `pannello.js`). Il
  tracker PF era in fondo alla scheda, sotto ~700px di form, e sullo sheet
  mobile da 62dvh voleva dire scorrere l'intera anagrafica del mostro a ogni
  colpo andato a segno.
  - L'ordine ora è quello del **tavolo** e non quello della scheda stampata: PF,
    azioni, dadi — le tre cose che si toccano giocando — e sotto, ripiegata in
    una sola sezione, l'anagrafica. Il blocco è montato **subito sotto il
    titolo**: un encounter lo si apre per i PF, non per la larghezza in pixel.
    Misurato in Chromium: il tracker passa da ~700px a **194px** dall'inizio del
    pannello su desktop, e su un 390×844 sta dentro lo sheet **senza scorrere**.
  - Una sezione sola, non due annidate: "Resto della scheda" dentro "Scheda
    mostro" sarebbe stato un livello di richiusura per distinguere
    caratteristiche da tiri salvezza, che in sessione non si guardano né le une
    né gli altri.
  - **Riempire una sezione chiusa è indistinguibile dal non far niente**: chi
    sceglie un goblin dalla SRD si vedeva comparire una barra dei PF e sparire
    le statistiche che stava scegliendo, perché `applySRD` crea il primo nemico
    e la regola di apertura è "aperta se non ci sono nemici". Da lì `secShow` in
    `pannello.js`, che apre una sezione da fuori: il `force` di `secOpen`
    risponde a una condizione dello stato e non sa distinguere "il mostro c'era
    già" da "il mostro è arrivato ora".
  - L'attribuzione CC-BY resta **fuori** dalla sezione richiudibile: è una
    condizione della licenza, e una licenza dietro un `<summary>` chiuso non è
    resa.
  - Rifinitura vista solo a schermo acceso: il campo **Azioni** teneva tre righe
    e tagliava il resto dietro la maniglia di ridimensionamento. Ora cresce col
    testo (`field-sizing:content`, `min-height` più alto dove non c'è) con un
    tetto, perché sotto ci stanno i dadi.

  Verifica in Chromium, 24 controlli automatici più le schermate: annulla/rifai
  da tastiera e dal bottone su tablet (44×44), storia lineare, import che lascia
  intatta la campagna di prima, pannello encounter a 1440×900 e a 390×844.
  `npx tsc --noEmit` e i 97 test puliti, zero errori in console.

## I tre P1 dell'audit (accessibilità da tastiera e movimento)

- [x] **I tre P1 aperti dall'audit del 28 lug** — fatto (28 lug 2026). Filo
  comune: l'app dell'editor e il sito **dicono cose diverse sulle stesse
  regole**. I token colore hanno una sorgente unica (`themes.css`), le regole
  d'uso no, e le due metà si stavano allontanando in silenzio.

- [x] **L'anello di focus è l'accento pieno** (`app.css`: la regola su
  `input/textarea/select/button:focus-visible`, `.pal-item:focus-visible`,
  lo sfondo di `#detail-grip`). Era `--fen-dim`, cioè `--moss-deep`: la
  variante scura, nata per riempimenti e barre, che come **contorno** scendeva
  sotto i 3:1 di WCAG 1.4.11 in **cinque temi su dodici** — 1,94:1 su
  Sottosuolo, 2,48 su Segnale, 2,54 su Gilda, 2,57 su Notturno, 2,90 su
  Taverna. Il sito usava già `--moss` (`globals.css`): erano due ricette per la
  stessa cosa, e quella sbagliata stava nella metà che si usa da tastiera per
  ore. `#detail-grip` era il caso peggiore: ha `outline:none`, quindi la
  striscia che si accende **è** l'indicatore e non ha un secondo segnale.
  - `verifica-contrasto.mjs` non se n'era accorto perché le sue `COPPIE` sono
    un elenco scritto a mano, e nessuna riga guardava il focus. Non ne servivano
    di nuove — `--moss` su fondo e su pannello ci sono già, a soglia 4,5, più
    severa dei 3 che il focus chiede: serviva che quelle righe **dicessero**
    che ora ci pende anche l'anello. È il commento a essere stato aggiornato.

- [x] **Il lightbox è un `<dialog>`** (`app.html`, `openLightbox` in
  `pannello.js`, `.img-zoom` in `app.css`). Prima era un `<div>` con una classe:
  si apriva cliccando un tag immagine con un `onclick` addosso — che non prende
  il focus — e una volta aperto **non si chiudeva più da tastiera**. Nessuno dei
  due gesti aveva un equivalente. Ora l'immagine sta dentro un `<button>` e
  `showModal()` porta Escape, la trappola del focus e il ritorno del focus a chi
  ha aperto. Il clic ovunque chiude come prima.
  - Caduto per conseguenza il tag immagine con la sorgente vuota che il ramo DM
    emetteva quando il nodo non ha immagine (certi browser lo risolvono
    sull'URL della pagina e lo richiedono una seconda volta): ora il markup
    emette il tag solo quando l'immagine c'è, e il vecchio `display:none`/`.show`
    non serve più.

- [x] **`app.css` rispetta `prefers-reduced-motion`**. La regola gemella del
  sito non arrivava fin lì — `app.html` carica `themes.css` e `app.css`, e
  basta — quindi chi aveva chiesto meno movimento se lo vedeva rispettato sul
  sito e ignorato nell'editor, che è la metà dove si passa la serata.
  L'animazione vistosa è una sola: il pannello dettagli che sale dal fondo su
  mobile. L'alternativa è il **salto istantaneo**, non l'assenza.

- [x] **Trovato verificando, e più largo dei tre**: le scorciatoie della mappa
  rubavano **Invio, Spazio e Canc** a qualunque comando avesse il focus
  (`scorciatoie.js`). Il filtro copriva `input/textarea/select` e si fermava lì,
  quindi su un bottone del pannello Invio entrava nella bolla selezionata e Canc
  la cancellava: un comando raggiunto con Tab si poteva mettere a fuoco e **non
  premere**. Senza questo, il bottone nuovo del lightbox sarebbe stato
  raggiungibile e inerte, cioè il P1 sarebbe stato chiuso solo a metà.
  - Che la toppa andasse messa alla sorgente lo diceva già il codice: la palette
    si era difesa da sola con uno `stopPropagation()` (`mappa.js`, "arma e
    tocca"). Una toppa per elemento vuol dire che ogni elemento nuovo nasce
    rotto finché qualcuno non se ne ricorda.
  - La **tela è esclusa** apposta: bolle e muri hanno `tabindex` e
    `role=button`, ma lì Invio e Spazio li vuole proprio quell'elenco. Frecce,
    zoom, F ed Esc restano globali — non sono tasti che un comando consuma.
  - Seconda guardia, stessa indagine: **con un dialogo aperto la pagina sotto è
    inerte**. L'Escape che chiudeva il dialogo proseguiva fino alle scorciatoie
    e deselezionava anche la bolla, così il pannello si ridisegnava e il ritorno
    del focus garantito da `showModal()` veniva disfatto un istante dopo. Vale
    per tutti e sei i dialoghi: Canc dentro il dialogo del tavolo cancellava la
    selezione dietro.

  Verifica in Chromium, 16 controlli automatici: apertura con Tab+Invio,
  chiusura con Escape, ritorno del focus, il clic che chiude ancora, l'anello di
  focus misurato in tre temi, la durata della transizione con e senza
  `reducedMotion`, più le tre regressioni della tela (Invio entra nel livello,
  Spazio ribalta la selezione multipla, Canc dal pannello non cancella più).
  `npx tsc --noEmit`, i 97 test e `npm run temi:contrasto` puliti.

### Cosa resta dell'audit (P2 e P3, con la misura già fatta)

- [x] **`--edge` faceva da bordo di componente in ~15 punti** — fatto
  (28 lug 2026). Stava sotto 3:1 in **10 temi su 12** (peggiore Brace 1,32:1;
  passavano solo Gilda e Alto contrasto, che lo dichiarano alto per altre
  ragioni). Era la correzione del 26 lug lasciata a metà: fatta su campi e
  bottoni, non sul resto. Diciassette punti passati a `--line-ui` — i quattordici
  dell'audit più tre che l'elenco non aveva: `.pcard` (il gemello di `.foe-card`:
  lasciarlo indietro rifaceva l'incoerenza che il token serve a chiudere), le due
  sottolineature di `.pcard input` (campi, cioè la categoria già in ambito il
  26 lug) e `#qs-kbd` (il gemello di `kbd`). Restano su `--line` i separatori
  veri: bordo della topbar, `.detail-actions`, `.share-field`, `#ctx-menu hr`,
  `#plan-hint`.
  - **La regola che decide è il ruolo, ed è scritta accanto agli alias** in
    `app.css`: `--line-ui` a ciò che si opera o **galleggia** senza altro che lo
    stacchi da sotto; `--line` a ciò che separa due zone della stessa superficie.
    I `<dialog>` restano decorativi ed è l'eccezione che dice la regola: il
    `::backdrop` scurisce tutto il resto, quindi a staccarli è il riempimento.
  - **Le coppie nuove sono due, e sono i due estremi dello stesso gradiente.**
    I livelli che galleggiano hanno introdotto una superficie che nessuna riga di
    `COPPIE` aveva mai misurato — la **tela** — e lì il caso peggiore per un
    mezzotono non è `--peat` ma `--glow`: Torbiera, Cripta e Brace passavano su
    peat (3,34–3,45) e cadevano sul glow (2,85–2,96), cioè **proprio dove
    `#battle-bar` si apre** (12px dall'angolo in alto a sinistra). Ritoccati i
    tre `--edge-ui` (`#636961`→`#686e66`, `#616973`→`#646c75`,
    `#746357`→`#766559`): ora 3,05–3,09 sul glow. Notturno (3,01) e Sottosuolo
    (3,03) sono rimasti come stavano — passano, e il valore giusto è quello che
    passa, non quello che rassicura.
  - **`--edge-ui`/`--surface-hi` NON è stata aggiunta**, ed è una decisione, non
    una dimenticanza: sta a 2,56–2,87 in otto temi, ma un bordo ha due adiacenze
    e ne basta una: `#srd-results` è basso contro il proprio riempimento e regge
    sul pannello che ha sotto (3,06–3,88). Dichiararla avrebbe voluto dire
    inventare una severità, e `COPPIE` vuole coppie trovate nel CSS.
  - Verifica in Chromium, **204 controlli** su tutti e dodici i temi: per ogni
    selettore toccato il colore **calcolato** dal browser dev'essere `--edge-ui`,
    e per i tre separatori di controllo `--edge` — è quel gruppo di controllo a
    provare che sono stati spostati i selettori e non il token. Più la sonda su
    `.campaign` nel sito e tre scatti (Torbiera, Brace, Pergamena) col menu
    contestuale e il tabellone aperti sulla tela. `npx tsc --noEmit`, 97 test e
    `npm run temi:contrasto` (12/12) puliti.
  - Due controlli **non toccati** perché il difetto non è il bordo ma quanto sia
    forte un comando a riposo, che è una scelta di disegno: `#detail-grip`
    (fondo `--line`, 1,37:1 — la maniglia del pannello è invisibile finché non
    ci passi sopra, e il commento accanto pretende 3:1 solo dall'**acceso**) e
    `.q-star` spenta (`color:var(--line)`). Anche `.tab[aria-selected]` del sito
    è rimasto su `--edge`: lì il bordo non è l'unico segnale (cambiano anche
    fondo e colore), e alzarlo avrebbe solo fatto più rumore.
- [x] **PG e mostro si distinguevano solo dal colore** nel tabellone
  d'iniziativa — fatto (29 lug 2026). La striscia da 3px di `.ini-row.pg`/`.foe`
  era l'unico segnale, e su Brace accento e distruttivo sono la coppia di
  famiglie più vicina dei dodici temi (ΔE 17,4, dichiarato in `themes.css`):
  due righe indistinguibili. Applicata la ricetta che stava già due righe più
  in là — `.ini-row.on` dice il turno con fondo, grassetto **e** `▸` — con un
  glifo `.ini-tipo` (◆ i PG, ▲ i nemici) accanto alla striscia.
  - **Due silhouette, non due riempimenti**: ◆ e ◇ sarebbero stati di nuovo un
    canale solo, il peso. Il glifo prende **lo stesso token** della striscia
    (`--fen`/`--ember`): è lo stesso segnale detto due volte, non un secondo
    codice da imparare. Essendo testo la soglia è 4,5:1, e la reggono le coppie
    accento/pannello e distruttivo/pannello che `verifica-contrasto.mjs` misura
    già — nessuna riga nuova in `COPPIE`.
  - **Il caso che conta è il tavolo**: lì il 🎲 che marcava i PG nella vista DM
    non c'è, quindi la striscia era davvero sola. Regge senza toccare il server,
    perché `projectBattle` (`share.ts`) manda già `kind`.
  - Il glifo è `aria-hidden` e la parola sta in un `.sr-only` che apre la riga:
    "rombo nero" non è l'informazione, e il lato va sentito prima del nome.
    Prima nel tabellone non c'era alcun modo di sentirlo.
  - **Costa 15px al nome** (vista DM 98 → 83px; al tavolo restano 122px, che è
    dove i nomi contano). Un nome da tavolo ne chiede ~126, quindi il nome porta
    ora un `title`. Il tetto vero è `#battle-bar` a 216px fissi, voce a sé qui
    sotto: allargare la barra è quel lavoro, non questo.
  - Correzione venuta di conseguenza: una voce **senza fonte** (nemico
    cancellato) prendeva `foe` per esclusione e si disegnava rossa — annunciava
    un nemico dove c'è un buco. Ora non dichiara nessun lato e tiene un
    `.ini-tipo` vuoto, sennò la riga rientra e la fila dei glifi si sfalsa. Al
    tavolo il caso non esiste: `projectBattle` filtra quelle voci.
  - Verifica in Chromium: **180 controlli** su tutti e dodici i temi (glifo,
    `.sr-only`, glifo e striscia dello stesso colore, contrasto ≥ 4,5:1, la
    riga senza fonte) più **9 al tavolo** con la proiezione vera di `share.ts`
    (nessun bottone nelle righe, 4 voci su 5, i due glifi distinti) a 390px.
    Quattro scatti (Torbiera, Brace, Pergamena, Alto contrasto), console pulita,
    `npx tsc --noEmit`, 97 test e `npm run temi:contrasto` (12/12) puliti.
- [x] **Il polling del tavolo ogni 5 s costava tre volte** — fatto (29 lug 2026).
  La voce diceva "due `JSON.stringify` sul telefono dei giocatori, confronta
  `updatedAt` e ricadi sullo stringify solo quando cambia: è una riga". La riga
  è stata scritta, poi **misurata**, e la misura ha spostato il lavoro.
  - **Il `JSON.stringify` era la metà piccola.** Misurato in Chromium su
    documenti costruiti come una campagna vera (molti valori piccoli, non una
    stringa unica: è lì che V8 spende): 0,43 ms per confronto a 0,96 MB,
    0,92 ms a 1,96 MB, **4,17 ms a 3,69 MB** — cioè 50 ms al minuto sul caso
    peggiore, su desktop. Fastidioso, non grave. Nello stesso ciclo però il
    telefono **riscarica il documento intero**: quella campagna da 3,69 MB fa
    **44 MB al minuto per giocatore**, e il server ri-valida e ri-proietta
    l'albero a ogni richiesta di ognuno. Il gate su `updatedAt` non toccava
    niente di tutto questo.
  - **La correzione è una richiesta condizionale**, che copre tutte e tre le
    voci di spesa: `ETag: "r<revision>"` sulla rotta, `If-None-Match` dal
    client, e un **304 senza corpo** quando il DM non ha scritto. La rotta esce
    prima di `prepareCampaignDocument`/`projectForPlayers`, quindi il
    risparmio è anche del server.
  - **L'ETag è `revision` e non un hash del corpo**: il contatore è già la
    risposta a "la copia da cui parti è quella corrente?", ed è incrementato
    dentro la query che scrive `data`. Un hash vorrebbe proiettare tutto per
    calcolarlo, cioè risparmierebbe la rete e non il server.
  - Il gate su `updatedAt` è stato **tolto**: con il 304 non sarebbe mai vero
    (arrivare al corpo vuol già dire che la revisione è cambiata), cioè codice
    morto che sembra una difesa. Il confronto sullo `stringify` invece resta,
    e ora si paga solo quando il DM ha salvato: serve per il caso in cui abbia
    scritto una nota sua, che al tavolo non arriva e non deve ridisegnare.
  - Verifica: **16 controlli** in Chromium sul codice vero (fetch intercettata,
    non funzioni sostituite), con un finto server che tiene una revisione e
    risponde 304 come la rotta — l'`If-None-Match` che parte, il 304 che costa
    zero serializzazioni e non diventa "Offline", il 200 che passa ancora dal
    confronto, la nota invisibile che non ridisegna, la bolla rivelata che sì.
    Più un **gruppo di controllo**: disattivando la modifica i due giri fermi
    tornano a costare 2 serializzazioni ciascuno, cioè la prova misura davvero
    qualcosa. Il passaggio dell'`ETag` e del 304 attraverso Next è stato provato
    con una rotta usa-e-getta (200 con l'ETag, 304 con `If-None-Match` giusto,
    200 con quello sbagliato), poi rimossa.
  - **Verificato contro il database vero** (31 lug 2026, 15/15). L'ostacolo
    annotato — «crearne una è una scrittura sui dati di qualcun altro» — non
    era l'ostacolo giusto: su Neon un **branch usa-e-getta** è una copia
    isolata di `dev`, quindi la campagna con `share_token` si semina lì e non
    tocca niente. `npm run dev` col `DATABASE_URL` del branch, il tavolo
    aperto in Chromium, e le risposte contate dal `page.on("response")`.
    - Quel che si è visto: **tre giri, `200 304 304`**, ETag `"r1"` forte;
      il DM salva (`data` nuovo e `revision+1`) e arriva un 200 con `"r2"` e
      la tela ridisegnata; il giro dopo torna 304 sulla revisione nuova; una
      revisione toccata **senza** cambiare il documento dà il 200 dichiarato
      e il confronto del client evita il ridisegno; il token ruotato dà 404 e
      il tavolo scrive "Il DM ha chiuso il tavolo".
    - **I giri sono tre e non quattro**, e dice una cosa: il caricamento
      della pagina non fa nessuna fetch — il ponte è già nell'HTML — quindi
      il primo 200 È il primo colpo di polling, non un doppione.
    - **Controprova**: rimessa la rotta com'era prima del 29 lug (senza il
      ramo 304) cadono **esattamente le due asserzioni sui 304** e le altre
      tredici restano verdi. È il verso giusto: le tredici sono il gruppo di
      controllo, non stavano misurando l'ETag.
    - La verifica va scritta **idempotente**: al primo giro passava, al
      secondo no — la revisione era rimasta dove l'aveva lasciata e il
      documento era già quello riscritto, cioè misurava sé stessa. Ora si
      riporta la riga alla base prima di guardarla.
    - Trovato per strada e corretto: `serviTavolo` nella fixture emetteva
      l'ETag come **numero nudo** (`1`) mentre la rotta scrive `"r1"`. Al
      client non cambia niente (rimanda indietro quel che riceve), ma una
      fixture che dichiara "come nella rotta vera" e ne emette un'altra è la
      deriva che quel file esiste per non avere.
    - Trovato per strada e corretto: **il confronto di `If-None-Match` era
      forte**, e RFC 9110 §13.1.2 lo vuole debole. Vedi la voce qui sotto.
- [x] **`If-None-Match` confrontato con `===`** — fatto (31 lug 2026), scoperto
  dalla verifica qui sopra. Un ETag forte chiunque stia in mezzo ha il permesso
  di indebolirlo, e `W/"r5" === "r5"` è falso: la rotta avrebbe risposto 200 per
  sempre, il polling sarebbe tornato a scaricare tutto e **nessuno se ne sarebbe
  accorto**, perché il tavolo funziona lo stesso. È l'unico guasto di quella
  rotta che non si vede.
  - **Prima di correggere, misurato**: `/themes.css` in produzione con e senza
    brotli torna lo **stesso** ETag, quindi l'edge di Vercel non indebolisce
    niente e il caso oggi non capita. Il confronto debole (`stessaRevisione`)
    non ripara un guasto: toglie la dipendenza da quella misura, e costa niente
    perché l'ETag *è* la revisione — "stessa revisione indebolita" resta stessa
    revisione.
  - Provato con curl: forte identico → 304, `W/` → 304, dentro un elenco
    separato da virgole → 304; revisione diversa, header vuoto e spazzatura →
    200. Il jolly `*` resta un 200 ed è voluto: nessun client lo manda in un
    polling, e farlo rispondere 304 vorrebbe dire chiudere un giro senza corpo
    a chi il documento non l'ha mai ricevuto.
- [x] **`#battle-bar` fisso a 216px senza variante mobile** — fatto (29 lug
  2026). La voce diceva "copre il 60% della tela". Rimisurato **col dito
  emulato** — che è il punto: senza `hasTouch` la media query `pointer:coarse`
  non scatta e si misura un telefono che non esiste — a 360×740 la barra sta
  216×424 su una tela di 360×448, cioè il 60% della larghezza e il **95%
  dell'altezza**. Non è un tabellone che galleggia sopra la mappa: è un
  pannello che la nasconde, e proprio durante uno scontro.
  - **La regola d'accessibilità aggravava il difetto**: `pointer:coarse` porta
    il 🎲 da 33 a 44px, e la colonna del nome scende da 83 (misura del 29 lug,
    fatta col mouse) a **72**. Chi misura su desktop questo non lo vede.
  - **Cambia l'asse, non la larghezza**: nessuna larghezza è quella giusta a
    360px, quindi su schermo stretto la barra diventa una **fascia larga
    quanto la tela**, che paga in altezza — l'unica delle due dimensioni
    limitabile senza troncare niente. Dopo: 96% di larghezza ma **54%
    dell'altezza** nella vista DM e **31%** al tavolo, e il nome passa da 72px
    a 194 (250 al tavolo), cioè per la prima volta sopra i ~126 che ne chiede
    uno da tavolo. Il tetto lo tengono `.ini-list` (112px: due voci in vista
    DM, quattro al tavolo, e la terza tagliata a metà dice che si scorre) e
    `.ini-actions` su una riga sola scorrevole — la ricetta di `#plan-toolbar`,
    che costa 44px invece dei 94 di due righe da 44.
  - **La condizione è `(orientation:portrait)` e non la sola larghezza.** Un
    telefono coricato è ~740×360, quindi rientrerebbe in `max-width:760px`, ma
    lì la colonna da 216px è il **29%** della larghezza — nessun difetto da
    correggere — mentre la fascia mangerebbe l'altezza, che coricati è la
    dimensione scarsa. La regola vale dove il difetto è misurato.
  - Verifica in Chromium, **22 controlli**: vista DM e tavolo a 360×740 col
    dito, più **due gruppi di controllo** — lo stesso telefono coricato e il
    desktop, dove la colonna deve restare a 216px e la lista senza tetto. Le
    asserzioni guardano anche che la lista *scorra* invece di troncare
    (`scrollHeight > clientHeight`) e che il turno corrente non finisca sotto
    il tetto appena si apre lo scontro.
- [x] **Bersagli sotto i 44px non coperti da `pointer:coarse`** — fatto (29 lug
  2026). L'elenco scritto a mano è stato **rimisurato con una sonda** che
  enumera tutto ciò che è interattivo e visibile sotto i 44px, invece di
  fidarsi della lista: quella era ferma al giorno in cui è stata scritta.
  - **La falla più larga non era in elenco: i campi.** La regola cresceva per
    classe (`.btn`, `.icon-btn`, `.hp-btn`, `.pal-item`) e non nominava affatto
    `input`, `select` e `textarea`, che si toccano esattamente come un bottone
    — `#campaign-select` stava a 120×29, `#quick-search` a 110×34. Ora
    `input:not([type=checkbox]), select, textarea{min-height:44px}`; le caselle
    di spunta restano a 24, che è l'eccezione già dichiarata due righe sopra, e
    il `:not()` serve a non ribaltarla.
  - **`input.ini-num` a 38×24 era il bersaglio più piccolo dell'app**, e non
    era in elenco: è il numero che si corregge più spesso durante uno scontro.
    Portato a 44×44 — nella fascia il costo è nullo (il nome ha ~200px), nella
    colonna sono 6px di nome in meno. Dopo la correzione la barra **non ha più
    nessun bersaglio sotto soglia** su un telefono.
  - Fatti anche quelli in elenco: `.swatch` (26→44, i sette campioni vanno a
    capo su due righe e il foglio mobile ci sta), `.q-star`, `details.field >
    summary` (17px: è il comando che apre metà pannello), `#qs-results button`
    e `#srd-results button`.
  - **Il sito non aveva NESSUNA regola `pointer:coarse`**, ed è lo stesso modo
    in cui le due metà si allontanano per `prefers-reduced-motion`: i colori
    hanno una sorgente unica (`themes.css`), le regole d'uso no e vanno
    dichiarate due volte. Aggiunte in `globals.css` per `.btn` (copre
    `.btn--sm`), `.tab` (era a 42 — due pixel sotto, il modo più fastidioso di
    sbagliare) e `.linkbtn` (23px: "Password dimenticata?", "Elimina il mio
    account"). `.input` passava già.
  - **Trovato dalla sonda e più serio di tutto l'elenco**: gli indici
    `.srd-nomi` sono link alti 19px con 5,6 di scarto, cioè **24,6px da un nome
    al successivo** — sopra il minimo WCAG 2.5.8 di 24 per meno di un pixel, su
    un elenco che ne conta 331 (il bestiario) uno sotto l'altro a 360px. Ora il
    passo è 49,9. Cresce il **bersaglio** e non il testo: il link diventa alto
    44 e il nome resta della sua taglia.
  - **I link dentro la prosa restano come sono, ed è una decisione**: WCAG
    2.5.8 esenta i link in linea in una frase, e dare 44px d'altezza ai rimandi
    dell'SRD spezzerebbe l'interlinea delle pagine che esistono per essere
    lette. Un elenco di nomi in colonna non è un link in linea, e infatti è
    l'unica eccezione — sta in `srd.css`, accanto a `.srd-nomi`.
  - Verifica in Chromium, **20 controlli** a 360px col dito su app e sito, col
    **gruppo di controllo su desktop**. Lì il confronto non può essere "sta
    sotto i 44px" — il rem di questo sito scala con la *larghezza*, quindi a
    1280px una `.tab` è alta 52 di suo — e a dire se la regola ha morso è la
    sua **impronta**, il `min-height` calcolato, che vale 44px solo dove la
    media query scatta (col mouse esce `auto`/`0px`). Più l'asserzione che un
    link di prosa **non** sia cresciuto, che è l'eccezione detta sopra.
- [x] **La ricerca rapida (Ctrl+K) era rotta** — fatto (29 lug 2026), e non è
  una voce dell'audit: è saltata fuori verificando i bersagli qui sopra.
  `ricerca.js` usava `nodeColor(n)` senza importarlo, quindi la funzione
  lanciava `ReferenceError` sulla **prima bolla incontrata** — cioè in
  qualunque campagna che non sia vuota. Il menu restava chiuso, che dal di
  fuori è **indistinguibile da "nessun risultato"**: nessun avviso, nessuno
  stato d'errore, solo una ricerca che non trova mai niente.
  - Si è visto solo perché una regola da 44px era stata scritta su
    `#qs-results button`, e per misurarla bisognava che quei bottoni
    esistessero. Una regola su un selettore mai disegnato è indistinguibile da
    una regola che non serve — per questo la verifica **asserisce prima che i
    risultati si siano aperti**, e poi li misura.
  - Da qui una lezione per le verifiche a mano: guardare la **console**, non
    solo il DOM. Un `pageerror` dentro un gestore lascia l'interfaccia in uno
    stato plausibile, e nessuna asserzione sul DOM lo distingue da un caso
    legittimo.
- **Effetto collaterale da tenere presente**: coi campi a 44px la topbar
  dell'app cresce di **10px** su touch, e la tela della vista DM scende da 448
  a 438 a 360×740. È il prezzo dichiarato di bersagli tacchabili, non un
  guasto, ma va ricordato prima di aggiungere altre righe alla topbar.
- [x] **Il telefono coricato non lasciava tela** — fatto (29 lug 2026), e la
  misura ha cambiato di grado il difetto. La voce parlava di 740×360, dove la
  tela è alta 180px su 360 (il 50%: topbar 61 + briciole 45 + palette 74).
  Ma **un telefono coricato non è largo 740: è largo 852** (iPhone 14 Pro;
  15/16 arrivano a 932), cioè **sopra** la soglia mobile di 760px — e lì la
  palette può andare a capo e si prende **425px** su uno schermo alto 393.
  Misurata col dito, la tela usciva alta **ZERO**: non "poca mappa", nessuna
  mappa. Il 740×360 della voce era il caso mite, l'unico in cui la
  compattazione mobile almeno scatta.
  - **La condizione è l'ALTEZZA** (`@media (max-height:480px)`), non
    l'orientamento come nella fascia d'iniziativa: lì il difetto era la
    larghezza di un pannello, qui è quanto verticale mangia il cromo, e a
    dirlo è l'altezza della finestra — che copre anche una finestra da
    scrivania schiacciata, dove il difetto è identico. 480px sta sopra ogni
    telefono coricato (430 il più alto) e sotto ogni tablet (768 l'iPad):
    in mezzo non c'è niente da rompere.
  - Il blocco fa tre cose: topbar su **una** riga (i figli visibili sommano
    648px, quindi ci stanno da 740 in su; il gradino 761–1200 forza l'a-capo
    con uno pseudo-elemento a `flex-basis:100%`, e va disfatto), palette a
    **una riga sola scorrevole** (la ricetta di ≤760px — è questa LA
    correzione), padding di topbar e briciole tagliati. Nessun *comando*
    rimpicciolito: i 44px col dito restano, ed è una delle asserzioni.
  - **Il pannello dettagli resta di fianco** e non diventa un foglio dal
    basso: su uno schermo alto 393 un foglio al 62% ne coprirebbe 244, cioè
    rifarebbe il difetto appena corretto. Coricati lo spazio sta in
    orizzontale — ma **quanto**: 440px fissi su 852 sono metà schermo, la tela
    ne riceveva 407 e il tabellone d'iniziativa (la colonna da 216px, che lì è
    la forma giusta) ne copriva il 53%. Restava una fessura di mappa fra i
    due. Il tetto scende da 60vw a **40vw** e la tela passa a 506px (60% della
    larghezza), col tabellone al 43%; a 932×430 sono 554 e il 39%.
    - È la stessa difesa già scritta accanto a `--detail-w` — la larghezza
      ricordata da un monitor grande non deve mangiare la tela di uno schermo
      piccolo — applicata dove il monitor grande non c'entra: il pannello lì
      è largo 440 perché *nasce* così.
    - Resta un **tetto e non una larghezza imposta**: sopra i 760px la
      maniglia c'è, quindi il DM può ancora stringerlo (e un'asserzione
      guarda che ci sia). `min-width:761px` nella condizione non è
      decorativo: sotto, il pannello *è* il foglio dal basso
      (`max-width:none`) e un tetto in vw lo ridurrebbe a una colonna in un
      angolo — il controllo a 360×740 verifica proprio che non sia sceso lì.
  - Dopo: a 852×393 la tela passa da **0 a 239px** (61% dello schermo) e il
    cromo da 587 a 154; a 740×360 la tela da 180 a 204 (50% → 57%), cioè la
    stessa quota che ha il telefono in piedi (62%).
  - Verifica in Chromium, **48 controlli** col dito emulato su tre telefoni
    coricati (740×360, 852×393, 932×430) più il **tavolo**, e tre gruppi di
    controllo che devono restare identici — telefono in piedi, scrivania e
    iPad — misurati sull'**impronta** (il padding calcolato dice se il blocco
    ha morso; l'altezza no, che cambia con la finestra). Fra le asserzioni:
    nessun bersaglio del cromo sotto i 44px, e la pagina che non scorre in
    orizzontale. Controprova disattivando il blocco: a 852×393 la verifica
    **non parte nemmeno**, perché `#plan-svg` è alto 0 e Playwright lo dà per
    invisibile — che è il modo più chiaro in cui il difetto poteva dirsi.
- [x] **`alt="riferimento"` su un'immagine che ha il titolo a disposizione** —
  fatto (29 lug 2026), e la voce era scritta sul posto sbagliato: quella
  miniatura sta **dentro un `<button aria-label="Ingrandisci l'immagine">`**, e
  un `aria-label` copre il contenuto dell'elemento. L'`alt` non veniva
  annunciato affatto — correggere il solo `alt` avrebbe prodotto un diff che
  sembra una correzione d'accessibilità e non cambia una parola di ciò che si
  sente.
  - A portare il nome è l'**etichetta del bottone** ("Ingrandisci: Immagine di
    riferimento di Locanda della Biscia"). L'`alt` resta comunque descrittivo,
    per due ragioni diverse: nel **lightbox** l'immagine non sta in nessun
    bottone e lì viene letto per davvero, e nel pannello è ciò che si vede
    quando l'immagine non carica (un base64 troncato da un import), dove un
    `alt=""` lascerebbe un bottone vuoto.
  - I tre punti sono **uno solo** (`imgZoomMarkup` + `nomeImmagine` in
    `pannello.js`): il markup era ricopiato in `renderDetail` e
    `renderTableDetail`, e un nome che va detto in tre posti si scrive in uno.
- [x] **`.hp-bar i` sotto soglia in due temi** — fatto (29 lug 2026), e la
  misura ha allargato la voce da due temi a cinque e da un selettore a quattro.
  Il difetto non è della barra: è che **`--moss-deep` come riempimento non era
  misurato da nessuna coppia**. Compariva in `COPPIE` solo di riflesso, e i suoi
  valori erano stati scelti guardandoli su un fondo scuro, dove il contrasto c'è.
  - **Un riempimento ha UNA adiacenza** — ciò che ci sta dietro — quindi non
    vale lo sconto dichiarato per i bordi il 28 lug ("ne basta una delle due").
    Le superfici sono tre (barra PF sul fondo incassato, spunta della checklist
    e maniglia di collegamento sul pannello) e la severa è il **pannello**, la
    più chiara: lì stavano a 2,57 (Notturno), 2,54 (Gilda), 2,48 (Segnale),
    **1,94 (Sottosuolo)** e 2,90 (Taverna).
  - Ritoccati quei cinque `--moss-deep` avvicinandoli al **proprio `--moss`**,
    dal 9% di Taverna al 39% di Sottosuolo, che partiva più scuro di tutti: la
    variante scura deve restare la stessa tinta dell'accento, non diventare un
    colore nuovo. Ora 3,07–3,09 sul pannello e 3,45–3,95 sul fondo incassato.
    Gli altri sette non sono stati toccati — passavano, e il valore giusto è
    quello che passa.
  - **Due coppie nuove in `COPPIE`**, che è la metà che impedisce il ritorno:
    `--moss-deep`/`--peat-sunk` e `--moss-deep`/`--surface`. Senza, il prossimo
    tema nasce di nuovo con la barra invisibile e lo script dice 12/12.
  - **Trovato di conseguenza, e più grave**: `#detail-fab` — il bottone
    flottante che su telefono è l'**unico** modo di aprire il pannello dettagli
    — aveva la ✎ (testo, soglia 4,5:1) su `--fen-dim`, cioè a 2,12–3,82:1 in
    **nove temi su dodici**, il peggiore Sottosuolo a 2,12. È esattamente la
    correzione già fatta per `.btn.primary` ("su --fen-dim il testo scendeva
    sotto 4,5:1"), rimasta indietro su un bottone che sta in una media query
    mobile e che chi misura da desktop non vede nemmeno. Ora è su `--fen`:
    5,15–14,98:1 il glifo, 5,06–14,98:1 il bottone sulla tela.
  - Verifica in Chromium, **131 controlli**, tutti col colore **calcolato dal
    browser** e non letto da `themes.css` — leggere il CSS avrebbe ridato il
    numero che ha già dato `temi:contrasto`, senza provare che il selettore
    prende quel token. Dodici temi × (barra, spunta, glifo, bottone sulla tela)
    più i gruppi di controllo: che su desktop il FAB resti nascosto, e
    soprattutto che le **due correzioni siano di verso opposto** — sulla barra è
    cambiato il *token* (il selettore legge ancora `--moss-deep`), sul FAB il
    *selettore* (il token è `--moss`). Senza quelle due righe una verifica verde
    non direbbe quale delle due è successa. Controprova fatta rimettendo i
    valori vecchi: 32 asserzioni cadono, e Sottosuolo torna a 2,21/1,94/2,12.
  - Lo stato critico `.low` (`--ember`) resta com'era: 4,87–10,42:1 ovunque.
- [x] **Due comandi che a riposo non si vedevano** — fatto (29 lug 2026).
  `#detail-grip` (la maniglia che ridimensiona il pannello dettagli) e la `★`
  spenta di `.q-star` stavano su `--line`, cioè **1,37:1 su Torbiera**: due
  comandi che si scoprono solo per caso, uno passandoci sopra col mouse e
  l'altro sapendo che c'è. Ora sono su `--line-ui`.
  - **La voce diceva che WCAG non li copre, e si sbagliava.** Non sono bordi,
    è vero, ma 1.4.11 non parla solo di contorni: chiede 3:1 all'informazione
    visiva che **identifica un componente**, e per questi due non c'è
    nient'altro — la maniglia è `role="separator" tabindex="0"` (un window
    splitter, cioè un widget) e la stella è un `<button>` il cui unico visuale
    è il glifo. L'eccezione della norma vale per i componenti **inattivi**, e
    "spento" non è "disabilitato". Quindi la domanda "quanto forte deve essere
    un comando a riposo" aveva già una risposta, e non era una scelta di gusto.
  - **`--edge-lit`, il candidato che la voce proponeva, non regge**: sta sotto
    3:1 in **quattro temi su dodici** contro almeno una delle superfici
    (Torbiera 1,84–2,15, Brace 1,93–2,18, Cripta 2,10–2,45, Pergamena
    2,73–3,06), e ha già un mestiere suo — il bordo acceso in hover — quindi
    ritoccarne i valori avrebbe spostato altro. `--edge-ui` passa ovunque
    (3,01–4,62): è il token che *per contratto* regge 3:1 su tutte le
    superfici su cui compare.
  - **Un riempimento ha una adiacenza sola**, quindi qui non vale lo sconto
    dei bordi — e la maniglia ne ha due perché sta *fra* pannello e tela, non
    perché sia un contorno. Le tre superfici (`--surface`, `--peat`, `--glow`)
    erano **già** tutte in `COPPIE` dal 28 lug: nessuna riga nuova, solo i
    commenti che ora dicono chi dipende da quelle soglie — la stessa cosa
    fatta per l'anello di focus, e per la stessa ragione (chi le abbassa
    spegne anche questi due).
  - Lo **stato** della stella non passa dal colore: le principali stanno in una
    sezione loro ("★ Quest principali"), quindi ★/☆ sarebbe un terzo modo di
    dire una cosa già detta due volte — e il precedente di `.ini-tipo` dice che
    pieno/vuoto è comunque un canale solo, il peso.
  - Verifica in Chromium, **168 controlli** su tutti e dodici i temi, col colore
    **calcolato dal browser**: maniglia e stella spenta uguali a `--edge-ui`,
    i tre rapporti ≥3:1, la stella accesa ancora oro, e due gruppi di controllo
    — il bordo di `#detail` che corre *accanto* alla maniglia deve restare
    `--edge` (prova che sono stati spostati i selettori e non il token) e la
    maniglia in hover deve restare `--fen` (la correzione è a riposo).
    Controprova rimettendo i vecchi valori: **60 asserzioni cadono** e il
    browser riporta 1,37:1 su Torbiera, cioè la stessa misura da cui la voce
    era partita. `npx tsc --noEmit`, 97 test e `temi:contrasto` (12/12) puliti.
  - Due trappole della verifica, che valgono per le prossime: `.focus()` da
    script **non** accende `:focus-visible` su un elemento che non è un campo
    (12 falsi KO: si misurava il riposo credendo di misurare l'acceso — si usa
    l'hover), e con `transition:.15s` leggere subito dà il colore di
    **partenza**, cioè di nuovo il riposo.
- [x] **La pista della barra PF dei mostri** (trovata e chiusa il 29 lug 2026) era
  `background:var(--line)` sul pannello: **1,32–4,36:1**, cioè sotto 3:1 in
  dieci temi. Trovata il 29 lug 2026 cercando col grep gli *altri* usi di
  `--line` come riempimento, dopo i due comandi qui sopra — la lezione dei
  bersagli da 44px applicata a mano: si misura, non ci si fida dell'elenco.
  - **Non è lo stesso difetto e per questo non è stata corretta insieme**: la
    pista non identifica un comando, dice *quanto è lungo il massimo*, e quel
    numero sta già scritto nei due campi `hp`/`hpMax` accanto alla barra
    (`foeCard` in `mostri.js`). Nessuna informazione è affidata al solo colore.
  - Resta un'**incoerenza fra le due barre**, ed è quella la voce: la barra dei
    PG (`.hp-bar`, giocatori) ha pista `--bog-2` e bordo `--line`, quella dei
    mostri pista `--line` e nessun bordo. Il riempimento dei mostri è per di
    più deciso in JS (`hpColor`: `--fen`/`--gold`/`--ember` in uno `style`
    inline), quindi `temi:contrasto` non lo vede e non lo vedrà: chi unifica le
    due barre decida prima se quel colore deve restare inline.

  **Com'è andata, e la misura ha spostato il bersaglio.** La voce guardava la
  pista contro il pannello. Misurando anche la barra dei PG — quella "giusta",
  il riferimento da cui copiare — viene fuori che la sua pista sta a
  **1,03–1,28:1** in tutti e dodici i temi, e il suo bordo a 1,32–4,36 come
  quella dei mostri. Cioè: **una barra PF non ha una pista visibile e non deve
  averla**. È un incavo; quello che si vede è il riempimento, e il massimo sta
  scritto nei due campi accanto. Alzare la pista a 3:1 avrebbe voluto dire
  riprogettare entrambe le barre per una soglia che nessuno chiede.
  - **Il difetto vero era un altro, ed era peggiore**: il riempimento sulla
    pista. La pista dei mostri era `--line`, cioè un **mezzotono**, e le tre
    fasce ci cadevano sotto 3:1 in **sei casi su trentasei** (dodici temi × tre
    fasce): l'oro 2,93 su Pergamena e 2,76 su Inchiostro, il rosso 1,96 su
    Gilda, 2,60 su Segnale, 2,25 su Alto contrasto, il verde 1,67 su Gilda. A
    pochi PF la barra spariva dentro la propria pista, cioè **proprio quando
    quella barra serve**. Sull'incavo (`--bog-2`) le tre passano in tutti e
    dodici i temi, minimo 3,95:1.
  - **La correzione è l'unificazione**, che era la voce: una ricetta sola
    (`.hp-bar`), e la scheda del mostro la usa un pixel più bassa perché è
    densa (`.foe-hp .hp-bar{height:9px}`). Due blocchi CSS a duecento righe di
    distanza divergono, ed è esattamente quello che era successo. Il verde dei
    mostri passa da `--fen` a `--fen-dim`, che è la variante che `themes.css`
    dichiara per i riempimenti e che i PG usavano già.
  - **Il colore inline era la causa, non un dettaglio** (era la domanda che la
    voce lasciava aperta): un colore in uno `style` scritto dal JS non lo trova
    nessun grep sul CSS, quindi nessuno pensa a dichiararlo in `COPPIE`. Ora
    `hpFascia` torna una **classe** (`mid`/`low`) e i colori stanno in
    `app.css`, con due righe nuove in `COPPIE` (`--lantern`/`--peat-sunk`,
    `--ember`/`--peat-sunk`). La seconda copre anche la fascia bassa dei PG,
    che nessuna riga guardava.
  - **Le soglie restano diverse** e adesso lo dicono: 30% per i PG, 25/50% per
    i mostri. Non si sa perché lo siano — sembra accidentale — ma unificarle
    cambia quando la barra di un PG diventa rossa e gli aggiunge una fascia
    d'oro, che è una scelta di prodotto e non una correzione. Chi la vuole fare
    la faccia dicendolo.
  - **Il limite che resta**, e non lo chiude questo lavoro: `COPPIE` dichiara
    *quale* coppia misurare, quindi incorpora l'ipotesi che la pista sia
    `--bog-2`. Chi rimettesse un mezzotono lì avrebbe di nuovo dodici verdi e
    il difetto sotto. È la stessa limitazione già scritta in CLAUDE.md — quel
    file è scritto a mano — e il rimedio non è una coppia in più: è che la
    ricetta della barra ora è una sola, quindi il posto dove sbagliare è uno.
  - Verificato in Chromium con **22 controlli**: le tre fasce viste tutte
    scendendo di PF col bottone `−` (che è `renderFoeHP`, il percorso che il
    rinominare poteva rompere in silenzio), il gruppo di controllo sulla barra
    dei PG (10px, bordo, contrasto), e la controprova **su Gilda** — su
    Torbiera il rosso sulla vecchia pista stava a 4,26:1 e una controprova sul
    tema di default avrebbe detto che il difetto non c'era. Su Gilda il browser
    conferma i numeri del verificatore al centesimo: 1,96:1 sulla vecchia
    pista, 7,67:1 sull'incavo.

- [x] **La scala della maglia sulla tela** — fatto (22 set 2026). Una barra in
  basso (`#plan-scale` in `app.html`, `aggiornaScala` in `mappa.js`) lunga
  n quadretti veri dello schermo corrente, con una tacca per quadretto e
  l'etichetta «n ▢ · metri». n scala a 1, 2, 5, 10… perché la barra resti
  sopra i 24px quando si allontana lo zoom. **Situazionale**: compare solo dove
  i quadretti misurano qualcosa — livello in scala, piante o muri dentro, o uno
  scontro aperto — e resta nascosta su mondo, regione e quartieri di sole zone.
  In basso a destra su scrivania (a sinistra scende il tabellone d'iniziativa),
  a sinistra su telefono (a destra c'è il FAB). Misurato in Chromium: la barra
  da 1 quadretto è 43px contro i 43,25 della maglia disegnata, e 2 quadretti
  su telefono 45 contro 44,6.
- [x] **Privacy: cookie e Cloudflare dichiarati per quello che sono** — fatto
  (23 set 2026), dopo una segnalazione ePrivacy ("cookie non essenziali senza
  consenso") che si è rivelata un falso positivo: in produzione le pagine non
  impostano cookie, gli unici sono quelli di Auth.js (sessione, CSRF, callback,
  state/pkce di Google), tutti tecnici, e non c'è nessuno script di analisi. La
  pagina però diceva «l'unico cookie è quello che ti tiene collegato» e che
  Cloudflare instrada solo la posta, mentre fa da proxy a tutto il sito
  (`server: cloudflare`). Ora `src/app/privacy/page.tsx` elenca cookie,
  `localStorage` e copia offline con lo scopo di ciascuno, e dice che il
  traffico passa da Cloudflare. Niente banner: chiederebbe un consenso che
  l'art. 5.3 non richiede. Chi aggiunge uno script di terze parti o un cookie
  nuovo aggiorni quell'elenco.

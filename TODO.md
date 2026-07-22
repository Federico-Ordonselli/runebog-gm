# To-do

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
- [ ] **Sezione regole sul sito** — capitoli dell'SRD consultabili in italiano
  (`/srd`): Come si gioca, Creazione del personaggio, Classi, Origini dei
  personaggi, Talenti, Equipaggiamento, Incantesimi, Glossario delle regole,
  Strumenti di gioco, Oggetti magici, panoramica delle schede mostro. Con le
  Informazioni legali e la dichiarazione di attribuzione richiesta dalla licenza.
  **Tutti e dieci i capitoli sono pubblicati dal 21 lug 2026**: la voce resta
  aperta per la panoramica delle schede mostro, le Informazioni legali e le
  rifiniture in fondo.
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
  - [ ] **I restanti sette capitoli**, uno alla volta. L'ordine non è quello del
    PDF ma quello del valore al tavolo incrociato con la difficoltà di
    estrazione — ogni capitolo si pubblica mettendo `pronto: true` nel registro
    di `src/lib/srd/index.ts` dopo che `node scripts/verifica-srd-regole.mjs
    <PDF> <id>` passa:
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

## Mappe in scala

La maglia esiste già ed è una sola — `CELL` 40px = 1 quadretto = 1,5 m (5 piedi),
identica tra pattern `#grid` in `mappa.js`, battaglia e `DG_SCALE` in `dungeon.js` —
ma oggi le bolle non la rispettano: sono simboli, non piante.

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

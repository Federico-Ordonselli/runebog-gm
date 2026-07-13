# GmHelper — Diario del Game Master

Strumento per Game Master di giochi di ruolo da tavolo: costruisci mappe gerarchiche e navigabili delle tue città e dei tuoi dungeon, tieni traccia di quest ed encounter, gestisci le schede dei mostri con i PF in tempo reale durante il combattimento, e organizza tutto in campagne separate.

Nato per gestire una one-shot di compleanno ambientata nella città di **Runebog** (da cui i nomi file storici), è cresciuto fino a diventare uno strumento generico per qualsiasi campagna, con dati ufficiali **D&D 5e (SRD 5.2.1, regole 2024)** integrati.

---

## Idea di fondo

Il concetto centrale è una **mappa gerarchica di "bolle"**. Ogni bolla è un nodo che può contenere altre bolle: apri la città Runebog e dentro trovi i quartieri, entri in un quartiere e dentro trovi gli edifici, entri in un edificio e dentro trovi le stanze. Non c'è un limite di profondità. A ogni livello puoi:

- disporre le bolle liberamente su una tela con pan e zoom;
- collegarle con strade tipizzate (strada normale, bloccata, ponte, passaggio segreto, tunnel);
- mettere un'immagine di sfondo (una mappa disegnata) sotto le bolle;
- piazzare segnalini per quest, encounter, PNG, note e token dei personaggi.

Tutto lo stato di una campagna è **un unico oggetto JSON serializzabile**. Questa scelta è il cardine dell'intero progetto: rende l'esportazione banale, l'importazione simmetrica, e il salvataggio su cloud una semplice scrittura di quel JSON in una colonna del database.

---

## I tre modi di usare GmHelper

Lo stesso identico file `app.html` (vanilla JavaScript, nessun framework, nessuna dipendenza a runtime) gira in tre contesti diversi. È il cuore del progetto e la **fonte di verità** del codice dell'applicazione.

### 1. Standalone nel browser
Apri `runebog-campaign-manager.html` direttamente in un browser. I dati vengono salvati in `localStorage`. Zero installazione, funziona offline. Ideale per provarlo o per usarlo su una macchina qualsiasi.

### 2. App desktop (Electron)
Il wrapper in `runebog-desktop/` impacchetta lo stesso HTML in un'app nativa per Linux e macOS. Aggiunge dialog di sistema per Esporta/Importa e un profilo dati persistente separato dal browser. Vedi più sotto per la build.

### 3. Sito web multi-utente (Next.js)
Il progetto in `runebog-web/` serve lo stesso HTML dietro un login, con salvataggio su database cloud. Ogni utente ha le sue campagne private. Vedi più sotto per l'architettura.

Il punto chiave: **il formato JSON è identico nei tre contesti**. Esporti dal desktop, importi nel sito, riesporti nel browser — nessuna conversione. L'app rileva da sola in che contesto gira (controlla se esiste `window.__cloud`) e adatta il comportamento di salvataggio.

---

## Struttura del repository

```
.
├── runebog-campaign-manager.html   ← L'APP. File singolo, ~2400 righe, vanilla JS. Fonte di verità.
│
├── runebog-desktop/                ← Wrapper Electron (Linux + macOS)
│   ├── app.html                    ← copia di runebog-campaign-manager.html
│   ├── main.js                     ← processo principale, dialog Esporta/Importa nativi
│   ├── preload.js                  ← bridge sicuro (contextBridge) verso window.desktop
│   └── package.json                ← config electron-builder
│
└── runebog-web/                    ← Sito Next.js 15 (App Router)
    ├── public/app.html             ← copia di runebog-campaign-manager.html
    ├── src/
    │   ├── auth.ts                 ← Auth.js v5 + Google OAuth + adapter Drizzle
    │   ├── db/
    │   │   ├── schema.ts           ← tabelle: users/accounts/sessions + campaigns (JSONB)
    │   │   └── index.ts            ← connessione Neon Postgres
    │   └── app/
    │       ├── page.tsx            ← landing: login, lista campagne, donazione
    │       ├── play/[id]/route.ts  ← serve app.html iniettando window.__cloud = {id, state}
    │       └── api/campaigns/...    ← REST: GET/POST lista, GET/PATCH/DELETE singola
    ├── drizzle.config.ts
    └── .env.example
```

Quando modifichi `runebog-campaign-manager.html`, ricopialo in `runebog-desktop/app.html` e `runebog-web/public/app.html`. È l'unico passo di sincronizzazione manuale.

---

## L'app: com'è fatta dentro

`app.html` è un unico file con HTML, CSS e JavaScript inline. Circa 89 funzioni, organizzate in sezioni delimitate da commenti-banner. Le principali:

**Modello dati.** Un nodo (bolla) ha: `id`, `title`, `type` (zona, luogo, quest, encounter, png, token, nota), `notes`, `img` (immagine di riferimento in base64), `children` (nodi figli), `edges` (collegamenti tra i figli), coordinate `x`/`y`, `shape`, ed eventualmente `monster` (scheda mostro) o `bg` (sfondo del livello). Lo stato completo è `{root, checklist, players}`.

**Motore della mappa spaziale.** Il grosso del codice. Gestisce il rendering SVG delle bolle e delle strade, pan/zoom con viewBox (uno per livello, memorizzato), drag dei blocchi con snap magnetico e linee guida di allineamento, creazione dei collegamenti trascinando dalle maniglie, ridimensionamento, selezione multipla con Ctrl e spostamento di gruppo. Le miniature dei livelli figli vengono disegnate dentro le bolle padre, così dalla città vedi già com'è fatto ogni quartiere.

**Pannello dettaglio.** La colonna a destra: cambia in base a cosa è selezionato (un nodo, un collegamento, una selezione multipla). Contiene i campi editabili e, per gli encounter, la scheda mostro.

**Schede mostro (D&D 5e).** Dataset SRD 5.2.1 con 331 creature embedded nel file (`window.SRD_MONSTERS`). Cerchi un mostro, la scheda si compila da sola (CA, PF, velocità, 6 caratteristiche con modificatori, tiri salvezza, azioni, azioni leggendarie). Ogni nemico ha PF individuali modificabili con +/− durante il combattimento; un gruppo di più creature mostra il conteggio "vivi / PF totali". Include un tiradadi.

**Le altre viste.** Diario Quest (aggrega tutte le quest della campagna, con quelle principali segnabili con una stella), Checklist, Giocatori.

**Qualità della vita.** Ricerca rapida (Ctrl+K) che salta a qualsiasi nodo, menu contestuale col tasto destro, duplicazione, scorciatoie da tastiera (frecce per spostare, Canc per eliminare, +/− zoom, F per adattare), campagne multiple con selettore. Su schermi piccoli il pannello dettaglio diventa un bottom sheet.

**Persistenza.** Salvataggio automatico con debounce. In standalone/desktop scrive su `localStorage` (una chiave per campagna). In modalità cloud fa una PATCH all'API con coalescing delle scritture (se un salvataggio è in volo, il successivo si accoda). Esporta/Importa produce e legge il JSON completo.

---

## Sviluppo

### Modificare l'app
L'app non ha build step: apri `runebog-campaign-manager.html` nel browser, modifica, ricarica. Per verificare la sintassi senza aprire il browser puoi estrarre gli `<script>` e passarli a `node --check`.

Dopo ogni modifica, propaga il file:
```bash
cp runebog-campaign-manager.html runebog-desktop/app.html
cp runebog-campaign-manager.html runebog-web/public/app.html
```

### Build desktop (Electron)
```bash
cd runebog-desktop
npm install
npm start                              # avvia senza impacchettare
npm run dist:linux                     # AppImage per Linux
npm run dist:mac                       # zip per macOS (arm64 e x64)
```
Le build macOS non sono firmate (la firma richiede un account Apple Developer). Al primo avvio su Mac serve tasto destro → Apri, oppure da terminale `xattr -cr "Runebog GM.app"`. Su Apple Silicon può servire anche `codesign --force --deep --sign - "Runebog GM.app"`.

I dati dell'app desktop vivono nel profilo Electron (`~/Library/Application Support/runebog-gm/` su Mac, `~/.config/runebog-gm/` su Linux), separati dal browser e conservati tra un aggiornamento e l'altro.

### Setup sito web (Next.js + Neon + Vercel)
```bash
cd runebog-web
npm install
cp .env.example .env                   # poi compila i valori
npx auth secret                        # genera AUTH_SECRET
npm run db:push                        # crea le tabelle su Neon
npm run dev                            # http://localhost:3000
```
Servono: una connection string Neon (`DATABASE_URL`), un OAuth client Google (ID + secret, con redirect URI `.../api/auth/callback/google`), e `AUTH_SECRET`. Deploy su Vercel importando il repo e incollando le stesse variabili d'ambiente. Con i free tier di Vercel e Neon il costo è zero fino a traffico significativo.

---

## Come funziona il salvataggio cloud

Questo è il meccanismo più interessante dell'architettura, ed è volutamente semplice.

Una campagna corrisponde a **una riga** nella tabella `campaigns`, con una colonna `data` di tipo JSONB che contiene l'intero stato dell'app — esattamente lo stesso JSON che produce il pulsante Esporta. Niente scomposizione dell'albero ricorsivo in tabelle relazionali (sarebbe complessa e fragile); Postgres gestisce e indicizza il JSONB nativamente.

Il flusso:
1. La route `/play/[id]` legge la riga dal database e serve `app.html` iniettando `<script>window.__cloud = {id, state}</script>` prima dello script dell'app.
2. All'avvio, l'app vede `window.__cloud` e parte da quello stato invece che da `localStorage`.
3. Ogni `save()` fa `PATCH /api/campaigns/:id` con lo stato aggiornato. Il `localStorage` resta come cache offline di sicurezza.
4. Ogni route API verifica che la campagna appartenga all'utente autenticato.

Le immagini (mappe di sfondo, riferimenti) sono attualmente in base64 dentro il JSON. Funziona, ma fa crescere il peso: l'evoluzione naturale è spostarle su un object storage (Cloudflare R2, S3) e tenere nel JSON solo gli URL. C'è un limite di sicurezza a 4 MB per salvataggio nell'API, allineato ai limiti di Vercel.

---

## Dati e licenze

Le statistiche dei mostri provengono dal **System Reference Document 5.2.1** di Wizards of the Coast, rilasciato sotto licenza **Creative Commons Attribution 4.0 (CC-BY-4.0)**. L'attribuzione richiesta è visibile in ogni scheda mostro. I dati strutturati derivano dal progetto open source Open5e. Nomi e descrizioni dei mostri sono in inglese (Wizards ha pubblicato la SRD italiana solo in PDF, non come dati); tutti i campi restano modificabili a mano.

Alcune creature iconiche (Beholder, Mind Flayer) e nomi propri (Tiamat, Strahd) non fanno parte della SRD per scelta dell'editore e vanno ricreate a mano se servono.

---

## Roadmap possibile

- Condivisione delle campagne con i giocatori (colonna `share_token`, route in sola lettura), poi collaborazione in tempo reale.
- Immagini su object storage esterno invece che in base64.
- SRD 2024 completa man mano che i dataset open source la finalizzano.
- Ricerca incantesimi/oggetti magici oltre ai mostri.

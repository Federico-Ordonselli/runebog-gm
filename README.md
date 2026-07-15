# Runebog GM — Diario del Game Master

Strumento per Game Master di giochi di ruolo da tavolo: costruisci mappe gerarchiche e navigabili delle tue città e dei tuoi dungeon, tieni traccia di quest ed encounter, gestisci le schede dei mostri con i PF in tempo reale durante il combattimento, e organizza tutto in campagne separate.

Questo repository contiene il **sito web multi-utente** (Next.js 15): serve l'app dietro un login, con le campagne salvate su database cloud. L'app in sé (`public/app.html` + i moduli in `public/app/`) è vanilla JavaScript, senza framework, senza build step e senza dipendenze a runtime, e gira identica anche standalone nel browser.

Nato per gestire una one-shot di compleanno ambientata nella città immaginaria di **Runebog** (da cui il nome), è cresciuto fino a diventare uno strumento generico per qualsiasi campagna, con dati ufficiali **D&D 5e (SRD 5.2.1, regole 2024)** integrati.

---

## Idea di fondo

Il concetto centrale è una **mappa gerarchica di "bolle"**. Ogni bolla è un nodo che può contenere altre bolle: apri una città e dentro trovi i quartieri, entri in un quartiere e dentro trovi gli edifici, entri in un edificio e dentro trovi le stanze. Non c'è un limite di profondità. A ogni livello puoi:

- disporre le bolle liberamente su una tela con pan e zoom;
- collegarle con strade tipizzate (strada normale, bloccata, ponte, passaggio segreto, tunnel);
- mettere un'immagine di sfondo (una mappa disegnata) sotto le bolle;
- piazzare segnalini per quest, encounter, PNG, note e token dei personaggi.

Tutto lo stato di una campagna è **un unico oggetto JSON serializzabile**. Questa scelta è il cardine dell'intero progetto: rende l'esportazione banale, l'importazione simmetrica, e il salvataggio su cloud una semplice scrittura di quel JSON in una colonna del database.

Il formato JSON è **identico** in ogni contesto (standalone su localStorage, cloud, file esportato): esporti da una parte, importi dall'altra, senza nessuna conversione. L'app rileva da sola dove sta girando (controlla se esiste `window.__cloud`) e adatta il comportamento di salvataggio.

---

## Struttura del repository

```
.
├── public/
│   ├── app.html                ← L'APP: solo il markup (~160 righe)
│   └── app/                    ← stili (app.css), dataset SRD (srd-mostri.js) e
│                                 moduli ES per dominio (main.js è l'entry point)
├── src/
│   ├── auth.ts                 ← Auth.js v5: Google OAuth + username/password, sessioni JWT
│   ├── db/
│   │   ├── schema.ts           ← tabelle Auth.js + campaign (JSONB) + password_reset_token
│   │   └── index.ts            ← connessione Neon Postgres (drizzle-orm)
│   ├── lib/
│   │   ├── password.ts         ← hashing scrypt (stdlib, nessuna dipendenza)
│   │   ├── reset-token.ts      ← token di reset monouso (nel DB solo lo SHA-256)
│   │   ├── email.ts            ← invio via API REST di Resend (fetch, niente SDK)
│   │   └── rate-limit.ts       ← freno ai tentativi di login (in memoria)
│   └── app/
│       ├── page.tsx            ← landing: login, registrazione, lista campagne
│       ├── auth-actions.ts     ← server action: registrazione, login, recupero password
│       ├── reset/[token]/      ← pagina per impostare la nuova password
│       ├── play/[id]/route.ts  ← serve app.html iniettando window.__cloud = {id, state}
│       └── api/campaigns/…     ← REST: GET/POST lista, GET/PATCH/DELETE singola
├── drizzle.config.ts
└── .env.example
```

---

## L'app: com'è fatta dentro

`app.html` è il markup; il codice sta in `public/app/`, moduli ES divisi per dominio (`stato.js`, `mappa.js`, `pannello.js`, `mostri.js`, `tavolo.js`, …) con `main.js` come unico entry point — sempre senza framework e senza build step. Le parti principali:

**Modello dati.** Un nodo (bolla) ha: `id`, `title`, `type` (zona, luogo, quest, encounter, png, token, nota), `notes`, `img` (immagine in base64), `children` (nodi figli), `edges` (collegamenti tra i figli), coordinate `x`/`y`, `shape`, ed eventualmente `monster` (scheda mostro) o `bg` (sfondo del livello). Lo stato completo è `{root, checklist, players}`.

**Motore della mappa spaziale.** Il grosso del codice. Rendering SVG di bolle e strade, pan/zoom con viewBox (uno per livello, memorizzato), drag con snap magnetico e linee guida, creazione dei collegamenti trascinando dalle maniglie, ridimensionamento, selezione multipla con Ctrl e spostamento di gruppo. Le miniature dei livelli figli vengono disegnate dentro le bolle padre: dalla città vedi già com'è fatto ogni quartiere.

**Schede mostro (D&D 5e).** Dataset SRD 5.2.1 con 331 creature embedded (`window.SRD_MONSTERS`). Cerchi un mostro e la scheda si compila da sola. Ogni nemico ha PF individuali modificabili con +/− durante il combattimento; un gruppo mostra il conteggio "vivi / PF totali". Incluso un tiradadi.

**Le altre viste.** Diario Quest (aggrega le quest della campagna), Checklist, Giocatori.

**Qualità della vita.** Ricerca rapida (Ctrl+K), menu contestuale, duplicazione, scorciatoie da tastiera, campagne multiple. Su schermi piccoli il pannello dettaglio diventa un bottom sheet.

**Persistenza.** Salvataggio automatico con debounce. Senza `window.__cloud` scrive su `localStorage` (una chiave per campagna); in modalità cloud fa `PATCH` all'API con coalescing delle scritture (se un salvataggio è in volo, il successivo si accoda), e tiene comunque una copia in `localStorage` come cache offline.

---

## Come funziona il salvataggio cloud

Il meccanismo è volutamente semplice.

Una campagna è **una riga** nella tabella `campaign`, con una colonna `data` di tipo JSONB che contiene l'intero stato dell'app — esattamente lo stesso JSON che produce il pulsante Esporta. Niente scomposizione dell'albero ricorsivo in tabelle relazionali: Postgres gestisce il JSONB nativamente.

Il flusso:

1. La route `/play/[id]` legge la riga e serve `app.html` iniettando `<script>window.__cloud = {id, state}</script>` in `<head>`, **prima** di ogni script dell'app (l'ancora è il primo tag script inline, quello del tema).
2. All'avvio l'app vede `window.__cloud` e parte da quello stato invece che da `localStorage`.
3. Ogni `save()` fa `PATCH /api/campaigns/:id`. Se la rete manca, l'app mostra "Offline — salvato in locale" e non perde nulla.
4. Ogni route API verifica che la campagna appartenga all'utente autenticato.

Le immagini (mappe di sfondo, riferimenti) sono in base64 dentro il JSON. Funziona, ma fa crescere il peso: l'evoluzione naturale è spostarle su object storage (R2, S3) tenendo nel JSON solo gli URL. C'è un limite di 4 MB per salvataggio nell'API, allineato ai limiti di Vercel.

---

## Autenticazione

Due modi di entrare, entrambi verso lo stesso tipo di account:

- **Google OAuth** — nessuna password da ricordare, recupero gestito da Google.
- **Username + password** — per chi non ha (o non vuole usare) un account Google. L'email è **facoltativa** e serve solo a recuperare la password.

Dettagli implementativi che vale la pena conoscere:

- Le sessioni sono **JWT**, non su database: è un requisito del provider Credentials di Auth.js. Conseguenza: non si possono revocare lato server istantaneamente.
- Le password sono hashate con **scrypt** dalla stdlib di Node (`src/lib/password.ts`), senza dipendenze esterne. Serve `maxmem` esplicito: con N=32768 scrypt supera il limite di default di Node e fallirebbe.
- I token di reset sono **monouso, scadono in un'ora**, e nel database è salvato solo il loro **SHA-256**: se il DB trapela, i link già emessi restano inutilizzabili.
- La richiesta di reset risponde **sempre allo stesso modo**, che l'account esista o no: altrimenti sarebbe un modo per scoprire quali username sono registrati.

**Chi si registra senza email non ha modo di recuperare l'account.** L'avviso è mostrato nel form di registrazione.

---

## Setup

```bash
npm install
cp .env.example .env                   # poi compila i valori
npm run dev                            # http://localhost:3000
```

Per generare `AUTH_SECRET`:

```bash
node -e 'console.log(require("crypto").randomBytes(32).toString("base64"))'
```

> **Non usare `npx auth secret`**: il pacchetto npm chiamato `auth` è la CLI di *better-auth*, non di Auth.js, e stampa una variabile con il nome sbagliato (`BETTER_AUTH_SECRET`).

Servono: una connection string **Neon** pooled (`DATABASE_URL`), un **OAuth client Google** (ID + secret, con redirect URI `http://localhost:3000/api/auth/callback/google` per lo sviluppo), e `AUTH_SECRET`. Le variabili per le email (`RESEND_API_KEY`, `EMAIL_FROM`) sono facoltative: senza, il sito funziona lo stesso e il link di reset viene stampato nei log del server invece che spedito.

### Schema del database

Lo schema è versionato con **migrazioni SQL** in `drizzle/` (la `0000_iniziale` è il
baseline dello schema esistente). Per modificarlo:

```bash
# 1. modifica src/db/schema.ts
npm run db:generate    # 2. genera il file SQL in drizzle/ (committalo)
npm run db:migrate     # 3. applica al database di DATABASE_URL
```

`db:migrate` applica solo le migrazioni non ancora registrate in
`drizzle.__drizzle_migrations`, quindi è idempotente.

> ⚠️ **Non usare `drizzle-kit push`** (lo script `db:push` è stato rimosso): su questo schema propone di rimuovere il `NOT NULL` dalle chiavi primarie (errore 42P16) e di **troncare la tabella `user`**. Il flusso generate + migrate non ha questo problema perché parte dal baseline, non dall'introspezione del DB.

### Deploy

Deploy su Vercel importando il repo e incollando le variabili d'ambiente. Servono in più, rispetto allo sviluppo:

- `AUTH_URL` — l'URL pubblico (es. `https://runebog.app`); serve anche a costruire i link di recupero password.
- il redirect URI di produzione autorizzato nel client OAuth di Google.

Per le email di recupero serve un dominio verificato su Resend: con `onboarding@resend.dev` si può scrivere **solo** alla propria email. Il piano gratuito copre 3.000 email/mese (100/giorno), abbondanti per dei reset password.

Con i free tier di Vercel e Neon il costo resta zero fino a traffico significativo.

---

## Limiti noti

- Il **rate limiting è in memoria** (`src/lib/rate-limit.ts`), quindi vale per processo. In locale è esatto; su Vercel, con più istanze serverless, un attaccante distribuito lo aggira. Per una difesa vera serve uno store condiviso (Upstash/Redis).
- Le sessioni JWT non sono revocabili lato server.
- Le immagini in base64 dentro il JSON fanno crescere il peso delle campagne.

---

## Dati e licenze

Il **codice** di questo progetto è rilasciato sotto licenza **MIT** (vedi [LICENSE](LICENSE)).

I **dati dei mostri** NON sono coperti dalla MIT e restano sotto la loro licenza originale: le statistiche provengono dal **System Reference Document 5.2.1** di Wizards of the Coast, rilasciato sotto licenza **Creative Commons Attribution 4.0 (CC-BY-4.0)**. L'attribuzione richiesta è visibile in ogni scheda mostro. Se riusi questo progetto, la MIT ti copre per il codice ma devi mantenere l'attribuzione CC-BY per i dati SRD. I dati strutturati derivano dal progetto open source Open5e. Nomi e descrizioni dei mostri sono in inglese (Wizards ha pubblicato la SRD italiana solo in PDF, non come dati); tutti i campi restano modificabili a mano.

Alcune creature iconiche (Beholder, Mind Flayer) e nomi propri (Tiamat, Strahd) non fanno parte della SRD per scelta dell'editore e vanno ricreate a mano se servono.

---

## Roadmap possibile

- Recupero password via email in produzione (dominio verificato su Resend).
- Rate limiting su store condiviso.
- Condivisione delle campagne con i giocatori (colonna `share_token`, route in sola lettura), poi collaborazione in tempo reale.
- Immagini su object storage esterno invece che in base64.
- Ricerca incantesimi/oggetti magici oltre ai mostri.

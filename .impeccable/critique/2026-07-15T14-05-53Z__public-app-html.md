---
target: check UX complessivo (editor app.html, sito, dungeon)
total_score: 29
p0_count: 0
p1_count: 3
timestamp: 2026-07-15T14-05-53Z
slug: public-app-html
---
# Critique — Runebog (editor app.html + sito + dungeon)

Method: dual-agent (A: general-purpose design review · B: general-purpose detector) — 15 lug 2026

## Design Health Score — 29/40 (Good)

| # | Euristica | Punteggio | Problema chiave |
|---|-----------|:---:|-----------------|
| 1 | Visibilità dello stato | 3 | `#savestate` ottimo nei contenuti ma senza `aria-live`; nessun feedback durante compressione immagini |
| 2 | Sistema ↔ mondo reale | 4 | Linguaggio da tavolo perfetto (GS/PF/CA, "Rivela ai giocatori") |
| 3 | Controllo e libertà | 2 | **Nessun undo** in tutto l'editor; drag/nudge senza nemmeno conferma |
| 4 | Coerenza e standard | 3 | Bottone primario con ricetta diversa tra sito (10.9:1) e app (3.8:1); nomenclatura bolla/blocco che deriva |
| 5 | Prevenzione errori | 3 | Conferme sui distruttivi ok; nessun avviso proattivo sul limite 4 MB immagini |
| 6 | Riconoscimento vs memoria | 3 | Scorciatoie (F, Ctrl+D, frecce) non documentate da nessuna parte |
| 7 | Flessibilità ed efficienza | 3 | Buon set scorciatoie ma Ctrl+K muore nei campi di testo; niente undo |
| 8 | Estetica e minimalismo | 3 | Pannello dettagli sempre tutto aperto (~12 campi uniformi) |
| 9 | Recupero dagli errori | 3 | Messaggi umani, ma `alert()` nativi in stato.js:110 e tavolo.js:78,84 |
| 10 | Aiuto e documentazione | 2 | Micro-aiuti contestuali ottimi; zero onboarding, zero elenco scorciatoie |

## Verdetto anti-pattern

**LLM**: registro product superato con margine (identità torbiera/muschio/lanterna, token per ruolo, micro-decisioni artigianali). Landing non è slop ma timida: vende un editor visuale senza mostrarne un pixel. Un pattern bandito: side-stripe `border-left:4px` sulle card stanza del dungeon (dungeon.css:98) — ridondante col badge testuale.

**Detector**: 6 warning. Concordanza sul side-stripe (`side-tab`, dungeon.css:98). Solo-detector: `layout-transition` su barre HP (app.css:178,304 — impatto trascurabile), `flat-type-hierarchy` (app.html:90 — parziale FP, scala densa legittima per un tool; il gradino 18/19px è consolidabile). Falsi positivi: `broken-image` (img del lightbox, src impostato via JS), `border-accent-on-rounded` (swatch funzionale del menu contestuale).

**Overlay visivi**: non disponibili — browser condiviso tra i due assessment; nessun overlay iniettato.

## Impressione generale

Prodotto con identità vera e microcopy fuori dal comune; la coerenza tra architettura di sicurezza (whitelist server) e superficie (badge "SOLO TUE", glow oro sui rivelati) è rara. I tre P1 sono circoscritti e ad alto ritorno: undo, contrasto CTA app, tastiera sulla mappa.

## Cosa funziona

1. La condivisione come sistema di design (share.ts:80-123 + badge/glow/contatori in UI).
2. I temi come risposte a contesti d'uso reali (Pergamena per luce accesa/stampa, Alto contrasto dichiarato come esigenza) — 5 temi, un file, nomi per ruolo.
3. Empty state che insegnano l'interfaccia (app.html:89-93, vista Quest).

## Problemi prioritari

1. **[P1] Nessun undo nell'editor** — eliminazioni/spostamenti/testo irreversibili; Ctrl+Z non fa nulla. Lo stato è già un singolo JSON: snapshot-stack con debounce (cap 20) + Ctrl+Z in scorciatoie.js. → `/impeccable harden`
2. **[P1] CTA primaria dell'app sotto contrasto nei 3 temi scuri** — `.btn.primary` (app.css:61) `--bog` su `--fen-dim`: 3.82 Torbiera, 3.80 Cripta, 3.62 Brace (min 4.5). Allineare al sito: fondo `--fen`, testo `--bog`. → `/impeccable polish`
3. **[P1] Mappa inaccessibile da tastiera** — bolle SVG e palette senza tabindex/role/aria (mappa.js, app.html:70-80); frecce funzionano solo dopo selezione col mouse. → `/impeccable harden`
4. **[P2] Landing senza prodotto né porta senza account** — nessuna immagine/demo, nessun link a /app.html che già gira standalone (page.tsx:124-139). → `/impeccable onboard`
5. **[P2] Colori hardcoded che tradiscono Pergamena** — EDGE_TYPES (modello.js:24-28): strada #c9b98a su carta = 1.58:1; barra PF (mostri.js:68,127) 1.53:1; griglia (mappa.js:175) invisibile. Portare a token per tema. → `/impeccable colorize`

## Palette colori (approfondimento)

- themes.css è davvero l'unica sorgente: 24 token per ruolo, 5 temi. Cripta/Brace ereditano `--dg-trap`/`--dg-lair` implicitamente (da dichiarare).
- Contrasti misurati: body e muted passano ovunque; **placeholder `--parchment-mute` su `--peat-sunk` fallisce in tutti e 4 i temi atmosferici (3.6–4.0:1)** [P2]; CTA app fallisce nei 3 temi scuri [P1, sopra]; Alto contrasto passa ogni coppia misurata.
- Strategia: Restrained da manuale; semantica ricca e distinta (--ember/--lantern/--wisp/--arcane); colore quasi mai unico canale. Eccezione: status-dot da fare/in corso/fatto solo col colore (mappa.js:126) — variare forma o tooltip [P3].
- Fuori-token: EDGE_TYPES, barra PF, griglia (sopra); `#fff` in globals.css:160 corretto ma fragile (merita `--on-ember`); TOKEN_COLORS ok (sono dati).

## Persona red flags

**Alex (power user)**: Ctrl+K non funziona col focus nei campi (scorciatoie.js:13, verificato); Ctrl+Z inesistente; scorciatoie non documentate. In positivo: multi-selezione, duplica, nudge fine già presenti.

**Sam (accessibilità)**: flusso primario impossibile da tastiera; `#savestate` senza aria-live; tab dell'app senza role="tab"/aria-selected (il sito li fa giusti); placeholder e CTA sotto soglia. In positivo: :focus-visible reale, zoom non bloccato, tema Alto contrasto.

**Jordan (first-timer)**: compra a scatola chiusa (nessuna immagine/demo prima della registrazione); "mappe gerarchiche" è gergo senza visual; placeholder "Cerca… (Ctrl" troncato su mobile.

## Osservazioni minori

- favicon.ico 404 su app.html (manca link rel="icon").
- Nomenclatura: blocco/bolla — scegliere una parola.
- Topbar mobile su 3 righe con Esporta/Importa sempre visibili.
- alert() nativi dove il dialog custom esiste già.
- Mini-preview nei blocchi: gemma poco contrastata (opacity .85 su tratti 1.2px).
- Barra XP dungeon: superamento budget solo a colore, aggiungere % testuale.
- Poll del tavolo: JSON.stringify dell'intero stato ogni 5s (tavolo.js:114) — pesante con immagini base64.
- Detector: transizioni width sulle barre HP (micro), gradino tipografico 18/19px consolidabile.

## Domande da considerare

1. Lo stato è già un singolo JSON serializzabile: cosa vi trattiene dall'undo?
2. Perché la landing nasconde che l'app gira senza account? /app.html con i distretti demo è il miglior venditore, ed è già online.
3. Pergamena è "il tema da stampare" — ma la mappa si stampa bene? (strade 1.58:1, griglia invisibile)

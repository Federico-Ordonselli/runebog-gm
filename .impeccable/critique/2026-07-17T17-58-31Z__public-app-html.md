---
target: public/app.html (app editor)
total_score: 29
p0_count: 0
p1_count: 3
timestamp: 2026-07-17T17-58-31Z
slug: public-app-html
---
Method: dual-agent (A: design review · B: detector + browser evidence)

# Critique — Runebog GM, app editor (`public/app.html`) — 17 lug 2026

## Design Health Score

| # | Euristica | Voto | Problema chiave |
|---|-----------|------|-----------------|
| 1 | Visibilità stato sistema | 3 | Contorno oro "rivelato" sparisce nel tema Pergamena; manca stato "salvataggio in corso" |
| 2 | Corrispondenza sistema/mondo reale | 4 | n/a — lessico da tavolo impeccabile (bolle, segnalini, GS, "Al tavolo") |
| 3 | Controllo e libertà | 2 | Nessun redo (scorciatoie.js:24); Importa sostituisce la campagna senza conferma e azzera l'undo (esporta.js:17-27) |
| 4 | Coerenza e standard | 3 | `--gold` porta 4 semantiche: selezione, focus, "rivelato", "in corso" + warning savestate |
| 5 | Prevenzione errori | 2 | Import distruttivo senza conferma; debounce 700ms senza flush su pagehide/beforeunload (stato.js:355-360) |
| 6 | Riconoscimento vs ricordo | 3 | "Doppio clic per entrare" solo nell'hint 11px; su mobile `#plan-hint` è display:none (app.css:553) |
| 7 | Flessibilità ed efficienza | 3 | Niente redo né bulk sulla multi-selezione (pannello multi = solo Elimina); 31 Tab fino alla prima bolla |
| 8 | Estetica e minimalismo | 3 | Pannello ~9 blocchi sempre; TITOLO duplica l'h2; W/H numerici sopra le Note |
| 9 | Recupero errori | 3 | Salvataggio locale corrotto → `emptyState()` silenzioso (stato.js:199-201) |
| 10 | Aiuto e documentazione | 3 | Dialog "?" completo + campagna-tutorial; ma textarea tutorial tagliata e zero aiuto gestuale mobile |
| **Totale** | | **29/40** | **Good (28–35): base solida, aree deboli da sistemare** |

## Anti-Patterns Verdict

**LLM**: non è slop e non ci somiglia — grammatica riconoscibile, copy da giocatore vero, componenti con scopo dimostrabile. Un utente fluente in Linear/Notion si fida in 30 secondi. Gli inciampi sono "strani con scopo nascosto male": oro con 4 significati, pannello-anagrafica con W/H sopra le Note, tracker PF in fondo alla scheda, campo TITOLO che duplica l'h2.

**Detector (deterministico)**: 2 finding CLI, entrambi falsi positivi già noti (broken-image sul lightbox `app.html:147` — src assegnato via JS prima dell'apertura; border-accent su `.bar` `app.css:462` — è uno swatch di legenda). In pagina 14 finding: 11 low-contrast sono falsi positivi da fallback bianco del detector su testo SVG in tema scuro; 2 gpt-thin-border-wide-shadow advisory su popover nascosti (convenzionali); 2 text-overflow su etichette SVG probabile artefatto di misura. **Residuo reale: tiny-text 11px su `#plan-hint`** — converge con l'euristica 6; all-caps sui `summary` è stile deliberato da label di sezione.

**Overlay**: browser MCP non disponibile — nessun overlay visibile all'utente; evidenza raccolta headless (screenshot con overlay in scratchpad/assessB/app-detect.png), segnalato come fallback.

## Overall Impression

Terza critique, terzo 29/40 — ma la composizione è di nuovo diversa: i 5 priority del giro precedente sono chiusi tutti, e il punteggio è tenuto giù da un cluster nuovo, la **sicurezza del lavoro dell'utente** (import senza conferma, niente redo, niente flush alla chiusura) e dalla **gerarchia del pannello** che riflette il modello dati invece del valore delle decisioni. La singola opportunità più grande: trattare la sessione al tavolo come il momento primario — tracker PF in cima, statblock ripiegato.

## What's Working

1. **Onboarding per esplorazione** (stato.js:47-104): la campagna d'esempio dimostra gerarchia, i 3 stati, i tipi di collegamento, note DM ≠ giocatori e un tracker già popolato; "(esempio)" nel titolo dà il permesso di distruggere. Zero tour forzati.
2. **Fiducia progettata**: il tavolo filtra sul server e l'UI lo dice ("mai le tue note, mai i PF dei mostri"); il contorno oro è il registro visivo di cosa è già stato dato via.
3. **Accessibilità sostanziale**: aria-label composte sulle bolle, stato mai affidato al solo colore, ripristino del focus dopo ogni re-render, tema Alto contrasto reale; a zoom 200% l'app regge.

## Priority Issues

1. **[P1] Importa sovrascrive la campagna aperta senza conferma e azzera l'undo** (esporta.js:17-27). Due click e un file sbagliato = campagna persa; il pattern di rassicurazione di "Elimina campagna" manca dove il danno è identico. **Fix**: `openConfirm("Sostituire «{titolo}» ({n} bolle)…?")`; in standalone meglio importare in un nuovo slot. **Comando**: /impeccable harden.
2. **[P1] Nessun redo** (scorciatoie.js:24, stato.js:247-273). Un Ctrl+Z di troppo distrugge lavoro senza rimedio. **Fix**: stack redo simmetrico (lo stato è già una stringa JSON), Ctrl+Shift+Z/Ctrl+Y, voce nel menu ⋯. **Comando**: /impeccable harden.
3. **[P1] Il tracker PF è in fondo alla scheda encounter** (mostri.js:211, montato per ultimo in pannello.js:225). In sessione è il controllo primario e sta sotto ~700px di form; nello sheet mobile da 62dvh è peggio. **Fix**: foe-list subito sotto il titolo; statblock dentro `<details>` "Scheda mostro". **Comando**: /impeccable layout (o distill del pannello).
4. **[P2] Mobile: sheet al pointerdown + bersagli sotto soglia**. Sheet al 62% su ogni tocco di bolla anche durante un drag (mappa.js:623 → pannello.js:254-255); misurati sotto i 44px: stella quest 24×22, select stato 77×26, select campagna 120×29; palette scorrevole senza affordance (app.css:550-551). **Fix**: sheet solo su tap secco (pointerup con !moved), minimi touch estesi a select/input/q-star, dissolvenza sul bordo della palette. **Comando**: /impeccable adapt.
5. **[P2] Nessun flush del salvataggio alla chiusura** (stato.js:355-360; nessun beforeunload/pagehide nel repo). Debounce 700ms: scrivi una nota, chiudi la scheda, il lavoro muore in silenzio. **Fix**: doSave() su pagehide/visibilitychange→hidden; in cloud sendBeacon come ultima spiaggia. **Comando**: /impeccable harden.

## Persona Red Flags

**Alex (power user)**: contratto undo rotto a metà (niente Ctrl+Shift+Z); multi-selezione senza bulk stato/Rivela (rivelare 6 stanze = 12 click); race verificata nella ricerca (timer blur 150ms non cancellato, ricerca.js:93 — dropdown ucciso digitando veloce dopo Esc→Ctrl+K); risultati tagliati a 9 senza indicazione.

**Sam (screen reader/tastiera)**: 31 Tab fino alla prima bolla, nessuno skip-link; focus = stesso anello oro di selezione e shared-glow (indistinguibili sulla Locanda "rivelata"); lightbox inaccessibile da tastiera (apertura/chiusura solo click, tabIndex -1); bottoni zoom ＋/− e PF −/+ senza aria-label.

**Casey (mobile)**: tap su bolla → sheet 62% anche se volevi trascinare; palette mostra 3½ chip su 10 senza indizio di scroll; segnalini a ~12px alla prima apertura (mappa adattata a 390px); stella quest e select sotto soglia. Stato preservato bene: qui Casey è servito.

## Minor Observations

- Conferma eliminazione generica ("e tutto il suo contenuto?" → potrebbe contare gli elementi, mappa.js:898-900).
- Esc su `type=search` in Chrome svuota il campo oltre a chiudere il dropdown.
- A 1000px la palette va su 3 righe (~190px di tela persi).
- Textarea tutorial taglia la frase chiave sotto la piega.
- Su desktop >1400px l'undo non ha superficie visibile (solo scorciatoia).
- `switchCampaign` con slot corrotto → fallback muto su emptyState (stato.js:134-135).
- Savestate warning in Pergamena a 12px facilissimo da non notare.
- `#plan-hint` a 11px (tiny-text confermato dal detector) e display:none su mobile.

## Questions to Consider

1. Se la sessione al tavolo è il momento per cui il prodotto esiste, perché la sua UI (PF, azioni) è la parte più profonda dell'albero visivo? Un "modo sessione" che ribalta la priorità del pannello direbbe più di dieci feature nuove.
2. La palette da 10 elementi sempre visibile si guadagna i suoi pixel? Una palette da 4 (Bolla, Quest, Encounter, PNG) + "altro…" dimezzerebbe il costo della prima decisione.
3. Perché la larghezza in pixel di una locanda è un campo di prima classe mentre "Rivela ai giocatori" — l'azione con più conseguenze — è a metà scroll?

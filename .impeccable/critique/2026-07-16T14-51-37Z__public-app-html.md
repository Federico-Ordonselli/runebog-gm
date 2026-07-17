---
target: public/app.html (editor Runebog)
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-07-16T14-51-37Z
slug: public-app-html
---
# Critique — Runebog GM, editor `public/app.html` (16 lug 2026)

Method: dual-agent (A: sub-agente design review · B: sub-agente detector+browser)

## Design Health Score

| # | Euristica | Score | Issue chiave |
|---|-----------|-------|--------------|
| 1 | Visibilità dello stato del sistema | 3 | `#savestate` con aria-live e toni graduati; ma a 1440px "Salvato ✓" e l'h1 vanno a capo — la topbar non tiene la propria larghezza |
| 2 | Corrispondenza col mondo reale | 3 | Lessico D&D coerente; la doppia tassonomia Tipo×Forma resta un mapping implicito (la palette "Quartiere" crea un tipo Zona) |
| 3 | Controllo e libertà | 2 | Undo solo Ctrl+Z: niente redo, nessuna via touch. Su tablet/telefono un drag accidentale è irreversibile |
| 4 | Coerenza e standard | 3 | Grammatica dei controlli coerente; ctx-menu con pallini generici teal vs miniature della palette; confirm "Rimuovere giocatore?" con bottone "Elimina" |
| 5 | Prevenzione degli errori | 3 | Bolle vuote eliminate senza dialogo, avviso 4 MB all'80%, snap con guide; mancano conferme su rimozione nemico e voce checklist |
| 6 | Riconoscere anziché ricordare | 3 | Hint bar, badge Ctrl K, dialog "?"; ma su mobile `#plan-hint` è nascosto e doppio tap/long-press sono conoscenza segreta |
| 7 | Flessibilità ed efficienza | 3 | Scorciatoie ricche, multi-selezione, pan col tasto centrale; niente redo, collegamenti solo col drag della maniglia |
| 8 | Estetica e design minimalista | 3 | Pannello con progressive disclosure ben ragionata; ctx-menu bolla con 12 azioni piatte |
| 9 | Riconoscere e recuperare gli errori | 3 | Messaggi con rimedio ("alleggerisci le immagini", "Offline — salvato in locale") |
| 10 | Aiuto e documentazione | 3 | Dialog scorciatoie curato; ma promette "Cerca in tutta la campagna" mentre Ctrl+K matcha solo i titoli |
| **Totale** | | **29/40** | **Good — base solida, aree deboli da sistemare** |

## Anti-Patterns Verdict

**LLM assessment**: non è AI slop. Vocabolario dei componenti deliberato e documentato (ricetta chip condivisa, token per ruolo, stato mai affidato al solo colore), una sola animazione dietro `prefers-reduced-motion`. Tre inciampi da product slop: diario Quest con layout rotto, bottoni distruttivi indistinguibili a riposo, primo avvio con i dati personali dello sviluppatore.

**Scan deterministico (CLI)**: 3 finding warning su `public/app.html` + `public/app`:
- `broken-image` (app.html:144) — **falso positivo**: `#lightbox-img` riceve src a runtime (pannello.js:346), mai renderizzato senza.
- `border-accent-on-rounded` (app.css:443) — **falso positivo**: è lo swatch colore del ctx-menu (height:0, disegnato col border-top), non una card.
- `flat-type-hierarchy` (app.html:105) — scala 13/16/19px: densa da tool, il gradino unico è deliberato e commentato; heuristica, non difetto.

**Detector runtime (browser, pagina viva con campagna di test)**: 9 anti-pattern.
- `low-contrast` ×6 "su #ffffff" — **falsi positivi**: il tema è scuro, il detector ha risolto gli sfondi compositi al fallback bianco. La review A ha misurato i contrasti reali: 7.45:1 (testo dim), 5.05:1 (placeholder), 4.57:1 (caso peggiore in Pergamena) — tutti sopra soglia.
- `text-overflow` (36px) — **vero, corroborato**: la review A ha trovato indipendentemente overflow reali (h1 topbar a capo, "Salvato ✓" spezzato, input PF che tronca "24" in "2·", titoli quest collassati).
- `tiny-text` (11px), `all-caps-body` (31 caratteri), `gpt-thin-border-wide-shadow` ×2 — minori, vedi osservazioni.

**Overlay visivi**: browser headless (MCP Playwright non disponibile in questo ambiente) — nessun overlay visibile all'utente; l'evidenza è il segnale console del detector iniettato nella pagina viva.

## Overall Impression

Il punteggio è fermo a 29/40 rispetto alla baseline del 15 lug, ma la composizione è cambiata radicalmente: i problemi della baseline (contrasti, tastiera, undo assente, onboarding) sono risolti — oggi contrasti e accessibilità della mappa sono punti di forza. Il 29 di oggi è fatto di problemi nuovi e più profondi: un bug di layout che rompe la vista Quest, e una rete di sicurezza (undo) che non esiste sulla metà touch dei dispositivi target. La singola opportunità più grande: rendere l'annulla universale e visibile.

## What's Working

- **Stato mai affidato al solo colore**: "da fare" = anello vuoto, "in corso" = disco, "fatto" = disco+spunta (mappa.js:128); PF con numero sempre accanto alla barra. Accessibilità nel modello, non patch.
- **Contrasti da manuale su 5 temi**: misurati live (7.45:1 dim, 5.05:1 placeholder, focus ring 3.82:1, 10.89:1 su bottone primario); il detector che dice il contrario è un artefatto headless.
- **Tastiera sulla tela SVG fatta sul serio**: Tab sulle bolle, focus ripristinato dopo ogni re-render, aria-label ricchi, undo annunciato via role=status. Verificato live.

## Priority Issues

1. **[P1] Il diario Quest è rotto** — `input,textarea,select{width:100%}` (app.css:34) si applica a `.q-status` che non la sovrascrive (app.css:394): il select occupa la riga, il titolo collassa a una parola per riga. Vista principale illeggibile con >0 quest. Fix: `.q-status{width:auto}`. Corroborato dal detector (`text-overflow`). → `/impeccable polish`
2. **[P1] Undo inesistente su touch** — `undo()` agganciato solo a Ctrl+Z (scorciatoie.js:24). Su tablet al tavolo (il contesto per cui esistono i target 44px) un drag accidentale è irreversibile. Fix: voce "Annulla" nel menu ⋯ e/o bottone in topbar mobile quando lo stack non è vuoto. → `/impeccable harden`
3. **[P2] Il distruttivo non si vede finché non lo tocchi** — `.btn.danger` e `#ctx-menu .danger` stilati solo su `:hover` (app.css:69, 440): nel confirm "Elimina" e "Annulla" sono identici; su touch "Elimina campagna…" non è mai rosso. Fix: ember a riposo sul danger. → `/impeccable polish`
4. **[P2] Primo avvio = dati personali dello sviluppatore** — `defaultState()` (stato.js:42) spedisce "One-shot di compleanno — 11 luglio" e cinque "Distretto N" vuoti. Fix: esempio-tutorial vero (una zona compilata, una quest, un PNG) o canvas vuoto + empty state guidato (il pattern esiste già ed è buono). → `/impeccable onboard`
5. **[P2] La ricerca promette più di quel che fa** — il dialog "?" dice "Cerca in tutta la campagna", `ricerca.js:18` matcha solo `n.title`: note, giocatori, checklist e nemici invisibili a Ctrl+K. Fix: includere `notes`/`playerNotes` con snippet, o correggere la microcopy. → `/impeccable clarify` (copy) o `/impeccable harden` (feature)

## Persona Red Flags

**Alex (power user)**: nessun redo (Ctrl+Shift+Z non intercettato, cap 20 a senso unico); Ctrl+K cieco sulle note; il ctx-menu non cambia il *tipo* di bolla (solo stato e forma); "Ordina" ricolloca l'intero livello senza anteprima né conferma.

**Sam (tastiera/screen reader)**: lightbox vicolo cieco (si apre solo con click su `<img>` non focusabile, si chiude solo con click — niente Esc, niente focus trap, è un div non un `<dialog>`); collegamenti impossibili da tastiera (solo drag della maniglia); ctx-menu senza Shift+F10; risultati Ctrl+K senza pattern combobox (la voce evidenziata non viene annunciata). In positivo: Tab sulle bolle con aria-label ricchi, verificato live.

**Casey (mobile distratto)**: palette in scroll orizzontale con scrollbar nascosta — Torre, segnalini e Token fuori schermo senza alcun indizio che esistano; gesti chiave (doppio tap, long-press) senza hint sotto i 760px; "Elimina campagna…" mai rosso, a un tap da "Nuova campagna". In positivo: topbar due righe pulita, bottom sheet con ✕ sticky, target 44px reali.

## Minor Observations

- Input PF massimi troncato: `.hp-num input{width:34px}` mostra "2·" invece di "24" — illeggibile proprio nella card da combattimento.
- h1 topbar "Runebog GM · Diario del GM" ripete "GM" e va a capo a 1440px; `#savestate` senza `white-space:nowrap`.
- `.rune-ring` (app.css:101) è CSS morto: nessun modulo genera quell'elemento.
- Ctx-menu su tela: cinque forme con lo stesso pallino teal (informazione nulla, incoerente con le miniature della palette).
- Esc sul confirm lascia `confirmCb` appeso: innocuo oggi, trappola domani.
- "Rimuovere Aldric?" col bottone "Elimina": verbo incoerente.
- Dal detector runtime: testo body a 11px (`tiny-text`) e 31 caratteri uppercase (`all-caps-body` — presumibilmente il sottotitolo della topbar); due casi di bordo 1px + ombra 30px.

## Questions to Consider

1. Perché Tipo e Forma sono due campi separati? Se la forma implicasse il tipo (come già fa la palette in `addSpatialChild`), sparirebbero un select dal pannello e cinque voci dal ctx-menu.
2. Il tavolo è la feature identitaria — perché non esiste una modalità sessione? Al tavolo servono PF, tiro dadi, checklist e "rivela"; non forma, dimensioni, sfondo, generatore.
3. Se l'undo è l'unica rete di sicurezza (niente conferme su nemici e checklist, "Ordina" senza preavviso), può restare invisibile e legato a una combinazione che su metà dei dispositivi target non esiste?

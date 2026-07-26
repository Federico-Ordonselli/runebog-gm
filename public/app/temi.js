/* L'elenco dei temi, UNA volta sola.

   Erano tre: le <option> scritte a mano in app.html, l'array di validazione in
   main.js e la mappa id→etichetta del menu "⋯" in menu.js. A cinque temi si
   reggeva; a dodici no — e il modo in cui si sarebbe rotto è il peggiore, cioè
   in silenzio: un tema aggiunto al CSS e dimenticato in main.js non compare, e
   uno tolto dal CSS ma rimasto nell'elenco si sceglie e non fa niente.

   Qui c'è l'elenco e basta: nessun import, nessun DOM. Chi disegna un menu lo
   legge (main.js riempie il <select>, menu.js le voci del menu mobile), e
   l'unico posto che resta da tenere allineato a mano è public/themes.css, che
   è la sorgente dei colori — non si può leggere da JS senza chiedere al
   browser di risolvere trenta variabili per dodici temi.

   Il GRUPPO è il fondo, perché è il criterio con cui si sceglie davvero: la
   luce che si ha in stanza, non l'atmosfera. "Alto contrasto" sta per conto
   suo — è un'esigenza e non un'atmosfera, e in mezzo agli scuri sembrerebbe
   una variante estetica del nero. */

export const GRUPPI = ["Scuri", "Chiari", "Accessibilità"];

/* torbiera è il DEFAULT e va per primo: è l'unico senza data-theme in
   themes.css (nessun attributo = tema di base), e setTheme ci ricade quando
   il valore salvato non è più fra questi. */
export const TEMI = [
  {id:"torbiera",   label:"Torbiera",       gruppo:"Scuri"},
  {id:"cripta",     label:"Cripta",         gruppo:"Scuri"},
  {id:"brace",      label:"Brace",          gruppo:"Scuri"},
  {id:"taverna",    label:"Taverna",        gruppo:"Scuri"},
  {id:"sottosuolo", label:"Sottosuolo",     gruppo:"Scuri"},
  {id:"notturno",   label:"Notturno",       gruppo:"Scuri"},
  {id:"gilda",      label:"Gilda",          gruppo:"Scuri"},
  {id:"segnale",    label:"Segnale",        gruppo:"Scuri"},
  {id:"pergamena",  label:"Pergamena",      gruppo:"Chiari"},
  {id:"inchiostro", label:"Inchiostro",     gruppo:"Chiari"},
  {id:"alba",       label:"Alba",           gruppo:"Chiari"},
  {id:"contrasto",  label:"Alto contrasto", gruppo:"Accessibilità"},
];

export const TEMA_DEFAULT = TEMI[0].id;
export const temaValido = id => TEMI.some(t => t.id === id);
export const temiDelGruppo = g => TEMI.filter(t => t.gruppo === g);

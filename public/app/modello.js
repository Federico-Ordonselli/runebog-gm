/* Il vocabolario del modello dati: tipi di bolla, forme, collegamenti, e le
   utilità pure che ne derivano. Nessuna dipendenza: è la base di tutti i moduli. */

export const TYPES = {
  zona:      {label:"Zona",      color:"var(--fen)"},
  luogo:     {label:"Luogo",     color:"var(--teal)"},
  quest:     {label:"Quest",     color:"var(--gold)"},
  encounter: {label:"Encounter", color:"var(--ember)"},
  png:       {label:"PNG",       color:"var(--viola)"},
  token:     {label:"Token",     color:"var(--ink)"},
  nota:      {label:"Nota",      color:"var(--grigio)"}
};
/* La tavolozza del colore personalizzato. Sono hex letterali, non token di tema,
   e la differenza è voluta: il DEFAULT di una bolla segue il tema (vedi
   SHAPE_COLORS), la scelta esplicita del DM no — se coloro di rosso la torre del
   negromante, deve restare rossa anche passando a Pergamena. È anche un vincolo
   del server: safeColor() in src/lib/share.ts accetta solo #hex. */
export const NODE_COLORS = ["#8fd4a8","#6cc3c9","#d8b25a","#d0765a","#b393c9","#e8e3d8"];
export const STATUSES = ["", "da fare", "in corso", "fatto"];

export const SHAPES = {
  quartiere:{label:"Quartiere", w:200, h:140},
  edificio: {label:"Edificio",  w:140, h:80},
  stanza:   {label:"Stanza",    w:80,  h:80},
  piazza:   {label:"Piazza",    w:110, h:110, circle:true},
  torre:    {label:"Torre",     w:80,  h:80,  diamond:true}
};
/* Colore di default PER FORMA, non per tipo: prima edificio e stanza erano
   entrambi "luogo" e quindi lo stesso teal, così una pianta di dungeon era una
   distesa di rettangoli identici e la gerarchia si leggeva solo dalla taglia.
   Riusano i token esistenti invece di introdurne di nuovi — come già fanno i
   tipi di stanza del generatore — così i cinque temi restano coerenti da soli.
   Piazza e torre stanno lontane dai segnalini con cui si confonderebbero:
   la piazza è un cerchio come il PNG, quindi il violetto va alla torre.
   Le cinque tinte vanno scelte per SALTO DI TINTA, non di luminosità: stanza e
   piazza erano --track e --tunnel, cioè la stessa sabbia più chiara e più
   scura, e su una mappa affollata leggevano come un colore solo. La piazza
   passa quindi ad --dg-trap, l'arancio del generatore.
   Il vincolo vero è che la separazione regga in TUTTI E CINQUE i temi, non solo
   nel default: --gold per la stanza sembrava più squillante, ma in Brace
   l'accento --moss è rame (#d99a4e) e l'oro (#f0c05a) gli finisce addosso —
   quartiere, stanza e piazza diventavano tre aranci. --track resta sabbia
   pallida ovunque, e con l'arancio della piazza non si confonde. */
export const SHAPE_COLORS = {
  quartiere:"var(--fen)",
  edificio: "var(--teal)",
  stanza:   "var(--track)",
  piazza:   "var(--dg-trap)",
  torre:    "var(--viola)"
};
/* Gli stroke sono token di tema (in Pergamena i valori fissi sparivano, 1.6:1
   sulla carta) e vanno applicati via style="stroke:…", mai come attributo SVG
   stroke="…": gli attributi di presentazione non risolvono var(). */
export const EDGE_TYPES = {
  strada:   {label:"Strada",            stroke:"var(--track)",  dash:"",     w:5},
  bloccata: {label:"Strada bloccata",   stroke:"var(--ember)",  dash:"11 8", w:5, blocked:true},
  ponte:    {label:"Ponte",             stroke:"var(--wisp)",   dash:"",     w:7, double:true},
  /* dmOnly: il tavolo non lo vede MAI, nemmeno tra due bolle rivelate — a
     decidere è comunque il server (DM_ONLY_EDGES in src/lib/share.ts), questo
     flag serve solo a dirlo nel pannello. Se ne aggiungi uno, aggiorna entrambi. */
  segreto:  {label:"Passaggio segreto", stroke:"var(--arcane)", dash:"2 7",  w:3, dmOnly:true},
  tunnel:   {label:"Tunnel / fogna",    stroke:"var(--tunnel)", dash:"14 6", w:4}
};
export const MARKER_R = 15;
export const STATUS_COLORS = {"da fare":"var(--grigio)","in corso":"var(--gold)","fatto":"var(--fen)"};

export const uid = () => Math.random().toString(36).slice(2,10);
export const node = (title, type="zona") => ({id:uid(), title, type, status:"", notes:"", img:null, children:[], edges:[], x:null, y:null, shape:null});

export const isMarker = n => !(n.type==="zona" || n.type==="luogo");
export const defShape = n => n.type==="zona" ? "quartiere" : "edificio";

/* L'UNICO posto che decide di che colore è una bolla. Ordine: scelta esplicita
   del DM, poi il default della forma (bolle) o del tipo (segnalini). Prima questa
   logica era sparsa in quattro punti di mappa.js — con `col` calcolato una volta
   sola per tutti i rami — e il token era un caso speciale hardcodato. */
export function nodeColor(n){
  if(n.color) return n.color;
  if(n.type === "token") return "#e8e3d8";              // pedina senza colore: avorio
  if(isMarker(n)) return (TYPES[n.type] || TYPES.nota).color;
  return SHAPE_COLORS[n.shape || defShape(n)] || (TYPES[n.type] || TYPES.nota).color;
}
export function nodeBox(n){
  if(isMarker(n)) return {w:MARKER_R*2, h:MARKER_R*2};
  const s = SHAPES[n.shape] || SHAPES[defShape(n)];
  return {w:n.w||s.w, h:n.h||s.h};
}
export const nodeCenter = n => { const b=nodeBox(n); return {x:n.x+b.w/2, y:n.y+b.h/2}; };

export function escapeHtml(s){ return String(s??"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
export function escapeAttr(s){ return escapeHtml(s); }

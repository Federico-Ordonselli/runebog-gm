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
export const TOKEN_COLORS = ["#8fd4a8","#6cc3c9","#d8b25a","#d0765a","#b393c9","#e8e3d8"];
export const STATUSES = ["", "da fare", "in corso", "fatto"];

export const SHAPES = {
  quartiere:{label:"Quartiere", w:200, h:140},
  edificio: {label:"Edificio",  w:140, h:80},
  stanza:   {label:"Stanza",    w:80,  h:80},
  piazza:   {label:"Piazza",    w:110, h:110, circle:true},
  torre:    {label:"Torre",     w:80,  h:80,  diamond:true}
};
export const EDGE_TYPES = {
  strada:   {label:"Strada",            stroke:"#c9b98a", dash:"",     w:5},
  bloccata: {label:"Strada bloccata",   stroke:"#d0765a", dash:"11 8", w:5, blocked:true},
  ponte:    {label:"Ponte",             stroke:"#6cc3c9", dash:"",     w:7, double:true},
  segreto:  {label:"Passaggio segreto", stroke:"#b393c9", dash:"2 7",  w:3},
  tunnel:   {label:"Tunnel / fogna",    stroke:"#9a7d54", dash:"14 6", w:4}
};
export const MARKER_R = 15;
export const STATUS_COLORS = {"da fare":"var(--grigio)","in corso":"var(--gold)","fatto":"var(--fen)"};

export const uid = () => Math.random().toString(36).slice(2,10);
export const node = (title, type="zona") => ({id:uid(), title, type, status:"", notes:"", img:null, children:[], edges:[], x:null, y:null, shape:null});

export const isMarker = n => !(n.type==="zona" || n.type==="luogo");
export const defShape = n => n.type==="zona" ? "quartiere" : "edificio";
export function nodeBox(n){
  if(isMarker(n)) return {w:MARKER_R*2, h:MARKER_R*2};
  const s = SHAPES[n.shape] || SHAPES[defShape(n)];
  return {w:n.w||s.w, h:n.h||s.h};
}
export const nodeCenter = n => { const b=nodeBox(n); return {x:n.x+b.w/2, y:n.y+b.h/2}; };

export function escapeHtml(s){ return String(s??"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m])); }
export function escapeAttr(s){ return escapeHtml(s); }

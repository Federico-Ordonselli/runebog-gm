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

/* La maglia della pianta: 1 quadretto = 40px = 5 piedi = 1,5 m. Definita QUI e
   in nessun altro posto — battaglia.js la riesporta, il pattern #grid in
   mappa.js e DG_SCALE in dungeon.js la importano: è la stessa maglia vista da
   tre punti, e se divergessero pedine e stanze non combacerebbero più. */
export const CELL = 40;
export const snapGrid = v => Math.round(v / CELL) * CELL;

/* Le forme con grid:true sono piante, non simboli: posizione e dimensioni
   vivono in quadretti interi (scelta del 19 lug 2026: solo le forme
   architettoniche — quartieri, torri e segnalini restano liberi, e le bolle
   esistenti fuori scala non migrano: si agganciano al primo tocco). */
export const SHAPES = {
  // I default w/h NON si toccano: le bolle esistenti senza dimensioni esplicite
  // li ereditano via nodeBox, e cambiarli sarebbe la migrazione che si è deciso
  // di non fare. Le forme in scala nascono con dimensioni esplicite agganciate
  // (vedi addSpatialChild in mappa.js).
  quartiere:{label:"Quartiere", w:200, h:140},
  // walls: true = muri accesi di default, "opt" = muri possibili ma spenti (vedi wallShape)
  edificio: {label:"Edificio",  w:140, h:80,  grid:true, walls:"opt"},
  stanza:   {label:"Stanza",    w:80,  h:80,  grid:true, walls:true},
  piazza:   {label:"Piazza",    w:110, h:110, circle:true, grid:true},
  torre:    {label:"Torre",     w:80,  h:80,  diamond:true}
};
export const gridShape = n => !isMarker(n) && !!SHAPES[n.shape || defShape(n)]?.grid;

/* Sulla maglia ci si sta in due modi, perché sono due cose diverse.
   Una pianta è in scala e occupa quadretti interi: si aggancia l'ANGOLO, e la
   sua dimensione è un multiplo di cella (snapGrid).
   Un simbolo è più stretto di un quadretto e ci sta DENTRO: si aggancia il suo
   CENTRO al centro della cella (snapToCell). Agganciarne l'angolo lo lascerebbe
   a cavallo di quattro celle, sbilanciato di 5px verso l'alto a sinistra —
   "sta in un quadretto" sarebbe vero per le coordinate e falso per l'occhio, che
   è come stavano quest, encounter e PNG fino al 22 lug 2026.
   Fuori restano quartiere e torre: non sono in scala, sono etichette di
   territorio, e vivono libere come prima. */
export const onGrid = n => gridShape(n) || isMarker(n);
/* Il raggio disegnato del simbolo: la pedina è un filo più grande del segnalino
   (vedi il disco in mappa.js, che legge di qui). Il raggio decide l'aggancio,
   quindi dev'essere quello vero: con un raggio sbagliato il centro geometrico
   finisce nel quadretto giusto e il disco no. */
export const markerR = n => n.type === "token" ? MARKER_R + 1 : MARKER_R;
export function snapToCell(v, r = MARKER_R + 1){
  const centro = v + r;
  return Math.floor(centro / CELL) * CELL + CELL / 2 - r;
}
/* L'unico posto che sa dove va una bolla sulla maglia. Le coordinate arrivano
   da fuori (il puntatore, una griglia di riordino, la posizione attuale) perché
   i chiamanti le calcolano in modi diversi; a scegliere la regola è il nodo. */
export function snapNode(n, x = n.x, y = n.y){
  if(typeof x !== "number" || typeof y !== "number") return {x, y};
  if(gridShape(n)) return {x:snapGrid(x), y:snapGrid(y)};
  if(isMarker(n)){ const r = markerR(n); return {x:snapToCell(x, r), y:snapToCell(y, r)}; }
  return {x, y};
}

/* ---------------- muri ----------------
   Un muro non è un bordo più spesso: è il perimetro spezzato dalle porte. E le
   porte non sono un dato da tenere allineato — stanno dove un collegamento
   attraversa il muro, perché i collegamenti tra bolle SONO già le porte. Si
   ricalcolano a ogni disegno: spostare una stanza sposta la porta, cancellare
   un arco richiude il muro, e non esiste uno stato "porte" che possa divergere
   dalla mappa.

   Un passaggio segreto NON apre il muro: lascia un segno sopra la parete. Al
   tavolo quegli archi il server non li manda affatto (DM_ONLY_EDGES in
   src/lib/share.ts), quindi ai giocatori resta un muro pieno — nessun buco da
   nascondere lato client, che è la stessa regola di share.ts vista in geometria.

   Il default è acceso SOLO sulla stanza: una stanza senza muri non è una stanza,
   e sono le stanze che escono dal generatore di dungeon. Sull'edificio i muri
   esistono ma partono spenti, perché `edificio` è anche la forma implicita di
   ogni `luogo` senza shape (defShape): accenderli lì avrebbe messo pareti dentro
   ogni bolla già disegnata nelle campagne, cioè la migrazione a sorpresa che si
   è deciso di non fare per le forme in scala. La casella nel pannello li accende
   e spegne per bolla, e cambia solo il disegno: nessun dato si sposta. */
export const WALL = 6;            // spessore: a 40px = 1,5 m sono ~22 cm di parete
export const DOOR = CELL;         // un'apertura sta in un quadretto (1,5 m), come sui battlemap
/* Il muro corre DENTRO la forma: sul bordo, un tratto da 6px coprirebbe il
   contorno di .blk-shape, che è quello che porta la selezione (ring oro) e
   l'alone di "condiviso". */
const WALL_INSET = WALL/2 + 2;

export function wallShape(n){
  if(isMarker(n)) return false;
  const w = SHAPES[n.shape || defShape(n)]?.walls;
  if(!w) return false;
  return n.walls == null ? w === true : !!n.walls;   // la scelta del DM batte il default
}

/* Il rettangolo su cui corre il muro, in coordinate locali della bolla. */
export const wallBox = box => ({
  x: WALL_INSET, y: WALL_INSET,
  w: Math.max(2, box.w - 2*WALL_INSET),
  h: Math.max(2, box.h - 2*WALL_INSET)
});

/* Dove il raggio centro→centro buca il perimetro: lato e ascissa lungo quel lato.
   Metodo delle lastre — si esce dal lato che si incontra prima, cioè col t minore. */
export function wallOpening(wb, dx, dy){
  const tx = dx ? (wb.w/2)/Math.abs(dx) : Infinity;
  const ty = dy ? (wb.h/2)/Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  if(!isFinite(t)) return null;                       // due centri coincidenti
  return tx <= ty
    ? {side: dx>0 ? "e" : "o", pos: wb.h/2 + dy*t}
    : {side: dy>0 ? "s" : "n", pos: wb.w/2 + dx*t};
}

const sideLen = (wb,s) => (s==="n" || s==="s") ? wb.w : wb.h;
const sidePoint = (wb,s,u) =>
  s==="n" ? {x:wb.x+u,      y:wb.y}      :
  s==="s" ? {x:wb.x+u,      y:wb.y+wb.h} :
  s==="o" ? {x:wb.x,        y:wb.y+u}    :
            {x:wb.x+wb.w,   y:wb.y+u};

/* Gli estremi che toccano un angolo sporgono di mezzo spessore: con i capi piatti
   (butt, gli unici che non arrotondano le aperture) il perimetro avrebbe un
   intaglio quadrato in ogni angolo. Le aperture invece finiscono dove finiscono. */
function wallSeg(wb, s, a, b, len, esatto){
  const A = sidePoint(wb, s, (!esatto && a<=0)   ? a - WALL/2 : a);
  const B = sidePoint(wb, s, (!esatto && b>=len) ? b + WALL/2 : b);
  return {x1:A.x, y1:A.y, x2:B.x, y2:B.y};
}

/* Il perimetro spezzato: tratti pieni, soglie delle porte e segni dei passaggi
   segreti, tutti in coordinate locali della bolla. `openings` viene da
   wallOpening, uno per collegamento che tocca questa bolla. */
export function wallPlan(box, openings){
  const wb = wallBox(box);
  const runs = [], doors = [], marks = [];
  for(const s of ["n","e","s","o"]){
    const len = sideLen(wb, s);
    // gli angoli non si aprono: sono quelli che tengono su la stanza, e una porta
    // a cavallo di due lati non sarebbe disegnabile come un'apertura sola
    const bordo = Math.min(WALL, len/2);
    const gaps = [];
    for(const o of openings){
      if(o.side !== s || o.secret) continue;
      const w = Math.min(DOOR, len - 2*bordo);
      if(w <= 0) continue;                            // lato troppo corto: resta pieno
      const a = Math.max(bordo, Math.min(len - bordo - w, o.pos - w/2));
      gaps.push([a, a + w]);
    }
    // due porte sullo stesso tratto si fondono in un'apertura sola, sennò il
    // muro conserverebbe schegge di pochi pixel tra l'una e l'altra
    gaps.sort((p,q)=>p[0]-q[0]);
    const uniti = [];
    for(const g of gaps){
      const ultimo = uniti[uniti.length-1];
      if(ultimo && g[0] <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], g[1]);
      else uniti.push(g.slice());
    }
    let cur = 0;
    for(const [a,b] of uniti){
      if(a > cur) runs.push(wallSeg(wb, s, cur, a, len));
      doors.push(wallSeg(wb, s, a, b, len, true));
      cur = b;
    }
    if(cur < len) runs.push(wallSeg(wb, s, cur, len, len));
  }
  for(const o of openings){
    if(!o.secret) continue;
    const len = sideLen(wb, o.side), w = Math.min(DOOR*0.7, len);
    const a = Math.max(0, Math.min(len - w, o.pos - w/2));
    marks.push(wallSeg(wb, o.side, a, a + w, len, true));
  }
  return {runs, doors, marks};
}
/* ---------------- muri liberi ----------------
   Il perimetro qui sopra è DERIVATO: è il contorno di una bolla, e le porte
   stanno dove passa un collegamento. Serve a leggere una pianta a colpo
   d'occhio e per quello va benissimo — ma non ci si gioca sopra, perché è
   sempre un rettangolo, ed è il rettangolo di UNA bolla.

   Un muro libero è l'opposto: è un dato, un segmento che il DM posa dove vuole.
   Con questi si costruisce il perimetro vero — stanze a L, corridoi, tramezzi —
   e le porte sono i buchi che si lasciano fra un muro e l'altro. Nessuna delle
   due cose sostituisce l'altra e non si incrociano: il perimetro è la sagoma di
   una bolla, i muri liberi stanno sul PAVIMENTO di un livello, insieme alle
   bolle e ai segnalini, e vivono nel nodo di quel livello (`n.wallSegs`).
   Attenzione a non confonderlo con `n.walls`, che è il flag acceso/spento del
   perimetro: lo stesso nodo può avere tutti e due, e vogliono dire cose diverse.

   Corre sui BORDI dei quadretti, non dentro: su un battlemap le pedine stanno
   nelle celle e i muri fra una cella e l'altra. Per questo gli estremi si
   agganciano agli incroci della maglia (snapGrid) e non al centro della cella
   come i segnalini. */
export const WALL_MIN = 1;                  // meno di un quadretto non è un muro
export const WALL_MAX = 200;                // 300 m: oltre, è un JSON che mente
export const wallSegsOf = n => Array.isArray(n.wallSegs) ? n.wallSegs : [];
export const wallSegEnds = w => w.dir === "v"
  ? {x1:w.x, y1:w.y, x2:w.x,               y2:w.y + w.len*CELL}
  : {x1:w.x, y1:w.y, x2:w.x + w.len*CELL,  y2:w.y};
export const newWallSeg = (x, y, dir = "h", len = 2) =>
  ({id:uid(), x:snapGrid(x), y:snapGrid(y), dir, len});

/* Stira un muro dal capo che si sta trascinando: l'altro sta fermo, e l'asse lo
   decide lo spostamento più lungo. Così un gesto solo allunga E ruota — non
   serve un comando "ruota", che sarebbe un bottone per una cosa che il dito sta
   già dicendo. */
export function stretchWallSeg(w, capo, px, py){
  const e = wallSegEnds(w);
  const fx = capo === "a" ? e.x2 : e.x1, fy = capo === "a" ? e.y2 : e.y1;
  const dx = snapGrid(px) - fx, dy = snapGrid(py) - fy;
  const orizzontale = Math.abs(dx) >= Math.abs(dy);
  const d = orizzontale ? dx : dy;
  const len = Math.max(WALL_MIN, Math.min(WALL_MAX, Math.round(Math.abs(d) / CELL)));
  w.dir = orizzontale ? "h" : "v";
  w.len = len;
  w.x = orizzontale ? (d >= 0 ? fx : fx - len*CELL) : fx;
  w.y = orizzontale ? fy : (d >= 0 ? fy : fy - len*CELL);
}

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

/*
 * Bonifica dei campi che finiscono DENTRO attributi HTML (src, href, style, onclick,
 * data-block) nei render dell'app. escapeHtml protegge il testo, non questi: un `img`
 * come `x" onerror="…` o un `id` come `');…//` esce dall'attributo ed esegue codice.
 * Il tavolo è già coperto da share.ts sul server; qui il vettore è il JSON IMPORTATO
 * (Importa, o una bolla-dungeon altrui): forma valida ma contenuto ostile. Stesse
 * regole di share.ts, così client e server concordano su cosa è un valore sicuro.
 *
 * safeId è deterministico e idempotente: applicato sia a un id sia a ogni riferimento
 * che lo punta (edge.a/b, playerId, foe.*, order.*) lascia intatti i lookup `x.id===ref`
 * — gli id legittimi (uid() = [a-z0-9]{8}) passano immutati, gli ostili si spuntano
 * allo stesso modo su entrambi i lati. I valori (colore, immagine) non sono mai
 * riferimenti: se malformati si perdono, non si riparano.
 */
const safeId = v => String(v ?? "").replace(/[^\w-]/g, "");
const safeColor = v => /^#[0-9a-f]{3,8}$/i.test(String(v)) ? String(v) : null;
function safeUrl(v){
  const s = String(v ?? "");
  if(!/^(data:image\/|https?:\/\/)/i.test(s)) return null;   // niente javascript: e simili
  if(/[\s"'<>`]/.test(s)) return null;                       // niente uscite dall'attributo
  return s;
}

/* Le coordinate di un muro finiscono dentro attributi SVG (x1/y1/x2/y2) e, a
   differenza di quelle di una bolla, NON hanno una rete sotto: `ensureLayout`
   ricalcola una x che non sia un numero — un muro invece resterebbe quello che
   c'era nel JSON. Quindi qui si coerce, e ciò che non è un numero finito fa
   cadere il segmento invece di finire nel markup. `len` ha anche un tetto: un
   muro da un miliardo di quadretti non è un muro, è un modo di piantare il
   browser di chi apre la campagna. */
function safeWallSeg(w){
  if(!w || typeof w !== "object") return null;
  /* `Number(null)` è 0 e `Number("")` pure: senza il primo test un muro con una
     coordinata mancante non cadrebbe, verrebbe "corretto" a 0,0 — cioè
     ricomparirebbe nell'angolo del livello, che è un guasto travestito da dato.
     E capita per davvero: JSON.stringify scrive `null` al posto di un NaN. */
  const num = v => {
    if(v === null || v === undefined || v === "") return null;
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
  };
  const x = num(w.x), y = num(w.y), len = num(w.len);
  if(x === null || y === null || len === null) return null;
  return {
    id: safeId(w.id ?? uid()),
    x: snapGrid(x), y: snapGrid(y),
    dir: w.dir === "v" ? "v" : "h",
    len: Math.max(WALL_MIN, Math.min(WALL_MAX, Math.round(len)))
  };
}

/* Pulisce in-place l'intero albero dello stato. Un solo punto: la chiama migrateState,
   che ogni percorso di caricamento attraversa (import, cloud, localStorage). */
export function sanitizeState(s){
  if(!s || typeof s !== "object") return s;
  (function walk(n){
    if(!n || typeof n !== "object") return;
    if(n.id != null) n.id = safeId(n.id);
    if(n.color != null){ const c = safeColor(n.color); if(c) n.color = c; else delete n.color; }
    if(n.tokenColor != null){ const c = safeColor(n.tokenColor); if(c) n.tokenColor = c; else delete n.tokenColor; }
    if(n.img != null){ const u = safeUrl(n.img); if(u) n.img = u; else n.img = null; }
    if(n.bg && n.bg.img != null){ const u = safeUrl(n.bg.img); if(u) n.bg.img = u; else delete n.bg; }
    // riferimenti della pedina: stesso safeId dei nodi/foe puntati, così restano allineati
    if(n.playerId != null) n.playerId = safeId(n.playerId);
    if(n.foe){ n.foe.nodeId = safeId(n.foe.nodeId); n.foe.foeId = safeId(n.foe.foeId); }
    if(n.wallSegs != null) n.wallSegs = (Array.isArray(n.wallSegs) ? n.wallSegs : [])
      .map(safeWallSeg).filter(Boolean);
    for(const e of (Array.isArray(n.edges) ? n.edges : [])){
      if(e.id != null) e.id = safeId(e.id);
      e.a = safeId(e.a); e.b = safeId(e.b);
    }
    for(const f of (n.monster && Array.isArray(n.monster.foes) ? n.monster.foes : []))
      if(f.id != null) f.id = safeId(f.id);
    if(n.battle) for(const o of (Array.isArray(n.battle.order) ? n.battle.order : [])){
      if(o.id != null) o.id = safeId(o.id);
      if(o.playerId != null) o.playerId = safeId(o.playerId);
      if(o.nodeId != null) o.nodeId = safeId(o.nodeId);
      if(o.foeId != null) o.foeId = safeId(o.foeId);
    }
    for(const c of (Array.isArray(n.children) ? n.children : [])) walk(c);
  })(s.root);
  for(const p of (Array.isArray(s.players) ? s.players : []))
    if(p && p.id != null) p.id = safeId(p.id);
  return s;
}

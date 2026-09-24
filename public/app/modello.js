/* Il vocabolario del modello dati: tipi di bolla, forme, collegamenti, e le
   utilità pure che ne derivano. È la base di tutti i moduli, e l'UNICA cosa che
   importa è il contratto — che a sua volta non importa niente, quindi la
   chiusura transitiva resta un modulo solo e non ci sono cicli possibili.
   Quell'import esiste per una riga sola (`IMMAGINE_LOCALE`): la forma di un URL
   di immagine deve essere la stessa qui e nel validatore, sennò il client
   accetta ciò che il server rifiuta. Non è la porta per farne entrare altre. */
import { IMMAGINE_LOCALE, GRID_FORMS, GRID_LIMITS, CAMPAIGN_LIMITS, normalizzaCorridoi, normalizzaPercorso } from "./formato-campagna.js";

export const TYPES = {
  zona:      {label:"Zona",      color:"var(--fen)"},
  luogo:     {label:"Luogo",     color:"var(--teal)"},
  quest:     {label:"Quest",     color:"var(--gold)"},
  encounter: {label:"Encounter", color:"var(--ember)"},
  png:       {label:"PNG",       color:"var(--viola)"},
  token:     {label:"Token",     color:"var(--ink)"},
  nota:      {label:"Nota",      color:"var(--grigio)"},
  testo:     {label:"Testo",     color:"var(--ink)"}
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
/* Il lato di un quadretto in metri, NUMERO e non stringa: il righello lo
   moltiplica per contare i metri di una distanza, il tabellone d'iniziativa lo
   mostra. La formattazione con unità ("1,5 m") sta dove serve mostrarla, non
   qui — un numero non porta la sua etichetta, sennò non lo si può sommare. */
export const METRI_PER_CELLA = 1.5;

/* ---------------- la maglia di un livello ----------------
   Dal 22 set 2026 CELL e METRI_PER_CELLA sono il DEFAULT, non la maglia: ogni
   livello può dichiararne una sua in `n.griglia` — {forma, cella, metri} —
   perché un mondo si misura in esagoni da 9 km e il dungeon che ci sta dentro
   in quadretti da 1,5 m. Vive sul nodo del livello come lo sfondo e i muri
   liberi, cioè accanto alle cose che misura. Assente = la maglia storica, e
   per questo nessuna campagna va migrata.

   `grigliaDi` è l'UNICO modo di leggerla: normalizza e ripiega sul default,
   quindi a valle nessuno deve chiedersi se il campo c'è o se è sano. Chi
   aggancia o misura qualcosa riceve la maglia del livello dove quella cosa
   sta — non di quello aperto: un segnalino si centra nella cella del proprio
   genitore anche quando lo migra `migrateState`, che non apre niente.

   Negli esagoni `cella` è la distanza fra i centri di due esagoni vicini (la
   larghezza da lato a lato), cioè il passo con cui si conta: un esagono =
   `metri`. La matematica è quella delle coordinate assiali, fatta una volta
   per la punta in alto; il lato piatto in alto è la stessa maglia trasposta
   (x↔y), e si ottiene scambiando gli assi all'ingresso e all'uscita. */
export const GRIGLIE = {
  quadrata:     {label:"Quadrata",                      unita:["quadretto","quadretti"], sigla:"q",  glifo:"▢"},
  "hex-punta":  {label:"Esagoni, punta in alto",       unita:["esagono","esagoni"],     sigla:"es", glifo:"⬡", hex:true},
  "hex-piatto": {label:"Esagoni, lato piatto in alto", unita:["esagono","esagoni"],     sigla:"es", glifo:"⬡", hex:true},
};
export { GRID_FORMS, GRID_LIMITS };
export const GRIGLIA_BASE = Object.freeze({forma:"quadrata", cella:CELL, metri:METRI_PER_CELLA});
const numeroFra = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
/* La bonifica del campo: forma dichiarata e numeri nei limiti del contratto,
   oppure niente — una maglia storta non si "corregge" a metà, si torna al
   default. Si scrivono solo le tre chiavi: il campo finisce in `style` e in
   attributi SVG attraverso i numeri che ne escono. */
export function safeGriglia(g){
  if(!g || typeof g !== "object" || !GRIGLIE[g.forma]) return null;
  const L = GRID_LIMITS;
  return {
    forma: g.forma,
    cella: numeroFra(g.cella, L.cellaMin, L.cellaMax) ? g.cella : CELL,
    metri: numeroFra(g.metri, L.metriMin, L.metriMax) ? g.metri : METRI_PER_CELLA,
  };
}
export const grigliaDi = n => (n && safeGriglia(n.griglia)) || GRIGLIA_BASE;
export const isHex = g => !!GRIGLIE[g?.forma]?.hex;
/* Il nome della cella con il suo numero: "1 quadretto", "3 esagoni". */
export const nomeCelle = (g, n) => {
  const u = (GRIGLIE[g?.forma] || GRIGLIE.quadrata).unita;
  return `${n.toLocaleString("it-IT",{maximumFractionDigits:2})} ${n === 1 ? u[0] : u[1]}`;
};
/* I metri all'italiana, in km sopra il migliaio: un esagono di viaggio da 9000 m
   si legge "9 km", non "9.000 m". */
export function formattaMetri(m){
  const km = Math.abs(m) >= 1000;
  return `${(km ? m/1000 : m).toLocaleString("it-IT",{maximumFractionDigits:2})} ${km ? "km" : "m"}`;
}

/* Sulla maglia quadrata un punto si aggancia agli INCROCI (piante, muri); negli
   esagoni gli incroci non formano una maglia ortogonale, quindi piante e muri
   restano liberi e il punto torna com'è. */
export const snapGrid = (v, g = GRIGLIA_BASE) => isHex(g) ? v : Math.round(v / g.cella) * g.cella;

const R3 = Math.sqrt(3);
const hexPiatto = g => g.forma === "hex-piatto";
function arrotondaCubo(q, r){
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if(dq > dr && dq > ds) rq = -rr - rs;
  else if(dr > ds) rr = -rq - rs;
  return {q:rq + 0, r:rr + 0};                   // + 0: niente -0, che deepEqual e i JSON leggono diversi
}
/* L'esagono che contiene il punto, in coordinate assiali. */
export function cellaEsagono(g, x, y){
  const [X, Y] = hexPiatto(g) ? [y, x] : [x, y];
  const r = Y / (g.cella * R3 / 2);
  return arrotondaCubo(X / g.cella - r / 2, r);
}
export function centroEsagono(g, {q, r}){
  const X = g.cella * (q + r / 2), Y = g.cella * R3 / 2 * r;
  return hexPiatto(g) ? {x:Y, y:X} : {x:X, y:Y};
}
/* Il centro della cella che contiene il punto, qualunque sia la forma. */
export function centroCella(g, x, y){
  if(isHex(g)) return centroEsagono(g, cellaEsagono(g, x, y));
  const c = g.cella;
  return {x:Math.floor(x / c) * c + c / 2, y:Math.floor(y / c) * c + c / 2};
}
/* Dove si aggancia un punto preso col puntatore dagli strumenti (righello, aree
   d'effetto): incroci sulla maglia quadrata, come i muri; centri negli
   esagoni, perché lì è dal centro di un esagono all'altro che si conta. */
export const puntoMaglia = (g, p) => isHex(g) ? centroCella(g, p.x, p.y) : {x:snapGrid(p.x, g), y:snapGrid(p.y, g)};
/* Quante celle fra due punti, contate come si contano sulla maglia: negli
   esagoni è la distanza assiale fra le due celle, ed è intera per costruzione.
   Sulla maglia quadrata torna null — lì il righello ha i suoi metodi per la
   diagonale (distanzaCelle in strumenti/righello.js). */
export function celleFra(g, a, b){
  if(!isHex(g)) return null;
  const p = cellaEsagono(g, a.x, a.y), q = cellaEsagono(g, b.x, b.y);
  const dq = p.q - q.q, dr = p.r - q.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}
/* Il vettore di maglia più vicino a uno spostamento: spostando un gruppo di
   tanto, chi era agganciato resta agganciato. Negli esagoni i vettori di
   maglia sono i centri stessi, perché l'origine è un centro. */
export const vettoreMaglia = (g, dx, dy) => isHex(g)
  ? centroEsagono(g, cellaEsagono(g, dx, dy))
  : {x:snapGrid(dx, g), y:snapGrid(dy, g)};
/* Un passo di freccia: un lato sulla maglia quadrata, il vicino negli esagoni.
   In verticale (punta in alto) o in orizzontale (lato piatto) i vicini sono
   due, sfalsati di mezza cella: si sceglie in base alla parità della riga di
   partenza, così su-giù e giù-su tornano nello stesso esagono invece di
   scivolare di lato a ogni battuta. È sempre un vettore di maglia, quindi un
   gruppo si sposta rigido e nessuno esce dal proprio centro. */
const DIREZIONI = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1]};
export function passoMaglia(g, dir, da = {x:0, y:0}){
  const [ux, uy] = DIREZIONI[dir] || [0, 0];
  if(!isHex(g)) return {dx:ux * g.cella, dy:uy * g.cella};
  const c = cellaEsagono(g, da.x, da.y), o = centroEsagono(g, c);
  const verso = ((c.r % 2) + 2) % 2 === 0 ? 1 : -1;
  let meglio = null;
  for(const [dq, dr] of [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]]){
    const p = centroEsagono(g, {q:c.q + dq, r:c.r + dr});
    const vx = p.x - o.x, vy = p.y - o.y;
    const allineato = (vx * ux + vy * uy) / g.cella;
    const lato = (ux ? vy : vx) * verso;
    if(!meglio || allineato > meglio.a + 1e-6 || (Math.abs(allineato - meglio.a) <= 1e-6 && lato > meglio.l))
      meglio = {a:allineato, l:lato, dx:vx, dy:vy};
  }
  return {dx:meglio.dx, dy:meglio.dy};
}
/* Il disegno della maglia: il tassello di un <pattern> SVG e il percorso che ci
   sta dentro. Negli esagoni ogni esagono disegna tre dei suoi sei lati (i due in
   alto e quello a destra, per la punta in alto): gli altri tre li disegnano i
   vicini, così ogni lato è tracciato UNA volta — due volte, con un tratto
   semitrasparente, si vedrebbe più scuro. Il tassello ritaglia ciò che esce, e
   per questo gli esagoni si elencano anche un giro fuori dal tassello. */
export function tasselloMaglia(g){
  const s = g.cella, f = v => Math.round(v * 100) / 100;
  if(!isHex(g)) return {w:s, h:s, d:`M${s} 0H0V${s}`};
  const h = s * R3 / 2, R = s / R3;
  const lati = [];
  for(let j = -1; j <= 3; j++) for(let i = -1; i <= 2; i++){
    const cx = i * s + (((j % 2) + 2) % 2 ? s / 2 : 0), cy = j * h;
    const pt = [[cx - s/2, cy - R/2], [cx, cy - R], [cx + s/2, cy - R/2], [cx + s/2, cy + R/2]]
      .map(([x, y]) => hexPiatto(g) ? [y, x] : [x, y]);
    lati.push("M" + pt.map(([x, y]) => `${f(x)} ${f(y)}`).join("L"));
  }
  return hexPiatto(g) ? {w:f(2 * h), h:s, d:lati.join("")} : {w:s, h:f(2 * h), d:lati.join("")};
}

/* Le forme con grid:true sono piante, non simboli: posizione e dimensioni
   vivono in quadretti interi (scelta del 19 lug 2026: solo le forme
   architettoniche — quartieri, torri e segnalini restano liberi, e le bolle
   esistenti fuori scala non migrano: si agganciano al primo tocco). */
export const SHAPES = {
  // I default w/h NON si toccano: le bolle esistenti senza dimensioni esplicite
  // li ereditano via nodeBox, e cambiarli sarebbe la migrazione che si è deciso
  // di non fare. Le forme in scala nascono con dimensioni esplicite agganciate
  // (vedi addSpatialChild in mappa.js).
  //
  // territorio:true = un pezzo di mondo, non una costruzione. Sono elencati dal
  // più largo al più stretto perché quest'ordine SI VEDE: la palette e i due
  // menu a tendina della forma leggono Object.entries(SHAPES), e messi così
  // dichiarano una scala invece di un elenco. Nessuno di loro sta sulla maglia
  // (una nazione non si misura in quadretti da 1,5 m) né ha muri.
  //
  // disegno = la sagoma con cui il territorio si disegna, al posto del
  // rettangolo. È un campo e non un confronto letterale dentro mappa.js perché
  // quella strada l'abbiamo già percorsa una volta (shape==="quartiere" per
  // decidere zona/luogo): il renderer dispaccia su disegno e non sa i nomi.
  // Il colore invece resta UNO solo per tutti e cinque (vedi SHAPE_COLORS): la
  // sagoma non costa token, regge in tutti i temi e si legge in monocromia.
  //
  // dentro = [larghezza, altezza] del rettangolo INSCRITTO nella sagoma, in
  // frazioni del riquadro e centrato su di esso: dove sta il contenuto della
  // bolla (contentBox qui sotto). Serve solo alle sagome inscritte, cioè quelle
  // che lasciano vuoti gli angoli del riquadro — senza, titolo, anteprima dei
  // figli e conteggio restano impaginati sul riquadro e sbordano dal contorno.
  // È lo stesso campo-invece-di-confronto di `disegno`, per la stessa ragione:
  // questa è la seconda volta che la sagoma serve a un posto diverso dal
  // renderer, e la terza sarebbe un `if` sul nome in un terzo file.
  // I numeri sono GEOMETRIA e non gusto: ellisse 1/√2 per lato (l'area va al
  // 50%), rombo 1/2 (al 25%). Per la costa non c'è una formula — sono misurati
  // sulla curva vera con una ricerca del rettangolo di area massima, e il
  // rettangolo libero esce centrato in (0,494, 0,515), cioè praticamente sul
  // centro: per questo bastano due numeri e non serve dichiarare anche dove sta.
  mondo:      {label:"Mondo",      w:440, h:300, territorio:true, disegno:"globo",      dentro:[.707,.707]},
  continente: {label:"Continente", w:380, h:260, territorio:true, disegno:"costa",      dentro:[.66,.52]},
  // Nazione e regione disegnano il rettangolo pieno (il confine e il tratteggio
  // ci corrono sopra), quindi il loro contenuto sta sul riquadro come prima.
  nazione:    {label:"Nazione",    w:320, h:220, territorio:true, disegno:"confine"},
  regione:    {label:"Regione",    w:260, h:180, territorio:true, disegno:"tratteggio"},
  // Il quartiere non ha disegno: è il rettangolo pieno, cioè il capolinea
  // "bordi disegnati" della scala — e la forma che ereditano per default tutte
  // le zone senza shape (defShape), che non devono cambiare aspetto da sole.
  quartiere:  {label:"Quartiere",  w:200, h:140, territorio:true},
  // walls: true = muri accesi di default, "opt" = muri possibili ma spenti (vedi wallShape)
  edificio: {label:"Edificio",  w:140, h:80,  grid:true, walls:"opt"},
  stanza:   {label:"Stanza",    w:80,  h:80,  grid:true, walls:true},
  piazza:   {label:"Piazza",    w:110, h:110, circle:true, grid:true, dentro:[.707,.707]},
  torre:    {label:"Torre",     w:80,  h:80,  diamond:true, dentro:[.5,.5]}
};

/* La scala: che cosa contiene che cosa, dal più largo al più stretto. UNA lista
   sola, letta nei due versi, perché "cosa c'è sopra?" e "cosa nasce dentro?"
   sono la stessa domanda — e due elenchi si sarebbero contraddetti al primo
   gradino aggiunto.

   Le due risposte non si CHIEDONO a nessuno, ed è il punto: lo zoom indietro
   (zoomOut in stato.js) sa già che sopra una regione c'è una nazione, e il
   doppio clic sulla tela sa già che dentro un mondo si fanno continenti, non
   stanze. Un menu con sette voci sarebbe una domanda a cui si può rispondere
   male, per una cosa che la forma del livello dice già.

   Comprende anche edificio e stanza: sotto un quartiere si costruisce, e la
   catena non ha ragione di interrompersi dove cambia il genere di cosa.
   Piazza e torre restano fuori: non sono un gradino, sono due modi di essere
   un luogo, e infilarle nella lista avrebbe voluto dire scegliere se una
   piazza sta sopra o sotto una torre — che non vuol dire niente. */
export const SCALA = ["mondo","continente","nazione","regione","quartiere","edificio","stanza"];
export function scalaSopra(shape){
  const i = SCALA.indexOf(shape);
  // Fuori dalla scala (una piazza, una torre, una radice importata strana):
  // sopra un posto ci sta il primo territorio, non il vuoto.
  if(i < 0) return "quartiere";
  return i === 0 ? null : SCALA[i-1];   // sopra il mondo non c'è niente: è il capolinea
}
export function scalaDentro(shape){
  const i = SCALA.indexOf(shape);
  // Sotto la stanza non si scende, e dentro una piazza o una torre si fanno
  // stanze: è quello che il doppio clic faceva già prima della scala.
  if(i < 0) return "stanza";
  return SCALA[i+1] || "stanza";
}
/* Il tipo di bolla che nasce da una forma. Era il confronto letterale
   `shape==="quartiere"` dentro addSpatialChild: con cinque territori doveva
   smettere di essere una stringa scritta a mano in un altro modulo. */
export const shapeType = shape => SHAPES[shape]?.territorio ? "zona" : "luogo";
export const gridShape = n => !isMarker(n) && !isTesto(n) && !!SHAPES[n.shape || defShape(n)]?.grid;

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
export const onGrid = (n, g = GRIGLIA_BASE) => inScala(n, g) || isMarker(n);
/* Una pianta sta in quadretti interi solo sulla maglia quadrata: negli esagoni
   una stanza rettangolare non ha una maglia su cui appoggiarsi, e resta libera. */
export const inScala = (n, g = GRIGLIA_BASE) => gridShape(n) && !isHex(g);
/* Il raggio disegnato del simbolo: la pedina è un filo più grande del segnalino
   (vedi il disco in mappa.js, che legge di qui). Il raggio decide l'aggancio,
   quindi dev'essere quello vero: con un raggio sbagliato il centro geometrico
   finisce nel quadretto giusto e il disco no. */
export const markerR = n => n.type === "token" ? MARKER_R + 1 : MARKER_R;
export function snapToCell(v, r = MARKER_R + 1){
  const centro = v + r;
  return Math.floor(centro / CELL) * CELL + CELL / 2 - r;
}
/* Il segnalino col centro nel centro della cella, su qualunque maglia: le
   coordinate di un simbolo sono l'angolo del suo riquadro, quindi si passa dal
   centro e si torna indietro del raggio. Sulla maglia quadrata di default è
   esattamente snapToCell sui due assi. */
export function snapMarker(g, x, y, r = MARKER_R + 1){
  const c = centroCella(g, x + r, y + r);
  return {x:c.x - r, y:c.y - r};
}
/* L'unico posto che sa dove va una bolla sulla maglia. Le coordinate arrivano
   da fuori (il puntatore, una griglia di riordino, la posizione attuale) perché
   i chiamanti le calcolano in modi diversi; a scegliere la regola è il nodo. */
export function snapNode(n, x = n.x, y = n.y, g = GRIGLIA_BASE){
  if(typeof x !== "number" || typeof y !== "number") return {x, y};
  if(inScala(n, g)) return {x:snapGrid(x, g), y:snapGrid(y, g)};
  if(isMarker(n)) return snapMarker(g, x, y, markerR(n));
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
  if(isMarker(n) || isTesto(n)) return false;
  const w = SHAPES[n.shape || defShape(n)]?.walls;
  if(!w) return false;
  return n.walls == null ? w === true : !!n.walls;   // la scelta del DM batte il default
}

/* Il riquadro del CONTENUTO di una bolla, in coordinate locali: dove stanno il
   titolo, l'anteprima dei figli e il conteggio `◦ N`. Per una sagoma piena
   (rettangolo, e ogni bolla murata, che il rettangolo lo ridiventa) è il
   riquadro stesso; per una sagoma inscritta è il rettangolo che ci sta dentro,
   dichiarato da `dentro` in SHAPES.

   Non è una rifinitura: dal 26 lug 2026 mondo, continente, piazza e torre hanno
   un contorno inscritto nel riquadro, e tutto ciò che stava negli angoli usciva
   dalla figura — la bolla si leggeva come se il contenuto le stesse traboccando
   (misurato: fino a 8 angoli su 16 dell'anteprima fuori sagoma, e il titolo di
   una torre fuori per intero). Il prezzo dichiarato è che il contenuto si vede
   più piccolo: è la direzione scelta, perché una bolla dentro una bolla è un
   indizio e non una mappa da leggere. */
export function contentBox(n, box){
  // Muri accesi = la sagoma torna un rettangolo pieno (vedi shapeMarkup): il
  // contenuto riprende il riquadro intero, sennò si stringerebbe per una
  // silhouette che in quel momento nessuno sta disegnando.
  const s = wallShape(n) ? null : SHAPES[n.shape || defShape(n)];
  const [fw, fh] = s?.dentro || [1, 1];
  return {x: box.w*(1-fw)/2, y: box.h*(1-fh)/2, w: box.w*fw, h: box.h*fh};
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
      if(o.side !== s || o.dmOnly) continue;
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
    if(!o.dmOnly) continue;
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
/* `len` è in celle della maglia del livello su cui il muro sta: il muro è
   fatto di lati di cella, e con una maglia da 60px un muro da due è lungo 120.
   Negli esagoni non c'è un incrocio ortogonale dove appoggiarlo: la posizione
   resta libera e la lunghezza si conta comunque in celle, così "3 esagoni" di
   muro è quanto ci si aspetta di leggere accanto al righello. */
export const wallSegEnds = (w, g = GRIGLIA_BASE) => w.dir === "v"
  ? {x1:w.x, y1:w.y, x2:w.x,                  y2:w.y + w.len*g.cella}
  : {x1:w.x, y1:w.y, x2:w.x + w.len*g.cella,  y2:w.y};
export const newWallSeg = (x, y, dir = "h", len = 2, g = GRIGLIA_BASE) =>
  ({id:uid(), x:snapGrid(x, g), y:snapGrid(y, g), dir, len});

/* Una porta è un muro DICHIARATO porta, non un buco fra due muri. Il buco resta
   il modo di fare un varco, e va benissimo per un'arcata o uno sfondamento —
   ma non sa dire "qui c'è un battente" né "è chiusa a chiave", e al tavolo un
   varco e una porta si leggono uguali.

   Porta = SEGMENTO INTERO, non una posizione dentro il segmento: il perimetro
   si costruisce a quadretti, quindi la porta è il quadretto in cui sta. Darle
   un'ascissa propria dentro il muro sarebbe un secondo sistema di coordinate
   per una cosa che la maglia dice già, e due sistemi divergono.

   dmOnly: come per i collegamenti (EDGE_TYPES.segreto) il flag serve solo a
   dirlo nel pannello — a decidere è il server (DM_ONLY_DOORS in
   src/lib/share.ts), e i due elenchi vanno tenuti allineati. */
export const DOOR_TYPES = {
  aperta:  {label:"Porta aperta"},
  chiusa:  {label:"Porta chiusa"},
  chiave:  {label:"Chiusa a chiave"},
  segreta: {label:"Porta segreta", dmOnly:true},
  /* Le altre aperture del dungeon (24 set 2026): stanno qui e non in un
     elenco loro perché sono la stessa cosa — un pezzo di muro che dichiara
     cosa c'è nel vano — e passano dagli stessi tre posti (contratto,
     share.ts, disegno). Varco: si passa, niente battente (l'arcata che
     prima si faceva solo lasciando un buco, e al tavolo non si leggeva).
     Finestra: si vede, non si passa. Grata: si vede, non si passa finché
     non la si alza. */
  varco:    {label:"Varco"},
  finestra: {label:"Finestra"},
  grata:    {label:"Grata"}
};
export const doorKind = w => DOOR_TYPES[w.porta] ? w.porta : null;
/* Nome di un muro in una riga: è il titolo del pannello, l'etichetta del menu
   contestuale e la voce che un lettore di schermo annuncia. Uno solo, sennò
   diventano tre e divergono. */
export const wallLabel = w => DOOR_TYPES[doorKind(w)]?.label || "Muro pieno";

/* Stira un muro dal capo che si sta trascinando: l'altro sta fermo, e l'asse lo
   decide lo spostamento più lungo. Così un gesto solo allunga E ruota — non
   serve un comando "ruota", che sarebbe un bottone per una cosa che il dito sta
   già dicendo. */
export function stretchWallSeg(w, capo, px, py, g = GRIGLIA_BASE){
  const e = wallSegEnds(w, g), C = g.cella;
  const fx = capo === "a" ? e.x2 : e.x1, fy = capo === "a" ? e.y2 : e.y1;
  const dx = snapGrid(px, g) - fx, dy = snapGrid(py, g) - fy;
  const orizzontale = Math.abs(dx) >= Math.abs(dy);
  const d = orizzontale ? dx : dy;
  const len = Math.max(WALL_MIN, Math.min(WALL_MAX, Math.round(Math.abs(d) / C)));
  w.dir = orizzontale ? "h" : "v";
  w.len = len;
  w.x = orizzontale ? (d >= 0 ? fx : fx - len*C) : fx;
  w.y = orizzontale ? fy : (d >= 0 ? fy : fy - len*C);
}

/* ---------------- corridoi ----------------
   Le celle dipinte di un livello (`n.corridoi`, 24 set 2026): i corridoi fra
   le stanze, che fino a questa data esistevano solo come SFONDO di un dungeon
   importato — un'immagine, quindi niente da togliere o allungare. Ora sono un
   dato come i muri liberi, sul nodo del livello, e il generatore li scrive qui.
   Una cella è `[i, j]` nella maglia del livello (vedi normalizzaCorridoi nel
   contratto): negli esagoni sono coordinate assiali, quindi i corridoi seguono
   la forma della maglia senza un secondo formato. Non ha id né selezione: si
   dipinge e si cancella col pennello, non si prende in mano. */
export const CORRIDOI_MAX = CAMPAIGN_LIMITS.corridoiPerNode;
export const corridoiDi = n => Array.isArray(n?.corridoi) ? n.corridoi : [];
export const chiaveCella = c => c[0] + "," + c[1];
export function cellaCorridoio(g, x, y){
  if(isHex(g)){ const c = cellaEsagono(g, x, y); return [c.q, c.r]; }
  return [Math.floor(x / g.cella), Math.floor(y / g.cella)];
}
/* I vertici di una cella, in px. */
function verticiCella(g, [i, j]){
  if(!isHex(g)){
    const c = g.cella, x = i * c, y = j * c;
    return [[x, y], [x + c, y], [x + c, y + c], [x, y + c]];
  }
  const o = centroEsagono(g, {q:i, r:j}), R = g.cella / R3, piatto = hexPiatto(g);
  const out = [];
  for(let k = 0; k < 6; k++){
    const a = Math.PI / 180 * (60 * k - 90);        // punta in alto; il lato piatto è la trasposta
    const dx = R * Math.cos(a), dy = R * Math.sin(a);
    out.push(piatto ? [o.x + dy, o.y + dx] : [o.x + dx, o.y + dy]);
  }
  return out;
}
/* Tutti i corridoi in UN percorso: una cella è un sottopercorso chiuso, e le
   celle non si sovrappongono, quindi il riempimento semitrasparente resta
   uniforme. Sui quadretti le corse orizzontali si fondono in un rettangolo
   solo (la stessa economia dello sfondo che il dungeon disegnava prima). */
export function sagomaCorridoi(g, celle){
  const f = v => Math.round(v * 100) / 100;
  if(isHex(g)) return celle.map(c => "M" + verticiCella(g, c).map(([x, y]) => `${f(x)} ${f(y)}`).join("L") + "Z").join("");
  const righe = new Map();
  for(const [i, j] of celle){ if(!righe.has(j)) righe.set(j, []); righe.get(j).push(i); }
  const c = g.cella;
  let d = "";
  for(const [j, col] of righe){
    col.sort((a, b) => a - b);
    for(let k = 0; k < col.length;){
      let e = k;
      while(e + 1 < col.length && col[e + 1] === col[e] + 1) e++;
      d += `M${f(col[k] * c)} ${f(j * c)}h${f((e - k + 1) * c)}v${f(c)}h${f(-(e - k + 1) * c)}Z`;
      k = e + 1;
    }
  }
  return d;
}
/* Il riquadro che contiene i corridoi, per "Adatta". */
export function riquadroCorridoi(g, celle){
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for(const c of celle) for(const [x, y] of verticiCella(g, c)){
    x1 = Math.min(x1, x); y1 = Math.min(y1, y); x2 = Math.max(x2, x); y2 = Math.max(y2, y);
  }
  return celle.length ? {x1, y1, x2, y2} : null;
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
   Il vincolo vero è che la separazione regga in TUTTI i temi, non solo
   nel default: --gold per la stanza sembrava più squillante, ma in una
   palette ramata l'accento e l'oro finiscono addosso — quartiere, stanza e
   piazza diventano tre aranci. --track resta sabbia pallida ovunque, e con
   l'arancio della piazza non si confonde. */
export const SHAPE_COLORS = {
  /* I cinque territori hanno UN colore solo, ed è voluto: il colore dice che
     cosa è una bolla (un pezzo di mondo, non una costruzione). Cinque verdi
     diversi avrebbero voluto dire quattro token nuovi da far reggere in tutti e
     cinque i temi, per una differenza che il colore non è il posto giusto per
     dire. A dire quanto è largo un territorio sono la dimensione, il nome e la
     SAGOMA (il campo disegno in SHAPES): quella non costa token, si legge in
     monocromia e resta leggibile per un daltonico. */
  mondo:     "var(--fen)",
  continente:"var(--fen)",
  nazione:   "var(--fen)",
  regione:   "var(--fen)",
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

/* Una casella di testo (22 set 2026) è una scritta posata sulla pianta, da
   leggere senza aprire niente: non è un simbolo (isMarker), non è un posto in
   cui si entra, non sta sulla maglia e non ha muri. È un nodo e non un elenco
   a parte come i muri liberi perché così selezione, trascinamento,
   ridimensionamento, annulla, duplica ed elimina sono quelli di sempre — i
   muri hanno dovuto riscriverseli tutti. Il testo sta in `notes`, quindi è del
   DM: al tavolo non esce (share.ts la toglie comunque, anche se `shared`). */
export const isTesto = n => n.type === "testo";
export const TESTO_BOX = {w:200, h:80};
/* Come si chiama un nodo in un elenco (ricerca, contenuto del pannello): la
   casella di testo un titolo non ce l'ha, e "(senza nome)" la farebbe
   sembrare una bolla dimenticata. */
export const nomeInElenco = n => n.title || (isTesto(n) ? "Casella di testo" : "(senza nome)");
/* La dimensione del carattere finisce in un attributo style: si legge SOLO da
   qui, che la riduce a un numero fra due limiti qualunque cosa ci sia scritto.
   Il tetto è alto (24 set 2026): una casella sulla mappa del mondo sta in un
   livello largo migliaia di pixel, e a 48 si leggeva solo zoomando fino in
   fondo. Per lo stesso problema c'è `textFit`: il carattere lo decide la
   casella, e la si tira grande quanto serve. */
export const TESTO_SIZES = [12, 16, 22, 30, 48, 72];
export const TESTO_SIZE_MAX = 240;
export const testoSize = n => {
  const v = Number(n.textSize);
  return Number.isFinite(v) ? Math.min(TESTO_SIZE_MAX, Math.max(8, Math.round(v))) : 16;
};
/* Anche l'allineamento finisce in uno style: esce solo da questo elenco. */
export const TESTO_ALLINEA = {left:"A sinistra", center:"Al centro", right:"A destra", justify:"Giustificato"};
export const testoAllinea = n => Object.hasOwn(TESTO_ALLINEA, n.textAlign) ? n.textAlign : "left";
export const testoAdatta = n => n.textFit === true;
export const isMarker = n => !(n.type==="zona" || n.type==="luogo" || n.type==="testo");
export const defShape = n => n.type==="zona" ? "quartiere" : "edificio";

/* L'UNICO posto che decide di che colore è una bolla. Ordine: scelta esplicita
   del DM, poi il default della forma (bolle) o del tipo (segnalini). Prima questa
   logica era sparsa in quattro punti di mappa.js — con `col` calcolato una volta
   sola per tutti i rami — e il token era un caso speciale hardcodato. */
export function nodeColor(n){
  if(n.color) return n.color;
  if(n.type === "token") return "#e8e3d8";              // pedina senza colore: avorio
  if(isMarker(n) || isTesto(n)) return (TYPES[n.type] || TYPES.nota).color;
  return SHAPE_COLORS[n.shape || defShape(n)] || (TYPES[n.type] || TYPES.nota).color;
}
export function nodeBox(n){
  if(isMarker(n)) return {w:MARKER_R*2, h:MARKER_R*2};
  const s = isTesto(n) ? TESTO_BOX : (SHAPES[n.shape] || SHAPES[defShape(n)]);
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
  // Una figura servita da noi (/immagini/[chiave]): regola CONDIVISA col
  // contratto, non ricopiata — se le due divergessero il client accetterebbe
  // un URL che il server rifiuta con 422, e a scoprirlo sarebbe il DM.
  if(IMMAGINE_LOCALE.test(s)) return s;
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
function safeWallSeg(w, g){
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
  const seg = {
    id: safeId(w.id ?? uid()),
    x: snapGrid(x, g), y: snapGrid(y, g),
    dir: w.dir === "v" ? "v" : "h",
    len: Math.max(WALL_MIN, Math.min(WALL_MAX, Math.round(len)))
  };
  // Il tipo di porta si accetta solo se è uno dei nostri: finisce in un nome di
  // classe CSS, e un valore inventato lascerebbe un muro senza disegno invece
  // di un muro pieno — cioè un pezzo di perimetro che sparisce.
  if(DOOR_TYPES[w.porta]) seg.porta = w.porta;
  return seg;
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
    // La maglia prima dei muri: i muri si agganciano a quella del loro livello,
    // e con la maglia ancora da bonificare si aggancerebbero a un numero sporco.
    if(n.griglia != null){ const g = safeGriglia(n.griglia); if(g) n.griglia = g; else delete n.griglia; }
    if(n.wallSegs != null) n.wallSegs = (Array.isArray(n.wallSegs) ? n.wallSegs : [])
      .map(w => safeWallSeg(w, grigliaDi(n))).filter(Boolean);
    if(n.corridoi != null){ const p = normalizzaCorridoi(n.corridoi); if(p.length) n.corridoi = p; else delete n.corridoi; }
    for(const e of (Array.isArray(n.edges) ? n.edges : [])){
      if(e.id != null) e.id = safeId(e.id);
      e.a = safeId(e.a); e.b = safeId(e.b);
      if(e.percorso != null){ const p = normalizzaPercorso(e.percorso); if(p.length) e.percorso = p; else delete e.percorso; }
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

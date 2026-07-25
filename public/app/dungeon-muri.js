/* Le pareti delle stanze di un dungeon generato.

   Geometria pura: entrano la griglia dell'export e i rettangoli delle stanze (in
   quadretti), esce un elenco di muri liberi (`wallSegs`, vedi modello.js) già in
   pixel del livello. Niente DOM e niente stato, così si prova con node:test —
   è la stessa ragione per cui la geometria del righello sta in una funzione sua.

   Perché derivarli qui e non farli emettere dal motore: la griglia DICE già dove
   sono le pareti (una cella di stanza confina con qualcosa che non è la stanza) e
   dove sono le porte (le celle `3`). Metterli nell'export vorrebbe dire un campo
   nuovo, una versione di schema nuova e due verità da tenere allineate — e
   lascerebbe senza muri ogni export già salvato, che invece così li guadagna.

   Quanti sono: 122 muri in media per un dungeon da 16 stanze, il massimo che la
   UI concede (44 per uno da 6), misurati su 20 seed — due ordini di grandezza
   sotto `wallsPerNode` del formato, e un test lo impone.

   Il perimetro DERIVATO (`n.walls`) resta un'altra cosa e non si somma a questi:
   corre 5px dentro la sagoma e apre le porte dove passa un arco centro→centro,
   cioè quasi mai dove sta la porta vera. Chi crea questi muri spegne quello —
   vedi dungeonFromExport in dungeon.js. */

import { CELL, uid, WALL_MAX } from "./modello.js";

/* La legenda dell'export (grid.legend): 0 roccia, 1 stanza, 2 corridoio, 3 porta. */
const PORTA = "3";
const CORRIDOIO = "2";
/* Una porta di dungeon nasce chiusa, come quella della palette: è lo stato in cui
   una porta sta su una pianta, e aprirla è una battuta di gioco, non un dato del
   generatore. Dal pannello si cambia in aperta, a chiave o segreta. */
const PORTA_DEFAULT = "chiusa";

/* Fuori dalla griglia è roccia: una stanza sul bordo della mappa ha comunque le
   sue quattro pareti. Un indice negativo su una stringa dà undefined, non un
   errore, ed è esattamente il caso "fuori". */
const cella = (rows, x, y) => (typeof rows?.[y] === "string" ? rows[y][x] : undefined) || "0";

/* I quattro lati di una stanza, ognuno come: quante celle lo compongono, dove
   comincia il quadretto i-esimo (in pixel, sull'incrocio della maglia) e qual è
   la cella CONFINANTE — quella fuori dalla stanza, che dice se lì c'è una porta.
   I lati si sovrappongono solo negli angoli, che sono punti: nord e sud corrono
   sulle ascisse x..x+w, ovest ed est sulle ordinate y..y+h. */
const lati = ({ x, y, w, h }) => [
  { n:w, dir:"h", punto:i=>({x:(x+i)*CELL, y:y*CELL}),     vicino:i=>({x:x+i, y:y-1}) },  // nord
  { n:w, dir:"h", punto:i=>({x:(x+i)*CELL, y:(y+h)*CELL}), vicino:i=>({x:x+i, y:y+h}) },  // sud
  { n:h, dir:"v", punto:j=>({x:x*CELL,     y:(y+j)*CELL}), vicino:j=>({x:x-1, y:y+j}) },  // ovest
  { n:h, dir:"v", punto:j=>({x:(x+w)*CELL, y:(y+j)*CELL}), vicino:j=>({x:x+w, y:y+j}) },  // est
];

/* Un rettangolo di stanza è utile solo se è un rettangolo: il JSON arriva dagli
   appunti ed è untrusted come ogni import. Il tetto è WALL_MAX (200 quadretti),
   lo stesso di un muro: una "stanza" più lunga di così non è una stanza, ed è
   l'unica cosa che impedisce a un lato dichiarato lungo un miliardo di quadretti
   di piantare il browser in un ciclo per cella. La stanza resta (la bolla la
   disegna comunque il chiamante): quello che cade sono le sue pareti. */
const rettangoloSano = r =>
  !!r && [r.x, r.y, r.w, r.h].every(v => Number.isFinite(v))
  && r.w >= 1 && r.h >= 1 && r.w <= WALL_MAX && r.h <= WALL_MAX;

/* Una stanza senza nemmeno una porta è una stanza in cui non si entra, e al
   tavolo è un guasto muto: la pianta sembra a posto finché qualcuno non ci
   prova. Capita perché il motore marca le celle `3` guardando DALLA cella di
   corridoio e si ferma alla prima stanza che tocca: una soglia stretta fra due
   stanze finisce a una sola, e l'altra resta murata pur avendo il corridoio
   addosso. Finora non si vedeva — il perimetro derivato apriva le porte dagli
   archi, che ci sono sempre — e con le pareti vere diventa un muro pieno.
   La porta è dove passa il corridoio: si promuove la prima cella `2` adiacente,
   una sola, che è quanto serve per entrare. Il resto delle celle di corridoio
   che costeggiano la stanza resta parete, come vuole il motore. */
function apriUnPassaggio(perimetro){
  if(perimetro.some(l => l.celle.includes(PORTA))) return;
  for(const l of perimetro){
    const i = l.celle.indexOf(CORRIDOIO);
    if(i >= 0){ l.celle[i] = PORTA; return; }
  }
}

/**
 * @param {string[]} rows righe della griglia dell'export (una stringa per riga)
 * @param {{x:number,y:number,w:number,h:number}[]} rettangoli stanze, in quadretti
 * @returns {{id:string,x:number,y:number,dir:"h"|"v",len:number,porta?:string}[]}
 */
export function muriDelleStanze(rows, rettangoli){
  const out = [];
  for(const r of (Array.isArray(rettangoli) ? rettangoli : [])){
    if(!rettangoloSano(r)) continue;
    /* Prima si legge tutto il perimetro, poi si disegna: la rete di sicurezza
       qui sotto deve poter dire "questa stanza non ha porte da nessun lato",
       e un lato per volta non lo sa. */
    const perimetro = lati(r).map(lato => ({
      lato,
      celle: Array.from({length:lato.n}, (_, i) => {
        const v = lato.vicino(i);
        return cella(rows, v.x, v.y);
      })
    }));
    apriUnPassaggio(perimetro);
    for(const {lato, celle} of perimetro){
      /* Le celle piene si fondono in un muro solo: un segmento per quadretto
         sarebbe lo stesso disegno con dieci volte i dati, e una selezione che
         prende un quadretto invece di una parete. Le porte no — una porta È un
         quadretto (DOOR in modello.js), e due porte di fila non capitano: il
         motore ne marca una per lato di stanza. */
      let pieni = 0;
      const chiudi = fine => {
        if(!pieni) return;
        const p = lato.punto(fine - pieni);
        out.push({id:uid(), x:p.x, y:p.y, dir:lato.dir, len:pieni});
        pieni = 0;
      };
      for(let i=0; i<lato.n; i++){
        if(celle[i] === PORTA){
          chiudi(i);
          const p = lato.punto(i);
          out.push({id:uid(), x:p.x, y:p.y, dir:lato.dir, len:1, porta:PORTA_DEFAULT});
        }else pieni++;
      }
      chiudi(lato.n);
    }
  }
  return out;
}

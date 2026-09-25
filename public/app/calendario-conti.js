/* I conti del calendario di gioco: giorno assoluto ↔ data, e le scadenze
   dette come le dice un DM ("tra 3 giorni", "scaduta da 2 giorni").

   Modulo PURO, senza DOM e senza stato: lo provano i test sotto Node e lo
   leggono scheda Calendario, pannello, diario quest e tela. La forma del
   calendario la decide il contratto (`normalizzaCalendario`); qui si dà per
   buona, cioè si chiama sempre con un calendario già passato di lì — lo fa
   `calendarioDi`, che è l'unica porta.

   Il giorno 1 è il primo giorno del primo mese dell'anno `annoIniziale`, e
   i giorni non scendono sotto 1: un calendario che va anche all'indietro
   vorrebbe dire anni negativi rispetto all'inizio della campagna, e nessuno
   gioca prima che la campagna cominci. */

import { calendarioPredefinito, normalizzaCalendario } from "./formato-campagna.js";

/* Il calendario di un documento, sempre valido: quello del DM se c'è,
   altrimenti il predefinito. Non lo scrive nel documento — lo fa solo chi lo
   modifica (`assicuraCalendario` in calendario.js), così aprire la scheda non
   è una modifica e non produce una revisione. */
export function calendarioDi(stato){
  return normalizzaCalendario(stato?.calendario) || calendarioPredefinito();
}

export const lunghezzaAnno = cal => cal.mesi.reduce((t, m) => t + m.giorni, 0);

/* Il giorno assoluto `g` come data: anno, mese (indice da 0) e giorno del
   mese (da 1). */
export function dataDi(cal, g){
  const L = lunghezzaAnno(cal);
  const zero = Math.max(1, Math.floor(g)) - 1;
  const anno = cal.annoIniziale + Math.floor(zero / L);
  let resto = zero % L, mese = 0;
  while(resto >= cal.mesi[mese].giorni){ resto -= cal.mesi[mese].giorni; mese++; }
  return {anno, mese, giorno: resto + 1};
}

/* Il contrario: il giorno assoluto di una data. Un giorno oltre la fine del
   mese si ferma all'ultimo; una data prima dell'inizio torna 1. */
export function giornoDi(cal, anno, mese, giorno = 1){
  const L = lunghezzaAnno(cal);
  let g = (anno - cal.annoIniziale) * L;
  for(let i=0; i<mese; i++) g += cal.mesi[i].giorni;
  g += Math.min(Math.max(1, giorno), cal.mesi[mese].giorni);
  return Math.max(1, g);
}

/* Il mese prima o dopo, attraversando l'anno. */
export function spostaMese(cal, anno, mese, delta){
  const n = cal.mesi.length;
  const t = anno * n + mese + delta;
  return {anno: Math.floor(t / n), mese: ((t % n) + n) % n};
}

/* Il giorno della settimana, indice in `cal.settimana`. Le settimane corrono
   continue attraverso mesi e anni: il giorno 1 è il primo della settimana. */
export const giornoSettimana = (cal, g) => (Math.max(1, g) - 1) % cal.settimana.length;

export const nomeMese = (cal, i) => cal.mesi[i]?.nome.trim() || `Mese ${i + 1}`;
export const nomeGiorno = (cal, i) => cal.settimana[i]?.trim() || `${i + 1}°`;
export const nomeAnno = (cal, anno) => cal.era.trim() ? `${anno} ${cal.era.trim()}` : `anno ${anno}`;

export function formattaData(cal, g){
  const d = dataDi(cal, g);
  return `${d.giorno} ${nomeMese(cal, d.mese)}, ${nomeAnno(cal, d.anno)}`;
}

/* Quanti giorni mancano, detto come lo direbbe il DM. `stato` è per chi
   disegna: "scaduta", "oggi", "vicina" (entro tre giorni) o "lontana" — il
   testo porta già l'informazione, il colore la ripete. */
export function scadenzaTesto(oggi, scadenza){
  const d = scadenza - oggi;
  if(d < 0) return {testo: d === -1 ? "scaduta ieri" : `scaduta da ${-d} giorni`, stato: "scaduta", giorni: d};
  if(d === 0) return {testo: "scade oggi", stato: "oggi", giorni: d};
  if(d === 1) return {testo: "scade domani", stato: "vicina", giorni: d};
  return {testo: `tra ${d} giorni`, stato: d <= 3 ? "vicina" : "lontana", giorni: d};
}

/* Quanto dista un giorno qualunque da oggi, per l'intestazione del giorno
   scelto nella scheda. */
export function distanzaTesto(oggi, g){
  const d = g - oggi;
  if(d === 0) return "oggi";
  if(d === 1) return "domani";
  if(d === -1) return "ieri";
  return d > 0 ? `tra ${d} giorni` : `${-d} giorni fa`;
}

/* Le preferenze dello schermo scelte dalla finestra Impostazioni (25 set 2026):
   su che foglio si scrivono le caselle e le schede che non ne hanno uno loro,
   e con che carattere nasce una casella nuova. Stanno in localStorage come il
   tema e la barra, non nel JSON: la stessa campagna aperta su due schermi può
   volere due aspetti, e al tavolo queste cose non arrivano comunque (caselle e
   schede sono del DM).

   Si leggono a ogni disegno, quindi stanno in memoria e il localStorage si
   tocca solo all'avvio e alla scelta. Un valore che non riconosciamo (una
   chiave scritta a mano, una versione futura) torna al default: finisce in
   una classe CSS e in un numero di pixel. */

import { foglioValido, TESTO_SIZES } from "./modello.js";

const CHIAVI = {foglio:"runebog-foglio", carattere:"runebog-carattere"};
const DEFAULT = {foglio:"pulito", carattere:16};
const valida = {
  foglio: v => foglioValido(v),
  carattere: v => TESTO_SIZES.includes(v),
};
const leggi = (nome, grezzo) => nome === "carattere" ? Number(grezzo) : grezzo;

const correnti = {...DEFAULT};
for(const nome of Object.keys(CHIAVI)){
  let v = null;
  try{ v = localStorage.getItem(CHIAVI[nome]); }catch(_){}
  if(v != null && valida[nome](leggi(nome, v))) correnti[nome] = leggi(nome, v);
}

export const preferenza = nome => correnti[nome];

export function impostaPreferenza(nome, v){
  if(!Object.hasOwn(CHIAVI, nome) || !valida[nome](v)) return;
  correnti[nome] = v;
  try{
    v === DEFAULT[nome] ? localStorage.removeItem(CHIAVI[nome]) : localStorage.setItem(CHIAVI[nome], String(v));
  }catch(_){}
}

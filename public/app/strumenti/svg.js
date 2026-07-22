/* Primitive SVG condivise dagli strumenti temporanei della mappa. Solo ciò che
   più tool useranno davvero: creare un elemento, sapere quanti pixel-schermo vale
   un'unità di mappa (per etichette leggibili a ogni zoom), formattare un numero
   all'italiana. NON è un posto per la logica di un singolo tool.

   Nota: `svgEl` legge `document` solo QUANDO viene chiamata, non all'import —
   così il modulo si importa anche fuori dal browser (i test di geometria non la
   chiamano mai). Il gestore, che deve girare sotto Node nei test, non usa questo
   file: crea i suoi nodi con la `doc` che gli viene iniettata. */

export const SVG_NS = "http://www.w3.org/2000/svg";

export function svgEl(name, attrs = {}){
  const el = document.createElementNS(SVG_NS, name);
  for(const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/* Quante unità di mappa vale un pixel sullo schermo: viewBox.width / larghezza
   resa. Serve a tenere un'etichetta della stessa altezza in pixel a ogni zoom
   (font-size = costante × questa scala), sennò il testo cresce con la vista. */
export function scalaSchermo(svg){
  const vb = svg.viewBox?.baseVal;
  if(!vb || !svg.clientWidth) return 1;
  return vb.width / svg.clientWidth;
}

/* Un numero all'italiana (virgola decimale), senza zeri di coda: 1.5 → "1,5",
   3 → "3". Il righello lo usa per i metri, che non hanno un numero fisso di
   decimali sensato (una diagonale è 2,12 quadretti). */
export function formattaNumero(value, decimali = 2){
  return Number(value.toFixed(decimali)).toLocaleString("it-IT", {
    maximumFractionDigits: decimali,
  });
}

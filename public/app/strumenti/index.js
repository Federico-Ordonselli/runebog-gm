/* L'unico elenco degli strumenti installati. Aggiungere un tool = un import e una
   riga in TOOLS, più il suo file sotto strumenti/. Nient'altro: non app.html, non
   mappa.js, non le API. Elenco esplicito, niente discovery dinamica (il frontend
   non ha build step, e una lista che si legge è più verificabile di un glob).

   Quando i tool passano di due, tenere l'array e registrare in ciclo (già così). */

import { initGestoreTool, registraTool } from "./gestore.js";
import { righelloTool } from "./righello.js";

const TOOLS = [righelloTool];

export function initStrumentiMappa(options){
  for(const tool of TOOLS) registraTool(tool);
  initGestoreTool(options);
}

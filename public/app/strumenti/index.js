/* L'unico elenco degli strumenti installati. Aggiungere un tool = un import e una
   riga in TOOLS, più il suo file sotto strumenti/. Nient'altro: non app.html, non
   mappa.js, non le API. Elenco esplicito, niente discovery dinamica (il frontend
   non ha build step, e una lista che si legge è più verificabile di un glob).

   In questo commit il registro è ancora vuoto: serve a provare che, senza tool,
   la mappa non cambia comportamento. Il righello arriva nel commit seguente. */

import { initGestoreTool, registraTool } from "./gestore.js";

const TOOLS = [];

export function initStrumentiMappa(options){
  for(const tool of TOOLS) registraTool(tool);
  initGestoreTool(options);
}

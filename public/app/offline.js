/* La copia offline dell'editor: si installa da sé, non si comanda.
 *
 * Il service worker vero è generato (`/sw.js`, vedi src/app/sw.js/route.ts).
 * Qui c'è solo la registrazione e l'etichetta di stato che il menu ⋯ mostra.
 *
 * Perché senza chiedere: chi è su /app.html quei 24 file li ha appena scaricati
 * tutti: precaricarli non aggiunge byte, chiede al browser di non buttarli.
 * Un bottone "usa offline" qui sarebbe un comando per riparare qualcosa che
 * nasce storto. Le regole SRD sono l'altro caso — 1,3 MB, che si chiedono — e
 * infatti quelle hanno un comando, ma sta su /srd.
 *
 * Perché SOLO in standalone: /play/[id] e /tavolo/[token] servono questo stesso
 * app.html con lo stato iniettato dentro l'HTML, e quelle due pagine il worker
 * non le mette in cache per contratto (sono segrete, o sono una revisione che
 * invecchia). Installare da lì una copia che non le riguarda vuol dire lasciare
 * un worker sul telefono di un giocatore che ha solo aperto un link condiviso.
 * Offline ha senso dov'è vero che i dati sono già lì: localStorage.
 */

let attivo = false;
let pronto = false;

export function initOffline() {
  if (!("serviceWorker" in navigator)) return;
  if (window.__cloud || window.__table) return;
  attivo = true;

  /* Alla seconda apertura il worker controlla già la pagina: senza questa riga
     l'etichetta direbbe "preparo" per sempre, perché `controllerchange` scatta
     solo quando il controllo CAMBIA. */
  if (navigator.serviceWorker.controller) pronto = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    pronto = true;
  });

  /* Un fallimento non si annuncia: l'app funziona identica senza. Capita per
     davvero — in navigazione privata, o dietro una policy che vieta i worker. */
  navigator.serviceWorker.register("/sw.js").catch(() => {
    attivo = false;
  });
}

/** L'etichetta per il menu ⋯, o null se non c'è niente da dire. È una riga di
 *  stato e non una voce: non c'è niente da premere, e un comando che non fa
 *  niente sarebbe peggio del silenzio. */
export function etichettaOffline() {
  if (!attivo) return null;
  return pronto ? "Disponibile offline ✓" : "Preparo la copia offline…";
}

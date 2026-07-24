/* La cache offline di una campagna cloud, e il dialogo con cui si sceglie quale
   versione tenere quando ce ne sono due.

   Qui dentro non si importa `stato.js`: stato, `store` e callback arrivano da
   fuori. Non è purezza per sport — è ciò che rende la classificazione ("questa
   copia locale è da recuperare o è un conflitto?") verificabile con node:test,
   senza DOM, senza server e senza rete. La parte che NON si può testare così
   (la fetch, il debounce, il dialogo) resta in `stato.js`, ed è tenuta sottile
   apposta.

   Due cose che il formato deve sapere dire e che la vecchia cache non sapeva:
   DI CHI è la copia (`campaignId` — la chiave `runebog-gm-v1` era una sola per
   tutte le campagne) e DA DOVE parte (`baseRevision`), perché senza la seconda
   "il server è cambiato" e "il server è quello di prima" sono indistinguibili e
   l'unico recupero possibile diventa la sovrascrittura alla cieca. */

export const CLOUD_CACHE_VERSION = 1;
export const CLOUD_CACHE_PREFIX = "runebog-cloud-v1:";

export function cloudCacheKey(campaignId){
  if(typeof campaignId !== "string" || !campaignId) throw new TypeError("campaignId non valido");
  return CLOUD_CACHE_PREFIX + campaignId;
}

/* `pending`: c'è lavoro che il server non ha. `synced`: la copia locale è la
   stessa cosa che sta nel cloud, e non c'è niente da proporre alla riapertura.
   Lo stato non si deduce confrontando i JSON al volo, perché il confronto
   possibile alla riapertura è con la revisione che il server manda ADESSO, non
   con quella da cui si era partiti. */
export function makePendingCache({ campaignId, state, baseRevision, savedAt = Date.now() }){
  if(!Number.isSafeInteger(baseRevision) || baseRevision < 0)
    throw new TypeError("baseRevision non valida");
  return {
    version: CLOUD_CACHE_VERSION,
    campaignId,
    state,
    savedAt,
    baseRevision,
    status: "pending",
  };
}

export function makeSyncedCache({ campaignId, state, revision, savedAt = Date.now() }){
  if(!Number.isSafeInteger(revision) || revision < 0)
    throw new TypeError("revision non valida");
  return {
    version: CLOUD_CACHE_VERSION,
    campaignId,
    state,
    savedAt,
    baseRevision: revision,
    status: "synced",
  };
}

/* Il localStorage è scrivibile da qualunque cosa giri su questa origine e
   sopravvive agli aggiornamenti dell'app: una cache si controlla prima di
   crederle, compresa la versione del formato — una scritta da un domani non si
   sa leggere, e provarci è peggio che ignorarla. Il contenuto resta comunque
   untrusted: chi la usa deve passarla da `migrateState`, che chiama
   `sanitizeState`. */
export function isCloudCache(value, campaignId){
  return !!value &&
    value.version === CLOUD_CACHE_VERSION &&
    value.campaignId === campaignId &&
    (value.status === "pending" || value.status === "synced") &&
    Number.isFinite(value.savedAt) &&
    Number.isSafeInteger(value.baseRevision) &&
    value.baseRevision >= 0 &&
    !!value.state?.root &&
    Array.isArray(value.state.checklist) &&
    Array.isArray(value.state.players);
}

export function readCloudCache(store, campaignId){
  try{
    const raw = store.get(cloudCacheKey(campaignId));
    if(!raw) return null;
    const value = JSON.parse(raw);
    return isCloudCache(value, campaignId) ? value : null;
  }catch(_){
    return null;
  }
}

/* Torna `false` se localStorage ha rifiutato la scrittura (quota piena): il
   chiamante lo usa per dire "solo in memoria", perché in quel caso una copia da
   recuperare alla riapertura non esiste. */
export function writeCloudCache(store, cache){
  if(!isCloudCache(cache, cache?.campaignId)) throw new TypeError("cache cloud non valida");
  return store.set(cloudCacheKey(cache.campaignId), JSON.stringify(cache));
}

export function statesEqual(a, b){
  try{ return JSON.stringify(a) === JSON.stringify(b); }
  catch(_){ return false; }
}

/*
 * Cosa fare della copia locale trovata all'apertura:
 * - none:       niente da recuperare (nessuna cache, o già sincronizzata);
 * - equivalent: pendente ma identica al server — è arrivata, va solo marcata;
 * - pending:    il server è fermo alla base locale, il recupero è senza perdite;
 * - conflict:   il server è andato avanti da un'altra parte. Le due versioni
 *               discendono dallo stesso antenato ma nessuno può dire quale
 *               contenga cosa: la scelta è dell'utente, e non si fondono.
 */
export function classifyCloudRecovery(cache, { campaignId, state, revision }){
  if(!isCloudCache(cache, campaignId) || cache.status !== "pending") return "none";
  if(statesEqual(cache.state, state)) return "equivalent";
  if(cache.baseRevision === revision) return "pending";
  return "conflict";
}

/*
 * Cosa persistere dopo un ACK, e se serve un altro giro.
 *
 * Un 200 dice che è arrivato LO SNAPSHOT SPEDITO, non "lo stato corrente": fra
 * la partenza della PATCH e la risposta l'utente ha continuato a scrivere.
 * Marcare sincronizzato ciò che c'è adesso perderebbe quelle battute al primo
 * imprevisto — ed è la parte che si rompe solo con la rete lenta, cioè mai
 * durante una prova a mano. Sta qui, separata dalla fetch, per poterla provare.
 *
 * `sentJson`/`currentJson` sono le serializzazioni che il chiamante ha già in
 * mano: uno stato arriva a 4 MB, e riserializzarlo — o peggio riparsarlo — a
 * ogni ACK è la parte più cara del salvataggio. Senza, la funzione se le
 * calcola da sé: è così che la usano i test.
 */
export function reconcileCloudAck({
  campaignId,
  sentState,
  currentState,
  sentJson,
  currentJson,
  acknowledgedRevision,
  savedAt = Date.now(),
}){
  const identici = typeof sentJson === "string" && typeof currentJson === "string"
    ? sentJson === currentJson
    : statesEqual(sentState, currentState);
  if(identici){
    return {
      retry: false,
      cache: makeSyncedCache({
        campaignId,
        state: currentState,
        revision: acknowledgedRevision,
        savedAt,
      }),
    };
  }
  return {
    retry: true,
    cache: makePendingCache({
      campaignId,
      state: currentState,
      baseRevision: acknowledgedRevision,
      savedAt,
    }),
  };
}

export function recoveryBackup({ campaignId, localCache, server }){
  return {
    format: "runebog-cloud-recovery-v1",
    exportedAt: new Date().toISOString(),
    campaignId,
    local: {
      savedAt: new Date(localCache.savedAt).toISOString(),
      baseRevision: localCache.baseRevision,
      state: localCache.state,
    },
    server: {
      updatedAt: server.updatedAt,
      revision: server.revision,
      state: server.state,
    },
  };
}

export function downloadRecoveryBackup(payload, documentRef = document){
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const link = documentRef.createElement("a");
  const safeId = String(payload.campaignId).replace(/[^a-zA-Z0-9_-]/g, "_");
  link.href = url;
  link.download = `runebog-recupero-${safeId}-${Date.now()}.json`;
  link.click();
  setTimeout(()=>URL.revokeObjectURL(url), 0);
}

/*
 * Il dialogo della scelta.
 *
 * A differenza di alert e conferma non ha un `<dialog>` in `app.html`: quello lì
 * è markup che si vede in due casi rari, e questo si costruisce con
 * createElement + textContent, quindi il titolo di una campagna altrui non
 * diventa HTML nemmeno per sbaglio (`escapeHtml` non è nel giro: non c'è nessun
 * innerHTML da proteggere).
 *
 * Non si chiude da solo e non ha "Annulla": finché non si sceglie, `stato.js`
 * tiene fermo il salvataggio, e un dialogo chiudibile lascerebbe l'app in quello
 * stato senza dirlo. "Esporta entrambe" apposta NON chiude: mette al sicuro le
 * due versioni, ma la scelta resta da fare.
 */
export function openCloudRecoveryDialog({
  kind,
  campaignId,
  localCache,
  server,
  onKeepServer,
  onRecoverLocal,
  documentRef = document,
}){
  let dialog = documentRef.getElementById("cloud-recovery-dialog");
  if(dialog) dialog.remove();

  dialog = documentRef.createElement("dialog");
  dialog.id = "cloud-recovery-dialog";
  dialog.setAttribute("aria-labelledby", "cloud-recovery-title");

  const title = documentRef.createElement("h2");
  title.id = "cloud-recovery-title";
  title.className = "serif";
  title.textContent = kind === "conflict"
    ? "Conflitto di salvataggio"
    : "Modifiche locali da recuperare";

  const text = documentRef.createElement("p");
  text.textContent = localCache.legacy
    ? "È stata trovata una copia creata dalla vecchia cache, che non registrava l’ID della campagna: potrebbe appartenere a un’altra. Controlla il titolo prima di recuperarla, oppure esporta entrambe le versioni."
    : kind === "conflict"
    ? "Questa campagna è stata modificata anche altrove. Scegli quale versione continuare: nessuna delle due verrà sovrascritta senza conferma."
    : "Esiste una copia salvata soltanto su questo dispositivo. Il cloud non è cambiato da quando è stata creata.";

  const meta = documentRef.createElement("p");
  meta.className = "hint-sm";
  const localDate = new Date(localCache.savedAt).toLocaleString("it-IT");
  const serverDate = server.updatedAt
    ? new Date(server.updatedAt).toLocaleString("it-IT") : "data sconosciuta";
  meta.textContent = `Copia locale: ${localDate} · Cloud: ${serverDate}`;

  const actions = documentRef.createElement("div");
  actions.className = "d-actions cloud-recovery-actions";

  const exportBtn = documentRef.createElement("button");
  exportBtn.type = "button";
  exportBtn.className = "btn";
  exportBtn.textContent = "Esporta entrambe";
  exportBtn.addEventListener("click", ()=>{
    downloadRecoveryBackup(recoveryBackup({campaignId, localCache, server}), documentRef);
  });

  const serverBtn = documentRef.createElement("button");
  serverBtn.type = "button";
  serverBtn.className = "btn";
  serverBtn.textContent = "Conserva cloud";
  serverBtn.addEventListener("click", ()=>{
    dialog.close();
    dialog.remove();
    onKeepServer();
  });

  const localBtn = documentRef.createElement("button");
  localBtn.type = "button";
  localBtn.className = "btn primary";
  localBtn.textContent = "Recupera locale";
  localBtn.addEventListener("click", ()=>{
    dialog.close();
    dialog.remove();
    onRecoverLocal();
  });

  actions.append(exportBtn, serverBtn, localBtn);
  dialog.append(title, text, meta, actions);
  documentRef.body.append(dialog);
  // Escape non deve poter chiudere una scelta che l'app sta aspettando.
  dialog.addEventListener("cancel", e=>e.preventDefault());
  dialog.showModal();
}

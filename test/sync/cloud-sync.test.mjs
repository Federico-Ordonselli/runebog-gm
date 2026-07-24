/* La cache cloud: formato, classificazione del recupero e riconciliazione
   dell'ACK. Puri come i test degli strumenti — niente DOM, niente rete, niente
   server: è tutto ciò che sta in sync-cloud.js proprio perché sia provabile
   così. Quello che resta in stato.js (fetch, debounce, dialogo) si prova a mano,
   con la procedura scritta in TODO.md. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  cloudCacheKey,
  makePendingCache,
  makeSyncedCache,
  readCloudCache,
  writeCloudCache,
  classifyCloudRecovery,
  reconcileCloudAck,
  recoveryBackup,
} from "../../public/app/sync-cloud.js";

/* Lo stesso contratto di `store` in stato.js: set() torna false quando la
   scrittura non è persistita (quota piena). */
function memoryStore(pieno = false){
  const values = new Map();
  return {
    get: key => values.get(key) ?? null,
    set: (key, value)=>{ if(pieno) return false; values.set(key, value); return true; },
    del: key=>values.delete(key),
  };
}

const state = title=>({
  root: {id:"root", title, children:[], edges:[]},
  checklist: [],
  players: [],
});

test("la cache è distinta per campagna", ()=>{
  assert.notEqual(cloudCacheKey("campagna-a"), cloudCacheKey("campagna-b"));
  const store = memoryStore();
  writeCloudCache(store, makePendingCache({
    campaignId:"campagna-a", state:state("A"), baseRevision:2,
  }));
  assert.equal(readCloudCache(store, "campagna-b"), null);
  assert.equal(readCloudCache(store, "campagna-a").state.root.title, "A");
});

test("una modifica offline sopravvive alla chiusura della scheda", ()=>{
  const store = memoryStore();
  writeCloudCache(store, makePendingCache({
    campaignId:"c1", state:state("Modifica offline"), baseRevision:5, savedAt:1234,
  }));
  // Rileggere dallo store simula il bootstrap successivo: non dipende da
  // niente che sia rimasto in memoria.
  const dopoIlReload = readCloudCache(store, "c1");
  assert.equal(dopoIlReload.status, "pending");
  assert.equal(dopoIlReload.savedAt, 1234);
  assert.equal(dopoIlReload.state.root.title, "Modifica offline");
});

test("una scrittura rifiutata dalla quota si dichiara", ()=>{
  // È la differenza fra "ce l'hai comunque" e "usa Esporta": senza questo
  // ritorno il messaggio in topbar mentirebbe.
  assert.equal(writeCloudCache(memoryStore(true), makePendingCache({
    campaignId:"c1", state:state("Grande"), baseRevision:0,
  })), false);
});

test("una copia sincronizzata non chiede recupero", ()=>{
  assert.equal(classifyCloudRecovery(makeSyncedCache({
    campaignId:"c1", state:state("Cloud"), revision:4,
  }), {campaignId:"c1", state:state("Cloud"), revision:4}), "none");
});

test("una copia pendente identica al server viene riconciliata in silenzio", ()=>{
  // Caso del salvataggio riuscito la cui risposta non è mai arrivata: il lavoro
  // è già nel cloud, e chiedere all'utente di scegliere sarebbe un falso allarme.
  assert.equal(classifyCloudRecovery(makePendingCache({
    campaignId:"c1", state:state("Uguale"), baseRevision:3,
  }), {campaignId:"c1", state:state("Uguale"), revision:4}), "equivalent");
});

test("offline con server invariato è un recupero, non un conflitto", ()=>{
  assert.equal(classifyCloudRecovery(makePendingCache({
    campaignId:"c1", state:state("Locale"), baseRevision:7,
  }), {campaignId:"c1", state:state("Server"), revision:7}), "pending");
});

test("una revisione server più recente è un conflitto", ()=>{
  assert.equal(classifyCloudRecovery(makePendingCache({
    campaignId:"c1", state:state("Locale"), baseRevision:7,
  }), {campaignId:"c1", state:state("Server"), revision:8}), "conflict");
});

test("un ACK marca sincronizzato soltanto lo snapshot davvero inviato", ()=>{
  const esito = reconcileCloudAck({
    campaignId:"c1",
    sentState:state("Inviato"),
    currentState:state("Inviato"),
    acknowledgedRevision:9,
  });
  assert.equal(esito.retry, false);
  assert.equal(esito.cache.status, "synced");
  assert.equal(esito.cache.baseRevision, 9);
});

test("una modifica fatta mentre la richiesta era in volo resta pendente", ()=>{
  const esito = reconcileCloudAck({
    campaignId:"c1",
    sentState:state("Prima modifica"),
    currentState:state("Seconda modifica"),
    acknowledgedRevision:9,
  });
  assert.equal(esito.retry, true);
  assert.equal(esito.cache.status, "pending");
  // La base è l'ACK appena ricevuto: la seconda modifica riparte da lì, sennò
  // il ritentativo arriverebbe al server con una revisione già superata da sé.
  assert.equal(esito.cache.baseRevision, 9);
  assert.equal(esito.cache.state.root.title, "Seconda modifica");
});

test("le serializzazioni già in mano al chiamante danno lo stesso esito", ()=>{
  // La scorciatoia che evita di riserializzare 4 MB a ogni ACK deve decidere
  // come il confronto lungo, sennò è un secondo criterio che può divergere.
  const inviato = state("Inviato"), corrente = state("Seconda");
  for(const [a, b, atteso] of [[inviato, inviato, false], [inviato, corrente, true]]){
    const esito = reconcileCloudAck({
      campaignId:"c1",
      currentState:b,
      sentJson:JSON.stringify(a),
      currentJson:JSON.stringify(b),
      acknowledgedRevision:9,
    });
    assert.equal(esito.retry, atteso);
  }
});

test("il backup contiene entrambe le versioni e le rispettive revisioni", ()=>{
  const backup = recoveryBackup({
    campaignId:"c1",
    localCache: makePendingCache({
      campaignId:"c1", state:state("Locale"), baseRevision:7, savedAt:1000,
    }),
    server:{state:state("Server"), revision:8, updatedAt:"2026-07-24T10:00:00.000Z"},
  });
  assert.equal(backup.local.state.root.title, "Locale");
  assert.equal(backup.server.state.root.title, "Server");
  assert.equal(backup.local.baseRevision, 7);
  assert.equal(backup.server.revision, 8);
});

test("una cache corrotta o di versione futura viene ignorata", ()=>{
  const store = memoryStore();
  store.set(cloudCacheKey("c1"), JSON.stringify({
    version:99, campaignId:"c1", state:state("X"), savedAt:1,
    baseRevision:0, status:"pending",
  }));
  assert.equal(readCloudCache(store, "c1"), null);
  store.set(cloudCacheKey("c2"), "{non è json");
  assert.equal(readCloudCache(store, "c2"), null);
});

test("una revisione non dichiarata non diventa zero", ()=>{
  // Number(null) è 0, e 0 come base significherebbe "sovrascrivi qualunque
  // cosa ci sia": un metadato mancante deve far fallire la cache, non passarci.
  for(const base of [null, undefined, "3", 1.5, -1, NaN])
    assert.throws(()=>makePendingCache({campaignId:"c1", state:state("X"), baseRevision:base}));
});

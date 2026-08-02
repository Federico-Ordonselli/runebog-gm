"use client";

import { useCallback, useEffect, useState } from "react";

/* «Tieni le regole anche senza rete»: il secondo livello della copia offline.
 *
 * L'editor si precarica da sé (public/app/offline.js) perché costa zero — chi è
 * su /app.html quei file li ha appena scaricati. Queste 61 pagine costano 1,38
 * MB, più 149 KB di chunk perché la ricerca funzioni anche qui (misurato il 2
 * ago 2026, trasferito): 1,5 MB che sulla connessione di un telefono non si
 * prendono senza chiedere — da qui la differenza fra i due livelli, che non è
 * tecnica ma di costo.
 *
 * Per la stessa ragione la misura sta SUL bottone e non in una nota sotto: una
 * domanda a cui si può rispondere è una domanda che dice quanto costa.
 *
 * Il service worker può non esserci ancora (su /srd non lo registra nessuno):
 * ci pensa il primo clic. È l'unico posto dell'app in cui l'installazione è un
 * atto esplicito, ed è coerente — è anche l'unico in cui si scarica qualcosa
 * che non si stava già scaricando. */

type Stato = "ignoto" | "assente" | "in-corso" | "presente" | "errore";

export function OffLineRegole() {
  const [stato, setStato] = useState<Stato>("ignoto");
  const [pagine, setPagine] = useState(0);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const ascolta = (ev: MessageEvent) => {
      const d = ev.data || {};
      if (d.tipo === "stato") {
        setPagine(d.pagine || 0);
        setStato(d.presenti ? "presente" : "assente");
      } else if (d.tipo === "regole-fatto") {
        if (d.pagine) setPagine(d.pagine);
        setStato("presente");
      }
      else if (d.tipo === "regole-errore") setStato("errore");
      else if (d.tipo === "regole-tolte") setStato("assente");
    };
    navigator.serviceWorker.addEventListener("message", ascolta);

    /* `ready` e non `register`: se il worker c'è già (installato dall'editor)
       si vuole sapere lo stato senza installarlo una seconda volta, e se non
       c'è si resta in "ignoto" — cioè il bottone non compare finché non si sa
       cosa dire. Un bottone che promette e poi si corregge è peggio di uno che
       arriva un istante dopo. */
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return setStato("assente");
      navigator.serviceWorker.ready.then((r) =>
        r.active?.postMessage({ tipo: "stato" }),
      );
    });

    return () => navigator.serviceWorker.removeEventListener("message", ascolta);
  }, []);

  const chiedi = useCallback(async (tipo: string) => {
    const reg =
      (await navigator.serviceWorker.getRegistration()) ??
      (await navigator.serviceWorker.register("/sw.js"));
    /* `ready` aspetta che sia ATTIVO: appena registrato è ancora in
       installazione, e un postMessage a `reg.installing` non arriva. */
    await navigator.serviceWorker.ready;
    (reg.active ?? (await navigator.serviceWorker.ready).active)?.postMessage({ tipo });
  }, []);

  if (stato === "ignoto") return null;

  const scarica = () => {
    setStato("in-corso");
    chiedi("scarica-regole").catch(() => setStato("errore"));
  };

  return (
    <p className="srd-offline">
      {stato === "presente" ? (
        <>
          <span className="muted small">
            Le {pagine} pagine delle regole sono sul dispositivo: si consultano
            anche senza rete.
          </span>{" "}
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={() => chiedi("dimentica-regole")}
          >
            Libera lo spazio
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="btn btn--sm"
            onClick={scarica}
            disabled={stato === "in-corso"}
          >
            {stato === "in-corso"
              ? "Scarico le regole…"
              : "Tieni le regole senza rete — 1,5 MB"}
          </button>{" "}
          <span className="muted small">
            {stato === "errore"
              ? "Non è riuscito: riprova quando la rete è stabile."
              : "Da consultare al tavolo anche dove non prende."}
          </span>
        </>
      )}
    </p>
  );
}

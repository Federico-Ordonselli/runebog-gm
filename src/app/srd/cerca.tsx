"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* La ricerca trasversale ai dieci capitoli.
 *
 * Il filtro dell'indice laterale cerca dentro UN capitolo, e al tavolo il
 * capitolo è proprio ciò che non si sa: chi cerca "afferrato" non sa che sta
 * nel glossario, e chi cerca "palla di fuoco" non deve passare da Incantesimi →
 * 3º livello per trovarla.
 *
 * L'indice arriva da /srd/ancore.json alla prima interazione, non al
 * caricamento della pagina: chi apre /srd per scegliere un capitolo non paga
 * niente. Da lì in poi è tutto in memoria, quindi filtrare è istantaneo anche
 * con la connessione che si ha in una cantina. */

type Compatto = { pagine: [string, string][]; ancore: [string, number, string][] };
type Voce = { testo: string; chiave: string; href: string; pagina: string };

/* Come nell'indice laterale: senza accenti e senza maiuscole, che al tavolo si
   digita di fretta. NFKD e non NFD per la stessa ragione per cui lo fa lo slug
   dell'estrattore — scioglie anche le legature, se un domani ne uscisse una. */
const normalizza = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/* Quanti risultati mostrare. Oltre questa soglia la risposta non è un elenco ma
   un invito a scrivere una lettera in più. */
const MAX = 40;

/* L'ordine dei risultati: prima chi comincia con ciò che si è scritto, poi chi
   ce l'ha all'inizio di una parola, poi tutti gli altri. Cercando "arma" la
   voce "Arma" deve battere "Competenza nelle armi", e senza rango vincerebbe
   l'ordine dei capitoli. */
function rango(chiave: string, q: string): number | null {
  const i = chiave.indexOf(q);
  if (i < 0) return null;
  if (i === 0) return 0;
  return /[\s'(\[«"-]/.test(chiave[i - 1]) ? 1 : 2;
}

export function CercaNelleRegole() {
  const [q, setQ] = useState("");
  const [voci, setVoci] = useState<Voce[] | null>(null);
  const [errore, setErrore] = useState(false);
  const chiesto = useRef(false);

  /* Una sola richiesta, alla prima interazione vera (fuoco o testo). */
  const carica = () => {
    if (chiesto.current) return;
    chiesto.current = true;
    fetch("/srd/ancore.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: Compatto) =>
        setVoci(d.ancore.map(([testo, i, frammento]) => ({
          testo,
          chiave: normalizza(testo),
          href: d.pagine[i][0] + (frammento ? `#${frammento}` : ""),
          pagina: d.pagine[i][1],
        }))),
      )
      .catch(() => setErrore(true));
  };

  /* Il filtro dell'indice di un capitolo, quando non trova niente, manda qui
     con la ricerca già scritta: è il punto in cui si scopre che il termine sta
     in un altro capitolo. Si legge una volta all'avvio e non si tocca più — la
     query vive nel campo, non nell'indirizzo, sennò ogni tasto premuto
     lascerebbe una voce nella cronologia. */
  useEffect(() => {
    const iniziale = new URLSearchParams(window.location.search).get("q");
    if (iniziale) { setQ(iniziale); carica(); }
  }, []);

  const trovate = useMemo(() => {
    const cercato = normalizza(q.trim());
    if (!cercato || !voci) return null;
    return voci
      .map((v) => ({ v, r: rango(v.chiave, cercato) }))
      .filter((x): x is { v: Voce; r: number } => x.r !== null)
      .sort((a, b) =>
        a.r - b.r
        || a.v.testo.length - b.v.testo.length
        || a.v.testo.localeCompare(b.v.testo, "it"))
      .map((x) => x.v);
  }, [q, voci]);

  const mostrate = trovate?.slice(0, MAX);

  return (
    <search className="srd-cerca">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          /* Scrivere e battere Invio porta al primo risultato: al tavolo è il
             percorso più corto, e senza sarebbe scrivere, staccare la mano e
             puntare. */
          if (mostrate?.length) window.location.href = mostrate[0].href;
        }}
      >
        <input
          className="input srd-cerca__campo"
          type="search"
          value={q}
          onFocus={carica}
          onChange={(e) => { carica(); setQ(e.target.value); }}
          placeholder="Cerca in tutte le regole…"
          aria-label="Cerca in tutte le regole"
          autoComplete="off"
        />
      </form>

      {errore && (
        <p className="muted small srd-cerca__stato">
          L’indice della ricerca non si è caricato. I capitoli qui sotto restano
          consultabili.
        </p>
      )}

      {q.trim() && !voci && !errore && (
        <p className="muted small srd-cerca__stato">Carico l’indice…</p>
      )}

      {trovate && (
        <>
          <p className="muted small srd-cerca__stato" role="status">
            {trovate.length === 0
              ? `Nessuna voce per «${q.trim()}».`
              : trovate.length > MAX
                ? `${trovate.length} voci: ecco le prime ${MAX}.`
                : `${trovate.length} ${trovate.length === 1 ? "voce" : "voci"}.`}
          </p>
          {mostrate && mostrate.length > 0 && (
            <ul className="srd-cerca__esiti">
              {mostrate.map((v) => (
                <li key={v.href + v.testo}>
                  <a href={v.href} className="srd-cerca__esito">
                    <span className="srd-cerca__testo">{v.testo}</span>
                    <span className="muted small srd-cerca__dove">{v.pagina}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </search>
  );
}

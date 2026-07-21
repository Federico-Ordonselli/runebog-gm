"use client";

import { useMemo, useState } from "react";

export type Voce = { id: string; testo: string; livello: 2 | 3 | 4 };

/** L'indice laterale del capitolo, con filtro. Il glossario ha 154 voci: senza
 *  un campo di ricerca l'indice sarebbe un muro da scorrere, e il capitolo si
 *  consulta al tavolo, di corsa, cercando un termine preciso.
 *
 *  Il confronto è senza accenti e senza maiuscole: chi cerca "abilita" o
 *  "AFFERRATO" deve trovare "Abilità" e "Afferrato [condizione]". */
const normalizza = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function IndiceCapitolo({ voci }: { voci: Voce[] }) {
  const [filtro, setFiltro] = useState("");

  const visibili = useMemo(() => {
    const q = normalizza(filtro.trim());
    if (!q) return voci;
    return voci.filter((v) => normalizza(v.testo).includes(q));
  }, [voci, filtro]);

  return (
    <nav className="srd-indice" aria-label="Indice del capitolo">
      <input
        className="input srd-indice__filtro"
        type="search"
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Filtra le voci…"
        aria-label="Filtra le voci del capitolo"
      />
      {visibili.length === 0 ? (
        /* Il filtro cerca dentro QUESTO capitolo, e chi non trova niente il più
           delle volte sta cercando nel capitolo sbagliato: da qui si passa alla
           ricerca trasversale con la parola già scritta, invece di tornare
           all'indice e ricominciare. */
        <p className="muted small srd-indice__vuoto">
          Nessuna voce per «{filtro}» in questo capitolo.{" "}
          <a href={`/srd?q=${encodeURIComponent(filtro.trim())}`} className="link">
            Cerca in tutte le regole →
          </a>
        </p>
      ) : (
        <ol className="srd-indice__lista">
          {visibili.map((v) => (
            <li key={v.id} className={`srd-indice__voce srd-indice__voce--l${v.livello}`}>
              <a href={`#${v.id}`} className="link link--quiet">{v.testo}</a>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}

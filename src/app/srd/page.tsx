import { ATTRIBUZIONE_SRD, CAPITOLI } from "@/lib/srd";
import { CercaNelleRegole } from "./cerca";
import "./srd.css";

export const metadata = {
  title: "Regole SRD 5.2.1 in italiano — Runebog GM",
  description:
    "I dieci capitoli del System Reference Document 5.2.1 consultabili in italiano: classi, incantesimi, equipaggiamento, oggetti magici, glossario delle regole. Testo ufficiale CC-BY-4.0.",
};

export default function SrdPage() {
  const pronti = CAPITOLI.filter((c) => c.pronto);
  const inArrivo = CAPITOLI.filter((c) => !c.pronto);

  return (
    <main className="page page--wide srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          Regole
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small"><a href="/" className="link link--quiet">← Runebog GM</a></p>
      </div>

      <p className="lede">
        Il regolamento ufficiale della quinta edizione, nella traduzione italiana del
        System Reference Document 5.2.1. Consultabile, ricercabile, gratis.
      </p>

      {/* La ricerca prima dell'elenco: chi arriva qui ha in mano un termine —
          "afferrato", "palla di fuoco" — molto più spesso del nome del capitolo
          che lo contiene. L'elenco resta sotto, per chi vuole leggere. */}
      <CercaNelleRegole />

      <ul className="srd-capitoli">
        {pronti.map((c) => (
          <li key={c.id} className="srd-capitoli__voce">
            <a href={`/srd/${c.id}`} className="srd-capitoli__link">
              <span className="srd-capitoli__titolo">{c.titolo}</span>
              <span className="muted small">{c.sommario}</span>
            </a>
          </li>
        ))}
      </ul>

      {inArrivo.length > 0 && (
        <>
          <h2 className="srd-h2">In arrivo</h2>
          <p className="muted small">
            La sezione cresce un capitolo alla volta: ogni testo viene estratto dal PDF
            ufficiale e verificato prima di essere pubblicato.
          </p>
          <ul className="srd-capitoli srd-capitoli--attesa">
            {inArrivo.map((c) => (
              <li key={c.id} className="srd-capitoli__voce">
                <span className="srd-capitoli__link" aria-disabled="true">
                  <span className="srd-capitoli__titolo">{c.titolo}</span>
                  <span className="muted small">{c.sommario}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      <hr className="rule" />
      <p className="muted small srd-attribuzione">{ATTRIBUZIONE_SRD}</p>
    </main>
  );
}

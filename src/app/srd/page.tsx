import { CAPITOLI } from "@/lib/srd";
import { tuttiIMostri } from "@/lib/srd/mostri";
import { Attribuzione } from "./attribuzione";
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
  const mostri = tuttiIMostri().length;

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
        {/* I mostri chiudono l'elenco perché è il loro posto nel PDF, ma la voce
            è scritta qui e non in CAPITOLI: quel registro elenca i capitoli che
            passano dall'estrattore delle regole e vivono in `capitoli/*.json`, e
            metterci i mostri vorrebbe dire che `[capitolo]` prova a caricare un
            JSON che non esiste. Il bestiario ha una sorgente sua
            (`public/app/srd-mostri.js`, lo stesso file che usa l'app) e pagine
            sue: è un'altra cosa che si consulta allo stesso modo. */}
        <li className="srd-capitoli__voce">
          <a href="/srd/mostri" className="srd-capitoli__link">
            <span className="srd-capitoli__titolo">Mostri</span>
            <span className="muted small">
              Le {mostri} schede del bestiario, per tipo di creatura e per grado di sfida.
            </span>
          </a>
        </li>
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

      <Attribuzione />
    </main>
  );
}

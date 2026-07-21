import { notFound } from "next/navigation";
import { ATTRIBUZIONE_SRD, CAPITOLI, CAPITOLI_A_PIU_PAGINE, caricaCapitolo } from "@/lib/srd";
import { rimandiDi } from "@/lib/srd/ancore";
import { Blocchi } from "../blocchi";
import { IndiceCapitolo, type Voce } from "../indice";
import "../srd.css";

/* Solo i capitoli già generati: gli altri sono elencati su /srd ma non hanno
   ancora una pagina, e devono dare 404, non una pagina vuota. I due capitoli
   lunghi (Incantesimi per livello, Oggetti magici per categoria) hanno rotte
   statiche proprie e non passano di qui. */
export function generateStaticParams() {
  return CAPITOLI.filter((c) => c.pronto && !CAPITOLI_A_PIU_PAGINE.includes(c.id))
    .map((c) => ({ capitolo: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ capitolo: string }> }) {
  const { capitolo } = await params;
  const meta = CAPITOLI.find((c) => c.id === capitolo && c.pronto);
  if (!meta) return {};
  return {
    title: `${meta.titolo} — Regole SRD 5.2.1 in italiano — Runebog GM`,
    description: meta.sommario,
  };
}

export default async function CapitoloPage({ params }: { params: Promise<{ capitolo: string }> }) {
  const { capitolo } = await params;
  const doc = await caricaCapitolo(capitolo);
  if (!doc) notFound();

  const voci: Voce[] = doc.blocchi.flatMap((b) =>
    b.t === "h2" || b.t === "h3" || b.t === "h4"
      ? [{ id: b.id, testo: b.testo, livello: b.t === "h2" ? 2 : b.t === "h3" ? 3 : 4 }]
      : [],
  );

  return (
    <main className="page page--srd srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          {doc.titolo}
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small"><a href="/srd" className="link link--quiet">← Regole</a></p>
      </div>

      <div className="srd-corpo">
        <IndiceCapitolo voci={voci} />
        <article className="srd-testo">
          <Blocchi blocchi={doc.blocchi} rimandi={await rimandiDi(capitolo)} />
          <hr className="rule" />
          <p className="muted small srd-attribuzione">{ATTRIBUZIONE_SRD}</p>
        </article>
      </div>
    </main>
  );
}

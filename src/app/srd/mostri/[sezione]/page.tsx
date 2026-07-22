import { notFound } from "next/navigation";
import {
  SEZIONI_MOSTRI, mostriDellaSezione, sezioneMostriDaSlug, slugMostro,
} from "@/lib/srd/mostri";
import { Attribuzione } from "../../attribuzione";
import { SchedaMostro } from "../scheda";
import "../../srd.css";

/* Le schede di una sezione del bestiario. Una sezione è un tipo di creatura,
   tranne Bestie e Draghi che sono spezzati per peso: il perché di entrambe le
   cose sta in src/lib/srd/mostri.ts, accanto al registro. */

export function generateStaticParams() {
  return SEZIONI_MOSTRI.map((s) => ({ sezione: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ sezione: string }> }) {
  const s = sezioneMostriDaSlug((await params).sezione);
  if (!s) return {};
  const n = mostriDellaSezione(s.slug).length;
  return {
    title: `${s.titolo} — Mostri — Regole SRD 5.2.1 in italiano — Runebog GM`,
    description:
      `${n} schede mostro dell'SRD 5.2.1 in italiano (${s.titolo}): ` +
      "statistiche, tratti, azioni e grado di sfida.",
  };
}

export default async function SezionePage({ params }: { params: Promise<{ sezione: string }> }) {
  const s = sezioneMostriDaSlug((await params).sezione);
  if (!s) notFound();
  const mostri = mostriDellaSezione(s.slug);
  if (!mostri.length) notFound();

  return (
    <main className="page page--wide srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          {s.titolo}
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small"><a href="/srd/mostri" className="link link--quiet">← Mostri</a></p>
      </div>

      <p className="muted small">
        {mostri.length} {mostri.length === 1 ? "scheda" : "schede"}.
      </p>

      {/* I nomi in cima, come nelle pagine dei livelli di incantesimo: una
          pagina di schede è lunga, e chi arriva qui sa già quale creatura
          cerca. */}
      <ul className="srd-nomi">
        {mostri.map((m) => (
          <li key={m.name}>
            <a href={`#${slugMostro(m.name)}`} className="link link--quiet">{m.name}</a>
          </li>
        ))}
      </ul>

      <div className="srd-testo">
        {mostri.map((m) => <SchedaMostro key={m.name} m={m} />)}
      </div>

      {/* Le altre sezioni in fondo: si salta senza tornare all'indice, come fra
          i livelli degli incantesimi. */}
      <nav className="srd-livelli-nav" aria-label="Le altre sezioni del bestiario">
        {SEZIONI_MOSTRI.map((x) =>
          x.slug === s.slug ? (
            <span key={x.slug} className="srd-livelli-nav__qui" aria-current="page">{x.titolo}</span>
          ) : (
            <a key={x.slug} href={`/srd/mostri/${x.slug}`} className="link link--quiet">{x.titolo}</a>
          ),
        )}
      </nav>

      <Attribuzione />
    </main>
  );
}

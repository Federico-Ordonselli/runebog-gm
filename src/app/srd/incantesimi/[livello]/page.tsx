import { notFound } from "next/navigation";
import {
  ATTRIBUZIONE_SRD, LIVELLI, caricaCapitolo, dividiIncantesimi,
  livelloDaSlug, slugLivello, titoloLivello,
} from "@/lib/srd";
import { rimandiDi } from "@/lib/srd/ancore";
import { Blocchi } from "../../blocchi";
import { IndiceCapitolo, type Voce } from "../../indice";
import "../../srd.css";

export function generateStaticParams() {
  return LIVELLI.map((n) => ({ livello: slugLivello(n) }));
}

export async function generateMetadata({ params }: { params: Promise<{ livello: string }> }) {
  const { livello } = await params;
  const n = livelloDaSlug(livello);
  if (n === null) return {};
  return {
    title: `${titoloLivello(n)} — Regole SRD 5.2.1 in italiano — Runebog GM`,
    description: `Le descrizioni complete degli incantesimi ${
      n === 0 ? "di livello 0 (trucchetti)" : `di ${n}º livello`
    } dell'SRD 5.2.1 in italiano.`,
  };
}

export default async function LivelloPage({ params }: { params: Promise<{ livello: string }> }) {
  const { livello } = await params;
  const n = livelloDaSlug(livello);
  if (n === null) notFound();

  const doc = await caricaCapitolo("incantesimi");
  if (!doc) notFound();
  const dellivello = dividiIncantesimi(doc).incantesimi.filter((s) => s.livello === n);
  if (!dellivello.length) notFound();

  /* L'indice laterale elenca solo gli incantesimi, non i titoli interni alle
     loro descrizioni (le schede delle creature evocate): con un incantesimo
     per riga la pagina si scorre già col dito. */
  const voci: Voce[] = dellivello.map((s) => ({ id: s.id, testo: s.nome, livello: 3 }));

  return (
    <main className="page page--srd srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          {titoloLivello(n)}
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small">
          <a href="/srd/incantesimi" className="link link--quiet">← Incantesimi</a>
        </p>
      </div>

      <div className="srd-corpo">
        <IndiceCapitolo voci={voci} />
        <article className="srd-testo">
          <Blocchi blocchi={dellivello.flatMap((s) => s.blocchi)} rimandi={await rimandiDi("incantesimi")} />

          <nav className="srd-livelli-nav">
            {LIVELLI.map((m) => (
              m === n
                ? <span key={m} className="srd-livelli-nav__qui">{m === 0 ? "Trucchetti" : `${m}º`}</span>
                : <a key={m} href={`/srd/incantesimi/${slugLivello(m)}`} className="link link--quiet">
                    {m === 0 ? "Trucchetti" : `${m}º`}
                  </a>
            ))}
          </nav>

          <hr className="rule" />
          <p className="muted small srd-attribuzione">{ATTRIBUZIONE_SRD}</p>
        </article>
      </div>
    </main>
  );
}

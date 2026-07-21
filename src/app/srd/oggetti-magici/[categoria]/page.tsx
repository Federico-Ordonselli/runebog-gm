import { notFound } from "next/navigation";
import {
  ATTRIBUZIONE_SRD, SEZIONI_OGGETTI, caricaCapitolo, dividiOggetti, nellaSezione,
  sezioneDaSlug,
} from "@/lib/srd";
import { rimandiDi } from "@/lib/srd/ancore";
import { Blocchi } from "../../blocchi";
import { IndiceCapitolo, type Voce } from "../../indice";
import "../../srd.css";

export function generateStaticParams() {
  return SEZIONI_OGGETTI.map((s) => ({ categoria: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ categoria: string }> }) {
  const { categoria } = await params;
  const s = sezioneDaSlug(categoria);
  if (!s) return {};
  return {
    title: `${s.titolo} — Oggetti magici — Regole SRD 5.2.1 in italiano — Runebog GM`,
    description: `Le descrizioni complete degli oggetti magici della categoria "${s.titolo}" dell'SRD 5.2.1 in italiano.`,
  };
}

export default async function CategoriaPage({ params }: { params: Promise<{ categoria: string }> }) {
  const { categoria } = await params;
  const sezione = sezioneDaSlug(categoria);
  if (!sezione) notFound();

  const doc = await caricaCapitolo("oggetti-magici");
  if (!doc) notFound();
  const suoi = dividiOggetti(doc).oggetti.filter((o) => nellaSezione(o, sezione));
  if (!suoi.length) notFound();

  /* L'indice laterale elenca solo gli oggetti, non i titoli interni alle loro
     descrizioni (le schede di creatura dell'Avatar della morte e della Mosca
     gigante): con un oggetto per riga la pagina si scorre già col dito. */
  const voci: Voce[] = suoi.map((o) => ({ id: o.id, testo: o.nome, livello: 3 }));

  return (
    <main className="page page--srd srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          {sezione.titolo}
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small">
          <a href="/srd/oggetti-magici" className="link link--quiet">← Oggetti magici</a>
        </p>
      </div>

      <div className="srd-corpo">
        <IndiceCapitolo voci={voci} />
        <article className="srd-testo">
          <Blocchi blocchi={suoi.flatMap((o) => o.blocchi)} rimandi={await rimandiDi("oggetti-magici")} />

          <nav className="srd-livelli-nav">
            {SEZIONI_OGGETTI.map((s) => (
              s.slug === sezione.slug
                ? <span key={s.slug} className="srd-livelli-nav__qui">{s.titolo}</span>
                : <a key={s.slug} href={`/srd/oggetti-magici/${s.slug}`} className="link link--quiet">
                    {s.titolo}
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

import { notFound } from "next/navigation";
import { caricaCapitolo, dividiClassi } from "@/lib/srd";
import { rimandiDi } from "@/lib/srd/ancore";
import { Attribuzione } from "../../attribuzione";
import { Blocchi } from "../../blocchi";
import { IndiceCapitolo, type Voce } from "../../indice";
import "../../srd.css";

/* L'elenco delle classi lo dà il capitolo, non un registro a parte: sono i suoi
   h2, e un registro separato sarebbe una seconda verità da tenere allineata. */
async function classi() {
  const doc = await caricaCapitolo("classi");
  return doc ? dividiClassi(doc) : [];
}

export async function generateStaticParams() {
  return (await classi()).map((c) => ({ classe: c.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ classe: string }> }) {
  const { classe } = await params;
  const c = (await classi()).find((x) => x.id === classe);
  if (!c) return {};
  return {
    title: `${c.nome} — Classi — Regole SRD 5.2.1 in italiano — Runebog GM`,
    description:
      `La classe ${c.nome.toLowerCase()} dell'SRD 5.2.1 in italiano: tratti, ` +
      `tabella di avanzamento e privilegi di classe livello per livello.`,
  };
}

export default async function ClassePage({ params }: { params: Promise<{ classe: string }> }) {
  const { classe } = await params;
  const tutte = await classi();
  const c = tutte.find((x) => x.id === classe);
  if (!c) notFound();

  /* L'indice laterale salta l'h2, che è il titolo della pagina: ripeterlo in
     cima all'elenco sarebbe una voce che porta dove si è già. */
  const voci: Voce[] = c.blocchi.flatMap((b) =>
    b.t === "h3" || b.t === "h4"
      ? [{ id: b.id, testo: b.testo, livello: b.t === "h3" ? 3 : 4 }]
      : [],
  );

  return (
    <main className="page page--srd srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          {c.nome}
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small"><a href="/srd/classi" className="link link--quiet">← Classi</a></p>
      </div>

      <div className="srd-corpo">
        <IndiceCapitolo voci={voci} />
        <article className="srd-testo">
          {/* Senza l'h2: è il titolo della pagina, che sta già in cima. */}
          <Blocchi blocchi={c.blocchi.slice(1)} rimandi={await rimandiDi("classi")} />

          <nav className="srd-livelli-nav">
            {tutte.map((x) => (
              x.id === c.id
                ? <span key={x.id} className="srd-livelli-nav__qui">{x.nome}</span>
                : <a key={x.id} href={`/srd/classi/${x.id}`} className="link link--quiet">{x.nome}</a>
            ))}
          </nav>

          <Attribuzione />
        </article>
      </div>
    </main>
  );
}

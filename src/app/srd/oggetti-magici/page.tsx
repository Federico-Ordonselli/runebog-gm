import { notFound } from "next/navigation";
import {
  SEZIONI_OGGETTI, caricaCapitolo, dividiOggetti, nellaSezione,
} from "@/lib/srd";
import { rimandiDi } from "@/lib/srd/ancore";
import { Attribuzione } from "../attribuzione";
import { Blocchi } from "../blocchi";
import "../srd.css";

/* Questa rotta statica ha la precedenza sul segmento dinamico [capitolo], che
   infatti esclude "oggetti-magici" dai suoi generateStaticParams: 258 oggetti in
   una pagina sola sono 942 KB di HTML, il triplo del glossario. */

export const metadata = {
  title: "Oggetti magici — Regole SRD 5.2.1 in italiano — Runebog GM",
  description:
    "I 258 oggetti magici dell'SRD 5.2.1 in italiano: anelli, armi, armature, " +
    "bacchette, bastoni, pergamene, pozioni, verghe e oggetti meravigliosi, " +
    "con rarità, sintonia e descrizione completa.",
};

export default async function OggettiMagiciPage() {
  const doc = await caricaCapitolo("oggetti-magici");
  if (!doc) notFound();
  const { intro, catalogo, oggetti } = dividiOggetti(doc);
  const rimandi = await rimandiDi("oggetti-magici");

  return (
    <main className="page page--wide srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          {doc.titolo}
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small"><a href="/srd" className="link link--quiet">← Regole</a></p>
      </div>

      {/* L'elenco prima delle regole, come per gli incantesimi: chi apre questa
          pagina ha in mano il nome di un oggetto e vuole la sua scheda, non le
          regole sulla sintonia. Il titolo se lo porta dal capitolo. */}
      <article className="srd-testo">
        <Blocchi blocchi={catalogo} rimandi={rimandi} />
      </article>

      {SEZIONI_OGGETTI.map((s) => {
        const suoi = oggetti.filter((o) => nellaSezione(o, s));
        if (!suoi.length) return null;
        return (
          <section key={s.slug} className="srd-livello">
            <h3 className="srd-h3">
              <a href={`/srd/oggetti-magici/${s.slug}`} className="link">{s.titolo}</a>
              <span className="muted small"> · {suoi.length}</span>
            </h3>
            <ul className="srd-nomi">
              {suoi.map((o) => (
                <li key={o.id}>
                  <a href={`/srd/oggetti-magici/${s.slug}#${o.id}`} className="link link--quiet">
                    {o.nome}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <h2 className="srd-h2">Usare gli oggetti magici</h2>
      <article className="srd-testo">
        <Blocchi blocchi={intro} rimandi={rimandi} />
      </article>

      <Attribuzione />
    </main>
  );
}

import { notFound } from "next/navigation";
import {
  LIVELLI, caricaCapitolo, dividiIncantesimi,
  slugLivello, titoloLivello,
} from "@/lib/srd";
import { rimandiDi } from "@/lib/srd/ancore";
import { Attribuzione } from "../attribuzione";
import { Blocchi } from "../blocchi";
import "../srd.css";

/* Questa rotta statica ha la precedenza sul segmento dinamico [capitolo], che
   infatti esclude "incantesimi" dai suoi generateStaticParams: il capitolo più
   lungo dell'SRD si consulta per livello, non tutto in una pagina. */

export const metadata = {
  title: "Incantesimi — Regole SRD 5.2.1 in italiano — Runebog GM",
  description:
    "I 339 incantesimi dell'SRD 5.2.1 in italiano, dai trucchetti al 9º livello: " +
    "tempo di lancio, gittata, componenti, durata e descrizione completa.",
};

export default async function IncantesimiPage() {
  const doc = await caricaCapitolo("incantesimi");
  if (!doc) notFound();
  const { intro, incantesimi } = dividiIncantesimi(doc);

  return (
    <main className="page page--wide srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          {doc.titolo}
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small"><a href="/srd" className="link link--quiet">← Regole</a></p>
      </div>

      {/* L'elenco prima delle regole di lancio: chi apre questa pagina cerca un
          incantesimo, e farlo scorrere oltre tre pagine di prosa per arrivarci
          sarebbe l'indice del PDF, non una pagina da consultare al tavolo. */}
      {LIVELLI.map((n) => {
        const dellivello = incantesimi.filter((s) => s.livello === n);
        if (!dellivello.length) return null;
        return (
          <section key={n} className="srd-livello">
            <h3 className="srd-h3">
              <a href={`/srd/incantesimi/${slugLivello(n)}`} className="link">
                {titoloLivello(n)}
              </a>
              <span className="muted small"> · {dellivello.length}</span>
            </h3>
            <ul className="srd-nomi">
              {dellivello.map((s) => (
                <li key={s.id}>
                  <a href={`/srd/incantesimi/${slugLivello(n)}#${s.id}`} className="link link--quiet">
                    {s.nome}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <h2 className="srd-h2">Lanciare gli incantesimi</h2>
      <article className="srd-testo">
        <Blocchi blocchi={intro} rimandi={await rimandiDi("incantesimi")} />
      </article>

      <Attribuzione />
    </main>
  );
}

import { notFound } from "next/navigation";
import { cartaClasse, caricaCapitolo, dividiClassi } from "@/lib/srd";
import { Attribuzione } from "../attribuzione";
import "../srd.css";

/* Questa rotta statica ha la precedenza sul segmento dinamico [capitolo], che
   infatti esclude "classi" dai suoi generateStaticParams: le dodici classi in
   una pagina sola sono 340 KB di testo, quasi un mega di HTML. */

export const metadata = {
  title: "Classi — Regole SRD 5.2.1 in italiano — Runebog GM",
  description:
    "Le dodici classi dell'SRD 5.2.1 in italiano: barbaro, bardo, chierico, " +
    "druido, guerriero, ladro, mago, monaco, paladino, ranger, stregone e " +
    "warlock, con tabella di avanzamento, privilegi livello per livello, liste " +
    "di incantesimi e una sottoclasse ciascuna.",
};

export default async function ClassiPage() {
  const doc = await caricaCapitolo("classi");
  if (!doc) notFound();
  const classi = dividiClassi(doc);

  return (
    <main className="page srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          {doc.titolo}
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small"><a href="/srd" className="link link--quiet">← Regole</a></p>
      </div>

      {/* Nessuna prosa introduttiva: il capitolo del PDF non ne ha, comincia
          direttamente col Barbaro. Quindi l'indice è la scelta della classe, e
          porta con sé ciò che si confronta prima di aprirne una. */}
      <ul className="srd-classi">
        {classi.map((c) => {
          const carta = cartaClasse(c);
          return (
            <li key={c.id}>
              <a href={`/srd/classi/${c.id}`} className="srd-capitoli__link">
                <span className="srd-capitoli__titolo">{c.nome}</span>
                <span className="muted small srd-classi__tratti">
                  {[carta.primaria, carta.dado].filter(Boolean).join(" · ")}
                </span>
                {carta.sottoclasse && (
                  <span className="muted small srd-classi__sotto">{carta.sottoclasse}</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>

      <Attribuzione />
    </main>
  );
}

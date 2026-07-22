import {
  SEZIONI_MOSTRI, gradoDi, hrefMostro, mostriDellaSezione, mostriSenzaTipo,
  tuttiIMostri, valoreGrado,
} from "@/lib/srd/mostri";
import { Attribuzione } from "../attribuzione";
import "../srd.css";

export const metadata = {
  title: "Mostri — Regole SRD 5.2.1 in italiano — Runebog GM",
  description:
    "Le 331 schede mostro dell'SRD 5.2.1 in italiano: statistiche, tratti, azioni e " +
    "grado di sfida, dal ratto all'antico drago rosso. Testo ufficiale CC-BY-4.0.",
};

export default function MostriPage() {
  const mostri = tuttiIMostri();

  /* Guardia: le schede pubblicate devono essere tutte quelle che ci sono. Una
     creatura il cui tipo non riconosciamo non finirebbe su nessuna pagina e
     sparirebbe in silenzio — che in una sezione di consultazione vuol dire un
     mostro che al tavolo non si trova, senza che niente si sia rotto. */
  const orfani = mostriSenzaTipo();
  if (orfani.length) {
    throw new Error(
      `${orfani.length} schede non dichiarano un tipo di creatura noto ` +
      `(${orfani.slice(0, 3).map((m) => m.name).join(", ")}…): ` +
      "nessuna pagina le servirebbe. Aggiorna TIPI_CREATURA in src/lib/srd/mostri.ts.",
    );
  }

  /* I gradi di sfida in ordine di numero e non di carattere: "1/8" prima di
     "1", "10" dopo "9". */
  const gradi = [...new Set(mostri.map(gradoDi))]
    .sort((a, b) => valoreGrado(a) - valoreGrado(b));

  return (
    <main className="page page--wide srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          Mostri
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small"><a href="/srd" className="link link--quiet">← Regole</a></p>
      </div>

      <p className="lede">
        Le {mostri.length} schede del bestiario ufficiale, in italiano. Sono le stesse
        che l'editor di mappe attacca a un incontro: qui si leggono, lì si tirano i
        punti ferita.
      </p>

      {/* I tipi per primi, perché sono le pagine. Poi l'elenco completo per chi
          ha in mano un nome, e i gradi di sfida per chi ha in mano un incontro
          da bilanciare: sono i due modi in cui si apre un bestiario, e nessuno
          dei due è l'indice dei tipi. */}
      <h2 className="srd-h2">Per tipo di creatura</h2>
      {/* La stessa griglia di carte delle dodici classi: voci corte da
          confrontare a colpo d'occhio, non un elenco da scorrere. Sono sezioni
          e non tipi: Bestie e Draghi compaiono spezzati, dov'è il loro peso. */}
      <ul className="srd-capitoli srd-classi">
        {SEZIONI_MOSTRI.map((s) => {
          const n = mostriDellaSezione(s.slug).length;
          return (
            <li key={s.slug} className="srd-capitoli__voce">
              <a href={`/srd/mostri/${s.slug}`} className="srd-capitoli__link">
                <span className="srd-capitoli__titolo">{s.titolo}</span>
                <span className="muted small">{n} {n === 1 ? "scheda" : "schede"}</span>
              </a>
            </li>
          );
        })}
      </ul>

      <h2 className="srd-h2">Tutte le schede</h2>
      <ul className="srd-nomi">
        {mostri.map((m) => (
          <li key={m.name}>
            <a href={hrefMostro(m)!} className="link link--quiet">{m.name}</a>
            <span className="muted small srd-mostri__gs"> GS {gradoDi(m)}</span>
          </li>
        ))}
      </ul>

      <h2 className="srd-h2">Per grado di sfida</h2>
      <p className="muted small">
        Quanto pesa una creatura in un incontro. È l’ordine con cui si sfoglia un
        bestiario mentre si prepara la sessione, invece che durante.
      </p>
      {gradi.map((g) => {
        const delGrado = mostri.filter((m) => gradoDi(m) === g);
        return (
          <section key={g} className="srd-livello">
            <h3 className="srd-h3">
              GS {g}
              <span className="muted small"> · {delGrado.length}</span>
            </h3>
            <ul className="srd-nomi">
              {delGrado.map((m) => (
                <li key={m.name}>
                  <a href={hrefMostro(m)!} className="link link--quiet">{m.name}</a>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Attribuzione />
    </main>
  );
}

import { caricaInformazioniLegali } from "@/lib/srd";
import { REPO_URL } from "@/lib/site";
import { Attribuzione } from "../attribuzione";
import { Blocchi, collegaIndirizzi } from "../blocchi";
import "../srd.css";

export const metadata = {
  title: "Informazioni legali — Regole SRD 5.2.1 in italiano — Runebog GM",
  description:
    "I termini con cui il System Reference Document 5.2.1 è concesso in licenza: "
    + "la pagina 1 del documento ufficiale, riprodotta integralmente.",
};

/** La pagina 1 del PDF: la licenza del testo che tutta la sezione pubblica.
 *
 *  Non ha indice laterale perché non ha titoli — l'unico è quello della pagina,
 *  che qui è il titolo del documento. Non è una mancanza da colmare: un indice
 *  di quattro paragrafi sarebbe più lungo dei paragrafi.
 *
 *  Non è un capitolo e non compare nell'elenco delle regole (vedi
 *  INFORMAZIONI_LEGALI): ci si arriva dall'attribuzione in fondo a ogni pagina,
 *  che è il punto in cui viene da chiedersi con che licenza, di preciso. */
export default async function InformazioniLegaliPage() {
  const doc = await caricaInformazioniLegali();

  return (
    <main className="page page--srd srd-page">
      <div className="bar">
        <h1 className="title title--sm">
          {doc.titolo}
          <span className="title__kicker">SRD 5.2.1 · italiano · CC-BY-4.0</span>
        </h1>
        <p className="muted small"><a href="/srd" className="link link--quiet">← Regole</a></p>
      </div>

      <article className="srd-testo">
        {/* Chi arriva qui da un menu può aspettarsi le condizioni d'uso del
            sito. Sono un'altra cosa, e le due licenze coprono materiali
            diversi: dirlo prima del testo costa due righe e toglie l'equivoco.
            La nota è nostra e si vede che lo è — il testo dell'SRD comincia
            sotto, e nessuno deve poterli confondere. */}
        <p className="muted small srd-nota">
          Il testo qui sotto è la pagina 1 del System Reference Document 5.2.1,
          riprodotta integralmente: sono i termini che regolano il regolamento
          pubblicato in questa sezione. Riguardano i contenuti dell’SRD — regole,
          tabelle, schede dei mostri — e non il software di Runebog GM, che è{" "}
          <a href={REPO_URL} className="link" rel="noreferrer">
            distribuito con licenza MIT
          </a>.
        </p>

        <Blocchi blocchi={doc.blocchi} rimandi={collegaIndirizzi} />
        <Attribuzione rimando={false} />
      </article>
    </main>
  );
}

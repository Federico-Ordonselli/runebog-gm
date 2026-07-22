import { ATTRIBUZIONE_SRD, INFORMAZIONI_LEGALI } from "@/lib/srd";
import { Testo, collegaIndirizzi } from "./blocchi";

/** L'attribuzione CC-BY in fondo a ogni pagina della sezione regole.
 *
 *  È una condizione della licenza, non una cortesia, e stava ricopiata in fondo
 *  a otto template identici: una riga che la licenza impone su tutte le pagine
 *  non deve dipendere dal fatto che chi aggiunge la nona se ne ricordi.
 *
 *  I due indirizzi che cita diventano link. Non è cosmesi: la frase esiste per
 *  dire dove si trovano la fonte e i termini, e una fonte che si legge ma non si
 *  apre è una citazione a metà. */
export function Attribuzione({ rimando = true }: { rimando?: boolean }) {
  return (
    <>
      <hr className="rule" />
      <p className="muted small srd-attribuzione">
        <Testo span={[{ s: ATTRIBUZIONE_SRD }]} rimandi={collegaIndirizzi} />{" "}
        {/* Sulla pagina delle informazioni legali il rimando punterebbe a se
            stessa: lì l'attribuzione è già in mezzo al testo che la impone. */}
        {rimando && (
          <a href={`/srd/${INFORMAZIONI_LEGALI}`} className="link">
            Informazioni legali
          </a>
        )}
      </p>
    </>
  );
}

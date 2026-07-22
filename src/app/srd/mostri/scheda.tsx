import {
  CARATTERISTICHE, type Mostro, type VoceScheda,
  modificatore, slugMostro, vociDi,
} from "@/lib/srd/mostri";

/* Una scheda mostro come si legge, non come si compila: l'app del DM ne ha già
   una versione fatta di campi modificabili (`statblockHTML` in
   public/app/mostri.js), e questa è la stessa creatura vista dal sito. I dati
   sono gli stessi — letteralmente lo stesso file — quindi le etichette sono le
   stesse: chi passa dall'una all'altra deve ritrovarsi. */

/* Le voci di tratti e azioni: nel PDF il nome è in grassetto e qui si ricostruisce
   dal punto fermo (vedi `vociDi`). Le intestazioni che il PDF stampa dentro il
   blocco delle azioni ("AZIONI BONUS", "REAZIONI") diventano sottotitoli veri:
   sono sezioni della scheda, non tratti con un nome in maiuscolo. */
function Voci({ voci }: { voci: VoceScheda[] }) {
  return (
    <>
      {voci.map((v, k) =>
        v.t === "sezione" ? (
          <h4 key={k} className="srd-mostro__sezione">{v.testo}</h4>
        ) : v.t === "voce" ? (
          <p key={k} className="srd-def">
            <strong className="srd-def__nome">{v.nome}.</strong>{v.testo && ` ${v.testo}`}
          </p>
        ) : (
          <p key={k} className="srd-p">{v.testo}</p>
        ),
      )}
    </>
  );
}

/* Una riga della scheda esiste solo se il PDF le dà un valore: `gear` è vuoto in
   286 schede su 331, e stampare "Attrezzatura: —" trecento volte riempirebbe la
   pagina di niente. */
function Riga({ nome, valore }: { nome: string; valore: string }) {
  if (!valore?.trim()) return null;
  return (
    <div className="srd-scheda__voce">
      <dt>{nome}</dt>
      <dd>{valore}</dd>
    </div>
  );
}

export function SchedaMostro({ m }: { m: Mostro }) {
  const tratti = vociDi(m.traits);
  const azioni = vociDi(m.actions);
  const leggendarie = vociDi(m.legendary);
  /* I PF si leggono "150 (20d10 + 40)": il numero è quello che si segna, il
     tiro è quello che serve se si vuole tirarli. */
  const pf = m.hpRoll ? `${m.hp} (${m.hpRoll})` : String(m.hp);

  return (
    <article className="srd-mostro">
      <h3 id={slugMostro(m.name)} className="srd-voce">{m.name}</h3>
      <p className="srd-mostro__meta"><em>{m.meta}</em></p>

      <dl className="srd-scheda">
        <Riga nome="CA" valore={m.ac} />
        <Riga nome="Iniziativa" valore={m.init} />
        <Riga nome="Punti ferita" valore={pf} />
        <Riga nome="Velocità" valore={m.speed} />
      </dl>

      {/* Le sei caratteristiche in tabella e non in scheda: qui i valori sono
          omogenei e corti, e incolonnati si confrontano con l'occhio — che è
          l'unica cosa che si fa con questi sei numeri. Il modificatore è il
          dato che si tira, quindi sta accanto al punteggio e non si calcola a
          mente al tavolo. */}
      <div className="srd-tab srd-tab__scorri">
        <table className="srd-mostro__car">
          <thead>
            <tr>{CARATTERISTICHE.map(([, lbl]) => <th key={lbl} scope="col">{lbl}</th>)}</tr>
          </thead>
          <tbody>
            <tr>
              {CARATTERISTICHE.map(([k, lbl]) => (
                <td key={lbl}>
                  {m[k]} <span className="srd-mostro__mod">{modificatore(m[k])}</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <dl className="srd-scheda">
        <Riga nome="Tiri salvezza" valore={m.saves} />
        <Riga nome="Abilità" valore={m.skills} />
        <Riga nome="Res./Immunità" valore={m.resist} />
        <Riga nome="Sensi" valore={m.senses} />
        <Riga nome="Lingue" valore={m.langs} />
        <Riga nome="GS" valore={m.cr} />
        <Riga nome="Attrezzatura" valore={m.gear} />
      </dl>

      {tratti.length > 0 && (
        <>
          <h4 className="srd-mostro__sezione">Tratti</h4>
          <Voci voci={tratti} />
        </>
      )}
      {azioni.length > 0 && (
        <>
          <h4 className="srd-mostro__sezione">Azioni</h4>
          <Voci voci={azioni} />
        </>
      )}
      {leggendarie.length > 0 && (
        <>
          <h4 className="srd-mostro__sezione">Azioni leggendarie</h4>
          <Voci voci={leggendarie} />
        </>
      )}
    </article>
  );
}

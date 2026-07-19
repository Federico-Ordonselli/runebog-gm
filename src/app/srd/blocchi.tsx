import type { Blocco, Span } from "@/lib/srd";

/* Il testo arriva come span, non come HTML: qui diventano elementi React veri.
   È il motivo per cui il generatore non emette markup — non esiste una stringa
   di cui fidarsi, quindi non serve fidarsene. */
function Testo({ span }: { span: Span[] }) {
  return (
    <>
      {span.map((s, k) => {
        const el = s.b ? <strong>{s.s}</strong> : s.i ? <em>{s.s}</em> : s.s;
        return <span key={k}>{el}</span>;
      })}
    </>
  );
}

/* Le tabelle scorrono per conto loro sotto una certa larghezza: la pagina non
   deve mai scorrere in orizzontale per colpa di una tabella a quattro colonne. */
function Tabella({ titolo, colonne, righe }: { titolo?: string; colonne?: string[]; righe: string[][] }) {
  return (
    <figure className="srd-tab">
      {titolo && <figcaption>{titolo}</figcaption>}
      <div className="srd-tab__scorri">
        <table>
          {colonne && (
            <thead>
              <tr>{colonne.map((c, k) => <th key={k}>{c}</th>)}</tr>
            </thead>
          )}
          <tbody>
            {righe.map((r, k) => (
              <tr key={k}>{r.map((c, n) => <td key={n}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

export function Blocchi({ blocchi }: { blocchi: Blocco[] }) {
  return (
    <>
      {blocchi.map((b, k) => {
        switch (b.t) {
          case "h2":
            return <h2 key={k} id={b.id} className="srd-h2">{b.testo}</h2>;
          case "h3":
            return <h3 key={k} id={b.id} className="srd-h3">{b.testo}</h3>;
          case "h4":
            return <h3 key={k} id={b.id} className="srd-voce">{b.testo}</h3>;
          case "p":
            return <p key={k} className="srd-p"><Testo span={b.testo} /></p>;
          case "def":
            return (
              <p key={k} className="srd-def">
                <strong className="srd-def__nome">{b.nome}.</strong> <Testo span={b.testo} />
              </p>
            );
          case "tabella":
            return <Tabella key={k} titolo={b.titolo} colonne={b.colonne} righe={b.righe} />;
          case "griglia":
            return <Tabella key={k} righe={b.righe} />;
          case "elenco":
            return (
              <ul key={k} className="srd-elenco">
                {b.voci.map((v, n) => <li key={n}>{v}</li>)}
              </ul>
            );
          case "punti":
            return (
              <ul key={k} className="srd-punti">
                {b.voci.map((v, n) => <li key={n}>{v}</li>)}
              </ul>
            );
        }
      })}
    </>
  );
}

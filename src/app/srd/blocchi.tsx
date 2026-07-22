import type { Blocco, Span } from "@/lib/srd";
import type { Intervallo, Rimandi } from "@/lib/srd/ancore";

/* Il testo arriva come span, non come HTML: qui diventano elementi React veri.
   È il motivo per cui il generatore non emette markup — non esiste una stringa
   di cui fidarsi, quindi non serve fidarsene. */
function Frammento({ s }: { s: Span }) {
  return s.b ? <strong>{s.s}</strong> : s.i ? <em>{s.s}</em> : <>{s.s}</>;
}

/* I rimandi «Vedi anche "Afferrato"» sono link, e le loro posizioni arrivano
   sul TESTO PIATTO del blocco: nel PDF «Vedi anche» è in corsivo e i termini
   che seguono no, quindi il rimando attraversa sempre almeno due span (90 su
   90 nel glossario) e non esiste lo span che lo contenga.
   Qui il taglio si riproietta sugli span: ogni pezzo si tiene il suo corsivo o
   grassetto, e i pezzi consecutivi che stanno nello stesso rimando finiscono in
   UN solo <a> — sennò un termine a cavallo di due span sarebbe due link
   affiancati, indistinguibili a vedersi e due voci separate per chi naviga a
   voce. */
function segmenta(span: Span[], intervalli: Intervallo[]) {
  const gruppi: { iv: Intervallo | null; pezzi: Span[] }[] = [];
  let pos = 0;
  for (const sp of span) {
    let off = 0;
    while (off < sp.s.length) {
      const assoluto = pos + off;
      const iv = intervalli.find((x) => x.da <= assoluto && assoluto < x.a) ?? null;
      /* Il pezzo finisce dove finisce lo span, o dove il rimando comincia o
         finisce: il primo dei tre confini che si incontra. */
      const prossimo = intervalli.find((x) => x.da > assoluto)?.da ?? Infinity;
      const fine = Math.min(pos + sp.s.length, iv ? iv.a : prossimo);
      const ultimo = gruppi[gruppi.length - 1];
      const pezzo = { ...sp, s: sp.s.slice(off, fine - pos) };
      if (ultimo && ultimo.iv === iv) ultimo.pezzi.push(pezzo);
      else gruppi.push({ iv, pezzi: [pezzo] });
      off = fine - pos;
    }
    pos += sp.s.length;
  }
  return gruppi;
}

export function Testo({ span, rimandi }: { span: Span[]; rimandi?: Rimandi }) {
  const intervalli = rimandi ? rimandi(span.map((s) => s.s).join("")) : [];
  if (!intervalli.length) {
    return <>{span.map((s, k) => <Frammento key={k} s={s} />)}</>;
  }
  return (
    <>
      {segmenta(span, intervalli).map((g, k) => {
        const dentro = g.pezzi.map((s, n) => <Frammento key={n} s={s} />);
        if (!g.iv) return <span key={k}>{dentro}</span>;
        /* I rimandi interni sono percorsi del sito, gli indirizzi citati nelle
           informazioni legali portano fuori: là il referrer non lo deve sapere
           nessuno, e distinguerli non richiede un campo in più — lo dice l'href.
           `srd-indirizzo` serve a spezzarli: un URL è un token che il browser
           non sa dove mandare a capo. */
        const fuori = g.iv.href.startsWith("http");
        return (
          <a
            key={k}
            href={g.iv.href}
            className={`link srd-rimando${fuori ? " srd-indirizzo" : ""}`}
            rel={fuori ? "noreferrer" : undefined}
          >
            {dentro}
          </a>
        );
      })}
    </>
  );
}

/* Gli indirizzi web citati nel testo, resi come link.
 *
 * Ha la firma dei rimandi — (testo piatto) => intervalli — perché è lo stesso
 * problema: un pezzo di testo che diventa un <a>, con la proiezione sugli span
 * già scritta. Non è però una proprietà di Blocchi, ed è una misura a dirlo:
 * nei dieci capitoli di regole non compare un solo "http". Gli unici due posti
 * dove serve sono l'attribuzione e la pagina delle informazioni legali, che si
 * passano questa funzione apposta.
 *
 * La punteggiatura finale resta fuori dal link: nell'SRD gli indirizzi chiudono
 * la frase ("…/srd." e "…/legalcode.") e un href col punto in fondo è un href
 * sbagliato — che è anche il modo peggiore di sbagliare, perché il link c'è e
 * si apre su un 404. */
export const collegaIndirizzi: Rimandi = (testo) =>
  [...testo.matchAll(/https?:\/\/\S+/g)].map((m) => {
    const url = m[0].replace(/[.,;:!?)\]]+$/, "");
    return { da: m.index, a: m.index + url.length, href: url };
  });

/* Una cella senza spazi è un pezzo solo e non va spezzata. Il browser lo fa
   comunque, perché il trattino d'intervallo delle chiavi ("2–6", "9–10") è un
   punto di a capo legittimo per il line breaker: in una tabella dalla seconda
   colonna larga la prima si restringe fin lì, e "9–10" usciva su due righe. */
const unita = (c: string) => (/\s/.test(c) ? undefined : "srd-tab__unita");

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
              <tr key={k}>{r.map((c, n) => <td key={n} className={unita(c)}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

/** `rimandi` è opzionale perché non tutte le pagine hanno un capitolo di
 *  contesto da dichiarare: senza, il testo si rende come prima. Oggi i 90
 *  rimandi stanno tutti nel glossario, ma la risoluzione non lo dà per scontato
 *  — è il capitolo che si sta leggendo a disambiguare i titoli omonimi. */
export function Blocchi({ blocchi, rimandi }: { blocchi: Blocco[]; rimandi?: Rimandi }) {
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
            return <p key={k} className="srd-p"><Testo span={b.testo} rimandi={rimandi} /></p>;
          case "def":
            return (
              <p key={k} className="srd-def">
                <strong className="srd-def__nome">{b.nome}.</strong> <Testo span={b.testo} rimandi={rimandi} />
              </p>
            );
          case "tabella":
            return <Tabella key={k} titolo={b.titolo} colonne={b.colonne} righe={b.righe} />;
          case "griglia":
            return <Tabella key={k} titolo={b.titolo} righe={b.righe} />;
          /* Il riquadro di uno strumento è una lista di descrizioni, non una
             tabella: le sue due colonne nel PDF sono impaginazione, e su un
             telefono devono poter diventare una sola senza scorrimento. */
          case "scheda":
            return (
              <dl key={k} className="srd-scheda">
                {b.voci.map((v, n) => (
                  <div key={n} className="srd-scheda__voce">
                    <dt>{v.nome}</dt>
                    <dd><Testo span={v.testo} rimandi={rimandi} /></dd>
                  </div>
                ))}
              </dl>
            );
          case "elenco":
            return (
              <ul key={k} className="srd-elenco">
                {b.voci.map((v, n) => <li key={n}>{v}</li>)}
              </ul>
            );
          case "punti":
            return (
              <ul key={k} className="srd-punti">
                {b.voci.map((v, n) => <li key={n}><Testo span={v} rimandi={rimandi} /></li>)}
              </ul>
            );
        }
      })}
    </>
  );
}

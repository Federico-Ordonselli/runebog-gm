/** La sezione regole: i capitoli dell'SRD 5.2.1 in italiano, consultabili su /srd.
 *
 *  I JSON di `capitoli/` sono GENERATI da `scripts/estrai-srd-regole.mjs` a
 *  partire dal PDF ufficiale — non si modificano a mano, come srd-mostri.js.
 *  Qui vivono solo il tipo del documento e l'elenco dei capitoli.
 *
 *  Il testo esce dal generatore come array di span ({s, i?, b?}) e non come
 *  HTML: le pagine lo rendono con elementi React veri, così non c'è nessuna
 *  stringa di markup da dare a dangerouslySetInnerHTML.
 *
 *  I contenuti sono CC-BY-4.0, non MIT: l'attribuzione (ATTRIBUZIONE_SRD, resa
 *  in fondo a ogni pagina del capitolo) è una condizione della licenza. */

export type Span = { s: string; i?: 1; b?: 1 };

export type Blocco =
  | { t: "h2" | "h3" | "h4"; testo: string; id: string }
  | { t: "p"; testo: Span[] }
  | { t: "def"; nome: string; testo: Span[] }
  | { t: "tabella"; titolo: string; colonne: string[]; righe: string[][] }
  | { t: "griglia"; righe: string[][] }
  /* Un riquadro a coppie etichetta/valore: gli strumenti di Equipaggiamento
     ("Caratteristica: / Utilizzo: / Creazione: / Peso:") e — stessa forma — le
     schede degli incantesimi. Non è una tabella: le colonne sono un artefatto
     dell'impaginato (la prima riga ne affianca due coppie), e leggerlo come
     griglia rimescolava i valori a capo. */
  | { t: "scheda"; voci: { nome: string; testo: Span[] }[] }
  | { t: "elenco"; voci: string[] }
  | { t: "punti"; voci: string[] };

export type Capitolo = {
  id: string;
  titolo: string;
  pagine: [number, number];
  blocchi: Blocco[];
};

/** L'elenco dei capitoli del PDF, nell'ordine in cui vi compaiono. `pronto` dice
 *  se il JSON è già stato generato: la sezione cresce un capitolo alla volta e
 *  l'indice mostra anche quelli che mancano, invece di fingere che non esistano. */
export const CAPITOLI: { id: string; titolo: string; sommario: string; pronto: boolean }[] = [
  { id: "come-si-gioca", titolo: "Come si gioca", sommario: "Prove con d20, azioni, esplorazione, combattimento, danni e guarigione.", pronto: true },
  { id: "creazione-del-personaggio", titolo: "Creazione del personaggio", sommario: "Creare un personaggio, avanzamento di livello, multiclasse.", pronto: false },
  { id: "classi", titolo: "Classi", sommario: "Le dodici classi con privilegi, tabelle di avanzamento e una sottoclasse ciascuna.", pronto: false },
  { id: "origini-dei-personaggi", titolo: "Origini dei personaggi", sommario: "Background e specie giocabili.", pronto: false },
  { id: "talenti", titolo: "Talenti", sommario: "Talenti di origine, generali, stile di combattimento e dono epico.", pronto: false },
  { id: "equipaggiamento", titolo: "Equipaggiamento", sommario: "Armi, armature, oggetti d'avventura, servizi e stile di vita.", pronto: true },
  { id: "incantesimi", titolo: "Incantesimi", sommario: "Lanciare gli incantesimi e le descrizioni complete, dai trucchetti al 9º livello.", pronto: false },
  { id: "glossario-delle-regole", titolo: "Glossario delle regole", sommario: "Ogni termine di regola in ordine alfabetico: condizioni, azioni, aree di effetto, pericoli.", pronto: true },
  { id: "strumenti-di-gioco", titolo: "Strumenti di gioco", sommario: "Trappole, malattie, veleni, follia e gli altri arnesi del GM.", pronto: true },
  { id: "oggetti-magici", titolo: "Oggetti magici", sommario: "Attivazione, sintonia, oggetti maledetti e il catalogo completo.", pronto: false },
];

/** La dichiarazione di attribuzione richiesta dalla CC-BY-4.0, nei termini
 *  esatti imposti dall'SRD: il testo non va parafrasato. */
export const ATTRIBUZIONE_SRD =
  'Quest’opera include materiale tratto dal System Reference Document 5.2.1 ' +
  '(“SRD 5.2.1”) di Wizards of the Coast LLC, disponibile all’indirizzo ' +
  'https://www.dndbeyond.com/srd. Il SRD 5.2.1 è concesso in licenza ai sensi ' +
  'della licenza di attribuzione 4.0 Internazionale di Creative Commons, ' +
  'disponibile all’indirizzo https://creativecommons.org/licenses/by/4.0/legalcode.';

export const capitoloPronto = (id: string) => CAPITOLI.some((c) => c.id === id && c.pronto);

/** Carica un capitolo generato. L'import dinamico tiene fuori dal bundle di una
 *  pagina i JSON degli altri capitoli: il solo glossario pesa 75 KB di testo. */
export async function caricaCapitolo(id: string): Promise<Capitolo | null> {
  if (!capitoloPronto(id)) return null;
  const mod = await import(`./capitoli/${id}.json`);
  return mod.default as Capitolo;
}

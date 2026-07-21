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
  /* Una tabella senza riga di intestazione: la struttura la dichiarano le
     chiavi della prima colonna. La didascalia c'è quando il PDF gliene dà una
     ("Tratti del barbaro"), e nelle griglie chiave/valore succede spesso. */
  | { t: "griglia"; titolo?: string; righe: string[][] }
  /* Un riquadro a coppie etichetta/valore: gli strumenti di Equipaggiamento
     ("Caratteristica: / Utilizzo: / Creazione: / Peso:") e — stessa forma — le
     schede degli incantesimi. Non è una tabella: le colonne sono un artefatto
     dell'impaginato (la prima riga ne affianca due coppie), e leggerlo come
     griglia rimescolava i valori a capo. */
  | { t: "scheda"; voci: { nome: string; testo: Span[] }[] }
  | { t: "elenco"; voci: string[] }
  /* Un elenco puntato. Le voci sono span e non stringhe perché il pallino non
     è l'unica cosa che portano: negli oggetti magici sono nomi di incantesimo
     in corsivo, nei gruppi di mostri il nome della creatura è in grassetto. */
  | { t: "punti"; voci: Span[][] };

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
  { id: "creazione-del-personaggio", titolo: "Creazione del personaggio", sommario: "Creare un personaggio, avanzamento di livello, multiclasse.", pronto: true },
  { id: "classi", titolo: "Classi", sommario: "Le dodici classi con privilegi, tabelle di avanzamento e una sottoclasse ciascuna.", pronto: true },
  { id: "origini-dei-personaggi", titolo: "Origini dei personaggi", sommario: "Background e specie giocabili.", pronto: true },
  { id: "talenti", titolo: "Talenti", sommario: "Talenti di origine, generali, stile di combattimento e dono epico.", pronto: true },
  { id: "equipaggiamento", titolo: "Equipaggiamento", sommario: "Armi, armature, oggetti d'avventura, servizi e stile di vita.", pronto: true },
  { id: "incantesimi", titolo: "Incantesimi", sommario: "Lanciare gli incantesimi e le descrizioni complete, dai trucchetti al 9º livello.", pronto: true },
  { id: "glossario-delle-regole", titolo: "Glossario delle regole", sommario: "Ogni termine di regola in ordine alfabetico: condizioni, azioni, aree di effetto, pericoli.", pronto: true },
  { id: "strumenti-di-gioco", titolo: "Strumenti di gioco", sommario: "Trappole, malattie, veleni, follia e gli altri arnesi del GM.", pronto: true },
  { id: "oggetti-magici", titolo: "Oggetti magici", sommario: "Attivazione, sintonia, oggetti maledetti e il catalogo completo.", pronto: true },
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

/** I capitoli troppo lunghi per stare in una pagina sola hanno rotte proprie
 *  (`/srd/incantesimi/[livello]`, `/srd/oggetti-magici/[categoria]`) e vanno
 *  tolti dai generateStaticParams di `[capitolo]`, che altrimenti prerenderebbe
 *  la pagina intera che si è deciso di non servire. */
export const CAPITOLI_A_PIU_PAGINE = ["classi", "incantesimi", "oggetti-magici"];

/* --- Classi: un capitolo, dodici pagine ----------------------------------- */

/* Stessa ragione degli altri due (340 KB di testo, che resi in una pagina sola
   fanno quasi un mega di HTML) ma taglio più semplice: qui non serve leggere
   una riga in corsivo per capire dove finisce una voce, perché lo dichiara la
   STRUTTURA. Il capitolo non ha introduzione — nel PDF comincia direttamente
   col Barbaro — e ha esattamente un h2 per classe, quindi le dodici classi
   sono i dodici h2 e tutto ciò che li segue. */

export type Classe = { nome: string; id: string; blocchi: Blocco[] };

export function dividiClassi(doc: Capitolo): Classe[] {
  const classi: Classe[] = [];
  for (const b of doc.blocchi) {
    if (b.t === "h2") classi.push({ nome: b.testo, id: b.id, blocchi: [b] });
    else if (classi.length) classi[classi.length - 1].blocchi.push(b);
  }
  return classi;
}

/** La carta d'identità di una classe, per l'indice: è ciò che si confronta fra
 *  una classe e l'altra prima di aprirne una. I due tratti si cercano per
 *  ETICHETTA dentro il riquadro "Tratti del <classe>", non per posizione, e la
 *  sottoclasse è il titolo della sezione che la descrive — se il capitolo
 *  cambia forma la carta perde una riga, non inventa un dato. */
export type CartaClasse = { primaria?: string; dado?: string; sottoclasse?: string };

export function cartaClasse(c: Classe): CartaClasse {
  const tratti = c.blocchi.find((b) => b.t === "griglia");
  const voce = (etichetta: string) =>
    tratti?.t === "griglia"
      ? tratti.righe.find((r) => r[0] === etichetta)?.[1]
      : undefined;
  const sezione = c.blocchi.find((b) => b.t === "h3" && b.testo.startsWith("Sottoclasse"));
  return {
    primaria: voce("Caratteristiche primarie"),
    /* Del Dado Vita interessa il dado: "D12 per ogni livello da barbaro" è la
       frase del riquadro, e in una carta di confronto conta "D12". */
    dado: voce("Dado Vita")?.split(/\s/)[0],
    sottoclasse: sezione?.t === "h3" ? sezione.testo.split(": ").slice(1).join(": ") : undefined,
  };
}

/* --- Incantesimi: un capitolo, dieci pagine ------------------------------- */

/* Incantesimi è 84 pagine di PDF: servito intero sarebbero 600 KB di testo e un
   indice laterale da 364 voci per chi cerca "dardo incantato". Il JSON invece
   resta UNO — è importato lato server e al browser non arriva mai, quindi a
   pesare è l'HTML reso, non il file. Si spezzano le pagine, non la sorgente. */

export const LIVELLI = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const slugLivello = (n: number) => (n === 0 ? "trucchetti" : `livello-${n}`);
export const titoloLivello = (n: number) =>
  n === 0 ? "Trucchetti" : `Incantesimi di ${n}º livello`;
export const livelloDaSlug = (s: string) =>
  LIVELLI.find((n) => slugLivello(n) === s) ?? null;

export type Incantesimo = { nome: string; id: string; livello: number; blocchi: Blocco[] };

/* Il livello lo dichiara la riga in corsivo sotto il nome ("Invocazione di 3º
   livello (mago, stregone)", oppure "Trucchetto di invocazione (…)"): è anche
   il solo segnale che distingue un incantesimo da un sottotitolo qualsiasi —
   nel capitolo ci sono 355 h4 e 339 incantesimi. */
function livelloDichiarato(b: Blocco | undefined): number | null {
  if (!b || b.t !== "p" || !b.testo[0]?.i) return null;
  const testo = b.testo.map((s) => s.s).join("");
  const m = /\b(\d)º livello/.exec(testo);
  if (m) return +m[1];
  return /^\s*Trucchetto\b/i.test(testo) ? 0 : null;
}

/* Divide il capitolo in una parte introduttiva (le regole di lancio, che
   restano sull'indice) e i singoli incantesimi. Un incantesimo comincia a un
   h4 col livello dichiarato sotto e arriva fino al successivo: i titoli
   interni — le schede delle creature evocate, "Oggetto animato" sotto animare
   oggetti — sono h3 e restano dentro, dove il PDF li mette. */
export function dividiIncantesimi(doc: Capitolo) {
  const intro: Blocco[] = [];
  const incantesimi: Incantesimo[] = [];
  for (let i = 0; i < doc.blocchi.length; i++) {
    const b = doc.blocchi[i];
    const livello = b.t === "h4" ? livelloDichiarato(doc.blocchi[i + 1]) : null;
    if (livello !== null && b.t === "h4") {
      incantesimi.push({ nome: b.testo, id: b.id, livello, blocchi: [b] });
    } else if (incantesimi.length) incantesimi[incantesimi.length - 1].blocchi.push(b);
    else intro.push(b);
  }
  return { intro, incantesimi };
}

/* --- Oggetti magici: un capitolo, dieci pagine ---------------------------- */

/* Stessa ragione degli incantesimi e stessa ricetta: 258 oggetti in una pagina
   sola fanno 942 KB di HTML, il triplo del glossario, e un indice laterale da
   294 voci. Il JSON resta uno.
 *
 * Qui però il taglio non è un numero ma la CATEGORIA, dichiarata dalla stessa
 * riga in corsivo che sotto agli incantesimi dice il livello ("Anello, raro
 * (richiede sintonia)"). È anche il solo segnale che distingue un oggetto da un
 * sottotitolo qualsiasi: nel capitolo ci sono 268 h4 e 258 oggetti, e i dieci di
 * troppo sono i tratti degli oggetti senzienti e le schede delle creature.
 *
 * Gli oggetti meravigliosi sono metà del capitolo (127 su 258) e da soli
 * sfonderebbero il tetto: si spezzano a metà alfabeto, che è l'unico taglio che
 * il capitolo stesso suggerisce — la sezione si chiama "Oggetti magici A–Z". */

export type Oggetto = { nome: string; id: string; categoria: string; blocchi: Blocco[] };

export const SEZIONI_OGGETTI: {
  slug: string; titolo: string; categoria: string; da?: string; fino?: string;
}[] = [
  { slug: "anelli", titolo: "Anelli", categoria: "Anello" },
  { slug: "armature", titolo: "Armature", categoria: "Armatura" },
  { slug: "armi", titolo: "Armi", categoria: "Arma" },
  { slug: "bacchette", titolo: "Bacchette", categoria: "Bacchetta" },
  { slug: "bastoni", titolo: "Bastoni", categoria: "Bastone" },
  { slug: "oggetti-meravigliosi-a-l", titolo: "Oggetti meravigliosi A–L", categoria: "Oggetto meraviglioso", fino: "L" },
  { slug: "oggetti-meravigliosi-m-z", titolo: "Oggetti meravigliosi M–Z", categoria: "Oggetto meraviglioso", da: "M" },
  { slug: "pergamene", titolo: "Pergamene", categoria: "Pergamena" },
  { slug: "pozioni", titolo: "Pozioni", categoria: "Pozione" },
  { slug: "verghe", titolo: "Verghe", categoria: "Verga" },
];

export const sezioneDaSlug = (s: string) => SEZIONI_OGGETTI.find((x) => x.slug === s) ?? null;

/* L'iniziale che decide da che parte dell'alfabeto sta un oggetto: normalizzata,
   perché un domani "Élmo" non deve finire fuori da entrambe le metà. */
const iniziale = (nome: string) =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();

export const nellaSezione = (o: Oggetto, s: (typeof SEZIONI_OGGETTI)[number]) =>
  o.categoria === s.categoria
  && (!s.da || iniziale(o.nome) >= s.da)
  && (!s.fino || iniziale(o.nome) <= s.fino);

/* La categoria è la prima cosa che la riga in corsivo dichiara, prima della
   rarità o della specificazione fra parentesi ("Arma (mazza), rara"). Si accetta
   solo se è una di quelle del registro: un corsivo qualsiasi non deve poter
   inventare una categoria — e quindi un oggetto — che nessuna pagina serve. */
const CATEGORIE_NOTE = new Set(SEZIONI_OGGETTI.map((s) => s.categoria));

function categoriaDichiarata(b: Blocco | undefined): string | null {
  if (!b || b.t !== "p" || !b.testo[0]?.i) return null;
  const cat = b.testo.map((s) => s.s).join("").split(/[,(]/)[0].trim();
  return CATEGORIE_NOTE.has(cat) ? cat : null;
}

/** Divide il capitolo nelle regole introduttive (che restano sull'indice) e nei
 *  singoli oggetti. Come per gli incantesimi, i titoli interni a una descrizione
 *  — le schede di creatura dell'Avatar della morte e della Mosca gigante —
 *  restano dentro l'oggetto, dove il PDF li mette. */
export function dividiOggetti(doc: Capitolo) {
  const intro: Blocco[] = [];
  const oggetti: Oggetto[] = [];
  for (let i = 0; i < doc.blocchi.length; i++) {
    const b = doc.blocchi[i];
    const categoria = b.t === "h4" ? categoriaDichiarata(doc.blocchi[i + 1]) : null;
    if (categoria !== null && b.t === "h4") {
      oggetti.push({ nome: b.testo, id: b.id, categoria, blocchi: [b] });
    } else if (oggetti.length) oggetti[oggetti.length - 1].blocchi.push(b);
    else intro.push(b);
  }
  /* Le ultime righe dell'introduzione non introducono le regole: aprono il
     catalogo ("Oggetti magici A–Z" e la frase che lo annuncia). Vanno con
     l'elenco, che nella pagina sta in cima — chi arriva qui cerca un oggetto —
     e non lasciate in fondo alle regole, dove sarebbero un titolo senza seguito.
     Si riconoscono senza nominarle: sono tutto ciò che viene dopo l'ULTIMO
     titolo dell'introduzione, quel titolo compreso. */
  const ultimo = intro.map((b) => b.t).lastIndexOf("h2");
  const catalogo = ultimo < 0 ? [] : intro.splice(ultimo);
  return { intro, catalogo, oggetti };
}

/** Carica un capitolo generato. L'import dinamico tiene fuori dal bundle di una
 *  pagina i JSON degli altri capitoli: il solo glossario pesa 75 KB di testo. */
export async function caricaCapitolo(id: string): Promise<Capitolo | null> {
  if (!capitoloPronto(id)) return null;
  const mod = await import(`./capitoli/${id}.json`);
  return mod.default as Capitolo;
}

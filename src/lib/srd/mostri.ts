/** Il bestiario dell'SRD 5.2.1 in italiano, consultabile su /srd/mostri.
 *
 *  ## Una sola copia, e sta in `public/`
 *
 *  Le 331 schede vivono in `public/app/srd-mostri.js`, dove le ha messe
 *  `scripts/estrai-srd-mostri.mjs`: è uno script classico che espone
 *  `window.SRD_MONSTERS`, perché l'app del DM lo carica con un `<script src>` e
 *  non ha un passo di build in cui importarlo.
 *
 *  Il sito lo LEGGE da lì invece di avere un `mostri.json` suo. Generare due
 *  file dallo stesso PDF sarebbe stato più comodo e sarebbe stata la stessa
 *  cosa che questo repo ha già pagato una volta: l'attribuzione CC-BY ricopiata
 *  a mano era divergente in cinque punti dall'originale. Due copie si allontanano
 *  da sole, anche quando nascono uguali — qui il rischio non è nemmeno teorico,
 *  perché chi rigenera il bestiario per l'app non ha motivo di sapere che il
 *  sito ne tiene un'altra.
 *
 *  Costo: un `readFileSync` e un `JSON.parse` a build time. Tutte le pagine
 *  della sezione sono statiche, quindi il file non si legge mai a runtime.
 *
 *  I dati sono CC-BY-4.0 come i capitoli: l'attribuzione va resa in fondo a ogni
 *  pagina che li mostra. */

import fs from "node:fs";
import path from "node:path";

/** Una scheda come la scrive l'estrattore. I campi ci sono sempre; quelli che il
 *  PDF non dichiara arrivano come stringa vuota (`gear` è vuoto in 286 schede su
 *  331), quindi la pagina li salta guardando il valore, non l'esistenza. */
export type Mostro = {
  name: string;
  meta: string;
  ac: string;
  init: string;
  hp: number;
  hpRoll: string;
  speed: string;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  saves: string;
  skills: string;
  resist: string;
  senses: string;
  langs: string;
  cr: string;
  gear: string;
  traits: string;
  actions: string;
  legendary: string;
};

/** Lo slug dei titoli, identico a quello di `scripts/estrai-srd-regole.mjs`: gli
 *  id dei mostri finiscono nello stesso indice di ricerca degli altri 1530
 *  titoli, e due ricette diverse per la stessa cosa divergono. NFKD e non NFD
 *  per la stessa ragione dell'estrattore: scioglie anche le legature. */
export const slugMostro = (t: string) =>
  t.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/* --- lettura del file generato -------------------------------------------- */

const SORGENTE = "public/app/srd-mostri.js";

/** Estrae l'array dal file dell'app. Il file è generato, quindi la sua forma è
 *  nota (`window.SRD_MONSTERS=[…];`) — ma è comunque un formato letto da un
 *  altro modulo, quindi qui si dichiara che cosa ci si aspetta e si fallisce
 *  forte se non c'è. Un bestiario vuoto pubblicherebbe quindici pagine senza
 *  schede senza che nessuna build si lamenti, che è il guasto peggiore: sembra
 *  funzionare. */
function leggiBestiario(): Mostro[] {
  const file = path.join(process.cwd(), SORGENTE);
  const src = fs.readFileSync(file, "utf8");
  const uguale = src.indexOf("=", src.indexOf("window.SRD_MONSTERS"));
  const fine = src.lastIndexOf("]");
  if (uguale < 0 || fine < 0) {
    throw new Error(
      `${SORGENTE} non assegna più window.SRD_MONSTERS a un array. ` +
      "Il bestiario di /srd/mostri si legge di lì: ricontrolla scripts/estrai-srd-mostri.mjs.",
    );
  }
  const mostri = JSON.parse(src.slice(uguale + 1, fine + 1)) as Mostro[];
  if (!Array.isArray(mostri) || !mostri.length || !mostri[0]?.name) {
    throw new Error(`${SORGENTE} non contiene schede leggibili.`);
  }
  return mostri;
}

/* 400 KB di file, un parse: si fa una volta per processo. A build time le
   pagine prerese sono sedici e lo chiedono tutte. */
let cache: Mostro[] | null = null;

export function tuttiIMostri(): Mostro[] {
  cache ??= leggiBestiario().sort((a, b) => a.name.localeCompare(b.name, "it"));
  return cache;
}

/* --- il taglio: per tipo di creatura -------------------------------------- */

/* Le schede in una pagina sola farebbero quasi un mega di HTML — il triplo del
 * glossario, che è il tetto già raggiunto una volta in questa sezione. Il
 * capitolo va spezzato, e come per gli oggetti magici il taglio lo DICHIARA il
 * documento: la riga sotto il nome apre col tipo della creatura ("Aberrazione
 * Grande, legale malvagio"), che è la classificazione ufficiale e anche il modo
 * in cui un GM cerca ("mi serve un non morto"). L'alfabeto sarebbe stato un
 * taglio nostro, e per giunta sbilanciato: la D da sola sono 55 schede, perché
 * ci stanno tutti i draghi.
 *
 * Chi cerca per nome non passa di qui: l'indice elenca tutte e 331 le schede in
 * ordine alfabetico e ognuna punta alla sua ancora, e la ricerca trasversale le
 * ha tutte. */

/** I tipi di creatura, nell'ordine in cui si leggono in un indice. Ogni voce
 *  dichiara anche il PLURALE MINUSCOLO, che non è pignoleria: le schede degli
 *  sciami non dicono il tipo in testa ma dentro ("Sciame Medio **di bestie**
 *  Minuscole"), quindi un match sulla sola forma del titolo perdeva sette
 *  schede. */
export const TIPI_CREATURA: { nome: string; slug: string; plurale: string }[] = [
  { nome: "Aberrazione", slug: "aberrazioni", plurale: "aberrazioni" },
  { nome: "Bestia", slug: "bestie", plurale: "bestie" },
  { nome: "Celestiale", slug: "celestiali", plurale: "celestiali" },
  { nome: "Costrutto", slug: "costrutti", plurale: "costrutti" },
  { nome: "Drago", slug: "draghi", plurale: "draghi" },
  { nome: "Elementale", slug: "elementali", plurale: "elementali" },
  { nome: "Folletto", slug: "folletti", plurale: "folletti" },
  { nome: "Gigante", slug: "giganti", plurale: "giganti" },
  { nome: "Immondo", slug: "immondi", plurale: "immondi" },
  { nome: "Melma", slug: "melme", plurale: "melme" },
  { nome: "Mostruosità", slug: "mostruosita", plurale: "mostruosità" },
  { nome: "Non morto", slug: "non-morti", plurale: "non morti" },
  { nome: "Umanoide", slug: "umanoidi", plurale: "umanoidi" },
  { nome: "Vegetale", slug: "vegetali", plurale: "vegetali" },
];

/** Il tipo dichiarato da una scheda. Prima la forma del titolo in testa, che è
 *  il caso normale; poi il plurale ovunque nella riga, che è lo sciame. */
export function tipoDi(m: Mostro): (typeof TIPI_CREATURA)[number] | null {
  const meta = m.meta ?? "";
  return TIPI_CREATURA.find((t) => meta.startsWith(t.nome))
    ?? TIPI_CREATURA.find((t) => meta.includes(t.plurale))
    ?? null;
}

/** Una scheda che non dichiara un tipo noto non finirebbe su nessuna pagina:
 *  `/srd/mostri` ferma la build se ne compare una. 331 pubblicate devono
 *  restare 331. */
export const mostriSenzaTipo = () => tuttiIMostri().filter((m) => !tipoDi(m));

/* --- le pagine: un tipo, tranne dove pesa troppo -------------------------- */

/* Un tipo è una pagina. Due fanno eccezione **e solo per peso**, come gli
 * oggetti meravigliosi del capitolo accanto: servite intere, Bestie faceva 578
 * KB di HTML e Draghi 458, contro i 347 del glossario — il massimo che questa
 * sezione ha accettato finora. A pesare è il NUMERO di schede più che la loro
 * lunghezza (una scheda costa ~4,6 KB di markup a prescindere), quindi il
 * confine si sceglie contando le schede.
 *
 * Il criterio con cui si spezzano non è lo stesso, e a deciderlo sono i nomi:
 *  - le Bestie si distribuiscono sull'alfabeto (43 fino alla L, 48 dopo), ed è
 *    esattamente il taglio A–L / M–Z già in uso per gli oggetti meravigliosi;
 *  - i Draghi no — 40 su 45 cominciano per "D", perché si chiamano tutti
 *    "Drago <colore> <età>" — e l'alfabeto li lascerebbe tutti da una parte.
 *    Lì il taglio è il grado di sfida, che per un drago È l'età: cucciolo,
 *    giovane, adulto, antico. Il documento lo dichiara scheda per scheda.
 *
 * Un criterio unico per forza sarebbe stato peggio: l'alfabeto non divide i
 * draghi, e il grado di sfida non è il modo in cui si cerca un cavallo. */
export type SezioneMostri = {
  slug: string;
  titolo: string;
  tipo: string;
  /** Confini alfabetici sull'iniziale del nome (inclusi). */
  da?: string;
  fino?: string;
  /** Confini sul grado di sfida (inclusi). */
  gsDa?: number;
  gsFino?: number;
};

export const SEZIONI_MOSTRI: SezioneMostri[] = TIPI_CREATURA.flatMap((t) => {
  if (t.slug === "bestie") return [
    { slug: "bestie-a-l", titolo: "Bestie A–L", tipo: t.slug, fino: "L" },
    { slug: "bestie-m-z", titolo: "Bestie M–Z", tipo: t.slug, da: "M" },
  ];
  if (t.slug === "draghi") return [
    { slug: "draghi-fino-a-gs-15", titolo: "Draghi fino a GS 15", tipo: t.slug, gsFino: 15 },
    { slug: "draghi-da-gs-16", titolo: "Draghi da GS 16", tipo: t.slug, gsDa: 16 },
  ];
  return [{ slug: t.slug, titolo: t.nome, tipo: t.slug }];
});

export const sezioneMostriDaSlug = (s: string) =>
  SEZIONI_MOSTRI.find((x) => x.slug === s) ?? null;

/** L'iniziale che decide da che parte dell'alfabeto sta un nome: normalizzata,
 *  come per gli oggetti magici. */
const iniziale = (nome: string) =>
  nome.normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toUpperCase();

export function nellaSezione(m: Mostro, s: SezioneMostri) {
  if (tipoDi(m)?.slug !== s.tipo) return false;
  if (s.da && iniziale(m.name) < s.da) return false;
  if (s.fino && iniziale(m.name) > s.fino) return false;
  const gs = valoreGrado(gradoDi(m));
  if (s.gsDa !== undefined && gs < s.gsDa) return false;
  if (s.gsFino !== undefined && gs > s.gsFino) return false;
  return true;
}

export const mostriDellaSezione = (slug: string) => {
  const s = sezioneMostriDaSlug(slug);
  return s ? tuttiIMostri().filter((m) => nellaSezione(m, s)) : [];
};

/** La sezione che serve una scheda: è l'unico posto che sa dov'è finito un
 *  mostro, e quindi l'unico che sa costruirne l'indirizzo. */
export const sezioneDi = (m: Mostro) => SEZIONI_MOSTRI.find((s) => nellaSezione(m, s)) ?? null;

export const hrefMostro = (m: Mostro) => {
  const s = sezioneDi(m);
  return s ? `/srd/mostri/${s.slug}#${slugMostro(m.name)}` : null;
};

/* --- tratti e azioni: righe piatte che erano voci ------------------------- */

/* Nel PDF ogni tratto ha il nome in grassetto; nell'estratto le voci sono righe
 * separate da "\n" e il grassetto è perso. Si ricostruisce dal punto fermo, e la
 * misura dice che si può: su 1445 righe il primo ". " cade entro 60 caratteri in
 * 1348, in 95 non c'è affatto (sono le intestazioni "AZIONI BONUS:" e
 * "REAZIONI:", che il PDF stampa come sezioni) e in UNA sola cade oltre — la
 * "Nube fetida (1/giorno)" del fungo violetto, dove manca il punto dopo la
 * parentesi.
 *
 * Quindi il tetto a 60 caratteri non è tarato a occhio: separa 1348 casi da 1, e
 * il caso che perde resta prosa intera invece di uscire con mezza frase in
 * grassetto. Sbagliare in quel verso è la regola di questa sezione. */
export type VoceScheda =
  | { t: "sezione"; testo: string }
  | { t: "voce"; nome: string; testo: string }
  | { t: "prosa"; testo: string };

const NOME_MAX = 60;

export function vociDi(campo: string): VoceScheda[] {
  return String(campo ?? "")
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r): VoceScheda => {
      const i = r.indexOf(". ");
      // "AZIONI BONUS:" — nessun punto, chiude coi due punti: è un'intestazione
      if (i < 0 && r.endsWith(":")) return { t: "sezione", testo: r.slice(0, -1) };
      // "Trafiggere." — un nome senza descrizione, l'unico del bestiario
      if (i < 0) return r.endsWith(".") && r.length <= NOME_MAX
        ? { t: "voce", nome: r.slice(0, -1), testo: "" }
        : { t: "prosa", testo: r };
      if (i > NOME_MAX) return { t: "prosa", testo: r };
      return { t: "voce", nome: r.slice(0, i), testo: r.slice(i + 2) };
    });
}

/** Il modificatore di una caratteristica, con il segno: in uno statblock è
 *  quello che si tira, e il punteggio è il dato che lo genera. Stessa formula di
 *  `abMod` in `public/app/mostri.js`. */
export const modificatore = (v: number) => {
  const m = Math.floor((Number(v) - 10) / 2);
  return (m >= 0 ? "+" : "") + m;
};

export const CARATTERISTICHE = [
  ["str", "For"], ["dex", "Des"], ["con", "Cos"],
  ["int", "Int"], ["wis", "Sag"], ["cha", "Car"],
] as const;

/** Il grado di sfida nudo, senza i PE fra parentesi: "10 (PE 5.900, …)" → "10".
 *  Serve all'indice, dove la colonna è larga quanto un numero. */
export const gradoDi = (m: Mostro) => (m.cr ?? "").split(" ")[0] || "—";

/* L'ordine dei gradi di sfida non è quello dei caratteri: "1/8" viene prima di
   "1", e "10" dopo "9". */
export const valoreGrado = (g: string) => {
  const [a, b] = g.split("/");
  return b ? Number(a) / Number(b) : Number(a);
};

/** Il registro delle ancore: per ogni titolo dei dieci capitoli, l'indirizzo
 *  della pagina che lo serve davvero.
 *
 *  Serve a due cose che senza di lui non si possono fare — la ricerca
 *  trasversale ai capitoli e i rimandi «Vedi anche "…"» resi come link — e le
 *  serve per la stessa ragione: **un id di titolo non basta a costruire un
 *  indirizzo**. Tre capitoli sono serviti su più pagine, e a decidere quale
 *  pagina porti quale titolo sono i divisori (`dividiClassi`,
 *  `dividiIncantesimi`, `dividiOggetti`), non l'id del capitolo.
 *
 *  Per questo il registro si costruisce facendo girare quegli stessi divisori.
 *  Una tabella scritta a mano sarebbe una seconda verità, e si scoprirebbe
 *  disallineata il giorno in cui si spezza un altro capitolo: il link
 *  atterrerebbe su una pagina che quell'ancora non ce l'ha, cioè in cima invece
 *  che sul punto giusto — un guasto silenzioso, la specialità di questa sezione.
 *
 *  Tutto qui dentro gira **lato server** (a build time, le pagine sono
 *  prerese): importa i dieci JSON, che al browser non arrivano mai. Al client
 *  esce solo la forma compatta di `/srd/ancore.json`. */

import {
  CAPITOLI, SEZIONI_OGGETTI, type Blocco, type Capitolo, caricaCapitolo,
  dividiClassi, dividiIncantesimi, dividiOggetti, nellaSezione, slugLivello,
  titoloLivello,
} from ".";

export type Ancora = {
  id: string;
  testo: string;
  livello: 2 | 3 | 4;
  capitolo: string;
  /** L'indirizzo completo, frammento compreso. Manca il frammento solo quando
   *  il titolo È la pagina (l'h2 di una classe, che `/srd/classi/[classe]` non
   *  rende perché lo mostra già come titolo). */
  href: string;
  /** L'etichetta della pagina che lo serve: "Glossario delle regole", ma anche
   *  "Classi › Guerriero". Nella ricerca è ciò che distingue i dodici
   *  "Livello 4: Aumento dei punteggi di caratteristica" — senza la classe
   *  sarebbero dodici risultati identici, cioè nessun risultato. */
  pagina: string;
};

const LIVELLI_TITOLO = { h2: 2, h3: 3, h4: 4 } as const;

/* I soli blocchi che portano un'ancora: `id` esiste solo sui titoli. */
const titoli = (blocchi: Blocco[]) =>
  blocchi.flatMap((b) => (b.t === "h2" || b.t === "h3" || b.t === "h4" ? [b] : []));

/* --- Le ancore di un capitolo, capitolo per capitolo ----------------------- */

/* Le classi: un h2 per classe, e la pagina della classe non rende il proprio
   h2 (`c.blocchi.slice(1)` in [classe]/page.tsx) — quindi quel titolo è la
   pagina, senza frammento. Puntarlo con `#` darebbe un link che non aggancia
   niente e lascia il lettore in cima, che è il modo peggiore di sbagliare:
   sembra funzionare. */
function ancoreClassi(doc: Capitolo): Ancora[] {
  return dividiClassi(doc).flatMap((c) => {
    const rotta = `/srd/classi/${c.id}`;
    const pagina = `Classi › ${c.nome}`;
    return titoli(c.blocchi).map((t, i) => ({
      id: t.id,
      testo: t.testo,
      livello: LIVELLI_TITOLO[t.t],
      capitolo: "classi",
      href: i === 0 && t.t === "h2" ? rotta : `${rotta}#${t.id}`,
      pagina,
    }));
  });
}

/* Gli incantesimi: l'introduzione (le regole di lancio) resta sull'indice, le
   descrizioni stanno sulla pagina del loro livello. I titoli interni a una
   descrizione — le schede delle creature evocate — seguono l'incantesimo che li
   contiene, che è dove il divisore li ha messi. */
function ancoreIncantesimi(doc: Capitolo): Ancora[] {
  const { intro, incantesimi } = dividiIncantesimi(doc);
  const comuni = { capitolo: "incantesimi" } as const;
  return [
    ...titoli(intro).map((t) => ({
      ...comuni,
      id: t.id, testo: t.testo, livello: LIVELLI_TITOLO[t.t],
      href: `/srd/incantesimi#${t.id}`,
      pagina: "Incantesimi",
    })),
    ...incantesimi.flatMap((s) => {
      const rotta = `/srd/incantesimi/${slugLivello(s.livello)}`;
      return titoli(s.blocchi).map((t) => ({
        ...comuni,
        id: t.id, testo: t.testo, livello: LIVELLI_TITOLO[t.t],
        href: `${rotta}#${t.id}`,
        pagina: `Incantesimi › ${titoloLivello(s.livello)}`,
      }));
    }),
  ];
}

/* Gli oggetti magici: stessa forma degli incantesimi, col catalogo che sta
   sull'indice insieme alle regole. */
function ancoreOggetti(doc: Capitolo): Ancora[] {
  const { intro, catalogo, oggetti } = dividiOggetti(doc);
  const comuni = { capitolo: "oggetti-magici" } as const;
  return [
    ...titoli([...catalogo, ...intro]).map((t) => ({
      ...comuni,
      id: t.id, testo: t.testo, livello: LIVELLI_TITOLO[t.t],
      href: `/srd/oggetti-magici#${t.id}`,
      pagina: "Oggetti magici",
    })),
    ...oggetti.flatMap((o) => {
      const sez = SEZIONI_OGGETTI.find((s) => nellaSezione(o, s));
      /* Un oggetto senza sezione non ha una pagina che lo serva: meglio nessuna
         ancora che un'ancora che porta a un 404. */
      if (!sez) return [];
      return titoli(o.blocchi).map((t) => ({
        ...comuni,
        id: t.id, testo: t.testo, livello: LIVELLI_TITOLO[t.t],
        href: `/srd/oggetti-magici/${sez.slug}#${t.id}`,
        pagina: `Oggetti magici › ${sez.titolo}`,
      }));
    }),
  ];
}

/* --- Il registro ---------------------------------------------------------- */

/* Costruirlo vuol dire caricare 1,7 MB di JSON: si fa una volta per processo.
   A build time le pagine prerese sono una quarantina e lo chiedono tutte. */
let cache: Promise<Ancora[]> | null = null;

export function tutteLeAncore(): Promise<Ancora[]> {
  cache ??= (async () => {
    const fuoriSchema: Record<string, (d: Capitolo) => Ancora[]> = {
      classi: ancoreClassi,
      incantesimi: ancoreIncantesimi,
      "oggetti-magici": ancoreOggetti,
    };
    const tutte: Ancora[] = [];
    for (const c of CAPITOLI.filter((x) => x.pronto)) {
      const doc = await caricaCapitolo(c.id);
      if (!doc) continue;
      const speciale = fuoriSchema[c.id];
      if (speciale) tutte.push(...speciale(doc));
      else
        tutte.push(...titoli(doc.blocchi).map((t) => ({
          id: t.id, testo: t.testo, livello: LIVELLI_TITOLO[t.t],
          capitolo: c.id,
          href: `/srd/${c.id}#${t.id}`,
          pagina: c.titolo,
        })));
    }
    return tutte;
  })();
  return cache;
}

/* --- Rimandi: «Vedi anche "…"» diventa un link ---------------------------- */

/** Un tratto di testo da rendere come link: posizioni sul testo piatto del
 *  blocco. Non sugli span, perché il rimando li attraversa sempre — «Vedi
 *  anche» è in corsivo e i termini che seguono no, in tutti e 90 i casi del
 *  glossario. */
export type Intervallo = { da: number; a: number; href: string };

/** Data la prosa di un blocco, i tratti da trasformare in link. */
export type Rimandi = (testo: string) => Intervallo[];

const normalizza = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").trim();

/* Le chiavi con cui un titolo può essere citato. Il glossario intitola
   "Afferrato [condizione]" e il rimando cita "Afferrato": il suffisso fra
   quadre dice di che genere è la voce (condizione, azione, atteggiamento), non
   fa parte del nome. Senza questa regola 17 rimandi su 90 restavano testo. */
function chiaviDi(testo: string): string[] {
  const piena = normalizza(testo);
  const senzaGenere = piena.replace(/\s*\[[^\]]*\]\s*$/, "");
  return senzaGenere !== piena ? [piena, senzaGenere] : [piena];
}

/* Il rimando cita prima il capitolo e poi la sezione dentro di esso:
   «Vedi anche "Come si gioca" ("Competenza")». Il nome del capitolo, quindi,
   non è solo un link: è il CONTESTO in cui cercare i termini che seguono, ed è
   ciò che disambigua "Bonus di competenza", che esiste in tre capitoli. */
export async function rimandiDi(capitoloCorrente: string): Promise<Rimandi> {
  const ancore = await tutteLeAncore();

  const perCapitolo = new Map<string, Map<string, string>>();
  const ovunque = new Map<string, string[]>();
  for (const a of ancore) {
    const m = perCapitolo.get(a.capitolo) ?? new Map<string, string>();
    perCapitolo.set(a.capitolo, m);
    for (const k of chiaviDi(a.testo)) {
      /* Primo arrivato: dentro un capitolo i titoli ripetuti sono numerati
         nell'id ma non nel testo, e il rimando intende il primo. */
      if (!m.has(k)) m.set(k, a.href);
      const dove = ovunque.get(k) ?? [];
      if (!dove.includes(a.capitolo)) dove.push(a.capitolo);
      ovunque.set(k, dove);
    }
  }

  const capitoli = new Map(
    CAPITOLI.filter((c) => c.pronto).map((c) => [normalizza(c.titolo), c.id] as const),
  );

  return (testo: string) => {
    const trovati: Intervallo[] = [];
    /* La frase del rimando finisce al primo punto: «Vedi anche "Copertura". Se
       il creatore di un'area…» prosegue con prosa che non c'entra. */
    for (const frase of testo.matchAll(/[Vv]edi anche[^.]*/g)) {
      let contesto = capitoloCorrente;
      /* Un contesto DICHIARATO è un vincolo, non un suggerimento: in
         «Vedi anche "Equipaggiamento" ("Armi")» il lettore è stato mandato in
         Equipaggiamento, e "Armi" è anche il titolo di una sezione di Oggetti
         magici — il ripiego "univoco altrove" ce lo spediva, cioè nel capitolo
         sbagliato con l'aria di aver funzionato. */
      let dichiarato = false;
      const base = frase.index;
      for (const cit of frase[0].matchAll(/"([^"]+)"/g)) {
        const chiave = normalizza(cit[1]);
        const da = base + cit.index;
        const a = da + cit[0].length;

        const capitolo = capitoli.get(chiave);
        if (capitolo) {
          contesto = capitolo;
          dichiarato = true;
          trovati.push({ da, a, href: `/srd/${capitolo}` });
          continue;
        }
        /* Nel contesto prima che altrove: è la regola che fa atterrare
           "Creare il personaggio" nel suo capitolo e non in una voce omonima. */
        const qui = perCapitolo.get(contesto)?.get(chiave);
        if (qui) { trovati.push({ da, a, href: qui }); continue; }

        /* Fuori dal contesto si collega solo se il contesto non era dichiarato
           e il titolo è univoco in tutta la sezione: un rimando che porta alla
           voce sbagliata è peggio di un rimando che resta testo. */
        const dove = dichiarato ? undefined : ovunque.get(chiave);
        if (dove?.length === 1) {
          trovati.push({ da, a, href: perCapitolo.get(dove[0])!.get(chiave)! });
        }
        /* Quel che resta sono i titoli delle tavole illustrate del PDF
           ("Combattimento", "Esplorazione", "Danni e guarigione"): pagine con
           zero font, dove il titolo di sezione è un'immagine e non esiste come
           testo in nessun capitolo. Restano testo — ma il nome del capitolo che
           li precede è comunque un link, quindi il rimando porta comunque da
           qualche parte. */
      }
    }
    return trovati;
  };
}

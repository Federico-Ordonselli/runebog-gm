/**
 * Il tavolo dei giocatori: cosa esce dal server e cosa no.
 *
 * Regola non negoziabile: il filtro sta QUI, non nell'app. Ai giocatori non viene
 * mai spedito lo stato completo della campagna — se lo fosse, basterebbe aprire gli
 * strumenti di sviluppo per leggere note, twist e PF dei boss, e nascondere le cose
 * con il CSS sarebbe teatro. Tutto quello che non è esplicitamente costruito da
 * `projectForPlayers` non lascia il server.
 *
 * Due decisioni che vale la pena capire:
 *
 * 1. Le note sono DUE campi, non uno filtrato. `notes` sono gli appunti del DM e non
 *    escono mai; `playerNotes` è ciò che il DM scrive apposta per il tavolo. Filtrare
 *    della prosa è impossibile: o un testo è per i giocatori, o non lo è.
 *
 * 2. Un nodo si vede solo se ha `shared === true`. Non c'è ereditarietà: rivelare una
 *    città non rivela ciò che contiene. È l'app che, quando riveli qualcosa, rivela
 *    anche i livelli superiori — servono per raggiungerlo — così qui la condizione
 *    resta una sola, banale da verificare a colpo d'occhio.
 */

import { randomBytes } from "crypto";

type Node = Record<string, any>;

/** Token del link. 32 caratteri base64url ≈ 192 bit: non lo si indovina a tentativi. */
export function newShareToken() {
  return randomBytes(24).toString("base64url");
}

/** PF esatti e CA sono informazione da DM. Al tavolo arriva solo lo stato a occhio. */
function foeState(hp: number, hpMax: number) {
  if (hp <= 0) return "fuori combattimento";
  const pct = hpMax > 0 ? hp / hpMax : 1;
  if (pct >= 1) return "illeso";
  if (pct >= 0.5) return "ferito";
  if (pct >= 0.25) return "malconcio";
  return "in fin di vita";
}

/** Del blocco mostro sopravvivono i nomi e lo stato di salute. Niente statistiche. */
function projectCombat(m: Node | undefined) {
  const foes = Array.isArray(m?.foes) ? m!.foes : [];
  if (!foes.length) return undefined;
  return {
    foes: foes.map((f: Node) => ({
      id: safeId(f.id),
      name: String(f.name ?? "Nemico"),
      state: foeState(Number(f.hp) || 0, Number(f.hpMax) || 0),
    })),
    alive: foes.filter((f: Node) => (Number(f.hp) || 0) > 0).length,
    total: foes.length,
  };
}

/**
 * Tipi di collegamento che non escono mai, nemmeno tra due bolle rivelate.
 * Un passaggio segreto è un segreto del DM: che il cunicolo esista è precisamente
 * l'informazione che i giocatori devono guadagnarsi al tavolo, e l'etichetta lo
 * racconta pure ("cunicolo sotto il guado"). Rivelare le due estremità significa
 * "conoscono i due posti", non "conoscono la scorciatoia che li unisce".
 * Quando il gruppo lo scopre, il DM cambia il tipo in strada o tunnel.
 */
const DM_ONLY_EDGES = new Set(["segreto"]);

/**
 * I campi che il client interpola DENTRO attributi HTML (onclick="jumpTo('${id}')",
 * src="${img}", style="fill:${color}", translate(${x},${y})): l'escape del
 * client copre solo il testo, quindi qui si stringono a forme che da un attributo
 * non possono uscire. Un valore che non rispetta la forma si perde, non si ripara.
 */
const safeId = (v: unknown) => String(v ?? "").replace(/[^\w-]/g, "");
const num = (v: unknown, alt: number | null = null) =>
  Number.isFinite(Number(v)) ? Number(v) : alt;
const safeColor = (v: unknown) =>
  /^#[0-9a-f]{3,8}$/i.test(String(v)) ? String(v) : null;
function safeUrl(v: unknown) {
  const s = String(v ?? "");
  if (!/^(data:image\/|https?:\/\/)/i.test(s)) return null;   // niente javascript: e parenti
  if (/[\s"'<>`]/.test(s)) return null;                       // niente uscite dall'attributo
  return s;
}

/** Cerca un nodo per id in tutto l'albero: serve a risolvere i riferimenti
 *  dell'ordine d'iniziativa, che puntano a encounter ovunque nella campagna. */
function trovaNodo(n: Node | undefined, id: string): Node | undefined {
  if (!n) return undefined;
  if (n.id === id) return n;
  for (const c of (Array.isArray(n.children) ? n.children : [])) {
    const f = trovaNodo(c, id);
    if (f) return f;
  }
  return undefined;
}

/** Il nome visibile di una pedina, risolto dal riferimento che porta. */
function nomePedina(n: Node, data: Node) {
  if (n.playerId) {
    const p = (Array.isArray(data.players) ? data.players : [])
      .find((x: Node) => x.id === n.playerId);
    return String(p?.name ?? "PG");
  }
  if (n.foe) {
    const nodo = trovaNodo(data.root, String(n.foe.nodeId ?? ""));
    const f = (Array.isArray(nodo?.monster?.foes) ? nodo!.monster.foes : [])
      .find((x: Node) => x.id === n.foe.foeId);
    return String(f?.name ?? "Nemico");
  }
  return String(n.title ?? "");
}

/**
 * L'ordine d'iniziativa come lo vede il tavolo: nomi, numeri e di chi è il turno.
 *
 * I riferimenti si risolvono QUI, sul server, e ne esce solo il nome: la voce
 * salvata punta a un giocatore o a un nemico dentro un encounter, e spedirla
 * grezza significherebbe consegnare gli id di nodi che i giocatori non vedono.
 * Dei mostri non esce nessun PF — solo `down`, che è la stessa informazione già
 * pubblica via projectCombat ("fuori combattimento"), non un numero in più.
 */
function projectBattle(b: Node | undefined, data: Node) {
  const order = Array.isArray(b?.order) ? b!.order : [];
  if (!b || !order.length) return undefined;

  const voci = order.map((e: Node) => {
    let name = "", down = false;
    if (e?.kind === "pg") {
      const p = (Array.isArray(data.players) ? data.players : [])
        .find((x: Node) => x.id === e.playerId);
      if (!p) return null;                        // giocatore rimosso: sparisce dal tabellone
      name = String(p.name ?? "PG");
      down = (Number(p.hp) || 0) <= 0;
    } else {
      const nodo = trovaNodo(data.root, String(e?.nodeId ?? ""));
      const f = (Array.isArray(nodo?.monster?.foes) ? nodo!.monster.foes : [])
        .find((x: Node) => x.id === e.foeId);
      if (!f) return null;                        // nemico cancellato dal DM
      name = String(f.name ?? "Nemico");
      down = (Number(f.hp) || 0) <= 0;
    }
    return { id: safeId(e.id), name, init: num(e.init, 0) as number,
             kind: e.kind === "pg" ? "pg" : "foe", down };
  }).filter(Boolean);

  if (!voci.length) return undefined;
  // turn è un indice sull'elenco COMPLETO: dopo il filtro va riportato sulle voci
  // rimaste, sennò il tavolo evidenzierebbe la riga sbagliata.
  const attivo = safeId(order[num(b.turn, 0) as number]?.id);
  const turn = Math.max(0, voci.findIndex((v: any) => v.id === attivo));
  return { round: num(b.round, 1), turn, order: voci };
}

/**
 * Ricostruisce il nodo campo per campo. È volutamente una lista bianca: un campo
 * nuovo aggiunto al modello NON compare al tavolo finché qualcuno non lo scrive qui.
 * Se un giorno questa funzione diventasse "copia tutto tranne X", il primo campo
 * segreto che dimentichi di togliere finisce dritto in mano ai giocatori.
 */
function projectNode(n: Node, data: Node): Node {
  const kids = (Array.isArray(n.children) ? n.children : [])
    .filter((c: Node) => c?.shared === true)
    .map((c: Node) => projectNode(c, data));
  const visibleIds = new Set(kids.map((c: Node) => c.id));

  const out: Node = {
    id: safeId(n.id),
    // Una pedina collegata non ha titolo proprio: nell'app il nome si legge dal
    // giocatore o dal nemico a cui punta. Al tavolo quei dati non arrivano (e non
    // devono: sono id di nodi invisibili), quindi il nome lo risolve il server e
    // lo consegna già come titolo — altrimenti i giocatori vedrebbero pedine mute.
    title: n.type === "token" ? nomePedina(n, data) : String(n.title ?? ""),
    type: String(n.type ?? "zona"),              // il client la usa solo come chiave di lookup
    status: "",                                  // "da fare / in corso" è preparazione del DM
    notes: String(n.playerNotes ?? ""),          // ← MAI n.notes
    img: safeUrl(n.img),
    children: kids,
    // una strada si vede solo se si vedono entrambe le sue estremità (altrimenti
    // sarebbe una freccia verso un luogo che i giocatori non dovrebbero sapere che
    // esiste) E se il suo tipo non è di quelli riservati al DM
    edges: (Array.isArray(n.edges) ? n.edges : [])
      .filter((e: Node) => !DM_ONLY_EDGES.has(String(e.type ?? "")))
      .filter((e: Node) => visibleIds.has(safeId(e.a)) && visibleIds.has(safeId(e.b)))
      .map((e: Node) => ({
        id: safeId(e.id), a: safeId(e.a), b: safeId(e.b),
        type: String(e.type ?? ""), label: String(e.label ?? ""), notes: "",
      })),
    x: num(n.x),
    y: num(n.y),
    shape: n.shape != null ? String(n.shape) : null,
  };
  // I muri: esce solo la SCELTA esplicita del DM (acceso o spento), perché il
  // default lo decide la forma e il client lo conosce già. Le porte non escono
  // affatto — il client le ricava dagli archi che ha in mano, e quelli segreti
  // qui sopra sono già stati tolti: ai giocatori resta un muro pieno, non
  // un'apertura da nascondere.
  if (typeof n.walls === "boolean") out.walls = n.walls;
  const w = num(n.w), h = num(n.h);
  if (w) out.w = w;
  if (h) out.h = h;
  // `tokenColor` è il vecchio nome (valeva solo per le pedine): l'app migra al volo
  // in migrateState, ma una campagna salvata prima e non più riaperta dal DM ha
  // ancora il campo vecchio nel JSONB — finché non la risalva, va letto anche quello.
  const color = safeColor(n.color) ?? safeColor(n.tokenColor);
  if (color) out.color = color;
  const bgImg = safeUrl(n.bg?.img);              // lo sfondo è la mappa disegnata: è il senso di tutto
  if (bgImg) out.bg = {
    img: bgImg,
    x: num(n.bg.x, 0), y: num(n.bg.y, 0),
    w: num(n.bg.w, 0), h: num(n.bg.h, 0),
    opacity: num(n.bg.opacity, 0.6),
  };

  const combat = projectCombat(n.monster);
  if (combat) out.combat = combat;

  // I riferimenti della pedina (playerId / foe) NON escono: al tavolo servono
  // solo nome e colore, che il client ricava dal titolo. Spedirli darebbe ai
  // giocatori gli id di nodi che non possono vedere.
  const battle = projectBattle(n.battle, data);
  if (battle) out.battle = battle;

  return out;
}

/**
 * Lo stato che riceve il tavolo. Stessa forma dell'app (root/checklist/players), così
 * l'app non deve imparare un secondo formato — ma con dentro solo il rivelato.
 */
export function projectForPlayers(data: Node | null | undefined) {
  if (!data?.root) return null;
  const root = projectNode(data.root, data);     // la radice c'è sempre: è il contenitore
  return {
    root,
    checklist: [],                               // la checklist è la lista della spesa del DM
    players: (Array.isArray(data.players) ? data.players : []).map((p: Node) => ({
      id: safeId(p.id), name: String(p.name ?? ""), cls: String(p.cls ?? ""),
      // le schede dei PG sono loro: passano intere. Ma i PF sono interpolati
      // come numeri nella scheda: una stringa lì dentro sarebbe HTML.
      hp: num(p.hp, 0), hpMax: num(p.hpMax, 0), notes: String(p.notes ?? ""),
    })),
  };
}

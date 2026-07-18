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
 * I campi che il client interpola DENTRO attributi HTML (onclick="jumpTo('${id}')",
 * src="${img}", style="fill:${tokenColor}", translate(${x},${y})): l'escape del
 * client copre solo il testo, quindi qui si stringono a forme che da un attributo
 * non possono uscire. Un valore che non rispetta la forma si perde, non si ripara.
 */
/**
 * Tipi di collegamento che non escono mai, nemmeno tra due bolle rivelate.
 * Un passaggio segreto è un segreto del DM: che il cunicolo esista è precisamente
 * l'informazione che i giocatori devono guadagnarsi al tavolo, e l'etichetta lo
 * racconta pure ("cunicolo sotto il guado"). Rivelare le due estremità significa
 * "conoscono i due posti", non "conoscono la scorciatoia che li unisce".
 * Quando il gruppo lo scopre, il DM cambia il tipo in strada o tunnel.
 */
const DM_ONLY_EDGES = new Set(["segreto"]);

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

/**
 * Ricostruisce il nodo campo per campo. È volutamente una lista bianca: un campo
 * nuovo aggiunto al modello NON compare al tavolo finché qualcuno non lo scrive qui.
 * Se un giorno questa funzione diventasse "copia tutto tranne X", il primo campo
 * segreto che dimentichi di togliere finisce dritto in mano ai giocatori.
 */
function projectNode(n: Node): Node {
  const kids = (Array.isArray(n.children) ? n.children : [])
    .filter((c: Node) => c?.shared === true)
    .map(projectNode);
  const visibleIds = new Set(kids.map((c: Node) => c.id));

  const out: Node = {
    id: safeId(n.id),
    title: String(n.title ?? ""),
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
  const w = num(n.w), h = num(n.h);
  if (w) out.w = w;
  if (h) out.h = h;
  const tokenColor = safeColor(n.tokenColor);
  if (tokenColor) out.tokenColor = tokenColor;
  const bgImg = safeUrl(n.bg?.img);              // lo sfondo è la mappa disegnata: è il senso di tutto
  if (bgImg) out.bg = {
    img: bgImg,
    x: num(n.bg.x, 0), y: num(n.bg.y, 0),
    w: num(n.bg.w, 0), h: num(n.bg.h, 0),
    opacity: num(n.bg.opacity, 0.6),
  };

  const combat = projectCombat(n.monster);
  if (combat) out.combat = combat;

  return out;
}

/**
 * Lo stato che riceve il tavolo. Stessa forma dell'app (root/checklist/players), così
 * l'app non deve imparare un secondo formato — ma con dentro solo il rivelato.
 */
export function projectForPlayers(data: Node | null | undefined) {
  if (!data?.root) return null;
  const root = projectNode(data.root);           // la radice c'è sempre: è il contenitore
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

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
      id: String(f.id ?? ""),
      name: String(f.name ?? "Nemico"),
      state: foeState(Number(f.hp) || 0, Number(f.hpMax) || 0),
    })),
    alive: foes.filter((f: Node) => (Number(f.hp) || 0) > 0).length,
    total: foes.length,
  };
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
    id: n.id,
    title: n.title ?? "",
    type: n.type ?? "zona",
    status: "",                                  // "da fare / in corso" è preparazione del DM
    notes: n.playerNotes ?? "",                  // ← MAI n.notes
    img: n.img ?? null,
    children: kids,
    // una strada si vede solo se si vedono entrambe le sue estremità: altrimenti
    // sarebbe una freccia verso un luogo che i giocatori non dovrebbero sapere che esiste
    edges: (Array.isArray(n.edges) ? n.edges : [])
      .filter((e: Node) => visibleIds.has(e.a) && visibleIds.has(e.b))
      .map((e: Node) => ({ id: e.id, a: e.a, b: e.b, type: e.type, label: e.label ?? "", notes: "" })),
    x: n.x ?? null,
    y: n.y ?? null,
    shape: n.shape ?? null,
  };
  if (n.w) out.w = n.w;
  if (n.h) out.h = n.h;
  if (n.tokenColor) out.tokenColor = n.tokenColor;
  if (n.bg) out.bg = n.bg;                       // lo sfondo è la mappa disegnata: è il senso di tutto

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
      id: p.id, name: p.name ?? "", cls: p.cls ?? "",
      hp: p.hp, hpMax: p.hpMax, notes: p.notes ?? "",   // le schede dei PG sono loro: passano intere
    })),
  };
}

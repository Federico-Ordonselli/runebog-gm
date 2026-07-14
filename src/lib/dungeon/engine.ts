/* Runebog — motore del generatore di dungeon.
   Puro e deterministico: stesso seed => stesso dungeon, anche tra server e
   client (è ciò che permette di generare già in SSR senza lampi all'idratazione).
   Niente React qui: la UI vive in src/app/dungeon/.
   Griglia D&D 5e: 1 quadrato = 5 piedi = 1,5 m. */

// ============ tipi ============
export type Ruleset = "2014" | "2024";
export type Difficulty = "facile" | "medio" | "difficile" | "mortale";
export type Rarity = "common" | "uncommon" | "rare" | "veryRare" | "legendary";
export type RoomType =
  | "ingresso" | "combattimento" | "tesoro" | "trappola" | "enigma"
  | "riposo" | "tana" | "vuota" | "boss";

export interface Monster {
  name: string; cr: number; xp: number; type: string; size: string;
  ac: number; hp: number; hpDice: string; speed: number; tags: string[];
}
export interface MagicItem { name: string; cat: string }

export interface EncounterGroup { mon: Monster; count: number }
export interface Encounter { groups: EncounterGroup[]; adjXP: number; budget: number; rawXP: number }
export interface Coins { cp: number; sp: number; gp: number; pp: number }
export interface Valuable { value: number; name: string }
export interface LootMagic { name: string; rarity: Rarity; category: string }
export interface Loot { coins: Coins; gems: Valuable[]; art: Valuable[]; magic: LootMagic[] }
export interface Trap { name: string; save: string; dc: number; damage: string; damageType: string; effect: string }

interface MapRoom { id: number; x: number; y: number; w: number; h: number; cx: number; cy: number; type?: RoomType }
export interface Room extends MapRoom {
  type: RoomType; index: number; label: string; description: string;
  encounter: Encounter | null; loot: Loot | null; traps: Trap[]; features: string[];
}

export type ThemeKey = keyof typeof THEMES;
export interface DungeonParams {
  seed: number; name: string; roomCount: number; theme: ThemeKey;
  level: number; partySize: number; difficulty: Difficulty; ruleset: Ruleset;
}
export interface Dungeon {
  name: string; seed: number; params: DungeonParams;
  grid: number[][]; gridW: number; gridH: number;
  rooms: Room[]; doors: { x: number; y: number; room: number }[];
  /** Coppie di stanze collegate da un corridoio (id di stanza, dedotte dagli archi scavati). */
  connections: [number, number][];
}
interface Pools { monsters: Monster[]; magic: Record<Rarity, MagicItem[]> }

// ============ RNG + helpers ============
type Rng = () => number;
const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const rollDie = (r: Rng, s: number) => 1 + Math.floor(r() * s);
const rollDice = (r: Rng, n: number, s: number) => { let x = 0; for (let i = 0; i < n; i++) x += rollDie(r, s); return x; };
const randInt = (r: Rng, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const pick = <T,>(r: Rng, a: readonly T[]): T => a[Math.floor(r() * a.length)];
function weighted<T>(r: Rng, e: [T, number][]): T {
  const t = e.reduce((s, x) => s + x[1], 0);
  let k = r() * t;
  for (const [v, w] of e) { if ((k -= w) <= 0) return v; }
  return e[e.length - 1][0];
}

// ============ tabelle D&D ============
const XP_THRESH_2014: Record<number, number[]> = { 1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500], 5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100], 9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500], 13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400], 16: [1600, 3200, 4800, 7200], 17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500], 19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700] };
const XP_BUDGET_2024: Record<number, number[]> = { 1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100], 6: [600, 1000, 1400], 7: [750, 1300, 1700], 8: [1000, 1700, 2100], 9: [1300, 2000, 2600], 10: [1600, 2300, 3100], 11: [1900, 2900, 4100], 12: [2200, 3700, 4700], 13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800], 16: [3800, 6100, 9800], 17: [4500, 7200, 11700], 18: [5000, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22000] };
const DIFF_INDEX: Record<Difficulty, number> = { facile: 0, medio: 1, difficile: 2, mortale: 3 };
const DIFF_2024: Record<Difficulty, number> = { facile: 0, medio: 1, difficile: 2, mortale: 2 };
const DIFF_ORDER: Difficulty[] = ["facile", "medio", "difficile", "mortale"];
const stepDifficulty = (d: Difficulty, n: number): Difficulty =>
  DIFF_ORDER[Math.max(0, Math.min(3, DIFF_ORDER.indexOf(d) + n))];
const MULT_ROWS = [1, 1.5, 2, 2.5, 3, 4];
const multRowIndex = (c: number) => (c <= 1 ? 0 : c === 2 ? 1 : c <= 6 ? 2 : c <= 10 ? 3 : c <= 14 ? 4 : 5);
function encMult(c: number, ps: number) {
  let i = multRowIndex(c);
  if (ps < 3) i = Math.min(i + 1, 5); else if (ps >= 6) i = Math.max(i - 1, 0);
  return MULT_ROWS[i];
}
function xpBudget(l: number, ps: number, d: Difficulty, rs: Ruleset) {
  return rs === "2024" ? XP_BUDGET_2024[l][DIFF_2024[d]] * ps : XP_THRESH_2014[l][DIFF_INDEX[d]] * ps;
}
function adjustedXP(g: EncounterGroup[], rs: Ruleset, ps: number) {
  const raw = g.reduce((s, x) => s + x.mon.xp * x.count, 0);
  if (rs === "2024") return raw;
  const c = g.reduce((s, x) => s + x.count, 0);
  return Math.round(raw * encMult(c, ps));
}
export const crLabel = (cr: number) => (cr === 0.125 ? "1/8" : cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr));

// ============ costruzione incontri (validato) ============
function buildEncounter(r: Rng, pool: Monster[], level: number, partySize: number, difficulty: Difficulty, ruleset: Ruleset): Encounter {
  const budget = xpBudget(level, partySize, difficulty, ruleset);
  const cap = budget * 1.15;
  const band = (fd: number, cm: number) => pool.filter((m) => m.xp > 0 && m.xp >= budget / fd && m.xp <= budget * cm);
  let cand = band(12, 1.2);
  if (cand.length < 2) cand = band(20, 1.25);
  if (cand.length < 2) cand = band(40, 1.6);
  if (cand.length === 0) cand = [...pool].filter((m) => m.xp > 0).sort((a, b) => Math.abs(a.xp - budget) - Math.abs(b.xp - budget)).slice(0, 6);
  if (cand.length === 0) return { groups: [], adjXP: 0, budget, rawXP: 0 };
  const groups: EncounterGroup[] = [];
  const speciesTarget = weighted(r, [[1, 3], [2, 4], [3, 2]]);
  let guard = 0;
  const tryAdd = (mon: Monster) => {
    const t = groups.map((g) => ({ ...g }));
    const e = t.find((g) => g.mon.name === mon.name);
    if (e) e.count++; else t.push({ mon, count: 1 });
    return adjustedXP(t, ruleset, partySize) <= cap;
  };
  const commit = (mon: Monster) => {
    const c = groups.find((g) => g.mon.name === mon.name);
    if (c) c.count++; else groups.push({ mon, count: 1 });
  };
  while (guard++ < 300) {
    if (adjustedXP(groups, ruleset, partySize) >= budget * 0.85) break;
    if (groups.reduce((s, g) => s + g.count, 0) >= 14) break;
    const useEx = groups.length >= speciesTarget || (groups.length > 0 && r() < 0.6);
    const target = useEx && groups.length ? pick(r, groups).mon : pick(r, cand);
    if (tryAdd(target)) commit(target);
    else {
      const small = cand.reduce((a, b) => (a.xp < b.xp ? a : b));
      if (tryAdd(small)) commit(small); else break;
    }
  }
  if (groups.length === 0) groups.push({ mon: cand.reduce((a, b) => (a.xp < b.xp ? a : b)), count: 1 });
  const rawXP = groups.reduce((s, g) => s + g.mon.xp * g.count, 0);
  return { groups, adjXP: adjustedXP(groups, ruleset, partySize), budget, rawXP };
}

// ============ mappa (validato) ============
// Celle: 0 roccia, 1 stanza, 2 corridoio, 3 porta.
function generateMap(r: Rng, o: { gridW: number; gridH: number; roomCount: number; minRoom: number; maxRoom: number }) {
  const { gridW, gridH, roomCount, minRoom, maxRoom } = o;
  const grid: number[][] = Array.from({ length: gridH }, () => new Array(gridW).fill(0));
  const roomId: number[][] = Array.from({ length: gridH }, () => new Array(gridW).fill(-1));
  const rooms: MapRoom[] = [];
  let att = 0;
  while (rooms.length < roomCount && att < roomCount * 50) {
    att++;
    const w = randInt(r, minRoom, maxRoom), h = randInt(r, minRoom, maxRoom);
    const x = randInt(r, 1, gridW - w - 1), y = randInt(r, 1, gridH - h - 1);
    let ok = true;
    for (let yy = y - 1; yy <= y + h && ok; yy++)
      for (let xx = x - 1; xx <= x + w && ok; xx++)
        if (yy >= 0 && yy < gridH && xx >= 0 && xx < gridW && grid[yy][xx] !== 0) ok = false;
    if (!ok) continue;
    const id = rooms.length;
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { grid[yy][xx] = 1; roomId[yy][xx] = id; }
    rooms.push({ id, x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
  }
  // Albero di copertura sulle distanze Manhattan + qualche anello in più.
  const edges: [number, number][] = [];
  if (rooms.length > 1) {
    const inT = new Set([0]);
    while (inT.size < rooms.length) {
      let best: { a: number; b: number; d: number } | null = null;
      for (const a of inT)
        for (let b = 0; b < rooms.length; b++) {
          if (inT.has(b)) continue;
          const d = Math.abs(rooms[a].cx - rooms[b].cx) + Math.abs(rooms[a].cy - rooms[b].cy);
          if (!best || d < best.d) best = { a, b, d };
        }
      edges.push([best!.a, best!.b]);
      inT.add(best!.b);
    }
    const extra = Math.floor(rooms.length * 0.18);
    for (let i = 0; i < extra; i++) {
      const a = randInt(r, 0, rooms.length - 1), b = randInt(r, 0, rooms.length - 1);
      if (a !== b) edges.push([a, b]);
    }
  }
  const carve = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= gridW || y >= gridH) return;
    if (grid[y][x] === 0) grid[y][x] = 2;
  };
  for (const [a, b] of edges) {
    const { cx: x0, cy: y0 } = rooms[a]; const { cx: x1, cy: y1 } = rooms[b];
    if (r() < 0.5) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) carve(x, y0);
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) carve(x1, y);
    } else {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) carve(x0, y);
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) carve(x, y1);
    }
  }
  // Una porta per lato di stanza: dove un corridoio tocca la stanza.
  const doors: { x: number; y: number; room: number }[] = [];
  const seen = new Set<string>();
  for (let y = 0; y < gridH; y++)
    for (let x = 0; x < gridW; x++) {
      if (grid[y][x] !== 2) continue;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        if (grid[ny][nx] === 1) {
          const key = roomId[ny][nx];
          const side = `${key}:${nx < x ? "W" : nx > x ? "E" : ny < y ? "N" : "S"}`;
          if (!seen.has(side)) { seen.add(side); grid[y][x] = 3; doors.push({ x, y, room: key }); }
          break;
        }
      }
    }
  return { grid, roomId, rooms, doors, edges };
}

function assignRoomTypes(r: Rng, rooms: MapRoom[]) {
  if (!rooms.length) return;
  let entrance = rooms[0], be = Infinity;
  for (const rm of rooms) { const d = Math.min(rm.cx, rm.cy); if (d < be) { be = d; entrance = rm; } }
  entrance.type = "ingresso";
  let boss = entrance, far = -1;
  for (const rm of rooms) {
    if (rm === entrance) continue;
    const d = Math.abs(rm.cx - entrance.cx) + Math.abs(rm.cy - entrance.cy);
    if (d > far) { far = d; boss = rm; }
  }
  if (boss !== entrance) boss.type = "boss";
  const rest = rooms.filter((rm) => !rm.type);
  let tg = false;
  for (const rm of rest) {
    rm.type = weighted<RoomType>(r, [["combattimento", 10], ["tesoro", 3], ["trappola", 3], ["enigma", 2], ["riposo", 2], ["tana", 3], ["vuota", 2]]);
    if (rm.type === "tesoro") tg = true;
  }
  if (!tg && rest.length) pick(r, rest).type = "tesoro";
}

// ============ bottino (validato) ============
const GEM_TIERS: [number, string][] = [[10, "quarzo colorato"], [50, "onice/citrino"], [100, "perla/ametista"], [500, "topazio/giada"], [1000, "zaffiro/smeraldo"], [5000, "diamante/rubino"]];
const ART_TIERS: [number, string][] = [[25, "statuetta d’osso intagliata"], [250, "calice d’argento con ambra"], [750, "maschera cerimoniale dorata"], [2500, "corona ingioiellata"], [7500, "diadema di platino"]];
const partyTier = (l: number) => (l <= 4 ? 1 : l <= 10 ? 2 : l <= 16 ? 3 : 4);

function generateLoot(r: Rng, level: number, kind: "hoard" | "individual", magicItems: Record<Rarity, MagicItem[]>): Loot {
  const tier = partyTier(level);
  const hoard = kind === "hoard";
  const loot: Loot = { coins: { cp: 0, sp: 0, gp: 0, pp: 0 }, gems: [], art: [], magic: [] };
  const cm = hoard ? 1 : 0.15;
  const base = [
    [rollDice(r, 3, 6) * 10, 0],
    [rollDice(r, 4, 6) * 50, rollDice(r, 2, 6) * 5],
    [rollDice(r, 4, 6) * 100, rollDice(r, 3, 6) * 10],
    [rollDice(r, 3, 6) * 1000, rollDice(r, 4, 6) * 50],
  ][tier - 1];
  loot.coins.gp = Math.round(base[0] * cm);
  loot.coins.pp = Math.round(base[1] * cm);
  loot.coins.sp = hoard ? rollDice(r, 2, 6) * 10 : rollDice(r, 2, 6);
  loot.coins.cp = hoard ? rollDice(r, 2, 6) * 20 : rollDice(r, 3, 6);
  if (hoard) {
    const gt = Math.min(tier, GEM_TIERS.length - 1);
    for (let i = 0, n = randInt(r, 0, 2 + tier); i < n; i++) {
      const [v, nm] = GEM_TIERS[Math.max(0, randInt(r, gt - 1, gt))];
      loot.gems.push({ value: v, name: nm });
    }
    for (let i = 0, n = randInt(r, 0, 1 + Math.floor(tier / 2)); i < n; i++) {
      const [v, nm] = ART_TIERS[Math.min(ART_TIERS.length - 1, Math.max(0, randInt(r, tier - 2, tier - 1)))];
      loot.art.push({ value: v, name: nm });
    }
  }
  const rw: Record<number, [Rarity, number][]> = {
    1: [["common", 4], ["uncommon", 3], ["rare", 0.3]],
    2: [["common", 1], ["uncommon", 5], ["rare", 3], ["veryRare", 0.5]],
    3: [["uncommon", 2], ["rare", 5], ["veryRare", 3], ["legendary", 0.5]],
    4: [["rare", 2], ["veryRare", 5], ["legendary", 3]],
  };
  const nM = hoard ? randInt(r, 1, tier >= 3 ? 3 : 2) : r() < 0.12 ? 1 : 0;
  for (let i = 0; i < nM; i++) {
    const rar = weighted(r, rw[tier]);
    const arr = magicItems[rar] || magicItems.uncommon;
    if (arr && arr.length) {
      const it = pick(r, arr);
      loot.magic.push({ name: it.name, rarity: rar, category: it.cat });
    }
  }
  return loot;
}
export const lootTotalGp = (l: Loot) => {
  const c = l.coins;
  let g = c.cp / 100 + c.sp / 10 + c.gp + c.pp * 10;
  for (const x of l.gems) g += x.value;
  for (const x of l.art) g += x.value;
  return Math.round(g);
};
export const lootEmpty = (l: Loot) =>
  !l.coins.gp && !l.coins.pp && !l.coins.sp && !l.coins.cp && !l.gems.length && !l.art.length && !l.magic.length;

// ============ flavor italiano ============
const ROOM_NAMES: Record<RoomType, string[]> = { ingresso: ["Atrio d’Ingresso", "Vestibolo Crollato", "Soglia del Guardiano", "Anticamera Polverosa"], combattimento: ["Sala delle Guardie", "Camera dei Pilastri", "Galleria Insanguinata", "Corte Interna", "Sala d’Armi"], tesoro: ["Cripta del Tesoro", "Camera del Bottino", "Volta Sigillata", "Reliquiario", "Sala del Forziere"], trappola: ["Corridoio Ingannevole", "Sala dei Meccanismi", "Passaggio Maledetto", "Camera delle Lame"], enigma: ["Sala degli Enigmi", "Camera dei Sigilli", "Santuario del Quesito", "Stanza dei Simboli"], riposo: ["Rifugio Silenzioso", "Cappella Abbandonata", "Nicchia Sicura", "Sala della Fonte"], tana: ["Tana Fetida", "Covo Buio", "Nido Brulicante", "Antro della Bestia"], vuota: ["Sala Vuota", "Corridoio Deserto", "Magazzino Saccheggiato", "Camera Spoglia"], boss: ["Sala del Trono", "Santuario Profano", "Camera del Signore", "Cuore del Dungeon"] };
const SUFFIXES = ["delle Ossa Sussurranti", "del Silenzio Eterno", "dei Sette Sigilli", "della Fiamma Nera", "del Sangue Antico", "del Verme Divoratore", "della Regina Caduta"];
const DESC = {
  air: ["L’aria è umida e stagnante", "Un freddo innaturale pervade la stanza", "L’aria sa di fumo e cenere", "Un tanfo di decomposizione riempie il luogo", "L’aria vibra di un’energia arcana"],
  light: ["le torce morenti proiettano ombre lunghe", "un muschio bioluminescente tinge tutto di blu", "cristalli pulsanti emanano un chiarore fioco", "regna il buio, rotto solo dalla vostra luce", "braci morenti offrono un tenue bagliore"],
  detail: ["ossa spezzate sono sparse sul pavimento", "fitte ragnatele coprono gli angoli", "affreschi sbiaditi narrano battaglie dimenticate", "rune arcane sono incise nella pietra", "catene arrugginite pendono dal soffitto", "una pozza d’acqua scura riflette la volta", "colonne scheggiate reggono a fatica il soffitto"],
};
interface TrapSpec { name: string; save: string; dmgType: string; dice: Record<number, string>; effect: string }
const TRAPS: TrapSpec[] = [
  { name: "Fossa Nascosta", save: "Destrezza", dmgType: "contundente (caduta)", dice: { 1: "2d6", 2: "4d6", 3: "6d6", 4: "8d6" }, effect: "una botola cede: chi fallisce precipita in una fossa di 3 m" },
  { name: "Dardi Avvelenati", save: "Destrezza", dmgType: "perforante + veleno", dice: { 1: "2d4", 2: "3d4", 3: "4d4", 4: "6d4" }, effect: "dardi scattano dalle feritoie nelle pareti" },
  { name: "Ago Avvelenato", save: "Costituzione", dmgType: "veleno", dice: { 1: "1d10", 2: "2d10", 3: "4d10", 4: "6d10" }, effect: "un ago celato nella serratura inietta veleno" },
  { name: "Lama a Pendolo", save: "Destrezza", dmgType: "tagliente", dice: { 1: "2d8", 2: "4d8", 3: "6d8", 4: "8d8" }, effect: "una lama oscilla dal soffitto lungo il passaggio" },
  { name: "Soffitto Crollante", save: "Destrezza", dmgType: "contundente", dice: { 1: "2d10", 2: "4d10", 3: "6d10", 4: "8d10" }, effect: "blocchi di pietra precipitano dall’alto" },
  { name: "Glifo di Fuoco", save: "Destrezza", dmgType: "fuoco (area 3 m)", dice: { 1: "2d6", 2: "4d6", 3: "7d6", 4: "10d6" }, effect: "un glifo esplode in fiamme investendo l’area" },
  { name: "Scarica di Fulmini", save: "Destrezza", dmgType: "fulmine (area)", dice: { 1: "2d6", 2: "4d6", 3: "7d6", 4: "9d6" }, effect: "piastre a contatto scatenano una scarica elettrica" },
  { name: "Nube Tossica", save: "Costituzione", dmgType: "veleno (nube)", dice: { 1: "1d6", 2: "3d6", 3: "5d6", 4: "7d6" }, effect: "gas velenoso satura la stanza per alcuni round" },
  { name: "Rete a Scatto", save: "Destrezza", dmgType: "—", dice: { 1: "0", 2: "0", 3: "0", 4: "0" }, effect: "una rete cade dall’alto: bersaglio Trattenuto (CD Forza per liberarsi)" },
  { name: "Runa del Terrore", save: "Saggezza", dmgType: "psichico", dice: { 1: "1d6", 2: "2d6", 3: "3d6", 4: "4d6" }, effect: "una runa proietta visioni: bersaglio Spaventato per 1 minuto" },
];
const TRAP_DC: Record<number, number> = { 1: 12, 2: 14, 3: 16, 4: 18 };
const FEATURES = ["Un altare di pietra macchiato di sangue rappreso", "Un sarcofago sigillato con iscrizioni in una lingua morta", "Scaffali marci carichi di tomi ammuffiti e illeggibili", "La statua di una divinità dimenticata, il volto eroso", "Una fontana asciutta col fondo coperto di monete verdi di ruggine", "Un mucchio di equipaggiamento arrugginito e inservibile", "Una gabbia dalle sbarre piegate verso l’esterno", "Un grande affresco che raffigura una profezia oscura", "Uno scheletro incatenato alla parete, la bocca in un urlo muto", "Un fungo colossale che pulsa di una luce malata", "Bracieri spenti in cerchio attorno a un simbolo inciso", "Un pozzo profondo da cui sale un eco di gocciolio"];

export const THEMES = {
  misto: { label: "Misto (tutti)", tags: null as string[] | null },
  nonmorti: { label: "Cripta non-morta", tags: ["undead", "undead_theme"] },
  goblinoidi: { label: "Covo di goblinoidi", tags: ["goblinoid", "orc", "gnoll", "humanoid_npc"] },
  drago: { label: "Tana di drago", tags: ["draconic", "kobold"] },
  fuoco: { label: "Caverne di fuoco", tags: ["fire", "elemental"] },
  ghiaccio: { label: "Caverne di ghiaccio", tags: ["ice", "elemental"] },
  aberrazioni: { label: "Nido di aberrazioni", tags: ["aberrant", "aberration", "ooze_theme"] },
  banditi: { label: "Rifugio di banditi", tags: ["humanoid_npc"] },
  bosco: { label: "Bosco corrotto", tags: ["fey_theme", "plant_theme", "fey"] },
  infernale: { label: "Fortezza infernale", tags: ["demon", "devil", "fiend"] },
  bestie: { label: "Rovine bestiali", tags: ["wild_beast", "monstrosity", "vermin", "beast"] },
};

function themePool(monsters: Monster[], themeKey: ThemeKey) {
  const t = THEMES[themeKey];
  if (!t || !t.tags) return monsters;
  return monsters.filter((m) => t.tags!.some((tag) => m.tags.includes(tag)));
}
function roomName(r: Rng, type: RoomType) {
  let n = pick(r, ROOM_NAMES[type]);
  if (["boss", "tesoro", "tana"].includes(type) && r() < 0.5) n += " " + pick(r, SUFFIXES);
  return n;
}
function roomDesc(r: Rng) {
  return `${pick(r, DESC.air)}; ${pick(r, DESC.light)}. Sul posto, ${pick(r, DESC.detail)}.`;
}
function makeTrap(r: Rng, tier: number): Trap {
  const t = pick(r, TRAPS);
  const dc = Math.max(10, Math.min(20, TRAP_DC[tier] + randInt(r, -1, 1)));
  return { name: t.name, save: t.save, dc, damage: t.dice[tier], damageType: t.dmgType, effect: t.effect };
}

// ============ contenuto stanza ============
function generateRoomContent(r: Rng, room: MapRoom, params: DungeonParams, pools: Pools) {
  const { level, partySize, difficulty, ruleset } = params;
  const tier = partyTier(level);
  const c: { encounter: Encounter | null; loot: Loot | null; traps: Trap[]; features: string[] } =
    { encounter: null, loot: null, traps: [], features: [] };
  const enc = (diff: Difficulty) => buildEncounter(r, pools.monsters, level, partySize, diff, ruleset);
  switch (room.type) {
    case "ingresso":
      if (r() < 0.4) c.encounter = enc(stepDifficulty(difficulty, -1));
      if (r() < 0.3) c.traps.push(makeTrap(r, tier));
      break;
    case "combattimento":
      c.encounter = enc(difficulty);
      if (r() < 0.5) c.loot = generateLoot(r, level, "individual", pools.magic);
      break;
    case "tana":
      c.encounter = enc(stepDifficulty(difficulty, r() < 0.5 ? 1 : 0));
      c.loot = generateLoot(r, level, r() < 0.4 ? "hoard" : "individual", pools.magic);
      break;
    case "tesoro":
      c.loot = generateLoot(r, level, "hoard", pools.magic);
      if (r() < 0.6) c.traps.push(makeTrap(r, tier));
      if (r() < 0.3) c.encounter = enc(stepDifficulty(difficulty, -1));
      break;
    case "trappola": {
      const n = randInt(r, 1, 2);
      for (let i = 0; i < n; i++) c.traps.push(makeTrap(r, tier));
      if (r() < 0.4) c.loot = generateLoot(r, level, "individual", pools.magic);
      break;
    }
    case "enigma":
      c.features.push(pick(r, FEATURES));
      if (r() < 0.6) c.loot = generateLoot(r, level, "individual", pools.magic);
      break;
    case "riposo":
      break;
    case "vuota":
      if (r() < 0.5) c.features.push(pick(r, FEATURES));
      break;
    case "boss":
      c.encounter = enc(stepDifficulty(difficulty, 1));
      c.loot = generateLoot(r, level, "hoard", pools.magic);
      if (r() < 0.4) c.traps.push(makeTrap(r, tier));
      break;
  }
  if (room.type !== "vuota" && room.type !== "enigma" && r() < 0.35) c.features.push(pick(r, FEATURES));
  return c;
}

// ============ orchestrazione ============
function gridDims(roomCount: number) {
  return { gridW: Math.min(60, 28 + roomCount * 2), gridH: Math.min(44, (20 + roomCount * 1.4) | 0) };
}

export function generateDungeon(params: DungeonParams, monsters: Monster[], magicItems: Record<Rarity, MagicItem[]>): Dungeon {
  const { seed, name, roomCount, theme } = params;
  const r = mulberry32(seed);
  const pools: Pools = { monsters: themePool(monsters, theme), magic: magicItems };
  const { gridW, gridH } = gridDims(roomCount);
  const map = generateMap(r, { gridW, gridH, roomCount, minRoom: 3, maxRoom: 8 });
  assignRoomTypes(r, map.rooms);
  const rooms: Room[] = map.rooms.map((rm, i) => {
    const content = generateRoomContent(r, rm, params, pools);
    return { ...rm, type: rm.type!, index: i + 1, label: roomName(r, rm.type!), description: roomDesc(r), ...content };
  });
  // Gli archi extra possono duplicare quelli dell'albero: una coppia una volta sola.
  const seen = new Set<string>();
  const connections: [number, number][] = [];
  for (const [a, b] of map.edges) {
    if (a === b) continue;
    const key = Math.min(a, b) + ":" + Math.max(a, b);
    if (!seen.has(key)) { seen.add(key); connections.push([a, b]); }
  }
  return { name, seed, params, grid: map.grid, gridW, gridH, rooms, doors: map.doors, connections };
}

// ============ export Runebog ============
export function exportForRunebog(d: Dungeon) {
  const M = 1.5;
  const rows = d.grid.map((row) => row.join(""));
  const rooms = d.rooms.map((rm) => ({
    id: `room-${rm.id}`, index: rm.index, name: rm.label, type: rm.type,
    rect: { x: rm.x, y: rm.y, w: rm.w, h: rm.h, widthMeters: +(rm.w * M).toFixed(1), heightMeters: +(rm.h * M).toFixed(1) },
    description: rm.description,
    encounter: rm.encounter && rm.encounter.groups.length
      ? {
          ruleset: d.params.ruleset, difficulty: d.params.difficulty,
          xpBudget: rm.encounter.budget, rawXP: rm.encounter.rawXP, adjustedXP: rm.encounter.adjXP,
          monsters: rm.encounter.groups.map((g) => ({ name: g.mon.name, cr: g.mon.cr, crLabel: crLabel(g.mon.cr), xp: g.mon.xp, count: g.count, ac: g.mon.ac, hp: g.mon.hp, hpDice: g.mon.hpDice, speed: g.mon.speed, size: g.mon.size, type: g.mon.type })),
        }
      : null,
    loot: rm.loot && !lootEmpty(rm.loot)
      ? { coins: rm.loot.coins, gems: rm.loot.gems, art: rm.loot.art, magicItems: rm.loot.magic, totalGp: lootTotalGp(rm.loot) }
      : null,
    traps: rm.traps, features: rm.features,
  }));
  const totalXP = rooms.reduce((s, x) => s + (x.encounter ? x.encounter.adjustedXP : 0), 0);
  const totalGp = rooms.reduce((s, x) => s + (x.loot ? x.loot.totalGp : 0), 0);
  const monsterCount = rooms.reduce((s, x) => s + (x.encounter ? x.encounter.monsters.reduce((a, m) => a + m.count, 0) : 0), 0);
  return {
    schemaVersion: "1.1", generator: "runebog-dungeon-generator",
    id: `dungeon-${d.seed}`, name: d.name, createdAt: new Date().toISOString(), seed: d.seed,
    params: d.params,
    grid: { unit: { squares: 1, feet: 5, meters: 1.5 }, width: d.gridW, height: d.gridH, legend: { "0": "roccia", "1": "stanza", "2": "corridoio", "3": "porta" }, rows },
    rooms,
    // 1.1: le coppie di stanze collegate, per ricostruire i corridoi come archi.
    connections: d.connections.map(([a, b]) => [`room-${a}`, `room-${b}`] as [string, string]),
    summary: { totalRooms: rooms.length, totalAdjustedXP: totalXP, totalLootGp: totalGp, monsterCount },
  };
}
export type RunebogExport = ReturnType<typeof exportForRunebog>;

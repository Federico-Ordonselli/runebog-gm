/* FILE GENERATO da scripts/genera-motore-dungeon.mjs — non modificare a mano.
   È il motore di src/lib/dungeon (engine.ts + srd-data.ts) per l'editor, che
   non ha build. Si rigenera con: node scripts/genera-motore-dungeon.mjs */
// src/lib/dungeon/engine.ts
var mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
var rollDie = (r, s) => 1 + Math.floor(r() * s);
var rollDice = (r, n, s) => {
  let x = 0;
  for (let i = 0; i < n; i++) x += rollDie(r, s);
  return x;
};
var randInt = (r, a, b) => a + Math.floor(r() * (b - a + 1));
var pick = (r, a) => a[Math.floor(r() * a.length)];
function weighted(r, e) {
  const t = e.reduce((s, x) => s + x[1], 0);
  let k = r() * t;
  for (const [v, w] of e) {
    if ((k -= w) <= 0) return v;
  }
  return e[e.length - 1][0];
}
var XP_THRESH_2014 = { 1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500], 5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100], 9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1e3, 2e3, 3e3, 4500], 13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400], 16: [1600, 3200, 4800, 7200], 17: [2e3, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500], 19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700] };
var XP_BUDGET_2024 = { 1: [50, 75, 100], 2: [100, 150, 200], 3: [150, 225, 400], 4: [250, 375, 500], 5: [500, 750, 1100], 6: [600, 1e3, 1400], 7: [750, 1300, 1700], 8: [1e3, 1700, 2100], 9: [1300, 2e3, 2600], 10: [1600, 2300, 3100], 11: [1900, 2900, 4100], 12: [2200, 3700, 4700], 13: [2600, 4200, 5400], 14: [2900, 4900, 6200], 15: [3300, 5400, 7800], 16: [3800, 6100, 9800], 17: [4500, 7200, 11700], 18: [5e3, 8700, 14200], 19: [5500, 10700, 17200], 20: [6400, 13200, 22e3] };
var DIFF_INDEX = { facile: 0, medio: 1, difficile: 2, mortale: 3 };
var DIFF_2024 = { facile: 0, medio: 1, difficile: 2, mortale: 2 };
var DIFF_ORDER = ["facile", "medio", "difficile", "mortale"];
var stepDifficulty = (d, n) => DIFF_ORDER[Math.max(0, Math.min(3, DIFF_ORDER.indexOf(d) + n))];
var MULT_ROWS = [1, 1.5, 2, 2.5, 3, 4];
var multRowIndex = (c) => c <= 1 ? 0 : c === 2 ? 1 : c <= 6 ? 2 : c <= 10 ? 3 : c <= 14 ? 4 : 5;
function encMult(c, ps) {
  let i = multRowIndex(c);
  if (ps < 3) i = Math.min(i + 1, 5);
  else if (ps >= 6) i = Math.max(i - 1, 0);
  return MULT_ROWS[i];
}
function xpBudget(l, ps, d, rs) {
  return rs === "2024" ? XP_BUDGET_2024[l][DIFF_2024[d]] * ps : XP_THRESH_2014[l][DIFF_INDEX[d]] * ps;
}
function adjustedXP(g, rs, ps) {
  const raw = g.reduce((s, x) => s + x.mon.xp * x.count, 0);
  if (rs === "2024") return raw;
  const c = g.reduce((s, x) => s + x.count, 0);
  return Math.round(raw * encMult(c, ps));
}
var crLabel = (cr) => cr === 0.125 ? "1/8" : cr === 0.25 ? "1/4" : cr === 0.5 ? "1/2" : String(cr);
function buildEncounter(r, pool, level, partySize, difficulty, ruleset) {
  const budget = xpBudget(level, partySize, difficulty, ruleset);
  const cap = budget * 1.15;
  const band = (fd, cm) => pool.filter((m) => m.xp > 0 && m.xp >= budget / fd && m.xp <= budget * cm);
  let cand = band(12, 1.2);
  if (cand.length < 2) cand = band(20, 1.25);
  if (cand.length < 2) cand = band(40, 1.6);
  if (cand.length === 0) cand = [...pool].filter((m) => m.xp > 0).sort((a, b) => Math.abs(a.xp - budget) - Math.abs(b.xp - budget)).slice(0, 6);
  if (cand.length === 0) return { groups: [], adjXP: 0, budget, rawXP: 0 };
  const groups = [];
  const speciesTarget = weighted(r, [[1, 3], [2, 4], [3, 2]]);
  let guard = 0;
  const tryAdd = (mon) => {
    const t = groups.map((g) => ({ ...g }));
    const e = t.find((g) => g.mon.name === mon.name);
    if (e) e.count++;
    else t.push({ mon, count: 1 });
    return adjustedXP(t, ruleset, partySize) <= cap;
  };
  const commit = (mon) => {
    const c = groups.find((g) => g.mon.name === mon.name);
    if (c) c.count++;
    else groups.push({ mon, count: 1 });
  };
  while (guard++ < 300) {
    if (adjustedXP(groups, ruleset, partySize) >= budget * 0.85) break;
    if (groups.reduce((s, g) => s + g.count, 0) >= 14) break;
    const useEx = groups.length >= speciesTarget || groups.length > 0 && r() < 0.6;
    const target = useEx && groups.length ? pick(r, groups).mon : pick(r, cand);
    if (tryAdd(target)) commit(target);
    else {
      const small = cand.reduce((a, b) => a.xp < b.xp ? a : b);
      if (tryAdd(small)) commit(small);
      else break;
    }
  }
  if (groups.length === 0) groups.push({ mon: cand.reduce((a, b) => a.xp < b.xp ? a : b), count: 1 });
  const rawXP = groups.reduce((s, g) => s + g.mon.xp * g.count, 0);
  return { groups, adjXP: adjustedXP(groups, ruleset, partySize), budget, rawXP };
}
function generateMap(r, o) {
  const { gridW, gridH, roomCount, minRoom, maxRoom } = o;
  const grid = Array.from({ length: gridH }, () => new Array(gridW).fill(0));
  const roomId = Array.from({ length: gridH }, () => new Array(gridW).fill(-1));
  const rooms = [];
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
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      grid[yy][xx] = 1;
      roomId[yy][xx] = id;
    }
    rooms.push({ id, x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
  }
  const edges = [];
  if (rooms.length > 1) {
    const inT = /* @__PURE__ */ new Set([0]);
    while (inT.size < rooms.length) {
      let best = null;
      for (const a of inT)
        for (let b = 0; b < rooms.length; b++) {
          if (inT.has(b)) continue;
          const d = Math.abs(rooms[a].cx - rooms[b].cx) + Math.abs(rooms[a].cy - rooms[b].cy);
          if (!best || d < best.d) best = { a, b, d };
        }
      edges.push([best.a, best.b]);
      inT.add(best.b);
    }
    const extra = Math.floor(rooms.length * 0.18);
    for (let i = 0; i < extra; i++) {
      const a = randInt(r, 0, rooms.length - 1), b = randInt(r, 0, rooms.length - 1);
      if (a !== b) edges.push([a, b]);
    }
  }
  const carve = (x, y) => {
    if (x < 0 || y < 0 || x >= gridW || y >= gridH) return;
    if (grid[y][x] === 0) grid[y][x] = 2;
  };
  for (const [a, b] of edges) {
    const { cx: x0, cy: y0 } = rooms[a];
    const { cx: x1, cy: y1 } = rooms[b];
    if (r() < 0.5) {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) carve(x, y0);
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) carve(x1, y);
    } else {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) carve(x0, y);
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) carve(x, y1);
    }
  }
  const doors = [];
  const seen = /* @__PURE__ */ new Set();
  for (let y = 0; y < gridH; y++)
    for (let x = 0; x < gridW; x++) {
      if (grid[y][x] !== 2) continue;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= gridW || ny >= gridH) continue;
        if (grid[ny][nx] === 1) {
          const key = roomId[ny][nx];
          const side = `${key}:${nx < x ? "W" : nx > x ? "E" : ny < y ? "N" : "S"}`;
          if (!seen.has(side)) {
            seen.add(side);
            grid[y][x] = 3;
            doors.push({ x, y, room: key });
          }
          break;
        }
      }
    }
  return { grid, roomId, rooms, doors, edges };
}
function assignRoomTypes(r, rooms) {
  if (!rooms.length) return;
  let entrance = rooms[0], be = Infinity;
  for (const rm of rooms) {
    const d = Math.min(rm.cx, rm.cy);
    if (d < be) {
      be = d;
      entrance = rm;
    }
  }
  entrance.type = "ingresso";
  let boss = entrance, far = -1;
  for (const rm of rooms) {
    if (rm === entrance) continue;
    const d = Math.abs(rm.cx - entrance.cx) + Math.abs(rm.cy - entrance.cy);
    if (d > far) {
      far = d;
      boss = rm;
    }
  }
  if (boss !== entrance) boss.type = "boss";
  const rest = rooms.filter((rm) => !rm.type);
  let tg = false;
  for (const rm of rest) {
    rm.type = weighted(r, [["combattimento", 10], ["tesoro", 3], ["trappola", 3], ["enigma", 2], ["riposo", 2], ["tana", 3], ["vuota", 2]]);
    if (rm.type === "tesoro") tg = true;
  }
  if (!tg && rest.length) pick(r, rest).type = "tesoro";
}
var GEM_TIERS = [[10, "quarzo colorato"], [50, "onice/citrino"], [100, "perla/ametista"], [500, "topazio/giada"], [1e3, "zaffiro/smeraldo"], [5e3, "diamante/rubino"]];
var ART_TIERS = [[25, "statuetta d\u2019osso intagliata"], [250, "calice d\u2019argento con ambra"], [750, "maschera cerimoniale dorata"], [2500, "corona ingioiellata"], [7500, "diadema di platino"]];
var partyTier = (l) => l <= 4 ? 1 : l <= 10 ? 2 : l <= 16 ? 3 : 4;
function generateLoot(r, level, kind, magicItems) {
  const tier = partyTier(level);
  const hoard = kind === "hoard";
  const loot = { coins: { cp: 0, sp: 0, gp: 0, pp: 0 }, gems: [], art: [], magic: [] };
  const cm = hoard ? 1 : 0.15;
  const base = [
    [rollDice(r, 3, 6) * 10, 0],
    [rollDice(r, 4, 6) * 50, rollDice(r, 2, 6) * 5],
    [rollDice(r, 4, 6) * 100, rollDice(r, 3, 6) * 10],
    [rollDice(r, 3, 6) * 1e3, rollDice(r, 4, 6) * 50]
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
  const rw = {
    1: [["common", 4], ["uncommon", 3], ["rare", 0.3]],
    2: [["common", 1], ["uncommon", 5], ["rare", 3], ["veryRare", 0.5]],
    3: [["uncommon", 2], ["rare", 5], ["veryRare", 3], ["legendary", 0.5]],
    4: [["rare", 2], ["veryRare", 5], ["legendary", 3]]
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
var lootTotalGp = (l) => {
  const c = l.coins;
  let g = c.cp / 100 + c.sp / 10 + c.gp + c.pp * 10;
  for (const x of l.gems) g += x.value;
  for (const x of l.art) g += x.value;
  return Math.round(g);
};
var lootEmpty = (l) => !l.coins.gp && !l.coins.pp && !l.coins.sp && !l.coins.cp && !l.gems.length && !l.art.length && !l.magic.length;
var ROOM_NAMES = { ingresso: ["Atrio d\u2019Ingresso", "Vestibolo Crollato", "Soglia del Guardiano", "Anticamera Polverosa"], combattimento: ["Sala delle Guardie", "Camera dei Pilastri", "Galleria Insanguinata", "Corte Interna", "Sala d\u2019Armi"], tesoro: ["Cripta del Tesoro", "Camera del Bottino", "Volta Sigillata", "Reliquiario", "Sala del Forziere"], trappola: ["Corridoio Ingannevole", "Sala dei Meccanismi", "Passaggio Maledetto", "Camera delle Lame"], enigma: ["Sala degli Enigmi", "Camera dei Sigilli", "Santuario del Quesito", "Stanza dei Simboli"], riposo: ["Rifugio Silenzioso", "Cappella Abbandonata", "Nicchia Sicura", "Sala della Fonte"], tana: ["Tana Fetida", "Covo Buio", "Nido Brulicante", "Antro della Bestia"], vuota: ["Sala Vuota", "Corridoio Deserto", "Magazzino Saccheggiato", "Camera Spoglia"], boss: ["Sala del Trono", "Santuario Profano", "Camera del Signore", "Cuore del Dungeon"] };
var SUFFIXES = ["delle Ossa Sussurranti", "del Silenzio Eterno", "dei Sette Sigilli", "della Fiamma Nera", "del Sangue Antico", "del Verme Divoratore", "della Regina Caduta"];
var DESC = {
  air: ["L\u2019aria \xE8 umida e stagnante", "Un freddo innaturale pervade la stanza", "L\u2019aria sa di fumo e cenere", "Un tanfo di decomposizione riempie il luogo", "L\u2019aria vibra di un\u2019energia arcana"],
  light: ["le torce morenti proiettano ombre lunghe", "un muschio bioluminescente tinge tutto di blu", "cristalli pulsanti emanano un chiarore fioco", "regna il buio, rotto solo dalla vostra luce", "braci morenti offrono un tenue bagliore"],
  detail: ["ossa spezzate sono sparse sul pavimento", "fitte ragnatele coprono gli angoli", "affreschi sbiaditi narrano battaglie dimenticate", "rune arcane sono incise nella pietra", "catene arrugginite pendono dal soffitto", "una pozza d\u2019acqua scura riflette la volta", "colonne scheggiate reggono a fatica il soffitto"]
};
var TRAPS = [
  { name: "Fossa Nascosta", save: "Destrezza", dmgType: "contundente (caduta)", dice: { 1: "2d6", 2: "4d6", 3: "6d6", 4: "8d6" }, effect: "una botola cede: chi fallisce precipita in una fossa di 3 m" },
  { name: "Dardi Avvelenati", save: "Destrezza", dmgType: "perforante + veleno", dice: { 1: "2d4", 2: "3d4", 3: "4d4", 4: "6d4" }, effect: "dardi scattano dalle feritoie nelle pareti" },
  { name: "Ago Avvelenato", save: "Costituzione", dmgType: "veleno", dice: { 1: "1d10", 2: "2d10", 3: "4d10", 4: "6d10" }, effect: "un ago celato nella serratura inietta veleno" },
  { name: "Lama a Pendolo", save: "Destrezza", dmgType: "tagliente", dice: { 1: "2d8", 2: "4d8", 3: "6d8", 4: "8d8" }, effect: "una lama oscilla dal soffitto lungo il passaggio" },
  { name: "Soffitto Crollante", save: "Destrezza", dmgType: "contundente", dice: { 1: "2d10", 2: "4d10", 3: "6d10", 4: "8d10" }, effect: "blocchi di pietra precipitano dall\u2019alto" },
  { name: "Glifo di Fuoco", save: "Destrezza", dmgType: "fuoco (area 3 m)", dice: { 1: "2d6", 2: "4d6", 3: "7d6", 4: "10d6" }, effect: "un glifo esplode in fiamme investendo l\u2019area" },
  { name: "Scarica di Fulmini", save: "Destrezza", dmgType: "fulmine (area)", dice: { 1: "2d6", 2: "4d6", 3: "7d6", 4: "9d6" }, effect: "piastre a contatto scatenano una scarica elettrica" },
  { name: "Nube Tossica", save: "Costituzione", dmgType: "veleno (nube)", dice: { 1: "1d6", 2: "3d6", 3: "5d6", 4: "7d6" }, effect: "gas velenoso satura la stanza per alcuni round" },
  { name: "Rete a Scatto", save: "Destrezza", dmgType: "\u2014", dice: { 1: "0", 2: "0", 3: "0", 4: "0" }, effect: "una rete cade dall\u2019alto: bersaglio Trattenuto (CD Forza per liberarsi)" },
  { name: "Runa del Terrore", save: "Saggezza", dmgType: "psichico", dice: { 1: "1d6", 2: "2d6", 3: "3d6", 4: "4d6" }, effect: "una runa proietta visioni: bersaglio Spaventato per 1 minuto" }
];
var TRAP_DC = { 1: 12, 2: 14, 3: 16, 4: 18 };
var FEATURES = ["Un altare di pietra macchiato di sangue rappreso", "Un sarcofago sigillato con iscrizioni in una lingua morta", "Scaffali marci carichi di tomi ammuffiti e illeggibili", "La statua di una divinit\xE0 dimenticata, il volto eroso", "Una fontana asciutta col fondo coperto di monete verdi di ruggine", "Un mucchio di equipaggiamento arrugginito e inservibile", "Una gabbia dalle sbarre piegate verso l\u2019esterno", "Un grande affresco che raffigura una profezia oscura", "Uno scheletro incatenato alla parete, la bocca in un urlo muto", "Un fungo colossale che pulsa di una luce malata", "Bracieri spenti in cerchio attorno a un simbolo inciso", "Un pozzo profondo da cui sale un eco di gocciolio"];
var THEMES = {
  misto: { label: "Misto (tutti)", tags: null },
  nonmorti: { label: "Cripta non-morta", tags: ["undead", "undead_theme"] },
  goblinoidi: { label: "Covo di goblinoidi", tags: ["goblinoid", "orc", "gnoll", "humanoid_npc"] },
  drago: { label: "Tana di drago", tags: ["draconic", "kobold"] },
  fuoco: { label: "Caverne di fuoco", tags: ["fire", "elemental"] },
  ghiaccio: { label: "Caverne di ghiaccio", tags: ["ice", "elemental"] },
  aberrazioni: { label: "Nido di aberrazioni", tags: ["aberrant", "aberration", "ooze_theme"] },
  banditi: { label: "Rifugio di banditi", tags: ["humanoid_npc"] },
  bosco: { label: "Bosco corrotto", tags: ["fey_theme", "plant_theme", "fey"] },
  infernale: { label: "Fortezza infernale", tags: ["demon", "devil", "fiend"] },
  bestie: { label: "Rovine bestiali", tags: ["wild_beast", "monstrosity", "vermin", "beast"] }
};
function themePool(monsters, themeKey) {
  const t = THEMES[themeKey];
  if (!t || !t.tags) return monsters;
  return monsters.filter((m) => t.tags.some((tag) => m.tags.includes(tag)));
}
function roomName(r, type) {
  let n = pick(r, ROOM_NAMES[type]);
  if (["boss", "tesoro", "tana"].includes(type) && r() < 0.5) n += " " + pick(r, SUFFIXES);
  return n;
}
function roomDesc(r) {
  return `${pick(r, DESC.air)}; ${pick(r, DESC.light)}. Sul posto, ${pick(r, DESC.detail)}.`;
}
function makeTrap(r, tier) {
  const t = pick(r, TRAPS);
  const dc = Math.max(10, Math.min(20, TRAP_DC[tier] + randInt(r, -1, 1)));
  return { name: t.name, save: t.save, dc, damage: t.dice[tier], damageType: t.dmgType, effect: t.effect };
}
function generateRoomContent(r, room, params, pools) {
  const { level, partySize, difficulty, ruleset } = params;
  const tier = partyTier(level);
  const c = { encounter: null, loot: null, traps: [], features: [] };
  const enc = (diff) => buildEncounter(r, pools.monsters, level, partySize, diff, ruleset);
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
function gridDims(roomCount) {
  return { gridW: Math.min(60, 28 + roomCount * 2), gridH: Math.min(44, 20 + roomCount * 1.4 | 0) };
}
function generateDungeon(params, monsters, magicItems) {
  const { seed, name, roomCount, theme } = params;
  const r = mulberry32(seed);
  const pools = { monsters: themePool(monsters, theme), magic: magicItems };
  const { gridW, gridH } = gridDims(roomCount);
  const map = generateMap(r, { gridW, gridH, roomCount, minRoom: 3, maxRoom: 8 });
  assignRoomTypes(r, map.rooms);
  const rooms = map.rooms.map((rm, i) => {
    const content = generateRoomContent(r, rm, params, pools);
    return { ...rm, type: rm.type, index: i + 1, label: roomName(r, rm.type), description: roomDesc(r), ...content };
  });
  const seen = /* @__PURE__ */ new Set();
  const connections = [];
  for (const [a, b] of map.edges) {
    if (a === b) continue;
    const key = Math.min(a, b) + ":" + Math.max(a, b);
    if (!seen.has(key)) {
      seen.add(key);
      connections.push([a, b]);
    }
  }
  return { name, seed, params, grid: map.grid, gridW, gridH, rooms, doors: map.doors, connections };
}
function exportForRunebog(d) {
  const M = 1.5;
  const rows = d.grid.map((row) => row.join(""));
  const rooms = d.rooms.map((rm) => ({
    id: `room-${rm.id}`,
    index: rm.index,
    name: rm.label,
    type: rm.type,
    rect: { x: rm.x, y: rm.y, w: rm.w, h: rm.h, widthMeters: +(rm.w * M).toFixed(1), heightMeters: +(rm.h * M).toFixed(1) },
    description: rm.description,
    encounter: rm.encounter && rm.encounter.groups.length ? {
      ruleset: d.params.ruleset,
      difficulty: d.params.difficulty,
      xpBudget: rm.encounter.budget,
      rawXP: rm.encounter.rawXP,
      adjustedXP: rm.encounter.adjXP,
      monsters: rm.encounter.groups.map((g) => ({ name: g.mon.name, cr: g.mon.cr, crLabel: crLabel(g.mon.cr), xp: g.mon.xp, count: g.count, ac: g.mon.ac, hp: g.mon.hp, hpDice: g.mon.hpDice, speed: g.mon.speed, size: g.mon.size, type: g.mon.type }))
    } : null,
    loot: rm.loot && !lootEmpty(rm.loot) ? { coins: rm.loot.coins, gems: rm.loot.gems, art: rm.loot.art, magicItems: rm.loot.magic, totalGp: lootTotalGp(rm.loot) } : null,
    traps: rm.traps,
    features: rm.features
  }));
  const totalXP = rooms.reduce((s, x) => s + (x.encounter ? x.encounter.adjustedXP : 0), 0);
  const totalGp = rooms.reduce((s, x) => s + (x.loot ? x.loot.totalGp : 0), 0);
  const monsterCount = rooms.reduce((s, x) => s + (x.encounter ? x.encounter.monsters.reduce((a, m) => a + m.count, 0) : 0), 0);
  return {
    schemaVersion: "1.1",
    generator: "runebog-dungeon-generator",
    id: `dungeon-${d.seed}`,
    name: d.name,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    seed: d.seed,
    params: d.params,
    grid: { unit: { squares: 1, feet: 5, meters: 1.5 }, width: d.gridW, height: d.gridH, legend: { "0": "roccia", "1": "stanza", "2": "corridoio", "3": "porta" }, rows },
    rooms,
    // 1.1: le coppie di stanze collegate, per ricostruire i corridoi come archi.
    connections: d.connections.map(([a, b]) => [`room-${a}`, `room-${b}`]),
    summary: { totalRooms: rooms.length, totalAdjustedXP: totalXP, totalLootGp: totalGp, monsterCount }
  };
}

// src/lib/dungeon/srd-data.ts
var MONSTERS = [
  { "name": "Aquila", "cr": 0, "xp": 10, "type": "beast", "size": "Small", "ac": 12, "hp": 4, "hpDice": "1d6+1", "speed": 10, "tags": ["beast", "wild_beast"] },
  { "name": "Avvoltoio", "cr": 0, "xp": 10, "type": "beast", "size": "Medium", "ac": 10, "hp": 5, "hpDice": "1d8+1", "speed": 10, "tags": ["beast"] },
  { "name": "Babbuino", "cr": 0, "xp": 10, "type": "beast", "size": "Small", "ac": 12, "hp": 3, "hpDice": "1d6", "speed": 30, "tags": ["beast"] },
  { "name": "Boleto stridente", "cr": 0, "xp": 0, "type": "plant", "size": "Medium", "ac": 5, "hp": 13, "hpDice": "3d8", "speed": 0, "tags": ["plant", "plant_theme"] },
  { "name": "Capra", "cr": 0, "xp": 10, "type": "beast", "size": "Medium", "ac": 10, "hp": 4, "hpDice": "1d8", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Cavalluccio marino", "cr": 0, "xp": 0, "type": "beast", "size": "Tiny", "ac": 12, "hp": 1, "hpDice": "1d4-1", "speed": 20, "tags": ["aquatic", "beast", "wild_beast"] },
  { "name": "Cespuglio risvegliato", "cr": 0, "xp": 10, "type": "plant", "size": "Small", "ac": 9, "hp": 10, "hpDice": "3d6", "speed": 20, "tags": ["plant", "plant_theme"] },
  { "name": "Corvo", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 12, "hp": 2, "hpDice": "1d4", "speed": 10, "tags": ["beast"] },
  { "name": "Daino", "cr": 0, "xp": 10, "type": "beast", "size": "Medium", "ac": 13, "hp": 4, "hpDice": "1d8", "speed": 50, "tags": ["beast", "wild_beast"] },
  { "name": "Faina", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 13, "hp": 1, "hpDice": "1d4-1", "speed": 30, "tags": ["beast"] },
  { "name": "Falco", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 13, "hp": 1, "hpDice": "1d4-1", "speed": 10, "tags": ["beast", "wild_beast"] },
  { "name": "Gatto", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 12, "hp": 2, "hpDice": "1d4", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Granchio", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 11, "hp": 3, "hpDice": "1d4+1", "speed": 20, "tags": ["beast"] },
  { "name": "Gufo", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 11, "hp": 1, "hpDice": "1d4-1", "speed": 5, "tags": ["beast", "wild_beast"] },
  { "name": "Iena", "cr": 0, "xp": 10, "type": "beast", "size": "Medium", "ac": 11, "hp": 5, "hpDice": "1d8+1", "speed": 50, "tags": ["beast", "wild_beast"] },
  { "name": "Lemure", "cr": 0, "xp": 10, "type": "fiend", "size": "Medium", "ac": 9, "hp": 9, "hpDice": "2d8", "speed": 15, "tags": ["devil", "fiend"] },
  { "name": "Lucertola", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 10, "hp": 2, "hpDice": "1d4", "speed": 20, "tags": ["beast", "wild_beast"] },
  { "name": "Omuncolo", "cr": 0, "xp": 10, "type": "construct", "size": "Tiny", "ac": 13, "hp": 4, "hpDice": "1d4+2", "speed": 20, "tags": ["construct", "construct_theme"] },
  { "name": "Piovra", "cr": 0, "xp": 10, "type": "beast", "size": "Small", "ac": 12, "hp": 3, "hpDice": "1d6", "speed": 5, "tags": ["beast", "wild_beast"] },
  { "name": "Pipistrello", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 12, "hp": 1, "hpDice": "1d4-1", "speed": 5, "tags": ["beast", "wild_beast"] },
  { "name": "Piranha", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 13, "hp": 1, "hpDice": "1d4-1", "speed": 40, "tags": ["beast"] },
  { "name": "Popolano", "cr": 0, "xp": 10, "type": "humanoid", "size": "Medium", "ac": 10, "hp": 4, "hpDice": "1d8", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Ragno", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 12, "hp": 1, "hpDice": "1d4-1", "speed": 20, "tags": ["beast", "vermin"] },
  { "name": "Rana", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 11, "hp": 1, "hpDice": "1d4-1", "speed": 20, "tags": ["beast", "wild_beast"] },
  { "name": "Scarabeo di fuoco gigante", "cr": 0, "xp": 10, "type": "beast", "size": "Small", "ac": 13, "hp": 4, "hpDice": "1d6+1", "speed": 30, "tags": ["beast", "fire", "giantkin", "vermin"] },
  { "name": "Sciacallo", "cr": 0, "xp": 10, "type": "beast", "size": "Small", "ac": 12, "hp": 3, "hpDice": "1d6", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Scorpione", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 11, "hp": 1, "hpDice": "1d4-1", "speed": 10, "tags": ["beast", "vermin"] },
  { "name": "Tasso", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 11, "hp": 5, "hpDice": "1d4+3", "speed": 20, "tags": ["beast"] },
  { "name": "Topo", "cr": 0, "xp": 10, "type": "beast", "size": "Tiny", "ac": 10, "hp": 1, "hpDice": "1d4-1", "speed": 20, "tags": ["beast", "wild_beast"] },
  { "name": "Bandito", "cr": 0.125, "xp": 25, "type": "humanoid", "size": "Medium", "ac": 12, "hp": 11, "hpDice": "2d8+2", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Cammello", "cr": 0.125, "xp": 25, "type": "beast", "size": "Large", "ac": 10, "hp": 17, "hpDice": "2d10+6", "speed": 50, "tags": ["beast"] },
  { "name": "Coboldo guerriero", "cr": 0.125, "xp": 25, "type": "humanoid", "size": "Small", "ac": 14, "hp": 7, "hpDice": "3d6-3", "speed": 30, "tags": ["humanoid", "kobold"] },
  { "name": "Cultista", "cr": 0.125, "xp": 25, "type": "humanoid", "size": "Medium", "ac": 12, "hp": 9, "hpDice": "2d8", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Faina gigante", "cr": 0.125, "xp": 25, "type": "beast", "size": "Medium", "ac": 13, "hp": 9, "hpDice": "2d8", "speed": 40, "tags": ["beast", "giantkin", "vermin"] },
  { "name": "Falco di sangue", "cr": 0.125, "xp": 25, "type": "beast", "size": "Small", "ac": 12, "hp": 7, "hpDice": "2d6", "speed": 10, "tags": ["beast", "wild_beast"] },
  { "name": "Granchio gigante", "cr": 0.125, "xp": 25, "type": "beast", "size": "Medium", "ac": 15, "hp": 13, "hpDice": "3d8", "speed": 30, "tags": ["beast", "giantkin", "vermin"] },
  { "name": "Guardia", "cr": 0.125, "xp": 25, "type": "humanoid", "size": "Medium", "ac": 16, "hp": 11, "hpDice": "2d8+2", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Guerriero di fanteria", "cr": 0.125, "xp": 25, "type": "humanoid", "size": "Medium", "ac": 13, "hp": 9, "hpDice": "2d8", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Marinide schermagliatore", "cr": 0.125, "xp": 25, "type": "humanoid", "size": "Medium", "ac": 11, "hp": 11, "hpDice": "2d8+2", "speed": 10, "tags": ["aquatic", "humanoid"] },
  { "name": "Mastino", "cr": 0.125, "xp": 25, "type": "beast", "size": "Medium", "ac": 12, "hp": 5, "hpDice": "1d8+1", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Mulo", "cr": 0.125, "xp": 25, "type": "beast", "size": "Medium", "ac": 10, "hp": 11, "hpDice": "2d8+2", "speed": 40, "tags": ["beast"] },
  { "name": "Nobile", "cr": 0.125, "xp": 25, "type": "humanoid", "size": "Medium", "ac": 15, "hp": 9, "hpDice": "2d8", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Pony", "cr": 0.125, "xp": 25, "type": "beast", "size": "Medium", "ac": 10, "hp": 11, "hpDice": "2d8+2", "speed": 40, "tags": ["beast"] },
  { "name": "Serpente velenoso", "cr": 0.125, "xp": 25, "type": "beast", "size": "Tiny", "ac": 12, "hp": 5, "hpDice": "2d4", "speed": 30, "tags": ["beast", "wild_beast"] },
  { "name": "Serpente volante", "cr": 0.125, "xp": 25, "type": "beast", "size": "Tiny", "ac": 14, "hp": 5, "hpDice": "2d4", "speed": 30, "tags": ["beast", "wild_beast"] },
  { "name": "Topo gigante", "cr": 0.125, "xp": 25, "type": "beast", "size": "Small", "ac": 13, "hp": 7, "hpDice": "2d6", "speed": 30, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Uccello stigeo", "cr": 0.125, "xp": 25, "type": "beast", "size": "Tiny", "ac": 13, "hp": 5, "hpDice": "2d4", "speed": 10, "tags": ["beast"] },
  { "name": "Alce", "cr": 0.25, "xp": 50, "type": "beast", "size": "Large", "ac": 10, "hp": 11, "hpDice": "2d10", "speed": 50, "tags": ["beast", "wild_beast"] },
  { "name": "Beccoaguzzo", "cr": 0.25, "xp": 50, "type": "beast", "size": "Large", "ac": 11, "hp": 19, "hpDice": "3d10+3", "speed": 50, "tags": ["beast"] },
  { "name": "Cane intermittente", "cr": 0.25, "xp": 50, "type": "fey", "size": "Medium", "ac": 13, "hp": 22, "hpDice": "4d8+4", "speed": 40, "tags": ["fey", "fey_theme"] },
  { "name": "Cavallo da galoppo", "cr": 0.25, "xp": 50, "type": "beast", "size": "Large", "ac": 11, "hp": 13, "hpDice": "2d10+2", "speed": 60, "tags": ["beast", "wild_beast"] },
  { "name": "Cavallo da tiro", "cr": 0.25, "xp": 50, "type": "beast", "size": "Large", "ac": 10, "hp": 15, "hpDice": "2d10+4", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Cinghiale", "cr": 0.25, "xp": 50, "type": "beast", "size": "Medium", "ac": 11, "hp": 13, "hpDice": "2d8+4", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Colonia di topi", "cr": 0.25, "xp": 50, "type": "swarm", "size": "Medium", "ac": 10, "hp": 14, "hpDice": "4d8-4", "speed": 30, "tags": ["swarm", "wild_beast"] },
  { "name": "Dretch", "cr": 0.25, "xp": 50, "type": "fiend", "size": "Small", "ac": 11, "hp": 18, "hpDice": "4d6+4", "speed": 20, "tags": ["demon", "fiend"] },
  { "name": "Fungo viola", "cr": 0.25, "xp": 50, "type": "plant", "size": "Medium", "ac": 5, "hp": 18, "hpDice": "4d8", "speed": 5, "tags": ["plant", "plant_theme"] },
  { "name": "Goblin guerriero", "cr": 0.25, "xp": 50, "type": "humanoid", "size": "Small", "ac": 15, "hp": 10, "hpDice": "3d6", "speed": 30, "tags": ["goblinoid", "humanoid"] },
  { "name": "Grimlock", "cr": 0.25, "xp": 50, "type": "humanoid", "size": "Medium", "ac": 11, "hp": 11, "hpDice": "2d8+2", "speed": 30, "tags": ["humanoid"] },
  { "name": "Gufo gigante", "cr": 0.25, "xp": 50, "type": "beast", "size": "Large", "ac": 12, "hp": 19, "hpDice": "3d10+3", "speed": 5, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Lucertola gigante", "cr": 0.25, "xp": 50, "type": "beast", "size": "Large", "ac": 12, "hp": 19, "hpDice": "3d10+3", "speed": 30, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Lupo", "cr": 0.25, "xp": 50, "type": "beast", "size": "Medium", "ac": 12, "hp": 11, "hpDice": "2d8+2", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Mephit del vapore", "cr": 0.25, "xp": 50, "type": "elemental", "size": "Small", "ac": 10, "hp": 17, "hpDice": "5d6", "speed": 30, "tags": ["elemental", "elemental_construct"] },
  { "name": "Millepiedi gigante", "cr": 0.25, "xp": 50, "type": "beast", "size": "Small", "ac": 14, "hp": 9, "hpDice": "2d6+2", "speed": 30, "tags": ["beast", "giantkin", "vermin"] },
  { "name": "Pantera", "cr": 0.25, "xp": 50, "type": "beast", "size": "Medium", "ac": 13, "hp": 13, "hpDice": "3d8", "speed": 50, "tags": ["beast", "wild_beast"] },
  { "name": "Pipistrello gigante", "cr": 0.25, "xp": 50, "type": "beast", "size": "Large", "ac": 13, "hp": 22, "hpDice": "4d10", "speed": 10, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Pseudodrago", "cr": 0.25, "xp": 50, "type": "dragon", "size": "Tiny", "ac": 14, "hp": 10, "hpDice": "3d4+3", "speed": 15, "tags": ["draconic", "dragon", "fey_theme"] },
  { "name": "Ragno lupo gigante", "cr": 0.25, "xp": 50, "type": "beast", "size": "Medium", "ac": 13, "hp": 11, "hpDice": "2d8+2", "speed": 40, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Rana gigante", "cr": 0.25, "xp": 50, "type": "beast", "size": "Medium", "ac": 11, "hp": 18, "hpDice": "4d8", "speed": 30, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Sacerdote accolito", "cr": 0.25, "xp": 50, "type": "humanoid", "size": "Medium", "ac": 13, "hp": 11, "hpDice": "2d8+2", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Scheletro", "cr": 0.25, "xp": 50, "type": "undead", "size": "Medium", "ac": 14, "hp": 13, "hpDice": "2d8+4", "speed": 30, "tags": ["undead", "undead_theme"] },
  { "name": "Sciame di pipistrelli", "cr": 0.25, "xp": 50, "type": "swarm", "size": "Medium", "ac": 12, "hp": 11, "hpDice": "2d10", "speed": 0, "tags": ["swarm", "wild_beast"] },
  { "name": "Serpente stritolatore", "cr": 0.25, "xp": 50, "type": "beast", "size": "Large", "ac": 13, "hp": 13, "hpDice": "2d10+2", "speed": 30, "tags": ["beast", "wild_beast"] },
  { "name": "Serpente velenoso gigante", "cr": 0.25, "xp": 50, "type": "beast", "size": "Medium", "ac": 14, "hp": 11, "hpDice": "2d8+2", "speed": 30, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Spada volante animata", "cr": 0.25, "xp": 50, "type": "construct", "size": "Small", "ac": 17, "hp": 14, "hpDice": "4d6", "speed": 0, "tags": ["construct"] },
  { "name": "Spiritello", "cr": 0.25, "xp": 50, "type": "fey", "size": "Tiny", "ac": 15, "hp": 10, "hpDice": "4d4", "speed": 10, "tags": ["fey", "fey_theme"] },
  { "name": "Stormo di corvi", "cr": 0.25, "xp": 50, "type": "swarm", "size": "Medium", "ac": 12, "hp": 11, "hpDice": "2d8+2", "speed": 10, "tags": ["swarm"] },
  { "name": "Tasso gigante", "cr": 0.25, "xp": 50, "type": "beast", "size": "Medium", "ac": 13, "hp": 15, "hpDice": "2d8+6", "speed": 30, "tags": ["beast", "giantkin", "vermin"] },
  { "name": "Zombi", "cr": 0.25, "xp": 50, "type": "undead", "size": "Medium", "ac": 8, "hp": 15, "hpDice": "2d8+6", "speed": 20, "tags": ["ooze_theme", "undead", "undead_theme"] },
  { "name": "Bruto", "cr": 0.5, "xp": 100, "type": "humanoid", "size": "Medium", "ac": 12, "hp": 32, "hpDice": "5d8+10", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Capra gigante", "cr": 0.5, "xp": 100, "type": "beast", "size": "Large", "ac": 11, "hp": 19, "hpDice": "3d10+3", "speed": 40, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Cavallo da guerra", "cr": 0.5, "xp": 100, "type": "beast", "size": "Large", "ac": 11, "hp": 19, "hpDice": "3d10+3", "speed": 60, "tags": ["beast", "wild_beast"] },
  { "name": "Cavalluccio marino gigante", "cr": 0.5, "xp": 100, "type": "beast", "size": "Large", "ac": 14, "hp": 16, "hpDice": "3d10", "speed": 0, "tags": ["aquatic", "beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Coccatrice", "cr": 0.5, "xp": 100, "type": "monstrosity", "size": "Small", "ac": 11, "hp": 22, "hpDice": "5d6+5", "speed": 20, "tags": ["ice", "monstrosity"] },
  { "name": "Coccodrillo", "cr": 0.5, "xp": 100, "type": "beast", "size": "Large", "ac": 12, "hp": 13, "hpDice": "2d10+2", "speed": 20, "tags": ["beast", "wild_beast"] },
  { "name": "Esploratore", "cr": 0.5, "xp": 100, "type": "humanoid", "size": "Medium", "ac": 13, "hp": 16, "hpDice": "3d8+3", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Gnoll guerriero", "cr": 0.5, "xp": 100, "type": "humanoid", "size": "Medium", "ac": 15, "hp": 27, "hpDice": "6d8", "speed": 30, "tags": ["gnoll", "humanoid"] },
  { "name": "Gorilla", "cr": 0.5, "xp": 100, "type": "beast", "size": "Medium", "ac": 12, "hp": 19, "hpDice": "3d8+6", "speed": 30, "tags": ["beast", "wild_beast"] },
  { "name": "Hobgoblin guerriero", "cr": 0.5, "xp": 100, "type": "humanoid", "size": "Medium", "ac": 18, "hp": 11, "hpDice": "2d8+2", "speed": 30, "tags": ["goblinoid", "humanoid"] },
  { "name": "Magmin", "cr": 0.5, "xp": 100, "type": "elemental", "size": "Small", "ac": 14, "hp": 13, "hpDice": "3d6+3", "speed": 30, "tags": ["elemental", "fire"] },
  { "name": "Mantoscuro", "cr": 0.5, "xp": 100, "type": "monstrosity", "size": "Small", "ac": 11, "hp": 22, "hpDice": "5d6+5", "speed": 10, "tags": ["monstrosity"] },
  { "name": "Melma grigia", "cr": 0.5, "xp": 100, "type": "ooze", "size": "Medium", "ac": 9, "hp": 22, "hpDice": "3d8+9", "speed": 10, "tags": ["ooze", "ooze_theme"] },
  { "name": "Mephit del ghiaccio", "cr": 0.5, "xp": 100, "type": "elemental", "size": "Small", "ac": 11, "hp": 21, "hpDice": "6d6", "speed": 30, "tags": ["elemental", "elemental_construct", "ice"] },
  { "name": "Mephit del magma", "cr": 0.5, "xp": 100, "type": "elemental", "size": "Small", "ac": 11, "hp": 18, "hpDice": "4d6+4", "speed": 30, "tags": ["elemental", "elemental_construct", "fire"] },
  { "name": "Mephit della polvere", "cr": 0.5, "xp": 100, "type": "elemental", "size": "Small", "ac": 12, "hp": 17, "hpDice": "5d6", "speed": 30, "tags": ["elemental", "elemental_construct"] },
  { "name": "Ombra", "cr": 0.5, "xp": 100, "type": "undead", "size": "Medium", "ac": 12, "hp": 27, "hpDice": "5d8+5", "speed": 40, "tags": ["undead", "undead_theme"] },
  { "name": "Orso nero", "cr": 0.5, "xp": 100, "type": "beast", "size": "Medium", "ac": 11, "hp": 19, "hpDice": "3d8+6", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Rugginofago", "cr": 0.5, "xp": 100, "type": "monstrosity", "size": "Medium", "ac": 14, "hp": 33, "hpDice": "6d8+6", "speed": 40, "tags": ["monstrosity"] },
  { "name": "Sahuagin guerriero", "cr": 0.5, "xp": 100, "type": "humanoid", "size": "Medium", "ac": 12, "hp": 22, "hpDice": "4d8+4", "speed": 30, "tags": ["aquatic", "humanoid"] },
  { "name": "Satiro", "cr": 0.5, "xp": 100, "type": "fey", "size": "Medium", "ac": 13, "hp": 31, "hpDice": "7d8", "speed": 40, "tags": ["fey", "fey_theme"] },
  { "name": "Scheletro di cavallo da guerra", "cr": 0.5, "xp": 100, "type": "undead", "size": "Large", "ac": 13, "hp": 22, "hpDice": "3d10+6", "speed": 60, "tags": ["undead", "undead_theme", "wild_beast"] },
  { "name": "Sciame di insetti", "cr": 0.5, "xp": 100, "type": "swarm", "size": "Medium", "ac": 11, "hp": 19, "hpDice": "3d8+6", "speed": 20, "tags": ["swarm", "vermin"] },
  { "name": "Squalo tropicale", "cr": 0.5, "xp": 100, "type": "beast", "size": "Medium", "ac": 12, "hp": 22, "hpDice": "4d8+4", "speed": 40, "tags": ["aquatic", "beast", "wild_beast"] },
  { "name": "Vespa gigante", "cr": 0.5, "xp": 100, "type": "beast", "size": "Medium", "ac": 13, "hp": 22, "hpDice": "5d8", "speed": 10, "tags": ["beast", "giantkin", "vermin"] },
  { "name": "Worg", "cr": 0.5, "xp": 100, "type": "monstrosity", "size": "Large", "ac": 13, "hp": 26, "hpDice": "4d10+4", "speed": 50, "tags": ["monstrosity"] },
  { "name": "Aquila gigante", "cr": 1, "xp": 200, "type": "beast", "size": "Large", "ac": 13, "hp": 26, "hpDice": "4d10+4", "speed": 10, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Armatura animata", "cr": 1, "xp": 200, "type": "construct", "size": "Medium", "ac": 18, "hp": 33, "hpDice": "6d8+6", "speed": 25, "tags": ["construct", "construct_theme"] },
  { "name": "Arpia", "cr": 1, "xp": 200, "type": "monstrosity", "size": "Medium", "ac": 11, "hp": 38, "hpDice": "7d8+7", "speed": 20, "tags": ["monstrosity"] },
  { "name": "Avvoltoio gigante", "cr": 1, "xp": 200, "type": "beast", "size": "Large", "ac": 10, "hp": 25, "hpDice": "3d10+9", "speed": 10, "tags": ["beast", "giantkin", "vermin"] },
  { "name": "Banco di piranha", "cr": 1, "xp": 200, "type": "swarm", "size": "Medium", "ac": 13, "hp": 28, "hpDice": "8d8-8", "speed": 0, "tags": ["swarm"] },
  { "name": "Bugbear guerriero", "cr": 1, "xp": 200, "type": "humanoid", "size": "Medium", "ac": 14, "hp": 33, "hpDice": "6d8+6", "speed": 30, "tags": ["goblinoid", "humanoid", "wild_beast"] },
  { "name": "Cane della morte", "cr": 1, "xp": 200, "type": "monstrosity", "size": "Medium", "ac": 12, "hp": 39, "hpDice": "6d8+12", "speed": 40, "tags": ["monstrosity", "undead_theme"] },
  { "name": "Drago d'ottone cucciolo", "cr": 1, "xp": 200, "type": "dragon", "size": "Medium", "ac": 15, "hp": 22, "hpDice": "4d8+4", "speed": 30, "tags": ["draconic", "dragon"] },
  { "name": "Drago di rame cucciolo", "cr": 1, "xp": 200, "type": "dragon", "size": "Medium", "ac": 16, "hp": 22, "hpDice": "4d8+4", "speed": 30, "tags": ["draconic", "dragon"] },
  { "name": "Driade", "cr": 1, "xp": 200, "type": "fey", "size": "Medium", "ac": 16, "hp": 22, "hpDice": "5d8", "speed": 30, "tags": ["fey", "fey_theme"] },
  { "name": "Ghoul", "cr": 1, "xp": 200, "type": "undead", "size": "Medium", "ac": 12, "hp": 22, "hpDice": "5d8", "speed": 30, "tags": ["undead", "undead_theme"] },
  { "name": "Iena gigante", "cr": 1, "xp": 200, "type": "beast", "size": "Large", "ac": 12, "hp": 45, "hpDice": "6d10+12", "speed": 50, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Imp", "cr": 1, "xp": 200, "type": "fiend", "size": "Tiny", "ac": 13, "hp": 21, "hpDice": "6d4+6", "speed": 20, "tags": ["devil", "fiend"] },
  { "name": "Ippogrifo", "cr": 1, "xp": 200, "type": "monstrosity", "size": "Large", "ac": 11, "hp": 26, "hpDice": "4d10+4", "speed": 40, "tags": ["monstrosity"] },
  { "name": "Leone", "cr": 1, "xp": 200, "type": "beast", "size": "Large", "ac": 12, "hp": 22, "hpDice": "4d10", "speed": 50, "tags": ["beast", "wild_beast"] },
  { "name": "Lupo feroce", "cr": 1, "xp": 200, "type": "beast", "size": "Large", "ac": 14, "hp": 22, "hpDice": "3d10+6", "speed": 50, "tags": ["beast", "wild_beast"] },
  { "name": "Orso bruno", "cr": 1, "xp": 200, "type": "beast", "size": "Large", "ac": 11, "hp": 22, "hpDice": "3d10+6", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Piovra gigante", "cr": 1, "xp": 200, "type": "beast", "size": "Large", "ac": 11, "hp": 45, "hpDice": "7d10+7", "speed": 10, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Quasit", "cr": 1, "xp": 200, "type": "fiend", "size": "Tiny", "ac": 13, "hp": 25, "hpDice": "10d4", "speed": 40, "tags": ["demon", "fiend"] },
  { "name": "Ragno gigante", "cr": 1, "xp": 200, "type": "beast", "size": "Large", "ac": 14, "hp": 26, "hpDice": "4d10+4", "speed": 30, "tags": ["beast", "giantkin", "vermin"] },
  { "name": "Rospo gigante", "cr": 1, "xp": 200, "type": "beast", "size": "Large", "ac": 11, "hp": 39, "hpDice": "6d10+6", "speed": 20, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Spettro", "cr": 1, "xp": 200, "type": "undead", "size": "Medium", "ac": 12, "hp": 22, "hpDice": "5d8", "speed": 0, "tags": ["undead", "undead_theme"] },
  { "name": "Spia", "cr": 1, "xp": 200, "type": "humanoid", "size": "Medium", "ac": 12, "hp": 27, "hpDice": "6d8", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Tigre", "cr": 1, "xp": 200, "type": "beast", "size": "Large", "ac": 13, "hp": 30, "hpDice": "4d10+8", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Albero risvegliato", "cr": 2, "xp": 450, "type": "plant", "size": "Huge", "ac": 13, "hp": 59, "hpDice": "7d12+14", "speed": 20, "tags": ["plant", "plant_theme"] },
  { "name": "Alce gigante", "cr": 2, "xp": 450, "type": "beast", "size": "Huge", "ac": 14, "hp": 42, "hpDice": "5d12+10", "speed": 60, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Ameba paglierina", "cr": 2, "xp": 450, "type": "ooze", "size": "Large", "ac": 8, "hp": 52, "hpDice": "7d10+14", "speed": 10, "tags": ["ooze", "ooze_theme"] },
  { "name": "Ankheg", "cr": 2, "xp": 450, "type": "monstrosity", "size": "Large", "ac": 14, "hp": 45, "hpDice": "6d10+12", "speed": 30, "tags": ["monstrosity"] },
  { "name": "Azer sentinella", "cr": 2, "xp": 450, "type": "elemental", "size": "Medium", "ac": 17, "hp": 39, "hpDice": "6d8+12", "speed": 30, "tags": ["elemental", "fire"] },
  { "name": "Berserker", "cr": 2, "xp": 450, "type": "humanoid", "size": "Medium", "ac": 13, "hp": 67, "hpDice": "9d8+27", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Capo dei banditi", "cr": 2, "xp": 450, "type": "humanoid", "size": "Medium", "ac": 15, "hp": 52, "hpDice": "8d8+16", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Centauro combattente", "cr": 2, "xp": 450, "type": "monstrosity", "size": "Large", "ac": 16, "hp": 45, "hpDice": "6d10+12", "speed": 50, "tags": ["monstrosity"] },
  { "name": "Cinghiale gigante", "cr": 2, "xp": 450, "type": "beast", "size": "Large", "ac": 13, "hp": 42, "hpDice": "5d10+15", "speed": 40, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Colonia di serpenti velenosi", "cr": 2, "xp": 450, "type": "swarm", "size": "Medium", "ac": 14, "hp": 36, "hpDice": "8d8", "speed": 30, "tags": ["swarm", "wild_beast"] },
  { "name": "Cubo gelatinoso", "cr": 2, "xp": 450, "type": "ooze", "size": "Large", "ac": 6, "hp": 63, "hpDice": "6d10+30", "speed": 15, "tags": ["ooze", "ooze_theme"] },
  { "name": "Cultista fanatico", "cr": 2, "xp": 450, "type": "humanoid", "size": "Medium", "ac": 13, "hp": 44, "hpDice": "8d8+8", "speed": 30, "tags": ["humanoid"] },
  { "name": "Drago bianco cucciolo", "cr": 2, "xp": 450, "type": "dragon", "size": "Medium", "ac": 16, "hp": 32, "hpDice": "5d8+10", "speed": 30, "tags": ["draconic", "dragon", "ice"] },
  { "name": "Drago d'argento cucciolo", "cr": 2, "xp": 450, "type": "dragon", "size": "Medium", "ac": 17, "hp": 45, "hpDice": "6d8+18", "speed": 30, "tags": ["draconic", "dragon"] },
  { "name": "Drago di bronzo cucciolo", "cr": 2, "xp": 450, "type": "dragon", "size": "Medium", "ac": 15, "hp": 39, "hpDice": "6d8+12", "speed": 30, "tags": ["draconic", "dragon"] },
  { "name": "Drago nero cucciolo", "cr": 2, "xp": 450, "type": "dragon", "size": "Medium", "ac": 17, "hp": 33, "hpDice": "6d8+6", "speed": 30, "tags": ["draconic", "dragon"] },
  { "name": "Drago verde cucciolo", "cr": 2, "xp": 450, "type": "dragon", "size": "Medium", "ac": 17, "hp": 38, "hpDice": "7d8+7", "speed": 30, "tags": ["draconic", "dragon"] },
  { "name": "Druido", "cr": 2, "xp": 450, "type": "humanoid", "size": "Medium", "ac": 13, "hp": 44, "hpDice": "8d8+8", "speed": 30, "tags": ["humanoid"] },
  { "name": "Ettercap", "cr": 2, "xp": 450, "type": "monstrosity", "size": "Medium", "ac": 13, "hp": 44, "hpDice": "8d8+8", "speed": 30, "tags": ["monstrosity", "vermin"] },
  { "name": "Fauce gorgogliante", "cr": 2, "xp": 450, "type": "aberration", "size": "Medium", "ac": 9, "hp": 52, "hpDice": "7d8+21", "speed": 10, "tags": ["aberrant", "aberration"] },
  { "name": "Fuoco fatuo", "cr": 2, "xp": 450, "type": "undead", "size": "Tiny", "ac": 19, "hp": 27, "hpDice": "11d4", "speed": 0, "tags": ["undead", "undead_theme"] },
  { "name": "Gargoyle", "cr": 2, "xp": 450, "type": "elemental", "size": "Medium", "ac": 15, "hp": 67, "hpDice": "9d8+27", "speed": 30, "tags": ["elemental", "elemental_construct"] },
  { "name": "Ghast", "cr": 2, "xp": 450, "type": "undead", "size": "Medium", "ac": 13, "hp": 36, "hpDice": "8d8", "speed": 30, "tags": ["undead", "undead_theme"] },
  { "name": "Grick", "cr": 2, "xp": 450, "type": "monstrosity", "size": "Medium", "ac": 14, "hp": 54, "hpDice": "12d8", "speed": 30, "tags": ["monstrosity"] },
  { "name": "Grifone", "cr": 2, "xp": 450, "type": "monstrosity", "size": "Large", "ac": 12, "hp": 59, "hpDice": "7d10+21", "speed": 30, "tags": ["monstrosity"] },
  { "name": "Megera marina", "cr": 2, "xp": 450, "type": "fey", "size": "Medium", "ac": 14, "hp": 52, "hpDice": "7d8+21", "speed": 30, "tags": ["aquatic", "fey", "fey_theme"] },
  { "name": "Merrow", "cr": 2, "xp": 450, "type": "monstrosity", "size": "Large", "ac": 13, "hp": 45, "hpDice": "6d10+12", "speed": 10, "tags": ["aquatic", "monstrosity"] },
  { "name": "Mimic", "cr": 2, "xp": 450, "type": "monstrosity", "size": "Medium", "ac": 12, "hp": 58, "hpDice": "9d8+18", "speed": 15, "tags": ["monstrosity"] },
  { "name": "Ogre", "cr": 2, "xp": 450, "type": "giant", "size": "Large", "ac": 11, "hp": 68, "hpDice": "8d10+24", "speed": 40, "tags": ["giant", "giantkin"] },
  { "name": "Orso polare", "cr": 2, "xp": 450, "type": "beast", "size": "Large", "ac": 12, "hp": 42, "hpDice": "5d10+15", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Pegaso", "cr": 2, "xp": 450, "type": "celestial", "size": "Large", "ac": 12, "hp": 59, "hpDice": "7d10+21", "speed": 60, "tags": ["celestial", "celestial_theme"] },
  { "name": "Plesiosauro", "cr": 2, "xp": 450, "type": "beast", "size": "Large", "ac": 13, "hp": 68, "hpDice": "8d10+24", "speed": 20, "tags": ["beast"] },
  { "name": "Rinoceronte", "cr": 2, "xp": 450, "type": "beast", "size": "Large", "ac": 13, "hp": 45, "hpDice": "6d10+12", "speed": 40, "tags": ["beast"] },
  { "name": "Sacerdote", "cr": 2, "xp": 450, "type": "humanoid", "size": "Medium", "ac": 13, "hp": 38, "hpDice": "7d8+7", "speed": 25, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Scheletro di minotauro", "cr": 2, "xp": 450, "type": "undead", "size": "Large", "ac": 12, "hp": 45, "hpDice": "6d10+12", "speed": 40, "tags": ["undead", "undead_theme"] },
  { "name": "Serpente stritolatore gigante", "cr": 2, "xp": 450, "type": "beast", "size": "Huge", "ac": 12, "hp": 60, "hpDice": "8d12+8", "speed": 30, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Squalo cacciatore", "cr": 2, "xp": 450, "type": "beast", "size": "Large", "ac": 12, "hp": 45, "hpDice": "6d10+12", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Tappeto soffocante animato", "cr": 2, "xp": 450, "type": "construct", "size": "Large", "ac": 12, "hp": 27, "hpDice": "5d10", "speed": 10, "tags": ["construct"] },
  { "name": "Tigre dai denti a sciabola", "cr": 2, "xp": 450, "type": "beast", "size": "Large", "ac": 13, "hp": 52, "hpDice": "7d10+14", "speed": 40, "tags": ["beast", "wild_beast"] },
  { "name": "Topo mannaro", "cr": 2, "xp": 450, "type": "humanoid", "size": "Medium", "ac": 13, "hp": 60, "hpDice": "11d8+11", "speed": 30, "tags": ["humanoid", "lycanthrope", "wild_beast"] },
  { "name": "Zombi ogre", "cr": 2, "xp": 450, "type": "undead", "size": "Large", "ac": 8, "hp": 85, "hpDice": "9d10+36", "speed": 30, "tags": ["giantkin", "ooze_theme", "undead", "undead_theme"] },
  { "name": "Basilisco", "cr": 3, "xp": 700, "type": "monstrosity", "size": "Medium", "ac": 15, "hp": 52, "hpDice": "8d8+16", "speed": 20, "tags": ["monstrosity"] },
  { "name": "Cavaliere", "cr": 3, "xp": 700, "type": "humanoid", "size": "Medium", "ac": 18, "hp": 52, "hpDice": "8d8+16", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Cavallo degli incubi", "cr": 3, "xp": 700, "type": "fiend", "size": "Large", "ac": 13, "hp": 68, "hpDice": "8d10+24", "speed": 60, "tags": ["fiend"] },
  { "name": "Diavolo barbuto", "cr": 3, "xp": 700, "type": "fiend", "size": "Medium", "ac": 13, "hp": 58, "hpDice": "9d8+18", "speed": 30, "tags": ["devil", "fiend", "wild_beast"] },
  { "name": "Doppelganger", "cr": 3, "xp": 700, "type": "monstrosity", "size": "Medium", "ac": 14, "hp": 52, "hpDice": "8d8+16", "speed": 30, "tags": ["monstrosity"] },
  { "name": "Drago blu cucciolo", "cr": 3, "xp": 700, "type": "dragon", "size": "Medium", "ac": 17, "hp": 65, "hpDice": "10d8+20", "speed": 30, "tags": ["draconic", "dragon"] },
  { "name": "Drago d'oro cucciolo", "cr": 3, "xp": 700, "type": "dragon", "size": "Medium", "ac": 17, "hp": 60, "hpDice": "8d8+24", "speed": 30, "tags": ["draconic", "dragon"] },
  { "name": "Guerriero veterano", "cr": 3, "xp": 700, "type": "humanoid", "size": "Medium", "ac": 17, "hp": 65, "hpDice": "10d8+20", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Lupo invernale", "cr": 3, "xp": 700, "type": "monstrosity", "size": "Large", "ac": 13, "hp": 75, "hpDice": "10d10+20", "speed": 50, "tags": ["ice", "monstrosity", "wild_beast"] },
  { "name": "Lupo mannaro", "cr": 3, "xp": 700, "type": "humanoid", "size": "Medium", "ac": 15, "hp": 71, "hpDice": "11d8+22", "speed": 30, "tags": ["humanoid", "lycanthrope", "wild_beast"] },
  { "name": "Manticora", "cr": 3, "xp": 700, "type": "monstrosity", "size": "Large", "ac": 14, "hp": 68, "hpDice": "8d10+24", "speed": 30, "tags": ["monstrosity"] },
  { "name": "Megera verde", "cr": 3, "xp": 700, "type": "fey", "size": "Medium", "ac": 17, "hp": 82, "hpDice": "11d8+33", "speed": 30, "tags": ["fey", "fey_theme"] },
  { "name": "Minotauro di Baphomet", "cr": 3, "xp": 700, "type": "monstrosity", "size": "Large", "ac": 14, "hp": 85, "hpDice": "10d10+30", "speed": 40, "tags": ["monstrosity"] },
  { "name": "Mummia", "cr": 3, "xp": 700, "type": "undead", "size": "Medium", "ac": 11, "hp": 58, "hpDice": "9d8+18", "speed": 20, "tags": ["undead", "undead_theme"] },
  { "name": "Orca assassina", "cr": 3, "xp": 700, "type": "beast", "size": "Huge", "ac": 12, "hp": 90, "hpDice": "12d12+12", "speed": 60, "tags": ["beast"] },
  { "name": "Orsogufo", "cr": 3, "xp": 700, "type": "monstrosity", "size": "Large", "ac": 13, "hp": 59, "hpDice": "7d10+21", "speed": 40, "tags": ["monstrosity", "wild_beast"] },
  { "name": "Ragno-fase", "cr": 3, "xp": 700, "type": "monstrosity", "size": "Large", "ac": 14, "hp": 45, "hpDice": "7d10+7", "speed": 30, "tags": ["monstrosity", "vermin"] },
  { "name": "Scorpione gigante", "cr": 3, "xp": 700, "type": "beast", "size": "Large", "ac": 15, "hp": 52, "hpDice": "7d10+14", "speed": 40, "tags": ["beast", "giantkin", "vermin"] },
  { "name": "Segugio infernale", "cr": 3, "xp": 700, "type": "fiend", "size": "Medium", "ac": 15, "hp": 58, "hpDice": "9d8+18", "speed": 50, "tags": ["fiend", "fire"] },
  { "name": "Wight", "cr": 3, "xp": 700, "type": "undead", "size": "Medium", "ac": 14, "hp": 82, "hpDice": "11d8+33", "speed": 30, "tags": ["undead", "undead_theme"] },
  { "name": "Chuul", "cr": 4, "xp": 1100, "type": "aberration", "size": "Large", "ac": 16, "hp": 76, "hpDice": "9d10+27", "speed": 30, "tags": ["aberrant", "aberration"] },
  { "name": "Cinghiale mannaro", "cr": 4, "xp": 1100, "type": "humanoid", "size": "Medium", "ac": 15, "hp": 97, "hpDice": "15d8+30", "speed": 40, "tags": ["humanoid", "lycanthrope", "wild_beast"] },
  { "name": "Couatl", "cr": 4, "xp": 1100, "type": "celestial", "size": "Medium", "ac": 19, "hp": 60, "hpDice": "8d8+24", "speed": 30, "tags": ["celestial", "celestial_theme"] },
  { "name": "Drago rosso cucciolo", "cr": 4, "xp": 1100, "type": "dragon", "size": "Medium", "ac": 17, "hp": 75, "hpDice": "10d8+30", "speed": 30, "tags": ["draconic", "dragon", "fire"] },
  { "name": "Elefante", "cr": 4, "xp": 1100, "type": "beast", "size": "Huge", "ac": 12, "hp": 76, "hpDice": "8d12+24", "speed": 40, "tags": ["beast", "vermin"] },
  { "name": "Ettin", "cr": 4, "xp": 1100, "type": "giant", "size": "Large", "ac": 12, "hp": 85, "hpDice": "10d10+30", "speed": 40, "tags": ["giant", "giantkin"] },
  { "name": "Fantasma", "cr": 4, "xp": 1100, "type": "undead", "size": "Medium", "ac": 11, "hp": 45, "hpDice": "10d8", "speed": 0, "tags": ["undead", "undead_theme"] },
  { "name": "Lamia", "cr": 4, "xp": 1100, "type": "monstrosity", "size": "Large", "ac": 13, "hp": 97, "hpDice": "13d10+26", "speed": 30, "tags": ["monstrosity"] },
  { "name": "Protoplasma nero", "cr": 4, "xp": 1100, "type": "ooze", "size": "Large", "ac": 7, "hp": 68, "hpDice": "8d10+24", "speed": 20, "tags": ["ooze", "ooze_theme"] },
  { "name": "Succube", "cr": 4, "xp": 1100, "type": "fiend", "size": "Medium", "ac": 15, "hp": 71, "hpDice": "13d8+13", "speed": 30, "tags": ["fiend"] },
  { "name": "Tigre mannara", "cr": 4, "xp": 1100, "type": "humanoid", "size": "Medium", "ac": 12, "hp": 120, "hpDice": "16d8+48", "speed": 30, "tags": ["humanoid", "lycanthrope", "wild_beast"] },
  { "name": "Bulette", "cr": 5, "xp": 1800, "type": "monstrosity", "size": "Large", "ac": 17, "hp": 94, "hpDice": "9d10+45", "speed": 40, "tags": ["monstrosity"] },
  { "name": "Coccodrillo gigante", "cr": 5, "xp": 1800, "type": "beast", "size": "Huge", "ac": 14, "hp": 85, "hpDice": "9d12+27", "speed": 30, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Cumulo strisciante", "cr": 5, "xp": 1800, "type": "plant", "size": "Large", "ac": 15, "hp": 110, "hpDice": "13d10+39", "speed": 20, "tags": ["plant", "plant_theme"] },
  { "name": "Diavolo uncinato", "cr": 5, "xp": 1800, "type": "fiend", "size": "Medium", "ac": 15, "hp": 110, "hpDice": "13d8+52", "speed": 30, "tags": ["devil", "fiend"] },
  { "name": "Elementale del fuoco", "cr": 5, "xp": 1800, "type": "elemental", "size": "Large", "ac": 13, "hp": 93, "hpDice": "11d10+33", "speed": 50, "tags": ["elemental", "elemental_construct", "fire"] },
  { "name": "Elementale dell'acqua", "cr": 5, "xp": 1800, "type": "elemental", "size": "Large", "ac": 14, "hp": 114, "hpDice": "12d10+48", "speed": 30, "tags": ["aquatic", "elemental", "elemental_construct"] },
  { "name": "Elementale dell'aria", "cr": 5, "xp": 1800, "type": "elemental", "size": "Large", "ac": 15, "hp": 90, "hpDice": "12d10+24", "speed": 90, "tags": ["elemental", "elemental_construct"] },
  { "name": "Elementale della terra", "cr": 5, "xp": 1800, "type": "elemental", "size": "Large", "ac": 17, "hp": 147, "hpDice": "14d10+70", "speed": 30, "tags": ["elemental", "elemental_construct"] },
  { "name": "Fustigatore", "cr": 5, "xp": 1800, "type": "monstrosity", "size": "Large", "ac": 20, "hp": 93, "hpDice": "11d10+33", "speed": 10, "tags": ["monstrosity"] },
  { "name": "Gigante delle colline", "cr": 5, "xp": 1800, "type": "giant", "size": "Huge", "ac": 13, "hp": 105, "hpDice": "10d12+40", "speed": 40, "tags": ["giant", "giantkin", "vermin"] },
  { "name": "Gladiatore", "cr": 5, "xp": 1800, "type": "humanoid", "size": "Medium", "ac": 16, "hp": 112, "hpDice": "15d8+45", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Golem di carne", "cr": 5, "xp": 1800, "type": "construct", "size": "Medium", "ac": 9, "hp": 127, "hpDice": "15d8+60", "speed": 30, "tags": ["construct", "construct_theme", "elemental_construct"] },
  { "name": "Gorgone", "cr": 5, "xp": 1800, "type": "monstrosity", "size": "Large", "ac": 19, "hp": 114, "hpDice": "12d10+48", "speed": 40, "tags": ["monstrosity"] },
  { "name": "Megera notturna", "cr": 5, "xp": 1800, "type": "fiend", "size": "Medium", "ac": 17, "hp": 112, "hpDice": "15d8+45", "speed": 30, "tags": ["fey_theme", "fiend"] },
  { "name": "Mezzodrago", "cr": 5, "xp": 1800, "type": "humanoid", "size": "Medium", "ac": 18, "hp": 105, "hpDice": "14d8+42", "speed": 30, "tags": ["draconic", "fire", "humanoid", "humanoid_npc"] },
  { "name": "Orso mannaro", "cr": 5, "xp": 1800, "type": "humanoid", "size": "Medium", "ac": 15, "hp": 135, "hpDice": "18d8+54", "speed": 40, "tags": ["humanoid", "lycanthrope", "wild_beast"] },
  { "name": "Otyugh", "cr": 5, "xp": 1800, "type": "aberration", "size": "Large", "ac": 14, "hp": 104, "hpDice": "11d10+44", "speed": 30, "tags": ["aberrant", "aberration"] },
  { "name": "Progenie vampirica", "cr": 5, "xp": 1800, "type": "undead", "size": "Medium", "ac": 16, "hp": 90, "hpDice": "12d8+36", "speed": 30, "tags": ["undead", "undead_theme"] },
  { "name": "Salamandra", "cr": 5, "xp": 1800, "type": "elemental", "size": "Large", "ac": 15, "hp": 90, "hpDice": "12d10+24", "speed": 30, "tags": ["elemental", "fire"] },
  { "name": "Squalo gigante", "cr": 5, "xp": 1800, "type": "beast", "size": "Huge", "ac": 13, "hp": 92, "hpDice": "8d12+40", "speed": 50, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Triceratopo", "cr": 5, "xp": 1800, "type": "beast", "size": "Huge", "ac": 14, "hp": 114, "hpDice": "12d12+36", "speed": 50, "tags": ["beast", "ice", "wild_beast"] },
  { "name": "Troll", "cr": 5, "xp": 1800, "type": "giant", "size": "Large", "ac": 15, "hp": 94, "hpDice": "9d10+45", "speed": 30, "tags": ["giant", "giantkin"] },
  { "name": "Unicorno", "cr": 5, "xp": 1800, "type": "celestial", "size": "Large", "ac": 12, "hp": 97, "hpDice": "13d10+26", "speed": 50, "tags": ["celestial", "celestial_theme"] },
  { "name": "Wraith", "cr": 5, "xp": 1800, "type": "undead", "size": "Medium", "ac": 13, "hp": 67, "hpDice": "9d8+27", "speed": 0, "tags": ["undead", "undead_theme"] },
  { "name": "Xorn", "cr": 5, "xp": 1800, "type": "elemental", "size": "Medium", "ac": 19, "hp": 84, "hpDice": "8d8+48", "speed": 20, "tags": ["elemental", "elemental_construct"] },
  { "name": "Cacciatore invisibile", "cr": 6, "xp": 2300, "type": "elemental", "size": "Medium", "ac": 14, "hp": 97, "hpDice": "13d10+26", "speed": 50, "tags": ["elemental"] },
  { "name": "Chimera", "cr": 6, "xp": 2300, "type": "monstrosity", "size": "Large", "ac": 14, "hp": 114, "hpDice": "12d10+48", "speed": 30, "tags": ["monstrosity"] },
  { "name": "Drago bianco giovane", "cr": 6, "xp": 2300, "type": "dragon", "size": "Large", "ac": 17, "hp": 123, "hpDice": "13d10+52", "speed": 40, "tags": ["draconic", "dragon", "ice"] },
  { "name": "Drago d'ottone giovane", "cr": 6, "xp": 2300, "type": "dragon", "size": "Large", "ac": 17, "hp": 110, "hpDice": "13d10+39", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drider", "cr": 6, "xp": 2300, "type": "monstrosity", "size": "Large", "ac": 19, "hp": 123, "hpDice": "13d10+52", "speed": 30, "tags": ["monstrosity"] },
  { "name": "Mago", "cr": 6, "xp": 2300, "type": "humanoid", "size": "Medium", "ac": 15, "hp": 81, "hpDice": "18d8", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Mammut", "cr": 6, "xp": 2300, "type": "beast", "size": "Huge", "ac": 13, "hp": 126, "hpDice": "11d12+55", "speed": 40, "tags": ["beast"] },
  { "name": "Medusa", "cr": 6, "xp": 2300, "type": "monstrosity", "size": "Medium", "ac": 15, "hp": 127, "hpDice": "17d8+51", "speed": 30, "tags": ["monstrosity"] },
  { "name": "Viverna", "cr": 6, "xp": 2300, "type": "dragon", "size": "Large", "ac": 14, "hp": 127, "hpDice": "15d10+45", "speed": 20, "tags": ["draconic", "dragon"] },
  { "name": "Vrock", "cr": 6, "xp": 2300, "type": "fiend", "size": "Large", "ac": 15, "hp": 152, "hpDice": "16d10+64", "speed": 40, "tags": ["demon", "fiend"] },
  { "name": "Drago di rame giovane", "cr": 7, "xp": 2900, "type": "dragon", "size": "Large", "ac": 17, "hp": 119, "hpDice": "14d10+42", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago nero giovane", "cr": 7, "xp": 2900, "type": "dragon", "size": "Large", "ac": 18, "hp": 127, "hpDice": "15d10+45", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Gigante delle pietre", "cr": 7, "xp": 2900, "type": "giant", "size": "Huge", "ac": 17, "hp": 126, "hpDice": "11d12+55", "speed": 40, "tags": ["giant", "giantkin", "vermin"] },
  { "name": "Gorilla gigante", "cr": 7, "xp": 2900, "type": "beast", "size": "Huge", "ac": 12, "hp": 168, "hpDice": "16d12+64", "speed": 40, "tags": ["beast", "giantkin", "vermin", "wild_beast"] },
  { "name": "Guardiano protettore", "cr": 7, "xp": 2900, "type": "construct", "size": "Large", "ac": 17, "hp": 142, "hpDice": "15d10+60", "speed": 30, "tags": ["construct", "construct_theme", "humanoid_npc"] },
  { "name": "Oni", "cr": 7, "xp": 2900, "type": "giant", "size": "Large", "ac": 17, "hp": 119, "hpDice": "14d10+42", "speed": 30, "tags": ["giant", "giantkin"] },
  { "name": "Assassino", "cr": 8, "xp": 3900, "type": "humanoid", "size": "Medium", "ac": 16, "hp": 97, "hpDice": "15d8+30", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Diavolo delle catene", "cr": 8, "xp": 3900, "type": "fiend", "size": "Medium", "ac": 15, "hp": 85, "hpDice": "10d8+40", "speed": 30, "tags": ["devil", "fiend"] },
  { "name": "Drago di bronzo giovane", "cr": 8, "xp": 3900, "type": "dragon", "size": "Large", "ac": 17, "hp": 142, "hpDice": "15d10+60", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago verde giovane", "cr": 8, "xp": 3900, "type": "dragon", "size": "Large", "ac": 18, "hp": 136, "hpDice": "16d10+48", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Gigante del gelo", "cr": 8, "xp": 3900, "type": "giant", "size": "Huge", "ac": 15, "hp": 149, "hpDice": "13d12+65", "speed": 40, "tags": ["giant", "giantkin", "ice", "vermin"] },
  { "name": "Hezrou", "cr": 8, "xp": 3900, "type": "fiend", "size": "Large", "ac": 18, "hp": 157, "hpDice": "15d10+75", "speed": 30, "tags": ["demon", "fiend"] },
  { "name": "Idra", "cr": 8, "xp": 3900, "type": "monstrosity", "size": "Huge", "ac": 15, "hp": 184, "hpDice": "16d12+80", "speed": 30, "tags": ["aquatic", "monstrosity"] },
  { "name": "Manto assassino", "cr": 8, "xp": 3900, "type": "aberration", "size": "Large", "ac": 14, "hp": 91, "hpDice": "14d10+14", "speed": 10, "tags": ["aberrant", "aberration"] },
  { "name": "Naga spirituale", "cr": 8, "xp": 3900, "type": "monstrosity", "size": "Large", "ac": 17, "hp": 135, "hpDice": "18d10+36", "speed": 40, "tags": ["monstrosity"] },
  { "name": "Tirannosauro", "cr": 8, "xp": 3900, "type": "beast", "size": "Huge", "ac": 13, "hp": 136, "hpDice": "13d12+52", "speed": 50, "tags": ["beast"] },
  { "name": "Diavolo d'ossa", "cr": 9, "xp": 5e3, "type": "fiend", "size": "Large", "ac": 16, "hp": 161, "hpDice": "17d10+68", "speed": 40, "tags": ["devil", "fiend"] },
  { "name": "Drago blu giovane", "cr": 9, "xp": 5e3, "type": "dragon", "size": "Large", "ac": 18, "hp": 152, "hpDice": "16d10+64", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago d'argento giovane", "cr": 9, "xp": 5e3, "type": "dragon", "size": "Large", "ac": 18, "hp": 168, "hpDice": "16d10+80", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Gigante del fuoco", "cr": 9, "xp": 5e3, "type": "giant", "size": "Huge", "ac": 18, "hp": 162, "hpDice": "13d12+78", "speed": 30, "tags": ["fire", "giant", "giantkin", "vermin"] },
  { "name": "Gigante delle nuvole", "cr": 9, "xp": 5e3, "type": "giant", "size": "Huge", "ac": 14, "hp": 200, "hpDice": "16d12+96", "speed": 40, "tags": ["giant", "giantkin", "vermin"] },
  { "name": "Glabrezu", "cr": 9, "xp": 5e3, "type": "fiend", "size": "Large", "ac": 17, "hp": 189, "hpDice": "18d10+90", "speed": 40, "tags": ["demon", "fiend"] },
  { "name": "Golem di argilla", "cr": 9, "xp": 5e3, "type": "construct", "size": "Large", "ac": 14, "hp": 123, "hpDice": "13d10+52", "speed": 20, "tags": ["construct", "construct_theme", "elemental_construct"] },
  { "name": "Treant", "cr": 9, "xp": 5e3, "type": "plant", "size": "Huge", "ac": 16, "hp": 138, "hpDice": "12d12+60", "speed": 30, "tags": ["plant", "plant_theme", "vermin"] },
  { "name": "Aboleth", "cr": 10, "xp": 5900, "type": "aberration", "size": "Large", "ac": 17, "hp": 150, "hpDice": "20d10+40", "speed": 10, "tags": ["aberrant", "aberration"] },
  { "name": "Deva", "cr": 10, "xp": 5900, "type": "celestial", "size": "Medium", "ac": 17, "hp": 229, "hpDice": "27d8+108", "speed": 30, "tags": ["celestial", "celestial_theme"] },
  { "name": "Drago d'oro giovane", "cr": 10, "xp": 5900, "type": "dragon", "size": "Large", "ac": 18, "hp": 178, "hpDice": "17d10+85", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago rosso giovane", "cr": 10, "xp": 5900, "type": "dragon", "size": "Large", "ac": 18, "hp": 178, "hpDice": "17d10+85", "speed": 40, "tags": ["draconic", "dragon", "fire"] },
  { "name": "Golem di pietra", "cr": 10, "xp": 5900, "type": "construct", "size": "Large", "ac": 18, "hp": 220, "hpDice": "21d10+105", "speed": 30, "tags": ["construct", "construct_theme", "elemental_construct"] },
  { "name": "Naga guardiana", "cr": 10, "xp": 5900, "type": "monstrosity", "size": "Large", "ac": 18, "hp": 136, "hpDice": "16d10+48", "speed": 40, "tags": ["humanoid_npc", "monstrosity"] },
  { "name": "Behir", "cr": 11, "xp": 7200, "type": "monstrosity", "size": "Huge", "ac": 17, "hp": 168, "hpDice": "16d12+64", "speed": 50, "tags": ["monstrosity"] },
  { "name": "Diavolo cornuto", "cr": 11, "xp": 7200, "type": "fiend", "size": "Large", "ac": 18, "hp": 199, "hpDice": "19d10+95", "speed": 20, "tags": ["devil", "fiend"] },
  { "name": "Djinni", "cr": 11, "xp": 7200, "type": "elemental", "size": "Large", "ac": 17, "hp": 218, "hpDice": "19d10+114", "speed": 30, "tags": ["elemental", "elemental_construct"] },
  { "name": "Efreeti", "cr": 11, "xp": 7200, "type": "elemental", "size": "Large", "ac": 17, "hp": 212, "hpDice": "17d10+119", "speed": 40, "tags": ["elemental", "elemental_construct", "fire"] },
  { "name": "Remorhaz", "cr": 11, "xp": 7200, "type": "monstrosity", "size": "Huge", "ac": 17, "hp": 195, "hpDice": "17d12+85", "speed": 30, "tags": ["ice", "monstrosity"] },
  { "name": "Roc", "cr": 11, "xp": 7200, "type": "monstrosity", "size": "Gargantuan", "ac": 15, "hp": 248, "hpDice": "16d20+80", "speed": 20, "tags": ["monstrosity"] },
  { "name": "Sfinge della conoscenza", "cr": 11, "xp": 7200, "type": "monstrosity", "size": "Large", "ac": 17, "hp": 170, "hpDice": "20d10+60", "speed": 40, "tags": ["monstrosity"] },
  { "name": "Arcimago", "cr": 12, "xp": 8e3, "type": "humanoid", "size": "Medium", "ac": 17, "hp": 170, "hpDice": "31d8+31", "speed": 30, "tags": ["humanoid", "humanoid_npc"] },
  { "name": "Erinni", "cr": 12, "xp": 8400, "type": "fiend", "size": "Medium", "ac": 18, "hp": 178, "hpDice": "21d8+84", "speed": 30, "tags": ["devil", "fiend"] },
  { "name": "Drago bianco adulto", "cr": 13, "xp": 1e4, "type": "dragon", "size": "Huge", "ac": 18, "hp": 200, "hpDice": "16d12+96", "speed": 40, "tags": ["draconic", "dragon", "ice"] },
  { "name": "Drago d'ottone adulto", "cr": 13, "xp": 1e4, "type": "dragon", "size": "Huge", "ac": 18, "hp": 172, "hpDice": "15d12+75", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Gigante delle tempeste", "cr": 13, "xp": 1e4, "type": "giant", "size": "Huge", "ac": 16, "hp": 230, "hpDice": "20d12+100", "speed": 50, "tags": ["giant", "giantkin", "vermin"] },
  { "name": "Nalfeshnee", "cr": 13, "xp": 1e4, "type": "fiend", "size": "Large", "ac": 18, "hp": 184, "hpDice": "16d10+96", "speed": 20, "tags": ["demon", "fiend"] },
  { "name": "Rakshasa", "cr": 13, "xp": 1e4, "type": "fiend", "size": "Medium", "ac": 17, "hp": 221, "hpDice": "26d8+104", "speed": 40, "tags": ["fiend"] },
  { "name": "Vampiro", "cr": 13, "xp": 1e4, "type": "undead", "size": "Medium", "ac": 16, "hp": 195, "hpDice": "23d8+92", "speed": 5, "tags": ["undead", "undead_theme", "wild_beast"] },
  { "name": "Diavolo del ghiaccio", "cr": 14, "xp": 11500, "type": "fiend", "size": "Large", "ac": 18, "hp": 228, "hpDice": "24d10+96", "speed": 40, "tags": ["devil", "fiend", "ice"] },
  { "name": "Drago di rame adulto", "cr": 14, "xp": 11500, "type": "dragon", "size": "Huge", "ac": 18, "hp": 184, "hpDice": "16d12+80", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago nero adulto", "cr": 14, "xp": 11500, "type": "dragon", "size": "Huge", "ac": 19, "hp": 195, "hpDice": "17d12+85", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago di bronzo adulto", "cr": 15, "xp": 13e3, "type": "dragon", "size": "Huge", "ac": 18, "hp": 212, "hpDice": "17d12+102", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago verde adulto", "cr": 15, "xp": 13e3, "type": "dragon", "size": "Huge", "ac": 19, "hp": 207, "hpDice": "18d12+90", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Signore delle mummie", "cr": 15, "xp": 13e3, "type": "undead", "size": "Medium", "ac": 17, "hp": 187, "hpDice": "25d8+75", "speed": 20, "tags": ["undead", "undead_theme"] },
  { "name": "Verme purpureo", "cr": 15, "xp": 13e3, "type": "monstrosity", "size": "Gargantuan", "ac": 18, "hp": 247, "hpDice": "15d20+90", "speed": 50, "tags": ["monstrosity"] },
  { "name": "Drago blu adulto", "cr": 16, "xp": 15e3, "type": "dragon", "size": "Huge", "ac": 19, "hp": 212, "hpDice": "17d12+102", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago d'argento adulto", "cr": 16, "xp": 15e3, "type": "dragon", "size": "Huge", "ac": 19, "hp": 216, "hpDice": "16d12+112", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Golem di ferro", "cr": 16, "xp": 15e3, "type": "construct", "size": "Large", "ac": 20, "hp": 252, "hpDice": "24d10+120", "speed": 30, "tags": ["construct", "construct_theme", "elemental_construct"] },
  { "name": "Marilith", "cr": 16, "xp": 15e3, "type": "fiend", "size": "Large", "ac": 16, "hp": 220, "hpDice": "21d10+105", "speed": 40, "tags": ["demon", "fiend"] },
  { "name": "Planetar", "cr": 16, "xp": 15e3, "type": "celestial", "size": "Large", "ac": 19, "hp": 262, "hpDice": "21d10+147", "speed": 40, "tags": ["celestial", "celestial_theme"] },
  { "name": "Drago d'oro adulto", "cr": 17, "xp": 18e3, "type": "dragon", "size": "Huge", "ac": 19, "hp": 243, "hpDice": "18d12+126", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago rosso adulto", "cr": 17, "xp": 18e3, "type": "dragon", "size": "Huge", "ac": 19, "hp": 256, "hpDice": "19d12+133", "speed": 40, "tags": ["draconic", "dragon", "fire"] },
  { "name": "Sfinge del valore", "cr": 17, "xp": 18e3, "type": "monstrosity", "size": "Large", "ac": 17, "hp": 199, "hpDice": "19d10+95", "speed": 40, "tags": ["monstrosity"] },
  { "name": "Testuggine dragona", "cr": 17, "xp": 18e3, "type": "dragon", "size": "Gargantuan", "ac": 20, "hp": 356, "hpDice": "23d20+115", "speed": 20, "tags": ["draconic", "dragon"] },
  { "name": "Balor", "cr": 19, "xp": 22e3, "type": "fiend", "size": "Huge", "ac": 19, "hp": 287, "hpDice": "23d12+138", "speed": 40, "tags": ["demon", "fiend"] },
  { "name": "Diavolo della fossa", "cr": 20, "xp": 25e3, "type": "fiend", "size": "Large", "ac": 21, "hp": 337, "hpDice": "27d10+189", "speed": 30, "tags": ["devil", "fiend"] },
  { "name": "Drago bianco antico", "cr": 20, "xp": 25e3, "type": "dragon", "size": "Gargantuan", "ac": 20, "hp": 333, "hpDice": "18d20+144", "speed": 40, "tags": ["draconic", "dragon", "ice"] },
  { "name": "Drago d'ottone antico", "cr": 20, "xp": 25e3, "type": "dragon", "size": "Gargantuan", "ac": 20, "hp": 332, "hpDice": "19d20+133", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago di rame antico", "cr": 21, "xp": 33e3, "type": "dragon", "size": "Gargantuan", "ac": 21, "hp": 367, "hpDice": "21d20+147", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago nero antico", "cr": 21, "xp": 33e3, "type": "dragon", "size": "Gargantuan", "ac": 22, "hp": 367, "hpDice": "21d20+147", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Lich", "cr": 21, "xp": 33e3, "type": "undead", "size": "Medium", "ac": 20, "hp": 315, "hpDice": "42d8+126", "speed": 30, "tags": ["undead", "undead_theme"] },
  { "name": "Solar", "cr": 21, "xp": 33e3, "type": "celestial", "size": "Large", "ac": 21, "hp": 297, "hpDice": "22d10+176", "speed": 50, "tags": ["celestial", "celestial_theme"] },
  { "name": "Drago di bronzo antico", "cr": 22, "xp": 41e3, "type": "dragon", "size": "Gargantuan", "ac": 22, "hp": 444, "hpDice": "24d20+192", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago verde antico", "cr": 22, "xp": 41e3, "type": "dragon", "size": "Gargantuan", "ac": 21, "hp": 402, "hpDice": "23d20+161", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago blu antico", "cr": 23, "xp": 5e4, "type": "dragon", "size": "Gargantuan", "ac": 22, "hp": 481, "hpDice": "26d20+208", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago d'argento antico", "cr": 23, "xp": 5e4, "type": "dragon", "size": "Gargantuan", "ac": 22, "hp": 468, "hpDice": "24d20+216", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Kraken", "cr": 23, "xp": 5e4, "type": "monstrosity", "size": "Gargantuan", "ac": 18, "hp": 481, "hpDice": "26d20+208", "speed": 20, "tags": ["monstrosity"] },
  { "name": "Drago d'oro antico", "cr": 24, "xp": 62e3, "type": "dragon", "size": "Gargantuan", "ac": 22, "hp": 546, "hpDice": "28d20+252", "speed": 40, "tags": ["draconic", "dragon"] },
  { "name": "Drago rosso antico", "cr": 24, "xp": 62e3, "type": "dragon", "size": "Gargantuan", "ac": 22, "hp": 507, "hpDice": "26d20+234", "speed": 40, "tags": ["draconic", "dragon", "fire"] },
  { "name": "Tarrasque", "cr": 30, "xp": 155e3, "type": "monstrosity", "size": "Gargantuan", "ac": 25, "hp": 697, "hpDice": "34d20+340", "speed": 40, "tags": ["monstrosity"] }
];
var MAGIC_ITEMS = {
  common: [
    { "name": "Potion of Climbing", "cat": "Potion" },
    { "name": "Potion of Healing", "cat": "Potion" },
    { "name": "Spell Scroll (Cantrip)", "cat": "Scroll" },
    { "name": "Spell Scroll (1st)", "cat": "Scroll" }
  ],
  uncommon: [
    { "name": "Adamantine Armor", "cat": "Armor" },
    { "name": "Ammunition, +1, +2, or +3", "cat": "Ammunition" },
    { "name": "Ammunition, +1", "cat": "Ammunition" },
    { "name": "Amulet of Proof against Detection and Location", "cat": "Wondrous Items" },
    { "name": "Armor, +1, +2, or +3", "cat": "Armor" },
    { "name": "Bag of Holding", "cat": "Wondrous Items" },
    { "name": "Bag of Tricks", "cat": "Wondrous Items" },
    { "name": "Gray Bag of Tricks", "cat": "Wondrous Items" },
    { "name": "Rust Bag of Tricks", "cat": "Wondrous Items" },
    { "name": "Tan Bag of Tricks", "cat": "Wondrous Items" },
    { "name": "Belt of Giant Strength", "cat": "Wondrous Items" },
    { "name": "Boots of Elvenkind", "cat": "Wondrous Items" },
    { "name": "Boots of Striding and Springing", "cat": "Wondrous Items" },
    { "name": "Boots of the Winterlands", "cat": "Wondrous Items" },
    { "name": "Bracers of Archery", "cat": "Wondrous Items" },
    { "name": "Brooch of Shielding", "cat": "Wondrous Items" },
    { "name": "Broom of Flying", "cat": "Wondrous Items" },
    { "name": "Circlet of Blasting", "cat": "Wondrous Items" },
    { "name": "Cloak of Elvenkind", "cat": "Wondrous Items" },
    { "name": "Cloak of Protection", "cat": "Wondrous Items" },
    { "name": "Cloak of the Manta Ray", "cat": "Wondrous Items" },
    { "name": "Decanter of Endless Water", "cat": "Wondrous Items" },
    { "name": "Deck of Illusions", "cat": "Wondrous Items" },
    { "name": "Dust of Disappearance", "cat": "Wondrous Items" },
    { "name": "Dust of Dryness", "cat": "Wondrous Items" },
    { "name": "Dust of Sneezing and Choking", "cat": "Wondrous Items" },
    { "name": "Efficient Quiver", "cat": "Wondrous Items" },
    { "name": "Elemental Gem", "cat": "Wondrous Items" },
    { "name": "Air Elemental Gem", "cat": "Wondrous Items" },
    { "name": "Earth Elemental Gem", "cat": "Wondrous Items" },
    { "name": "Fire Elemental Gem", "cat": "Wondrous Items" },
    { "name": "Water Elemental Gem", "cat": "Wondrous Items" },
    { "name": "Eversmoking Bottle", "cat": "Wondrous Items" },
    { "name": "Eyes of Charming", "cat": "Wondrous Items" },
    { "name": "Eyes of Minute Seeing", "cat": "Wondrous Items" },
    { "name": "Eyes of the Eagle", "cat": "Wondrous Items" },
    { "name": "Figurine of Wondrous Power", "cat": "Wondrous Items" },
    { "name": "Silver Raven Figurine of Wondrous Power", "cat": "Wondrous Items" },
    { "name": "Gauntlets of Ogre Power", "cat": "Wondrous Items" },
    { "name": "Gem of Brightness", "cat": "Wondrous Items" },
    { "name": "Gloves of Missile Snaring", "cat": "Wondrous Items" },
    { "name": "Gloves of Swimming and Climbing", "cat": "Wondrous Items" },
    { "name": "Goggles of Night", "cat": "Wondrous Items" },
    { "name": "Hat of Disguise", "cat": "Wondrous Items" },
    { "name": "Headband of Intellect", "cat": "Wondrous Items" },
    { "name": "Helm of Comprehending Languages", "cat": "Wondrous Items" },
    { "name": "Helm of Telepathy", "cat": "Wondrous Items" },
    { "name": "Horn of Valhalla", "cat": "Wondrous Items" },
    { "name": "Immovable Rod", "cat": "Rod" },
    { "name": "Ioun Stone", "cat": "Wondrous Items" },
    { "name": "Javelin of Lightning", "cat": "Weapon" },
    { "name": "Lantern of Revealing", "cat": "Wondrous Items" },
    { "name": "Medallion of Thoughts", "cat": "Wondrous Items" },
    { "name": "Mithral Armor", "cat": "Armor" },
    { "name": "Necklace of Adaptation", "cat": "Wondrous Items" },
    { "name": "Oil of Slipperiness", "cat": "Potion" },
    { "name": "Pearl of Power", "cat": "Wondrous Items" },
    { "name": "Periapt of Health", "cat": "Wondrous Items" },
    { "name": "Periapt of Wound Closure", "cat": "Wondrous Items" },
    { "name": "Philter of Love", "cat": "Potion" },
    { "name": "Pipes of Haunting", "cat": "Wondrous Items" },
    { "name": "Pipes of the Sewers", "cat": "Wondrous Items" },
    { "name": "Potion of Animal Friendship", "cat": "Potion" },
    { "name": "Potion of Giant Strength", "cat": "Potion" },
    { "name": "Potion of Hill Giant Strength", "cat": "Potion" },
    { "name": "Potion of Growth", "cat": "Potion" },
    { "name": "Potion of Healing", "cat": "Potion" },
    { "name": "Potion of Greater Healing", "cat": "Potion" },
    { "name": "Potion of Poison", "cat": "Potion" },
    { "name": "Potion of Resistance", "cat": "Potion" },
    { "name": "Potion of Acid Resistance", "cat": "Potion" },
    { "name": "Potion of Cold Resistance", "cat": "Potion" },
    { "name": "Potion of Fire Resistance", "cat": "Potion" },
    { "name": "Potion of Force Resistance", "cat": "Potion" },
    { "name": "Potion of Lightning Resistance", "cat": "Potion" },
    { "name": "Potion of Necrotic Resistance", "cat": "Potion" },
    { "name": "Potion of Poison Resistance", "cat": "Potion" },
    { "name": "Potion of Psychic Resistance", "cat": "Potion" },
    { "name": "Potion of Radiant Resistance", "cat": "Potion" },
    { "name": "Potion of Thunder Resistance", "cat": "Potion" },
    { "name": "Potion of Water Breathing", "cat": "Potion" },
    { "name": "Restorative Ointment", "cat": "Wondrous Items" },
    { "name": "Ring of Jumping", "cat": "Ring" },
    { "name": "Ring of Mind Shielding", "cat": "Ring" },
    { "name": "Ring of Swimming", "cat": "Ring" },
    { "name": "Ring of Warmth", "cat": "Ring" },
    { "name": "Ring of Water Walking", "cat": "Ring" },
    { "name": "Robe of Useful Items", "cat": "Wondrous Items" },
    { "name": "Rope of Climbing", "cat": "Wondrous Items" },
    { "name": "Slippers of Spider Climbing", "cat": "Wondrous Items" },
    { "name": "Spell Scroll", "cat": "Scroll" },
    { "name": "Spell Scroll (2nd)", "cat": "Scroll" },
    { "name": "Spell Scroll (3rd)", "cat": "Scroll" },
    { "name": "Stone of Good Luck (Luckstone)", "cat": "Wondrous Items" },
    { "name": "Trident of Fish Command", "cat": "Weapon" },
    { "name": "Wand of Magic Detection", "cat": "Wand" },
    { "name": "Wand of Magic Missiles", "cat": "Wand" },
    { "name": "Wand of Secrets", "cat": "Wand" },
    { "name": "Wand of the War Mage, +1, +2, or +3", "cat": "Wand" },
    { "name": "Wand of the War Mage, +1", "cat": "Wand" },
    { "name": "Wand of Web", "cat": "Wand" },
    { "name": "Weapon, +1, +2, or +3", "cat": "Weapon" },
    { "name": "Weapon, +1", "cat": "Weapon" },
    { "name": "Wind Fan", "cat": "Wondrous Items" },
    { "name": "Winged Boots", "cat": "Wondrous Items" }
  ],
  rare: [
    { "name": "Ammunition, +2", "cat": "Ammunition" },
    { "name": "Amulet of Health", "cat": "Wondrous Items" },
    { "name": "Armor, +1", "cat": "Armor" },
    { "name": "Armor of Resistance", "cat": "Armor" },
    { "name": "Armor of Vulnerability", "cat": "Armor" },
    { "name": "Arrow-Catching Shield", "cat": "Armor" },
    { "name": "Bag of Beans", "cat": "Wondrous Items" },
    { "name": "Bead of Force", "cat": "Wondrous Items" },
    { "name": "Belt of Dwarvenkind", "cat": "Wondrous Items" },
    { "name": "Belt of Hill Giant Strength", "cat": "Wondrous Items" },
    { "name": "Berserker Axe", "cat": "Weapon" },
    { "name": "Boots of Levitation", "cat": "Wondrous Items" },
    { "name": "Boots of Speed", "cat": "Wondrous Items" },
    { "name": "Bowl of Commanding Water Elementals", "cat": "Wondrous Items" },
    { "name": "Bracers of Defense", "cat": "Wondrous Items" },
    { "name": "Brazier of Commanding Fire Elementals", "cat": "Wondrous Items" },
    { "name": "Cape of the Mountebank", "cat": "Wondrous Items" },
    { "name": "Censer of Controlling Air Elementals", "cat": "Wondrous Items" },
    { "name": "Chime of Opening", "cat": "Wondrous Items" },
    { "name": "Cloak of Displacement", "cat": "Wondrous Items" },
    { "name": "Cloak of the Bat", "cat": "Wondrous Items" },
    { "name": "Cube of Force", "cat": "Wondrous Items" },
    { "name": "Dagger of Venom", "cat": "Weapon" },
    { "name": "Dimensional Shackles", "cat": "Wondrous Items" },
    { "name": "Dragon Slayer", "cat": "Weapon" },
    { "name": "Elven Chain", "cat": "Armor" },
    { "name": "Feather Token", "cat": "Wondrous Items" },
    { "name": "Anchor Feather Token", "cat": "Wondrous Items" },
    { "name": "Bird Feather Token", "cat": "Wondrous Items" },
    { "name": "Fan Feather Token", "cat": "Wondrous Items" },
    { "name": "Swan Boat Feather Token", "cat": "Wondrous Items" },
    { "name": "Tree Feather Token", "cat": "Wondrous Items" },
    { "name": "Whip Feather Token", "cat": "Wondrous Items" },
    { "name": "Bronze Griffon Figurine of Wondrous Power", "cat": "Wondrous Items" },
    { "name": "Ebony Fly Figurine of Wondrous Power", "cat": "Wondrous Items" },
    { "name": "Golden Lions Figurine of Wondrous Power", "cat": "Wondrous Items" },
    { "name": "Ivory Goats Figurine of Wondrous Power", "cat": "Wondrous Items" },
    { "name": "Marble Elephant Figurine of Wondrous Power", "cat": "Wondrous Items" },
    { "name": "Onyx Dog Figurine of Wondrous Power", "cat": "Wondrous Items" },
    { "name": "Serpentine Owl Figurine of Wondrous Power", "cat": "Wondrous Items" },
    { "name": "Flame Tongue", "cat": "Weapon" },
    { "name": "Folding Boat", "cat": "Wondrous Items" },
    { "name": "Gem of Seeing", "cat": "Wondrous Items" },
    { "name": "Giant Slayer", "cat": "Weapon" },
    { "name": "Glamoured Studded Leather Armor", "cat": "Armor" },
    { "name": "Handy Haversack", "cat": "Wondrous Items" },
    { "name": "Helm of Teleportation", "cat": "Wondrous Items" },
    { "name": "Horn of Blasting", "cat": "Wondrous Items" },
    { "name": "Silver Horn of Valhalla", "cat": "Wondrous Items" },
    { "name": "Brass Horn of Valhalla", "cat": "Wondrous Items" },
    { "name": "Horseshoes of Speed", "cat": "Wondrous Items" },
    { "name": "Instant Fortress", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Awareness", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Protection", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Reserve", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Sustenance", "cat": "Wondrous Items" },
    { "name": "Iron Bands of Binding", "cat": "Wondrous Items" },
    { "name": "Mace of Disruption", "cat": "Weapon" },
    { "name": "Mace of Smiting", "cat": "Weapon" },
    { "name": "Mace of Terror", "cat": "Weapon" },
    { "name": "Mantle of Spell Resistance", "cat": "Wondrous Items" },
    { "name": "Necklace of Fireballs", "cat": "Wondrous Items" },
    { "name": "Necklace of Prayer Beads", "cat": "Wondrous Items" },
    { "name": "Oil of Etherealness", "cat": "Potion" },
    { "name": "Periapt of Proof against Poison", "cat": "Wondrous Items" },
    { "name": "Portable Hole", "cat": "Wondrous Items" },
    { "name": "Potion of Clairvoyance", "cat": "Potion" },
    { "name": "Potion of Diminution", "cat": "Potion" },
    { "name": "Potion of Gaseous Form", "cat": "Potion" },
    { "name": "Potion of Frost Giant Strength", "cat": "Potion" },
    { "name": "Potion of Stone Giant Strength", "cat": "Potion" },
    { "name": "Potion of Fire Giant Strength", "cat": "Potion" },
    { "name": "Potion of Superior Healing", "cat": "Potion" },
    { "name": "Potion of Heroism", "cat": "Potion" },
    { "name": "Potion of Mind Reading", "cat": "Potion" },
    { "name": "Ring of Animal Influence", "cat": "Ring" },
    { "name": "Ring of Evasion", "cat": "Ring" },
    { "name": "Ring of Feather Falling", "cat": "Ring" },
    { "name": "Ring of Free Action", "cat": "Ring" },
    { "name": "Ring of Protection", "cat": "Ring" },
    { "name": "Ring of Resistance", "cat": "Ring" },
    { "name": "Ring of Acid Resistance", "cat": "Ring" },
    { "name": "Ring of Cold Resistance", "cat": "Ring" },
    { "name": "Ring of Fire Resistance", "cat": "Ring" },
    { "name": "Ring of Force Resistance", "cat": "Ring" },
    { "name": "Ring of Lightning Resistance", "cat": "Ring" },
    { "name": "Ring of Necrotic Resistance", "cat": "Ring" },
    { "name": "Ring of Poison Resistance", "cat": "Ring" },
    { "name": "Ring of Psychic Resistance", "cat": "Ring" },
    { "name": "Ring of Radiant Resistance", "cat": "Ring" },
    { "name": "Ring of Thunder Resistance", "cat": "Ring" },
    { "name": "Ring of Spell Storing", "cat": "Ring" },
    { "name": "Ring of the Ram", "cat": "Ring" },
    { "name": "Ring of X-ray Vision", "cat": "Ring" },
    { "name": "Robe of Eyes", "cat": "Wondrous Items" },
    { "name": "Rod of Rulership", "cat": "Rod" },
    { "name": "Rope of Entanglement", "cat": "Wondrous Items" },
    { "name": "Shield of Missile Attraction", "cat": "Armor" },
    { "name": "Spell Scroll (4th)", "cat": "Scroll" },
    { "name": "Spell Scroll (5th)", "cat": "Scroll" },
    { "name": "Staff of Charming", "cat": "Staff" },
    { "name": "Staff of Healing", "cat": "Staff" },
    { "name": "Staff of the Woodlands", "cat": "Staff" },
    { "name": "Staff of Withering", "cat": "Staff" },
    { "name": "Stone of Controlling Earth Elementals", "cat": "Wondrous Items" },
    { "name": "Sun Blade", "cat": "Weapon" },
    { "name": "Sword of Life Stealing", "cat": "Weapon" },
    { "name": "Sword of Wounding", "cat": "Weapon" },
    { "name": "Vicious Weapon", "cat": "Weapon" },
    { "name": "Wand of Binding", "cat": "Wand" },
    { "name": "Wand of Enemy Detection", "cat": "Wand" },
    { "name": "Wand of Fear", "cat": "Wand" },
    { "name": "Wand of Fireballs", "cat": "Wand" },
    { "name": "Wand of Lightning Bolts", "cat": "Wand" },
    { "name": "Wand of Paralysis", "cat": "Wand" },
    { "name": "Wand of the War Mage, +2", "cat": "Wand" },
    { "name": "Wand of Wonder", "cat": "Wand" },
    { "name": "Weapon, +2", "cat": "Weapon" },
    { "name": "Wings of Flying", "cat": "Wondrous Items" }
  ],
  veryRare: [
    { "name": "Ammunition, +3", "cat": "Ammunition" },
    { "name": "Amulet of the Planes", "cat": "Wondrous Items" },
    { "name": "Animated Shield", "cat": "Armor" },
    { "name": "Armor, +2", "cat": "Armor" },
    { "name": "Arrow of Slaying", "cat": "Ammunition" },
    { "name": "Bag of Devouring", "cat": "Wondrous Items" },
    { "name": "Belt of Stone Giant Strength", "cat": "Wondrous Items" },
    { "name": "Belt of Frost Giant Strength", "cat": "Wondrous Items" },
    { "name": "Belt of Fire Giant Strength", "cat": "Wondrous Items" },
    { "name": "Candle of Invocation", "cat": "Wondrous Items" },
    { "name": "Carpet of Flying", "cat": "Wondrous Items" },
    { "name": "Carpet of Flying (3 ft. \xD7 5 ft.)", "cat": "Wondrous Items" },
    { "name": "Carpet of Flying (4 ft. \xD7 6 ft.)", "cat": "Wondrous Items" },
    { "name": "Carpet of Flying (5 ft. \xD7 7 ft.)", "cat": "Wondrous Items" },
    { "name": "Carpet of Flying (6 ft. \xD7 9 ft.)", "cat": "Wondrous Items" },
    { "name": "Cloak of Arachnida", "cat": "Wondrous Items" },
    { "name": "Crystal Ball", "cat": "Wondrous Items" },
    { "name": "Dancing Sword", "cat": "Weapon" },
    { "name": "Demon Armor", "cat": "Armor" },
    { "name": "Dragon Scale Mail", "cat": "Armor" },
    { "name": "Black Dragon Scale Mail", "cat": "Armor" },
    { "name": "Blue Dragon Scale Mail", "cat": "Armor" },
    { "name": "Brass Dragon Scale Mail", "cat": "Armor" },
    { "name": "Bronze Dragon Scale Mail", "cat": "Armor" },
    { "name": "Copper Dragon Scale Mail", "cat": "Armor" },
    { "name": "Gold Dragon Scale Mail", "cat": "Armor" },
    { "name": "Green Dragon Scale Mail", "cat": "Armor" },
    { "name": "Red Dragon Scale Mail", "cat": "Armor" },
    { "name": "Silver Dragon Scale Mail", "cat": "Armor" },
    { "name": "White Dragon Scale Mail", "cat": "Armor" },
    { "name": "Dwarven Plate", "cat": "Armor" },
    { "name": "Dwarven Thrower", "cat": "Weapon" },
    { "name": "Efreeti Bottle", "cat": "Wondrous Items" },
    { "name": "Obsidian Steed Figurine of Wondrous Power", "cat": "Wondrous Items" },
    { "name": "Frost Brand", "cat": "Weapon" },
    { "name": "Helm of Brilliance", "cat": "Wondrous Items" },
    { "name": "Bronze Horn of Valhalla", "cat": "Wondrous Items" },
    { "name": "Horseshoes of a Zephyr", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Absorption", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Agility", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Fortitude", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Insight", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Intellect", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Leadership", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Strength", "cat": "Wondrous Items" },
    { "name": "Manual of Bodily Health", "cat": "Wondrous Items" },
    { "name": "Manual of Gainful Exercise", "cat": "Wondrous Items" },
    { "name": "Manual of Golems", "cat": "Wondrous Items" },
    { "name": "Manual of Clay Golems", "cat": "Wondrous Items" },
    { "name": "Manual of Flesh Golems", "cat": "Wondrous Items" },
    { "name": "Manual of Iron Golems", "cat": "Wondrous Items" },
    { "name": "Manual of Stone Golems", "cat": "Wondrous Items" },
    { "name": "Manual of Quickness of Action", "cat": "Wondrous Items" },
    { "name": "Marvelous Pigments", "cat": "Wondrous Items" },
    { "name": "Mirror of Life Trapping", "cat": "Wondrous Items" },
    { "name": "Nine Lives Stealer", "cat": "Weapon" },
    { "name": "Oathbow", "cat": "Weapon" },
    { "name": "Oil of Sharpness", "cat": "Potion" },
    { "name": "Potion of Flying", "cat": "Potion" },
    { "name": "Potion of Cloud Giant Strength", "cat": "Potion" },
    { "name": "Potion of Supreme Healing", "cat": "Potion" },
    { "name": "Potion of Invisibility", "cat": "Potion" },
    { "name": "Potion of Speed", "cat": "Potion" },
    { "name": "Ring of Regeneration", "cat": "Ring" },
    { "name": "Ring of Shooting Stars", "cat": "Ring" },
    { "name": "Ring of Telekinesis", "cat": "Ring" },
    { "name": "Robe of Scintillating Colors", "cat": "Wondrous Items" },
    { "name": "Robe of Stars", "cat": "Wondrous Items" },
    { "name": "Rod of Absorption", "cat": "Rod" },
    { "name": "Rod of Alertness", "cat": "Rod" },
    { "name": "Rod of Security", "cat": "Rod" },
    { "name": "Scimitar of Speed", "cat": "Weapon" },
    { "name": "Spell Scroll (6th)", "cat": "Scroll" },
    { "name": "Spell Scroll (7th)", "cat": "Scroll" },
    { "name": "Spell Scroll (8th)", "cat": "Scroll" },
    { "name": "Spellguard Shield", "cat": "Armor" },
    { "name": "Staff of Fire", "cat": "Staff" },
    { "name": "Staff of Frost", "cat": "Staff" },
    { "name": "Staff of Power", "cat": "Staff" },
    { "name": "Staff of Striking", "cat": "Staff" },
    { "name": "Staff of Swarming Insects", "cat": "Staff" },
    { "name": "Staff of the Python", "cat": "Staff" },
    { "name": "Staff of Thunder and Lightning", "cat": "Staff" },
    { "name": "Sword of Sharpness", "cat": "Weapon" },
    { "name": "Tome of Clear Thought", "cat": "Wondrous Items" },
    { "name": "Tome of Leadership and Influence", "cat": "Wondrous Items" },
    { "name": "Tome of Understanding", "cat": "Wondrous Items" },
    { "name": "Wand of Polymorph", "cat": "Wand" },
    { "name": "Wand of the War Mage, +3", "cat": "Wand" },
    { "name": "Weapon, +3", "cat": "Weapon" }
  ],
  legendary: [
    { "name": "Apparatus of the Crab", "cat": "Wondrous Items" },
    { "name": "Armor, +3", "cat": "Armor" },
    { "name": "Armor of Invulnerability", "cat": "Armor" },
    { "name": "Belt of Cloud Giant Strength", "cat": "Wondrous Items" },
    { "name": "Belt of Storm Giant Strength", "cat": "Wondrous Items" },
    { "name": "Crystal Ball of Mind Reading", "cat": "Wondrous Items" },
    { "name": "Crystal Ball of Telepathy", "cat": "Wondrous Items" },
    { "name": "Crystal Ball of True Seeing", "cat": "Wondrous Items" },
    { "name": "Cubic Gate", "cat": "Wondrous Items" },
    { "name": "Deck of Many Things", "cat": "Wondrous Items" },
    { "name": "Defender", "cat": "Weapon" },
    { "name": "Hammer of Thunderbolts", "cat": "Weapon" },
    { "name": "Holy Avenger", "cat": "Weapon" },
    { "name": "Iron Horn of Valhalla", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Greater Absorption", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Mastery", "cat": "Wondrous Items" },
    { "name": "Ioun Stone of Regeneration", "cat": "Wondrous Items" },
    { "name": "Iron Flask", "cat": "Wondrous Items" },
    { "name": "Luck Blade", "cat": "Weapon" },
    { "name": "Plate Armor of Etherealness", "cat": "Armor" },
    { "name": "Potion of Storm Giant Strength", "cat": "Potion" },
    { "name": "Ring of Djinni Summoning", "cat": "Ring" },
    { "name": "Ring of Elemental Command", "cat": "Ring" },
    { "name": "Ring of Air Elemental Command", "cat": "Ring" },
    { "name": "Ring of Earth Elemental Command", "cat": "Ring" },
    { "name": "Ring of Fire Elemental Command", "cat": "Ring" },
    { "name": "Ring of Water Elemental Command", "cat": "Ring" },
    { "name": "Ring of Invisibility", "cat": "Ring" },
    { "name": "Ring of Spell Turning", "cat": "Ring" },
    { "name": "Ring of Three Wishes", "cat": "Ring" },
    { "name": "Robe of the Archmagi", "cat": "Wondrous Items" },
    { "name": "Rod of Lordly Might", "cat": "Rod" },
    { "name": "Scarab of Protection", "cat": "Wondrous Items" },
    { "name": "Sovereign Glue", "cat": "Wondrous Items" },
    { "name": "Spell Scroll (9th)", "cat": "Scroll" },
    { "name": "Sphere of Annihilation", "cat": "Wondrous Items" },
    { "name": "Staff of the Magi", "cat": "Staff" },
    { "name": "Talisman of Pure Good", "cat": "Wondrous Items" },
    { "name": "Talisman of the Sphere", "cat": "Wondrous Items" },
    { "name": "Talisman of Ultimate Evil", "cat": "Wondrous Items" },
    { "name": "Universal Solvent", "cat": "Wondrous Items" },
    { "name": "Vorpal Sword", "cat": "Weapon" },
    { "name": "Well of Many Worlds", "cat": "Wondrous Items" }
  ]
};
export {
  MAGIC_ITEMS,
  MONSTERS,
  THEMES,
  exportForRunebog,
  generateDungeon
};

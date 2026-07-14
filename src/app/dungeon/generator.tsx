"use client";

/* UI del generatore di dungeon. Il motore (puro) sta in @/lib/dungeon/engine:
   qui solo stato dei controlli e resa di mappa e stanze. I colori vengono dai
   token di themes.css, così il generatore segue i cinque temi come il resto. */

import * as React from "react";
import {
  generateDungeon, exportForRunebog, crLabel, lootTotalGp, lootEmpty, THEMES,
  type Difficulty, type Dungeon, type Encounter as Enc, type Loot as LootT,
  type Rarity, type Room, type RoomType, type Ruleset, type ThemeKey, type Trap,
} from "@/lib/dungeon/engine";
import { MONSTERS, MAGIC_ITEMS } from "@/lib/dungeon/srd-data";

const RARITY_COLOR: Record<Rarity, string> = {
  common: "var(--parchment-mute)",
  uncommon: "var(--moss)",
  rare: "var(--wisp)",
  veryRare: "var(--arcane)",
  legendary: "var(--lantern)",
};
const RARITY_LABEL: Record<Rarity, string> = {
  common: "comune", uncommon: "non comune", rare: "raro", veryRare: "molto raro", legendary: "leggendario",
};
const ROOM_META: Record<RoomType, { color: string; label: string }> = {
  ingresso: { color: "var(--wisp)", label: "Ingresso" },
  combattimento: { color: "var(--parchment-dim)", label: "Combattimento" },
  tesoro: { color: "var(--lantern)", label: "Tesoro" },
  trappola: { color: "var(--dg-trap)", label: "Trappola" },
  enigma: { color: "var(--arcane)", label: "Enigma" },
  riposo: { color: "var(--moss)", label: "Riposo" },
  tana: { color: "var(--dg-lair)", label: "Tana" },
  vuota: { color: "var(--parchment-mute)", label: "Vuota" },
  boss: { color: "var(--ember)", label: "Boss" },
};
const SIZE_IT: Record<string, string> = { Tiny: "Minuscola", Small: "Piccola", Medium: "Media", Large: "Grande", Huge: "Enorme", Gargantuan: "Mastodontica" };
const sizeIt = (s: string) => SIZE_IT[s] || s;
const meters = (q: number) => ((q * 1.5).toFixed(1)).replace(".", ",");
// Trasparenza su un token: non si può concatenare l'alfa a un var(), serve color-mix.
const faded = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

const DEFAULT_SEED = 424242;
const DEFAULT_PARAMS = {
  seed: DEFAULT_SEED, name: "Le Cripte di Vaelthorn", roomCount: 11,
  theme: "nonmorti" as ThemeKey, level: 6, partySize: 4,
  difficulty: "difficile" as Difficulty, ruleset: "2014" as Ruleset,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
    </label>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max ? (value / max) * 100 : 0;
  const col = pct > 110 ? "var(--ember)" : pct > 90 ? "var(--lantern)" : "var(--moss)";
  return (
    <div className="dg-bar">
      <div className="dg-bar__fill" style={{ width: Math.min(100, pct) + "%", background: col }} />
    </div>
  );
}

function DungeonMap({ dungeon, selectedId, onSelect }: { dungeon: Dungeon; selectedId: number | null; onSelect: (id: number) => void }) {
  const C = 16;
  const { gridW, gridH, grid, rooms } = dungeon;
  const corr: [number, number][] = [], doors: [number, number][] = [];
  for (let y = 0; y < gridH; y++)
    for (let x = 0; x < gridW; x++) {
      const v = grid[y][x];
      if (v === 2) corr.push([x, y]); else if (v === 3) doors.push([x, y]);
    }
  return (
    <svg viewBox={`0 0 ${gridW * C} ${gridH * C}`} className="dg-svg" role="img" aria-label="Mappa del dungeon">
      <defs>
        <pattern id="dg-grid" width={C} height={C} patternUnits="userSpaceOnUse">
          <path d={`M ${C} 0 L 0 0 0 ${C}`} fill="none" stroke="var(--edge-soft)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={gridW * C} height={gridH * C} fill="var(--peat-sunk)" />
      {corr.map(([x, y], i) => <rect key={"c" + i} x={x * C} y={y * C} width={C} height={C} fill="var(--surface-hov)" />)}
      {rooms.map((rm) => {
        const m = ROOM_META[rm.type];
        const sel = rm.id === selectedId;
        return (
          <g key={rm.id} className="dg-svgroom" onClick={() => onSelect(rm.id)}>
            <title>{`#${rm.index} ${m.label}: ${rm.label}`}</title>
            <rect x={rm.x * C} y={rm.y * C} width={rm.w * C} height={rm.h * C}
                  fill={m.color} fillOpacity={sel ? 0.34 : 0.18}
                  stroke={m.color} strokeWidth={sel ? 3 : 1.6} />
          </g>
        );
      })}
      {doors.map(([x, y], i) => (
        <rect key={"d" + i} x={x * C + C * 0.15} y={y * C + C * 0.15} width={C * 0.7} height={C * 0.7}
              fill="var(--parchment)" stroke="var(--lantern)" />
      ))}
      <rect x="0" y="0" width={gridW * C} height={gridH * C} fill="url(#dg-grid)" pointerEvents="none" />
      {rooms.map((rm) => {
        const cx = (rm.x + rm.w / 2) * C, cy = (rm.y + rm.h / 2) * C;
        const hasEnc = !!rm.encounter, hasLoot = rm.loot && !lootEmpty(rm.loot), hasTrap = rm.traps.length > 0;
        return (
          <g key={"l" + rm.id} pointerEvents="none">
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fill="var(--parchment)"
                  fontSize={Math.min(rm.w, rm.h) >= 4 ? 15 : 12} fontWeight="700"
                  style={{ fontFamily: "ui-monospace, monospace" }}>{rm.index}</text>
            {hasEnc && <circle cx={rm.x * C + 7} cy={rm.y * C + 7} r="4" fill="var(--ember)" />}
            {hasLoot && <circle cx={(rm.x + rm.w) * C - 7} cy={rm.y * C + 7} r="4" fill="var(--lantern)" />}
            {hasTrap && <polygon points={`${rm.x * C + 7},${(rm.y + rm.h) * C - 4} ${rm.x * C + 3},${(rm.y + rm.h) * C - 11} ${rm.x * C + 11},${(rm.y + rm.h) * C - 11}`} fill="var(--dg-trap)" />}
          </g>
        );
      })}
    </svg>
  );
}

const LEGEND_MARKERS: [string, string][] = [["var(--ember)", "incontro"], ["var(--lantern)", "bottino"], ["var(--dg-trap)", "trappola"]];
function Legend() {
  return (
    <div className="dg-legend">
      {(Object.entries(ROOM_META) as [RoomType, { color: string; label: string }][]).map(([k, m]) => (
        <span key={k} className="dg-legend__item">
          <span className="dg-legend__dot" style={{ background: faded(m.color, 18), borderColor: m.color }} />
          {m.label}
        </span>
      ))}
      <span className="dg-legend__break" />
      {LEGEND_MARKERS.map(([c, l]) => (
        <span key={l} className="dg-legend__item">
          <span className="dg-legend__dot dg-legend__dot--round" style={{ background: c, borderColor: c }} />
          {l}
        </span>
      ))}
      <span className="dg-legend__item">
        <span className="dg-legend__dot" style={{ background: "var(--parchment)", borderColor: "var(--lantern)" }} />
        porta
      </span>
    </div>
  );
}

function CoinsLine({ c }: { c: LootT["coins"] }) {
  const p: string[] = [];
  if (c.pp) p.push(c.pp + " mp");
  if (c.gp) p.push(c.gp + " mo");
  if (c.sp) p.push(c.sp + " ma");
  if (c.cp) p.push(c.cp + " mr");
  return <span>{p.length ? p.join(" · ") : "nessuna moneta"}</span>;
}

function EncounterView({ enc }: { enc: Enc }) {
  const total = enc.groups.reduce((s, g) => s + g.count, 0);
  return (
    <div className="dg-sec">
      <div className="dg-sec__h" style={{ color: "var(--ember)" }}>
        Incontro · {enc.adjXP} XP <span className="muted">(budget {enc.budget})</span>
      </div>
      <Bar value={enc.adjXP} max={enc.budget} />
      <ul className="dg-list">
        {enc.groups.map((g, i) => (
          <li key={i}>
            <b>{g.count}×</b> {g.mon.name}{" "}
            <span className="muted">— GS {crLabel(g.mon.cr)} · PF {g.mon.hp} ({g.mon.hpDice || "—"}) · CA {g.mon.ac} · {sizeIt(g.mon.size)} · {g.mon.xp} XP</span>
          </li>
        ))}
      </ul>
      <div className="muted small">{total} creature · {enc.rawXP} XP grezzi</div>
    </div>
  );
}

function LootView({ loot }: { loot: LootT }) {
  return (
    <div className="dg-sec">
      <div className="dg-sec__h" style={{ color: "var(--lantern)" }}>Bottino · {lootTotalGp(loot)} mo totali</div>
      <div className="muted"><CoinsLine c={loot.coins} /></div>
      {loot.gems.length > 0 && <div className="dg-tags">{loot.gems.map((g, i) => <span key={i} className="dg-tag">{g.value} mo · {g.name}</span>)}</div>}
      {loot.art.length > 0 && <div className="dg-tags">{loot.art.map((a, i) => <span key={i} className="dg-tag">{a.value} mo · {a.name}</span>)}</div>}
      {loot.magic.length > 0 && (
        <div className="dg-tags">
          {loot.magic.map((mi, i) => (
            <span key={i} className="dg-tag" style={{ borderColor: RARITY_COLOR[mi.rarity], color: RARITY_COLOR[mi.rarity] }}>
              {mi.name} ({RARITY_LABEL[mi.rarity]})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TrapsView({ traps }: { traps: Trap[] }) {
  return (
    <div className="dg-sec">
      <div className="dg-sec__h" style={{ color: "var(--dg-trap)" }}>Trappole</div>
      <ul className="dg-list">
        {traps.map((t, i) => (
          <li key={i}>
            <b>{t.name}</b>{" "}
            <span className="muted">— CD {t.dc} {t.save}{t.damage && t.damage !== "0" ? ` · ${t.damage} ${t.damageType}` : ""}. {t.effect}.</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeaturesView({ features }: { features: string[] }) {
  return (
    <div className="dg-sec">
      <div className="dg-sec__h muted">Dettagli d’ambiente</div>
      <ul className="dg-list">{features.map((f, i) => <li key={i} className="muted">{f}</li>)}</ul>
    </div>
  );
}

function RoomCard({ room, selected, onSelect, ref }: { room: Room; selected: boolean; onSelect: (id: number) => void; ref?: React.Ref<HTMLDivElement> }) {
  const m = ROOM_META[room.type];
  return (
    <div ref={ref} className={"dg-card" + (selected ? " dg-card--sel" : "")} style={{ borderLeftColor: m.color }} onClick={() => onSelect(room.id)}>
      <div className="dg-card__head">
        <span className="dg-card__idx">#{room.index}</span>
        <span className="dg-badge" style={{ color: m.color, borderColor: m.color }}>{m.label}</span>
        <span className="dg-card__name">{room.label}</span>
      </div>
      <div className="muted small">{room.w}×{room.h} quadrati · {meters(room.w)}×{meters(room.h)} m · pos ({room.x},{room.y})</div>
      <p className="dg-card__desc">{room.description}</p>
      {room.encounter && <EncounterView enc={room.encounter} />}
      {room.loot && !lootEmpty(room.loot) && <LootView loot={room.loot} />}
      {room.traps.length > 0 && <TrapsView traps={room.traps} />}
      {room.features.length > 0 && <FeaturesView features={room.features} />}
    </div>
  );
}

export default function DungeonGenerator() {
  const [name, setName] = React.useState(DEFAULT_PARAMS.name);
  const [level, setLevel] = React.useState(String(DEFAULT_PARAMS.level));
  const [partySize, setPartySize] = React.useState(String(DEFAULT_PARAMS.partySize));
  const [difficulty, setDifficulty] = React.useState<Difficulty>(DEFAULT_PARAMS.difficulty);
  const [ruleset, setRuleset] = React.useState<Ruleset>(DEFAULT_PARAMS.ruleset);
  const [theme, setTheme] = React.useState<ThemeKey>(DEFAULT_PARAMS.theme);
  const [roomCount, setRoomCount] = React.useState(String(DEFAULT_PARAMS.roomCount));
  const [seed, setSeed] = React.useState(String(DEFAULT_PARAMS.seed));
  // Il motore è deterministico, quindi il primo dungeon si genera già in SSR:
  // la pagina arriva piena, e all'idratazione lo stesso seed rifà gli stessi byte.
  const [dungeon, setDungeon] = React.useState<Dungeon>(() => generateDungeon(DEFAULT_PARAMS, MONSTERS, MAGIC_ITEMS));
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [copied, setCopied] = React.useState(false);
  const roomRefs = React.useRef<Record<number, HTMLDivElement | null>>({});

  const build = (useSeed?: number) => {
    const s = Number.isFinite(useSeed) ? (useSeed as number) : Number(seed) || 1;
    const d = generateDungeon({
      seed: s, name,
      roomCount: clamp(Number(roomCount) || 11, 6, 16),
      theme,
      level: clamp(Number(level) || 1, 1, 20),
      partySize: clamp(Number(partySize) || 4, 1, 8),
      difficulty, ruleset,
    }, MONSTERS, MAGIC_ITEMS);
    setDungeon(d);
    setSelectedId(null);
  };

  const exportObj = React.useMemo(() => exportForRunebog(dungeon), [dungeon]);

  function randomize() {
    const ns = Math.floor(Math.random() * 1e9);
    setSeed(String(ns));
    build(ns);
  }
  function copyJSON() {
    const t = JSON.stringify(exportObj, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(t)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })
        .catch(() => {});
    }
  }
  function downloadJSON() {
    const t = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([t], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (name || "dungeon").replace(/\s+/g, "_") + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  function selectRoom(id: number) {
    setSelectedId(id);
    roomRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const sum = exportObj.summary;

  return (
    <div className="dg-layout">
      <aside className="dg-controls card">
        <Field label="Nome del dungeon">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="dg-row">
          <Field label="Livello party">
            <input className="input" type="number" min="1" max="20" value={level} onChange={(e) => setLevel(e.target.value)} />
          </Field>
          <Field label="N° PG">
            <input className="input" type="number" min="1" max="8" value={partySize} onChange={(e) => setPartySize(e.target.value)} />
          </Field>
        </div>
        <Field label="Difficoltà base">
          <select className="input" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            <option value="facile">Facile</option>
            <option value="medio">Medio</option>
            <option value="difficile">Difficile</option>
            <option value="mortale">Mortale</option>
          </select>
        </Field>
        <div className="field">
          <span className="field__label">Sistema budget XP</span>
          <div className="tabs dg-tabs" role="tablist">
            <button role="tab" className="tab" aria-selected={ruleset === "2014"} onClick={() => setRuleset("2014")}>2014 (moltiplic.)</button>
            <button role="tab" className="tab" aria-selected={ruleset === "2024"} onClick={() => setRuleset("2024")}>2024 (budget)</button>
          </div>
        </div>
        <Field label="Tema / bestiario">
          <select className="input" value={theme} onChange={(e) => setTheme(e.target.value as ThemeKey)}>
            {Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
          </select>
        </Field>
        <Field label={`Numero di stanze: ${roomCount}`}>
          <input className="dg-range" type="range" min="6" max="16" value={roomCount} onChange={(e) => setRoomCount(e.target.value)} />
        </Field>
        <Field label="Seed (riproducibile)">
          <div className="dg-row">
            <input className="input" type="number" value={seed} onChange={(e) => setSeed(e.target.value)} />
            <button type="button" className="btn dg-dice" title="Seed casuale" onClick={randomize}>⚄</button>
          </div>
        </Field>
        <div className="dg-actions">
          <button type="button" className="btn btn--primary btn--block" onClick={() => build()}>Genera dungeon</button>
          <button type="button" className="btn btn--block" onClick={copyJSON}>
            {copied ? <span className="dg-copied">✓ Copiato negli appunti</span> : "Copia JSON (Runebog)"}
          </button>
          <button type="button" className="btn btn--block" onClick={downloadJSON}>Scarica .json</button>
        </div>
        <p className="muted small dg-note">
          Poi, nell’app: apri la campagna, pannello del livello →{" "}
          <strong>Incolla dungeon</strong>. Il dungeon diventa una bolla con le stanze
          sulla pianta, gli incontri pronti per il tracking PF e i tuoi PG come
          pedine all’ingresso. (Schema <code>runebog-dungeon-generator v1.1</code>.)
        </p>
      </aside>

      <main className="dg-main">
        <section className="dg-mapwrap card">
          <DungeonMap dungeon={dungeon} selectedId={selectedId} onSelect={selectRoom} />
          <Legend />
        </section>
        <section className="dg-summary card">
          <div className="dg-stat"><div className="dg-stat__v">{sum.totalRooms}</div><div className="dg-stat__k">Stanze</div></div>
          <div className="dg-stat"><div className="dg-stat__v">{sum.monsterCount}</div><div className="dg-stat__k">Creature</div></div>
          <div className="dg-stat"><div className="dg-stat__v">{sum.totalAdjustedXP.toLocaleString("it")}</div><div className="dg-stat__k">XP (rettif.)</div></div>
          <div className="dg-stat"><div className="dg-stat__v">{sum.totalLootGp.toLocaleString("it")}</div><div className="dg-stat__k">mo bottino</div></div>
          <div className="dg-stat"><div className="dg-stat__v">{dungeon.gridW}×{dungeon.gridH}</div><div className="dg-stat__k">Griglia (quadrati)</div></div>
          <div className="dg-stat"><div className="dg-stat__v">{dungeon.seed}</div><div className="dg-stat__k">Seed</div></div>
        </section>
        <section className="dg-rooms">
          {dungeon.rooms.map((rm) => (
            <RoomCard key={rm.id}
                      ref={(el) => { roomRefs.current[rm.id] = el; }}
                      room={rm} selected={rm.id === selectedId} onSelect={setSelectedId} />
          ))}
        </section>
      </main>
    </div>
  );
}

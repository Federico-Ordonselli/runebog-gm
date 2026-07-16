/* Schede mostro (D&D 5e SRD): la scheda combattimento dentro il pannello,
   i nemici coi PF, la ricerca nel bestiario (window.SRD_MONSTERS, caricato
   da srd-mostri.js) e il tiradadi. */

import { uid, escapeHtml, escapeAttr } from "./modello.js";
import { findNode, save } from "./stato.js";
import { renderDetail, editNode, secOpen } from "./pannello.js";

const ABILITIES = [["str","FOR"],["dex","DES"],["con","COS"],["int","INT"],["wis","SAG"],["cha","CAR"]];
const abMod = v => { const m = Math.floor(((+v||10)-10)/2); return (m>=0?"+":"")+m; };

// Token, non hex fissi: i vecchi valori di Torbiera sulla carta di Pergamena
// scendevano a 1.5:1 e la barra spariva. La soglia resta accompagnata dal
// numero PF accanto: il colore non è mai l'unica informazione.
const hpColor = pct => pct>50 ? "var(--fen)" : pct>25 ? "var(--gold)" : "var(--ember)";

export function newFoe(name="Nemico", hp=10){ return {id:uid(), name, hp, hpMax:hp}; }
function ensureMon(n){
  if(!n.monster) n.monster = {};
  const m = n.monster;
  // migrazione dal vecchio formato Dungeon World
  if(m.kind!==undefined && m.meta===undefined){
    m.meta = m.kind || "";
    m.traits = m.special || "";
    m.actions = [m.actions, (m.moves||"")].filter(Boolean).join("\n");
  }
  const defaults = {meta:"", ac:"", speed:"", str:10, dex:10, con:10, int:10, wis:10, cha:10,
    saves:"", skills:"", resist:"", senses:"", langs:"", cr:"", traits:"", actions:"", legendary:"",
    hpDefault:10, foes:[]};
  for(const k in defaults) if(m[k]===undefined) m[k]=defaults[k];
  return m;
}
export function editMon(id, key, val){
  const n = findNode(id); if(!n) return;
  ensureMon(n)[key] = val;
  save();
}
export function addFoe(id){
  const n = findNode(id); if(!n) return;
  const m = ensureMon(n);
  const base = m.foes[m.foes.length-1];
  const f = newFoe(n.title||"Nemico", base ? base.hpMax : (m.hpDefault||10));
  if(base){
    f.name = base.name.replace(/\s*\d+$/,"") + " " + (m.foes.length+1);
    if(m.foes.length===1 && !/\d$/.test(m.foes[0].name)) m.foes[0].name += " 1";
  }
  m.foes.push(f);
  save(); renderDetail();
}
export function editFoe(id, foeId, key, val){
  const n = findNode(id); if(!n||!n.monster) return;
  const f = n.monster.foes.find(x=>x.id===foeId); if(!f) return;
  f[key] = val;
  if(key==="hpMax" && f.hp>val) f.hp = val;
  save();
  if(key==="hp"||key==="hpMax") renderFoeHP(id, foeId);
}
export function bumpFoeHP(id, foeId, delta){
  const n = findNode(id); if(!n||!n.monster) return;
  const f = n.monster.foes.find(x=>x.id===foeId); if(!f) return;
  f.hp = Math.max(0, Math.min(f.hpMax, f.hp+delta));
  save(); renderFoeHP(id, foeId);
}
export function removeFoe(id, foeId){
  const n = findNode(id); if(!n||!n.monster) return;
  n.monster.foes = n.monster.foes.filter(x=>x.id!==foeId);
  save(); renderDetail();
}
function renderFoeHP(id, foeId){
  const f = findNode(id)?.monster?.foes.find(x=>x.id===foeId); if(!f) return;
  const wrap = document.querySelector(`[data-foehp="${foeId}"]`); if(!wrap) return;
  const pct = f.hpMax ? Math.round(100*f.hp/f.hpMax) : 0;
  const col = hpColor(pct);
  wrap.querySelector(".hpbar-fill").style.width = pct+"%";
  wrap.querySelector(".hpbar-fill").style.background = col;
  const num = wrap.querySelector(".hp-now"); if(num) num.value = f.hp;
  const g = wrap.closest(".foe-card"); if(g) g.classList.toggle("dead", f.hp<=0);
  // aggiorno anche l'intestazione (vivi / PF totali) senza ridisegnare tutto
  const m = findNode(id)?.monster;
  const head = document.querySelector(".foe-head span");
  if(m && head && m.foes.length>1){
    const alive = m.foes.filter(x=>x.hp>0).length;
    const total = m.foes.reduce((s,x)=>s+x.hp,0);
    head.textContent = `${alive}/${m.foes.length} in vita · ${total} PF totali`;
  }
}

/* --- ricerca nel bestiario SRD --- */
export function srdSearch(id, q){
  const box = document.getElementById("srd-results"); if(!box) return;
  q = (q||"").trim().toLowerCase();
  if(q.length<2 || !window.SRD_MONSTERS){ box.classList.remove("show"); return; }
  const hits = window.SRD_MONSTERS.filter(m=>m.name.toLowerCase().includes(q)).slice(0,8);
  if(!hits.length){ box.classList.remove("show"); return; }
  box.innerHTML = hits.map(m=>{
    const i = window.SRD_MONSTERS.indexOf(m);
    return `<button onclick="applySRD('${id}',${i})">${escapeHtml(m.name)}
      <span class="srd-cr">GS ${escapeHtml(m.cr)}</span></button>`;
  }).join("");
  box.classList.add("show");
}
export function applySRD(id, idx){
  const n = findNode(id); if(!n) return;
  const s = window.SRD_MONSTERS[idx]; if(!s) return;
  const m = ensureMon(n);
  Object.assign(m, {
    meta:s.meta, ac:s.ac, speed:s.speed,
    str:s.str, dex:s.dex, con:s.con, int:s.int, wis:s.wis, cha:s.cha,
    saves:s.saves, skills:s.skills, resist:s.resist, senses:s.senses,
    langs:s.langs, cr:s.cr, traits:s.traits, actions:s.actions, legendary:s.legendary,
    hpDefault:s.hp
  });
  if(!m.foes.length) m.foes.push(newFoe(s.name, s.hp));
  else m.foes.forEach(f=>{ f.hpMax = s.hp; f.hp = Math.min(f.hp, s.hp) || s.hp; });
  if(!n.title) editNode(id, "title", s.name);
  save(); renderDetail();
}

/* --- tiradadi --- */
export function rollDice(expr){
  const m = String(expr).trim().match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/i);
  const out = document.getElementById("dice-out"); if(!out) return;
  if(!m){ out.textContent = "formato: 2d6+3"; return; }
  const n = Math.min(50, +m[1]||1), faces = +m[2], mod = m[3]? +m[3].replace(/\s/g,"") : 0;
  const rolls = Array.from({length:n}, ()=>1+Math.floor(Math.random()*faces));
  const tot = rolls.reduce((a,b)=>a+b,0)+mod;
  out.innerHTML = `<b>${tot}</b> <span class="dice-detail">(${rolls.join("+")}${mod? (mod>0?"+":"")+mod:""})</span>`;
}

function foeCard(nodeId, f){
  const pct = f.hpMax ? Math.round(100*f.hp/f.hpMax) : 0;
  const col = hpColor(pct);
  return `<div class="foe-card ${f.hp<=0?"dead":""}">
    <div class="foe-top">
      <input class="foe-name" value="${escapeAttr(f.name)}" oninput="editFoe('${nodeId}','${f.id}','name',this.value)" placeholder="Nome">
      <button class="btn tiny danger" title="Rimuovi" onclick="removeFoe('${nodeId}','${f.id}')">✕</button>
    </div>
    <div class="foe-hp" data-foehp="${f.id}">
      <button class="btn tiny" onclick="bumpFoeHP('${nodeId}','${f.id}',-1)">−</button>
      <div class="hpbar"><div class="hpbar-fill" style="width:${pct}%;background:${col}"></div></div>
      <input class="hp-now" type="number" value="${f.hp}" min="0" max="${f.hpMax}"
        onchange="editFoe('${nodeId}','${f.id}','hp',Math.max(0,Math.min(${f.hpMax},parseInt(this.value)||0)))">
      <span class="hp-sep">/</span>
      <input class="hp-max" type="number" value="${f.hpMax}" min="1"
        onchange="editFoe('${nodeId}','${f.id}','hpMax',Math.max(1,parseInt(this.value)||1))">
      <button class="btn tiny" onclick="bumpFoeHP('${nodeId}','${f.id}',1)">+</button>
    </div>
  </div>`;
}

export function statblockHTML(n){
  const m = n.monster;
  if(!m || (!m.foes?.length && !m.meta && !m.actions)){
    return `<div class="field statblock-empty">
      <label>Scheda combattimento — D&D 5e</label>
      <div class="srd-wrap">
        <input id="srd-search" placeholder="🔎 Cerca nel bestiario SRD (es. goblin, dragon…)"
          oninput="srdSearch('${n.id}', this.value)" autocomplete="off">
        <div id="srd-results"></div>
      </div>
      <button class="btn" style="margin-top:8px" onclick="addFoe('${n.id}')">+ Scheda vuota</button>
      <p class="srd-attrib">Dati mostri: SRD 5.2.1 (regole 2024) © Wizards of the Coast — CC-BY-4.0</p>
    </div>`;
  }
  ensureMon(n);
  const alive = m.foes.filter(f=>f.hp>0).length;
  const total = m.foes.reduce((s,f)=>s+f.hp,0);
  return `<div class="field statblock">
    <label>Scheda mostro — D&D 5e</label>
    <div class="srd-wrap">
      <input id="srd-search" placeholder="🔎 Cambia mostro (cerca nella SRD)…"
        oninput="srdSearch('${n.id}', this.value)" autocomplete="off">
      <div id="srd-results"></div>
    </div>
    <input class="mon-meta" value="${escapeAttr(m.meta)}" oninput="editMon('${n.id}','meta',this.value)" placeholder="Taglia e tipo (es. Large monstrosity, unaligned)">
    <div class="row">
      <div class="field"><label>CA</label><input value="${escapeAttr(m.ac)}" oninput="editMon('${n.id}','ac',this.value)"></div>
      <div class="field"><label>Velocità</label><input value="${escapeAttr(m.speed)}" oninput="editMon('${n.id}','speed',this.value)"></div>
    </div>
    <div class="ab-grid">
      ${ABILITIES.map(([k,lbl])=>`<div class="ab-cell">
        <label>${lbl}</label>
        <input type="number" value="${m[k]}" oninput="editMon('${n.id}','${k}',parseInt(this.value)||10); this.nextElementSibling.textContent=abMod(this.value)">
        <span class="ab-mod">${abMod(m[k])}</span>
      </div>`).join("")}
    </div>
    <div class="row">
      <div class="field"><label>GS (PE)</label><input value="${escapeAttr(m.cr)}" oninput="editMon('${n.id}','cr',this.value)"></div>
      <div class="field"><label>Sensi</label><input value="${escapeAttr(m.senses)}" oninput="editMon('${n.id}','senses',this.value)"></div>
    </div>
    <label>Azioni</label>
    <textarea oninput="editMon('${n.id}','actions',this.value)">${escapeHtml(m.actions||"")}</textarea>
    <!-- Consultazione rara in combattimento: parte chiusa, il tracker PF e le
         Azioni restano sempre a portata di mano. -->
    <details class="field" data-sec="mon-extra" ontoggle="secToggle(this)"${secOpen("mon-extra")}>
      <summary>Resto della scheda</summary>
      <div class="row">
        <div class="field"><label>Tiri salvezza</label><input value="${escapeAttr(m.saves)}" oninput="editMon('${n.id}','saves',this.value)"></div>
        <div class="field"><label>Abilità</label><input value="${escapeAttr(m.skills)}" oninput="editMon('${n.id}','skills',this.value)"></div>
      </div>
      <div class="row">
        <div class="field"><label>Res./Immunità</label><input value="${escapeAttr(m.resist)}" oninput="editMon('${n.id}','resist',this.value)"></div>
        <div class="field"><label>Linguaggi</label><input value="${escapeAttr(m.langs)}" oninput="editMon('${n.id}','langs',this.value)"></div>
      </div>
      <label>Tratti</label>
      <textarea class="mon-sm" oninput="editMon('${n.id}','traits',this.value)">${escapeHtml(m.traits||"")}</textarea>
      <label>Azioni leggendarie</label>
      <textarea class="mon-sm" oninput="editMon('${n.id}','legendary',this.value)">${escapeHtml(m.legendary||"")}</textarea>
    </details>

    <div class="foe-list">
      <div class="foe-head"><span>${m.foes.length>1?`${alive}/${m.foes.length} in vita · ${total} PF totali`:"Nemico"}</span>
        <button class="btn tiny" onclick="addFoe('${n.id}')">+ nemico</button></div>
      ${m.foes.map(f=>foeCard(n.id,f)).join("")}
    </div>

    <label>Tiradadi</label>
    <div class="dice-bar">
      ${[20,12,10,8,6,4].map(d=>`<button class="btn tiny" onclick="rollDice('d${d}')">d${d}</button>`).join("")}
      <input id="dice-expr" placeholder="2d6+3" onkeydown="if(event.key==='Enter')rollDice(this.value)">
      <button class="btn tiny" onclick="rollDice(document.getElementById('dice-expr').value)">Tira</button>
      <span id="dice-out"></span>
    </div>
    <p class="srd-attrib">Dati mostri: SRD 5.2.1 (regole 2024) © Wizards of the Coast — CC-BY-4.0</p>
  </div>`;
}

// per gli onclick inline nei template (l'input delle caratteristiche usa anche abMod)
Object.assign(window, { editMon, addFoe, editFoe, bumpFoeHP, removeFoe,
  srdSearch, applySRD, rollDice, abMod });

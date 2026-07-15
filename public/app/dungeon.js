/* Import dal generatore di dungeon.
   L'export di /dungeon (runebog-dungeon-generator) diventa una bolla nel livello
   corrente: le stanze sono blocchi alle coordinate vere della griglia (1 quadrato
   = 40px, la stessa maglia del canvas), i corridoi sono lo sfondo della pianta più
   archi "tunnel", gli incontri sono nodi encounter coi nemici già contati, e i PG
   di state.players entrano come pedine trascinabili nella stanza d'ingresso. */

import { node, uid, TOKEN_COLORS, MARKER_R } from "./modello.js";
import { st, save, currentNode, RO } from "./stato.js";
import { enterNode, planFit } from "./mappa.js";
import { newFoe } from "./mostri.js";

const DG_SCALE = 40;
const DG_SIZE_IT = {Tiny:"Minuscola",Small:"Piccola",Medium:"Media",Large:"Grande",Huge:"Enorme",Gargantuan:"Mastodontica"};
const DG_RARITY_IT = {common:"comune",uncommon:"non comune",rare:"raro",veryRare:"molto raro",legendary:"leggendario"};
const DG_ROOM_IT = {ingresso:"Ingresso",combattimento:"Combattimento",tesoro:"Tesoro",trappola:"Trappola",
  enigma:"Enigma",riposo:"Riposo",tana:"Tana",vuota:"Vuota",boss:"Boss"};

function dungeonBgImage(g){
  // Solo corridoi e porte: le stanze le disegnano i blocchi che ci stanno sopra.
  // Le corse orizzontali di corridoio si fondono in un rect solo: meno byte in salvataggio.
  const S = DG_SCALE;
  let rects = "", doors = "";
  for(let y=0; y<g.rows.length; y++){
    const row = g.rows[y];
    let run = -1;
    for(let x=0; x<=row.length; x++){
      const corr = x<row.length && (row[x]==="2" || row[x]==="3");
      if(corr && run<0) run = x;
      if(!corr && run>=0){
        rects += `<rect x="${run*S}" y="${y*S}" width="${(x-run)*S}" height="${S}"/>`;
        run = -1;
      }
      if(x<row.length && row[x]==="3")
        doors += `<rect x="${x*S+7}" y="${y*S+7}" width="${S-14}" height="${S-14}"/>`;
    }
  }
  // Hex fissi obbligati: questo SVG diventa un'immagine data-URI (documento a
  // sé), dove i token var(--…) della pagina non esistono. È l'eccezione, non
  // il modello: nel DOM della pagina i colori passano dai token del tema.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${g.width*S} ${g.height*S}">`
    + `<g fill="#8a8f98" fill-opacity="0.45">${rects}</g>`
    + `<g fill="#d8b25a" fill-opacity="0.9">${doors}</g></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function dungeonRoomNotes(r){
  const L = [];
  L.push(`${DG_ROOM_IT[r.type]||r.type} — ${r.rect.w}×${r.rect.h} quadrati (${String(r.rect.widthMeters).replace(".",",")}×${String(r.rect.heightMeters).replace(".",",")} m)`);
  if(r.description) L.push(r.description);
  if(r.encounter)
    L.push("", `Incontro (${r.encounter.difficulty}) — ${r.encounter.adjustedXP} XP rettificati, budget ${r.encounter.xpBudget}. I nemici sono nei nodi qui dentro.`);
  if(r.traps && r.traps.length){
    L.push("", "Trappole:");
    for(const t of r.traps)
      L.push(`· ${t.name} — CD ${t.dc} ${t.save}${t.damage&&t.damage!=="0"?` · ${t.damage} ${t.damageType}`:""} — ${t.effect}`);
  }
  if(r.loot){
    L.push("", `Bottino (${r.loot.totalGp} mo totali):`);
    const c = r.loot.coins, coins = [];
    if(c.pp) coins.push(c.pp+" mp"); if(c.gp) coins.push(c.gp+" mo");
    if(c.sp) coins.push(c.sp+" ma"); if(c.cp) coins.push(c.cp+" mr");
    if(coins.length) L.push("· Monete: "+coins.join(" · "));
    for(const gm of (r.loot.gems||[])) L.push(`· Gemma: ${gm.value} mo · ${gm.name}`);
    for(const a of (r.loot.art||[]))  L.push(`· Oggetto d'arte: ${a.value} mo · ${a.name}`);
    for(const m of (r.loot.magicItems||[])) L.push(`· Magico: ${m.name} (${DG_RARITY_IT[m.rarity]||m.rarity})`);
  }
  if(r.features && r.features.length){
    L.push("", "Sul posto:");
    for(const f of r.features) L.push("· "+f);
  }
  return L.join("\n");
}

function dungeonFromExport(data){
  const S = DG_SCALE;
  const dg = node(data.name||"Dungeon", "luogo");
  dg.w = 200; dg.h = 140;
  const p = data.params||{};
  const sum = data.summary||{};
  dg.notes = [
    `Generato con /dungeon — seed ${data.seed}`,
    `Party: livello ${p.level??"?"}, ${p.partySize??"?"} PG · difficoltà ${p.difficulty??"?"} · regole ${p.ruleset??"?"}`,
    `${sum.totalRooms??data.rooms.length} stanze · ${sum.monsterCount??"?"} creature · ${sum.totalAdjustedXP??"?"} XP rettificati · ${sum.totalLootGp??"?"} mo di bottino`,
  ].join("\n");
  dg.bg = {img: dungeonBgImage(data.grid), x:0, y:0, w:data.grid.width*S, h:data.grid.height*S, opacity:0.7};

  const idmap = {};          // room-N dell'export -> id del nodo creato
  let entrance = null;
  for(const r of data.rooms){
    const rn = node(`#${r.index} ${r.name}`, "luogo");
    rn.shape = "stanza";
    rn.x = r.rect.x*S; rn.y = r.rect.y*S;
    rn.w = r.rect.w*S; rn.h = r.rect.h*S;
    rn.notes = dungeonRoomNotes(r);
    if(r.type==="ingresso" && !entrance) entrance = r;
    idmap[r.id] = rn.id;
    if(r.encounter){
      for(const m of r.encounter.monsters){
        const en = node(`${m.count}× ${m.name}`, "encounter");
        en.notes = `GS ${m.crLabel} · ${m.xp} PE l'uno · ${DG_SIZE_IT[m.size]||m.size} ${m.type}`;
        en.monster = {
          meta: `${DG_SIZE_IT[m.size]||m.size} ${m.type}`,
          ac: String(m.ac), speed: `${m.speed} ft`, cr: `${m.crLabel} (${m.xp} PE)`,
          hpDefault: m.hp,
          foes: Array.from({length:m.count}, (_,i)=>newFoe(m.count>1?`${m.name} ${i+1}`:m.name, m.hp)),
        };
        rn.children.push(en);
      }
    }
    dg.children.push(rn);
  }

  for(const [a,b] of (data.connections||[])){
    if(idmap[a] && idmap[b])
      dg.edges.push({id:uid(), a:idmap[a], b:idmap[b], type:"tunnel", label:"", notes:""});
  }

  // I PG entrano in scena: una pedina per giocatore, in fila nella stanza d'ingresso.
  const ent = entrance || data.rooms[0];
  if(ent){
    const pcs = st.state.players.filter(pl=>(pl.name||"").trim());
    const cx = (ent.rect.x + ent.rect.w/2)*S, cy = (ent.rect.y + ent.rect.h/2)*S;
    pcs.forEach((pl,i)=>{
      const tk = node(pl.name.trim(), "token");
      tk.tokenColor = TOKEN_COLORS[i % TOKEN_COLORS.length];
      tk.x = Math.round(cx + (i - (pcs.length-1)/2)*36 - MARKER_R);
      tk.y = Math.round(cy - MARKER_R);
      dg.children.push(tk);
    });
  }
  return dg;
}

function importDungeon(text){
  if(RO) return;
  let data;
  try{ data = JSON.parse(text); }
  catch(_){ alert("Non è JSON: copia l'export dalla pagina /dungeon (Copia JSON) e riprova."); return; }
  if(!data || data.generator!=="runebog-dungeon-generator" || !data.grid || !Array.isArray(data.rooms)){
    alert("Questo JSON non viene dal generatore di dungeon (/dungeon del sito).");
    return;
  }
  const dg = dungeonFromExport(data);
  currentNode().children.push(dg);
  save();
  enterNode(dg.id);       // dentro subito: si vedono stanze, corridoi e pedine
  planFit(true);
}

export async function pasteDungeon(){
  if(RO) return;
  let text = null;
  try{ text = await navigator.clipboard.readText(); }catch(_){}
  if(!text){
    alert("Non riesco a leggere gli appunti: usa “Da file…” con il .json scaricato.");
    return;
  }
  importDungeon(text);
}

export function initDungeon(){
  document.getElementById("dungeon-file").addEventListener("change", e=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{ importDungeon(r.result); e.target.value = ""; };
    r.readAsText(f);
  });
}

// per l'onclick inline nel pannello
Object.assign(window, { pasteDungeon });

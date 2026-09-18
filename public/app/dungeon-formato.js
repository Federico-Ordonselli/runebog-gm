/* Confine dell'import: limiti prima delle allocazioni di griglia e nemici.
   Le proprietà extra restano compatibili con gli export futuri, ma nessun
   valore consumato dalla conversione viene accettato per coercizione. */
import { CAMPAIGN_LIMITS, scanJsonLimits, utf8ByteLength } from './formato-campagna.js';

export function parseDungeonExport(text){
  const fail = () => { throw new Error('Export dungeon non valido o troppo grande.'); };
  if(typeof text !== 'string' || utf8ByteLength(text) > CAMPAIGN_LIMITS.documentBytes) fail();
  const data = JSON.parse(text);
  if(!scanJsonLimits(data).ok) fail();
  const obj = v => { if(!v || typeof v !== 'object' || Array.isArray(v)) fail(); };
  const str = (v, max=2000) => { if(typeof v !== 'string' || v.length > max) fail(); };
  const num = (v, min=0, max=1000000) => { if(typeof v !== 'number' || !Number.isFinite(v) || v<min || v>max) fail(); };
  const int = (v, min, max) => { num(v,min,max); if(!Number.isSafeInteger(v)) fail(); };
  const arr = (v, max=600) => { if(!Array.isArray(v) || v.length>max) fail(); };
  const fields = (v, strings=[], numbers=[]) => {
    obj(v); strings.forEach(k=>str(v[k])); numbers.forEach(k=>num(v[k]));
  };
  obj(data);
  if(data.generator !== 'runebog-dungeon-generator') fail();
  if(data.schemaVersion !== undefined && !['1.0','1.1'].includes(data.schemaVersion)) fail();
  str(data.name,500); num(data.seed, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  for(const key of ['params','summary']) if(data[key] != null){
    obj(data[key]);
    for(const value of Object.values(data[key])){
      if(typeof value === 'string') str(value);
      else num(value, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }
  }
  const g = data.grid; obj(g);
  int(g.width,1,500); int(g.height,1,500); arr(g.rows,500);
  if(g.rows.length !== g.height) fail();
  for(const row of g.rows) if(typeof row !== 'string' || row.length !== g.width || !/^[0-3]+$/.test(row)) fail();
  arr(data.rooms); if(!data.rooms.length) fail();
  const ids = new Set(); let foes = 0;
  for(const r of data.rooms){
    fields(r,['id','name','type']); int(r.index,0,1000000);
    if(ids.has(r.id)) fail(); ids.add(r.id);
    const q=r.rect; obj(q);
    int(q.x,0,g.width-1); int(q.y,0,g.height-1);
    int(q.w,1,g.width-q.x); int(q.h,1,g.height-q.y);
    num(q.widthMeters); num(q.heightMeters);
    if(r.description != null) str(r.description,250000);
    if(r.features != null){ arr(r.features); r.features.forEach(v=>str(v)); }
    if(r.traps != null){ arr(r.traps); r.traps.forEach(t=>fields(t,['name','save','damage','damageType','effect'],['dc'])); }
    if(r.loot != null){
      const l=r.loot; fields(l,[],['totalGp']); fields(l.coins,[],['pp','gp','sp','cp']);
      for(const key of ['gems','art','magicItems']) if(l[key] != null){
        arr(l[key]); l[key].forEach(v=>key==='magicItems' ? fields(v,['name','rarity']) : fields(v,['name'],['value']));
      }
    }
    if(r.encounter != null){
      const e=r.encounter; fields(e,['difficulty'],['adjustedXP','xpBudget']); arr(e.monsters);
      for(const m of e.monsters){
        fields(m,['name','crLabel','size','type'],['xp','ac','speed']);
        int(m.hp,1,1000000); int(m.count,1,CAMPAIGN_LIMITS.foesPerNode);
        foes += m.count; if(foes>5000) fail();
      }
    }
  }
  if(data.connections != null){
    arr(data.connections,3000);
    for(const pair of data.connections){ arr(pair,2); if(pair.length!==2 || !pair.every(id=>ids.has(id))) fail(); }
  }
  return data;
}

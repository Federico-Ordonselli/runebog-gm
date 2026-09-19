/* Tutta la selezione condivide una mappa degli ID: una pedina può stare in
   una bolla diversa dall'incontro. I riferimenti esterni (PG compresi) restano. */
import { uid } from './modello.js';

export function duplicaNodi(originali){
  const copie = structuredClone(originali);
  const nodi = new Map(), nemici = new Map();
  const visita = (lista, fn) => {
    for(const n of lista){ fn(n); visita(n.children || [], fn); }
  };
  visita(copie, n=>{
    const vecchio = n.id;
    nodi.set(vecchio, n.id = uid());
    const mappaNemici = new Map();
    for(const f of n.monster?.foes || []) mappaNemici.set(f.id, f.id = uid());
    nemici.set(vecchio, mappaNemici);
    for(const w of n.wallSegs || []) w.id = uid();
  });
  const collegaNemico = ref => {
    if(!nodi.has(ref.nodeId)) return;
    ref.foeId = nemici.get(ref.nodeId)?.get(ref.foeId) || ref.foeId;
    ref.nodeId = nodi.get(ref.nodeId);
  };
  visita(copie, n=>{
    for(const e of n.edges || []){
      e.id = uid(); e.a = nodi.get(e.a) || e.a; e.b = nodi.get(e.b) || e.b;
    }
    if(n.foe) collegaNemico(n.foe);
    for(const e of n.battle?.order || []){
      e.id = uid();
      if(e.kind === 'foe') collegaNemico(e);
    }
  });
  return {copie, nodi};
}

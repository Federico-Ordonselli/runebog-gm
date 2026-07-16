/* Il tavolo dei giocatori.
   Lato DM: marcare cosa è rivelato, e gestire il link di condivisione.
   Lato giocatori (RO): ricaricare periodicamente lo stato filtrato dal server. */

import { escapeAttr } from "./modello.js";
import { st, save, findNode, findParent, RO, TABLE } from "./stato.js";
import { openAlert } from "./viste.js";
import { renderMap, renderCanvas } from "./mappa.js";
import { renderDetail } from "./pannello.js";

export function revealNode(id, on){
  if(RO) return;
  const n = findNode(id); if(!n || n.id===st.state.root.id) return;
  n.shared = !!on;
  if(on){
    // I giocatori navigano l'albero come noi: un blocco rivelato dentro un livello
    // nascosto sarebbe irraggiungibile. Rivelo la catena dei contenitori.
    let p = findParent(id);
    while(p && p.id !== st.state.root.id){ p.shared = true; p = findParent(p.id); }
  }else{
    // Nascondendo un contenitore sparisce anche ciò che sta dentro: lasciarlo "rivelato"
    // ma irraggiungibile significherebbe farlo riapparire di colpo alla prossima rivelazione.
    (function walk(x){ x.shared = false; (x.children||[]).forEach(walk); })(n);
  }
  save(); renderCanvas(); renderDetail();
}

/* --- il link del tavolo (solo sul sito: serve il server) --- */
export async function openShare(){
  if(!window.__cloud) return;
  const dlg = document.getElementById("share-dialog");
  const body = document.getElementById("share-body");
  body.innerHTML = `<p class="hint-sm">Carico…</p>`;
  dlg.showModal();
  try{
    const res = await fetch(`/api/campaigns/${window.__cloud.id}`);
    if(!res.ok) throw new Error(res.status);
    const row = await res.json();
    renderShare(row.shareToken || null);
  }catch(_){
    body.innerHTML = `<p class="hint-sm" style="color:var(--gold)">Non riesco a leggere lo stato del tavolo. Sei offline?</p>`;
  }
}
function renderShare(token){
  const body = document.getElementById("share-body");
  const nRivelati = (function count(n){
    return (n.children||[]).reduce((s,c)=> s + (c.shared?1:0) + count(c), 0);
  })(st.state.root);

  if(!token){
    body.innerHTML = `
      <p>Apri il tavolo e ottieni un link da dare ai giocatori. Vedranno la mappa e le
      descrizioni <b>solo delle bolle che hai rivelato</b> — mai le tue note, mai i PF dei mostri.</p>
      <p class="hint-sm">Chi ha il link entra senza account. Puoi chiuderlo quando vuoi.</p>
      <div class="d-actions">
        <button class="btn" onclick="document.getElementById('share-dialog').close()">Annulla</button>
        <button class="btn primary" onclick="rotateShare()">Apri il tavolo</button>
      </div>`;
    return;
  }
  const url = location.origin + "/tavolo/" + token;
  body.innerHTML = `
    <p>Il tavolo è <b>aperto</b>. Bolle rivelate finora: <b>${nRivelati}</b>.</p>
    <div class="field">
      <label>Link per i giocatori</label>
      <input id="share-url" readonly value="${escapeAttr(url)}" onclick="this.select()">
    </div>
    ${nRivelati===0 ? `<p class="hint-sm" style="color:var(--gold)">Non hai ancora rivelato niente:
      per ora i giocatori aprirebbero una mappa vuota. Seleziona una bolla e premi
      «Rivela ai giocatori».</p>` : ``}
    <div class="d-actions">
      <button class="btn" onclick="copyShare()">Copia link</button>
      <button class="btn" onclick="rotateShare()" title="Il vecchio link smette di funzionare">Nuovo link</button>
      <button class="btn danger" onclick="closeShare()">Chiudi il tavolo</button>
    </div>`;
}
export async function rotateShare(){
  const res = await fetch(`/api/campaigns/${window.__cloud.id}/share`, {method:"POST"});
  if(!res.ok){ openAlert("Non riesco ad aprire il tavolo. Controlla la connessione e riprova."); return; }
  const {token} = await res.json();
  renderShare(token);
}
export async function closeShare(){
  const res = await fetch(`/api/campaigns/${window.__cloud.id}/share`, {method:"DELETE"});
  if(!res.ok){ openAlert("Non riesco a chiudere il tavolo. Controlla la connessione e riprova."); return; }
  renderShare(null);
}
export function copyShare(){
  const i = document.getElementById("share-url");
  i.select();
  navigator.clipboard?.writeText(i.value).catch(()=>{});
}

/* --- lato giocatori: lo stato lo rilegge il server, non lo si costruisce qui --- */
export function initTavolo(){
  if(!RO) return;
  const POLL_MS = 5000;
  let pollBusy = false;
  async function pollTable(){
    if(pollBusy || document.hidden) return;        // a scheda chiusa non si consuma banda
    pollBusy = true;
    const el = document.getElementById("savestate");
    try{
      const res = await fetch(`/api/tavolo/${TABLE.token}`, {cache:"no-store"});
      if(res.status===404){
        el.textContent = "Il DM ha chiuso il tavolo";
        el.style.color = "var(--gold)";
        clearInterval(pollTimer);
        return;
      }
      if(!res.ok) throw new Error(res.status);
      const fresh = await res.json();
      // Ridisegno solo se qualcosa è cambiato davvero: altrimenti ogni 5 secondi
      // perderei la selezione e farei sfarfallare la mappa sotto le mani dei giocatori.
      if(JSON.stringify(fresh.state) !== JSON.stringify(st.state)){
        st.state = fresh.state;
        if(!findNode(st.path[st.path.length-1])) st.path = [st.state.root.id];   // il DM ha ri-nascosto dove eravamo
        if(st.selectedId && !findNode(st.selectedId)) st.selectedId = null;
        renderMap();
      }
      el.textContent = "Aggiornato ✓";
      el.style.color = "var(--ink-dim)";
    }catch(_){
      el.textContent = "Offline";
      el.style.color = "var(--gold)";
    }finally{ pollBusy = false; }
  }
  const pollTimer = setInterval(pollTable, POLL_MS);
  addEventListener("visibilitychange", ()=>{ if(!document.hidden) pollTable(); });
}

// per gli onclick inline nei template (pannello e dialogo di condivisione)
Object.assign(window, { revealNode, openShare, rotateShare, closeShare, copyShare });

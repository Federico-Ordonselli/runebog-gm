/* La scheda Calendario (25 set 2026): il tempo del mondo di gioco. Il
   giorno corrente, un bottone per farlo avanzare, il mese a griglia con
   eventi e scadenze delle quest, e la struttura del calendario (mesi,
   settimana, anno) che il DM si costruisce.

   I conti stanno in calendario-conti.js e la forma nel contratto; qui c'è
   solo la vista. Al tavolo la scheda è in sola lettura e compare solo se il
   DM il calendario l'ha usato: lo stato che arriva è già la proiezione di
   share.ts, quindi gli eventi del DM qui non ci sono proprio.

   Il calendario entra nel documento al primo gesto che lo modifica
   (`assicura`), non all'apertura della scheda: guardarlo non è una
   modifica, e in cloud ogni modifica è una revisione. */

import { escapeHtml, uid } from "./modello.js";
import { st, save, RO, campagnaCorrente } from "./stato.js";
import { calendarioPredefinito, CALENDARIO_LIMITI, CAMPAIGN_LIMITS } from "./formato-campagna.js";
import {
  calendarioDi, dataDi, giornoDi, spostaMese, giornoSettimana, lunghezzaAnno,
  nomeMese, nomeGiorno, nomeAnno, formattaData, scadenzaTesto, distanzaTesto,
} from "./calendario-conti.js";

/* Cosa si sta guardando: il mese mostrato e il giorno scelto. Sono della
   vista, non della campagna — cambiando campagna si torna a oggi. */
let vista = null, scelto = null, vistaDi = undefined, strutturaAperta = false;

export function assicuraCalendario(){
  if(!st.state.calendario) st.state.calendario = calendarioPredefinito();
  return st.state.calendario;
}

/* Le quest con una scadenza, da tutto l'albero. Al tavolo ci sono solo
   quelle condivise e con la scadenza detta: le altre il server non le manda. */
export function scadenzeQuest(){
  const out = [];
  (function walk(n){
    if(n.type === "quest" && Number.isInteger(n.scadenza)) out.push(n);
    for(const c of n.children) walk(c);
  })(st.state.root);
  return out;
}

/* Il testo della scadenza di una quest, per chi la mostra (diario, pannello,
   tela). null se non ne ha. Una quest fatta non scade più. */
export function scadenzaDi(n){
  if(!Number.isInteger(n?.scadenza)) return null;
  const cal = calendarioDi(st.state);
  const s = scadenzaTesto(cal.oggi, n.scadenza);
  if(n.status === "fatto") return {...s, testo: `era per il ${formattaData(cal, n.scadenza)}`, stato: "fatta"};
  return s;
}

/* Al tavolo la scheda c'è solo se il DM il calendario l'ha usato. */
export function aggiornaTabCalendario(){
  const tab = document.getElementById("tab-cal");
  if(tab) tab.hidden = RO && !st.state.calendario;
}

function voci(cal, da, a){
  const per = new Map();
  const metti = (g, v) => { if(g < da || g > a) return; if(!per.has(g)) per.set(g, []); per.get(g).push(v); };
  for(const q of scadenzeQuest()) metti(q.scadenza, {tipo:"scadenza", q});
  for(const e of cal.eventi) metti(e.giorno, {tipo:"evento", e});
  return per;
}

const etichetta = v => v.tipo === "scadenza" ? `⚑ ${v.q.title || "(quest senza nome)"}` : (v.e.titolo || "(evento senza titolo)");

function testataHTML(cal){
  return `<div class="cal-testa">
    <div class="cal-oggi-box">
      <h2 class="q-h">Oggi</h2>
      <div class="cal-oggi">${escapeHtml(formattaData(cal, cal.oggi))}</div>
      <div class="q-loc cal-conta">giorno ${cal.oggi} della campagna · ${escapeHtml(nomeGiorno(cal, giornoSettimana(cal, cal.oggi)))}</div>
    </div>
    ${RO ? "" : `<div class="cal-avanza" role="group" aria-label="Far passare il tempo">
      <button class="btn" onclick="calGiorni(-1)" ${cal.oggi <= 1 ? "disabled" : ""}
        aria-label="Torna indietro di un giorno">−1</button>
      <button class="btn primary" onclick="calGiorni(1)">+1 giorno</button>
      <span class="cal-n-riga">
        <input id="cal-n" type="number" min="1" max="100000" value="7" inputmode="numeric"
          aria-label="Quanti giorni far passare">
        <button class="btn" onclick="calAvanza()">Fai passare</button>
      </span>
    </div>`}
  </div>`;
}

function grigliaHTML(cal){
  const {anno, mese} = vista;
  const g0 = giornoDi(cal, anno, mese, 1), n = cal.mesi[mese].giorni;
  const per = voci(cal, g0, g0 + n - 1);
  const settimana = cal.settimana.length;
  // La prima cella del mese sta sotto il suo giorno della settimana; un mese
  // prima dell'inizio della campagna non esiste (giorno 1), quindi si parte da lì.
  const vuote = giornoSettimana(cal, g0);
  const celle = [];
  for(let i=0; i<vuote; i++) celle.push(`<span class="cal-vuota" aria-hidden="true"></span>`);
  for(let d=1; d<=n; d++){
    const g = g0 + d - 1, vv = per.get(g) || [];
    const oggi = g === cal.oggi, sel = g === scelto;
    const aria = [`${d} ${nomeMese(cal, mese)}`, oggi ? "oggi" : "",
      vv.length ? `${vv.length} ${vv.length === 1 ? "voce" : "voci"}` : ""].filter(Boolean).join(", ");
    celle.push(`<button type="button" class="cal-g${oggi ? " oggi" : ""}${sel ? " scelto" : ""}"
      aria-pressed="${sel}" aria-label="${escapeHtml(aria)}" onclick="calScegli(${g})">
      <span class="cal-num">${d}</span>${oggi ? `<span class="cal-oggi-tag">oggi</span>` : ""}
      ${vv.slice(0, 3).map(v => `<span class="cal-voce ${v.tipo}${v.tipo === "scadenza" && v.q.status === "fatto" ? " fatta" : ""}">${escapeHtml(etichetta(v))}</span>`).join("")}
      ${vv.length > 3 ? `<span class="cal-piu">+${vv.length - 3}</span>` : ""}
      ${vv.length ? `<span class="cal-punti" aria-hidden="true">${"•".repeat(Math.min(3, vv.length))}</span>` : ""}
    </button>`);
  }
  return `<div class="cal-mese-nav">
      <button class="btn" onclick="calMese(-1)" aria-label="Mese precedente">‹</button>
      <h2 class="cal-mese-titolo" aria-live="polite">${escapeHtml(nomeMese(cal, mese))} ${escapeHtml(nomeAnno(cal, anno))}</h2>
      <button class="btn" onclick="calMese(1)" aria-label="Mese successivo">›</button>
      <button class="btn" onclick="calVaiOggi()">Oggi</button>
    </div>
    <div class="cal-griglia" style="--sett:${settimana}">
      ${cal.settimana.map((_, i) => `<span class="cal-sett" aria-hidden="true">${escapeHtml(nomeGiorno(cal, i))}</span>`).join("")}
      ${celle.join("")}
    </div>`;
}

function giornoHTML(cal){
  const g = scelto;
  const per = voci(cal, g, g).get(g) || [];
  const scad = per.filter(v => v.tipo === "scadenza"), ev = per.filter(v => v.tipo === "evento");
  const scadRighe = scad.map(({q}) => {
    const s = scadenzaDi(q);
    return `<div class="cal-riga cal-scad">
      <span class="cal-glifo" aria-hidden="true">⚑</span>
      <div class="cal-riga-corpo">
        <span class="cal-tipo">Scadenza della quest</span>
        <button type="button" class="q-title png-nome" onclick="goToNode('${q.id}')"
          title="Vai sulla mappa">${escapeHtml(q.title || "(senza nome)")}</button>
        <span class="q-scad s-${s.stato}">${escapeHtml(s.testo)}</span>
        ${!RO && !q.scadenzaVisibile ? `<span class="cal-solo-dm">solo DM</span>` : ""}
      </div>
    </div>`;
  }).join("");
  const evRighe = ev.map(({e}) => RO
    ? `<div class="cal-riga"><span class="cal-glifo" aria-hidden="true">•</span><div class="cal-riga-corpo">
        <strong>${escapeHtml(e.titolo || "(evento senza titolo)")}</strong>
        ${e.note ? `<div class="ro-text">${escapeHtml(e.note)}</div>` : ""}</div></div>`
    : `<div class="cal-riga cal-ev${e.visibile ? "" : " dm"}">
        <span class="cal-glifo" aria-hidden="true">•</span>
        <div class="cal-riga-corpo">
          <input id="cal-ev-t-${e.id}" class="cal-ev-titolo" value="${escapeHtml(e.titolo)}"
            placeholder="Titolo dell'evento" aria-label="Titolo dell'evento"
            maxlength="${CAMPAIGN_LIMITS.titleChars}" onchange="calEvento('${e.id}','titolo',this.value)">
          <textarea id="cal-ev-n-${e.id}" rows="2" placeholder="Note" aria-label="Note dell'evento"
            onchange="calEvento('${e.id}','note',this.value)">${escapeHtml(e.note || "")}</textarea>
          <div class="cal-ev-azioni">
            <div class="opt"><label><input id="cal-ev-v-${e.id}" type="checkbox" ${e.visibile ? "checked" : ""}
              onchange="calEvento('${e.id}','visibile',this.checked)"> Visibile ai giocatori</label>
              <p class="hint-sm">${e.visibile ? "Al tavolo escono titolo e note." : "Resta tuo: al tavolo non esce."}</p></div>
            <button class="btn danger" onclick="calEliminaEvento('${e.id}')">Elimina</button>
          </div>
        </div>
      </div>`).join("");
  const vuoto = !per.length
    ? `<p class="q-empty">${RO ? "Niente in questo giorno." : "Niente in questo giorno. Un evento qui, oppure una scadenza dal pannello di una quest."}</p>` : "";
  return `<section class="cal-giorno" aria-labelledby="cal-giorno-titolo">
    <div class="cal-giorno-testa">
      <h3 id="cal-giorno-titolo">${escapeHtml(formattaData(cal, g))}
        <span class="cal-dist">${escapeHtml(distanzaTesto(cal.oggi, g))}</span></h3>
      ${!RO && g !== cal.oggi ? `<button class="btn" onclick="calImpostaOggi()">Fai diventare oggi</button>` : ""}
    </div>
    ${scadRighe}${evRighe}${vuoto}
    ${RO ? "" : `<button class="btn primary cal-nuovo" onclick="calNuovoEvento()">+ Evento in questo giorno</button>`}
  </section>`;
}

/* I prossimi giorni che contano, da oggi in avanti, più le quest scadute e
   non ancora fatte: sono quelle che il DM rischia di dimenticare. */
function prossimiHTML(cal){
  const lista = [];
  for(const q of scadenzeQuest())
    if(q.scadenza >= cal.oggi || q.status !== "fatto") lista.push({g:q.scadenza, v:{tipo:"scadenza", q}});
  for(const e of cal.eventi) if(e.giorno >= cal.oggi) lista.push({g:e.giorno, v:{tipo:"evento", e}});
  lista.sort((a, b) => a.g - b.g);
  const primi = lista.slice(0, 10);
  if(!primi.length) return "";
  return `<section class="cal-prossimi"><h2 class="q-h">In arrivo</h2>
    ${primi.map(({g, v}) => {
      const dist = v.tipo === "scadenza" ? scadenzaDi(v.q) : {testo: distanzaTesto(cal.oggi, g), stato: g === cal.oggi ? "oggi" : "lontana"};
      return `<button type="button" class="cal-prossimo" onclick="calScegli(${g}, true)">
        <span class="cal-prossimo-data">${escapeHtml(formattaData(cal, g))}</span>
        <span class="cal-prossimo-titolo">${escapeHtml(etichetta(v))}</span>
        <span class="q-scad s-${dist.stato}">${escapeHtml(dist.testo)}</span>
      </button>`;
    }).join("")}
  </section>`;
}

function strutturaHTML(cal){
  const L = CALENDARIO_LIMITI, n = cal.mesi.length;
  return `<details class="cal-struttura" ontoggle="calStrutturaToggle(this.open)"${strutturaAperta ? " open" : ""}>
    <summary>Struttura del calendario</summary>
    <p class="hint-sm">Anno di ${lunghezzaAnno(cal)} giorni in ${n} ${n === 1 ? "mese" : "mesi"},
      settimana di ${cal.settimana.length} giorni. Eventi e scadenze restano a quanti giorni
      mancano da oggi: cambiando la lunghezza di un mese cambia la data in cui cadono, non quando.</p>
    <div class="cal-mesi">
      ${cal.mesi.map((m, i) => `<div class="cal-mese-riga">
        <span class="cal-mese-num">${i + 1}</span>
        <input id="cal-m-n-${i}" value="${escapeHtml(m.nome)}" placeholder="Mese ${i + 1}" maxlength="${L.nomeChars}"
          aria-label="Nome del mese ${i + 1}" onchange="calMeseCampo(${i},'nome',this.value)">
        <input id="cal-m-g-${i}" type="number" min="1" max="${L.giorniMese}" value="${m.giorni}" inputmode="numeric"
          aria-label="Giorni del mese ${i + 1}" onchange="calMeseCampo(${i},'giorni',this.value)">
        <button class="btn" id="cal-m-su-${i}" onclick="calMeseSposta(${i},-1)" ${i === 0 ? "disabled" : ""} aria-label="Sposta su il mese ${i + 1}">↑</button>
        <button class="btn" id="cal-m-giu-${i}" onclick="calMeseSposta(${i},1)" ${i === n - 1 ? "disabled" : ""} aria-label="Sposta giù il mese ${i + 1}">↓</button>
        <button class="btn danger" onclick="calMeseTogli(${i})" ${n === 1 ? "disabled" : ""} aria-label="Togli il mese ${i + 1}">✕</button>
      </div>`).join("")}
    </div>
    <button class="btn" onclick="calMeseAggiungi()" ${n >= L.mesi ? "disabled" : ""}>+ Aggiungi mese</button>
    <div class="cal-campi">
      <label for="cal-sett">Giorni della settimana <span class="hint-sm">(separati da virgola)</span></label>
      <input id="cal-sett" value="${escapeHtml(cal.settimana.join(", "))}" onchange="calSettimana(this.value)">
      <div class="cal-campi-anno">
        <span><label for="cal-anno">Anno iniziale</label>
        <input id="cal-anno" type="number" min="${-L.annoAbs}" max="${L.annoAbs}" value="${cal.annoIniziale}"
          onchange="calAnno(this.value)"></span>
        <span><label for="cal-era">Era <span class="hint-sm">(es. DR)</span></label>
        <input id="cal-era" value="${escapeHtml(cal.era)}" maxlength="${L.eraChars}" onchange="calEra(this.value)"></span>
      </div>
    </div>
  </details>`;
}

export function renderCalendario(){
  aggiornaTabCalendario();
  const wrap = document.getElementById("cal-wrap");
  if(!wrap) return;
  const cal = calendarioDi(st.state);
  // Cambiando campagna la vista riparte da oggi; al tavolo la campagna è una.
  const chi = campagnaCorrente();
  if(!vista || vistaDi !== chi){ vistaDi = chi; vaiA(cal, cal.oggi); }
  if(vista.mese >= cal.mesi.length) vaiA(cal, scelto);
  wrap.innerHTML = `${testataHTML(cal)}
    <div class="cal-corpo">
      <div class="cal-sinistra">${grigliaHTML(cal)}</div>
      <div class="cal-destra">${giornoHTML(cal)}${prossimiHTML(cal)}</div>
    </div>
    ${RO ? "" : strutturaHTML(cal)}`;
}

function vaiA(cal, g){
  scelto = g;
  const d = dataDi(cal, g);
  vista = {anno: d.anno, mese: d.mese};
}

/* Ridisegna dopo che l'evento `change` è finito, e rimette il focus dov'era
   andato: il change arriva quando si esce da un campo col Tab, e ridisegnare
   subito distruggerebbe il campo in cui il Tab sta portando il focus. Gli id
   dei campi sono stabili apposta. */
function ridisegna(){
  setTimeout(() => {
    const id = document.activeElement?.id;
    renderCalendario();
    const el = id && document.getElementById(id);
    if(el && document.getElementById("view-cal")?.classList.contains("active")) el.focus();
  }, 0);
}

function modifica(fn){
  if(RO) return;
  const cal = assicuraCalendario();
  fn(cal);
  save();
  ridisegna();
}

const intero = (v, min, max) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

export function calGiorni(delta){
  modifica(cal => {
    cal.oggi = Math.min(CALENDARIO_LIMITI.giornoMax, Math.max(1, cal.oggi + delta));
    vaiA(cal, cal.oggi);
  });
  annuncia();
}
export function calAvanza(){
  const n = intero(document.getElementById("cal-n")?.value, 1, 100000);
  if(n) calGiorni(n);
}
function annuncia(){
  const el = document.getElementById("savestate");
  if(el) el.textContent = `Oggi è il ${formattaData(calendarioDi(st.state), calendarioDi(st.state).oggi)}`;
}
export function calMese(delta){
  const cal = calendarioDi(st.state);
  vista = spostaMese(cal, vista.anno, vista.mese, delta);
  // Prima dell'inizio della campagna non c'è niente da guardare: il giorno 1
  // è il primo del primo mese dell'anno iniziale.
  if(vista.anno < cal.annoIniziale) vista = {anno: cal.annoIniziale, mese: 0};
  renderCalendario();
}
export function calVaiOggi(){ const cal = calendarioDi(st.state); vaiA(cal, cal.oggi); renderCalendario(); }
export function calScegli(g, sposta = false){
  const cal = calendarioDi(st.state);
  if(sposta) vaiA(cal, g); else scelto = g;
  renderCalendario();
}
export function calImpostaOggi(){ modifica(cal => { cal.oggi = scelto; }); annuncia(); }
export function calNuovoEvento(){
  let id;
  modifica(cal => {
    if(cal.eventi.length >= CALENDARIO_LIMITI.eventi) return;
    id = uid();
    cal.eventi.push({id, giorno: scelto, titolo: ""});
  });
  // il titolo del nuovo evento prende il focus, dopo il ridisegno
  setTimeout(() => document.getElementById(`cal-ev-t-${id}`)?.focus(), 0);
}
export function calEvento(id, chiave, valore){
  modifica(cal => {
    const e = cal.eventi.find(x => x.id === id);
    if(!e) return;
    if(chiave === "titolo") e.titolo = String(valore).slice(0, CAMPAIGN_LIMITS.titleChars);
    if(chiave === "note"){ const t = String(valore).slice(0, CAMPAIGN_LIMITS.longTextChars); if(t) e.note = t; else delete e.note; }
    if(chiave === "visibile"){ if(valore) e.visibile = true; else delete e.visibile; }
  });
}
export function calEliminaEvento(id){
  modifica(cal => { cal.eventi = cal.eventi.filter(x => x.id !== id); });
  const el = document.getElementById("savestate");
  if(el) el.textContent = "Evento eliminato · Ctrl+Z per annullare";
}
export function calMeseCampo(i, chiave, valore){
  modifica(cal => {
    const m = cal.mesi[i];
    if(!m) return;
    if(chiave === "nome") m.nome = String(valore).slice(0, CALENDARIO_LIMITI.nomeChars);
    if(chiave === "giorni"){ const g = intero(valore, 1, CALENDARIO_LIMITI.giorniMese); if(g) m.giorni = g; }
  });
}
export function calMeseSposta(i, d){
  modifica(cal => {
    const j = i + d;
    if(j < 0 || j >= cal.mesi.length) return;
    [cal.mesi[i], cal.mesi[j]] = [cal.mesi[j], cal.mesi[i]];
  });
  // il bottone premuto ha cambiato riga: il focus lo segue
  setTimeout(() => document.getElementById(`cal-m-${d < 0 ? "su" : "giu"}-${i + d}`)?.focus(), 0);
}
export function calMeseTogli(i){
  modifica(cal => { if(cal.mesi.length > 1) cal.mesi.splice(i, 1); });
}
export function calMeseAggiungi(){
  let i;
  modifica(cal => {
    if(cal.mesi.length >= CALENDARIO_LIMITI.mesi) return;
    cal.mesi.push({nome: "", giorni: 30});
    i = cal.mesi.length - 1;
  });
  setTimeout(() => document.getElementById(`cal-m-n-${i}`)?.focus(), 0);
}
export function calSettimana(valore){
  const giorni = String(valore).split(",").map(s => s.trim()).filter(Boolean)
    .slice(0, CALENDARIO_LIMITI.settimana).map(s => s.slice(0, CALENDARIO_LIMITI.nomeChars));
  modifica(cal => { if(giorni.length) cal.settimana = giorni; });
}
export function calAnno(valore){
  const a = intero(valore, -CALENDARIO_LIMITI.annoAbs, CALENDARIO_LIMITI.annoAbs);
  modifica(cal => {
    if(a === null) return;
    // la vista resta sullo stesso mese della campagna, non sullo stesso numero
    if(vista) vista.anno += a - cal.annoIniziale;
    cal.annoIniziale = a;
  });
}
export function calEra(valore){ modifica(cal => { cal.era = String(valore).trim().slice(0, CALENDARIO_LIMITI.eraChars); }); }
export function calStrutturaToggle(aperta){ strutturaAperta = aperta; }

export function initCalendario(){ aggiornaTabCalendario(); }

// per gli onclick inline nei template
Object.assign(window, {
  calGiorni, calAvanza, calMese, calVaiOggi, calScegli, calImpostaOggi, calNuovoEvento, calEvento,
  calEliminaEvento, calMeseCampo, calMeseSposta, calMeseTogli, calMeseAggiungi, calSettimana, calAnno,
  calEra, calStrutturaToggle,
});

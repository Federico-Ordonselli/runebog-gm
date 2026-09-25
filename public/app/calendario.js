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

import { escapeHtml, uid, TYPES } from "./modello.js";
import { st, save, RO, campagnaCorrente, findNode } from "./stato.js";
import { showView } from "./viste.js";
import { calendarioPredefinito, CALENDARIO_LIMITI, CAMPAIGN_LIMITS, RIPETI_UNITA } from "./formato-campagna.js";
import {
  calendarioDi, dataDi, giornoDi, spostaMese, giornoSettimana, lunghezzaAnno,
  nomeMese, nomeGiorno, nomeAnno, formattaData, scadenzaTesto, distanzaTesto,
  occorrenze, prossimaOccorrenza, ricorrenzaTesto,
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
  for(const e of cal.eventi) for(const g of occorrenze(cal, e, da, a)) metti(g, {tipo:"evento", e});
  return per;
}

/* ↻ dice "si ripete" anche dove non c'è spazio per scrivere ogni quanto. */
const etichetta = v => v.tipo === "scadenza" ? `⚑ ${v.q.title || "(quest senza nome)"}`
  : `${v.e.ripeti ? "↻ " : ""}${v.e.titolo || "(evento senza titolo)"}`;

/* La bolla di un evento, se c'è ancora (al tavolo: se è rivelata — il server
   il legame lo manda solo allora). */
const bollaDi = e => e.nodeId ? findNode(e.nodeId) : null;
const nomeBolla = n => n.title || `(${TYPES[n.type]?.label || "bolla"} senza nome)`;
const vaiBollaHTML = n => `<button type="button" class="q-title png-nome cal-bolla" onclick="goToNode('${n.id}')"
  title="Vai sulla mappa">→ ${escapeHtml(nomeBolla(n))}</button>`;

/* Le bolle a cui si può legare un evento: tutte tranne caselle di testo e
   pedine, che non sono posti né persone. In ordine di nome, col livello che
   le contiene per distinguere due "Taverna". */
function bolleLegabili(){
  const out = [];
  (function walk(n, genitore){
    if(n.type !== "testo" && n.type !== "token") out.push({n, genitore});
    for(const c of n.children) walk(c, n);
  })(st.state.root, null);
  return out.sort((a, b) => nomeBolla(a.n).localeCompare(nomeBolla(b.n), "it"));
}

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
  const legabili = RO || !ev.length ? [] : bolleLegabili();
  const evRighe = ev.map(({e}) => RO
    ? `<div class="cal-riga"><span class="cal-glifo" aria-hidden="true">${e.ripeti ? "↻" : "•"}</span><div class="cal-riga-corpo">
        <strong>${escapeHtml(e.titolo || "(evento senza titolo)")}</strong>
        ${e.ripeti ? `<span class="q-loc">${escapeHtml(ricorrenzaTesto(e))}</span>` : ""}
        ${bollaDi(e) ? vaiBollaHTML(bollaDi(e)) : ""}
        ${e.note ? `<div class="ro-text">${escapeHtml(e.note)}</div>` : ""}</div></div>`
    : `<div class="cal-riga cal-ev${e.visibile ? "" : " dm"}">
        <span class="cal-glifo" aria-hidden="true">•</span>
        <div class="cal-riga-corpo">
          <input id="cal-ev-t-${e.id}" class="cal-ev-titolo" value="${escapeHtml(e.titolo)}"
            placeholder="Titolo dell'evento" aria-label="Titolo dell'evento"
            maxlength="${CAMPAIGN_LIMITS.titleChars}" onchange="calEvento('${e.id}','titolo',this.value)">
          <textarea id="cal-ev-n-${e.id}" rows="2" placeholder="Note" aria-label="Note dell'evento"
            onchange="calEvento('${e.id}','note',this.value)">${escapeHtml(e.note || "")}</textarea>
          ${dataHTML(cal, e)}
          ${ripetiHTML(cal, e)}
          ${legameHTML(e, legabili)}
          <div class="cal-ev-azioni">
            <div class="opt"><label><input id="cal-ev-v-${e.id}" type="checkbox" ${e.visibile ? "checked" : ""}
              onchange="calEvento('${e.id}','visibile',this.checked)"> Visibile ai giocatori</label>
              <p class="hint-sm">${e.visibile ? "Al tavolo escono titolo e note." : "Resta tuo: al tavolo non esce."}</p></div>
            <button class="btn danger" onclick="calEliminaEvento('${e.id}')">${e.ripeti ? "Elimina tutte le volte" : "Elimina"}</button>
          </div>
        </div>
      </div>`).join("");
  const vuoto = !per.length
    ? `<p class="q-empty">${RO ? "Niente in questo giorno." : "Niente in questo giorno. Un evento qui, oppure una scadenza dal pannello di una quest."}</p>` : "";
  return `<section class="cal-giorno" aria-labelledby="cal-giorno-titolo">
    <div class="cal-giorno-testa">
      <h3 id="cal-giorno-titolo" tabindex="-1">${escapeHtml(formattaData(cal, g))}
        <span class="cal-dist">${escapeHtml(distanzaTesto(cal.oggi, g))}</span></h3>
      ${!RO && g !== cal.oggi ? `<button class="btn" onclick="calImpostaOggi()">Fai diventare oggi</button>` : ""}
    </div>
    ${scadRighe}${evRighe}${vuoto}
    ${RO ? "" : `<button class="btn primary cal-nuovo" onclick="calNuovoEvento()">+ Evento in questo giorno</button>`}
  </section>`;
}

/* Il giorno dell'evento, come data: giorno, mese, anno. Per un evento che si
   ripete è la PRIMA volta, da cui si contano le altre. */
function dataHTML(cal, e){
  const d = dataDi(cal, e.giorno);
  return `<fieldset class="cal-data"><legend>${e.ripeti ? "Prima volta" : "Data"}</legend>
    <input id="cal-ev-dg-${e.id}" type="number" min="1" max="${cal.mesi[d.mese].giorni}" value="${d.giorno}"
      inputmode="numeric" aria-label="Giorno" onchange="calEventoData('${e.id}')">
    <select id="cal-ev-dm-${e.id}" aria-label="Mese" onchange="calEventoData('${e.id}')">
      ${cal.mesi.map((_, i) => `<option value="${i}"${i === d.mese ? " selected" : ""}>${escapeHtml(nomeMese(cal, i))}</option>`).join("")}
    </select>
    <input id="cal-ev-da-${e.id}" type="number" min="${cal.annoIniziale}" max="${CALENDARIO_LIMITI.annoAbs}" value="${d.anno}"
      inputmode="numeric" aria-label="Anno" onchange="calEventoData('${e.id}')">
  </fieldset>`;
}

/* Ogni quanto si ripete. La prima volta resta il giorno in cui l'evento è
   stato messo: modificarlo da un'occorrenza qualunque cambia l'evento
   intero, e il suggerimento lo dice. */
const UNITA_UNA = {giorni:"giorno", settimane:"settimana", mesi:"mese", anni:"anno"};
function ripetiHTML(cal, e){
  const r = e.ripeti;
  const nomi = {giorni:"Ogni giorno", settimane:"Ogni settimana", mesi:"Ogni mese", anni:"Ogni anno"};
  return `<div class="cal-ripeti">
    <label for="cal-ev-r-${e.id}">Si ripete</label>
    <select id="cal-ev-r-${e.id}" onchange="calRipeti('${e.id}',this.value)">
      <option value=""${r ? "" : " selected"}>No</option>
      ${RIPETI_UNITA.map(u => `<option value="${u}"${r?.unita === u ? " selected" : ""}>${nomi[u]}</option>`).join("")}
    </select>
    ${r ? `<span class="cal-ogni"><label for="cal-ev-o-${e.id}">ogni</label>
      <input id="cal-ev-o-${e.id}" type="number" min="1" max="${CALENDARIO_LIMITI.ripetiOgni}" value="${r.ogni}"
        inputmode="numeric" onchange="calRipetiOgni('${e.id}',this.value)">
      <span>${r.ogni === 1 ? UNITA_UNA[r.unita] : r.unita}</span></span>
      <p class="hint-sm">Dal ${escapeHtml(formattaData(cal, e.giorno))}, ${escapeHtml(ricorrenzaTesto(e))}.
        Le modifiche valgono per tutte le volte.</p>` : ""}
  </div>`;
}

/* A quale bolla appartiene: un luogo, un PNG, una quest. Dal pannello di
   quella bolla l'evento si ritrova, e al tavolo porta alla mappa se la bolla
   è rivelata. Un legame a una bolla eliminata resta scelto e lo dice. */
function legameHTML(e, legabili){
  const n = bollaDi(e);
  const opzioni = legabili.map(({n: b, genitore}) => `<option value="${b.id}"${b.id === e.nodeId ? " selected" : ""}>${
    escapeHtml(nomeBolla(b))}${genitore ? ` · ${escapeHtml(genitore.title || "")}` : ""}</option>`).join("");
  return `<div class="cal-legame">
    <label for="cal-ev-b-${e.id}">Bolla</label>
    <span class="cal-legame-riga">
      <select id="cal-ev-b-${e.id}" onchange="calEvento('${e.id}','nodeId',this.value)">
        <option value=""${e.nodeId ? "" : " selected"}>Nessuna</option>
        ${e.nodeId && !n ? `<option value="${e.nodeId}" selected>(bolla eliminata)</option>` : ""}
        ${opzioni}
      </select>
      ${n ? `<button type="button" class="btn" onclick="goToNode('${n.id}')"
        aria-label="Mostra sulla mappa: ${escapeHtml(nomeBolla(n))}">Mostra sulla mappa</button>` : ""}
    </span>
  </div>`;
}

/* Gli eventi legati a una bolla, per il suo pannello: la prossima volta che
   cadono (o l'ultima, se sono passati) e un bottone per aprirli nel
   calendario. Al tavolo arrivano solo quelli visibili, e solo il legame
   alle bolle rivelate: è la proiezione a deciderlo, qui non si filtra. */
export function eventiBollaHTML(n){
  const stato = st.state;
  if(RO && !stato.calendario) return "";
  const cal = calendarioDi(stato);
  const suoi = cal.eventi.filter(e => e.nodeId === n.id)
    .map(e => ({e, g: prossimaOccorrenza(cal, e, cal.oggi) ?? e.giorno}))
    .sort((a, b) => a.g - b.g);
  if(RO && !suoi.length) return "";
  return `<div class="field"><label>Nel calendario</label>
    ${suoi.length ? `<div class="child-list">${suoi.map(({e, g}) => `<button type="button" class="cal-prossimo"
        onclick="calApriGiorno(${g})">
        <span class="cal-prossimo-data">${escapeHtml(formattaData(cal, g))}</span>
        <span class="cal-prossimo-titolo">${escapeHtml(etichetta({tipo:"evento", e}))}</span>
        <span class="q-scad s-${g === cal.oggi ? "oggi" : g < cal.oggi ? "fatta" : "lontana"}">${
          escapeHtml(e.ripeti ? `${distanzaTesto(cal.oggi, g)} · ${ricorrenzaTesto(e)}` : distanzaTesto(cal.oggi, g))}</span>
      </button>`).join("")}</div>` : ""}
    ${RO ? "" : `<button class="btn" onclick="calNuovoEventoPer('${n.id}')">+ Evento per questa bolla</button>
      ${suoi.length ? "" : `<p class="hint-sm">Un evento legato qui si ritrova da questo pannello e porta alla bolla dal calendario.</p>`}`}
  </div>`;
}

/* I prossimi giorni che contano, da oggi in avanti, più le quest scadute e
   non ancora fatte: sono quelle che il DM rischia di dimenticare. */
function prossimiHTML(cal){
  const lista = [];
  for(const q of scadenzeQuest())
    if(q.scadenza >= cal.oggi || q.status !== "fatto") lista.push({g:q.scadenza, v:{tipo:"scadenza", q}});
  for(const e of cal.eventi){
    const g = prossimaOccorrenza(cal, e, cal.oggi);
    if(g !== null) lista.push({g, v:{tipo:"evento", e}});
  }
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
export function calNuovoEvento(nodeId){
  let id;
  modifica(cal => {
    if(cal.eventi.length >= CALENDARIO_LIMITI.eventi) return;
    id = uid();
    cal.eventi.push({id, giorno: scelto, titolo: "", ...(nodeId ? {nodeId} : {})});
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
    if(chiave === "nodeId"){ if(valore) e.nodeId = String(valore); else delete e.nodeId; }
  });
}
/* Sposta l'evento alla data dei tre campi, e la vista lo segue: sennò
   sparirebbe dal giorno scelto proprio mentre lo si sta scrivendo. */
export function calEventoData(id){
  const v = k => document.getElementById(`cal-ev-${k}-${id}`)?.value;
  modifica(cal => {
    const e = cal.eventi.find(x => x.id === id);
    const mese = intero(v("dm"), 0, cal.mesi.length - 1);
    const anno = intero(v("da"), cal.annoIniziale, CALENDARIO_LIMITI.annoAbs);
    const giorno = intero(v("dg"), 1, CALENDARIO_LIMITI.giorniMese);
    if(!e || mese === null || anno === null || giorno === null) return;
    e.giorno = Math.min(CALENDARIO_LIMITI.giornoMax, giornoDi(cal, anno, mese, giorno));
    vaiA(cal, e.giorno);
  });
}
export function calRipeti(id, unita){
  modifica(cal => {
    const e = cal.eventi.find(x => x.id === id);
    if(!e) return;
    if(RIPETI_UNITA.includes(unita)) e.ripeti = {ogni: e.ripeti?.ogni || 1, unita};
    else delete e.ripeti;
  });
}
export function calRipetiOgni(id, valore){
  const n = intero(valore, 1, CALENDARIO_LIMITI.ripetiOgni);
  modifica(cal => {
    const e = cal.eventi.find(x => x.id === id);
    if(e?.ripeti && n) e.ripeti.ogni = n;
  });
}
/* Dal pannello di una bolla: il calendario, sul giorno dell'evento. */
export function calApriGiorno(g){
  vaiA(calendarioDi(st.state), g);
  showView("cal");
  document.getElementById("cal-giorno-titolo")?.focus();
}
/* Dal pannello di una bolla: un evento oggi, già legato, col titolo pronto
   da scrivere. La data si cambia lì sotto, nei campi dell'evento. */
export function calNuovoEventoPer(nodeId){
  if(RO) return;
  const cal = calendarioDi(st.state);
  vaiA(cal, cal.oggi);
  showView("cal");
  calNuovoEvento(nodeId);
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
  calEliminaEvento, calEventoData, calRipeti, calRipetiOgni, calApriGiorno, calNuovoEventoPer, calMeseCampo, calMeseSposta, calMeseTogli, calMeseAggiungi, calSettimana, calAnno,
  calEra, calStrutturaToggle,
});

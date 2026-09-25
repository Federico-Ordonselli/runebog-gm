/* Il pannello di dettaglio: la scheda del blocco/collegamento selezionato,
   le modifiche che ne partono (editNode, editEdge, immagini) e la variante
   bottom sheet su mobile. */

import { avvolgi, prefissaRighe } from "./testo-ricco.js";
import { TYPES, STATUSES, SHAPES, EDGE_TYPES, NODE_COLORS, nodeColor,
         isMarker, isTesto, testoSize, testoAllinea, testoAdatta, TESTO_ALLINEA, TESTO_SIZE_MAX, nomeInElenco, TESTO_SIZES, defShape, nodeBox, node, escapeHtml, escapeAttr,
         wallShape, inScala, DOOR_TYPES, doorKind, wallLabel,
         GRIGLIE, GRID_LIMITS, grigliaDi, isHex, nomeCelle, formattaMetri, normalizzaTaglia, TAGLIA_MAX,
         SCHEDA_TIPI, schedaDi, FOGLI, foglioDi, TESTO_SIZE_NOMI } from "./modello.js";
import { preferenza } from "./preferenze.js";
import { st, save, findNode, findParent, removeNode, currentNode, RO } from "./stato.js";
import { openConfirm } from "./viste.js";
import { renderMap, renderCrumbs, renderCanvas, bgEdit, isEmptyNode, doDeleteNodes,
         wallOf, misuraMuro, deleteWallSeg, adattaTesto, inserisciNelMuro, cellaToccata } from "./mappa.js";
import { statblockHTML } from "./mostri.js";
import { scadenzaDi, assicuraCalendario } from "./calendario.js";
import { calendarioDi, formattaData } from "./calendario-conti.js";
import { CALENDARIO_LIMITI } from "./formato-campagna.js";

/* Una forma in scala si legge in celle e metri della maglia del suo livello:
   i pixel non dicono niente al tavolo. */
const labelScala = (box, g) => {
  const q = v => (v/g.cella).toLocaleString("it-IT",{maximumFractionDigits:2});
  const m = v => formattaMetri(v/g.cella*g.metri);
  return `${q(box.w)}×${q(box.h)} ${GRIGLIE[g.forma].unita[1]} · ${m(box.w)} × ${m(box.h)}`;
};

/* La maglia del livello aperto, nel pannello del livello: forma, lato della
   cella in px e metri per cella. Il lato è in px perché serve ad allineare la
   maglia allo sfondo caricato, che è misurato in px; i metri sono quello che
   il righello e la barra della scala dicono al tavolo. */
/* La taglia di un segnalino: quanti quadretti occupa per lato. I quattro
   bottoni sono le taglie delle creature, il campo arriva a TAGLIA_MAX per i
   PNG da leggere su una mappa larga. Lo stesso lo fa la maniglia sulla tela. */
function tagliaHTML(n){
  const t = normalizzaTaglia(n.taglia);
  const nomi = ["Normale","Grande","Enorme","Mastodontica"];
  return `<div class="field"><label for="taglia-num">Taglia</label>
    <div class="img-actions scelte">${nomi.map((nome, i)=>`<button class="btn${t===i+1?" primary":""}"
      aria-pressed="${t===i+1}" onclick="impostaTaglia('${n.id}',${i+1})">${nome}</button>`).join("")}
      <input id="taglia-num" type="number" min="1" max="${TAGLIA_MAX}" step="1" value="${t}" style="width:4.5em"
        aria-label="Quadretti per lato" onchange="impostaTaglia('${n.id}',this.value)"></div>
    <p class="hint-sm">Quadretti per lato: ${t}×${t}. Nome e sigla crescono con il segnalino;
      si può anche tirare l'angolo in basso a destra sulla mappa.</p></div>`;
}

function grigliaHTML(cur){
  const g = grigliaDi(cur), L = GRID_LIMITS;
  const forme = Object.entries(GRIGLIE)
    .map(([k,v])=>`<option value="${k}" ${k===g.forma?"selected":""}>${v.label}</option>`).join("");
  const num = v => String(v).replace(".", ",");
  return `<details class="field" data-sec="griglia" ontoggle="secToggle(this)"${secOpen("griglia")}>
    <summary>Griglia</summary>
    <label for="griglia-forma">Forma</label>
    <select id="griglia-forma" onchange="impostaGriglia('forma',this.value)">${forme}</select>
    <div class="row" style="margin-top:10px">
      <div class="field"><label for="griglia-cella">Lato cella (px)</label>
        <input id="griglia-cella" type="number" inputmode="decimal" min="${L.cellaMin}" max="${L.cellaMax}" step="1"
          value="${g.cella}" onchange="impostaGriglia('cella',this.value)"></div>
      <div class="field"><label for="griglia-metri">Metri per cella</label>
        <input id="griglia-metri" type="text" inputmode="decimal" value="${num(g.metri)}"
          onchange="impostaGriglia('metri',this.value)"></div>
    </div>
    <p class="hint-sm">${escapeHtml(`${nomeCelle(g, 1)} = ${formattaMetri(g.metri)}.`)}
      ${isHex(g)
        ? "Segnalini e pedine si agganciano al centro degli esagoni; righello e aree d'effetto contano in esagoni. Piante e muri restano liberi."
        : "Piante e muri si agganciano agli incroci, segnalini e pedine al centro dei quadretti."}
      Vale solo per questo livello.</p>
  </details>`;
}
import { tokenLink } from "./battaglia.js";

/* Sezioni richiudibili (<details>) del pannello: lo stato di apertura vive qui,
   fuori dal DOM, perché ogni renderDetail ricostruisce l'innerHTML da zero e
   l'attributo open andrebbe perso. `force` riapre le sezioni che in quel momento
   hanno qualcosa da mostrare (un'immagine caricata, lo sfondo in modifica). */
const openSecs = new Set();
export function secOpen(key, force=false){ return (force || openSecs.has(key)) ? " open" : ""; }
export function secToggle(el){
  if(el.open) openSecs.add(el.dataset.sec); else openSecs.delete(el.dataset.sec);
}
/* Aprire una sezione da fuori, per chi ci ha appena messo dentro qualcosa:
   `force` di secOpen risponde a una condizione dello stato ("c'è un'immagine"),
   e non sa distinguere "il mostro c'era già" da "il mostro è arrivato ora".
   Riempire una sezione chiusa senza aprirla è indistinguibile dal non far
   niente — è il caso di applySRD (mostri.js), dove il DM ha appena scelto una
   scheda e deve vedere che è arrivata. */
export function secShow(key){ openSecs.add(key); }

/* Il nome di un'immagine di riferimento sta in un posto solo, perché i posti
   che lo dicono sono tre: l'alt della miniatura, l'etichetta del bottone che
   la ingrandisce e l'alt dell'immagine dentro il lightbox.

   Attenzione a quale dei tre viene letto davvero: la miniatura sta DENTRO un
   <button>, e un aria-label sul bottone copre il contenuto — l'alt della
   miniatura non viene annunciato. Correggere il solo alt, come diceva la voce
   dell'audit, non avrebbe cambiato niente all'ascolto: a portare il nome
   dev'essere l'etichetta del bottone. L'alt resta comunque descrittivo perché
   è ciò che si legge quando l'immagine non carica (una campagna importata con
   un base64 troncato), e lì il bottone è vuoto. */
const nomeImmagine = n => `Immagine di riferimento di ${n.title || "(senza nome)"}`;
function imgZoomMarkup(n){
  return `<button class="img-zoom" onclick="openLightbox('${n.id}')"
      aria-label="Ingrandisci: ${escapeHtml(nomeImmagine(n))}">
      <img id="detail-img" src="${n.img}" alt="${escapeHtml(nomeImmagine(n))}">
    </button>`;
}

/* Il pannello del tavolo. È una funzione a parte, e non un renderDetail() pieno di
   `if(RO)`: quello che i giocatori vedono deve poter essere letto tutto insieme, in
   venti righe, senza inseguire condizioni sparse dentro duecento. */
function renderTableDetail(aside){
  const n = (st.selectedId && findNode(st.selectedId)) || currentNode();
  const t = TYPES[n.type] || TYPES.nota;
  const c = n.combat;

  const childRows = n.children.map(k=>{
    const kc = nodeColor(k);
    return `<div class="child" onclick="jumpTo('${n.id}','${k.id}')">
      <span class="type-badge" style="background:${kc}"></span>${escapeHtml(k.title||"(senza nome)")}
    </div>`;
  }).join("");

  const nulla = !n.notes && !n.img && !c && !n.children.length;

  aside.innerHTML = `<div class="inner">
    <div>
      <span style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${t.color}">
        <span class="type-badge" style="background:${t.color}"></span>${t.label}
      </span>
      <h2>${escapeHtml(n.title||"(senza nome)")}</h2>
    </div>

    ${n.notes ? `<div class="field"><label>Descrizione</label>
      <div class="ro-text">${escapeHtml(n.notes)}</div></div>` : ""}

    ${n.img ? `<div class="field"><label>Immagine</label>
      ${imgZoomMarkup(n)}
    </div>` : ""}

    ${n.type==="quest" && Number.isInteger(n.scadenza) ? `<div class="field"><label>Scadenza</label>
      <div class="ro-text">${escapeHtml(formattaData(calendarioDi(st.state), n.scadenza))} ·
        <span class="q-scad s-${scadenzaDi(n).stato}">${escapeHtml(scadenzaDi(n).testo)}</span></div></div>` : ""}

    ${c ? `<div class="field"><label>Combattimento</label>
      <div class="foe-head"><span>${c.alive}/${c.total} in vita</span></div>
      ${c.foes.map(f=>`<div class="foe-ro">
        <span>${escapeHtml(f.name)}</span>
        <span class="foe-state s-${f.state.replace(/\s/g,"-")}">${f.state}</span>
      </div>`).join("")}
    </div>` : ""}

    ${n.children.length ? `<div class="field"><label>Cosa c'è qui (${n.children.length})</label>
      <div class="child-list">${childRows}</div></div>` : ""}

    ${nulla ? `<p class="empty" style="padding:20px 0">Il DM non ha ancora svelato niente
      di questo posto.</p>` : ""}
  </div>`;
}

function renderDetailCore(){
  const aside = document.getElementById("detail");
  if(RO) return renderTableDetail(aside);
  const cur = currentNode();

  /* Selezione multipla: si contano insieme bolle e muri, perché il pannello
     deve descrivere quello che il prossimo gesto sposta o elimina — e quello è
     l'insieme, non una delle due metà. Sta prima del pannello del muro singolo:
     un muro fra dieci selezionati non è "il muro selezionato". */
  if(st.multiSel.size + st.multiSelWalls.size > 1){
    const nodes = [...st.multiSel].map(id=>findNode(id)).filter(Boolean);
    const muri = [...st.multiSelWalls].map(id=>wallOf(id)).filter(Boolean);
    const tot = nodes.length + muri.length;
    aside.innerHTML = `<div class="inner">
      <div><h2>${tot} element${tot===1?"o":"i"} selezionat${tot===1?"o":"i"}</h2></div>
      <div class="field"><div class="child-list">${
        nodes.map(x=>`<div class="child">
          <span class="type-badge" style="background:${nodeColor(x)}"></span>${escapeHtml(x.title||"(senza nome)")}
        </div>`).join("") +
        muri.map(w=>`<div class="child">
          <span class="type-badge" style="background:var(--ink-dim)"></span>${escapeHtml(wallLabel(w))} · ${escapeHtml(misuraMuro(w))}
        </div>`).join("")}</div></div>
      <p style="color:var(--ink-dim);font-size:12px;line-height:1.5">
        Trascina uno qualsiasi per spostarli insieme · Frecce per spostarli di un quadretto ·
        Ctrl+D per duplicarli · Canc per eliminarli · Esc per deselezionare
      </p>
      <div class="detail-actions">
        <button class="btn danger" onclick="requestDeleteSelection()">Elimina selezionati</button>
      </div>
    </div>`;
    return;
  }

  /* Pannello di un muro. Non ha campi da riempire — un muro non ha nome, note
     né stato: è geometria. Quello che serve saperne è quanto è lungo, quello
     che serve deciderne è se è pieno o è una porta, e quello che serve poterci
     fare è toglierlo. Il resto si fa col dito sulla mappa. */
  if(st.selectedWallId){
    const w = wallOf(st.selectedWallId);
    if(!w){ st.selectedWallId = null; }
    else{
      const kind = doorKind(w);
      const tipoOpts = `<option value="" ${kind?"":"selected"}>Muro pieno</option>` +
        Object.entries(DOOR_TYPES)
          .map(([k,d])=>`<option value="${k}" ${k===kind?"selected":""}>${d.label}</option>`).join("");
      aside.innerHTML = `<div class="inner">
        <div>
          <span style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-dim)">
            <span class="type-badge" style="background:var(--ink-dim)"></span>Muro
          </span>
          <h2>${escapeHtml(wallLabel(w))}</h2>
        </div>
        <p class="hint-sm">${w.dir==="v" ? "Verticale" : "Orizzontale"} · ${escapeHtml(misuraMuro(w))}</p>
        ${w.len > 1 ? `<div class="field"><label>Metti nel quadretto evidenziato</label>
          <div class="img-actions scelte">${Object.entries(DOOR_TYPES).map(([k,d])=>`<button class="btn"
            onclick="inserisciNelMuro('${w.id}','${k}')">${d.label}</button>`).join("")}</div>
          <p class="hint-sm">Il muro si spezza e al posto del quadretto ${cellaToccata(w)+1} di ${w.len}
            (quello che hai toccato, in oro) compare il vano. Per sceglierne un altro, tocca il muro lì.</p></div>` : ""}
        <div class="field"><label>${w.len > 1 ? "Tutto il muro" : "Tipo"}</label>
          <select onchange="setWallDoor('${w.id}',this.value)">${tipoOpts}</select>
          ${kind==="segreta"?`<p class="hint-sm">Resta tua: al tavolo questo pezzo esce come
            muro pieno, non come porta da cercare. Quando i giocatori la trovano, cambia
            il tipo in aperta o chiusa.</p>`:""}</div>
        <p class="hint-sm">Trascina il muro per spostarlo, i due capi per allungarlo
          o girarlo. Le frecce lo spostano di un quadretto. Con “Muro” della palette
          armato, tieni premuto e trascina per tracciarne tanti di fila.</p>
        <div class="detail-actions">
          <button class="btn danger" onclick="deleteWallSeg('${w.id}')">Elimina muro</button>
        </div>
      </div>`;
      return;
    }
  }

  // pannello di un collegamento selezionato
  if(st.selectedEdgeId){
    const e = (cur.edges||[]).find(x=>x.id===st.selectedEdgeId);
    if(!e){ st.selectedEdgeId = null; }
    else{
      const a = findNode(e.a), b = findNode(e.b);
      const et = EDGE_TYPES[e.type]||EDGE_TYPES.strada;
      const typeOpts = Object.entries(EDGE_TYPES)
        .map(([k,v])=>`<option value="${k}" ${k===e.type?"selected":""}>${v.label}</option>`).join("");
      aside.innerHTML = `<div class="inner">
        <div>
          <span style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${et.stroke}">
            <span class="type-badge" style="background:${et.stroke}"></span>Collegamento
          </span>
          <h2>${escapeHtml(a?.title||"(senza nome)")} ↔ ${escapeHtml(b?.title||"(senza nome)")}</h2>
        </div>
        <div class="field"><label>Tipo</label>
          <select onchange="editEdge('${e.id}','type',this.value)">${typeOpts}</select>
          ${et.dmOnly?`<p class="hint-sm">Resta tuo: al tavolo questo collegamento non compare,
            anche quando i giocatori vedono le bolle alle due estremità. Quando lo scoprono,
            cambia il tipo in strada o tunnel.</p>`:""}</div>
        <div class="field"><label>Percorso</label>
          ${e.percorso?.length
            ? `<div class="img-actions"><button class="btn" onclick="raddrizzaEdge('${e.id}')">Raddrizza</button></div>
               <p class="hint-sm">Disegnato a mano: segue le bolle quando le sposti.
                 Per cambiarlo, ritraccialo dalla maniglia ◦ di una delle due bolle all'altra.</p>`
            : `<p class="hint-sm">Dritto. Per dargli una forma, ritraccialo dalla maniglia ◦ di una
                 delle due bolle all'altra seguendo il percorso che vuoi: curve e spigoli restano, ammorbiditi.</p>`}</div>
        <div class="field"><label>Etichetta (visibile sulla pianta)</label>
          <input value="${escapeAttr(e.label||"")}" oninput="editEdge('${e.id}','label',this.value)" placeholder="Es. Via del Mercato"></div>
        <div class="field"><label>Note</label>
          <textarea oninput="editEdge('${e.id}','notes',this.value)" placeholder="Macerie, posto di blocco, encounter legato alla strada…">${escapeHtml(e.notes||"")}</textarea></div>
        <div class="detail-actions">
          <button class="btn danger" onclick="deleteEdge('${e.id}')">Elimina collegamento</button>
        </div>
      </div>`;
      return;
    }
  }

  const sel = st.selectedId ? findNode(st.selectedId) : null;
  const n = sel || cur;
  const isRoot = (n.id === st.state.root.id);
  const t = TYPES[n.type] || TYPES.nota;
  // Una pedina collegata non ha un titolo proprio: mostrarne il campo inviterebbe
  // a scriverci un nome che il disegno poi ignora, perché legge la fonte.
  const link = n.type === "token" ? tokenLink(n) : null;
  if(sel && isTesto(n)){ aside.innerHTML = testoDetailHTML(n); return; }
  // La bolla si misura nella maglia del livello su cui sta, che per il livello
  // aperto è quella del genitore.
  const gN = grigliaDi(findParent(n.id) || cur), C = gN.cella, scala = inScala(n, gN);

  // "Testo" non è fra i tipi in cui trasformare una bolla: una bolla con dei
  // figli diventerebbe una scritta in cui non si entra più, e quei figli
  // resterebbero nel documento senza una strada per raggiungerli.
  const typeOpts = Object.entries(TYPES).filter(([k])=>k!=="testo")
    .map(([k,v])=>`<option value="${k}" ${k===n.type?"selected":""}>${v.label}</option>`).join("");
  const statusOpts = STATUSES
    .map(s=>`<option value="${s}" ${s===n.status?"selected":""}>${s||"—"}</option>`).join("");
  const shapeOpts = Object.entries(SHAPES)
    .map(([k,v])=>`<option value="${k}" ${(n.shape||defShape(n))===k?"selected":""}>${v.label}</option>`).join("");
  /* La radice non ha una "forma sulla pianta" — nessuno la disegna: si è dentro.
     Ha però una SCALA, ed è un dato vero da quando la campagna può crescere
     verso l'alto: è lei a dire cosa crea lo zoom indietro (SCALA_TERRITORIO in
     modello.js), ed è l'unico modo di dichiarare che una campagna comincia già
     mondo senza doverci arrivare a gradini. Solo territori: una radice
     "stanza" direbbe che la campagna intera è una stanza. */
  const scalaOpts = Object.entries(SHAPES).filter(([,v])=>v.territorio)
    .map(([k,v])=>`<option value="${k}" ${(n.shape||defShape(n))===k?"selected":""}>${v.label}</option>`).join("");

  const childRows = n.children.map(c=>{
    const cc = nodeColor(c);
    return `<div class="child" onclick="jumpTo('${n.id}','${c.id}')">
      <span class="type-badge" style="background:${cc}"></span>${escapeHtml(nomeInElenco(c))}
      ${c.status?`<span class="st">${c.status}</span>`:""}
    </div>`;
  }).join("");

  aside.innerHTML = `<div class="inner">
    <div>
      <span style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${t.color}">
        <span class="type-badge" style="background:${t.color}"></span>${t.label}${sel?"":" (livello corrente)"}
      </span>
      <h2>${escapeHtml(link ? link.nome : (n.title||"(senza nome)"))}</h2>
    </div>

    ${link ? `<div class="field link-field">
      <label>Pedina collegata</label>
      <p class="hint-sm">Rappresenta <b>${escapeHtml(link.nome)}</b>${link.hpMax>0?` — ${link.hp}/${link.hpMax} PF`:""}.
        Nome e PF li tiene ${link.pg?"la scheda del giocatore":"la scheda del mostro"}: cambiali lì,
        qui cambiano da soli. Rimuovere la pedina non tocca la creatura.</p>
    </div>` : `
    <div class="field"><label>Titolo</label>
      <input value="${escapeAttr(n.title)}" oninput="editNode('${n.id}','title',this.value)"></div>`}

    <!-- Subito sotto il nome, e non in fondo: un encounter selezionato durante
         una sessione lo si apre per i PF, non per la larghezza in pixel. Il
         resto del pannello (tipo, note, colore) è preparazione, e la
         preparazione può stare sotto — al tavolo non si scorre. -->
    ${n.type==="encounter" ? statblockHTML(n) : ""}

    <div class="row">
      <div class="field"><label>Tipo</label>
        <select onchange="editNode('${n.id}','type',this.value)" ${isRoot?"disabled":""}>${typeOpts}</select></div>
      <div class="field"><label>Stato</label>
        <select onchange="editNode('${n.id}','status',this.value)">${statusOpts}</select></div>
    </div>

    ${isMarker(n) && !isRoot ? tagliaHTML(n) : ""}

    ${isRoot && !isMarker(n) ? `<div class="field"><label>Scala</label>
      <select onchange="editNode('${n.id}','shape',this.value)">${scalaOpts}</select>
      <p class="hint-sm">Quanto è larga la campagna, e cosa crea lo zoom indietro:
        il gradino subito sopra questo. Un mondo non ha niente sopra.</p></div>` : ""}

    ${!isMarker(n) && !isRoot ? `<div class="field"><label>Forma sulla pianta</label>
      <select onchange="editNode('${n.id}','shape',this.value)">${shapeOpts}</select></div>
    <div class="row">
      <div class="field"><label>Larghezza</label>
        <input type="number" step="${scala?C:10}" min="${scala?C:40}" value="${nodeBox(n).w}"
          onchange="editNode('${n.id}','w',${scala
            ? `Math.max(${C},Math.round((parseFloat(this.value)||${C})/${C})*${C})`
            : `Math.max(40,parseInt(this.value)||40)`})"></div>
      <div class="field"><label>Altezza</label>
        <input type="number" step="${scala?C:10}" min="${scala?C:30}" value="${nodeBox(n).h}"
          onchange="editNode('${n.id}','h',${scala
            ? `Math.max(${C},Math.round((parseFloat(this.value)||${C})/${C})*${C})`
            : `Math.max(30,parseInt(this.value)||30)`})"></div>
    </div>
    ${scala?`<p class="hint-sm">${labelScala(nodeBox(n), gN)}</p>`:""}
    ${SHAPES[n.shape||defShape(n)]?.walls ? `<div class="opt">
      <label><input type="checkbox" ${wallShape(n)?"checked":""}
        onchange="editNode('${n.id}','walls',this.checked)"> Muri e porte</label>
      <p class="hint-sm">Le porte si aprono da sole dove passa un collegamento;
        un passaggio segreto lascia il muro chiuso.</p>
    </div>` : ""}` : ""}

    ${SCHEDA_TIPI.has(n.type) && !isRoot ? schedaDetailHTML(n) : `<div class="field"><label>Note <span class="only-dm">solo tue</span></label>
      <textarea oninput="editNode('${n.id}','notes',this.value)" placeholder="Dettagli, agganci, statistiche mostri, letture ad alta voce…">${escapeHtml(n.notes)}</textarea></div>`}

    <div class="field share-field">
      <label>Al tavolo</label>
      ${isRoot ? `<p class="hint-sm">La radice della campagna è sempre visibile: è il contenitore.</p>`
        : `<button class="btn ${n.shared?"primary":""}" onclick="revealNode('${n.id}',${n.shared?"false":"true"})">
             ${n.shared ? "👁 Visibile ai giocatori" : "Rivela ai giocatori"}
           </button>
           <p class="hint-sm">${n.shared
             ? "I giocatori lo vedono sulla mappa condivisa. Le note qui sopra restano tue."
             : "Nascosto. Rivelandolo si rivelano anche i livelli che lo contengono: servono per raggiungerlo."}</p>`}
      <label style="margin-top:10px">Descrizione per i giocatori</label>
      <textarea oninput="editNode('${n.id}','playerNotes',this.value)"
        placeholder="Cosa vedono al tavolo. Vuoto = non leggono niente.">${escapeHtml(n.playerNotes||"")}</textarea>
    </div>

    ${!isRoot ? `<div class="field"><label>Colore</label>
      <div class="swatches">
        <!-- "Predefinito" per primo e con la spunta quando non c'è scelta esplicita:
             senza, il colore personalizzato sarebbe una porta a senso unico. Il
             campione mostra il default vero di questa forma, non un grigio finto. -->
        <button class="swatch swatch--auto${n.color?"":" on"}" style="background:${nodeColor({...n, color:null})}"
          title="Predefinito della forma" aria-label="Colore predefinito"
          onclick="editNode('${n.id}','color',null)"></button>
        ${NODE_COLORS.map(cc=>`<button class="swatch${n.color===cc?" on":""}"
          style="background:${cc}" aria-label="Colora di ${cc}"
          onclick="editNode('${n.id}','color','${cc}')"></button>`).join("")}
      </div></div>` : ""}

    ${n.type==="quest" ? `<div class="field"><label>Diario</label>
      <button class="btn ${n.main?"primary":""}" onclick="editNode('${n.id}','main',${n.main?"false":"true"})">
        ★ ${n.main?"Quest principale":"Segna come principale"}</button></div>` : ""}

    ${n.type==="quest" ? scadenzaHTML(n) : ""}

    ${!sel && !RO ? grigliaHTML(cur) : ""}

    ${!sel && !isMarker(n) ? `<details class="field" data-sec="bg" ontoggle="secToggle(this)"${secOpen("bg", bgEdit)}>
      <summary>Sfondo della pianta</summary>
      <div class="img-actions">
        <button class="btn" onclick="pickBg()">${cur.bg?"Sostituisci":"Carica"} sfondo</button>
        ${cur.bg?`<button class="btn ${bgEdit?"primary":""}" onclick="toggleBgEdit()">${bgEdit?"Fatto":"Sposta/Ridim."}</button>
        <button class="btn danger" onclick="removeBg()">Rimuovi</button>`:""}
      </div>
      ${cur.bg?`<label style="margin-top:10px">Opacità sfondo</label>
      <input type="range" min="0.1" max="1" step="0.05" value="${cur.bg.opacity ?? 0.6}" oninput="setBgOpacity(this.value)">`:""}
    </details>

    <details class="field" data-sec="dungeon" ontoggle="secToggle(this)"${secOpen("dungeon")}>
      <summary>Generatore di dungeon</summary>
      <div class="img-actions">
        <button class="btn primary" onclick="apriGeneratoreDungeon()">Genera un dungeon…</button>
        <button class="btn" onclick="pasteDungeon()">Incolla</button>
        <button class="btn" onclick="document.getElementById('dungeon-file').click()">Da file…</button>
      </div>
      <p class="hint-sm">Diventa una bolla in questo livello, con le stanze sulla pianta,
        gli incontri pronti per i PF e i tuoi PG come pedine all'ingresso.
        Incolla e Da file servono per un dungeon esportato dalla pagina del generatore.</p>
    </details>` : ""}

    <details class="field" data-sec="img" ontoggle="secToggle(this)"${secOpen("img", !!n.img)}>
      <summary>Mappa / immagine di riferimento</summary>
      ${n.img ? imgZoomMarkup(n) : ""}
      <div class="img-actions" style="margin-top:8px">
        <button class="btn" onclick="pickImage('${n.id}')">${n.img?"Sostituisci":"Carica"} immagine</button>
        ${n.img?`<button class="btn" onclick="apriInFinestra('${n.id}')"
          title="Una finestra a parte, da trascinare su un altro schermo">In finestra ↗</button>
        <button class="btn danger" onclick="editNode('${n.id}','img',null)">Rimuovi</button>`:""}
      </div>
    </details>

    ${n.children.length?`<div class="field"><label>Contenuto (${n.children.length})</label>
      <div class="child-list">${childRows}</div></div>`:""}

    <div class="detail-actions">
      <button class="btn primary" onclick="addChild('${n.id}')">+ Bolla dentro</button>
      ${sel?`<button class="btn" onclick="entra('${n.id}')">Entra →</button>`:""}
      ${!isRoot?`<button class="btn danger" onclick="askDeleteNode('${n.id}')">Elimina</button>`:""}
    </div>
  </div>`;
}

/* Il pannello di una casella di testo è un pannello a sé, come quello del
   tavolo: di una bolla le servono tre cose (testo, grandezza, colore), e
   nascondere le altre venti con degli `if` sparsi vorrebbe dire inseguirle
   ogni volta che se ne aggiunge una. */
/* Il foglio di una casella o di una scheda. La prima scelta è "nessuna
   scelta": la bolla segue le impostazioni di chi guarda, ed è il caso di
   quasi tutte — chi cambia foglio dalle impostazioni li cambia insieme. */
function sceltaFoglio(n){
  const cur = foglioDi(n);
  return `<div class="field"><label>Foglio</label>
    <div class="img-actions scelte">
      <button class="btn${cur?"":" primary"}" aria-pressed="${!cur}"
        onclick="editNode('${n.id}','foglio',undefined)">Predefinito (${FOGLI[preferenza("foglio")].toLowerCase()})</button>
      ${Object.entries(FOGLI).map(([k,v])=>`<button class="btn${k===cur?" primary":""}" aria-pressed="${k===cur}"
        onclick="editNode('${n.id}','foglio','${k}')">${v}</button>`).join("")}
    </div></div>`;
}

function testoDetailHTML(n){
  const size = testoSize(n), fit = testoAdatta(n), al = testoAllinea(n);
  const suCarta = (foglioDi(n) ?? preferenza("foglio")) !== "pulito";
  return `<div class="inner">
    <div>
      <span style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-dim)">
        <span class="type-badge" style="background:var(--ink)"></span>Casella di testo
      </span>
    </div>
    <div class="field"><label for="testo-area">Testo <span class="only-dm">solo tuo</span></label>
      ${barraFormattazione(n.id, "testo-area")}
      <textarea id="testo-area" rows="8" oninput="editNode('${n.id}','notes',this.value)"
        onkeydown="tastiTesto(event,'${n.id}')"
        placeholder="Quello che vuoi leggere a colpo d'occhio sulla mappa">${escapeHtml(n.notes||"")}</textarea>
      <p class="hint-sm">Si legge sulla mappa senza aprire niente. Al tavolo dei giocatori non compare.
        I bottoni scrivono dei segni nel testo: <code># titolo</code>, <code>- voce</code>,
        <code>1. voce</code>, <code>**grassetto**</code>, <code>*corsivo*</code>; due spazi davanti
        a una voce la rientrano.</p></div>
    <div class="opt"><label><input type="checkbox" ${fit?"checked":""}
        onchange="editNode('${n.id}','textFit',this.checked)"> Adatta il testo alla casella</label>
      <p class="hint-sm">${fit
        ? "Il carattere cresce e cala con la casella: tirane l'angolo in basso a destra finché si legge bene."
        : "La casella la allarghi e allunghi tirando l'angolo in basso a destra: il testo va a capo dentro, e se non ci sta la casella si allunga."}</p></div>
    ${fit ? "" : `<div class="field"><label for="testo-size">Carattere</label>
      <div class="img-actions scelte">${TESTO_SIZES.map((v,i)=>`<button class="btn${v===size?" primary":""}"
        aria-pressed="${v===size}" onclick="editNode('${n.id}','textSize',${v})"
        style="font-size:${11+Math.min(i,4)*2}px">${TESTO_SIZE_NOMI[i]}</button>`).join("")}
        <input id="testo-size" type="number" min="8" max="${TESTO_SIZE_MAX}" step="1" value="${size}" style="width:5.5em"
          aria-label="Grandezza in pixel" onchange="editNode('${n.id}','textSize',Number(this.value))"></div></div>`}
    <div class="field"><label>Allineamento</label>
      <div class="img-actions scelte">${Object.entries(TESTO_ALLINEA).map(([k,v])=>`<button class="btn${k===al?" primary":""}"
        aria-pressed="${k===al}" onclick="editNode('${n.id}','textAlign','${k}')">${v}</button>`).join("")}</div></div>
    ${sceltaFoglio(n)}
    ${suCarta ? `<p class="hint-sm">Sul foglio si scrive con l'inchiostro del foglio: il colore vale per la casella senza foglio.</p>` :
    `<div class="field"><label>Colore del testo</label>
      <div class="swatches">
        <button class="swatch swatch--auto${n.color?"":" on"}" style="background:var(--ink)"
          aria-label="Colore predefinito" onclick="editNode('${n.id}','color',null)"></button>
        ${NODE_COLORS.map(cc=>`<button class="swatch${n.color===cc?" on":""}"
          style="background:${cc}" aria-label="Colora di ${cc}"
          onclick="editNode('${n.id}','color','${cc}')"></button>`).join("")}
      </div></div>`}
    <div class="detail-actions">
      <button class="btn danger" onclick="askDeleteNode('${n.id}')">Elimina</button>
    </div>
  </div>`;
}

/* Le note di un segnalino con la scheda (SCHEDA_TIPI): sono la descrizione
   che si legge sulla mappa, quindi hanno la stessa barra della casella di
   testo e le stesse regole di carattere e allineamento. Il riquadro si
   ridimensiona dalla sua maniglia sulla tela; da qui si torna alle misure
   di partenza, cioè a un riquadro che segue il testo. */
function schedaDetailHTML(n){
  const s = schedaDi(n), fit = testoAdatta(n), al = testoAllinea(n);
  return `<div class="field"><label for="note-area">Descrizione <span class="only-dm">solo tua</span></label>
      ${barraFormattazione(n.id, "note-area")}
      <textarea id="note-area" rows="6" oninput="editNode('${n.id}','notes',this.value)"
        onkeydown="tastiTesto(event,'${n.id}')"
        placeholder="Chi è, cosa vuole, cosa sa. Si legge sulla mappa, sotto il segnalino.">${escapeHtml(n.notes)}</textarea>
      <p class="hint-sm">Si legge sulla mappa in una scheda sotto il segnalino; doppio clic sul
        segnalino per scriverci sul posto. Al tavolo non compare.</p></div>
    ${n.notes && n.notes.trim() ? `<details class="field" data-sec="scheda" ontoggle="secToggle(this)"${secOpen("scheda")}>
      <summary>Scheda sulla mappa</summary>
      <div class="opt"><label><input type="checkbox" ${fit?"checked":""}
          onchange="editNode('${n.id}','textFit',this.checked)"> Adatta il testo alla scheda</label></div>
      ${fit ? "" : `<div class="field"><label>Carattere</label>
        <div class="img-actions scelte">
          <button class="btn" onclick="cambiaCarattere('${n.id}',-1)" aria-label="Carattere più piccolo">A−</button>
          <button class="btn" onclick="cambiaCarattere('${n.id}',1)" aria-label="Carattere più grande">A+</button>
          <span class="hint-sm">${Math.round(s.px)} px</span>
          ${n.textSize!=null ? `<button class="btn" onclick="editNode('${n.id}','textSize',undefined)">Segue la taglia</button>` : ""}
        </div></div>`}
      <div class="field"><label>Allineamento</label>
        <div class="img-actions scelte">${Object.entries(TESTO_ALLINEA).map(([k,v])=>`<button class="btn${k===al?" primary":""}"
          aria-pressed="${k===al}" onclick="editNode('${n.id}','textAlign','${k}')">${v}</button>`).join("")}</div></div>
      ${sceltaFoglio(n)}
      ${n.scheda ? `<div class="img-actions">
        ${n.scheda.h ? `<button class="btn" onclick="editNode('${n.id}','scheda',{w:${s.w}})">Altezza secondo il testo</button>` : ""}
        <button class="btn" onclick="editNode('${n.id}','scheda',undefined)">Misure di partenza</button></div>` : ""}
    </details>` : ""}`;
}

/* La barra della formattazione: la stessa nel pannello (casella di testo,
   descrizione di un segnalino) e sopra la scrittura sul posto. `taId` è la
   textarea su cui lavora. Il mousedown non prende il focus, sennò la
   selezione nella textarea si perderebbe prima del clic. */
export function barraFormattazione(id, taId){
  const cmd = (c, label, title) =>
    `<button class="btn tiny" type="button" title="${title}" aria-label="${title}"
      onmousedown="event.preventDefault()" onclick="formattaTesto('${id}','${c}','${taId}')">${label}</button>`;
  return `<div class="testo-strumenti" role="toolbar" aria-label="Formattazione">
        ${cmd("b","<b>G</b>","Grassetto (Ctrl+B)")}${cmd("i","<i>C</i>","Corsivo (Ctrl+I)")}${cmd("s","<s>B</s>","Barrato")}
        <span class="sep"></span>
        ${cmd("t1","Titolo","Titolo")}${cmd("t2","Sottotitolo","Sottotitolo")}${cmd("t3","Intest.","Intestazione")}
        ${cmd("piccolo","<small>Piccolo</small>","Testo piccolo")}${cmd("p","Normale","Testo normale")}
        <span class="sep"></span>
        ${cmd("ul","• Elenco","Elenco puntato")}${cmd("ol","1. Elenco","Elenco numerato")}${cmd("hr","―","Linea di separazione")}
      </div>`;
}

/* Il carattere un gradino più grande o più piccolo (×1,2), partendo da
   quello che si vede: per una scheda senza scelta è quello della taglia. */
export function cambiaCarattere(id, verso){
  const n = findNode(id); if(!n || RO) return;
  const ora = isTesto(n) ? testoSize(n) : schedaDi(n).px;
  const px = Math.round(verso > 0 ? ora * 1.2 : ora / 1.2);
  editNode(id, "textSize", Math.max(8, Math.min(TESTO_SIZE_MAX, px === Math.round(ora) ? px + verso : px)));
}

/* I bottoni della formattazione lavorano sulla selezione della textarea e
   passano da editNode come una battitura: stesso salvataggio, stesso annulla. */
const SEGNI = {b:"**", i:"*", s:"~~"};
const PREFISSI = {t1:"# ", t2:"## ", t3:"### ", piccolo:"-# ", p:null, ul:"- ", ol:"1. "};
export function formattaTesto(id, c, taId = "testo-area"){
  const ta = document.getElementById(taId); if(!ta || RO) return;
  const v = ta.value, i = ta.selectionStart, f = ta.selectionEnd;
  let r;
  if(SEGNI[c]) r = avvolgi(v, i, f, SEGNI[c]);
  else if(c in PREFISSI) r = prefissaRighe(v, i, f, PREFISSI[c]);
  else if(c === "hr"){
    const prima = i && v[i-1] !== "\n" ? "\n" : "", ins = `${prima}---\n`;
    r = {testo: v.slice(0, i) + ins + v.slice(f), inizio: i + ins.length, fine: i + ins.length};
  }else return;
  ta.value = r.testo;
  ta.focus(); ta.setSelectionRange(r.inizio, r.fine);
  editNode(id, "notes", r.testo);
}
export function tastiTesto(ev, id){
  if(!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if(k === "b" || k === "i"){ ev.preventDefault(); formattaTesto(id, k, ev.target.id); }
}

/* --- pannello mobile (bottom sheet): sempre sincronizzato dopo ogni render --- */
export function openDetailSheet(){ st.detailOpen = true; renderDetail(); }
function closeDetailSheet(){
  st.detailOpen = false;
  document.getElementById("detail").classList.remove("open");
}
function mobileDetailSync(){
  const aside = document.getElementById("detail");
  if(!aside) return;
  if(!aside.querySelector(".sheet-close")){
    const b = document.createElement("button");
    b.className = "sheet-close btn tiny";
    b.textContent = "✕ Chiudi";
    b.onclick = closeDetailSheet;
    aside.prepend(b);
  }
  /* Su uno schermo stretto selezionare serve prima di tutto a operare sulla
     mappa: aprire automaticamente il foglio copriva il 62% della tela e, col
     long-press, lo sommava al menu contestuale. Il contenuto continua ad
     aggiornarsi dietro le quinte; ad aprirlo è solo un gesto esplicito. */
  aside.classList.toggle("open", st.detailOpen);
}
export function renderDetail(){
  renderDetailCore();
  mobileDetailSync();
}

/* ==================== modifiche dal pannello ==================== */
export function editNode(id, key, val){
  if(RO) return;
  const n = findNode(id); if(!n) return;
  // undefined toglie il campo: "segue la taglia", "misure di partenza"
  if(val === undefined) delete n[key]; else n[key] = val;
  if(key==="type" && !isMarker(n) && !n.shape) n.shape = defShape(n);
  save();
  if(["title","type","status","shape","w","h","color","walls"].includes(key)){ renderCrumbs(); renderCanvas(); }
  // il testo di una casella È il suo disegno, e così la descrizione di un
  // segnalino con la scheda; la textarea resta viva perché renderDetail qui
  // non gira
  else if((isTesto(n) || SCHEDA_TIPI.has(n.type)) && ["notes","textSize","textFit","textAlign","scheda","foglio"].includes(key)){
    renderCanvas(); if(isTesto(n)) adattaTesto(n);
  }
  if(["textSize","textFit","textAlign","scheda","foglio","scadenzaVisibile"].includes(key)) renderDetail();
  // la sezione "Scheda sulla mappa" compare col primo carattere e sparisce
  // col testo: si ridisegna solo a quel confine, sennò la textarea
  // perderebbe il focus a ogni battuta
  if(key==="notes" && SCHEDA_TIPI.has(n.type) && !isTesto(n)
     && !!String(val||"").trim() !== !!document.querySelector('#detail [data-sec="scheda"]')
     && document.activeElement?.id !== "note-area") renderDetail();
  // shape: cambiando forma cambia il colore predefinito, e il campione "Predefinito"
  // nel pannello deve seguirlo
  if(["type","img","main","color","shape"].includes(key)) renderDetail();
}

export function raddrizzaEdge(id){
  if(RO) return;
  const e = (currentNode().edges||[]).find(x=>x.id===id); if(!e) return;
  delete e.percorso;
  save(); renderCanvas(); renderDetail();
}

export function editEdge(id, key, val){
  if(RO) return;
  const cur = currentNode();
  const e = (cur.edges||[]).find(x=>x.id===id); if(!e) return;
  e[key] = val;
  save();
  if(key==="type"||key==="label") renderCanvas();   // l'input vive nel pannello: il focus non si perde
}
export function deleteEdge(id){
  if(RO) return;
  const cur = currentNode();
  cur.edges = (cur.edges||[]).filter(x=>x.id!==id);
  st.selectedEdgeId = null;
  save(); renderMap();
}

export function addChild(id){
  if(RO) return;
  const parent = id ? findNode(id) : currentNode();
  const c = node("Nuova bolla","nota");
  parent.children.push(c);
  if(parent.id === currentNode().id){ st.selectedId = c.id; }
  save(); renderMap();
  // focus sul titolo per rinominare subito
  setTimeout(()=>{ const inp=document.querySelector("#detail input"); if(inp){inp.focus(); inp.select();} },50);
}

export function askDeleteNode(id){
  if(RO) return;
  const n = findNode(id); if(!n || n.id===st.state.root.id) return;
  if(isEmptyNode(n)){ doDeleteNodes([id]); return; }   // bolla vuota: via subito, niente dialogo
  openConfirm(`Eliminare "${n.title||"bolla"}" e tutto il suo contenuto?`, ok=>{
    if(!ok) return;
    const par = findParent(id);
    if(par && Array.isArray(par.edges))
      par.edges = par.edges.filter(e=>e.a!==id && e.b!==id);
    removeNode(id, st.state.root);
    // se il nodo eliminato era nel percorso, torno al genitore valido
    const idx = st.path.indexOf(id);
    if(idx!==-1) st.path = st.path.slice(0, idx);
    if(!st.path.length) st.path=[st.state.root.id];
    if(st.selectedId===id) st.selectedId=null;
    save(); renderMap();
  });
}

/* ==================== immagini ==================== */
export function pickImage(id){
  const inp = document.createElement("input");
  inp.type="file"; inp.accept="image/*";
  inp.onchange = ()=>{
    const f = inp.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=>{ compressImage(r.result, (data)=>{ editNode(id,"img",data); }); };
    r.readAsDataURL(f);
  };
  inp.click();
}
export function compressImage(dataUrl, cb){
  const img = new Image();
  img.onload = ()=>{
    const MAX = 1400;
    let w=img.width, h=img.height;
    if(w>MAX||h>MAX){ const k=MAX/Math.max(w,h); w=Math.round(w*k); h=Math.round(h*k); }
    const c=document.createElement("canvas"); c.width=w; c.height=h;
    c.getContext("2d").drawImage(img,0,0,w,h);
    cb(c.toDataURL("image/jpeg",0.82));
  };
  img.onerror = ()=>cb(dataUrl);
  img.src = dataUrl;
}
export function openLightbox(id){
  const n = findNode(id); if(!n||!n.img) return;
  const img = document.getElementById("lightbox-img");
  img.src = n.img;
  /* Qui l'alt viene letto per davvero: nel dialogo l'immagine non sta dentro
     nessun bottone che la rinomini. Si scrive come proprietà e non nel markup,
     quindi non c'è niente da escapare. */
  img.alt = nomeImmagine(n);
  /* showModal() e non una classe: è la chiamata che accende Escape, la trappola
     del focus e il ritorno del focus al bottone che l'ha aperto. Il src si
     scrive PRIMA, sennò il dialogo si apre su un'immagine vuota. */
  document.getElementById("lightbox").showModal();
}

/* L'immagine in una finestra sua, da trascinare su un secondo schermo mentre
   si continua a lavorare: il lightbox è un modale, e finché è aperto l'editor
   non risponde.

   La finestra è UNA sola, per nome: chi la mette sull'altro schermo la mette
   lì una volta, e l'immagine successiva deve arrivare nello stesso posto invece
   di aprirne un'altra davanti all'editor. Si scrive dentro un about:blank e
   non si naviga all'URL dell'immagine per due ragioni: i browser bloccano la
   navigazione verso `data:` (le immagini dello standalone e quelle mai
   migrate), e `/immagini/[chiave]` risponde con `sandbox`, cioè una pagina a
   cui non si potrebbe cambiare immagine da qui. Titolo e src si scrivono come
   proprietà, quindi non c'è markup da escapare. */
const FINESTRA_IMMAGINE = "runebog-immagine";
export function apriInFinestra(id){
  const n = findNode(id); if(!n||!n.img) return;
  const w = window.open("", FINESTRA_IMMAGINE, "popup,width=900,height=700");
  /* Un blocco dei popup non deve sembrare un bottone rotto: lo si dice nella
     riga di stato, dove l'app dice già "Modifica annullata". */
  if(!w){
    document.getElementById("savestate").textContent = "Finestra bloccata: consenti i popup per questo sito";
    return;
  }
  const d = w.document;
  let img = d.getElementById("img");
  if(!img){
    d.open(); d.write(`<!doctype html><meta charset="utf-8"><title>Runebog</title>
      <style>html,body{margin:0;height:100%;background:#0b0f0c}
      body{display:flex;align-items:center;justify-content:center}
      img{max-width:100%;max-height:100%;object-fit:contain}</style><img id="img">`);
    d.close();
    img = d.getElementById("img");
  }
  /* Assoluto: la base di un about:blank è quella di chi lo apre, ma su un
     percorso relativo non vale la pena di dipenderne. */
  img.src = new URL(n.img, location.href).href;
  img.alt = nomeImmagine(n);
  d.title = n.title || "Immagine";
  w.focus();
}

// per gli onclick/ontoggle inline nei template
/* La scadenza di una quest si scrive come la dice il DM, "tra N giorni", e si
   salva come giorno assoluto (oggi + N): avanzando il calendario il campo
   mostra da sé quanto manca. Vuoto toglie la scadenza, e con lei il flag. La
   prima scadenza scrive il calendario nel documento, sennò al tavolo non
   arriverebbe il giorno da cui contare. */
function scadenzaHTML(n){
  const cal = calendarioDi(st.state), s = scadenzaDi(n);
  const tra = Number.isInteger(n.scadenza) ? n.scadenza - cal.oggi : "";
  return `<div class="field"><label for="q-scad-${n.id}">Scadenza</label>
    <div class="scad-riga"><span>tra</span>
      <input id="q-scad-${n.id}" type="number" inputmode="numeric" value="${tra}" placeholder="—"
        onchange="impostaScadenza('${n.id}', this.value)" aria-describedby="q-scad-d-${n.id}">
      <span>giorni</span></div>
    <p class="hint-sm" id="q-scad-d-${n.id}">${s
      ? `${escapeHtml(formattaData(cal, n.scadenza))} · <span class="q-scad s-${s.stato}">${escapeHtml(s.testo)}</span>`
      : "Vuoto = nessuna scadenza. Compare nel calendario e nel diario."}</p>
    ${s ? `<div class="opt"><label><input type="checkbox" ${n.scadenzaVisibile?"checked":""}
        onchange="editNode('${n.id}','scadenzaVisibile',this.checked||undefined)"> La vedono anche i giocatori</label>
      <p class="hint-sm">${n.scadenzaVisibile ? "Al tavolo esce il giorno, se la quest è rivelata."
        : "Resta tua: al tavolo non esce."}</p></div>` : ""}
  </div>`;
}
export function impostaScadenza(id, valore){
  if(RO) return;
  const n = findNode(id); if(!n) return;
  if(String(valore).trim() === ""){ delete n.scadenza; delete n.scadenzaVisibile; }
  else{
    const tra = Math.round(Number(valore));
    if(!Number.isFinite(tra)) return renderDetail();
    const cal = assicuraCalendario();
    n.scadenza = Math.min(CALENDARIO_LIMITI.giornoMax, Math.max(1, cal.oggi + tra));
  }
  save();
  renderDetail(); renderCanvas();
}

Object.assign(window, { editNode, editEdge, raddrizzaEdge, formattaTesto, tastiTesto, cambiaCarattere, deleteEdge, addChild, askDeleteNode,
  pickImage, openLightbox, apriInFinestra, openDetailSheet, secToggle, impostaScadenza });

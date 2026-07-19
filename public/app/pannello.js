/* Il pannello di dettaglio: la scheda del blocco/collegamento selezionato,
   le modifiche che ne partono (editNode, editEdge, immagini) e la variante
   bottom sheet su mobile. */

import { TYPES, STATUSES, SHAPES, EDGE_TYPES, NODE_COLORS, nodeColor,
         isMarker, defShape, nodeBox, node, escapeHtml, escapeAttr,
         gridShape, wallShape, CELL } from "./modello.js";
import { st, save, findNode, findParent, removeNode, currentNode, RO } from "./stato.js";
import { openConfirm } from "./viste.js";
import { renderMap, renderCrumbs, renderCanvas, bgEdit, isEmptyNode, doDeleteNodes } from "./mappa.js";
import { statblockHTML } from "./mostri.js";

/* Una forma in scala si legge in quadretti e metri (1 quadretto = 1,5 m):
   i pixel non dicono niente al tavolo. */
const labelScala = box => {
  const q = v => (v/CELL).toLocaleString("it-IT",{maximumFractionDigits:2});
  const m = v => (v/CELL*1.5).toLocaleString("it-IT",{maximumFractionDigits:2});
  return `${q(box.w)}×${q(box.h)} quadretti · ${m(box.w)}×${m(box.h)} m`;
};
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
      <img id="detail-img" class="show" src="${n.img}" alt="riferimento" onclick="openLightbox('${n.id}')">
    </div>` : ""}

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

  if(st.multiSel.size>1){
    const nodes = [...st.multiSel].map(id=>findNode(id)).filter(Boolean);
    aside.innerHTML = `<div class="inner">
      <div><h2>${nodes.length} bolle selezionate</h2></div>
      <div class="field"><div class="child-list">${nodes.map(x=>`<div class="child">
        <span class="type-badge" style="background:${nodeColor(x)}"></span>${escapeHtml(x.title||"(senza nome)")}
      </div>`).join("")}</div></div>
      <p style="color:var(--ink-dim);font-size:12px;line-height:1.5">
        Trascina una qualsiasi delle bolle per spostarle insieme · Frecce per ritocchi fini · Canc per eliminarle · Esc per deselezionare
      </p>
      <div class="detail-actions">
        <button class="btn danger" onclick="requestDeleteSelection()">Elimina selezionati</button>
      </div>
    </div>`;
    return;
  }

  const sel = st.selectedId ? findNode(st.selectedId) : null;
  const n = sel || cur;
  const isRoot = (n.id === st.state.root.id);
  const t = TYPES[n.type] || TYPES.nota;
  // Una pedina collegata non ha un titolo proprio: mostrarne il campo inviterebbe
  // a scriverci un nome che il disegno poi ignora, perché legge la fonte.
  const link = n.type === "token" ? tokenLink(n) : null;

  const typeOpts = Object.entries(TYPES)
    .map(([k,v])=>`<option value="${k}" ${k===n.type?"selected":""}>${v.label}</option>`).join("");
  const statusOpts = STATUSES
    .map(s=>`<option value="${s}" ${s===n.status?"selected":""}>${s||"—"}</option>`).join("");
  const shapeOpts = Object.entries(SHAPES)
    .map(([k,v])=>`<option value="${k}" ${(n.shape||defShape(n))===k?"selected":""}>${v.label}</option>`).join("");

  const childRows = n.children.map(c=>{
    const cc = nodeColor(c);
    return `<div class="child" onclick="jumpTo('${n.id}','${c.id}')">
      <span class="type-badge" style="background:${cc}"></span>${escapeHtml(c.title||"(senza nome)")}
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

    <div class="row">
      <div class="field"><label>Tipo</label>
        <select onchange="editNode('${n.id}','type',this.value)" ${isRoot?"disabled":""}>${typeOpts}</select></div>
      <div class="field"><label>Stato</label>
        <select onchange="editNode('${n.id}','status',this.value)">${statusOpts}</select></div>
    </div>

    ${!isMarker(n) && !isRoot ? `<div class="field"><label>Forma sulla pianta</label>
      <select onchange="editNode('${n.id}','shape',this.value)">${shapeOpts}</select></div>
    <div class="row">
      <div class="field"><label>Larghezza</label>
        <input type="number" step="${gridShape(n)?CELL:10}" min="${gridShape(n)?CELL:40}" value="${nodeBox(n).w}"
          onchange="editNode('${n.id}','w',${gridShape(n)
            ? `Math.max(${CELL},Math.round((parseInt(this.value)||${CELL})/${CELL})*${CELL})`
            : `Math.max(40,parseInt(this.value)||40)`})"></div>
      <div class="field"><label>Altezza</label>
        <input type="number" step="${gridShape(n)?CELL:10}" min="${gridShape(n)?CELL:30}" value="${nodeBox(n).h}"
          onchange="editNode('${n.id}','h',${gridShape(n)
            ? `Math.max(${CELL},Math.round((parseInt(this.value)||${CELL})/${CELL})*${CELL})`
            : `Math.max(30,parseInt(this.value)||30)`})"></div>
    </div>
    ${gridShape(n)?`<p class="hint-sm">${labelScala(nodeBox(n))}</p>`:""}
    ${SHAPES[n.shape||defShape(n)]?.walls ? `<div class="opt">
      <label><input type="checkbox" ${wallShape(n)?"checked":""}
        onchange="editNode('${n.id}','walls',this.checked)"> Muri e porte</label>
      <p class="hint-sm">Le porte si aprono da sole dove passa un collegamento;
        un passaggio segreto lascia il muro chiuso.</p>
    </div>` : ""}` : ""}

    <div class="field"><label>Note <span class="only-dm">solo tue</span></label>
      <textarea oninput="editNode('${n.id}','notes',this.value)" placeholder="Dettagli, agganci, statistiche mostri, letture ad alta voce…">${escapeHtml(n.notes)}</textarea></div>

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
        <a class="btn primary" href="/dungeon" target="_blank" rel="noopener">Genera un dungeon ↗</a>
        <button class="btn" onclick="pasteDungeon()">Incolla dungeon</button>
        <button class="btn" onclick="document.getElementById('dungeon-file').click()">Da file…</button>
      </div>
      <p class="hint-sm">Il generatore si apre in una scheda a parte — la campagna resta
        aperta qui. Copia il JSON e torna: diventa una bolla con le stanze sulla pianta,
        gli incontri pronti per i PF e i tuoi PG come pedine all'ingresso.</p>
    </details>` : ""}

    <details class="field" data-sec="img" ontoggle="secToggle(this)"${secOpen("img", !!n.img)}>
      <summary>Mappa / immagine di riferimento</summary>
      <img id="detail-img" class="${n.img?"show":""}" src="${n.img||""}" alt="riferimento" onclick="openLightbox('${n.id}')">
      <div class="img-actions" style="margin-top:8px">
        <button class="btn" onclick="pickImage('${n.id}')">${n.img?"Sostituisci":"Carica"} immagine</button>
        ${n.img?`<button class="btn danger" onclick="editNode('${n.id}','img',null)">Rimuovi</button>`:""}
      </div>
    </details>

    ${n.type==="encounter" ? statblockHTML(n) : ""}

    ${n.children.length?`<div class="field"><label>Contenuto (${n.children.length})</label>
      <div class="child-list">${childRows}</div></div>`:""}

    <div class="detail-actions">
      <button class="btn primary" onclick="addChild('${n.id}')">+ Bolla dentro</button>
      ${sel?`<button class="btn" onclick="enterNode('${n.id}')">Entra →</button>`:""}
      ${!isRoot?`<button class="btn danger" onclick="askDeleteNode('${n.id}')">Elimina</button>`:""}
    </div>
  </div>`;
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
  aside.classList.toggle("open",
    st.detailOpen || !!st.selectedId || !!st.selectedEdgeId || st.multiSel.size>0);
}
export function renderDetail(){
  renderDetailCore();
  mobileDetailSync();
}

/* ==================== modifiche dal pannello ==================== */
export function editNode(id, key, val){
  if(RO) return;
  const n = findNode(id); if(!n) return;
  n[key] = val;
  if(key==="type" && !isMarker(n) && !n.shape) n.shape = defShape(n);
  save();
  if(["title","type","status","shape","w","h","color","walls"].includes(key)){ renderCrumbs(); renderCanvas(); }
  // shape: cambiando forma cambia il colore predefinito, e il campione "Predefinito"
  // nel pannello deve seguirlo
  if(["type","img","main","color","shape"].includes(key)) renderDetail();
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
  document.getElementById("lightbox-img").src = n.img;
  document.getElementById("lightbox").classList.add("show");
}

// per gli onclick/ontoggle inline nei template
Object.assign(window, { editNode, editEdge, deleteEdge, addChild, askDeleteNode,
  pickImage, openLightbox, openDetailSheet, secToggle });

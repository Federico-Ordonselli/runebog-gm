/* La formattazione di una casella di testo (24 set 2026): titoli, elenchi,
   grassetto e corsivo DENTRO la stessa casella, per scrivere un riepilogo
   o una pergamena sulla mappa invece di una riga sola tutta uguale.

   Il testo resta una stringa in `notes`, con una marcatura da tastiera —
   quella che scrivono già le chat — e non HTML: così niente da sanificare
   (l'uscita è costruita qui, dopo `escapeHtml`, e i soli tag sono i nostri),
   niente migrazione, e una casella scritta prima di oggi si legge uguale.
   Il pannello ha i bottoni che la inseriscono, quindi non va imparata.

     # Titolo   ## Sottotitolo   ### Intestazione   -# testo piccolo
     - voce  (o * e •)           1. voce numerata   ---  riga di separazione
     **grassetto**   *corsivo*   ~~barrato~~        rientro: due spazi per livello

   Le grandezze sono in `em` (app.css, `.tr-*`): scalano col carattere della
   casella, e quindi anche con "Adatta alla casella". Modulo puro: si prova
   in test/disegno/ senza DOM. */

const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));

/* Sul testo GIÀ escapato: `*`, `_` e `~` non sono toccati da esc, e le
   sostituzioni aggiungono solo tag fissi. Un asterisco spaiato resta un
   asterisco. */
function inline(s){
  return esc(s)
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<b>$1</b>")
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, "<s>$1</s>")
    .replace(/(^|[^\w*])\*(?=[^\s*])(.+?)(?<=[^\s*])\*(?![\w*])/g, "$1<i>$2</i>")
    .replace(/(^|[\s(])_(?=\S)(.+?)(?<=\S)_(?=$|[\s.,;:!?)])/g, "$1<i>$2</i>");
}

const TITOLI = {"#":"tr-t1", "##":"tr-t2", "###":"tr-t3"};

export function testoRicco(testo){
  let out = "";
  for(const riga of String(testo ?? "").split(/\r?\n/)){
    const spazi = riga.match(/^ */)[0].length;
    const r = riga.slice(spazi);
    const rientro = Math.min(3, Math.floor(spazi/2));
    const cls = rientro ? ` tr-in${rientro}` : "";
    let m;
    if(!r.trim()){ out += `<div class="tr-vuota"></div>`; continue; }
    if(/^(-{3,}|_{3,}|\*{3,})$/.test(r.trim())){ out += `<hr class="tr-hr">`; continue; }
    if((m = r.match(/^(#{1,3}) (.*)$/))){ out += `<div class="${TITOLI[m[1]]}${cls}">${inline(m[2])}</div>`; continue; }
    if((m = r.match(/^-# (.*)$/))){ out += `<div class="tr-piccolo${cls}">${inline(m[1])}</div>`; continue; }
    if((m = r.match(/^[-*•] (.*)$/))){
      out += `<div class="tr-li${cls}"><span class="tr-mk" aria-hidden="true">•</span>${inline(m[1])}</div>`; continue;
    }
    if((m = r.match(/^(\d{1,3}[.)]) (.*)$/))){
      out += `<div class="tr-li tr-num${cls}"><span class="tr-mk">${m[1]}</span>${inline(m[2])}</div>`; continue;
    }
    out += `<div class="tr-p${cls}">${inline(r)}</div>`;
  }
  return out;
}

/* Il testo senza marcatura, per chi lo annuncia (aria-label) e non lo guarda. */
export function testoSemplice(testo){
  return String(testo ?? "").split(/\r?\n/)
    .map(r => r.trim().replace(/^(#{1,3}|-#|[-*•]|\d{1,3}[.)]) /, "").replace(/^(-{3,}|_{3,}|\*{3,})$/, ""))
    .map(r => r.replace(/\*\*|~~/g, "").replace(/(^|[^\w])[*_](?=\S)|(?<=\S)[*_](?!\w)/g, "$1"))
    .filter(Boolean).join(" ");
}

/* I comandi del pannello, sul testo e sulla selezione della textarea: puri,
   tornano il testo nuovo e la selezione da ripristinare. */

/* Grassetto/corsivo/barrato: avvolge la selezione, o la toglie se c'è già. */
export function avvolgi(testo, inizio, fine, segno){
  const k = segno.length;
  const prima = testo.slice(inizio-k, inizio), dopo = testo.slice(fine, fine+k);
  if(prima === segno && dopo === segno)
    return {testo: testo.slice(0, inizio-k) + testo.slice(inizio, fine) + testo.slice(fine+k),
            inizio: inizio-k, fine: fine-k};
  return {testo: testo.slice(0, inizio) + segno + testo.slice(inizio, fine) + segno + testo.slice(fine),
          inizio: inizio+k, fine: fine+k};
}

/* Un prefisso di riga (titolo, elenco) su tutte le righe toccate dalla
   selezione. Ripremerlo lo toglie; un prefisso di blocco diverso lo
   sostituisce, così Titolo su un Sottotitolo non dà "# ## …". Il rientro
   resta davanti. `prefisso` null toglie e basta (testo normale). */
const BLOCCO = /^(#{1,3} |-# |[-*•] |\d{1,3}[.)] )/;
export function prefissaRighe(testo, inizio, fine, prefisso){
  const da = testo.lastIndexOf("\n", inizio-1) + 1;
  let a = testo.indexOf("\n", fine > inizio && testo[fine-1] === "\n" ? fine-1 : fine);
  if(a < 0) a = testo.length;
  const righe = testo.slice(da, a).split("\n");
  const numerato = prefisso === "1. ";
  const tutte = prefisso && righe.every(r => {
    const t = r.trimStart();
    return numerato ? /^\d{1,3}[.)] /.test(t) : t.startsWith(prefisso);
  });
  let n = 0;
  const nuove = righe.map(r => {
    const sp = r.match(/^ */)[0], t = r.slice(sp.length).replace(BLOCCO, "");
    if(tutte || !prefisso) return sp + t;
    if(!t && righe.length > 1) return r;          // le righe vuote restano vuote
    return sp + (numerato ? `${++n}. ` : prefisso) + t;
  });
  const blocco = nuove.join("\n");
  return {testo: testo.slice(0, da) + blocco + testo.slice(a), inizio: da, fine: da + blocco.length};
}

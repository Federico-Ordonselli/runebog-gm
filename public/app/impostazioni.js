/* La finestra Impostazioni (25 set 2026): le preferenze dello schermo in un
   posto solo — tema, barra, foglio e carattere delle caselle. Tema e barra
   avevano già le loro voci nei menu, e le tengono: qui si RICHIAMANO le
   stesse funzioni (`setTheme` di main.js, `impostaBarra` di barra-menu.js),
   non se ne scrive una seconda strada.

   Un <dialog> e non una pagina: resta dentro l'editor, funziona offline e
   non perde la campagna aperta. Le scelte valgono subito, come nei menu,
   quindi non c'è un "Salva" — solo Chiudi. Il contenuto si costruisce
   all'apertura, così dice sempre lo stato di adesso.

   Al tavolo restano tema e barra: caselle e schede lì non arrivano. */

import { RO } from "./stato.js";
import { renderCanvas } from "./mappa.js";
import { renderDetail } from "./pannello.js";
import { FOGLI, TESTO_SIZES, TESTO_SIZE_NOMI } from "./modello.js";
import { preferenza, impostaPreferenza } from "./preferenze.js";
import { GRUPPI, TEMA_DEFAULT, temiDelGruppo } from "./temi.js";

const $ = id => document.getElementById(id);

const scelta = (gruppo, valore, attuale, html, extra = "") =>
  `<button type="button" class="btn${valore === attuale ? " primary" : ""}" aria-pressed="${valore === attuale}"
     data-imp="${gruppo}" data-valore="${valore}"${extra}>${html}</button>`;

function contenuto(){
  const tema = $("theme-select")?.value || TEMA_DEFAULT;
  const barra = document.documentElement.classList.contains("ui-classica") ? "classica" : "menu";
  const opzioniTema = GRUPPI.map(g => {
    const voci = temiDelGruppo(g);
    return voci.length ? `<optgroup label="${g}">${voci.map(t =>
      `<option value="${t.id}"${t.id === tema ? " selected" : ""}>${t.label}</option>`).join("")}</optgroup>` : "";
  }).join("");
  let html = `
    <div class="field"><label for="imp-tema">Tema</label>
      <select id="imp-tema">${opzioniTema}</select></div>
    <div class="field"><label>Barra in alto</label>
      <div class="img-actions scelte">
        ${scelta("barra", "menu", barra, "A menu")}
        ${scelta("barra", "classica", barra, "Completa")}
      </div>
      <p class="hint-sm">La barra completa mostra tutti i comandi insieme: serve a chi ha uno schermo largo.</p></div>`;
  if(!RO){
    const foglio = preferenza("foglio"), px = preferenza("carattere");
    html += `
    <div class="field"><label>Foglio di caselle e schede</label>
      <div class="img-actions scelte imp-fogli">
        ${Object.entries(FOGLI).map(([k, v]) => scelta("foglio", k, foglio,
          `<span class="foglio-prova${k === "pulito" ? "" : ` foglio foglio-${k}`}" aria-hidden="true"><span class="testo-txt">Aa</span></span>${v}`)).join("")}
      </div>
      <p class="hint-sm">Vale per quelle che non ne hanno uno loro: dal pannello puoi sceglierlo bolla per bolla.
        Lo vedi solo tu, come il tema.</p></div>
    <div class="field"><label>Carattere delle nuove caselle di testo</label>
      <div class="img-actions scelte">
        ${TESTO_SIZES.map((v, i) => scelta("carattere", String(v), String(px), TESTO_SIZE_NOMI[i])).join("")}
      </div></div>`;
  }
  return html;
}

function disegna(){
  $("imp-corpo").innerHTML = contenuto();
}

export function apriImpostazioni(){
  const d = $("impostazioni-dialog");
  if(!d) return;
  disegna();
  d.showModal();
}

export function initImpostazioni(){
  const d = $("impostazioni-dialog");
  if(!d) return;
  d.addEventListener("change", e => {
    if(e.target.id === "imp-tema") window.setTheme(e.target.value);
  });
  d.addEventListener("click", e => {
    const b = e.target.closest("[data-imp]");
    if(!b) return;
    const { imp, valore } = b.dataset;
    if(imp === "barra") window.impostaBarra(valore);
    else if(imp === "foglio"){
      // Le caselle in cui il testo non ci sta più si allungano da sé al
      // disegno (adattaCaselle in mappa.js), in ogni livello.
      impostaPreferenza("foglio", valore); renderCanvas(); renderDetail();
    }
    else if(imp === "carattere") impostaPreferenza("carattere", Number(valore));
    // Si ridisegna il contenuto e si rimette il focus sulla scelta appena
    // fatta: innerHTML lo butterebbe sul <body>, cioè fuori dal dialogo.
    disegna();
    d.querySelector(`[data-imp="${imp}"][data-valore="${valore}"]`)?.focus();
  });
}

Object.assign(window, { apriImpostazioni });

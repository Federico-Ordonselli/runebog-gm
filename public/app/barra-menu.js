/* La barra a menu (22 set 2026): File, Modifica, Visualizza, Strumenti, Aiuto,
   più la palette raggruppata in tendine. È il default; la barra completa di
   prima — ogni comando un bottone, la palette stesa — resta a un clic
   (Visualizza › Barra completa) per chi la preferisce, ed è una preferenza
   dello schermo come il tema: `runebog-ui` in localStorage, mai nel JSON.

   Due regole che reggono tutto il resto:
   - NESSUN comando nuovo e nessun comando perso. Ogni voce chiama la stessa
     funzione del bottone che sostituisce; i bottoni stanno ancora nel markup
     e la barra completa è solo CSS (`html.ui-classica`). Una seconda strada
     verso la stessa funzione non può divergere, una copia della funzione sì.
   - Le voci si costruiscono ALL'APERTURA, come fa già il menu ⋯: così dicono
     lo stato di adesso (tema scelto, campagna aperta, scontro acceso) senza
     un secondo stato da tenere allineato.
   Il menu è `#ctx-menu`, lo stesso del tasto destro: posizione, chiusura e
   stile ci sono già (menu.js). */

import { RO, doUndo, doRedo, newCampaign, askDeleteCampaign, switchCampaign } from "./stato.js";
import { openCtx, closeCtx, ctxAperto, ancoraCtx } from "./menu.js";
import { openKeys } from "./viste.js";
import { GRUPPI, TEMA_DEFAULT, temiDelGruppo } from "./temi.js";
import { etichettaOffline } from "./offline.js";
import { exportJSON } from "./esporta.js";
import { planFit, planZoom, arrangeGrid, duplicateSelected } from "./mappa.js";
import { copiaSelezione, tagliaSelezione, incolla, ciSonoAppunti } from "./appunti.js";

const CHIAVE = "runebog-ui";
const mac = /Mac|iPhone|iPad/.test(navigator.platform || "");
const ctrl = t => (mac ? "⌘" : "Ctrl+") + t;
const visibile = el => !!el && el.offsetParent !== null;

/* "menu" | "classica". Chiude quel che è aperto: un menu o una tendina rimasti
   appesi a un bottone che sparisce resterebbero lì, senza modo di richiuderli. */
export function impostaBarra(modo){
  closeCtx(); chiudiGruppi();
  const classica = modo === "classica";
  document.documentElement.classList.toggle("ui-classica", classica);
  try{ classica ? localStorage.setItem(CHIAVE, "classica") : localStorage.removeItem(CHIAVE); }catch(_){}
  // La tela cambia altezza (la palette stesa va a capo): si ridisegna al nuovo
  // riquadro, come dopo un resize della finestra.
  dispatchEvent(new Event("resize"));
}

const regole = {id:"srd", label:"Regole SRD 5.2.1 ↗", run:()=>window.open("/srd","_blank","noopener")};

function voceOffline(){
  const t = etichettaOffline();
  return t ? ["---", {head:t}] : [];
}

const MENU = {
  file(){
    const v = [];
    if(!window.__cloud){
      v.push({id:"newc", label:"Nuova campagna", run:newCampaign});
      /* Le campagne si leggono dal <select> della barra completa, che
         renderCampaignSelect tiene aggiornato: un secondo elenco qui sarebbe
         un secondo posto da ricordarsi di ridisegnare. */
      const sel = document.getElementById("campaign-select");
      const opts = sel ? [...sel.options] : [];
      if(opts.length > 1){
        v.push({head:"Apri campagna"});
        for(const o of opts) v.push({id:"c-"+o.value, label:o.textContent + (o.selected ? "  ✓" : ""),
                                     run:()=>switchCampaign(o.value)});
      }
      v.push({id:"delc", label:"Elimina campagna…", danger:true, run:askDeleteCampaign}, "---");
    }
    v.push(
      {id:"imp", label:"Importa da file…", run:()=>document.getElementById("import-file").click()},
      {id:"exp", label:"Esporta la campagna", run:()=>exportJSON()});
    if(window.__cloud || window.runebogDesktop)
      v.push("---", {id:"share", label:"Tavolo dei giocatori…", run:()=>window.openShare()});
    // Il titolo in topbar porta già lì; nel desktop "/" non è il sito, e il
    // titolo resta l'unica via (come prima).
    if(!window.runebogDesktop) v.push("---", {id:"home", run:()=>{ location.href = "/"; },
      label: window.__cloud ? "← Le mie campagne" : "Esci dall'editor"});
    return v;
  },

  modifica(){
    const v = [
      {id:"undo", label:"Annulla", kbd:ctrl("Z"), run:doUndo},
      {id:"redo", label:"Ripristina", kbd:ctrl("Y"), run:doRedo},
      "---",
      {id:"tag", label:"Taglia", kbd:ctrl("X"), run:tagliaSelezione},
      {id:"cop", label:"Copia", kbd:ctrl("C"), run:copiaSelezione},
    ];
    // Come nel menu del tasto destro: una voce che risponde "niente da
    // incollare" è un comando che si prova per scoprire che non fa niente.
    if(ciSonoAppunti()) v.push({id:"inc", label:"Incolla", kbd:ctrl("V"), run:()=>incolla()});
    v.push({id:"dup", label:"Duplica", kbd:ctrl("D"), run:duplicateSelected},
           "---",
           {id:"grid", label:"Riordina in griglia", run:arrangeGrid});
    return v;
  },

  visualizza(){
    const v = [
      {id:"fit", label:"Adatta alla finestra", kbd:"F", run:()=>planFit(true)},
      {id:"zin", label:"Ingrandisci", kbd:"+", run:()=>planZoom(1.25)},
      {id:"zout", label:"Rimpicciolisci", kbd:"−", run:()=>planZoom(0.8)},
      "---",
      {id:"impost", label:"Impostazioni…", run:()=>window.apriImpostazioni()},
    ];
    const cur = document.getElementById("theme-select")?.value || TEMA_DEFAULT;
    for(const g of GRUPPI){
      const voci = temiDelGruppo(g);
      if(!voci.length) continue;
      v.push("---", {head: g === "Scuri" || g === "Chiari" ? "Tema — " + g.toLowerCase() : g});
      for(const t of voci)
        v.push({id:"th-"+t.id, label:t.label + (cur === t.id ? "  ✓" : ""), run:()=>window.setTheme(t.id)});
    }
    v.push("---", {id:"ui", label:"Barra completa (sviluppatore)", run:()=>impostaBarra("classica")});
    return v;
  },

  strumenti(){
    const v = [];
    /* I tool li crea il gestore dentro #map-tools, uno per registro: qui si
       leggono i loro bottoni invece di elencarli, così un tool nuovo compare
       anche nel menu senza toccare questo file (la regola di strumenti/). */
    for(const b of document.querySelectorAll("#map-tools button[data-tool]")){
      if(!visibile(b)) continue;          // fuori dalla mappa i tool non hanno tela
      const tasto = b.getAttribute("aria-keyshortcuts") || "";   // la scrive il gestore
      const acceso = b.getAttribute("aria-pressed") === "true";
      v.push({id:"t-"+b.dataset.tool, label:b.textContent.trim() + (acceso ? "  ✓" : ""),
              kbd:tasto, run:()=>b.click()});
    }
    const bb = document.getElementById("battle-btn");
    if(!RO && visibile(bb))
      v.push({id:"battle", label:bb.textContent.trim(), run:()=>bb.click()});
    if(!RO) v.push("---", {id:"dg", label:"Genera un dungeon…", run:()=>window.apriGeneratoreDungeon()});
    v.push(regole);
    return v;
  },

  aiuto(){
    return [
      {id:"keys", label:"Scorciatoie da tastiera", kbd:"?", run:openKeys},
      regole,
      ...voceOffline(),
    ];
  },
};

/* Il ☰ del telefono: le stesse sezioni, una sotto l'altra, ciascuna col suo
   titolo. Al tavolo File e Modifica non ci sono, come nella barra. */
MENU.tutto = ()=>{
  const sezioni = RO ? ["visualizza","strumenti","aiuto"]
                     : ["file","modifica","visualizza","strumenti","aiuto"];
  const nomi = {file:"File", modifica:"Modifica", visualizza:"Visualizza", strumenti:"Strumenti", aiuto:"Aiuto"};
  return sezioni.flatMap((k, i)=>{
    const voci = MENU[k]();
    while(voci[0] === "---") voci.shift();
    return [...(i ? ["---"] : []), {head:nomi[k]}, ...voci];
  });
};

function apriMenu(btn){
  const voci = MENU[btn.dataset.menu]?.();
  if(!voci) return;
  const r = btn.getBoundingClientRect();
  openCtx(voci, r.left, r.bottom + 4, btn);
}

const bottoniBarra = () => [...document.querySelectorAll("#menubar [data-menu]")].filter(visibile);

/* ---- le tendine della palette ---- */

function chiudiGruppi(tranne){
  for(const g of document.querySelectorAll(".pal-gruppo.aperto")){
    if(g === tranne) continue;
    g.classList.remove("aperto");
    g.querySelector(".pal-apri")?.setAttribute("aria-expanded", "false");
  }
}

/* La tendina è `position:fixed` e si piazza qui, non `absolute` sotto il
   bottone: su telefono la striscia della palette scorre in orizzontale, e un
   contenitore che scorre ritaglia i figli assoluti — la tendina sarebbe
   uscita tagliata al bordo della striscia. */
function apriGruppo(g){
  chiudiGruppi(g);
  const btn = g.querySelector(".pal-apri"), voci = g.querySelector(".pal-voci");
  g.classList.add("aperto");
  btn.setAttribute("aria-expanded", "true");
  const r = btn.getBoundingClientRect(), v = voci.getBoundingClientRect();
  voci.style.left = Math.max(8, Math.min(r.left, innerWidth - v.width - 8)) + "px";
  voci.style.top  = (r.bottom + 4) + "px";
  voci.style.maxHeight = Math.max(120, innerHeight - r.bottom - 12) + "px";
}

export function initBarraMenu(){
  document.getElementById("menubar")?.addEventListener("click", ev=>{
    const btn = ev.target.closest("[data-menu]");
    if(!btn) return;
    if(ctxAperto() && ancoraCtx() === btn){ closeCtx(); return; }
    apriMenu(btn);
  });
  /* Come in ogni barra a menu: con un menu aperto basta passare sopra
     l'intestazione accanto per aprirla, senza un altro clic. */
  document.getElementById("menubar")?.addEventListener("pointerover", ev=>{
    const btn = ev.target.closest("[data-menu]");
    const aperto = ancoraCtx();
    if(btn && ctxAperto() && aperto && aperto !== btn && aperto.closest("#menubar")) apriMenu(btn);
  });

  /* Tastiera dentro il menu: su e giù fra le voci, destra e sinistra fra i
     menu della barra. Solo se il menu l'ha aperto la barra: il menu del
     tasto destro non ha vicini. */
  document.getElementById("ctx-menu").addEventListener("keydown", ev=>{
    const btns = [...ev.currentTarget.querySelectorAll("button")];
    const i = btns.indexOf(document.activeElement);
    if(ev.key === "ArrowDown" || ev.key === "ArrowUp"){
      ev.preventDefault(); ev.stopPropagation();
      const d = ev.key === "ArrowDown" ? 1 : -1;
      btns[(i + d + btns.length) % btns.length]?.focus();
      return;
    }
    const da = ancoraCtx();
    if((ev.key === "ArrowRight" || ev.key === "ArrowLeft") && da?.closest("#menubar")){
      ev.preventDefault(); ev.stopPropagation();
      const barra = bottoniBarra(), j = barra.indexOf(da);
      const altro = barra[(j + (ev.key === "ArrowRight" ? 1 : -1) + barra.length) % barra.length];
      altro.focus(); apriMenu(altro);
    }
  });

  for(const g of document.querySelectorAll(".pal-gruppo")){
    const btn = g.querySelector(".pal-apri");
    btn.addEventListener("click", ()=> g.classList.contains("aperto") ? chiudiGruppi() : apriGruppo(g));
    // Scelta una pastiglia (armata col clic o trascinata via), la tendina ha
    // finito il suo lavoro. Il dragend e non il dragstart: nascondere la
    // sorgente mentre il trascinamento parte lo farebbe annullare a Chrome.
    g.querySelector(".pal-voci").addEventListener("click", ev=>{
      if(ev.target.closest(".pal-item")) chiudiGruppi();
    });
    g.addEventListener("dragend", ()=> chiudiGruppi());
  }
  addEventListener("pointerdown", ev=>{
    if(!ev.target.closest?.(".pal-gruppo.aperto")) chiudiGruppi();
  }, true);
  // In cattura: l'Escape che chiude la tendina non deve arrivare anche alle
  // scorciatoie della mappa, che deselezionerebbero o risalirebbero di livello.
  addEventListener("keydown", ev=>{
    if(ev.key !== "Escape") return;
    const aperto = document.querySelector(".pal-gruppo.aperto");
    if(!aperto) return;
    ev.stopPropagation();
    chiudiGruppi();
    aperto.querySelector(".pal-apri").focus();
  }, true);
  addEventListener("resize", ()=> chiudiGruppi());
}

Object.assign(window, { impostaBarra });

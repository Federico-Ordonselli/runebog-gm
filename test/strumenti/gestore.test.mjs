/* Test puri del gestore degli strumenti mappa. Node non ha il DOM, quindi il
   gestore riceve fake minimi via le dipendenze iniettate (mapSvg, overlaySvg,
   toolbar, status, doc, keyTarget): è tutto il senso di quell'iniezione.
   Si eseguono con `npm test`. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  registraTool, initGestoreTool, attivaTool, toolAttivo, _reset,
} from "../../public/app/strumenti/gestore.js";

/* --- fake minimi di un elemento e di un document --- */
function fakeEl(){
  const listeners = {};
  return {
    listeners,
    dataset: {},
    style: {},
    textContent: "",
    className: "",
    type: "",
    _attr: {},
    classList: {
      add(c){ this._s.add(c); }, remove(c){ this._s.delete(c); },
      contains(c){ return this._s.has(c); }, _s: new Set(),
    },
    matches(){ return false; },
    addEventListener(t, fn){ (listeners[t] ||= []).push(fn); },
    setAttribute(k, v){ this._attr[k] = String(v); },
    getAttribute(k){ return this._attr[k]; },
    removeAttribute(k){ delete this._attr[k]; },
    appendChild(c){ (this.children ||= []).push(c); return c; },
    replaceChildren(){ this.children = []; },
    remove(){ this._removed = true; },
    setPointerCapture(){}, releasePointerCapture(){},
  };
}
function fakeDoc(){
  return { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
}
function fakeEvent(over = {}){
  let stopped = false, prevented = false;
  return Object.assign({
    button: 0, pointerId: 1, clientX: 0, clientY: 0, key: "",
    preventDefault(){ prevented = true; },
    stopImmediatePropagation(){ stopped = true; },
    get _stopped(){ return stopped; },
    get _prevented(){ return prevented; },
  }, over);
}
function initConFake(extra = {}){
  const mapSvg = fakeEl(), overlaySvg = fakeEl(), toolbar = fakeEl(),
        status = fakeEl(), keyTarget = fakeEl();
  initGestoreTool({
    mapSvg, overlaySvg, toolbar, status, keyTarget,
    doc: fakeDoc(), cell: 40, metersPerCell: 1.5,
    toMapPoint: (x, y) => ({ x, y }), readOnly: false, ...extra,
  });
  return { mapSvg, overlaySvg, toolbar, status, keyTarget };
}
const toolBase = over => ({ id: "x", label: "X", pointerDown: () => true, ...over });

test("registrare due volte lo stesso id fallisce", () => {
  _reset();
  registraTool(toolBase({ id: "righello" }));
  assert.throws(() => registraTool(toolBase({ id: "righello" })), /duplicato/);
});

test("una scorciatoia già usata fallisce", () => {
  _reset();
  registraTool(toolBase({ id: "a", shortcut: "R" }));
  assert.throws(() => registraTool(toolBase({ id: "b", shortcut: "r" })), /Scorciatoia/);
});

test("un solo tool attivo: accenderne un secondo spegne il primo", () => {
  _reset();
  let aOff = 0, bOn = 0;
  registraTool(toolBase({ id: "a", deactivate: () => { aOff++; } }));
  registraTool(toolBase({ id: "b", activate: () => { bOn++; } }));
  initConFake();
  attivaTool("a");
  assert.equal(toolAttivo(), "a");
  attivaTool("b");
  assert.equal(toolAttivo(), "b");
  assert.equal(aOff, 1, "il primo tool è stato disattivato");
  assert.equal(bOn, 1);
});

test("premere il pulsante del tool attivo lo spegne", () => {
  _reset();
  registraTool(toolBase({ id: "a" }));
  const { toolbar } = initConFake();
  const btn = toolbar.children[0];      // il pulsante creato dal gestore
  const click = btn.listeners.click[0];
  click();                              // su
  assert.equal(toolAttivo(), "a");
  click();                              // il pulsante del tool attivo: giù
  assert.equal(toolAttivo(), null);
});

test("pointerDown che ritorna false non blocca la mappa", () => {
  _reset();
  registraTool(toolBase({ id: "a", pointerDown: () => false }));
  const { mapSvg } = initConFake();
  attivaTool("a");
  const giu = mapSvg.listeners.pointerdown[0];
  const ev = fakeEvent();
  giu(ev);
  assert.equal(ev._stopped, false, "l'evento deve poter raggiungere la mappa");
});

test("pointerDown che ritorna true prende il gesto", () => {
  _reset();
  registraTool(toolBase({ id: "a", pointerDown: () => true }));
  const { mapSvg } = initConFake();
  attivaTool("a");
  const ev = fakeEvent();
  mapSvg.listeners.pointerdown[0](ev);
  assert.equal(ev._stopped, true, "il gesto è posseduto: niente pan/drag della mappa");
});

test("senza tool attivo gli eventi passano invariati", () => {
  _reset();
  registraTool(toolBase({ id: "a" }));
  const { mapSvg } = initConFake();
  // nessun attivaTool
  const ev = fakeEvent();
  mapSvg.listeners.pointerdown[0](ev);
  assert.equal(ev._stopped, false);
});

test("il tasto centrale e il destro restano alla mappa anche con tool attivo", () => {
  _reset();
  registraTool(toolBase({ id: "a" }));
  const { mapSvg } = initConFake();
  attivaTool("a");
  for(const button of [1, 2]){
    const ev = fakeEvent({ button });
    mapSvg.listeners.pointerdown[0](ev);
    assert.equal(ev._stopped, false, `button ${button} non deve essere intercettato`);
  }
});

test("Escape spegne il tool prima delle scorciatoie", () => {
  _reset();
  registraTool(toolBase({ id: "a", shortcut: "R" }));
  const { keyTarget } = initConFake();
  attivaTool("a");
  const ev = fakeEvent({ key: "Escape" });
  keyTarget.listeners.keydown[0](ev);
  assert.equal(toolAttivo(), null);
  assert.equal(ev._stopped, true);
});

test("un errore nel tool non lascia la mappa bloccata", () => {
  _reset();
  registraTool(toolBase({ id: "a", pointerMove: () => { throw new Error("boom"); } }));
  const { mapSvg } = initConFake();
  attivaTool("a");
  // prendo il gesto, poi un move che esplode
  mapSvg.listeners.pointerdown[0](fakeEvent());
  mapSvg.listeners.pointermove[0](fakeEvent());
  assert.equal(toolAttivo(), null, "dopo un errore il tool è spento");
});

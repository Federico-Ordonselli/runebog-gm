/* Test delle quattro geometrie delle aree d'effetto. Nessun DOM: punti e
   dimensioni sono espressi direttamente in quadretti. */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  geometriaCerchio,
  geometriaCono,
  geometriaLinea,
  geometriaQuadrato,
  areeEffettoTool,
} from "../../public/app/strumenti/aree-effetto.js";

test("cerchio: raggio 3 quadretti = 4,5 m", () => {
  const forma = geometriaCerchio({ x: 1, y: 2 }, { x: 4, y: 2 });
  assert.deepEqual(forma.centro, { x: 1, y: 2 });
  assert.equal(forma.raggio, 3);
  assert.deepEqual(forma.misura, { quadretti: 3, metri: 4.5 });
});

test("quadrato: il drag definisce un lato allineato alla maglia", () => {
  const forma = geometriaQuadrato({ x: 1, y: 1 }, { x: 3, y: 2 });
  assert.equal(forma.lato, 2);
  assert.deepEqual(forma.punti, [
    { x: 1, y: 1 },
    { x: 3, y: 1 },
    { x: 3, y: 3 },
    { x: 1, y: 3 },
  ]);
  assert.deepEqual(forma.misura, { quadretti: 2, metri: 3 });
});

test("linea: segmento 3-4-5 spesso un quadretto", () => {
  const forma = geometriaLinea({ x: 0, y: 0 }, { x: 3, y: 4 });
  assert.equal(forma.lunghezza, 5);
  assert.equal(forma.spessore, 1);
  assert.deepEqual(forma.punti, [
    { x: -0.4, y: 0.3 },
    { x: 2.6, y: 4.3 },
    { x: 3.4, y: 3.7 },
    { x: 0.4, y: -0.3 },
  ]);
  assert.deepEqual(forma.misura, { quadretti: 5, metri: 7.5 });
});

test("cono: lunghezza 4 e base larga 4 quadretti", () => {
  const forma = geometriaCono({ x: 0, y: 0 }, { x: 4, y: 0 });
  assert.equal(forma.lunghezza, 4);
  assert.deepEqual(forma.centroBase, { x: 4, y: 0 });
  assert.deepEqual(forma.punti, [
    { x: 0, y: 0 },
    { x: 4, y: 2 },
    { x: 4, y: -2 },
  ]);
  assert.ok(Math.abs(forma.aperturaGradi - 53.13010235415598) < 1e-12);
  assert.deepEqual(forma.misura, { quadretti: 4, metri: 6 });
});

/* Il selettore dei sottotipi: senza un gesto in corso (da = null) keyDown non
   disegna, quindi la logica è verificabile senza DOM. deactivate() riporta il
   sottotipo a "cerchio" fra un caso e l'altro. */
test("aree d'effetto: i tasti 1–4 scelgono il footprint", () => {
  areeEffettoTool.deactivate();               // stato pulito: sottotipo = cerchio
  let msg = "";
  const ctx = { announce: t => { msg = t; } };

  assert.equal(areeEffettoTool.keyDown(ctx, { key: "2" }), true, "il tasto 2 è consumato");
  assert.ok(msg.includes("— cono."), "il sottotipo attivo è il cono");

  assert.equal(areeEffettoTool.keyDown(ctx, { key: "4" }), true);
  assert.ok(msg.includes("— quadrato."), "il tasto 4 passa al quadrato");

  areeEffettoTool.deactivate();
});

test("aree d'effetto: un tasto fuori da 1–4 non è consumato", () => {
  areeEffettoTool.deactivate();
  const ctx = { announce: () => {} };
  assert.equal(areeEffettoTool.keyDown(ctx, { key: "9" }), false);
  assert.equal(areeEffettoTool.keyDown(ctx, { key: "a" }), false, "la scorciatoia del tool resta al gestore");
  areeEffettoTool.deactivate();
});

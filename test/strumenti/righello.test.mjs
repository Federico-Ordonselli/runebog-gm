/* Test della geometria pura del righello. Nessun DOM: `distanzaCelle` prende
   delta in quadretti e torna quadretti. Si eseguono con `npm test`. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { distanzaCelle } from "../../public/app/strumenti/righello.js";

const METRI = 1.5;   // METRI_PER_CELLA: il righello moltiplica i quadretti per questo

test("una cella orizzontale = 1 quadretto = 1,5 m", () => {
  const q = distanzaCelle(1, 0);
  assert.equal(q, 1);
  assert.equal(q * METRI, 1.5);
});

test("una diagonale euclidea di un quadretto = √2 quadretti", () => {
  assert.ok(Math.abs(distanzaCelle(1, 1) - Math.SQRT2) < 1e-12);
});

test("euclideo: 3-4-5", () => {
  assert.equal(distanzaCelle(3, 4), 5);
});

test("euclideo è indipendente dal segno dei delta", () => {
  assert.equal(distanzaCelle(-3, -4), 5);
});

test("diagonale-uno: ogni diagonale vale 1 (max dei due assi)", () => {
  assert.equal(distanzaCelle(1, 1, "diagonale-uno"), 1);
  assert.equal(distanzaCelle(3, 2, "diagonale-uno"), 3);
  assert.equal(distanzaCelle(0, 4, "diagonale-uno"), 4);
});

test("alternato: la seconda diagonale vale 2 (5-10-5)", () => {
  assert.equal(distanzaCelle(2, 2, "alternato"), 3);   // 2 diagonali: 2 + floor(2/2)
  assert.equal(distanzaCelle(4, 4, "alternato"), 6);   // 4 diagonali: 4 + floor(4/2)
  assert.equal(distanzaCelle(5, 2, "alternato"), 6);   // 3 rette + 2 diag + 1
});

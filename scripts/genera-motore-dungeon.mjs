/* Genera public/app/dungeon-motore.js dal motore del sito.
 *
 *   node scripts/genera-motore-dungeon.mjs
 *
 * L'editor è JS senza build, il motore è TypeScript in src/lib/dungeon: questa
 * è la sola strada che li collega. Una copia scritta a mano divergerebbe in
 * silenzio — lo stesso seed darebbe due dungeon diversi nel sito e nell'app —
 * e a impedirlo è test/dungeon/motore-app.test.mjs, che genera con entrambi e
 * confronta. Chi tocca engine.ts o srd-data.ts rigeneri, sennò quel test
 * fallisce.
 *
 * Il file generato sta in public/ perché lì lo trovano tutte e tre le copie
 * dell'editor: il sito, la copia offline (il manifesto del service worker legge
 * public/ per intero) e il desktop, che serve public/ così com'è.
 */
import { buildSync } from "esbuild";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uscita = path.join(radice, "public/app/dungeon-motore.js");

const risultato = buildSync({
  stdin: {
    contents: `export { generateDungeon, exportForRunebog, THEMES } from "./src/lib/dungeon/engine.ts";
export { MONSTERS, MAGIC_ITEMS } from "./src/lib/dungeon/srd-data.ts";`,
    resolveDir: radice,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  target: "es2020",
  write: false,
  legalComments: "none",
});

const intestazione = `/* FILE GENERATO da scripts/genera-motore-dungeon.mjs — non modificare a mano.
   È il motore di src/lib/dungeon (engine.ts + srd-data.ts) per l'editor, che
   non ha build. Si rigenera con: node scripts/genera-motore-dungeon.mjs */
`;
writeFileSync(uscita, intestazione + risultato.outputFiles[0].text);
console.log("scritto", path.relative(radice, uscita));

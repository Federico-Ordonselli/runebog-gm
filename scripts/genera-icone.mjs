/* Le icone PNG dell'app installata, generate dall'icona che c'è già.
 *
 *   node scripts/genera-icone.mjs
 *
 * I file in `public/icone/` sono GENERATI e non si modificano a mano — stessa
 * regola di `public/app/srd-mostri.js`. La sorgente è `src/app/icon.svg`, cioè
 * il favicon del sito: un'icona ridisegnata a parte diventa una seconda idea di
 * come si chiama questo prodotto, e le due si allontanano in silenzio.
 *
 * Perché dei PNG, visto che l'SVG c'è: `manifest.webmanifest` accetta anche gli
 * SVG, ma Android li ignora per l'icona della schermata iniziale e iOS non
 * guarda affatto il manifesto — vuole un `apple-touch-icon` PNG. Il caso d'uso
 * di tutto questo lavoro è un tablet al tavolo, quindi le icone che contano
 * sono proprio quelle che il manifesto da solo non copre.
 *
 * Le tre taglie non sono tre gusti:
 *   192  la taglia che Android chiede per la schermata iniziale;
 *   512  quella per la schermata di avvio e gli elenchi di sistema;
 *   180  apple-touch-icon, l'unica che iOS legge.
 * Più la variante `maskable`, che è un disegno diverso e non un ritaglio: lì il
 * sistema ritaglia a piacere (cerchio, goccia, quadrato stondato), quindi lo
 * sfondo deve arrivare ai bordi e il soggetto stare nel cerchio di sicurezza —
 * l'80% centrale. Con l'icona normale, che ha gli angoli già stondati, si
 * otterrebbe un'icona stondata dentro un'icona stondata.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const radice = process.cwd();
const dirIcone = path.join(radice, "public", "icone");

/* La torre si legge dal favicon invece di essere ricopiata qui: le due copie
   divergerebbero al primo ritocco. Si prende tutto ciò che sta dentro il
   <svg>, cioè i tre tracciati e il cerchio, e si butta solo il rettangolo di
   sfondo — che nella variante maskable va rifatto senza angoli stondati. */
async function pezziDelFavicon() {
  const svg = await readFile(path.join(radice, "src", "app", "icon.svg"), "utf8");
  const dentro = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");
  const fondo = dentro.match(/<rect[^>]*fill="(#[0-9a-f]{6})"[^>]*\/>/i);
  if (!fondo) throw new Error("icon.svg: manca il rettangolo di sfondo");
  return { fondo: fondo[1], soggetto: dentro.replace(fondo[0], "").trim() };
}

const rendi = (svg, lato, file) =>
  sharp(Buffer.from(svg)).resize(lato, lato).png({ compressionLevel: 9 }).toFile(file);

const { fondo, soggetto } = await pezziDelFavicon();

/* viewBox 32×32 come la sorgente: si scala in rasterizzazione, non a mano. */
const normale = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="${fondo}"/>
  ${soggetto}
</svg>`;

/* La torre sta fra x 9–21 e y 8–24, cioè un riquadro 12×16 centrato in (15,16):
   mezza diagonale 10, contro i 12,8 del cerchio di sicurezza. Ci sta già —
   l'unico ritocco è portarla al centro vero della tela e ingrandirla quel poco
   che il margine concede senza uscirne (1,1 → mezza diagonale 11). */
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${fondo}"/>
  <g transform="translate(16 16) scale(1.1) translate(-15 -16)">${soggetto}</g>
</svg>`;

await mkdir(dirIcone, { recursive: true });
await Promise.all([
  rendi(normale, 192, path.join(dirIcone, "runebog-192.png")),
  rendi(normale, 512, path.join(dirIcone, "runebog-512.png")),
  rendi(normale, 180, path.join(dirIcone, "runebog-180.png")),
  rendi(maskable, 512, path.join(dirIcone, "runebog-maskable-512.png")),
]);

/* La variante maskable resta anche come SVG: è l'unica forma in cui il
   disegno "sfondo pieno + soggetto nel cerchio di sicurezza" si può rileggere
   e correggere. I PNG sono uscite. */
await writeFile(path.join(dirIcone, "runebog-maskable.svg"), maskable + "\n");

console.log("Icone generate in public/icone/");

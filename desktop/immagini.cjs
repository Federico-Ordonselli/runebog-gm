/* Le immagini del portable stanno in file accanto ai dati (2 ott 2026), non in
   base64 dentro la campagna: la campagna vive in localStorage, che ha una quota
   sola per tutte le campagne, e una mappa grande la riempiva da sola. Il
   documento porta `/immagini/<chiave>`, la stessa forma del cloud
   (IMMAGINE_LOCALE), quindi contratto, bonifica e proiezione del tavolo non
   cambiano.

   - La chiave è casuale come nel cloud, e il tipo sta nell'estensione: il
     Content-Type in uscita lo decide questa tabella, mai il nome del file.
   - Nessun gesto cancella un file: Ctrl+Z, appunti e copie della stessa bolla
     possono ancora puntarci. Lo spazzino segna gli orfani e li toglie dopo
     30 giorni di orfanità, e li riabilita se tornano referenziati — la regola
     dello spazzino del cloud. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const IMAGE_BYTES = 32 * 1024 * 1024;   // allineato a DESKTOP_IMAGE_BYTES in public/app/immagini.js
const GRAZIA_MS = 30 * 24 * 60 * 60 * 1000;
const ESTENSIONI = Object.freeze({
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
  'image/gif': '.gif', 'image/avif': '.avif', 'image/svg+xml': '.svg',
});
const MIME_DI = Object.fromEntries(Object.entries(ESTENSIONI).map(([m, e]) => [e, m]));
const CHIAVE = /^[A-Za-z0-9_-]{1,64}$/;
/* Navigata direttamente, un SVG è un documento che può eseguire script, e qui
   l'origine è quella dell'editor col suo preload: stessa difesa della rotta
   /immagini del sito. */
const INTESTAZIONI = Object.freeze({
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; sandbox",
});

function createImageStore(dir) {
  const orfaneFile = path.join(dir, 'orfane.json');

  function save(bytes, mime) {
    const ext = ESTENSIONI[mime];
    if (!ext) throw new Error('Formato immagine non ammesso.');
    if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) throw new Error('Immagine vuota.');
    if (bytes.byteLength > IMAGE_BYTES) throw new Error('Immagine oltre 32 MiB.');
    fs.mkdirSync(dir, { recursive: true });
    const key = crypto.randomBytes(18).toString('base64url');
    // Prima un file temporaneo, poi il nome vero: un'immagine a metà non deve
    // mai essere servita come se fosse intera.
    const tmp = path.join(dir, key + '.tmp');
    fs.writeFileSync(tmp, bytes);
    fs.renameSync(tmp, path.join(dir, key + ext));
    return '/immagini/' + key;
  }

  function find(key) {
    if (!CHIAVE.test(key)) return null;
    for (const [ext, mime] of Object.entries(MIME_DI)) {
      const file = path.join(dir, key + ext);
      if (fs.existsSync(file)) return { file, mime };
    }
    return null;
  }

  function sweep(referenced, now = Date.now()) {
    let files;
    try { files = fs.readdirSync(dir); } catch { return { marked: 0, deleted: 0 }; }
    const ref = new Set(referenced);
    let orfane = {};
    try { orfane = JSON.parse(fs.readFileSync(orfaneFile, 'utf8')) || {}; } catch {}
    const prossime = {};
    let marked = 0, deleted = 0;
    for (const name of files) {
      const ext = path.extname(name), key = path.basename(name, ext);
      if (ext === '.tmp') { fs.rmSync(path.join(dir, name), { force: true }); continue; }
      if (!MIME_DI[ext] || !CHIAVE.test(key) || ref.has(key)) continue;
      const da = Number(orfane[key]) || now;
      if (now - da >= GRAZIA_MS) { fs.rmSync(path.join(dir, name), { force: true }); deleted++; continue; }
      if (!orfane[key]) marked++;
      prossime[key] = da;
    }
    fs.writeFileSync(orfaneFile, JSON.stringify(prossime));
    return { marked, deleted };
  }

  return { save, find, sweep };
}

module.exports = { createImageStore, IMAGE_BYTES, INTESTAZIONI, GRAZIA_MS };

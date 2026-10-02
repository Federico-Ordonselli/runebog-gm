const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createTableServer } = require('./table-server.cjs');

const state = {
  root: { id: 'root', title: 'Campagna', type: 'zona', notes: 'SEGRETO DM',
    children: [
      { id: 'visibile', title: 'Piazza', type: 'zona', shared: true,
        notes: 'SECONDO SEGRETO', playerNotes: 'Benvenuti in piazza', children: [], edges: [] },
      { id: 'nascosto', title: 'Tana segreta', type: 'zona', shared: false,
        children: [], edges: [] },
    ], edges: [] },
  checklist: [], players: [],
};

test('tavolo LAN: proiezione, asset, aggiornamenti e chiusura', async () => {
  const table = createTableServer(path.resolve(__dirname, '..', 'public'));
  try {
    const opened = await table.open(state);
    assert.equal(opened.open, true);
    assert.match(opened.qr, /^data:image\/png;base64,/);
    const url = new URL(opened.urls[0]);
    url.hostname = '127.0.0.1';
    const page = await fetch(url);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /Benvenuti in piazza/);
    assert.doesNotMatch(html, /SEGRETO DM|SECONDO SEGRETO|Tana segreta/);
    const escaped = { ...state, root: { ...state.root,
      children: [{ ...state.root.children[0], playerNotes: '</script><script>intruso()</script>' }] } };
    table.update(escaped);
    const safePage = await (await fetch(url)).text();
    assert.doesNotMatch(safePage, /<script>intruso\(\)<\/script>/);
    table.update(state);
    const css = await fetch(new URL('/app/app.css', url));
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /text\/css/);
    const texture = await fetch(new URL('/app/materiali/lava.webp', url));
    assert.equal(texture.status, 200);
    assert.equal(texture.headers.get('content-type'), 'image/webp');
    const api = new URL(url.pathname.replace('/tavolo/', '/api/tavolo/'), url);
    const first = await fetch(api);
    assert.equal(first.status, 200);
    assert.equal((await first.json()).state.root.children.length, 1);
    const etag = first.headers.get('etag');
    assert.equal((await fetch(api, { headers: { 'If-None-Match': etag } })).status, 304);
    table.update({ ...state, root: { ...state.root, title: 'Campagna nuova' } });
    const fresh = await fetch(api, { headers: { 'If-None-Match': etag } });
    assert.equal(fresh.status, 200);
    assert.equal((await fresh.json()).state.root.title, 'Campagna nuova');
    assert.equal((await fetch(new URL('/api/tavolo/token-sbagliato', url))).status, 404);
  } finally { table.close(); }
});

test('immagini del portable: file su disco, tetto, tavolo solo per le immagini condivise', async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const { createImageStore, GRAZIA_MS, IMAGE_BYTES } = require('./immagini.cjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'runebog-immagini-'));
  const images = createImageStore(dir);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const condivisa = images.save(png, 'image/png');
  const segreta = images.save(png, 'image/jpeg');
  assert.match(condivisa, /^\/immagini\/[A-Za-z0-9_-]{1,64}$/);
  assert.throws(() => images.save(png, 'text/html'), /Formato/);
  assert.throws(() => images.save(new Uint8Array(IMAGE_BYTES + 1), 'image/png'), /32 MiB/);
  assert.equal(images.find('../orfane'), null);
  assert.equal(images.find(condivisa.slice(10)).mime, 'image/png');

  const conImmagini = { ...state, root: { ...state.root, children: [
    { ...state.root.children[0], img: condivisa },
    { ...state.root.children[1], img: segreta },
  ] } };
  const table = createTableServer(path.resolve(__dirname, '..', 'public'), { images });
  try {
    const url = new URL((await table.open(conImmagini)).urls[0]);
    url.hostname = '127.0.0.1';
    const ok = await fetch(new URL(condivisa, url));
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'image/png');
    assert.match(ok.headers.get('content-security-policy'), /sandbox/);
    assert.match(ok.headers.get('cache-control'), /immutable/);
    assert.deepEqual(new Uint8Array(await ok.arrayBuffer()), png);
    // la bolla non condivisa non esce, e con lei la sua immagine
    assert.equal((await fetch(new URL(segreta, url))).status, 404);
  } finally { table.close(); }

  // Lo spazzino segna, aspetta la grazia, e riabilita chi torna citato.
  const k1 = condivisa.slice(10), k2 = segreta.slice(10);
  const t0 = Date.now();
  assert.deepEqual(images.sweep([k1], t0), { marked: 1, deleted: 0 });
  assert.deepEqual(images.sweep([k1, k2], t0 + GRAZIA_MS), { marked: 0, deleted: 0 });
  assert.ok(images.find(k2));
  images.sweep([k1], t0 + GRAZIA_MS);
  assert.deepEqual(images.sweep([k1], t0 + 2 * GRAZIA_MS), { marked: 0, deleted: 1 });
  assert.equal(images.find(k2), null);
  assert.ok(images.find(k1));
  fs.rmSync(dir, { recursive: true, force: true });
});

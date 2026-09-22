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

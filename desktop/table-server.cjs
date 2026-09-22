const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const QRCode = require('qrcode');
const { projectForPlayers, jsonForScript } = require('./projector.cjs');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };
const NO_STORE = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' };

function addresses() {
  const found = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal && !entry.address.startsWith('169.254.'))
        found.push({ name, address: entry.address });
    }
  }
  return found.filter((entry, i) => found.findIndex(x => x.address === entry.address) === i);
}

function send(res, code, body, type = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(code, { ...NO_STORE, 'Content-Type': type, ...headers });
  res.end(body);
}

function createTableServer(staticRoot) {
  let server = null, token = null, projection = null, name = '', revision = 0;
  const html = fs.readFileSync(path.join(staticRoot, 'app.html'), 'utf8');

  function handle(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Metodo non consentito');
    let pathname;
    try { pathname = new URL(req.url, 'http://localhost').pathname; }
    catch { return send(res, 400, 'URL non valido'); }
    if (pathname === `/tavolo/${token}` && token) {
      const bridge = `<script>window.__table = ${jsonForScript({ token, name, state: projection })};</script>`;
      return send(res, 200, html.replace('<script>', bridge + '\n<script>'), 'text/html; charset=utf-8');
    }
    if (pathname === `/api/tavolo/${token}` && token) {
      const etag = `"r${revision}"`;
      if (req.headers['if-none-match'] === etag) return send(res, 304, '', 'application/json', { ETag: etag });
      return send(res, 200, JSON.stringify({ name, state: projection }), 'application/json', { ETag: etag });
    }
    if (!/^\/(?:app\/|icone\/|themes\.css$|icon\.svg$)/.test(pathname))
      return send(res, 404, 'Tavolo non trovato o chiuso');
    let file;
    try { file = path.resolve(staticRoot, '.' + decodeURIComponent(pathname)); }
    catch { return send(res, 400, 'Percorso non valido'); }
    if (!file.startsWith(staticRoot + path.sep)) return send(res, 403, 'Accesso negato');
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return send(res, 404, 'Non trovato');
      res.writeHead(200, { ...NO_STORE, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
  }

  async function info() {
    if (!token || !server?.listening) return { open: false };
    const port = server.address().port;
    const ips = addresses();
    const choices = ips.length ? ips : [{ name: 'Questo PC', address: '127.0.0.1' }];
    const urls = choices.map(({ address }) => `http://${address}:${port}/tavolo/${token}`);
    const qrs = await Promise.all(urls.map(url => QRCode.toDataURL(url, { margin: 1, width: 200 })));
    return { open: true, urls, qrs, interfaces: choices.map(x => x.name), qr: qrs[0] };
  }

  function update(state) {
    if (!token) return;
    const next = projectForPlayers(state);
    if (!next) throw new Error('Campagna non valida');
    projection = next;
    name = String(state.root.title || 'Campagna');
    revision++;
  }

  async function open(state) {
    if (token) close();
    token = crypto.randomBytes(24).toString('base64url');
    try {
      update(state);
      server = http.createServer(handle);
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '0.0.0.0', resolve);
      });
      return await info();
    } catch (error) { close(); throw error; }
  }

  function close() {
    token = null; projection = null;
    if (server) { server.close(); server = null; }
    return { open: false };
  }

  return { open, update, close, info };
}

module.exports = { createTableServer };

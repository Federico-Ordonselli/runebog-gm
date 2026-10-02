const { app, BrowserWindow, protocol, net, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ORIGIN = 'runebog://app';
protocol.registerSchemesAsPrivileged([{
  scheme: 'runebog',
  privileges: { standard: true, secure: true, supportFetchAPI: true },
}]);

// electron-builder imposta questa variabile sull'eseguibile portable. Il profilo
// Chromium, incluso localStorage, segue l'EXE quando viene spostato su USB.
if (process.env.PORTABLE_EXECUTABLE_DIR) {
  app.setPath('userData', path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'Runebog GM Data'));
}

// Lo smoke test scrive (localStorage, immagini) nel profilo usa-e-getta che
// smoke.cjs crea e poi cancella, non in quello di chi lo lancia.
if (process.env.RUNEBOG_SMOKE_TEST === '1' && process.env.RUNEBOG_SMOKE_PROFILE) {
  app.setPath('userData', process.env.RUNEBOG_SMOKE_PROFILE);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    const staticRoot = app.isPackaged
      ? path.join(process.resourcesPath, 'static')
      : path.resolve(__dirname, '..', 'public');
    const { createTableServer } = require('./table-server.cjs');
    const { createImageStore, INTESTAZIONI } = require('./immagini.cjs');
    const images = createImageStore(path.join(app.getPath('userData'), 'immagini'));
    const table = createTableServer(staticRoot, { images });

    protocol.handle('runebog', request => {
      const url = new URL(request.url);
      if (url.host !== 'app' || request.method !== 'GET') return new Response('Non trovato', { status: 404 });
      const pathname = url.pathname === '/' ? '/app.html' : url.pathname;
      if (pathname.startsWith('/immagini/')) {
        const found = images.find(pathname.slice('/immagini/'.length));
        if (!found) return new Response('Immagine non trovata', { status: 404 });
        return new Response(fs.readFileSync(found.file),
          { headers: { ...INTESTAZIONI, 'Content-Type': found.mime } });
      }
      let file;
      try { file = path.resolve(staticRoot, '.' + decodeURIComponent(pathname)); }
      catch { return new Response('Percorso non valido', { status: 400 }); }
      if (!file.startsWith(staticRoot + path.sep)) return new Response('Accesso negato', { status: 403 });
      if (!app.isPackaged && pathname === '/icon.svg') {
        file = path.resolve(__dirname, '..', 'src', 'app', 'icon.svg');
      }
      return net.fetch(pathToFileURL(file).toString());
    });

    const smoke = process.env.RUNEBOG_SMOKE_TEST === '1';
    const win = new BrowserWindow({
      show: !smoke,
      width: 1440, height: 900, minWidth: 760, minHeight: 560,
      title: 'Runebog GM',
      icon: path.join(staticRoot, 'icone', 'runebog-512.png'),
      webPreferences: {
        nodeIntegration: false, contextIsolation: true, sandbox: true,
        preload: path.join(__dirname, 'preload.cjs'),
      },
    });
    const fromEditor = event => event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame;
    ipcMain.handle('table:open', (event, state) => {
      if (!fromEditor(event)) throw new Error('Accesso negato');
      return table.open(state);
    });
    ipcMain.handle('table:update', (event, state) => {
      if (!fromEditor(event)) throw new Error('Accesso negato');
      table.update(state);
    });
    ipcMain.handle('table:close', event => {
      if (!fromEditor(event)) throw new Error('Accesso negato');
      return table.close();
    });
    ipcMain.handle('table:info', event => {
      if (!fromEditor(event)) throw new Error('Accesso negato');
      return table.info();
    });
    ipcMain.handle('immagini:salva', (event, bytes, mime) => {
      if (!fromEditor(event)) throw new Error('Accesso negato');
      return images.save(bytes, mime);
    });
    ipcMain.handle('immagini:spazza', (event, keys) => {
      if (!fromEditor(event)) throw new Error('Accesso negato');
      if (!Array.isArray(keys)) throw new Error('Elenco non valido');
      return images.sweep(keys.filter(k => typeof k === 'string'));
    });
    win.on('closed', () => table.close());
    win.removeMenu();
    /* L'unica finestra interna ammessa è quella dell'immagine (apriInFinestra
       in pannello.js): un about:blank col nome dichiarato, che l'editor riempie
       da sé. Nient'altro si apre qui dentro. */
    win.webContents.setWindowOpenHandler(({ url, frameName }) => {
      if (url === 'about:blank' && frameName === 'runebog-immagine') {
        return { action: 'allow', overrideBrowserWindowOptions: {
          width: 900, height: 700, autoHideMenuBar: true, backgroundColor: '#0b0f0c' } };
      }
      if (url.startsWith('https://')) shell.openExternal(url);
      return { action: 'deny' };
    });
    win.webContents.on('did-create-window', child => {
      child.removeMenu();
      child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      child.webContents.on('will-navigate', event => event.preventDefault());
    });
    win.webContents.on('will-navigate', (event, url) => {
      if (url.startsWith(ORIGIN + '/')) return;
      event.preventDefault();
      if (url.startsWith('https://')) shell.openExternal(url);
    });
    win.loadURL(ORIGIN + '/app.html');
    if (smoke) {
      win.webContents.once('did-finish-load', async () => {
        try {
          const result = await win.webContents.executeJavaScript(`({
            title: document.title,
            editor: typeof window.newCampaign === 'function',
            desktop: typeof window.runebogDesktop?.openTable === 'function',
            styles: [...document.styleSheets].some(s => s.href?.endsWith('/app/app.css')),
            monsters: Array.isArray(window.SRD_MONSTERS) && window.SRD_MONSTERS.length > 0,
            storage: (() => { localStorage.setItem('runebog-smoke', 'ok');
              const ok = localStorage.getItem('runebog-smoke') === 'ok';
              localStorage.removeItem('runebog-smoke'); return ok; })()
          })`);
          if (!result.editor || !result.desktop || !result.storage || !result.styles || !result.monsters || !result.title.includes('Runebog')) {
            throw new Error(JSON.stringify(result));
          }
          const tableOK = await win.webContents.executeJavaScript(`(async () => {
            const opened = await window.runebogDesktop.openTable({
              root: { id: 'root', title: 'Smoke', type: 'zona', children: [], edges: [] },
              checklist: [], players: []
            });
            const ok = opened.open && opened.urls.length > 0 && opened.qr.startsWith('data:image/png');
            await window.runebogDesktop.closeTable();
            return ok;
          })()`);
          if (!tableOK) throw new Error('Tavolo locale non disponibile');
          // le immagini vanno su file e tornano dal protocollo dell'app
          const immagine = await win.webContents.executeJavaScript(`(async () => {
            const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
            const url = await window.runebogDesktop.saveImage(png, 'image/png');
            const res = await fetch(url);
            const img = new Image(); img.src = url; await img.decode();
            return /^\\/immagini\\//.test(url) && res.headers.get('content-type') === 'image/png'
              && img.naturalWidth === 1;
          })()`);
          if (!immagine) throw new Error('Immagini su file non disponibili');
          // una campagna di prima del 2 ott 2026, col data URL dentro, alla
          // riapertura si ritrova l'immagine su file
          // Scritta in un pagehide registrato DOPO quello dell'editor, che
          // uscendo riscrive l'indice delle campagne che ha in memoria.
          await win.webContents.executeJavaScript(`addEventListener('pagehide', () => {
            const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
            localStorage.setItem('gm-campaigns-v1', JSON.stringify([{ id: 'vecchia', name: 'Vecchia', updatedAt: 1 }]));
            localStorage.setItem('gm-current-campaign', 'vecchia');
            localStorage.setItem('gm-campaign-vecchia', JSON.stringify({ schemaVersion: 1,
              root: { id: 'root', title: 'Vecchia', type: 'zona', img: png, children: [], edges: [] },
              checklist: [], players: [] }));
          })`);
          await new Promise(resolve => { win.webContents.once('did-finish-load', resolve); win.webContents.reload(); });
          const migrata = await win.webContents.executeJavaScript(`(async () => {
            for (let i = 0; i < 50; i++) {
              const img = JSON.parse(localStorage.getItem('gm-campaign-vecchia')).root.img;
              if (/^\\/immagini\\//.test(img)) return true;
              await new Promise(r => setTimeout(r, 100));
            }
            return false;
          })()`);
          if (!migrata) throw new Error('Il data URL della campagna non è passato su file');
          // Oltre il vecchio tetto (3,75 MiB): il backup la reincorpora intera,
          // il contratto dell'import del portable la accetta, e torna su file.
          const grande = await win.webContents.executeJavaScript(`(async () => {
            const im = await import('/app/immagini.js');
            const fc = await import('/app/formato-campagna.js');
            const url = await window.runebogDesktop.saveImage(new Uint8Array(5 * 1024 * 1024).fill(7), 'image/png');
            const stato = { schemaVersion: 1, root: { id: 'root', title: 'G', type: 'zona', status: '', notes: '', img: url, children: [], edges: [], x: null, y: null, shape: null },
              checklist: [], players: [] };
            const backup = await im.embedImages(stato, { limit: im.DESKTOP_IMAGE_BYTES });
            const testo = JSON.stringify(backup);
            if (fc.parseCampaignJson(testo, { documentBytes: im.ARCHIVE_BYTES }).ok) return 'il sito la accetterebbe';
            const esito = fc.parseCampaignJson(testo, { documentBytes: im.ARCHIVE_BYTES, imageBytes: im.DESKTOP_DATA_URL_BYTES });
            if (!esito.ok) return 'import rifiutato: ' + esito.error.code;
            await im.storeImagesOnDisk(esito.value, window.runebogDesktop.saveImage);
            const ritorno = await fetch(esito.value.root.img);
            return (await ritorno.arrayBuffer()).byteLength === 5 * 1024 * 1024 || 'byte diversi';
          })()`);
          if (grande !== true) throw new Error('Immagine grande: ' + grande);
          // la finestra dell'immagine si apre e si scrive; qualunque altra resta chiusa
          const finestra = await win.webContents.executeJavaScript(`(() => {
            const w = window.open('', 'runebog-immagine', 'popup');
            const altra = window.open('', 'altra', 'popup');
            const ok = !!w && typeof w.document?.write === 'function' && altra === null;
            w?.close();
            return ok;
          })()`, true);
          if (!finestra) throw new Error('Finestra immagine non disponibile');
          // il generatore di dungeon è un import dinamico dal protocollo dell'app
          const dungeon = await win.webContents.executeJavaScript(`import('/app/dungeon-motore.js').then(m => {
            const d = m.generateDungeon({ seed: 1, name: 'Smoke', roomCount: 6, theme: 'misto', level: 1,
              partySize: 4, difficulty: 'medio', ruleset: '2024' }, m.MONSTERS, m.MAGIC_ITEMS);
            return d.rooms.length === 6;
          })`);
          if (!dungeon) throw new Error('Generatore di dungeon non disponibile');
          console.log('Desktop smoke OK:', JSON.stringify(result));
          app.exit(0);
        } catch (error) { console.error(error); app.exit(1); }
      });
      win.webContents.once('did-fail-load', (_event, code, description) => {
        console.error('Caricamento fallito:', code, description);
        app.exit(1);
      });
    }
  });

  app.on('window-all-closed', () => app.quit());
}

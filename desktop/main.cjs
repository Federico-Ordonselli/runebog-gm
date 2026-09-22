const { app, BrowserWindow, protocol, net, shell, ipcMain } = require('electron');
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
    const table = createTableServer(staticRoot);

    protocol.handle('runebog', request => {
      const url = new URL(request.url);
      if (url.host !== 'app' || request.method !== 'GET') return new Response('Non trovato', { status: 404 });
      const pathname = url.pathname === '/' ? '/app.html' : url.pathname;
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
    win.on('closed', () => table.close());
    win.removeMenu();
    win.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://')) shell.openExternal(url);
      return { action: 'deny' };
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

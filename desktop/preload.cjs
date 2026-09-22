const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('runebogDesktop', Object.freeze({
  openTable: state => ipcRenderer.invoke('table:open', state),
  updateTable: state => ipcRenderer.invoke('table:update', state),
  closeTable: () => ipcRenderer.invoke('table:close'),
  tableInfo: () => ipcRenderer.invoke('table:info'),
}));

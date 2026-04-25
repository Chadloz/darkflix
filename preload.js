const { contextBridge, ipcRenderer } = require('electron');

console.log('[DEBUG][Preload] Bridge loading - Status: Started');

contextBridge.exposeInMainWorld('darkflix', {
  storeGet:    (key)        => ipcRenderer.invoke('store:get', key),
  storeSet:    (key, value) => ipcRenderer.invoke('store:set', key, value),
  storeGetAll: ()           => ipcRenderer.invoke('store:getAll'),
  fetchText:   (url, headers) => ipcRenderer.invoke('net:fetchText', url, headers),
  fetchJson:   (url, headers) => ipcRenderer.invoke('net:fetchJson', url, headers),
  openM3U:     ()           => ipcRenderer.invoke('file:openM3U'),
  platform:    process.platform,
});

console.log('[DEBUG][Preload] Bridge loading - Status: Success');
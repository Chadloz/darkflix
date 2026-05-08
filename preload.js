const { contextBridge, ipcRenderer } = require('electron');

console.log('[DEBUG][Preload] Bridge loading - Status: Started');

contextBridge.exposeInMainWorld('darkflix', {
  storeGet:    (key)        => ipcRenderer.invoke('store:get', key),
  storeSet:    (key, value) => ipcRenderer.invoke('store:set', key, value),
  storeGetAll: ()           => ipcRenderer.invoke('store:getAll'),
  fetchText:   (url, headers) => ipcRenderer.invoke('net:fetchText', url, headers),
  fetchJson:   (url, headers) => ipcRenderer.invoke('net:fetchJson', url, headers),
  openM3U:     ()           => ipcRenderer.invoke('file:openM3U'),
  saveLog:     (content)    => ipcRenderer.invoke('file:saveLog', content),
  encrypt:     (text)       => ipcRenderer.invoke('crypto:encrypt', text),
  decrypt:     (text)       => ipcRenderer.invoke('crypto:decrypt', text),
  platform:    process.platform,
  appVersion:   process.env.npm_package_version || '1.0.5',
  castDiscover: ()                    => ipcRenderer.invoke('cast:discover'),
  castSend:     (device, url, type)   => ipcRenderer.invoke('cast:send', device, url, type),
  castStop:     ()                    => ipcRenderer.invoke('cast:stop'),
  updateCheck:    ()  => ipcRenderer.invoke('update:check'),
  updateDownload: ()  => ipcRenderer.invoke('update:download'),
  updateInstall:  ()  => ipcRenderer.invoke('update:install'),
  onUpdateAvailable:    (cb) => ipcRenderer.on('update-available',    (e, v) => cb(v)),
  onUpdateNotAvailable: (cb) => ipcRenderer.on('update-not-available', ()    => cb()),
  onUpdateDownloaded:   (cb) => ipcRenderer.on('update-downloaded',   ()    => cb()),
  onUpdateError:        (cb) => ipcRenderer.on('update-error',        (e, m) => cb(m)),
});

console.log('[DEBUG][Preload] Bridge loading - Status: Success');
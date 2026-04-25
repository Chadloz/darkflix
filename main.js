const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let storePath;
let _store = {};

function storeLoad() {
  try { _store = JSON.parse(fs.readFileSync(storePath, 'utf-8')); }
  catch { _store = {}; }
  console.log('[DEBUG][Main] storeLoad - Status: Success - Payload: keys=' + Object.keys(_store).join(','));
}
function storeSave() {
  try { fs.writeFileSync(storePath, JSON.stringify(_store, null, 2)); }
  catch (e) { console.error('[DEBUG][Main] storeSave - Status: Error - Payload: ' + e.message); }
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 16 } : undefined,
    title: 'Darkflix',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  console.log('[DEBUG][Main] createWindow - Status: Success');
}

app.whenReady().then(() => {
  storePath = path.join(app.getPath('userData'), 'darkflix.json');
  storeLoad();
  createWindow();
  console.log('[DEBUG][Main] App ready - Status: Started - Payload: ' + storePath);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.handle('store:get', (e, key) => {
  console.log(`[DEBUG][Main] store:get - Status: Started - Payload: ${key}`);
  return _store[key];
});
ipcMain.handle('store:set', (e, key, value) => {
  console.log(`[DEBUG][Main] store:set - Status: Started - Payload: ${key}`);
  _store[key] = value;
  storeSave();
});
ipcMain.handle('store:getAll', () => {
  console.log('[DEBUG][Main] store:getAll - Status: Started');
  return _store;
});

ipcMain.handle('net:fetchText', async (e, url, headers = {}) => {
  const short = url.split('?')[0].split('/').slice(-2).join('/');
  console.log(`[DEBUG][Main] net:fetchText - Status: Started - Payload: ${short}`);
  try {
    const text = await nodeFetch(url, headers);
    console.log(`[DEBUG][Main] net:fetchText - Status: Success - Payload: ${short} (${text.length} chars)`);
    return { ok: true, text };
  } catch (e) {
    console.error(`[DEBUG][Main] net:fetchText - Status: Error - Payload: ${e.message}`);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('net:fetchJson', async (e, url, headers = {}) => {
  const short = url.split('?')[0].split('/').slice(-2).join('/');
  console.log(`[DEBUG][Main] net:fetchJson - Status: Started - Payload: ${short}`);
  try {
    const text = await nodeFetch(url, headers);
    const data = JSON.parse(text);
    console.log(`[DEBUG][Main] net:fetchJson - Status: Success - Payload: ${short}`);
    return { ok: true, data };
  } catch (e) {
    console.error(`[DEBUG][Main] net:fetchJson - Status: Error - Payload: ${e.message}`);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('file:saveLog', async (e, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Save Debug Log',
    defaultPath: 'darkflix-debug-'+new Date().toISOString().slice(0,10)+'.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }],
  });
  if (canceled || !filePath) return { ok: false };
  try { fs.writeFileSync(filePath, content); return { ok: true }; }
  catch(e) { return { ok: false, error: e.message }; }
});

ipcMain.handle('file:openM3U', async () => {
  console.log('[DEBUG][Main] file:openM3U - Status: Started');
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open M3U Playlist',
    filters: [{ name: 'M3U Playlist', extensions: ['m3u', 'm3u8', 'txt'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths.length) return { ok: false, canceled: true };
  try {
    const text = fs.readFileSync(filePaths[0], 'utf-8');
    console.log(`[DEBUG][Main] file:openM3U - Status: Success - Payload: ${filePaths[0]}`);
    return { ok: true, text, filePath: filePaths[0] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

function nodeFetch(url, extraHeaders = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) { reject(new Error('Too many redirects')); return; }
    const mod = url.startsWith('https') ? https : http;
    const opts = {
      headers: { 'User-Agent': 'Darkflix/1.0 IPTV', 'Accept': '*/*', ...extraHeaders },
      timeout: 20000,
    };
    const req = mod.get(url, opts, (res) => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location) {
        nodeFetch(res.headers.location, extraHeaders, redirects + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let storePath;
let _store = {};

// Storage is split: small settings file + big channel catalog file.
// Small saves (wasPlaying, lastChannel) never rewrite the big catalog.
const BIG_KEYS = new Set(['live', 'movies', 'series']);
let catalogPath;
const _dirty = { main: false, catalog: false };
let _saveTimer = null, _saving = false, _pending = false;

function pickKeys(big) {
  const o = {};
  for (const k of Object.keys(_store)) { if (BIG_KEYS.has(k) === big) o[k] = _store[k]; }
  return o;
}
function storeLoad() {
  catalogPath = storePath.replace(/\.json$/, '-catalog.json');
  try { _store = JSON.parse(fs.readFileSync(storePath, 'utf-8')); }
  catch { _store = {}; }
  try {
    if (fs.existsSync(catalogPath)) {
      const cat = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
      for (const k of Object.keys(cat)) _store[k] = cat[k];
    } else {
      // First run after upgrade: move channel lists into the catalog file
      _dirty.main = true; _dirty.catalog = true;
      console.log('[DEBUG][Main] storeLoad - Status: Migrating to split storage');
    }
  } catch (e) { console.error('[DEBUG][Main] storeLoad catalog - Status: Error - Payload: ' + e.message); }
  console.log('[DEBUG][Main] storeLoad - Status: Success - Payload: keys=' + Object.keys(_store).join(','));
  if (_dirty.main || _dirty.catalog) scheduleSave(2000);
}
async function writeAtomic(file, data) {
  const tmp = file + '.tmp';
  await fs.promises.writeFile(tmp, data);
  await fs.promises.rename(tmp, file);
}
async function flushSave() {
  if (_saving) { _pending = true; return; }
  _saving = true;
  try {
    if (_dirty.main) { _dirty.main = false; await writeAtomic(storePath, JSON.stringify(pickKeys(false))); }
    if (_dirty.catalog) {
      _dirty.catalog = false;
      const t = Date.now();
      await writeAtomic(catalogPath, JSON.stringify(pickKeys(true)));
      console.log('[DEBUG][Main] storeSave catalog - Status: Success - Payload: ' + (Date.now() - t) + 'ms');
    }
  } catch (e) { console.error('[DEBUG][Main] storeSave - Status: Error - Payload: ' + e.message); }
  _saving = false;
  if (_pending) { _pending = false; flushSave(); }
}
function scheduleSave(delay) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(flushSave, delay == null ? 1000 : delay);
}
function storeSave(key) {
  if (key === undefined) { _dirty.main = true; _dirty.catalog = true; }
  else if (BIG_KEYS.has(key)) _dirty.catalog = true;
  else _dirty.main = true;
  scheduleSave();
}
function writeSyncAtomic(file, data) {
  fs.writeFileSync(file + '.tmp', data);
  fs.renameSync(file + '.tmp', file);
}
// Flush anything unsaved when the app quits
app.on('before-quit', () => {
  clearTimeout(_saveTimer);
  try {
    writeSyncAtomic(storePath, JSON.stringify(pickKeys(false)));
    if (_dirty.catalog || _saving) writeSyncAtomic(catalogPath, JSON.stringify(pickKeys(true)));
  } catch (e) { console.error('[DEBUG][Main] storeSave quit - Status: Error - Payload: ' + e.message); }
});

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 800, minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 14, y: 16 } : undefined,
    title: 'Black Mango',
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

// ── Auto Updater ──────────────────────────────────────────────────────────────
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
if(!app.isPackaged) autoUpdater.forceDevUpdateConfig = true;

autoUpdater.on('update-available', (info) => {
  if(win) win.webContents.send('update-available', info.version);
});

autoUpdater.on('update-not-available', () => {
  if(win) win.webContents.send('update-not-available');
});

autoUpdater.on('update-downloaded', () => {
  if(win) win.webContents.send('update-downloaded');
});

autoUpdater.on('error', (err) => {
  console.error('[Updater] Error:', err.message);
  if(win) win.webContents.send('update-error', err.message);
});

autoUpdater.on('checking-for-update', () => {
  console.log('[Updater] Checking for update...');
});

ipcMain.handle('update:check', async () => {
  try { await autoUpdater.checkForUpdates(); } catch(e) { return { error: e.message }; }
  return { ok: true };
});

ipcMain.handle('update:download', async () => {
  try { await autoUpdater.downloadUpdate(); } catch(e) { return { error: e.message }; }
  return { ok: true };
});

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  storePath = path.join(app.getPath('userData'), 'blackmango.json');
  storeLoad();
  createWindow();
  console.log('[DEBUG][Main] App ready - Status: Started - Payload: ' + storePath);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

const { safeStorage } = require('electron');

ipcMain.handle('crypto:encrypt', (e, text) => {
  if(!safeStorage.isEncryptionAvailable())return text;
  try{return safeStorage.encryptString(text).toString('base64');}
  catch{return text;}
});
ipcMain.handle('crypto:decrypt', (e, text) => {
  if(!safeStorage.isEncryptionAvailable())return text;
  try{return safeStorage.decryptString(Buffer.from(text,'base64'));}
  catch{return text;}
});

ipcMain.handle('store:get', (e, key) => {
  console.log(`[DEBUG][Main] store:get - Status: Started - Payload: ${key}`);
  return _store[key];
});
ipcMain.handle('store:set', (e, key, value) => {
  console.log(`[DEBUG][Main] store:set - Status: Started - Payload: ${key}`);
  _store[key] = value;
  storeSave(key);
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
    defaultPath: 'blackmango-debug-'+new Date().toISOString().slice(0,10)+'.txt',
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


// ── Cast Support ──────────────────────────────────────────────────────────────
const HLS_PROXY = 'https://darkflix-hls-proxy.chadavidlozano.workers.dev';
let _activeCastClient = null;
let _activePlayer = null;
let _activeDlnaInfo = null;
let mdns = null;
try { mdns = require('mdns-js'); } catch(e) { console.warn('[Cast] mdns-js not available, Chromecast discovery disabled:', e.message); }
const { Client: SsdpClient } = require('node-ssdp');

let _castDevices = [];

ipcMain.handle('cast:discover', async () => {
  _castDevices = [];
  return new Promise((resolve) => {
    const found = [];
    const seen = new Set();

    // Chromecast discovery via mDNS
    try {
      if(!mdns) throw new Error('mdns-js not available');
      const browser = mdns.createBrowser(mdns.tcp('googlecast'));
      browser.on('ready', () => browser.discover());
      browser.on('update', (data) => {
        const ip = data.addresses && data.addresses[0];
        if(!ip) return;
        let name = 'Chromecast';
        if(data.txt && Array.isArray(data.txt)){
          const fnEntry=data.txt.find(t=>typeof t==='string'&&t.startsWith('fn='));
          if(fnEntry) name=fnEntry.slice(3);
        } else if(data.txt&&data.txt.fn){ name=data.txt.fn; }
        const key = 'cc:' + ip;
        if (ip && !seen.has(key)) {
          seen.add(key);
          found.push({ id: key, name, type: 'chromecast', host: ip, port: data.port || 8009 });
        }
      });
      setTimeout(() => { try { browser.stop(); } catch {} }, 4000);
    } catch(e) {
      console.error('[Cast] mDNS error:', e.message);
    }

    // DLNA/UPnP discovery via SSDP
    try {
      const ssdp = new SsdpClient();
      ssdp.on('response', (headers, statusCode, rinfo) => {
        const ip = rinfo.address;
        // Filter routers, link-local, and devices already found as Chromecast
        if(ip === '10.0.0.1' || ip === '192.168.1.1' || ip.startsWith('169.254')) return;
        if(seen.has('cc:' + ip)) return;
        const key = 'dlna:' + ip;
        if (!seen.has(key)) {
          seen.add(key);
          const loc = headers['LOCATION'] || '';
          const server = headers['SERVER'] || '';
          // Try to get a clean name from server string
          let friendlyName = rinfo.address;
          if(server) {
            // Server strings like "Microsoft-Windows/10.0 UPnP/1.0" -> "Windows PC"
            if(server.includes('Microsoft-Windows')) friendlyName = 'Windows PC';
            else if(server.includes('LG')) friendlyName = 'LG TV';
            else if(server.includes('Samsung')) friendlyName = 'Samsung TV';
            else if(server.includes('Roku')) friendlyName = 'Roku';
            else if(server.includes('Xbox')) friendlyName = 'Xbox';
            else if(server.includes('Sony')) friendlyName = 'Sony TV';
            else if(server.includes('Linux')) friendlyName = 'Smart TV';
          else friendlyName = server.split('/')[0].split(' ')[0];
          }
          found.push({ id: key, name: friendlyName + ' (' + ip + ')', type: 'dlna', host: ip, location: loc });
        }
      });
      // Search multiple service types to catch LG, Roku, Samsung, Xbox, etc.
      const searchTypes = [
        'urn:schemas-upnp-org:service:AVTransport:1',
        'urn:schemas-upnp-org:device:MediaRenderer:1',
        'ssdp:all',
      ];
      searchTypes.forEach(t => { try { ssdp.search(t); } catch {} });
      setTimeout(() => { try { ssdp.stop(); } catch {} }, 4000);
    } catch(e) {
      console.error('[Cast] SSDP error:', e.message);
    }

    // Resolve after 4.5s with whatever we found
    setTimeout(() => {
      // Final dedup -- prefer Chromecast entries over DLNA for same IP
      const ipMap = {};
      found.forEach(d => {
        const ip = d.host;
        if(!ipMap[ip] || d.type === 'chromecast') ipMap[ip] = d;
      });
      const deduped = Object.values(ipMap);
      _castDevices = deduped;
      resolve(deduped);
    }, 4500);
  });
});

ipcMain.handle('cast:send', async (e, device, streamUrl, contentType) => {
  // Route HLS streams through Cloudflare proxy for Chromecast
  let castUrl = streamUrl;
  if(device.type === 'chromecast' && !streamUrl.includes('.mp4') && !streamUrl.includes('.mkv')){
    castUrl = HLS_PROXY + '/?url=' + encodeURIComponent(streamUrl);
    console.log('[Cast] Proxying through Cloudflare:', castUrl);
  } else {
    console.log('[Cast] Sending to', device.name, device.host, streamUrl);
  }
  try {
    if (device.type === 'chromecast') {
      const { Client, DefaultMediaReceiver } = require('castv2-client');
      return new Promise((resolve) => {
        const client = new Client();
        client.connect(device.host, () => {
          client.launch(DefaultMediaReceiver, (err, player) => {
            if (err) { client.close(); return resolve({ ok: false, error: err.message }); }
            // Force correct content type for raw IPTV streams
            let resolvedType = contentType || 'application/x-mpegURL';
            if(!streamUrl.includes('.') || streamUrl.match(/\/[^.]+$/)){
              resolvedType = 'video/mp2t';
            }
            const media = {
              contentId: castUrl,
              contentType: resolvedType,
              streamType: streamUrl.endsWith('.mp4') ? 'BUFFERED' : 'LIVE',
            };
            player.load(media, { autoplay: true }, (err) => {
              if (err) { client.close(); return resolve({ ok: false, error: err.message }); }
              _activeCastClient = client;
              _activePlayer = player;
              resolve({ ok: true });
            });
          });
        });
        client.on('error', (err) => { resolve({ ok: false, error: err.message }); });
      });
    }

    if (device.type === 'dlna') {
      try {
        // Step 1: Fetch device XML to find real AVTransport control URL
        let avTransportUrl = null;
        if(device.location) {
          const xmlText = await nodeFetch(device.location);
          // Extract friendly name from XML if available
          const nameMatch = xmlText.match(/<friendlyName>([^<]+)<\/friendlyName>/i);
          if(nameMatch) console.log('[Cast] Device friendly name:', nameMatch[1]);
          // Find AVTransport service controlURL
          // Try AVTransport first, fall back to any controlURL (LG uses proprietary service)
          let avMatch = xmlText.match(/AVTransport[\s\S]*?<controlURL>([^<]+)<\/controlURL>/i);
          if(!avMatch) avMatch = xmlText.match(/<controlURL>([^<]+)<\/controlURL>/i);
          if(avMatch) {
            const controlPath = avMatch[1].startsWith('/') ? avMatch[1] : '/' + avMatch[1];
            const locUrl = new URL(device.location);
            avTransportUrl = locUrl.protocol + '//' + locUrl.hostname + ':' + (locUrl.port||80) + controlPath;
          }
        }
        if(!avTransportUrl) {
          // Fallback guesses for common devices
          avTransportUrl = 'http://' + device.host + ':7676/dmr/control/AVTransport';
        }
        console.log('[Cast] DLNA AVTransport URL:', avTransportUrl);

        const envelope = (body) =>
          '<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body>' + body + '</s:Body></s:Envelope>';
        // Build DIDL metadata required by Windows/Xbox DLNA
        const mime = contentType || 'video/mp4';
        const didl = '&lt;DIDL-Lite xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"&gt;&lt;item id="0" parentID="-1" restricted="1"&gt;&lt;dc:title&gt;Darkflix Stream&lt;/dc:title&gt;&lt;upnp:class&gt;object.item.videoItem&lt;/upnp:class&gt;&lt;res protocolInfo="http-get:*:' + mime + ':*"&gt;' + streamUrl + '&lt;/res&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;';
        const setUri = envelope(
          '<u:SetAVTransportURI xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><CurrentURI>' + streamUrl + '</CurrentURI><CurrentURIMetaData>' + didl + '</CurrentURIMetaData></u:SetAVTransportURI>');
        const play = envelope(
          '<u:Play xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID><Speed>1</Speed></u:Play>');

        const soapPost = (url, body, action) => new Promise((res, rej) => {
          const u = new URL(url);
          const opts = { hostname: u.hostname, port: parseInt(u.port)||80, path: u.pathname, method: 'POST',
            headers: { 'Content-Type': 'text/xml; charset="utf-8"', 'SOAPAction': '"' + action + '"',
              'Content-Length': Buffer.byteLength(body), 'Connection': 'close' } };
          const req = http.request(opts, (r) => {
            let data = '';
            r.on('data', c => data += c);
            r.on('end', () => res({ status: r.statusCode, body: data }));
          });
          req.on('error', rej);
          req.write(body);
          req.end();
        });

        // Stop any current playback first
        const stopEnv = envelope('<u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:Stop>');
        try { await soapPost(avTransportUrl, stopEnv, 'urn:schemas-upnp-org:service:AVTransport:1#Stop'); } catch(e) {}

        const r1 = await soapPost(avTransportUrl, setUri, 'urn:schemas-upnp-org:service:AVTransport:1#SetAVTransportURI');
        console.log('[Cast] DLNA SetAVTransportURI status:', r1.status, r1.body.slice(0,500));
        if(r1.status >= 400) return { ok: false, error: 'SetAVTransportURI failed: ' + r1.status + ' ' + r1.body };

        const r2 = await soapPost(avTransportUrl, play, 'urn:schemas-upnp-org:service:AVTransport:1#Play');
        console.log('[Cast] DLNA Play status:', r2.status);
        if(r2.status >= 400) return { ok: false, error: 'Play failed: ' + r2.status + ' ' + r2.body };

        _activeDlnaInfo = { avTransportUrl, soapPost, envelope };
        return { ok: true };
      } catch(e) {
        return { ok: false, error: e.message };
      }
    }

    return { ok: false, error: 'Unknown device type' };
  } catch(e) {
    console.error('[Cast] Send error:', e.message);
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('cast:stop', async () => {
  if(_activeCastClient){
    try{
      _activeCastClient.stop(_activePlayer, function(){
        try{_activeCastClient.close();}catch(e){}
      });
    }catch(e){
      try{_activeCastClient.close();}catch(e2){}
    }
    _activeCastClient = null;
    _activePlayer = null;
  }
  if(_activeDlnaInfo){
    try{
      const { avTransportUrl, soapPost, envelope } = _activeDlnaInfo;
      const stopEnv = envelope('<u:Stop xmlns:u="urn:schemas-upnp-org:service:AVTransport:1"><InstanceID>0</InstanceID></u:Stop>');
      await soapPost(avTransportUrl, stopEnv, 'urn:schemas-upnp-org:service:AVTransport:1#Stop');
    }catch(e){ console.error('[Cast] DLNA stop error:', e.message); }
    _activeDlnaInfo = null;
  }
  return { ok: true };
});

function nodeFetch(url, extraHeaders = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) { reject(new Error('Too many redirects')); return; }
    const mod = url.startsWith('https') ? https : http;
    const opts = {
      headers: { 'User-Agent': 'BlackMango/1.0 IPTV', 'Accept': '*/*', ...extraHeaders },
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
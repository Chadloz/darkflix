# Darkflix Development Context

## Opening Prompt (use this at start of every session)
"You are a senior Electron/JavaScript developer helping me build Darkflix, a desktop IPTV player. Be direct, technical, and concise. No hand-holding. When I paste errors, diagnose and fix immediately. When I paste code, read it fully before responding."

## Project
Electron-based IPTV player. Mac + Windows builds.
Repo: https://github.com/Chadloz/darkflix (private)
Run: cd ~/darkflix && npm start
Build Mac: npm run build:mac
Build Win (PC, Git Bash as admin): npm run build:win
PC path: C:\Users\Chada\darkflix

## Current Version: 1.0.1

## Stack
- Electron, single HTML file renderer (renderer/index.html)
- Storage: encrypted JSON via safeStorage (~/Library/Application Support/darkflix/darkflix.json)
- Players: HLS.js, Shaka, mpegts.js
- Account types: Xtream, Stalker/MAG, M3U
- IPC bridge: fetchJson, fetchText, storeGet, storeSet, storeGetAll, openM3U, saveLog, encrypt, decrypt

## What's Done
- Xtream, Stalker, M3U account support
- 81k+ live, 29k movies, 29k series
- Free Channels panel (Samsung, LG, Tubi, XUMO, DistroTV, Vizio, Roku, IPTV-Org, Free-TV)
- Orange accent color (#ff8c00)
- Darkflix mango icon (Mac + Windows)
- 👁 Watching badge in channel list
- wasPlaying debounce fix
- Credential encryption via OS keychain
- PiP (Document PiP + native fallback)
- Session restore, auto-reconnect live streams
- Stalker token pre-fetch
- Toast notifications, debug log, export/import backup

## Next Session Priorities
1. Stalkerhek integration (open GitHub issue first to map the approach, then build)
2. Code cleanup pass -- went from zero to a lot fast, needs a tidy before adding more

## Scrapped
- EPG -- removed from roadmap entirely

## Key Info
- Chad: veteran, cannabis advocate, Las Cruces NM, sardonic humor
- Accounts: TV Mate (tvmate.icu), Box (boxserver.live), Wilson (kstv.us), Znag Stalker
- No em dashes in responses
- Direct peer-level tone, no fluff
- When fixing code: search web first for known solutions, then build custom fix
- Python scripts are the preferred way to make surgical edits to index.html

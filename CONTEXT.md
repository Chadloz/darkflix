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

## Research First Rule
Before ANY fix, feature, or integration: search the web first. Electron docs, GitHub issues, Stack Overflow, existing libraries. Most of what we're building has been done before -- find it, adapt it, don't reinvent it. Only write custom code when nothing usable exists.

## Known Bugs (fix next session)
- **PiP expand bug**: When exiting PiP back to normal view, the app navigates to the home page instead of returning to the original page/view where the content was playing. Should restore the user's position (series page, movie detail, channel list, etc.) on expand.

## Known Bugs (fix next session)

### PiP - Expand / Source Nav Bug
- Navigating back to the source view while in PiP (e.g. go to Movies while watching a movie in PiP) kills PiP and dumps to normal view instead of just navigating the panel
- Should: let user browse the source section freely while PiP keeps playing, only exit PiP if they explicitly hit Expand or Exit
- Key flags involved: _pipReturnInfo, _pipExpanding, _stoppingFromRemote, _docPipVidInfo

### Audio Missing on Some Content
- Some movies and shows play with no audio
- Likely source-side codec issue (AC3/EAC3 not supported in Chromium without passthrough)
- Investigate: check if pattern is format-specific (ts vs mp4), add audio track detection/switching
- Low priority, may not be fixable on our end

### Free Channels - Accounts Not Saving
- Free channel panel accounts may not be persisting correctly
- Needs investigation and fix

## Code Quality
- Refactor pass scheduled -- codebase grew fast, needs cleanup for maintainability and future contributors

## Tomorrow's Order of Operations
1. Bug fixes (PiP nav, audio codec, free channels not saving)
2. Stalkerhek integration (GitHub issue first, then build)
3. Refactor / code cleanup pass

## Stalkerhek - REMOVED FROM ROADMAP
Not needed. Stalker accounts working fine after previous fixes. Stalkerhek solves multi-device auth conflicts and stream reliability issues that don't exist in this setup.

## Completed This Session
- PiP nav bug fixed
- _wpTimer global scope fix
- Home page movie/series click nav fixed
- Light refactor: globals consolidated, var->let, section comments
- Stalkerhek removed from roadmap
- MKV audio confirmed write-off

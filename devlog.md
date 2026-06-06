# Dev Log — SupaSing / SupaTraxx

## 2026-06-06 (Session 2) — STT + TTS Fix + Proactive Naledi + Docs Site

### Naledi STT (Speech-to-Text)
- **`/naledi/stt` endpoint**: uses `@cf/openai/whisper-large-v3-turbo` ($0.00045/min)
- **Mic button** on naledi-test.html: click → MediaRecorder captures audio → base64 → whisper → transcribed text → auto-sent as chat message
- Works with browser microphone, handles errors gracefully

### TTS Fix — now actually works
- Chat endpoint received `tts: true` param but **never called the TTS model** — bug
- Added `generateTTS()` helper: after getting the reply, calls `@cf/myshell-ai/melotts` and includes `audio` in response
- Frontend `data.audio` check now fires correctly — Naledi speaks her replies
- Max 500 chars per TTS call (melotts limit)

### Proactive Naledi
- **System prompt** updated: Naledi now ends every reply with a question or invitation
- **Dynamic greeting**: removed hardcoded first message from HTML. On page load, sends `init: true` to `/naledi/chat` — Naledi generates a fresh greeting every time
- Personality: "always greet first, ask follow-up questions, suggest songs, keep conversation flowing"

### Docs Site — docs.oriondevcore.com
- Created `/home/graham/docs-site/public/` with FAQ.md, HOWTO.md, HELP.md (copied from supa_singv1, updated links to current domains)
- Clean index page with navigation cards
- `_redirects`: `/faq` → `/FAQ.md 200`, `/howto` → `/HOWTO.md 200`, `/help` → `/HELP.md 200`
- Privacy policy + terms pages preserved from previous deployment
- Deployed to `orion-docs` Pages project via wrangler direct upload (not git)

### NEXUS POS / MPOS
- Reviewed Nexus POS on GitHub — full-featured POS system, significant effort to port
- MPOS remains a Google Apps Script solution for now (T. Mpumlwana & Associates)
- Future: migrate MPOS from GAS to Cloudflare Workers when bandwidth allows

### Known Issues
- Windows poller still offline (laptop disconnected from Connor's)
- Song count mismatch persists (224,956 in D1 vs 671,865 on Windows)

## 2026-06-06 — Naledi Phase 2: GLM-4.7-Flash + Tool Calling + TTS + Pages Cleanup

### Naledi Chat Upgrade
- **Model swap**: `@cf/meta/llama-3.2-3b-instruct` → `@cf/zai-org/glm-4.7-flash` (supports tool calling, 131K context, better at following instructions)
- **searchSongs tool**: Naledi can now search the 667K karaoke library automatically — when you ask for song recommendations, she calls the API, reads results, and suggests real songs
- **Multi-turn tool loop**: GLM can make multiple search calls (e.g., "Queen songs" then "We Will Rock You" for details), combine results, and respond naturally
- **Tool debug info**: response includes `toolCalls` array showing name, args, and result of each tool use

### TTS (Text-to-Speech)
- **`/naledi/tts` endpoint**: uses `@cf/myshell-ai/melotts`, returns base64 MP3 audio
- **Pricing**: $0.0002/min — ~537 minutes/day fit in $5 Workers Paid plan
- Tested: 354K audio chars for "Hello Graham, Naledi here. Ready for karaoke tonight?"

### Test Playground
- **`naledi-test.html`** at `oriondevcore.com/naledi-test.html`
- Preset buttons: recommend songs, Queen rock, R&B, soulful ballad, services, intro
- Tool call debug panel (sidebar): shows every tool Naledi used, args, and results
- TTS toggle: hear Naledi speak responses
- Works offline/online — graceful error handling

### SupaTraxx 404 Fix
- **Root cause**: `zen-search` Pages project had empty `root_dir` in build config → published repo root instead of `/zen-search/` → every deployment served 404
- **Fix**: set `root_dir: zen-search` via API, retriggered deployment
- `supatraxx.oriondevcore.com` now HTTP 200 with full SupaTraxx UI
- `zen-search.oriondevcore.com` was serving stale cache (worked because old deployment had correct root_dir before redesign)

### Pages Deployment Cleanup
- **zen-search**: deleted 14 old deployments (manual uploads, stale main builds) — kept only current live build
- **orion-ventures**: deleted 23 old deployments (including 5 failed builds) — kept 2 latest

### Known Issues
- Windows poller still offline (laptop disconnected from Connor's)
- Song count mismatch persists (224,956 in D1 vs 671,865 on Windows)

## 2026-06-04 — SupaTraxx Redesign + Charts + Artwork

### SupaTraxx (zen-search) — Full UI Redesign
- **Big text**: base font bumped to 20px, song titles 18px bold, everything large and readable
- **Simplified layout**: removed "moods" section, AI orb, koan — just search bar + genre chips + results
- **Fat genre pills**: horizontal scroll, 16px bold text, gold highlight when active
- **Album artwork**: song cards now have 72×72 thumbnail, fetched via iTunes API and cached in D1 (`album_art` table)
- **Charts on homepage**: "Hot Right Now" section shows most-requested songs + top artists — **anonymous, no user names**
- **Singer history tab**: bottom nav "My Songs" shows personal request history from `/profile` endpoint
- **Bottom nav**: Search | My Songs | Faves | Profile — only shows after sign-in
- **Click to explore**: tapping a chart card auto-searches that song; tapping a song card's artist fills search bar
- **Big SUPASING button**: green, high-contrast, disabled briefly after request to prevent double-tap

### Worker Updates (v4.1)
- `GET /charts?days=30` — most requested songs + artists (anonymous, no names)
- `GET /artwork?artist=X&title=Y` — iTunes album art lookup, cached in `album_art` D1 table (UNIQUE on artist+title)
- `album_art` table created in `supatraxx_karaoke_db` via D1 migration
- Both endpoints tested and live

### Known Issue
- Song count: OpenKJ has **671,865** songs on Windows, but only **224,956** imported to D1. ~447k missing — likely import script needs investigation.

## 2026-06-04 — Phase 1b Complete

### Session 1 — OKJRS Flow Fixes
- **OKJRS serial bug**: `getSerial(env)` was reading a static env var (`OKJRS_SERIAL=15`), so OKJRS never detected new requests — button never flashed. Changed to dynamic query: `SELECT MAX(id) FROM song_requests`. Deployed.
- **OKJRS protocol fixes**: `error` field changed from boolean to string `"false"`/`"true"` to match StandaloneRequestServer format.
- **Session-aware routing**: Changed from "has any prior requests" to `total_requests > 0` — first-ever request is pending (popup), subsequent are silent (auto-queue).
- **RevertToPending**: Added API command + poller logic — when a silent request targets a singer NOT in rotation, poller flips it back to pending so KJ gets the popup.
- **Poller state file**: Hardcoded to `C:\Users\Admin\.hermes\...` to work in non-interactive session-0.
- **Poller runner**: Batch → VBS (`run-poller.vbs`) via `python.exe` (not `pythonw.exe`), properly daemonized. PID verified.
- **Branding**: Favicon, apple-touch-icon, SS-LOGO.svg, manifest.json copied into all frontends. `.logo-glow` CSS added.

### Session 2 — Spilled Beer Search + End-to-End

**Spilled Beer (drunk-proof search) — live on `/search`, `/suggestions`, and OKJRS protocol:**
- Strips punctuation: `-"\\.,;:!@#$%^&*()_+=[]{}|<>/~` → space
- Apostrophe removed entirely (so `O'BRIEN` → `OBRIEN`, search `obrien` finds it)
- Uppercase matching on both sides via SQL REPLACE chains
- Progressive word dropping: if 4-word search yields nothing, tries 3, then 2, then 1
- SQL-side `cleanSQL()` uses nested `REPLACE` chains + `CHAR(39)` + double-space collapsing

**Verified edge cases:**
```
obrien           → Gnash & Olivia O'brien              ✓
dont             → Usher - I Don't Mind                ✓
don''t           → same                                ✓
james--bay       → James Bay                           ✓
james!!!bay      → James Bay                           ✓
boHEMian RHApsody → Bohemian Rhapsody                  ✓
dont stop        → Don't Stop Me Now                   ✓
james bay hold   → James Bay - Hold Back The River     ✓
```

**End-to-end test (ZEN-OC → James Bay - Hold Back The River):**
1. POST /request → status `silent` (8 prior requests) ✓
2. Poller picked up in 30s cycle → matched in dbSongs → queued at position 2 ✓
3. OpenKJ queue verified: `qsongid=501`, artist "James Bay", title "Hold Back The River" ✓

### Known Issues
- **Windows poller offline**: laptop disconnected from Connor's — poller (`openkj-poller.py`) will not run until reconnected. Silent requests will not auto-queue.
- **Song count mismatch**: OpenKJ has **671,865** songs on Windows, but only **224,956** imported to D1. ~447k missing — likely import script needs investigation.

## 2026-06-03 — Phase 1a Launch

- Set up CLOUDFLARE_API_TOKEN for wrangler auth
- Created repo structure under ~/orion-supasing/
- Created zen-mem.py — Python CLI memory system with D1 (zen_db)
- Created zen_db D1 database (ID: 3f7d5f7a-0554-4fcb-9525-e5801be336e3)
- Wrote master-plan.md, README.md, FAQ.md, HOWTO.md, HELP.md
- Copied existing sources into repo (worker.js, zen-search, docs-site)
- Git init + first commit + push to github.com/Oriondevcore/Supa_singv1

## 2026-06-03 — Phase 1b Delivered

### User-Facing
- userdb.oriondevcore.com (Supa-Profile): mood picker, stats, milestones, history, edit — deployed
- fav.oriondevcore.com (Supa-Faves): list, search filter, re-request, delete — deployed
- zen-search.oriondevcore.com redesigned: big bold layout, 100px mood buttons, 42px heart btn, SING btn
- 1,510 singers seeded from OpenKJ historySingers into D1 users table

### API / Backend (worker.js)
- Session-aware request routing: checks for accepted request within last 8 hours
  - First request per session = `pending` (popup)
  - Subsequent same-session requests = `silent` (auto-queue)
- OKJRS protocol fixes:
  - `error` field changed from boolean to string `"false"` / `"true"`
  - `getRequests` / `getSilentRequests` stripped `song_id`, `key_change` to match StandaloneRequestServer format
  - `acceptRequest` / `rejectRequest` now accept ANY status (removed `AND status = 'silent'` guard)
- Poller v2 written (openkj-poller.py) with fixed acceptRequest JSON format, copied to Windows

### Infrastructure
- D1 databases: supatraxx_karaoke_db (58be4e00), supabook_users_db (337f0340), zen_db (3f7d5f7a)
- Worker deployed: supatraxx-api (supatraxx-api.orion269.workers.dev + supatraxx-api.oriondevcore.com)
- Pages: zen-search, fav, userdb — all on Cloudflare Pages with custom domains
- Git push to main

### Known Issues
- OKJRS popup on Windows: user must toggle Tools → Request Server off/on after API fixes
- StandaloneRequestServer at C:\GitH\StandaloneRequestServer\ — reference impl, DO NOT EDIT
- Service worker on zen-search may cache old files; hard refresh required

### Empire Vision (master-plan.md)
- GRS multi-tenant architecture: grs.oriondevcore.com, t1.grs...
- Four Pillars: Supa-Ads, Singers Studio, NPO Helper, Business Engine
- AI layer: recommend, transcribe, review, score, produce
- Monetisation: Supa-Ads, SRS, tokens, AI-upsell, badges
- Documented in master-plan.md

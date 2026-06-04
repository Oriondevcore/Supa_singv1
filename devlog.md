# Dev Log — SupaSing

## 2026-06-04 — Phase 1b Complete

### Fixes
- **OKJRS serial bug**: `getSerial(env)` was reading a static env var (`OKJRS_SERIAL=15`), so OKJRS never detected new requests — button never flashed. Changed to dynamic query: `SELECT MAX(id) FROM song_requests`. Deployed.
- **OKJRS protocol fixes**: `error` field changed from boolean to string `"false"`/`"true"` to match StandaloneRequestServer format.
- **Session-aware routing**: Changed from "has any prior requests" to "has accepted request within last 8 hours" — first request per night is pending (popup), subsequent are silent (auto-queue).

### Deployments
- **Poller v2** deployed to Windows (`C:\Users\Admin\openkj-poller.py`)
- Scheduled task `SupaTraxx-Poller` created (runs at logon, pythonw no-console)
- Poller running as background process (PID verified via WMI)

### Data
- Seeded 4,790 favourites from OpenKJ historySongs into D1 (1,389 singers, songs played 2+ times)
- Created `favourites` table + unique index in supabook_users_db

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

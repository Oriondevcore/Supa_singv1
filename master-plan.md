# SupaSing — Orion SupaSing Ecosystem

**Master Plan v1.0** — 3 June 2026

---

## The Empire Vision

Orion Ventures is a hospitality-technology company. SupaSing is the first product — the on-ramp to a multi-venue Guest Relations System (GRS) that connects venues, singers, DJs, and data into a unified platform.

### GRS — Guest Relations System

A multi-tenant platform where each venue gets its own branded portal:

| Subdomain | Purpose |
|-----------|---------|
| `grs.oriondevcore.com` | GRS hub — venue discovery, platform overview, admin |
| `t1.grs.oriondevcore.com` | Tenant 1 — Connor's Public House (pilot) |
| `t2.grs.oriondevcore.com` | Tenant 2 — next venue |
| `tN.grs.oriondevcore.com` | Tenant N — scaled |

Each tenant gets: song search, request flow, singer profiles, favourites, DJ queue, and venue-specific analytics.

### The Four Pillars

```
                      ┌─────────────────────────┐
                      │      GRS PLATFORM        │
                      │   grs.oriondevcore.com    │
                      ├─────────────────────────┤
                      │  Multi-Tenant Core        │
                      │  (t1, t2, t3... tN)      │
                      └────────────┬────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │             │                         │             │
   ┌────▼────┐  ┌─────▼──────┐  ┌────────▼────┐  ┌────────▼───┐
   │ SUPA-    │  │ SINGERS    │  │ NPO HELPER  │  │ BUSINESS    │
   │ ADS      │  │ STUDIO     │  │             │  │ ENGINE      │
   ├──────────┤  ├────────────┤  ├─────────────┤  ├────────────┤
   │ Venue    │  │ Recording  │  │ Fundraising │  │ Analytics   │
   │ sponsors │  │ booth      │  │ karaoke     │  │ dashboards  │
   │ & brand  │  │ booking    │  │ events      │  │ for venues  │
   │ promos   │  │ + vocal    │  │ + donor     │  │ + ROI       │
   │ in-app   │  │ coaching   │  │ recognition │  │ tracking    │
   └──────────┘  └────────────┘  └─────────────┘  └────────────┘
```

1. **Supa-Ads** — In-app venue promotions, brand sponsorships, targeted offers
2. **Singers Studio** — Book a recording booth, vocal coaching, take-home recordings
3. **NPO Helper** — Charity karaoke events, fundraising drives, donor leaderboards
4. **Business Engine** — Venue analytics: peak songs, singer retention, revenue tracking

### Naledi — The AI Voice of Orion Ventures

Naledi is the AI assistant front-and-centre on the landing page (`oriondevcore.com`). She's powered by Workers AI and handles:

- **Song recommendations**: searches the 667K library via `searchSongs` tool (GLM-4.7-Flash)
- **Booking inquiries**: directs users to WhatsApp for quotes and event booking
- **TTS voice**: speaks responses aloud via MeloTTS ($0.0002/min)
- **STT (Speech-to-Text)**: listens via microphone + Whisper ($0.00045/min)
- **Proactive personality**: asks follow-up questions, suggests songs, keeps conversation flowing
- **Dynamic greeting**: fresh greeting every time via `init` flow
- **Fallback chain**: AI binding → REST API → WhatsApp fallback

Access Naledi's test playground at `oriondevcore.com/naledi-test.html` (private, for testing).

### Naledi API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/naledi/chat` | POST | Chat with Naledi (GLM-4.7-Flash + searchSongs tool) |
| `/naledi/tts` | POST | Text-to-speech (MeloTTS, returns base64 MP3) |
| `/naledi/stt` | POST | Speech-to-text (Whisper, returns transcribed text) |

### The AI Layer

AI runs across everything — three distinct engines:

```
┌─────────────────────────────────────────────────────────────┐
│                     NALEDI (AI ORCHESTRATOR)                 │
│             GLM-4.7-Flash + Tool Calling + TTS               │
├─────────────────┬─────────────────────┬──────────────────────┤
│  RECOMMENDER    │  ANALYST            │  RESEARCHER          │
├─────────────────┼─────────────────────┼──────────────────────┤
│ Song recs by    │ Venue insights:     │ Anonymous behaviour  │
│ mood, history,  │ popular songs,      │ study — age, region, │
│ and what's      │ peak times, singer  │ preferences, trends  │
│ trending now    │ retention patterns  │ NO PII ever linked   │
├─────────────────┴─────────────────────┴──────────────────────┤
│                        NALEDI (AI Guide)                      │
│  Personalised song suggestions + tool calling + TTS voice    │
│  Replaces old "AI Guide (Premium)" concept — built and live  │
└──────────────────────────────────────────────────────────────┘
```

### Monetisation Model

| Source | Free | Premium | Notes |
|--------|------|---------|-------|
| Song Requests | Unlimited | Unlimited | Core free feature |
| Supa-Faves | Yes | Yes | Free |
| Profile | Basic | Custom | Premium unlocks mood icons, themes |
| AI Guide | — | Yes | R1/month or one-time |
| Supa-Ads | Seen | Removed | Venue sponsors |
| Tips to DJ | Optional | Optional | Yoco takes 2-3% |
| Venue Subscription | — | Tiered | Venues pay for GRS tenant |

### Data Ethics

- Anonymous ML research is **opt-in only**
- Demographics collected are: age range, area code, sex, pets, family size
- **No PII** is ever linked to research data
- Research data stored in separate analytics D1, no foreign keys to user profiles
- Never sold — anonymised behavioural insights only

---

## Current Architecture (Phase 1-2)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  supatraxx       │────▶│  API Worker      │────▶│  supatraxx_db   │
│  (search, scan)  │     │  (Cloudflare)    │     │  (D1: songs,    │
│                  │     │                  │     │   requests)     │
│  oriondevcore    │     │  v4.1            │────▶│                  │
│  /fav/ /profile/ │     │                  │     │  supabook_db    │
│  /sing → /scan   │     │                  │────▶│  (D1: users,    │
│                  │     │                  │     │   favourites)   │
│  docs            │     │                  │     │                  │
│  (docs site)     │     │                  │     │  zen_db          │
│                  │     │                  │────▶│  (D1: memory)   │
│  Naledi AI:      │     │                  │     │                  │
│  /naledi/chat    │     │                  │     │  Workers AI:     │
│  /naledi/tts     │     │                  │     │  GLM-4.7-Flash   │
│  /naledi/stt     │     │                  │     │  MeloTTS         │
│                  │     │                  │     │  Whisper-large   │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  Windows Poller   │
                        │  (openkj-poller)  │
                        │                   │
                        │  ┌─────────────┐  │
                        │  │ OpenKJ      │  │
                        │  │ SQLite      │  │
                        │  └─────────────┘  │
                        └──────────────────┘
```

## Domains (Current)

| Domain / Path | Purpose | Cloudflare |
|----------|---------|------------|
| supatraxx.oriondevcore.com | Song search, request, charts, history | Pages (zen-search) |
| docs.oriondevcore.com | Docs, legal, FAQ | Pages (orion-docs) |
| supatraxx-api.oriondevcore.com | Backend API | Worker |
| oriondevcore.com | Landing page (lobby), Naledi AI chat, Naledi playground | Pages (orion-ventures) |
| oriondevcore.com/fav/ | Favourites & history (consolidated from fav.oriondevcore.com) | Pages (orion-ventures) |
| oriondevcore.com/profile/ | Singer profiles (consolidated from userdb.oriondevcore.com) | Pages (orion-ventures) |
| oriondevcore.com/sing | → 302 → supatraxx.oriondevcore.com/scan | Pages (orion-ventures) |

## Databases

### supatraxx_karaoke_db (D1) — `58be4e00-fcc2-4a05-843c-3f7870868210`
- `okjrs_songdb` / `okjrs_songdb_fts` — 224,956 songs (FTS5, ~447k missing from OpenKJ's 671,865)
- `songs_metadata` — genre, year per song (only 13,100 have genre metadata)
- `song_requests` — pending/silent/accepted/rejected/played/deleted
- `album_art` — cached iTunes artwork URLs (artist + title UNIQUE)
- `singer_profiles` — name, whatsapp, stage_name, points, tokens, milestones
- `tips` — Yoco tip records

### supabook_users_db (D1) — `337f0340-cf1f-42f9-90c8-504bf68d1190`
- `users` — id, name, whatsapp, stage_name, mood_icon, mood_color, created_at
- `favourites` — id, singer_name, song_id, artist, title, key_change, created_at
- `demographics` (future) — opt-in: age_range, area, sex, pets, family_size (no PII link)

### zen_db (D1) — `3f7d5f7a-0554-4fcb-9525-e5801be336e3`
- `sessions` — development session history
- `decisions` — architectural decisions with rationale
- `todos` — project task tracking
- `context_log` — key/value context store
- `files` — repo file registry

## OpenKJ Integration

### How requests flow into OpenKJ

1. **Singer uses zen-search** → taps Supa-Sing! → POST /request
2. **API checks** singer's `total_requests`:
   - **`total_requests > 0` (existing singer)** → `status = 'silent'` → Windows poller sees it
   - **`total_requests === 0` (new singer)** → `status = 'pending'` → OKJRS popup
3. **Windows poller** (`openkj-poller.py`):
   - Polls `getSilentRequests` every 30s
   - Finds singer in `rotationSingers` → auto-inserts into `queueSongs`
   - Singer **not** in rotation → calls `revertToPending` API → flips back to pending → KJ gets popup

### Database tables (OpenKJ SQLite)
- `rotationSingers` — (singerid, name, position, regular, regularid, addts)
- `queueSongs` — (qsongid, singer, song, artist, title, discid, path, keychg, played, position)
- `dbSongs` — (songid, Artist, Title, DiscId, Duration, path, filename, searchstring)
- `regularSingers` — (regsingerid, Name, ph1, ph2, ph3)
- `regularSongs` — (regsongid, regsingerid, songid, keychg, position)

## Brand Voice

- "Supa" prefix used tastefully: Supa-Sing!, Supa-Profile, Supa-Faves, Supa-Choice
- Professional but playful — premium arcade, not childish
- **No emojis in UI** — use subtle SVG icons
- Toast messages: "Your jam's in the queue!", "Supa-choice!", "Supa-request fired off!"
- **NO toasts with "You're next"** — use "Request submitted! Listen for your name!"

## Phases

### Phase 1 — Foundation (Complete ✅)
- [x] Repo structure + zen-mem CLI + git
- [x] CLOUDFLARE_API_TOKEN / wrangler authentication
- [x] API worker v4 (registration, favourites, silent requests, accept/reject)
- [x] zen-search (registration modal, Supa-Sing!, favourites, real request flow)
- [x] docs.oriondevcore.com restyled to zen design
- [x] zen_db D1 created and wired
- [x] supabook_db tables (users, favourites) created

### Phase 1b — Profiles & Favourites + SupaTraxx Redesign (Complete ✅)
- [x] Build userdb.oriondevcore.com (profile page with mood icon picker, stats, milestones)
- [x] Build fav.oriondevcore.com (favourites showcase, quick re-request)
- [x] Seed favourites from OpenKJ historySingers into D1 (4,790 favourites, 1,389 singers)
- [x] Deploy updated openkj-poller.py to Windows (scheduled task, runs at logon)
- [x] Wire poller to `getSilentRequests` / `acceptRequest` API commands
- [x] Fix OKJRS serial: dynamic serial from D1 max ID (was static env var, broke popup notification)
- [x] Branding: favicons, SS-LOGO.svg, manifest.json, `.logo-glow` CSS in all frontends
- [x] `revertToPending` API command + poller logic (silent → pending if singer not in rotation)
- [x] Spilled Beer (drunk-proof search): punctuation stripping, apostrophe removal, progressive word dropping, SQL REPLACE chains
- [x] Poller runner: VBS + `python.exe` (replaced `pythonw.exe` which didn't persist in session-0)
- [x] End-to-end verified: ZEN-OC → silent → poller → OpenKJ queue
- [x] SupaTraxx redesign: big-text UI (20px base), simplified layout (no moods/AI), fat genre pills
- [x] Album artwork: iTunes API lookup + D1 cache (`album_art` table, `/artwork` endpoint)
- [x] Anonymous charts: most-requested songs & artists (`/charts` endpoint, no user names)
- [x] Singer history tab ("My Songs") in bottom nav, fetched from `/profile` endpoint
- [x] Bottom nav: Search | My Songs | Faves | Profile
- [x] `supatraxx.oriondevcore.com` custom domain assigned and serving (fixed root_dir → zen-search/)
- [x] Landing page AI binding added (NALEDI AI + MODEL for Workers AI)
- [ ] Windows poller still offline (laptop reconnected but poller status unknown)
- [ ] Song count mismatch (224,956 in D1 vs 671,865 on Windows — ~447k missing)
- [ ] Old fav.oriondevcore.com / userdb.oriondevcore.com subdomains still resolve to old Pages projects
- [ ] Yoco tip endpoint exists but no frontend UI button on scan/search pages

### Phase 2 — Naledi & AI Features (In Progress 🔄)
- [x] Upgrade Naledi to `@cf/zai-org/glm-4.7-flash` — supports tool calling, 131K context
- [x] Add `searchSongs` tool — Naledi searches the 667K library for real song recommendations
- [x] Multi-turn tool loop — GLM makes multiple search calls, combines results naturally
- [x] Build `/naledi/tts` TTS endpoint via `@cf/myshell-ai/melotts` ($0.0002/min)
- [x] Build `/naledi/stt` STT endpoint via `@cf/openai/whisper-large-v3-turbo` ($0.00045/min)
- [x] Build Naledi test playground at `oriondevcore.com/naledi-test.html` (presets, tool debug panel, TTS toggle, mic button)
- [x] Fix TTS wiring — chat endpoint now actually calls melotts and returns audio
- [x] Proactive Naledi — system prompt updated for follow-up questions, dynamic init greeting, conversational flow
- [ ] Add `getVenueInfo` tool — Naledi answers venue/event questions from live data
- [ ] Add song request tool — Naledi can submit requests directly into the queue
- [ ] Build Telegram bot for async Naledi chat when user is away from browser
- [ ] Public launch: embed Naledi chat widget on landing page (already wired, polish needed)
- [ ] Build Naledi knowledge base / question sheet for learning about Graham, vision, company

### Phase 3 — Intelligence & Scale
- [ ] Trending / recommendation engine (collaborative filtering based on request patterns)
- [ ] Anonymous behaviour analytics pipeline
- [ ] AI-powered mood-to-song matching (beyond static genre mapping)
- [ ] Multi-tenant architecture: venue_id in all operational tables
- [ ] Venue admin dashboard (queue management, singer list, stats)

### Phase 4 — Monetisation
- [ ] Supa-Fan subscriptions (premium profile, AI Guide, no ads)
- [ ] Supa-Ads (venue promotions, sponsored songs)
- [ ] Yoco tips fully operational
- [ ] Singers Studio bookings
- [ ] NPO Helper event system

### Phase 5 — Scale
- [ ] Multi-venue onboarding flow
- [ ] Business Engine analytics for venue owners
- [ ] OpenKJ poller as Cloudflare Worker (Windows dependency removed)
- [ ] Full GRS tenant provisioning (t2, t3...)

## Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Two D1 databases (karaoke + users) | Operational data separate from user profiles |
| 2 | D1 for zen-mem | Fast SQL queries, accessible from any machine via REST |
| 3 | Cloudflare Pages for frontends | Free hosting, global CDN, custom domains |
| 4 | Status-based request routing | `silent`=auto-queue vs `pending`=KJ popup |
| 5 | No emojis in UI | Professional brand consistency |
| 6 | Windows poller separate from Cloudflare | OpenKJ is desktop-only; SQLite local access |
| 7 | Multi-tenant by subdomain (t1.grs, t2.grs) | Clean URL separation, venue-specific branding |
| 8 | Workers AI for LLM features | Stays in Cloudflare ecosystem, no external API costs |
| 9 | Spilled Beer search (LIKE + REPLACE chains) | FTS5 tokenizer can't match across punctuation; `REPLACE` chains on both query and DB side give true drunk-proof matching with progressive word dropping |
| 10 | Poller runs via VBS + `python.exe` (not `pythonw.exe`) | `pythonw.exe` wouldn't persist in session-0 (scheduled task context); VBS runner + `python.exe` daemonizes reliably |
| 11 | Album art via iTunes API + D1 cache | Free, no API key needed; D1 UNIQUE(artist,title) avoids repeated lookups; `300x300bb` size from `100x100bb` replacement |
| 12 | Anonymous charts (no user names) | Privacy-first; `song_requests` GROUP BY artist/title with counts only, no singer field exposed |
| 13 | Landing page AI binding (Pages Functions + Workers AI) | Uses `env.AI` binding in Pages Functions; falls back to REST API with CLOUDFLARE_API_TOKEN; final fallback directs to WhatsApp |
| 14 | Naledi uses GLM-4.7-Flash (not Llama 3.2 3B) | GLM-4.7-Flash supports native tool calling with multi-turn loops, 131K context window, and better instruction following at similar latency/cost |
| 15 | Tool calling for song search | `searchSongs` tool calls the worker API `/search` endpoint — Naledi searches the actual library instead of making up songs or hallucinating |
| 16 | TTS via MeloTTS on Workers AI | `@cf/myshell-ai/melotts` at $0.0002/min — 537 min/day fits in $5 plan; returns base64 MP3 directly, no external API needed |
| 17 | Pages root_dir must be set explicitly | `zen-search` Pages project had empty `root_dir` → published repo root (not `/zen-search/`) → every deployment served 404. Fixed via API: `root_dir: zen-search` |
| 18 | STT via Whisper on Workers AI | `@cf/openai/whisper-large-v3-turbo` at $0.00045/min. Frontend sends base64 audio via MediaRecorder (webm/opus) → server decodes to Uint8Array → Workers AI binding → returns transcribed text |
| 19 | TTS wired into chat endpoint | Chat.js accepts `tts: true` param but never called melotts (broken). Added `generateTTS()` helper that calls melotts after getting the reply. Max 500 chars per call |
| 20 | Proactive Naledi via system prompt + init flow | System prompt: "End every reply with a question." Frontend: removed hardcoded first message, sends `init: true` on page load → Naledi generates a fresh dynamic greeting |
| 21 | Docs site at docs.oriondevcore.com | Separate Pages project (orion-docs). Updated FAQ/HOWTO/HELP files with current domain paths. `_redirects` for clean URLs. Wrangler direct upload for deployment |
| 22 | Subdomains consolidated to paths | `fav.oriondevcore.com` → `oriondevcore.com/fav/`, `userdb.oriondevcore.com` → `oriondevcore.com/profile/`. Simpler DNS, single Pages project |

## Relevant Files

| File | Purpose |
|------|---------|
| `/home/graham/ventures/functions/naledi/chat.js` | Naledi chat: GLM-4.7-Flash, searchSongs tool, TTS wiring, init/greeting |
| `/home/graham/ventures/functions/naledi/tts.js` | TTS endpoint: MeloTTS, base64 MP3 |
| `/home/graham/ventures/functions/naledi/stt.js` | STT endpoint: Whisper, accepts base64 audio |
| `/home/graham/ventures/naledi-test.html` | Naledi playground: presets, mic, TTS toggle, tool panel |
| `/home/graham/ventures/index.html` | Landing page lobby: 6 door cards, Naledi FAB |
| `/home/graham/ventures/fav/` | Favourites page (served at /fav/) |
| `/home/graham/ventures/profile/` | Profile page (served at /profile/) |
| `/home/graham/docs-site/public/` | Docs site: FAQ.md, HOWTO.md, HELP.md (served at docs.oriondevcore.com) |
| `/home/graham/orion-supasing/zen-search/` | SupaTraxx frontend (search, scan.html, style.css) |
| `/home/graham/orion-supasing/master-plan.md` | This file |

## Tools & Credentials

| Tool | Value |
|------|-------|
| CF Account ID | `fdd89cf30de14e1ddcfa5fbbf27581c1` |
| CF API Token | *(set in CLOUDFLARE_API_TOKEN env var)* |
| supatraxx_db ID | `58be4e00-fcc2-4a05-843c-3f7870868210` |
| supabook_db ID | `337f0340-cf1f-42f9-90c8-504bf68d1190` |
| zen_db ID | `3f7d5f7a-0554-4fcb-9525-e5801be336e3` |
| Windows (ssh) | `admin@192.168.1.100` / `bolt123` |
| GitHub | `github.com/Oriondevcore/Supa_singv1` |
| Worker Endpoint | `supatraxx-api.oriondevcore.com` |

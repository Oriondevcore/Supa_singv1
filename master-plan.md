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

### The AI Layer

AI runs across everything — three distinct engines:

```
┌─────────────────────────────────────────────────────────────┐
│                     AI ORCHESTRATOR                          │
│                  Workers AI (Cloudflare)                      │
├─────────────────┬─────────────────────┬──────────────────────┤
│  RECOMMENDER    │  ANALYST            │  RESEARCHER          │
├─────────────────┼─────────────────────┼──────────────────────┤
│ Song recs by    │ Venue insights:     │ Anonymous behaviour  │
│ mood, history,  │ popular songs,      │ study — age, region, │
│ and what's      │ peak times, singer  │ preferences, trends  │
│ trending now    │ retention patterns  │ NO PII ever linked   │
├─────────────────┴─────────────────────┴──────────────────────┤
│                        AI GUIDE (Premium)                     │
│        Personalised song suggestions via chat interface       │
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
│  zen-search      │────▶│  API Worker      │────▶│  supatraxx_db   │
│  (search + mood) │     │  (Cloudflare)    │     │  (D1: songs,    │
│                  │     │                  │     │   requests)     │
│  userdb          │────▶│  v4.0            │────▶│                  │
│  (profile page)  │     │                  │     │  supabook_db    │
│                  │     │                  │────▶│  (D1: users,    │
│  fav             │────▶│                  │     │   favourites)   │
│  (faves/history) │     │                  │     │                  │
│                  │     │                  │     │  zen_db          │
│  docs            │     │                  │────▶│  (D1: memory)   │
│  (docs site)     │     │                  │     │                  │
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
                        │  │ queueSongs  │  │
                        │  └─────────────┘  │
                        └──────────────────┘
```

## Domains (Current)

| Domain | Purpose | Cloudflare |
|--------|---------|------------|
| zen-search.oriondevcore.com | Landing, search, moods, request | Pages (zen-search) |
| userdb.oriondevcore.com | Singer profiles | Pages |
| fav.oriondevcore.com | Favourites & history | Pages |
| docs.oriondevcore.com | Docs, legal, FAQ | Pages (orion-docs) |
| supatraxx-api.oriondevcore.com | Backend API | Worker |

## Databases

### supatraxx_karaoke_db (D1) — `58be4e00-fcc2-4a05-843c-3f7870868210`
- `okjrs_songdb` / `okjrs_songdb_fts` — 224,956 songs (FTS5, ~447k missing from OpenKJ's 671,865)
- `songs_metadata` — genre, year per song (only 13,100 have genre metadata)
- `song_requests` — pending/silent/accepted/rejected/played/deleted
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

### Phase 1b — Profiles & Favourites (Complete ✅)
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

### Phase 2 — GRS Foundation
- [ ] Build `grs.oriondevcore.com` hub page (venue discovery, platform overview)
- [ ] Build `t1.grs.oriondevcore.com` (Connor's branded tenant portal)
- [ ] Multi-tenant architecture: venue_id in all operational tables
- [ ] Venue admin dashboard (queue management, singer list, stats)

### Phase 3 — AI & Intelligence
- [ ] AI Guide (Workers AI LLM + RAG on song catalogue)
- [ ] Trending / recommendation engine (collaborative filtering)
- [ ] Anonymous behaviour analytics pipeline
- [ ] AI-powered mood-to-song matching (beyond static genre mapping)

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

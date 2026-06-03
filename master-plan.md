# SupaSing — Orion SupaSing Ecosystem

**Master Plan v1.0** — 3 June 2026

---

## Vision

A mobile-first karaoke song request ecosystem that connects singers at Connor's Public House (and beyond) with the DJ's OpenKJ system — frictionless, fun, and professional. Long-term: anonymous, opt-in ML research on karaoke behaviour.

---

## Architecture

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

## Domains

| Domain | Purpose | Cloudflare |
|--------|---------|------------|
| zen-search.oriondevcore.com | Landing, search, moods, request | Pages (zen-search) |
| userdb.oriondevcore.com | Singer profiles | Pages |
| fav.oriondevcore.com | Favourites & history | Pages |
| docs.oriondevcore.com | Docs, legal, FAQ | Pages (existing) |
| supatraxx-api.oriondevcore.com | Backend API | Worker |

## Databases

### supatraxx_karaoke_db (D1) — `58be4e00-fcc2-4a05-843c-3f7870868210`
- `okjrs_songdb` / `okjrs_songdb_fts` — 224k songs (FTS5 full-text search)
- `songs_metadata` — genre, year per song
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
2. **API checks** if singer has a profile:
   - **Has profile (existing singer)** → `status = 'silent'` → Windows poller sees it
   - **No profile (new singer)** → `status = 'pending'` → OKJRS popup
3. **Windows poller** (`openkj-poller.py`):
   - Polls `getSilentRequests` every 30s
   - Finds singer in `rotationSingers` → auto-inserts into `queueSongs`
   - Singer not in rotation → leaves pending for KJ to handle

### Database tables (OpenKJ SQLite)
- `rotationSingers` — (singerid, name, position, regular, regularid, addts)
- `queueSongs` — (qsongid, singer, song, artist, title, discid, path, keychg, played, position)
- `dbSongs` — (songid, Artist, Title, DiscId, Duration, path, filename, searchstring)
- `regularSingers` — (regsingerid, Name, ph1, ph2, ph3) — Connor's regulars
- `regularSongs` — (regsongid, regsingerid, songid, keychg, position)

## Brand Voice

- "Supa" prefix used tastefully: Supa-Sing!, Supa-Profile, Supa-Faves, Supa-Choice
- Professional but playful — premium arcade, not childish
- **No emojis in UI** — use subtle SVG icons
- Toast messages: "Your jam's in the queue!", "Supa-choice!", "Supa-request fired off!"
- **NO toasts with "You're next"** — use "Request submitted! Listen for your name!"

## Phases

### Phase 1 — Foundation (Current)
- [x] Set up repo structure
- [x] Set up CLOUDFLARE_API_TOKEN / wrangler
- [x] Create zen-mem Python CLI memory system
- [ ] Update API worker v4 (registration, favourites, silent requests)
- [ ] Update zen-search (registration popup, real requests, Supa-Sing!)
- [ ] Deploy everything
- [ ] Restyle docs.oriondevcore.com
- [ ] Import connors_singers.xml as seed favourites

### Phase 2 — Profile & Favourites
- [ ] Build userdb.oriondevcore.com (profile page)
- [ ] Build fav.oriondevcore.com (favourites page)
- [ ] Mood icon + colour picker
- [ ] Milestone badges
- [ ] Request history

### Phase 3 — OpenKJ Deep Integration
- [ ] Deploy updated Windows poller
- [ ] Auto-queue for existing rotation singers
- [ ] OKJRS popup for new singers
- [ ] Song matching (normalized search)

### Phase 4 — Premium & Monetisation
- [ ] AI Guide (song suggestions by mood)
- [ ] Yoco tips
- [ ] Token / points system
- [ ] Supa-Fan subscriptions

### Phase 5 — AI/ML Research (Anonymous)
- [ ] Optional demographics collection
- [ ] Karaoke behaviour analysis
- [ ] No PII link

## Technical Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Two D1 databases (karaoke + users) | Keep operational data separate from user profiles; different backup policies |
| 2 | D1 for zen-mem | Fast SQL queries, free tier, accessible from any machine via REST API |
| 3 | Cloudflare Pages for frontends | Free hosting, global CDN, easy custom domains |
| 4 | Status-based request routing | `silent`=auto-queue vs `pending`=KJ popup; clean separation |
| 5 | No emojis in UI | Professional brand consistency across all surfaces |
| 6 | Windows poller separate from Cloudflare | OpenKJ is desktop-only; SQLite must be accessed locally |

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
| GitHub Token | *(set in local git config)* |
| Worker Endpoint | `supatraxx-api.oriondevcore.com` |

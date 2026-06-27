# Database Schema — SupaTraxx Ecosystem

Two D1 databases serve the karaoke ecosystem, separating operational data from user profiles.

---

## supatraxx_karaoke_db

**ID:** `58be4e00-fcc2-4a05-843c-3f7870868210`  
**Binding:** `DB` (in worker.js)  
**Purpose:** Song library, requests, singer stats, tips, album art cache

### dbSongs

The main song library. ~225K songs (seeded from OpenKJ, ~447K more from Windows poller pending).

| Column | Type | Notes |
|--------|------|-------|
| `songid` | INTEGER | Auto-increment primary key |
| `Artist` | TEXT | Artist name |
| `Title` | TEXT | Song title |
| `combined` | TEXT | `{Artist} - {Title}` (pre-computed) |
| `normalized_combined` | TEXT | Lowercased `combined` for FTS |

**Used by:** `/search`, `/random`, `/suggestions`, `/artwork`, OKJRS `search` and `addSongs` commands

### song_requests

All song requests submitted by singers.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Auto-increment primary key (serial for OKJRS) |
| `singer` | TEXT | Singer name |
| `song_id` | INTEGER | FK to `dbSongs.songid` |
| `artist` | TEXT | Denormalized artist name |
| `title` | TEXT | Denormalized song title |
| `key_change` | INTEGER | Semitones (default 0) |
| `venue` | TEXT | Venue name |
| `status` | TEXT | `pending`, `silent`, `accepted`, `played`, `rejected`, `deleted` |
| `created_at` | TEXT | `datetime('now')` auto-set |

**Status meanings:**
- `pending` — New singer, awaiting KJ approval (OKJRS popup)
- `silent` — Returning singer, eligible for poller auto-queue
- `accepted` — Accepted by KJ or poller
- `played` — Song has been played
- `rejected` — Rejected by KJ
- `deleted` — Soft-deleted

**Used by:** `/request`, `/queue`, `/history`, `/trending`, `/charts`, `/suggestions`, `/profile`, OKJRS commands

### singer_profiles

Singer stats and points tracking.

| Column | Type | Notes |
|--------|------|-------|
| `name` | TEXT | **Primary key** — singer's name |
| `whatsapp` | TEXT | WhatsApp number |
| `points` | INTEGER | Total points earned |
| `tokens` | INTEGER | Token balance (future use) |
| `total_requests` | INTEGER | Total songs requested |
| `milestone_level` | INTEGER | Current milestone level (0-6) |
| `updated_at` | TEXT | `datetime('now')` auto-set |
| `id` | INTEGER | Internal ID (not used as FK) |

**Used by:** `/profile`, `/register`, `/leaderboard`, `/request`, OKJRS `acceptRequest`

### album_art

Cached artwork URLs from iTunes API. UNIQUE constraint on `(artist, title)` prevents duplicate lookups.

| Column | Type | Notes |
|--------|------|-------|
| `artist` | TEXT | Artist name (part of UNIQUE) |
| `title` | TEXT | Song title (part of UNIQUE) |
| `artwork_url` | TEXT | iTunes `300x300bb` URL (or null if not found) |
| `updated_at` | TEXT | `datetime('now')` auto-set |

**Used by:** `/artwork`

### songs_metadata

Additional song metadata. Only ~13K of ~225K songs have genre data.

| Column | Type | Notes |
|--------|------|-------|
| `genre` | TEXT | Genre name |
| `year` | INTEGER | Release year |
| `songid` | INTEGER | FK to `dbSongs.songid` |

**Used by:** `/genres`, `/search` (genre filter)

### tips

Yoco payment records for DJ tips.

| Column | Type | Notes |
|--------|------|-------|
| `amount` | INTEGER | Amount in cents |
| `currency` | TEXT | Always `ZAR` |
| `payer_name` | TEXT | Tip giver's name |
| `singer_name` | TEXT | Name of singer being tipped (optional) |
| `venue` | TEXT | Venue name |
| `yoco_checkout_id` | TEXT | Yoco checkout reference |
| `status` | TEXT | `pending` initially, updated on webhook |

**Used by:** `/tip`

---

## supabook_users_db

**ID:** `337f0340-cf1f-42f9-90c8-504bf68d1190`  
**Binding:** `UB` (in worker.js)  
**Purpose:** User profiles, favourites, demographics (future)

### users

Singer profiles with mood/icons for the frontend.

| Column | Type | Notes |
|--------|------|-------|
| `name` | TEXT | Primary key — singer's name |
| `whatsapp` | TEXT | WhatsApp number (optional) |
| `stage_name` | TEXT | Display name in UI (may differ from `name`) |
| `mood_icon` | TEXT | Icon identifier (`mic`, `star`, etc.) |
| `mood_color` | TEXT | Hex colour for profile accent |
| `created_at` | TEXT | `datetime('now')` auto-set |
| `updated_at` | TEXT | `datetime('now')` auto-set |

**Used by:** `/register`, `/profile`

### favourites

Singer's favourite/bookmarked songs.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Auto-increment primary key |
| `singer_name` | TEXT | Singer's name |
| `song_id` | INTEGER | FK to `dbSongs.songid` |
| `artist` | TEXT | Denormalized artist name |
| `title` | TEXT | Denormalized song title |
| `key_change` | INTEGER | Default key change (default 0) |
| `created_at` | TEXT | `datetime('now')` auto-set |

UNIQUE constraint on `(singer_name, song_id)` prevents duplicates.

**Used by:** `/favourite` (POST/DELETE), `/favourites`

### demographics (planned)

Future opt-in demographic data for anonymous research.

| Column | Type | Notes |
|--------|------|-------|
| `age_range` | TEXT | e.g. `18-25` |
| `area` | TEXT | Postal code / area code |
| `sex` | TEXT | |
| `pets` | INTEGER | |
| `family_size` | INTEGER | |

No PII — no FK to `users`.

---

## Entity Relationships

```
supatraxx_karaoke_db                    supabook_users_db
─────────────────────                   ───────────────────

dbSongs (songid)                           users (name)
  │                                          │
  ├── song_requests (song_id) ──┐            ├── favourites (singer_name)
  │   └── singer_profiles (name) │            │
  │                              │            │
  ├── songs_metadata (songid)    │            │
  │                              │            │
  ├── album_art (artist, title)  │            │
  │                              │            │
  └── tips                       │            │
                                 │            │
song_requests.singer ────────────┼────────────┘
singer_profiles.name ────────────┘
```

## Request Status State Machine

```
                ┌────────────────────────────────────┐
                │                                    │
                ▼                                    │
  ┌────────┐       ┌──────────┐       ┌──────────┐  │
  │ PENDING│──────►│ ACCEPTED │──────►│  PLAYED  │  │
  └────────┘       └──────────┘       └──────────┘  │
       │                                            │
       │ (new singer, OKJRS popup)                  │
       │                                            │
  ┌────────┐       ┌──────────┐                     │
  │ SILENT │──────►│ ACCEPTED │─────────────────────┘
  └────────┘       └──────────┘
       │
       │ (returning singer, poller auto-queue)
       │
       ▼
  ┌──────────┐
  │ PENDING  │ (revertToPending — singer not in rotation)
  └──────────┘
       │
       ▼
  ┌──────────┐
  │ REJECTED │
  └──────────┘

  ┌─────────┐ (soft delete)
  │ DELETED │
  └─────────┘
```

## Related: zen_db

**ID:** `3f7d5f7a-0554-4fcb-9525-e5801be336e3`  
**Purpose:** Development session history, architecture decisions, context store (not karaoke operational data)

| Table | Purpose |
|-------|---------|
| `sessions` | Development session history |
| `decisions` | Architectural decisions with rationale |
| `todos` | Project task tracking |
| `context_log` | Key/value context store |
| `files` | Repo file registry |

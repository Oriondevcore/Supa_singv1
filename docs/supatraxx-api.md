# SupaTraxx API v4.0

Base URL: `https://supatraxx-api.oriondevcore.com`  
Runtime: Cloudflare Worker + D1 (x2)  
Version: `4.0.0`  
Venue: Connor's Public House, 46 Ashley Ave, Durban North (Thursdays 7pm-late)

All endpoints return JSON. CORS wide-open (`Access-Control-Allow-Origin: *`).

---

## Health / Discovery

### `GET /`

API root — lists all available endpoints.

```json
{
  "name": "SupaTraxx Karaoke API",
  "version": "4.0.0",
  "runtime": "Cloudflare Worker + D1",
  "endpoints": { "GET  /health": "Service status", ... }
}
```

### `GET /health`

```json
{
  "status": "live",
  "service": "SupaTraxx Karaoke API",
  "version": "4.0.0",
  "totalSongs": 224956,
  "venue": "Connor's Public House, 46 Ashley Ave, Durban North",
  "schedule": "Thursday 7pm-late",
  "timestamp": "2026-06-07T12:00:00Z"
}
```

---

## Song Search & Discovery

### `GET /search?q=<query>&limit=<N>`

Full-text search with **Spilled Beer** (drunk-proof) algorithm. Strips punctuation, apostrophes, collapses spaces, uppercases both query and DB side. Progressively drops words until results are found.

**Params:**
- `q` — search query (artist, song, or both)
- `limit` — max results (default 50, max 200)

```json
// GET /search?q=bohemian%20rhapsody
{
  "query": "bohemian rhapsody",
  "cleaned": "BOHEMIAN RHAPSODY",
  "count": 1,
  "results": [
    { "id": 12345, "artist": "Queen", "title": "Bohemian Rhapsody" }
  ]
}
```

Empty query returns the first N songs in the database.

### `GET /search?q=<query>&limit=<N>&genre=<genre>`

Genre filter can be combined with search (requires genre data, which only ~13K songs have).

### `GET /genres`

List all genres with song counts.

```json
{
  "genres": [
    { "genre": "Pop", "count": 3200 },
    { "genre": "Rock", "count": 2800 }
  ]
}
```

### `GET /random?limit=<N>`

Random songs.

```json
// GET /random?limit=3
{
  "count": 3,
  "results": [
    { "id": 54321, "artist": "Nirvana", "title": "Smells Like Teen Spirit" },
    { "id": 98765, "artist": "ABBA", "title": "Dancing Queen" }
  ]
}
```

### `GET /stats`

Database statistics.

```json
{
  "totalSongs": 224956,
  "pendingRequests": 3
}
```

### `GET /trending?limit=<N>`

Most-requested songs in the last 7 days. Requires `status = 'played'`.

```json
// GET /trending?limit=5
{
  "count": 5,
  "trending": [
    { "artist": "Queen", "title": "Bohemian Rhapsody", "requests": 12 }
  ]
}
```

### `GET /suggestions?q=<query>&genre=<genre>&singer=<name>`

Song suggestions combining search results, trending songs, and singer history.

```json
{
  "query": "love",
  "singer": "John",
  "suggestions": [ { "id": 111, "artist": "...", "title": "..." } ],
  "trending": [ { "artist": "...", "title": "...", "req_count": 5 } ],
  "history": [ { "artist": "...", "title": "..." } ]
}
```

### `GET /charts?days=<N>`

Anonymous charts — most-requested songs and artists (aggregated, no user data).

**Params:** `days` — lookback period in days (default 7, 0 = all time)

```json
// GET /charts?days=30
{
  "songs": [
    { "artist": "Queen", "title": "Bohemian Rhapsody", "requests": 42 }
  ],
  "artists": [
    { "artist": "Queen", "requests": 87 }
  ]
}
```

### `GET /artwork?artist=<name>&title=<song>`

Album art lookup via iTunes API with D1 cache.

```json
// GET /artwork?artist=Queen&title=Bohemian%20Rhapsody
{
  "artist": "Queen",
  "title": "Bohemian Rhapsody",
  "artwork_url": "https://is1-ssl.mzstatic.com/image/thumb/...300x300bb.jpg"
}
```

Results are cached in the `album_art` table (UNIQUE on artist+title).

---

## Singer Profiles

### `POST /register`

Create or update a singer profile. Also auto-creates a `singer_profiles` entry in the karaoke DB.

```json
// Request
{
  "name": "John",
  "whatsapp": "+27 72 123 4567",
  "stageName": "Starwalker",
  "moodIcon": "mic",
  "moodColor": "#c8a44e"
}

// Response (201)
{
  "success": true,
  "message": "Profile saved!",
  "name": "John",
  "stageName": "Starwalker",
  "whatsapp": "+27 72 123 4567"
}
```

### `GET /profile?name=<singer>`

Fetch singer profile, milestones, and request history.

```json
// GET /profile?name=John
{
  "name": "John",
  "whatsapp": "+27 72 123 4567",
  "stageName": "Starwalker",
  "moodIcon": "mic",
  "moodColor": "#c8a44e",
  "points": 150,
  "tokens": 30,
  "total_requests": 15,
  "milestone_level": 2,
  "milestones": [
    { "level": 1, "icon": "mic", "unlocked": true },
    { "level": 5, "icon": "star", "unlocked": true },
    { "level": 10, "icon": "bronze", "unlocked": true },
    { "level": 25, "icon": "silver", "unlocked": false }
  ],
  "history": [
    { "artist": "Queen", "title": "Bohemian Rhapsody", "venue": "Connor's Public House", "key_change": 0, "created_at": "2026-06-01T20:30:00", "status": "played" }
  ]
}
```

### `POST /profile`

Update profile or delete.

```json
// Update
{ "name": "John", "whatsapp": "+27 72 765 4321", "stageName": "Starwalker", "moodIcon": "star", "moodColor": "#ff0000" }

// Delete
{ "name": "John", "action": "delete" }
```

### `GET /leaderboard?limit=<N>`

Top singers by points.

```json
// GET /leaderboard?limit=5
{
  "count": 5,
  "leaderboard": [
    { "name": "Sarah", "points": 450, "tokens": 90, "total_requests": 45, "milestone_level": 3 }
  ]
}
```

---

## Song Requests

### `POST /request`

Submit a song request.

```json
// Request
{
  "singerName": "John",
  "songId": 12345,
  "keyChange": 0
}

// Response (201) — returning singer
{
  "success": true,
  "message": "Your jam is in the queue! Listen for your name.",
  "singerName": "John",
  "artist": "Queen",
  "title": "Bohemian Rhapsody",
  "keyChange": 0,
  "status": "silent",
  "needsProfile": false,
  "points": { "points": 160, "tokens": 30, "total_requests": 16, "milestone_level": 2, "milestones": [...] }
}
```

**Status logic:**
- `total_requests > 0` (returning singer) → `status: "silent"` → auto-queued by poller
- `total_requests === 0` (new singer) → `status: "pending"` → OKJRS popup for KJ

Awards **10 points** per request.

### `GET /queue`

Pending request queue (new singers awaiting KJ approval).

```json
{
  "count": 3,
  "queue": [
    { "id": 5843, "singer": "Bob", "song_id": 12345, "artist": "Queen", "title": "Bohemian Rhapsody", "status": "pending", "created_at": "..." }
  ]
}
```

### `GET /history?limit=<N>`

Full request history across all singers.

```json
// GET /history?limit=3
{
  "count": 3,
  "history": [
    { "id": 5843, "singer": "John", "song_id": 12345, "artist": "Queen", "title": "Bohemian Rhapsody", "status": "played", "created_at": "..." }
  ]
}
```

---

## Favourites

### `POST /favourite`

Save a favourite song.

```json
{ "singerName": "John", "songId": 12345, "artist": "Queen", "title": "Bohemian Rhapsody", "keyChange": 0 }

// Response (201)
{ "success": true, "message": "Favourite saved!" }
```

### `DELETE /favourite`

Remove a favourite.

```json
{ "singerName": "John", "songId": 12345 }

// Response
{ "success": true, "message": "Favourite removed" }
```

### `GET /favourites?name=<singer>`

List a singer's favourites.

```json
// GET /favourites?name=John
{
  "count": 2,
  "favourites": [
    { "id": 1, "singer_name": "John", "song_id": 12345, "artist": "Queen", "title": "Bohemian Rhapsody", "key_change": 0, "created_at": "..." }
  ]
}
```

---

## Payments

### `POST /tip`

Create a Yoco payment checkout for tipping the DJ.

```json
// Request
{ "amount": 20, "payerName": "John", "singerName": "", "venue": "Connor's Public House" }

// Response (201)
{
  "success": true,
  "redirectUrl": "https://payments.yoco.com/checkout/...",
  "checkoutId": "ch_..."
}
```

Amount is in ZAR. The returned `redirectUrl` is used to redirect the user to Yoco's payment page.

---

## Points & Milestones

| Event | Points | Notes |
|-------|--------|-------|
| Song request via app | +10 | Awarded on `POST /request` |
| Silent request accepted | +5 | Awarded when poller calls `acceptRequest` |

### Milestone Levels

| Requests | Icon | Name |
|----------|------|------|
| 1 | mic | First song |
| 5 | star | Rising star |
| 10 | bronze | Bronze |
| 25 | silver | Silver |
| 50 | gold | Gold |
| 100 | trophy | Legend |

---

## Spilled Beer Search Algorithm

The search strips punctuation, apostrophes, and collapses whitespace on **both** the query and the DB columns, then does a `LIKE %word%` match. If no results, it progressively drops the last word and retries.

**JS side** (`spilledBeer`):
- Remove `- " . , ; : ! @ # $ % ^ & * ( ) _ + = [ ] { } | < > / ~`
- Remove `'` (apostrophe → empty string)
- Collapse consecutive spaces → single space
- UPPERCASE

**SQL side** (`cleanSQL`):
- Nested `REPLACE()` chain that applies the same transformation
- Used in `LIKE '%SEARCH%'` queries

Example: `O'Brien "Hello" - World!` → `OBRIEN HELLO WORLD` → matches `O BRIEN HELLO WORLD` in DB.

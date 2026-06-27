# OKJRS — OpenKJ Request Server Protocol

The OpenKJ Request Server (OKJRS) protocol allows OpenKJ to poll a remote API for song requests and auto-queue them into the local OpenKJ rotation. SupaTraxx implements the server side of this protocol.

## Architecture

```
┌──────────────┐  POST /api    ┌───────────────┐  silent requests  ┌────────────────┐
│  SupaTraxx   │ ◄─────────── │  OpenKJ Poller │ ────────────────► │  OpenKJ SQLite │
│  (Worker)    │ ──► response │  (Python)      │ ◄──────────────── │                │
│              │              │                │ auto-queue songs  │ queueSongs     │
│  D1:         │              │  Windows VM    │                   │ rotationSingers│
│  song_req    │              │  (Connor's)    │                   │ dbSongs        │
└──────────────┘              └────────────────┘                   └────────────────┘
```

## Request Flow

### New singer (first request)

```
User taps "Sing!" → POST /api { command: "submitRequest" }
  → status = "pending"
  → OKJRS popup appears on KJ screen → KJ accepts/rejects manually
```

### Returning singer (has sung before)

```
User taps "Sing!" → POST /request
  → singer.total_requests > 0 → status = "silent"
  → Poller polls getSilentRequests (every 30s)
  → Poller checks if singer exists in OpenKJ rotationSingers
    ├─ YES → auto-insert into queueSongs → acceptRequest
    └─ NO  → revertToPending → flips back to "pending" → OKJRS popup
```

## OKJRS Commands (POST `/api`)

All commands are JSON POST bodies with a `command` field. Responses are JSON.

### connectionTest

Verify the server is reachable.

```json
// Request
{ "command": "connectionTest" }

// Response
{ "command": "connectionTest", "error": "false", "connection": "ok" }
```

### getSerial

Get the current max request ID for polling. The poller tracks `last_id` and only processes requests with `request_id > last_id`.

```json
// Request
{ "command": "getSerial" }

// Response
{ "command": "getSerial", "error": "false", "serial": 5842 }
```

### getVenues

List available venues.

```json
// Request
{ "command": "getVenues" }

// Response
{
  "command": "getVenues",
  "error": "false",
  "venues": [{ "venue_id": 1, "name": "Connor's", "url_name": "connors", "accepting": true }]
}
```

### getAccepting / venueAccepting

Check if a venue is accepting requests.

```json
// Request
{ "command": "getAccepting", "venue_id": 1 }

// Response
{ "command": "getAccepting", "error": "false", "accepting": true, "venue_id": 1 }
```

### getAlert

Get any current alert message (none currently).

```json
// Request
{ "command": "getAlert" }

// Response
{ "command": "getAlert", "error": "false", "alert": false, "title": "", "message": "" }
```

### getEntitledSystemCount

Returns the number of entitled systems.

```json
// Request
{ "command": "getEntitledSystemCount" }

// Response
{ "command": "getEntitledSystemCount", "error": "false", "count": 1 }
```

### getRequests

Fetch all pending requests (new singers awaiting KJ approval). Each request has `request_id`, `artist`, `title`, `singer`, and `request_time` (Unix timestamp).

```json
// Request
{ "command": "getRequests" }

// Response
{
  "command": "getRequests",
  "error": "false",
  "requests": [
    { "request_id": 5843, "artist": "Queen", "title": "Bohemian Rhapsody", "singer": "John", "request_time": 1749254400 }
  ],
  "serial": 5843
}
```

### getSilentRequests

Fetch returning-singer requests that are eligible for auto-queue. Poller uses this endpoint.

```json
// Request
{ "command": "getSilentRequests", "venue_id": 1 }

// Response
{
  "command": "getSilentRequests",
  "error": "false",
  "requests": [
    { "request_id": 5845, "artist": "Adele", "title": "Hello", "singer": "Sarah", "request_time": 1749254400 }
  ],
  "serial": 5845
}
```

### acceptRequest

Accept a silent request. If the request has a singer, awards 5 points.

```json
// Request
{ "command": "acceptRequest", "request_id": 5845, "venue_id": 1 }

// Response
{ "command": "acceptRequest", "error": "false", "success": true, "serial": 5846 }
```

### rejectRequest

Reject a silent request.

```json
// Request
{ "command": "rejectRequest", "request_id": 5845, "venue_id": 1 }

// Response
{ "command": "rejectRequest", "error": "false", "success": true, "serial": 5846 }
```

### revertToPending

Flip a silent request back to pending status (used when singer isn't found in rotation).

```json
// Request
{ "command": "revertToPending", "request_id": 5845, "venue_id": 1 }

// Response
{ "command": "revertToPending", "error": "false", "success": true, "serial": 5846 }
```

### deleteRequest

Mark a request as deleted.

```json
// Request
{ "command": "deleteRequest", "request_id": 5845 }

// Response
{ "command": "deleteRequest", "error": "false", "serial": 5846 }
```

### submitRequest

Submit a new song request (OpenKJ → API). Creates the request as `pending`.

```json
// Request
{ "command": "submitRequest", "singerName": "Bob", "songId": 12345, "key_change": 0 }

// Response
{ "command": "submitRequest", "error": "false", "success": true, "serial": 5843, "request_id": 1 }
```

### search

Search songs using Spilled Beer algorithm.

```json
// Request
{ "command": "search", "searchString": "bohemian rhapsody" }

// Response
{
  "command": "search",
  "error": "false",
  "requests": [
    { "song_id": 12345, "artist": "Queen", "title": "Bohemian Rhapsody" }
  ],
  "serial": 5843
}
```

### addSongs

Bulk insert songs into `dbSongs`.

```json
// Request
{
  "command": "addSongs",
  "songs": [
    { "artist": "Queen", "title": "Bohemian Rhapsody" },
    { "artist": "Adele", "title": "Hello" }
  ]
}

// Response
{
  "command": "addSongs",
  "error": "false",
  "entries processed": 2,
  "last_artist": "Adele",
  "last_title": "Hello",
  "serial": 5843,
  "errors": []
}
```

### clearDatabase

Delete all songs and requests.

```json
// Request
{ "command": "clearDatabase" }

// Response
{ "command": "clearDatabase", "error": "false", "serial": 1 }
```

### clearRequests

Delete all requests only (songs preserved).

```json
// Request
{ "command": "clearRequests" }

// Response
{ "command": "clearRequests", "error": "false", "serial": 1 }
```

## Windows Poller (`openkj-poller.py`)

The poller runs on the Windows machine at Connor's Public House and bridges the API with the local OpenKJ SQLite database.

### How it works

1. Loads `last_id` from state file (`openkj_poller_state.json`)
2. Calls `getSilentRequests` every 30 seconds
3. Filters requests where `request_id > last_id`
4. For each request:
   - Looks up singer in OpenKJ `rotationSingers`
   - If found: finds the song in OpenKJ `dbSongs` via `artist + title` match (with fallback to `searchstring`)
   - Checks `queueSongs` for duplicates
   - Inserts into `queueSongs` with next position
   - Calls `acceptRequest` on the API
   - If **not** found in rotation: calls `revertToPending`
5. Advances `last_id` to highest processed ID

### OpenKJ SQLite tables used by poller

| Table | Purpose |
|-------|---------|
| `rotationSingers` | Current rotation — `singerid`, `name`, `position` |
| `dbSongs` | Song library — `songid`, `artist`, `title`, `discid`, `path`, `searchstring` |
| `queueSongs` | Upcoming queue — `qsongid`, `singer`, `song`, `artist`, `title`, `discid`, `path`, `keychg`, `played`, `position` |
| `regularSingers` | Regular singer list — `regsingerid`, `Name` |
| `regularSongs` | Regular singer default songs — `regsongid`, `regsingerid`, `songid`, `keychg`, `position` |

### State file

```json
{ "last_id": 5845, "updated_at": 1749254400.0 }
```

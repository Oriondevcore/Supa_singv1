#!/usr/bin/env python3
"""
OpenKJ Rotation Poller — polls API and writes to OpenKJ SQLite.

TWO PATHS:
  - EXISTING singer (in rotationSingers) -> auto-add song to queueSongs -> accept on remote
  - NEW singer (not in rotation) -> LEAVE PENDING for OKJRS popup + KJ interaction

Runs on Windows laptop at Connor's.
Usage: python3 openkj-poller.py [--once]
"""

import json
import urllib.request
import os
import sys
import time
import sqlite3
import re
from datetime import datetime

API_BASE = "https://supatraxx-api.oriondevcore.com"
OPENKJ_DB = r"C:\Users\Admin\AppData\Local\OpenKJ\OpenKJ\openkj.sqlite"
POLL_INTERVAL = 30
STATE_FILE = r"C:\Users\Admin\.hermes\openkj_poller_state.json"

if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def get_last_id():
    try:
        with open(STATE_FILE) as f:
            return json.load(f).get('last_id', 0)
    except:
        return 0


def save_last_id(rid):
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, 'w') as f:
        json.dump({'last_id': rid, 'updated_at': time.time()}, f)


def api_post(payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{API_BASE}/api",
        data=body,
        headers={'Content-Type': 'application/json', 'User-Agent': 'SupaTraxx-Poller/2.0'}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())


def get_silent_requests():
    return api_post({"command": "getSilentRequests", "venue_id": 1}).get('requests', [])


def accept_request(request_id):
    try:
        api_post({"command": "acceptRequest", "request_id": request_id, "venue_id": 1})
    except Exception as e:
        print(f"  [WARN] acceptRequest failed: {e}")


def reject_request(request_id):
    try:
        api_post({"command": "rejectRequest", "request_id": request_id, "venue_id": 1})
    except Exception as e:
        print(f"  [WARN] rejectRequest failed: {e}")


def revert_to_pending(request_id):
    try:
        api_post({"command": "revertToPending", "request_id": request_id, "venue_id": 1})
    except Exception as e:
        print(f"  [WARN] revertToPending failed: {e}")


def normalize(s):
    s = s.lower().strip()
    s = re.sub(r'[^a-z0-9\s]', '', s)
    return re.sub(r'\s+', ' ', s).strip()


def find_song(cursor, artist, title):
    a, t = artist.strip(), title.strip()
    na, nt = normalize(a), normalize(t)
    if not na or not nt:
        return None
    cursor.execute(
        "SELECT songid, artist, title, discid, path FROM dbSongs WHERE artist = ? AND title = ? LIMIT 1;",
        (a, t)
    )
    row = cursor.fetchone()
    if row:
        return row
    cursor.execute(
        "SELECT songid, artist, title, discid, path FROM dbSongs WHERE LOWER(searchstring) LIKE ? LIMIT 1;",
        (f"%{na} {nt}%",)
    )
    row = cursor.fetchone()
    if row:
        return row
    return None


def song_already_queued(cursor, singer_id, artist, title):
    a, t = artist.strip(), title.strip()
    if not a or not t:
        return False
    cursor.execute(
        """SELECT 1 FROM queueSongs qs
           JOIN dbSongs ds ON qs.song = ds.songid
           WHERE qs.singer = ? AND qs.played = 0
           AND ds.artist LIKE ? AND ds.title LIKE ?
           LIMIT 1;""",
        (singer_id, f"%{a}%", f"%{t}%")
    )
    return cursor.fetchone() is not None


def auto_queue_song(request_data):
    singer_name = request_data.get('singer', '').strip()
    artist = request_data.get('artist', '').strip()
    title = request_data.get('title', '').strip()
    key_change = request_data.get('key_change', 0)
    request_id = request_data.get('request_id')

    if not singer_name or not artist or not title:
        print("  [SKIP] Missing singer/artist/title")
        return True

    conn = sqlite3.connect(OPENKJ_DB)
    cursor = conn.cursor()

    try:
        cursor.execute("SELECT singerid, position FROM rotationSingers WHERE name = ?;", (singer_name,))
        singer = cursor.fetchone()

        if not singer:
            print(f"  [OKJRS] Singer '{singer_name}' not in rotation — reverting to pending")
            if request_id:
                revert_to_pending(request_id)
            return True

        singer_id, _ = singer
        print(f"  [ROTATION] Existing singer '{singer_name}' (id={singer_id})")

        song_info = find_song(cursor, artist, title)
        if not song_info:
            print(f"  [MISS] Song not found in OpenKJ db: \"{artist} - {title}\"")
            if request_id:
                accept_request(request_id)
            return True

        q_song_id, q_artist, q_title, q_discid, q_path = song_info
        print(f"  [MATCH] songid={q_song_id} \"{q_artist} - {q_title}\"")

        if song_already_queued(cursor, singer_id, q_artist, q_title):
            print(f"  [DUP] Already queued for '{singer_name}' — skipping")
            if request_id:
                accept_request(request_id)
            return True

        cursor.execute("SELECT COALESCE(MAX(position), -1) + 1 FROM queueSongs WHERE singer = ? AND played = 0;", (singer_id,))
        next_pos = cursor.fetchone()[0]

        cursor.execute(
            """INSERT INTO queueSongs (singer, song, artist, title, discid, path, keychg, played, position)
               VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?);""",
            (singer_id, q_song_id, q_artist, q_title, q_discid, q_path, key_change, next_pos)
        )
        conn.commit()
        print(f"  [QUEUED] position={next_pos} qsongid={cursor.lastrowid}")

        if request_id:
            accept_request(request_id)

        return True

    except Exception as e:
        print(f"  [ERROR] {e}")
        conn.rollback()
        return False
    finally:
        conn.close()


def poll():
    last_id = get_last_id()

    try:
        silent_requests = get_silent_requests()
        new_requests = [r for r in silent_requests if r.get('request_id', 0) > last_id]

        if not new_requests:
            return True

        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] {len(new_requests)} new silent request(s)")

        highest = last_id
        success_count = 0

        for req in new_requests:
            rid = req.get('request_id', 0)
            singer = req.get('singer', '')
            artist = req.get('artist', '')
            title = req.get('title', '')
            print(f"\n  #{rid}: {singer} -> \"{artist} - {title}\"")

            ok = auto_queue_song(req)
            if ok:
                success_count += 1
                if rid > highest:
                    highest = rid
                print(f"  \u2713 #{rid} done")
            else:
                print(f"  \u2717 #{rid} failed — will retry")

        if highest > last_id:
            save_last_id(highest)
            print(f"\n  [STATE] last_id advanced to {highest}")

        return success_count > 0

    except Exception as e:
        print(f"  [POLL] Error: {e}")
        return False


def main():
    if '--once' in sys.argv:
        poll()
        return

    print("=" * 50)
    print("  OpenKJ Rotation Poller v2.0")
    print(f"  Polling {API_BASE}")
    print(f"  Interval: {POLL_INTERVAL}s")
    print("=" * 50)

    while True:
        try:
            poll()
        except KeyboardInterrupt:
            print("\nShutting down...")
            break
        except Exception as e:
            print(f"[FATAL] {e}")
        time.sleep(POLL_INTERVAL)


if __name__ == '__main__':
    main()

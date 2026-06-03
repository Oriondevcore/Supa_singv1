#!/usr/bin/env python3
"""
Seed singer profiles + favourites from OpenKJ history into D1.

Reads historySingers and historySongs from the OpenKJ SQLite database
on the Windows machine and registers them in the supabook_users_db via API.
"""

import json
import urllib.request
import subprocess
import sys
import os
import re

API_BASE = "https://supatraxx-api.oriondevcore.com"
WINDOWS_HOST = "192.168.1.100"
WINDOWS_USER = "admin"
WINDOWS_PASS = "bolt123"
OPENKJ_DB = r"C:\Users\Admin\AppData\Local\OpenKJ\OpenKJ\openkj.sqlite"

SSH_CMD = ["sshpass", "-p", WINDOWS_PASS, "ssh", "-o", "StrictHostKeyChecking=no",
           f"{WINDOWS_USER}@{WINDOWS_HOST}"]


def ssh(cmd):
    full_cmd = SSH_CMD + [cmd]
    result = subprocess.run(full_cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        print(f"SSH error: {result.stderr}")
        return None
    return result.stdout.strip()


def query_sqlite(sql):
    result = ssh(f'sqlite3 -csv "{OPENKJ_DB}" "{sql}"')
    if not result:
        return []
    lines = [l.strip() for l in result.split('\n') if l.strip()]
    return lines


def api_post(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=body,
        headers={'Content-Type': 'application/json', 'User-Agent': 'SupaTraxx-Seed/1.0'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode()) if e.code != 502 else {"error": str(e)}


def register_singer(name):
    stage = re.sub(r'\s*\[.*?\]', '', name).strip()
    result = api_post('/register', {
        "name": name,
        "whatsapp": "",
        "stageName": stage or name
    })
    return result.get('success', False)


def main():
    print("=" * 50)
    print("  SupaTraxx Singer Seed")
    print(f"  From: Windows ({WINDOWS_HOST})")
    print(f"  To:   {API_BASE}")
    print("=" * 50)

    print("\n1. Fetching history singers...")
    singers = query_sqlite("SELECT id, name FROM historySingers ORDER BY id;")
    print(f"   Found {len(singers)} singers")

    print("\n2. Fetching history songs...")
    songs = query_sqlite(
        "SELECT h.historySinger, s.id, s.artist, s.title, h.plays "
        "FROM historySongs h "
        "JOIN dbSongs s ON h.songid = s.songid "
        "WHERE h.plays > 0 "
        "ORDER BY h.historySinger, h.plays DESC;"
    )
    print(f"   Found {len(songs)} song entries")

    print("\n3. Registering singers...")
    registered = 0
    skipped = 0
    for line in singers:
        parts = line.split(',', 1)
        if len(parts) < 2:
            continue
        sid, name = parts[0].strip(), parts[1].strip()
        if not name:
            skipped += 1
            continue
        ok = register_singer(name)
        if ok:
            registered += 1
        else:
            skipped += 1
        if registered % 100 == 0 and registered > 0:
            print(f"   ... {registered} registered")

    print(f"\n   Done: {registered} registered, {skipped} skipped")

    print("\n4. Seeding favourites (top songs per singer)...")
    fav_count = 0
    current_singer = None
    songs_for_singer = []

    for line in songs:
        parts = line.split(',', 4)
        if len(parts) < 5:
            continue
        singer_id, song_id, artist, title, plays = parts
        if current_singer != singer_id:
            if current_singer and songs_for_singer:
                for s in songs_for_singer[:10]:
                    name = None
                    for sl in singers:
                        if sl.startswith(current_singer + ','):
                            name = sl.split(',', 1)[1].strip()
                            break
                    if name:
                        result = api_post('/favourite', {
                            "singerName": name,
                            "songId": int(s['song_id']),
                            "artist": s['artist'],
                            "title": s['title']
                        })
                        if result.get('success'):
                            fav_count += 1
            current_singer = singer_id
            songs_for_singer = []

        songs_for_singer.append({
            'song_id': song_id.strip(),
            'artist': artist.strip(),
            'title': title.strip()
        })

    print(f"   Seeded {fav_count} favourites")

    print("\n" + "=" * 50)
    print("  Seed complete!")
    print(f"  Singers: {registered}")
    print(f"  Favourites: {fav_count}")
    print("=" * 50)


if __name__ == '__main__':
    main()

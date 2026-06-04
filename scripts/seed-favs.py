#!/usr/bin/env python3
import subprocess, json, re, sys

HISTORY_FILE = "/tmp/history_data.json"
WRANGLER = ["npx", "wrangler", "d1", "execute", "supabook_users_db", "--remote", "--json"]

def norm(s):
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9\s]', '', s.lower().strip())).strip()

def run(cmd, timeout=120):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if r.returncode != 0:
        print(f"FAILED: {r.stderr[:300]}")
        return None
    return r.stdout

def parse_wrangler(out):
    lines = out.strip().split('\n')
    for i, line in enumerate(lines):
        if line.startswith('['):
            return json.loads('\n'.join(lines[i:]))
    return None

def esc(s):
    return s.replace("'", "''")

def main():
    # Load D1 songs
    print("Fetching D1 songs...")
    out = run(["npx", "wrangler", "d1", "execute", "supatraxx_karaoke_db", "--remote",
               "--command", "SELECT id, artist, title FROM okjrs_songdb;"], 180)
    if not out: return
    data = parse_wrangler(out)
    if not data: return
    song_map = {}
    for s in data[0]['results']:
        if s.get('artist') and s.get('title'):
            song_map[(norm(s['artist']), norm(s['title']))] = s['id']
    print(f"  {len(song_map)} unique songs")

    # Load history from local file
    print("Loading history data...")
    history = json.load(open(HISTORY_FILE))
    print(f"  {len(history)} entries")

    # Match
    matched, no_match, seen = [], 0, set()
    for row in history:
        name, artist, title = row['name'].strip(), row['artist'].strip(), row['title'].strip()
        if not name or not artist or not title: continue
        dk = (name.lower(), artist.lower(), title.lower())
        if dk in seen: continue
        seen.add(dk)
        sid = song_map.get((norm(artist), norm(title)))
        if sid:
            matched.append((name, sid, artist, title))
        else:
            no_match += 1

    print(f"Matched: {len(matched)}, No match: {no_match}")

    # Bulk insert
    if matched:
        batch, total = [], 0
        for name, sid, artist, title in matched:
            batch.append(f"('{esc(name)}',{sid},'{esc(artist)}','{esc(title)}',0)")
            if len(batch) >= 200:
                sql = f"INSERT OR IGNORE INTO favourites (singer_name,song_id,artist,title,key_change) VALUES {','.join(batch)}"
                run(WRANGLER + ["--command", sql], 60)
                total += len(batch)
                print(f"  Inserted {total}...")
                batch = []
        if batch:
            sql = f"INSERT OR IGNORE INTO favourites (singer_name,song_id,artist,title,key_change) VALUES {','.join(batch)}"
            run(WRANGLER + ["--command", sql], 60)
            total += len(batch)
        print(f"Imported: {total}")

    print("DONE")

if __name__ == '__main__':
    main()

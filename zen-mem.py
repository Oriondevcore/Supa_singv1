#!/usr/bin/env python3
"""
zen-mem — SupaSing Project Memory System
Persists session context, decisions, and todos to Cloudflare D1.
Call from any machine to recall full project state.

Usage:
  python3 zen-mem.py --init            First-time setup (creates tables)
  python3 zen-mem.py --save "msg"      Save what just happened
  python3 zen-mem.py --recall          Recall full context
  python3 zen-mem.py --status          Quick status summary
  python3 zen-mem.py --ask "question"  Search past decisions
  python3 zen-mem.py --todo "add"     Add a todo (pending)
  python3 zen-mem.py --done "id"       Mark todo complete
"""
import json, os, sys, time, re, uuid
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError

CF_API = "https://api.cloudflare.com/client/v4"
CF_TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
CF_ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")

ZEN_DB_ID = "3f7d5f7a-0554-4fcb-9525-e5801be336e3"

STATE_DIR = os.path.expanduser("~/.config/zen-mem")
STATE_FILE = os.path.join(STATE_DIR, "state.json")

os.makedirs(STATE_DIR, exist_ok=True)

def cf_headers():
    return {
        "Authorization": f"Bearer {CF_TOKEN}",
        "Content-Type": "application/json"
    }

def d1_query(sql, params=None):
    body = {"sql": sql}
    if params:
        body["params"] = params
    req = Request(
        f"{CF_API}/accounts/{CF_ACCOUNT}/d1/database/{ZEN_DB_ID}/query",
        data=json.dumps(body).encode(),
        headers=cf_headers()
    )
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read().decode())

def d1_execute(sql, params=None):
    result = d1_query(sql, params)
    if not result.get("success"):
        print(f"[ERROR] D1 query failed: {result.get('errors', result)}")
        return False
    return True

def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except:
        return {"session_id": str(uuid.uuid4())[:8], "started_at": datetime.now(timezone.utc).isoformat()}

def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)

def init_db():
    print("[zen-mem] Creating tables in zen_db (D1)...")
    tables = [
        """CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT UNIQUE NOT NULL,
            started_at TEXT NOT NULL,
            context TEXT,
            summary TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );""",
        """CREATE TABLE IF NOT EXISTS decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            category TEXT,
            decision TEXT NOT NULL,
            rationale TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );""",
        """CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL,
            purpose TEXT,
            last_modified TEXT
        );""",
        """CREATE TABLE IF NOT EXISTS todos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            priority TEXT DEFAULT 'medium',
            created_at TEXT DEFAULT (datetime('now')),
            completed_at TEXT
        );""",
        """CREATE TABLE IF NOT EXISTS context_log (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        );"""
    ]
    for sql in tables:
        r = d1_query(sql)
        if not r.get("success"):
            print(f"  [FAIL] Could not create table: {r.get('errors')}")
            return False
    print("  [OK] All tables created")
    return True

def save_session(summary):
    state = load_state()
    d1_execute(
        "INSERT INTO sessions (session_id, started_at, summary) VALUES (?, ?, ?)",
        [state["session_id"], state["started_at"], summary]
    )
    print(f"  [OK] Session saved: {summary[:60]}...")

def save_decision(category, decision, rationale=""):
    state = load_state()
    d1_execute(
        "INSERT INTO decisions (session_id, category, decision, rationale) VALUES (?, ?, ?, ?)",
        [state["session_id"], category, decision, rationale]
    )
    print(f"  [OK] Decision saved: {decision[:60]}...")

def recall():
    r = d1_query("SELECT * FROM context_log ORDER BY updated_at DESC LIMIT 20")
    if r.get("success") and r["result"]:
        for row in r["result"][0].get("results", []):
            print(f"  {row['key']}: {row['value'][:120]}")

    r = d1_query("SELECT * FROM decisions ORDER BY created_at DESC LIMIT 20")
    if r.get("success") and r["result"]:
        print("\n  --- Recent Decisions ---")
        for row in r["result"][0].get("results", []):
            print(f"  [{row.get('category','?')}] {row['decision'][:80]}")

    r = d1_query("SELECT * FROM todos WHERE status = 'pending' ORDER BY created_at DESC")
    if r.get("success") and r["result"]:
        rows = r["result"][0].get("results", [])
        if rows:
            print(f"\n  --- Pending Todos ({len(rows)}) ---")
            for row in rows:
                print(f"  #{row['id']} [{row['priority']}] {row['description'][:80]}")

def show_status():
    r = d1_query("SELECT COUNT(*) as c FROM sessions")
    sessions = r["result"][0]["results"][0]["c"] if r.get("success") else "?"
    r = d1_query("SELECT COUNT(*) as c FROM decisions")
    decisions = r["result"][0]["results"][0]["c"] if r.get("success") else "?"
    r = d1_query("SELECT COUNT(*) as c FROM todos WHERE status = 'pending'")
    pending = r["result"][0]["results"][0]["c"] if r.get("success") else "?"
    r = d1_query("SELECT COUNT(*) as c FROM todos WHERE status = 'completed'")
    done = r["result"][0]["results"][0]["c"] if r.get("success") else "?"
    state = load_state()
    print(f"zen-mem status")
    print(f"  Session:        {state['session_id']}")
    print(f"  Started:        {state['started_at'][:19]}")
    print(f"  Sessions:       {sessions}")
    print(f"  Decisions:      {decisions}")
    print(f"  Todos pending:  {pending}")
    print(f"  Todos done:     {done}")
    print(f"  D1 database:    zen_db ({ZEN_DB_ID})")

def add_todo(desc, priority="medium"):
    d1_execute(
        "INSERT INTO todos (description, priority) VALUES (?, ?)",
        [desc, priority]
    )
    print(f"  [OK] Todo added: {desc[:60]}...")

def mark_done(todo_id):
    d1_execute(
        "UPDATE todos SET status = 'completed', completed_at = datetime('now') WHERE id = ?",
        [int(todo_id)]
    )
    print(f"  [OK] Todo #{todo_id} completed")

def ask(question):
    """Search decisions for relevant context"""
    r = d1_query("SELECT * FROM decisions ORDER BY created_at DESC LIMIT 50")
    if not r.get("success") or not r["result"]:
        print("  [INFO] No decision history yet.")
        return
    rows = r["result"][0].get("results", [])
    keywords = question.lower().split()
    if not keywords:
        for row in rows:
            print(f"  [{row.get('category','?')}] {row['decision']}")
        return
    scored = []
    for row in rows:
        text = f"{row['decision']} {row.get('rationale','')}".lower()
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scored.append((score, row))
    scored.sort(key=lambda x: x[0], reverse=True)
    for score, row in scored[:5]:
        print(f"  [{score}][{row.get('category','?')}] {row['decision'][:100]}")
        if row.get('rationale'):
            print(f"    Reason: {row['rationale'][:120]}")

def save_context(key, value):
    d1_execute(
        "INSERT OR REPLACE INTO context_log (key, value, updated_at) VALUES (?, ?, datetime('now'))",
        [key, value]
    )

def main():
    global CF_ACCOUNT
    if not CF_TOKEN:
        print("[ERROR] Set CLOUDFLARE_API_TOKEN env var")
        sys.exit(1)
    if not CF_ACCOUNT:
        CF_ACCOUNT = "fdd89cf30de14e1ddcfa5fbbf27581c1"

    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1]

    if cmd == "--init":
        if not init_db():
            sys.exit(1)
        save_context("project", "SupaSing — Orion SupaSing Karaoke Ecosystem")
        save_context("repos", "https://github.com/Oriondevcore/Supa_singv1.git")
        save_context("api_token_note", "CF token stored in CLOUDFLARE_API_TOKEN env var")
        print("\n[zen-mem] Ready. Use --save, --recall, --status, --ask, --todo, --done")

    elif cmd == "--save":
        msg = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else ""
        if msg:
            save_session(msg)
        else:
            print("[ERROR] Provide a message: --save \"what happened\"")

    elif cmd == "--decide":
        if len(sys.argv) < 4:
            print("Usage: --decide category \"decision\" [rationale]")
            return
        category = sys.argv[2]
        decision = sys.argv[3]
        rationale = " ".join(sys.argv[4:]) if len(sys.argv) > 4 else ""
        save_decision(category, decision, rationale)

    elif cmd == "--recall":
        recall()

    elif cmd == "--status":
        show_status()

    elif cmd == "--ask":
        q = " ".join(sys.argv[2:])
        ask(q)

    elif cmd == "--todo":
        desc = " ".join(sys.argv[2:])
        add_todo(desc)

    elif cmd == "--done":
        mark_done(sys.argv[2])

    elif cmd == "--context":
        if len(sys.argv) < 4:
            print("Usage: --context key value")
            return
        save_context(sys.argv[2], " ".join(sys.argv[3:]))

    else:
        print(f"[ERROR] Unknown command: {cmd}")
        print(__doc__)

if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate SQL to seed singers from OpenKJ history into D1 users table."""
import csv
import re

def clean_stage(name):
    s = re.sub(r'\s*\[.*?\]', '', name).strip()
    return s or name

with open('history_singers.csv', newline='', encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = []
    for row in reader:
        if len(row) < 2:
            continue
        sid, name = row[0].strip(), row[1].strip()
        if not name:
            continue
        stage = clean_stage(name).replace("'", "''")
        name_esc = name.replace("'", "''")
        rows.append(f"INSERT OR IGNORE INTO users (name, whatsapp, stage_name) VALUES ('{name_esc}', '', '{stage}');")

with open('seed_users.sql', 'w', encoding='utf-8') as f:
    f.write("-- Seed singers from OpenKJ historySingers\n")
    f.write(f"-- {len(rows)} singers\n\n")
    f.write('\n'.join(rows))
    f.write('\n')

print(f"Generated {len(rows)} INSERT statements -> seed_users.sql")

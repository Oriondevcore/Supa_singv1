# SupaSing — Orion SupaSing Karaoke Ecosystem

Mobile-first karaoke song request platform for Connor's Public House.
Search songs by mood, genre, or title — tap Supa-Sing! to queue your jam with the DJ.

## Tech Stack
- **Frontend**: Vanilla JS + CSS, Cloudflare Pages
- **Backend**: Cloudflare Workers + D1 (SQLite)
- **Search**: FTS5 full-text search (224k songs)
- **Desktop**: Python poller → OpenKJ SQLite
- **Memory**: zen-mem Python CLI → D1

## Repo Structure
```
orion-supasing/
├── api/           — Cloudflare Worker (unified API)
├── zen-search/    — zen-search.oriondevcore.com
├── userdb/        — userdb.oriondevcore.com (profile page)
├── fav/           — fav.oriondevcore.com (favourites)
├── docs/          — docs.oriondevcore.com
├── assets/        — SVG icons & brand assets
├── poller/        — Windows poller scripts
├── zen-mem.py     — Project memory system
├── master-plan.md — Architecture & roadmap
├── devlog.md      — Development log
├── FAQ.md         — Singer FAQ
├── HOWTO.md       — Venue staff guide
└── HELP.md        — Troubleshooting guide
```

## Quick Start
```bash
# Set up environment
export CLOUDFLARE_API_TOKEN="your-cf-api-token"

# Deploy API worker
cd api && wrangler deploy worker.js

# Deploy frontends
wrangler pages deploy zen-search/ --project-name zen-search
wrangler pages deploy userdb/ --project-name userdb
wrangler pages deploy fav/ --project-name fav
wrangler pages deploy docs/ --project-name docs-oriondevcore
```

## Learn More
- [Architecture & Roadmap](master-plan.md)
- [FAQ](FAQ.md)
- [How-To Guide](HOWTO.md)
- [Help & Troubleshooting](HELP.md)

## License
Orion Ventures — Connor's Public House

# SupaSing — How-To Guide (Venue Staff)

## Setting Up for the Night

1. **Windows laptop**: Ensure OpenKJ Pro is running and OKJRS is enabled
2. **Start the poller**: `python3 openkj-poller.py` (runs continuously)
3. **Verify**: Open Zen Search, search a song, tap Supa-Sing! — request should appear in OpenKJ within 30s

## Handling Requests

- **New singers**: OKJRS popup appears — review and accept/reject
- **Regulars**: Requests auto-queue (poller writes directly to queueSongs)
- **Checking the queue**: OpenKJ rotation panel shows all queued songs

## Poller Management

```bash
# Run once (test)
python3 openkj-poller.py --once

# Run continuously (production)
python3 openkj-poller.py

# Check state
type %USERPROFILE%\.hermes\openkj_poller_state.json
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Requests not showing in OpenKJ | Check poller is running. Verify CLOUDFLARE_API_TOKEN |
| Poller errors | Check `openkj.sqlite` is accessible. Run `--once` to test |
| Duplicate requests | Poller checks for duplicates before inserting |
| OKJRS not connecting | Verify venue_id matches OpenKJ config |

## Updating

```bash
# Pull latest code
git pull

# Deploy API
cd api && wrangler deploy worker.js

# Deploy frontends
wrangler pages deploy zen-search/ --project-name zen-search
```

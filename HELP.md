# SupaSing — Help & Troubleshooting

## Common Issues

### "Song request didn't go through"
- Check your internet connection
- Try searching again and tapping Supa-Sing!
- If it persists, tell the DJ — they can take your request manually

### "I can't find a song"
- Try different spellings or search by artist
- Browse by mood or genre instead
- Not all songs are in every library — ask the DJ

### "My favourites disappeared"
- Favourites are tied to your stage name. Make sure you're using the same name.
- Try searching your name on fav.oriondevcore.com

### "The page looks broken"
- Refresh the page
- Clear your browser cache
- Make sure you're on the latest version

## For the DJ

### Poller won't start
```
python3 openkj-poller.py --once
```
Run with `--once` to see the full error output.

### Requests stuck in pending
Check that OKJRS is enabled in OpenKJ. The poller only auto-queues for singers already in the rotation. New singers need the KJ to manually accept via OKJRS popup.

### Queue isn't updating
Stop the poller (Ctrl+C), wait 5s, start again. Check Windows firewall isn't blocking outbound HTTPS.

## Support
Contact Graham at Connor's during venue hours.

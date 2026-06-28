// supatraxx-api v4.0 — Unified API Worker
// Songs, requests, profiles, favourites, OKJRS protocol
// DB = supatraxx_karaoke_db (songs, requests, profiles)
// UB = supabook_users_db (users, favourites)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const VERSION = '4.0.0';
const VENUE = "Connor's Public House, 46 Ashley Ave, Durban North";
const SCHEDULE = 'Thursday 7pm-late';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ── Spilled Beer (drunk-proof search) ──
const DRUNK_CHARS = /[-"\\.,;:!@#$%^&*()_+=\[\]{}|<>\/~]/g;

function spilledBeer(text) {
  // Strip punctuation → space, apostrophe → empty (same as cleanSQL)
  return text.replace(DRUNK_CHARS, ' ').replace(/'/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function cleanSQL(expr) {
  // Strip punctuation → space, apostrophe → empty, collapse consecutive spaces
  const chars = ['-', '"', '.', ',', ';', ':', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '_', '+', '=', '[', ']', '{', '}', '|', '<', '>', '/', '~'];
  let sql = `UPPER(${expr})`;
  for (const c of chars) sql = `REPLACE(${sql}, '${c}', ' ')`;
  sql = `REPLACE(${sql}, CHAR(39), '')`;                // apostrophe → empty (so O'BRIEN→OBRIEN)
  sql = `REPLACE(${sql}, '  ', ' ')`;                   // collapse double spaces
  sql = `REPLACE(${sql}, '  ', ' ')`;
  sql = `REPLACE(${sql}, '  ', ' ')`;
  return sql;
}

async function getSerial(env) {
  // Dynamic serial = max request ID so OKJRS detects new requests
  const row = await env.DB.prepare('SELECT COALESCE(MAX(id), 0) as max_id FROM song_requests').first().catch(() => ({ max_id: 0 }));
  return row.max_id;
}

async function getSinger(env, name) {
  if (!name) return null;
  let s = await env.DB.prepare('SELECT * FROM singer_profiles WHERE name = ?').bind(name).first();
  if (!s) {
    await env.DB.prepare('INSERT INTO singer_profiles (name, points, tokens, total_requests, milestone_level) VALUES (?, 0, 0, 0, 0)').bind(name).run();
    s = await env.DB.prepare('SELECT * FROM singer_profiles WHERE name = ?').bind(name).first();
  }
  return s;
}

async function getUBUser(env, name) {
  if (!name) return null;
  return await env.UB.prepare('SELECT * FROM users WHERE name = ?').bind(name).first();
}

function calcMilestones(reqs) {
  const levels = [1, 5, 10, 25, 50, 100];
  const icons = ['mic', 'star', 'bronze', 'silver', 'gold', 'trophy'];
  const ms = [];
  for (let i = 0; i < levels.length; i++) {
    if (reqs >= levels[i]) ms.push({ level: levels[i], icon: icons[i], unlocked: true });
    else { ms.push({ level: levels[i], icon: icons[i], unlocked: false }); break; }
  }
  if (ms.length <= levels.length && ms[ms.length - 1]?.unlocked !== false) {
    for (let i = ms.length; i < levels.length; i++)
      ms.push({ level: levels[i], icon: icons[i], unlocked: false });
  }
  return ms;
}

async function addPoints(env, singerName, points, tokens = 0) {
  const s = await getSinger(env, singerName);
  const newPts = (s.points || 0) + points;
  const newToks = (s.tokens || 0) + tokens;
  const newReqs = (s.total_requests || 0) + 1;
  const ml = calcMilestones(newReqs).filter(m => m.unlocked).length || 0;
  await env.DB.prepare('UPDATE singer_profiles SET points = ?, tokens = ?, total_requests = ?, milestone_level = ?, updated_at = datetime(\'now\') WHERE name = ?')
    .bind(newPts, newToks, newReqs, ml, singerName).run();
  return { points: newPts, tokens: newToks, total_requests: newReqs, milestone_level: ml, milestones: calcMilestones(newReqs) };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const body = method === 'POST' ? await request.json().catch(() => ({})) : {};

    if (path === '/health') {
      const tot = await env.DB.prepare('SELECT COUNT(*) as c FROM dbSongs').first().catch(() => ({ c: 0 }));
      return json({ status: 'live', service: 'SupaTraxx Karaoke API', version: VERSION, totalSongs: tot.c || 0, venue: VENUE, schedule: SCHEDULE, timestamp: new Date().toISOString() });
    }

    // ── SEARCH (Spilled Beer) ──
    if (path === '/search') {
      const q = (url.searchParams.get('q') || '').trim();
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);

      if (!q) {
        const { results } = await env.DB.prepare('SELECT songid as id, Artist as artist, Title as title FROM dbSongs ORDER BY songid LIMIT ?').bind(limit).all();
        return json({ query: '', count: results.length, results });
      }

      const cleaned = spilledBeer(q);
      let words = cleaned ? cleaned.split(/\s+/) : [];
      if (words.length === 0) return json({ query: q, count: 0, results: [] });

      let results = [];
      while (words.length > 0 && results.length === 0) {
        const searchTerm = words.join(' ');
        const cleanCol = cleanSQL("s.Artist || ' ' || s.Title");
        const sql = `SELECT s.songid as id, s.Artist as artist, s.Title as title FROM dbSongs s WHERE ${cleanCol} LIKE ? ORDER BY s.songid LIMIT ?`;
        const { results: r } = await env.DB.prepare(sql).bind(`%${searchTerm}%`, limit).all();
        results = r;
        if (results.length === 0) words.pop();
      }

      return json({ query: q, cleaned, count: results.length, results });
      } catch (e) {
        return json({ error: 'Search failed', details: e.message }, 500);
      }
    }

    if (path === '/genres') {
      try {
        const { results } = await env.DB.prepare('SELECT genre, COUNT(*) as count FROM songs_metadata WHERE genre IS NOT NULL AND genre != \'\' GROUP BY genre ORDER BY count DESC').all();
        return json({ genres: results });
      } catch (e) {
        return json({ genres: [], count: 0 });
      }
    }

    if (path === '/stats') {
      try {
        const songs = await env.DB.prepare('SELECT COUNT(*) as c FROM dbSongs').first();
        const reqs = await env.DB.prepare('SELECT COUNT(*) as c FROM song_requests WHERE status = \'pending\'').first().catch(() => ({ c: 0 }));
        return json({ totalSongs: songs.c, pendingRequests: reqs.c });
      } catch (e) {
        return json({ error: 'Stats failed' }, 500);
      }
    }

    if (path === '/random') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
      try {
        const { results } = await env.DB.prepare('SELECT songid as id, Artist as artist, Title as title FROM dbSongs ORDER BY RANDOM() LIMIT ?').bind(limit).all();
        return json({ count: results.length, results });
      } catch (e) {
        return json({ error: 'Random failed' }, 500);
      }
    }

    if (path === '/trending') {
      try {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 30);
        const { results } = await env.DB.prepare('SELECT artist, title, COUNT(*) as requests FROM song_requests WHERE created_at > datetime(\'now\', \'-7 days\') AND status = \'played\' GROUP BY artist, title ORDER BY requests DESC LIMIT ?').bind(limit).all().catch(() => ({ results: [] }));
        return json({ count: results.length, trending: results });
      } catch (e) {
        return json({ trending: [] });
      }
    }

    if (path === '/suggestions') {
      const q = (url.searchParams.get('q') || '').trim();
      const genre = (url.searchParams.get('genre') || '').trim();
      const singerName = url.searchParams.get('singer') || '';
      try {
        let history = [];
        if (singerName) {
          const s = await getSinger(env, singerName);
          if (s?.id) {
            history = await env.DB.prepare('SELECT artist, title FROM song_requests WHERE singer = ? ORDER BY created_at DESC LIMIT 10').bind(singerName).all().catch(() => ({ results: [] }));
          }
        }
        const trending = await env.DB.prepare('SELECT artist, title, COUNT(*) as req_count FROM song_requests WHERE created_at > datetime(\'now\', \'-3 days\') GROUP BY artist, title ORDER BY req_count DESC LIMIT 5').all().catch(() => ({ results: [] }));
        let suggestions = [];
        if (q) {
          const cleaned = spilledBeer(q);
          let words = cleaned ? cleaned.split(/\s+/) : [];
          while (words.length > 0 && suggestions.length === 0) {
            const searchTerm = words.join(' ');
            const cleanCol = cleanSQL("Artist || ' ' || Title");
            const { results } = await env.DB.prepare(`SELECT songid as id, Artist as artist, Title as title FROM dbSongs WHERE ${cleanCol} LIKE ? ORDER BY songid LIMIT 10`).bind(`%${searchTerm}%`).all();
            suggestions = results;
            if (suggestions.length === 0) words.pop();
          }
        } else {
          suggestions = trending.results || [];
        }
        return json({ query: q, suggestions, trending: trending.results || [], history: history.results || [], singer: singerName });
      } catch (e) {
        return json({ suggestions: [], trending: [], history: [] });
      }
    }

    // ── REGISTER ──
    if (path === '/register' && method === 'POST') {
      const { name, whatsapp, stageName, moodIcon, moodColor } = body;
      if (!name) return json({ error: 'name is required' }, 400);
      try {
        const existing = await env.UB.prepare('SELECT * FROM users WHERE name = ?').bind(name).first();
        if (existing) {
          await env.UB.prepare('UPDATE users SET whatsapp = COALESCE(?, whatsapp), stage_name = COALESCE(?, stage_name), mood_icon = COALESCE(?, mood_icon), mood_color = COALESCE(?, mood_color), updated_at = datetime(\'now\') WHERE name = ?')
            .bind(whatsapp || null, stageName || null, moodIcon || null, moodColor || null, name).run();
        } else {
          await env.UB.prepare('INSERT INTO users (name, whatsapp, stage_name, mood_icon, mood_color) VALUES (?, ?, ?, ?, ?)')
            .bind(name, whatsapp || '', stageName || name, moodIcon || 'mic', moodColor || '#c8a44e').run();
        }
        await getSinger(env, name);
        return json({ success: true, message: 'Profile saved!', name, stageName: stageName || name, whatsapp: whatsapp || '' }, 201);
      } catch (e) {
        return json({ error: 'Registration failed', details: e.message }, 500);
      }
    }

    // ── REQUEST ──
    if (path === '/request' && method === 'POST') {
      const { singerName, songId, keyChange = 0 } = body;
      if (!singerName || !songId) return json({ error: 'singerName and songId are required' }, 400);
      try {
        const song = await env.DB.prepare('SELECT Artist as artist, Title as title FROM dbSongs WHERE songid = ?').bind(songId).first();
        if (!song) return json({ error: 'Song not found' }, 404);

        const singer = await getSinger(env, singerName);
        const hasSungBefore = (singer.total_requests || 0) > 0;
        const status = hasSungBefore ? 'silent' : 'pending';

        await env.DB.prepare('INSERT INTO song_requests (singer, song_id, artist, title, key_change, venue, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind(singerName, songId, song.artist, song.title, keyChange, VENUE, status).run();

        const pts = await addPoints(env, singerName, 10, 0);

        const ubUser = await getUBUser(env, singerName);
        const needsProfile = !ubUser || !ubUser.whatsapp;

        return json({
          success: true,
          message: 'Your jam is in the queue! Listen for your name.',
          singerName,
          artist: song.artist,
          title: song.title,
          keyChange,
          status,
          needsProfile,
          points: pts
        }, 201);
      } catch (e) {
        return json({ error: 'Request failed', details: e.message }, 500);
      }
    }

    // ── PROFILE ──
    if (path === '/profile') {
      const name = url.searchParams.get('name') || body.name || '';
      if (!name) return json({ error: 'name required' }, 400);
      try {
        if (method === 'POST') {
          const { whatsapp, stageName, moodIcon, moodColor, action } = body;
          if (action === 'delete') {
            await env.DB.prepare('DELETE FROM song_requests WHERE singer = ?').bind(name).run();
            await env.DB.prepare('DELETE FROM singer_profiles WHERE name = ?').bind(name).run();
            await env.UB.prepare('DELETE FROM users WHERE name = ?').bind(name).run();
            return json({ success: true, message: 'Profile deleted' });
          }
          await env.DB.prepare('UPDATE singer_profiles SET whatsapp = ?, updated_at = datetime(\'now\') WHERE name = ?').bind(whatsapp || '', name).run();
          if (stageName || moodIcon || moodColor) {
            const existing = await env.UB.prepare('SELECT * FROM users WHERE name = ?').bind(name).first();
            if (existing) {
              await env.UB.prepare('UPDATE users SET stage_name = COALESCE(?, stage_name), mood_icon = COALESCE(?, mood_icon), mood_color = COALESCE(?, mood_color), updated_at = datetime(\'now\') WHERE name = ?')
                .bind(stageName || null, moodIcon || null, moodColor || null, name).run();
            }
          }
        }
        const singer = await getSinger(env, name);
        const ubUser = await getUBUser(env, name);
        const history = singer?.id ? await env.DB.prepare('SELECT artist, title, venue, key_change, created_at, status FROM song_requests WHERE singer = ? ORDER BY created_at DESC LIMIT 20').bind(name).all().catch(() => ({ results: [] })) : { results: [] };
        return json({
          name: singer.name,
          whatsapp: singer.whatsapp || '',
          stageName: ubUser?.stage_name || singer.name,
          moodIcon: ubUser?.mood_icon || 'mic',
          moodColor: ubUser?.mood_color || '#c8a44e',
          points: singer.points || 0,
          tokens: singer.tokens || 0,
          total_requests: singer.total_requests || 0,
          milestone_level: singer.milestone_level || 0,
          milestones: calcMilestones(singer.total_requests || 0),
          history: history.results || []
        });
      } catch (e) {
        return json({ error: 'Profile error', details: e.message }, 500);
      }
    }

    // ── FAVOURITES ──
    if (path === '/favourite' && method === 'POST') {
      const { singerName, songId, artist, title, keyChange = 0 } = body;
      if (!singerName || !songId) return json({ error: 'singerName and songId required' }, 400);
      try {
        await env.UB.prepare('INSERT OR IGNORE INTO favourites (singer_name, song_id, artist, title, key_change) VALUES (?, ?, ?, ?, ?)')
          .bind(singerName, songId, artist || '', title || '', keyChange).run();
        return json({ success: true, message: 'Favourite saved!' }, 201);
      } catch (e) {
        return json({ error: 'Failed to save favourite', details: e.message }, 500);
      }
    }

    if (path === '/favourite' && method === 'DELETE') {
      const { singerName, songId } = body;
      if (!singerName || !songId) return json({ error: 'singerName and songId required' }, 400);
      try {
        await env.UB.prepare('DELETE FROM favourites WHERE singer_name = ? AND song_id = ?').bind(singerName, songId).run();
        return json({ success: true, message: 'Favourite removed' });
      } catch (e) {
        return json({ error: 'Failed to remove favourite', details: e.message }, 500);
      }
    }

    if (path === '/favourites') {
      const name = url.searchParams.get('name') || '';
      if (!name) return json({ error: 'name required' }, 400);
      try {
        const { results } = await env.UB.prepare('SELECT * FROM favourites WHERE singer_name = ? ORDER BY created_at DESC').bind(name).all();
        return json({ count: results.length, favourites: results });
      } catch (e) {
        return json({ favourites: [], count: 0 });
      }
    }

    if (path === '/tip' && method === 'POST') {
      const { amount = 20, payerName = 'Anonymous', singerName = '', venue = VENUE } = body;
      const amountCents = Math.round(amount * 100);
      try {
        const yocoKey = env.YOCO_SECRET || '';
        const checkout = await fetch('https://payments.yoco.com/api/checkouts', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${yocoKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: amountCents, currency: 'ZAR', metadata: { payerName, singerName, venue, source: 'supatraxx-api' } })
        }).then(r => r.json());
        if (checkout.redirectUrl) {
          await env.DB.prepare('INSERT INTO tips (amount, currency, payer_name, singer_name, venue, yoco_checkout_id, status) VALUES (?, \'ZAR\', ?, ?, ?, ?, \'pending\')')
            .bind(amountCents, payerName, singerName, venue, checkout.id || '').run();
          return json({ success: true, redirectUrl: checkout.redirectUrl, checkoutId: checkout.id }, 201);
        }
        return json({ error: 'Payment gateway error' }, 502);
      } catch (e) {
        return json({ error: 'Tip failed', details: e.message }, 500);
      }
    }

    if (path === '/leaderboard') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
      try {
        const { results } = await env.DB.prepare('SELECT name, points, tokens, total_requests, milestone_level FROM singer_profiles ORDER BY points DESC LIMIT ?').bind(limit).all();
        return json({ count: results.length, leaderboard: results });
      } catch (e) {
        return json({ leaderboard: [], count: 0 });
      }
    }

    // ── CHARTS (anonymous — most requested songs & artists) ──
    if (path === '/charts') {
      try {
        const days = parseInt(url.searchParams.get('days') || '7', 10);
        const timeSql = days > 0 ? `created_at > datetime('now', '-${days} days') AND` : '';
        const songs = await env.DB.prepare(`SELECT artist, title, COUNT(*) as requests FROM song_requests WHERE ${timeSql} status IN ('played', 'accepted') GROUP BY artist, title ORDER BY requests DESC LIMIT 20`).all().catch(() => ({ results: [] }));
        const artists = await env.DB.prepare(`SELECT artist, COUNT(*) as requests FROM song_requests WHERE ${timeSql} status IN ('played', 'accepted') GROUP BY artist ORDER BY requests DESC LIMIT 20`).all().catch(() => ({ results: [] }));
        return json({ songs: songs.results || [], artists: artists.results || [] });
      } catch (e) {
        return json({ songs: [], artists: [] });
      }
    }

    // ── ARTWORK (iTunes lookup + D1 cache) ──
    if (path === '/artwork') {
      const artist = (url.searchParams.get('artist') || '').trim();
      const title = (url.searchParams.get('title') || '').trim();
      if (!artist || !title) return json({ error: 'artist and title required' }, 400);
      try {
        // Check cache first
        const cached = await env.DB.prepare('SELECT artwork_url FROM album_art WHERE artist = ? AND title = ?').bind(artist, title).first();
        if (cached?.artwork_url) return json({ artist, title, artwork_url: cached.artwork_url });

        // Query iTunes API
        const searchTerm = encodeURIComponent(`${artist} ${title}`.substring(0, 200));
        const resp = await fetch(`https://itunes.apple.com/search?term=${searchTerm}&limit=1&entity=song`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });
        const data = await resp.json();
        let artworkUrl = null;
        if (data?.results?.length > 0) {
          artworkUrl = data.results[0].artworkUrl100?.replace('100x100bb', '300x300bb') || null;
        }

        // Cache result (even null to avoid repeated misses)
        await env.DB.prepare('INSERT OR REPLACE INTO album_art (artist, title, artwork_url, updated_at) VALUES (?, ?, ?, datetime(\'now\'))')
          .bind(artist, title, artworkUrl).run();

        return json({ artist, title, artwork_url: artworkUrl });
      } catch (e) {
        return json({ artist, title, artwork_url: null, error: e.message });
      }
    }

    if (path === '/queue') {
      try {
        const { results } = await env.DB.prepare('SELECT * FROM song_requests WHERE status = \'pending\' ORDER BY created_at ASC LIMIT 50').all();
        return json({ count: results.length, queue: results });
      } catch (e) {
        return json({ queue: [] });
      }
    }

    if (path === '/history') {
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
      try {
        const { results } = await env.DB.prepare('SELECT * FROM song_requests ORDER BY created_at DESC LIMIT ?').bind(limit).all();
        return json({ count: results.length, history: results });
      } catch (e) {
        return json({ history: [] });
      }
    }

    // ── OKJRS PROTOCOL ──
    if (path === '/api' && method === 'POST') {
      const { command } = body;
      let data = { command, error: 'false' };
      try {
        switch (command) {
          case 'connectionTest':
            data.connection = 'ok';
            break;
          case 'getSerial':
            data.serial = await getSerial(env);
            break;
          case 'getVenues':
            data.venues = [{ venue_id: 1, name: 'Connor\'s', url_name: 'connors', accepting: true }];
            break;
          case 'getAccepting':
            data.accepting = true;
            data.venue_id = body.venue_id || 1;
            break;
          case 'venueAccepting':
            data.accepting = true;
            break;
          case 'getAlert':
            data.alert = false;
            data.title = '';
            data.message = '';
            break;
          case 'getEntitledSystemCount':
            data.count = 1;
            break;

          // ── Poller: fetch silent requests for auto-queue ──
          case 'getSilentRequests': {
            const { results } = await env.DB.prepare('SELECT id as request_id, artist, title, singer, cast(strftime(\'%s\', created_at) as int) as request_time FROM song_requests WHERE status = \'silent\' ORDER BY id LIMIT 50').all();
            data.requests = results;
            data.serial = await getSerial(env);
            break;
          }

          // ── Poller: accept a silent request after auto-queue ──
          case 'acceptRequest': {
            const rid = body.request_id;
            if (!rid) { data.error = 'true'; data.errorString = 'request_id required'; break; }
            await env.DB.prepare("UPDATE song_requests SET status = 'accepted' WHERE id = ?").bind(rid).run();
            const req = await env.DB.prepare('SELECT singer FROM song_requests WHERE id = ?').bind(rid).first();
            if (req?.singer) {
              await addPoints(env, req.singer, 5, 0);
            }
            data.success = true;
            data.serial = await getSerial(env) + 1;
            break;
          }

          // ── Poller: reject a silent request ──
          case 'rejectRequest': {
            const rj = body.request_id;
            if (!rj) { data.error = 'true'; data.errorString = 'request_id required'; break; }
            await env.DB.prepare("UPDATE song_requests SET status = 'rejected' WHERE id = ?").bind(rj).run();
            data.success = true;
            data.serial = await getSerial(env) + 1;
            break;
          }

          case 'addSongs': {
            const songs = body.songs || [];
            let processed = 0, lastArtist = null, lastTitle = null, errs = [];
            const tx = env.DB.prepare('INSERT OR IGNORE INTO dbSongs (artist, title, combined, normalized_combined) VALUES (?, ?, ?, ?)');
            for (const item of songs) {
              if (!item.artist?.trim() || !item.title?.trim()) { errs.push(`Invalid: ${JSON.stringify(item)}`); continue; }
              const a = item.artist.trim(), t = item.title.trim();
              tx.bind(a, t, `${a} - ${t}`, `${a} - ${t}`.toLowerCase()).run();
              lastArtist = a; lastTitle = t; processed++;
            }
            data.error = errs.length > 0 ? 'true' : 'false';
            data.errorString = errs.length > 0 ? 'Some errors' : null;
            data.errors = errs;
            data['entries processed'] = processed;
            data.last_artist = lastArtist;
            data.last_title = lastTitle;
            data.serial = await getSerial(env);
            break;
          }
          case 'clearDatabase':
            await env.DB.prepare('DELETE FROM dbSongs').run();
            await env.DB.prepare('DELETE FROM song_requests').run();
            data.serial = await getSerial(env) + 1;
            break;
          case 'clearRequests':
            await env.DB.prepare('DELETE FROM song_requests').run();
            data.serial = await getSerial(env) + 1;
            break;
          case 'deleteRequest': {
            const rid2 = body.request_id;
            if (!rid2) { data.error = 'true'; data.errorString = 'request_id required'; break; }
            await env.DB.prepare('UPDATE song_requests SET status = \'deleted\' WHERE id = ?').bind(rid2).run();
            data.serial = await getSerial(env) + 1;
            break;
          }
          case 'revertToPending': {
            const rvpId = body.request_id;
            if (!rvpId) { data.error = 'true'; data.errorString = 'request_id required'; break; }
            await env.DB.prepare("UPDATE song_requests SET status = 'pending' WHERE id = ? AND status = 'silent'").bind(rvpId).run();
            data.success = true;
            data.serial = await getSerial(env) + 1;
            break;
          }
          case 'getRequests': {
            const { results } = await env.DB.prepare('SELECT id as request_id, artist, title, singer, cast(strftime(\'%s\', created_at) as int) as request_time FROM song_requests WHERE status = \'pending\' ORDER BY id LIMIT 50').all();
            data.requests = results;
            data.serial = await getSerial(env);
            break;
          }
          case 'search': {
            const ss = body.searchString || '';
            if (!ss) { data.error = 'true'; data.errorString = 'searchString required'; break; }
            const cleaned = spilledBeer(ss);
            let words = cleaned ? cleaned.split(/\s+/) : [];
            if (words.length === 0) { data.requests = []; data.serial = await getSerial(env); break; }
            let results = [];
            while (words.length > 0 && results.length === 0) {
              const searchTerm = words.join(' ');
              const cleanCol = cleanSQL("s.Artist || ' ' || s.Title");
              const { results: r } = await env.DB.prepare(`SELECT s.songid as song_id, s.Artist as artist, s.Title as title FROM dbSongs s WHERE ${cleanCol} LIKE ? ORDER BY s.songid LIMIT 100`).bind(`%${searchTerm}%`).all().catch(() => ({ results: [] }));
              results = r;
              if (results.length === 0) words.pop();
            }
            data.requests = results.map(r => ({ song_id: r.song_id, artist: r.artist, title: r.title }));
            data.serial = await getSerial(env);
            break;
          }
          case 'submitRequest': {
            const { singerName, songId } = body;
            if (!singerName || !songId) { data.error = 'true'; data.errorString = 'singerName and songId required'; break; }
            const song = await env.DB.prepare('SELECT Artist as artist, Title as title FROM dbSongs WHERE songid = ?').bind(songId).first();
            if (!song) { data.error = 'true'; data.errorString = 'Song not found'; break; }
            await env.DB.prepare('INSERT INTO song_requests (singer, song_id, artist, title, key_change, status) VALUES (?, ?, ?, ?, ?, \'pending\')').bind(singerName, songId, song.artist, song.title, body.key_change || 0).run();
            await getSinger(env, singerName);
            data.success = true;
            data.serial = await getSerial(env) + 1;
            data.request_id = 1;
            break;
          }
          default:
            data.error = 'true';
            data.errorString = 'Unknown command';
            break;
        }
      } catch (e) { data.error = 'true'; data.errorString = e.message; }
      return json(data);
    }

    if (path === '/') {
      return json({
        name: 'SupaTraxx Karaoke API',
        version: VERSION,
        runtime: 'Cloudflare Worker + D1',
        endpoints: {
          'GET  /health': 'Service status',
          'GET  /search': 'Full-text search with filters',
          'GET  /genres': 'Genre list with song counts',
          'GET  /stats': 'Database statistics',
          'GET  /random': 'Random songs',
          'GET  /trending': 'Trending songs',
          'GET  /suggestions': 'AI song suggestions',
          'POST /register': 'Create or update singer profile',
          'POST /request': 'Submit song request',
          'GET  /profile': 'Singer profile',
          'POST /profile': 'Update or delete profile',
          'POST /favourite': 'Save a favourite song',
          'DELETE /favourite': 'Remove a favourite',
          'GET  /favourites': 'List favourites',
          'GET  /queue': 'Pending request queue',
          'GET  /leaderboard': 'Top singers by points',
          'GET  /charts': 'Top requested songs & artists (anonymous)',
          'GET  /artwork': 'Album art lookup (iTunes + cache)',
          'GET  /history': 'Song request history',
          'POST /tip': 'Tip the DJ (Yoco)',
          'POST /api': 'OpenKJ Request Server protocol',
        }
      });
    }

    return json({ error: 'Not found' }, 404);
  }
};

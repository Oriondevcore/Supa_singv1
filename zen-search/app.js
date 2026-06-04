const API = 'https://supatraxx-api.orion269.workers.dev';

const searchInput = document.getElementById('searchInput');
const resultsEl = document.getElementById('results');
const moodGrid = document.getElementById('moodGrid');
const genreChips = document.getElementById('genreChips');
const genresSection = document.getElementById('genresSection');
const regModal = document.getElementById('regModal');
const regForm = document.getElementById('regForm');
const regName = document.getElementById('regName');
const regWhatsApp = document.getElementById('regWhatsApp');
const regSubmit = document.getElementById('regSubmit');
const singerBadge = document.getElementById('singerBadge');

let genres = [];
let debounceTimer = null;
let pendingRequest = null;
let singer = null;

const SINGER_KEY = 'supasing_singer';

function loadSinger() {
  try {
    const d = JSON.parse(localStorage.getItem(SINGER_KEY));
    if (d && d.name) singer = d;
  } catch {}
}

function saveSinger(d) {
  singer = d;
  localStorage.setItem(SINGER_KEY, JSON.stringify(d));
  updateSingerBadge();
}

function updateSingerBadge() {
  if (singer?.stageName) {
    singerBadge.textContent = singer.stageName;
    singerBadge.classList.add('has-singer');
  } else {
    singerBadge.textContent = '';
    singerBadge.classList.remove('has-singer');
  }
}

function logoutSinger() {
  localStorage.removeItem(SINGER_KEY);
  singer = null;
  updateSingerBadge();
}

const MOODS = [
  {
    id: 'energetic', label: 'Energetic',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    search: { genre: 'Rock' }
  },
  {
    id: 'nostalgic', label: 'Nostalgic',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    search: { decade: '1990' }
  },
  {
    id: 'romantic', label: 'Romantic',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    search: { genre: 'Ballad' }
  },
  {
    id: 'melancholic', label: 'Melancholic',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>',
    search: { genre: 'Blues' }
  },
  {
    id: 'happy', label: 'Happy',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    search: { genre: 'Pop' }
  },
  {
    id: 'zen', label: 'Chill',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>',
    search: { genre: 'Jazz' }
  }
];

function showToast(msg, duration) {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._hide);
  el._hide = setTimeout(() => el.classList.remove('show'), duration || 3000);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ─── Moods ─── */
MOODS.forEach(m => {
  const btn = document.createElement('button');
  btn.className = 'mood-btn';
  btn.dataset.mood = m.id;
  btn.innerHTML = `${m.svg}<span>${m.label}</span>`;
  btn.addEventListener('click', () => {
    const siblings = moodGrid.querySelectorAll('.mood-btn');
    if (btn.classList.contains('active')) {
      btn.classList.remove('active');
      if (!searchInput.value.trim()) { showEmpty(); return; }
      doSearch();
      return;
    }
    siblings.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    doSearch();
  });
  moodGrid.appendChild(btn);
});

/* ─── Genres ─── */
function loadGenres() {
  fetch(`${API}/genres`)
    .then(r => r.json())
    .then(d => {
      genres = (d.genres || []).map(g => g.genre).filter(Boolean);
      renderGenreChips();
    })
    .catch(() => {
      genres = ['Pop', 'Rock', 'Country', 'R&B', 'Jazz', 'Blues', 'Soul'];
      renderGenreChips();
    });
}

function renderGenreChips() {
  genreChips.innerHTML = '';
  genres.forEach(g => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = g;
    chip.dataset.value = g;
    chip.addEventListener('click', () => {
      const siblings = genreChips.querySelectorAll('.chip');
      if (chip.classList.contains('active')) {
        chip.classList.remove('active');
      } else {
        siblings.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      }
      doSearch();
    });
    genreChips.appendChild(chip);
  });
}
loadGenres();

/* ─── Search ─── */
function showEmpty() {
  genresSection.classList.remove('visible');
  resultsEl.innerHTML = `
    <div class="empty-state">
      <p>Pick a mood, choose a genre,<br>or search for a song.</p>
    </div>`;
}

function showLoading() {
  resultsEl.innerHTML = '<div class="spinner-wrap"><div class="enso-spinner"></div></div>';
}

async function doSearch() {
  const q = searchInput.value.trim();
  const activeMood = moodGrid.querySelector('.mood-btn.active');
  const activeGenre = genreChips.querySelector('.chip.active');
  const genre = activeGenre ? activeGenre.dataset.value : (activeMood ? MOODS.find(m => m.id === activeMood.dataset.mood)?.search.genre || '' : '');
  const decade = activeMood && !genre ? (MOODS.find(m => m.id === activeMood.dataset.mood)?.search.decade || '') : '';

  genresSection.classList.add('visible');
  if (!q && !genre && !decade) { showEmpty(); return; }

  showLoading();

  const params = new URLSearchParams({ limit: '30' });
  if (q) params.set('q', q);
  if (genre) params.set('genre', genre);
  if (decade) params.set('decade', decade);

  try {
    const res = await fetch(`${API}/search?${params}`);
    const data = await res.json();
    const songs = (data.results || []).map(s => ({ ...s, _id: String(s.id) }));
    renderResults(songs);
  } catch {
    resultsEl.innerHTML = '<div class="empty-state"><p>Connection error — check your network.</p></div>';
  }
}

/* ─── Favourites ─── */
let favouriteIds = new Set();

async function loadFavourites() {
  if (!singer?.name) return;
  try {
    const res = await fetch(`${API}/favourites?name=${encodeURIComponent(singer.name)}`);
    const data = await res.json();
    favouriteIds = new Set((data.favourites || []).map(f => String(f.song_id)));
  } catch {}
}

async function toggleFavourite(songId, artist, title) {
  if (!singer?.name) {
    showToast('Set your profile first to save favourites.');
    return;
  }
  const key = String(songId);
  if (favouriteIds.has(key)) {
    await fetch(`${API}/favourite`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ singerName: singer.name, songId })
    });
    favouriteIds.delete(key);
    showToast('Removed from favourites.');
  } else {
    await fetch(`${API}/favourite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ singerName: singer.name, songId, artist, title })
    });
    favouriteIds.add(key);
    showToast('Saved to favourites!');
  }
  document.querySelectorAll(`.fav-btn[data-id="${key}"]`).forEach(b => {
    b.classList.toggle('active', favouriteIds.has(key));
  });
}

/* ─── Request ─── */
async function doRequest(songId, title, artist) {
  if (!singer?.name) {
    pendingRequest = { songId, title, artist };
    regModal.classList.add('open');
    regName.focus();
    return;
  }
  await submitRequest(songId, title, artist);
}

async function submitRequest(songId, title, artist) {
  try {
    const res = await fetch(`${API}/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ singerName: singer.name, songId, keyChange: 0 })
    });
    const data = await res.json();
    if (data.success) {
      const msgs = [
        `"${title}" is in the queue!`,
        `"${title}" heading to the DJ!`,
        `"${title}" — you're up next!`,
        `"${title}" queued!`
      ];
      showToast(pickRandom(msgs), 4000);
      if (data.status === 'pending') {
        setTimeout(() => showToast('First time? The DJ will call you up!', 3500), 1200);
      }
      if (data.needsProfile) {
        setTimeout(() => showToast('Make your profile at userdb.oriondevcore.com', 5000), 2500);
      }
    } else {
      showToast('Request failed. Ask the DJ.', 4000);
    }
  } catch {
    showToast('Could not reach the DJ.', 4000);
  }
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ─── Registration Modal ─── */
regForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = regName.value.trim();
  const whatsapp = regWhatsApp.value.trim();
  if (!name || !whatsapp) {
    showToast('Name and WhatsApp are required.');
    return;
  }
  regSubmit.disabled = true;
  regSubmit.textContent = 'Connecting...';
  try {
    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, whatsapp, stageName: name })
    });
    const data = await res.json();
    if (data.success) {
      saveSinger({ name, stageName: name, whatsapp });
      regModal.classList.remove('open');
      showToast(`Welcome, ${name}!`);
      if (pendingRequest) {
        await submitRequest(pendingRequest.songId, pendingRequest.title, pendingRequest.artist);
        pendingRequest = null;
      }
    } else {
      showToast('Registration failed.');
    }
  } catch {
    showToast('Connection error.');
  }
  regSubmit.disabled = false;
  regSubmit.textContent = "Let's Go!";
});

document.getElementById('regCancel')?.addEventListener('click', () => {
  regModal.classList.remove('open');
  pendingRequest = null;
});

document.getElementById('singerBadge')?.addEventListener('click', () => {
  if (singer) {
    logoutSinger();
    showToast('Signed out.');
  }
});

/* ─── Render Results ─── */
function renderResults(songs) {
  if (!songs.length) {
    resultsEl.innerHTML = '<div class="empty-state"><p>Nothing found. Try a different search.</p></div>';
    return;
  }

  let html = `<div class="section-header"><h3>Songs</h3><span>${songs.length} found</span></div>`;
  songs.forEach((song, i) => {
    const sid = song._id;
    const isFav = favouriteIds.has(sid);
    html += `
      <div class="song-card" data-id="${sid}" style="animation-delay:${i * 0.04}s">
        <div class="song-card-body">
          <div class="song-card-title">${escapeHtml(song.title)}</div>
          <div class="song-card-artist">${escapeHtml(song.artist)}</div>
          ${(song.genre || song.year) ? `<div class="song-card-meta">${[song.genre, song.year].filter(Boolean).join(' / ')}</div>` : ''}
        </div>
        <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${sid}" data-title="${escapeHtml(song.title)}" data-artist="${escapeHtml(song.artist)}" aria-label="Favourite">
          <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button class="song-card-action" data-action="request" data-id="${sid}" data-title="${escapeHtml(song.title)}" data-artist="${escapeHtml(song.artist)}">
          <span>SING</span>
        </button>
      </div>`;
  });
  resultsEl.innerHTML = html;

  resultsEl.querySelectorAll('[data-action="request"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      doRequest(btn.dataset.id, btn.dataset.title, btn.dataset.artist);
    });
  });

  resultsEl.querySelectorAll('.fav-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavourite(btn.dataset.id, btn.dataset.artist, btn.dataset.title);
    });
  });
}

/* ─── Input ─── */
searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doSearch, 300);
});

searchInput.addEventListener('focus', () => {
  genresSection.classList.add('visible');
});

/* ─── Init ─── */
loadSinger();
updateSingerBadge();
loadFavourites();
showEmpty();

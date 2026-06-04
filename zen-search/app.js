const API = 'https://supatraxx-api.orion269.workers.dev';

const $ = id => document.getElementById(id);
const searchInput = $('searchInput');
const content = $('content');
const genreRow = $('genreRow');
const regModal = $('regModal');
const regForm = $('regForm');
const regName = $('regName');
const regWhatsApp = $('regWhatsApp');
const regSubmit = $('regSubmit');
const singerBadge = $('singerBadge');
const toast = $('toast');
const bottomBar = $('bottomBar');

let singer = null;
let genres = [];
let favouriteIds = new Set();
let pendingRequest = null;
let artworkCache = new Map();
let debounceTimer = null;
const SINGER_KEY = 'supasing_singer';

/* ─── Singer ─── */
function loadSinger() {
  try { const d = JSON.parse(localStorage.getItem(SINGER_KEY)); if (d?.name) singer = d; } catch {}
}

function saveSinger(d) {
  singer = d;
  localStorage.setItem(SINGER_KEY, JSON.stringify(d));
  updateSingerBadge();
}

function updateSingerBadge() {
  singerBadge.textContent = singer?.stageName || 'Sign In';
  singerBadge.classList.toggle('has-singer', !!singer?.stageName);
}

singerBadge.addEventListener('click', () => {
  if (singer) {
    localStorage.removeItem(SINGER_KEY);
    singer = null;
    favouriteIds = new Set();
    updateSingerBadge();
    showToast('Signed out');
    switchTab('search');
    loadCharts();
  } else {
    promptSignIn();
  }
});

function promptSignIn() {
  pendingRequest = null;
  regName.value = '';
  regWhatsApp.value = '';
  regModal.classList.add('open');
  regName.focus();
}

/* ─── Toast ─── */
function showToast(msg, duration = 3000) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._hide);
  toast._hide = setTimeout(() => toast.classList.remove('show'), duration);
}

/* ─── Register Modal ─── */
regForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = regName.value.trim();
  const whatsapp = regWhatsApp.value.trim();
  if (!name || !whatsapp) { showToast('Name and WhatsApp needed'); return; }
  regSubmit.disabled = true;
  regSubmit.textContent = 'Sending...';
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
      showToast('You\'re signed in!');
      await loadFavourites();
      if (pendingRequest) {
        await submitRequest(pendingRequest.songId, pendingRequest.title, pendingRequest.artist);
        pendingRequest = null;
      }
    } else {
      showToast('Registration failed');
    }
  } catch { showToast('Connection error'); }
  regSubmit.disabled = false;
  regSubmit.textContent = 'SUPASING!';
});

$('regCancel')?.addEventListener('click', () => {
  regModal.classList.remove('open');
  pendingRequest = null;
});

/* ─── Genres ─── */
async function loadGenres() {
  try {
    const res = await fetch(`${API}/genres`);
    const data = await res.json();
    genres = (data.genres || []).map(g => g.genre).filter(Boolean);
  } catch {
    genres = ['Pop', 'Rock', 'Country', 'R&B', 'Jazz', 'Blues', 'Soul'];
  }
  renderGenreChips();
}

function renderGenreChips() {
  genreRow.innerHTML = '';
  const top = genres.slice(0, 8);
  top.forEach(g => {
    const chip = document.createElement('button');
    chip.className = 'genre-chip';
    chip.textContent = g;
    chip.addEventListener('click', () => {
      const siblings = genreRow.querySelectorAll('.genre-chip');
      chip.classList.toggle('active');
      siblings.forEach(c => { if (c !== chip) c.classList.remove('active'); });
      doSearch();
    });
    genreRow.appendChild(chip);
  });
}

/* ─── Charts ─── */
async function loadCharts() {
  content.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const res = await fetch(`${API}/charts?days=30`);
    const data = await res.json();
    renderCharts(data);
  } catch {
    content.innerHTML = '<div class="empty-state"><p>Could not load trending songs.</p></div>';
  }
}

function renderCharts(data) {
  const songs = data.songs || [];
  const artists = data.artists || [];
  if (!songs.length && !artists.length) {
    content.innerHTML = '<div class="empty-state"><p>No requests yet — be the first!</p></div>';
    return;
  }
  let html = '<div class="charts-section">';
  html += '<div class="charts-header">Hot Right Now</div>';
  if (songs.length) {
    html += '<div class="chart-subsection"><h3>Most Requested Songs</h3>';
    songs.slice(0, 10).forEach((s, i) => {
      html += `
        <div class="chart-card" data-artist="${esc(s.artist)}" data-title="${esc(s.title)}">
          <div class="chart-rank">${i + 1}</div>
          <div class="chart-body">
            <div class="chart-title">${esc(s.title)}</div>
            <div class="chart-artist">${esc(s.artist)}</div>
          </div>
          <div class="chart-reqs">${s.requests}x</div>
        </div>`;
    });
    html += '</div>';
  }
  if (artists.length) {
    html += '<div class="chart-subsection"><h3>Top Artists</h3>';
    artists.slice(0, 10).forEach((a, i) => {
      html += `
        <div class="chart-card">
          <div class="chart-rank">${i + 1}</div>
          <div class="chart-body">
            <div class="chart-title">${esc(a.artist)}</div>
          </div>
          <div class="chart-reqs">${a.requests}x</div>
        </div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  content.innerHTML = html;

  // Click chart card to search that song
  content.querySelectorAll('.chart-card[data-artist]').forEach(el => {
    el.addEventListener('click', () => {
      searchInput.value = `${el.dataset.artist} ${el.dataset.title}`;
      doSearch();
      searchInput.focus();
    });
  });
}

/* ─── Search ─── */
function doSearch() {
  const q = searchInput.value.trim();
  const activeGenre = genreRow.querySelector('.genre-chip.active');
  const genre = activeGenre ? activeGenre.textContent : '';

  if (!q && !genre) { loadCharts(); return; }

  content.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';

  const params = new URLSearchParams({ limit: '50' });
  if (q) params.set('q', q);
  if (genre) params.set('genre', genre);

  fetch(`${API}/search?${params}`)
    .then(r => r.json())
    .then(data => {
      const songs = (data.results || []).map(s => ({ ...s, _id: String(s.id) }));
      renderResults(songs);
    })
    .catch(() => {
      content.innerHTML = '<div class="empty-state"><p>Connection error.</p></div>';
    });
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doSearch, 300);
});

searchInput.addEventListener('focus', () => {
  if (!searchInput.value.trim() && !genreRow.querySelector('.chip.active')) {
    // keep showing charts
  }
});

/* ─── Artwork ─── */
async function loadArtwork(artist, title, imgEl) {
  const key = `${artist}|${title}`;
  if (artworkCache.has(key)) {
    const url = artworkCache.get(key);
    if (url) imgEl.src = url;
    return;
  }
  try {
    const res = await fetch(`${API}/artwork?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`);
    const data = await res.json();
    artworkCache.set(key, data.artwork_url || null);
    if (data.artwork_url) imgEl.src = data.artwork_url;
  } catch { /* no artwork */ }
}

/* ─── Render Results ─── */
function renderResults(songs) {
  if (!songs.length) {
    content.innerHTML = '<div class="empty-state"><p>Nothing found — try different words.</p></div>';
    return;
  }
  let html = `<div class="results-count">${songs.length} songs</div>`;
  songs.forEach((song, i) => {
    const sid = song._id;
    const isFav = favouriteIds.has(sid);
    html += `
      <div class="song-card" data-id="${sid}" style="animation-delay:${i * 0.03}s">
        <div class="song-art">
          <img data-artwork="${esc(song.artist)}||${esc(song.title)}" alt="" loading="lazy">
          <svg class="song-art-placeholder" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div class="song-body">
          <div class="song-title">${esc(song.title)}</div>
          <div class="song-artist">${esc(song.artist)}</div>
          ${(song.genre || song.year) ? `<div class="song-meta">${[song.genre, song.year].filter(Boolean).join(' / ')}</div>` : ''}
        </div>
        <div class="song-actions">
          <button class="btn-fav ${isFav ? 'active' : ''}" data-id="${sid}" data-title="${esc(song.title)}" data-artist="${esc(song.artist)}" aria-label="Favourite">
            <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
          <button class="btn-sing" data-action="request" data-id="${sid}" data-title="${esc(song.title)}" data-artist="${esc(song.artist)}">SING</button>
        </div>
      </div>`;
  });
  content.innerHTML = html;

  // Lazy-load artwork
  content.querySelectorAll('img[data-artwork]').forEach(img => {
    const [artist, title] = img.dataset.artwork.split('||');
    loadArtwork(artist, title, img);
  });

  // Request buttons
  content.querySelectorAll('[data-action="request"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      doRequest(btn.dataset.id, btn.dataset.title, btn.dataset.artist, btn);
    });
  });

  // Fav buttons
  content.querySelectorAll('.btn-fav').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavourite(btn.dataset.id, btn.dataset.artist, btn.dataset.title);
    });
  });

  // Click card to search same artist
  content.querySelectorAll('.song-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.btn-fav') || e.target.closest('.btn-sing')) return;
      const artist = card.querySelector('.song-artist')?.textContent;
      if (artist) { searchInput.value = artist; doSearch(); }
    });
  });
}

/* ─── Favourites ─── */
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
    pendingRequest = { songId, artist, title };
    promptSignIn();
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
    showToast('Removed from favourites');
  } else {
    await fetch(`${API}/favourite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ singerName: singer.name, songId, artist, title })
    });
    favouriteIds.add(key);
    showToast('Saved!');
  }
  content.querySelectorAll(`.btn-fav[data-id="${key}"]`).forEach(b => {
    b.classList.toggle('active', favouriteIds.has(key));
    b.querySelector('svg').setAttribute('fill', favouriteIds.has(key) ? 'currentColor' : 'none');
  });
}

/* ─── Request ─── */
async function doRequest(songId, title, artist, btn) {
  if (!singer?.name) {
    pendingRequest = { songId, title, artist };
    promptSignIn();
    return;
  }
  if (btn) { btn.textContent = '...'; btn.disabled = true; }
  await submitRequest(songId, title, artist);
  if (btn) setTimeout(() => { btn.textContent = 'SING'; btn.disabled = false; }, 2000);
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
      showToast(`${title} — you're in the queue!`, 4000);
      if (data.needsProfile) {
        setTimeout(() => showToast('Finish your profile at userdb.oriondevcore.com', 4000), 1500);
      }
    } else {
      showToast('Request failed — ask the DJ', 3000);
    }
  } catch {
    showToast('Could not reach the DJ', 3000);
  }
}

/* ─── History ─── */
let historyLoaded = false;

async function loadHistory() {
  if (!singer?.name) {
    content.innerHTML = '<div class="empty-state"><p>Sign in to see your songs.</p><button class="btn-sing" onclick="promptSignIn()" style="margin-top:16px;padding:14px 32px;font-size:16px">Sign In</button></div>';
    return;
  }
  content.innerHTML = '<div class="spinner-wrap"><div class="spinner"></div></div>';
  try {
    const res = await fetch(`${API}/profile?name=${encodeURIComponent(singer.name)}`);
    const data = await res.json();
    const history = data.history || [];
    renderHistory(history);
  } catch {
    content.innerHTML = '<div class="empty-state"><p>Could not load history.</p></div>';
  }
}

function renderHistory(requests) {
  if (!requests.length) {
    content.innerHTML = '<div class="history-empty"><p>You haven\'t requested any songs yet.</p><button class="btn-sing" onclick="switchTab(\'search\')" style="padding:14px 32px;font-size:16px">Find a Song</button></div>';
    return;
  }
  let html = '<div class="history-section">';
  html += `<div class="results-count">${requests.length} songs</div>`;
  requests.forEach(r => {
    const time = r.created_at ? new Date(r.created_at + 'Z').toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }) : '';
    html += `
      <div class="history-item">
        <div class="history-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="history-body">
          <div class="history-title">${esc(r.title)}</div>
          <div class="history-artist">${esc(r.artist)}</div>
        </div>
        <div class="history-when">${time}</div>
      </div>`;
  });
  html += '</div>';
  content.innerHTML = html;
}

/* ─── Tab switching ─── */
function switchTab(tab) {
  bottomBar.querySelectorAll('.bottom-tab').forEach(t => t.classList.remove('active'));
  const btn = bottomBar.querySelector(`[data-tab="${tab}"]`);
  if (btn) btn.classList.add('active');

  if (tab === 'search') {
    const q = searchInput.value.trim();
    const genre = genreRow.querySelector('.genre-chip.active');
    genreRow.style.display = 'flex';
    searchInput.style.display = 'block';
    if (q || genre) doSearch(); else loadCharts();
  } else if (tab === 'history') {
    genreRow.style.display = 'none';
    searchInput.style.display = 'none';
    loadHistory();
  }
}

bottomBar.querySelectorAll('.bottom-tab[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

/* ─── Escape HTML ─── */
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/* ─── Init ─── */
loadSinger();
updateSingerBadge();
loadGenres();
loadFavourites();
loadCharts();

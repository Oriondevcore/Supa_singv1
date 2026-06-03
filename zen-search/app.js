const API = 'https://supatraxx-api.orion269.workers.dev';

const searchInput = document.getElementById('searchInput');
const resultsEl = document.getElementById('results');
const moodGrid = document.getElementById('moodGrid');
const genreChips = document.getElementById('genreChips');
const genresSection = document.getElementById('genresSection');
const koanEl = document.getElementById('koan');
const aiOrb = document.getElementById('aiOrb');
const aiPanel = document.getElementById('aiPanel');
const aiPanelClose = document.getElementById('aiPanelClose');
const canvas = document.getElementById('particles');
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
    id: 'zen', label: 'Zen',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>',
    search: { genre: 'Jazz' }
  }
];

const KOANS = [
  'The song was already there. You just had to open your mouth.',
  'Every note is a step on a path you have been walking your whole life.',
  'The stage is not a place. It is a moment of becoming.',
  'Your voice does not need to be perfect. It needs to be yours.',
  'A song is a bridge between who you are and who you could be.',
  'The microphone is not a tool. It is an invitation.',
  'Silence is not empty. It is full of songs waiting to be sung.',
  'To sing is to arrive exactly where you are.',
  'The best song is the one you have not sung yet.',
  'In the space between notes, the truth lives.',
  'A wrong note played with confidence is a new melody.',
  'The audience is not watching you. They are watching themselves through you.',
  'Breathe. The song knows where it is going.',
  'You are never more yourself than when you sing someone else words.',
  'The loudest voice is not always the one that is heard.'
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

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function setKoan() {
  koanEl.textContent = pickRandom(KOANS);
}
setKoan();

/* ─── Particles ─── */
function initParticles() {
  const ctx = canvas.getContext('2d');
  let w, h, particles = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COUNT = Math.min(60, Math.floor(w * h / 15000));

  for (let i = 0; i < COUNT; i++) {
    particles.push({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 2 + 0.5,
      dx: (Math.random() - 0.5) * 0.3, dy: -(Math.random() * 0.2 + 0.05),
      opacity: Math.random() * 0.5 + 0.1,
      twinkle: Math.random() * 100, twinkleSpeed: Math.random() * 2 + 1
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      p.x += p.dx; p.y += p.dy;
      p.twinkle += p.twinkleSpeed;
      const o = p.opacity * (0.5 + 0.5 * Math.sin(p.twinkle * 0.02));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 164, 78, ${o})`;
      ctx.fill();
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
    });
    requestAnimationFrame(draw);
  }
  draw();
}
initParticles();

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
      <p>Select a mood above, pick a genre,<br>or search for any song.</p>
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
    resultsEl.innerHTML = '<div class="empty-state"><p>Connection error — check your network and try again.</p></div>';
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
    showToast('Set your Supa-Profile first to save favourites.');
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
    showToast('Removed from your Supa-Faves.');
  } else {
    await fetch(`${API}/favourite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ singerName: singer.name, songId, artist, title })
    });
    favouriteIds.add(key);
    showToast('Saved to your Supa-Faves!');
  }
  // Update heart icons on page
  document.querySelectorAll(`.fav-btn[data-id="${key}"]`).forEach(b => {
    b.classList.toggle('active', favouriteIds.has(key));
  });
}

/* ─── Request Flow ─── */
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
        `"${title}" is in the queue! Listen for your name.`,
        `Supa-choice! "${title}" is heading to the DJ.`,
        `Your jam "${title}" is on its way to the stage.`,
        `"${title}" queued! The mic is calling.`
      ];
      showToast(pickRandom(msgs), 4000);
      if (data.status === 'pending') {
        setTimeout(() => showToast('New to the stage? The DJ will bring you in!', 3500), 1200);
      }
      if (data.needsProfile) {
        setTimeout(() => showToast('Make your profile Supa at userdb.oriondevcore.com', 5000), 2500);
      }
    } else {
      showToast('Request failed. Try again or ask the DJ.', 4000);
    }
  } catch {
    showToast('Could not reach the DJ. Check your connection.', 4000);
  }
}

/* ─── Registration Modal ─── */
regForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = regName.value.trim();
  const whatsapp = regWhatsApp.value.trim();
  if (!name || !whatsapp) {
    showToast('Stage name and WhatsApp are required.');
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
      showToast(`Welcome to the stage, ${name}!`);
      if (pendingRequest) {
        await submitRequest(pendingRequest.songId, pendingRequest.title, pendingRequest.artist);
        pendingRequest = null;
      }
    } else {
      showToast('Registration failed. Try again.');
    }
  } catch {
    showToast('Connection error. Check your network.');
  }
  regSubmit.disabled = false;
  regSubmit.textContent = 'Step into the Spotlight';
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
    resultsEl.innerHTML = '<div class="empty-state"><p>Nothing matched your search. Try a different mood or keyword.</p></div>';
    return;
  }

  let html = `<div class="section-header"><h3>Songs</h3><span>${songs.length} found</span></div>`;
  songs.forEach((song, i) => {
    const moodIcon = MOODS[i % MOODS.length].svg;
    const sid = song._id;
    const isFav = favouriteIds.has(sid);
    html += `
      <div class="song-card" data-id="${sid}" style="animation-delay:${i * 0.04}s">
        <div class="song-card-mood">${moodIcon}</div>
        <div class="song-card-body">
          <div class="song-card-title">${escapeHtml(song.title)}</div>
          <div class="song-card-artist">${escapeHtml(song.artist)}</div>
          ${(song.genre || song.year) ? `<div class="song-card-meta">${[song.genre, song.year].filter(Boolean).join(' / ')}</div>` : ''}
        </div>
        <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${sid}" data-title="${escapeHtml(song.title)}" data-artist="${escapeHtml(song.artist)}" aria-label="Favourite">
          <svg viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <button class="song-card-action" data-action="request" data-id="${sid}" data-title="${escapeHtml(song.title)}" data-artist="${escapeHtml(song.artist)}">
          <span>SUPA-SING!</span>
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

  resultsEl.querySelectorAll('.song-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('[data-action="request"]') || e.target.closest('.fav-btn')) return;
      // Optional: show details or preview
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

/* ─── AI Panel ─── */
aiOrb.addEventListener('click', () => aiPanel.classList.toggle('open'));
aiPanelClose.addEventListener('click', () => aiPanel.classList.remove('open'));

document.getElementById('premiumLink')?.addEventListener('click', e => {
  e.preventDefault();
  aiPanel.classList.add('open');
});

document.querySelector('.premium-btn')?.addEventListener('click', () => {
  showToast('AI Guide is tuning up. Coming soon.');
  aiPanel.classList.remove('open');
});

/* ─── Init ─── */
loadSinger();
updateSingerBadge();
loadFavourites();
showEmpty();

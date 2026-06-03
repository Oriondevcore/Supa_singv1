const API = 'https://supatraxx-api.orion269.workers.dev';

let singerName = null;
let allFaves = [];
let filteredFaves = [];

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

function loadSinger() {
  try {
    const d = JSON.parse(localStorage.getItem('supasing_singer'));
    if (d && d.name) {
      singerName = d.name;
      document.getElementById('singerInput').value = d.stageName || d.name;
    }
  } catch {}
}

async function loadFavourites(name) {
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '<div class="spinner-wrap"><div class="enso-spinner"></div></div>';

  try {
    const res = await fetch(`${API}/favourites?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    allFaves = data.favourites || [];
    filteredFaves = [...allFaves];
    document.getElementById('favCount').textContent = allFaves.length;
    renderFavourites();
  } catch {
    resultsEl.innerHTML = '<div class="empty-state"><p>Could not load favourites. Check your connection.</p></div>';
  }
}

function renderFavourites() {
  const resultsEl = document.getElementById('results');

  if (!filteredFaves.length) {
    const emptyMsg = allFaves.length ? 'No favourites match your filter.' : 'No favourites yet. Tap the heart on any song in Zen Search to save it here.';
    resultsEl.innerHTML = `<div class="empty-state">
      <div class="empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>
      <p>${emptyMsg}</p>
    </div>`;
    return;
  }

  resultsEl.innerHTML = filteredFaves.map(f => `
    <div class="fav-item" data-id="${f.song_id}">
      <div class="fav-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </div>
      <div class="fav-body">
        <div class="fav-title">${escapeHtml(f.title)}</div>
        <div class="fav-artist">${escapeHtml(f.artist)}${f.key_change ? ' (key: ' + f.key_change + ')' : ''}</div>
      </div>
      <div class="fav-actions">
        <button class="fav-sing-btn" data-action="request" data-id="${f.song_id}" data-title="${escapeHtml(f.title)}" data-artist="${escapeHtml(f.artist)}">SING</button>
        <button class="fav-del-btn" data-action="delete" data-id="${f.song_id}" aria-label="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>
  `).join('');

  resultsEl.querySelectorAll('[data-action="request"]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      btn.textContent = '...';
      btn.disabled = true;
      try {
        const res = await fetch(`${API}/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ singerName, songId: parseInt(btn.dataset.id), keyChange: 0 })
        });
        const data = await res.json();
        if (data.success) {
          showToast(`"${btn.dataset.title}" queued!`);
        } else {
          showToast('Request failed.');
        }
      } catch {
        showToast('Connection error.');
      }
      btn.textContent = 'SING';
      btn.disabled = false;
    });
  });

  resultsEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const id = btn.dataset.id;
      try {
        await fetch(`${API}/favourite`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ singerName, songId: parseInt(id) })
        });
        allFaves = allFaves.filter(f => String(f.song_id) !== id);
        filteredFaves = filteredFaves.filter(f => String(f.song_id) !== id);
        document.getElementById('favCount').textContent = allFaves.length;
        renderFavourites();
        showToast('Removed from Supa-Faves.');
      } catch {
        showToast('Failed to remove.');
      }
    });
  });
}

document.getElementById('singerSetBtn').addEventListener('click', () => {
  const name = document.getElementById('singerInput').value.trim();
  if (!name) { showToast('Enter your name.'); return; }
  singerName = name;
  localStorage.setItem('supasing_singer', JSON.stringify({ name, stageName: name }));
  document.getElementById('singerPrompt').style.display = 'none';
  loadFavourites(name);
});

document.getElementById('singerInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('singerSetBtn').click();
});

document.getElementById('searchInput').addEventListener('input', () => {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  if (!q) {
    filteredFaves = [...allFaves];
  } else {
    filteredFaves = allFaves.filter(f =>
      f.title.toLowerCase().includes(q) || f.artist.toLowerCase().includes(q)
    );
  }
  renderFavourites();
});

loadSinger();
if (singerName) {
  document.getElementById('singerPrompt').style.display = 'none';
  loadFavourites(singerName);
}

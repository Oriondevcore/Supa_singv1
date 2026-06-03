const API = 'https://supatraxx-api.orion269.workers.dev';
const SINGER_KEY = 'supasing_singer';
let singer = null;
let profile = null;

const MOODS = [
  { id: 'energetic', label: 'Energetic', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>' },
  { id: 'nostalgic', label: 'Nostalgic', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' },
  { id: 'romantic', label: 'Romantic', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
  { id: 'melancholic', label: 'Melancholic', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>' },
  { id: 'happy', label: 'Happy', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>' },
  { id: 'zen', label: 'Zen', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/></svg>' }
];

const COLORS = ['#c8a44e', '#ff6b35', '#e0526e', '#8b7355', '#6c5b7b', '#5ba3b5', '#39FF14', '#4ecdc4'];

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
    const d = JSON.parse(localStorage.getItem(SINGER_KEY));
    if (d && d.name) singer = d;
  } catch {}
  if (!singer) {
    const name = prompt('Enter your stage name to view your Supa-Profile:');
    if (name && name.trim()) {
      singer = { name: name.trim(), stageName: name.trim() };
    }
  }
}

async function loadProfile() {
  if (!singer?.name) return;
  try {
    const res = await fetch(`${API}/profile?name=${encodeURIComponent(singer.name)}`);
    if (!res.ok) return;
    profile = await res.json();
    renderProfile();
  } catch {}
}

function renderProfile() {
  if (!profile) return;

  document.getElementById('profileName').textContent = profile.stageName || profile.name;
  document.getElementById('profileStage').textContent = profile.name;

  document.getElementById('statPoints').textContent = profile.points || 0;
  document.getElementById('statTokens').textContent = profile.tokens || 0;
  document.getElementById('statRequests').textContent = profile.total_requests || 0;

  renderAvatar();
  renderMilestones();
  renderHistory();
  renderMoodPicker();

  document.getElementById('editName').value = profile.stageName || profile.name;
  document.getElementById('editWhatsApp').value = profile.whatsapp || '';
}

function renderAvatar() {
  const wrap = document.getElementById('avatarIcon');
  const mood = MOODS.find(m => m.id === profile.moodIcon) || MOODS[0];
  wrap.innerHTML = mood.svg;
  wrap.style.color = profile.moodColor || '#c8a44e';
  document.querySelector('.avatar-wrap').style.borderColor = profile.moodColor || '#c8a44e';
}

const MILESTONE_CONFIG = [
  { level: 1, label: 'First Note', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' },
  { level: 5, label: 'Rising Star', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' },
  { level: 10, label: 'Stage Veteran', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3v4h14V3"/><path d="M5 21h14"/><path d="M2 7h20v10H2z"/><path d="M8 7v14"/><path d="M16 7v14"/></svg>' },
  { level: 25, label: 'Mic Master', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>' },
  { level: 50, label: 'Karaoke Legend', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5C7 4 12 7 12 7s5-3 7.5-3a2.5 2.5 0 0 1 0 5H18"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><path d="M12 12v11"/></svg>' },
  { level: 100, label: 'Hall of Fame', svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>' }
];

function renderMilestones() {
  const el = document.getElementById('milestones');
  const reqs = profile.total_requests || 0;
  el.innerHTML = MILESTONE_CONFIG.map(m => {
    const unlocked = reqs >= m.level;
    return `<div class="milestone${unlocked ? ' unlocked' : ''}">
      ${m.svg}<span>${m.label}</span>
    </div>`;
  }).join('');
}

function renderHistory() {
  const el = document.getElementById('historyList');
  if (!profile.history || !profile.history.length) {
    el.innerHTML = '<p class="empty-text">No songs yet. Head to Zen Search and hit Supa-Sing!</p>';
    return;
  }
  el.innerHTML = profile.history.map(h => {
    const status = h.status === 'played' ? 'Performed' : h.status === 'accepted' ? 'Accepted' : h.status === 'pending' ? 'Pending' : 'Requested';
    return `<div class="history-item">
      <div class="history-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div class="history-body">
        <div class="history-title">${escapeHtml(h.title)}</div>
        <div class="history-meta">${escapeHtml(h.artist)} — ${status}${h.key_change ? ' (key: ' + h.key_change + ')' : ''}</div>
      </div>
    </div>`;
  }).join('');
}

function renderMoodPicker() {
  const picker = document.getElementById('moodPicker');
  picker.innerHTML = MOODS.map(m => {
    const active = m.id === profile.moodIcon;
    return `<button class="mood-option${active ? ' active' : ''}" data-mood="${m.id}">
      ${m.svg}<span>${m.label}</span>
    </button>`;
  }).join('') + '<div class="color-options" id="colorOptions"></div>';

  picker.querySelectorAll('.mood-option').forEach(btn => {
    btn.addEventListener('click', () => {
      picker.querySelectorAll('.mood-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      profile.moodIcon = btn.dataset.mood;
      renderAvatar();
      saveMood();
    });
  });

  const colorEl = document.getElementById('colorOptions');
  colorEl.innerHTML = COLORS.map(c => {
    const active = c === profile.moodColor;
    return `<button class="color-dot${active ? ' active' : ''}" style="background:${c}" data-color="${c}"></button>`;
  }).join('');

  colorEl.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      colorEl.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      profile.moodColor = dot.dataset.color;
      renderAvatar();
      saveMood();
    });
  });
}

async function saveMood() {
  try {
    await fetch(`${API}/profile?name=${encodeURIComponent(profile.name)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moodIcon: profile.moodIcon, moodColor: profile.moodColor })
    });
  } catch {}
}

document.getElementById('editForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = document.getElementById('editName').value.trim();
  const whatsapp = document.getElementById('editWhatsApp').value.trim();
  if (!name) {
    showToast('Name is required.');
    return;
  }
  try {
    await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: profile.name, stageName: name, whatsapp })
    });
    profile.stageName = name;
    profile.whatsapp = whatsapp;
    localStorage.setItem(SINGER_KEY, JSON.stringify({ ...singer, stageName: name }));
    document.getElementById('profileName').textContent = name;
    showToast('Profile updated!');
  } catch {
    showToast('Failed to save.');
  }
});

document.getElementById('signOutBtn').addEventListener('click', () => {
  localStorage.removeItem(SINGER_KEY);
  singer = null;
  profile = null;
  showToast('Signed out.');
  setTimeout(() => location.reload(), 800);
});

loadSinger();
if (singer?.name) {
  loadProfile();
} else {
  document.getElementById('profileName').textContent = 'No singer set';
  document.querySelector('.spinner-wrap')?.remove();
}

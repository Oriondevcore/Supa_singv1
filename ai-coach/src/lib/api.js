const API = window.location.origin

export async function chat(message, conversationId = null) {
  const res = await fetch(`${API}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversation_id: conversationId }),
  })
  return res.json()
}

export async function stt(audioBlob) {
  const form = new FormData()
  form.append('audio', audioBlob, 'recording.webm')
  const res = await fetch(`${API}/stt`, { method: 'POST', body: form })
  return res.json()
}

export async function tts(text) {
  const res = await fetch(`${API}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  return res.json()
}

export async function getConversations() {
  const res = await fetch(`${API}/conversations`)
  return res.json()
}

export async function getMessages(conversationId) {
  const res = await fetch(`${API}/messages?conversation_id=${conversationId}`)
  return res.json()
}

export async function newConversation(title = 'New chat') {
  const res = await fetch(`${API}/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return res.json()
}

export async function getKnowledge() {
  const res = await fetch(`${API}/knowledge`)
  return res.json()
}

export async function addKnowledge(key, value, category = 'general') {
  const res = await fetch(`${API}/knowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, category }),
  })
  return res.json()
}

export async function startInterview() {
  const res = await fetch(`${API}/interview`, { method: 'POST' })
  return res.json()
}

export async function continueInterview(answer, sessionId) {
  const res = await fetch(`${API}/interview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer, session_id: sessionId }),
  })
  return res.json()
}

export async function getProfile() {
  const res = await fetch(`${API}/profile`)
  return res.json()
}

export async function updateProfile(data) {
  const res = await fetch(`${API}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function getRecordings() {
  const res = await fetch(`${API}/recordings`)
  return res.json()
}

export async function getRecording(id) {
  const res = await fetch(`${API}/recordings/${id}`)
  return res.json()
}

export async function generateContent(prompt, type = 'social') {
  const res = await fetch(`${API}/content`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, type }),
  })
  return res.json()
}

export async function analyzePractice(audioBlob, title, artist) {
  const form = new FormData()
  form.append('audio', audioBlob, 'practice.webm')
  form.append('title', title)
  form.append('artist', artist)
  const res = await fetch(`${API}/practice/analyze`, { method: 'POST', body: form })
  return res.json()
}

export async function searchSongs(query) {
  const res = await fetch(`${API}/songs/search?q=${encodeURIComponent(query)}&limit=20`)
  return res.json()
}

export async function getMySongs() {
  const res = await fetch(`${API}/my-songs`)
  return res.json()
}

export async function saveSong(songId, artist, title) {
  const res = await fetch(`${API}/my-songs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_id: String(songId), artist, title }),
  })
  return res.json()
}

export async function deleteSong(id) {
  const res = await fetch(`${API}/my-songs/${id}`, { method: 'DELETE' })
  return res.json()
}

export async function uploadSongAudio(songId, audioBlob) {
  const form = new FormData()
  form.append('song_id', String(songId))
  form.append('audio', audioBlob, 'track.webm')
  const res = await fetch(`${API}/my-songs/upload`, { method: 'POST', body: form })
  return res.json()
}

export function getSongPlayUrl(id) {
  return `${API}/my-songs/play/${id}`
}

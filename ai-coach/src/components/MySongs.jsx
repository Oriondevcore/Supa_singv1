import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { searchSongs, getMySongs, saveSong, deleteSong, uploadSongAudio, getSongPlayUrl } from '../lib/api'

const query = signal('')
const results = signal([])
const mySongs = signal([])
const searching = signal(false)
const selectedSong = signal(null)
const uploading = signal({})
const playing = signal(null)

export default function MySongs() {
  useEffect(() => { loadSongs() }, [])

  async function loadSongs() {
    const data = await getMySongs()
    mySongs.value = data.songs || []
  }

  async function search() {
    if (!query.value.trim()) return
    searching.value = true
    results.value = []
    const data = await searchSongs(query.value.trim())
    searching.value = false
    results.value = data.results || []
  }

  async function save(song) {
    const data = await saveSong(song.id, song.artist, song.title)
    if (data.success || data.id) {
      await loadSongs()
      results.value = results.value.filter(r => r.id !== song.id)
    }
  }

  async function remove(id) {
    await deleteSong(id)
    await loadSongs()
  }

  async function upload(songId, file) {
    uploading.value = { ...uploading.value, [songId]: true }
    await uploadSongAudio(songId, file)
    uploading.value = { ...uploading.value, [songId]: false }
    await loadSongs()
  }

  function play(song) {
    playing.value = playing.value === song.id ? null : song.id
  }

  function handleKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); search() }
  }

  return (
    <div class="my-songs-view">
      <div class="my-songs-header">
        <h2>My Songs</h2>
        <p class="my-songs-subtitle">Build your personal songbook — search, save, upload audio, and practice anywhere</p>
      </div>

      <div class="my-songs-search-bar">
        <input
          type="text"
          class="practice-input"
          placeholder="Search for songs in the karaoke library..."
          value={query.value}
          onInput={e => query.value = e.target.value}
          onKeyDown={handleKey}
        />
        <button class="btn-primary" onClick={search} disabled={searching || !query.value.trim()}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {results.value.length > 0 && (
        <div class="search-results-section">
          <h3>Search Results</h3>
          <div class="search-results-list">
            {results.value.map(song => (
              <div class="song-row" key={song.id}>
                <div class="song-row-info">
                  <div class="song-title">{song.title || song.artist}</div>
                  <div class="song-artist">{song.artist}</div>
                </div>
                <button class="btn-secondary" onClick={() => save(song)}>+ Save</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div class="my-songs-section">
        <h3>Your Songbook</h3>
        {mySongs.value.length === 0 && (
          <p class="empty-state">No songs saved yet. Search above and start building your library.</p>
        )}
        {mySongs.value.map(song => (
          <div class="my-song-card" key={song.id}>
            <div class="song-card-header">
              <div class="song-row-info">
                <strong>{song.title}</strong>
                <span class="song-artist">{song.artist}</span>
              </div>
              <div class="song-card-actions">
                <button class="btn-text" onClick={() => remove(song.id)}>Remove</button>
              </div>
            </div>

            <div class="song-card-controls">
              {song.r2_key ? (
                <>
                  <button class="btn-secondary" onClick={() => play(song)}>
                    {playing.value === song.id ? 'Pause' : 'Play'}
                  </button>
                  <span class="song-status">Audio saved</span>
                </>
              ) : (
                <label class="upload-btn">
                  <input
                    type="file"
                    accept="audio/*"
                    hidden
                    onChange={e => {
                      const file = e.target.files[0]
                      if (file) upload(song.id, file)
                    }}
                  />
                  <span class="btn-secondary">
                    {uploading.value[song.id] ? 'Uploading...' : 'Upload Audio'}
                  </span>
                </label>
              )}
            </div>

            {playing.value === song.id && song.r2_key && (
              <audio controls autoplay class="song-player" src={getSongPlayUrl(song.id)}>
                Your browser doesn't support audio playback.
              </audio>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

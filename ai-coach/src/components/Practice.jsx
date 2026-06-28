import { signal } from '@preact/signals'
import { analyzePractice } from '../lib/api'

const urlInput = signal('')
const selectedVideo = signal(null)
const recording = signal(false)
const analyzing = signal(false)
const result = signal(null)
const chunks = signal([])
const error = signal(null)

function extractVideoId(input) {
  const clean = input.trim()
  if (!clean) return null
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const p of patterns) {
    const m = clean.match(p)
    if (m) return m[1]
  }
  return null
}

function loadPlayer(videoId) {
  if (window.YT && window.YT.Player) {
    new YT.Player('youtube-player', {
      videoId,
      height: '100%', width: '100%',
      events: { onReady: () => {} },
    })
  } else {
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0])
    window.onYouTubeIframeAPIReady = () => {
      new YT.Player('youtube-player', {
        videoId,
        height: '100%', width: '100%',
        events: { onReady: () => {} },
      })
    }
  }
}

export default function Practice() {
  function handleSubmit() {
    error.value = null
    const id = extractVideoId(urlInput.value)
    if (!id) {
      error.value = 'Could not find a YouTube video ID. Paste a YouTube link (e.g. https://youtube.com/watch?v=...) or just the video ID.'
      return
    }
    selectedVideo.value = { id }
    result.value = null
    loadPlayer(id)
  }

  function handleKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit() }
  }

  async function startRecording() {
    result.value = null; chunks.value = []
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    mr.ondataavailable = e => { if (e.data.size > 0) chunks.value.push(e.data) }
    mr.onstop = async () => {
      stream.getTracks().forEach(t => t.stop())
      const blob = new Blob(chunks.value, { type: 'audio/webm' })
      if (blob.size < 1000) return
      analyzing.value = true
      const data = await analyzePractice(blob, 'YouTube Track', 'Karaoke')
      analyzing.value = false
      result.value = data
    }
    mr.start()
    recording.value = true
  }

  function stopRecording() {
    recording.value = false
    try { if (window.YT?.Player) YT.stopVideo() } catch {}
  }

  return (
    <div class="practice-view">
      <div class="practice-header">
        <h2>Practice Room</h2>
        <p class="practice-subtitle">Paste a YouTube karaoke link, sing along, and get AI feedback</p>
      </div>

      <div class="practice-search">
        <div class="practice-search-bar">
          <input
            type="text"
            class="practice-input"
            placeholder="Paste a YouTube link (e.g. https://youtube.com/watch?v=dQw4w9WgXcQ)"
            value={urlInput.value}
            onInput={e => urlInput.value = e.target.value}
            onKeyDown={handleKey}
          />
          <button class="btn-primary" onClick={handleSubmit} disabled={!urlInput.value.trim()}>
            Load Video
          </button>
        </div>
        <p class="practice-note">Tip: Search YouTube for "Artist - Song karaoke", copy the URL, and paste it here.</p>
        {error.value && <p class="voice-error">{error.value}</p>}
      </div>

      {selectedVideo.value && (
        <div class="practice-player-area">
          <div class="practice-player">
            <div id="youtube-player"></div>
          </div>

          <div class="practice-controls">
            <div class="practice-actions">
              {!recording.value ? (
                <button class="record-btn" onClick={startRecording} disabled={analyzing.value}>
                  <svg class="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3"/>
                    <path d="M5 10a7 7 0 0 0 14 0"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                  </svg>
                  Sing & Record
                </button>
              ) : (
                <button class="record-btn recording" onClick={stopRecording}>
                  ■ Stop & Analyze
                </button>
              )}
              {analyzing.value && <span class="analyzing">Analyzing your performance...</span>}
            </div>
          </div>

          {result.value && (
            <div class="practice-feedback">
              <h3>AI Feedback</h3>
              {result.value.transcript && (
                <div class="feedback-transcript">
                  <strong>What was heard:</strong>
                  <p>{result.value.transcript}</p>
                </div>
              )}
              {result.value.feedback && (
                <div class="feedback-analysis">
                  {result.value.feedback}
                </div>
              )}
              {!result.value.feedback && !result.value.transcript && (
                <p class="empty-state">No audio could be analyzed. Try recording again.</p>
              )}
            </div>
          )}
        </div>
      )}

      {!selectedVideo.value && (
        <div class="practice-welcome">
          <svg class="practice-welcome-icon" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="32" cy="32" r="28"/>
            <path d="M24 24l16 8-16 8z"/>
          </svg>
          <h3>Ready to practice?</h3>
          <p>Find a karaoke track on YouTube, paste the link above, then sing along and record yourself. The AI coach will analyze your performance and give feedback.</p>
        </div>
      )}
    </div>
  )
}

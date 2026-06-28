import { signal } from '@preact/signals'
import { stt, getRecordings } from '../lib/api'

const recording = signal(false)
const transcribing = signal(false)
const result = signal(null)
const error = signal(null)
const recordings = signal([])
const mediaRecorder = signal(null)
const chunks = signal([])
const stream = signal(null)

export default function VoiceRecorder() {
  async function loadRecordings() {
    const data = await getRecordings()
    recordings.value = data.recordings || []
  }

  async function startRecording() {
    error.value = null
    result.value = null
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.value = s
      const mr = new MediaRecorder(s, { mimeType: 'audio/webm' })
      mediaRecorder.value = mr
      chunks.value = []

      mr.ondataavailable = e => {
        if (e.data.size > 0) chunks.value.push(e.data)
      }

      mr.onstop = async () => {
        stream.value.getTracks().forEach(t => t.stop())
        stream.value = null

        const blob = new Blob(chunks.value, { type: 'audio/webm' })
        if (blob.size < 1000) {
          error.value = 'Recording too short'
          return
        }

        transcribing.value = true
        try {
          const data = await stt(blob)
          if (data.error) {
            error.value = data.error
          } else {
            result.value = data
            loadRecordings()
          }
        } catch (e) {
          error.value = 'Transcription failed'
        }
        transcribing.value = false
      }

      mr.start()
      recording.value = true
    } catch (e) {
      error.value = 'Microphone access denied'
    }
  }

  function stopRecording() {
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
      mediaRecorder.value.stop()
    }
    recording.value = false
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  return (
    <div class="voice-view">
      <div class="voice-header">
        <h2>Voice Recorder</h2>
        <p class="voice-subtitle">Record your voice — get transcription you can copy anywhere</p>
      </div>

      <div class="voice-controls">
        <button
          class={`record-btn ${recording.value ? 'recording' : ''}`}
          onClick={recording.value ? stopRecording : startRecording}
          disabled={transcribing.value}
        >
          <svg class="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="2" width="6" height="12" rx="3"/>
            <path d="M5 10a7 7 0 0 0 14 0"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
          </svg>
          {recording.value ? 'Stop' : 'Record'}
        </button>
        {transcribing.value && <span class="transcribing">Transcribing...</span>}
      </div>

      {error.value && <div class="voice-error">{error.value}</div>}

      {result.value && (
        <div class="voice-result">
          <div class="voice-transcript">
            <h3>Transcription</h3>
            <p>{result.value.text}</p>
            <div class="voice-actions">
              <button class="btn-secondary" onClick={() => copyText(result.value.text)}>Copy Text</button>
            </div>
          </div>
        </div>
      )}

      <div class="voice-recordings">
        <h3>Recent Recordings</h3>
        {recordings.value.length === 0 && <p class="empty-state">No recordings yet</p>}
        {recordings.value.map(r => (
          <div class="recording-item" key={r.id}>
            <div class="recording-info">
              <span class="recording-date">{new Date(r.created_at).toLocaleString()}</span>
              <span class="recording-size">{formatSize(r.size)}</span>
            </div>
            <p class="recording-text">{r.transcript}</p>
            <button class="btn-text" onClick={() => copyText(r.transcript)}>Copy</button>
          </div>
        ))}
      </div>
    </div>
  )
}

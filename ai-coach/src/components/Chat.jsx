import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { chat, getMessages, newConversation, getConversations, stt, tts } from '../lib/api'

const messages = signal([])
const input = signal('')
const loading = signal(false)
const convId = signal(null)
const convList = signal([])
const isRecording = signal(false)
const isTranscribing = signal(false)

export default function Chat() {
  useEffect(() => {
    loadConversations()
  }, [])

  async function loadConversations() {
    const data = await getConversations()
    convList.value = data.conversations || []
  }

  async function send() {
    const text = input.value.trim()
    if (!text || loading.value) return
    input.value = ''
    loading.value = true

    if (!convId.value) {
      const data = await newConversation(text.slice(0, 60))
      convId.value = data.conversation_id
      convList.value = [{ id: data.conversation_id, title: text.slice(0, 60) }, ...convList.value]
    }

    messages.value = [...messages.value, { role: 'user', content: text }]

    const data = await chat(text, convId.value)
    loading.value = false

    if (data.error) {
      messages.value = [...messages.value, { role: 'assistant', content: `Error: ${data.error}` }]
      return
    }

    messages.value = [...messages.value, { role: 'assistant', content: data.reply }]
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks = []

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        
        if (blob.size < 1000) {
          isTranscribing.value = false
          isRecording.value = false
          return
        }

        isTranscribing.value = true
        try {
          const data = await stt(blob)
          if (data.text) {
            input.value = data.text
            // Auto-send after transcription
            await send()
          }
        } catch (e) {
          console.error('STT Error:', e)
        } finally {
          isTranscribing.value = false
          isRecording.value = false
        }
      }

      mediaRecorder._instance = mediaRecorder // store for stop call
      mediaRecorder.start()
      isRecording.value = true
    } catch (e) {
      console.error('Mic Error:', e)
      isRecording.value = false
    }
  }

  function stopRecording() {
    // We need a way to access the mediaRecorder instance. 
    // Since we can't easily attach to a ref in this functional component without a ref,
    // I'll use a global-ish approach for this quick patch.
    // A better way is to use a ref, but let's get it working.
    window.currentMediaRecorder?.stop()
    isRecording.value = false
  }

  // Revised startRecording to handle the instance
  async function startRecordingFixed() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks = []
      window.currentMediaRecorder = mr

      mr.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        if (blob.size < 1000) {
          isTranscribing.value = false
          isRecording.value = false
          return
        }
        isTranscribing.value = true
        try {
          const data = await stt(blob)
          if (data.text) {
            input.value = data.text
            await send()
          }
        } catch (e) {
          console.error('STT Error:', e)
        } finally {
          isTranscribing.value = false
          isRecording.value = false
        }
      }

      mr.start()
      isRecording.value = true
    } catch (e) {
      console.error('Mic Error:', e)
      isRecording.value = false
    }
  }

  async function playTTS(text) {
    try {
      const data = await tts(text)
      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`)
        audio.play()
      }
    } catch (e) {
      console.error('TTS Error:', e)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  async function selectConversation(id) {
    convId.value = id
    const data = await getMessages(id)
    messages.value = data.messages || []
  }

  function newChat() {
    convId.value = null
    messages.value = []
  }

  return (
    <div class="chat-view">
      <div class="chat-header">
        <h2>Chat</h2>
        <button class="btn-secondary" onClick={newChat}>+ New Chat</button>
      </div>

      <div class="chat-messages" ref={el => el && (el.scrollTop = el.scrollHeight)}>
        {messages.value.length === 0 && (
          <div class="chat-welcome">
            <h3>Hey! I'm your AI Coach</h3>
            <p>Ask me anything — brainstorm ideas, get singing tips, research topics, or just chat. I'm here to help with your karaoke journey, content creation, and more.</p>
          </div>
        )}
        {messages.value.map((msg, i) => (
          <div class={`message ${msg.role}`} key={i}>
            <div class="message-content">
              {msg.content}
              {msg.role === 'assistant' && (
                <button class="tts-btn" onClick={() => playTTS(msg.content)} title="Listen">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                </button>
              )}
            </div>
          </div>
        ))}
        {loading.value && (
          <div class="message assistant">
            <div class="message-content thinking">
              <span class="dot-pulse"></span>
            </div>
          </div>
        )}
      </div>

      <div class="chat-input-bar">
        <button 
          class={`mic-btn ${isRecording.value ? 'recording' : ''} ${isTranscribing.value ? 'transcribing' : ''}`}
          onClick={isRecording.value ? () => window.currentMediaRecorder?.stop() : startRecordingFixed}
          disabled={isTranscribing.value}
          title={isRecording.value ? "Stop Recording" : "Speak to Coach"}
        >
          {isRecording.value ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          )}
        </button>

        <textarea
          class="chat-input"
          placeholder={isRecording.value ? "Listening..." : isTranscribing.value ? "Transcribing..." : "Type a message..."}
          value={input.value}
          onInput={e => input.value = e.target.value}
          onKeyDown={handleKey}
          rows="1"
        />
        <button class="btn-primary" onClick={send} disabled={loading.value || !input.value.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}


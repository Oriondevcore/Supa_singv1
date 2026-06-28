import { signal } from '@preact/signals'
import { startInterview, continueInterview } from '../lib/api'

const active = signal(false)
const sessionId = signal(null)
const question = signal('')
const answer = signal('')
const history = signal([])
const loading = signal(false)
const done = signal(false)

export default function InterviewMode() {
  async function begin() {
    loading.value = true
    const data = await startInterview()
    loading.value = false
    if (data.error) return
    active.value = true
    sessionId.value = data.session_id
    question.value = data.question
    history.value = [{ role: 'coach', content: data.question }]
  }

  async function submit() {
    const text = answer.value.trim()
    if (!text || loading.value) return
    loading.value = true
    history.value = [...history.value, { role: 'you', content: text }]
    answer.value = ''

    const data = await continueInterview(text, sessionId.value)
    loading.value = false
    if (data.error) return

    if (data.done) {
      history.value = [...history.value, { role: 'coach', content: data.message }]
      done.value = true
    } else {
      history.value = [...history.value, { role: 'coach', content: data.question }]
      question.value = data.question
    }
  }

  function reset() {
    active.value = false
    sessionId.value = null
    question.value = ''
    answer.value = ''
    history.value = []
    done.value = false
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  if (!active.value) {
    return (
      <div class="interview-view">
        <div class="interview-welcome">
          <h2>Tell Me About You</h2>
          <p>I'll ask you a series of questions to learn about your singing history, goals, preferences, and what makes you tick. This helps me give you better coaching and helps Naledi know you too.</p>
          <ul class="interview-benefits">
            <li>Voice type & range discovery</li>
            <li>Song style preferences</li>
            <li>Personal background & brand</li>
            <li>Goals for karaoke & content</li>
          </ul>
          <button class="btn-primary" onClick={begin}>Start Interview</button>
        </div>
      </div>
    )
  }

  return (
    <div class="interview-view">
      <div class="interview-header">
        <h2>Interview Session</h2>
        {!done.value && <button class="btn-text" onClick={reset}>Reset</button>}
      </div>

      <div class="interview-history">
        {history.value.map((h, i) => (
          <div class={`interview-entry ${h.role}`} key={i}>
            <strong>{h.role === 'coach' ? 'Coach' : 'You'}</strong>
            <p>{h.content}</p>
          </div>
        ))}
        {loading.value && <div class="interview-entry coach"><p>Thinking...</p></div>}
      </div>

      {!done.value && (
        <div class="interview-input-bar">
          <textarea
            class="interview-input"
            placeholder="Your answer..."
            value={answer.value}
            onInput={e => answer.value = e.target.value}
            onKeyDown={handleKey}
            rows="2"
          />
          <button class="btn-primary" onClick={submit} disabled={loading.value || !answer.value.trim()}>Submit</button>
        </div>
      )}

      {done.value && (
        <div class="interview-done">
          <button class="btn-primary" onClick={reset}>Start Over</button>
        </div>
      )}
    </div>
  )
}

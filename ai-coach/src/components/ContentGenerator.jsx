import { signal } from '@preact/signals'
import { generateContent } from '../lib/api'

const prompt = signal('')
const type = signal('social')
const loading = signal(false)
const result = signal(null)

export default function ContentGenerator() {
  async function generate() {
    if (!prompt.value.trim() || loading.value) return
    loading.value = true
    result.value = null
    const data = await generateContent(prompt.value.trim(), type.value)
    loading.value = false
    if (data.error) return
    result.value = data.content
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text) }
    catch {
      const ta = document.createElement('textarea')
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove()
    }
  }

  return (
    <div class="content-view">
      <div class="content-header">
        <h2>Content Generator</h2>
        <p class="content-subtitle">Brainstorm ads, social posts, promos, and brand copy</p>
      </div>

      <div class="content-form">
        <div class="content-type-selector">
          <label>Content type:</label>
          <select value={type.value} onChange={e => type.value = e.target.value}>
            <option value="social">Social Media Post</option>
            <option value="ad">Advertisement</option>
            <option value="promo">Promotion</option>
            <option value="email">Email / Newsletter</option>
            <option value="tagline">Tagline / Slogan</option>
          </select>
        </div>
        <textarea
          class="content-prompt"
          placeholder="Describe what you want to promote or create..."
          value={prompt.value}
          onInput={e => prompt.value = e.target.value}
          rows="4"
        />
        <button class="btn-primary" onClick={generate} disabled={loading.value || !prompt.value.trim()}>
          {loading.value ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {result.value && (
        <div class="content-result">
          <h3>Result</h3>
          <div class="content-output">{result.value}</div>
          <button class="btn-secondary" onClick={() => copyText(result.value)}>Copy</button>
        </div>
      )}
    </div>
  )
}

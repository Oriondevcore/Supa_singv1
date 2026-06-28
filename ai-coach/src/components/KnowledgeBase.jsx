import { signal } from '@preact/signals'
import { useEffect } from 'preact/hooks'
import { getKnowledge, addKnowledge } from '../lib/api'

const entries = signal([])
const key = signal('')
const value = signal('')
const category = signal('general')
const loading = signal(false)

export default function KnowledgeBase() {
  useEffect(() => { load() }, [])

  async function load() {
    const data = await getKnowledge()
    entries.value = data.entries || []
  }

  async function save() {
    if (!key.value.trim() || !value.value.trim()) return
    loading.value = true
    await addKnowledge(key.value.trim(), value.value.trim(), category.value)
    key.value = ''
    value.value = ''
    category.value = 'general'
    loading.value = false
    load()
  }

  const cats = entries.value.reduce((acc, e) => {
    const c = e.category || 'general'
    if (!acc[c]) acc[c] = []
    acc[c].push(e)
    return acc
  }, {})

  return (
    <div class="knowledge-view">
      <div class="knowledge-header">
        <h2>Knowledge Base</h2>
        <p class="knowledge-subtitle">Things I know about you — stored for coaching & Naledi</p>
      </div>

      <div class="knowledge-add">
        <h3>Add a fact</h3>
        <div class="knowledge-form">
          <select value={category.value} onChange={e => category.value = e.target.value}>
            <option value="general">General</option>
            <option value="voice">Voice</option>
            <option value="style">Style & Preferences</option>
            <option value="background">Background</option>
            <option value="goals">Goals</option>
            <option value="brand">Brand & Content</option>
          </select>
          <input
            type="text"
            placeholder="Key (e.g. voice_type)"
            value={key.value}
            onInput={e => key.value = e.target.value}
          />
          <textarea
            placeholder="Value"
            value={value.value}
            onInput={e => value.value = e.target.value}
            rows="2"
          />
          <button class="btn-primary" onClick={save} disabled={loading.value || !key.value.trim() || !value.value.trim()}>
            Save
          </button>
        </div>
      </div>

      <div class="knowledge-list">
        <h3>What I know</h3>
        {Object.keys(entries.value).length === 0 && <p class="empty-state">No knowledge yet. Do an interview or add facts manually.</p>}
        {Object.entries(cats).map(([cat, items]) => (
          <div class="knowledge-category" key={cat}>
            <h4 class="cat-title">{cat}</h4>
            {items.map((item, i) => (
              <div class="knowledge-entry" key={i}>
                <strong>{item.key}</strong>
                <p>{item.value}</p>
                <span class="entry-date">{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

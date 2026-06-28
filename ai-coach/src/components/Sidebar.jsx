const NAV = [
  { id: 'chat', label: 'Chat', svg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>' },
  { id: 'voice', label: 'Voice', svg: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/>' },
  { id: 'practice', label: 'Practice', svg: '<path d="M10 8v3a1 1 0 0 1-1 1H6"/><circle cx="12" cy="12" r="10"/><path d="M16.5 7.5L13 11"/><path d="M13 11l4 4"/>' },
  { id: 'mysongs', label: 'My Songs', svg: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' },
  { id: 'interview', label: 'Interview', svg: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>' },
  { id: 'knowledge', label: 'Knowledge', svg: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="9" y1="9" x2="15" y2="9"/>' },
  { id: 'content', label: 'Content', svg: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' },
]

export default function Sidebar({ current, onNavigate }) {
  return (
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1 class="sidebar-logo">AI Coach</h1>
        <p class="sidebar-tagline">Your personal singing & creative coach</p>
      </div>
      <nav class="sidebar-nav">
        {NAV.map(item => (
          <button
            class={`nav-item ${current.value === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              dangerouslySetInnerHTML={{ __html: item.svg }}
            />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}

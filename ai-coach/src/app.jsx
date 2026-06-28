import { signal, computed } from '@preact/signals'
import Chat from './components/Chat'
import VoiceRecorder from './components/VoiceRecorder'
import Practice from './components/Practice'
import MySongs from './components/MySongs'
import InterviewMode from './components/InterviewMode'
import KnowledgeBase from './components/KnowledgeBase'
import ContentGenerator from './components/ContentGenerator'
import Sidebar from './components/Sidebar'

const page = signal('chat')

export default function App() {
  return (
    <div class="app-layout">
      <Sidebar current={page} onNavigate={v => page.value = v} />
      <main class="main-area">
        {page.value === 'chat' && <Chat />}
        {page.value === 'voice' && <VoiceRecorder />}
        {page.value === 'practice' && <Practice />}
        {page.value === 'mysongs' && <MySongs />}
        {page.value === 'interview' && <InterviewMode />}
        {page.value === 'knowledge' && <KnowledgeBase />}
        {page.value === 'content' && <ContentGenerator />}
      </main>
    </div>
  )
}

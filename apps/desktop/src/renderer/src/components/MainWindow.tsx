import { useEffect, useRef, useState } from 'react'
import type { LunaSnapshot, TranscriptItem } from '../../../shared/luna'
import { MemoryView, Reply, SettingsView } from './PanelView'

type Nav = 'chat' | 'memory' | 'settings'

/** Полноценное окно: боковое меню, лента чата, память и настройки. */
export default function MainWindow() {
  const [nav, setNav] = useState<Nav>('chat')
  const [snapshot, setSnapshot] = useState<LunaSnapshot | null>(null)

  useEffect(() => {
    void window.luna.getSnapshot().then(setSnapshot)
    return window.luna.onSnapshot(setSnapshot)
  }, [])

  const items: { id: Nav; label: string }[] = [
    { id: 'chat', label: 'Чат' },
    { id: 'memory', label: 'Память и задачи' },
    { id: 'settings', label: 'Настройки' }
  ]

  return (
    <div className="mw">
      <aside className="mw-side">
        <div className="mw-brand">Луна</div>
        <nav className="mw-nav" aria-label="Разделы">
          {items.map((it) => (
            <button key={it.id} className={nav === it.id ? 'on' : ''} onClick={() => setNav(it.id)} aria-current={nav === it.id}>
              {it.label}
            </button>
          ))}
        </nav>
        <div className="mw-foot">
          <span className={`dot ${snapshot?.fullAccess ? 'full' : ''}`} />
          {snapshot?.fullAccess ? 'Полный доступ включён' : `Режим: ${snapshot?.mode === 'observe' ? 'наблюдать' : 'помогать'}`}
        </div>
      </aside>
      <section className="mw-main">
        {nav === 'chat' && <ChatPane />}
        {nav === 'memory' && (
          <div className="mw-pane">
            <MemoryView />
          </div>
        )}
        {nav === 'settings' && (
          <div className="mw-pane">
            <SettingsView />
          </div>
        )}
      </section>
    </div>
  )
}

/** Лента диалога и поле ввода. Подтверждения действий показываются в маленькой панели. */
function ChatPane() {
  const [items, setItems] = useState<TranscriptItem[]>([])
  const [text, setText] = useState('')
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void window.luna.getTranscript().then(setItems)
    return window.luna.onTranscript(setItems)
  }, [])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [items])

  const send = (): void => {
    if (!text.trim()) return
    window.luna.submit(text)
    setText('')
  }

  return (
    <div className="chat">
      <div className="feed" ref={feedRef}>
        {items.length === 0 && <div className="empty">Напишите Луне. Вся переписка видна здесь, пока приложение открыто.</div>}
        {items.map((it) => (
          <div key={it.id} className={`msg ${it.role}`}>
            {it.role === 'assistant' ? <Reply text={it.text} /> : it.text}
          </div>
        ))}
      </div>
      <div className="composer-row">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Спросите Луну или дайте задачу…"
          aria-label="Сообщение Луне"
        />
        <button className="send" onClick={send} disabled={!text.trim()}>
          Отправить
        </button>
      </div>
    </div>
  )
}

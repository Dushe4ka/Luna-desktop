import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { LunaSnapshot, MenuActionId, PanelView as View } from '../../../shared/luna'

const MENU_ITEMS: { id: MenuActionId; label: string; hint?: string; danger?: boolean }[] = [
  { id: 'history', label: 'История сообщений', hint: '⌘H' },
  { id: 'text', label: 'Написать текстом', hint: '⌘T' },
  { id: 'listen', label: 'Слушать', hint: '⌥Space' },
  { id: 'mode', label: 'Режим' },
  { id: 'settings', label: 'Настройки', hint: '⌘,' },
  { id: 'pause', label: 'Пауза' },
  { id: 'quit', label: 'Выйти из Луны', hint: '⌘Q', danger: true }
]

const MODE_LABELS: Record<LunaSnapshot['mode'], string> = {
  observe: 'Наблюдать',
  assist: 'Помогать',
  autopilot: 'Авто'
}

/** Панель, которую открывают от значка: меню (правый клик) или ввод (клик). */
export default function PanelView() {
  const [view, setView] = useState<View>('input')
  const [snapshot, setSnapshot] = useState<LunaSnapshot | null>(null)

  useEffect(() => {
    void window.luna.getSnapshot().then(setSnapshot)
    const offSnapshot = window.luna.onSnapshot(setSnapshot)
    const offView = window.luna.onPanelView(setView)
    return () => {
      offSnapshot()
      offView()
    }
  }, [])

  // Esc закрывает панель в любом виде.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape') window.luna.hidePanel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="panel">
      {view === 'menu' ? (
        <GlassMenu mode={snapshot?.mode ?? 'assist'} />
      ) : (
        <InputPanel reply={snapshot?.reply ?? null} state={snapshot?.state ?? 'idle'} />
      )}
    </div>
  )
}

function GlassMenu({ mode }: { mode: LunaSnapshot["mode"] }) {
  return (
    <div className="menu" role="menu">
      <div className="menu-head">
        <span>Луна</span>
        <b>{MODE_LABELS[mode]}</b>
      </div>
      {MENU_ITEMS.map((item, i) => (
        <div key={item.id}>
          {item.id === 'pause' && <div className="menu-sep" />}
          <button
            role="menuitem"
            className={`menu-row${item.danger ? ' danger' : ''}`}
            style={{ animationDelay: `${i * 30}ms` }}
            onClick={() => window.luna.action(item.id)}
          >
            <span className="menu-dot" aria-hidden="true" />
            <span className="menu-label">
              {item.id === 'mode' ? `Режим: ${MODE_LABELS[mode]}` : item.label}
            </span>
            {item.hint && <kbd>{item.hint}</kbd>}
          </button>
        </div>
      ))}
    </div>
  )
}

function InputPanel({ reply, state }: { reply: string | null; state: LunaSnapshot['state'] }) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const send = (): void => {
    if (!text.trim()) return
    window.luna.submit(text)
    setText('')
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') send()
  }

  return (
    <div className="input">
      <div className="input-head">
        <span className="eyebrow">Луна · {state === 'thinking' ? 'думаю' : 'текст'}</span>
      </div>
      <div className="reply" aria-live="polite">
        {reply ? reply : <span className="muted">Напишите запрос. Голос подключим позже.</span>}
      </div>
      <div className="composer">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Спросите Луну…"
          aria-label="Запрос Луне"
        />
        <button className="send" onClick={send} disabled={!text.trim()} aria-label="Отправить">
          ↵
        </button>
      </div>
    </div>
  )
}

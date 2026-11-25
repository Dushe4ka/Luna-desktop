import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { LunaSnapshot, MemorySnapshot, MenuActionId, PanelView as View } from '../../../shared/luna'

const MENU_ITEMS: { id: MenuActionId; label: string; hint?: string; danger?: boolean }[] = [
  { id: 'history', label: 'Память и задачи', hint: '⌘H' },
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
      {view === 'menu' && <GlassMenu mode={snapshot?.mode ?? 'assist'} />}
      {view === 'memory' && <MemoryView />}
      {view === 'input' && (
        <InputPanel
          reply={snapshot?.reply ?? null}
          state={snapshot?.state ?? 'idle'}
          screenNote={snapshot?.screenNote ?? null}
          approval={snapshot?.approval ?? null}
        />
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

function InputPanel({
  reply,
  state,
  screenNote,
  approval
}: {
  reply: string | null
  state: LunaSnapshot['state']
  screenNote: string | null
  approval: LunaSnapshot['approval']
}) {
  const busy = state === 'thinking' || state === 'acting' || state === 'approval'
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
        {busy && (
          <button className="stop" onClick={() => window.luna.stop()}>
            Стоп
          </button>
        )}
      </div>
      {screenNote && <div className="screen-note">{screenNote}</div>}
      {approval && (
        <div className="approval" role="alertdialog" aria-label="Подтверждение действия">
          <div className="approval-text">Луна хочет: {approval.description}</div>
          <div className="approval-actions">
            <button
              className="deny"
              autoFocus
              onClick={() => window.luna.decide(approval.id, false)}
            >
              Отклонить
            </button>
            <button className="allow" onClick={() => window.luna.decide(approval.id, true)}>
              Разрешить
            </button>
          </div>
        </div>
      )}
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

/** Экран «Память и задачи»: задачи со статусами и записи памяти, с удалением. */
function MemoryView() {
  const [data, setData] = useState<MemorySnapshot>({ tasks: [], memories: [] })

  const load = (): void => {
    void window.luna.listMemory().then(setData)
  }
  useEffect(load, [])

  const remove = (kind: 'task' | 'memory', id: string | number): void => {
    window.luna.deleteMemory(kind, String(id))
    setTimeout(load, 120)
  }

  return (
    <div className="menu memory" role="region" aria-label="Память и задачи">
      <div className="menu-head">
        <span>Задачи</span>
      </div>
      <div className="memory-list">
        {data.tasks.length === 0 && <div className="muted">Задач пока нет.</div>}
        {data.tasks.map((t) => (
          <div className="memory-row" key={t.id}>
            <div className="memory-main">
              <div>{t.title}</div>
              <div className="memory-meta">
                {t.status}
                {t.due ? `, срок ${t.due}` : ''}
                {t.summary ? ` · ${t.summary}` : ''}
              </div>
            </div>
            <button className="forget" onClick={() => remove('task', t.id)} aria-label={`Удалить задачу ${t.title}`}>
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="menu-head">
        <span>Память</span>
      </div>
      <div className="memory-list">
        {data.memories.length === 0 && <div className="muted">Пока пусто.</div>}
        {data.memories.map((m) => (
          <div className="memory-row" key={m.id}>
            <div className="memory-main">
              <div>{m.content}</div>
              <div className="memory-meta">
                {m.layer} · {m.source === 'explicit' ? 'вы попросили' : 'предложено'}
              </div>
            </div>
            <button className="forget" onClick={() => remove('memory', m.id)} aria-label={`Забыть: ${m.content}`}>
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

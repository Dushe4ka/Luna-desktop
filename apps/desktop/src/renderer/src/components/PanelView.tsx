import { useEffect, useRef, useState, type KeyboardEvent, type ReactElement } from 'react'
import type { LunaSnapshot, MemorySnapshot, MenuActionId, PanelView as View, SettingsData } from '../../../shared/luna'

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
  assist: 'Помогать'
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
      {view === 'settings' && <SettingsView />}
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
        {reply ? <Reply text={reply} /> : <span className="muted">Напишите запрос. Голос подключим позже.</span>}
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

const MODE_OPTIONS: { value: SettingsData['mode']; label: string }[] = [
  { value: 'observe', label: 'Наблюдать (только чтение)' },
  { value: 'assist', label: 'Помогать' }
]

const LEVEL_OPTIONS: { value: SettingsData['accessLevel']; label: string; hint: string }[] = [
  { value: 'ask', label: 'Спрашивать всегда', hint: 'Любое действие ждёт вашего «да».' },
  { value: 'safe', label: 'Безопасные без вопросов', hint: 'Заметки и задачи без вопросов; действия на компьютере — с вопросом.' },
  { value: 'allowlist', label: 'По списку', hint: 'Без вопросов только то, что вы добавили в список ниже.' },
  { value: 'full', label: 'Полный доступ', hint: 'Ничего не спрашивает, в том числе отправку сообщений и снимки окон, пока вы не отключите.' }
]

/** Экран настроек: модель, Obsidian, исключённые приложения, режим и ключ OpenAI. */
function SettingsView() {
  const [data, setData] = useState<SettingsData | null>(null)
  const [status, setStatus] = useState<string>('')
  const [excludedDraft, setExcludedDraft] = useState('')
  const [keyDraft, setKeyDraft] = useState('')
  const [consentFull, setConsentFull] = useState(false)
  const [ruleDraft, setRuleDraft] = useState('')

  useEffect(() => {
    void window.luna.getSettings().then(setData)
  }, [])

  if (!data) return <div className="menu" />

  const save = async (patch: Partial<Omit<SettingsData, 'hasOpenAIKey'>> & { confirmFull?: boolean }): Promise<void> => {
    const next = await window.luna.saveSettings(patch)
    setData(next)
    setStatus(next.accessLevel === 'full' ? 'Полный доступ включён' : 'Сохранено')
  }

  const chooseLevel = (level: SettingsData['accessLevel']): void => {
    if (level === 'full' && data.accessLevel !== 'full') {
      // Без галочки согласия полный доступ не включаем.
      if (!consentFull) {
        setStatus('Поставьте галочку согласия, чтобы включить полный доступ')
        return
      }
      void save({ accessLevel: 'full', confirmFull: true })
      return
    }
    void save({ accessLevel: level })
  }

  const saveKey = async (): Promise<void> => {
    const ok = await window.luna.saveOpenAIKey(keyDraft)
    setKeyDraft('')
    setStatus(ok ? 'Ключ сохранён в Keychain' : 'Ключ не похож на ключ OpenAI (начинается с sk-)')
    void window.luna.getSettings().then(setData)
  }

  return (
    <div className="menu settings" role="region" aria-label="Настройки">
      <div className="menu-head">
        <span>Настройки</span>
        <b>{status}</b>
      </div>
      <div className="settings-body">
        <div className="field">
          <span>Пол Луны (голоса выберем позже)</span>
          <select value={data.persona} onChange={(e) => void save({ persona: e.target.value as SettingsData['persona'] })}>
            <option value="female">Женский</option>
            <option value="male">Мужской</option>
          </select>
        </div>
        <label className="field">
          <span>Модель</span>
          <select
            value={data.provider}
            onChange={(e) => {
              const provider = e.target.value as SettingsData['provider']
              // При смене провайдера подставляем его модель по умолчанию.
              void save({ provider, model: provider === 'ollama' ? 'qwen3-vl:8b' : 'gpt-4.1-mini' })
            }}
          >
            <option value="openai">OpenAI (облако)</option>
            <option value="ollama">Ollama (на этом Mac)</option>
          </select>
        </label>
        <label className="field">
          <span>Название модели</span>
          <input
            key={`${data.provider}-${data.model}`}
            defaultValue={data.model}
            onBlur={(e) => e.target.value !== data.model && void save({ model: e.target.value })}
          />
        </label>
        <div className="field">
          <span>Ключ OpenAI</span>
          <div className="row-inline">
            <input
              type="password"
              placeholder={data.hasOpenAIKey ? 'Ключ сохранён — введите новый, чтобы заменить' : 'Вставьте ключ sk-…'}
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              autoComplete="off"
            />
            <button onClick={() => void saveKey()} disabled={!keyDraft.trim()}>
              Сохранить
            </button>
          </div>
        </div>
        <label className="field">
          <span>Папка Obsidian (зеркало памяти)</span>
          <input
            defaultValue={data.vaultDir}
            onBlur={(e) => e.target.value !== data.vaultDir && void save({ vaultDir: e.target.value })}
          />
        </label>
        <label className="field">
          <span>Режим</span>
          <select value={data.mode} onChange={(e) => void save({ mode: e.target.value as SettingsData['mode'] })}>
            {MODE_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Уровень доступа</span>
          <select value={data.accessLevel} onChange={(e) => chooseLevel(e.target.value as SettingsData['accessLevel'])}>
            {LEVEL_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <span className="hint">{LEVEL_OPTIONS.find((l) => l.value === data.accessLevel)?.hint}</span>
          {data.accessLevel !== 'full' && (
            <label className="consent">
              <input type="checkbox" checked={consentFull} onChange={(e) => setConsentFull(e.target.checked)} />
              Я понимаю: при полном доступе Луна ничего не спрашивает. Она открывает приложения, вводит текст, нажимает клавиши, в том числе отправляет сообщения, и отдаёт снимки окон в облачную модель, пока я не отключу это.
            </label>
          )}
          {data.accessLevel === 'full' && <div className="warn">Полный доступ включён. Значок показывает это постоянно.</div>}
        </div>
        {data.accessLevel === 'allowlist' && (
          <div className="field">
            <span>Разрешённые без вопросов (инструмент:приложение)</span>
            <div className="chips">
              {data.allowlist.map((rule) => (
                <button
                  key={rule}
                  className="chip"
                  onClick={() => void save({ allowlist: data.allowlist.filter((r) => r !== rule) })}
                  aria-label={`Убрать правило ${rule}`}
                >
                  {rule} ×
                </button>
              ))}
            </div>
            <div className="row-inline">
              <input
                placeholder="open_app:Calculator"
                value={ruleDraft}
                onChange={(e) => setRuleDraft(e.target.value)}
              />
              <button
                onClick={() => {
                  const rule = ruleDraft.trim()
                  if (/^[a-z_]+:.+$/.test(rule)) void save({ allowlist: [...data.allowlist, rule] })
                  setRuleDraft('')
                }}
                disabled={!ruleDraft.trim()}
              >
                Добавить
              </button>
            </div>
          </div>
        )}
        <div className="field">
          <span>Не читать и не снимать</span>
          <div className="chips">
            {data.excludedApps.map((app) => (
              <button
                key={app}
                className="chip"
                onClick={() => void save({ excludedApps: data.excludedApps.filter((a) => a !== app) })}
                aria-label={`Убрать ${app} из исключений`}
              >
                {app} ×
              </button>
            ))}
          </div>
          <div className="row-inline">
            <input
              placeholder="Название приложения"
              value={excludedDraft}
              onChange={(e) => setExcludedDraft(e.target.value)}
            />
            <button
              onClick={() => {
                const name = excludedDraft.trim()
                if (name) void save({ excludedApps: [...data.excludedApps, name] })
                setExcludedDraft('')
              }}
              disabled={!excludedDraft.trim()}
            >
              Добавить
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Ответ: абзацы, списки из строк «- », жирный текст, блоки кода. Без сторонних библиотек. */
function Reply({ text }: { text: string }) {
  const blocks: ReactElement[] = []
  const lines = text.split('\n')
  let list: string[] = []
  let key = 0
  const flush = (): void => {
    if (list.length) {
      blocks.push(
        <ul className="reply-list" key={`l${key++}`}>
          {list.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>
      )
      list = []
    }
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    if (/^\s*[-•*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-•*]\s+/, ''))
      continue
    }
    flush()
    if (line.trim() === '') continue
    blocks.push(<p key={`p${key++}`}>{inline(line)}</p>)
  }
  flush()
  return <div className="reply-body">{blocks}</div>
}

/** **жирный** и `код` внутри строки. */
function inline(text: string): ReactElement {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

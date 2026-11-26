// Общие типы и имена каналов IPC между главным процессом, мостом (preload) и интерфейсом.
// Не содержит ни одного секрета и не зависит от Electron.

/** Состояние значка Луны. */
export type OrbState = 'idle' | 'listening' | 'thinking' | 'acting' | 'approval' | 'error' | 'paused'

/** Что показывает панель, которая открывается от значка. */
export type PanelView = 'menu' | 'input' | 'memory' | 'settings'

/** Сообщение в ленте полного окна. */
export interface TranscriptItem {
  id: number
  role: 'user' | 'assistant'
  text: string
  ts: string
}

/** Настройки для экрана. Ключ отдаём только признаком «сохранён». */
export interface SettingsData {
  provider: string
  model: string
  baseURL: string
  searchProvider: 'wikipedia' | 'searxng' | 'openai'
  searxngURL: string
  vaultDir: string
  excludedApps: string[]
  mode: 'observe' | 'assist'
  accessLevel: 'ask' | 'safe' | 'allowlist' | 'full'
  persona: 'female' | 'male'
  allowlist: string[]
  hasOpenAIKey: boolean
  /** Ключ сохранён для выбранного провайдера. */
  hasKey: boolean
}

/** Режимы доступа из спеки (§6). В фазе 1 это только переключатель отображения. */
export type AssistantMode = 'observe' | 'assist'

/** Действия из стеклянного меню. */
export type MenuActionId = 'history' | 'text' | 'listen' | 'mode' | 'settings' | 'pause' | 'quit' | 'window'

/** Задача и запись памяти для экрана «Память и задачи». */
export interface TaskItem {
  id: string
  title: string
  status: 'active' | 'waiting' | 'done' | 'postponed'
  due: string | null
  summary: string
  updatedAt: string
}

export interface MemoryItem {
  id: number
  layer: 'profile' | 'pattern' | 'fact'
  content: string
  source: 'explicit' | 'proposed'
  createdAt: string
}

export interface MemorySnapshot {
  tasks: TaskItem[]
  memories: MemoryItem[]
}

export interface LunaSnapshot {
  state: OrbState
  mode: AssistantMode
  /** Последний ответ Луны (в фазе 1 — заглушка, пока не подключена модель). */
  reply: string | null
  /** Полный доступ включён (показываем на значке). */
  fullAccess: boolean
  /** Что прочитано с экрана для последнего запроса, или почему не прочитано. */
  screenNote: string | null
  /** Действие, которое ждёт решения пользователя, или null. */
  approval: { id: string; description: string } | null
}

export const IPC = {
  snapshot: 'luna:snapshot',
  state: 'luna:state',
  panelView: 'luna:panel-view',
  openPanel: 'luna:open-panel',
  hidePanel: 'luna:hide-panel',
  action: 'luna:action',
  submit: 'luna:submit',
  dragBy: 'luna:drag-by',
  stop: 'luna:stop',
  decide: 'luna:decide',
  memoryList: 'luna:memory-list',
  memoryDelete: 'luna:memory-delete',
  settingsGet: 'luna:settings-get',
  settingsSave: 'luna:settings-save',
  settingsKey: 'luna:settings-key',
  settingsProviderKey: 'luna:settings-provider-key',
  settingsTest: 'luna:settings-test',
  settingsHasKey: 'luna:settings-has-key',
  transcriptGet: 'luna:transcript-get',
  transcript: 'luna:transcript'
} as const

/** API, который мост открывает интерфейсу через window.luna. */
export interface LunaAPI {
  getSnapshot(): Promise<LunaSnapshot>
  onSnapshot(callback: (snapshot: LunaSnapshot) => void): () => void
  onPanelView(callback: (view: PanelView) => void): () => void
  openPanel(view: PanelView): void
  hidePanel(): void
  action(id: MenuActionId): void
  submit(text: string): void
  dragBy(dx: number, dy: number): void
  stop(): void
  decide(id: string, allow: boolean): void
  listMemory(): Promise<MemorySnapshot>
  deleteMemory(kind: 'task' | 'memory', id: string): void
  getSettings(): Promise<SettingsData>
  getTranscript(): Promise<TranscriptItem[]>
  onTranscript(callback: (items: TranscriptItem[]) => void): () => void
  saveSettings(patch: Partial<Omit<SettingsData, 'hasOpenAIKey'>> & { confirmFull?: boolean }): Promise<SettingsData>
  saveOpenAIKey(value: string): Promise<boolean>
  saveProviderKey(providerId: string, value: string): Promise<boolean>
  hasProviderKey(providerId: string): Promise<boolean>
  testProvider(): Promise<{ ok: boolean; message: string }>
}

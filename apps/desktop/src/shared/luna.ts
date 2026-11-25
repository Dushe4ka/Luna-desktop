// Общие типы и имена каналов IPC между главным процессом, мостом (preload) и интерфейсом.
// Не содержит ни одного секрета и не зависит от Electron.

/** Состояние значка Луны. */
export type OrbState = 'idle' | 'listening' | 'thinking' | 'acting' | 'approval' | 'error' | 'paused'

/** Что показывает панель, которая открывается от значка. */
export type PanelView = 'menu' | 'input'

/** Режимы доступа из спеки (§6). В фазе 1 это только переключатель отображения. */
export type AssistantMode = 'observe' | 'assist' | 'autopilot'

/** Действия из стеклянного меню. */
export type MenuActionId = 'history' | 'text' | 'listen' | 'mode' | 'settings' | 'pause' | 'quit'

export interface LunaSnapshot {
  state: OrbState
  mode: AssistantMode
  /** Последний ответ Луны (в фазе 1 — заглушка, пока не подключена модель). */
  reply: string | null
}

export const IPC = {
  snapshot: 'luna:snapshot',
  state: 'luna:state',
  panelView: 'luna:panel-view',
  openPanel: 'luna:open-panel',
  hidePanel: 'luna:hide-panel',
  action: 'luna:action',
  submit: 'luna:submit',
  dragBy: 'luna:drag-by'
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
}

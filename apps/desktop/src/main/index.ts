import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import {
  allWindows,
  createOrbWindow,
  createPanelWindow,
  dragBy,
  hidePanel,
  isPanelVisible,
  showPanel
} from './windows'
import {
  IPC,
  type AssistantMode,
  type LunaSnapshot,
  type MenuActionId,
  type OrbState
} from '../shared/luna'
import {
  createProvider,
  pickRole,
  readProviderConfig,
  runTurn,
  type ChatMessage,
  type ModelProvider
} from './agent'

/** Горячая клавиша открытия ввода. В Electron это Option+Space на macOS. */
const HOTKEY = 'Alt+Space'

const MODES: AssistantMode[] = ['observe', 'assist', 'autopilot']

let snapshot: LunaSnapshot = { state: 'idle', mode: 'assist', reply: null }
let listenTimer: NodeJS.Timeout | null = null

/** Диалог в памяти процесса. Сохранение между запусками — в фазе 4. */
const history: ChatMessage[] = []
let provider: ModelProvider | null = null
let providerError: string | null = null
let activeTurn: AbortController | null = null

/** Рассылает состояние во все окна. */
function broadcast(): void {
  for (const win of allWindows()) {
    win.webContents.send(IPC.state, snapshot)
  }
}

function update(patch: Partial<LunaSnapshot>): void {
  snapshot = { ...snapshot, ...patch }
  broadcast()
}

function setState(state: OrbState): void {
  update({ state })
}

/** Провайдер создаём один раз; ошибка настройки показывается пользователю, а не падает приложение. */
function getProvider(): ModelProvider | null {
  if (provider || providerError) return provider
  try {
    provider = createProvider(readProviderConfig(process.env))
  } catch (error) {
    providerError = error instanceof Error ? error.message : String(error)
  }
  return provider
}

function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/abort/i.test(message)) return ''
  if (/401|invalid_api_key|incorrect api key/i.test(message)) {
    return 'Ключ провайдера не принят. Проверьте ключ в настройках.'
  }
  if (/ECONNREFUSED|fetch failed|connect/i.test(message)) {
    return 'Не удалось подключиться к модели. Для локальной модели проверьте, что Ollama запущен.'
  }
  return `Ошибка модели: ${message.slice(0, 200)}`
}

/** Отправляет запрос агенту и стримит ответ в панель и значок. */
async function submit(text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  activeTurn?.abort()
  const controller = new AbortController()
  activeTurn = controller

  const current = getProvider()
  if (!current) {
    update({ state: 'error', reply: providerError ?? 'Модель не настроена.' })
    return
  }

  const role = pickRole(trimmed)
  setState('thinking')
  update({ reply: '' })

  try {
    await runTurn({
      provider: current,
      role,
      history,
      userText: trimmed,
      signal: controller.signal,
      onDelta: (fullText) => update({ reply: fullText, state: 'acting' })
    })
    if (activeTurn === controller) {
      activeTurn = null
      update({ state: 'idle' })
    }
  } catch (error) {
    if (activeTurn === controller) activeTurn = null
    const message = friendlyError(error)
    if (message) update({ state: 'error', reply: message })
  }
}

function runAction(id: MenuActionId): void {
  switch (id) {
    case 'text':
      showPanel('input')
      return
    case 'listen':
      hidePanel()
      setState('listening')
      if (listenTimer) clearTimeout(listenTimer)
      // Заглушка: слушание без распознавания. Настоящий голос — в фазе 5.
      listenTimer = setTimeout(() => setState('idle'), 2500)
      return
    case 'mode': {
      const next = MODES[(MODES.indexOf(snapshot.mode) + 1) % MODES.length]
      update({ mode: next })
      return
    }
    case 'pause':
      setState(snapshot.state === 'paused' ? 'idle' : 'paused')
      hidePanel()
      return
    case 'history':
    case 'settings':
      update({ reply: id === 'history' ? 'История появится в фазе 4.' : 'Настройки появятся позже.' })
      showPanel('input')
      return
    case 'quit':
      app.quit()
      return
  }
}

function toggleInput(): void {
  if (isPanelVisible()) {
    hidePanel()
  } else {
    showPanel('input')
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.snapshot, () => snapshot)
  ipcMain.on(IPC.openPanel, (_event, view: 'menu' | 'input') => showPanel(view))
  ipcMain.on(IPC.hidePanel, () => hidePanel())
  ipcMain.on(IPC.action, (_event, id: MenuActionId) => runAction(id))
  ipcMain.on(IPC.submit, (_event, text: string) => void submit(text))
  ipcMain.on(IPC.dragBy, (_event, dx: number, dy: number) => dragBy(dx, dy))
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.luna.desktop')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc()
  createOrbWindow()
  createPanelWindow()

  const registered = globalShortcut.register(HOTKEY, toggleInput)
  if (!registered) {
    console.warn(`Горячая клавиша ${HOTKEY} не зарегистрирована. Проверьте раскладку и занятость сочетания.`)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOrbWindow()
      createPanelWindow()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// На macOS приложение живёт, пока его не выключат явно (Cmd+Q или пункт «Выйти»).
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

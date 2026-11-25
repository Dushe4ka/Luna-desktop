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
  type LunaSnapshot,
  type MenuActionId,
  type AssistantMode,
  type OrbState
} from '../shared/luna'

/** Горячая клавиша открытия ввода. В Electron это Option+Space на macOS. */
const HOTKEY = 'Alt+Space'

const MODES: AssistantMode[] = ['observe', 'assist', 'autopilot']

let snapshot: LunaSnapshot = { state: 'idle', mode: 'assist', reply: null }
let listenTimer: NodeJS.Timeout | null = null

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

/**
 * Заглушка ответа: в фазе 1 модели ещё нет.
 * Нужна только для проверки состояний значка и панели.
 */
function submit(text: string): void {
  const trimmed = text.trim()
  if (!trimmed) return
  setState('thinking')
  update({ reply: null })
  setTimeout(() => {
    update({
      state: 'idle',
      reply: `Модель пока не подключена. Вы написали: «${trimmed}»`
    })
  }, 1200)
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
  ipcMain.on(IPC.submit, (_event, text: string) => submit(text))
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

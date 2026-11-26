import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { PanelView } from '../shared/luna'

/** Видимый размер значка. */
export const ORB_VISUAL = 64
/** Окно значка больше значка: внутри помещаются кольца и свечение, иначе их обрежет. */
export const ORB_WINDOW = 128
const ORB_INSET = (ORB_WINDOW - ORB_VISUAL) / 2
export const PANEL_WIDTH = 320
export const PANEL_HEIGHT = 380
const EDGE_OFFSET = 28
const GAP = 10

let orbWindow: BrowserWindow | null = null
let panelWindow: BrowserWindow | null = null

/** Загружает нужный вид в одном и том же бандле интерфейса: через параметр ?view=. */
function loadView(win: BrowserWindow, view: 'orb' | 'panel' | 'main'): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (is.dev && devUrl) {
    void win.loadURL(`${devUrl}?view=${view}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { query: { view } })
  }
}

function basePreferences(): Electron.WebPreferences {
  return {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true
  }
}

/** Прозрачное окно без рамки, всегда поверх обычных окон. */
function makeOverlayWindow(width: number, height: number): BrowserWindow {
  const win = new BrowserWindow({
    width,
    height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: basePreferences()
  })
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  return win
}

/** Значок в правом верхнем углу основного экрана. Видимый круг стоит у края с отступом. */
export function createOrbWindow(): BrowserWindow {
  const area = screen.getPrimaryDisplay().workArea
  orbWindow = makeOverlayWindow(ORB_WINDOW, ORB_WINDOW)
  // Клик по значку не должен переносить фокус: окно, с которым работает пользователь, запоминаем точно.
  orbWindow.setFocusable(false)
  const x = area.x + area.width - ORB_VISUAL - EDGE_OFFSET - ORB_INSET
  const y = area.y + EDGE_OFFSET - ORB_INSET
  orbWindow.setPosition(Math.round(x), Math.round(y))
  loadView(orbWindow, 'orb')
  orbWindow.once('ready-to-show', () => orbWindow?.showInactive())
  orbWindow.on('closed', () => (orbWindow = null))
  return orbWindow
}

/** Панель меню и ввода. Скрыта, пока её не открыли. Прячется, когда теряет фокус. */
export function createPanelWindow(): BrowserWindow {
  panelWindow = makeOverlayWindow(PANEL_WIDTH, PANEL_HEIGHT)
  loadView(panelWindow, 'panel')
  panelWindow.on('blur', () => hidePanel())
  panelWindow.on('closed', () => (panelWindow = null))
  return panelWindow
}

let mainWindow: BrowserWindow | null = null

/** Полноценное окно Луны: обычное окно с рамкой, чат, задачи, память и настройки. */
export function openMainWindow(): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
    return mainWindow
  }
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 740,
    minWidth: 720,
    minHeight: 520,
    title: 'Луна',
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0b0d14',
    show: false,
    webPreferences: basePreferences()
  })
  loadView(mainWindow, 'main')
  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => (mainWindow = null))
  return mainWindow
}

/** Ставит панель под видимым значком, выровненной по его правому краю. */
function placePanel(): void {
  if (!orbWindow || !panelWindow) return
  const win = orbWindow.getBounds()
  const visualLeft = win.x + ORB_INSET
  const visualTop = win.y + ORB_INSET
  const visualRight = visualLeft + ORB_VISUAL
  const visualBottom = visualTop + ORB_VISUAL
  const area = screen.getDisplayMatching(win).workArea
  let x = visualRight - PANEL_WIDTH
  let y = visualBottom + GAP
  x = Math.max(area.x, Math.min(x, area.x + area.width - PANEL_WIDTH))
  if (y + PANEL_HEIGHT > area.y + area.height) y = visualTop - GAP - PANEL_HEIGHT
  panelWindow.setPosition(Math.round(x), Math.round(y))
}

/** Открывает панель в нужном виде и даёт ей фокус. */
export function showPanel(view: PanelView): void {
  if (!panelWindow) createPanelWindow()
  if (!panelWindow) return
  placePanel()
  panelWindow.webContents.send('luna:panel-view', view)
  panelWindow.show()
  panelWindow.focus()
}

export function hidePanel(): void {
  if (panelWindow && panelWindow.isVisible()) panelWindow.hide()
}

export function isPanelVisible(): boolean {
  return panelWindow?.isVisible() ?? false
}

/** Перемещает значок и, если панель открыта, её тоже. Для перетаскивания мышью. */
export function dragBy(dx: number, dy: number): void {
  if (!orbWindow) return
  const [x, y] = orbWindow.getPosition()
  orbWindow.setPosition(Math.round(x + dx), Math.round(y + dy))
  if (isPanelVisible()) placePanel()
}

export function allWindows(): BrowserWindow[] {
  return BrowserWindow.getAllWindows()
}

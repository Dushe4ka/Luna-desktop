import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { PanelView } from '../shared/luna'

export const ORB_SIZE = 96
export const PANEL_WIDTH = 320
export const PANEL_HEIGHT = 380
const EDGE_OFFSET = 28
const GAP = 10

let orbWindow: BrowserWindow | null = null
let panelWindow: BrowserWindow | null = null

/** Загружает нужный вид в одном и том же бандле интерфейса: через параметр ?view=. */
function loadView(win: BrowserWindow, view: 'orb' | 'panel'): void {
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

/** Значок в правом верхнем углу основного экрана. */
export function createOrbWindow(): BrowserWindow {
  const area = screen.getPrimaryDisplay().workArea
  orbWindow = makeOverlayWindow(ORB_SIZE, ORB_SIZE)
  orbWindow.setPosition(area.x + area.width - ORB_SIZE - EDGE_OFFSET, area.y + EDGE_OFFSET)
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

/** Ставит панель под значком, выровненной по его правому краю. */
function placePanel(): void {
  if (!orbWindow || !panelWindow) return
  const orb = orbWindow.getBounds()
  const area = screen.getDisplayMatching(orb).workArea
  let x = orb.x + ORB_SIZE - PANEL_WIDTH
  let y = orb.y + ORB_SIZE + GAP
  x = Math.max(area.x, Math.min(x, area.x + area.width - PANEL_WIDTH))
  if (y + PANEL_HEIGHT > area.y + area.height) y = orb.y - GAP - PANEL_HEIGHT
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

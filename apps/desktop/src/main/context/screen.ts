import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Чтение окна через agent-desktop (accessibility). Ничего не пишет и не нажимает.
 * Приложения из списка исключений не читаем вообще (спека §4.1).
 */

/** Приложения, которые Луна никогда не читает. Потом настраивается пользователем. */
export let EXCLUDED_APPS: string[] = ['1Password', 'Bitwarden', 'Keychain Access', 'Связка ключей', 'Электронный ключ']

/** Список меняется в настройках (см. settings.ts). */
export function setExcludedApps(apps: string[]): void {
  EXCLUDED_APPS = apps
}

/** Свои окна не читаем: иначе Луна увидит собственную панель. */
const OWN_APPS = ['Electron', 'Luna', 'Luna Desktop']

const MAX_CHARS = 3000
/** Меньше этого — считаем, что содержимого окна нет (только заголовок или пустота). */
const MIN_CONTENT_CHARS = 40
const TIMEOUT_MS = 15000

export interface FocusedWindow {
  app: string
  windowId: string
  title: string
}

export type ScreenRead =
  | { ok: true; app: string; title: string; text: string }
  | { ok: false; app: string | null; reason: string }

function runAgentDesktop(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('agent-desktop', args, { timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) return reject(error)
      resolve(stdout)
    })
  })
}

/** Активное окно другого приложения: то, с которым пользователь работал до вызова Луны. */
export async function findFocusedWindow(): Promise<FocusedWindow | null> {
  const raw = await runAgentDesktop(['list-windows'])
  const parsed = JSON.parse(raw) as {
    ok: boolean
    data: { app_name: string; id: string; title: string; is_focused: boolean; visible: boolean }[]
  }
  if (!parsed.ok) return null
  const win = parsed.data.find(
    (w) => w.is_focused && w.visible && !OWN_APPS.some((own) => w.app_name === own)
  )
  return win ? { app: win.app_name, windowId: win.id, title: win.title } : null
}

/** Собирает текст из дерева элементов: имена и значения, без повторов. */
function collectText(node: unknown, out: string[], seen: Set<string>): void {
  if (!node || typeof node !== 'object') return
  const n = node as Record<string, unknown>
  for (const key of ['name', 'value', 'title']) {
    const v = n[key]
    if (typeof v === 'string') {
      const t = v.trim()
      if (t.length > 1 && !seen.has(t)) {
        seen.add(t)
        out.push(t)
      }
    }
  }
  const children = n['children']
  if (Array.isArray(children)) for (const child of children) collectText(child, out, seen)
}

/** Читает содержимое окна. Если приложение не отдаёт дерево, возвращаем понятную причину. */
export async function readFocusedWindow(target: FocusedWindow): Promise<ScreenRead> {
  if (EXCLUDED_APPS.some((name) => target.app.includes(name))) {
    return { ok: false, app: target.app, reason: 'Это приложение в списке исключений, его не читаю.' }
  }
  const raw = await runAgentDesktop([
    'snapshot',
    '--window-id',
    target.windowId,
    '-i',
    '--compact',
    '--timeout-ms',
    '5000'
  ])
  const parsed = JSON.parse(raw) as { ok: boolean; data?: { tree?: unknown; ref_count?: number }; error?: { message: string } }
  if (!parsed.ok || !parsed.data?.tree) {
    return { ok: false, app: target.app, reason: 'Окно не отдаёт содержимое через accessibility.' }
  }
  const parts: string[] = []
  collectText(parsed.data.tree, parts, new Set())
  let text = parts.join('\n')
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS) + '\n…(обрезано)'
  // Только заголовок окна (например, «Telegram @ имя») — это не содержимое, считаем текст не прочитанным.
  if (text.trim().length < MIN_CONTENT_CHARS) {
    return { ok: false, app: target.app, reason: 'Окно отдаёт только заголовок, без содержимого.' }
  }
  return { ok: true, app: target.app, title: target.title, text }
}

/** Приложение из списка исключений (его не читаем и не снимаем). */
export function isExcludedApp(app: string): boolean {
  return EXCLUDED_APPS.some((name) => app.includes(name))
}

/**
 * Снимок окна как запасной путь (для приложений, которые не отдают текст).
 * Уменьшаем до 1400 px, временный файл удаляем сразу. Возвращает data URL или null.
 */
export function captureWindow(windowId: string): Promise<string | null> {
  const file = join(tmpdir(), `luna-shot-${randomUUID()}.png`)
  const small = file.replace(/\.png$/, '-small.png')
  return new Promise((resolve) => {
    execFile('agent-desktop', ['screenshot', file, '--window-id', windowId], { timeout: TIMEOUT_MS }, (error) => {
      if (error) return resolve(null)
      execFile('sips', ['-Z', '1400', file, '--out', small], { timeout: TIMEOUT_MS }, (sipsError) => {
        try {
          const data = readFileSync(sipsError ? file : small).toString('base64')
          resolve(`data:image/png;base64,${data}`)
        } catch {
          resolve(null)
        } finally {
          for (const path of [file, small]) {
            try {
              unlinkSync(path)
            } catch {
              // уже удалён
            }
          }
        }
      })
    })
  })
}

/** Запросы, для которых нужен экран. Остальные не трогают экран вообще. */
export function wantsScreen(text: string): boolean {
  return /(экран|окн|вкладк|на странице|этот чат|этом чате|здесь|посмотри|что ответить|что написано|что тут|прочитай)/i.test(
    text
  )
}

/** Видимое окно конкретного приложения (нужно после открытия приложения, чтобы знать, куда вводить текст). */
export async function findAppWindow(app: string): Promise<FocusedWindow | null> {
  const raw = await runAgentDesktop(['list-windows'])
  const parsed = JSON.parse(raw) as {
    ok: boolean
    data: { app_name: string; id: string; title: string; is_focused: boolean; visible: boolean }[]
  }
  if (!parsed.ok) return null
  const wins = parsed.data.filter((w) => w.visible && w.app_name.toLowerCase() === app.toLowerCase())
  const win = wins.find((w) => w.is_focused) ?? wins[0]
  return win ? { app: win.app_name, windowId: win.id, title: win.title } : null
}

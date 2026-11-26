import { execFile } from 'node:child_process'
import { asData } from './system-tools'
import { readSecret } from '../secrets'
import OpenAI from 'openai'

/**
 * Инструменты управления интерфейсом через agent-desktop (accessibility, без скриншотов).
 * Работа по ссылкам из снимка: сначала desktop_snapshot, потом click/type/scroll по ref.
 * Ссылки устаревают при изменении окна: тогда agent-desktop вернёт ошибку и нужен новый снимок.
 */

const TIMEOUT_MS = 20000

function ad(args: string[]): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  return new Promise((resolve) => {
    execFile('agent-desktop', args, { timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 }, (error, stdout) => {
      try {
        const parsed = JSON.parse(stdout) as { ok: boolean; data?: unknown; error?: { code?: string; message?: string } }
        if (parsed.ok) return resolve({ ok: true, data: parsed.data })
        return resolve({ ok: false, error: `${parsed.error?.code ?? 'ОШИБКА'}: ${parsed.error?.message ?? 'не удалось'}` })
      } catch {
        return resolve({ ok: false, error: error ? error.message.slice(0, 200) : 'пустой ответ' })
      }
    })
  })
}

interface SnapNode {
  role?: string
  name?: string
  value?: string
  ref_id?: string
  available_actions?: string[]
  children?: SnapNode[]
}

/** Список элементов, с которыми можно работать, с их ссылками. */
export async function snapshotTool(app: string | undefined, windowId: string | undefined): Promise<string> {
  const args = ['snapshot', '-i', '--compact', '--timeout-ms', '5000']
  if (windowId) args.push('--window-id', windowId)
  else if (app) args.push('--app', app)
  else return 'Укажите приложение или окно для снимка.'
  const res = await ad(args)
  if (!res.ok) return `Снимок не получен: ${res.error}`
  const data = res.data as { tree?: SnapNode; snapshot_id?: string }
  const lines: string[] = []
  const walk = (n: SnapNode): void => {
    if (lines.length >= 150) return
    if (n.ref_id) {
      const label = (n.name || n.value || '').replace(/\s+/g, ' ').trim().slice(0, 80)
      const actions = (n.available_actions ?? []).slice(0, 3).join(', ')
      if (label || (n.available_actions ?? []).length) {
        lines.push(`${n.ref_id} | ${n.role ?? '?'} | ${label || '—'} | ${actions}`)
      }
    }
    for (const c of n.children ?? []) walk(c)
  }
  if (data.tree) walk(data.tree)
  const head = `Снимок ${data.snapshot_id ?? ''}. Ссылки действительны только для этого снимка.`
  return asData('Элементы (ссылка | роль | название | действия)', `${head}\n${lines.join('\n') || '(элементов нет)'}`)
}

export async function clickTool(ref: string): Promise<string> {
  const res = await ad(['click', ref, '--timeout-ms', '5000'])
  return res.ok ? 'Нажато.' : `Не нажалось: ${res.error}`
}

export async function scrollTool(ref: string, direction: string, amount: number): Promise<string> {
  const dir = ['up', 'down', 'left', 'right'].includes(direction) ? direction : 'down'
  const res = await ad(['scroll', ref, '--direction', dir, '--amount', String(Math.min(Math.max(amount || 3, 1), 20))])
  return res.ok ? `Прокручено: ${dir}.` : `Не прокрутилось: ${res.error}`
}

export async function listWindowsTool(app: string | undefined): Promise<string> {
  const args = ['list-windows']
  if (app) args.push('--app', app)
  const res = await ad(args)
  if (!res.ok) return `Не получилось: ${res.error}`
  const data = res.data as { app_name: string; id: string; title: string; visible: boolean }[]
  const lines = data.filter((w) => w.visible).map((w) => `${w.id} | ${w.app_name} | ${w.title.slice(0, 80)}`)
  return asData('Окна (id | приложение | заголовок)', lines.join('\n') || '(окон нет)')
}

export async function focusWindowTool(windowId: string): Promise<string> {
  const res = await ad(['focus-window', '--window-id', windowId])
  return res.ok ? 'Окно на переднем плане.' : `Не получилось: ${res.error}`
}

export async function clipboardGetTool(): Promise<string> {
  const res = await ad(['clipboard-get'])
  if (!res.ok) return `Не получилось: ${res.error}`
  return asData('Буфер обмена', JSON.stringify(res.data).slice(0, 2000))
}

export async function clipboardSetTool(text: string): Promise<string> {
  const res = await ad(['clipboard-set', text])
  return res.ok ? 'Буфер обмена записан.' : `Не получилось: ${res.error}`
}

/** Клавиши: только безопасные комбинации. Закрытие приложений (cmd+q, cmd+w) не разрешаем. */
const BLOCKED_COMBOS = /(cmd|command)\+(q|w|shift\+q)\b|ctrl\+alt\+delete|cmd\+opt\+esc/i
export async function pressComboTool(combo: string, windowId: string | undefined): Promise<string> {
  if (BLOCKED_COMBOS.test(combo)) return 'Эту комбинацию не выполняю: она может закрыть приложение.'
  const args = ['--headed', 'press', combo]
  if (windowId) args.push('--window-id', windowId)
  const res = await ad(args)
  return res.ok ? `Нажато: ${combo}.` : `Не нажалось: ${res.error}`
}

/** Поиск в интернете через встроенный веб-поиск OpenAI. Запрос уходит в OpenAI. */
export async function webSearchTool(query: string, model: string): Promise<string> {
  const key = await readSecret('openai')
  if (!key) return 'Для поиска нужен ключ OpenAI в Keychain.'
  try {
    const client = new OpenAI({ apiKey: key })
    const response = await client.responses.create({
      model,
      input: query,
      tools: [{ type: 'web_search' }]
    } as never)
    const text = (response as unknown as { output_text?: string }).output_text ?? ''
    const sources: string[] = []
    for (const item of ((response as unknown as { output?: unknown[] }).output ?? []) as { content?: { annotations?: { url?: string; title?: string }[] }[] }[]) {
      for (const c of item.content ?? []) {
        for (const a of c.annotations ?? []) if (a.url) sources.push(`${a.title ?? a.url} — ${a.url}`)
      }
    }
    const uniq = [...new Set(sources)].slice(0, 8)
    return asData('Результаты поиска', `${text}${uniq.length ? `\nИсточники:\n${uniq.join('\n')}` : ''}`)
  } catch (error) {
    return `Поиск не выполнен: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`
  }
}

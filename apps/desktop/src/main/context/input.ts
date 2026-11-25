import { execFile, spawn } from 'node:child_process'

/**
 * Поиск поля ввода в окне и ввод текста через agent-desktop.
 * Вызывается только после подтверждения пользователя (см. agent/execute.ts).
 */

const TEXT_ROLES = new Set(['textfield', 'textarea', 'searchfield', 'textbox', 'text field', 'text area'])
const TIMEOUT_MS = 15000
export const MAX_TEXT_CHARS = 500

export interface EditableTarget {
  ref: string
  role: string
  label: string
}

interface Node {
  role?: string
  name?: string
  value?: string
  ref_id?: string
  states?: string[]
  available_actions?: string[]
  children?: Node[]
}

/** Ищет поле ввода: сначала то, у которого фокус, иначе первое доступное для записи. */
export function pickEditable(tree: Node): EditableTarget | null {
  const candidates: { target: EditableTarget; focused: boolean }[] = []
  const walk = (n: Node): void => {
    const role = (n.role ?? '').toLowerCase()
    const writable = (n.available_actions ?? []).some((a) => a === 'SetValue' || a === 'SetFocus')
    if (TEXT_ROLES.has(role) && n.ref_id && writable) {
      candidates.push({
        target: { ref: n.ref_id, role, label: (n.name ?? n.value ?? '').slice(0, 60) },
        focused: (n.states ?? []).includes('focused')
      })
    }
    for (const child of n.children ?? []) walk(child)
  }
  walk(tree)
  const focused = candidates.find((c) => c.focused)
  return (focused ?? candidates[0])?.target ?? null
}

export function findEditable(windowId: string): Promise<EditableTarget | null> {
  return new Promise((resolve, reject) => {
    execFile(
      'agent-desktop',
      ['snapshot', '--window-id', windowId, '-i', '--compact', '--timeout-ms', '5000'],
      { timeout: TIMEOUT_MS, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout) => {
        if (error && !stdout) return reject(error)
        const parsed = JSON.parse(stdout) as { ok: boolean; data?: { tree?: Node } }
        if (!parsed.ok || !parsed.data?.tree) return resolve(null)
        resolve(pickEditable(parsed.data.tree))
      }
    )
  })
}

/** Вводит текст в найденное поле. Текст передаётся через stdin, а не в аргументах командной строки. */
export function typeIntoRef(ref: string, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    // --headed разрешает запасной способ через фокус: это действие уже подтвердил пользователь.
    const child = spawn('agent-desktop', ['--headed', 'type', ref, '--stdin', '--timeout-ms', '8000'])
    let out = ''
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()))
    child.on('error', () => resolve(false))
    child.on('close', (code) => {
      try {
        resolve(code === 0 && (JSON.parse(out) as { ok: boolean }).ok)
      } catch {
        resolve(false)
      }
    })
    child.stdin.end(text, 'utf8')
  })
}

/** Нажимает клавишу в окне. Только клавиши из белого списка проверяются вызывающим кодом. */
export function pressInWindow(key: string, windowId: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      'agent-desktop',
      ['--headed', 'press', key, '--window-id', windowId],
      { timeout: 15000 },
      (error, stdout) => {
        if (error && !stdout) return resolve(false)
        try {
          resolve((JSON.parse(stdout) as { ok: boolean }).ok)
        } catch {
          resolve(false)
        }
      }
    )
  })
}

import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Журнал действий Луны (спека §4.1, §6). Пишет только факты: что предложено, что решил пользователь,
 * что выполнено. Содержимое экрана и текст запросов в журнал не попадают.
 */
export type JournalKind =
  | 'read'
  | 'read_refused'
  | 'tool_proposed'
  | 'tool_invalid'
  | 'tool_denied'
  | 'approval_requested'
  | 'approval_granted'
  | 'approval_denied'
  | 'action_done'
  | 'action_failed'
  | 'stop'
  | 'summary'

export interface JournalEntry {
  kind: JournalKind
  /** Короткое описание: приложение, действие, причина. Без содержимого экрана. */
  detail?: string
  chars?: number
}

let dir: string | null = null

function file(): string {
  if (!dir) {
    dir = join(app.getPath('userData'), 'journal')
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, 'actions.jsonl')
}

export function journal(entry: JournalEntry): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'
  appendFileSync(file(), line, 'utf8')
}

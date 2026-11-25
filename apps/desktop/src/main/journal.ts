import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Журнал действий Луны (спека §4.1, §6). Пишет только факты: что прочитано и откуда,
 * сколько символов. Содержимое экрана и текст запросов в журнал не попадают.
 */
export interface JournalEntry {
  kind: 'read' | 'read_refused' | 'stop' | 'answer'
  app?: string
  chars?: number
  reason?: string
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

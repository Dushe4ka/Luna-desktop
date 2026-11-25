import { execFile } from 'node:child_process'

/**
 * Управление приложениями через AppleScript (Заметки, Календарь, Напоминания и другие).
 * Выполняется только после решения пользователя по уровню доступа. Вывод обрезаем.
 */
export const MAX_SCRIPT_CHARS = 4000
const MAX_OUTPUT = 1000

export function runAppleScript(script: string): Promise<string> {
  if (!script.trim() || script.length > MAX_SCRIPT_CHARS) {
    return Promise.resolve(`Скрипт пустой или длиннее ${MAX_SCRIPT_CHARS} символов.`)
  }
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], { timeout: 20000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const reason = (stderr || error.message).trim().slice(0, 300)
        return resolve(`Скрипт не выполнен: ${reason}`)
      }
      const out = stdout.trim().slice(0, MAX_OUTPUT)
      resolve(out ? `Выполнено. Результат: ${out}` : 'Выполнено.')
    })
  })
}

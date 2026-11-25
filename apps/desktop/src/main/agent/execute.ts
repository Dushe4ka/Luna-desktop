import { execFile } from 'node:child_process'

/** Выполнение действий на компьютере через agent-desktop. Вызывается только после подтверждения. */
export function executeAction(name: string, args: Record<string, unknown>): Promise<string> {
  if (name !== 'open_app') return Promise.resolve(`Неизвестное действие: ${name}`)
  const app = String(args.app ?? '').trim()
  return new Promise((resolve) => {
    execFile('agent-desktop', ['launch', '--timeout', '15000', app], { timeout: 20000 }, (error, stdout) => {
      if (error) return resolve(`Не удалось открыть «${app}»: ${error.message.slice(0, 120)}`)
      try {
        const parsed = JSON.parse(stdout) as { ok: boolean; error?: { message?: string } }
        if (!parsed.ok) return resolve(`Не удалось открыть «${app}»: ${parsed.error?.message ?? 'ошибка'}`)
      } catch {
        // Не JSON — считаем успешным запуском, если процесс завершился без ошибки.
      }
      resolve(`Приложение «${app}» открыто.`)
    })
  })
}

import { execFile } from 'node:child_process'
import { findEditable, MAX_TEXT_CHARS, pressInWindow, typeIntoRef } from '../context/input'

/** Выполнение действий на компьютере через agent-desktop. Вызывается только после подтверждения. */
export interface ActionContext {
  /** Окно, с которым работал пользователь до вызова Луны. */
  foreground: { app: string; windowId: string } | null
}

export function executeAction(name: string, args: Record<string, unknown>, ctx: ActionContext): Promise<string> {
  if (name === 'type_text') return typeText(String(args.text ?? ''), ctx)
  if (name === 'press_key') return pressKey(String(args.key ?? ''), ctx)
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

async function typeText(text: string, ctx: ActionContext): Promise<string> {
  if (!text.trim() || text.length > MAX_TEXT_CHARS) return `Текст пустой или длиннее ${MAX_TEXT_CHARS} символов.`
  if (!ctx.foreground) return 'Не знаю, в каком окне вводить текст. Откройте Луну из окна, куда нужно писать.'
  const field = await findEditable(ctx.foreground.windowId).catch(() => null)
  if (!field) return `В окне «${ctx.foreground.app}» не нашла поле для ввода. Щёлкните в поле и повторите.`
  const ok = await typeIntoRef(field.ref, text)
  return ok ? `Текст введён в «${ctx.foreground.app}».` : `Не удалось ввести текст в «${ctx.foreground.app}».`
}

async function pressKey(key: string, ctx: ActionContext): Promise<string> {
  if (!ctx.foreground) return 'Не знаю, в каком окне нажать клавишу.'
  const ok = await pressInWindow(key, ctx.foreground.windowId)
  return ok ? `Клавиша «${key}» нажата в «${ctx.foreground.app}».` : `Не удалось нажать «${key}» в «${ctx.foreground.app}».`
}

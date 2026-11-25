import type { ToolSpec } from './types'

/**
 * Инструменты, которые модель может предложить. Все «act» — требуют подтверждения пользователя.
 * Чтение экрана делает сам код по запросу (context/screen.ts), модель его не вызывает.
 */
export const TOOLS: ToolSpec[] = [
  {
    name: 'open_app',
    description:
      'Открыть приложение на компьютере пользователя по его имени, например "Safari", "Calculator", "Notes". Используй только если пользователь явно попросил открыть приложение.',
    parameters: {
      type: 'object',
      properties: {
        app: { type: 'string', description: 'Имя приложения, как оно называется в macOS' }
      },
      required: ['app'],
      additionalProperties: false
    }
  }
]

/** Инструменты, которые что-то меняют на компьютере. */
export const ACTION_TOOLS = new Set(['open_app'])

/** Понятное описание действия для карточки подтверждения. */
export function describeAction(name: string, args: Record<string, unknown>): string {
  if (name === 'open_app') return `Открыть приложение «${String(args.app ?? '')}»`
  return `Действие «${name}»`
}

/** Имя приложения проверяем до запуска: только буквы, цифры, пробел, точка и дефис. */
export function isSafeAppName(name: string): boolean {
  return /^[\p{L}\p{N} .\-]{1,60}$/u.test(name)
}

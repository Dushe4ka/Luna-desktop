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
  },
  {
    name: 'type_text',
    description:
      'Ввести текст в поле ввода приложения, с которым работает пользователь. Используй, только если пользователь явно попросил написать или вставить текст. Текст не отправляется: кнопку отправки нажимает пользователь.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Текст, который нужно ввести' }
      },
      required: ['text'],
      additionalProperties: false
    }
  }
]

/** Инструменты, которые что-то меняют на компьютере. */
export const ACTION_TOOLS = new Set(['open_app', 'type_text'])

/** Понятное описание действия для карточки подтверждения. */
export function describeAction(name: string, args: Record<string, unknown>, targetApp: string | null): string {
  if (name === 'open_app') return `Открыть приложение «${String(args.app ?? '')}»`
  if (name === 'type_text') {
    const text = String(args.text ?? '')
    const preview = text.length > 80 ? text.slice(0, 80) + '…' : text
    return `Ввести текст «${preview}» в «${targetApp ?? 'окно'}»`
  }
  return `Действие «${name}»`
}

/** Имя приложения проверяем до запуска: только буквы, цифры, пробел, точка и дефис. */
export function isSafeAppName(name: string): boolean {
  return /^[\p{L}\p{N} .\-]{1,60}$/u.test(name)
}

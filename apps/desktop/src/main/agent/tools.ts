import type { ToolSpec } from './types'

/**
 * Инструменты, которые модель может предложить. Все «act» — требуют подтверждения пользователя.
 * Чтение экрана делает сам код по запросу (context/screen.ts), модель его не вызывает.
 */
export const TOOLS: ToolSpec[] = [
  {
    name: 'create_task',
    description:
      'Создать карточку задачи, когда пользователь ставит цель, срок или обязательство. Карточка видна пользователю и её можно поправить.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Короткое название задачи' },
        due: { type: 'string', description: 'Срок, если назван, например "пятница" или "30.11"' }
      },
      required: ['title'],
      additionalProperties: false
    }
  },
  {
    name: 'update_task',
    description: 'Изменить статус задачи по её id: active, waiting, done или postponed. Итог можно записать в summary.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['active', 'waiting', 'done', 'postponed'] },
        summary: { type: 'string', description: 'Итог работы по задаче, если он известен' }
      },
      required: ['id', 'status'],
      additionalProperties: false
    }
  },
  {
    name: 'list_tasks',
    description: 'Показать задачи пользователя со статусами. Используй, когда спрашивают о задачах или отчётах.',
    parameters: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'search_memory',
    description: 'Найти в задачах и памяти записи по слову или фразе. Используй, когда пользователь спрашивает, что было раньше.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
      additionalProperties: false
    }
  },
  {
    name: 'remember',
    description:
      'Запомнить факт о пользователе или его работе. Используй только если пользователь сказал «запомни» или подтвердил, что это стоит запомнить. Не запоминай болтовню и чувствительные данные.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Факт одной короткой фразой' },
        layer: { type: 'string', enum: ['profile', 'pattern', 'fact'] }
      },
      required: ['text', 'layer'],
      additionalProperties: false
    }
  },
  {
    name: 'press_key',
    description:
      'Нажать одну клавишу в приложении, с которым работает пользователь: return (отправить/подтвердить), escape, tab. Используй только если пользователь явно попросил нажать или отправить.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', enum: ['return', 'escape', 'tab'] }
      },
      required: ['key'],
      additionalProperties: false
    }
  },
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
      'Ввести текст в поле ввода приложения, с которым работает пользователь. Используй, только если пользователь явно попросил написать или вставить текст. Текст не отправляется сам: для отправки нужен отдельный инструмент press_key.',
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

/**
 * Классы риска (спека §6):
 * act — меняет что-то на компьютере; send — может отправить сообщение от имени пользователя.
 * Оба класса требуют подтверждения. В режиме «наблюдать» не передаются вовсе.
 */
export type Risk = 'act' | 'send'
export const RISK: Record<string, Risk> = {
  open_app: 'act',
  type_text: 'act',
  press_key: 'send',
  remember: 'act'
}

/** Клавиши, которые Луна может нажать. Остальное не разрешено. */
export const ALLOWED_KEYS = ['return', 'escape', 'tab'] as const

/** Инструменты, которые что-то меняют на компьютере. */
export const ACTION_TOOLS = new Set(Object.keys(RISK))

/** Записи в задачи и чтение памяти: без подтверждения (обратимо и видно пользователю). */
export const AUTO_TOOLS = new Set(['create_task', 'update_task'])
export const READ_TOOLS = new Set(['list_tasks', 'search_memory'])

/** Понятное описание действия для карточки подтверждения. */
export function describeAction(name: string, args: Record<string, unknown>, targetApp: string | null): string {
  if (name === 'open_app') return `Открыть приложение «${String(args.app ?? '')}»`
  if (name === 'remember') return `Запомнить: «${String(args.text ?? '')}»?`
  if (name === 'press_key') {
    return `Нажать «${String(args.key ?? '')}» в «${targetApp ?? 'окне'}»${args.key === 'return' ? ' (может отправить сообщение)' : ''}`
  }
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

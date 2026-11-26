import type { ToolSpec } from './types'

/**
 * Инструменты, которые модель может предложить. Все «act» — требуют подтверждения пользователя.
 * Чтение экрана делает сам код по запросу (context/screen.ts), модель его не вызывает.
 */
export const TOOLS: ToolSpec[] = [
  {
    name: "desktop_snapshot",
    description: "Снять список элементов приложения или окна с ссылками (ref). Вызывай перед нажатием или вводом, ссылки работают только в своём снимке.",
    parameters: { type: 'object', properties: {"app": {"type": "string"}, "window_id": {"type": "string"}}, required: [], additionalProperties: false }
  },
  {
    name: "desktop_click",
    description: "Нажать элемент по ссылке из снимка (кнопка, ссылка, пункт меню).",
    parameters: { type: 'object', properties: {"ref": {"type": "string"}}, required: ["ref"], additionalProperties: false }
  },
  {
    name: "desktop_scroll",
    description: "Прокрутить элемент по ссылке из снимка.",
    parameters: { type: 'object', properties: {"ref": {"type": "string"}, "direction": {"type": "string", "enum": ["up", "down", "left", "right"]}, "amount": {"type": "integer"}}, required: ["ref"], additionalProperties: false }
  },
  {
    name: "desktop_list_windows",
    description: "Показать открытые окна (id, приложение, заголовок).",
    parameters: { type: 'object', properties: {"app": {"type": "string"}}, required: [], additionalProperties: false }
  },
  {
    name: "desktop_focus_window",
    description: "Вывести окно на передний план по id.",
    parameters: { type: 'object', properties: {"window_id": {"type": "string"}}, required: ["window_id"], additionalProperties: false }
  },
  {
    name: "desktop_press",
    description: "Нажать клавишу или комбинацию в окне, например return, escape, tab, space, cmd+a, cmd+c, cmd+v, cmd+n.",
    parameters: { type: 'object', properties: {"combo": {"type": "string"}, "window_id": {"type": "string"}}, required: ["combo"], additionalProperties: false }
  },
  {
    name: "clipboard_get",
    description: "Прочитать текст из буфера обмена.",
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
  },
  {
    name: "clipboard_set",
    description: "Записать текст в буфер обмена.",
    parameters: { type: 'object', properties: {"text": {"type": "string"}}, required: ["text"], additionalProperties: false }
  },
  {
    name: "web_search",
    description: "Поиск в интернете: актуальные сведения с источниками. Используй для новостей, цен, фактов, которых может не быть в памяти модели.",
    parameters: { type: 'object', properties: {"query": {"type": "string"}}, required: ["query"], additionalProperties: false }
  },
  {
    name: 'run_command',
    description:
      'Выполнить команду в командной строке (zsh) на компьютере пользователя. Используй для поиска, сборки, git, установки пакетов и других задач. Не используй для того, что проще сделать другим инструментом.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Команда целиком, например: ls -la ~/Documents' },
        cwd: { type: 'string', description: 'Папка, откуда запустить (по умолчанию домашняя)' }
      },
      required: ['command'],
      additionalProperties: false
    }
  },
  {
    name: 'read_file',
    description: 'Прочитать текстовый файл по пути (можно ~/...).',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false }
  },
  {
    name: 'write_file',
    description: 'Записать текстовый файл целиком (создаёт или перезаписывает). Используй осторожно: это меняет данные.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, content: { type: 'string' } },
      required: ['path', 'content'],
      additionalProperties: false
    }
  },
  {
    name: 'edit_file',
    description: 'Заменить один фрагмент текста в файле. Фрагмент должен встречаться в файле ровно один раз.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' }, old_text: { type: 'string' }, new_text: { type: 'string' } },
      required: ['path', 'old_text', 'new_text'],
      additionalProperties: false
    }
  },
  {
    name: 'list_dir',
    description: 'Показать содержимое папки.',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, additionalProperties: false }
  },
  {
    name: 'search_files',
    description: 'Найти текст в файлах внутри папки.',
    parameters: {
      type: 'object',
      properties: { pattern: { type: 'string' }, path: { type: 'string' } },
      required: ['pattern'],
      additionalProperties: false
    }
  },
  {
    name: 'fetch_url',
    description: 'Загрузить текст веб-страницы по адресу (только чтение).',
    parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'], additionalProperties: false }
  },
  {
    name: 'run_applescript',
    description:
      'Выполнить AppleScript, чтобы управлять приложениями macOS: создать заметку, событие календаря, напоминание и т.п. Пример заметки: tell application "Notes" to make new note with properties {name:"Привет", body:"привет"}. Используй, когда пользователь просит что-то создать или изменить в приложении.',
    parameters: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'Текст AppleScript целиком' }
      },
      required: ['script'],
      additionalProperties: false
    }
  },
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
export type Risk = 'read' | 'act' | 'send'
export const RISK: Record<string, Risk> = {
  desktop_snapshot: 'read',
  desktop_list_windows: 'read',
  web_search: 'read',
  desktop_click: 'act',
  desktop_scroll: 'act',
  desktop_focus_window: 'act',
  desktop_press: 'send',
  clipboard_get: 'act',
  clipboard_set: 'act',
  run_command: 'act',
  read_file: 'read',
  list_dir: 'read',
  search_files: 'read',
  fetch_url: 'read',
  write_file: 'act',
  edit_file: 'act',
  open_app: 'act',
  type_text: 'act',
  press_key: 'send',
  remember: 'act',
  run_applescript: 'act'
}

/** Клавиши, которые Луна может нажать. Остальное не разрешено. */
export const ALLOWED_KEYS = ['return', 'escape', 'tab'] as const

/** Инструменты, которые что-то меняют на компьютере. */
export const ACTION_TOOLS = new Set(Object.keys(RISK))

/** Записи в задачи и чтение памяти: без подтверждения (обратимо и видно пользователю). */
export const AUTO_TOOLS = new Set(['create_task', 'update_task'])
export const READ_TOOLS = new Set(['list_tasks', 'search_memory', 'read_file', 'list_dir', 'search_files', 'fetch_url', 'desktop_snapshot', 'desktop_list_windows', 'web_search'])
/** Чтение файлов и веб-страниц: без вопроса на уровнях «безопасные» и «по списку». */
export const FILE_READ_TOOLS = new Set(['read_file', 'list_dir', 'search_files', 'fetch_url', 'web_search'])

/** Понятное описание действия для карточки подтверждения. */
export function describeAction(name: string, args: Record<string, unknown>, targetApp: string | null): string {
  if (name === 'open_app') return `Открыть приложение «${String(args.app ?? '')}»`
  if (name === 'remember') return `Запомнить: «${String(args.text ?? '')}»?`
  if (name === 'desktop_click') return `Нажать элемент ${String(args.ref ?? '')}${targetApp ? ` в «${targetApp}»` : ''}`
  if (name === 'desktop_press') return `Нажать «${String(args.combo ?? '')}»${targetApp ? ` в «${targetApp}»` : ''}`
  if (name === 'desktop_focus_window') return `Вывести окно ${String(args.window_id ?? '')} на передний план`
  if (name === 'desktop_scroll') return `Прокрутить элемент ${String(args.ref ?? '')}`
  if (name === 'clipboard_set') return `Записать в буфер обмена: «${String(args.text ?? '').slice(0, 80)}»`
  if (name === 'clipboard_get') return 'Прочитать буфер обмена (он может содержать пароли или личное)'
  if (name === 'web_search') return `Искать в интернете: «${String(args.query ?? '')}» (запрос уйдёт в OpenAI)`
  if (name === 'run_command') return `Выполнить команду: «${String(args.command ?? '').slice(0, 200)}»`
  if (name === 'write_file') return `Записать файл «${String(args.path ?? '')}»`
  if (name === 'edit_file') return `Изменить файл «${String(args.path ?? '')}»`
  if (name === 'read_file') return `Прочитать файл «${String(args.path ?? '')}»`
  if (name === 'list_dir') return `Посмотреть папку «${String(args.path ?? '~')}»`
  if (name === 'search_files') return `Искать «${String(args.pattern ?? '')}» в «${String(args.path ?? '~')}»`
  if (name === 'fetch_url') return `Открыть страницу «${String(args.url ?? '')}»`
  if (name === 'run_applescript') {
    const script = String(args.script ?? '')
    const shown = script.length > 300 ? script.slice(0, 300) + '…' : script
    return `Выполнить скрипт для приложений: «${shown.replace(/\s+/g, ' ')}»`
  }
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

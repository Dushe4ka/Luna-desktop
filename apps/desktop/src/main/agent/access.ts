import { RISK } from './tools'

/**
 * Уровни доступа (спека §6). Решаем, нужно ли спрашивать пользователя перед действием.
 * На уровне «полный доступ» Луна ничего не спрашивает: выполняет всё, в том числе отправку (класс «send»)
 * и снимки окон. Это включается только с согласием пользователя и видно на значке.
 * На остальных уровнях отправка и снимки всегда спрашивают.
 */
export type AccessLevel = 'ask' | 'safe' | 'allowlist' | 'full'

export const ACCESS_LEVELS: AccessLevel[] = ['ask', 'safe', 'allowlist', 'full']

export interface AccessInput {
  level: AccessLevel
  /** Записи вида "open_app:Calculator" или "type_text:Notes". */
  allowlist: string[]
  toolName: string
  args: Record<string, unknown>
  targetApp: string | null
  /** Память: «запомни» сказано прямо в этом запросе. */
  explicitMemory: boolean
}

/** true — выполнить без вопроса, false — спросить. */
export function autoApprove(input: AccessInput): boolean {
  // Полный доступ: без вопросов вообще.
  if (input.level === 'full') return true
  // Снимок окна уходит в облако — только на полном доступе без вопросов.
  if (input.toolName === 'read_screenshot') return false
  // Отправка от имени пользователя — с подтверждением на всех остальных уровнях.
  if (RISK[input.toolName] === 'send') return false

  if (input.toolName === 'remember') {
    // Явная просьба «запомни» — всегда без вопроса; на «безопасном» уровне и выше — тоже.
    if (input.explicitMemory) return true
    return input.level !== 'ask'
  }

  switch (input.level) {
    case 'ask':
      return false
    case 'safe':
      // Чтение и заметки без вопросов, действия на компьютере — с вопросом.
      return false
    case 'allowlist': {
      const app = String(input.args.app ?? input.targetApp ?? '')
      return input.allowlist.includes(`${input.toolName}:${app}`)
    }
  }
}

/** Ключ записи в список разрешённых автоматических действий. */
export function allowKey(toolName: string, app: string): string {
  return `${toolName}:${app}`
}

import { RISK } from './tools'

/**
 * Уровни доступа (спека §6). Решаем, нужно ли спрашивать пользователя перед действием.
 * Правила, которые не отключаются ни одним уровнем:
 *  - действия класса «send» (нажатие Return, отправка) всегда с подтверждением;
 *  - снимок экрана и всё, что уходит в облако, решается отдельно (в main, не здесь).
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
  // Отправка от имени пользователя — всегда с подтверждением, кроме любого уровня.
  if (RISK[input.toolName] === 'send') return false

  if (input.toolName === 'remember') {
    // Явная просьба «запомни» — всегда без вопроса; на «безопасном» уровне и выше — тоже.
    if (input.explicitMemory) return true
    return input.level === 'safe' || input.level === 'allowlist' || input.level === 'full'
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
    case 'full':
      return true
  }
}

/** Ключ записи в список разрешённых автоматических действий. */
export function allowKey(toolName: string, app: string): string {
  return `${toolName}:${app}`
}

import { RISK } from './tools'

/**
 * Уровни доступа (спека §6). Решаем, нужно ли спрашивать пользователя перед действием.
 *  - «Опасное» (команды, которые вредят устройству и данным, защищённые пути) спрашивает ВСЕГДА,
 *    даже на полном доступе: решает risk.ts, сюда приходит флагом.
 *  - «Полный доступ»: остальное выполняется без вопросов (включая отправку и снимки окон).
 *  - «Безопасные»: чтение и заметки без вопросов; запись, команды и открытие приложений — с вопросом.
 *  - «По списку»: без вопросов только то, что в списке.
 *  - «Спрашивать всегда»: всё спрашивает.
 */
export type AccessLevel = 'ask' | 'safe' | 'allowlist' | 'full'

export const ACCESS_LEVELS: AccessLevel[] = ['ask', 'safe', 'allowlist', 'full']

export interface AccessInput {
  level: AccessLevel
  /** Записи вида "open_app:Calculator" или "run_command:git status". */
  allowlist: string[]
  toolName: string
  args: Record<string, unknown>
  targetApp: string | null
  /** Память: «запомни» сказано прямо в этом запросе. */
  explicitMemory: boolean
  /** Опасно по risk.ts (команда, защищённый путь, опасный скрипт). */
  dangerous: boolean
}

/** true — выполнить без вопроса, false — спросить. */
export function autoApprove(input: AccessInput): boolean {
  // Опасное спрашиваем всегда, на любом уровне.
  if (input.dangerous) return false
  // Полный доступ: без вопросов вообще.
  if (input.level === 'full') return true
  // Снимок окна уходит в облако — на остальных уровнях спрашиваем.
  if (input.toolName === 'read_screenshot') return false

  if (input.toolName === 'remember') {
    if (input.explicitMemory) return true
    return input.level !== 'ask'
  }

  const cls = RISK[input.toolName]
  if (cls === 'read') {
    return input.level === 'safe'
  }

  switch (input.level) {
    case 'ask':
      return false
    case 'safe':
      return false
    case 'allowlist': {
      const app = String(input.args.app ?? input.targetApp ?? '')
      const command = String(input.args.command ?? '')
      return input.allowlist.includes(`${input.toolName}:${app}`) || (command !== '' && input.allowlist.includes(`${input.toolName}:${command}`))
    }
  }
}

/** Ключ записи в список разрешённых автоматических действий. */
export function allowKey(toolName: string, app: string): string {
  return `${toolName}:${app}`
}

// Типы ядра агента. Без зависимости от Electron, чтобы ядро тестировалось отдельно.

export type ChatRole = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

/** Один провайдер моделей. Все облачные и локальные серверы подключаются через него. */
export interface ModelProvider {
  /** Имя для интерфейса и журнала, например "openai" или "ollama". */
  readonly id: string
  readonly model: string
  /** Отдаёт текст ответа по частям. Прерывается через signal. */
  stream(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string>
}

/** Роли из спеки §3.4. В фазе 2 у каждой только свой системный промпт. */
export type RoleId = 'research' | 'developer' | 'office' | 'companion'

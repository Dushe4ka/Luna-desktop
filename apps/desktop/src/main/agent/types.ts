// Типы ядра агента. Без зависимости от Electron, чтобы ядро тестировалось отдельно.

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

/** Вызов инструмента, который предложила модель. */
export interface ToolCall {
  id: string
  name: string
  /** Аргументы в виде JSON-строки, как их отдаёт модель. */
  arguments: string
}

export interface ChatMessage {
  role: ChatRole
  content: string
  /** Только для assistant: какие инструменты он предложил. */
  toolCalls?: ToolCall[]
  /** Только для tool: к какому вызову относится результат. */
  toolCallId?: string
}

/** Описание инструмента для модели (JSON Schema для аргументов). */
export interface ToolSpec {
  name: string
  description: string
  parameters: Record<string, unknown>
}

/** Что отдаёт поток: кусок текста или готовый вызов инструмента. */
export type ModelEvent = { type: 'text'; text: string } | { type: 'tool_call'; call: ToolCall }

/** Один провайдер моделей. Все облачные и локальные серверы подключаются через него. */
export interface ModelProvider {
  /** Имя для интерфейса и журнала, например "openai" или "ollama". */
  readonly id: string
  readonly model: string
  /** Текст ответа по частям, без инструментов. */
  stream(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string>
  /** Текст и вызовы инструментов. */
  streamWithTools(messages: ChatMessage[], tools: ToolSpec[], signal?: AbortSignal): AsyncGenerator<ModelEvent>
}

/** Роли из спеки §3.4. В фазе 2 у каждой только свой системный промпт. */
export type RoleId = 'research' | 'developer' | 'office' | 'companion'

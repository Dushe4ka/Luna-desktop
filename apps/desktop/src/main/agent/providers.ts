import OpenAI from 'openai'
import type { ChatMessage, ModelEvent, ModelProvider, ToolSpec } from './types'
import { findProvider } from '../../shared/providers'

/**
 * Адаптер для любого сервера с протоколом OpenAI Chat Completions:
 * OpenAI, Ollama (/v1), LM Studio, vLLM, OpenRouter, Groq и другие.
 */
export class OpenAICompatibleProvider implements ModelProvider {
  private readonly client: OpenAI

  constructor(
    readonly id: string,
    readonly model: string,
    options: { apiKey: string; baseURL?: string }
  ) {
    this.client = new OpenAI({ apiKey: options.apiKey, baseURL: options.baseURL })
  }

  async *stream(messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
    const response = await this.client.chat.completions.create(
      { model: this.model, messages: messages.map(toWireMessage), stream: true },
      { signal }
    )
    for await (const chunk of response) {
      const piece = chunk.choices[0]?.delta?.content
      if (piece) yield piece
    }
  }
  async *streamWithTools(messages: ChatMessage[], tools: ToolSpec[], signal?: AbortSignal): AsyncGenerator<ModelEvent> {
    const response = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: messages.map(toWireMessage),
        tools: tools.map((t) => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.parameters }
        })),
        stream: true
      },
      { signal }
    )
    // Вызовы инструментов приходят кусками: собираем их по индексу.
    const pending = new Map<number, { id: string; name: string; args: string }>()
    for await (const chunk of response) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue
      if (delta.content) yield { type: 'text', text: delta.content }
      for (const part of delta.tool_calls ?? []) {
        const slot = pending.get(part.index) ?? { id: '', name: '', args: '' }
        if (part.id) slot.id = part.id
        if (part.function?.name) slot.name += part.function.name
        if (part.function?.arguments) slot.args += part.function.arguments
        pending.set(part.index, slot)
      }
    }
    for (const slot of pending.values()) {
      if (slot.name) yield { type: 'tool_call', call: { id: slot.id, name: slot.name, arguments: slot.args } }
    }
  }
}

/** Перевод нашего сообщения в формат протокола OpenAI. */
function toWireMessage(message: ChatMessage): OpenAI.Chat.ChatCompletionMessageParam {
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.toolCallId ?? '', content: message.content }
  }
  if (message.role === 'assistant' && message.toolCalls?.length) {
    return {
      role: 'assistant',
      content: message.content || null,
      tool_calls: message.toolCalls.map((c) => ({
        id: c.id,
        type: 'function' as const,
        function: { name: c.name, arguments: c.arguments }
      }))
    }
  }
  if (message.role === 'user' && message.images?.length) {
    return {
      role: 'user',
      content: [
        { type: 'text' as const, text: message.content },
        ...message.images.map((url) => ({ type: 'image_url' as const, image_url: { url, detail: 'auto' as const } }))
      ]
    }
  }
  return { role: message.role as 'system' | 'user' | 'assistant', content: message.content }
}

/** Настройки подключения: провайдер из каталога, адрес, модель и ключ. */
export interface ProviderConfig {
  provider: string
  model: string
  apiKey: string
  baseURL?: string
}

/**
 * Собирает настройки из переменных окружения (для разработки) и значений по умолчанию каталога.
 * Настройки из интерфейса подставляются в main/index.ts и имеют приоритет над каталогом.
 */
export function readProviderConfig(env: NodeJS.ProcessEnv): ProviderConfig {
  const id = env.LUNA_PROVIDER || 'openai'
  const info = findProvider(id) ?? findProvider('openai')!
  const apiKey = info.id === 'ollama' ? 'ollama' : env.LUNA_API_KEY || (info.id === 'openai' ? env.OPENAI_API_KEY || '' : '')
  return {
    provider: info.id,
    model: env.LUNA_MODEL || info.defaultModel,
    apiKey,
    baseURL: env.LUNA_BASE_URL || info.baseURL
  }
}

export function createProvider(config: ProviderConfig): ModelProvider {
  return new OpenAICompatibleProvider(config.provider, config.model, {
    apiKey: config.apiKey,
    baseURL: config.baseURL
  })
}

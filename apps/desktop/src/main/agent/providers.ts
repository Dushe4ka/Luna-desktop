import OpenAI from 'openai'
import type { ChatMessage, ModelProvider } from './types'

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
      { model: this.model, messages, stream: true },
      { signal }
    )
    for await (const chunk of response) {
      const piece = chunk.choices[0]?.delta?.content
      if (piece) yield piece
    }
  }
}

/** Настройки из переменных окружения. Ключи в файлы не пишем (в фазе 2; Keychain — позже). */
export interface ProviderConfig {
  provider: 'openai' | 'ollama'
  model: string
  apiKey: string
  baseURL?: string
}

export function readProviderConfig(env: NodeJS.ProcessEnv): ProviderConfig {
  const provider = env.LUNA_PROVIDER === 'ollama' ? 'ollama' : 'openai'
  if (provider === 'openai') {
    return {
      provider,
      model: env.LUNA_MODEL || 'gpt-4.1-mini',
      apiKey: env.OPENAI_API_KEY || '',
      baseURL: env.LUNA_OPENAI_URL || undefined
    }
  }
  return {
    provider,
    model: env.LUNA_MODEL || 'qwen3-vl:8b',
    apiKey: 'ollama', // Ollama не проверяет ключ, но SDK требует значение
    baseURL: env.LUNA_OLLAMA_URL || 'http://127.0.0.1:11434/v1'
  }
}

export function createProvider(config: ProviderConfig): ModelProvider {
  return new OpenAICompatibleProvider(config.provider, config.model, {
    apiKey: config.apiKey,
    baseURL: config.baseURL
  })
}

/**
 * Каталог провайдеров. Все они говорят протоколом OpenAI Chat Completions,
 * поэтому подключаются одним адаптером: меняется только адрес и ключ.
 * verified — адрес проверен в работе; иначе пометка «проверить» и пользователь может поправить адрес.
 */
export interface ProviderInfo {
  id: string
  name: string
  baseURL: string
  defaultModel: string
  needsKey: boolean
  verified: boolean
  note: string
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'openai', name: 'OpenAI', baseURL: 'https://api.openai.com/v1', defaultModel: 'gpt-4.1-mini', needsKey: true, verified: true, note: 'облако, ключ sk-…' },
  { id: 'ollama', name: 'Ollama (на этом Mac)', baseURL: 'http://127.0.0.1:11434/v1', defaultModel: 'qwen3-vl:8b', needsKey: false, verified: true, note: 'локально, ключ не нужен' },
  { id: 'lmstudio', name: 'LM Studio (локально)', baseURL: 'http://127.0.0.1:1234/v1', defaultModel: '', needsKey: false, verified: false, note: 'локально, порт по умолчанию — проверить' },
  { id: 'groq', name: 'Groq', baseURL: 'https://api.groq.com/openai/v1', defaultModel: '', needsKey: true, verified: false, note: 'облако, есть бесплатный тариф' },
  { id: 'openrouter', name: 'OpenRouter', baseURL: 'https://openrouter.ai/api/v1', defaultModel: '', needsKey: true, verified: false, note: 'много моделей, есть бесплатные' },
  { id: 'mistral', name: 'Mistral', baseURL: 'https://api.mistral.ai/v1', defaultModel: '', needsKey: true, verified: false, note: 'облако' },
  { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', defaultModel: '', needsKey: true, verified: false, note: 'адрес проверить (возможен /v1)' },
  { id: 'xai', name: 'xAI (Grok)', baseURL: 'https://api.x.ai/v1', defaultModel: '', needsKey: true, verified: false, note: 'облако' },
  { id: 'gemini', name: 'Google Gemini', baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/', defaultModel: '', needsKey: true, verified: false, note: 'адрес проверить' },
  { id: 'together', name: 'Together AI', baseURL: 'https://api.together.xyz/v1', defaultModel: '', needsKey: true, verified: false, note: 'адрес проверить (.xyz или .ai)' },
  { id: 'cerebras', name: 'Cerebras', baseURL: 'https://api.cerebras.ai/v1', defaultModel: '', needsKey: true, verified: false, note: 'облако, есть бесплатный тариф' },
  { id: 'custom', name: 'Свой сервер (OpenAI-совместимый)', baseURL: '', defaultModel: '', needsKey: false, verified: false, note: 'укажите адрес вида https://…/v1' }
]

export function findProvider(id: string): ProviderInfo | undefined {
  return PROVIDERS.find((p) => p.id === id)
}

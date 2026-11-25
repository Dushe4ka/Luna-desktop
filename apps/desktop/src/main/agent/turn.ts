import { systemPrompt } from './roles'
import type { ChatMessage, ModelProvider, RoleId } from './types'

/** Сколько последних реплик помним в диалоге. Сжатие истории — в фазе 4. */
const HISTORY_LIMIT = 20

export interface TurnOptions {
  provider: ModelProvider
  role: RoleId
  history: ChatMessage[]
  userText: string
  onDelta: (fullTextSoFar: string) => void
  signal?: AbortSignal
}

/**
 * Один ход диалога: отправляем историю, стримим ответ, дописываем в историю.
 * Возвращает полный текст ответа.
 */
export async function runTurn(options: TurnOptions): Promise<string> {
  const { provider, role, history, userText, onDelta, signal } = options
  history.push({ role: 'user', content: userText })
  const recent = history.slice(-HISTORY_LIMIT)
  const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt(role) }, ...recent]

  let text = ''
  try {
    for await (const piece of provider.stream(messages, signal)) {
      text += piece
      onDelta(text)
    }
  } catch (error) {
    history.pop() // не оставляем неотвеченную реплику пользователя
    throw error
  }
  history.push({ role: 'assistant', content: text })
  return text
}

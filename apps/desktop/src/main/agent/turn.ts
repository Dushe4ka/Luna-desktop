import { ACTION_TOOLS, ALLOWED_KEYS, describeAction, isSafeAppName } from './tools'
import { systemPrompt } from './roles'
import type { ChatMessage, ModelProvider, RoleId, ToolCall, ToolSpec } from './types'

/** Сколько последних реплик помним в диалоге. Сжатие истории — в фазе 4. */
const HISTORY_LIMIT = 20
/** Сколько шагов инструментов допускаем за один запрос, чтобы модель не зациклилась. */
const MAX_STEPS = 4

export interface ApprovalRequest {
  id: string
  name: string
  args: Record<string, unknown>
  description: string
}

export interface TurnOptions {
  provider: ModelProvider
  role: RoleId
  history: ChatMessage[]
  userText: string
  /** Инструменты, которые можно предлагать (пустой список — только текст). */
  tools: ToolSpec[]
  /** Приложение, в котором будет действие (для описания в подтверждении). */
  targetApp: string | null
  /** Снимок окна, если текст прочитать не удалось. Только для этого запроса. */
  images?: string[]
  onDelta: (fullTextSoFar: string) => void
  /** Спрашивает пользователя перед действием. true — разрешил. */
  requestApproval: (request: ApprovalRequest) => Promise<boolean>
  /** Выполняет подтверждённое действие и возвращает текст результата для модели. */
  runTool: (name: string, args: Record<string, unknown>) => Promise<string>
  /** Записывает событие в журнал. */
  onEvent: (kind: 'tool_proposed' | 'tool_denied' | 'tool_invalid', detail: string) => void
  signal?: AbortSignal
}

/**
 * Один ход диалога: история → модель → (инструменты с подтверждением → модель)* → текст.
 * Возвращает итоговый текст ответа.
 */
export async function runTurn(options: TurnOptions): Promise<string> {
  const { provider, role, history, userText, tools, targetApp, images, onDelta, requestApproval, runTool, onEvent, signal } = options
  history.push({ role: 'user', content: userText })
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(role) },
    ...history.slice(-HISTORY_LIMIT)
  ]
  // Картинка прикрепляется только к текущему вопросу; в историю она не попадает.
  if (images?.length) messages[messages.length - 1] = { ...messages[messages.length - 1], images }
  const known = new Set(tools.map((t) => t.name))

  try {
    let finalText = ''
    for (let step = 0; step < MAX_STEPS; step++) {
      let text = ''
      const calls: ToolCall[] = []
      for await (const event of provider.streamWithTools(messages, tools, signal)) {
        if (event.type === 'text') {
          text += event.text
          onDelta(text)
        } else {
          calls.push(event.call)
        }
      }
      finalText = text
      if (calls.length === 0) break

      messages.push({ role: 'assistant', content: text, toolCalls: calls })
      for (const call of calls) {
        const result = await handleCall(call, known, targetApp, requestApproval, runTool, onEvent)
        messages.push({ role: 'tool', content: result, toolCallId: call.id })
      }
    }
    history.push({ role: 'assistant', content: finalText })
    return finalText
  } catch (error) {
    history.pop() // не оставляем неотвеченную реплику пользователя
    throw error
  }
}

async function handleCall(
  call: { id: string; name: string; arguments: string },
  known: Set<string>,
  targetApp: string | null,
  requestApproval: TurnOptions['requestApproval'],
  runTool: TurnOptions['runTool'],
  onEvent: TurnOptions['onEvent']
): Promise<string> {
  if (!known.has(call.name)) {
    onEvent('tool_invalid', call.name)
    return `Инструмент «${call.name}» недоступен.`
  }
  let args: Record<string, unknown>
  try {
    args = JSON.parse(call.arguments || '{}') as Record<string, unknown>
  } catch {
    return 'Аргументы инструмента не разобраны.'
  }
  if (call.name === 'open_app' && !isSafeAppName(String(args.app ?? ''))) {
    onEvent('tool_invalid', 'open_app: некорректное имя приложения')
    return 'Некорректное имя приложения.'
  }
  if (call.name === 'press_key' && !(ALLOWED_KEYS as readonly string[]).includes(String(args.key ?? ''))) {
    onEvent('tool_invalid', 'press_key: клавиша не разрешена')
    return 'Эта клавиша не разрешена.'
  }
  if (call.name === 'type_text' && !String(args.text ?? '').trim()) {
    onEvent('tool_invalid', 'type_text: пустой текст')
    return 'Текст пустой.'
  }
  if (!ACTION_TOOLS.has(call.name)) return runTool(call.name, args)

  const description = describeAction(call.name, args, targetApp)
  onEvent('tool_proposed', description)
  const allowed = await requestApproval({ id: call.id, name: call.name, args, description })
  if (!allowed) {
    onEvent('tool_denied', description)
    return 'Пользователь отклонил действие. Не повторяй его без нового запроса.'
  }
  return runTool(call.name, args)
}

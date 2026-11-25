import { execFile } from 'node:child_process'
import { findEditable, MAX_TEXT_CHARS, pressInWindow, typeIntoRef } from '../context/input'
import { isSensitive } from '../memory/policy'
import { runAppleScript } from './applescript'

/** Выполнение действий на компьютере через agent-desktop. Вызывается только после подтверждения. */
export interface ActionContext {
  /** Окно, с которым работал пользователь до вызова Луны. */
  foreground: { app: string; windowId: string } | null
  /** Постоянная память. */
  memory: MemoryAccess
  /** Пользователь прямо попросил «запомни» — тогда факт сохраняется как явный. */
  explicitMemory: boolean
}

/** Узкий интерфейс памяти для ядра агента (реализует memory/store.ts). */
export interface MemoryAccess {
  createTask(title: string, due: string | null): { id: string; title: string; due: string | null }
  updateTaskStatus(id: string, status: 'active' | 'waiting' | 'done' | 'postponed', summary?: string): { id: string; title: string; status: string } | null
  listTasks(limit?: number): { id: string; title: string; status: string; due: string | null }[]
  search(query: string): { tasks: { id: string; title: string; status: string }[]; memories: { content: string; layer: string }[] }
  addMemory(layer: 'profile' | 'pattern' | 'fact', content: string, source: 'explicit' | 'proposed'): unknown
  onChanged(): void
}

export function executeAction(name: string, args: Record<string, unknown>, ctx: ActionContext): Promise<string> {
  if (name === 'type_text') return typeText(String(args.text ?? ''), ctx)
  if (name === 'press_key') return pressKey(String(args.key ?? ''), ctx)
  if (name === 'run_applescript') return runAppleScript(String(args.script ?? ''))
  if (name === 'create_task' || name === 'update_task' || name === 'list_tasks' || name === 'search_memory' || name === 'remember') {
    return Promise.resolve(memoryTool(name, args, ctx))
  }
  if (name !== 'open_app') return Promise.resolve(`Неизвестное действие: ${name}`)
  const app = String(args.app ?? '').trim()
  return new Promise((resolve) => {
    execFile('agent-desktop', ['launch', '--timeout', '15000', app], { timeout: 20000 }, (error, stdout) => {
      if (error) return resolve(`Не удалось открыть «${app}»: ${error.message.slice(0, 120)}`)
      try {
        const parsed = JSON.parse(stdout) as { ok: boolean; error?: { message?: string } }
        if (!parsed.ok) return resolve(`Не удалось открыть «${app}»: ${parsed.error?.message ?? 'ошибка'}`)
      } catch {
        // Не JSON — считаем успешным запуском, если процесс завершился без ошибки.
      }
      resolve(`Приложение «${app}» открыто.`)
    })
  })
}

async function typeText(text: string, ctx: ActionContext): Promise<string> {
  if (!text.trim() || text.length > MAX_TEXT_CHARS) return `Текст пустой или длиннее ${MAX_TEXT_CHARS} символов.`
  if (!ctx.foreground) return 'Не знаю, в каком окне вводить текст. Откройте Луну из окна, куда нужно писать.'
  const field = await findEditable(ctx.foreground.windowId).catch(() => null)
  if (!field) return `В окне «${ctx.foreground.app}» не нашла поле для ввода. Щёлкните в поле и повторите.`
  const ok = await typeIntoRef(field.ref, text)
  return ok ? `Текст введён в «${ctx.foreground.app}».` : `Не удалось ввести текст в «${ctx.foreground.app}».`
}

async function pressKey(key: string, ctx: ActionContext): Promise<string> {
  if (!ctx.foreground) return 'Не знаю, в каком окне нажать клавишу.'
  const ok = await pressInWindow(key, ctx.foreground.windowId)
  return ok ? `Клавиша «${key}» нажата в «${ctx.foreground.app}».` : `Не удалось нажать «${key}» в «${ctx.foreground.app}».`
}

function memoryTool(name: string, args: Record<string, unknown>, ctx: ActionContext): string {
  const memory = ctx.memory
  if (name === 'create_task') {
    const title = String(args.title ?? '').trim()
    if (!title) return 'Название задачи пустое.'
    const due = args.due ? String(args.due) : null
    const task = memory.createTask(title, due)
    memory.onChanged()
    return `Задача создана: «${task.title}»${task.due ? `, срок ${task.due}` : ''}. id: ${task.id}`
  }
  if (name === 'update_task') {
    const status = String(args.status ?? '') as 'active' | 'waiting' | 'done' | 'postponed'
    const task = memory.updateTaskStatus(String(args.id ?? ''), status, args.summary ? String(args.summary) : undefined)
    memory.onChanged()
    return task ? `Задача «${task.title}»: статус ${task.status}.` : 'Такой задачи нет.'
  }
  if (name === 'list_tasks') {
    const tasks = memory.listTasks(30)
    if (tasks.length === 0) return 'Задач пока нет.'
    return tasks.map((t) => `- «${t.title}» — ${t.status}${t.due ? `, срок ${t.due}` : ''} (id ${t.id})`).join('\n')
  }
  if (name === 'search_memory') {
    const found = memory.search(String(args.query ?? ''))
    const lines = [
      ...found.tasks.map((t) => `задача: «${t.title}» — ${t.status}`),
      ...found.memories.map((m) => `факт: ${m.content}`)
    ]
    return lines.length ? lines.join('\n') : 'Ничего не найдено.'
  }
  // remember
  const text = String(args.text ?? '').trim()
  const layer = String(args.layer ?? 'fact') as 'profile' | 'pattern' | 'fact'
  if (!text) return 'Пустой факт не сохраняю.'
  if (isSensitive(text)) return 'Это чувствительные данные, в память их не сохраняю.'
  memory.addMemory(layer, text, ctx.explicitMemory ? 'explicit' : 'proposed')
  memory.onChanged()
  return `Запомнила: «${text}».`
}

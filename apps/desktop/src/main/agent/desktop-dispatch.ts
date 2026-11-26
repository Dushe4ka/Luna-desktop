import type { ActionContext } from './execute'
import {
  clickTool,
  clipboardGetTool,
  clipboardSetTool,
  focusWindowTool,
  listWindowsTool,
  pressComboTool,
  scrollTool,
  snapshotTool,
  webSearchTool
} from './desktop-tools'
import { searxngSearch, wikipediaSearch } from './search'

/** Поиск по настройкам: Википедия (без ключа), свой SearXNG или OpenAI. */
export function runWebSearch(query: string, search: { provider?: string; searxngURL?: string; model?: string } = {}): Promise<string> {
  if (search.provider === 'searxng') return searxngSearch(query, search.searxngURL ?? '')
  if (search.provider === 'openai') return webSearchTool(query, search.model || 'gpt-4.1-mini')
  return wikipediaSearch(query)
}

/** Разбор аргументов инструментов интерфейса и вызов нужной функции. */
export function desktopDispatch(name: string, args: Record<string, unknown>, ctx: ActionContext): Promise<string> {
  const str = (k: string): string => String(args[k] ?? '').trim()
  const windowId = str('window_id') || ctx.foreground?.windowId || undefined
  switch (name) {
    case 'desktop_snapshot':
      return snapshotTool(str('app') || undefined, windowId || (str('app') ? undefined : ctx.foreground?.windowId))
    case 'desktop_click':
      return clickTool(str('ref'))
    case 'desktop_scroll':
      return scrollTool(str('ref'), str('direction') || 'down', Number(args.amount ?? 3))
    case 'desktop_list_windows':
      return listWindowsTool(str('app') || undefined)
    case 'desktop_focus_window':
      return focusWindowTool(str('window_id'))
    case 'desktop_press':
      return pressComboTool(str('combo'), windowId)
    case 'clipboard_get':
      return clipboardGetTool()
    case 'clipboard_set':
      return clipboardSetTool(String(args.text ?? ''))
    case 'web_search':
      return runWebSearch(str('query'), ctx.search)
    default:
      return Promise.resolve(`Неизвестный инструмент: ${name}`)
  }
}

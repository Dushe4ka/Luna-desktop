import { asData } from './system-tools'

/**
 * Веб-поиск без обязательного ключа.
 * wikipedia — открытый API Википедии (бесплатно, без ключа, для фактов и определений).
 * searxng — свой экземпляр SearXNG (открытый метапоиск, AGPL-3.0; пользователь разворачивает сам).
 */
export type SearchProviderId = 'wikipedia' | 'searxng'

const TIMEOUT_MS = 15000

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

export async function wikipediaSearch(query: string, lang: 'ru' | 'en' = 'ru'): Promise<string> {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`)
  url.search = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '5',
    format: 'json',
    origin: '*'
  }).toString()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'LunaDesktop/0.1 (personal assistant)' } })
    const data = (await res.json()) as { query?: { search?: { title: string; snippet: string; pageid: number }[] } }
    const hits = data.query?.search ?? []
    if (hits.length === 0) return 'По запросу в Википедии ничего не найдено.'
    const lines = hits.map((h) => `- ${h.title}: ${stripTags(h.snippet)} (https://${lang}.wikipedia.org/?curid=${h.pageid})`)
    return asData(`Википедия (${lang})`, lines.join('\n'))
  } catch (error) {
    return `Поиск в Википедии не выполнен: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`
  }
}

export async function searxngSearch(query: string, baseUrl: string): Promise<string> {
  if (!baseUrl) return 'Адрес SearXNG не задан в настройках.'
  const url = new URL('/search', baseUrl)
  url.search = new URLSearchParams({ q: query, format: 'json' }).toString()
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return `SearXNG ответил ошибкой ${res.status}. Проверьте, что включён формат JSON.`
    const data = (await res.json()) as { results?: { title: string; url: string; content?: string }[] }
    const hits = (data.results ?? []).slice(0, 6)
    if (hits.length === 0) return 'Ничего не найдено.'
    return asData('Результаты SearXNG', hits.map((h) => `- ${h.title}: ${(h.content ?? '').slice(0, 200)} (${h.url})`).join('\n'))
  } catch (error) {
    return `SearXNG недоступен: ${error instanceof Error ? error.message.slice(0, 200) : String(error)}`
  }
}

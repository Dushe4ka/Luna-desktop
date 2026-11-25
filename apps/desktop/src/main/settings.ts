import { app } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { readSecret } from './secrets'

/**
 * Настройки Луны (файл settings.json в папке данных приложения).
 * Ключи провайдеров сюда не пишем: они лежат в Keychain.
 */
export type ProviderId = 'openai' | 'ollama'
export type AccessMode = 'observe' | 'assist' | 'autopilot'

export interface Settings {
  provider: ProviderId
  model: string
  vaultDir: string
  excludedApps: string[]
  mode: AccessMode
}

const PROVIDERS: ProviderId[] = ['openai', 'ollama']
const MODES: AccessMode[] = ['observe', 'assist', 'autopilot']

export const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  model: 'gpt-4.1-mini',
  vaultDir: join(homedir(), 'Documents', 'Obsidian Vault', 'Память Luna'),
  excludedApps: ['1Password', 'Bitwarden', 'Keychain Access', 'Связка ключей', 'Электронный ключ'],
  mode: 'assist'
}

let filePath = ''
let current: Settings = { ...DEFAULT_SETTINGS }

export function loadSettings(): Settings {
  filePath = join(app.getPath('userData'), 'settings.json')
  try {
    current = sanitize({ ...DEFAULT_SETTINGS, ...(JSON.parse(readFileSync(filePath, 'utf8')) as Partial<Settings>) })
  } catch {
    current = { ...DEFAULT_SETTINGS }
  }
  return current
}

export function getSettings(): Settings {
  return current
}

export function saveSettings(patch: Partial<Settings>): Settings {
  current = sanitize({ ...current, ...patch })
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(current, null, 2), 'utf8')
  return current
}

/** Проверяем значения из интерфейса: лишнего не пропускаем. */
function sanitize(input: Settings): Settings {
  return {
    provider: PROVIDERS.includes(input.provider) ? input.provider : DEFAULT_SETTINGS.provider,
    model: String(input.model ?? '').trim().slice(0, 80) || DEFAULT_SETTINGS.model,
    vaultDir: String(input.vaultDir ?? '').trim().slice(0, 500) || DEFAULT_SETTINGS.vaultDir,
    excludedApps: (Array.isArray(input.excludedApps) ? input.excludedApps : [])
      .map((a) => String(a).trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 50),
    mode: MODES.includes(input.mode) ? input.mode : DEFAULT_SETTINGS.mode
  }
}

/** Есть ли ключ в Keychain. Сам ключ наружу не отдаём. */
export async function hasOpenAIKey(): Promise<boolean> {
  return (await readSecret('openai')) !== null
}

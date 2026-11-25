import { homedir } from 'node:os'

/**
 * Оценка риска действий (спека §6, раздел «Инструменты»).
 * «Опасно» — всегда спрашиваем, даже на уровне «полный доступ».
 * Классификация консервативная: лучше лишний вопрос, чем тихий ущерб.
 */

export type CommandLevel = 'read' | 'write' | 'dangerous'

/** Команды, которые ничего не меняют (проверяются по каждому звену цепочки). */
const READ_COMMANDS = new Set([
  'ls', 'cat', 'head', 'tail', 'pwd', 'echo', 'date', 'whoami', 'which', 'file', 'wc', 'du', 'df',
  'stat', 'grep', 'rg', 'tree', 'sw_vers', 'uname', 'ps', 'printenv', 'id', 'hostname'
])

/** Признаки опасных команд: удаление, права, сеть с отправкой данных, системные операции. */
const DANGEROUS_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\brm\b[^|;&]*\s-[a-zA-Z]*[rRf]/, reason: 'удаление с -r/-f' },
  { re: /\bsudo\b/, reason: 'повышение прав (sudo)' },
  { re: /\bmkfs\b|\bdiskutil\s+(erase|partition|reformat|secureErase)/, reason: 'форматирование диска' },
  { re: /\bdd\s+if=/, reason: 'низкоуровневая запись (dd)' },
  { re: /\b(shutdown|reboot|halt)\b/, reason: 'выключение или перезагрузка' },
  { re: /(curl|wget)[^|;]*\|\s*(sh|bash|zsh)\b/, reason: 'запуск скрипта из интернета' },
  { re: /\b(chmod|chown)\s+-R\b/, reason: 'массовая смена прав' },
  { re: /\b(killall|kill\s+-9|pkill)\b/, reason: 'остановка процессов' },
  { re: /\blaunchctl\b/, reason: 'системные службы (launchctl)' },
  { re: /\bsecurity\s+(find|dump|delete|export)-/, reason: 'доступ к Keychain' },
  { re: /\b(ssh|scp|nc|netcat|telnet|sftp|rsync)\b/, reason: 'сетевой доступ к другим машинам' },
  { re: /\bcurl\b[^|;]*(\s-d\b|--data|\s-F\b|--form|\s-T\b|--upload|-X\s*(POST|PUT|DELETE))/, reason: 'отправка данных по сети' },
  { re: /\bgit\s+(push\b[^;|&]*--force|reset\s+--hard|clean\s+-[a-z]*f)/, reason: 'необратимые изменения в git' },
  { re: /\beval\b|\bbase64\s+-d[^;]*\|/, reason: 'выполнение закодированного кода' },
  { re: />\s*\/(etc|System|usr|bin|sbin|Library)\b/, reason: 'запись в системные папки' },
  { re: /\bosascript\b|do shell script/i, reason: 'вложенный скрипт системы' }
]

/** Пути, которые нельзя трогать без вопроса: ключи, пароли, системные папки, настройки оболочки. */
const SENSITIVE_PATHS: { re: RegExp; reason: string }[] = [
  { re: /\.ssh(\/|$)/, reason: 'ключи SSH' },
  { re: /Keychains|Связка ключей/i, reason: 'связка ключей macOS' },
  { re: /(^|\/)\.env(\.[\w-]+)?$/, reason: 'файл с секретами (.env)' },
  { re: /\.aws\/|\.gnupg\/|\.netrc|\.npmrc|\.pypirc|id_rsa|id_ed25519/, reason: 'учётные данные' },
  { re: /(^|\/)(\.zshrc|\.bashrc|\.bash_profile|\.zprofile|\.profile)$/, reason: 'настройки оболочки' },
  { re: /credentials|passwords?|secret|token/i, reason: 'похоже на секреты' },
  { re: /^\/(System|usr|bin|sbin|etc|private\/etc|Library\/LaunchDaemons)(\/|$)/, reason: 'системная папка' }
]

/** Приводим путь: ~ — домашняя папка. */
export function expandPath(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/')) return homedir() + path.slice(1)
  return path
}

export function sensitivePathReason(path: string): string | null {
  const full = expandPath(path)
  for (const rule of SENSITIVE_PATHS) if (rule.re.test(full)) return rule.reason
  return null
}

/** Уровень команды: самый опасный из звеньев цепочки (; && || |). */
export function classifyCommand(command: string): { level: CommandLevel; reason: string | null } {
  for (const rule of DANGEROUS_PATTERNS) {
    if (rule.re.test(command)) return { level: 'dangerous', reason: rule.reason }
  }
  const segments = command.split(/;|&&|\|\||\|/).map((s) => s.trim()).filter(Boolean)
  const sensitive = sensitivePathReason(command)
  if (sensitive) return { level: 'dangerous', reason: sensitive }
  let level: CommandLevel = 'read'
  for (const segment of segments) {
    const first = segment.split(/\s+/)[0].replace(/^.*\//, '')
    const isFind = first === 'find' && !/-exec|-delete|-ok/.test(segment)
    const isGit = first === 'git' && /^git\s+(status|log|diff|show|branch)\b/.test(segment)
    const readOnly = READ_COMMANDS.has(first) || isFind || isGit
    if (!readOnly) level = 'write'
  }
  return { level, reason: null }
}

export interface RiskAssessment {
  dangerous: boolean
  reason: string | null
}

/** Оценка риска конкретного вызова инструмента. */
export function assessRisk(name: string, args: Record<string, unknown>): RiskAssessment {
  if (name === 'run_command') {
    const r = classifyCommand(String(args.command ?? ''))
    return { dangerous: r.level === 'dangerous', reason: r.reason }
  }
  if (name === 'run_applescript') {
    const script = String(args.script ?? '')
    const hit = DANGEROUS_PATTERNS.find((p) => p.re.test(script))
    return { dangerous: Boolean(hit), reason: hit ? hit.reason : null }
  }
  if (['read_file', 'write_file', 'edit_file', 'list_dir', 'search_files'].includes(name)) {
    const reason = sensitivePathReason(String(args.path ?? args.dir ?? ''))
    return { dangerous: Boolean(reason), reason }
  }
  return { dangerous: false, reason: null }
}

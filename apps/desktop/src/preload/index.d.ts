import type { LunaAPI } from '../shared/luna'

declare global {
  interface Window {
    luna: LunaAPI
  }
}

export {}

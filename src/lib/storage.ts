/** Small, dependency-free wrapper around localStorage that never throws. */
export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable (private mode / quota) - ignore */
  }
}

export function remove(key: string): void {
  try {
    globalThis.localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const STORAGE_KEYS = {
  user: 'pw.user',
  watches: 'pw.watches',
  theme: 'pw.theme',
} as const

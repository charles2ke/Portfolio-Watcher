import { STORAGE_KEYS, readJSON, writeJSON } from './storage'
import { isValidSymbol, normalizeSymbol } from './market'
import { validateDestinations } from './alerts'
import type { AlertChannel, Watch } from './types'

export interface WatchDraft {
  symbol: string
  dipPercent: number
  risePercent: number
  channels: AlertChannel[]
  email: string
  phone: string
}

export function createWatch(draft: WatchDraft, id: string): Watch {
  return {
    id,
    symbol: normalizeSymbol(draft.symbol),
    dipPercent: draft.dipPercent,
    risePercent: draft.risePercent,
    channels: [...draft.channels],
    email: draft.email.trim(),
    phone: draft.phone.trim(),
  }
}

export function validateDraft(draft: WatchDraft, existing: Watch[]): string | null {
  if (!isValidSymbol(draft.symbol)) return 'Enter a valid ticker symbol, e.g. MSFT.'
  if (existing.some((watch) => watch.symbol === normalizeSymbol(draft.symbol))) {
    return 'That ticker is already on your watchlist.'
  }
  if (draft.dipPercent <= 0 && draft.risePercent <= 0) {
    return 'Set a dip or rise percentage greater than 0.'
  }
  if (draft.dipPercent < 0 || draft.risePercent < 0) return 'Percentages cannot be negative.'
  if (draft.channels.length === 0) return 'Choose at least one alert channel.'
  return validateDestinations(draft.channels, draft.email, draft.phone)
}

export function loadWatches(): Watch[] {
  const stored = readJSON<Watch[]>(STORAGE_KEYS.watches, [])
  return Array.isArray(stored) ? stored : []
}

export function saveWatches(watches: Watch[]): void {
  writeJSON(STORAGE_KEYS.watches, watches)
}

export function removeWatch(watches: Watch[], id: string): Watch[] {
  return watches.filter((watch) => watch.id !== id)
}

export function toggleChannel(channels: AlertChannel[], channel: AlertChannel): AlertChannel[] {
  return channels.includes(channel)
    ? channels.filter((item) => item !== channel)
    : [...channels, channel]
}

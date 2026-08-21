export type Provider = 'microsoft' | 'google' | 'guest'

export interface User {
  id: string
  name: string
  email: string
  provider: Provider
}

export type AlertChannel = 'email' | 'sms' | 'whatsapp'

export interface Watch {
  id: string
  symbol: string
  /** Alert when the price drops by at least this percentage. */
  dipPercent: number
  /** Alert when the price rises by at least this percentage. */
  risePercent: number
  channels: AlertChannel[]
  /** Destination per channel: email address or phone number. */
  destination: string
}

export interface Quote {
  symbol: string
  price: number
  previousClose: number
  changePercent: number
  currency: string
  series: number[]
}

export interface TriggeredAlert {
  symbol: string
  direction: 'dip' | 'rise'
  changePercent: number
  threshold: number
  channels: AlertChannel[]
  destination: string
}

export type Theme = 'light' | 'dark'

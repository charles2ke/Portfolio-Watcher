import type { Provider, User } from './types'
import { STORAGE_KEYS, readJSON, remove, writeJSON } from './storage'

interface ProviderConfig {
  label: string
  authorizeUrl: string
  clientId: string
  scope: string
}

const NONCE_KEY = 'pw.auth.nonce'
const PENDING_KEY = 'pw.auth.pending'

/**
 * OAuth client ids are supplied at build time. When they are absent the app
 * runs in demo mode: sign-in creates a local-only session so that the static
 * site remains fully usable (and testable) without a backend.
 */
export function getProviderConfig(provider: Provider): ProviderConfig | null {
  const env = import.meta.env as Record<string, string | undefined>
  if (provider === 'google' && env.VITE_GOOGLE_CLIENT_ID) {
    return {
      label: 'Google',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      clientId: env.VITE_GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
    }
  }
  if (provider === 'microsoft' && env.VITE_MICROSOFT_CLIENT_ID) {
    const tenant = env.VITE_MICROSOFT_TENANT_ID ?? 'common'
    return {
      label: 'Microsoft',
      authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      clientId: env.VITE_MICROSOFT_CLIENT_ID,
      scope: 'openid email profile',
    }
  }
  return null
}

export function createNonce(random: () => number = Math.random): string {
  return `${Date.now().toString(36)}.${random().toString(36).slice(2, 12)}`
}

export function buildAuthorizeUrl(
  config: ProviderConfig,
  redirectUri: string,
  nonce: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'id_token',
    redirect_uri: redirectUri,
    scope: config.scope,
    response_mode: 'fragment',
    nonce,
    state: nonce,
  })
  return `${config.authorizeUrl}?${params.toString()}`
}

export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    const payload: unknown = JSON.parse(json)
    if (payload === null || typeof payload !== 'object') return null
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

export function guestUser(): User {
  return { id: 'guest', name: 'Guest', email: '', provider: 'guest' }
}

function demoUser(provider: Provider): User {
  const label = provider === 'google' ? 'Google' : 'Microsoft'
  return {
    id: `demo-${provider}`,
    name: `${label} Demo User`,
    email: `demo@${provider}.example`,
    provider,
  }
}

/**
 * Starts a sign-in. Returns a user when the session could be established
 * locally (guest or demo mode), or `null` when the browser is being redirected
 * to the identity provider.
 */
export function signIn(provider: Provider, redirect: (url: string) => void): User | null {
  if (provider === 'guest') return saveUser(guestUser())
  const config = getProviderConfig(provider)
  if (!config) return saveUser(demoUser(provider))
  const nonce = createNonce()
  writeJSON(NONCE_KEY, nonce)
  writeJSON(PENDING_KEY, provider)
  redirect(buildAuthorizeUrl(config, redirectUri(), nonce))
  return null
}

export function redirectUri(): string {
  const { origin, pathname } = globalThis.location
  return `${origin}${pathname}`
}

/** Completes a redirect sign-in by reading the URL fragment. */
export function completeSignIn(hash: string): User | null {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  const token = fragment.get('id_token')
  if (!token) return null
  const expectedNonce = readJSON<string | null>(NONCE_KEY, null)
  const payload = decodeJwtPayload(token)
  remove(NONCE_KEY)
  if (!payload) return null
  if (expectedNonce !== null && payload.nonce !== expectedNonce) return null
  const provider = readJSON<Provider>(PENDING_KEY, 'google')
  remove(PENDING_KEY)
  const email = typeof payload.email === 'string' ? payload.email : ''
  const name = typeof payload.name === 'string' ? payload.name : email || 'Signed in user'
  const id = typeof payload.sub === 'string' ? payload.sub : `${provider}-user`
  return saveUser({ id, name, email, provider })
}

export function saveUser(user: User): User {
  writeJSON(STORAGE_KEYS.user, user)
  return user
}

export function loadUser(): User | null {
  return readJSON<User | null>(STORAGE_KEYS.user, null)
}

export function signOut(): void {
  remove(STORAGE_KEYS.user)
}

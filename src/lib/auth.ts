import type { Provider, User } from './types'
import { STORAGE_KEYS, readJSON, remove, writeJSON } from './storage'

interface ProviderConfig {
  label: string
  authorizeUrl: string
  clientId: string
  scope: string
  /** Tenant the Microsoft token must come from; `common` accepts any tenant. */
  tenant?: string
}

const NONCE_KEY = 'pw.auth.nonce'
const STATE_KEY = 'pw.auth.state'
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
    const tenant = env.VITE_MICROSOFT_TENANT_ID?.trim() || 'common'
    return {
      label: 'Microsoft',
      authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      clientId: env.VITE_MICROSOFT_CLIENT_ID,
      scope: 'openid email profile',
      tenant,
    }
  }
  return null
}

/**
 * 128 bits of cryptographically secure randomness. The `nonce` and `state`
 * values are the only binding between a redirect we started and the token that
 * comes back, so they must never be guessable — `Math.random` is not.
 */
export function createNonce(): string {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function buildAuthorizeUrl(
  config: ProviderConfig,
  redirectUri: string,
  nonce: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'id_token',
    redirect_uri: redirectUri,
    scope: config.scope,
    response_mode: 'fragment',
    nonce,
    state,
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
  const state = createNonce()
  writeJSON(NONCE_KEY, nonce)
  writeJSON(STATE_KEY, state)
  writeJSON(PENDING_KEY, provider)
  redirect(buildAuthorizeUrl(config, redirectUri(), nonce, state))
  return null
}

export function redirectUri(): string {
  const { origin, pathname } = globalThis.location
  return `${origin}${pathname}`
}

/** Removes the id_token from the address bar once it has been consumed. */
function clearHash(): void {
  const { history, location } = globalThis
  history.replaceState(null, '', `${location.pathname}${location.search}`)
}

/**
 * Accepts only issuers that belong to the configured provider, so a token
 * minted by an unrelated identity provider cannot open a session here.
 */
export function isTrustedIssuer(provider: Provider, issuer: unknown, tenant?: string): boolean {
  if (typeof issuer !== 'string') return false
  if (provider === 'google') {
    return issuer === 'https://accounts.google.com' || issuer === 'accounts.google.com'
  }
  if (provider !== 'microsoft') return false
  const match = /^https:\/\/login\.microsoftonline\.com\/([^/]+)\/v2\.0$/.exec(issuer)
  if (!match) return false
  const multiTenant = tenant === undefined || ['common', 'organizations', 'consumers'].includes(tenant)
  return multiTenant || match[1].toLowerCase() === tenant.toLowerCase()
}

/**
 * Claim checks that can be done in a browser without a backend: the token must
 * come from the configured provider, be addressed to this client and still be
 * valid. Signature verification needs the provider's JWKS and a server-side
 * check, so the resulting session is trusted locally only — every request that
 * leaves the browser must be authorised by the receiving service itself.
 */
export function hasValidClaims(
  payload: Record<string, unknown>,
  config: ProviderConfig,
  provider: Provider,
  nowMs: number,
): boolean {
  if (!isTrustedIssuer(provider, payload.iss, config.tenant)) return false
  const audience = payload.aud
  const audiences = Array.isArray(audience) ? audience : [audience]
  if (!audiences.includes(config.clientId)) return false
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= nowMs) return false
  return true
}

/**
 * Completes a redirect sign-in by reading the URL fragment. The token is only
 * accepted when its `state` and `nonce` match the values created when the flow
 * started and its issuer, audience and expiry check out; the fragment is always
 * cleared so the token never lingers in the browser history.
 */
export function completeSignIn(hash: string, now: () => number = Date.now): User | null {
  const fragment = new URLSearchParams(hash.replace(/^#/, ''))
  const token = fragment.get('id_token')
  if (!token) return null
  const expectedNonce = readJSON<string | null>(NONCE_KEY, null)
  const expectedState = readJSON<string | null>(STATE_KEY, null)
  const payload = decodeJwtPayload(token)
  const provider = readJSON<Provider>(PENDING_KEY, 'google')
  remove(NONCE_KEY)
  remove(STATE_KEY)
  remove(PENDING_KEY)
  clearHash()
  if (!payload) return null
  if (expectedNonce === null || payload.nonce !== expectedNonce) return null
  if (expectedState === null || fragment.get('state') !== expectedState) return null
  const config = getProviderConfig(provider)
  if (!config || !hasValidClaims(payload, config, provider, now())) return null
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

/**
 * Signing out clears everything the app kept about the person, including the
 * watchlist — it holds the email addresses and phone numbers used for alerts,
 * which must not survive on a shared device after the session ends.
 */
export function signOut(): void {
  remove(STORAGE_KEYS.user)
  remove(STORAGE_KEYS.watches)
}

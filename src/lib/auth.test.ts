import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizeUrl,
  completeSignIn,
  createNonce,
  decodeJwtPayload,
  getProviderConfig,
  guestUser,
  loadUser,
  redirectUri,
  saveUser,
  signIn,
  signOut,
} from './auth'

afterEach(() => {
  vi.unstubAllEnvs()
})

function base64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function makeToken(payload: Record<string, unknown>): string {
  return `header.${base64Url(JSON.stringify(payload))}.signature`
}

/** Starts a redirect flow and returns the nonce and state to echo back. */
function startFlow(provider: 'google' | 'microsoft'): { nonce: string; state: string } {
  vi.stubEnv(provider === 'google' ? 'VITE_GOOGLE_CLIENT_ID' : 'VITE_MICROSOFT_CLIENT_ID', 'id')
  let authorizeUrl = ''
  signIn(provider, (url) => {
    authorizeUrl = url
  })
  const params = new URL(authorizeUrl).searchParams
  return { nonce: params.get('nonce')!, state: params.get('state')! }
}

function callbackHash(token: string, state: string): string {
  return `#id_token=${token}&state=${encodeURIComponent(state)}`
}

describe('provider configuration', () => {
  it('returns null when client ids are absent', () => {
    expect(getProviderConfig('google')).toBeNull()
    expect(getProviderConfig('microsoft')).toBeNull()
    expect(getProviderConfig('guest')).toBeNull()
  })

  it('builds a Google config', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-id')
    expect(getProviderConfig('google')).toMatchObject({
      label: 'Google',
      clientId: 'google-id',
    })
  })

  it('builds a Microsoft config with the default tenant', () => {
    vi.stubEnv('VITE_MICROSOFT_CLIENT_ID', 'ms-id')
    expect(getProviderConfig('microsoft')?.authorizeUrl).toContain('/common/')
  })

  it('builds a Microsoft config with a custom tenant', () => {
    vi.stubEnv('VITE_MICROSOFT_CLIENT_ID', 'ms-id')
    vi.stubEnv('VITE_MICROSOFT_TENANT_ID', 'contoso')
    expect(getProviderConfig('microsoft')?.authorizeUrl).toContain('/contoso/')
  })
})

describe('authorize url', () => {
  it('includes the OIDC parameters', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-id')
    const config = getProviderConfig('google')!
    const url = new URL(buildAuthorizeUrl(config, 'https://app.test/', 'nonce-1', 'state-1'))
    expect(url.searchParams.get('client_id')).toBe('google-id')
    expect(url.searchParams.get('response_type')).toBe('id_token')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.test/')
    expect(url.searchParams.get('nonce')).toBe('nonce-1')
    expect(url.searchParams.get('state')).toBe('state-1')
  })

  it('creates unique nonces', () => {
    expect(createNonce(() => 0.5)).toMatch(/\./)
    expect(createNonce()).not.toBe(createNonce(() => 0.1))
  })

  it('derives the redirect uri from the current location', () => {
    expect(redirectUri()).toBe(`${location.origin}${location.pathname}`)
  })
})

describe('decodeJwtPayload', () => {
  it('decodes a payload', () => {
    expect(decodeJwtPayload(makeToken({ email: 'a@b.co' }))).toEqual({ email: 'a@b.co' })
  })

  it('decodes unicode payloads', () => {
    expect(decodeJwtPayload(makeToken({ name: 'Ünicode ✓' }))).toEqual({ name: 'Ünicode ✓' })
  })

  it('rejects malformed tokens', () => {
    expect(decodeJwtPayload('not-a-token')).toBeNull()
    expect(decodeJwtPayload('a.!!!.c')).toBeNull()
    expect(decodeJwtPayload(`a.${btoa('"string"')}.c`)).toBeNull()
    expect(decodeJwtPayload(`a.${btoa('null')}.c`)).toBeNull()
  })
})

describe('sign in', () => {
  it('signs in as a guest without redirecting', () => {
    const redirect = vi.fn()
    expect(signIn('guest', redirect)).toEqual(guestUser())
    expect(redirect).not.toHaveBeenCalled()
    expect(loadUser()).toEqual(guestUser())
  })

  it('creates a demo session when the provider is not configured', () => {
    const redirect = vi.fn()
    expect(signIn('google', redirect)?.email).toBe('demo@google.example')
    expect(signIn('microsoft', redirect)?.name).toBe('Microsoft Demo User')
    expect(redirect).not.toHaveBeenCalled()
  })

  it('redirects to the provider when configured', () => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'google-id')
    const redirect = vi.fn()
    expect(signIn('google', redirect)).toBeNull()
    expect(redirect).toHaveBeenCalledWith(expect.stringContaining('accounts.google.com'))
  })
})

describe('completeSignIn', () => {
  it('returns null without a token', () => {
    expect(completeSignIn('')).toBeNull()
    expect(completeSignIn('#error=access_denied')).toBeNull()
  })

  it('returns null for an undecodable token', () => {
    startFlow('google')
    expect(completeSignIn('#id_token=garbage')).toBeNull()
  })

  it('clears the token from the url once consumed', () => {
    const { nonce, state } = startFlow('google')
    completeSignIn(callbackHash(makeToken({ sub: 'abc', nonce }), state))
    expect(window.location.hash).toBe('')
  })

  it('rejects a replayed token once the nonce is consumed', () => {
    const { nonce, state } = startFlow('google')
    const hash = callbackHash(makeToken({ sub: 'abc', nonce }), state)
    expect(completeSignIn(hash)).not.toBeNull()
    signOut()
    expect(completeSignIn(hash)).toBeNull()
  })

  it('rejects a mismatched state', () => {
    const { nonce } = startFlow('google')
    expect(completeSignIn(callbackHash(makeToken({ sub: 'abc', nonce }), 'forged'))).toBeNull()
  })

  it('creates a session from the id token', () => {
    const { nonce, state } = startFlow('google')
    const token = makeToken({ sub: 'abc', name: 'Ada', email: 'ada@example.com', nonce })
    const user = completeSignIn(callbackHash(token, state))
    expect(user).toEqual({
      id: 'abc',
      name: 'Ada',
      email: 'ada@example.com',
      provider: 'google',
    })
    expect(loadUser()).toEqual(user)
  })

  it('falls back to the email or a generic name', () => {
    const first = startFlow('google')
    expect(
      completeSignIn(callbackHash(makeToken({ email: 'x@y.co', nonce: first.nonce }), first.state)),
    ).toMatchObject({ name: 'x@y.co', id: 'google-user' })
    const second = startFlow('google')
    expect(
      completeSignIn(callbackHash(makeToken({ nonce: second.nonce }), second.state)),
    ).toMatchObject({ name: 'Signed in user', email: '' })
  })

  it('rejects a mismatched nonce', () => {
    const { state } = startFlow('microsoft')
    expect(completeSignIn(callbackHash(makeToken({ sub: 'abc', nonce: 'wrong' }), state))).toBeNull()
  })

  it('remembers the pending provider', () => {
    const { nonce, state } = startFlow('microsoft')
    const user = completeSignIn(callbackHash(makeToken({ sub: 'abc', nonce }), state))
    expect(user).toMatchObject({ provider: 'microsoft', id: 'abc' })
  })
})

describe('session', () => {
  it('loads and clears the stored user', () => {
    saveUser(guestUser())
    expect(loadUser()).toEqual(guestUser())
    signOut()
    expect(loadUser()).toBeNull()
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildAuthorizeUrl,
  completeSignIn,
  createNonce,
  decodeJwtPayload,
  getProviderConfig,
  guestUser,
  hasValidClaims,
  isTrustedIssuer,
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

const ISSUERS = {
  google: 'https://accounts.google.com',
  microsoft: 'https://login.microsoftonline.com/common/v2.0',
} as const

function rawToken(payload: Record<string, unknown>): string {
  return `header.${base64Url(JSON.stringify(payload))}.signature`
}

/** A token that satisfies the issuer, audience and expiry checks. */
function makeToken(payload: Record<string, unknown>): string {
  const claims = {
    iss: ISSUERS.google,
    aud: 'id',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...payload,
  }
  return `header.${base64Url(JSON.stringify(claims))}.signature`
}

/** Starts a redirect flow and returns the nonce and state to echo back. */
function startFlow(provider: 'google' | 'microsoft'): { nonce: string; state: string } {
  vi.stubEnv(provider === 'google' ? 'VITE_GOOGLE_CLIENT_ID' : 'VITE_MICROSOFT_CLIENT_ID', 'id')
  vi.stubEnv('VITE_MICROSOFT_TENANT_ID', '')
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

  it('creates unpredictable nonces', () => {
    expect(createNonce()).toMatch(/^[0-9a-f]{32}$/)
    expect(createNonce()).not.toBe(createNonce())
  })

  it('derives the redirect uri from the current location', () => {
    expect(redirectUri()).toBe(`${location.origin}${location.pathname}`)
  })
})

describe('decodeJwtPayload', () => {
  it('decodes a payload', () => {
    expect(decodeJwtPayload(rawToken({ email: 'a@b.co' }))).toEqual({ email: 'a@b.co' })
  })

  it('decodes unicode payloads', () => {
    expect(decodeJwtPayload(rawToken({ name: 'Ünicode ✓' }))).toEqual({ name: 'Ünicode ✓' })
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
    const token = makeToken({ sub: 'abc', nonce, iss: ISSUERS.microsoft })
    const user = completeSignIn(callbackHash(token, state))
    expect(user).toMatchObject({ provider: 'microsoft', id: 'abc' })
  })

  it('rejects a token from another issuer, audience or an expired one', () => {
    const forged = startFlow('google')
    const wrongIssuer = makeToken({ sub: 'abc', nonce: forged.nonce, iss: 'https://evil.test' })
    expect(completeSignIn(callbackHash(wrongIssuer, forged.state))).toBeNull()

    const other = startFlow('google')
    const wrongAudience = makeToken({ sub: 'abc', nonce: other.nonce, aud: 'another-app' })
    expect(completeSignIn(callbackHash(wrongAudience, other.state))).toBeNull()

    const stale = startFlow('google')
    const expired = makeToken({
      sub: 'abc',
      nonce: stale.nonce,
      exp: Math.floor(Date.now() / 1000) - 10,
    })
    expect(completeSignIn(callbackHash(expired, stale.state))).toBeNull()
  })

  it('rejects a callback for a provider that is no longer configured', () => {
    const { nonce, state } = startFlow('google')
    const token = makeToken({ sub: 'abc', nonce })
    vi.unstubAllEnvs()
    expect(completeSignIn(callbackHash(token, state))).toBeNull()
  })
})

describe('token claims', () => {
  const config = { label: 'Google', authorizeUrl: '', clientId: 'id', scope: '' }

  it('accepts only issuers belonging to the provider', () => {
    expect(isTrustedIssuer('google', 'accounts.google.com')).toBe(true)
    expect(isTrustedIssuer('google', ISSUERS.google)).toBe(true)
    expect(isTrustedIssuer('google', 42)).toBe(false)
    expect(isTrustedIssuer('guest', ISSUERS.google)).toBe(false)
    expect(isTrustedIssuer('microsoft', 'https://login.microsoftonline.com/tid/v2.0')).toBe(true)
    expect(isTrustedIssuer('microsoft', 'https://login.microsoftonline.com.evil.test/a/v2.0'))
      .toBe(false)
    expect(isTrustedIssuer('microsoft', 'https://login.microsoftonline.com/TID/v2.0', 'tid'))
      .toBe(true)
    expect(isTrustedIssuer('microsoft', 'https://login.microsoftonline.com/other/v2.0', 'tid'))
      .toBe(false)
    expect(isTrustedIssuer('microsoft', 'https://login.microsoftonline.com/any/v2.0', 'common'))
      .toBe(true)
  })

  it('accepts an audience list that contains the client id', () => {
    const base = { iss: ISSUERS.google, exp: Math.floor(Date.now() / 1000) + 60 }
    expect(hasValidClaims({ ...base, aud: ['id', 'other'] }, config, 'google', Date.now()))
      .toBe(true)
    expect(hasValidClaims({ ...base, aud: ['other'] }, config, 'google', Date.now())).toBe(false)
    expect(hasValidClaims({ ...base, aud: 'id', exp: undefined }, config, 'google', Date.now()))
      .toBe(false)
  })
})

describe('session', () => {
  it('loads and clears the stored user', () => {
    saveUser(guestUser())
    expect(loadUser()).toEqual(guestUser())
    signOut()
    expect(loadUser()).toBeNull()
  })

  it('clears the watchlist so alert destinations do not outlive the session', () => {
    saveUser(guestUser())
    localStorage.setItem('pw.watches', JSON.stringify([{ email: 'trader@example.com' }]))
    signOut()
    expect(localStorage.getItem('pw.watches')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { isSecureEndpoint } from './endpoints'

describe('isSecureEndpoint', () => {
  it('accepts https and same-origin paths', () => {
    expect(isSecureEndpoint('https://relay.example/alerts')).toBe(true)
    expect(isSecureEndpoint('/api/quote/')).toBe(true)
  })

  it('rejects plaintext, dangerous and malformed urls', () => {
    expect(isSecureEndpoint('http://relay.example/alerts')).toBe(false)
    expect(isSecureEndpoint('javascript:alert(1)')).toBe(false)
    expect(isSecureEndpoint('data:text/plain,hi')).toBe(false)
    expect(isSecureEndpoint('relay.example/alerts')).toBe(false)
  })
})

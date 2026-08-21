import { describe, expect, it } from 'vitest'
import { navigate } from './navigation'

describe('navigate', () => {
  it('delegates to location.assign', () => {
    navigate('#deep-link')
    expect(window.location.hash).toBe('#deep-link')
    window.location.hash = ''
  })
})

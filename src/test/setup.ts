import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom has no layout engine, so scrolling is a no-op rather than an error.
globalThis.scrollTo = () => {}

afterEach(() => {
  cleanup()
  localStorage.clear()
})

/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/** Hosts the browser may talk to, on top of the site's own origin. */
const VENDOR_ENDPOINTS = [
  'https://finnhub.io',
  'https://www.alphavantage.co',
]

function originOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

function contentSecurityPolicy(env: NodeJS.ProcessEnv): string {
  const connect = new Set(["'self'", ...VENDOR_ENDPOINTS])
  for (const key of ['VITE_QUOTE_API_URL', 'VITE_ALERT_WEBHOOK_URL']) {
    const origin = originOf(env[key])
    if (origin) connect.add(origin)
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    // Vite emits the app's CSS as a file; inline styles remain for React style props.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src ${[...connect].join(' ')}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * GitHub Pages cannot set response headers, so the policy ships as a meta tag.
 * It is injected on build only: the dev server needs inline scripts for HMR.
 */
function cspPlugin(): Plugin {
  return {
    name: 'portfolio-watcher-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: contentSecurityPolicy(process.env),
            },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

// `BASE_PATH` is set by the GitHub Pages workflow (e.g. /Portfolio-Watcher/).
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), cspPlugin()],
  build: {
    // The polyfill would add an inline script, which `script-src 'self'` blocks.
    modulePreload: { polyfill: false },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/vite-env.d.ts', 'src/lib/types.ts'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})

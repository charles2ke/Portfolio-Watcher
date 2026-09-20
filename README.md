# Portfolio Watcher

[![CI](https://github.com/charles2ke/Portfolio-Watcher/actions/workflows/ci.yml/badge.svg)](https://github.com/charles2ke/Portfolio-Watcher/actions/workflows/ci.yml)
[![Security](https://github.com/charles2ke/Portfolio-Watcher/actions/workflows/security.yml/badge.svg)](https://github.com/charles2ke/Portfolio-Watcher/actions/workflows/security.yml)
[![Deploy to GitHub Pages](https://github.com/charles2ke/Portfolio-Watcher/actions/workflows/pages.yml/badge.svg)](https://github.com/charles2ke/Portfolio-Watcher/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

An ultra-modern, mobile-first stock watchlist. Sign in with Microsoft, Google or as a guest, add
the ticker symbols you care about, choose the dip/rise percentage that should alert you, and pick
whether the alert goes out over email, SMS or WhatsApp.

🔗 **Live app:** https://charles2ke.github.io/Portfolio-Watcher/

## Contents

- [Features](#features)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [How it works](#how-it-works)
- [Project structure](#project-structure)
- [Security and privacy](#security-and-privacy)
- [Integrations](#integrations)
- [Testing](#testing)
- [Automation](#automation)
- [Scripts](#scripts)
- [Dependencies](#dependencies)
- [License](#license)

## Features

- **Sign in your way** — Microsoft (Entra ID), Google or a local guest session, with one-click logout.
- **Ticker watchlist** — add any symbol, set an independent dip % and rise % alert threshold.
- **Alert channels** — email, SMS and WhatsApp, with per-channel destination validation.
- **Google-style movement chart** — sparkline with price, currency and percentage change, refreshed
  every 15 seconds.
- **Dark theme toggle** — respects your system preference and remembers your choice.
- **Mobile first** — responsive layout, 44px touch targets and no horizontal overflow at 360px.

## Getting started

**Prerequisites:** Node.js 22 (the version used by CI) and npm.

```bash
npm install
npm run dev          # http://localhost:5173
```

Useful during development:

```bash
npm run lint         # oxlint
npm run typecheck    # tsc -b
npm run build        # production bundle in dist/
npm run preview      # serve the production bundle on http://localhost:4173
```

The app is a fully static single-page app: your session, watchlist and theme live in
`localStorage`, so it can be hosted on GitHub Pages without a backend.

## Configuration

All configuration is optional. Without it the app runs in demo mode: identity providers create a
local demo session and quotes come from a deterministic offline price series.

| Environment variable | Purpose |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Enables the real Google OpenID Connect sign-in flow. |
| `VITE_MICROSOFT_CLIENT_ID` | Enables the real Microsoft Entra ID sign-in flow. |
| `VITE_MICROSOFT_TENANT_ID` | Microsoft tenant to authenticate against (defaults to `common`). |
| `VITE_QUOTE_API_URL` | Self-hosted quote API prefix; the ticker symbol is appended to the URL. Takes precedence over `VITE_MARKET_PROVIDER`. |
| `VITE_MARKET_PROVIDER` | Market data vendor: `finnhub` or `alphavantage`. |
| `VITE_MARKET_API_KEY` | API key for the selected market data vendor. |
| `VITE_ALERT_WEBHOOK_URL` | Relay endpoint that delivers triggered alerts over email, SMS and WhatsApp. |

Add them to a `.env.local` file for local development, or as repository variables consumed by the
Pages workflow for production.

> **Every `VITE_` value is public.** It is inlined into the JavaScript bundle that anyone can read,
> so `VITE_MARKET_API_KEY` must be a read-only quote key you are happy to expose (or, better, keep
> the key in a proxy behind `VITE_QUOTE_API_URL`). `VITE_QUOTE_API_URL` and `VITE_ALERT_WEBHOOK_URL`
> are ignored unless they are HTTPS or a same-origin path.

## How it works

1. You sign in with Microsoft, Google or as a guest; the session is stored in `localStorage`.
2. You add ticker symbols and set an independent dip % and rise % threshold plus the alert
   channels and destinations for each one.
3. Quotes refresh every 15 seconds from the configured provider (or a deterministic offline series
   in demo mode) and feed the sparkline on each ticker card.
4. When a movement crosses a threshold the alert is shown in the alerts panel and, when configured,
   POSTed once to your relay, which is responsible for the actual email, SMS or WhatsApp delivery.

## Project structure

```
src/
  App.tsx              top-level state, routing and quote refresh loop
  components/          Header, LoginScreen, SetupPage, WatchForm, TickerCard, Sparkline, AlertsPanel, ThemeToggle
  lib/                 auth, market + quoteProviders, alerts, notifications, watchlist, storage, theme, endpoints, navigation helpers
  test/setup.ts        Vitest/Testing Library setup
e2e/                   Playwright specs (desktop + mobile projects)
scripts/               update-readme.mjs, which regenerates the auto-managed README sections
```

Unit tests sit next to the code they cover (`*.test.ts`/`*.test.tsx`).

## Security and privacy

- **Your data stays on your device.** The session, watchlist and theme live in `localStorage`; there
  is no Portfolio Watcher backend and nothing is analytics-tracked.
- **Signing out wipes it.** Logging out removes the session *and* the watchlist, because the
  watchlist holds the email addresses and phone numbers used for alerts — they must not outlive the
  session on a shared device.
- **What leaves the browser.** Ticker symbols go to the configured quote API; a triggered alert
  POSTs the symbol, the movement and the destinations you entered to your own relay. Both must be
  HTTPS. In demo mode nothing leaves the browser at all.
- **Sign-in.** OpenID Connect redirects use a `state` and `nonce` generated from
  `crypto.getRandomValues`, and the returned token is checked for issuer, audience and expiry before
  a session is created. The signature cannot be verified client-side, so the session is only
  trusted on this device — see [SECURITY.md](SECURITY.md).
- **Hardened page.** The published build ships a Content-Security-Policy meta tag (no inline
  scripts, an allow-list of the hosts it may call, `frame-ancestors 'none'`) and a
  `strict-origin-when-cross-origin` referrer policy.

Vulnerability reports are welcome — see [SECURITY.md](SECURITY.md).

## Integrations

| Integration | Configuration | Behaviour |
| --- | --- | --- |
| Microsoft Entra ID / Google | `VITE_MICROSOFT_CLIENT_ID`, `VITE_MICROSOFT_TENANT_ID`, `VITE_GOOGLE_CLIENT_ID` | Real OpenID Connect redirect sign-in; falls back to a local demo session. |
| Finnhub | `VITE_MARKET_PROVIDER=finnhub`, `VITE_MARKET_API_KEY` | Live price and previous close from `/quote`; the sparkline uses the day's open, low, high and current price. |
| Alpha Vantage | `VITE_MARKET_PROVIDER=alphavantage`, `VITE_MARKET_API_KEY` | Live price and previous close from `GLOBAL_QUOTE`; the sparkline uses the day's open, low, high and current price. |
| Self-hosted quote API | `VITE_QUOTE_API_URL` | The app's own contract: `{ price, previousClose?, currency?, series[] }`. |
| Alert relay (email / SMS / WhatsApp) | `VITE_ALERT_WEBHOOK_URL` | Every newly triggered threshold is POSTed once; the alerts panel shows `Sent`, `Failed` or `In-app only`. |

Any failing or missing integration degrades gracefully: quotes fall back to the deterministic
offline series and alerts remain visible in the app.

### Alert relay contract

The browser POSTs a JSON body to `VITE_ALERT_WEBHOOK_URL`:

```json
{
  "symbol": "MSFT",
  "direction": "dip",
  "changePercent": -6.1,
  "threshold": 5,
  "channels": ["email", "whatsapp"],
  "destinations": ["trader@example.com", "+15551234567"],
  "message": "MSFT dropped 6.10% (threshold 5%) — notifying …",
  "sentAt": "2024-01-02T15:04:05.000Z"
}
```

Point it at a small serverless function that forwards the payload to your providers (for example
SendGrid for email and Twilio for SMS and WhatsApp). Because this is a static site, provider
credentials must live in that relay — never in the frontend bundle. Anything in a `VITE_` variable
is public, so scope market data keys to read-only quote access. Authenticate and rate-limit the
relay itself (for example an origin allow-list or a secret known only to the relay) — a browser
cannot hold a credential that stays secret.

## Testing

```bash
npm run test       # unit + component tests (Vitest)
npm run test:watch # the same tests in watch mode
npm run coverage   # unit + component tests, enforced at 100% coverage
npm run test:e2e   # Playwright end-to-end tests (desktop + mobile projects)
```

Playwright runs against the production preview server, so run `npx playwright install --with-deps`
once before the first end-to-end run. CI runs lint, typecheck, build, coverage and Playwright on
every push and pull request, so run the same commands locally before opening one.

### Coverage

<!-- coverage:start -->
| Metric | Coverage |
| --- | --- |
| statements | 100% |
| branches | 100% |
| functions | 100% |
| lines | 100% |
<!-- coverage:end -->

## Automation

| Workflow | What it does |
| --- | --- |
| `ci.yml` | Lint, typecheck, build, 100%-coverage unit tests and Playwright tests on every push and PR. |
| `security.yml` | CodeQL analysis, `npm audit` dependency scanning and a scheduled auto-fix pull request. |
| `readme.yml` | Regenerates the auto-managed README sections whenever the project metadata changes. |
| `pages.yml` | Builds and publishes the site to GitHub Pages on every push to `main`. |

Publishing requires a one-time repository setup: open **Settings → Pages** and set
**Source** to **GitHub Actions**. The workflow token cannot enable Pages by itself.

While **Source** is still **Deploy from a branch**, GitHub also runs its built-in
`pages build and deployment` job on every push. That job builds the repository root with Jekyll
and, because it usually finishes after `pages.yml`, it replaces the Vite bundle with the unbuilt
source `index.html` — the live site then loads `/src/main.tsx`, which the browser cannot execute,
and renders a blank page. Switching **Source** to **GitHub Actions** stops that job from running.
`public/.nojekyll` is published alongside the bundle so the output is never Jekyll-processed.

## Scripts

The table below is regenerated from `package.json` by `npm run readme` — edit the scripts there,
not here.

<!-- scripts:start -->
| Script | Description |
| --- | --- |
| `npm run dev` | `vite` |
| `npm run build` | `tsc -b && vite build` |
| `npm run lint` | `oxlint` |
| `npm run preview` | `vite preview --port 4173` |
| `npm run test` | `vitest run` |
| `npm run test:watch` | `vitest` |
| `npm run coverage` | `vitest run --coverage` |
| `npm run test:e2e` | `playwright test` |
| `npm run typecheck` | `tsc -b` |
| `npm run readme` | `node scripts/update-readme.mjs` |
<!-- scripts:end -->

## Dependencies

<!-- dependencies:start -->
| Package | Version |
| --- | --- |
| @playwright/test | ^1.62.1 |
| @testing-library/jest-dom | ^7.0.1 |
| @testing-library/react | ^16.3.2 |
| @testing-library/user-event | ^14.6.5 |
| @types/node | ^24.13.3 |
| @types/react | ^19.2.17 |
| @types/react-dom | ^19.2.3 |
| @vitejs/plugin-react | ^6.0.4 |
| @vitest/coverage-v8 | ^4.1.11 |
| jsdom | ^30.0.1 |
| oxlint | ^1.75.0 |
| react | ^19.2.8 |
| react-dom | ^19.2.8 |
| typescript | ~6.0.2 |
| vite | ^8.2.0 |
| vitest | ^4.1.11 |
<!-- dependencies:end -->

## License

[MIT](LICENSE)

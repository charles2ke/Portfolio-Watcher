# Portfolio Watcher

An ultra-modern, mobile-first stock watchlist. Sign in with Microsoft, Google or as a guest, add
the ticker symbols you care about, choose the dip/rise percentage that should alert you, and pick
whether the alert goes out over email, SMS or WhatsApp.

🔗 **Live app:** https://charles2ke.github.io/Portfolio-Watcher/

## Features

- **Sign in your way** — Microsoft (Entra ID), Google or a local guest session, with one-click logout.
- **Ticker watchlist** — add any symbol, set an independent dip % and rise % alert threshold.
- **Alert channels** — email, SMS and WhatsApp, with per-channel destination validation.
- **Google-style movement chart** — sparkline with price, currency and percentage change, refreshed
  every 15 seconds.
- **Dark theme toggle** — respects your system preference and remembers your choice.
- **Mobile first** — responsive layout, 44px touch targets and no horizontal overflow at 360px.

## Getting started

```bash
npm install
npm run dev
```

The app is a fully static single-page app: your session, watchlist and theme live in
`localStorage`, so it can be hosted on GitHub Pages without a backend.

### Configuration

All configuration is optional. Without it the app runs in demo mode: identity providers create a
local demo session and quotes come from a deterministic offline price series.

| Environment variable | Purpose |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Enables the real Google OpenID Connect sign-in flow. |
| `VITE_MICROSOFT_CLIENT_ID` | Enables the real Microsoft Entra ID sign-in flow. |
| `VITE_MICROSOFT_TENANT_ID` | Microsoft tenant to authenticate against (defaults to `common`). |
| `VITE_QUOTE_API_URL` | Quote API prefix; the ticker symbol is appended to the URL. |

Add them to a `.env.local` file for local development, or as repository variables consumed by the
Pages workflow for production.

## Testing

```bash
npm run coverage   # unit + component tests, enforced at 100% coverage
npm run test:e2e   # Playwright end-to-end tests (desktop + mobile projects)
```

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

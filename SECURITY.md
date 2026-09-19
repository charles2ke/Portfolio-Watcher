# Security Policy

## Supported versions

Portfolio Watcher is a static single-page app deployed continuously from `main`. Only the version
currently published at <https://charles2ke.github.io/Portfolio-Watcher/> — the latest commit on
`main` — receives security fixes.

| Version | Supported |
| ------- | --------- |
| `main` (latest deployment) | :white_check_mark: |
| Older commits / forks | :x: |

## Reporting a vulnerability

Please report vulnerabilities privately through
[GitHub Security Advisories](https://github.com/charles2ke/Portfolio-Watcher/security/advisories/new).
Do not open a public issue for an unfixed vulnerability.

Include the affected URL or file, the steps to reproduce, and the impact you observed.

- You can expect an acknowledgement within 7 days.
- Accepted reports are fixed on `main` and deployed automatically; you will be credited in the
  advisory unless you prefer otherwise.
- Declined reports come with an explanation of why the behaviour is considered out of scope.

## Security model

The app is a browser-only client with no backend of its own:

- **Sessions are local.** Sign-in uses OpenID Connect redirects; the returned `id_token` is only
  accepted when the `state` and `nonce` match the values created for that redirect (128 bits of
  `crypto.getRandomValues` entropy) and when its issuer, audience and expiry check out. The token
  signature cannot be verified in the browser, so the session is trusted **on this device only** —
  any service that receives data from the app must authenticate the request itself.
- **No secrets in the bundle.** Anything exposed through a `VITE_` variable is public in the
  compiled JavaScript. Market-data keys must be read-only quote keys — or, better, kept in a proxy
  behind `VITE_QUOTE_API_URL`. Email, SMS and WhatsApp provider credentials must live only in the
  alert relay.
- **HTTPS only.** The configured quote API and alert webhook are ignored unless they are HTTPS (or
  a same-origin path), so watchlist data never travels in the clear.
- **Defence in depth in the browser.** The built page ships a Content-Security-Policy meta tag
  (`default-src 'self'`, no inline scripts, a `connect-src` allow-list, `frame-ancestors 'none'`)
  and a `strict-origin-when-cross-origin` referrer policy.

## Automated checks

Every push and pull request runs CodeQL analysis and `npm audit --audit-level=high`; a weekly
scheduled job opens a pull request with dependency fixes.

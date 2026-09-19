/**
 * Only absolute HTTPS endpoints (or a same-origin path) are accepted for the
 * configurable integrations, so watchlist data and alert destinations — email
 * addresses and phone numbers — are never sent in the clear over `http:` or
 * handed to a `javascript:`/`data:` URL.
 */
export function isSecureEndpoint(url: string): boolean {
  if (url.startsWith('/') && !url.startsWith('//')) return true
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

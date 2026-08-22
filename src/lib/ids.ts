/** Generates a unique watch id, with a fallback for older browsers. */
export function newId(): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') return cryptoApi.randomUUID()
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

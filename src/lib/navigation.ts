/** Thin wrapper so navigation can be stubbed in tests. */
export function navigate(url: string): void {
  globalThis.location.assign(url)
}

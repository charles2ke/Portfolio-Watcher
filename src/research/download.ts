/** Browser download helpers for CSV/XLSX/PDF exports. */

export function downloadText(filename: string, mimeType: string, contents: string): boolean {
  const url = globalThis.URL?.createObjectURL
  if (!url) return false
  const blob = new Blob([contents], { type: mimeType })
  const href = globalThis.URL.createObjectURL(blob)
  const anchor = globalThis.document.createElement('a')
  anchor.href = href
  anchor.download = filename
  anchor.rel = 'noopener'
  globalThis.document.body.append(anchor)
  anchor.click()
  anchor.remove()
  globalThis.URL.revokeObjectURL(href)
  return true
}

export function downloadCsv(filename: string, contents: string): boolean {
  return downloadText(filename, 'text/csv;charset=utf-8', contents)
}

export function downloadXlsx(filename: string, contents: string): boolean {
  return downloadText(filename, 'application/vnd.ms-excel;charset=utf-8', contents)
}

/**
 * PDF export goes through the browser print dialog on a generated document,
 * which keeps the bundle free of a PDF rendering dependency.
 */
export function printHtml(html: string): boolean {
  const target = globalThis.open('', '_blank', 'noopener,noreferrer')
  if (!target) return false
  target.document.write(html)
  target.document.close()
  target.focus()
  target.print()
  return true
}

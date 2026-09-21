import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadCsv, downloadText, downloadXlsx, printHtml } from './download'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('download helpers', () => {
  it('creates and revokes an object URL for text exports', () => {
    const createObjectURL = vi.fn(() => 'blob:mock')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...globalThis.URL, createObjectURL, revokeObjectURL })
    const click = vi.spyOn(globalThis.HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    expect(downloadText('a.txt', 'text/plain', 'hello')).toBe(true)
    expect(downloadCsv('a.csv', 'a,b')).toBe(true)
    expect(downloadXlsx('a.xls', '<Workbook/>')).toBe(true)
    expect(click).toHaveBeenCalledTimes(3)
    expect(revokeObjectURL).toHaveBeenCalledTimes(3)
    expect(globalThis.document.querySelectorAll('a')).toHaveLength(0)
  })

  it('reports failure when object URLs are unavailable', () => {
    vi.stubGlobal('URL', {})
    expect(downloadText('a.txt', 'text/plain', 'hello')).toBe(false)
  })

  it('prints a report through a new window', () => {
    const target = {
      document: { write: vi.fn(), close: vi.fn() },
      focus: vi.fn(),
      print: vi.fn(),
    }
    vi.stubGlobal('open', vi.fn(() => target))
    expect(printHtml('<p>report</p>')).toBe(true)
    expect(target.document.write).toHaveBeenCalledWith('<p>report</p>')
    expect(target.print).toHaveBeenCalled()
  })

  it('reports failure when the print window is blocked', () => {
    vi.stubGlobal('open', vi.fn(() => null))
    expect(printHtml('<p>report</p>')).toBe(false)
  })
})

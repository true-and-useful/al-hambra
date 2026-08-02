import { describe, expect, it, vi } from 'vitest'
import {
  buildStandaloneSvgDocument,
  downloadBlob,
  fitRasterDimensions,
  rasterizeSvgToPng,
  type RasterPlatform,
} from '../src/export.ts'

const options = {
  width: 1600,
  height: 1200,
  viewBox: '0 0 4 3',
  metadata: {
    designId: 'tenfold',
    title: 'Tenfold & blue',
    relationship: 'adapted from' as const,
    sourceUrl: 'https://example.com/pattern?a=1&b=2',
  },
}

describe('standalone SVG export', () => {
  it('wraps the live body with dimensions, namespace, title, and escaped provenance', () => {
    const result = buildStandaloneSvgDocument(
      '<defs><pattern id="p"/></defs><rect width="100%" height="100%" fill="url(#p)"/>',
      options,
    )
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(result).toContain('width="1600" height="1200" viewBox="0 0 4 3"')
    expect(result).toContain('<title>Tenfold &amp; blue</title>')
    expect(result).toContain('relationship="adapted from"')
    expect(result).toContain('source-url="https://example.com/pattern?a=1&amp;b=2"')
    expect(result).toContain('fill="url(#p)"')
  })

  it('rejects app CSS and network dependencies', () => {
    expect(() => buildStandaloneSvgDocument('<path stroke="var(--ink)"/>', options)).toThrow()
    expect(() => buildStandaloneSvgDocument('<image href="https://example.com/a.png"/>', options)).toThrow()
    expect(() => buildStandaloneSvgDocument('<style>path{fill:red}</style>', options)).toThrow()
  })

  it('fits a documented high-resolution size to a 4096px longest edge', () => {
    expect(fitRasterDimensions(4, 3)).toEqual({ width: 4096, height: 3072 })
    expect(fitRasterDimensions(2, 4, 1000)).toEqual({ width: 500, height: 1000 })
  })
})

describe('PNG and download browser boundaries', () => {
  it('rasterizes the exact SVG and always revokes its temporary URL', async () => {
    const png = new Blob(['png'], { type: 'image/png' })
    const draw = vi.fn()
    const platform: RasterPlatform = {
      createObjectURL: vi.fn(() => 'blob:svg'),
      revokeObjectURL: vi.fn(),
      loadImage: vi.fn(async () => ({ width: 4, height: 3 }) as never),
      createCanvas: vi.fn(() => ({ draw, toBlob: vi.fn(async () => png) })),
    }
    await expect(rasterizeSvgToPng('<svg/>', { width: 400, height: 300 }, platform)).resolves.toBe(png)
    expect(draw).toHaveBeenCalledWith(expect.anything(), 400, 300)
    expect(platform.revokeObjectURL).toHaveBeenCalledWith('blob:svg')
  })

  it('revokes the download URL after triggering the browser action', () => {
    const calls: string[] = []
    downloadBlob(new Blob(['x']), 'pattern.svg', {
      createObjectURL: () => 'blob:download',
      clickDownload: (url, name) => calls.push(`${url}:${name}`),
      revokeObjectURL: (url) => calls.push(`revoke:${url}`),
      scheduleRevoke: (callback) => callback(),
    })
    expect(calls).toEqual(['blob:download:pattern.svg', 'revoke:blob:download'])
  })
})

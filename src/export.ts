export type SourceRelationship = 'based on' | 'adapted from' | 'inspired by'

export type ExportMetadata = Readonly<{
  designId: string
  title: string
  relationship: SourceRelationship
  sourceUrl: string
}>

export type SvgExportOptions = Readonly<{
  width: number
  height: number
  viewBox: string
  metadata: ExportMetadata
}>

export type RasterDimensions = Readonly<{ width: number; height: number }>

export type RasterImage = CanvasImageSource & Readonly<{ width: number; height: number }>

export type RasterCanvas = Readonly<{
  draw(image: RasterImage, width: number, height: number): void
  toBlob(type: 'image/png'): Promise<Blob>
}>

export type RasterPlatform = Readonly<{
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
  loadImage(url: string): Promise<RasterImage>
  createCanvas(width: number, height: number): RasterCanvas
}>

export type DownloadPlatform = Readonly<{
  createObjectURL(blob: Blob): string
  revokeObjectURL(url: string): void
  clickDownload(url: string, fileName: string): void
  scheduleRevoke(callback: () => void): void
}>

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>'

function assertPositiveDimension(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${name} must be positive and finite`)
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function assertSelfContainedSvgBody(body: string): void {
  const forbiddenMarkup = /<(?:script|foreignObject|style)\b|\bstyle\s*=|\bvar\s*\(/i
  if (forbiddenMarkup.test(body)) {
    throw new Error('SVG export contains script, embedded CSS, or inherited CSS variables')
  }

  const hrefPattern = /(?:href|xlink:href)\s*=\s*(["'])(.*?)\1/gi
  for (const match of body.matchAll(hrefPattern)) {
    const href = match[2]
    if (href && !href.startsWith('#')) throw new Error(`SVG export contains external href: ${href}`)
  }

  const urlPattern = /url\(\s*(["']?)(.*?)\1\s*\)/gi
  for (const match of body.matchAll(urlPattern)) {
    const url = match[2]
    if (url && !url.startsWith('#')) throw new Error(`SVG export contains external URL: ${url}`)
  }
}

export function buildStandaloneSvgDocument(body: string, options: SvgExportOptions): string {
  assertPositiveDimension(options.width, 'SVG width')
  assertPositiveDimension(options.height, 'SVG height')
  assertSelfContainedSvgBody(body)
  const metadata = options.metadata
  const metadataElement = [
    '<metadata>',
    `<pattern-source design-id="${escapeXml(metadata.designId)}"`,
    ` title="${escapeXml(metadata.title)}"`,
    ` relationship="${escapeXml(metadata.relationship)}"`,
    ` source-url="${escapeXml(metadata.sourceUrl)}"/>`,
    '</metadata>',
  ].join('')

  return [
    XML_HEADER,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${options.width}" height="${options.height}"`,
    ` viewBox="${escapeXml(options.viewBox)}" role="img" aria-label="${escapeXml(metadata.title)}">`,
    `<title>${escapeXml(metadata.title)}</title>`,
    metadataElement,
    body,
    '</svg>',
  ].join('')
}

/** Clones the rendered contents into a new root with no dependency on app CSS. */
export function serializeStandaloneSvg(source: SVGSVGElement, options: SvgExportOptions): string {
  return buildStandaloneSvgDocument(source.innerHTML, options)
}

export function fitRasterDimensions(
  aspectWidth: number,
  aspectHeight: number,
  maxEdge = 4096,
): RasterDimensions {
  assertPositiveDimension(aspectWidth, 'Aspect width')
  assertPositiveDimension(aspectHeight, 'Aspect height')
  assertPositiveDimension(maxEdge, 'Maximum edge')
  const scale = maxEdge / Math.max(aspectWidth, aspectHeight)
  return {
    width: Math.max(1, Math.round(aspectWidth * scale)),
    height: Math.max(1, Math.round(aspectHeight * scale)),
  }
}

function browserRasterPlatform(): RasterPlatform {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    loadImage: (url) => new Promise((resolve, reject) => {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Could not decode SVG for PNG export'))
      image.src = url
    }),
    createCanvas: (width, height) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d', { alpha: true, colorSpace: 'srgb' })
      if (!context) throw new Error('2D canvas is unavailable')
      return {
        draw: (image, drawWidth, drawHeight) => context.drawImage(image, 0, 0, drawWidth, drawHeight),
        toBlob: (type) => new Promise((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Browser could not encode PNG export'))
          }, type)
        }),
      }
    },
  }
}

export async function rasterizeSvgToPng(
  svgDocument: string,
  dimensions: RasterDimensions,
  platform: RasterPlatform = browserRasterPlatform(),
): Promise<Blob> {
  assertPositiveDimension(dimensions.width, 'PNG width')
  assertPositiveDimension(dimensions.height, 'PNG height')
  if (Math.max(dimensions.width, dimensions.height) > 4096) {
    throw new RangeError('PNG export is capped at 4096 px on its longest edge')
  }

  const svgBlob = new Blob([svgDocument], { type: 'image/svg+xml;charset=utf-8' })
  const objectUrl = platform.createObjectURL(svgBlob)
  try {
    const image = await platform.loadImage(objectUrl)
    const canvas = platform.createCanvas(dimensions.width, dimensions.height)
    canvas.draw(image, dimensions.width, dimensions.height)
    return await canvas.toBlob('image/png')
  } finally {
    platform.revokeObjectURL(objectUrl)
  }
}

export function downloadBlob(
  blob: Blob,
  fileName: string,
  platform: DownloadPlatform = browserDownloadPlatform(),
): void {
  const objectUrl = platform.createObjectURL(blob)
  try {
    platform.clickDownload(objectUrl, fileName)
  } finally {
    platform.scheduleRevoke(() => platform.revokeObjectURL(objectUrl))
  }
}

function browserDownloadPlatform(): DownloadPlatform {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => URL.revokeObjectURL(url),
    scheduleRevoke: (callback) => window.setTimeout(callback, 1_000),
    clickDownload: (url, fileName) => {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
    },
  }
}

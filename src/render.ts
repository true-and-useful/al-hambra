import type { AppStateV1 } from './state'
import type {
  Crossing,
  PeriodicGraph,
  RenderScene,
  ScenePath,
  Vec2,
} from './geometry/types'
import type { Palette } from './palettes'

export const RENDER_VIEWBOX = Object.freeze({ width: 1200, height: 800 })

type TileMetrics = Readonly<{
  width: number
  height: number
  rows: number
}>

const number = (value: number): string => Number(value.toFixed(3)).toString()

function pathData(path: ScenePath, dx = 0, dy = 0): string {
  const points = path.points
  if (points.length === 0) return ''
  const first = points[0]
  if (!first) return ''
  const commands = [`M ${number(first.x + dx)} ${number(first.y + dy)}`]
  for (const point of points.slice(1)) {
    commands.push(`L ${number(point.x + dx)} ${number(point.y + dy)}`)
  }
  if (path.closed) commands.push('Z')
  return commands.join(' ')
}

function tileMetrics(scene: RenderScene): TileMetrics {
  const { a, b } = scene.cell
  const oblique = Math.abs(b.x) > 0.001
  return {
    width: Math.abs(a.x),
    height: Math.abs(b.y) * (oblique ? 2 : 1),
    rows: oblique ? 2 : 1,
  }
}

function latticeTranslations(scene: RenderScene, rows: number): Vec2[] {
  const { a, b } = scene.cell
  if (rows === 1) return [{ x: 0, y: 0 }]
  const translations: Vec2[] = []
  for (let v = 0; v < rows; v += 1) {
    for (let u = -1; u <= 0; u += 1) {
      translations.push({ x: u * a.x + v * b.x, y: u * a.y + v * b.y })
    }
  }
  return translations
}

function strokeMarkup(
  d: string,
  palette: Palette,
  material: number,
  role: ScenePath['role'],
): string {
  if (!d) return ''
  const lineWidth = 2.2 + material * 15
  const bandWidth = 2.8 + material * 24
  const roleScale = role === 'strand' ? 0.42 : role === 'accent' ? 0.3 : 1
  const width = (material < 0.18 ? lineWidth : bandWidth) * roleScale
  const color = role === 'accent' ? palette.accent : palette.strand
  const opacity = role === 'strand' ? 0.2 + material * 0.12 : role === 'accent' ? 0.82 : 0.96
  const common = `d="${d}" fill="none" stroke-linecap="square" stroke-linejoin="miter"`

  if (material < 0.18) {
    return `<path ${common} stroke="${color}" stroke-width="${number(width)}" opacity="${number(opacity)}"/>`
  }

  const edgeWidth = width + (role === 'ornament' ? 4 + material * 3 : 2)
  const highlightWidth = Math.max(0.8, width * 0.1)
  return [
    `<path ${common} stroke="${palette.edge}" stroke-width="${number(edgeWidth)}" opacity="${number(opacity)}"/>`,
    `<path ${common} stroke="${color}" stroke-width="${number(width)}" opacity="${number(opacity)}"/>`,
    `<path ${common} stroke="${palette.highlight}" stroke-width="${number(highlightWidth)}" opacity="${number(0.08 + material * 0.16)}"/>`,
  ].join('')
}

function crossingDirection(
  graph: PeriodicGraph,
  crossing: Crossing,
): Readonly<{ start: Vec2; end: Vec2 }> | undefined {
  const vertices = new Map(graph.vertices.map((vertex) => [vertex.id, vertex]))
  const edges = new Map(graph.halfEdges.map((edge) => [edge.id, edge]))
  const pair = crossing.continuations[crossing.overPair]
  const edge = edges.get(pair[0])
  const twin = edge ? edges.get(edge.twin) : undefined
  const center = vertices.get(crossing.vertex)?.position
  const toward = twin ? vertices.get(twin.origin)?.position : undefined
  if (!center || !toward) return undefined
  const dx = toward.x - center.x
  const dy = toward.y - center.y
  const magnitude = Math.hypot(dx, dy)
  if (magnitude === 0) return undefined
  const span = 36
  const ux = (dx / magnitude) * span
  const uy = (dy / magnitude) * span
  return {
    start: { x: center.x - ux, y: center.y - uy },
    end: { x: center.x + ux, y: center.y + uy },
  }
}

function crossingMarkup(
  scene: RenderScene,
  palette: Palette,
  material: number,
  translation: Vec2,
): string {
  if (material < 0.18) return ''
  const bandWidth = (2.8 + material * 24) * 0.42
  const edgeWidth = bandWidth + 2
  return scene.graph.crossings.map((crossing) => {
    const segment = crossingDirection(scene.graph, crossing)
    if (!segment) return ''
    const x1 = segment.start.x + translation.x
    const y1 = segment.start.y + translation.y
    const x2 = segment.end.x + translation.x
    const y2 = segment.end.y + translation.y
    const coords = `x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}" stroke-linecap="square"`
    return [
      `<line ${coords} stroke="${palette.background}" stroke-width="${number(edgeWidth + 7)}" opacity="0.32"/>`,
      `<line ${coords} stroke="${palette.edge}" stroke-width="${number(edgeWidth)}" opacity="0.32"/>`,
      `<line ${coords} stroke="${palette.strand}" stroke-width="${number(bandWidth)}" opacity="0.32"/>`,
    ].join('')
  }).join('')
}

function patternContent(scene: RenderScene, palette: Palette, material: number): string {
  const metrics = tileMetrics(scene)
  const translations = latticeTranslations(scene, metrics.rows)
  const paths = translations.map((translation) =>
    scene.paths.map((path) => strokeMarkup(
      pathData(path, translation.x, translation.y),
      palette,
      material,
      path.role,
    )).join(''),
  ).join('')
  const crossings = translations.map((translation) =>
    crossingMarkup(scene, palette, material, translation),
  ).join('')
  return `${paths}${crossings}`
}

export function renderSceneMarkup(
  scene: RenderScene,
  state: AppStateV1,
  palette: Palette,
): string {
  const metrics = tileMetrics(scene)
  const cellCenter = {
    x: scene.cell.origin.x + (scene.cell.a.x + scene.cell.b.x) / 2,
    y: scene.cell.origin.y + (scene.cell.a.y + scene.cell.b.y) / 2,
  }
  const offsetX =
    RENDER_VIEWBOX.width / 2 - cellCenter.x * state.view.scale +
    (0.5 - state.view.cx) * metrics.width * state.view.scale
  const offsetY =
    RENDER_VIEWBOX.height / 2 - cellCenter.y * state.view.scale +
    (0.5 - state.view.cy) * metrics.height * state.view.scale
  const transform = `translate(${number(offsetX)} ${number(offsetY)}) scale(${number(state.view.scale)})`
  return [
    '<defs>',
    `<pattern id="ornament" patternUnits="userSpaceOnUse" width="${number(metrics.width)}" height="${number(metrics.height)}" patternTransform="${transform}">`,
    `<rect x="0" y="0" width="${number(metrics.width)}" height="${number(metrics.height)}" fill="${palette.background}"/>`,
    patternContent(scene, palette, state.material),
    '</pattern>',
    '</defs>',
    `<rect x="0" y="0" width="${RENDER_VIEWBOX.width}" height="${RENDER_VIEWBOX.height}" fill="${palette.background}"/>`,
    `<rect x="0" y="0" width="${RENDER_VIEWBOX.width}" height="${RENDER_VIEWBOX.height}" fill="url(#ornament)"/>`,
  ].join('')
}

export function renderScene(
  svg: SVGSVGElement,
  scene: RenderScene,
  state: AppStateV1,
  palette: Palette,
): void {
  svg.setAttribute('viewBox', `0 0 ${RENDER_VIEWBOX.width} ${RENDER_VIEWBOX.height}`)
  svg.setAttribute('width', String(RENDER_VIEWBOX.width))
  svg.setAttribute('height', String(RENDER_VIEWBOX.height))
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', 'A continuously adjustable Islamic geometric pattern')
  svg.innerHTML = renderSceneMarkup(scene, state, palette)
}

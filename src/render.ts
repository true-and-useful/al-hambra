import type { AppStateV1 } from './state'
import { translateByWrap } from './geometry/kernel'
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
  oblique: boolean
}>

type TileTranslation = Readonly<Vec2 & { u: number; v: number }>

const number = (value: number): string => Number(value.toFixed(3)).toString()

function smoothstep(from: number, to: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

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
  const phaseU = scene.graph.crossings.some((crossing) => crossing.weavePhase.u === 1)
  const horizontalScale = phaseU ? 2 : 1
  const verticalScale = oblique
    ? (phaseU ? 2 : 1)
    : (scene.graph.crossings.some((crossing) => crossing.weavePhase.v === 1) ? 2 : 1)
  return {
    width: Math.abs(a.x) * horizontalScale,
    height: Math.abs(b.y) * (oblique ? 2 : 1) * verticalScale,
    oblique,
  }
}

/**
 * How far, in whole cells, the drawn geometry reaches outside its own cell.
 *
 * Strapwork runs for several cells before it closes, so a tile that only drew
 * its own cell would be clipped at the pattern boundary and leave visible gaps.
 * Every neighbour within this radius is drawn too, and the pattern tile clips
 * the excess.
 */
function decorationHalo(scene: RenderScene): Readonly<{ u: number; v: number }> {
  const { a, b } = scene.cell
  const determinant = a.x * b.y - a.y * b.x
  if (Math.abs(determinant) < 1e-9) return { u: 1, v: 1 }
  let halo = { u: 1, v: 1 }
  for (const path of scene.paths) {
    for (const point of path.points) {
      const x = point.x - scene.cell.origin.x
      const y = point.y - scene.cell.origin.y
      const u = (x * b.y - y * b.x) / determinant
      const v = (a.x * y - a.y * x) / determinant
      halo = {
        u: Math.max(halo.u, Math.ceil(Math.abs(u)) + 1),
        v: Math.max(halo.v, Math.ceil(Math.abs(v)) + 1),
      }
    }
  }
  return halo
}

function latticeTranslations(scene: RenderScene, metrics: TileMetrics): TileTranslation[] {
  const { a, b } = scene.cell
  const uCells = Math.round(metrics.width / Math.abs(a.x))
  const vCells = Math.round(metrics.height / Math.abs(b.y))
  const halo = decorationHalo(scene)
  const translations: TileTranslation[] = []
  for (let v = -halo.v; v < vCells + halo.v; v += 1) {
    const shiftX = v * b.x
    const minimumU = metrics.oblique ? Math.floor(-shiftX / a.x) : 0
    const maximumU = metrics.oblique
      ? Math.ceil((metrics.width - shiftX) / a.x) - 1
      : uCells - 1
    for (let u = minimumU - halo.u; u <= maximumU + halo.u; u += 1) {
      translations.push({ x: u * a.x + v * b.x, y: u * a.y + v * b.y, u, v })
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
  const bandWidth = 2.2 + material * 24.6
  const roleScale = role === 'strand' ? 0.42 : role === 'accent' ? 0.3 : 1
  const width = bandWidth * roleScale
  const color = role === 'accent' ? palette.accent : palette.strand
  const opacity = role === 'strand' ? 0.2 + material * 0.12 : role === 'accent' ? 0.82 : 0.96
  const common = `d="${d}" fill="none" stroke-linecap="square" stroke-linejoin="miter"`
  const materialized = smoothstep(0.08, 0.34, material)
  const edgeWidth = width + materialized * (role === 'ornament' ? 4 + material * 3 : 2)
  const highlightWidth = Math.max(0.8, width * 0.1)
  return [
    `<path ${common} stroke="${palette.edge}" stroke-width="${number(edgeWidth)}" opacity="${number(opacity * materialized)}"/>`,
    `<path ${common} stroke="${color}" stroke-width="${number(width)}" opacity="${number(opacity)}"/>`,
    `<path ${common} stroke="${palette.highlight}" stroke-width="${number(highlightWidth)}" opacity="${number(materialized * (0.08 + material * 0.16))}"/>`,
  ].join('')
}

function crossingDirection(
  graph: PeriodicGraph,
  crossing: Crossing,
  vertices: ReadonlyMap<string, PeriodicGraph['vertices'][number]>,
  edges: ReadonlyMap<string, PeriodicGraph['halfEdges'][number]>,
  overPair: 0 | 1,
): Readonly<{ start: Vec2; end: Vec2 }> | undefined {
  const pair = crossing.continuations[overPair]
  const edge = edges.get(pair[0])
  const twin = edge ? edges.get(edge.twin) : undefined
  const center = vertices.get(crossing.vertex)?.position
  const destination = twin ? vertices.get(twin.origin) : undefined
  const toward = destination && edge
    ? translateByWrap(destination.position, graph.cell, edge.wrap)
    : undefined
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
  translation: TileTranslation,
): string {
  const materialized = smoothstep(0.08, 0.34, material)
  if (materialized === 0) return ''
  const edges = new Map(scene.graph.halfEdges.map((edge) => [edge.id, edge]))
  const vertices = new Map(scene.graph.vertices.map((vertex) => [vertex.id, vertex]))
  const roleByArm = new Map<string, ScenePath['role']>()
  for (const strand of scene.graph.strands) {
    for (const edgeId of strand.edges) {
      roleByArm.set(edgeId, strand.role)
      const twin = edges.get(edgeId)?.twin
      if (twin) roleByArm.set(twin, strand.role)
    }
  }
  return scene.graph.crossings.map((crossing) => {
    if (crossing.kind === 'contact') return ''
    const phase = Math.abs(
      crossing.weavePhase.u * translation.u + crossing.weavePhase.v * translation.v,
    ) % 2
    const overPair = (crossing.overPair ^ phase) as 0 | 1
    const segment = crossingDirection(scene.graph, crossing, vertices, edges, overPair)
    if (!segment) return ''
    const overArms = new Set(crossing.continuations[overPair])
    const role = roleByArm.get([...overArms][0] ?? '') ?? 'strand'
    const roleScale = role === 'strand' ? 0.42 : role === 'accent' ? 0.3 : 1
    const bandWidth = (2.2 + material * 24.6) * roleScale
    const edgeWidth = bandWidth + materialized * (role === 'ornament' ? 4 + material * 3 : 2)
    const color = role === 'accent' ? palette.accent : palette.strand
    const opacity = role === 'strand' ? 0.2 + material * 0.12 : role === 'accent' ? 0.82 : 0.96
    const x1 = segment.start.x + translation.x
    const y1 = segment.start.y + translation.y
    const x2 = segment.end.x + translation.x
    const y2 = segment.end.y + translation.y
    const coords = `x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}" stroke-linecap="square"`
    return [
      `<line ${coords} stroke="${palette.background}" stroke-width="${number(edgeWidth + 7)}" opacity="${number(materialized)}"/>`,
      `<line ${coords} stroke="${palette.edge}" stroke-width="${number(edgeWidth)}" opacity="${number(opacity * materialized)}"/>`,
      `<line ${coords} stroke="${color}" stroke-width="${number(bandWidth)}" opacity="${number(opacity * materialized)}"/>`,
    ].join('')
  }).join('')
}

/** True when the weave repeats on the cell, so one crossing group can be reused. */
function weaveRepeatsPerCell(scene: RenderScene): boolean {
  return scene.graph.crossings.every(
    (crossing) => crossing.weavePhase.u === 0 && crossing.weavePhase.v === 0,
  )
}

function patternContent(scene: RenderScene, palette: Palette, material: number): string {
  const metrics = tileMetrics(scene)
  const translations = latticeTranslations(scene, metrics)
  const place = (id: string, translation: TileTranslation): string =>
    `<use href="#${id}" transform="translate(${number(translation.x)} ${number(translation.y)})"/>`
  const paths = translations.map((translation) => place('pattern-cell-paths', translation)).join('')
  // Crossings paint after every strand so an over-strand covers the under-strand
  // of a neighbouring cell too, not just its own.
  const crossings = weaveRepeatsPerCell(scene)
    ? translations.map((translation) => place('pattern-cell-crossings', translation)).join('')
    : translations.map((translation) => crossingMarkup(scene, palette, material, translation)).join('')
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
  const cellPaths = scene.paths.map((path) => strokeMarkup(
    pathData(path),
    palette,
    state.material,
    path.role,
  )).join('')
  const cellCrossings = weaveRepeatsPerCell(scene)
    ? crossingMarkup(scene, palette, state.material, { x: 0, y: 0, u: 0, v: 0 })
    : ''
  return [
    '<defs>',
    `<g id="pattern-cell-paths">${cellPaths}</g>`,
    cellCrossings ? `<g id="pattern-cell-crossings">${cellCrossings}</g>` : '',
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

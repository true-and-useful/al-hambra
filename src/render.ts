import type { AppStateV1 } from './state'
import { underCrossingIndices, unwrapCycle } from './geometry/kernel'
import type { RenderScene, ScenePath, Vec2 } from './geometry/types'
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

function polylineData(points: readonly Vec2[], closed: boolean): string {
  const first = points[0]
  if (points.length === 0 || !first) return ''
  const commands = [`M ${number(first.x)} ${number(first.y)}`]
  for (const point of points.slice(1)) {
    commands.push(`L ${number(point.x)} ${number(point.y)}`)
  }
  if (closed) commands.push('Z')
  return commands.join(' ')
}

type Run = Readonly<{ points: readonly Vec2[]; closed: boolean }>

/**
 * Splits a strand into the runs that are actually drawn, cutting a gap wherever
 * it passes beneath another strand.
 *
 * Cutting the strand that goes under is what makes the weave read. The
 * alternative -- painting the crossing over with a background-coloured patch --
 * also erases whatever unrelated geometry happens to sit nearby, which shows up
 * as gashes across untouched bands once the geometry gets tight.
 */
function strandRuns(path: ScenePath, under: readonly number[], gap: number): Run[] {
  const points = path.points
  const segments = points.length - 1
  if (segments < 1) return []
  const loops = path.netWrap.u === 0 && path.netWrap.v === 0
  const cuts = new Set(under)
  if (cuts.size === 0 || gap <= 0) {
    return [{ points: loops ? points.slice(0, segments) : points, closed: loops }]
  }

  const towards = (from: Vec2, to: Vec2): Vec2 => {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const length = Math.hypot(dx, dy)
    if (length <= gap) return from
    return { x: from.x + (dx / length) * gap, y: from.y + (dy / length) * gap }
  }

  const runs: Run[] = []
  let current: Vec2[] = []
  for (let index = 0; index <= segments; index += 1) {
    const point = points[index]
    if (!point) continue
    // The final point is the first one in the next cell, so it carries the same
    // crossing and has to be cut the same way.
    const isCut = cuts.has(index === segments ? 0 : index)
    if (!isCut) {
      current.push(point)
      continue
    }
    const previous = points[index - 1]
    if (current.length > 0 && previous) current.push(towards(point, previous))
    if (current.length > 1) runs.push({ points: current, closed: false })
    const next = points[index + 1]
    current = next ? [towards(point, next)] : []
  }
  if (current.length > 1) runs.push({ points: current, closed: false })

  // A closed strand whose first vertex is not a cut starts and ends mid-run.
  if (loops && !cuts.has(0) && runs.length > 1) {
    const first = runs.shift()
    const last = runs.pop()
    if (first && last) {
      runs.push({ points: [...last.points, ...first.points.slice(1)], closed: false })
    }
  }
  return runs
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

/**
 * Fills the enclosed regions of the arrangement.
 *
 * These are the same faces the weave solver colours, reused as mosaic tiles: a
 * ten-point rosette centre is simply the face with the most vertices. Faces are
 * grouped into classes by vertex count and area so that every rosette centre
 * takes one palette colour and every small filler takes another, the way glazed
 * tilework is cut.
 */
function faceMarkup(scene: RenderScene, palette: Palette): string {
  const colours = palette.faces
  if (!colours || colours.length === 0) return ''
  const classes = faceClasses(scene)
  return scene.graph.faces.map((face) => {
    const outline = unwrapCycle(scene.graph, face)
    if (outline.length < 4) return ''
    const rank = classes.get(face.id) ?? 0
    const colour = colours[rank % colours.length] ?? colours[0]
    // The closing point repeats the first, so drop it and let Z close the path.
    const d = polylineData(outline.slice(0, -1), true)
    if (!d) return ''
    return `<path d="${d}" fill="${colour}" stroke="${colour}" stroke-width="0.75"/>`
  }).join('')
}

/** Ranks faces into classes, largest first, so colours stay stable while morphing. */
function faceClasses(scene: RenderScene): Map<string, number> {
  const measured = scene.graph.faces.map((face) => {
    const outline = unwrapCycle(scene.graph, face).slice(0, -1)
    let twiceArea = 0
    for (let index = 0; index < outline.length; index += 1) {
      const a = outline[index]
      const b = outline[(index + 1) % outline.length]
      if (!a || !b) continue
      twiceArea += a.x * b.y - b.x * a.y
    }
    return { id: face.id, sides: outline.length, area: Math.abs(twiceArea / 2) }
  })
  const key = (entry: typeof measured[number]): string =>
    `${entry.sides}:${entry.area.toExponential(3)}`
  const order = [...new Set(measured.map(key))].sort((left, right) => {
    const areaOf = (k: string): number => Number(k.split(':')[1] ?? 0)
    return areaOf(right) - areaOf(left)
  })
  return new Map(measured.map((entry) => [entry.id, order.indexOf(key(entry))]))
}

function patternContent(scene: RenderScene, mosaic: boolean): string {
  const metrics = tileMetrics(scene)
  const translations = latticeTranslations(scene, metrics)
  const place = (id: string, translation: TileTranslation): string =>
    `<use href="#${id}" transform="translate(${number(translation.x)} ${number(translation.y)})"/>`
  // Every face is laid down before any strand, so the mosaic reads as a ground
  // the strapwork sits on rather than a patchwork interleaved with it.
  const faces = mosaic
    ? translations.map((translation) => place('pattern-cell-faces', translation)).join('')
    : ''
  const paths = translations.map((translation) => place('pattern-cell-paths', translation)).join('')
  return `${faces}${paths}`
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
  // Gap the under-strand so the strand passing over reads as unbroken.
  //
  // The cut has to clear the square linecap, not just the band. A square cap
  // extends half the stroke width past the point it was cut at, so a gap sized
  // only to the band leaves the two dark outlines overlapping and paints a bar
  // across the strand instead of opening a hole in it. Budget the cap first,
  // then the visible daylight on top.
  const bandWidth = 2.2 + state.material * 24.6
  const materialized = smoothstep(0.08, 0.34, state.material)
  const outlineWidth = bandWidth + materialized * (4 + state.material * 3)
  const gap = materialized * (outlineWidth / 2 + bandWidth * 0.35 + 1.5)
  const under = underCrossingIndices(scene.graph)
  const cellPaths = scene.paths.map((path) =>
    strandRuns(path, under.get(path.id) ?? [], gap)
      .map((run) => strokeMarkup(
        polylineData(run.points, run.closed),
        palette,
        state.material,
        path.role,
      ))
      .join(''),
  ).join('')
  const mosaic = (palette.faces?.length ?? 0) > 0
  const cellFaces = mosaic ? faceMarkup(scene, palette) : ''
  return [
    '<defs>',
    cellFaces ? `<g id="pattern-cell-faces">${cellFaces}</g>` : '',
    `<g id="pattern-cell-paths">${cellPaths}</g>`,
    `<pattern id="ornament" patternUnits="userSpaceOnUse" width="${number(metrics.width)}" height="${number(metrics.height)}" patternTransform="${transform}">`,
    `<rect x="0" y="0" width="${number(metrics.width)}" height="${number(metrics.height)}" fill="${palette.background}"/>`,
    patternContent(scene, mosaic),
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

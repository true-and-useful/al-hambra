import type { AppStateV1 } from './state'
import { translateByWrap, unwrapCycle } from './geometry/kernel'
import type { LatticeOffset, RenderScene, ScenePath, Vec2 } from './geometry/types'
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

/** Blends `over` onto `base` at `alpha`, so a sheen can be painted opaquely. */
function blend(base: string, over: string, alpha: number): string {
  const channels = (hex: string): number[] => {
    const value = hex.replace('#', '')
    return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16))
  }
  const from = channels(base)
  const to = channels(over)
  const mixed = from.map((channel, index) =>
    Math.round(channel + ((to[index] ?? channel) - channel) * Math.min(1, Math.max(0, alpha))),
  )
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Every layer is painted opaque on purpose.
 *
 * The crossing patches repaint a short length of the over-strand on top of what
 * is already there. With translucent layers that second pass composites instead
 * of replacing: band over band goes denser, outline over outline goes darker,
 * and the patch shows up as a box on an otherwise clean strand. Opaque layers
 * repaint identically, so the patch is invisible except where it covers the
 * strand beneath. The sheen keeps its softness by being pre-blended against the
 * band it sits on, which is a flat colour, rather than by carrying alpha.
 */
function strokeMarkup(
  d: string,
  palette: Palette,
  material: number,
  role: ScenePath['role'],
  cap: 'square' | 'butt' = 'square',
): string {
  if (!d) return ''
  const bandWidth = 2.2 + material * 24.6
  const roleScale = role === 'strand' ? 0.42 : role === 'accent' ? 0.3 : 1
  const width = bandWidth * roleScale
  const color = role === 'accent' ? palette.accent : palette.strand
  const common = `d="${d}" fill="none" stroke-linecap="${cap}" stroke-linejoin="miter"`
  const materialized = smoothstep(0.08, 0.34, material)
  // At no material the outline matches the band width and is covered by it, so
  // painting it opaque still leaves fine linework looking like linework.
  const edgeWidth = width + materialized * (role === 'ornament' ? 4 + material * 3 : 2)
  const highlightWidth = Math.max(0.8, width * 0.1)
  const sheen = blend(color, palette.highlight, materialized * (0.12 + material * 0.22))
  return [
    `<path ${common} stroke="${palette.edge}" stroke-width="${number(edgeWidth)}"/>`,
    `<path ${common} stroke="${color}" stroke-width="${number(width)}"/>`,
    `<path ${common} stroke="${sheen}" stroke-width="${number(highlightWidth)}"/>`,
  ].join('')
}

/**
 * The points actually drawn for a strand.
 *
 * A closed strand arrives with its first point repeated at the end; drawing that
 * AND closing with Z leaves a zero-length segment whose direction is undefined.
 *
 * A wrapping strand is cut at the cell boundary, and that cut usually lands on a
 * bend. Drawn as-is, this copy ends with a cap square to its last segment while
 * the neighbouring copy starts with a cap square to its first, and the two meet
 * at an angle as a spray of spikes instead of a mitre. Carrying the path one
 * segment past each end into the next cell turns both into ordinary mitred
 * joins; the overlap is invisible because every layer is opaque and the
 * neighbour paints exactly the same thing there.
 */
function drawablePoints(path: ScenePath, scene: RenderScene): readonly Vec2[] {
  const points = path.points
  if (points.length < 2) return points
  if (path.closed) return points.slice(0, -1)

  const wrap = {
    x: scene.cell.a.x * path.netWrap.u + scene.cell.b.x * path.netWrap.v,
    y: scene.cell.a.y * path.netWrap.u + scene.cell.b.y * path.netWrap.v,
  }
  if (wrap.x === 0 && wrap.y === 0) return points
  const last = points.length - 1
  const before = points[last - 1]
  const after = points[1]
  if (!before || !after) return points
  return [
    { x: before.x - wrap.x, y: before.y - wrap.y },
    ...points,
    { x: after.x + wrap.x, y: after.y + wrap.y },
  ]
}

/** True when the weave repeats on the cell, so one patch group can be reused. */
function weaveRepeatsPerCell(scene: RenderScene): boolean {
  return scene.graph.crossings.every(
    (crossing) => crossing.weavePhase.u === 0 && crossing.weavePhase.v === 0,
  )
}

/**
 * Redraws a short length of the over-strand on top of every crossing.
 *
 * The strand that dives under is drawn whole and then covered here, so the edge
 * that cuts it is the over-strand's own outline: parallel to the over-strand, at
 * exactly the angle the two bands meet. Ending the under-strand with a stroke
 * cap instead squares it off against its own direction, which is the wrong angle
 * at every crossing that is not a right angle.
 *
 * The patch follows the strand's real centreline rather than a straight segment.
 * A straight patch that reached a star tip would end flat across a vertex the
 * strand turns a sharp mitre at, cutting the point off and leaving a nub. Being
 * a sub-path of the strand, this inherits the identical join.
 *
 * It never walks past the next crossing, because beyond that the same strand may
 * be the one going under, and repainting there would put it on top.
 */
function crossingPatches(
  scene: RenderScene,
  palette: Palette,
  material: number,
  translation: TileTranslation,
): string {
  const materialized = smoothstep(0.08, 0.34, material)
  if (materialized === 0) return ''
  const bandWidth = 2.2 + material * 24.6
  const outlineWidth = bandWidth + materialized * (4 + material * 3)
  const overshoot = Math.max(0.75, outlineWidth * 0.05)
  const vertices = new Map(scene.graph.vertices.map((vertex) => [vertex.id, vertex]))
  const edges = new Map(scene.graph.halfEdges.map((edge) => [edge.id, edge]))
  const crossingByVertex = new Map(
    scene.graph.crossings.map((crossing) => [crossing.vertex, crossing]),
  )
  const pathById = new Map(scene.paths.map((path) => [path.id, path]))

  const armDirection = (armId: string, from: Vec2): Vec2 | undefined => {
    const edge = edges.get(armId)
    const twin = edge ? edges.get(edge.twin) : undefined
    const target = twin ? vertices.get(twin.origin) : undefined
    if (!edge || !target) return undefined
    const to = translateByWrap(target.position, scene.cell, edge.wrap)
    const span = Math.hypot(to.x - from.x, to.y - from.y)
    if (span === 0) return undefined
    return { x: (to.x - from.x) / span, y: (to.y - from.y) / span }
  }

  const markup: string[] = []
  for (const strand of scene.graph.strands) {
    const path = pathById.get(strand.id)
    if (!path || path.points.length < 2) continue
    const steps = path.points.length - 1
    const wrap = {
      x: scene.cell.a.x * path.netWrap.u + scene.cell.b.x * path.netWrap.v,
      y: scene.cell.a.y * path.netWrap.u + scene.cell.b.y * path.netWrap.v,
    }
    // Index beyond either end continues into the neighbouring cell, which is
    // where the strand actually goes.
    const pointAt = (index: number): Vec2 => {
      const lap = Math.floor(index / steps)
      const local = index - lap * steps
      const base = path.points[local] ?? path.points[0]
      if (!base) return { x: 0, y: 0 }
      return { x: base.x + wrap.x * lap, y: base.y + wrap.y * lap }
    }

    let tile: LatticeOffset = { u: 0, v: 0 }
    for (let index = 0; index < steps; index += 1) {
      const edge = edges.get(strand.edges[index] ?? '')
      if (!edge) continue
      const here = tile
      tile = { u: tile.u + edge.wrap.u, v: tile.v + edge.wrap.v }
      const crossing = crossingByVertex.get(edge.origin)
      if (!crossing || crossing.kind === 'contact') continue
      const pair = crossing.continuations.findIndex((arms) => arms.includes(edge.id))
      if (pair < 0) continue
      const phase = Math.abs(
        crossing.weavePhase.u * (translation.u + here.u) +
        crossing.weavePhase.v * (translation.v + here.v),
      ) % 2
      if (((crossing.overPair ^ phase) as number) !== pair) continue

      const centre = pointAt(index)
      const under = armDirection(crossing.continuations[pair === 0 ? 1 : 0][0], centre)
      const over = armDirection(edge.id, centre)
      if (!under || !over) continue
      // The far CORNER of the over-band has to escape the under-band, not its
      // centreline, and that corner sits half a width off to the side.
      const half = outlineWidth / 2
      const sine = Math.max(Math.abs(over.x * under.y - over.y * under.x), 0.2)
      const cosine = Math.abs(over.x * under.x + over.y * under.y)
      const wanted = (half * (1 + cosine)) / sine + 1

      // Walk the strand's own points outward, stopping at the next crossing.
      const walk = (direction: 1 | -1, limit: number): Vec2[] => {
        const run: Vec2[] = [centre]
        let left = limit
        for (let step = 1; step <= 2 && left > 0; step += 1) {
          const from = run[run.length - 1]
          const to = pointAt(index + direction * step)
          if (!from) break
          const length = Math.hypot(to.x - from.x, to.y - from.y)
          if (length < 1e-9) continue
          if (left < length) {
            run.push({
              x: from.x + ((to.x - from.x) / length) * left,
              y: from.y + ((to.y - from.y) / length) * left,
            })
            return run
          }
          run.push(to)
          left -= length
        }
        return run
      }
      const trace = (limit: number): Vec2[] => {
        const back = walk(-1, limit)
        const ahead = walk(1, limit)
        return [...back.slice(1).reverse(), ...ahead]
      }

      const outlineD = polylineData(trace(Math.max(0, wanted - overshoot)), false)
      const bandD = polylineData(trace(wanted), false)
      const common = 'fill="none" stroke-linecap="butt" stroke-linejoin="miter"' 
      const sheen = blend(
        palette.strand,
        palette.highlight,
        materialized * (0.12 + material * 0.22),
      )
      markup.push(
        `<path d="${outlineD}" ${common} stroke="${palette.edge}" stroke-width="${number(outlineWidth)}"/>`,
        `<path d="${bandD}" ${common} stroke="${palette.strand}" stroke-width="${number(bandWidth)}"/>`,
        `<path d="${bandD}" ${common} stroke="${sheen}" stroke-width="${number(Math.max(0.8, bandWidth * 0.1))}"/>`,
      )
    }
  }
  return markup.join('')
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

function patternContent(
  scene: RenderScene,
  palette: Palette,
  material: number,
  mosaic: boolean,
): string {
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
  // Patches paint after every strand, so an over-strand also covers the
  // under-strand of a neighbouring cell and not just its own.
  const crossings = weaveRepeatsPerCell(scene)
    ? translations.map((translation) => place('pattern-cell-crossings', translation)).join('')
    : translations.map((translation) => crossingPatches(scene, palette, material, translation)).join('')
  return `${faces}${paths}${crossings}`
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
  // Strands are drawn whole; the crossing patches put the over-strand back on
  // top afterwards, which is what opens the weave.
  const cellPaths = scene.paths.map((path) => strokeMarkup(
    polylineData(drawablePoints(path, scene), path.closed),
    palette,
    state.material,
    path.role,
  )).join('')
  const mosaic = (palette.faces?.length ?? 0) > 0
  const cellFaces = mosaic ? faceMarkup(scene, palette) : ''
  const cellCrossings = weaveRepeatsPerCell(scene)
    ? crossingPatches(scene, palette, state.material, { x: 0, y: 0, u: 0, v: 0 })
    : ''
  return [
    '<defs>',
    cellFaces ? `<g id="pattern-cell-faces">${cellFaces}</g>` : '',
    `<g id="pattern-cell-paths">${cellPaths}</g>`,
    cellCrossings ? `<g id="pattern-cell-crossings">${cellCrossings}</g>` : '',
    `<pattern id="ornament" patternUnits="userSpaceOnUse" width="${number(metrics.width)}" height="${number(metrics.height)}" patternTransform="${transform}">`,
    `<rect x="0" y="0" width="${number(metrics.width)}" height="${number(metrics.height)}" fill="${palette.background}"/>`,
    patternContent(scene, palette, state.material, mosaic),
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

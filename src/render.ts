import type { AppStateV1 } from './state'
import { translateByWrap, unwrapCycle } from './geometry/kernel'
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
 * The patch paints the over-band's own footprint and nothing wider, so unlike a
 * background-coloured eraser it cannot mark geometry that merely passes nearby.
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
  const vertices = new Map(scene.graph.vertices.map((vertex) => [vertex.id, vertex]))
  const edges = new Map(scene.graph.halfEdges.map((edge) => [edge.id, edge]))

  // Direction of an arm leaving the crossing, plus how far it runs before the
  // strand bends. The patch must not reach past that bend: beyond it the patch
  // stops being collinear with the strand and its outline shows.
  const along = (
    armId: string,
    from: Vec2,
  ): Readonly<{ unit: Vec2; span: number }> | undefined => {
    const edge = edges.get(armId)
    const twin = edge ? edges.get(edge.twin) : undefined
    const target = twin ? vertices.get(twin.origin) : undefined
    if (!edge || !target) return undefined
    const to = translateByWrap(target.position, scene.cell, edge.wrap)
    const span = Math.hypot(to.x - from.x, to.y - from.y)
    if (span === 0) return undefined
    return { unit: { x: (to.x - from.x) / span, y: (to.y - from.y) / span }, span }
  }

  return scene.graph.crossings.map((crossing) => {
    if (crossing.kind === 'contact') return ''
    const centre = vertices.get(crossing.vertex)?.position
    if (!centre) return ''
    const phase = Math.abs(
      crossing.weavePhase.u * translation.u + crossing.weavePhase.v * translation.v,
    ) % 2
    const overPair = (crossing.overPair ^ phase) as 0 | 1
    const overArms = crossing.continuations[overPair]
    const forward = along(overArms[0], centre)
    const backward = along(overArms[1], centre)
    const under = along(crossing.continuations[overPair === 0 ? 1 : 0][0], centre)
    if (!forward || !backward || !under) return ''
    // How far the patch must run to clear the band passing underneath.
    //
    // It is the far CORNER of the over-band that has to escape the under-band,
    // not its centreline, and the corner sits half a width off to the side.
    // Clearing only the centreline leaves the under-strand's outline poking
    // through the over-strand as a notch on each flank, and the shortfall grows
    // as the crossing gets shallower.
    const half = outlineWidth / 2
    const sine = Math.max(
      Math.abs(forward.unit.x * under.unit.y - forward.unit.y * under.unit.x),
      0.2,
    )
    const cosine = Math.abs(forward.unit.x * under.unit.x + forward.unit.y * under.unit.y)
    const wanted = (half * (1 + cosine)) / sine + 1
    // The band and its sheen run slightly past the outline layer beneath them.
    //
    // All three layers ending on one line leaves the outline's antialiased cap
    // showing along it as a hairline across the band, because the band painted
    // over it stops on exactly the same line. Letting the band overshoot buries
    // that fringe, and the band's own end is invisible: it meets more of the
    // same band colour, already drawn there by the strand itself.
    const overshoot = Math.max(0.75, outlineWidth * 0.05)
    const reach = (span: number): Readonly<{ outline: number; band: number }> => {
      const outline = Math.min(wanted, Math.max(0, span - overshoot))
      return { outline, band: Math.min(outline + overshoot, span) }
    }
    const ahead = reach(forward.span)
    const behind = reach(backward.span)
    const at = (arm: typeof forward, distance: number): Vec2 => ({
      x: centre.x + arm.unit.x * distance,
      y: centre.y + arm.unit.y * distance,
    })
    const segment = (distances: Readonly<{ back: number; front: number }>): string =>
      polylineData([at(backward, distances.back), at(forward, distances.front)], false)

    const outlineD = segment({ back: behind.outline, front: ahead.outline })
    const bandD = segment({ back: behind.band, front: ahead.band })
    const common = 'fill="none" stroke-linecap="butt" stroke-linejoin="miter"'
    const sheen = blend(palette.strand, palette.highlight, materialized * (0.12 + material * 0.22))
    return [
      `<path d="${outlineD}" ${common} stroke="${palette.edge}" stroke-width="${number(outlineWidth)}"/>`,
      `<path d="${bandD}" ${common} stroke="${palette.strand}" stroke-width="${number(bandWidth)}"/>`,
      `<path d="${bandD}" ${common} stroke="${sheen}" stroke-width="${number(Math.max(0.8, bandWidth * 0.1))}"/>`,
    ].join('')
  }).join('')
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
    polylineData(path.points, path.closed),
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

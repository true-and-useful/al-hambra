import type { LatticeCell, Vec2 } from './types'

/**
 * Periodic polygon tilings used as Hankin scaffolds.
 *
 * Every tile is listed counter-clockwise with unit-length edges before scaling,
 * and the tile list is exactly one fundamental domain: each edge of each tile is
 * shared with exactly one other tile edge, possibly in a translated copy of the
 * cell. `tilingErrors` enforces all of it, because a scaffold that is not a
 * genuine fundamental domain produces a silently broken pattern rather than an
 * error.
 */
export type TileDefinition = Readonly<{
  id: string
  verts: readonly Vec2[]
}>

export type TilingDefinition = Readonly<{
  id: string
  cell: LatticeCell
  tiles: readonly TileDefinition[]
}>

const radians = (degrees: number): number => (degrees * Math.PI) / 180

function regularPolygon(
  center: Vec2,
  sides: number,
  circumradius: number,
  startDegrees: number,
): Vec2[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = radians(startDegrees + (360 / sides) * index)
    return {
      x: center.x + circumradius * Math.cos(angle),
      y: center.y + circumradius * Math.sin(angle),
    }
  })
}

function signedArea(verts: readonly Vec2[]): number {
  let total = 0
  for (let index = 0; index < verts.length; index += 1) {
    const a = verts[index]
    const b = verts[(index + 1) % verts.length]
    if (!a || !b) continue
    total += a.x * b.y - b.x * a.y
  }
  return total / 2
}

const counterClockwise = (verts: readonly Vec2[]): Vec2[] =>
  signedArea(verts) > 0 ? [...verts] : [...verts].reverse()

function scaleTiling(tiling: TilingDefinition, factor: number): TilingDefinition {
  const point = (p: Vec2): Vec2 => ({ x: p.x * factor, y: p.y * factor })
  return {
    id: tiling.id,
    cell: {
      origin: point(tiling.cell.origin),
      a: point(tiling.cell.a),
      b: point(tiling.cell.b),
    },
    tiles: tiling.tiles.map((tile) => ({ id: tile.id, verts: tile.verts.map(point) })),
  }
}

/** Reports why a tiling is not a usable fundamental domain, or an empty list. */
export function tilingErrors(tiling: TilingDefinition, edgeLength: number): string[] {
  const errors: string[] = []
  const cellArea = Math.abs(
    tiling.cell.a.x * tiling.cell.b.y - tiling.cell.a.y * tiling.cell.b.x,
  )
  const tolerance = edgeLength * 1e-6
  let covered = 0

  for (const tile of tiling.tiles) {
    const area = signedArea(tile.verts)
    if (area <= 0) errors.push(`${tile.id} is not counter-clockwise`)
    covered += Math.abs(area)
    for (let index = 0; index < tile.verts.length; index += 1) {
      const a = tile.verts[index]
      const b = tile.verts[(index + 1) % tile.verts.length]
      if (!a || !b) continue
      const measured = Math.hypot(b.x - a.x, b.y - a.y)
      if (Math.abs(measured - edgeLength) > tolerance) {
        errors.push(`${tile.id} edge ${index} is ${measured.toFixed(4)}, expected ${edgeLength}`)
      }
    }
  }
  if (Math.abs(covered - cellArea) > cellArea * 1e-9) {
    errors.push(
      `tiles cover ${covered.toFixed(4)} but the cell is ${cellArea.toFixed(4)}`,
    )
  }

  // Matching area is not enough: the tiles also have to meet edge to edge. Pair
  // edges by their midpoint modulo the lattice, which is exactly how the Hankin
  // construction later finds each edge's neighbour. Catching a mispaired
  // scaffold here names the tile; letting it reach the construction does not.
  const determinant = tiling.cell.a.x * tiling.cell.b.y - tiling.cell.a.y * tiling.cell.b.x
  if (Math.abs(determinant) > 0) {
    const precision = 1e-6
    const shared = new Map<string, string[]>()
    for (const tile of tiling.tiles) {
      for (let index = 0; index < tile.verts.length; index += 1) {
        const a = tile.verts[index]
        const b = tile.verts[(index + 1) % tile.verts.length]
        if (!a || !b) continue
        const x = (a.x + b.x) / 2 - tiling.cell.origin.x
        const y = (a.y + b.y) / 2 - tiling.cell.origin.y
        const u = (x * tiling.cell.b.y - y * tiling.cell.b.x) / determinant
        const v = (tiling.cell.a.x * y - tiling.cell.a.y * x) / determinant
        const local = (value: number): number => {
          const nearest = Math.round(value)
          const snapped = Math.abs(value - nearest) < precision ? nearest : value
          return Math.round((snapped - Math.floor(snapped + precision)) / precision)
        }
        const key = `${local(u)}:${local(v)}`
        const entries = shared.get(key) ?? []
        entries.push(`${tile.id}#${index}`)
        shared.set(key, entries)
      }
    }
    for (const [key, entries] of shared) {
      if (entries.length !== 2) {
        errors.push(
          `edge midpoint ${key} is shared by ${entries.length} tile edges (${entries.join(', ')}), expected 2`,
        )
      }
    }
  }
  return errors
}

// --------------------------------------------------------------------------
// The launch scaffolds.
// --------------------------------------------------------------------------

/**
 * Truncated square tiling (4.8.8): regular octagons and squares on a square
 * lattice. The elementary case — one regular-polygon family, one contact angle.
 */
export function octagonSquareTiling(scale: number): TilingDefinition {
  const side = 1 + Math.SQRT2
  const octagonRadius = side / (2 * Math.cos(radians(22.5)))
  return scaleTiling({
    id: 'octagon-square',
    cell: { origin: { x: 0, y: 0 }, a: { x: side, y: 0 }, b: { x: 0, y: side } },
    tiles: [
      {
        id: 'octagon',
        verts: counterClockwise(
          regularPolygon({ x: side / 2, y: side / 2 }, 8, octagonRadius, 22.5),
        ),
      },
      {
        id: 'square',
        verts: counterClockwise(
          regularPolygon({ x: 0, y: 0 }, 4, Math.SQRT1_2, 0),
        ),
      },
    ],
  }, scale)
}

/**
 * Truncated trihexagonal tiling (4.6.12): regular dodecagons, hexagons, and
 * squares on a hexagonal lattice. Three tile families at one contact angle.
 */
export function dodecagonHexagonSquareTiling(scale: number): TilingDefinition {
  const dodecagonInradius = (2 + Math.sqrt(3)) / 2
  const dodecagonRadius = 1 / (2 * Math.sin(radians(15)))
  const spacing = 2 * dodecagonInradius + 1
  const a: Vec2 = { x: spacing, y: 0 }
  const b: Vec2 = { x: spacing / 2, y: (spacing * Math.sqrt(3)) / 2 }
  const hex: Vec2 = { x: (a.x + b.x) / 3, y: (a.y + b.y) / 3 }
  const square = (center: Vec2, startDegrees: number): Vec2[] =>
    counterClockwise(regularPolygon(center, 4, Math.SQRT1_2, startDegrees))

  return scaleTiling({
    id: 'dodecagon-hexagon-square',
    cell: { origin: { x: 0, y: 0 }, a, b },
    tiles: [
      {
        id: 'dodecagon',
        verts: counterClockwise(regularPolygon({ x: 0, y: 0 }, 12, dodecagonRadius, 15)),
      },
      { id: 'square-a', verts: square({ x: a.x / 2, y: a.y / 2 }, 45) },
      { id: 'square-b', verts: square({ x: b.x / 2, y: b.y / 2 }, 105) },
      { id: 'square-c', verts: square({ x: (a.x - b.x) / 2, y: (a.y - b.y) / 2 }, -15) },
      { id: 'hexagon-a', verts: counterClockwise(regularPolygon(hex, 6, 1, 0)) },
      {
        id: 'hexagon-b',
        verts: counterClockwise(regularPolygon({ x: 2 * hex.x, y: 2 * hex.y }, 6, 1, 0)),
      },
    ],
  }, scale)
}

/** Square tiling (4.4.4.4): the plainest scaffold, giving fourfold strapwork. */
export function squareTiling(scale: number): TilingDefinition {
  return scaleTiling({
    id: 'square',
    cell: { origin: { x: 0, y: 0 }, a: { x: 1, y: 0 }, b: { x: 0, y: 1 } },
    tiles: [{
      id: 'square',
      verts: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }],
    }],
  }, scale)
}

/** Regular hexagons (6.6.6). One per cell; the plainest sixfold field. */
export function hexagonTiling(scale: number): TilingDefinition {
  const inradius = Math.sqrt(3) / 2
  return scaleTiling({
    id: 'hexagon',
    cell: {
      origin: { x: 0, y: 0 },
      a: { x: 2 * inradius, y: 0 },
      b: { x: inradius, y: 1.5 },
    },
    tiles: [
      { id: 'hexagon', verts: counterClockwise(regularPolygon({ x: 0, y: 0 }, 6, 1, 30)) },
    ],
  }, scale)
}

/** Trihexagonal tiling (3.6.3.6): one hexagon and two triangles per cell. */
export function hexagonTriangleTiling(scale: number): TilingDefinition {
  const a: Vec2 = { x: 2, y: 0 }
  const b: Vec2 = { x: 1, y: Math.sqrt(3) }
  const triangleRadius = 1 / Math.sqrt(3)
  return scaleTiling({
    id: 'hexagon-triangle',
    cell: { origin: { x: 0, y: 0 }, a, b },
    tiles: [
      { id: 'hexagon', verts: counterClockwise(regularPolygon({ x: 0, y: 0 }, 6, 1, 0)) },
      {
        id: 'triangle-down',
        verts: counterClockwise(
          regularPolygon({ x: (a.x + b.x) / 3, y: (a.y + b.y) / 3 }, 3, triangleRadius, -90),
        ),
      },
      {
        id: 'triangle-up',
        verts: counterClockwise(
          regularPolygon(
            { x: (2 * (a.x + b.x)) / 3, y: (2 * (a.y + b.y)) / 3 }, 3, triangleRadius, 90,
          ),
        ),
      },
    ],
  }, scale)
}

/**
 * Truncated hexagonal tiling (3.12.12): dodecagons touching edge to edge with
 * triangles in the gaps. A twelvefold field quite unlike the 4.6.12 one.
 */
export function dodecagonTriangleTiling(scale: number): TilingDefinition {
  const inradius = (2 + Math.sqrt(3)) / 2
  const R12 = 1 / (2 * Math.sin(radians(15)))
  const spacing = 2 * inradius
  const a: Vec2 = { x: spacing, y: 0 }
  const b: Vec2 = { x: spacing / 2, y: (spacing * Math.sqrt(3)) / 2 }
  const up = 1 / Math.sqrt(3)
  return scaleTiling({
    id: 'dodecagon-triangle',
    cell: { origin: { x: 0, y: 0 }, a, b },
    tiles: [
      { id: 'dodecagon', verts: counterClockwise(regularPolygon({ x: 0, y: 0 }, 12, R12, 15)) },
      {
        id: 'triangle-a',
        verts: counterClockwise(
          regularPolygon({ x: (a.x + b.x) / 3, y: (a.y + b.y) / 3 }, 3, up, 30),
        ),
      },
      {
        id: 'triangle-b',
        verts: counterClockwise(
          regularPolygon({ x: (2 * (a.x + b.x)) / 3, y: (2 * (a.y + b.y)) / 3 }, 3, up, 90),
        ),
      },
    ],
  }, scale)
}

/**
 * Decagons in edge-sharing rows with the residual gaps filled by 72/108 rhombi.
 * The flagship: the supporting tile is irregular relative to the decagon, so the
 * scaffold cannot be described as a single regular-polygon family, and the
 * ten-point rosette only closes because the rows are offset by half a period.
 */
export function decagonRhombusTiling(scale: number): TilingDefinition {
  const phi = (1 + Math.sqrt(5)) / 2
  const decagonInradius = 1 / (2 * Math.tan(radians(18)))
  // The next row's decagon tops land exactly on this row's rhombus tips, which
  // sit one long rhombus diagonal above a decagon vertex at height phi*sin18.
  const rowHeight = 2 * phi + phi * Math.sin(radians(18))

  const decagon = Array.from({ length: 10 }, (_, index) => {
    const angle = radians(18 + 36 * index)
    return { x: phi * Math.cos(angle), y: phi * Math.sin(angle) }
  })

  const rotate = (p: Vec2, r: number): Vec2 => ({
    x: p.x * Math.cos(r) - p.y * Math.sin(r),
    y: p.x * Math.sin(r) + p.y * Math.cos(r),
  })
  const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
  const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })

  const cell: LatticeCell = {
    origin: { x: 0, y: 0 },
    a: { x: 2 * decagonInradius, y: 0 },
    b: { x: decagonInradius, y: rowHeight },
  }

  // Edges 4 and 9 are shared with the row neighbours. On each remaining edge a
  // rhombus sits outside the decagon, its 72 degree corner alternating between
  // the first and the second vertex of the edge.
  const seventyTwoAtFirst = new Set([0, 2, 5, 7])
  const determinant = cell.a.x * cell.b.y - cell.a.y * cell.b.x
  const rhombi = new Map<string, Vec2[]>()

  for (let index = 0; index < 10; index += 1) {
    if (index === 4 || index === 9) continue
    const p = decagon[index]
    const q = decagon[(index + 1) % 10]
    if (!p || !q) continue
    let verts: Vec2[]
    if (seventyTwoAtFirst.has(index)) {
      const s = add(p, rotate(sub(q, p), radians(-72)))
      verts = [p, q, add(q, sub(s, p)), s]
    } else {
      const s = add(q, rotate(sub(p, q), radians(72)))
      verts = [p, q, s, add(p, sub(s, q))]
    }
    // Keep one rhombus from each lattice-equivalent pair.
    const centroid = verts.reduce(
      (sum, point) => ({ x: sum.x + point.x / 4, y: sum.y + point.y / 4 }),
      { x: 0, y: 0 },
    )
    const u = (centroid.x * cell.b.y - centroid.y * cell.b.x) / determinant
    const v = (cell.a.x * centroid.y - cell.a.y * centroid.x) / determinant
    const fraction = (value: number): number =>
      Math.round((value - Math.floor(value + 1e-9)) * 1e6)
    const key = `${fraction(u)}:${fraction(v)}`
    if (!rhombi.has(key)) rhombi.set(key, verts)
  }

  return scaleTiling({
    id: 'decagon-rhombus',
    cell,
    tiles: [
      { id: 'decagon', verts: counterClockwise(decagon) },
      ...[...rhombi.values()].map((verts, index) => ({
        id: `rhombus-${index}`,
        verts: counterClockwise(verts),
      })),
    ],
  }, scale)
}

import type { TilingDefinition } from './tiling'
import type { LatticeCell, LatticeOffset, ScenePath, Vec2 } from './types'

/**
 * Hankin's "polygons in contact" construction, in the form Kaplan describes.
 *
 * Every edge of the scaffold carries a contact point at its midpoint. Two rays
 * leave that point into each adjacent tile, each making the same contact angle
 * with the edge. Inside a tile, the ray leaving edge `i` forwards meets the ray
 * leaving edge `i+1` backwards, and that meeting point is a bend in the
 * strapwork. Because the angle is equal on both sides of an edge, the two rays
 * on opposite sides are collinear: a strand runs straight through each contact
 * point, and two strands cross transversally there.
 *
 * The contact points are therefore deliberately *not* emitted as polyline
 * vertices. They are genuine interior crossings of two straight strands, and the
 * arrangement compiler has to discover them as such to weave them.
 *
 * The contact angle is the single continuous parameter behind the morph axis.
 */

const EPSILON = 1e-7

const subtract = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y })
const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y })
const scale = (v: Vec2, k: number): Vec2 => ({ x: v.x * k, y: v.y * k })
const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x
const midpoint = (a: Vec2, b: Vec2): Vec2 => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

function rotate(v: Vec2, radians: number): Vec2 {
  const c = Math.cos(radians)
  const s = Math.sin(radians)
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }
}

function unit(v: Vec2): Vec2 {
  const magnitude = Math.hypot(v.x, v.y)
  if (magnitude < EPSILON) throw new Error('Cannot normalize a degenerate edge')
  return { x: v.x / magnitude, y: v.y / magnitude }
}

const translateBy = (p: Vec2, cell: LatticeCell, w: LatticeOffset): Vec2 =>
  add(p, add(scale(cell.a, w.u), scale(cell.b, w.v)))

/** Canonical key for a point modulo the lattice, with the cell it came from. */
function canonical(
  cell: LatticeCell,
  point: Vec2,
  precision: number,
): Readonly<{ key: string; wrap: LatticeOffset }> {
  const determinant = cross(cell.a, cell.b)
  const relative = subtract(point, cell.origin)
  const u = cross(relative, cell.b) / determinant
  const v = cross(cell.a, relative) / determinant
  const axis = (value: number): Readonly<{ local: number; tile: number }> => {
    const nearest = Math.round(value)
    const snapped = Math.abs(value - nearest) < precision ? nearest : value
    const tile = Math.floor(snapped + precision)
    const local = snapped - tile
    return local > 1 - precision ? { local: 0, tile: tile + 1 } : { local, tile }
  }
  const U = axis(u)
  const V = axis(v)
  return {
    key: `${Math.round(U.local / precision)}:${Math.round(V.local / precision)}`,
    wrap: { u: U.tile, v: V.tile },
  }
}

type TileGeometry = Readonly<{
  index: number
  id: string
  sides: number
  midpoints: readonly Vec2[]
  forward: readonly Vec2[]
  backward: readonly Vec2[]
  corners: readonly Vec2[]
}>

type Port = Readonly<{ tile: number; edge: number; side: 1 | 2 }>

/**
 * Compiles a scaffold and a contact angle into continuous strand polylines on
 * the torus. Throws when the angle drives a tile's contact rays apart instead of
 * together, which is how the unusable ends of a range announce themselves.
 */
export function buildContactPaths(
  tiling: TilingDefinition,
  contactAngleDegrees: number,
): ScenePath[] {
  const cell = tiling.cell
  const theta = (contactAngleDegrees * Math.PI) / 180
  const cellSize = Math.hypot(cell.a.x, cell.a.y)
  const precision = 1e-6

  const geometry: TileGeometry[] = tiling.tiles.map((tile, index) => {
    const sides = tile.verts.length
    const midpoints: Vec2[] = []
    const forward: Vec2[] = []
    const backward: Vec2[] = []
    for (let edge = 0; edge < sides; edge += 1) {
      const a = tile.verts[edge]
      const b = tile.verts[(edge + 1) % sides]
      if (!a || !b) throw new Error(`${tile.id} has an incomplete edge ${edge}`)
      const direction = unit(subtract(b, a))
      midpoints.push(midpoint(a, b))
      forward.push(rotate(direction, theta))
      backward.push(rotate(direction, Math.PI - theta))
    }
    const corners: Vec2[] = []
    for (let edge = 0; edge < sides; edge += 1) {
      const next = (edge + 1) % sides
      const origin = midpoints[edge]
      const target = midpoints[next]
      const ray = forward[edge]
      const counterRay = backward[next]
      if (!origin || !target || !ray || !counterRay) {
        throw new Error(`${tile.id} is missing contact data at corner ${edge}`)
      }
      const determinant = cross(ray, counterRay)
      if (Math.abs(determinant) < EPSILON) {
        throw new Error(
          `${tile.id} has parallel contact rays at corner ${edge} for ${contactAngleDegrees} degrees`,
        )
      }
      const between = subtract(target, origin)
      const along = cross(between, counterRay) / determinant
      const opposing = cross(between, ray) / determinant
      if (along <= EPSILON || opposing <= EPSILON) {
        throw new Error(
          `${tile.id} contact rays diverge at corner ${edge} for ${contactAngleDegrees} degrees`,
        )
      }
      corners.push(add(origin, scale(ray, along)))
    }
    return { index, id: tile.id, sides, midpoints, forward, backward, corners }
  })

  // Pair every scaffold edge with its counterpart, possibly in a translated cell.
  const byKey = new Map<string, Array<Readonly<{ tile: number; edge: number; wrap: LatticeOffset }>>>()
  for (const tile of geometry) {
    for (let edge = 0; edge < tile.sides; edge += 1) {
      const point = tile.midpoints[edge]
      if (!point) continue
      const { key, wrap } = canonical(cell, point, precision)
      const bucket = byKey.get(key) ?? []
      bucket.push({ tile: tile.index, edge, wrap })
      byKey.set(key, bucket)
    }
  }

  type Neighbour = Readonly<{ tile: number; edge: number; wrap: LatticeOffset }>
  const neighbours = new Map<string, Neighbour>()
  for (const [key, bucket] of byKey) {
    if (bucket.length !== 2) {
      throw new Error(
        `${tiling.id}: contact point ${key} is shared by ${bucket.length} scaffold edges, expected 2`,
      )
    }
    const [left, right] = bucket
    if (!left || !right) continue
    const offset = { u: left.wrap.u - right.wrap.u, v: left.wrap.v - right.wrap.v }
    neighbours.set(`${left.tile}:${left.edge}`, { tile: right.tile, edge: right.edge, wrap: offset })
    neighbours.set(`${right.tile}:${right.edge}`, {
      tile: left.tile,
      edge: left.edge,
      wrap: { u: -offset.u, v: -offset.v },
    })
  }

  // Walk the ports. Inside a tile a corner joins side 1 of one edge to side 2 of
  // the next; across an edge, matching sides join because they are collinear.
  const visited = new Set<string>()
  const paths: ScenePath[] = []
  const portKey = (port: Port): string => `${port.tile}:${port.edge}:${port.side}`

  for (const tile of geometry) {
    for (let edge = 0; edge < tile.sides; edge += 1) {
      for (const side of [1, 2] as const) {
        const start: Port = { tile: tile.index, edge, side }
        if (visited.has(portKey(start))) continue

        const points: Vec2[] = []
        let wrap: LatticeOffset = { u: 0, v: 0 }
        let current: Port = start
        let closed = false

        for (let step = 0; step < 100_000 && !closed; step += 1) {
          const host = geometry[current.tile]
          if (!host) throw new Error('Strand walk reached an unknown tile')
          const cornerIndex = current.side === 1
            ? current.edge
            : (current.edge - 1 + host.sides) % host.sides
          const exit: Port = current.side === 1
            ? { tile: current.tile, edge: (current.edge + 1) % host.sides, side: 2 }
            : { tile: current.tile, edge: cornerIndex, side: 1 }

          visited.add(portKey(current))
          visited.add(portKey(exit))
          const corner = host.corners[cornerIndex]
          if (!corner) throw new Error(`${host.id} is missing corner ${cornerIndex}`)
          points.push(translateBy(corner, cell, wrap))

          const neighbour = neighbours.get(`${exit.tile}:${exit.edge}`)
          if (!neighbour) throw new Error(`${host.id} edge ${exit.edge} has no scaffold neighbour`)
          wrap = { u: wrap.u + neighbour.wrap.u, v: wrap.v + neighbour.wrap.v }
          current = { tile: neighbour.tile, edge: neighbour.edge, side: exit.side }
          if (portKey(current) === portKey(start)) closed = true
        }
        if (!closed) throw new Error(`${tiling.id}: a strand walk failed to close`)
        if (points.length < 2) continue

        const loops = wrap.u === 0 && wrap.v === 0
        const first = points[0]
        if (!first) continue
        paths.push({
          id: `strap:${tile.id}:${edge}:${side}`,
          role: 'ornament',
          points: loops ? points : [...points, translateBy(first, cell, wrap)],
          closed: loops,
          netWrap: wrap,
        })
      }
    }
  }

  if (paths.length === 0) throw new Error(`${tiling.id}: produced no strands`)
  void cellSize
  return paths
}

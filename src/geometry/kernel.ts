import { orient2d } from 'robust-predicates'

import type {
  LatticeCell,
  LatticeOffset,
  PeriodicCycle,
  PeriodicGraph,
  PeriodicHalfEdge,
  PeriodicStrand,
  PeriodicVertex,
  ScenePath,
  Vec2,
} from './types'

export type GridScaffold = Readonly<{
  columns: number
  rows: number
  cell: LatticeCell
  positionAt?: (u: number, v: number) => Vec2
  overUnderPhase?: 0 | 1
}>

const DIRECTIONS = ['e', 's', 'w', 'n'] as const
type Direction = (typeof DIRECTIONS)[number]

const directionDelta: Record<Direction, readonly [number, number]> = {
  e: [1, 0],
  s: [0, 1],
  w: [-1, 0],
  n: [0, -1],
}

const opposite: Record<Direction, Direction> = {
  e: 'w',
  s: 'n',
  w: 'e',
  n: 's',
}

const nextDirection: Record<Direction, Direction> = {
  e: 's',
  s: 'w',
  w: 'n',
  n: 'e',
}

export const add = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x + right.x,
  y: left.y + right.y,
})

export const subtract = (left: Vec2, right: Vec2): Vec2 => ({
  x: left.x - right.x,
  y: left.y - right.y,
})

export const scale = (point: Vec2, amount: number): Vec2 => ({
  x: point.x * amount,
  y: point.y * amount,
})

export const length = (vector: Vec2): number => Math.hypot(vector.x, vector.y)

export const latticePoint = (
  cell: LatticeCell,
  u: number,
  v: number,
): Vec2 =>
  add(cell.origin, add(scale(cell.a, u), scale(cell.b, v)))

export const translateByWrap = (
  point: Vec2,
  cell: LatticeCell,
  wrap: LatticeOffset,
): Vec2 => add(point, add(scale(cell.a, wrap.u), scale(cell.b, wrap.v)))

/**
 * robust-predicates intentionally uses screen coordinates (positive y points down).
 * Positive therefore means visually counter-clockwise in the SVG coordinate system.
 */
export const screenOrientation = (a: Vec2, b: Vec2, c: Vec2): number =>
  orient2d(a.x, a.y, b.x, b.y, c.x, c.y)

const modulo = (value: number, divisor: number): number =>
  ((value % divisor) + divisor) % divisor

const vertexId = (column: number, row: number): string => `v:${column}:${row}`
const edgeId = (column: number, row: number, direction: Direction): string =>
  `e:${column}:${row}:${direction}`

function neighbor(
  column: number,
  row: number,
  direction: Direction,
  columns: number,
  rows: number,
): Readonly<{ column: number; row: number; wrap: LatticeOffset }> {
  const [dc, dr] = directionDelta[direction]
  const rawColumn = column + dc
  const rawRow = row + dr

  return {
    column: modulo(rawColumn, columns),
    row: modulo(rawRow, rows),
    wrap: {
      u: rawColumn < 0 ? -1 : rawColumn >= columns ? 1 : 0,
      v: rawRow < 0 ? -1 : rawRow >= rows ? 1 : 0,
    },
  }
}

export function buildPeriodicGrid(scaffold: GridScaffold): PeriodicGraph {
  const { columns, rows, cell, positionAt, overUnderPhase = 0 } = scaffold
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 2 || rows < 2) {
    throw new Error('A periodic grid needs at least two integral rows and columns')
  }

  const vertices: PeriodicVertex[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const u = column / columns
      const v = row / rows
      vertices.push({
        id: vertexId(column, row),
        lineage: `grid/${column}/${row}`,
        position: positionAt?.(u, v) ?? latticePoint(cell, u, v),
      })
    }
  }

  const halfEdges: PeriodicHalfEdge[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      for (const direction of DIRECTIONS) {
        const destination = neighbor(column, row, direction, columns, rows)
        const following = nextDirection[direction]
        halfEdges.push({
          id: edgeId(column, row, direction),
          origin: vertexId(column, row),
          twin: edgeId(destination.column, destination.row, opposite[direction]),
          next: edgeId(destination.column, destination.row, following),
          wrap: destination.wrap,
        })
      }
    }
  }

  const faces: PeriodicCycle[] = []
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const east = neighbor(column, row, 'e', columns, rows)
      const southEast = neighbor(east.column, east.row, 's', columns, rows)
      const south = neighbor(column, row, 's', columns, rows)
      faces.push({
        id: `face:${column}:${row}`,
        edges: [
          edgeId(column, row, 'e'),
          edgeId(east.column, east.row, 's'),
          edgeId(southEast.column, southEast.row, 'w'),
          edgeId(south.column, south.row, 'n'),
        ],
        netWrap: { u: 0, v: 0 },
      })
    }
  }

  const strands: PeriodicStrand[] = []
  for (let row = 0; row < rows; row += 1) {
    strands.push({
      id: `strand:u:${row}`,
      role: 'strand',
      pathClosed: false,
      continuationId: `strand:u:${row}`,
      edges: Array.from({ length: columns }, (_, column) =>
        edgeId(column, row, 'e'),
      ),
      netWrap: { u: 1, v: 0 },
    })
  }
  for (let column = 0; column < columns; column += 1) {
    strands.push({
      id: `strand:v:${column}`,
      role: 'strand',
      pathClosed: false,
      continuationId: `strand:v:${column}`,
      edges: Array.from({ length: rows }, (_, row) =>
        edgeId(column, row, 's'),
      ),
      netWrap: { u: 0, v: 1 },
    })
  }

  const crossings = vertices.map((vertex, index) => {
    const row = Math.floor(index / columns)
    const column = index % columns
    const horizontal: readonly [string, string] = [
      edgeId(column, row, 'e'),
      edgeId(column, row, 'w'),
    ]
    const vertical: readonly [string, string] = [
      edgeId(column, row, 'n'),
      edgeId(column, row, 's'),
    ]
    return {
      id: `crossing:${column}:${row}`,
      kind: 'intersection' as const,
      vertex: vertex.id,
      armsCCW: [horizontal[0], vertical[0], horizontal[1], vertical[1]] as const,
      continuations: [horizontal, vertical] as const,
      overPair: ((column + row + overUnderPhase) % 2) as 0 | 1,
      weavePhase: { u: 0 as const, v: 0 as const },
    }
  })

  return { cell, vertices, halfEdges, faces, strands, crossings }
}

export function destinationOf(
  graph: PeriodicGraph,
  edge: PeriodicHalfEdge,
): PeriodicVertex {
  const edgeById = new Map(graph.halfEdges.map((candidate) => [candidate.id, candidate]))
  const vertexById = new Map(graph.vertices.map((vertex) => [vertex.id, vertex]))
  const twin = edgeById.get(edge.twin)
  const destination = twin === undefined ? undefined : vertexById.get(twin.origin)
  if (destination === undefined) {
    throw new Error(`Cannot resolve destination for half-edge ${edge.id}`)
  }
  return destination
}

export function unwrapCycle(graph: PeriodicGraph, cycle: PeriodicCycle): Vec2[] {
  const edgeById = new Map(graph.halfEdges.map((edge) => [edge.id, edge]))
  const vertexById = new Map(graph.vertices.map((vertex) => [vertex.id, vertex]))
  const first = edgeById.get(cycle.edges[0] ?? '')
  if (first === undefined) return []
  const firstVertex = vertexById.get(first.origin)
  if (firstVertex === undefined) return []

  const points: Vec2[] = [firstVertex.position]
  let accumulated: LatticeOffset = { u: 0, v: 0 }
  for (const edgeName of cycle.edges) {
    const edge = edgeById.get(edgeName)
    if (edge === undefined) throw new Error(`Unknown edge ${edgeName} in ${cycle.id}`)
    accumulated = {
      u: accumulated.u + edge.wrap.u,
      v: accumulated.v + edge.wrap.v,
    }
    const destination = destinationOf(graph, edge)
    points.push(translateByWrap(destination.position, graph.cell, accumulated))
  }
  return points
}

export function strandScenePaths(graph: PeriodicGraph): ScenePath[] {
  return graph.strands.map((strand) => ({
    id: strand.id,
    role: strand.role,
    continuationId: strand.continuationId,
    points: unwrapCycle(graph, strand),
    closed: strand.pathClosed,
    netWrap: strand.netWrap,
  }))
}

/**
 * For every strand, the indices along its rendered polyline where it dives under
 * another strand.
 *
 * This is what lets the renderer cut a gap into the strand that goes under,
 * rather than painting over the crossing and hoping only the intended strand was
 * beneath. Index `i` refers to the vertex the strand leaves along its edge `i`,
 * which is point `i` of the path `strandScenePaths` produces.
 */
export function underCrossingIndices(graph: PeriodicGraph): Map<string, number[]> {
  const edges = new Map(graph.halfEdges.map((edge) => [edge.id, edge]))
  const crossingByVertex = new Map(graph.crossings.map((crossing) => [crossing.vertex, crossing]))
  const result = new Map<string, number[]>()

  for (const strand of graph.strands) {
    const under: number[] = []
    let tile: LatticeOffset = { u: 0, v: 0 }
    for (let index = 0; index < strand.edges.length; index += 1) {
      const edge = edges.get(strand.edges[index] ?? '')
      if (!edge) continue
      const crossing = crossingByVertex.get(edge.origin)
      if (crossing !== undefined && crossing.kind === 'intersection') {
        const pair = crossing.continuations.findIndex((arms) => arms.includes(edge.id))
        if (pair >= 0) {
          const phase = Math.abs(
            crossing.weavePhase.u * tile.u + crossing.weavePhase.v * tile.v,
          ) % 2
          if (((crossing.overPair ^ phase) as number) !== pair) under.push(index)
        }
      }
      tile = { u: tile.u + edge.wrap.u, v: tile.v + edge.wrap.v }
    }
    result.set(strand.id, under)
  }
  return result
}

export function topologySignature(graph: PeriodicGraph): string {
  const offset = (wrap: LatticeOffset): string => `${wrap.u},${wrap.v}`
  const edges = [...graph.halfEdges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((edge) => `${edge.id}>${edge.origin}|${edge.twin}|${edge.next}|${offset(edge.wrap)}`)
  const faces = [...graph.faces]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((face) => `${face.id}:${face.edges.join(',')}:${offset(face.netWrap)}`)
  const strands = [...graph.strands]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((strand) => `${strand.id}:${strand.edges.join(',')}:${offset(strand.netWrap)}`)
  const crossings = [...graph.crossings]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(
      (crossing) =>
        `${crossing.id}:${crossing.kind}:${crossing.vertex}:${crossing.armsCCW.join(',')}:` +
        `${crossing.continuations.map((pair) => pair.join('+')).join('|')}:${crossing.overPair}:` +
        `${crossing.weavePhase.u},${crossing.weavePhase.v}`,
    )
  return [...edges, ...faces, ...strands, ...crossings].join(';')
}

export function graphInvariantErrors(graph: PeriodicGraph): string[] {
  const errors: string[] = []
  const edges = new Map(graph.halfEdges.map((edge) => [edge.id, edge]))
  const vertexById = new Map(graph.vertices.map((vertex) => [vertex.id, vertex]))
  const vertices = new Set(vertexById.keys())

  for (const edge of graph.halfEdges) {
    const twin = edges.get(edge.twin)
    if (!vertices.has(edge.origin)) errors.push(`${edge.id} has an unknown origin`)
    if (twin === undefined) {
      errors.push(`${edge.id} has an unknown twin`)
    } else {
      if (twin.twin !== edge.id) errors.push(`${edge.id} has a non-reciprocal twin`)
      if (twin.wrap.u !== -edge.wrap.u || twin.wrap.v !== -edge.wrap.v) {
        errors.push(`${edge.id} has a non-reciprocal wrap`)
      }
    }
    if (!edges.has(edge.next)) errors.push(`${edge.id} has an unknown next edge`)
  }

  const faceUse = new Map<string, number>()
  for (const face of graph.faces) {
    let sum: LatticeOffset = { u: 0, v: 0 }
    for (let index = 0; index < face.edges.length; index += 1) {
      const edge = edges.get(face.edges[index] ?? '')
      const expectedNext = face.edges[(index + 1) % face.edges.length]
      if (edge === undefined) {
        errors.push(`${face.id} contains an unknown edge`)
        continue
      }
      faceUse.set(edge.id, (faceUse.get(edge.id) ?? 0) + 1)
      if (edge.next !== expectedNext) errors.push(`${face.id} does not follow next pointers`)
      sum = { u: sum.u + edge.wrap.u, v: sum.v + edge.wrap.v }
    }
    if (sum.u !== face.netWrap.u || sum.v !== face.netWrap.v) {
      errors.push(`${face.id} has an incorrect net wrap`)
    }
    if (sum.u !== 0 || sum.v !== 0) errors.push(`${face.id} is not contractible on the torus`)
  }
  for (const edge of graph.halfEdges) {
    if ((faceUse.get(edge.id) ?? 0) !== 1) errors.push(`${edge.id} must belong to exactly one face`)
  }

  const strandUse = new Map<string, number>()
  const continuationByArm = new Map<string, string>()
  for (const strand of graph.strands) {
    let sum: LatticeOffset = { u: 0, v: 0 }
    for (let index = 0; index < strand.edges.length; index += 1) {
      const edge = edges.get(strand.edges[index] ?? '')
      if (!edge) {
        errors.push(`${strand.id} contains an unknown edge`)
        continue
      }
      const undirected = [edge.id, edge.twin].sort().join('|')
      strandUse.set(undirected, (strandUse.get(undirected) ?? 0) + 1)
      continuationByArm.set(edge.id, strand.continuationId)
      continuationByArm.set(edge.twin, strand.continuationId)
      sum = { u: sum.u + edge.wrap.u, v: sum.v + edge.wrap.v }
      const nextId = strand.edges[index + 1]
      if (nextId) {
        const destination = edges.get(edge.twin)?.origin
        if (destination !== edges.get(nextId)?.origin) {
          errors.push(`${strand.id} is disconnected between ${edge.id} and ${nextId}`)
        }
      }
    }
    if (sum.u !== strand.netWrap.u || sum.v !== strand.netWrap.v) {
      errors.push(`${strand.id} has an incorrect net wrap`)
    }
    if ((strand.pathClosed || (strand.role !== 'accent' && (sum.u !== 0 || sum.v !== 0))) && strand.edges.length > 0) {
      const first = edges.get(strand.edges[0] ?? '')
      const last = edges.get(strand.edges.at(-1) ?? '')
      if (first && last && edges.get(last.twin)?.origin !== first.origin) {
        errors.push(`${strand.id} does not close on the torus`)
      }
    }
  }
  for (const edge of graph.halfEdges) {
    const undirected = [edge.id, edge.twin].sort().join('|')
    if (edge.id < edge.twin && (strandUse.get(undirected) ?? 0) !== 1) {
      errors.push(`${edge.id} must be traversed by exactly one source strand`)
    }
  }

  const crossingUse = new Map<string, number>()
  for (const crossing of graph.crossings) {
    const flattened = crossing.continuations.flat()
    if (new Set(crossing.armsCCW).size !== 4 || new Set(flattened).size !== 4) {
      errors.push(`${crossing.id} must consume four unique arms`)
    }
    for (const arm of crossing.armsCCW) {
      crossingUse.set(arm, (crossingUse.get(arm) ?? 0) + 1)
      const edge = edges.get(arm)
      if (edge?.origin !== crossing.vertex) errors.push(`${crossing.id} has a foreign arm ${arm}`)
    }
    const crossingVertex = vertexById.get(crossing.vertex)
    if (crossingVertex !== undefined && crossing.kind === 'intersection') {
      const destinations = crossing.armsCCW.map((arm) => {
        const edge = edges.get(arm)
        const twin = edge === undefined ? undefined : edges.get(edge.twin)
        const destination = twin === undefined ? undefined : vertexById.get(twin.origin)
        return edge === undefined || destination === undefined
          ? undefined
          : translateByWrap(destination.position, graph.cell, edge.wrap)
      })
      for (let index = 0; index < destinations.length; index += 1) {
        const current = destinations[index]
        const following = destinations[(index + 1) % destinations.length]
        if (
          current !== undefined &&
          following !== undefined &&
          screenOrientation(crossingVertex.position, current, following) <= 0
        ) {
          errors.push(`${crossing.id} arms are not in counter-clockwise screen order`)
          break
        }
      }
    }
    if (crossing.armsCCW.some((arm) => !flattened.includes(arm))) {
      errors.push(`${crossing.id} continuations do not cover its arms`)
    }
  }
  for (const [edgeId, useCount] of crossingUse) {
    if (useCount !== 1) errors.push(`${edgeId} must be consumed by exactly one crossing`)
  }
  const outgoing = new Map<string, string[]>()
  for (const edge of graph.halfEdges) {
    const arms = outgoing.get(edge.origin) ?? []
    arms.push(edge.id)
    outgoing.set(edge.origin, arms)
  }
  for (const crossing of graph.crossings) {
    if ((outgoing.get(crossing.vertex)?.length ?? 0) !== 4) {
      errors.push(`${crossing.id} is not a degree-four vertex`)
    }
  }
  const crossingVertices = new Set(graph.crossings.map((crossing) => crossing.vertex))
  for (const [vertex, arms] of outgoing) {
    if (arms.length !== 4) continue
    const continuationGroups = new Map<string, number>()
    for (const arm of arms) {
      const continuation = continuationByArm.get(arm) ?? `missing:${arm}`
      continuationGroups.set(continuation, (continuationGroups.get(continuation) ?? 0) + 1)
    }
    // Two strands meeting give two continuations of two arms each; one strand
    // crossing itself gives a single continuation of four.
    const counts = [...continuationGroups.values()]
    const pairable =
      (continuationGroups.size === 2 && counts.every((count) => count === 2)) ||
      (continuationGroups.size === 1 && counts[0] === 4)
    if (pairable && !crossingVertices.has(vertex)) errors.push(`${vertex} is missing a crossing record`)
    if (!pairable) errors.push(`${vertex} cannot be paired into two strand continuations`)
  }

  const vertexCount = graph.vertices.length
  const edgeCount = graph.halfEdges.length / 2
  const faceCount = graph.faces.length
  if (vertexCount - edgeCount + faceCount !== 0) {
    errors.push('The periodic cell does not have torus Euler characteristic 0')
  }

  return errors
}

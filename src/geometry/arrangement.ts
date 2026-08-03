import { latticePoint, translateByWrap } from './kernel'
import type {
  Crossing,
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

type SourceSegment = Readonly<{
  pathId: string
  continuationId: string
  role: ScenePath['role']
  pathClosed: boolean
  pathLoops: boolean
  pointCount: number
  segmentIndex: number
  a: Vec2
  b: Vec2
}>

type Fragment = Readonly<{
  source: SourceSegment
  pieceIndex: number
  t0: number
  t1: number
  a: Vec2
  b: Vec2
  aLineage: string
  bLineage: string
}>

type EdgeMetadata = Readonly<{
  sourcePath: string
  continuationId: string
  role: ScenePath['role']
  forward: boolean
  order: number
}>

const EPSILON = 1e-8
const KEY_SCALE = 1e7

const cross = (left: Vec2, right: Vec2): number => left.x * right.y - left.y * right.x

function subtract(left: Vec2, right: Vec2): Vec2 {
  return { x: left.x - right.x, y: left.y - right.y }
}

function interpolate(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function worldToLattice(cell: LatticeCell, point: Vec2): Vec2 {
  const relative = subtract(point, cell.origin)
  const determinant = cross(cell.a, cell.b)
  if (Math.abs(determinant) < EPSILON) throw new Error('The lattice basis is singular')
  return {
    x: cross(relative, cell.b) / determinant,
    y: cross(cell.a, relative) / determinant,
  }
}

function canonicalCoordinate(value: number): Readonly<{ value: number; tile: number }> {
  const nearest = Math.round(value)
  const snapped = Math.abs(value - nearest) < EPSILON ? nearest : value
  const tile = Math.floor(snapped)
  const local = snapped - tile
  if (Math.abs(local - 1) < EPSILON) return { value: 0, tile: tile + 1 }
  if (Math.abs(local) < EPSILON) return { value: 0, tile }
  return { value: local, tile }
}

function canonicalPoint(
  cell: LatticeCell,
  point: Vec2,
): Readonly<{ position: Vec2; wrap: LatticeOffset; key: string }> {
  const lattice = worldToLattice(cell, point)
  const u = canonicalCoordinate(lattice.x)
  const v = canonicalCoordinate(lattice.y)
  const position = latticePoint(cell, u.value, v.value)
  const key = `${Math.round(u.value * KEY_SCALE)}:${Math.round(v.value * KEY_SCALE)}`
  return { position, wrap: { u: u.tile, v: v.tile }, key }
}

function sourceSegments(paths: readonly ScenePath[]): SourceSegment[] {
  return paths.flatMap((path) => {
    const segmentCount = path.closed ? path.points.length : Math.max(0, path.points.length - 1)
    return Array.from({ length: segmentCount }, (_, segmentIndex) => {
      const a = path.points[segmentIndex]
      const b = path.points[(segmentIndex + 1) % path.points.length]
      if (!a || !b) throw new Error(`${path.id} contains an incomplete segment`)
      return {
        pathId: path.id,
        continuationId: path.continuationId ?? path.id,
        role: path.role,
        pathClosed: path.closed,
        pathLoops: path.closed || path.netWrap.u !== 0 || path.netWrap.v !== 0,
        pointCount: path.points.length,
        segmentIndex,
        a,
        b,
      }
    })
  })
}

function pointLineage(segment: SourceSegment, endpoint: 0 | 1): string {
  const rawIndex = segment.segmentIndex + endpoint
  const pointIndex = segment.pathLoops ? rawIndex % (segment.pointCount - (segment.pathClosed ? 0 : 1)) : rawIndex
  return `point:${segment.pathId}:${pointIndex}`
}

function intersectionParameters(
  left: SourceSegment,
  right: SourceSegment,
): Readonly<{ left: number; right: number }> | undefined {
  const r = subtract(left.b, left.a)
  const s = subtract(right.b, right.a)
  const denominator = cross(r, s)
  if (Math.abs(denominator) < EPSILON) return undefined
  const between = subtract(right.a, left.a)
  const leftParameter = cross(between, s) / denominator
  const rightParameter = cross(between, r) / denominator
  if (
    leftParameter < -EPSILON || leftParameter > 1 + EPSILON ||
    rightParameter < -EPSILON || rightParameter > 1 + EPSILON
  ) return undefined
  return {
    left: Math.min(1, Math.max(0, leftParameter)),
    right: Math.min(1, Math.max(0, rightParameter)),
  }
}

function setMarker(markers: Map<number, string>, parameter: number, lineage: string): void {
  const existing = [...markers].find(([candidate]) => Math.abs(candidate - parameter) < EPSILON)
  if (!existing) {
    markers.set(parameter, lineage)
    return
  }
  const [existingParameter, existingLineage] = existing
  if (existingLineage.startsWith('point:')) return
  markers.set(existingParameter, [existingLineage, lineage].sort()[0] ?? lineage)
}

function splitAtIntersections(
  segments: readonly SourceSegment[],
  cell: LatticeCell,
): Fragment[] {
  const bounds = segments.map((segment) => {
    const a = worldToLattice(cell, segment.a)
    const b = worldToLattice(cell, segment.b)
    return {
      minU: Math.min(a.x, b.x),
      maxU: Math.max(a.x, b.x),
      minV: Math.min(a.y, b.y),
      maxV: Math.max(a.y, b.y),
    }
  })
  const parameters = segments.map((segment) => new Map<number, string>([
    [0, pointLineage(segment, 0)],
    [1, pointLineage(segment, 1)],
  ]))
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    const left = segments[leftIndex]
    if (!left) continue
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const right = segments[rightIndex]
      if (!right) continue
      const leftBounds = bounds[leftIndex]
      const rightBounds = bounds[rightIndex]
      if (!leftBounds || !rightBounds) continue
      for (let u = -1; u <= 1; u += 1) {
        if (rightBounds.maxU + u < leftBounds.minU - EPSILON || rightBounds.minU + u > leftBounds.maxU + EPSILON) continue
        for (let v = -1; v <= 1; v += 1) {
          if (rightBounds.maxV + v < leftBounds.minV - EPSILON || rightBounds.minV + v > leftBounds.maxV + EPSILON) continue
          const translatedRight: SourceSegment = {
            ...right,
            a: translateByWrap(right.a, cell, { u, v }),
            b: translateByWrap(right.b, cell, { u, v }),
          }
          const intersection = intersectionParameters(left, translatedRight)
          if (!intersection) continue
          const leftReference = `${left.pathId}:${left.segmentIndex}`
          const rightReference = `${right.pathId}:${right.segmentIndex}`
          const leftMidpoint = worldToLattice(cell, interpolate(left.a, left.b, 0.5))
          const rightMidpoint = worldToLattice(cell, interpolate(right.a, right.b, 0.5))
          const relative = {
            u: canonicalCoordinate(rightMidpoint.x).tile + u - canonicalCoordinate(leftMidpoint.x).tile,
            v: canonicalCoordinate(rightMidpoint.y).tile + v - canonicalCoordinate(leftMidpoint.y).tile,
          }
          const crossingLineage = leftReference <= rightReference
            ? `cross:${leftReference}|${rightReference}@${relative.u},${relative.v}`
            : `cross:${rightReference}|${leftReference}@${-relative.u},${-relative.v}`
          const leftLineage = intersection.left < EPSILON
            ? pointLineage(left, 0)
            : intersection.left > 1 - EPSILON
              ? pointLineage(left, 1)
              : crossingLineage
          const rightLineage = intersection.right < EPSILON
            ? pointLineage(right, 0)
            : intersection.right > 1 - EPSILON
              ? pointLineage(right, 1)
              : crossingLineage
          const leftMarkers = parameters[leftIndex]
          const rightMarkers = parameters[rightIndex]
          if (leftMarkers) setMarker(leftMarkers, intersection.left, leftLineage)
          if (rightMarkers) setMarker(rightMarkers, intersection.right, rightLineage)
        }
      }
    }
  }

  return segments.flatMap((source, segmentIndex) => {
    const values = [...(parameters[segmentIndex] ?? [])].sort(([left], [right]) => left - right)
    return values.slice(0, -1).flatMap(([t0, aLineage], pieceIndex) => {
      const next = values[pieceIndex + 1]
      if (next === undefined || next[0] - t0 < EPSILON) return []
      const [t1, bLineage] = next
      return [{
        source,
        pieceIndex,
        t0,
        t1,
        a: interpolate(source.a, source.b, t0),
        b: interpolate(source.a, source.b, t1),
        aLineage,
        bLineage,
      }]
    })
  })
}

function positiveAngle(angle: number): number {
  return angle < 0 ? angle + Math.PI * 2 : angle
}

function faceCycles(graph: PeriodicGraph): PeriodicCycle[] {
  const edges = new Map(graph.halfEdges.map((edge) => [edge.id, edge]))
  const visited = new Set<string>()
  const faces: PeriodicCycle[] = []
  for (const first of graph.halfEdges) {
    if (visited.has(first.id)) continue
    const cycle: string[] = []
    let wrap: LatticeOffset = { u: 0, v: 0 }
    let current: PeriodicHalfEdge | undefined = first
    while (current && !visited.has(current.id)) {
      visited.add(current.id)
      cycle.push(current.id)
      wrap = { u: wrap.u + current.wrap.u, v: wrap.v + current.wrap.v }
      current = edges.get(current.next)
    }
    if (current?.id !== first.id) throw new Error(`Face walk from ${first.id} did not close`)
    faces.push({ id: `face:${faces.length}`, edges: cycle, netWrap: wrap })
  }
  return faces
}

function hashParity(value: string): 0 | 1 {
  let hash = 0
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) | 0
  return Math.abs(hash) % 2 as 0 | 1
}

function solveWeaveAssignments(
  crossings: readonly Crossing[],
  metadata: ReadonlyMap<string, EdgeMetadata>,
  halfEdges: readonly PeriodicHalfEdge[],
  components: readonly ContinuationComponent[],
): Map<string, Readonly<{ overPair: 0 | 1; phase: Readonly<{ u: 0 | 1; v: 0 | 1 }> }>> {
  type Occurrence = Readonly<{
    crossing: string
    pair: 0 | 1
    order: number
    tile: LatticeOffset
  }>
  type Constraint = Readonly<{
    other: string
    xor: 0 | 1
    delta: LatticeOffset
  }>
  const edgeById = new Map(halfEdges.map((edge) => [edge.id, edge]))
  const crossingByVertex = new Map(crossings.map((crossing) => [crossing.vertex, crossing]))
  const sequences = components.map((component) => {
    const visits = componentVisits(component.edges, edgeById)
    const occurrences: Occurrence[] = []
    for (let order = 0; order < visits.length; order += 1) {
      const visit = visits[order]
      if (!visit) continue
      const crossing = crossingByVertex.get(visit.vertex)
      if (!crossing || crossing.kind === 'contact') continue
      const pair = crossing.continuations.findIndex((arms) =>
        arms.some((arm) => metadata.get(arm)?.continuationId === component.continuationId),
      )
      if (pair < 0) continue
      const occurrence = { crossing: crossing.id, pair: pair as 0 | 1, order, tile: visit.tile }
      const previous = occurrences.at(-1)
      if (
        previous?.crossing !== occurrence.crossing ||
        previous.tile.u !== occurrence.tile.u || previous.tile.v !== occurrence.tile.v
      ) occurrences.push(occurrence)
    }
    if (
      component.closed && occurrences.length > 1 &&
      occurrences[0]?.crossing === occurrences.at(-1)?.crossing
    ) {
      occurrences.pop()
    }
    const netWrap = component.edges.reduce<LatticeOffset>((sum, edgeId) => {
      const edge = edgeById.get(edgeId)
      return edge ? { u: sum.u + edge.wrap.u, v: sum.v + edge.wrap.v } : sum
    }, { u: 0, v: 0 })
    return { occurrences, closed: component.closed, netWrap }
  })

  const constraints = new Map<string, Constraint[]>()
  const constrain = (left: Occurrence, right: Occurrence): void => {
    const xor = (1 ^ left.pair ^ right.pair) as 0 | 1
    const delta = { u: right.tile.u - left.tile.u, v: right.tile.v - left.tile.v }
    const leftList = constraints.get(left.crossing) ?? []
    const rightList = constraints.get(right.crossing) ?? []
    leftList.push({ other: right.crossing, xor, delta })
    rightList.push({ other: left.crossing, xor, delta: { u: -delta.u, v: -delta.v } })
    constraints.set(left.crossing, leftList)
    constraints.set(right.crossing, rightList)
  }

  for (const sequence of sequences) {
    const unique = sequence.occurrences.sort((left, right) => left.order - right.order)
    for (let index = 1; index < unique.length; index += 1) {
      constrain(unique[index - 1]!, unique[index]!)
    }
    if (sequence.closed && unique.length > 0) {
      const first = unique[0]!
      constrain(unique.at(-1)!, {
        ...first,
        tile: { u: first.tile.u + sequence.netWrap.u, v: first.tile.v + sequence.netWrap.v },
      })
    }
  }

  const assignments = new Map<string, Readonly<{ overPair: 0 | 1; phase: Readonly<{ u: 0 | 1; v: 0 | 1 }> }>>()
  const phases = [
    { u: 0, v: 0 },
    { u: 1, v: 0 },
    { u: 0, v: 1 },
    { u: 1, v: 1 },
  ] as const
  const phaseDelta = (phase: typeof phases[number], delta: LatticeOffset): 0 | 1 =>
    (Math.abs(phase.u * delta.u + phase.v * delta.v) % 2) as 0 | 1
  for (const crossing of crossings) {
    if (assignments.has(crossing.id)) continue
    let solution: Readonly<{ values: Map<string, 0 | 1>; phase: typeof phases[number] }> | undefined
    for (const phase of phases) {
      const values = new Map<string, 0 | 1>([[crossing.id, hashParity(crossing.id)]])
      const queue = [crossing.id]
      let valid = true
      while (queue.length > 0 && valid) {
        const current = queue.shift()!
        const currentValue = values.get(current)!
        for (const constraint of constraints.get(current) ?? []) {
          const expected = (currentValue ^ constraint.xor ^ phaseDelta(phase, constraint.delta)) as 0 | 1
          const assigned = values.get(constraint.other)
          if (assigned !== undefined && assigned !== expected) {
            valid = false
            break
          }
          if (assigned === undefined) {
            values.set(constraint.other, expected)
            queue.push(constraint.other)
          }
        }
      }
      if (valid) {
        solution = { values, phase }
        break
      }
    }
    if (!solution) throw new Error(
      `Unsatisfiable periodic over/under system at ${crossing.id}: ${JSON.stringify(constraints.get(crossing.id) ?? [])}`,
    )
    for (const [id, overPair] of solution.values) {
      assignments.set(id, { overPair, phase: solution.phase })
    }
  }
  return assignments
}

type ContinuationComponent = Readonly<{
  continuationId: string
  role: ScenePath['role']
  edges: readonly string[]
  closed: boolean
}>

function continuationComponents(
  halfEdges: readonly PeriodicHalfEdge[],
  metadata: ReadonlyMap<string, EdgeMetadata>,
): ContinuationComponent[] {
  const edgeById = new Map(halfEdges.map((edge) => [edge.id, edge]))
  const forwardByContinuation = new Map<string, string[]>()
  for (const edge of halfEdges) {
    const detail = metadata.get(edge.id)
    if (!detail?.forward) continue
    const entries = forwardByContinuation.get(detail.continuationId) ?? []
    entries.push(edge.id)
    forwardByContinuation.set(detail.continuationId, entries)
  }

  const results: ContinuationComponent[] = []
  for (const [continuationId, forwardEdges] of forwardByContinuation) {
    const adjacency = new Map<string, string[]>()
    for (const edgeId of forwardEdges) {
      const edge = edgeById.get(edgeId)
      const destination = edge ? edgeById.get(edge.twin)?.origin : undefined
      if (!edge || !destination) continue
      for (const vertex of [edge.origin, destination]) {
        const entries = adjacency.get(vertex) ?? []
        entries.push(edgeId)
        adjacency.set(vertex, entries)
      }
    }
    for (const [vertex, entries] of adjacency) {
      if (entries.length > 2) throw new Error(`${continuationId} branches at ${vertex}`)
    }

    const remaining = new Set(forwardEdges)
    while (remaining.size > 0) {
      const seed = [...remaining].sort()[0]!
      const seedEdge = edgeById.get(seed)!
      const seedDestination = edgeById.get(seedEdge.twin)!.origin
      const componentEdges = new Set<string>()
      const frontier = [seedEdge.origin, seedDestination]
      const componentVertices = new Set<string>()
      while (frontier.length > 0) {
        const vertex = frontier.pop()!
        if (componentVertices.has(vertex)) continue
        componentVertices.add(vertex)
        for (const edgeId of adjacency.get(vertex) ?? []) {
          componentEdges.add(edgeId)
          const edge = edgeById.get(edgeId)!
          const destination = edgeById.get(edge.twin)!.origin
          frontier.push(edge.origin === vertex ? destination : edge.origin)
        }
      }

      const degreeOne = [...componentVertices].filter((vertex) =>
        (adjacency.get(vertex) ?? []).filter((edge) => componentEdges.has(edge)).length === 1,
      ).sort()
      const start = degreeOne[0] ?? [...componentVertices].sort()[0]!
      const ordered: string[] = []
      let current = start
      while (ordered.length < componentEdges.size) {
        const nextBase = (adjacency.get(current) ?? [])
          .filter((edge) => componentEdges.has(edge) && remaining.has(edge))
          .sort()[0]
        if (!nextBase) break
        const base = edgeById.get(nextBase)!
        const oriented = base.origin === current ? base.id : base.twin
        ordered.push(oriented)
        remaining.delete(nextBase)
        current = edgeById.get(edgeById.get(oriented)!.twin)!.origin
      }
      if (ordered.length !== componentEdges.size) throw new Error(`${continuationId} could not be traversed end to end`)
      const role = metadata.get(seed)?.role ?? 'ornament'
      if (ordered.some((edge) => metadata.get(edge)?.role !== role)) {
        throw new Error(`${continuationId} mixes render roles`)
      }
      results.push({ continuationId, role, edges: ordered, closed: current === start })
    }
  }
  return results
}

function componentVisits(
  edges: readonly string[],
  edgeById: ReadonlyMap<string, PeriodicHalfEdge>,
): Array<Readonly<{ vertex: string; tile: LatticeOffset }>> {
  if (edges.length === 0) return []
  const first = edgeById.get(edges[0]!)
  if (!first) return []
  const visits = [{ vertex: first.origin, tile: { u: 0, v: 0 } }]
  let tile: LatticeOffset = { u: 0, v: 0 }
  for (const edgeId of edges) {
    const edge = edgeById.get(edgeId)
    const destination = edge ? edgeById.get(edge.twin)?.origin : undefined
    if (edge && destination) {
      tile = { u: tile.u + edge.wrap.u, v: tile.v + edge.wrap.v }
      visits.push({ vertex: destination, tile })
    }
  }
  return visits
}

/**
 * Builds one canonical torus graph from the same paths that are rendered.
 * Intersections split both source paths, so topology signatures and weave records
 * necessarily change when the visible arrangement changes.
 */
export function compilePeriodicArrangement(
  cell: LatticeCell,
  paths: readonly ScenePath[],
): PeriodicGraph {
  const segments = sourceSegments(paths)
  const fragments = splitAtIntersections(segments, cell)
  const verticesByKey = new Map<string, PeriodicVertex[]>()
  const verticesByLineage = new Map<string, PeriodicVertex>()
  const allVertices: PeriodicVertex[] = []
  const mutableEdges: Array<PeriodicHalfEdge & { next: string }> = []
  const metadata = new Map<string, EdgeMetadata>()

  function vertexFor(point: Vec2, lineage: string): Readonly<{ vertex: PeriodicVertex; wrap: LatticeOffset }> {
    const canonical = canonicalPoint(cell, point)
    const byLineage = verticesByLineage.get(lineage)
    if (byLineage) return { vertex: byLineage, wrap: canonical.wrap }
    let vertex = (verticesByKey.get(canonical.key) ?? []).find((candidate) =>
      Math.hypot(
        candidate.position.x - canonical.position.x,
        candidate.position.y - canonical.position.y,
      ) < 1e-6,
    )
    if (!vertex) {
      vertex = {
        id: `v:${lineage}`,
        lineage,
        position: canonical.position,
      }
      const bucket = verticesByKey.get(canonical.key) ?? []
      bucket.push(vertex)
      verticesByKey.set(canonical.key, bucket)
      allVertices.push(vertex)
    }
    verticesByLineage.set(lineage, vertex)
    return { vertex, wrap: canonical.wrap }
  }

  for (const fragment of fragments) {
    const start = vertexFor(fragment.a, fragment.aLineage)
    const end = vertexFor(fragment.b, fragment.bLineage)
    if (start.vertex.id === end.vertex.id && start.wrap.u === end.wrap.u && start.wrap.v === end.wrap.v) {
      continue
    }
    const base = `e:${fragment.source.pathId}:${fragment.source.segmentIndex}:${fragment.pieceIndex}`
    const forward = `${base}:f`
    const reverse = `${base}:r`
    const wrap = {
      u: end.wrap.u - start.wrap.u,
      v: end.wrap.v - start.wrap.v,
    }
    mutableEdges.push(
      { id: forward, origin: start.vertex.id, twin: reverse, next: '', wrap },
      { id: reverse, origin: end.vertex.id, twin: forward, next: '', wrap: { u: -wrap.u, v: -wrap.v } },
    )
    const order = fragment.source.segmentIndex + fragment.t0
    metadata.set(forward, {
      sourcePath: fragment.source.pathId,
      continuationId: fragment.source.continuationId,
      role: fragment.source.role,
      forward: true,
      order,
    })
    metadata.set(reverse, {
      sourcePath: fragment.source.pathId,
      continuationId: fragment.source.continuationId,
      role: fragment.source.role,
      forward: false,
      order,
    })
  }

  const usedVertexIds = new Set(mutableEdges.map((edge) => edge.origin))
  const vertices = allVertices.filter((vertex) => usedVertexIds.has(vertex.id))
  const provisional: PeriodicGraph = {
    cell,
    vertices,
    halfEdges: mutableEdges,
    faces: [],
    strands: [],
    crossings: [],
  }
  const outgoing = new Map<string, string[]>()
  for (const edge of mutableEdges) {
    const arms = outgoing.get(edge.origin) ?? []
    arms.push(edge.id)
    outgoing.set(edge.origin, arms)
  }
  const edgeById = new Map(mutableEdges.map((edge) => [edge.id, edge]))
  const vertexById = new Map(vertices.map((vertex) => [vertex.id, vertex]))
  const angleByEdge = new Map(mutableEdges.map((edge) => {
    const origin = vertexById.get(edge.origin)
    const destination = vertexById.get(edgeById.get(edge.twin)?.origin ?? '')
    if (!origin || !destination) return [edge.id, 0] as const
    const unwrapped = translateByWrap(destination.position, cell, edge.wrap)
    return [
      edge.id,
      positiveAngle(Math.atan2(-(unwrapped.y - origin.position.y), unwrapped.x - origin.position.x)),
    ] as const
  }))
  for (const arms of outgoing.values()) {
    arms.sort((left, right) => (angleByEdge.get(left) ?? 0) - (angleByEdge.get(right) ?? 0))
  }
  for (const edge of mutableEdges) {
    const twin = edgeById.get(edge.twin)
    const arms = twin ? outgoing.get(twin.origin) : undefined
    const twinIndex = arms?.indexOf(edge.twin) ?? -1
    if (!arms?.length || twinIndex < 0) throw new Error(`Cannot continue face after ${edge.id}`)
    edge.next = arms[(twinIndex + 1) % arms.length] ?? edge.twin
  }

  const components = continuationComponents(mutableEdges, metadata)
  const componentCount = new Map<string, number>()
  for (const component of components) {
    componentCount.set(component.continuationId, (componentCount.get(component.continuationId) ?? 0) + 1)
  }
  const componentIndex = new Map<string, number>()
  const strands: PeriodicStrand[] = components.map((component) => {
    const index = componentIndex.get(component.continuationId) ?? 0
    componentIndex.set(component.continuationId, index + 1)
    const edges = [...component.edges]
    const netWrap = edges.reduce<LatticeOffset>((sum, edgeId) => {
      const edge = edgeById.get(edgeId)
      return edge ? { u: sum.u + edge.wrap.u, v: sum.v + edge.wrap.v } : sum
    }, { u: 0, v: 0 })
    return {
      id: (componentCount.get(component.continuationId) ?? 0) === 1
        ? component.continuationId
        : `${component.continuationId}:${index}`,
      continuationId: component.continuationId,
      role: component.role,
      pathClosed: component.closed && netWrap.u === 0 && netWrap.v === 0,
      edges,
      netWrap,
    }
  })

  const graphWithoutFaces: PeriodicGraph = {
    ...provisional,
    strands,
    crossings: [],
  }
  const crossings: Crossing[] = []
  for (const [vertex, arms] of outgoing) {
    if (arms.length !== 4) continue
    const groups = new Map<string, string[]>()
    for (const arm of arms) {
      const continuationId = metadata.get(arm)?.continuationId
      if (!continuationId) continue
      const group = groups.get(continuationId) ?? []
      group.push(arm)
      groups.set(continuationId, group)
    }
    if (groups.size !== 2 || [...groups.values()].some((group) => group.length !== 2)) continue
    const armsCCW = [...arms].sort((left, right) =>
      (angleByEdge.get(left) ?? 0) - (angleByEdge.get(right) ?? 0),
    ) as [string, string, string, string]
    const continuations = [...groups.values()].map((group) => [group[0]!, group[1]!] as const)
    const isOppositePair = (pair: readonly [string, string]): boolean => {
      const left = armsCCW.indexOf(pair[0])
      const right = armsCCW.indexOf(pair[1])
      return Math.abs(left - right) === 2
    }
    const position = vertexById.get(vertex)?.position
    const lattice = position ? worldToLattice(cell, position) : undefined
    const onPeriodicSeam = lattice !== undefined && (
      Math.abs(lattice.x) < EPSILON || Math.abs(lattice.y) < EPSILON
    )
    const isTransverse = continuations.every(isOppositePair)
    const isGuideCrossing = arms.some((arm) => metadata.get(arm)?.role === 'strand')
    const id = `crossing:${vertex}`
    crossings.push({
      id,
      // Interior construction endpoints are joins, even when their incident arms
      // alternate around the point. The same shape on a torus seam is a genuine
      // transverse crossing between periodic representatives and must interlace.
      kind: isTransverse && !isGuideCrossing && (!vertex.includes('point:') || onPeriodicSeam)
        ? 'intersection'
        : 'contact',
      vertex,
      armsCCW,
      continuations: [continuations[0]!, continuations[1]!],
      overPair: 0,
      weavePhase: { u: 0, v: 0 },
    })
  }

  const assignments = solveWeaveAssignments(crossings, metadata, mutableEdges, components)
  const solvedCrossings = crossings.map((crossing) => ({
    ...crossing,
    overPair: assignments.get(crossing.id)?.overPair ?? 0,
    weavePhase: assignments.get(crossing.id)?.phase ?? { u: 0, v: 0 },
  }))
  const withCrossings: PeriodicGraph = { ...graphWithoutFaces, crossings: solvedCrossings }
  return { ...withCrossings, faces: faceCycles(withCrossings) }
}

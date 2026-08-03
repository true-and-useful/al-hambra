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
  // A path may run for several cells before it closes, so the translations worth
  // testing follow from how far the geometry actually reaches rather than from a
  // fixed one-cell halo. The bounding-box rejection below keeps this cheap.
  const spread = (
    low: (b: typeof bounds[number]) => number,
    high: (b: typeof bounds[number]) => number,
  ): number => {
    let minimum = Number.POSITIVE_INFINITY
    let maximum = Number.NEGATIVE_INFINITY
    for (const entry of bounds) {
      if (!entry) continue
      minimum = Math.min(minimum, low(entry))
      maximum = Math.max(maximum, high(entry))
    }
    return Number.isFinite(minimum) ? Math.ceil(maximum - minimum) + 1 : 1
  }
  const uSpan = spread((b) => b.minU, (b) => b.maxU)
  const vSpan = spread((b) => b.minV, (b) => b.maxV)

  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    const left = segments[leftIndex]
    if (!left) continue
    for (let rightIndex = leftIndex + 1; rightIndex < segments.length; rightIndex += 1) {
      const right = segments[rightIndex]
      if (!right) continue
      const leftBounds = bounds[leftIndex]
      const rightBounds = bounds[rightIndex]
      if (!leftBounds || !rightBounds) continue
      for (let u = -uSpan; u <= uSpan; u += 1) {
        if (rightBounds.maxU + u < leftBounds.minU - EPSILON || rightBounds.minU + u > leftBounds.maxU + EPSILON) continue
        for (let v = -vSpan; v <= vSpan; v += 1) {
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

/**
 * Assigns over/under by checkerboard-colouring the faces of the arrangement.
 *
 * Two faces that share an edge get opposite colours, so the four sectors around
 * every crossing alternate. Choosing the over-strand by the colour of one fixed
 * sector therefore alternates along every strand automatically, which is the
 * standard construction of an alternating diagram from a four-valent graph. It
 * needs no lattice parity, so the weave repeats on the same cell as the pattern.
 *
 * Returns undefined when the faces are not two-colourable on the torus, which
 * means no globally alternating weave exists on this cell.
 */
function checkerboardWeave(
  crossings: readonly Crossing[],
  faces: readonly PeriodicCycle[],
  halfEdges: readonly PeriodicHalfEdge[],
): Map<string, Readonly<{ overPair: 0 | 1; phase: Readonly<{ u: 0 | 1; v: 0 | 1 }> }>> | undefined {
  const edgeById = new Map(halfEdges.map((edge) => [edge.id, edge]))
  const faceByEdge = new Map<string, string>()
  // Offset of each edge occurrence relative to the start of its own face cycle.
  const offsetByEdge = new Map<string, LatticeOffset>()
  for (const face of faces) {
    let offset: LatticeOffset = { u: 0, v: 0 }
    for (const edgeId of face.edges) {
      faceByEdge.set(edgeId, face.id)
      offsetByEdge.set(edgeId, offset)
      const edge = edgeById.get(edgeId)
      if (edge) offset = { u: offset.u + edge.wrap.u, v: offset.v + edge.wrap.v }
    }
  }

  // Lifting a face across one of its edges lands the neighbour at this offset.
  type Link = Readonly<{ other: string; delta: LatticeOffset }>
  const links = new Map<string, Link[]>()
  for (const [edgeId, faceId] of faceByEdge) {
    const edge = edgeById.get(edgeId)
    const here = offsetByEdge.get(edgeId)
    const twinOffset = edge ? offsetByEdge.get(edge.twin) : undefined
    const other = edge ? faceByEdge.get(edge.twin) : undefined
    if (!edge || !here || !twinOffset || other === undefined) continue
    const delta = {
      u: here.u + edge.wrap.u - twinOffset.u,
      v: here.v + edge.wrap.v - twinOffset.v,
    }
    const entries = links.get(faceId) ?? []
    entries.push({ other, delta })
    links.set(faceId, entries)
  }

  const phases = [
    { u: 0, v: 0 },
    { u: 1, v: 0 },
    { u: 0, v: 1 },
    { u: 1, v: 1 },
  ] as const
  const parity = (phase: typeof phases[number], offset: LatticeOffset): 0 | 1 =>
    (Math.abs(phase.u * offset.u + phase.v * offset.v) % 2) as 0 | 1

  for (const phase of phases) {
    const colour = new Map<string, 0 | 1>()
    let consistent = true
    for (const face of faces) {
      if (!consistent) break
      if (colour.has(face.id)) continue
      colour.set(face.id, 0)
      const queue = [face.id]
      while (queue.length > 0 && consistent) {
        const current = queue.shift()
        if (current === undefined) continue
        const here = colour.get(current) ?? 0
        for (const link of links.get(current) ?? []) {
          const want = (here ^ 1 ^ parity(phase, link.delta)) as 0 | 1
          const existing = colour.get(link.other)
          if (existing === undefined) {
            colour.set(link.other, want)
            queue.push(link.other)
          } else if (existing !== want) {
            consistent = false
            break
          }
        }
      }
    }
    if (!consistent) continue

    const assignments = new Map<
      string,
      Readonly<{ overPair: 0 | 1; phase: Readonly<{ u: 0 | 1; v: 0 | 1 }> }>
    >()
    for (const crossing of crossings) {
      // The sector swept counter-clockwise from arm 0 to arm 1 belongs to the
      // face that leaves this vertex along arm 1, shifted so that occurrence
      // sits in the base cell.
      const arm = crossing.armsCCW[1]
      const sector = faceByEdge.get(arm)
      const shift = offsetByEdge.get(arm) ?? { u: 0, v: 0 }
      const base = sector === undefined ? 0 : colour.get(sector) ?? 0
      const black = ((base ^ parity(phase, shift)) as 0 | 1) === 0
      const zeroIndex = crossing.continuations.findIndex((pair) =>
        pair.includes(crossing.armsCCW[0]),
      )
      const first = (zeroIndex < 0 ? 0 : zeroIndex) as 0 | 1
      assignments.set(crossing.id, {
        overPair: black ? first : ((1 - first) as 0 | 1),
        phase,
      })
    }
    return assignments
  }
  return undefined
}

type ContinuationComponent = Readonly<{
  continuationId: string
  role: ScenePath['role']
  edges: readonly string[]
  closed: boolean
}>

/**
 * Orders each continuation along the source path it came from rather than by
 * walking the graph. A strand is allowed to cross itself — real strapwork does —
 * so vertex degree cannot be used to recover the traversal order, but the
 * parameter recorded when each fragment was cut always can.
 */
function continuationComponents(
  halfEdges: readonly PeriodicHalfEdge[],
  metadata: ReadonlyMap<string, EdgeMetadata>,
): ContinuationComponent[] {
  const edgeById = new Map(halfEdges.map((edge) => [edge.id, edge]))
  const byContinuation = new Map<string, Map<string, string[]>>()
  for (const edge of halfEdges) {
    const detail = metadata.get(edge.id)
    if (!detail?.forward) continue
    const paths = byContinuation.get(detail.continuationId) ?? new Map<string, string[]>()
    const entries = paths.get(detail.sourcePath) ?? []
    entries.push(edge.id)
    paths.set(detail.sourcePath, entries)
    byContinuation.set(detail.continuationId, paths)
  }

  const destinationOfEdge = (id: string): string | undefined => {
    const twin = edgeById.get(id)?.twin
    return twin === undefined ? undefined : edgeById.get(twin)?.origin
  }

  const results: ContinuationComponent[] = []
  for (const [continuationId, paths] of byContinuation) {
    const chains = [...paths.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, ids]) =>
        [...ids].sort((left, right) =>
          (metadata.get(left)?.order ?? 0) - (metadata.get(right)?.order ?? 0),
        ),
      )
    const ordered = chains[0]
    if (!ordered) continue
    // Stitching several source paths into one continuation would also have to
    // reverse a path authored against the traversal, which is a real design
    // decision rather than a loop. Nothing emits multi-path continuations today,
    // so refuse clearly instead of half-supporting it.
    if (chains.length > 1) {
      throw new Error(
        `${continuationId} spans ${chains.length} source paths; multi-path continuations are not supported`,
      )
    }

    for (let index = 1; index < ordered.length; index += 1) {
      if (destinationOfEdge(ordered[index - 1] ?? '') !== edgeById.get(ordered[index] ?? '')?.origin) {
        throw new Error(`${continuationId} is disconnected before ${ordered[index]}`)
      }
    }
    const role = metadata.get(ordered[0] ?? '')?.role ?? 'ornament'
    if (ordered.some((edge) => metadata.get(edge)?.role !== role)) {
      throw new Error(`${continuationId} mixes render roles`)
    }
    results.push({
      continuationId,
      role,
      edges: ordered,
      closed: destinationOfEdge(ordered.at(-1) ?? '') === edgeById.get(ordered[0] ?? '')?.origin,
    })
  }
  return results
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
    const pairedByContinuation =
      groups.size === 2 && [...groups.values()].every((group) => group.length === 2)
    const selfCrossing = groups.size === 1 && [...groups.values()][0]?.length === 4
    if (!pairedByContinuation && !selfCrossing) continue
    const armsCCW = [...arms].sort((left, right) =>
      (angleByEdge.get(left) ?? 0) - (angleByEdge.get(right) ?? 0),
    ) as [string, string, string, string]
    // A strand crossing itself puts all four arms in one continuation, so the
    // straight-through pairing has to come from the cyclic order instead.
    const continuations = selfCrossing
      ? [[armsCCW[0], armsCCW[2]] as const, [armsCCW[1], armsCCW[3]] as const]
      : [...groups.values()].map((group) => [group[0]!, group[1]!] as const)
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

  const faces = faceCycles(graphWithoutFaces)
  const assignments = checkerboardWeave(crossings, faces, mutableEdges)
  // Even degree everywhere makes the arrangement face-two-colourable in the
  // plane, so lifting to the covering space and pushing the colouring back down
  // succeeds for one of the four lattice parities whenever the lifted graph is
  // connected. A failure under those conditions is a real defect rather than an
  // unsupported pattern. Arrangements with loose ends have no alternating weave
  // to find at all, and fall back to a stable arbitrary choice.
  const degrees = new Map<string, number>()
  for (const edge of mutableEdges) degrees.set(edge.origin, (degrees.get(edge.origin) ?? 0) + 1)
  const everyDegreeEven = [...degrees.values()].every((degree) => degree % 2 === 0)
  if (assignments === undefined && everyDegreeEven) {
    throw new Error(
      'No alternating weave found: the arrangement faces are not two-colourable ' +
      'under any of the four lattice parities',
    )
  }
  const solvedCrossings = crossings.map((crossing) => ({
    ...crossing,
    overPair: assignments?.get(crossing.id)?.overPair ?? 0,
    weavePhase: assignments?.get(crossing.id)?.phase ?? { u: 0, v: 0 },
  }))
  return { ...graphWithoutFaces, crossings: solvedCrossings, faces }
}

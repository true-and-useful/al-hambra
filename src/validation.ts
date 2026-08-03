import {
  graphInvariantErrors,
  length,
  subtract,
  topologySignature,
  translateByWrap,
} from './geometry/kernel'
import { compilePattern } from './geometry/recipe'
import type { PatternDefinition } from './geometry/recipe'
import type { PeriodicGraph, Vec2 } from './geometry/types'

export type ValidationTolerance = Readonly<{
  minimumEdgeLength: number
  warningClearance: number
  parameterPrecision: number
  exclusionMargin: number
}>

export type RangeValidationOptions = Readonly<{
  samples?: number
  tolerance?: Partial<ValidationTolerance>
  onSuspect?: (interval: SuspectInterval) => void
}>

export type SuspectInterval = Readonly<{
  from: number
  to: number
  reasons: readonly ('topology-change' | 'low-clearance' | 'short-edge' | 'invariant')[]
  minimumClearance: number
  minimumEdgeLength: number
}>

export type ValidationReport = Readonly<{
  patternId: string
  sampleCount: number
  signatures: readonly string[]
  minimumObservedClearance: number
  minimumObservedEdgeLength: number
  suspectIntervals: readonly SuspectInterval[]
  excludedRanges: readonly Readonly<{ from: number; to: number }>[]
  invariantErrors: readonly string[]
  valid: boolean
}>

export const DEFAULT_VALIDATION_TOLERANCE: ValidationTolerance = {
  minimumEdgeLength: 4,
  warningClearance: 8,
  parameterPrecision: 1 / 65_536,
  exclusionMargin: 0.005,
}

type Sample = Readonly<{
  parameter: number
  signature: string
  clearance: number
  edgeLength: number
  invariantErrors: readonly string[]
}>

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left.x - right.x, left.y - right.y)
}

/** Minimum vertex separation, including neighboring representatives of the torus. */
export function minimumVertexClearance(graph: PeriodicGraph): number {
  let minimum = Number.POSITIVE_INFINITY
  for (let leftIndex = 0; leftIndex < graph.vertices.length; leftIndex += 1) {
    const left = graph.vertices[leftIndex]
    if (left === undefined) continue
    for (let rightIndex = leftIndex + 1; rightIndex < graph.vertices.length; rightIndex += 1) {
      const right = graph.vertices[rightIndex]
      if (right === undefined) continue
      for (let u = -1; u <= 1; u += 1) {
        for (let v = -1; v <= 1; v += 1) {
          const representative = translateByWrap(right.position, graph.cell, { u, v })
          minimum = Math.min(minimum, distance(left.position, representative))
        }
      }
    }
  }
  return minimum
}

export function minimumGraphEdgeLength(graph: PeriodicGraph): number {
  let minimum = Number.POSITIVE_INFINITY
  const vertices = new Map(graph.vertices.map((vertex) => [vertex.id, vertex]))
  const edges = new Map(graph.halfEdges.map((edge) => [edge.id, edge]))
  for (const edge of graph.halfEdges) {
    const origin = vertices.get(edge.origin)
    const twin = edges.get(edge.twin)
    const destinationVertex = twin ? vertices.get(twin.origin) : undefined
    if (origin === undefined || destinationVertex === undefined) continue
    const destination = translateByWrap(destinationVertex.position, graph.cell, edge.wrap)
    minimum = Math.min(minimum, length(subtract(destination, origin.position)))
  }
  return minimum
}

function pointToSegmentDistance(point: Vec2, start: Vec2, end: Vec2): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const denominator = dx * dx + dy * dy
  if (denominator === 0) return distance(point, start)
  const t = Math.min(1, Math.max(0, ((point.x - start.x) * dx + (point.y - start.y) * dy) / denominator))
  return distance(point, { x: start.x + dx * t, y: start.y + dy * t })
}

function segmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  const ab = subtract(b, a)
  const cd = subtract(d, c)
  const denominator = ab.x * cd.y - ab.y * cd.x
  if (Math.abs(denominator) > 1e-9) {
    const ac = subtract(c, a)
    const t = (ac.x * cd.y - ac.y * cd.x) / denominator
    const u = (ac.x * ab.y - ac.y * ab.x) / denominator
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0
  }
  return Math.min(
    pointToSegmentDistance(a, c, d),
    pointToSegmentDistance(b, c, d),
    pointToSegmentDistance(c, a, b),
    pointToSegmentDistance(d, a, b),
  )
}

/** Minimum clearance between nonincident graph edges over adjacent torus representatives. */
export function minimumGraphClearance(graph: PeriodicGraph): number {
  const vertices = new Map(graph.vertices.map((vertex) => [vertex.id, vertex]))
  const edges = new Map(graph.halfEdges.map((edge) => [edge.id, edge]))
  const segments = graph.halfEdges.flatMap((edge) => {
    if (edge.id > edge.twin) return []
    const origin = vertices.get(edge.origin)
    const twin = edges.get(edge.twin)
    const destination = twin ? vertices.get(twin.origin) : undefined
    if (!origin || !destination) return []
    return [{
      id: edge.id,
      a: origin.position,
      b: translateByWrap(destination.position, graph.cell, edge.wrap),
    }]
  })
  let minimum = Number.POSITIVE_INFINITY
  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    const left = segments[leftIndex]
    if (!left) continue
    for (let rightIndex = leftIndex; rightIndex < segments.length; rightIndex += 1) {
      const right = segments[rightIndex]
      if (!right) continue
      for (let u = -1; u <= 1; u += 1) {
        for (let v = -1; v <= 1; v += 1) {
          if (leftIndex === rightIndex && u === 0 && v === 0) continue
          const c = translateByWrap(right.a, graph.cell, { u, v })
          const d = translateByWrap(right.b, graph.cell, { u, v })
          const sharesEndpoint = [
            distance(left.a, c), distance(left.a, d), distance(left.b, c), distance(left.b, d),
          ].some((separation) => separation < 1e-7)
          if (sharesEndpoint) continue
          minimum = Math.min(minimum, segmentDistance(left.a, left.b, c, d))
        }
      }
    }
  }
  return minimum
}

function makeEvaluator(definition: PatternDefinition): (parameter: number) => Sample {
  const cache = new Map<number, Sample>()
  return (parameter) => {
    const cached = cache.get(parameter)
    if (cached !== undefined) return cached
    const graph = compilePattern(definition, parameter).graph
    const sample: Sample = {
      parameter,
      signature: topologySignature(graph),
      clearance: minimumGraphClearance(graph),
      edgeLength: minimumGraphEdgeLength(graph),
      invariantErrors: graphInvariantErrors(graph),
    }
    cache.set(parameter, sample)
    return sample
  }
}

/**
 * Generic deterministic bisection hook used to localize a predicate transition.
 * This is intentionally empirical; it does not claim an interval proof.
 */
export function refineSuspectInterval(
  from: number,
  to: number,
  precision: number,
  isLeftClass: (parameter: number) => boolean,
): Readonly<{ from: number; to: number }> {
  if (![from, to, precision].every(Number.isFinite) || to < from || precision <= 0) {
    throw new RangeError('Bisection needs a finite ordered interval and positive precision')
  }
  let left = from
  let right = to
  const leftClass = isLeftClass(left)
  const maximumSteps = Math.ceil(Math.log2(Math.max(1, (right - left) / precision))) + 2
  for (let step = 0; right - left > precision && step < maximumSteps; step += 1) {
    const midpoint = (left + right) / 2
    if (midpoint === left || midpoint === right) break
    if (isLeftClass(midpoint) === leftClass) left = midpoint
    else right = midpoint
  }
  return { from: left, to: right }
}

function mergeIntervals(intervals: readonly SuspectInterval[]): SuspectInterval[] {
  const sorted = [...intervals].sort((a, b) => a.from - b.from)
  const merged: SuspectInterval[] = []
  for (const interval of sorted) {
    const previous = merged.at(-1)
    if (previous === undefined || interval.from > previous.to) {
      merged.push(interval)
      continue
    }
    merged[merged.length - 1] = {
      from: previous.from,
      to: Math.max(previous.to, interval.to),
      reasons: [...new Set([...previous.reasons, ...interval.reasons])],
      minimumClearance: Math.min(previous.minimumClearance, interval.minimumClearance),
      minimumEdgeLength: Math.min(previous.minimumEdgeLength, interval.minimumEdgeLength),
    }
  }
  return merged
}

export function validatePatternRange(
  definition: PatternDefinition,
  options: RangeValidationOptions = {},
): ValidationReport {
  const sampleCount = options.samples ?? 512
  if (!Number.isInteger(sampleCount) || sampleCount < 2) {
    throw new Error('Range validation requires at least two samples')
  }
  const tolerance: ValidationTolerance = {
    ...DEFAULT_VALIDATION_TOLERANCE,
    ...options.tolerance,
  }
  if (
    !Number.isFinite(tolerance.minimumEdgeLength) || tolerance.minimumEdgeLength <= 0 ||
    !Number.isFinite(tolerance.warningClearance) || tolerance.warningClearance <= 0 ||
    !Number.isFinite(tolerance.parameterPrecision) || tolerance.parameterPrecision <= 0 ||
    !Number.isFinite(tolerance.exclusionMargin) || tolerance.exclusionMargin < 0 ||
    tolerance.exclusionMargin >= 0.5
  ) {
    throw new RangeError('Validation tolerances must be finite, positive, and bounded')
  }
  const evaluate = makeEvaluator(definition)
  const samples = Array.from({ length: sampleCount }, (_, index) =>
    evaluate(index / (sampleCount - 1)),
  )
  const suspects: SuspectInterval[] = []
  const invariantErrors = new Set<string>()

  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index]
    if (sample === undefined) continue
    for (const error of sample.invariantErrors) invariantErrors.add(error)
    const previous = samples[index - 1]
    const next = samples[index + 1]
    const neighborhoodFrom = previous?.parameter ?? sample.parameter
    const neighborhoodTo = next?.parameter ?? sample.parameter
    const reasons: SuspectInterval['reasons'][number][] = []
    if (sample.clearance < tolerance.warningClearance) reasons.push('low-clearance')
    if (sample.edgeLength < tolerance.minimumEdgeLength) reasons.push('short-edge')
    if (sample.invariantErrors.length > 0) reasons.push('invariant')
    if (reasons.length > 0) {
      suspects.push({
        from: neighborhoodFrom,
        to: neighborhoodTo,
        reasons,
        minimumClearance: sample.clearance,
        minimumEdgeLength: sample.edgeLength,
      })
    }
    if (previous !== undefined && previous.signature !== sample.signature) {
      const refined = refineSuspectInterval(
        previous.parameter,
        sample.parameter,
        tolerance.parameterPrecision,
        (parameter) => evaluate(parameter).signature === previous.signature,
      )
      suspects.push({
        ...refined,
        reasons: ['topology-change'],
        minimumClearance: Math.min(previous.clearance, sample.clearance),
        minimumEdgeLength: Math.min(previous.edgeLength, sample.edgeLength),
      })
    }
    if (previous !== undefined) {
      const thresholds = [
        { reason: 'low-clearance' as const, threshold: tolerance.warningClearance, value: (candidate: Sample) => candidate.clearance },
        { reason: 'short-edge' as const, threshold: tolerance.minimumEdgeLength, value: (candidate: Sample) => candidate.edgeLength },
      ]
      for (const criterion of thresholds) {
        const previousSafe = criterion.value(previous) >= criterion.threshold
        const currentSafe = criterion.value(sample) >= criterion.threshold
        if (previousSafe === currentSafe) continue
        const refined = refineSuspectInterval(
          previous.parameter,
          sample.parameter,
          tolerance.parameterPrecision,
          (parameter) => criterion.value(evaluate(parameter)) >= criterion.threshold,
        )
        suspects.push({
          ...refined,
          reasons: [criterion.reason],
          minimumClearance: Math.min(previous.clearance, sample.clearance),
          minimumEdgeLength: Math.min(previous.edgeLength, sample.edgeLength),
        })
      }
    }
  }

  const suspectIntervals = mergeIntervals(suspects)
  for (const suspect of suspectIntervals) options.onSuspect?.(suspect)
  const signatures = [...new Set(samples.map((sample) => sample.signature))]
  return {
    patternId: definition.id,
    sampleCount,
    signatures,
    minimumObservedClearance: Math.min(...samples.map((sample) => sample.clearance)),
    minimumObservedEdgeLength: Math.min(...samples.map((sample) => sample.edgeLength)),
    suspectIntervals,
    excludedRanges: suspectIntervals.map((interval) => ({
      from: Math.max(0, interval.from - tolerance.exclusionMargin),
      to: Math.min(1, interval.to + tolerance.exclusionMargin),
    })),
    invariantErrors: [...invariantErrors],
    valid: invariantErrors.size === 0 && signatures.length === 1 && suspectIntervals.length === 0,
  }
}

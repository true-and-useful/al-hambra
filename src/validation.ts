import {
  destinationOf,
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
  minimumEdgeLength: 8,
  warningClearance: 16,
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
  for (const edge of graph.halfEdges) {
    const origin = graph.vertices.find((vertex) => vertex.id === edge.origin)
    if (origin === undefined) continue
    const destination = translateByWrap(destinationOf(graph, edge).position, graph.cell, edge.wrap)
    minimum = Math.min(minimum, length(subtract(destination, origin.position)))
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
      clearance: minimumVertexClearance(graph),
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
  let left = from
  let right = to
  const leftClass = isLeftClass(left)
  while (right - left > precision) {
    const midpoint = (left + right) / 2
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


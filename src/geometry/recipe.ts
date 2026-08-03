import { compilePeriodicArrangement } from './arrangement'
import { buildContactPaths } from './hankin'
import { strandScenePaths } from './kernel'
import { tilingErrors } from './tiling'
import type { TilingDefinition } from './tiling'
import type {
  CompiledPattern,
  MorphMap,
  PatternDefaults,
  PatternReference,
} from './types'

/**
 * A pattern is a scaffold plus a curated contact-angle range.
 *
 * The construction vocabulary is deliberately small: the scaffold says which
 * polygons meet, and the contact angle says how the strapwork leaves each shared
 * edge. Everything visible — star points, rosette rings, interlacing — follows
 * from those two facts, so no part of the kernel needs to know which design is
 * being drawn.
 */
export type PatternDefinition = Readonly<{
  id: string
  name: string
  description: string
  reference: PatternReference
  /** Scaffold builder; the scale keeps every design in one coordinate range. */
  tiling: TilingDefinition
  /** Edge length of the scaffold, used to check the tiling is well formed. */
  edgeLength: number
  /** Curated contact-angle range in degrees, mapped from the user's [0,1]. */
  morph: MorphMap
  defaults: PatternDefaults
  palettes: readonly string[]
}>

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** Maps the user-facing [0,1] morph onto the design's curated angle range. */
export function mapUserMorph(map: MorphMap, userMorph: number): number {
  return map.min + (map.max - map.min) * clamp01(userMorph)
}

export function compileTiling(
  tiling: TilingDefinition,
  contactAngleDegrees: number,
): CompiledPattern {
  const paths = buildContactPaths(tiling, contactAngleDegrees)
  const graph = compilePeriodicArrangement(tiling.cell, paths)
  return {
    graph,
    scene: { cell: tiling.cell, graph, paths: strandScenePaths(graph) },
    recipeMorph: contactAngleDegrees,
  }
}

export function compilePattern(
  definition: PatternDefinition,
  userMorph: number,
): CompiledPattern {
  return compileTiling(definition.tiling, mapUserMorph(definition.morph, userMorph))
}

/** Reports scaffold problems for a definition, or an empty list. */
export function patternScaffoldErrors(definition: PatternDefinition): string[] {
  return tilingErrors(definition.tiling, definition.edgeLength)
}

import { buildPeriodicGrid, latticePoint, strandScenePaths } from './kernel'
import type {
  CompiledPattern,
  LatticeCell,
  MorphMap,
  PatternDefaults,
  PatternReference,
  ScenePath,
  Vec2,
} from './types'

export type ScalarRange = Readonly<{ from: number; to: number }>

export type PeriodicDeformation = Readonly<{
  axis: 'u' | 'v'
  frequency: Readonly<{ u: number; v: number }>
  phaseTurns: number
  amplitude: ScalarRange
}>

export type PointCorrection = Readonly<{
  point: number
  radial: ScalarRange
  angularTurns?: ScalarRange
}>

export type StarLayer = Readonly<{
  id: string
  radiusScale: number
  rotationTurns: ScalarRange
}>

export type StarMotifRecipe = Readonly<{
  id: string
  center: Readonly<{ u: number; v: number }>
  points: number
  outerRadius: ScalarRange
  innerRatio: ScalarRange
  rotationTurns: ScalarRange
  layers: readonly StarLayer[]
  corrections?: readonly PointCorrection[]
}>

export type AccentLink = Readonly<{
  id: string
  motifId: string
  fromPoint: number
  toPoint: number
}>

export type ConstructionRecipe = Readonly<{
  cell: LatticeCell
  scaffold: Readonly<{
    columns: number
    rows: number
    overUnderPhase: 0 | 1
  }>
  deformations: readonly PeriodicDeformation[]
  motifs: readonly StarMotifRecipe[]
  links: readonly AccentLink[]
}>

export type PatternDefinition = Readonly<{
  id: string
  name: string
  description: string
  reference: PatternReference
  recipe: ConstructionRecipe
  morph: MorphMap
  defaults: PatternDefaults
  palettes: readonly string[]
}>

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))
const interpolate = (range: ScalarRange, t: number): number =>
  range.from + (range.to - range.from) * t

export function mapUserMorph(map: MorphMap, userMorph: number): number {
  return map.min + (map.max - map.min) * clamp01(userMorph)
}

function deformCoordinate(
  recipe: ConstructionRecipe,
  u: number,
  v: number,
  morph: number,
): Vec2 {
  let deformedU = u
  let deformedV = v
  for (const deformation of recipe.deformations) {
    const axisCoordinate = deformation.axis === 'u' ? u : v
    const crossCoordinate = deformation.axis === 'u' ? v : u
    const axisFrequency = deformation.axis === 'u'
      ? deformation.frequency.u
      : deformation.frequency.v
    const crossFrequency = deformation.axis === 'u'
      ? deformation.frequency.v
      : deformation.frequency.u
    const boundaryEnvelope = Math.sin(Math.PI * 2 * axisFrequency * axisCoordinate)
    const wave = Math.cos(
      Math.PI * 2 * (crossFrequency * crossCoordinate + deformation.phaseTurns),
    )
    const delta = interpolate(deformation.amplitude, morph) * boundaryEnvelope * wave
    if (deformation.axis === 'u') deformedU += delta
    else deformedV += delta
  }
  return latticePoint(recipe.cell, deformedU, deformedV)
}

function motifPoints(
  motif: StarMotifRecipe,
  recipe: ConstructionRecipe,
  morph: number,
  layer: StarLayer,
): Vec2[] {
  const center = latticePoint(recipe.cell, motif.center.u, motif.center.v)
  const outerRadius = interpolate(motif.outerRadius, morph) * layer.radiusScale
  const innerRatio = interpolate(motif.innerRatio, morph)
  const baseRotation = interpolate(motif.rotationTurns, morph)
  const layerRotation = interpolate(layer.rotationTurns, morph)
  const count = motif.points * 2

  return Array.from({ length: count }, (_, pointIndex) => {
    const correction = motif.corrections?.find(({ point }) => point === pointIndex)
    const radialCorrection = correction === undefined
      ? 0
      : interpolate(correction.radial, morph)
    const angularCorrection = correction?.angularTurns === undefined
      ? 0
      : interpolate(correction.angularTurns, morph)
    const radius =
      outerRadius * (pointIndex % 2 === 0 ? 1 : innerRatio) + radialCorrection
    const turn =
      baseRotation + layerRotation + pointIndex / count + angularCorrection
    const angle = turn * Math.PI * 2
    return {
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    }
  })
}

function ornamentPaths(recipe: ConstructionRecipe, morph: number): ScenePath[] {
  const paths: ScenePath[] = []
  const pointsByMotif = new Map<string, readonly Vec2[]>()

  for (const motif of recipe.motifs) {
    motif.layers.forEach((layer, layerIndex) => {
      const points = motifPoints(motif, recipe, morph, layer)
      if (layerIndex === 0) pointsByMotif.set(motif.id, points)
      paths.push({
        id: `motif:${motif.id}:${layer.id}`,
        role: 'ornament',
        points,
        closed: true,
        netWrap: { u: 0, v: 0 },
      })
    })
  }

  for (const link of recipe.links) {
    const points = pointsByMotif.get(link.motifId)
    if (points === undefined) throw new Error(`Unknown motif ${link.motifId} in ${link.id}`)
    const from = points[((link.fromPoint % points.length) + points.length) % points.length]
    const to = points[((link.toPoint % points.length) + points.length) % points.length]
    if (from === undefined || to === undefined) continue
    paths.push({
      id: `link:${link.id}`,
      role: 'accent',
      points: [from, to],
      closed: false,
      netWrap: { u: 0, v: 0 },
    })
  }

  return paths
}

export function compileRecipe(
  recipe: ConstructionRecipe,
  recipeMorph: number,
): CompiledPattern {
  const morph = clamp01(recipeMorph)
  const graph = buildPeriodicGrid({
    ...recipe.scaffold,
    cell: recipe.cell,
    positionAt: (u, v) => deformCoordinate(recipe, u, v, morph),
  })
  const paths = [...strandScenePaths(graph), ...ornamentPaths(recipe, morph)]
  return {
    graph,
    scene: { cell: recipe.cell, graph, paths },
    recipeMorph: morph,
  }
}

export function compilePattern(
  definition: PatternDefinition,
  userMorph: number,
): CompiledPattern {
  return compileRecipe(definition.recipe, mapUserMorph(definition.morph, userMorph))
}


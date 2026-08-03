export type Vec2 = Readonly<{ x: number; y: number }>

export type LatticeOffset = Readonly<{ u: number; v: number }>

export type LatticeCell = Readonly<{
  origin: Vec2
  a: Vec2
  b: Vec2
}>

export type PeriodicVertex = Readonly<{
  id: string
  lineage: string
  position: Vec2
}>

export type PeriodicHalfEdge = Readonly<{
  id: string
  origin: string
  twin: string
  next: string
  wrap: LatticeOffset
}>

export type PeriodicCycle = Readonly<{
  id: string
  edges: readonly string[]
  netWrap: LatticeOffset
}>

export type PeriodicStrand = PeriodicCycle & Readonly<{
  role: 'strand' | 'ornament' | 'accent'
  pathClosed: boolean
  continuationId: string
}>

export type Crossing = Readonly<{
  id: string
  kind: 'intersection' | 'contact'
  vertex: string
  armsCCW: readonly [string, string, string, string]
  continuations: readonly [
    readonly [string, string],
    readonly [string, string],
  ]
  overPair: 0 | 1
  /** Over/under phase toggled by translated lattice representatives. */
  weavePhase: Readonly<{ u: 0 | 1; v: 0 | 1 }>
}>

export type PeriodicGraph = Readonly<{
  cell: LatticeCell
  vertices: readonly PeriodicVertex[]
  halfEdges: readonly PeriodicHalfEdge[]
  faces: readonly PeriodicCycle[]
  strands: readonly PeriodicStrand[]
  crossings: readonly Crossing[]
}>

export type ScenePath = Readonly<{
  id: string
  continuationId?: string
  role: 'strand' | 'ornament' | 'accent'
  points: readonly Vec2[]
  closed: boolean
  /** Lattice translation applied after the final point, for wrapped paths. */
  netWrap: LatticeOffset
}>

export type RenderScene = Readonly<{
  cell: LatticeCell
  graph: PeriodicGraph
  paths: readonly ScenePath[]
}>

export type PatternReference = Readonly<{
  relationship: 'based on' | 'adapted from' | 'inspired by'
  title: string
  href: string
  note: string
}>

export type MorphMap = Readonly<{
  min: number
  max: number
  default: number
}>

export type PatternDefaults = Readonly<{
  morph: number
  material: number
  paletteId: string
  viewScale: number
  viewCenter: Readonly<{ cx: number; cy: number }>
}>

export type CompiledPattern = Readonly<{
  graph: PeriodicGraph
  scene: RenderScene
  recipeMorph: number
}>

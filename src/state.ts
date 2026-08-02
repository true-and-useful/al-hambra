export type ViewState = Readonly<{
  cx: number
  cy: number
  scale: number
}>

export type AppStateV1 = Readonly<{
  v: 1
  designId: string
  morph: number
  material: number
  paletteId: string
  view: ViewState
}>

export type StateCatalog = Readonly<{
  defaultDesignId: string
  defaultsByDesign: Readonly<Record<string, AppStateV1>>
  paletteIdsByDesign?: Readonly<Record<string, readonly string[]>>
  viewLimits?: Readonly<{
    centerMin: number
    centerMax: number
    scaleMin: number
    scaleMax: number
  }>
}>

export const DEFAULT_APP_STATE: AppStateV1 = Object.freeze({
  v: 1,
  designId: 'default',
  morph: 0.5,
  material: 0.35,
  paletteId: 'default',
  view: Object.freeze({ cx: 0.5, cy: 0.5, scale: 1 }),
})

export const DEFAULT_STATE_CATALOG: StateCatalog = Object.freeze({
  defaultDesignId: DEFAULT_APP_STATE.designId,
  defaultsByDesign: Object.freeze({ [DEFAULT_APP_STATE.designId]: DEFAULT_APP_STATE }),
  paletteIdsByDesign: Object.freeze({
    [DEFAULT_APP_STATE.designId]: Object.freeze([DEFAULT_APP_STATE.paletteId]),
  }),
})

const DEFAULT_VIEW_LIMITS = Object.freeze({
  centerMin: -4,
  centerMax: 5,
  scaleMin: 0.25,
  scaleMax: 8,
})

const HASH_KEYS = Object.freeze(['v', 'design', 'morph', 'material', 'palette', 'cx', 'cy', 'scale'])

type UnknownState = {
  v?: unknown
  designId?: unknown
  morph?: unknown
  material?: unknown
  paletteId?: unknown
  view?: { cx?: unknown; cy?: unknown; scale?: unknown }
}

export type StateChangeKind = 'replace' | 'preview' | 'commit' | 'rollback' | 'undo' | 'reset'
export type StateListener = (state: AppStateV1, kind: StateChangeKind) => void

function finiteNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (typeof value !== 'string' || value.trim() === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function cloneState(state: AppStateV1): AppStateV1 {
  return Object.freeze({
    ...state,
    view: Object.freeze({ ...state.view }),
  })
}

function stateEquals(left: AppStateV1, right: AppStateV1): boolean {
  return (
    left.designId === right.designId &&
    left.morph === right.morph &&
    left.material === right.material &&
    left.paletteId === right.paletteId &&
    left.view.cx === right.view.cx &&
    left.view.cy === right.view.cy &&
    left.view.scale === right.view.scale
  )
}

function getDefault(catalog: StateCatalog, requestedDesign?: unknown): AppStateV1 {
  const requested = typeof requestedDesign === 'string' ? requestedDesign : ''
  const design = catalog.defaultsByDesign[requested]
    ? requested
    : catalog.defaultsByDesign[catalog.defaultDesignId]
      ? catalog.defaultDesignId
      : Object.keys(catalog.defaultsByDesign)[0]

  if (!design) throw new Error('State catalog must contain at least one design default')
  const defaults = catalog.defaultsByDesign[design]
  if (!defaults) throw new Error(`Missing defaults for design "${design}"`)
  return defaults
}

export function normalizeAppState(
  input: UnknownState,
  catalog: StateCatalog = DEFAULT_STATE_CATALOG,
): AppStateV1 {
  const defaults = getDefault(catalog, input.designId)
  const limits = catalog.viewLimits ?? DEFAULT_VIEW_LIMITS
  const requestedPalette = typeof input.paletteId === 'string' ? input.paletteId : defaults.paletteId
  const allowedPalettes = catalog.paletteIdsByDesign?.[defaults.designId] ?? [defaults.paletteId]
  const paletteId = allowedPalettes.includes(requestedPalette)
    ? requestedPalette
    : defaults.paletteId

  return cloneState({
    v: 1,
    designId: defaults.designId,
    morph: clamp(finiteNumber(input.morph, defaults.morph), 0, 1),
    material: clamp(finiteNumber(input.material, defaults.material), 0, 1),
    paletteId,
    view: {
      cx: clamp(finiteNumber(input.view?.cx, defaults.view.cx), limits.centerMin, limits.centerMax),
      cy: clamp(finiteNumber(input.view?.cy, defaults.view.cy), limits.centerMin, limits.centerMax),
      scale: clamp(
        finiteNumber(input.view?.scale, defaults.view.scale),
        limits.scaleMin,
        limits.scaleMax,
      ),
    },
  })
}

function stableNumber(value: number): string {
  return String(value)
}

export function encodeStateHash(state: AppStateV1): string {
  const params = new URLSearchParams()
  params.set('v', '1')
  params.set('design', state.designId)
  params.set('morph', stableNumber(state.morph))
  params.set('material', stableNumber(state.material))
  params.set('palette', state.paletteId)
  params.set('cx', stableNumber(state.view.cx))
  params.set('cy', stableNumber(state.view.cy))
  params.set('scale', stableNumber(state.view.scale))
  return `#${params.toString()}`
}

function hasExactlySupportedKeys(params: URLSearchParams): boolean {
  const seen = new Set<string>()
  for (const key of params.keys()) {
    if (!HASH_KEYS.includes(key) || seen.has(key)) return false
    seen.add(key)
  }
  return HASH_KEYS.every((key) => seen.has(key))
}

/**
 * Decodes only the complete v1 shape. Unsupported, incomplete, duplicated, or
 * malformed hashes fail closed to the catalog default.
 */
export function decodeStateHash(
  hash: string,
  catalog: StateCatalog = DEFAULT_STATE_CATALOG,
): AppStateV1 {
  const fallback = normalizeAppState({}, catalog)
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  let params: URLSearchParams
  try {
    params = new URLSearchParams(raw)
  } catch {
    return fallback
  }

  if (params.get('v') !== '1' || !hasExactlySupportedKeys(params)) return fallback

  return normalizeAppState(
    {
      v: 1,
      designId: params.get('design') ?? undefined,
      morph: params.get('morph') ?? undefined,
      material: params.get('material') ?? undefined,
      paletteId: params.get('palette') ?? undefined,
      view: {
        cx: params.get('cx') ?? undefined,
        cy: params.get('cy') ?? undefined,
        scale: params.get('scale') ?? undefined,
      },
    },
    catalog,
  )
}

export type HashWriter = Readonly<{
  location: Pick<Location, 'href'>
  history: Pick<History, 'replaceState'>
}>

export function replaceUrlState(state: AppStateV1, target: HashWriter): string {
  const url = new URL(target.location.href)
  url.hash = encodeStateHash(state)
  target.history.replaceState(null, '', url.href)
  return url.href
}

export class AppStateStore {
  readonly #catalog: StateCatalog
  readonly #historyLimit: number
  readonly #listeners = new Set<StateListener>()
  #committed: AppStateV1
  #current: AppStateV1
  #previewOrigin: AppStateV1 | undefined
  #past: AppStateV1[] = []

  constructor(
    initial: AppStateV1,
    catalog: StateCatalog = DEFAULT_STATE_CATALOG,
    historyLimit = 100,
  ) {
    this.#catalog = catalog
    this.#historyLimit = Number.isFinite(historyLimit) ? Math.max(1, Math.floor(historyLimit)) : 100
    this.#committed = normalizeAppState(initial, catalog)
    this.#current = this.#committed
  }

  get state(): AppStateV1 {
    return this.#current
  }

  get canUndo(): boolean {
    return this.#past.length > 0
  }

  get isPreviewing(): boolean {
    return this.#previewOrigin !== undefined
  }

  subscribe(listener: StateListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  replace(next: AppStateV1): void {
    this.#previewOrigin = undefined
    this.#committed = normalizeAppState(next, this.#catalog)
    this.#current = this.#committed
    this.#emit('replace')
  }

  beginPreview(): AppStateV1 {
    if (!this.#previewOrigin) this.#previewOrigin = this.#committed
    return this.#previewOrigin
  }

  preview(next: AppStateV1): void {
    if (!this.#previewOrigin) throw new Error('beginPreview() must be called before preview()')
    this.#current = normalizeAppState(next, this.#catalog)
    this.#emit('preview')
  }

  commitPreview(): boolean {
    const origin = this.#previewOrigin
    if (!origin) return false
    this.#previewOrigin = undefined
    if (stateEquals(origin, this.#current)) {
      this.#current = this.#committed
      return false
    }
    this.#pushPast(origin)
    this.#committed = this.#current
    this.#emit('commit')
    return true
  }

  rollbackPreview(): boolean {
    const origin = this.#previewOrigin
    if (!origin) return false
    this.#previewOrigin = undefined
    this.#current = origin
    this.#committed = origin
    this.#emit('rollback')
    return true
  }

  commit(next: AppStateV1): boolean {
    if (this.#previewOrigin) this.rollbackPreview()
    const normalized = normalizeAppState(next, this.#catalog)
    if (stateEquals(normalized, this.#committed)) return false
    this.#pushPast(this.#committed)
    this.#committed = normalized
    this.#current = normalized
    this.#emit('commit')
    return true
  }

  undo(): boolean {
    if (this.#previewOrigin) this.rollbackPreview()
    const previous = this.#past.pop()
    if (!previous) return false
    this.#committed = previous
    this.#current = previous
    this.#emit('undo')
    return true
  }

  reset(): boolean {
    const defaults = getDefault(this.#catalog, this.#committed.designId)
    if (this.#previewOrigin) this.rollbackPreview()
    if (stateEquals(defaults, this.#committed)) return false
    this.#pushPast(this.#committed)
    this.#committed = cloneState(defaults)
    this.#current = this.#committed
    this.#emit('reset')
    return true
  }

  #pushPast(state: AppStateV1): void {
    this.#past.push(state)
    if (this.#past.length > this.#historyLimit) this.#past.shift()
  }

  #emit(kind: StateChangeKind): void {
    for (const listener of this.#listeners) listener(this.#current, kind)
  }
}

import type { AppStateV1, ViewState } from './state.ts'
import { AppStateStore } from './state.ts'

export type Point = Readonly<{ x: number; y: number }>
export type DragMode = 'morph' | 'pan'
export type GestureTransition = 'started' | 'previewed' | 'committed' | 'rolled-back' | 'ignored'

export type DragTuning = Readonly<{
  pixelsPerMorphRange: number
  panUnitsPerPixel: number
}>

export const DEFAULT_DRAG_TUNING: DragTuning = Object.freeze({
  pixelsPerMorphRange: 360,
  panUnitsPerPixel: 1,
})

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** A causal, linear mapping: no easing or smoothing sits between pointer and state. */
export function morphFromHorizontalDrag(
  startMorph: number,
  horizontalPixels: number,
  pixelsPerMorphRange = DEFAULT_DRAG_TUNING.pixelsPerMorphRange,
): number {
  if (!Number.isFinite(pixelsPerMorphRange) || pixelsPerMorphRange <= 0) {
    throw new RangeError('pixelsPerMorphRange must be positive and finite')
  }
  return clamp(startMorph + horizontalPixels / pixelsPerMorphRange, 0, 1)
}

export function viewFromPan(
  startView: ViewState,
  delta: Point,
  viewport: Readonly<{ width: number; height: number }>,
  movementScale = DEFAULT_DRAG_TUNING.panUnitsPerPixel,
): ViewState {
  if (viewport.width <= 0 || viewport.height <= 0) {
    throw new RangeError('Viewport dimensions must be positive')
  }
  if (!Number.isFinite(movementScale) || movementScale <= 0) {
    throw new RangeError('Pan movement scale must be positive and finite')
  }
  return {
    cx: startView.cx - (delta.x * movementScale) / (viewport.width * startView.scale),
    cy: startView.cy - (delta.y * movementScale) / (viewport.height * startView.scale),
    scale: startView.scale,
  }
}

export function zoomViewAroundPoint(
  view: ViewState,
  nextScale: number,
  focalPoint: Readonly<{ x: number; y: number }>,
): ViewState {
  if (!Number.isFinite(nextScale) || nextScale <= 0) throw new RangeError('Scale must be positive')
  const scaleRatio = view.scale / nextScale
  return {
    cx: focalPoint.x - (focalPoint.x - view.cx) * scaleRatio,
    cy: focalPoint.y - (focalPoint.y - view.cy) * scaleRatio,
    scale: nextScale,
  }
}

type ActiveGesture = Readonly<{
  pointerId: number
  start: Point
  state: AppStateV1
  mode: DragMode
  viewport: Readonly<{ width: number; height: number }>
}>

/**
 * DOM-independent pointer state machine. The UI owns pointer capture and should
 * release it whenever `pointerDown` or `pointerCancel` returns `rolled-back`.
 */
export class GestureController {
  readonly #store: AppStateStore
  readonly #tuning: DragTuning
  readonly #contacts = new Set<number>()
  #active: ActiveGesture | undefined
  #yieldingToNativeGesture = false

  constructor(store: AppStateStore, tuning: DragTuning = DEFAULT_DRAG_TUNING) {
    this.#store = store
    this.#tuning = tuning
  }

  pointerDown(
    pointerId: number,
    point: Point,
    mode: DragMode,
    viewport: Readonly<{ width: number; height: number }>,
  ): GestureTransition {
    this.#contacts.add(pointerId)
    if (this.#active || this.#contacts.size > 1) {
      const rolledBack = this.#store.rollbackPreview()
      this.#active = undefined
      this.#yieldingToNativeGesture = true
      return rolledBack ? 'rolled-back' : 'ignored'
    }
    if (this.#yieldingToNativeGesture) return 'ignored'

    const state = this.#store.beginPreview()
    this.#active = { pointerId, start: point, state, mode, viewport }
    return 'started'
  }

  pointerMove(pointerId: number, point: Point): GestureTransition {
    const active = this.#active
    if (!active || active.pointerId !== pointerId || this.#yieldingToNativeGesture) return 'ignored'
    const delta = { x: point.x - active.start.x, y: point.y - active.start.y }
    const next = active.mode === 'morph'
      ? {
          ...active.state,
          morph: morphFromHorizontalDrag(
            active.state.morph,
            delta.x,
            this.#tuning.pixelsPerMorphRange,
          ),
        }
      : {
          ...active.state,
          view: viewFromPan(active.state.view, delta, active.viewport, this.#tuning.panUnitsPerPixel),
        }
    this.#store.preview(next)
    return 'previewed'
  }

  pointerUp(pointerId: number): GestureTransition {
    this.#contacts.delete(pointerId)
    if (this.#yieldingToNativeGesture) {
      if (this.#contacts.size === 0) this.#yieldingToNativeGesture = false
      return 'ignored'
    }
    if (!this.#active || this.#active.pointerId !== pointerId) return 'ignored'
    this.#active = undefined
    return this.#store.commitPreview() ? 'committed' : 'ignored'
  }

  pointerCancel(pointerId: number): GestureTransition {
    this.#contacts.delete(pointerId)
    if (!this.#active || this.#active.pointerId !== pointerId) {
      if (this.#contacts.size === 0) this.#yieldingToNativeGesture = false
      return 'ignored'
    }
    this.#active = undefined
    this.#yieldingToNativeGesture = this.#contacts.size > 0
    return this.#store.rollbackPreview() ? 'rolled-back' : 'ignored'
  }

  cancel(): GestureTransition {
    this.#active = undefined
    this.#contacts.clear()
    this.#yieldingToNativeGesture = false
    return this.#store.rollbackPreview() ? 'rolled-back' : 'ignored'
  }
}

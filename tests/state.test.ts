import { describe, expect, it } from 'vitest'
import {
  AppStateStore,
  decodeStateHash,
  encodeStateHash,
  normalizeAppState,
  type AppStateV1,
  type StateCatalog,
} from '../src/state.ts'
import { GestureController, morphFromHorizontalDrag } from '../src/interaction.ts'

const tenfold: AppStateV1 = {
  v: 1,
  designId: 'tenfold',
  morph: 0.4,
  material: 0.25,
  paletteId: 'lapis',
  view: { cx: 0.5, cy: 0.5, scale: 1 },
}

const catalog: StateCatalog = {
  defaultDesignId: 'tenfold',
  defaultsByDesign: {
    tenfold,
    eightfold: {
      v: 1,
      designId: 'eightfold',
      morph: 0.2,
      material: 0.5,
      paletteId: 'clay',
      view: { cx: 0.5, cy: 0.5, scale: 1.5 },
    },
  },
  paletteIdsByDesign: { tenfold: ['lapis', 'ink'], eightfold: ['clay'] },
}

describe('versioned URL state', () => {
  it('round-trips the complete normalized state', () => {
    const state = normalizeAppState({
      ...tenfold,
      morph: 0.812345,
      material: 0.9,
      paletteId: 'ink',
      view: { cx: -0.25, cy: 1.75, scale: 3 },
    }, catalog)
    expect(decodeStateHash(encodeStateHash(state), catalog)).toEqual(state)
  })

  it('fails closed on unsupported, incomplete, duplicate, or extra fields', () => {
    expect(decodeStateHash('#v=2&design=tenfold', catalog)).toEqual(tenfold)
    expect(decodeStateHash('#v=1&design=tenfold', catalog)).toEqual(tenfold)
    expect(decodeStateHash(`${encodeStateHash(tenfold)}&morph=.8`, catalog)).toEqual(tenfold)
    expect(decodeStateHash(`${encodeStateHash(tenfold)}&tracking=1`, catalog)).toEqual(tenfold)
  })

  it('defaults unknown ids and clamps every numeric input', () => {
    const decoded = decodeStateHash(
      '#v=1&design=nope&morph=9&material=-2&palette=nope&cx=-99&cy=99&scale=Infinity',
      catalog,
    )
    expect(decoded).toEqual({
      ...tenfold,
      morph: 1,
      material: 0,
      view: { cx: -4, cy: 5, scale: 1 },
    })
  })
})

describe('gesture history', () => {
  it('previews many frames but commits one undo entry', () => {
    const store = new AppStateStore(tenfold, catalog)
    const gestures = new GestureController(store, { pixelsPerMorphRange: 100, panUnitsPerPixel: 1 })
    gestures.pointerDown(1, { x: 0, y: 0 }, 'morph', { width: 400, height: 800 })
    gestures.pointerMove(1, { x: 20, y: 0 })
    gestures.pointerMove(1, { x: 40, y: 0 })
    expect(store.state.morph).toBeCloseTo(0.8)
    expect(store.canUndo).toBe(false)
    expect(gestures.pointerUp(1)).toBe('committed')
    expect(store.canUndo).toBe(true)
    expect(store.undo()).toBe(true)
    expect(store.state).toEqual(tenfold)
    expect(store.undo()).toBe(false)
  })

  it('rolls back immediately when a second pointer arrives', () => {
    const store = new AppStateStore(tenfold, catalog)
    const gestures = new GestureController(store, { pixelsPerMorphRange: 100, panUnitsPerPixel: 1 })
    gestures.pointerDown(1, { x: 0, y: 0 }, 'morph', { width: 400, height: 800 })
    gestures.pointerMove(1, { x: 40, y: 0 })
    expect(gestures.pointerDown(2, { x: 20, y: 0 }, 'morph', { width: 400, height: 800 }))
      .toBe('rolled-back')
    expect(store.state).toEqual(tenfold)
    gestures.pointerUp(1)
    gestures.pointerUp(2)
    expect(store.canUndo).toBe(false)
  })

  it('rolls back pointercancel and lets the next gesture start cleanly', () => {
    const store = new AppStateStore(tenfold, catalog)
    const gestures = new GestureController(store)
    gestures.pointerDown(7, { x: 0, y: 0 }, 'morph', { width: 400, height: 800 })
    gestures.pointerMove(7, { x: 100, y: 0 })
    expect(gestures.pointerCancel(7)).toBe('rolled-back')
    expect(store.state).toEqual(tenfold)
    expect(gestures.pointerDown(8, { x: 0, y: 0 }, 'morph', { width: 400, height: 800 }))
      .toBe('started')
  })

  it('resets to the selected design default and can undo reset', () => {
    const changed = { ...tenfold, morph: 0.9 }
    const store = new AppStateStore(changed, catalog)
    expect(store.reset()).toBe(true)
    expect(store.state).toEqual(tenfold)
    expect(store.undo()).toBe(true)
    expect(store.state.morph).toBe(0.9)
  })

  it('maps drag distance linearly and clamps at endpoints', () => {
    expect(morphFromHorizontalDrag(0.5, 36, 360)).toBeCloseTo(0.6)
    expect(morphFromHorizontalDrag(0.9, 100, 360)).toBe(1)
    expect(morphFromHorizontalDrag(0.1, -100, 360)).toBe(0)
  })
})

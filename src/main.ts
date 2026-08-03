import './style.css'

import { buildStandaloneSvgDocument, downloadBlob, fitRasterDimensions, rasterizeSvgToPng } from './export'
import { compilePattern } from './geometry/recipe'
import { GestureController, zoomViewAroundPoint } from './interaction'
import { paletteById } from './palettes'
import { defaultPattern, patternById, patterns } from './patterns/registry'
import { RENDER_VIEWBOX, renderScene, renderSceneMarkup } from './render'
import {
  AppStateStore,
  decodeStateHash,
  encodeStateHash,
  replaceUrlState,
  type AppStateV1,
  type StateCatalog,
} from './state'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('The app root is missing')

const defaultsByDesign = Object.fromEntries(patterns.map((pattern) => [
  pattern.id,
  {
    v: 1 as const,
    designId: pattern.id,
    morph: pattern.defaults.morph,
    material: pattern.defaults.material,
    paletteId: pattern.defaults.paletteId,
    view: { ...pattern.defaults.viewCenter, scale: pattern.defaults.viewScale },
  },
])) as Record<string, AppStateV1>

const catalog: StateCatalog = {
  defaultDesignId: defaultPattern.id,
  defaultsByDesign,
  paletteIdsByDesign: Object.fromEntries(
    patterns.map((pattern) => [pattern.id, pattern.palettes]),
  ),
  viewLimits: { centerMin: -4, centerMax: 5, scaleMin: 0.35, scaleMax: 4 },
}

const initialState = decodeStateHash(window.location.hash, catalog)
const store = new AppStateStore(initialState, catalog)
const gestures = new GestureController(store, {
  pixelsPerMorphRange: Math.max(280, Math.min(560, window.innerWidth * 0.72)),
  panUnitsPerPixel: 1,
})

app.innerHTML = `
  <main class="instrument" id="instrument" data-touched="false">
    <header class="topbar">
      <h1 class="wordmark">Pattern <span>instrument</span></h1>
      <a class="provenance-link" target="_blank" rel="noreferrer"></a>
    </header>

    <section
      class="artwork-shell"
      data-mode="morph"
      data-dragging="false"
      aria-label="Pattern canvas. Drag horizontally to morph the ornament."
      aria-describedby="gesture-instructions"
    >
      <svg class="pattern-canvas" aria-live="off"></svg>
      <p class="gesture-hint" id="gesture-instructions">Drag to reshape</p>
    </section>

    <section class="control-region" aria-label="Pattern controls">
      <div class="control-dock">
        <label class="control-group design-group">
          <span class="control-label">Design</span>
          <select class="design-select" name="design">
            ${patterns.map((pattern) => `<option value="${pattern.id}">${pattern.name}</option>`).join('')}
          </select>
        </label>

        <label class="control-group material-group">
          <span class="control-label">Material <span class="control-value material-value">Bands</span></span>
          <input class="material-slider" name="material" type="range" min="0" max="1" step="0.001" />
        </label>

        <div class="control-group palette-group">
          <span class="control-label">Palette</span>
          <div class="palette-picker" role="group" aria-label="Palette"></div>
        </div>

        <div class="toolbar" aria-label="Actions">
          <button class="tool-button secondary-action undo-button" type="button" aria-label="Undo" title="Undo (Command Z)">↶</button>
          <button class="tool-button secondary-action move-button" type="button" aria-pressed="false" aria-label="Move view" title="Move view">✥</button>
          <button class="tool-button secondary-action zoom-out-button" type="button" aria-label="Zoom out" title="Zoom out">−</button>
          <button class="tool-button secondary-action zoom-in-button" type="button" aria-label="Zoom in" title="Zoom in">+</button>
          <button class="tool-button more-button" type="button" aria-label="More actions" aria-expanded="false" title="More actions">
            <span class="more-default" aria-hidden="true">•••</span>
            <span class="move-active-label" aria-hidden="true">Move</span>
          </button>
          <button class="primary-button copy-button" type="button"><span class="tool-label-wide">Copy </span>link</button>
        </div>

        <div class="more-menu" hidden>
          <div class="mobile-palette-menu" role="group" aria-label="Palette choices"></div>
          <button type="button" data-action="undo">Undo</button>
          <button type="button" data-action="move">Move view</button>
          <button type="button" data-action="save-svg">Save SVG</button>
          <button type="button" data-action="save-png">Save PNG</button>
          <button type="button" data-action="reset">Reset design</button>
          <button type="button" data-action="zoom-out">Zoom out</button>
          <button type="button" data-action="zoom-in">Zoom in</button>
        </div>
      </div>
    </section>

    <label>
      <span class="morph-slider">Morph</span>
      <input class="morph-slider" name="morph" type="range" min="0" max="1" step="0.001" />
    </label>
    <div class="status-toast" role="status" aria-live="polite"></div>
  </main>
`

const instrument = requireElement<HTMLElement>('.instrument')
const artwork = requireElement<HTMLElement>('.artwork-shell')
const svg = requireElement<SVGSVGElement>('.pattern-canvas')
const sourceLink = requireElement<HTMLAnchorElement>('.provenance-link')
const designSelect = requireElement<HTMLSelectElement>('.design-select')
const morphSlider = requireElement<HTMLInputElement>('input[name="morph"]')
const materialSlider = requireElement<HTMLInputElement>('input[name="material"]')
const materialValue = requireElement<HTMLElement>('.material-value')
const palettePicker = requireElement<HTMLElement>('.palette-picker')
const undoButton = requireElement<HTMLButtonElement>('.undo-button')
const moveButton = requireElement<HTMLButtonElement>('.move-button')
const zoomOutButton = requireElement<HTMLButtonElement>('.zoom-out-button')
const zoomInButton = requireElement<HTMLButtonElement>('.zoom-in-button')
const moreButton = requireElement<HTMLButtonElement>('.more-button')
const moreMenu = requireElement<HTMLElement>('.more-menu')
const mobilePaletteMenu = requireElement<HTMLElement>('.mobile-palette-menu')
const mobileMoveButton = requireElement<HTMLButtonElement>('.more-menu button[data-action="move"]')
const copyButton = requireElement<HTMLButtonElement>('.copy-button')
const toast = requireElement<HTMLElement>('.status-toast')
const gestureHint = requireElement<HTMLElement>('.gesture-hint')

let moveMode = false
let spacePressed = false
let renderFrame = 0
let toastTimer = 0
let wheelCommitTimer = 0
let renderedPaletteSet = ''
let renderedPaletteSelection = ''
let renderedAccent = ''
const capturedPointers = new Set<number>()

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error(`Missing required element: ${selector}`)
  return element
}

function currentPattern() {
  return patternById(store.state.designId) ?? defaultPattern
}

function showToast(message: string): void {
  window.clearTimeout(toastTimer)
  toast.textContent = message
  toast.dataset.visible = 'true'
  toastTimer = window.setTimeout(() => {
    toast.dataset.visible = 'false'
  }, 2200)
}

function materialLabel(value: number): string {
  if (value < 0.18) return 'Linework'
  if (value < 0.54) return 'Ribbon'
  return 'Woven bands'
}

function updatePaletteButtons(): void {
  const pattern = currentPattern()
  const paletteSet = pattern.palettes.join('|')
  if (renderedPaletteSet === paletteSet && renderedPaletteSelection === store.state.paletteId) return
  if (renderedPaletteSet !== paletteSet) {
    renderedPaletteSet = paletteSet
    palettePicker.replaceChildren(...pattern.palettes.map((paletteId) => {
      const palette = paletteById(paletteId)
      const button = document.createElement('button')
      button.className = 'palette-button'
      button.type = 'button'
      button.dataset.paletteId = paletteId
      button.title = palette.name
      button.setAttribute('aria-label', palette.name)
      button.style.setProperty('--swatch', palette.strand)
      button.addEventListener('click', () => {
        store.commit({ ...store.state, paletteId })
      })
      return button
    }))
    mobilePaletteMenu.replaceChildren(...pattern.palettes.map((paletteId) => {
      const palette = paletteById(paletteId)
      const button = document.createElement('button')
      button.type = 'button'
      button.dataset.action = 'palette'
      button.dataset.paletteId = paletteId
      button.textContent = `Palette: ${palette.name}`
      return button
    }))
  }
  renderedPaletteSelection = store.state.paletteId
  for (const button of palettePicker.querySelectorAll<HTMLButtonElement>('.palette-button')) {
    button.setAttribute('aria-pressed', String(button.dataset.paletteId === store.state.paletteId))
  }
  for (const button of mobilePaletteMenu.querySelectorAll<HTMLButtonElement>('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.paletteId === store.state.paletteId))
  }
}

function updateControls(state: AppStateV1): void {
  const pattern = currentPattern()
  const morph = String(state.morph)
  const material = String(state.material)
  const label = materialLabel(state.material)
  if (designSelect.value !== pattern.id) designSelect.value = pattern.id
  if (morphSlider.value !== morph) morphSlider.value = morph
  if (materialSlider.value !== material) materialSlider.value = material
  if (materialValue.textContent !== label) materialValue.textContent = label
  if (sourceLink.dataset.pattern !== pattern.id) {
    sourceLink.dataset.pattern = pattern.id
    sourceLink.href = pattern.reference.href
    sourceLink.textContent = `${pattern.reference.relationship} ${pattern.reference.title}`
    sourceLink.title = pattern.reference.note
  }
  if (undoButton.disabled === store.canUndo) undoButton.disabled = !store.canUndo
  updatePaletteButtons()
}

function paint(state: AppStateV1): void {
  const startedAt = performance.now()
  const pattern = currentPattern()
  const compiled = compilePattern(pattern, state.morph)
  renderScene(svg, compiled.scene, state, paletteById(state.paletteId))
  updateControls(state)
  const accent = paletteById(state.paletteId).accent
  if (renderedAccent !== accent) {
    renderedAccent = accent
    document.documentElement.style.setProperty('--accent', accent)
  }
  if (!document.body.dataset.patternReady) {
    document.body.dataset.patternReady = 'true'
    performance.mark('pattern-ready')
  }
  const metricsWindow = window as Window & { __patternPaintDurations?: number[] }
  const durations = metricsWindow.__patternPaintDurations ?? []
  durations.push(performance.now() - startedAt)
  if (durations.length > 600) durations.shift()
  metricsWindow.__patternPaintDurations = durations
}

function schedulePaint(state: AppStateV1): void {
  cancelAnimationFrame(renderFrame)
  renderFrame = requestAnimationFrame(() => paint(state))
}

store.subscribe((state, kind) => {
  schedulePaint(state)
  if (kind !== 'preview' && kind !== 'rollback' && kind !== 'replace') {
    replaceUrlState(state, window)
  }
})

designSelect.addEventListener('change', () => {
  const next = defaultsByDesign[designSelect.value]
  if (next) store.commit(next)
})

function beginRangePreview(): void {
  if (!store.isPreviewing) store.beginPreview()
}

materialSlider.addEventListener('pointerdown', beginRangePreview)
materialSlider.addEventListener('input', () => {
  beginRangePreview()
  store.preview({ ...store.state, material: Number(materialSlider.value) })
})
materialSlider.addEventListener('change', () => store.commitPreview())
materialSlider.addEventListener('pointercancel', () => store.rollbackPreview())

morphSlider.addEventListener('input', () => {
  beginRangePreview()
  store.preview({ ...store.state, morph: Number(morphSlider.value) })
})
morphSlider.addEventListener('change', () => store.commitPreview())

function setMoveMode(enabled: boolean): void {
  moveMode = enabled
  moveButton.setAttribute('aria-pressed', String(enabled))
  mobileMoveButton.setAttribute('aria-pressed', String(enabled))
  moreButton.dataset.moveActive = String(enabled)
  moreButton.setAttribute('aria-label', enabled ? 'More actions, move view active' : 'More actions')
  artwork.dataset.mode = enabled ? 'move' : 'morph'
  gestureHint.textContent = enabled ? 'Drag to move view' : 'Drag to reshape'
}

moveButton.addEventListener('click', () => setMoveMode(!moveMode))
undoButton.addEventListener('click', () => store.undo())

function zoomBy(factor: number): void {
  const state = store.state
  const nextScale = Math.min(4, Math.max(0.35, state.view.scale * factor))
  store.commit({
    ...state,
    view: zoomViewAroundPoint(state.view, nextScale, { x: state.view.cx, y: state.view.cy }),
  })
}

zoomOutButton.addEventListener('click', () => zoomBy(0.82))
zoomInButton.addEventListener('click', () => zoomBy(1.22))

moreButton.addEventListener('click', () => {
  const opening = moreMenu.hidden
  moreMenu.hidden = !opening
  moreButton.setAttribute('aria-expanded', String(opening))
  if (opening) {
    [...moreMenu.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.getClientRects().length > 0)
      ?.focus()
  }
})

function closeMoreMenu(restoreFocus = false): void {
  const wasOpen = !moreMenu.hidden
  moreMenu.hidden = true
  moreButton.setAttribute('aria-expanded', 'false')
  if (restoreFocus && wasOpen) moreButton.focus()
}

async function copyLivingLink(): Promise<void> {
  const url = new URL(window.location.href)
  url.hash = encodeStateHash(store.state)
  try {
    await navigator.clipboard.writeText(url.href)
    showToast('Living link copied')
  } catch {
    window.prompt('Copy this living link', url.href)
  }
}

copyButton.addEventListener('click', () => void copyLivingLink())

function standaloneSvg(): string {
  const pattern = currentPattern()
  const compiled = compilePattern(pattern, store.state.morph)
  const body = renderSceneMarkup(compiled.scene, store.state, paletteById(store.state.paletteId))
  return buildStandaloneSvgDocument(body, {
    width: RENDER_VIEWBOX.width,
    height: RENDER_VIEWBOX.height,
    viewBox: `0 0 ${RENDER_VIEWBOX.width} ${RENDER_VIEWBOX.height}`,
    metadata: {
      designId: pattern.id,
      title: pattern.name,
      relationship: pattern.reference.relationship,
      sourceUrl: pattern.reference.href,
    },
  })
}

function saveSvg(): void {
  const pattern = currentPattern()
  const blob = new Blob([standaloneSvg()], { type: 'image/svg+xml;charset=utf-8' })
  downloadBlob(blob, `${pattern.id}.svg`)
  showToast('SVG saved')
}

async function savePng(): Promise<void> {
  const pattern = currentPattern()
  try {
    const dimensions = fitRasterDimensions(RENDER_VIEWBOX.width, RENDER_VIEWBOX.height)
    const blob = await rasterizeSvgToPng(standaloneSvg(), dimensions)
    downloadBlob(blob, `${pattern.id}.png`)
    showToast('High-resolution PNG saved')
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'PNG export failed')
  }
}

moreMenu.addEventListener('click', (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
  if (!button) return
  closeMoreMenu(true)
  switch (button.dataset.action) {
    case 'palette': {
      const paletteId = button.dataset.paletteId
      if (paletteId) store.commit({ ...store.state, paletteId })
      break
    }
    case 'undo': store.undo(); break
    case 'move': setMoveMode(!moveMode); break
    case 'save-svg': saveSvg(); break
    case 'save-png': void savePng(); break
    case 'reset': store.reset(); showToast('Design reset'); break
    case 'zoom-out': zoomBy(0.82); break
    case 'zoom-in': zoomBy(1.22); break
  }
})

artwork.addEventListener('pointerdown', (event) => {
  instrument.dataset.touched = 'true'
  const mode = moveMode || spacePressed ? 'pan' : 'morph'
  const result = gestures.pointerDown(
    event.pointerId,
    { x: event.clientX, y: event.clientY },
    mode,
    { width: artwork.clientWidth, height: artwork.clientHeight },
  )
  if (result === 'started') {
    artwork.setPointerCapture(event.pointerId)
    capturedPointers.add(event.pointerId)
    artwork.dataset.dragging = 'true'
  } else if (result === 'rolled-back') {
    for (const pointerId of capturedPointers) {
      if (artwork.hasPointerCapture(pointerId)) artwork.releasePointerCapture(pointerId)
    }
    capturedPointers.clear()
    artwork.dataset.dragging = 'false'
  }
})

artwork.addEventListener('pointermove', (event) => {
  gestures.pointerMove(event.pointerId, { x: event.clientX, y: event.clientY })
})

artwork.addEventListener('pointerup', (event) => {
  gestures.pointerUp(event.pointerId)
  if (artwork.hasPointerCapture(event.pointerId)) artwork.releasePointerCapture(event.pointerId)
  capturedPointers.delete(event.pointerId)
  artwork.dataset.dragging = 'false'
})

artwork.addEventListener('pointercancel', (event) => {
  gestures.pointerCancel(event.pointerId)
  if (artwork.hasPointerCapture(event.pointerId)) artwork.releasePointerCapture(event.pointerId)
  capturedPointers.delete(event.pointerId)
  artwork.dataset.dragging = 'false'
})

artwork.addEventListener('wheel', (event) => {
  if (event.ctrlKey) return
  event.preventDefault()
  if (!store.isPreviewing) store.beginPreview()
  const factor = Math.exp(-event.deltaY * 0.0012)
  const current = store.state
  const rect = artwork.getBoundingClientRect()
  const focal = {
    x: current.view.cx + ((event.clientX - rect.left) / rect.width - 0.5) / current.view.scale,
    y: current.view.cy + ((event.clientY - rect.top) / rect.height - 0.5) / current.view.scale,
  }
  const nextScale = Math.min(4, Math.max(0.35, current.view.scale * factor))
  store.preview({ ...current, view: zoomViewAroundPoint(current.view, nextScale, focal) })
  window.clearTimeout(wheelCommitTimer)
  wheelCommitTimer = window.setTimeout(() => store.commitPreview(), 160)
}, { passive: false })

document.addEventListener('pointerdown', (event) => {
  if (!moreMenu.hidden && !moreMenu.contains(event.target as Node) && event.target !== moreButton) {
    closeMoreMenu()
  }
})

document.addEventListener('keydown', (event) => {
  if (event.key === ' ' && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
    spacePressed = true
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault()
    store.undo()
  } else if (event.key === 'Escape') {
    closeMoreMenu(true)
    setMoveMode(false)
  } else if ((event.key === '+' || event.key === '=') && event.target === document.body) {
    zoomBy(1.22)
  } else if (event.key === '-' && event.target === document.body) {
    zoomBy(0.82)
  }
})

document.addEventListener('keyup', (event) => {
  if (event.key === ' ') spacePressed = false
})

window.addEventListener('hashchange', () => store.replace(decodeStateHash(window.location.hash, catalog)))

morphSlider.addEventListener('focus', () => {
  gestureHint.textContent = 'Use arrow keys to reshape'
})
morphSlider.addEventListener('blur', () => {
  gestureHint.textContent = moveMode ? 'Drag to move view' : 'Drag to reshape'
})

paint(store.state)

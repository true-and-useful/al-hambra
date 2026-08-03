import type { PatternDefinition } from '../geometry/recipe'
import { decagonRhombusTiling } from '../geometry/tiling'

const SCALE = 560 / (1 / Math.tan(Math.PI / 10))

/**
 * The flagship. Its scaffold mixes decagons with an irregular supporting tile,
 * and the rosette only closes because successive rows are offset by half a
 * period, so it cannot be expressed as a single regular-polygon family the way
 * the elementary case can.
 */
export const decagonTen: PatternDefinition = {
  id: 'decagon-ten',
  name: 'Tenfold Rose',
  description:
    'Ten-point rosettes ringed by pentagons, carried on offset rows of decagons and rhombi.',
  reference: {
    relationship: 'inspired by',
    title: 'Darb-i Imam, Isfahan — TilingSearch IRA0911',
    href: 'https://tilingsearch.mit.edu/HTML/data189/IRA0911.html',
    note:
      'A decagonal polygons-in-contact study in the family documented at Darb-i Imam. It uses a decagon-and-rhombus scaffold on a centred rectangular repeat, not the shrine’s own tiling, and makes no claim to reproduce the quasiperiodic spandrel.',
  },
  tiling: decagonRhombusTiling(SCALE),
  edgeLength: SCALE,
  morph: { min: 57, max: 70 },
  defaults: {
    morph: 0.5,
    material: 0.5,
    paletteId: 'turquoise-brick',
    viewScale: 0.55,
    viewCenter: { cx: 0.5, cy: 0.5 },
  },
  palettes: ['turquoise-brick', 'saffron-night', 'ink-and-parchment'],
}

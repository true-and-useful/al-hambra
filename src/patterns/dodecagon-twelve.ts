import type { PatternDefinition } from '../geometry/recipe'
import { dodecagonHexagonSquareTiling } from '../geometry/tiling'

const SCALE = 560 / (2 + Math.sqrt(3) + 1)

/**
 * The companion. Three tile families on a hexagonal lattice give a visibly
 * different experience from the other two: the twelve-point centres sit in a
 * field of small rosettes rather than a plain ground.
 */
export const dodecagonTwelve: PatternDefinition = {
  id: 'dodecagon-twelve',
  name: 'Twelvefold Vault',
  description:
    'Twelve-point rosettes on a hexagonal repeat of dodecagons, hexagons, and squares.',
  reference: {
    relationship: 'inspired by',
    title: 'Kharraqan tower pattern — TilingSearch W85',
    href: 'https://tilingsearch.mit.edu/HTML/data18/W85.html',
    note:
      'A twelve-point polygons-in-contact study on the rhombitrihexagonal tiling. It shares the twelvefold family of the Kharraqan towers rather than reconstructing their brickwork.',
  },
  tiling: dodecagonHexagonSquareTiling(SCALE),
  edgeLength: SCALE,
  morph: { min: 61, max: 84, default: 0.5 },
  defaults: {
    morph: 0.5,
    material: 0.44,
    paletteId: 'brick-and-bone',
    viewScale: 0.5,
    viewCenter: { cx: 0.5, cy: 0.5 },
  },
  palettes: ['brick-and-bone', 'verdigris-sand', 'copper-night'],
}

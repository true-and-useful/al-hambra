import type { PatternDefinition } from '../geometry/recipe'
import { octagonSquareTiling } from '../geometry/tiling'

const SCALE = 560 / (1 + Math.SQRT2)

/**
 * The elementary case: one regular-polygon scaffold, one contact angle, and the
 * familiar eight-point star it produces. Everything the flagship needs beyond
 * this is visible as an addition rather than a rewrite.
 */
export const octagonEight: PatternDefinition = {
  id: 'octagon-eight',
  name: 'Eightfold Court',
  description:
    'Eight-point strapwork drawn on octagons and squares, the plainest construction in the collection.',
  reference: {
    relationship: 'inspired by',
    title: 'Kaplan, Islamic Star Patterns from Polygons in Contact',
    href: 'https://cs.uwaterloo.ca/~csk/publications/Papers/kaplan_2005.pdf',
    note:
      'A polygons-in-contact construction over the truncated square tiling, the scaffold behind a large family of historical eight-point patterns. Not a reconstruction of any single monument.',
  },
  tiling: octagonSquareTiling(SCALE),
  edgeLength: SCALE,
  morph: { min: 46, max: 86 },
  defaults: {
    morph: 0.55,
    material: 0.42,
    paletteId: 'lapis-and-ivory',
    viewScale: 0.55,
    viewCenter: { cx: 0.5, cy: 0.5 },
  },
  palettes: ['lapis-and-ivory', 'ink-and-parchment', 'copper-night'],
}

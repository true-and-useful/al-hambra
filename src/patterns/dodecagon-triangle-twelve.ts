import type { PatternDefinition } from '../geometry/recipe'
import { dodecagonTriangleTiling } from '../geometry/tiling'

const SCALE = 560 / (2 + Math.sqrt(3))

/** Dodecagons meeting edge to edge, with triangles closing the gaps. */
export const dodecagonTriangleTwelve: PatternDefinition = {
  id: 'dodecagon-triangle-twelve',
  name: 'Twelvefold Lantern',
  description: 'Twelve-point rosettes packed edge to edge, with small triangles between them.',
  reference: {
    relationship: 'inspired by',
    title: 'Kaplan, Islamic Star Patterns from Polygons in Contact',
    href: 'https://cs.uwaterloo.ca/~csk/publications/Papers/kaplan_2005.pdf',
    note:
      'A polygons-in-contact construction on the truncated hexagonal tiling. Its twelve-point centres touch directly, which reads quite differently from the same fold on a 4.6.12 ground.',
  },
  tiling: dodecagonTriangleTiling(SCALE),
  edgeLength: SCALE,
  morph: { min: 61, max: 86 },
  defaults: {
    morph: 0.5,
    material: 0.45,
    paletteId: 'copper-night',
    viewScale: 0.6,
    viewCenter: { cx: 0.5, cy: 0.5 },
  },
  palettes: ['copper-night', 'turquoise-brick', 'zellij-court'],
}

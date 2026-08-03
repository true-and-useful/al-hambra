import type { PatternDefinition } from '../geometry/recipe'
import { hexagonTriangleTiling } from '../geometry/tiling'

const SCALE = 280

/** Hexagons with triangles between them, giving a denser sixfold field. */
export const hexagonTriangleSix: PatternDefinition = {
  id: 'hexagon-triangle-six',
  name: 'Sixfold Garden',
  description: 'Six-point rosettes set in a lattice of hexagons and triangles.',
  reference: {
    relationship: 'inspired by',
    title: 'Kaplan, Islamic Star Patterns from Polygons in Contact',
    href: 'https://cs.uwaterloo.ca/~csk/publications/Papers/kaplan_2005.pdf',
    note:
      'A polygons-in-contact construction on the trihexagonal tiling. The triangles pull the strapwork tighter than the plain honeycomb does.',
  },
  tiling: hexagonTriangleTiling(SCALE),
  edgeLength: SCALE,
  morph: { min: 61, max: 86 },
  defaults: {
    morph: 0.8,
    material: 0.45,
    paletteId: 'brick-and-bone',
    viewScale: 0.6,
    viewCenter: { cx: 0.5, cy: 0.5 },
  },
  palettes: ['brick-and-bone', 'lapis-and-ivory', 'alhambra-glaze'],
}

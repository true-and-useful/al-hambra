import type { PatternDefinition } from '../geometry/recipe'

export const alaeddinEight: PatternDefinition = {
  id: 'alaeddin-eight',
  name: 'Alaeddin Eight',
  description: 'An open eight-point construction on a square p4m repeat.',
  reference: {
    relationship: 'adapted from',
    title: 'P222 — TilingSearch',
    href: 'https://tilingsearch.mit.edu/HTML/data161/P222.html',
    note: 'Alaeddin Mosque square-lattice pattern; adapted as a responsive construction.',
  },
  recipe: {
    cell: {
      origin: { x: 0, y: 0 },
      a: { x: 1000, y: 0 },
      b: { x: 0, y: 1000 },
    },
    scaffold: { columns: 4, rows: 4, overUnderPhase: 0 },
    deformations: [
      {
        axis: 'u',
        frequency: { u: 1, v: 1 },
        phaseTurns: 0,
        amplitude: { from: -0.018, to: 0.026 },
      },
      {
        axis: 'v',
        frequency: { u: 1, v: 1 },
        phaseTurns: 0,
        amplitude: { from: 0.018, to: -0.026 },
      },
    ],
    motifs: [
      {
        id: 'central-eight',
        center: { u: 0.5, v: 0.5 },
        points: 8,
        outerRadius: { from: 330, to: 385 },
        innerRatio: { from: 0.42, to: 0.58 },
        rotationTurns: { from: 1 / 16, to: 0 },
        layers: [
          { id: 'primary', radiusScale: 1, rotationTurns: { from: 0, to: 0 } },
          { id: 'echo', radiusScale: 0.56, rotationTurns: { from: 0, to: 1 / 32 } },
        ],
      },
    ],
    links: [
      { id: 'diameter-a', continuationId: 'eight-repeat', motifId: 'central-eight', fromPoint: 0, toPoint: 8 },
      { id: 'diameter-b', motifId: 'central-eight', fromPoint: 4, toPoint: 12 },
      { id: 'left-repeat-contact', continuationId: 'eight-repeat', motifId: 'central-eight', fromPoint: 8, toCell: { u: 0, v: 0.5 } },
      { id: 'right-repeat-contact', continuationId: 'eight-repeat', motifId: 'central-eight', fromPoint: 0, toCell: { u: 1, v: 0.5 } },
    ],
  },
  morph: { min: 0.3, max: 0.85, default: 0.46 },
  defaults: {
    morph: 0.46,
    material: 0.38,
    paletteId: 'lapis-and-ivory',
    viewScale: 0.65,
    viewCenter: { cx: 0.5, cy: 0.5 },
  },
  palettes: ['lapis-and-ivory', 'ink-and-parchment', 'copper-night'],
}

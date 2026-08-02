import type { PatternDefinition } from '../geometry/recipe'

export const kharraqanTwelve: PatternDefinition = {
  id: 'kharraqan-twelve',
  name: 'Kharraqan Twelve',
  description: 'A twelve-point rosette carried by an oblique p6m lattice.',
  reference: {
    relationship: 'adapted from',
    title: 'W85 — TilingSearch',
    href: 'https://tilingsearch.mit.edu/HTML/data18/W85.html',
    note: 'Kharraqan tower pattern adapted to a continuous oblique repeat.',
  },
  recipe: {
    cell: {
      origin: { x: 0, y: 0 },
      a: { x: 1000, y: 0 },
      b: { x: 500, y: 866.025403784 },
    },
    scaffold: { columns: 3, rows: 3, overUnderPhase: 0 },
    deformations: [
      {
        axis: 'u',
        frequency: { u: 1, v: 1 },
        phaseTurns: 1 / 6,
        amplitude: { from: 0.016, to: -0.025 },
      },
      {
        axis: 'v',
        frequency: { u: 1, v: 1 },
        phaseTurns: -1 / 6,
        amplitude: { from: -0.016, to: 0.025 },
      },
    ],
    motifs: [
      {
        id: 'central-twelve',
        center: { u: 0.5, v: 0.5 },
        points: 12,
        outerRadius: { from: 326, to: 382 },
        innerRatio: { from: 0.5, to: 0.34 },
        rotationTurns: { from: 1 / 24, to: 1 / 48 },
        layers: [
          { id: 'primary', radiusScale: 1, rotationTurns: { from: 0, to: 0 } },
          { id: 'inner', radiusScale: 0.67, rotationTurns: { from: 1 / 48, to: -1 / 48 } },
          { id: 'heart', radiusScale: 0.36, rotationTurns: { from: 0, to: 1 / 24 } },
        ],
      },
    ],
    links: [
      { id: 'axis-a', motifId: 'central-twelve', fromPoint: 0, toPoint: 12 },
      { id: 'axis-b', motifId: 'central-twelve', fromPoint: 4, toPoint: 16 },
      { id: 'axis-c', motifId: 'central-twelve', fromPoint: 8, toPoint: 20 },
    ],
  },
  morph: { min: 0.1, max: 0.9, default: 0.5 },
  defaults: {
    morph: 0.5,
    material: 0.48,
    paletteId: 'brick-and-bone',
    viewScale: 0.5,
    viewCenter: { cx: 0.5, cy: 0.5 },
  },
  palettes: ['brick-and-bone', 'ink-and-parchment', 'verdigris-sand'],
}

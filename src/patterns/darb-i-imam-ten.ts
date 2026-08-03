import type { PatternDefinition } from '../geometry/recipe'

export const darbIImamTen: PatternDefinition = {
  id: 'darb-i-imam-ten',
  name: 'Darb-i Imam Ten',
  description: 'A corrected ten-point construction on a centered rectangular cmm repeat.',
  reference: {
    relationship: 'inspired by',
    title: 'IRA0911 — TilingSearch',
    href: 'https://tilingsearch.mit.edu/HTML/data189/IRA0911.html',
    note: 'A responsive study inspired by the periodic field, not an exact reconstruction or the monument’s quasiperiodic spandrel.',
  },
  recipe: {
    cell: {
      origin: { x: 0, y: 0 },
      a: { x: 1200, y: 0 },
      b: { x: 0, y: 800 },
    },
    scaffold: { columns: 5, rows: 4, overUnderPhase: 1 },
    deformations: [
      {
        axis: 'u',
        frequency: { u: 1, v: 2 },
        phaseTurns: 0.125,
        amplitude: { from: -0.026, to: 0.034 },
      },
      {
        axis: 'v',
        frequency: { u: 2, v: 1 },
        phaseTurns: -0.125,
        amplitude: { from: 0.022, to: -0.03 },
      },
    ],
    motifs: [
      {
        id: 'left-ten',
        center: { u: 0.27, v: 0.5 },
        points: 10,
        outerRadius: { from: 238, to: 274 },
        innerRatio: { from: 0.36, to: 0.54 },
        rotationTurns: { from: -1 / 40, to: 1 / 80 },
        layers: [
          { id: 'primary-contact', radiusScale: 1, rotationTurns: { from: 0, to: 0 } },
          { id: 'secondary-contact', radiusScale: 0.61, rotationTurns: { from: 1 / 40, to: -1 / 50 } },
        ],
        corrections: [
          { point: 1, radial: { from: -8, to: 7 }, angularTurns: { from: -0.002, to: 0.004 } },
          { point: 9, radial: { from: 6, to: -5 }, angularTurns: { from: 0.003, to: -0.002 } },
          { point: 11, radial: { from: 6, to: -5 }, angularTurns: { from: -0.003, to: 0.002 } },
          { point: 19, radial: { from: -8, to: 7 }, angularTurns: { from: 0.002, to: -0.004 } },
        ],
      },
      {
        id: 'right-ten',
        center: { u: 0.73, v: 0.5 },
        points: 10,
        outerRadius: { from: 238, to: 274 },
        innerRatio: { from: 0.36, to: 0.54 },
        rotationTurns: { from: 1 / 40, to: -1 / 80 },
        layers: [
          { id: 'primary-contact', radiusScale: 1, rotationTurns: { from: 0, to: 0 } },
          { id: 'secondary-contact', radiusScale: 0.61, rotationTurns: { from: -1 / 40, to: 1 / 50 } },
        ],
        corrections: [
          { point: 1, radial: { from: 6, to: -5 }, angularTurns: { from: 0.003, to: -0.002 } },
          { point: 9, radial: { from: -8, to: 7 }, angularTurns: { from: -0.002, to: 0.004 } },
          { point: 11, radial: { from: -8, to: 7 }, angularTurns: { from: 0.002, to: -0.004 } },
          { point: 19, radial: { from: 6, to: -5 }, angularTurns: { from: -0.003, to: 0.002 } },
        ],
      },
    ],
    links: [
      { id: 'left-chord-a', motifId: 'left-ten', fromPoint: 1, toPoint: 9 },
      { id: 'left-chord-b', motifId: 'left-ten', fromPoint: 11, toPoint: 19 },
      { id: 'right-chord-a', motifId: 'right-ten', fromPoint: 1, toPoint: 9 },
      { id: 'right-chord-b', motifId: 'right-ten', fromPoint: 11, toPoint: 19 },
      { id: 'left-repeat-contact', continuationId: 'tenfold-repeat', motifId: 'left-ten', fromPoint: 10, toCell: { u: 0, v: 0.5 } },
      { id: 'right-repeat-contact', continuationId: 'tenfold-repeat', motifId: 'right-ten', fromPoint: 0, toCell: { u: 1, v: 0.5 } },
    ],
  },
  morph: { min: 0.34, max: 0.54, default: 0.52 },
  defaults: {
    morph: 0.52,
    material: 0.64,
    paletteId: 'turquoise-brick',
    viewScale: 0.7,
    viewCenter: { cx: 0.27, cy: 0.5 },
  },
  palettes: ['turquoise-brick', 'lapis-and-ivory', 'saffron-night'],
}

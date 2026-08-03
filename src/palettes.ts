export type Palette = Readonly<{
  id: string
  name: string
  background: string
  strand: string
  edge: string
  highlight: string
  accent: string
  /**
   * Glaze colours for the enclosed regions, largest region first. A palette
   * with these reads as cut tilework; a palette without them leaves the
   * strapwork on a plain ground. Faces beyond the list wrap around it.
   */
  faces?: readonly string[]
}>

export const palettes = [
  {
    id: 'turquoise-brick',
    name: 'Turquoise & brick',
    background: '#173f43',
    strand: '#c96c43',
    edge: '#542b25',
    highlight: '#f0c995',
    accent: '#dfba62',
  },
  {
    id: 'lapis-and-ivory',
    name: 'Lapis & ivory',
    background: '#e8dcc2',
    strand: '#28557e',
    edge: '#172f48',
    highlight: '#f7ebd1',
    accent: '#ad713b',
  },
  {
    id: 'ink-and-parchment',
    name: 'Ink & parchment',
    background: '#e7d9bc',
    strand: '#28251f',
    edge: '#0f0e0c',
    highlight: '#f7eedb',
    accent: '#9a6638',
  },
  {
    id: 'copper-night',
    name: 'Copper night',
    background: '#111317',
    strand: '#b36d3e',
    edge: '#3f2418',
    highlight: '#e3b27d',
    accent: '#738b8f',
  },
  {
    id: 'saffron-night',
    name: 'Saffron night',
    background: '#171b29',
    strand: '#d49b32',
    edge: '#58401e',
    highlight: '#f2d899',
    accent: '#4c7f86',
  },
  {
    id: 'brick-and-bone',
    name: 'Brick & bone',
    background: '#d8c7a8',
    strand: '#9b4937',
    edge: '#4b2922',
    highlight: '#f3e9d5',
    accent: '#365e60',
  },
  {
    id: 'verdigris-sand',
    name: 'Verdigris & sand',
    background: '#d7c49d',
    strand: '#32756f',
    edge: '#204743',
    highlight: '#ecdfc4',
    accent: '#a65d39',
  },
  {
    id: 'zellij-court',
    name: 'Zellij court',
    background: '#0f1a1d',
    strand: '#f2e9d2',
    edge: '#0b1417',
    highlight: '#fff8e6',
    accent: '#d8a13a',
    faces: ['#1d6f6a', '#c8452f', '#e6d3a3', '#2b4f7a', '#d8a13a'],
  },
  {
    id: 'alhambra-glaze',
    name: 'Alhambra glaze',
    background: '#171310',
    strand: '#efe3c8',
    edge: '#0e0b09',
    highlight: '#fffaf0',
    accent: '#b98b3d',
    faces: ['#2f6f5e', '#8c2f2a', '#efe3c8', '#1f4a6b', '#b98b3d', '#6b4a86'],
  },
  {
    id: 'marrakesh-clay',
    name: 'Marrakesh clay',
    background: '#1a120e',
    strand: '#f6ecd8',
    edge: '#100b08',
    highlight: '#fff6e4',
    accent: '#cf7a34',
    faces: ['#b8492b', '#2c6e63', '#e8d5ad', '#7d3f6d'],
  },
] as const satisfies readonly Palette[]

export const paletteById = (id: string): Palette =>
  palettes.find((palette) => palette.id === id) ?? palettes[0]

export type Palette = Readonly<{
  id: string
  name: string
  background: string
  strand: string
  edge: string
  highlight: string
  accent: string
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
] as const satisfies readonly Palette[]

export const paletteById = (id: string): Palette =>
  palettes.find((palette) => palette.id === id) ?? palettes[0]

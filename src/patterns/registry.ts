import type { PatternDefinition } from '../geometry/recipe'
import { decagonTen } from './decagon-ten'
import { dodecagonTriangleTwelve } from './dodecagon-triangle-twelve'
import { dodecagonTwelve } from './dodecagon-twelve'
import { hexagonTriangleSix } from './hexagon-triangle-six'
import { octagonEight } from './octagon-eight'

export const patterns = [
  decagonTen,
  octagonEight,
  dodecagonTwelve,
  hexagonTriangleSix,
  dodecagonTriangleTwelve,
] as const satisfies readonly PatternDefinition[]

export const defaultPattern = patterns[0]

export function patternById(id: string): PatternDefinition | undefined {
  return patterns.find((pattern) => pattern.id === id)
}

export {
  decagonTen,
  dodecagonTriangleTwelve,
  dodecagonTwelve,
  hexagonTriangleSix,
  octagonEight,
}

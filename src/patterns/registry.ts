import type { PatternDefinition } from '../geometry/recipe'
import { decagonTen } from './decagon-ten'
import { dodecagonTwelve } from './dodecagon-twelve'
import { octagonEight } from './octagon-eight'

export const patterns = [decagonTen, octagonEight, dodecagonTwelve] as const satisfies readonly PatternDefinition[]

export const defaultPattern = patterns[0]

export function patternById(id: string): PatternDefinition | undefined {
  return patterns.find((pattern) => pattern.id === id)
}

export { decagonTen, dodecagonTwelve, octagonEight }

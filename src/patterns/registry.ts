import type { PatternDefinition } from '../geometry/recipe'
import { alaeddinEight } from './alaeddin-eight'
import { darbIImamTen } from './darb-i-imam-ten'
import { kharraqanTwelve } from './kharraqan-twelve'

export const patterns = [darbIImamTen, alaeddinEight, kharraqanTwelve] as const satisfies readonly PatternDefinition[]

export const defaultPattern = patterns[0]

export function patternById(id: string): PatternDefinition | undefined {
  return patterns.find((pattern) => pattern.id === id)
}

export { alaeddinEight, darbIImamTen, kharraqanTwelve }


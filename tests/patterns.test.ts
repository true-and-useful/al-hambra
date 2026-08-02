import { describe, expect, it } from 'vitest'

import { compilePattern } from '../src/geometry/recipe'
import { patterns, patternById } from '../src/patterns/registry'
import { refineSuspectInterval, validatePatternRange } from '../src/validation'

describe('curated pattern registry', () => {
  it('contains a distinct elementary, flagship, and oblique companion', () => {
    expect(patterns.map((pattern) => pattern.id)).toEqual([
      'darb-i-imam-ten',
      'alaeddin-eight',
      'kharraqan-twelve',
    ])
    expect(new Set(patterns.map((pattern) => pattern.recipe.motifs[0]?.points))).toEqual(
      new Set([8, 10, 12]),
    )
    expect(patternById('darb-i-imam-ten')?.reference.relationship).toBe('based on')
    expect(patternById('missing')).toBeUndefined()
  })

  it.each(patterns)('$name compiles finite renderer-ready scenes across its range', (pattern) => {
    const start = compilePattern(pattern, 0)
    const middle = compilePattern(pattern, 0.5)
    const end = compilePattern(pattern, 1)

    expect(start.scene.paths.length).toBeGreaterThan(start.graph.strands.length)
    expect(middle.recipeMorph).toBeGreaterThanOrEqual(pattern.morph.min)
    expect(end.recipeMorph).toBe(pattern.morph.max)
    for (const compiled of [start, middle, end]) {
      expect(
        compiled.scene.paths.every((path) =>
          path.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
        ),
      ).toBe(true)
    }
  })

  it.each(patterns)('$name keeps one validated topology across 512 samples', (pattern) => {
    const report = validatePatternRange(pattern)

    expect(report.sampleCount).toBe(512)
    expect(report.signatures).toHaveLength(1)
    expect(report.invariantErrors).toEqual([])
    expect(report.suspectIntervals).toEqual([])
    expect(report.valid).toBe(true)
  })

  it('offers a deterministic bisection hook without claiming proof', () => {
    const refined = refineSuspectInterval(0, 1, 0.0001, (value) => value < 0.375)

    expect(refined.from).toBeCloseTo(0.375, 3)
    expect(refined.to - refined.from).toBeLessThanOrEqual(0.0001)
  })
})


import { describe, expect, it } from 'vitest'

import { compilePattern, mapUserMorph, patternScaffoldErrors } from '../src/geometry/recipe'
import { graphInvariantErrors } from '../src/geometry/kernel'
import { patternById, patterns } from '../src/patterns/registry'
import { refineSuspectInterval, validatePatternRange } from '../src/validation'

describe('curated pattern registry', () => {
  it('contains a flagship, an elementary case, and a distinct companion', () => {
    expect(patterns.map((pattern) => pattern.id)).toEqual([
      'decagon-ten',
      'octagon-eight',
      'dodecagon-twelve',
    ])
    expect(patternById('missing')).toBeUndefined()
  })

  it('names a documented source and an honest relationship for every design', () => {
    for (const pattern of patterns) {
      expect(pattern.reference.href).toMatch(/^https:\/\//)
      expect(['based on', 'adapted from', 'inspired by']).toContain(
        pattern.reference.relationship,
      )
      expect(pattern.reference.note.length).toBeGreaterThan(24)
    }
  })

  it('gives the flagship a scaffold the elementary case cannot express', () => {
    const flagship = patternById('decagon-ten')!
    const elementary = patternById('octagon-eight')!
    const shapes = (id: string): Set<number> =>
      new Set(patternById(id)!.tiling.tiles.map((tile) => tile.verts.length))

    // The elementary scaffold is one regular family; the flagship mixes a
    // decagon with an irregular supporting tile on an oblique repeat.
    expect(shapes('octagon-eight')).toEqual(new Set([8, 4]))
    expect(shapes('decagon-ten')).toEqual(new Set([10, 4]))
    expect(elementary.tiling.cell.b.x).toBe(0)
    expect(flagship.tiling.cell.b.x).not.toBe(0)
  })

  it.each(patterns)('$name has a well formed scaffold', (pattern) => {
    expect(patternScaffoldErrors(pattern)).toEqual([])
  })

  it.each(patterns)('$name compiles finite renderer-ready scenes across its range', (pattern) => {
    for (const morph of [0, 0.25, 0.5, 0.75, 1]) {
      const compiled = compilePattern(pattern, morph)
      expect(compiled.scene.paths).toHaveLength(compiled.graph.strands.length)
      expect(compiled.graph.strands.length).toBeGreaterThan(0)
      expect(compiled.recipeMorph).toBeCloseTo(mapUserMorph(pattern.morph, morph), 9)
      expect(
        compiled.scene.paths.every((path) =>
          path.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
        ),
      ).toBe(true)
      expect(graphInvariantErrors(compiled.graph)).toEqual([])
    }
  })

  it.each(patterns)('$name interlaces at genuine crossings', (pattern) => {
    const graph = compilePattern(pattern, 0.5).graph
    const woven = graph.crossings.filter((crossing) => crossing.kind === 'intersection')
    expect(woven.length).toBeGreaterThan(0)
    // Contact points are crossings of two straight straps, never path endpoints.
    expect(woven.every((crossing) => crossing.vertex.includes('cross:'))).toBe(true)
  })

  it.each(patterns)('$name keeps one validated topology across 512 samples', (pattern) => {
    const report = validatePatternRange(pattern)

    expect(report.sampleCount).toBe(512)
    expect(report.signatures).toHaveLength(1)
    expect(report.invariantErrors).toEqual([])
    expect(report.suspectIntervals).toEqual([])
    expect(report.valid).toBe(true)
  }, 120_000)

  it.each(patterns)('$name alternates over and under along every periodic strand', (pattern) => {
    const graph = compilePattern(pattern, 0.5).graph
    const edges = new Map(graph.halfEdges.map((edge) => [edge.id, edge]))
    const crossingByVertex = new Map(graph.crossings.map((crossing) => [crossing.vertex, crossing]))

    for (const strand of graph.strands) {
      let tile = { u: 0, v: 0 }
      const occurrences = strand.edges.flatMap((edgeId) => {
        const edge = edges.get(edgeId)
        if (!edge) return []
        const at = { vertex: edge.origin, tile, outgoing: edgeId }
        tile = { u: tile.u + edge.wrap.u, v: tile.v + edge.wrap.v }
        const crossing = crossingByVertex.get(at.vertex)
        if (!crossing || crossing.kind !== 'intersection') return []
        const pairIndex = crossing.continuations.findIndex((pair) => pair.includes(at.outgoing))
        if (pairIndex < 0) return []
        return [{ crossing, pairIndex, tile: at.tile }]
      })
      if (occurrences.length < 2) continue

      const isOver = (
        occurrence: typeof occurrences[number],
        offset = { u: 0, v: 0 },
      ): boolean => {
        const { crossing } = occurrence
        const phase = Math.abs(
          crossing.weavePhase.u * (occurrence.tile.u + offset.u) +
          crossing.weavePhase.v * (occurrence.tile.v + offset.v),
        ) % 2
        return (crossing.overPair ^ phase) === occurrence.pairIndex
      }
      for (let index = 0; index < occurrences.length; index += 1) {
        const current = occurrences[index]!
        const last = index === occurrences.length - 1
        const next = occurrences[(index + 1) % occurrences.length]!
        expect(isOver(current)).not.toBe(isOver(next, last ? strand.netWrap : { u: 0, v: 0 }))
      }
    }
  })

  it('offers a deterministic bisection hook without claiming proof', () => {
    const refined = refineSuspectInterval(0, 1, 0.0001, (value) => value < 0.375)

    expect(refined.from).toBeCloseTo(0.375, 3)
    expect(refined.to - refined.from).toBeLessThanOrEqual(0.0001)
    expect(() => refineSuspectInterval(0, 1, 0, () => true)).toThrow(RangeError)
  })
})

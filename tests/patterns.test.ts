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
    expect(patternById('darb-i-imam-ten')?.reference.relationship).toBe('inspired by')
    expect(patternById('missing')).toBeUndefined()
  })

  it.each(patterns)('$name compiles finite renderer-ready scenes across its range', (pattern) => {
    const start = compilePattern(pattern, 0)
    const middle = compilePattern(pattern, 0.5)
    const end = compilePattern(pattern, 1)

    expect(start.scene.paths).toHaveLength(start.graph.strands.length)
    expect(start.graph.strands.some((strand) => strand.role === 'ornament')).toBe(true)
    expect(start.graph.crossings.some((crossing) =>
      crossing.armsCCW.some((arm) => arm.includes('motif:')),
    )).toBe(true)
    expect(middle.recipeMorph).toBeGreaterThanOrEqual(pattern.morph.min)
    expect(end.recipeMorph).toBeCloseTo(pattern.morph.max, 12)
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
  }, 30_000)

  it('records the flagship repeat seam as a paired non-woven guide contact', () => {
    const graph = compilePattern(patternById('darb-i-imam-ten')!, 0.5).graph
    const seam = graph.crossings.find((crossing) => {
      const vertex = graph.vertices.find((candidate) => candidate.id === crossing.vertex)
      return vertex && Math.abs(vertex.position.x) < 0.001 && Math.abs(vertex.position.y - 400) < 0.001
    })

    expect(seam).toBeDefined()
    expect(seam?.kind).toBe('contact')
    expect(seam?.continuations.flat().some((arm) => arm.includes('left-repeat-contact'))).toBe(true)
    expect(seam?.continuations.flat().some((arm) => arm.includes('right-repeat-contact'))).toBe(true)
  })

  it('assembles a multi-path repeat as one periodic strand', () => {
    const graph = compilePattern(patternById('alaeddin-eight')!, 0.5).graph
    const repeat = graph.strands.find((strand) => strand.continuationId === 'eight-repeat')

    expect(repeat).toBeDefined()
    expect(repeat?.netWrap).not.toEqual({ u: 0, v: 0 })
    expect(repeat?.edges.some((edge) => edge.includes('diameter-a'))).toBe(true)
    expect(repeat?.edges.some((edge) => edge.includes('left-repeat-contact'))).toBe(true)
    expect(repeat?.edges.some((edge) => edge.includes('right-repeat-contact'))).toBe(true)
  })

  it.each(patterns)('$name alternates over and under along every periodic strand', (pattern) => {
    const graph = compilePattern(pattern, 0.5).graph
    const edges = new Map(graph.halfEdges.map((edge) => [edge.id, edge]))
    const crossingByVertex = new Map(graph.crossings.map((crossing) => [crossing.vertex, crossing]))
    for (const strand of graph.strands.filter((candidate) =>
      candidate.pathClosed || candidate.netWrap.u !== 0 || candidate.netWrap.v !== 0,
    )) {
      let tile = { u: 0, v: 0 }
      const visits = strand.edges.flatMap((edgeId, index) => {
        const edge = edges.get(edgeId)
        const destination = edge ? edges.get(edge.twin)?.origin : undefined
        const start = { vertex: edge?.origin, tile }
        if (edge) tile = { u: tile.u + edge.wrap.u, v: tile.v + edge.wrap.v }
        const end = { vertex: destination, tile }
        return index === 0 ? [start, end] : [end]
      }).filter((visit): visit is { vertex: string; tile: { u: number; v: number } } => visit.vertex !== undefined)
      const occurrences = visits.flatMap((visit) => {
        const crossing = crossingByVertex.get(visit.vertex)
        if (!crossing || crossing.kind !== 'intersection') return []
        const pairIndex = crossing.continuations.findIndex((pair) => pair.some((arm) =>
          strand.edges.includes(arm) || strand.edges.some((edgeId) => edges.get(edgeId)?.twin === arm),
        ))
        if (pairIndex < 0) return []
        return [{ crossing, pairIndex, tile: visit.tile }]
      }).filter((occurrence, index, all) =>
        index === 0 || occurrence.crossing.id !== all[index - 1]?.crossing.id ||
        occurrence.tile.u !== all[index - 1]?.tile.u || occurrence.tile.v !== all[index - 1]?.tile.v,
      )
      if (occurrences.length > 1 && occurrences[0]?.crossing === occurrences.at(-1)?.crossing) occurrences.pop()
      if (occurrences.length === 0) continue
      const isOver = (occurrence: typeof occurrences[number], offset = { u: 0, v: 0 }): boolean => {
        const crossing = occurrence.crossing
        const phase = Math.abs(
          crossing.weavePhase.u * (occurrence.tile.u + offset.u) +
          crossing.weavePhase.v * (occurrence.tile.v + offset.v),
        ) % 2
        return (crossing.overPair ^ phase) === occurrence.pairIndex
      }
      for (let index = 0; index < occurrences.length; index += 1) {
        const current = occurrences[index]!
        const wraps = index === occurrences.length - 1 ? strand.netWrap : { u: 0, v: 0 }
        const next = occurrences[(index + 1) % occurrences.length]!
        expect(isOver(current)).not.toBe(isOver(next, wraps))
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

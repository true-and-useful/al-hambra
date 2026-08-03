import { describe, expect, it } from 'vitest'

import {
  buildPeriodicGrid,
  destinationOf,
  graphInvariantErrors,
  screenOrientation,
  topologySignature,
  unwrapCycle,
} from '../src/geometry/kernel'
import { compilePeriodicArrangement } from '../src/geometry/arrangement'

const cell = {
  origin: { x: 0, y: 0 },
  a: { x: 100, y: 0 },
  b: { x: 20, y: 80 },
}

describe('periodic geometry kernel', () => {
  it('builds a coherent half-edge graph on the torus', () => {
    const graph = buildPeriodicGrid({ columns: 3, rows: 2, cell })

    expect(graph.vertices).toHaveLength(6)
    expect(graph.halfEdges).toHaveLength(24)
    expect(graph.faces).toHaveLength(6)
    expect(graphInvariantErrors(graph)).toEqual([])

    for (const edge of graph.halfEdges) {
      const twin = graph.halfEdges.find((candidate) => candidate.id === edge.twin)
      expect(twin?.twin).toBe(edge.id)
      expect((twin?.wrap.u ?? Number.NaN) + edge.wrap.u).toBe(0)
      expect((twin?.wrap.v ?? Number.NaN) + edge.wrap.v).toBe(0)
      expect(destinationOf(graph, edge).id).toBe(twin?.origin)
    }
  })

  it('traverses wrapped strands to the neighboring representative', () => {
    const graph = buildPeriodicGrid({ columns: 4, rows: 3, cell })
    const horizontal = graph.strands.find((strand) => strand.id === 'strand:u:0')
    expect(horizontal).toBeDefined()
    const points = unwrapCycle(graph, horizontal!)

    expect(points).toHaveLength(5)
    expect(points.at(-1)?.x).toBeCloseTo(points[0]!.x + cell.a.x)
    expect(points.at(-1)?.y).toBeCloseTo(points[0]!.y + cell.a.y)
  })

  it('keeps construction identity out of the topology signature', () => {
    const still = buildPeriodicGrid({ columns: 3, rows: 3, cell })
    const deformed = buildPeriodicGrid({
      columns: 3,
      rows: 3,
      cell,
      positionAt: (u, v) => ({ x: u * 100 + Math.sin(v * Math.PI * 2), y: v * 80 }),
    })

    expect(topologySignature(deformed)).toBe(topologySignature(still))
  })

  it('wraps robust-predicates with screen-coordinate semantics', () => {
    const positive = screenOrientation(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
    )
    const collinear = screenOrientation(
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
    )

    expect(positive).toBeGreaterThan(0)
    expect(Math.abs(collinear)).toBe(0)
  })

  it('discovers crossings against translated neighbor representatives', () => {
    const graph = compilePeriodicArrangement(
      { origin: { x: 0, y: 0 }, a: { x: 100, y: 0 }, b: { x: 0, y: 100 } },
      [
        { id: 'wrapped-horizontal', role: 'ornament', points: [{ x: 90, y: 50 }, { x: 110, y: 50 }], closed: false, netWrap: { u: 0, v: 0 } },
        { id: 'vertical', role: 'ornament', points: [{ x: 5, y: 40 }, { x: 5, y: 60 }], closed: false, netWrap: { u: 0, v: 0 } },
      ],
    )

    expect(graph.crossings.some((crossing) => crossing.kind === 'intersection')).toBe(true)
  })

  it('normalizes equivalent torus representatives to one topology signature', () => {
    const periodicCell = { origin: { x: 0, y: 0 }, a: { x: 100, y: 0 }, b: { x: 0, y: 100 } }
    const vertical = { id: 'vertical', role: 'ornament' as const, points: [{ x: 5, y: 40 }, { x: 5, y: 60 }], closed: false, netWrap: { u: 0, v: 0 } }
    const rightRepresentative = compilePeriodicArrangement(periodicCell, [
      { id: 'horizontal', role: 'ornament', points: [{ x: 90, y: 50 }, { x: 110, y: 50 }], closed: false, netWrap: { u: 0, v: 0 } },
      vertical,
    ])
    const leftRepresentative = compilePeriodicArrangement(periodicCell, [
      { id: 'horizontal', role: 'ornament', points: [{ x: -10, y: 50 }, { x: 10, y: 50 }], closed: false, netWrap: { u: 0, v: 0 } },
      vertical,
    ])

    expect(topologySignature(rightRepresentative)).toBe(topologySignature(leftRepresentative))
  })

  it('doubles weave phase for a periodic strand with one crossing per circuit', () => {
    const periodicCell = { origin: { x: 0, y: 0 }, a: { x: 100, y: 0 }, b: { x: 0, y: 100 } }
    const graph = compilePeriodicArrangement(periodicCell, [
      { id: 'horizontal', role: 'ornament', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }], closed: false, netWrap: { u: 1, v: 0 } },
      { id: 'vertical', role: 'ornament', points: [{ x: 50, y: 0 }, { x: 50, y: 100 }], closed: false, netWrap: { u: 0, v: 1 } },
    ])

    expect(graph.crossings).toHaveLength(1)
    expect(graph.crossings[0]?.weavePhase).toEqual({ u: 1, v: 1 })
  })
})

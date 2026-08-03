import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { compilePattern, mapUserMorph } from '../src/geometry/recipe'
import { topologySignature } from '../src/geometry/kernel'
import { patterns } from '../src/patterns/registry'
import { DEFAULT_VALIDATION_TOLERANCE, validatePatternRange } from '../src/validation'

const reportDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../docs/validation')

/**
 * U5 requires a stored validation report for every exposed range, so the numbers
 * behind a release are reviewable rather than living only inside a test run.
 *
 * The report records a digest of the normalized topology signature rather than
 * the signature itself. The signatures run to tens of thousands of characters,
 * where a diff communicates nothing; a digest identifies the topology exactly,
 * changes whenever it changes, and stays readable in review. Regenerate with
 * `npm test` -- the signature is reproducible from the definition and sample.
 */
describe('stored range validation reports', () => {
  it.each(patterns)('$name records its validated range', (pattern) => {
    const report = validatePatternRange(pattern)
    expect(report.valid).toBe(true)
    expect(report.signatures).toHaveLength(1)

    const signature = report.signatures[0] ?? ''
    const stored = {
      patternId: pattern.id,
      name: pattern.name,
      scaffold: pattern.tiling.id,
      contactAngleDegrees: {
        min: pattern.morph.min,
        max: pattern.morph.max,
        atDefault: mapUserMorph(pattern.morph, pattern.defaults.morph),
      },
      sampleCount: report.sampleCount,
      topology: {
        distinctSignatures: report.signatures.length,
        signatureDigest: createHash('sha256').update(signature).digest('hex'),
        signatureLength: signature.length,
      },
      tolerance: {
        note: 'Distance thresholds are fractions of the scaffold edge length.',
        scaffoldEdgeLength: pattern.edgeLength,
        minimumEdgeLengthFraction: DEFAULT_VALIDATION_TOLERANCE.minimumEdgeLength,
        warningClearanceFraction: DEFAULT_VALIDATION_TOLERANCE.warningClearance,
        parameterPrecision: DEFAULT_VALIDATION_TOLERANCE.parameterPrecision,
        exclusionMargin: DEFAULT_VALIDATION_TOLERANCE.exclusionMargin,
      },
      minimumObservedClearance: report.minimumObservedClearance,
      minimumObservedEdgeLength: report.minimumObservedEdgeLength,
      suspectIntervals: report.suspectIntervals,
      excludedRanges: report.excludedRanges,
      invariantErrors: report.invariantErrors,
      valid: report.valid,
    }

    // The stored digest has to describe the topology the app actually renders.
    const rendered = topologySignature(compilePattern(pattern, 0.5).graph)
    expect(createHash('sha256').update(rendered).digest('hex')).toBe(
      stored.topology.signatureDigest,
    )

    // Compare against the committed baseline before overwriting it. Writing
    // first and digesting what we just wrote would let a geometry regression
    // silently rewrite the report instead of failing the build.
    const reportPath = resolve(reportDirectory, `${pattern.id}.json`)
    const committed = existsSync(reportPath)
      ? (JSON.parse(readFileSync(reportPath, 'utf8')) as typeof stored)
      : undefined
    if (committed !== undefined && !process.env.UPDATE_VALIDATION_REPORTS) {
      expect(
        stored.topology.signatureDigest,
        `${pattern.id} topology changed against its committed report; ` +
        're-run with UPDATE_VALIDATION_REPORTS=1 once the change is intended',
      ).toBe(committed.topology.signatureDigest)
      expect(stored.contactAngleDegrees).toEqual(committed.contactAngleDegrees)
      expect(stored.minimumObservedClearance).toBeCloseTo(committed.minimumObservedClearance, 6)
    }

    mkdirSync(reportDirectory, { recursive: true })
    writeFileSync(reportPath, `${JSON.stringify(stored, null, 2)}\n`)
  }, 120_000)
})

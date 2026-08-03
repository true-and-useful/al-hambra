import { expect, test } from '@playwright/test'

const percentile = (values: readonly number[], fraction: number): number => {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? Number.POSITIVE_INFINITY
}

/** AC-1's documented profile: 1.6 Mbps down, 750 Kbps up, 150 ms latency, 4x CPU. */
const AC1_PROFILE = {
  latency: 150,
  downloadThroughput: (1.6 * 1_000_000) / 8,
  uploadThroughput: (750 * 1_000) / 8,
  cpuThrottlingRate: 4,
} as const

test('first meaningful render is a finished pattern on the AC-1 test profile', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the documented profile is applied through CDP')
  test.setTimeout(60_000)

  const client = await page.context().newCDPSession(page)
  await client.send('Network.enable')
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: AC1_PROFILE.latency,
    downloadThroughput: AC1_PROFILE.downloadThroughput,
    uploadThroughput: AC1_PROFILE.uploadThroughput,
  })
  await client.send('Emulation.setCPUThrottlingRate', { rate: AC1_PROFILE.cpuThrottlingRate })

  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-pattern-ready', 'true')

  // Measured from navigation start inside the page, so it includes transfer and
  // parse under the throttled profile rather than just the paint call.
  const readyAt = await page.evaluate(
    () => performance.getEntriesByName('pattern-ready')[0]?.startTime,
  )
  expect(readyAt, 'pattern-ready timing was not recorded').toBeDefined()
  expect(readyAt!, 'first meaningful render on the AC-1 profile').toBeLessThan(1_500)

  // The first thing on screen must be the finished ornament: no setup step, no
  // generator affordance, and no empty frame waiting to be filled.
  const canvas = page.locator('.pattern-canvas')
  await expect(canvas).toBeVisible()
  expect(await canvas.locator('use').count()).toBeGreaterThan(10)
  expect(await canvas.locator('path').count()).toBeGreaterThan(5)

  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  await client.send('Network.disable')
})

test('renders promptly and stays within a refresh-relative morph budget', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-pattern-ready', 'true')
  const readyAt = await page.evaluate(() => performance.getEntriesByName('pattern-ready')[0]?.startTime)
  expect(readyAt).toBeDefined()
  expect(readyAt!).toBeLessThan(1_500)

  const canvas = page.locator('.artwork-shell')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Pattern canvas has no box')
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.4)
  await page.mouse.down()
  for (let index = 0; index < 90; index += 1) {
    await page.mouse.move(
      box.x + box.width * (0.25 + index / 180),
      box.y + box.height * 0.4,
    )
  }
  await page.mouse.up()

  const metrics = await page.evaluate(async () => {
    const frames: number[] = []
    let previous = performance.now()
    for (let index = 0; index < 30; index += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      const now = performance.now()
      frames.push(now - previous)
      previous = now
    }
    return {
      frames,
      paints: (window as Window & { __patternPaintDurations?: number[] }).__patternPaintDurations ?? [],
    }
  })

  const idleInterval = percentile(metrics.frames, 0.5)
  const p95Paint = percentile(metrics.paints, 0.95)
  expect(p95Paint).toBeLessThan(idleInterval / 2)
  expect(Math.max(...metrics.paints)).toBeLessThan(50)
})

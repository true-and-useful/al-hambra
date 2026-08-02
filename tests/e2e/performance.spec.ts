import { expect, test } from '@playwright/test'

const percentile = (values: readonly number[], fraction: number): number => {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? Number.POSITIVE_INFINITY
}

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

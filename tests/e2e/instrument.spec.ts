import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-pattern-ready', 'true')
})

test('opens on a finished, bounded SVG composition', async ({ page }) => {
  const canvas = page.locator('.pattern-canvas')
  await expect(canvas).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Design' })).toHaveValue('darb-i-imam-ten')
  expect(await canvas.locator('*').count()).toBeLessThan(500)
  expect(await canvas.locator('path').count()).toBeGreaterThan(20)
})

test('a drag commits one living state and undo restores it', async ({ page }) => {
  const canvas = page.locator('.artwork-shell')
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Pattern canvas has no box')
  const before = await page.getByRole('slider', { name: 'Morph' }).inputValue()

  await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.45)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.68, box.y + box.height * 0.45, { steps: 8 })
  await page.mouse.up()

  const after = await page.getByRole('slider', { name: 'Morph' }).inputValue()
  expect(after).not.toBe(before)
  await expect(page).toHaveURL(/#v=1&design=darb-i-imam-ten/)

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('slider', { name: 'Morph' })).toHaveValue(before)
})

test('design and palette choices create an editable restorable URL', async ({ page, context }) => {
  await page.getByRole('combobox', { name: 'Design' }).selectOption('alaeddin-eight')
  await page.getByRole('button', { name: 'Ink & parchment' }).click()
  const url = page.url()

  const restored = await context.newPage()
  await restored.goto(url)
  await expect(restored.getByRole('combobox', { name: 'Design' })).toHaveValue('alaeddin-eight')
  await expect(restored.getByRole('button', { name: 'Ink & parchment' })).toHaveAttribute('aria-pressed', 'true')
  await restored.getByRole('slider', { name: 'Morph' }).press('ArrowRight')
  await expect(restored.getByRole('button', { name: 'Undo' })).toBeEnabled()
  await restored.close()
})

test('standalone SVG and PNG export from the live composition', async ({ page }) => {
  await page.getByRole('button', { name: 'More actions' }).click()
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save SVG' }).click()
  const svg = await svgDownload
  expect(svg.suggestedFilename()).toBe('darb-i-imam-ten.svg')

  await page.getByRole('button', { name: 'More actions' }).click()
  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save PNG' }).click()
  const png = await pngDownload
  expect(png.suggestedFilename()).toBe('darb-i-imam-ten.png')
})

test('mobile controls fit the viewport and keep generous targets', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile project only')
  const metrics = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    targets: [...document.querySelectorAll('button, select')]
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height, label: element.getAttribute('aria-label') ?? element.textContent }
      })
      .filter((target) => target.width > 0 && target.height > 0),
  }))
  expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.viewportWidth)
  for (const target of metrics.targets) {
    expect.soft(target.height, target.label ?? 'control').toBeGreaterThanOrEqual(44)
  }
})

import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'

async function visualDifference(page: Page, left: string, right: string): Promise<number> {
  return page.evaluate(async ([leftSource, rightSource]) => {
    const load = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Could not decode export comparison image'))
      image.src = source
    })
    const [leftImage, rightImage] = await Promise.all([load(leftSource), load(rightSource)])
    const pixels = (image: HTMLImageElement): Uint8ClampedArray => {
      const canvas = document.createElement('canvas')
      canvas.width = 240
      canvas.height = 160
      const context = canvas.getContext('2d', { colorSpace: 'srgb' })
      if (!context) throw new Error('Could not create export comparison canvas')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      return context.getImageData(0, 0, canvas.width, canvas.height).data
    }
    const leftPixels = pixels(leftImage)
    const rightPixels = pixels(rightImage)
    let difference = 0
    for (let index = 0; index < leftPixels.length; index += 1) {
      difference += Math.abs(leftPixels[index]! - rightPixels[index]!)
    }
    return difference / leftPixels.length
  }, [left, right] as const)
}

function stateHash(state: {
  design: string
  morph: number
  material: number
  palette: string
  cx: number
  cy: number
  scale: number
}): string {
  return `#v=1&design=${state.design}&morph=${state.morph}&material=${state.material}` +
    `&palette=${state.palette}&cx=${state.cx}&cy=${state.cy}&scale=${state.scale}`
}

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

test('a drag commits one living state and undo restores it', async ({ page }, testInfo) => {
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

  if (testInfo.project.name.includes('mobile')) {
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
  }
  await expect(page.getByRole('slider', { name: 'Morph' })).toHaveValue(before)
})

test('design and palette choices create an editable restorable URL', async ({ page, context }, testInfo) => {
  await page.getByRole('combobox', { name: 'Design' }).selectOption('alaeddin-eight')
  if (testInfo.project.name.includes('mobile')) {
    await page.getByRole('button', { name: 'More actions' }).click()
    await page.getByRole('button', { name: 'Palette: Ink & parchment' }).click()
  } else {
    await page.getByRole('button', { name: 'Ink & parchment' }).click()
  }
  const url = page.url()

  const restored = await context.newPage()
  await restored.goto(url)
  await expect(restored.getByRole('combobox', { name: 'Design' })).toHaveValue('alaeddin-eight')
  if (testInfo.project.name.includes('mobile')) {
    await restored.getByRole('button', { name: 'More actions' }).click()
    await expect(restored.getByRole('button', { name: 'Palette: Ink & parchment' })).toHaveAttribute('aria-pressed', 'true')
    await restored.getByRole('button', { name: 'More actions' }).click()
  } else {
    await expect(restored.getByRole('button', { name: 'Ink & parchment' })).toHaveAttribute('aria-pressed', 'true')
  }
  await restored.getByRole('slider', { name: 'Morph' }).press('ArrowRight')
  if (testInfo.project.name.includes('mobile')) {
    await restored.getByRole('button', { name: 'More actions' }).click()
  }
  await expect(restored.getByRole('button', { name: 'Undo', exact: true })).toBeEnabled()
  await restored.close()
})

test('standalone SVG and PNG export from the live composition', async ({ page }) => {
  await page.getByRole('button', { name: 'More actions' }).click()
  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save SVG' }).click()
  const svg = await svgDownload
  expect(svg.suggestedFilename()).toBe('darb-i-imam-ten.svg')
  const svgPath = await svg.path()
  if (!svgPath) throw new Error('SVG download has no local path')
  const svgText = await readFile(svgPath, 'utf8')
  expect(svgText).toContain('<pattern-source design-id="darb-i-imam-ten"')
  expect((svgText.match(/<path /g) ?? []).length).toBeGreaterThan(20)
  expect(svgText).not.toMatch(/<script|<style|\b(?:href|xlink:href)="https?:\/\//)

  await page.getByRole('button', { name: 'More actions' }).click()
  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save PNG' }).click()
  const png = await pngDownload
  expect(png.suggestedFilename()).toBe('darb-i-imam-ten.png')
  const pngPath = await png.path()
  if (!pngPath) throw new Error('PNG download has no local path')
  const pngBytes = await readFile(pngPath)
  expect([...pngBytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  expect(pngBytes.readUInt32BE(16)).toBe(4096)
  expect(pngBytes.readUInt32BE(20)).toBe(2731)
  expect(pngBytes.byteLength).toBeGreaterThan(10_000)
})

test('live canvas, standalone SVG, and PNG preserve appearance across every design', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.includes('mobile'), 'appearance matrix runs once in desktop Chromium')
  test.setTimeout(120_000)
  const states = [
    { design: 'darb-i-imam-ten', morph: 0.52, material: 0.64, palette: 'turquoise-brick', cx: 0.27, cy: 0.5, scale: 0.7 },
    { design: 'darb-i-imam-ten', morph: 0.08, material: 0.94, palette: 'saffron-night', cx: 0.58, cy: 0.42, scale: 1.15 },
    { design: 'alaeddin-eight', morph: 0.46, material: 0.38, palette: 'lapis-and-ivory', cx: 0.5, cy: 0.5, scale: 0.65 },
    { design: 'alaeddin-eight', morph: 0.91, material: 0.86, palette: 'copper-night', cx: 0.36, cy: 0.62, scale: 1.08 },
    { design: 'kharraqan-twelve', morph: 0.5, material: 0.48, palette: 'brick-and-bone', cx: 0.5, cy: 0.5, scale: 0.5 },
    { design: 'kharraqan-twelve', morph: 0.12, material: 0.9, palette: 'verdigris-sand', cx: 0.63, cy: 0.38, scale: 0.92 },
  ]

  for (const state of states) {
    await page.goto(`/${stateHash(state)}`)
    await expect(page.locator('body')).toHaveAttribute('data-pattern-ready', 'true')
    await page.getByRole('button', { name: 'More actions' }).click()
    const svgDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save SVG' }).click()
    const svgPath = await (await svgDownloadPromise).path()
    if (!svgPath) throw new Error('SVG comparison download has no path')
    const standaloneSvg = await readFile(svgPath, 'utf8')
    const structures = await page.evaluate((source) => {
      const root = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
      root.querySelector('title')?.remove()
      root.querySelector('metadata')?.remove()
      const visual = (parent: ParentNode): string[] => [...parent.querySelectorAll('g, pattern, path, line, rect, use')]
        .map((element) => [
          element.localName,
          ...[...element.attributes]
            .map((attribute) => `${attribute.name}=${attribute.value}`)
            .sort(),
        ].join('|'))
      return {
        live: visual(document.querySelector('.pattern-canvas')!),
        exported: visual(root),
      }
    }, standaloneSvg)
    expect(structures.exported, `${state.design} live/export visual structure`).toEqual(structures.live)

    await page.getByRole('button', { name: 'More actions' }).click()
    const pngDownloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Save PNG' }).click()
    const pngPath = await (await pngDownloadPromise).path()
    if (!pngPath) throw new Error('PNG comparison download has no path')
    const png = await readFile(pngPath)

    const svgSource = `data:image/svg+xml;base64,${Buffer.from(standaloneSvg).toString('base64')}`
    const pngSource = `data:image/png;base64,${png.toString('base64')}`
    // Browser SVG and high-resolution canvas rasterization use slightly different
    // antialiasing kernels; a mean channel delta below 3/255 is visually inert.
    expect(await visualDifference(page, svgSource, pngSource), `${state.design} SVG→PNG`).toBeLessThan(3)
  }
})

test('mobile controls fit the viewport and keep generous targets', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile project only')
  await page.getByRole('button', { name: 'More actions' }).click()
  const metrics = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    targets: [...document.querySelectorAll('button, select, input:not(.morph-slider)')]
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

  await expect(page.getByRole('button', { name: 'Move view', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Palette: Turquoise & brick' })).toBeVisible()
  await page.getByRole('button', { name: 'Move view', exact: true }).click()
  await expect(page.locator('.artwork-shell')).toHaveAttribute('data-mode', 'move')
  await expect(page.locator('.gesture-hint')).toHaveText('Drag to move view')
  const moreButton = page.getByRole('button', { name: 'More actions, move view active' })
  await expect(moreButton).toContainText('Move')
  const artwork = page.locator('.artwork-shell')
  const artworkBox = await artwork.boundingBox()
  if (!artworkBox) throw new Error('Pattern canvas has no box')
  await page.touchscreen.tap(artworkBox.x + artworkBox.width / 2, artworkBox.y + artworkBox.height / 2)
  await expect(page.locator('#instrument')).toHaveAttribute('data-touched', 'true')
  await expect(moreButton).toBeVisible()
  await moreButton.click()
  await expect(page.getByRole('button', { name: 'Move view', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('one-finger touch morph remains an app gesture', async ({ page, context }, testInfo) => {
  test.skip(!testInfo.project.name.includes('mobile'), 'mobile project only')
  const artwork = page.locator('.artwork-shell')
  const box = await artwork.boundingBox()
  if (!box) throw new Error('Pattern canvas has no box')
  const before = await page.getByRole('slider', { name: 'Morph' }).inputValue()
  const client = await context.newCDPSession(page)
  const y = box.y + box.height * 0.45
  const fromX = box.x + box.width * 0.3
  const toX = box.x + box.width * 0.7
  await client.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: fromX, y }],
  })
  for (let step = 1; step <= 6; step += 1) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: fromX + (toX - fromX) * (step / 6), y }],
    })
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(page.getByRole('slider', { name: 'Morph' })).not.toHaveValue(before)
})

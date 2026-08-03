import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const patternIds = ['decagon-ten', 'octagon-eight', 'dodecagon-twelve'] as const

test('generates the full-range visual contact sheets', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'generate once on desktop')
  const outputDirectory = resolve('docs/contact-sheets')
  await mkdir(outputDirectory, { recursive: true })

  for (const patternId of patternIds) {
    await page.goto('/')
    await expect(page.locator('body')).toHaveAttribute('data-pattern-ready', 'true')
    await page.getByRole('combobox', { name: 'Design' }).selectOption(patternId)
    const morph = page.getByRole('slider', { name: 'Morph' })
    const material = page.getByRole('slider', { name: /Material/ })
    const svg = page.locator('.pattern-canvas')
    const samples: string[] = []

    for (let index = 0; index < 101; index += 1) {
      await morph.fill(String(index / 100))
      await page.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame())))
      samples.push(await svg.evaluate((element) => element.outerHTML))
    }

    const materialSamples: string[] = []
    await morph.fill('0.5')
    for (const anchor of [0, 0.25, 0.5, 0.75, 1]) {
      await material.fill(String(anchor))
      await page.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => resolveFrame())))
      materialSamples.push(await svg.evaluate((element) => element.outerHTML))
    }

    const cells = samples.map((markup, index) => `
      <figure><div>${markup}</div><figcaption>${index.toString().padStart(3, '0')} · ${(index / 100).toFixed(2)}</figcaption></figure>
    `).join('')
    const anchors = materialSamples.map((markup, index) => `
      <figure class="anchor"><div>${markup}</div><figcaption>material · ${(index / 4).toFixed(2)}</figcaption></figure>
    `).join('')

    await page.setContent(`<!doctype html>
      <html><head><style>
        *{box-sizing:border-box} body{margin:0;padding:20px;background:#15120f;color:#e8dcc2;font:11px ui-monospace,monospace}
        h1{margin:0 0 14px;font:28px Georgia,serif;font-weight:400} h2{grid-column:1/-1;margin:16px 0 0;font:18px Georgia,serif;font-weight:400}
        main{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:7px;max-width:1800px;margin:auto}
        figure{min-width:0;margin:0;border:1px solid #54493d;background:#231e18} figure div{aspect-ratio:3/2;overflow:hidden}
        svg{display:block;width:100%;height:100%} figcaption{padding:4px 6px;color:#aa9d89;font-variant-numeric:tabular-nums}
        .anchor{grid-column:span 2}
      </style></head><body><h1>${patternId} · 101-state morph audit</h1><main>${cells}<h2>Material anchors at morph 0.5</h2>${anchors}</main></body></html>`)
    await page.screenshot({
      path: resolve(outputDirectory, `${patternId}.png`),
      fullPage: true,
    })
  }
})

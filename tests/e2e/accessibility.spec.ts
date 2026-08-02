import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('has no automatically detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-pattern-ready', 'true')
  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations).toEqual([])
})

test('remains operable at 200% text zoom', async ({ page }) => {
  await page.goto('/')
  await page.locator('html').evaluate((element) => {
    element.style.fontSize = '200%'
  })
  const overflow = await page.evaluate(() => document.body.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
  await expect(page.getByRole('combobox', { name: 'Design' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copy link' })).toBeVisible()
})

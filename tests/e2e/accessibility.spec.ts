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

test('returns focus when the actions menu closes and exposes keyboard morph focus', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toHaveAttribute('data-pattern-ready', 'true')
  const more = page.getByRole('button', { name: 'More actions' })
  await more.click()
  await page.keyboard.press('Escape')
  await expect(more).toBeFocused()

  const morph = page.getByRole('slider', { name: 'Morph' })
  await morph.focus()
  await expect(morph).toBeFocused()
  await expect(page.locator('.gesture-hint')).toHaveText('Use arrow keys to reshape')
  const outline = await page.locator('.artwork-shell').evaluate((element) => getComputedStyle(element).outlineStyle)
  expect(outline).not.toBe('none')
})

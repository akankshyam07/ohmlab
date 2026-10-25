import { expect, test } from '@playwright/test'

test('home loads with no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('./')
  await expect(page.getByRole('heading', { name: /ohmlab/i }).first()).toBeVisible()
  expect(errors).toEqual([])
})

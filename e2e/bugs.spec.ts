import { expect, lab, meter, test } from './fixtures.ts'

// Minimal repros for app bugs found by the journeys. Each is test.fixme until fixed; remove fixme to verify a fix.

// BUG-1 (S3): with the LED reversed the current meter reads "0.005 nA" (5 pA solver leakage) while the
// "Flip it" success text says "the meter reads 0". formatSI only rounds to "0" below 1e-12, and the Lab
// meter does not apply the view's 10 µA "no current" threshold. Suspect src/features/lab/Lab.tsx (meter value).
test('BUG-1: reversed LED meter reads exactly 0', async ({ page }) => {
  await page.goto('./#/lesson/first-led')
  await lab(page).getByRole('button', { name: 'Flip the LED' }).click()
  await expect(meter(page, 'Current through the loop')).toHaveText('0 A')
})

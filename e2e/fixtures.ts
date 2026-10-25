import { expect, test as base, type Locator, type Page } from '@playwright/test'

/** Every test fails on any console error or uncaught page error (TEST_PLAN journey 7). */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`)
      })
      await use(errors)
      expect(errors, 'console errors').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export const DAY1_TITLE = 'Voltage, current, resistance; your first LED'

/** "13.9 mA" → 0.0139 */
export function parseSI(text: string): number {
  const m = text.replace(/−/g, '-').match(/(-?[\d.]+)\s*([pnµumkM]?)[AVWΩ]/)
  if (!m) throw new Error(`no SI value in "${text}"`)
  const scale: Record<string, number> = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, '': 1, k: 1e3, M: 1e6 }
  return Number(m[1]) * scale[m[2]]
}

export const lab = (page: Page) => page.getByRole('region', { name: 'Circuit lab' })

export const meter = (page: Page, label: string) =>
  lab(page).getByRole('status').filter({ hasText: label }).locator('.lab-meter-value')

export const challenge = (page: Page, prompt: RegExp): Locator =>
  lab(page).locator('.lab-challenge').filter({ hasText: prompt })

/** Done in the tray list; a just-solved challenge's success text shows only in the tray's live line. */
export async function expectChallengeDone(page: Page, prompt: RegExp, success: RegExp) {
  await expect(challenge(page, prompt)).toContainText('(done)')
  await expect(lab(page).locator('.lab-tray-flash')).toContainText(success)
}

export const trayCount = (page: Page) => lab(page).locator('.lab-tray-count')

export async function pick(page: Page, group: string, option: string) {
  await lab(page).getByRole('group', { name: group }).getByRole('radio', { name: option, exact: true }).check()
}

/** Answers the Day 1 quiz; the right answers come from src/content/lessons/day01.ts. */
export async function answerDay1Quiz(page: Page) {
  const quiz = page.getByRole('region', { name: 'Quiz' })
  const answers: ({ choice: RegExp } | { numeric: string })[] = [
    { choice: /^Voltage is the push between two points/ },
    { numeric: '3 mA' },
    { numeric: '300' },
    { choice: /^It stays dark/ },
    { choice: /^Above its forward voltage/ },
    { choice: /^Nothing\. In a single loop/ },
  ]
  for (const [i, a] of answers.entries()) {
    await expect(quiz).toContainText(`Question ${i + 1} of ${answers.length}`)
    if ('choice' in a) await quiz.getByRole('radio', { name: a.choice }).check()
    else await quiz.getByRole('textbox', { name: /Your answer/ }).fill(a.numeric)
    await quiz.getByRole('button', { name: 'Check answer' }).click()
    await expect(quiz.locator('.quiz-verdict-title')).toHaveText('Correct!')
    await quiz.getByRole('button', { name: 'Next question' }).click()
  }
  await expect(quiz).toContainText('You scored 6 / 6')
}

/** Journey 1, start to finish, through the real UI. Ends on the home page. */
export async function completeDay1(page: Page) {
  await page.goto('./')
  await page.getByRole('link', { name: `Start: Day 1 — ${DAY1_TITLE}` }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(DAY1_TITLE)

  const steps = page.getByRole('navigation', { name: 'Lesson steps' })
  for (const name of [
    'Three numbers describe every circuit',
    'A circuit is a closed loop',
    'Ohm’s law',
    'Why an LED needs a resistor',
    'Quiz',
    'Build it for real',
  ])
    await expect(steps.getByRole('button', { name, exact: true })).toBeVisible()

  // Step 1 → 2, then the walkthrough highlights V1, R1, D1 in the lab.
  await expect(page.getByRole('note').filter({ hasText: 'Where the water picture breaks' })).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/#\/lesson\/first-led\/closed-loop$/)
  const walk = page.getByRole('region', { name: 'Trace the loop in the lab' })
  for (const [i, id] of ['V1', 'R1', 'D1'].entries()) {
    await walk.getByRole('button').nth(i).click()
    await expect(lab(page).locator(`[data-part="${id}"] .cv-halo`)).toHaveCount(1)
  }

  // Lab: starts at 1 kΩ, ~3 mA, nothing completed on load and only the first challenge unlocked.
  await expect(lab(page).getByRole('button', { name: 'Resistor R1, 1 kΩ' })).toBeVisible()
  await expect(trayCount(page)).toHaveText('Challenges 0 / 4')
  await expect(challenge(page, /break it!/)).toContainText('Up next')
  // Choose 220 Ω → light-safely completes.
  await expect.poll(async () => parseSI(await meter(page, 'Current through the loop').innerText())).toBeLessThan(0.004)
  await pick(page, 'Resistor R1', '220 Ω')
  await expect(lab(page).getByRole('button', { name: 'Resistor R1, 220 Ω' })).toBeVisible()
  const ma = parseSI(await meter(page, 'Current through the loop').innerText()) * 1000
  expect(ma).toBeGreaterThanOrEqual(13.5)
  expect(ma).toBeLessThanOrEqual(14.5)
  await expectChallengeDone(page, /brightly but safely/, /With 220 Ω the resistor takes about 3 V/)

  // Click the LED on the diagram to flip it: dark, 0 mA.
  await lab(page).getByRole('button', { name: /^LED D1 \(red\)/ }).click()
  await expect(lab(page).getByRole('button', { name: /^LED D1 \(red\), off/ })).toBeVisible()
  // The success text promises "the meter reads 0" (was BUG-1: "0.005 nA").
  await expect(meter(page, 'Current through the loop')).toHaveText('0 A')
  await expectChallengeDone(page, /backwards/, /Dark, and the meter reads 0/)
  const flipButton = lab(page).getByRole('button', { name: /Flip the LED/ })
  await expect(flipButton).toHaveAttribute('aria-pressed', 'true')
  await flipButton.click()
  await expect(flipButton).toHaveAttribute('aria-pressed', 'false')

  // No resistor → burnt LED with a text tag and an alert.
  await pick(page, 'Resistor R1', 'No resistor (0 Ω, sim only)')
  await expect(lab(page).getByRole('button', { name: 'LED D1 (red), burnt out' })).toBeVisible()
  await expect(lab(page).locator('[data-part="D1"]')).toContainText('BURNT')
  await expect(lab(page).getByRole('alert')).toContainText('D1 burnt out: the circuit is now open (0 A).')
  await expectChallengeDone(page, /break it!/, /Pop\./)

  // Reset restores 1 kΩ, red, not flipped.
  await lab(page).getByRole('button', { name: 'Reset circuit' }).click()
  await expect(lab(page).getByRole('group', { name: 'Resistor R1' }).getByRole('radio', { name: '1 kΩ' })).toBeChecked()
  await expect(lab(page).getByRole('group', { name: 'LED colour' }).getByRole('radio', { name: 'Red' })).toBeChecked()
  await expect(flipButton).toHaveAttribute('aria-pressed', 'false')
  await expect(lab(page).getByRole('alert')).toHaveCount(0)

  // Blue LED + 220 Ω (clicking the resistor cycles 1 kΩ → 10 kΩ → 220 Ω; "No resistor" is skipped).
  await pick(page, 'LED colour', 'Blue')
  for (let i = 0; i < 2; i++) await lab(page).getByRole('button', { name: /^Resistor R1,/ }).click()
  await expect(lab(page).getByRole('button', { name: 'Resistor R1, 220 Ω' })).toBeVisible()
  await expectChallengeDone(page, /blue/, /a blue LED gets about 9 mA/)
  await expect(trayCount(page)).toHaveText('Challenges 4 / 4')

  // Remaining sections, then the quiz.
  // Visit each step (wait for it to load): rapid repeated Next presses intentionally skip ahead.
  for (let i = 0; i < 3; i++) {
    const before = page.url()
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page).not.toHaveURL(before)
  }
  await expect(page).toHaveURL(/#\/lesson\/first-led\/quiz$/)
  await answerDay1Quiz(page)
  expect(await page.locator('.toast').count()).toBeLessThanOrEqual(2)

  // Build step, then Next leaves the lesson.
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/#\/lesson\/first-led\/build$/)
  await expect(page.getByRole('note').filter({ hasText: 'without a resistor' })).toBeVisible()
  await expect(page.locator('.build').getByRole('group', { name: 'To complete this lesson' })).toContainText('Lesson complete')
  await expect(page.getByRole('img', { name: 'Mastery 100 %' })).toBeVisible()

  // The last step's Next goes to the next available lesson (FEATURE_SPEC F4 AC4).
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page).toHaveURL(/#\/lesson\/ohms-law$/)
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText(DAY1_TITLE)
  await expect(page.locator('.eyebrow').first()).toContainText('Day 2')

  await page.getByRole('link', { name: 'Ohmlab home' }).click()
  await expect(page.getByRole('heading', { name: 'Ohmlab', level: 1 })).toBeVisible()
}

export async function expectDay1CompleteOnHome(page: Page) {
  const day1 = page.getByRole('link', { name: `Day 1: ${DAY1_TITLE}` })
  await expect(day1).toHaveAccessibleDescription('Complete')
  await expect(page.getByRole('link', { name: /^Continue: Day 2 — / })).toBeVisible()
  const stats = page.getByRole('region', { name: 'Your progress' })
  await expect(stats.locator('.stat').filter({ hasText: 'Lessons completed' })).toContainText(/^Lessons completed1/)
}

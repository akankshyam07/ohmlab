import { DAY1_TITLE, completeDay1, expect, expectDay1CompleteOnHome, lab, test } from './fixtures.ts'

test('J1: first visit → Day 1 complete', async ({ page }) => {
  await completeDay1(page)
  await expectDay1CompleteOnHome(page)
})

test('J2: progress survives a reload', async ({ page }) => {
  await completeDay1(page)
  await page.reload()
  await expectDay1CompleteOnHome(page)
  const ach = page.getByRole('region', { name: 'Achievements' })
  for (const title of ['First Light', "Ohm's Apprentice", 'Perfect Circuit', 'Magic Smoke'])
    await expect(ach.getByRole('listitem').filter({ hasText: title })).toContainText('(unlocked)')

  await page.getByRole('link', { name: `Day 1: ${DAY1_TITLE}` }).click()
  await expect(page.getByRole('img', { name: 'Mastery 100 %' })).toBeVisible()
  for (const prompt of [/brightly but safely/, /backwards/, /break it!/, /blue/])
    await expect(lab(page).locator('.lab-challenge').filter({ hasText: prompt })).toContainText('(done)')
})

test('J3: deep link renders the quiz step', async ({ page }) => {
  await page.goto('./#/lesson/voltage-divider/quiz')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Voltage dividers')
  await expect(page.getByRole('region', { name: 'Quiz' })).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Lesson steps' }).getByRole('button', { name: 'Quiz', exact: true }),
  ).toHaveAttribute('aria-current', 'step')
})

test('J4: settings persist and reset clears progress', async ({ page }) => {
  // Make some progress first so the reset has something to clear.
  await page.goto('./#/lesson/first-led')
  await expect(lab(page)).toBeVisible()
  await page.goto('./')
  await expect(page.getByRole('link', { name: `Day 1: ${DAY1_TITLE}` })).toHaveAccessibleDescription(/In progress/)

  await page.getByRole('link', { name: 'Settings' }).click()
  const animate = page.getByRole('checkbox', { name: 'Animate current flow' })
  await expect(animate).toBeChecked()
  await animate.uncheck()
  await page.reload()
  await expect(animate).not.toBeChecked()

  await page.getByRole('button', { name: 'Reset progress' }).click()
  const dialog = page.getByRole('dialog', { name: 'Reset all progress?' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Yes, reset everything' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Progress reset' })).toBeVisible()

  await page.getByRole('link', { name: 'Learn' }).click()
  await expect(page.getByRole('link', { name: `Day 1: ${DAY1_TITLE}` })).toHaveAccessibleDescription('Not started')
  await expect(page.getByRole('link', { name: `Start: Day 1 — ${DAY1_TITLE}` })).toBeVisible()
})

test('J5: unknown route shows the 404 with a way home', async ({ page }) => {
  await page.goto('./#/nope')
  await expect(page.getByRole('heading', { name: 'Nothing is connected here' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to the map' }).click()
  await expect(page.getByRole('heading', { name: 'Ohmlab', level: 1 })).toBeVisible()
})

test('J6: on a phone the lab stage is visible and not covered', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile project only')
  await page.goto('./#/lesson/first-led')
  const figure = lab(page).getByRole('figure')
  await figure.scrollIntoViewIfNeeded()
  await expect(figure).toBeInViewport()
  const box = (await figure.boundingBox())!
  // Sample points across the diagram: each must hit the diagram itself, not an overlay (top bar, toasts…).
  for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]]) {
    const [x, y] = [box.x + box.width * fx, box.y + box.height * fy]
    const inside = await page.evaluate(`!!document.elementFromPoint(${x}, ${y})?.closest('.lab-stage')`)
    expect(inside, `point ${fx},${fy} of the diagram is covered`).toBe(true)
  }
})

for (const [name, path] of [
  ['home', './'],
  ['lesson', './#/lesson/first-led'],
  ['lesson quiz', './#/lesson/first-led/quiz'],
]) {
  test(`J6: no horizontal scroll at 320 px — ${name}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 })
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
    const { scrollWidth, clientWidth } = await page.evaluate<{ scrollWidth: number; clientWidth: number }>(
      '({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })',
    )
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
  })
}

test('J7: every route renders with no console errors', async ({ page }) => {
  await page.goto('./')
  const lessonHrefs = await page
    .getByRole('link', { name: /^Day \d+: / })
    .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''))
  expect(lessonHrefs.length).toBeGreaterThanOrEqual(6)
  for (const href of lessonHrefs) {
    await page.goto('./' + href)
    await expect(page.locator('main h1')).toBeVisible()
    const steps = page.getByRole('navigation', { name: 'Lesson steps' }).getByRole('button')
    const count = await steps.count()
    for (let i = 0; i < count; i++) {
      await steps.nth(i).click()
      await expect(steps.nth(i)).toHaveAttribute('aria-current', 'step')
    }
  }
  for (const path of ['#/achievements', '#/settings', '#/nope']) {
    await page.goto('./' + path)
    await expect(page.locator('main h1')).toBeVisible()
  }
  // the auto fixture in fixtures.ts fails the test on any console error collected above
})

test('Reduced motion: no CSS animations run in the lab', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./#/lesson/first-led/closed-loop')
  await expect(lab(page)).toBeVisible()
  // Exercise the parts that animate with motion on: current flow, highlight halo, a burnt LED, a new challenge.
  await page.getByRole('region', { name: 'Trace the loop in the lab' }).getByRole('button').first().click()
  await lab(page).getByRole('radio', { name: '220 Ω', exact: true }).check()
  await lab(page).getByRole('radio', { name: 'No resistor (0 Ω, sim only)' }).check()
  await expect(lab(page).getByRole('alert')).toBeVisible()
  await page.waitForTimeout(300) // let 0.01 ms reduced-motion transitions finish
  const running = await page.evaluate(`document.getAnimations()
    .filter((a) => a.playState === 'running' && a.effect?.target?.closest('.lab'))
    .map((a) => (a.animationName ?? a.constructor.name) + ' on .' + a.effect.target.getAttribute('class'))`)
  expect(running).toEqual([])
})

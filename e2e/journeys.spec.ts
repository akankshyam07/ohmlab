import { DAY1_TITLE, answerDay1Quiz, completeDay1, expect, expectDay1CompleteOnHome, lab, test } from './fixtures.ts'

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

test('J6: on a phone the sticky mini-stage stays visible and uncovered while the text scrolls', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'mobile project only')
  await page.goto('./#/lesson/first-led/why-resistor')
  const stage = page.locator('.lesson-stage')
  const figure = lab(page).getByRole('figure')

  const expectUncovered = async () => {
    await expect(figure).toBeInViewport()
    const f = (await figure.boundingBox())!
    const st = (await stage.boundingBox())!
    // Nothing outside the stage (top bar, step text, toasts) overlaps the visible part of the diagram.
    // ponytail: in-stage overlays such as the compact Reset button are by design; the parts check below covers them.
    const top = Math.max(f.y, st.y, 0)
    const bottom = Math.min(f.y + f.height, st.y + st.height)
    expect(bottom - top, 'visible diagram height').toBeGreaterThan(80)
    for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.2], [0.85, 0.2], [0.15, 0.8], [0.85, 0.8]]) {
      const [x, y] = [f.x + f.width * fx, top + (bottom - top) * fy]
      const hit = await page.evaluate(
        `(() => { const el = document.elementFromPoint(${x}, ${y}); return el?.closest('.lesson-stage') ? 'stage' : (el?.outerHTML ?? 'nothing').slice(0, 120) })()`,
      )
      expect(hit, `point ${fx},${fy} of the diagram (${Math.round(x)}, ${Math.round(y)}) is covered`).toBe('stage')
    }
    // Every clickable part is visible and its centre hits that part.
    const parts = figure.locator('[data-part][role="button"]')
    expect(await parts.count()).toBeGreaterThan(0)
    for (const part of await parts.all()) {
      const id = await part.getAttribute('data-part')
      const p = (await part.boundingBox())!
      const [x, y] = [p.x + p.width / 2, p.y + p.height / 2]
      expect(y, `${id} centre is inside the stage`).toBeGreaterThan(top)
      expect(y).toBeLessThan(bottom)
      const hitId = await page.evaluate(`document.elementFromPoint(${x}, ${y})?.closest('[data-part]')?.getAttribute('data-part') ?? null`)
      expect(hitId, `${id} is covered`).toBe(id)
    }
  }

  await expectUncovered()
  // Scroll the step text under the stage: once stuck, the stage stays pinned just under the top bar.
  const barBottom = (await page.locator('.topbar').boundingBox())!.height
  await page.mouse.wheel(0, 600)
  await expect.poll(() => page.evaluate('window.scrollY')).toBeGreaterThan(300)
  await expect.poll(async () => Math.abs((await stage.boundingBox())!.y - barBottom)).toBeLessThanOrEqual(2)
  await expectUncovered()
  const scrolled = await page.evaluate<number>('window.scrollY')
  await page.mouse.wheel(0, 500)
  await expect.poll(() => page.evaluate('window.scrollY')).toBeGreaterThan(scrolled + 200)
  expect(Math.abs((await stage.boundingBox())!.y - barBottom)).toBeLessThanOrEqual(2)
  await expectUncovered()

  const hide = page.getByRole('button', { name: 'Hide circuit' })
  await expect(hide).toHaveAttribute('aria-expanded', 'true')
  await hide.click()
  const show = page.getByRole('button', { name: 'Show circuit' })
  await expect(show).toHaveAttribute('aria-expanded', 'false')
  await expect(figure).toBeHidden()
  await show.click()
  await expect(page.getByRole('button', { name: 'Hide circuit' })).toHaveAttribute('aria-expanded', 'true')
  await expectUncovered()

  // Short stage: alerts are one-line chips with More/Less.
  await lab(page).getByRole('radio', { name: 'No resistor (0 Ω, sim only)' }).check()
  const alert = lab(page).getByRole('alert')
  const more = alert.getByRole('button', { name: 'More' })
  await expect(more).toBeVisible()
  await expect(more).toHaveAttribute('aria-expanded', 'false')
  await more.click()
  await expect(alert.getByRole('button', { name: 'Less' })).toHaveAttribute('aria-expanded', 'true')
  const scrollWidth = await page.evaluate('document.documentElement.scrollWidth - document.documentElement.clientWidth')
  expect(scrollWidth).toBeLessThanOrEqual(0)
})

test('Day 1: clicking R1 never selects "No resistor"', async ({ page }) => {
  await page.goto('./#/lesson/first-led')
  const r1 = lab(page).getByRole('button', { name: /^Resistor R1,/ })
  const noResistor = lab(page).getByRole('radio', { name: 'No resistor (0 Ω, sim only)' })
  const seen: string[] = []
  for (let i = 0; i < 7; i++) {
    await r1.click()
    seen.push((await r1.getAttribute('aria-label'))!)
    await expect(noResistor).not.toBeChecked()
  }
  expect(seen.slice(0, 3)).toEqual(['Resistor R1, 10 kΩ', 'Resistor R1, 220 Ω', 'Resistor R1, 1 kΩ'])
  expect(seen.join()).not.toContain('no resistor')
  await expect(lab(page).getByRole('alert')).toHaveCount(0)
})

test('Day 1: challenges unlock in order and only on the learner\'s own moves', async ({ page }) => {
  await page.goto('./#/lesson/first-led')
  const count = lab(page).locator('.lab-tray-count')
  await expect(count).toHaveText('Challenges 0 / 4')
  await expect(lab(page).locator('.lab-tray-summary')).toContainText('Next: Light the LED brightly but safely')
  // Burning the LED before reaching "Break it!" does not tick it off.
  await lab(page).getByRole('radio', { name: 'No resistor (0 Ω, sim only)' }).check()
  await expect(lab(page).getByRole('alert')).toBeVisible()
  await lab(page).getByRole('radio', { name: '220 Ω', exact: true }).check()
  await expect(count).toHaveText('Challenges 1 / 4')
  const burn = lab(page).locator('.lab-challenge').filter({ hasText: /break it!/ })
  await expect(burn).not.toContainText('(done)')
  await expect(burn).toContainText('Up next')
  // A reload restores the done challenge but completes nothing new.
  await page.reload()
  await expect(count).toHaveText('Challenges 1 / 4')
})

test('Day 1: a predict card reveals the why and the try-it text', async ({ page }) => {
  await page.goto('./#/lesson/first-led/ohms-law')
  const card = page.locator('.blk-predict')
  const lock = card.getByRole('button', { name: 'Lock in my guess' })
  await expect(lock).toBeDisabled()
  await card.getByRole('radio', { name: /about a tenth of the current/ }).check()
  await lock.click()
  await expect(lock).toBeHidden()
  await expect(card).toContainText('Good call.')
  await expect(card).toContainText('Ten times the resistance, a tenth of the current.')
  await expect(card).toContainText('Try it in the lab:')
  await expect(card.getByRole('radio').first()).toBeDisabled()
})

test('Quiz: options are chosen by text and a pass with unfinished challenges says what is left', async ({ page }) => {
  await page.goto('./#/lesson/first-led/quiz')
  await answerDay1Quiz(page)
  await expect(page.getByRole('region', { name: 'Quiz' })).toContainText(
    'To finish this lesson, complete the lab challenges: 0 / 4 done',
  )
  await expect(page.getByRole('group', { name: 'To complete this lesson' })).toContainText('best 100 %')
})

test('Lesson checklist: "Go to challenges" opens the challenge tray', async ({ page }) => {
  await page.goto('./#/lesson/first-led')
  await page.getByRole('group', { name: 'To complete this lesson' }).getByRole('button', { name: 'Go to challenges' }).click()
  await expect(lab(page).locator('.lab-tray-details')).toHaveAttribute('open', '')
  await expect(lab(page).locator('.lab-tray-summary')).toBeFocused()
})

test('Burnt-part alert links to "How the simulator works"', async ({ page }) => {
  await page.goto('./#/lesson/first-led')
  await lab(page).getByRole('radio', { name: 'No resistor (0 Ω, sim only)' }).check()
  const alert = lab(page).getByRole('alert')
  const more = alert.getByRole('button', { name: 'More' })
  if (await more.isVisible()) await more.click()
  await alert.getByRole('button', { name: 'How the simulator works' }).click()
  await expect(lab(page).locator('.lab-about')).toHaveAttribute('open', '')
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

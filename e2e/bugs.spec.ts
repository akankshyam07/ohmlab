import { expect, test } from './fixtures.ts'

// Regressions for app bugs found by the journeys.

// REVIEW #17: leaving the quiz mid-way (lesson Next/Back) must not restart it. Quiz place lives in
// sessionStorage, so the lesson button stays enabled as "Skip quiz" and learners can peek ahead.
test('quiz resumes where you left it after leaving the step', async ({ page }) => {
  await page.goto('./#/lesson/first-led/quiz')
  const quiz = page.getByRole('region', { name: 'Quiz' })
  await expect(quiz).toContainText('Question 1 of 6')
  await quiz.getByRole('radio').first().check()
  await quiz.getByRole('button', { name: 'Check answer' }).click()
  await quiz.getByRole('button', { name: 'Next question' }).click()
  await expect(quiz).toContainText('Question 2 of 6')

  // Mid-quiz the lesson button reads "Skip quiz".
  await page.getByRole('button', { name: 'Skip quiz', exact: true }).click()
  await expect(page).toHaveURL(/\/build$/)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Quiz' })).toContainText('Question 2 of 6')
})

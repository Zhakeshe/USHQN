import { test, expect } from '@playwright/test'

const email = process.env.E2E_EMAIL ?? ''
const password = process.env.E2E_PASSWORD ?? ''
const hasLoginCreds = Boolean(email && password)

/** Full suite is skipped without creds so local `npm run test:e2e` does not launch Chromium. */
const describeCritical = hasLoginCreds ? test.describe : test.describe.skip

describeCritical('critical path', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => {
      localStorage.setItem('ushqn_lang', 'en')
    })
  })

  test('login → apply on a job → chat → send message', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email', { exact: true }).fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByRole('button', { name: /Sign in/ }).click()
    await expect(page).toHaveURL(/\/home/, { timeout: 45_000 })

    await page.goto('/jobs')
    await expect(page.getByRole('heading', { name: /Jobs/i })).toBeVisible({ timeout: 30_000 })

    const applyButtons = page.getByRole('button', { name: /Apply/ })
    const n = await applyButtons.count()
    test.skip(
      n === 0,
      'Need at least one vacancy posted by another user so the “Apply” button is visible (not your own listing).',
    )

    await applyButtons.first().click()
    await expect(page).toHaveURL(/\/chat\/[0-9a-f-]+/i, { timeout: 30_000 })

    const body = `e2e-${Date.now()}`
    const input = page.getByPlaceholder('Write a message…')
    await input.fill(body)
    await input.press('Enter')
    await expect(page.getByText(body, { exact: true })).toBeVisible({ timeout: 15_000 })
  })
})

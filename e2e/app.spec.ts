import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function signInAsGuest(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /guest/i }).click()
  await page.getByRole('button', { name: /Get started/ }).click()
  await expect(page.getByTestId('current-user')).toContainText('Guest')
}

test.describe('Portfolio Watcher', () => {
  test('shows the login options', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: /Microsoft/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Google/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /guest/i })).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/login.png', fullPage: true })
  })

  test('signs in with Microsoft in demo mode', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /Microsoft/ }).click()
    await page.getByRole('button', { name: /Get started/ }).click()
    await expect(page.getByTestId('current-user')).toContainText('Microsoft Demo User')
  })

  test('adds a ticker, shows its movement and alerts', async ({ page }) => {
    await signInAsGuest(page)
    await expect(page.getByTestId('watchlist-empty')).toBeVisible()

    await page.getByLabel('Ticker symbol').fill('MSFT')
    await page.getByLabel('Alert on dip %').fill('1')
    await page.getByLabel('Alert on rise %').fill('1')
    await page.getByLabel('Email address').fill('trader@example.com')
    await page.getByRole('button', { name: 'Add to watchlist' }).click()

    const card = page.getByTestId('ticker-MSFT')
    await expect(card).toBeVisible()
    await expect(card.getByRole('img', { name: 'MSFT price movement' })).toBeVisible()
    await expect(card.getByRole('status')).toBeVisible()
    await page.screenshot({ path: 'test-results/screenshots/watchlist.png', fullPage: true })

    await card.getByRole('button', { name: /Remove MSFT/ }).click()
    await expect(page.getByTestId('watchlist-empty')).toBeVisible()
  })

  test('validates the ticker form', async ({ page }) => {
    await signInAsGuest(page)
    await page.getByLabel('Ticker symbol').fill('123')
    await page.getByRole('button', { name: 'Add to watchlist' }).click()
    await expect(page.getByRole('alert')).toContainText('valid ticker symbol')
  })

  test('supports SMS and WhatsApp channels', async ({ page }) => {
    await signInAsGuest(page)
    await page.getByRole('checkbox', { name: 'Email' }).uncheck()
    await page.getByRole('checkbox', { name: 'SMS' }).check()
    await page.getByRole('checkbox', { name: 'WhatsApp' }).check()
    await page.getByLabel('Ticker symbol').fill('TSLA')
    await page.getByLabel('Phone number').fill('+15551234567')
    await page.getByRole('button', { name: 'Add to watchlist' }).click()
    const card = page.getByTestId('ticker-TSLA')
    await expect(card.getByText('SMS')).toBeVisible()
    await expect(card.getByText('WhatsApp')).toBeVisible()
  })

  test('toggles the dark theme and persists it', async ({ page }) => {
    await signInAsGuest(page)
    await page.getByTestId('theme-toggle').click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.screenshot({ path: 'test-results/screenshots/dark-theme.png', fullPage: true })
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })

  test('persists the watchlist across reloads and logs out', async ({ page }) => {
    await signInAsGuest(page)
    await page.getByLabel('Ticker symbol').fill('AAPL')
    await page.getByLabel('Email address').fill('trader@example.com')
    await page.getByRole('button', { name: 'Add to watchlist' }).click()
    await expect(page.getByTestId('ticker-AAPL')).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('ticker-AAPL')).toBeVisible()

    await page.getByRole('button', { name: 'Log out' }).click()
    await expect(page.getByRole('button', { name: /guest/i })).toBeVisible()
  })

  test('has no horizontal overflow on mobile viewports', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 })
    await signInAsGuest(page)
    await page.getByLabel('Ticker symbol').fill('NVDA')
    await page.getByLabel('Email address').fill('trader@example.com')
    await page.getByRole('button', { name: 'Add to watchlist' }).click()
    await expect(page.getByTestId('ticker-NVDA')).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    await page.screenshot({ path: 'test-results/screenshots/mobile.png', fullPage: true })
  })
})

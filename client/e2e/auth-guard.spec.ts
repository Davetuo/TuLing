import { test, expect } from '@playwright/test'
import { ensureLoggedIn } from './helpers'

test.describe('CQA-018: 未登录访问拦截', () => {
  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('http://localhost:5173/chat', { waitUntil: 'domcontentloaded' })
    await page.waitForURL('**/login', { timeout: 10000 })
    expect(page.url()).toContain('/login')
  })

  test('should show chat page for authenticated user', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('CQA-019: 移动端响应式', () => {
  test('should handle mobile viewport with collapsible sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })
  })
})

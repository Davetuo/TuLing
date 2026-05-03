import { test, expect } from '@playwright/test'
import { ensureLoggedIn } from './helpers'

test.describe('CQA-001: 新建对话', () => {
  test('should create new session and show welcome area', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("新建对话")')
    await expect(page.locator('.welcome-area')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.rec-card')).toHaveCount(6, { timeout: 5000 })
  })
})

test.describe('CQA-003: 发送消息获得AI流式回复', () => {
  test('should send message and receive streaming reply', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("新建对话")')
    await page.fill('textarea', '帮我推荐一个周末去杭州的行程')
    await page.click('.send-btn')

    await expect(page.locator('.message-row.user')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.message-row.assistant').first()).toBeVisible({ timeout: 30000 })
    await expect(page.locator('textarea')).toBeDisabled()
  })
})

test.describe('CQA-004: 空内容拦截', () => {
  test('should block empty message submission', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })
    await page.click('button:has-text("新建对话")')

    await page.fill('textarea', '')
    await expect(page.locator('.send-btn')).toBeDisabled()

    await page.fill('textarea', '   ')
    await expect(page.locator('.send-btn')).toBeDisabled()
  })
})

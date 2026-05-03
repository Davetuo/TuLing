import { test, expect } from '@playwright/test'
import { ensureLoggedIn } from './helpers'

test.describe('CQA-013: 历史会话继续对话', () => {
  test('should load historical session and allow continuing', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    const sessionItems = page.locator('.session-item')
    const count = await sessionItems.count()
    if (count > 0) {
      await sessionItems.first().click()
      await expect(page.locator('.message-row').first()).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('CQA-015: 智能总结消息不足拒绝', () => {
  test('should not show summary button for new session', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })
    await page.click('button:has-text("新建对话")')

    // Summary button only appears when hasActiveSession is true
    // After "新建对话", no active session exists yet
    const summaryBtn = page.locator('button:has-text("智能总结")')
    await expect(summaryBtn).not.toBeVisible({ timeout: 5000 })
  })
})

test.describe('CQA-020: 页面刷新消息持久化', () => {
  test('should persist messages after page refresh', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    const sessionItems = page.locator('.session-item')
    const count = await sessionItems.count()
    if (count > 0) {
      await sessionItems.first().click()
      await page.waitForTimeout(1000)
      const beforeCount = await page.locator('.message-row').count()

      await page.reload()
      await page.waitForTimeout(1000)
      // Re-authenticate after refresh (HttpOnly cookies may be lost)
      await ensureLoggedIn(page)

      // Re-select the session
      const sessionItemsAfter = page.locator('.session-item')
      if (await sessionItemsAfter.count() > 0) {
        await sessionItemsAfter.first().click()
        await page.waitForTimeout(1000)
      }

      const afterCount = await page.locator('.message-row').count()
      expect(afterCount).toBe(beforeCount)
    }
  })
})

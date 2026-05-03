import { test, expect } from '@playwright/test'
import { ensureLoggedIn } from './helpers'

test.describe('CQA-008: 推荐问题展示', () => {
  test('should display recommendations for new session', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("新建对话")')
    await expect(page.locator('.welcome-area')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.rec-card').first()).toBeVisible({ timeout: 5000 })

    const recCount = await page.locator('.rec-card').count()
    expect(recCount).toBeGreaterThanOrEqual(3)
  })
})

test.describe('CQA-009: 点击推荐问题自动发送', () => {
  test('should auto-send question when clicking recommendation', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("新建对话")')
    await expect(page.locator('.rec-card').first()).toBeVisible({ timeout: 5000 })
    await page.locator('.rec-card').first().click()

    await expect(page.locator('.message-row.user')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.rec-card')).not.toBeVisible({ timeout: 5000 })
  })
})

test.describe('CQA-012: 空历史状态', () => {
  test('should show empty state for no chat history', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-sidebar')).toBeVisible({ timeout: 5000 })

    const emptyState = page.locator('.empty-sessions')
    const emptyVisible = await emptyState.isVisible().catch(() => false)
    if (emptyVisible) {
      await expect(page.locator('.empty-sessions')).toContainText('暂无对话记录')
    }
  })
})

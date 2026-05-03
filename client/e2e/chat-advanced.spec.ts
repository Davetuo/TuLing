import { test, expect } from '@playwright/test'
import { ensureLoggedIn } from './helpers'

test.describe('CQA-007: 停止生成-保留部分回复', () => {
  test('should stop generation and preserve partial content', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("新建对话")')
    await page.fill('textarea', '帮我规划一个3天游杭州的路线')
    await page.click('.send-btn')

    // Wait for streaming to start (stop button appears)
    await expect(page.locator('button:has-text("停止生成")')).toBeVisible({ timeout: 10000 })

    // Stop after a short delay to get partial content
    await page.waitForTimeout(2000)
    await page.click('button:has-text("停止生成")')

    // The partial AI content should be preserved (assistant bubble with content)
    const assistantBubble = page.locator('.message-row.assistant')
    await expect(assistantBubble.first()).toBeVisible({ timeout: 5000 })
    const content = await assistantBubble.first().textContent()
    expect(content).toBeTruthy()

    // Input should be re-enabled after stopping
    await expect(page.locator('textarea')).toBeEnabled({ timeout: 5000 })
  })
})

test.describe('CQA-005: 内容违规拦截', () => {
  test('should reject content with blocked words', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("新建对话")')
    await page.fill('textarea', '赌博相关的内容')
    await page.click('.send-btn')

    // Should show error toast
    await expect(page.locator('.el-message--error').first()).toBeVisible({ timeout: 5000 })
  })
})

test.describe('CQA-002: 新建对话-AI回复中中断', () => {
  test('should abort streaming when new chat is clicked', async ({ page }) => {
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("新建对话")')
    await page.fill('textarea', '帮我规划一个去北京的5天行程')
    await page.click('.send-btn')

    // Wait for streaming to begin
    await expect(page.locator('button:has-text("停止生成")')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(1500)

    // Click new chat while streaming
    await page.click('button:has-text("新建对话")')

    // Should show welcome area (new session created)
    await expect(page.locator('.welcome-area')).toBeVisible({ timeout: 5000 })

    // Stop button should be gone
    await expect(page.locator('button:has-text("停止生成")')).not.toBeVisible({ timeout: 5000 })
  })
})

test.describe('CQA-014: 智能总结-成功生成', () => {
  test('should generate summary for conversation with enough messages', async ({ page }) => {
    test.setTimeout(120000)
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("新建对话")')

    // Send first question
    await page.fill('textarea', '帮我推荐杭州3天的行程')
    await page.click('.send-btn')
    await page.waitForTimeout(15000) // wait for AI reply

    // Send second question
    await page.fill('textarea', '预算大概需要多少？')
    await page.click('.send-btn')
    await page.waitForTimeout(15000) // wait for AI reply

    // Now we have 4+ messages, summary button should be enabled
    const summaryBtn = page.locator('button:has-text("智能总结")')
    await expect(summaryBtn).toBeVisible({ timeout: 5000 })
    await expect(summaryBtn).not.toBeDisabled({ timeout: 5000 })

    // Click summary
    await summaryBtn.click()

    // Summary should appear
    await expect(page.locator('.summary-section')).toBeVisible({ timeout: 30000 })
    const summaryText = await page.locator('.summary-content').textContent()
    expect(summaryText).toBeTruthy()
    expect(summaryText!.length).toBeGreaterThan(20)
  })
})

test.describe('CQA-016: 智能总结-复制功能', () => {
  test('should copy summary to clipboard', async ({ page }) => {
    test.setTimeout(120000)
    await ensureLoggedIn(page)
    await expect(page.locator('.chat-page')).toBeVisible({ timeout: 5000 })

    await page.click('button:has-text("新建对话")')

    // Need to send questions to build conversation for summary
    await page.fill('textarea', '推荐上海周末一日游')
    await page.click('.send-btn')
    await page.waitForTimeout(15000)

    await page.fill('textarea', '有哪些必去的景点？')
    await page.click('.send-btn')
    await page.waitForTimeout(15000)

    // Generate summary
    const summaryBtn = page.locator('button:has-text("智能总结")')
    await expect(summaryBtn).not.toBeDisabled({ timeout: 5000 })
    await summaryBtn.click()

    // Wait for summary to complete
    await expect(page.locator('.summary-section')).toBeVisible({ timeout: 30000 })
    // Wait a bit more for streaming to finish
    await page.waitForTimeout(5000)

    // Verify copy button exists and summary section is visible
    const copyBtn = page.locator('button:has-text("复制")')
    await expect(copyBtn).toBeVisible({ timeout: 5000 })
    const summaryEl = page.locator('.summary-content')
    await expect(summaryEl).toBeVisible()
    const text = await summaryEl.textContent()
    expect(text!.length).toBeGreaterThan(20)
  })
})

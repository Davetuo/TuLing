import { Page } from '@playwright/test'

export async function ensureLoggedIn(page: Page) {
  // Authenticate via API to get cookies
  const loginResp = await page.request.post('http://localhost:3000/api/auth/login', {
    data: { account: 'test@example.com', password: 'Test123456' },
  })

  if (loginResp.ok()) {
    // Extract Set-Cookie headers and apply them
    const setCookieHeaders = loginResp.headers()['set-cookie']
    if (setCookieHeaders) {
      const cookies = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders]
      for (const cookieStr of cookies) {
        const [nameValue] = cookieStr.split(';')
        const [name, value] = nameValue.split('=')
        await page.context().addCookies([{
          name,
          value,
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax' as const,
        }])
      }
    }
  }

  // Navigate to chat page
  await page.goto('http://localhost:5173/chat')
  await page.waitForLoadState('networkidle')
}

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../openqa/changes/chg-20260502-测试注册与登录模块的完整流程/test_scripts',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
});

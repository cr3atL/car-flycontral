import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', channel: 'msedge', headless: true, viewport: { width: 1280, height: 720 }, screenshot: 'only-on-failure' },
});

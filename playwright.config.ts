import { defineConfig, devices } from '@playwright/test'

const base = process.env.BASE_PATH ?? '/'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Each worker is a full Chromium; more than a few starves the animated pages on a busy dev machine.
  workers: process.env.CI ? undefined : 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:4791${base}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4791 --strictPort',
    url: `http://localhost:4791${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})

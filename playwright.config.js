import { defineConfig, devices } from '@playwright/test';

// Smoke tests against the production build: the service worker (offline) only exists there.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    ...devices['Pixel 7'], // the app is built for phones
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});

import { defineConfig, devices } from '@playwright/test';

const PREVIEW_PORT = '4173';
const deployedUrl = process.env.BASE_URL;
const baseURL = (
  deployedUrl ?? `http://localhost:${PREVIEW_PORT}/tunadao-relatorios/`
).replace(/\/?$/, '/');

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  ...(deployedUrl
    ? {}
    : {
        webServer: {
          command: `npm run build && npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }),
});

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4175',
    browserName: 'chromium',
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 4175 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 15_000
  }
});

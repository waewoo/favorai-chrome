import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = __dirname;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/tmp-user-data-*/**', '**/tmp-user-data-*'],
  timeout: 60000,  // 60s — each test spawns a Chrome instance with extension load
  retries: 1,      // 1 automatic retry for transient launch/timing failures
  workers: 2,      // Limit concurrent Chrome instances to reduce resource contention
  use: {
    headless: false, // Extensions require non-headless mode
  },
  projects: [
    {
      name: 'chrome-extension',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            '--no-sandbox'
          ]
        }
      }
    }
  ],
  reporter: [['html', { outputFolder: 'playwright-report' }]]
});

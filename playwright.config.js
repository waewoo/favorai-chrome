import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// Suppress Node.js deprecation warnings (e.g., DEP0205 module.register) in Playwright and its workers
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --no-deprecation`.trim();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = __dirname;

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: ['**/tmp-user-data-*/**', '**/tmp-user-data-*'],
  timeout: 60000,  // 60s — each test spawns a Chrome instance with extension load
  retries: 1,      // 1 retry to handle timing fluctuations under load
  workers: process.env.PLAYWRIGHT_WORKERS ? parseInt(process.env.PLAYWRIGHT_WORKERS) : (process.env.CI ? 2 : 4),      // Optimized to 4 workers locally to prevent CPU lockup while maintaining speed
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

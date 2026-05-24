import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = __dirname;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
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

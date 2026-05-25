import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '../../');

test('Extension popup loads successfully', async () => {
  // Create a temporary user data directory for the persistent context
  const tmpDir = path.join(extensionPath, 'tests/e2e/tmp-user-data-' + Date.now());
  
  const context = await chromium.launchPersistentContext(tmpDir, {
    headless: false, // Force false so Playwright uses standard Chromium launcher, but pass --headless=new in args
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--headless=new' // Force new headless mode to support extensions without GUI
    ]
  });

  try {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 });
    }

    const extensionId = background.url().split('/')[2];

    const page = await context.newPage();
    // Open the extension popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Assert that h1 contains 'FavorAI'
    const title = page.locator('h1');
    await expect(title).toHaveText('FavorAI');

    // Assert that minimal and complete reorganization buttons are present
    const minBtn = page.locator('#btnMinReorg');
    const fullBtn = page.locator('#btnFullReorg');
    await expect(minBtn).toBeVisible();
    await expect(fullBtn).toBeVisible();
  } finally {
    await context.close();
    // Clean up temporary user data directory
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
});

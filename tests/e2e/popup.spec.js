import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '../../');

test('Extension popup loads successfully', async ({ page, context }) => {
  let [background] = context.serviceWorkers();
  if (!background) {
    background = await context.waitForEvent('serviceworker');
  }

  const extensionId = background.url().split('/')[2];
  
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
});

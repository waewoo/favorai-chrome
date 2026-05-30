import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

test('Extension popup loads successfully', async () => {
  const { context, page, extensionId, tmpDir } = await launchExtension();

  try {
    await gotoPopup(page, extensionId);

    // Assert that h1 contains 'FavorAI'
    const title = page.locator('h1');
    await expect(title).toHaveText('FavorAI');

    // Navigate to Rangement tab to access reorganization buttons
    const tabRangementBtn = page.locator('#tabRangementBtn');
    await tabRangementBtn.click();

    // Wait for the Rangement tab panel to be visible
    const tabRangementPanel = page.locator('#tabRangementPanel');
    await expect(tabRangementPanel).toBeVisible();

    // Assert that minimal and complete reorganization buttons are present
    const minBtn = page.locator('#btnMinReorg');
    const fullBtn = page.locator('#btnFullReorg');
    await expect(minBtn).toBeVisible();
    await expect(fullBtn).toBeVisible();
  } finally {
    await cleanup(context, tmpDir);
  }
});

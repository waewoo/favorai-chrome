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

    // Assert launch button and mode radios are present
    const launchBtn = page.locator('#btnLaunch');
    await expect(launchBtn).toBeVisible();
    await expect(page.locator('input[name="reorgMode"][value="minimal"]')).toBeVisible();
    await expect(page.locator('input[name="reorgMode"][value="complete"]')).toBeVisible();
  } finally {
    await cleanup(context, tmpDir);
  }
});

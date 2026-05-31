import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

test.describe('Tabs Navigation', () => {
  test('should display all main tabs', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      // Check all tab buttons exist
      const tabRangement = page.locator('#tabRangementBtn');
      const tabConfig = page.locator('#tabConfigBtn');
      const tabHistory = page.locator('#tabHistoryBtn');
      const tabForgotten = page.locator('#tabForgottenBtn');

      await expect(tabRangement).toBeVisible();
      await expect(tabConfig).toBeVisible();
      await expect(tabHistory).toBeVisible();
      await expect(tabForgotten).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should switch to Rangement tab', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabRangementBtn = page.locator('#tabRangementBtn');
      const tabRangementPanel = page.locator('#tabRangementPanel');

      await tabRangementBtn.click();
      await expect(tabRangementPanel).toBeVisible();

      // Check for Rangement content
      const minBtn = page.locator('#btnMinReorg');
      const fullBtn = page.locator('#btnFullReorg');
      await expect(minBtn).toBeVisible();
      await expect(fullBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should switch to Configuration tab', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabConfigBtn = page.locator('#tabConfigBtn');
      const tabConfigPanel = page.locator('#tabConfigPanel');

      await tabConfigBtn.click();
      await expect(tabConfigPanel).toBeVisible();

      // Check for Configuration content
      const providerSelect = page.locator('#provider');
      const apiKeyInput = page.locator('#apiKey');
      await expect(providerSelect).toBeVisible();
      await expect(apiKeyInput).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should switch to Forgotten tab', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabForgottenBtn = page.locator('#tabForgottenBtn');
      const tabForgottenPanel = page.locator('#tabForgottenPanel');

      await tabForgottenBtn.click();
      await expect(tabForgottenPanel).toBeVisible();

      const scanBtn = page.locator('#btnScanForgotten');
      await expect(scanBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should switch to History tab', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabHistoryBtn = page.locator('#tabHistoryBtn');
      const tabHistoryPanel = page.locator('#tabHistoryPanel');

      await tabHistoryBtn.click();
      await expect(tabHistoryPanel).toBeVisible();

      // Check for History content
      const historyContainer = page.locator('#historyListContainer');
      await expect(historyContainer).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should maintain active tab state when switching', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabConfigBtn = page.locator('#tabConfigBtn');
      const tabRangementBtn = page.locator('#tabRangementBtn');

      // Switch to Config — wait for panel visible before asserting active class
      await tabConfigBtn.click();
      await page.locator('#tabConfigPanel').waitFor({ state: 'visible' });
      await expect(tabConfigBtn).toHaveClass(/active/);

      // Switch to Rangement — wait for panel visible before asserting active class
      await tabRangementBtn.click();
      await page.locator('#tabRangementPanel').waitFor({ state: 'visible' });
      await expect(tabRangementBtn).toHaveClass(/active/);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper default tab on load', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabRangementBtn = page.locator('#tabRangementBtn');
      const tabRangementPanel = page.locator('#tabRangementPanel');

      // Default should be Rangement
      await expect(tabRangementBtn).toHaveClass(/active/);
      await expect(tabRangementPanel).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

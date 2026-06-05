import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

async function navigateToForgotten(page) {
  const tabForgottenBtn = page.locator('#tabForgottenBtn');
  await tabForgottenBtn.click();
  await page.locator('#tabForgottenPanel').waitFor({ state: 'visible' });
}

test.describe('Forgotten Bookmarks Tab', () => {
  test('should display Forgotten tab button and navigate to it', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();
    try {
      await gotoPopup(page, extensionId);

      const tabBtn = page.locator('#tabForgottenBtn');
      await expect(tabBtn).toBeVisible();

      await navigateToForgotten(page);

      const panel = page.locator('#tabForgottenPanel');
      await expect(panel).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display the tab title using data-i18n attribute', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();
    try {
      await gotoPopup(page, extensionId);
      await navigateToForgotten(page);

      // Scope to panel to avoid matching the tab button which shares the same key
    const title = page.locator('#tabForgottenPanel [data-i18n="tabForgotten"]');
      await expect(title).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should show threshold selector with default value of 60 days', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();
    try {
      await gotoPopup(page, extensionId);
      await navigateToForgotten(page);

      const select = page.locator('#forgottenThreshold');
      await expect(select).toBeVisible();
      await expect(select).toHaveValue('60');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should show all threshold options', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();
    try {
      await gotoPopup(page, extensionId);
      await navigateToForgotten(page);

      const select = page.locator('#forgottenThreshold');
      const options = await select.locator('option').allTextContents();

      expect(options).toHaveLength(4);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should show Scan button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();
    try {
      await gotoPopup(page, extensionId);
      await navigateToForgotten(page);

      const scanBtn = page.locator('#btnScanForgotten');
      await expect(scanBtn).toBeVisible();
      await expect(scanBtn).toBeEnabled();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should run a scan and show a result message', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();
    try {
      await gotoPopup(page, extensionId);
      await navigateToForgotten(page);

      await page.click('#btnScanForgotten');

      // Wait for scan to complete (button re-enables or count message appears)
      await page.locator('#forgottenCount').waitFor({ state: 'visible' });
      const countText = await page.locator('#forgottenCount').textContent();

      // Either "none found" or "N bookmark(s) found" — both are non-empty
      expect(countText.trim().length).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should allow changing the threshold before scanning', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();
    try {
      await gotoPopup(page, extensionId);
      await navigateToForgotten(page);

      await page.selectOption('#forgottenThreshold', '30');
      await expect(page.locator('#forgottenThreshold')).toHaveValue('30');

      await page.selectOption('#forgottenThreshold', '0');
      await expect(page.locator('#forgottenThreshold')).toHaveValue('0');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should keep panel built on re-navigation (lazy render)', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();
    try {
      await gotoPopup(page, extensionId);

      // Navigate to Forgotten
      await navigateToForgotten(page);
      await expect(page.locator('#btnScanForgotten')).toBeVisible();

      // Switch away then back
      await page.click('#tabConfigBtn');
      await page.locator('#tabConfigPanel').waitFor({ state: 'visible' });
      await page.click('#tabForgottenBtn');
      await page.locator('#tabForgottenPanel').waitFor({ state: 'visible' });

      // Panel content must still be there
      await expect(page.locator('#btnScanForgotten')).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

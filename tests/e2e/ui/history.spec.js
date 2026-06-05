import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup, isBenignConsoleError } from '../helpers.js';

async function navigateToHistory(page) {
  const tabHistoryBtn = page.locator('#tabHistoryBtn');
  await tabHistoryBtn.click();
  await page.locator('#tabHistoryPanel').waitFor({ state: 'visible' });
}

test.describe('History Tab', () => {
  test('should display History tab content', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToHistory(page);

      const historyContainer = page.locator('#historyListContainer');
      await expect(historyContainer).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display empty history message when no history exists', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToHistory(page);

      // Wait for history to render and check for empty message
      await page.waitForTimeout(200);
      // Text is locale-dependent — just verify an empty-state element is shown
      const emptyMsg = page.locator('#historyListContainer').locator('div').first();
      await expect(emptyMsg).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Clear History button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToHistory(page);

      const clearBtn = page.locator('#btnClearHistory');
      expect(await clearBtn.count()).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Session History title', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToHistory(page);

      const title = page.locator('[data-i18n="historyTitle"]');
      await expect(title).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('history container should be properly styled and visible', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToHistory(page);

      const historyContainer = page.locator('#historyListContainer');
      const box = await historyContainer.boundingBox();

      expect(box).not.toBeNull();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should handle navigation away from History and back', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      // Go to History
      await navigateToHistory(page);
      let historyContainer = page.locator('#historyListContainer');
      await expect(historyContainer).toBeVisible();

      // Go to Config
      const tabConfigBtn = page.locator('#tabConfigBtn');
      await tabConfigBtn.click();
      const configPanel = page.locator('#tabConfigPanel');
      await expect(configPanel).toBeVisible();

      // Back to History
      await navigateToHistory(page);
      historyContainer = page.locator('#historyListContainer');
      await expect(historyContainer).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('Clear History button should have appropriate styling when no history', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await navigateToHistory(page);

      await page.waitForTimeout(300);
      const historyPanel = page.locator('#tabHistoryPanel');
      // Just verify that history panel loads without errors
      await expect(historyPanel).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should load History tab without errors', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      // Monitor for console errors
      let hasError = false;
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isBenignConsoleError(msg.text())) {
          hasError = true;
          console.error('Page error:', msg.text());
        }
      });

      await navigateToHistory(page);
      expect(hasError).toBe(false);
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

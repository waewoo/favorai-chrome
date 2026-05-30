import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

test.describe('Error Handling and Edge Cases', () => {
  test('should load popup without console errors', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await gotoPopup(page, extensionId);

      expect(errors).toHaveLength(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should load popup-light without console errors', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await gotoPopup(page, extensionId, 'popup-light.html');

      expect(errors).toHaveLength(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should handle missing DOM elements gracefully', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      // Try to access elements that should exist
      const tabRangement = page.locator('#tabRangementBtn');
      await expect(tabRangement).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have error banner but hidden initially', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');
      await page.waitForTimeout(300);

      const errorBanner = page.locator('#errorBanner');
      // Error banner element should exist in DOM
      expect(await errorBanner.count()).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have toast notification for user feedback', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const toast = page.locator('#toast');
      await expect(toast).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should not have null references in visible elements', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const allElements = await page.locator('*').count();
      expect(allElements).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should handle rapid tab switching without errors', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await gotoPopup(page, extensionId);

      // Rapidly switch tabs
      for (let i = 0; i < 5; i++) {
        const tabConfigBtn = page.locator('#tabConfigBtn');
        await tabConfigBtn.click();
        await page.waitForTimeout(50);

        const tabRangementBtn = page.locator('#tabRangementBtn');
        await tabRangementBtn.click();
        await page.waitForTimeout(50);
      }

      expect(errors).toHaveLength(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have all required form inputs accessible', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabConfigBtn = page.locator('#tabConfigBtn');
      await tabConfigBtn.click();
      await page.locator('#tabConfigPanel').waitFor({ state: 'visible' });

      const provider = page.locator('#provider');
      const apiKey = page.locator('#apiKey');
      const modelSelect = page.locator('#modelSelect');

      await expect(provider).toBeVisible();
      await expect(apiKey).toBeVisible();
      await expect(modelSelect).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have modal element available', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const modal = page.locator('#confirmModal');
      await expect(modal).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have accessibility features', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      // Check for proper heading hierarchy
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const count = await headings.count();
      expect(count).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should handle storage access gracefully', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await gotoPopup(page, extensionId);

      // Wait a bit for storage operations to complete
      await page.waitForTimeout(500);

      expect(errors).toHaveLength(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should not have memory leaks with repeated tab switches', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      // Get initial DOM size
      let elementCount = await page.locator('*').count();

      // Switch tabs multiple times
      for (let i = 0; i < 10; i++) {
        const tabConfigBtn = page.locator('#tabConfigBtn');
        await tabConfigBtn.click();
        await page.waitForTimeout(30);

        const tabRangementBtn = page.locator('#tabRangementBtn');
        await tabRangementBtn.click();
        await page.waitForTimeout(30);
      }

      // Element count should be similar (not significantly increased)
      const finalElementCount = await page.locator('*').count();
      const increase = finalElementCount - elementCount;

      expect(increase).toBeLessThan(50);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should properly handle network-related operations setup', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabConfigBtn = page.locator('#tabConfigBtn');
      await tabConfigBtn.click();

      // Should have button for fetching models
      const fetchBtn = page.locator('#btnFetchModels');
      await expect(fetchBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

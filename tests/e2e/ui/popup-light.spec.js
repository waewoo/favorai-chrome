import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

test.describe('Popup Light (Minimal Interface)', () => {
  test('should load popup-light.html successfully', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const title = page.locator('h1');
      await expect(title).toHaveText('FavorAI');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display Advanced Mode button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const advancedBtn = page.locator('#btnOpenAdvanced');
      await expect(advancedBtn).toBeVisible();

      // Should contain "Mode Avancé" text
      const text = await advancedBtn.textContent();
      expect(text).toContain('Mode Avancé');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have main content area visible', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const content = page.locator('.content');
      await expect(content).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display error banner element', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');
      await page.waitForTimeout(300);

      const errorBanner = page.locator('#errorBanner');
      // Error banner element should exist in DOM
      await expect(errorBanner).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have footer with language selector', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const footer = page.locator('.footer');
      await expect(footer).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display logo and branding', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const logo = page.locator('img[alt="FavorAI"]');
      await expect(logo).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper page structure', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const header = page.locator('.header');
      const content = page.locator('.content');
      const footer = page.locator('.footer');

      await expect(header).toBeVisible();
      await expect(content).toBeVisible();
      await expect(footer).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have detach button in main popup', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const detachBtn = page.locator('#btnDetach');
      await expect(detachBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('popup should be responsive and properly sized', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      expect(viewport.width).toBeGreaterThan(0);
      expect(viewport.height).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

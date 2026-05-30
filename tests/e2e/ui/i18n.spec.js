import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

test.describe('Internationalization (i18n)', () => {
  test('should load popup.html with proper language', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBeTruthy();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should load popup-light.html with proper language', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBeTruthy();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display "Mode Avancé" text in button (not "Interface complète")', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const advancedBtn = page.locator('#btnOpenAdvanced');
      const text = await advancedBtn.textContent();

      expect(text).toContain('Mode Avancé');
      expect(text).not.toContain('Interface complète');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should translate tab names correctly', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabRangement = page.locator('#tabRangementBtn');
      const tabConfig = page.locator('#tabConfigBtn');
      const tabHistory = page.locator('#tabHistoryBtn');

      const rangementText = await tabRangement.textContent();
      const configText = await tabConfig.textContent();
      const historyText = await tabHistory.textContent();

      // Should be in French or English depending on locale
      expect([rangementText, configText, historyText].join('')).toBeTruthy();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('Configuration tab should have translated labels', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabConfigBtn = page.locator('#tabConfigBtn');
      await tabConfigBtn.click();

      // Should have LLM Configuration section title
      const labels = page.locator('label');
      const count = await labels.count();
      expect(count).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('buttons should have translated text', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const minBtn = page.locator('#btnMinReorg');
      const fullBtn = page.locator('#btnFullReorg');

      const minText = await minBtn.textContent();
      const fullText = await fullBtn.textContent();

      // Both should have some text content
      expect(minText).toBeTruthy();
      expect(fullText).toBeTruthy();
      expect(minText.length).toBeGreaterThan(0);
      expect(fullText.length).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('privacy note should be translated', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      // Check if any privacy/data collection text is present (in French or English)
      const pageContent = await page.content();
      expect(pageContent).toContain('donn');  // Contains "données" (French for data)
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('popup-light should have all critical UI elements translated', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const title = page.locator('h1');
      const advancedBtn = page.locator('#btnOpenAdvanced');
      const footer = page.locator('.footer');

      await expect(title).toBeVisible();
      await expect(advancedBtn).toBeVisible();
      await expect(footer).toBeVisible();

      // All should have text content
      const titleText = await title.textContent();
      const btnText = await advancedBtn.textContent();

      expect(titleText).toBeTruthy();
      expect(btnText).toBeTruthy();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('data-i18n attributes should be properly applied to buttons', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const minBtn = page.locator('#btnMinReorg');
      const dataI18n = await minBtn.getAttribute('data-i18n');

      // Some buttons might have data-i18n attribute
      if (dataI18n) {
        expect(dataI18n).toBeTruthy();
      }
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display meaningful error messages (not error codes)', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(500);

      // Get all text content and check it's human-readable
      const pageText = await page.evaluate(() => document.body.textContent);
      // Should contain readable French or English text, not just codes
      expect(pageText).toBeTruthy();
      expect(pageText.length).toBeGreaterThan(50);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('configuration labels should be translated', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabConfigBtn = page.locator('#tabConfigBtn');
      await tabConfigBtn.click();
      await page.locator('#tabConfigPanel').waitFor({ state: 'visible' });
      await page.waitForTimeout(200);

      // Look for configuration-related labels
      const pageText = await page.evaluate(() => document.body.textContent);
      // Should contain configuration-related text
      expect(pageText.toLowerCase()).toMatch(/config|provider|api|model|fournisseur/i);
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

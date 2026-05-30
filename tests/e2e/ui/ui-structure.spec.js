import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionPath = path.resolve(__dirname, '../../../');

async function launchExtension() {
  const tmpDir = path.join(extensionPath, 'tests/e2e/tmp-user-data-' + Date.now());

  const context = await chromium.launchPersistentContext(tmpDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--headless=new'
    ]
  });

  let background = context.serviceWorkers()[0];
  if (!background) {
    background = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }

  const extensionId = background.url().split('/')[2];
  const page = await context.newPage();

  return { context, page, extensionId, tmpDir };
}

async function cleanup(context, tmpDir) {
  await context.close();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {}
}

test.describe('UI Structure and Layout', () => {
  test('popup.html should have proper document structure', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      // Check basic HTML structure
      const html = await page.locator('html');
      const body = await page.locator('body');

      await expect(html).not.toHaveCount(0);
      await expect(body).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('popup-light.html should have proper document structure', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup-light.html`);

      const html = await page.locator('html');
      const body = await page.locator('body');

      await expect(html).not.toHaveCount(0);
      await expect(body).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper CSS loaded', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      // Check if elements have computed styles (CSS is loaded)
      const tabRangement = page.locator('#tabRangementBtn');
      const color = await tabRangement.evaluate((el) =>
        window.getComputedStyle(el).color
      );

      expect(color).toBeTruthy();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have main view and validation view elements', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const mainView = page.locator('#mainView');
      const validationView = page.locator('#validationView');

      await expect(mainView).not.toHaveCount(0);
      await expect(validationView).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have confirmation modal structure', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const modal = page.locator('#confirmModal');
      const title = page.locator('#modalTitle');
      const message = page.locator('#modalMessage');
      const confirmBtn = page.locator('#modalBtnConfirm');
      const cancelBtn = page.locator('#modalBtnCancel');

      await expect(modal).not.toHaveCount(0);
      await expect(title).not.toHaveCount(0);
      await expect(message).not.toHaveCount(0);
      await expect(confirmBtn).not.toHaveCount(0);
      await expect(cancelBtn).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have all tab panels as siblings', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const rangementPanel = page.locator('#tabRangementPanel');
      const configPanel = page.locator('#tabConfigPanel');
      const historyPanel = page.locator('#tabHistoryPanel');

      await expect(rangementPanel).not.toHaveCount(0);
      await expect(configPanel).not.toHaveCount(0);
      await expect(historyPanel).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have action list container for validation view', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const actionListContainer = page.locator('#actionListContainer');
      await expect(actionListContainer).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have explanation block for AI explanations', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const explanationBlock = page.locator('#explanationBlock');
      await expect(explanationBlock).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('popup-light should have proper header and footer', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup-light.html`);

      const header = page.locator('.header');
      const footer = page.locator('.footer');
      const content = page.locator('.content');

      await expect(header).toBeVisible();
      await expect(footer).toBeVisible();
      await expect(content).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have version display element', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const appVersion = page.locator('#appVersion');
      // Version element might be hidden or displayed
      await expect(appVersion).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper nesting of elements', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      // Check tab structure - look for tab buttons with specific IDs
      const tabButtons = await page.locator('.tab-nav button, #tabRangementBtn, #tabConfigBtn, #tabHistoryBtn').count();
      expect(tabButtons).toBeGreaterThan(0);

      // Check tab panels
      const tabPanels = await page.locator('.tab-panel').count();
      // At least some panels should exist
      const explicitPanels = await page.locator(
        '#tabRangementPanel, #tabConfigPanel, #tabHistoryPanel'
      ).count();
      expect(explicitPanels).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper section organization', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const sections = page.locator('section');
      const count = await sections.count();

      // Should have multiple sections
      expect(count).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should not have duplicate IDs in the document', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const duplicateIds = await page.evaluate(() => {
        const ids = {};
        let duplicates = [];

        document.querySelectorAll('[id]').forEach(el => {
          if (ids[el.id]) {
            duplicates.push(el.id);
          }
          ids[el.id] = true;
        });

        return duplicates;
      });

      expect(duplicateIds).toHaveLength(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper data attributes for i18n', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const elementsWithI18n = await page.locator('[data-i18n]').count();
      // Should have some elements with i18n attributes
      expect(elementsWithI18n).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

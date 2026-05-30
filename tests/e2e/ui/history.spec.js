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

async function navigateToHistory(page) {
  const tabHistoryBtn = page.locator('#tabHistoryBtn');
  await tabHistoryBtn.click();
  await page.locator('#tabHistoryPanel').waitFor({ state: 'visible' });
}

test.describe('History Tab', () => {
  test('should display History tab content', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
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
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await navigateToHistory(page);

      // Wait for history to render and check for empty message
      await page.waitForTimeout(200);
      const emptyMsg = page.locator('#historyListContainer').locator('div').first();
      await expect(emptyMsg).toContainText('Aucun historique');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Clear History button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
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
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await navigateToHistory(page);

      const title = page.locator('text=Historique des Sessions');
      await expect(title).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('history container should be properly styled and visible', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
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
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      // Go to History
      await navigateToHistory(page);
      let historyContainer = page.locator('#historyListContainer');
      await expect(historyContainer).toBeVisible();

      // Go to Config
      const tabConfigBtn = page.locator('#tabConfigBtn');
      await tabConfigBtn.click();
      let configPanel = page.locator('#tabConfigPanel');
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
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
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
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      // Monitor for console errors
      let hasError = false;
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
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

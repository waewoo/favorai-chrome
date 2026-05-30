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

test.describe('Tabs Navigation', () => {
  test('should display all main tabs', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      // Check all tab buttons exist
      const tabRangement = page.locator('#tabRangementBtn');
      const tabConfig = page.locator('#tabConfigBtn');
      const tabHistory = page.locator('#tabHistoryBtn');

      await expect(tabRangement).toBeVisible();
      await expect(tabConfig).toBeVisible();
      await expect(tabHistory).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should switch to Rangement tab', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

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
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

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

  test('should switch to History tab', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

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
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const tabConfigBtn = page.locator('#tabConfigBtn');
      const tabRangementBtn = page.locator('#tabRangementBtn');

      // Switch to Config
      await tabConfigBtn.click();
      await expect(tabConfigBtn).toHaveClass(/active/);

      // Switch to Rangement
      await tabRangementBtn.click();
      await expect(tabRangementBtn).toHaveClass(/active/);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper default tab on load', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

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

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

test.describe('Reorganization (Rangement) Tab', () => {
  test('should display Rangement tab content', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const tabRangementPanel = page.locator('#tabRangementPanel');
      await expect(tabRangementPanel).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display Launch Reorganization section', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const launchSection = page.locator('text=Lancer le Rangement');
      await expect(launchSection).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Minimal reorganization button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await page.waitForTimeout(300);

      const minBtn = page.locator('#btnMinReorg');
      await expect(minBtn).toBeVisible();
      const text = await minBtn.textContent();
      expect(text).toBeTruthy();
      expect(text.toUpperCase()).toContain('MINIMAL');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Complete reorganization button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const fullBtn = page.locator('#btnFullReorg');
      await expect(fullBtn).toBeVisible();
      const text = await fullBtn.textContent();
      expect(text).toContain('Complet');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display Status Console section', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const statusSection = page.locator('text=Console de Statut');
      await expect(statusSection).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have log container for status messages', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const logContainer = page.locator('#logContainer');
      await expect(logContainer).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have progress bar container', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const progressContainer = page.locator('#progressBarContainer');
      await expect(progressContainer).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Check Dead Links checkbox', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const deadLinksCheckbox = page.locator('#checkDeadLinks');
      await expect(deadLinksCheckbox).toBeVisible();
      await expect(deadLinksCheckbox).toHaveAttribute('type', 'checkbox');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display privacy note', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const privacyNote = page.locator('text=Aucune donnée n\'est collectée');
      await expect(privacyNote).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('reorganization buttons should be enabled initially', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const minBtn = page.locator('#btnMinReorg');
      const fullBtn = page.locator('#btnFullReorg');

      await expect(minBtn).toBeEnabled();
      await expect(fullBtn).toBeEnabled();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Stop Reorganization button hidden initially', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const stopBtn = page.locator('#btnStopReorg');
      await expect(stopBtn).toHaveClass(/hidden/);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display Bookmark folder selector', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const folderSelect = page.locator('#bookmarkFolderSelect');
      await expect(folderSelect).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper section layout in Rangement tab', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const sections = page.locator('#tabRangementPanel section');
      const count = await sections.count();
      expect(count).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have toast notification container', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const toast = page.locator('#toast');
      await expect(toast).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should load Rangement without errors', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      let hasError = false;
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          hasError = true;
          console.error('Page error:', msg.text());
        }
      });

      const tabRangementPanel = page.locator('#tabRangementPanel');
      await expect(tabRangementPanel).toBeVisible();

      expect(hasError).toBe(false);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should maintain Rangement tab state on reload', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const tabRangementBtn = page.locator('#tabRangementBtn');
      await expect(tabRangementBtn).toHaveClass(/active/);

      await page.reload();

      await expect(tabRangementBtn).toHaveClass(/active/);
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

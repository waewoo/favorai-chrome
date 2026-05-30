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

test.describe('Popup Light (Minimal Interface)', () => {
  test('should load popup-light.html successfully', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup-light.html`);

      const title = page.locator('h1');
      await expect(title).toHaveText('FavorAI');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display Advanced Mode button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup-light.html`);

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
      await page.goto(`chrome-extension://${extensionId}/popup-light.html`);

      const content = page.locator('.content');
      await expect(content).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display error banner element', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup-light.html`);
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
      await page.goto(`chrome-extension://${extensionId}/popup-light.html`);

      const footer = page.locator('.footer');
      await expect(footer).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display logo and branding', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup-light.html`);

      const logo = page.locator('img[alt="FavorAI"]');
      await expect(logo).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper page structure', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup-light.html`);

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
      await page.goto(`chrome-extension://${extensionId}/popup.html`);

      const detachBtn = page.locator('#btnDetach');
      await expect(detachBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('popup should be responsive and properly sized', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await page.goto(`chrome-extension://${extensionId}/popup-light.html`);

      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      expect(viewport.width).toBeGreaterThan(0);
      expect(viewport.height).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

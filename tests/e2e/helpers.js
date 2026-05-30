import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const extensionPath = path.resolve(__dirname, '../../');

/**
 * Launches a Chromium instance with the extension loaded.
 * Uses --headless=new (Chrome's new headless mode that supports extensions).
 * headless: false prevents Playwright from injecting its own --headless flag.
 */
export async function launchExtension() {
  const tmpDir = path.join(extensionPath, 'tests/e2e/tmp-user-data-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));

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
    background = await context.waitForEvent('serviceworker', { timeout: 15000 });
  }

  const extensionId = background.url().split('/')[2];
  const page = await context.newPage();

  return { context, page, extensionId, tmpDir };
}

/**
 * Navigates to the extension popup and waits for the page to be interactive.
 * Always call this instead of raw page.goto() to avoid acting on a partially
 * loaded page (the most common cause of e2e timeouts).
 */
export async function gotoPopup(page, extensionId, file = 'popup.html') {
  await page.goto(`chrome-extension://${extensionId}/${file}`);
  await page.waitForLoadState('domcontentloaded');
  // Small stabilization wait for the extension's JS initialization
  await page.waitForTimeout(150);
}

export async function cleanup(context, tmpDir) {
  await context.close();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) {}
}

import { chromium } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const extensionPath = path.resolve(__dirname, '../../');

/**
 * Launches a Chromium instance with the extension loaded.
 * Uses optimized arguments for faster startup.
 */
export async function launchExtension() {
  // Store in os.tmpdir() to avoid polluting the testDir (Playwright scans it for specs)
  const tmpDir = path.join(os.tmpdir(), 'favorai-e2e-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7));

  const context = await chromium.launchPersistentContext(tmpDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--headless=new',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--js-flags="--max-opt-level=2"'
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
 */
export async function gotoPopup(page, extensionId, file = 'popup.html') {
  await page.goto(`chrome-extension://${extensionId}/${file}`);
  await page.waitForLoadState('domcontentloaded');
  // 120ms stabilization wait is a stable compromise for fast local runs
  await page.waitForTimeout(120);
}

const BENIGN_CONSOLE_ERROR_PATTERNS = [
  /Failed to load resource: net::ERR_NETWORK_ACCESS_DENIED/i,
  /Executing inline event handler violates the following Content Security Policy directive/i,
  /script-src 'self'/i
];

export function isBenignConsoleError(message) {
  const text = String(message || '');
  return BENIGN_CONSOLE_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export async function cleanup(context, tmpDir) {
  await context.close();
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
}

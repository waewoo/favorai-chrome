import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup, isBenignConsoleError } from '../helpers.js';

test.describe('Reorganization (Rangement) Tab', () => {
  test('should display Rangement tab content', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const tabRangementPanel = page.locator('#tabRangementPanel');
      await expect(tabRangementPanel).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display Launch Reorganization section', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const launchSection = page.locator('[data-i18n="sectionLaunchTitle"]');
      await expect(launchSection).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have launch analysis button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      const launchBtn = page.locator('#btnLaunch');
      await expect(launchBtn).toBeVisible();
      const text = await launchBtn.textContent();
      expect(text).toBeTruthy();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Minimal and Complete mode radio buttons', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const minRadio = page.locator('input[name="reorgMode"][value="minimal"]');
      const fullRadio = page.locator('input[name="reorgMode"][value="complete"]');
      await expect(minRadio).toBeVisible();
      await expect(fullRadio).toBeVisible();
      await expect(minRadio).toBeChecked();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display Status Console section', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const statusSection = page.locator('[data-i18n="sectionStatus"]');
      await expect(statusSection).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have log container for status messages', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      // #logContainer uses flex:1/min-height:0 — check presence and attribute, not pixel visibility
      const logContainer = page.locator('#logContainer');
      expect(await logContainer.count()).toBeGreaterThan(0);
      await expect(logContainer).toHaveAttribute('role', 'log');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have progress bar container', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const progressContainer = page.locator('#progressBarContainer');
      await expect(progressContainer).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have all analysis option checkboxes', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      for (const id of ['useAI', 'checkDeadLinks', 'checkRedirects', 'checkContentDuplicates']) {
        const el = page.locator(`#${id}`);
        await expect(el).toBeVisible();
        await expect(el).toHaveAttribute('type', 'checkbox');
      }
      await expect(page.locator('#useAI')).toBeChecked();
      await expect(page.locator('#checkDeadLinks')).not.toBeChecked();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display privacy note', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const privacyNote = page.locator('[data-i18n="privacyNote"]');
      await expect(privacyNote).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('launch button should be enabled initially', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const launchBtn = page.locator('#btnLaunch');
      await expect(launchBtn).toBeEnabled();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have Stop Reorganization button hidden initially', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const stopBtn = page.locator('#btnStopReorg');
      await expect(stopBtn).toHaveClass(/hidden/);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display Bookmark folder selector', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const folderSelect = page.locator('#bookmarkFolderSelect');
      await expect(folderSelect).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper section layout in Rangement tab', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

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
      await gotoPopup(page, extensionId);

      const toast = page.locator('#toast');
      await expect(toast).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should load Rangement without errors', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      let hasError = false;
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isBenignConsoleError(msg.text())) {
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
      await gotoPopup(page, extensionId);

      const tabRangementBtn = page.locator('#tabRangementBtn');
      await expect(tabRangementBtn).toHaveClass(/active/);

      await page.reload();

      await expect(tabRangementBtn).toHaveClass(/active/);
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

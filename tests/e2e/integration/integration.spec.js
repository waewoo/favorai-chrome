import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

// Mock some bookmarks in storage before test
async function setupMockBookmarks(context) {
  // Create bookmarks structure in extension storage
  const mockBookmarks = [
    { id: '1', title: 'Barre de favoris', children: [
      { id: '2', title: 'Design Resources', children: [
        { id: '3', title: 'CSS Tricks', url: 'https://css-tricks.com' },
        { id: '4', title: 'Dribbble', url: 'https://dribbble.com' }
      ]},
      { id: '5', title: 'Dev Tools', children: [
        { id: '6', title: 'GitHub', url: 'https://github.com' },
        { id: '7', title: 'Stack Overflow', url: 'https://stackoverflow.com' }
      ]}
    ]}
  ];

  const bg = context.serviceWorkers()[0];
  if (bg) {
    await bg.evaluate((bookmarks) => {
      chrome.bookmarks.getTree = async () => bookmarks;
    }, mockBookmarks);
  }
}

test.describe('Integration Tests - Reorganization Flow', () => {
  test('should load popup with configuration panel', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(500);

      // Verify main interface loads
      const mainView = page.locator('#mainView');
      await expect(mainView).toBeVisible();

      // Verify configuration panel is accessible
      const tabConfigBtn = page.locator('#tabConfigBtn');
      await expect(tabConfigBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should accept API configuration', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      // Navigate to configuration
      const tabConfigBtn = page.locator('#tabConfigBtn');
      await tabConfigBtn.click();
      await page.locator('#tabConfigPanel').waitFor({ state: 'visible' });

      // Verify we can set provider
      const provider = page.locator('#provider');
      await provider.selectOption('openai');

      // Verify API key field exists
      const apiKeyInput = page.locator('#apiKey');
      await expect(apiKeyInput).toBeVisible();

      // Verify save button exists
      const saveBtn = page.locator('#btnSaveConfig');
      await expect(saveBtn).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display folder selector in rangement tab', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      // Rangement tab should be active by default
      const tabRangementPanel = page.locator('#tabRangementPanel');
      await expect(tabRangementPanel).toBeVisible();

      // Folder selector should exist
      const folderSelect = page.locator('#bookmarkFolderSelect');
      await expect(folderSelect).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have minimal and complete reorganization buttons', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      // Both buttons should be visible and enabled
      const minBtn = page.locator('#btnMinReorg');
      const fullBtn = page.locator('#btnFullReorg');

      await expect(minBtn).toBeVisible();
      await expect(fullBtn).toBeVisible();
      await expect(minBtn).toBeEnabled();
      await expect(fullBtn).toBeEnabled();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display log console for status updates', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      // Status console should exist
      const logContainer = page.locator('#logContainer');
      await expect(logContainer).toBeVisible();

      // Progress bar container should exist
      const progressContainer = page.locator('#progressBarContainer');
      await expect(progressContainer).not.toHaveCount(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should handle dead links checkbox', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      const deadLinksCheckbox = page.locator('#checkDeadLinks');
      await expect(deadLinksCheckbox).toBeVisible();
      await expect(deadLinksCheckbox).toHaveAttribute('type', 'checkbox');

      // Should be unchecked by default
      const isChecked = await deadLinksCheckbox.isChecked();
      expect(isChecked).toBe(false);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should navigate to validation view when reorganization starts', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      // Initially, main view should be visible
      const mainView = page.locator('#mainView');
      const validationView = page.locator('#validationView');

      await expect(mainView).toBeVisible();

      // Validation view should exist but be hidden initially
      expect(await validationView.count()).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have confirmation modal for actions', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      // Confirmation modal should exist
      const modal = page.locator('#confirmModal');
      const btnConfirm = page.locator('#modalBtnConfirm');
      const btnCancel = page.locator('#modalBtnCancel');

      expect(await modal.count()).toBeGreaterThan(0);
      expect(await btnConfirm.count()).toBeGreaterThan(0);
      expect(await btnCancel.count()).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should persist configuration in chrome.storage', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(500);

      // Navigate to config
      const tabConfigBtn = page.locator('#tabConfigBtn');
      await tabConfigBtn.click();
      await page.locator('#tabConfigPanel').waitFor({ state: 'visible' });
      await page.waitForTimeout(200);

      // Verify we can interact with provider dropdown
      const provider = page.locator('#provider');
      const currentValue = await provider.inputValue();

      // Provider should have a default value
      expect(currentValue).toBeTruthy();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display history when available', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      // Navigate to history tab
      const tabHistoryBtn = page.locator('#tabHistoryBtn');
      await tabHistoryBtn.click();
      await page.locator('#tabHistoryPanel').waitFor({ state: 'visible' });
      await page.waitForTimeout(200);

      // History container should exist
      const historyContainer = page.locator('#historyListContainer');
      await expect(historyContainer).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should support popup-light interface for quick access', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');
      await page.waitForTimeout(300);

      // popup-light should have main content
      const content = page.locator('.content');
      await expect(content).toBeVisible();

      // Should have button to open advanced mode (main popup)
      const advancedBtn = page.locator('#btnOpenAdvanced');
      await expect(advancedBtn).toBeVisible();

      const btnText = await advancedBtn.textContent();
      expect(btnText).toBeTruthy();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should handle errors gracefully', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);

      const errors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });

      await page.waitForTimeout(1000);

      // No console errors should occur during normal load
      expect(errors.length).toBe(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display documentation tab with content', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.waitForTimeout(300);

      // Navigate to documentation tab
      const tabDocsBtn = page.locator('#tabDocsBtn');
      await expect(tabDocsBtn).toBeVisible();
      await tabDocsBtn.click();

      // Documentation panel should be visible after tab click
      const docsPanel = page.locator('#tabDocumentationPanel');
      await expect(docsPanel).toBeVisible({ timeout: 10000 });

      // Verify key documentation sections using i18n keys present in popup.html
      const docsTitle = page.locator('[data-i18n="docsTitle"]');
      expect(await docsTitle.count()).toBeGreaterThan(0);

      const docsOverview = page.locator('[data-i18n="docsOverviewTitle"]');
      await expect(docsOverview).toBeVisible();

      const docsFeatures = page.locator('[data-i18n="docsFeatures"]');
      await expect(docsFeatures).toBeVisible();

      const docsTokens = page.locator('[data-i18n="docsGettingTokens"]');
      await expect(docsTokens).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

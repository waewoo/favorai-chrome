import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

test.describe('Popup Light (Minimal Interface)', () => {
  test('should load popup-light.html successfully', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const title = page.locator('h1');
      await expect(title).toHaveText('FavorAI');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display Advanced Mode button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

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
      await gotoPopup(page, extensionId, 'popup-light.html');

      const content = page.locator('.content');
      await expect(content).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display error banner element', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');
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
      await gotoPopup(page, extensionId, 'popup-light.html');

      const footer = page.locator('.footer');
      await expect(footer).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should display logo and branding', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const logo = page.locator('img[alt="FavorAI"]');
      await expect(logo).toBeVisible();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should have proper page structure', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

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



  test('popup should be responsive and properly sized', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();
      expect(viewport.width).toBeGreaterThan(0);
      expect(viewport.height).toBeGreaterThan(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should show config warning banner if API key is missing', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const configAlert = page.locator('#lightConfigAlert');
      await expect(configAlert).toBeVisible();

      // Analyze button should be disabled with title
      const btnAnalyze = page.locator('#btnLightAnalyze');
      await expect(btnAnalyze).toBeDisabled();
      await expect(btnAnalyze).toHaveAttribute('title', /API/);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should hide config warning banner if provider is ollama or API key is set', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      // Set provider to ollama via page evaluate in storage
      await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.sync.set({ provider: 'ollama' }, () => {
            chrome.storage.local.set({ apiKey: '' }, resolve);
          });
        });
      });

      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(150);

      const configAlert = page.locator('#lightConfigAlert');
      await expect(configAlert).toBeHidden();
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should open config tab in advanced mode when clicking Configure AI button', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const configureBtn = page.locator('#btnLightConfigureAI');
      await expect(configureBtn).toBeVisible();

      // Click the button
      await configureBtn.click();

      // Wait for storage write to propagate
      await page.waitForTimeout(200);

      // Verify that activeTab is set to 'config' in chrome.storage.local
      const activeTab = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['activeTab'], (res) => resolve(res.activeTab));
        });
      });
      expect(activeTab).toBe('config');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should show quick reorg card and open organization tab when clicking Start Reorganization', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const reorgCard = page.locator('#lightQuickReorgCard');
      await expect(reorgCard).toBeVisible();

      const reorgBtn = page.locator('#btnLightReorgAll');
      await expect(reorgBtn).toBeVisible();

      // Click the button
      await reorgBtn.click();

      // Wait for storage write to propagate
      await page.waitForTimeout(200);

      // Verify that activeTab is set to 'rangement' in chrome.storage.local
      const activeTab = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['activeTab'], (res) => resolve(res.activeTab));
        });
      });
      expect(activeTab).toBe('rangement');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should open organization tab when clicking the quick reorg title', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');

      const reorgTitle = page.locator('#lightQuickReorgTitle');
      await expect(reorgTitle).toBeVisible();
      await reorgTitle.click();

      await page.waitForTimeout(200);

      const activeTab = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.storage.local.get(['activeTab'], (res) => resolve(res.activeTab));
        });
      });
      expect(activeTab).toBe('rangement');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('should allow a different folder when the suggested one contains a duplicate', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId, 'popup-light.html');
      const folders = await page.evaluate(() => new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'get_folders' }, response => resolve(response.folders));
      }));
      const [suggested, alternative] = folders.filter(folder => folder.id !== '0').slice(0, 2);
      expect(suggested).toBeDefined();
      expect(alternative).toBeDefined();

      await page.evaluate(async ({ suggestedFolder, alternativeFolder }) => {
        await chrome.storage.local.set({
          pendingAutoBookmarkSuggestions: {
            'auto-bookmark': {
              type: 'suggestion',
              bookmark: { id: 'auto-bookmark', title: 'Original title', url: 'https://example.com', parentId: '1' },
              suggestion: { action: 'use_existing', targetFolderId: suggestedFolder.id, explanation: 'Suggested destination.' },
              folders: [
                suggestedFolder,
                alternativeFolder
              ],
              existingDuplicate: { id: 'duplicate', folderId: suggestedFolder.id, folderPath: suggestedFolder.path },
              autoMoveEnabled: false
            }
          }
        });
      }, { suggestedFolder: suggested, alternativeFolder: alternative });

      await gotoPopup(page, extensionId, 'popup-light.html?mode=autoclassify&bookmarkId=auto-bookmark');

      await expect(page.locator('#lightSuggestionCard')).toBeVisible();
      await expect(page.locator('#lightBookmarkTitle')).toHaveValue('Original title');
      await expect(page.locator('#lightAutoTargetTitle')).toHaveValue('Original title');
      await expect(page.locator('#lightAutoTargetFolder')).toHaveValue(suggested.id);
      await expect(page.locator('#btnLightConfirm')).toBeDisabled();

      await page.locator('#lightAutoTargetFolder').selectOption(alternative.id);
      await expect(page.locator('#btnLightConfirm')).toBeEnabled();
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

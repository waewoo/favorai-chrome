import { test, expect } from '@playwright/test';
import { launchExtension, cleanup } from '../helpers.js';

test.describe('Managed most-used bookmarks folder', () => {
  test('reconciles stale copies without moving the original bookmark', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();
    const background = context.serviceWorkers()[0];

    try {
      await page.goto(`chrome-extension://${extensionId}/extension/popup-light.html`);
      const original = await background.evaluate(async () => {
        const children = await chrome.bookmarks.getChildren('1');
        for (const child of children) await chrome.bookmarks.removeTree(child.id);
        return chrome.bookmarks.create({
          parentId: '1',
          title: 'Original bookmark',
          url: 'https://example.com/original'
        });
      });

      const firstRefresh = await page.evaluate(() => new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'get_most_used_bookmarks' }, resolve);
      }));

      expect(firstRefresh.success).toBe(true);
      expect(firstRefresh.folderId).toBeTruthy();
      expect(firstRefresh.folderPath).toContain('⭐ Les plus consultés');

      const staleCopy = await background.evaluate(async (folderId) => {
        return chrome.bookmarks.create({
          parentId: folderId,
          title: 'Stale copy',
          url: 'https://example.com/stale'
        });
      }, firstRefresh.folderId);

      const secondRefresh = await page.evaluate(() => new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'get_most_used_bookmarks' }, resolve);
      }));

      const verification = await background.evaluate(async ({ folderId, originalId, staleId }) => {
        const [folder] = await chrome.bookmarks.get(folderId);
        const folderChildren = await chrome.bookmarks.getChildren(folderId);
        const [originalBookmark] = await chrome.bookmarks.get(originalId);
        const [staleBookmark] = await chrome.bookmarks.get(staleId).catch(() => []);
        return {
          folderParentId: folder.parentId,
          managedChildren: folderChildren.map(child => child.url),
          originalParentId: originalBookmark?.parentId,
          staleExists: Boolean(staleBookmark)
        };
      }, {
        folderId: secondRefresh.folderId,
        originalId: original.id,
        staleId: staleCopy.id
      });

      expect(verification.folderParentId).toBe('1');
      expect(verification.originalParentId).toBe('1');
      expect(verification.staleExists).toBe(false);
      expect(verification.managedChildren).not.toContain('https://example.com/stale');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('opens the suggestion popup when a normal bookmark is created', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();
    const background = context.serviceWorkers()[0];

    try {
      await page.goto(`chrome-extension://${extensionId}/extension/popup-light.html`);
      await page.evaluate(async () => {
        await chrome.storage.sync.set({
          provider: 'google',
          modelName: 'gemini-1.5-flash',
          autoMoveNewBookmarks: false
        });
        await chrome.storage.local.set({ apiKey: 'e2e-test-key' });
      });

      await context.route('**/generativelanguage.googleapis.com/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            candidates: [{ content: { parts: [{ text: JSON.stringify({
              action: 'use_existing',
              targetFolderId: '1',
              explanation: 'E2E suggestion.'
            }) }] } }]
          })
        });
      });

      const managedFolder = await page.evaluate(() => new Promise(resolve => {
        chrome.runtime.sendMessage({ action: 'get_most_used_bookmarks' }, resolve);
      }));
      expect(managedFolder.folderId).toBeTruthy();

      const popupPromise = context.waitForEvent('page', { timeout: 15000 });
      const bookmarkId = await background.evaluate((parentId) => new Promise((resolve, reject) => {
        chrome.bookmarks.create({
          parentId,
          title: 'E2E suggested bookmark',
          url: 'https://e2e-suggestion.example'
        }, bookmark => {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(bookmark.id);
        });
      }), managedFolder.folderId);

      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      expect(popup.url()).toContain(`mode=autoclassify&bookmarkId=${bookmarkId}`);
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

import { test, expect } from '@playwright/test';
import { launchExtension, cleanup, gotoPopup } from '../helpers.js';

test.describe('Bookmark snapshots', () => {
  test('previews a local snapshot and exports its JSON without mutating bookmarks', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      const snapshot = await page.evaluate(async () => {
        const [root] = await chrome.bookmarks.getTree();
        const serialize = (node, parentId = null) => ({
          id: String(node.id),
          title: node.title || '',
          parentId: node.parentId === undefined ? parentId : String(node.parentId),
          ...(node.url ? { url: node.url } : {}),
          ...(node.children ? { children: node.children.map(child => serialize(child, String(node.id))) } : {})
        });
        const value = {
          version: 1,
          id: 'snap_e2e',
          timestamp: Date.now(),
          scope: null,
          tree: serialize(root)
        };
        await chrome.storage.local.set({ bookmarkSnapshots: [value] });
        return value;
      });

      await page.locator('#tabHistoryBtn').click();
      await expect(page.locator('.btn-snapshot-preview')).toBeVisible();
      const before = await page.evaluate(() => chrome.bookmarks.getTree());

      await page.locator('.btn-snapshot-preview').click();
      await expect(page.locator('#snapshotPreview')).toContainText(/Restoration preview|Prévisualisation de la restauration/);

      const downloadPromise = page.waitForEvent('download');
      await page.locator('.btn-snapshot-export').click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toContain(snapshot.id);
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      expect(exported.id).toBe(snapshot.id);
      expect(JSON.stringify(exported)).not.toMatch(/apiKey|provider|model|prompt/i);

      const after = await page.evaluate(() => chrome.bookmarks.getTree());
      expect(after).toEqual(before);
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

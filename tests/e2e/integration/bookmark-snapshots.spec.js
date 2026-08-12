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
          scope: { bookmarkFolderId: 'root', apiKey: 'SECRET' },
          tree: serialize(root),
          apiKey: 'SECRET',
          provider: 'openai',
          model: 'secret-model',
          prompt: 'secret prompt'
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
      expect(Object.keys(exported)).toEqual(['version', 'id', 'timestamp', 'scope', 'tree']);
      expect(JSON.stringify(exported)).not.toMatch(/apiKey|provider|model|prompt/i);

      const after = await page.evaluate(() => chrome.bookmarks.getTree());
      expect(after).toEqual(before);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('restores a bookmark URL changed after the snapshot was captured', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      const bookmarkId = await page.evaluate(async () => {
        const bookmark = await chrome.bookmarks.create({
          parentId: '1',
          title: 'URL snapshot test',
          url: 'https://snapshot-old.example'
        });
        const [root] = await chrome.bookmarks.getTree();
        const serialize = (node, parentId = null) => ({
          id: String(node.id),
          title: node.title || '',
          parentId: node.parentId === undefined ? parentId : String(node.parentId),
          ...(node.url ? { url: node.url } : {}),
          ...(node.children ? { children: node.children.map(child => serialize(child, String(node.id))) } : {})
        });
        await chrome.storage.local.set({ bookmarkSnapshots: [{
          version: 1,
          id: 'snap_url_e2e',
          timestamp: Date.now(),
          scope: null,
          tree: serialize(root)
        }] });
        await chrome.bookmarks.update(bookmark.id, { url: 'https://snapshot-new.example' });
        return bookmark.id;
      });

      await page.locator('#tabHistoryBtn').click();
      await page.locator('.btn-snapshot-preview').click();
      await expect(page.locator('#snapshotPreview')).toContainText('rename_bookmark');
      await page.locator('.btn-snapshot-restore').click();
      await page.locator('#modalBtnConfirm').click();

      await expect.poll(async () => page.evaluate(async id => (await chrome.bookmarks.get(id))[0]?.url, bookmarkId)).toMatch(/^https:\/\/snapshot-old\.example\/?$/);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('reports an obsolete tree without mutating bookmarks', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      const bookmarkId = await page.evaluate(async () => {
        const bookmark = await chrome.bookmarks.create({
          parentId: '1',
          title: 'Stale snapshot test',
          url: 'https://stale-original.example'
        });
        const [root] = await chrome.bookmarks.getTree();
        const serialize = (node, parentId = null) => ({
          id: String(node.id),
          title: node.title || '',
          parentId: node.parentId === undefined ? parentId : String(node.parentId),
          ...(node.url ? { url: node.url } : {}),
          ...(node.children ? { children: node.children.map(child => serialize(child, String(node.id))) } : {})
        });
        await chrome.storage.local.set({ bookmarkSnapshots: [{
          version: 1,
          id: 'snap_stale_e2e',
          timestamp: Date.now(),
          scope: null,
          tree: serialize(root)
        }] });
        return bookmark.id;
      });

      await page.locator('#tabHistoryBtn').click();
      await page.locator('.btn-snapshot-preview').click();
      await page.evaluate(async id => chrome.bookmarks.update(id, { title: 'Changed after preview' }), bookmarkId);
      await page.locator('.btn-snapshot-restore').click();
      await page.locator('#modalBtnConfirm').click();

      await expect(page.locator('#toast')).toContainText(/Bookmarks changed since the preview|Les favoris ont changé depuis la prévisualisation/);
      await expect.poll(async () => page.evaluate(async id => (await chrome.bookmarks.get(id))[0]?.title, bookmarkId)).toBe('Changed after preview');
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('previews and rejects a snapshot node with an unresolved parent', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.evaluate(async () => {
        const [root] = await chrome.bookmarks.getTree();
        const serialize = (node, parentId = null) => ({
          id: String(node.id),
          title: node.title || '',
          parentId: node.parentId === undefined ? parentId : String(node.parentId),
          ...(node.url ? { url: node.url } : {}),
          ...(node.children ? { children: node.children.map(child => serialize(child, String(node.id))) } : {})
        });
        const tree = serialize(root);
        const bar = tree.children.find(child => child.id === '1');
        bar.children = [{
          id: 'unrestorable-bookmark',
          title: 'Unrestorable bookmark',
          parentId: 'missing-parent',
          url: 'https://unrestorable.example'
        }];
        await chrome.storage.local.set({ bookmarkSnapshots: [{
          version: 1,
          id: 'snap_unrestorable_e2e',
          timestamp: Date.now(),
          scope: null,
          tree
        }] });
      });

      await page.locator('#tabHistoryBtn').click();
      await page.locator('.btn-snapshot-preview').click();
      await expect(page.locator('#snapshotPreview')).toContainText(/Parent folder cannot be resolved\.|Le dossier parent est introuvable\./);
      await page.locator('.btn-snapshot-restore').click();
      await page.locator('#modalBtnConfirm').click();
      await expect(page.locator('#toast')).toContainText(/Some snapshot items cannot be restored automatically\.|Certains éléments du snapshot ne peuvent pas être restaurés automatiquement\./);
      expect(await page.evaluate(async () => (await chrome.bookmarks.search({ url: 'https://unrestorable.example' })).length)).toBe(0);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('cancels confirmation without mutation and restores sequentially after confirmation', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.evaluate(async () => {
        const [root] = await chrome.bookmarks.getTree();
        const serialize = (node, parentId = null) => ({
          id: String(node.id),
          title: node.title || '',
          parentId: node.parentId === undefined ? parentId : String(node.parentId),
          ...(node.url ? { url: node.url } : {}),
          ...(node.children ? { children: node.children.map(child => serialize(child, String(node.id))) } : {})
        });
        const tree = serialize(root);
        const bar = tree.children.find(child => child.id === '1');
        bar.children = [...(bar.children || []), {
          id: 'snapshot-bookmark',
          title: 'Restored from snapshot',
          parentId: '1',
          url: 'https://snapshot-restore.example'
        }];
        await chrome.storage.local.set({ bookmarkSnapshots: [{ version: 1, id: 'snap_restore_e2e', timestamp: Date.now(), scope: null, tree }] });
      });

      await page.locator('#tabHistoryBtn').click();
      await page.locator('.btn-snapshot-preview').click();
      await expect(page.locator('.btn-snapshot-restore')).toBeVisible();

      await page.locator('.btn-snapshot-restore').click();
      await expect(page.locator('#confirmModal')).toBeVisible();
      await page.locator('#modalBtnCancel').click();
      expect(await page.evaluate(async () => (await chrome.bookmarks.search({ url: 'https://snapshot-restore.example' })).length)).toBe(0);

      await page.locator('.btn-snapshot-restore').click();
      await page.locator('#modalBtnConfirm').click();
      await expect.poll(async () => page.evaluate(async () => (await chrome.bookmarks.search({ url: 'https://snapshot-restore.example' })).length)).toBe(1);
    } finally {
      await cleanup(context, tmpDir);
    }
  });

  test('shows successful and failed operations when Chrome rejects a restore move', async () => {
    const { context, page, extensionId, tmpDir } = await launchExtension();

    try {
      await gotoPopup(page, extensionId);
      await page.evaluate(async () => {
        const folderA = await chrome.bookmarks.create({ parentId: '1', title: 'Restore folder A' });
        const folderB = await chrome.bookmarks.create({ parentId: folderA.id, title: 'Restore folder B' });
        await chrome.bookmarks.create({ parentId: '1', title: 'Before restore', url: 'https://snapshot-partial.example' });
        const [root] = await chrome.bookmarks.getTree();
        const serialize = (node, parentId = null) => ({
          id: String(node.id),
          title: node.title || '',
          parentId: node.parentId === undefined ? parentId : String(node.parentId),
          ...(node.url ? { url: node.url } : {}),
          ...(node.children ? { children: node.children.map(child => serialize(child, String(node.id))) } : {})
        });
        const tree = serialize(root);
        const bar = tree.children.find(child => child.id === '1');
        const targetA = bar.children.find(child => child.id === String(folderA.id));
        const targetB = targetA.children.find(child => child.id === String(folderB.id));
        const targetBookmark = bar.children.find(child => child.title === 'Before restore');

        targetA.children = [];
        targetA.parentId = targetB.id;
        targetB.parentId = bar.id;
        targetB.children = [targetA];
        targetBookmark.title = 'After restore';
        bar.children = [targetB, targetBookmark];

        await chrome.storage.local.set({ bookmarkSnapshots: [{
          version: 1,
          id: 'snap_partial_error_e2e',
          timestamp: Date.now(),
          scope: null,
          tree
        }] });
      });

      await page.locator('#tabHistoryBtn').click();
      await expect(page.locator('.btn-snapshot-preview')).toBeVisible();
      await page.locator('.btn-snapshot-preview').click();
      await expect(page.locator('.btn-snapshot-restore')).toBeVisible();
      await page.locator('.btn-snapshot-restore').click();
      await page.locator('#modalBtnConfirm').click();

      await expect(page.locator('#snapshotPreview')).toContainText(/Restored: After restore|Restauré : After restore/);
      await expect(page.locator('#snapshotPreview')).toContainText(/Could not restore: Restore folder A|Impossible de restaurer : Restore folder A/);
      await expect(page.locator('#snapshotPreview')).toContainText(/failed: 1|échecs : 1/);
      const snapshots = await page.evaluate(async () => (await chrome.storage.local.get('bookmarkSnapshots')).bookmarkSnapshots);
      expect(snapshots.some(snapshot => snapshot.id === 'snap_partial_error_e2e')).toBe(true);
    } finally {
      await cleanup(context, tmpDir);
    }
  });
});

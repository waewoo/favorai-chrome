import { describe, expect, it } from 'vitest';
import {
  BOOKMARK_SNAPSHOT_VERSION,
  captureBookmarkSnapshot,
  createBookmarkSnapshot,
  getBookmarkSnapshot,
  saveBookmarkSnapshot,
  serializeBookmarkTree
} from '../../src/background/snapshots.js';
import { MAX_BOOKMARK_SNAPSHOTS } from '../../src/utils/constants.js';

describe('bookmark snapshots', () => {
  it('serializes the complete tree with bookmark metadata only', () => {
    const tree = serializeBookmarkTree({
      id: '0',
      title: 'Root',
      provider: 'must not be copied',
      children: [{ id: '1', title: 'Bar', children: [{ id: '10', title: 'Site', url: 'https://example.com' }] }]
    });

    expect(tree).toEqual({
      id: '0',
      title: 'Root',
      parentId: null,
      children: [{
        id: '1',
        title: 'Bar',
        parentId: '0',
        children: [{ id: '10', title: 'Site', parentId: '1', url: 'https://example.com' }]
      }]
    });
    expect(JSON.stringify(tree)).not.toContain('provider');
  });

  it('saves and reads a versioned snapshot without LLM configuration', async () => {
    const snapshot = createBookmarkSnapshot({ id: '0', title: 'Root', children: [] }, { timestamp: 123 });
    let stored = {};
    chrome.storage.local.get.mockImplementation(async () => stored);
    chrome.storage.local.set.mockImplementation(async values => { stored = { ...stored, ...values }; });

    await saveBookmarkSnapshot(snapshot);
    const loaded = await getBookmarkSnapshot(snapshot.id);

    expect(loaded).toEqual(snapshot);
    expect(loaded.version).toBe(BOOKMARK_SNAPSHOT_VERSION);
    expect(JSON.stringify(loaded)).not.toMatch(/apiKey|provider|model|prompt/i);
  });

  it('keeps the newest snapshots within the retention limit', async () => {
    let stored = { bookmarkSnapshots: Array.from({ length: MAX_BOOKMARK_SNAPSHOTS }, (_, index) => ({ id: `old-${index}` })) };
    chrome.storage.local.get.mockImplementation(async () => stored);
    chrome.storage.local.set.mockImplementation(async values => { stored = { ...stored, ...values }; });

    await saveBookmarkSnapshot(createBookmarkSnapshot({ id: '0', title: 'Root', children: [] }, { id: 'new', timestamp: 1 }));

    expect(stored.bookmarkSnapshots).toHaveLength(MAX_BOOKMARK_SNAPSHOTS);
    expect(stored.bookmarkSnapshots[0].id).toBe('new');
    expect(stored.bookmarkSnapshots.at(-1).id).toBe(`old-${MAX_BOOKMARK_SNAPSHOTS - 2}`);
  });

  it('captures the selected subtree before saving it', async () => {
    const subtree = { id: '42', title: 'Work', children: [] };
    chrome.bookmarks.getSubTree.mockResolvedValue([subtree]);
    chrome.storage.local.get.mockResolvedValue({});

    const snapshot = await captureBookmarkSnapshot('42');

    expect(chrome.bookmarks.getSubTree).toHaveBeenCalledWith('42');
    expect(snapshot.scope).toEqual({ bookmarkFolderId: '42' });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ bookmarkSnapshots: [snapshot] });
  });

  it('rejects malformed bookmark trees', () => {
    expect(() => createBookmarkSnapshot({ id: '0', title: 'Root', children: [{ title: 'Missing id' }] })).toThrow();
  });
});

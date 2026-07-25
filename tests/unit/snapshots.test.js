import { describe, expect, it } from 'vitest';
import {
  BOOKMARK_SNAPSHOT_VERSION,
  captureBookmarkSnapshot,
  buildBookmarkSnapshotDiff,
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

  it('builds a deterministic preview with URL remapping and no bookmark mutations', () => {
    const snapshot = createBookmarkSnapshot({
      id: '0', title: 'Root', children: [{ id: '1', title: 'Work', children: [{ id: '10', title: 'Old title', url: 'https://example.com' }] }]
    }, { id: 'snap-test', timestamp: 1 });
    const current = {
      id: '0', title: 'Root', children: [
        { id: '2', title: 'Work', children: [] },
        { id: '99', title: 'New title', url: 'https://example.com' }
      ]
    };

    const diff = buildBookmarkSnapshotDiff(snapshot, current);

    expect(diff.summary.renames).toBe(1);
    expect(diff.summary.moves).toBe(1);
    expect(diff.summary.creates).toBe(0);
    expect(diff.summary.deletes).toBe(0);
    expect(diff.operations.map(operation => operation.type)).toEqual(['rename_bookmark', 'move_bookmark']);
    expect(chrome.bookmarks.create).not.toHaveBeenCalled();
    expect(chrome.bookmarks.move).not.toHaveBeenCalled();
  });

  it('creates folders before their bookmark children and reports missing parents', () => {
    const snapshot = createBookmarkSnapshot({
      id: '0', title: 'Root', children: [{ id: '1', title: 'New folder', children: [{ id: '10', title: 'Site', url: 'https://example.com' }] }]
    }, { id: 'snap-create', timestamp: 1 });
    const diff = buildBookmarkSnapshotDiff(snapshot, { id: '0', title: 'Root', children: [] });

    expect(diff.operations.map(operation => operation.type)).toEqual(['create_folder', 'create_bookmark']);
    expect(diff.operations[1].params.parentId).toBe(diff.operations[0].params.tempId);
    expect(diff.unrestorable).toEqual([]);
  });
});

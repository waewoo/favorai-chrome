import { describe, expect, it } from 'vitest';
import {
  BOOKMARK_SNAPSHOT_VERSION,
  captureBookmarkSnapshot,
  buildBookmarkSnapshotDiff,
  createBookmarkSnapshot,
  getBookmarkSnapshots,
  getBookmarkSnapshot,
  getSnapshotExportPayload,
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

  it('preserves explicitly declared parent IDs during serialization', () => {
    expect(serializeBookmarkTree({
      id: '0',
      title: 'Root',
      parentId: null,
      children: [{ id: '1', title: 'Bar', parentId: 'parent' }]
    })).toEqual({
      id: '0',
      title: 'Root',
      parentId: null,
      children: [{ id: '1', title: 'Bar', parentId: 'parent' }]
    });

    expect(serializeBookmarkTree({ id: 'untitled', title: null })).toEqual({
      id: 'untitled',
      title: '',
      parentId: null
    });
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

  it('generates a stable-format ID when the caller does not provide one', () => {
    const snapshot = createBookmarkSnapshot({ id: '0', title: 'Root', children: [] }, { timestamp: 123 });

    expect(snapshot.id).toMatch(/^snap_123_[a-z0-9]+$/);
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

    chrome.bookmarks.getSubTree.mockResolvedValue(null);
    await expect(captureBookmarkSnapshot('missing-folder')).rejects.toThrow('Unable to read bookmarks');
  });

  it('captures the full bookmark tree and reports an empty tree', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.storage.local.get.mockResolvedValue({});

    const snapshot = await captureBookmarkSnapshot();

    expect(chrome.bookmarks.getTree).toHaveBeenCalledWith();
    expect(snapshot.scope).toBeNull();

    chrome.bookmarks.getTree.mockResolvedValue([]);
    await expect(captureBookmarkSnapshot()).rejects.toThrow('Unable to read bookmarks');
  });

  it('returns an empty list and null for missing stored snapshots', async () => {
    expect(await getBookmarkSnapshots()).toEqual([]);
    expect(await getBookmarkSnapshot('missing')).toBeNull();
  });

  it('rejects invalid stored snapshots and malformed diff inputs', async () => {
    await expect(saveBookmarkSnapshot({ version: BOOKMARK_SNAPSHOT_VERSION, tree: null })).rejects.toThrow('Invalid bookmark snapshot');
    await expect(saveBookmarkSnapshot(null)).rejects.toThrow('Invalid bookmark snapshot');
    await expect(saveBookmarkSnapshot({ version: BOOKMARK_SNAPSHOT_VERSION, tree: { id: '0', title: 'Root', url: 42 } })).rejects.toThrow('Invalid bookmark snapshot');
    await expect(saveBookmarkSnapshot({ version: BOOKMARK_SNAPSHOT_VERSION, tree: { id: '0', title: 'Root', parentId: 42 } })).rejects.toThrow('Invalid bookmark snapshot');
    expect(() => buildBookmarkSnapshotDiff(null, { id: '0', title: 'Root', children: [] })).toThrow('Invalid bookmark snapshot');
    const validSnapshot = createBookmarkSnapshot({ id: '0', title: 'Root', children: [] });
    expect(() => buildBookmarkSnapshotDiff(validSnapshot, null)).toThrow('Invalid current bookmark tree');
    expect(() => getSnapshotExportPayload({ ...validSnapshot, tree: { id: '0', title: 'Root', apiKey: 'SECRET' } })).toThrow('Invalid bookmark snapshot');
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

  it('creates a rename operation when an existing bookmark URL changed', () => {
    const snapshot = createBookmarkSnapshot({
      id: '0', title: 'Root', children: [{ id: '1', title: 'Bar', children: [{ id: '10', title: 'Site', url: 'https://new.example' }] }]
    }, { id: 'snap-url-change', timestamp: 1 });
    const current = {
      id: '0', title: 'Root', children: [{ id: '1', title: 'Bar', children: [{ id: '10', title: 'Site', url: 'https://old.example' }] }]
    };

    const diff = buildBookmarkSnapshotDiff(snapshot, current);

    expect(diff.operations).toEqual([expect.objectContaining({
      type: 'rename_bookmark',
      params: expect.objectContaining({ nodeId: '10', newTitle: 'Site', newUrl: 'https://new.example' })
    })]);
  });

  it('matches a uniquely titled folder when its parent path has changed', () => {
    const snapshot = createBookmarkSnapshot({
      id: '0',
      title: 'Root',
      children: [{
        id: 'target-parent',
        title: 'Target parent',
        children: [{ id: 'target-child', title: 'Shared folder', children: [] }]
      }]
    }, { id: 'snap-title-match', timestamp: 1 });
    const current = {
      id: '0',
      title: 'Root',
      children: [{
        id: 'current-parent',
        title: 'Current parent',
        children: [{ id: 'current-child', title: 'Shared folder', children: [] }]
      }]
    };

    const diff = buildBookmarkSnapshotDiff(snapshot, current);

    expect(diff.operations.map(operation => operation.type)).toEqual(['create_folder', 'delete_folder']);
    expect(diff.operations.map(operation => operation.title)).toEqual(['Target parent', 'Current parent']);
  });

  it('exports only the authorized snapshot schema', () => {
    const snapshot = createBookmarkSnapshot({ id: '0', title: 'Root', children: [] }, {
      id: 'snap-export',
      timestamp: 1,
      bookmarkFolderId: '42'
    });
    const contaminated = {
      ...snapshot,
      apiKey: 'SECRET',
      provider: 'openai',
      model: 'secret-model',
      prompt: 'secret prompt',
      scope: { bookmarkFolderId: '42', apiKey: 'SECRET' }
    };

    const exported = getSnapshotExportPayload(contaminated);

    expect(Object.keys(exported)).toEqual(['version', 'id', 'timestamp', 'scope', 'tree']);
    expect(exported.scope).toEqual({ bookmarkFolderId: '42' });
    expect(JSON.stringify(exported)).not.toMatch(/SECRET|openai|secret-model|secret prompt/i);
  });

  it('omits an invalid scope from the exported snapshot', () => {
    const snapshot = createBookmarkSnapshot({ id: '0', title: 'Root', children: [] }, { id: 'snap-invalid-scope', timestamp: 1 });

    expect(getSnapshotExportPayload({ ...snapshot, scope: { bookmarkFolderId: 42 } }).scope).toBeNull();
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

  it('uses the bookmarks bar as the parent when the snapshot root is recreated', () => {
    const snapshot = {
      version: BOOKMARK_SNAPSHOT_VERSION,
      id: 'snap-root-create',
      timestamp: 1,
      scope: null,
      tree: { id: 'snapshot-root', title: 'Snapshot root', children: [] }
    };

    const diff = buildBookmarkSnapshotDiff(snapshot, { id: '0', title: 'Root', children: [] });

    expect(diff.operations).toEqual([expect.objectContaining({
      type: 'create_folder',
      params: expect.objectContaining({ parentId: '1' })
    })]);
  });

  it('renames folders without adding a bookmark URL update', () => {
    const snapshot = createBookmarkSnapshot({
      id: '0',
      title: 'Root',
      children: [{ id: '1', title: 'Renamed Bar', children: [] }]
    }, { id: 'snap-folder-rename', timestamp: 1 });

    const diff = buildBookmarkSnapshotDiff(snapshot, {
      id: '0',
      title: 'Root',
      children: [{ id: '1', title: 'Old Bar', children: [] }]
    });

    expect(diff.operations).toEqual([expect.objectContaining({
      type: 'rename_folder',
      params: { nodeId: '1', newTitle: 'Renamed Bar' }
    })]);
  });

  it('orders new folders before renames in the restoration preview', () => {
    const snapshot = createBookmarkSnapshot({
      id: '0',
      title: 'Root',
      children: [{
        id: '1',
        title: 'Bar',
        children: [
          { id: '10', title: 'Updated site', url: 'https://example.com' },
          { id: 'new-folder', title: 'New folder', children: [] }
        ]
      }]
    }, { id: 'snap-mixed-order', timestamp: 1 });
    const current = {
      id: '0',
      title: 'Root',
      children: [{
        id: '1',
        title: 'Bar',
        children: [{ id: '10', title: 'Old site', url: 'https://example.com' }]
      }]
    };

    const diff = buildBookmarkSnapshotDiff(snapshot, current);

    expect(diff.operations.map(operation => operation.type)).toEqual(['create_folder', 'rename_bookmark']);
  });

  it('reports a snapshot node whose declared parent is not restorable', () => {
    const snapshot = {
      version: BOOKMARK_SNAPSHOT_VERSION,
      id: 'snap-unrestorable',
      timestamp: 1,
      scope: null,
      tree: {
        id: '0',
        title: 'Root',
        parentId: null,
        children: [{
          id: '1',
          title: 'Bar',
          parentId: '0',
          children: [{
            id: '10',
            title: 'Site',
            parentId: 'missing-parent',
            url: 'https://example.com'
          }]
        }]
      }
    };

    const diff = buildBookmarkSnapshotDiff(snapshot, { id: '0', title: 'Root', children: [{ id: '1', title: 'Bar', children: [] }] });

    expect(diff.unrestorable).toEqual([expect.objectContaining({
      type: 'create_bookmark',
      title: 'Site',
      code: 'UNRESOLVED_PARENT',
      details: { parentId: 'missing-parent' }
    })]);
    expect(diff.summary.unrestorable).toBe(1);
  });

  it('orders multiple deletes and uses deterministic ordering for multiple renames', () => {
    const snapshot = createBookmarkSnapshot({
      id: '0', title: 'Root', children: [{ id: '1', title: 'Bar', children: [{ id: '10', title: 'First', url: 'https://first.example' }, { id: '11', title: 'Second', url: 'https://second.example' }] }]
    }, { id: 'snap-order', timestamp: 1 });
    const current = {
      id: '0', title: 'Root', children: [{
        id: '1', title: 'Bar', children: [
          { id: '10', title: 'First changed', url: 'https://first.example' },
          { id: '11', title: 'Second changed', url: 'https://second.example' },
          { id: '12', title: 'Extra one', url: 'https://extra-one.example' },
          { id: '13', title: 'Extra two', url: 'https://extra-two.example' }
        ]
      }]
    };

    const diff = buildBookmarkSnapshotDiff(snapshot, current);

    expect(diff.operations.map(operation => operation.type)).toEqual([
      'rename_bookmark', 'rename_bookmark', 'delete_bookmark', 'delete_bookmark'
    ]);
    expect(diff.operations.slice(2).map(operation => operation.targetId)).toEqual(['12', '13']);
  });

  it('deletes nested bookmarks before their containing folders', () => {
    const snapshot = createBookmarkSnapshot({
      id: '0',
      title: 'Root',
      children: [{ id: '1', title: 'Bar', children: [] }]
    }, { id: 'snap-delete-folder', timestamp: 1 });
    const current = {
      id: '0',
      title: 'Root',
      children: [{
        id: '1',
        title: 'Bar',
        children: [{
          id: '2',
          title: 'Temporary folder',
          children: [{ id: '3', title: 'Temporary bookmark', url: 'https://temporary.example' }]
        }]
      }]
    };

    const diff = buildBookmarkSnapshotDiff(snapshot, current);

    expect(diff.operations.map(operation => operation.type)).toEqual(['delete_bookmark', 'delete_folder']);
    expect(diff.operations.map(operation => operation.title)).toEqual(['Temporary bookmark', 'Temporary folder']);
  });
});

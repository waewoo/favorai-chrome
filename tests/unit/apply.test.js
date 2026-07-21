import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyChanges } from '../../src/background/apply.js';
import { buildBookmarkTreeFingerprint } from '../../src/background/tree-fingerprint.js';

describe('applyChanges', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('should apply folder creations, renames, moves, and deletions in sequence', async () => {
    // Mock getTree to return a simple bookmarks bar tree
    chrome.bookmarks.getTree.mockResolvedValue([
      {
        id: '0',
        title: 'Root',
        children: [
          {
            id: '1',
            title: 'Barre de favoris',
            children: [
              { id: '10', title: 'Old Bookmark', url: 'https://old.com', parentId: '1' }
            ]
          }
        ]
      }
    ]);

    // Mock chrome.bookmarks.get to return fake bookmark nodes when queried during apply
    chrome.bookmarks.get.mockImplementation(async (id) => {
      if (id === '10') {
        return [{ id: '10', title: 'Old Bookmark', url: 'https://old.com', parentId: '1' }];
      }
      return [];
    });

    // Mock chrome.bookmarks.getChildren to return empty arrays for removeEmptyFoldersRecursive
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    // Create mocks for creating folders
    chrome.bookmarks.create.mockResolvedValue({ id: 'real-new-folder-id', title: 'New Folder' });

    const approvedActionIds = ['act_1', 'act_2', 'act_3', 'act_4'];
    const pendingActions = [
      {
        id: 'act_1',
        type: 'create_folder',
        params: { tempId: 'new_folder_1', title: 'New Folder', parentId: '1', targetPath: 'Barre de favoris' }
      },
      {
        id: 'act_2',
        type: 'rename_bookmark',
        params: { nodeId: '10', newTitle: 'Renamed Bookmark' }
      },
      {
        id: 'act_3',
        type: 'move_bookmark',
        params: { nodeId: '10', newParentId: 'new_folder_1' }
      },
      {
        id: 'act_4',
        type: 'delete_dead',
        targetId: '10'
      }
    ];

    await applyChanges(approvedActionIds, pendingActions, 'complete', 'My test explanation');

    // Verify folder creation
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({ parentId: '1', title: 'New Folder' });

    // Verify rename (it should use the real node ID)
    expect(chrome.bookmarks.update).toHaveBeenCalledWith('10', { title: 'Renamed Bookmark' });

    // Verify move (it should resolve parentId using the real folder ID mapped from the tempId)
    expect(chrome.bookmarks.move).toHaveBeenCalledWith('10', { parentId: 'real-new-folder-id' });

    // Verify deletion
    expect(chrome.bookmarks.remove).toHaveBeenCalledWith('10');

    // Verify history storage with unique entry IDs (starts with ent_)
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reorgHistory: expect.arrayContaining([
          expect.objectContaining({
            explanation: 'My test explanation',
            entries: expect.arrayContaining([
              expect.objectContaining({
                id: expect.stringMatching(/^ent_/)
              })
            ])
          })
        ])
      }),
      expect.any(Function)
    );
  });

  it('should recursively delete empty folders while preserving non-empty ones and root folders', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([
      { id: '0', title: 'Root', children: [{ id: '1', title: 'Barre de favoris' }] }
    ]);

    // Mock getChildren:
    // - parentId = '0': returns Barre de favoris ('1')
    // - parentId = '1': returns '100' (empty folder) and '200' (non-empty folder)
    // - parentId = '100': returns empty array (initially)
    // - parentId = '200': returns a bookmark
    chrome.bookmarks.getChildren.mockImplementation(async (id) => {
      if (id === '0') {
        return [{ id: '1', title: 'Barre de favoris' }];
      }
      if (id === '1') {
        return [
          { id: '100', title: 'Empty Folder' },
          { id: '200', title: 'Non-empty Folder' }
        ];
      }
      if (id === '100') {
        return [];
      }
      if (id === '200') {
        return [{ id: '201', title: 'Bookmark', url: 'https://example.com', parentId: '200' }];
      }
      return [];
    });

    await applyChanges([], [], 'complete');

    // Check that removeTree was called on empty folder '100' but NOT on non-empty folder '200' or root folder '1'
    expect(chrome.bookmarks.removeTree).toHaveBeenCalledWith('100');
    expect(chrome.bookmarks.removeTree).not.toHaveBeenCalledWith('200');
  });

  it('should handle all chrome.bookmarks errors gracefully and continue processing', async () => {
    // 1. Mock getTree to throw an error (covers lines 25-27)
    chrome.bookmarks.getTree.mockRejectedValue(new Error('Failed to get tree'));

    // 2. Mock create to throw an error (covers lines 42-44)
    chrome.bookmarks.create.mockRejectedValue(new Error('Failed to create folder'));

    // 3. Mock get to return invalid or valid node, and mock update/move/remove to throw
    chrome.bookmarks.get.mockImplementation(async (id) => {
      if (id === 'node_to_delete_folder') {
        return [{ id: 'node_to_delete_folder', title: 'Folder to delete' }]; // No URL -> isFolder
      }
      return [{ id, title: 'Test Node', url: 'https://test.com', parentId: '1' }];
    });

    chrome.bookmarks.update.mockRejectedValue(new Error('Failed to update'));
    chrome.bookmarks.move.mockRejectedValue(new Error('Failed to move'));
    chrome.bookmarks.remove.mockRejectedValue(new Error('Failed to remove'));
    chrome.bookmarks.removeTree.mockRejectedValue(new Error('Failed to remove tree'));

    // Mock getChildren to throw (covers lines 124-125)
    chrome.bookmarks.getChildren.mockRejectedValue(new Error('Failed to get children'));

    const approvedActionIds = ['act_create', 'act_rename', 'act_move', 'act_delete_file', 'act_delete_folder'];
    const pendingActions = [
      {
        id: 'act_create',
        type: 'create_folder',
        params: { tempId: 'new_folder_100', title: 'New Folder Error', parentId: '1' }
      },
      {
        id: 'act_rename',
        type: 'rename_bookmark',
        params: { nodeId: '10', newTitle: 'Renamed Bookmark Error' }
      },
      {
        id: 'act_move',
        type: 'move_bookmark',
        params: { nodeId: '10', newParentId: '1' }
      },
      {
        id: 'act_delete_file',
        type: 'delete_duplicate',
        targetId: '10'
      },
      {
        id: 'act_delete_folder',
        type: 'delete_folder',
        targetId: 'node_to_delete_folder',
        params: { sourcePath: 'A > B > C' }
      }
    ];

    // Verify it runs without throwing uncaught exception
    await expect(applyChanges(approvedActionIds, pendingActions, 'complete')).resolves.not.toThrow();

    // Verify that the folder deletion is still applied for the cleanup scenario.
    expect(chrome.bookmarks.removeTree).toHaveBeenCalledWith('node_to_delete_folder');
  });

  it('deletes bookmarks before folders and keeps cleanup explicit after an error', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.get.mockResolvedValue([{ id: '10', title: 'A', url: 'https://a.com' }]);

    // Deletion sorting edge cases:
    // folder vs bookmark (a.type === 'delete_folder' && b.type !== 'delete_folder' -> 1)
    // bookmark vs folder (a.type !== 'delete_folder' && b.type === 'delete_folder' -> -1)
    // folder vs folder (both are delete_folder -> b.path - a.path depth split)
    // other type vs other type -> 0
    const pendingActions = [
      { id: 'act_folder_deep', type: 'delete_folder', targetId: '101', params: { sourcePath: 'A > B > C' } },
      { id: 'act_folder_shallow', type: 'delete_folder', targetId: '102', params: { sourcePath: 'A > B' } },
      { id: 'act_folder_no_path', type: 'delete_folder', targetId: '105', params: {} },
      { id: 'act_file_1', type: 'delete_duplicate', targetId: '103' },
      { id: 'act_file_2', type: 'delete_dead', targetId: '104' }
    ];

    // Mock getChildren for post-cleanup:
    // First run returns one child folder ('sub_empty')
    // Second run (nested getChildren) throws error (covers lines 140-141)
    chrome.bookmarks.getChildren.mockImplementation(async (id) => {
      if (id === '0') return [{ id: 'sub_empty', title: 'Sub' }];
      if (id === 'sub_empty') throw new Error('Nested getChildren failed');
      return [];
    });

    await applyChanges(['act_folder_deep', 'act_folder_shallow', 'act_folder_no_path', 'act_file_1', 'act_file_2'], pendingActions, 'complete');

    // Test post-cleanup removeTree error:
    // Make children call succeed but removeTree fail (covers lines 151-152)
    chrome.bookmarks.getChildren.mockImplementation(async (id) => {
      if (id === '0') return [{ id: 'sub_empty_2', title: 'Sub 2' }];
      if (id === 'sub_empty_2') return []; // Empty children!
      return [];
    });
    chrome.bookmarks.removeTree.mockRejectedValue(new Error('Failed to remove empty folder'));

    await applyChanges([], [], 'complete');
    expect(chrome.bookmarks.removeTree).toHaveBeenCalledWith('sub_empty_2');
  });

  it('should skip folder creation and moves if the target parent folder (new_ prefix) is not resolved', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    
    const approvedActionIds = ['act_unresolved_create', 'act_unresolved_move'];
    const pendingActions = [
      {
        id: 'act_unresolved_create',
        type: 'create_folder',
        params: { tempId: 'new_folder_sub', title: 'Sub Folder', parentId: 'new_parent_unresolved', targetPath: 'A > B' }
      },
      {
        id: 'act_unresolved_move',
        type: 'move_bookmark',
        params: { nodeId: '10', newParentId: 'new_parent_unresolved' }
      }
    ];

    chrome.bookmarks.create.mockClear();
    chrome.bookmarks.move.mockClear();

    await applyChanges(approvedActionIds, pendingActions, 'complete');

    expect(chrome.bookmarks.create).not.toHaveBeenCalled();
    expect(chrome.bookmarks.move).not.toHaveBeenCalled();
  });

  it('should handle bookmarks.get returning empty or failing gracefully', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    
    chrome.bookmarks.get.mockImplementation(async (id) => {
      if (id === '99') throw new Error('Query error');
      return [];
    });

    const approvedActionIds = ['act_move_empty', 'act_delete_empty', 'act_move_fail'];
    const pendingActions = [
      {
        id: 'act_move_empty',
        type: 'move_bookmark',
        title: 'Bookmark To Move',
        params: { nodeId: '100', newParentId: '1' }
      },
      {
        id: 'act_delete_empty',
        type: 'delete_duplicate',
        targetId: '100'
      },
      {
        id: 'act_move_fail',
        type: 'move_bookmark',
        title: 'Bookmark Fail',
        params: { nodeId: '99', newParentId: '1' }
      }
    ];

    chrome.bookmarks.move.mockClear();
    chrome.bookmarks.remove.mockClear();

    await applyChanges(approvedActionIds, pendingActions, 'complete');

    expect(chrome.bookmarks.move).toHaveBeenCalledWith('100', { parentId: '1' });
    expect(chrome.bookmarks.remove).toHaveBeenCalledWith('100');
    expect(chrome.bookmarks.move).toHaveBeenCalledWith('99', { parentId: '1' });
  });

  it('applies renames and deletions according to the actual node type', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([
      {
        id: '0',
        title: 'Root',
        children: [
          {
            id: '1',
            title: 'Barre de favoris',
            children: [
              { id: '10', title: 'Bookmark', url: 'https://old.com', parentId: '1' },
              { id: '30', title: 'Folder B', parentId: '1', children: [] }
            ]
          }
        ]
      }
    ]);

    chrome.bookmarks.get.mockImplementation(async (id) => {
      if (id === '10') {
        return [{ id: '10', title: 'Bookmark', url: 'https://old.com', parentId: '1' }];
      }
      if (id === '30') {
        return [{ id: '30', title: 'Folder B', parentId: '1' }];
      }
      if (id === '31') {
        throw new Error('Get failed for rename catch');
      }
      if (id === '40') {
        return [{ id: '40', title: 'Folder to Delete', parentId: '1' }];
      }
      if (id === '99') {
        throw new Error('Get failed');
      }
      return [];
    });

    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const pendingActions = [
      {
        id: 'act_rename_fold_fail',
        type: 'rename_folder',
        params: { nodeId: '31', newTitle: 'Renamed Folder Fail' }
      },
      {
        id: 'act_rename_fold',
        type: 'rename_folder',
        params: { nodeId: '30', newTitle: 'Renamed Folder' }
      },
      {
        id: 'act_rename_book_url',
        type: 'rename_bookmark',
        params: { nodeId: '10', newTitle: 'Renamed Bookmark URL', newUrl: 'https://newurl.com' }
      },
      {
        id: 'act_delete_missing',
        type: 'delete_duplicate',
        targetId: '99'
      },
      {
        id: 'act_delete_empty_arr',
        type: 'delete_duplicate',
        targetId: '100'
      },
      {
        id: 'act_delete_folder_no_url',
        type: 'delete_folder',
        targetId: '40',
        params: { sourcePath: undefined }
      },
      {
        id: 'act_delete_folder_with_path',
        type: 'delete_folder',
        targetId: '30',
        params: { sourcePath: 'A > B' }
      }
    ];

    const approvedActionIds = [
      'act_rename_fold_fail',
      'act_rename_fold',
      'act_rename_book_url',
      'act_delete_missing',
      'act_delete_empty_arr',
      'act_delete_folder_no_url',
      'act_delete_folder_with_path'
    ];

    await applyChanges(approvedActionIds, pendingActions, 'complete');

    expect(chrome.bookmarks.update).toHaveBeenCalledWith('31', { title: 'Renamed Folder Fail' });
    expect(chrome.bookmarks.update).toHaveBeenCalledWith('30', { title: 'Renamed Folder' });
    expect(chrome.bookmarks.update).toHaveBeenCalledWith('10', { title: 'Renamed Bookmark URL', url: 'https://newurl.com' });
    expect(chrome.bookmarks.remove).toHaveBeenCalledWith('99');
    expect(chrome.bookmarks.remove).toHaveBeenCalledWith('100');
    expect(chrome.bookmarks.removeTree).toHaveBeenCalledWith('40');
    expect(chrome.bookmarks.removeTree).toHaveBeenCalledWith('30');
  });

  it('should not call saveSessionToHistory when no history entries are produced', async () => {
    // All actions fail or produce no history entries
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.create.mockRejectedValue(new Error('Create failed'));

    const pendingActions = [
      {
        id: 'act_fail',
        type: 'create_folder',
        params: { tempId: 'new_fail', title: 'Fail Folder', parentId: '1', targetPath: 'A' }
      }
    ];

    // Stub getChildren to avoid side-effects in post-cleanup
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.storage.local.set.mockClear();

    await applyChanges(['act_fail'], pendingActions, 'complete', 'No history produced');

    // saveSessionToHistory should NOT have been called since no operations succeeded
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  it('should filter out non-approved actions and only process approved ones', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.create.mockResolvedValue({ id: 'created-id', title: 'Approved' });
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const pendingActions = [
      { id: 'approved', type: 'create_folder', params: { tempId: 'new_1', title: 'Approved', parentId: '1', targetPath: 'A' } },
      { id: 'rejected', type: 'create_folder', params: { tempId: 'new_2', title: 'Rejected', parentId: '1', targetPath: 'A' } },
    ];

    chrome.bookmarks.create.mockClear();
    await applyChanges(['approved'], pendingActions, 'complete');

    // Only the approved action should have triggered a create call
    expect(chrome.bookmarks.create).toHaveBeenCalledTimes(1);
    expect(chrome.bookmarks.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Approved' }));
    expect(chrome.bookmarks.create).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Rejected' }));
  });

  it('should sort create_folder by targetPath depth so shallow folders are created first', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const createOrder = [];
    chrome.bookmarks.create.mockImplementation(async ({ title }) => {
      createOrder.push(title);
      return { id: `id-${title}`, title };
    });

    const pendingActions = [
      // Submitted in reverse depth order to prove the sort works
      { id: 'act_deep', type: 'create_folder', params: { tempId: 'new_deep', title: 'Child', parentId: '1', targetPath: 'Root > Parent' } },
      { id: 'act_shallow', type: 'create_folder', params: { tempId: 'new_shallow', title: 'Parent', parentId: '1', targetPath: 'Root' } },
    ];

    await applyChanges(['act_deep', 'act_shallow'], pendingActions, 'complete');

    expect(createOrder[0]).toBe('Parent');
    expect(createOrder[1]).toBe('Child');
  });

  it('should resolve parentId "0" (Chrome virtual root) to "1"', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.create.mockResolvedValue({ id: 'new-id', title: 'Folder' });
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const pendingActions = [
      { id: 'act_root', type: 'create_folder', params: { tempId: 'new_root', title: 'Folder', parentId: '0', targetPath: 'Root' } },
    ];

    await applyChanges(['act_root'], pendingActions, 'complete');

    expect(chrome.bookmarks.create).toHaveBeenCalledWith({ parentId: '1', title: 'Folder' });
  });

  it('should record correct history entry fields for create, rename, move, and delete', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([
      {
        id: '0', title: 'Root',
        children: [{ id: '1', title: 'Bar', children: [
          { id: '10', title: 'Old Title', url: 'https://old.com', parentId: '1' }
        ]}]
      }
    ]);

    chrome.bookmarks.create.mockResolvedValue({ id: 'folder-id', title: 'New Folder' });
    chrome.bookmarks.get.mockImplementation(async (id) => {
      if (id === '10') return [{ id: '10', title: 'Old Title', url: 'https://old.com', parentId: '1' }];
      return [];
    });
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.storage.local.set.mockClear();

    const pendingActions = [
      { id: 'a1', type: 'create_folder', params: { tempId: 'new_f', title: 'New Folder', parentId: '1', targetPath: 'Bar' } },
      { id: 'a2', type: 'rename_bookmark', params: { nodeId: '10', newTitle: 'New Title' } },
      { id: 'a3', type: 'move_bookmark', params: { nodeId: '10', newParentId: 'new_f' } },
      { id: 'a4', type: 'delete_dead', targetId: '10' },
    ];

    await applyChanges(['a1', 'a2', 'a3', 'a4'], pendingActions, 'minimal', 'detail test');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reorgHistory: expect.arrayContaining([
          expect.objectContaining({
            entries: expect.arrayContaining([
              expect.objectContaining({ type: 'create_folder', title: 'New Folder', realId: 'folder-id' }),
              expect.objectContaining({ type: 'rename', nodeId: '10', oldTitle: 'Old Title', newTitle: 'New Title', oldUrl: 'https://old.com', newUrl: null, isFolder: false }),
              expect.objectContaining({ type: 'move', nodeId: '10', isFolder: false, oldParentId: '1', newParentId: 'folder-id' }),
              expect.objectContaining({ type: 'delete', nodeId: '10', title: 'Old Title', url: 'https://old.com', isFolder: false }),
            ])
          })
        ])
      }),
      expect.any(Function)
    );
  });

  it('should record correct history entry for rename_folder (isFolder true) and rename with newUrl', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.get.mockImplementation(async (id) => {
      if (id === '50') return [{ id: '50', title: 'Old Folder', parentId: '1' }]; // no url → folder
      if (id === '60') return [{ id: '60', title: 'Old BM', url: 'https://old.com', parentId: '1' }];
      return [];
    });
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.storage.local.set.mockClear();

    const pendingActions = [
      { id: 'r1', type: 'rename_folder', params: { nodeId: '50', newTitle: 'New Folder' } },
      { id: 'r2', type: 'rename_bookmark', params: { nodeId: '60', newTitle: 'New BM', newUrl: 'https://new.com' } },
    ];

    await applyChanges(['r1', 'r2'], pendingActions, 'complete');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reorgHistory: expect.arrayContaining([
          expect.objectContaining({
            entries: expect.arrayContaining([
              expect.objectContaining({ type: 'rename', nodeId: '50', isFolder: true, oldUrl: null }),
              expect.objectContaining({ type: 'rename', nodeId: '60', isFolder: false, newUrl: 'https://new.com' }),
            ])
          })
        ])
      }),
      expect.any(Function)
    );
  });

  it('should record correct history entry for move_folder and use act.title fallback', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    // get returns empty for node '70' → title falls back to act.title
    chrome.bookmarks.get.mockResolvedValue([]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.storage.local.set.mockClear();

    const pendingActions = [
      { id: 'm1', type: 'move_folder', title: 'Fallback Title', params: { nodeId: '70', newParentId: '1' } },
    ];

    await applyChanges(['m1'], pendingActions, 'complete');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reorgHistory: expect.arrayContaining([
          expect.objectContaining({
            entries: expect.arrayContaining([
              expect.objectContaining({ type: 'move', nodeId: '70', title: 'Fallback Title' }),
            ])
          })
        ])
      }),
      expect.any(Function)
    );
  });

  it('skips mutations whose temporary parent folder cannot be resolved', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const pendingActions = [
      { id: 'c1', type: 'create_folder', params: { tempId: 'new_sub', title: 'Sub', parentId: 'new_unresolved', targetPath: 'A > B' } },
      { id: 'm1', type: 'move_bookmark', title: 'My BM', params: { nodeId: '10', newParentId: 'new_unresolved' } },
    ];

    await applyChanges(['c1', 'm1'], pendingActions, 'complete');

    expect(chrome.bookmarks.create).not.toHaveBeenCalled();
    expect(chrome.bookmarks.move).not.toHaveBeenCalled();
  });

  it('should delete bookmarks before folders and deepest folders first', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.get.mockImplementation(async (id) => [{ id, title: `Node ${id}`, url: id === 'bm1' || id === 'bm2' ? 'https://x.com' : undefined, parentId: '1' }]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const opLog = [];
    chrome.bookmarks.remove.mockImplementation(async (id) => { opLog.push({ op: 'remove', id }); });
    chrome.bookmarks.removeTree.mockImplementation(async (id) => { opLog.push({ op: 'removeTree', id }); });

    const pendingActions = [
      // Submitted in "wrong" order: folder first, then bookmarks
      { id: 'df1', type: 'delete_folder', targetId: 'folder-shallow', params: { sourcePath: 'A' } },
      { id: 'df2', type: 'delete_folder', targetId: 'folder-deep', params: { sourcePath: 'A > B > C' } },
      { id: 'dd1', type: 'delete_duplicate', targetId: 'bm1' },
      { id: 'dd2', type: 'delete_dead', targetId: 'bm2' },
    ];

    await applyChanges(['df1', 'df2', 'dd1', 'dd2'], pendingActions, 'complete');

    // All remove (bookmark) ops must come before any removeTree (folder) ops
    const firstRemoveTree = opLog.findIndex(o => o.op === 'removeTree');
    const lastRemove = opLog.map((o, i) => o.op === 'remove' ? i : -1).filter(i => i >= 0).pop();
    expect(lastRemove).toBeLessThan(firstRemoveTree);

    // Deeper folder must be removed before shallower folder
    const treeCalls = opLog.filter(o => o.op === 'removeTree');
    expect(treeCalls[0].id).toBe('folder-deep');
    expect(treeCalls[1].id).toBe('folder-shallow');
  });

  it('should NOT add url to update payload when act is rename_folder even if newUrl is set', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.get.mockImplementation(async (id) =>
      [{ id, title: 'Old Folder', parentId: '1' }] // no url → is a folder
    );
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const pendingActions = [
      { id: 'r1', type: 'rename_folder', params: { nodeId: '50', newTitle: 'New Name', newUrl: 'https://should-be-ignored.com' } },
    ];

    chrome.bookmarks.update.mockClear();
    await applyChanges(['r1'], pendingActions, 'complete');

    // For rename_folder, url must NOT be in the update payload regardless of newUrl
    expect(chrome.bookmarks.update).toHaveBeenCalledWith('50', { title: 'New Name' });
    expect(chrome.bookmarks.update).not.toHaveBeenCalledWith('50', expect.objectContaining({ url: expect.anything() }));
  });

  it('should use empty-string defaults for oldTitle and parentId when bookmarks.get returns empty', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    // get returns empty array → nodes?.[0] is falsy → initial defaults used
    chrome.bookmarks.get.mockResolvedValue([]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.storage.local.set.mockClear();

    const pendingActions = [
      { id: 'r1', type: 'rename_bookmark', params: { nodeId: '99', newTitle: 'Renamed' } },
    ];

    await applyChanges(['r1'], pendingActions, 'complete');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reorgHistory: expect.arrayContaining([
          expect.objectContaining({
            entries: expect.arrayContaining([
              expect.objectContaining({ type: 'rename', nodeId: '99', oldTitle: '', isFolder: true }),
            ])
          })
        ])
      }),
      expect.any(Function)
    );
  });

  it('should use isFolder=false default for move when bookmarks.get returns empty', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.get.mockResolvedValue([]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.storage.local.set.mockClear();

    const pendingActions = [
      { id: 'm1', type: 'move_bookmark', title: 'FallbackTitle', params: { nodeId: '99', newParentId: '1' } },
    ];

    await applyChanges(['m1'], pendingActions, 'complete');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reorgHistory: expect.arrayContaining([
          expect.objectContaining({
            entries: expect.arrayContaining([
              expect.objectContaining({ type: 'move', nodeId: '99', isFolder: false, title: 'FallbackTitle' }),
            ])
          })
        ])
      }),
      expect.any(Function)
    );
  });

  it('should use the nodeMap-derived path (not raw ID) in create_folder history entry', async () => {
    // Tests the try { nodeMap = buildNodeMap(trees[0]) } block
    // With populated nodeMap: getPathFromMap('11', map) → 'Dev' (named folder)
    // With empty nodeMap:     getPathFromMap('11', {})  → '11' (raw ID fallback)
    chrome.bookmarks.getTree.mockResolvedValue([{
      id: '0', title: 'Root',
      children: [{
        id: '1', title: 'Bar', children: [
          { id: '11', title: 'Dev', parentId: '1', children: [] }
        ]
      }]
    }]);
    chrome.bookmarks.create.mockResolvedValue({ id: 'new-id', title: 'MyFolder' });
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.storage.local.set.mockClear();

    const pendingActions = [
      { id: 'a1', type: 'create_folder', params: { tempId: 'new_f', title: 'MyFolder', parentId: '11', targetPath: 'Bar > Dev' } }
    ];

    await applyChanges(['a1'], pendingActions, 'complete');

    const lastSet = chrome.storage.local.set.mock.calls.at(-1);
    const entry = lastSet[0].reorgHistory[0].entries.find(e => e.type === 'create_folder');
    // Populated nodeMap: path resolves to named path, not the raw ID '11'
    expect(entry.targetPath).toBe('Dev');
    expect(entry.targetPath).not.toBe('11');
  });

  it('should generate entry IDs in format ent_<9chars>_<timestamp>', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.create.mockResolvedValue({ id: 'fid', title: 'F' });
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.storage.local.set.mockClear();

    await applyChanges(
      ['a1'],
      [{ id: 'a1', type: 'create_folder', params: { tempId: 'new_x', title: 'F', parentId: '1', targetPath: 'A' } }],
      'complete'
    );

    const lastSet = chrome.storage.local.set.mock.calls.at(-1);
    const entryId = lastSet[0].reorgHistory[0].entries[0].id;
    expect(entryId).toMatch(/^ent_[a-z0-9]{9}_\d+$/);
  });

  it('should not delete Chrome root folders (CHROME_ROOT_IDS) even when empty', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.getChildren.mockImplementation(async (id) => {
      if (id === '0') return [{ id: '1', title: 'Barre de favoris' }]; // root folder '1'
      if (id === '1') return []; // root folder is empty
      return [];
    });
    chrome.bookmarks.removeTree.mockClear();

    await applyChanges([], [], 'complete');

    // '1' is in CHROME_ROOT_IDS — must never be deleted
    expect(chrome.bookmarks.removeTree).not.toHaveBeenCalledWith('1');
  });

  it('should skip (continue) bookmarks with url in removeEmptyFoldersRecursive', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.getChildren.mockImplementation(async (id) => {
      if (id === '0') return [
        { id: 'bm1', title: 'A Bookmark', url: 'https://bm.com' }, // bookmark — must be skipped
        { id: 'folder1', title: 'Empty Folder' }                    // empty folder — must be deleted
      ];
      if (id === 'folder1') return [];
      return [];
    });
    chrome.bookmarks.removeTree.mockClear();

    await applyChanges([], [], 'complete');

    // Only the empty folder should be removed, not the bookmark
    expect(chrome.bookmarks.removeTree).toHaveBeenCalledWith('folder1');
    expect(chrome.bookmarks.removeTree).not.toHaveBeenCalledWith('bm1');
    // getChildren must NOT have been called on the bookmark
    const getChildrenIds = chrome.bookmarks.getChildren.mock.calls.map(c => c[0]);
    expect(getChildrenIds).not.toContain('bm1');
  });

  it('should record post-cleanup history entry with correct type, isFolder, and sourcePath', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.getChildren.mockImplementation(async (id) => {
      if (id === '0') return [{ id: 'empty1', title: 'Dead Folder' }];
      if (id === 'empty1') return [];
      return [];
    });
    chrome.bookmarks.removeTree.mockResolvedValue(undefined);
    chrome.storage.local.set.mockClear();

    await applyChanges([], [], 'complete');

    const lastSet = chrome.storage.local.set.mock.calls.at(-1);
    const entry = lastSet[0].reorgHistory[0].entries.find(e => e.nodeId === 'empty1');
    expect(entry).toBeDefined();
    expect(entry.type).toBe('delete');
    expect(entry.isFolder).toBe(true);
    expect(entry.sourcePath).toContain('post-cleanup');
  });

  it('should sort create_folder correctly when some folders have no targetPath (|| fallback)', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const createOrder = [];
    chrome.bookmarks.create.mockImplementation(async ({ title }) => {
      createOrder.push(title);
      return { id: `id-${title}`, title };
    });

    const pendingActions = [
      // Deep path first (submitted reversed) so the sort must reorder it
      { id: 'a1', type: 'create_folder', params: { tempId: 'new_1', title: 'Deep', parentId: '1', targetPath: 'A > B > C' } },
      // No targetPath → depth 1 via `|| ''` fallback on both a and b sides
      { id: 'a2', type: 'create_folder', params: { tempId: 'new_2', title: 'NoPathA', parentId: '1' } },
      { id: 'a3', type: 'create_folder', params: { tempId: 'new_3', title: 'NoPathB', parentId: '1' } },
    ];

    await applyChanges(['a1', 'a2', 'a3'], pendingActions, 'complete');

    // Deep (depth 3) must be created last; the two no-path items (depth 1) come first
    const deepIndex = createOrder.indexOf('Deep');
    expect(deepIndex).toBe(2);
    expect(createOrder[0]).toMatch(/NoPath/);
    expect(createOrder[1]).toMatch(/NoPath/);
  });

  it('should refuse to apply when bookmarks changed since analysis', async () => {
    const analyzedTree = {
      id: '0',
      title: 'Root',
      children: [{ id: '1', title: 'Bar', children: [{ id: '10', title: 'Old', url: 'https://old.com', parentId: '1' }] }]
    };
    const changedTree = {
      id: '0',
      title: 'Root',
      children: [{ id: '1', title: 'Bar', children: [{ id: '10', title: 'Changed', url: 'https://old.com', parentId: '1' }] }]
    };

    chrome.bookmarks.getTree.mockResolvedValue([changedTree]);
    chrome.bookmarks.create.mockClear();

    await expect(applyChanges(
      ['a1'],
      [{ id: 'a1', type: 'create_folder', params: { tempId: 'new_x', title: 'F', parentId: '1', targetPath: 'Bar' } }],
      'complete',
      '',
      { expectedTreeFingerprint: buildBookmarkTreeFingerprint(analyzedTree) }
    )).rejects.toThrow(/changed|favoris/i);

    expect(chrome.bookmarks.create).not.toHaveBeenCalled();
  });

  it('should validate the selected bookmark subtree before applying scoped changes', async () => {
    const subtree = {
      id: '42',
      title: 'Work',
      parentId: '1',
      children: [{ id: '10', title: 'Old', url: 'https://old.com', parentId: '42' }]
    };

    chrome.bookmarks.getSubTree.mockResolvedValue([subtree]);
    chrome.bookmarks.create.mockResolvedValue({ id: 'created-in-scope', title: 'Scoped Folder' });
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.storage.local.set.mockClear();

    await applyChanges(
      ['a1'],
      [{ id: 'a1', type: 'create_folder', params: { tempId: 'new_scoped', title: 'Scoped Folder', parentId: '42', targetPath: 'Work' } }],
      'minimal',
      'scoped',
      {
        bookmarkFolderId: '42',
        expectedTreeFingerprint: buildBookmarkTreeFingerprint(subtree)
      }
    );

    expect(chrome.bookmarks.getSubTree).toHaveBeenCalledWith('42');
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({ parentId: '42', title: 'Scoped Folder' });
  });

  it('should use fallback consistency error when i18n message is missing for changed bookmarks', async () => {
    const analyzedTree = { id: '0', title: 'Root', children: [] };
    const changedTree = { id: '0', title: 'Changed', children: [] };

    chrome.bookmarks.getTree.mockResolvedValue([changedTree]);
    chrome.i18n.getMessage.mockReturnValueOnce('');

    await expect(applyChanges(
      ['a1'],
      [{ id: 'a1', type: 'create_folder', params: { tempId: 'new_x', title: 'F', parentId: '1' } }],
      'complete',
      '',
      { expectedTreeFingerprint: buildBookmarkTreeFingerprint(analyzedTree) }
    )).rejects.toThrow('Bookmarks changed since analysis.');
  });

  it('should report failures with correct title fallbacks for rename/move/delete', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    // Line 86: rename with empty newTitle → falls back to oldTitle
    chrome.bookmarks.get.mockResolvedValue([{ id: '10', title: 'OldName', url: 'https://x.com', parentId: '1' }]);
    chrome.bookmarks.update.mockRejectedValue(new Error('rename fail'));
    const r1 = await applyChanges(
      ['a1'],
      [{ id: 'a1', type: 'rename_bookmark', params: { nodeId: '10', newTitle: '' } }],
      'complete'
    );
    expect(r1.failures[0].title).toBe('OldName');

    // Line 107: move where get returns empty title → falls back to act.title
    chrome.bookmarks.get.mockResolvedValue([{ id: '20', title: '', parentId: '1' }]);
    chrome.bookmarks.move.mockRejectedValue(new Error('move fail'));
    const r2 = await applyChanges(
      ['a2'],
      [{ id: 'a2', type: 'move_bookmark', title: 'FallbackTitle', params: { nodeId: '20', newParentId: '1' } }],
      'complete'
    );
    expect(r2.failures[0].title).toBe('FallbackTitle');

    // Line 134: delete where get returned empty (old=null) and remove fails → '' fallback
    chrome.bookmarks.get.mockResolvedValue([]);
    chrome.bookmarks.remove.mockRejectedValue(new Error('delete fail'));
    const r3 = await applyChanges(
      ['a3'],
      [{ id: 'a3', type: 'delete_duplicate', targetId: '99' }],
      'complete'
    );
    expect(r3.failures[0].title).toBe('');
  });

  it('should use fallback consistency error when guarded tree reads fail', async () => {
    chrome.bookmarks.getTree.mockRejectedValue(new Error('tree unavailable'));
    chrome.i18n.getMessage.mockReturnValueOnce('');

    await expect(applyChanges(
      [],
      [],
      'complete',
      '',
      { expectedTreeFingerprint: 'fnv1a:expected' }
    )).rejects.toThrow('Bookmarks changed since analysis.');
  });
});

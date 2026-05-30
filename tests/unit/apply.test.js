import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { applyChanges } from '../../src/background/apply.js';

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

    // Verify removeTree was called for folder deletion (covers line 99)
    expect(chrome.bookmarks.removeTree).toHaveBeenCalledWith('node_to_delete_folder');
  });

  it('should cover deletion sorting priorities and post-cleanup inner errors', async () => {
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

  it('should cover rename and delete branch variations', async () => {
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
});


import { describe, it, expect } from 'vitest';
import { saveSessionToHistory, rollbackSession } from '../../src/background/history.js';

describe('saveSessionToHistory', () => {
  it('should store session and explanation in chrome.storage.local', async () => {
    const entries = [{ type: 'move', nodeId: '10', oldParentId: '1' }];

    await saveSessionToHistory(entries, 'complete', 'My AI explanation text');

    expect(chrome.storage.local.get).toHaveBeenCalledWith(['reorgHistory'], expect.any(Function));
    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reorgHistory: expect.arrayContaining([
          expect.objectContaining({
            mode: 'complete',
            explanation: 'My AI explanation text',
            entries: entries
          })
        ])
      }),
      expect.any(Function)
    );
  });

  it('should use default mode minimal when mode is not provided', async () => {
    const entries = [{ type: 'move', nodeId: '10', oldParentId: '1' }];

    await saveSessionToHistory(entries);

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reorgHistory: expect.arrayContaining([
          expect.objectContaining({
            mode: 'minimal'
          })
        ])
      }),
      expect.any(Function)
    );
  });
});

describe('rollbackSession', () => {
  it('should undo operations in reverse order', async () => {
    const historyEntries = [
      { type: 'create_folder', realId: 'new-folder-1' },
      { type: 'rename', nodeId: '10', oldTitle: 'Old Title' },
      { type: 'move', nodeId: '11', oldParentId: '2' },
      { type: 'delete', nodeId: '12', parentId: '1', title: 'Deleted Book', url: 'https://example.com' }
    ];

    await rollbackSession(historyEntries);

    // Reversed order execution:
    // 1. delete rollback (recreates bookmark)
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({
      parentId: '1',
      title: 'Deleted Book',
      url: 'https://example.com'
    });

    // 2. move rollback
    expect(chrome.bookmarks.move).toHaveBeenCalledWith('11', { parentId: '2' });

    // 3. rename rollback
    expect(chrome.bookmarks.update).toHaveBeenCalledWith('10', { title: 'Old Title' });

    // 4. create_folder rollback (removes folder)
    expect(chrome.bookmarks.remove).toHaveBeenCalledWith('new-folder-1');
  });

  it('should append session to existing history', async () => {
    // Mock existing history
    const existingHistory = [
      {
        sessionId: 'sess_123',
        mode: 'minimal',
        entries: [{ type: 'move', nodeId: '5' }]
      }
    ];

    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ reorgHistory: existingHistory });
    });

    const newEntries = [{ type: 'rename', nodeId: '10' }];
    await saveSessionToHistory(newEntries, 'complete', 'New explanation');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reorgHistory: expect.arrayContaining([
          expect.objectContaining({ mode: 'minimal' }),
          expect.objectContaining({ mode: 'complete' })
        ])
      }),
      expect.any(Function)
    );
  });

  it('should handle errors gracefully during rollbackSession and continue', async () => {
    const historyEntries = [
      { type: 'create_folder', realId: 'new-folder-error' },
      { type: 'rename', nodeId: '10', oldTitle: 'Old Title Error' }
    ];

    // Mock chrome.bookmarks APIs to throw errors
    chrome.bookmarks.remove.mockRejectedValue(new Error('Mock delete failed'));
    chrome.bookmarks.update.mockRejectedValue(new Error('Mock update failed'));

    // Check that it completes successfully without rethrowing
    await expect(rollbackSession(historyEntries)).resolves.not.toThrow();

    expect(chrome.bookmarks.remove).toHaveBeenCalledWith('new-folder-error');
    expect(chrome.bookmarks.update).toHaveBeenCalledWith('10', { title: 'Old Title Error' });
  });

  it('should include oldUrl when renaming a bookmark with URL', async () => {
    const historyEntries = [
      { type: 'rename', nodeId: '20', oldTitle: 'Old Bookmark', oldUrl: 'https://old.com' }
    ];

    await rollbackSession(historyEntries);

    expect(chrome.bookmarks.update).toHaveBeenCalledWith('20', {
      title: 'Old Bookmark',
      url: 'https://old.com'
    });
  });

  it('should recreate deleted bookmark without URL if url is not provided', async () => {
    const historyEntries = [
      { type: 'delete', nodeId: '15', parentId: '1', title: 'No URL Bookmark' }
    ];

    await rollbackSession(historyEntries);

    expect(chrome.bookmarks.create).toHaveBeenCalledWith({
      parentId: '1',
      title: 'No URL Bookmark'
    });
  });

  it('should map old IDs to new IDs during rollback', async () => {
    const historyEntries = [
      { type: 'move', nodeId: '25', oldParentId: '2' },
      { type: 'delete', nodeId: '25', parentId: '1', title: 'Recreated Folder' }
    ];

    // When delete is rolled back, it creates a new bookmark with id 'new-id-999'
    chrome.bookmarks.create.mockResolvedValue({ id: 'new-id-999' });

    await rollbackSession(historyEntries);

    // First call in reversed order: delete rollback creates and maps the ID
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({
      parentId: '1',
      title: 'Recreated Folder'
    });

    // Second call: move should use the mapped ID
    expect(chrome.bookmarks.move).toHaveBeenCalledWith('new-id-999', { parentId: '2' });
  });
});

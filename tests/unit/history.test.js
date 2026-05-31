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

  it('should cap history to MAX_HISTORY_SESSIONS', async () => {
    const existingHistory = Array.from({ length: 50 }, (_, i) => ({
      sessionId: `sess_${i}`,
      mode: 'minimal',
      entries: []
    }));

    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ reorgHistory: existingHistory });
    });

    const newEntries = [{ type: 'rename', nodeId: '10' }];
    await saveSessionToHistory(newEntries, 'complete', 'Capping test');

    expect(chrome.storage.local.set).toHaveBeenCalledWith(
      expect.objectContaining({
        reorgHistory: expect.any(Array)
      }),
      expect.any(Function)
    );

    const callArgs = chrome.storage.local.set.mock.calls;
    const lastCall = callArgs[callArgs.length - 1];
    const savedHistory = lastCall[0].reorgHistory;
    
    expect(savedHistory).toHaveLength(50);
    expect(savedHistory[0].explanation).toBe('Capping test');
  });

  it('should NOT trim history when length equals MAX_HISTORY_SESSIONS after adding (boundary)', async () => {
    // Set existing history to exactly MAX_HISTORY_SESSIONS - 1 entries
    const existingHistory = Array.from({ length: 29 }, (_, i) => ({
      sessionId: `sess_${i}`,
      mode: 'minimal',
      entries: []
    }));

    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ reorgHistory: existingHistory });
    });

    await saveSessionToHistory([{ type: 'move', nodeId: '1' }], 'complete', 'Boundary test');

    const callArgs = chrome.storage.local.set.mock.calls;
    const lastCall = callArgs[callArgs.length - 1];
    const savedHistory = lastCall[0].reorgHistory;

    // Should have exactly 30 entries (29 existing + 1 new) — no pop() called
    expect(savedHistory).toHaveLength(30);
    expect(savedHistory[0].explanation).toBe('Boundary test');
  });

  it('should serialize concurrent saveSessionToHistory calls via queue', async () => {
    // Both calls should succeed in sequence without data corruption
    const p1 = saveSessionToHistory([{ type: 'move', nodeId: '1' }], 'minimal', 'First');
    const p2 = saveSessionToHistory([{ type: 'rename', nodeId: '2' }], 'complete', 'Second');
    await Promise.all([p1, p2]);

    expect(chrome.storage.local.set).toHaveBeenCalledTimes(2);
  });

  it('should use empty string as default explanation when not provided', async () => {
    const entries = [{ type: 'move', nodeId: '1' }];
    await saveSessionToHistory(entries, 'minimal');

    const callArgs = chrome.storage.local.set.mock.calls;
    const lastCall = callArgs[callArgs.length - 1];
    const saved = lastCall[0].reorgHistory[0];
    expect(saved.explanation).toBe('');
  });

  it('should generate session IDs starting with sess_', async () => {
    await saveSessionToHistory([{ type: 'move', nodeId: '1' }], 'complete', 'Test');

    const callArgs = chrome.storage.local.set.mock.calls;
    const lastCall = callArgs[callArgs.length - 1];
    const saved = lastCall[0].reorgHistory[0];
    expect(saved.id).toMatch(/^sess_\d+$/);
  });

  it('should start with empty history when storage returns no existing history', async () => {
    chrome.storage.local.get.mockImplementationOnce((keys, callback) => {
      callback({});  // no reorgHistory key → must start with []
    });

    await saveSessionToHistory([{ type: 'move', nodeId: '1' }], 'minimal', 'Solo');

    const callArgs = chrome.storage.local.set.mock.calls;
    const lastCall = callArgs[callArgs.length - 1];
    const savedHistory = lastCall[0].reorgHistory;
    expect(savedHistory).toHaveLength(1);
    expect(savedHistory[0].explanation).toBe('Solo');
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

  it('should NOT include url in update when oldUrl is falsy (strict: no url key)', async () => {
    chrome.bookmarks.update.mockClear();
    const historyEntries = [
      { type: 'rename', nodeId: '30', oldTitle: 'Folder', oldUrl: null }
    ];

    await rollbackSession(historyEntries);

    const updateCall = chrome.bookmarks.update.mock.calls.find(c => c[0] === '30');
    expect(updateCall).toBeDefined();
    // url key must be absent, not just undefined — use toStrictEqual
    expect(updateCall[1]).toStrictEqual({ title: 'Folder' });
  });

  it('should NOT trigger delete branch for unknown entry types', async () => {
    chrome.bookmarks.create.mockClear();
    const historyEntries = [
      { type: 'unknown_type', nodeId: '99' }
    ];

    await rollbackSession(historyEntries);
    expect(chrome.bookmarks.create).not.toHaveBeenCalled();
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

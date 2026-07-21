import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/llm/index.js', () => ({
  suggestBookmarkLocation: vi.fn()
}));

import { suggestBookmarkLocation } from '../../src/llm/index.js';

async function waitForPendingSuggestion(bookmarkId, type) {
  await vi.waitFor(() => {
    const call = chrome.storage.local.set.mock.calls.find(
      ([data]) => data.pendingAutoBookmarkSuggestions?.[bookmarkId]?.type === type
    );
    expect(call).toBeTruthy();
  });
}

function buildTree() {
  return [{
    id: '0',
    title: 'Root',
    children: [
      {
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          {
            id: '2',
            title: 'Projects',
            children: []
          }
        ]
      }
    ]
  }];
}

async function loadOrchestrator() {
  vi.resetModules();
  const orchestrator = await import('../../src/background/orchestrator.js');
  const createdListener = chrome.bookmarks.onCreated.addListener.mock.calls[0]?.[0];
  expect(createdListener).toBeTypeOf('function');
  return { createdListener, applyAutoBookmarkSuggestion: orchestrator.applyAutoBookmarkSuggestion };
}

describe('auto bookmark classification on create', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      cb({
        provider: 'google',
        apiUrl: 'https://generativelanguage.googleapis.com',
        modelName: 'gemini-3.5-flash',
        debugMode: false,
        maxTokens: 4096,
        autoMoveNewBookmarks: true,
        autoMoveConfidenceThreshold: 0.8
      });
    });

    chrome.storage.local.get.mockImplementation((keys, cb) => {
      if (Array.isArray(keys) && keys.includes('apiKey')) {
        cb({ apiKey: 'local-secret' });
        return;
      }
      cb({});
    });

    chrome.bookmarks.getTree.mockResolvedValue(buildTree());
    chrome.bookmarks.get.mockResolvedValue([{ id: 'bm-1', title: 'Example bookmark', parentId: '1' }]);
    chrome.bookmarks.move.mockResolvedValue({ id: 'bm-1', parentId: '2' });
    chrome.bookmarks.create.mockResolvedValue({ id: 'created-folder', title: 'Projects' });
    chrome.windows.create.mockResolvedValue({ id: 99 });
  });

  it('moves the bookmark automatically when confidence meets the threshold', async () => {
    vi.mocked(suggestBookmarkLocation).mockResolvedValue(JSON.stringify({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'Matches project work.',
      suggestedTitle: 'Example bookmark',
      confidence: 0.93
    }));

    const { createdListener } = await loadOrchestrator();
    chrome.bookmarks.move.mockClear();
    chrome.windows.create.mockClear();
    chrome.storage.local.set.mockClear();

    await createdListener('bm-1', {
      id: 'bm-1',
      title: 'Example bookmark',
      url: 'https://example.com',
      parentId: '1'
    });
    await vi.waitFor(() => expect(chrome.bookmarks.move).toHaveBeenCalledWith('bm-1', { parentId: '2' }));

    expect(chrome.bookmarks.move).toHaveBeenCalledWith('bm-1', { parentId: '2' });
    expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'popup',
      url: expect.stringContaining('mode=autoclassify')
    }));
  });

  it('stores a pending suggestion and opens the popup when auto-move is disabled or confidence is low', async () => {
    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      cb({
        provider: 'google',
        apiUrl: 'https://generativelanguage.googleapis.com',
        modelName: 'gemini-3.5-flash',
        debugMode: false,
        maxTokens: 4096,
        autoMoveNewBookmarks: true,
        autoMoveConfidenceThreshold: 0.8
      });
    });

    vi.mocked(suggestBookmarkLocation).mockResolvedValue(JSON.stringify({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'Looks related but not certain enough.',
      confidence: 0.42
    }));

    const { createdListener } = await loadOrchestrator();
    chrome.bookmarks.move.mockClear();
    chrome.windows.create.mockClear();
    chrome.storage.local.set.mockClear();

    await createdListener('bm-2', {
      id: 'bm-2',
      title: 'Low confidence bookmark',
      url: 'https://example.org',
      parentId: '1'
    });
    await waitForPendingSuggestion('bm-2', 'suggestion');

    expect(chrome.bookmarks.move).not.toHaveBeenCalled();
    expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'popup',
      url: expect.stringContaining('mode=autoclassify')
    }));

    const pendingCall = chrome.storage.local.set.mock.calls.find(call => call[0].pendingAutoBookmarkSuggestions?.['bm-2']?.type === 'suggestion');
    expect(pendingCall).toBeTruthy();
    expect(pendingCall[0].pendingAutoBookmarkSuggestions['bm-2']).toEqual(expect.objectContaining({
      type: 'suggestion',
      confidence: 0.42,
      threshold: 0.8,
      autoMoveEnabled: true
    }));
  });

  it('opens the popup immediately and shows loading while the LLM response is pending', async () => {
    let resolveSuggestion;
    vi.mocked(suggestBookmarkLocation).mockImplementation(() => new Promise((resolve) => {
      resolveSuggestion = resolve;
    }));

    const { createdListener } = await loadOrchestrator();
    chrome.windows.create.mockClear();
    chrome.storage.local.set.mockClear();

    createdListener('bm-4', {
      id: 'bm-4',
      title: 'Loading bookmark',
      url: 'https://loading.example',
      parentId: '1'
    });

    await vi.waitFor(() => expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'popup',
      url: expect.stringContaining('mode=autoclassify')
    })));

    expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'popup',
      url: expect.stringContaining('mode=autoclassify')
    }));

    const loadingCall = chrome.storage.local.set.mock.calls.find(call => call[0].pendingAutoBookmarkSuggestions?.['bm-4']?.type === 'loading');
    expect(loadingCall).toBeTruthy();

    resolveSuggestion(JSON.stringify({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'Resolved after loading.',
      confidence: 0.42
    }));

    await waitForPendingSuggestion('bm-4', 'suggestion');

    const suggestionCall = chrome.storage.local.set.mock.calls.find(call => call[0].pendingAutoBookmarkSuggestions?.['bm-4']?.type === 'suggestion');
    expect(suggestionCall).toBeTruthy();
  });

  it('stores an error state and opens the popup when the LLM call fails', async () => {
    vi.mocked(suggestBookmarkLocation).mockRejectedValue(new Error('Backend unavailable'));

    const { createdListener } = await loadOrchestrator();
    chrome.windows.create.mockClear();
    chrome.storage.local.set.mockClear();

    await createdListener('bm-3', {
      id: 'bm-3',
      title: 'Broken bookmark',
      url: 'https://broken.example',
      parentId: '1'
    });
    await waitForPendingSuggestion('bm-3', 'error');

    expect(chrome.windows.create).toHaveBeenCalled();
    const pendingCall = chrome.storage.local.set.mock.calls.find(call => call[0].pendingAutoBookmarkSuggestions?.['bm-3']?.type === 'error');
    expect(pendingCall).toBeTruthy();
    expect(pendingCall[0].pendingAutoBookmarkSuggestions['bm-3']).toEqual(expect.objectContaining({
      type: 'error'
    }));
  });

  it('does not auto-classify bookmarks created through the manual save flow', async () => {
    vi.mocked(suggestBookmarkLocation).mockResolvedValue(JSON.stringify({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'Should not be used.',
      confidence: 0.99
    }));

    const { createdListener } = await loadOrchestrator();
    const messageHandler = chrome.runtime.onMessage.addListener.mock.calls.at(-1)?.[0];
    expect(messageHandler).toBeTypeOf('function');

    chrome.bookmarks.create.mockImplementation((data, cb) => {
      const created = { id: 'manual-created', ...data };
      createdListener(created.id, created);
      if (cb) cb(created);
      return Promise.resolve(created);
    });

    const sendResponse = vi.fn();
    messageHandler({
      action: 'save_manual_bookmark',
      bookmark: {
        title: 'Manual bookmark',
        url: 'https://manual.example',
        parentId: '1'
      }
    }, {}, sendResponse);

    await new Promise(resolve => setImmediate(resolve));

    expect(suggestBookmarkLocation).not.toHaveBeenCalled();
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it('still classifies a normal bookmark when the managed-folder check fails', async () => {
    vi.mocked(suggestBookmarkLocation).mockResolvedValue(JSON.stringify({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'Normal bookmark.',
      confidence: 0.42
    }));
    const { createdListener } = await loadOrchestrator();
    chrome.storage.local.get.mockImplementationOnce(() => {
      throw new Error('storage temporarily unavailable');
    });
    createdListener('bm-storage-error', {
      id: 'bm-storage-error',
      title: 'Normal bookmark',
      url: 'https://storage-error.example',
      parentId: '1'
    });

    await waitForPendingSuggestion('bm-storage-error', 'suggestion');
    expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'popup',
      url: expect.stringContaining('mode=autoclassify')
    }));
  });

  it('classifies a user-created bookmark placed inside the managed folder', async () => {
    vi.mocked(suggestBookmarkLocation).mockResolvedValue(JSON.stringify({
      action: 'use_existing',
      targetFolderId: '2',
      explanation: 'User-created bookmark inside managed folder.',
      confidence: 0.42
    }));
    const { createdListener } = await loadOrchestrator();
    chrome.storage.local.get.mockImplementation((keys, cb) => {
      if (Array.isArray(keys) && keys.includes('apiKey')) cb({ apiKey: 'local-secret' });
      else cb({ mostUsedBookmarksFolderId: 'managed-folder', mostUsedBookmarksSystemCopyIds: [] });
    });

    createdListener('manual-in-managed', {
      id: 'manual-in-managed',
      title: 'Manual bookmark in managed folder',
      url: 'https://manual-managed.example',
      parentId: 'managed-folder'
    });

    await waitForPendingSuggestion('manual-in-managed', 'suggestion');
    expect(chrome.windows.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'popup',
      url: expect.stringContaining('mode=autoclassify')
    }));
  });

  it('ignores a system-created managed-folder copy', async () => {
    const { createdListener } = await loadOrchestrator();
    chrome.storage.local.get.mockImplementation((keys, cb) => {
      if (Array.isArray(keys) && keys.includes('apiKey')) cb({ apiKey: 'local-secret' });
      else cb({ mostUsedBookmarksFolderId: 'managed-folder', mostUsedBookmarksSystemCopyIds: ['system-copy'] });
    });

    createdListener('system-copy', {
      id: 'system-copy',
      title: 'Managed copy',
      url: 'https://system-copy.example',
      parentId: 'managed-folder'
    });

    await new Promise(resolve => setTimeout(resolve, 150));
    expect(chrome.windows.create).not.toHaveBeenCalled();
  });

  it('applies the manual title and folder choice from a pending suggestion', async () => {
    chrome.bookmarks.get.mockResolvedValue([{ id: 'bm-5', title: 'Original title', url: 'https://example.com', parentId: '1' }]);

    const { applyAutoBookmarkSuggestion } = await loadOrchestrator();
    await applyAutoBookmarkSuggestion(
      { id: 'bm-5', title: 'Original title', url: 'https://example.com', parentId: '1' },
      { action: 'use_existing', targetFolderId: '2', explanation: 'Suggested folder.' },
      { 1: { id: '1', title: 'Bookmarks Bar', parentId: '0' }, 2: { id: '2', title: 'Projects', parentId: '1' } },
      '1',
      'Renamed bookmark'
    );

    expect(chrome.bookmarks.update).toHaveBeenCalledWith('bm-5', { title: 'Renamed bookmark' });
    expect(chrome.bookmarks.move).toHaveBeenCalledWith('bm-5', { parentId: '1' });
  });

  it('rolls back a manual rename when the following move fails', async () => {
    chrome.bookmarks.get.mockResolvedValue([{ id: 'bm-6', title: 'Original title', url: 'https://example.com', parentId: '1' }]);
    chrome.bookmarks.move.mockRejectedValue(new Error('Move failed'));

    const { applyAutoBookmarkSuggestion } = await loadOrchestrator();
    await expect(applyAutoBookmarkSuggestion(
      { id: 'bm-6', title: 'Original title', url: 'https://example.com', parentId: '1' },
      { action: 'use_existing', targetFolderId: '2', explanation: 'Suggested folder.' },
      { 1: { id: '1', title: 'Bookmarks Bar', parentId: '0' }, 2: { id: '2', title: 'Projects', parentId: '1' } },
      '2',
      'Renamed bookmark'
    )).rejects.toThrow('Move failed');

    expect(chrome.bookmarks.update).toHaveBeenNthCalledWith(1, 'bm-6', { title: 'Renamed bookmark' });
    expect(chrome.bookmarks.update).toHaveBeenNthCalledWith(2, 'bm-6', { title: 'Original title', url: 'https://example.com' });
  });

});

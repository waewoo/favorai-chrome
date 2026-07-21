import { describe, expect, it } from 'vitest';
import { historyUrlKey } from '../../src/utils/historyUrlKey.js';
import {
  normalizeWindowDays,
  getMostUsedBookmarks,
  MOST_USED_FOLDER_TITLE,
  refreshMostUsedBookmarks,
  rankMostUsedBookmarks,
  queueMostUsedRefresh,
  setMostUsedWindow
} from '../../src/background/most-used.js';

describe('most-used bookmarks', () => {
  it('normalizes only the supported history windows', () => {
    expect(normalizeWindowDays('7')).toBe(7);
    expect(normalizeWindowDays(90)).toBe(90);
    expect(normalizeWindowDays('invalid')).toBe(30);
  });

  it('uses a conservative key that keeps protocol and query differences distinct', () => {
    expect(historyUrlKey('https://EXAMPLE.com/path#section')).toBe('https://example.com/path');
    expect(historyUrlKey('http://example.com/path')).not.toBe(historyUrlKey('https://example.com/path'));
    expect(historyUrlKey('https://example.com/path?a=1')).not.toBe(historyUrlKey('https://example.com/path?a=2'));
    expect(historyUrlKey('javascript:alert(1)')).toBeNull();
    expect(historyUrlKey('https://')).toBeNull();
    expect(historyUrlKey('http://example.com:80/path')).toBe('http://example.com/path');
    expect(historyUrlKey('https://example.com:443/path')).toBe('https://example.com/path');
  });

  it('ranks bookmarked URLs in the selected window with deterministic ties', async () => {
    const now = 2000000000000;
    chrome.bookmarks.getTree.mockResolvedValue([{
      id: '0', children: [
        { id: '2', title: 'B', url: 'https://b.example/' },
        { id: '1', title: 'A', url: 'https://a.example/' },
        { id: '3', title: 'Unsafe', url: 'javascript:alert(1)' }
      ]
    }]);
    chrome.history.search.mockResolvedValue([
      { url: 'https://a.example/' }, { url: 'https://b.example/' }
    ]);
    chrome.history.getVisits.mockImplementation(async ({ url }) => {
      if (url.includes('a.example')) return [{ visitTime: now - 100 }, { visitTime: now - 200 }];
      return [{ visitTime: now - 100 }, { visitTime: now - 300 }];
    });

    const result = await rankMostUsedBookmarks(30, now);

    expect(result.state).toBe('ready');
    expect(result.items.map(item => item.id)).toEqual(['1', '2']);
    expect(result.items[0]).toMatchObject({ visitCount: 2, lastVisitTime: now - 100 });
  });

  it('returns an empty state when no bookmark has a visit in the window', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [{ id: '1', url: 'https://a.example/' }] }]);
    chrome.history.search.mockResolvedValue([{ url: 'https://a.example/' }]);
    chrome.history.getVisits.mockResolvedValue([{ visitTime: 1 }]);

    await expect(rankMostUsedBookmarks(7, 1000000000)).resolves.toEqual({ state: 'empty', items: [] });
  });

  it('returns an unavailable state when History cannot be queried', async () => {
    chrome.history.search.mockRejectedValue(new Error('permission denied'));
    await expect(rankMostUsedBookmarks(30)).resolves.toEqual({ state: 'history_unavailable', items: [] });
  });

  it('returns an unavailable state when a required Chrome API is missing', async () => {
    chrome.history.getVisits = undefined;
    await expect(rankMostUsedBookmarks(30)).resolves.toEqual({ state: 'history_unavailable', items: [] });
  });

  it('returns an unavailable state when bookmark retrieval fails', async () => {
    chrome.bookmarks.getTree.mockRejectedValue(new Error('bookmark failure'));
    await expect(rankMostUsedBookmarks(30)).resolves.toEqual({ state: 'history_unavailable', items: [] });
  });

  it('ignores a history lookup failure for one bookmark', async () => {
    const now = 2000000000000;
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [{ id: '1', url: 'https://a.example/' }] }]);
    chrome.history.search.mockResolvedValue([{ url: 'https://a.example/' }]);
    chrome.history.getVisits.mockRejectedValue(new Error('visit failure'));

    await expect(rankMostUsedBookmarks(30, now)).resolves.toEqual({ state: 'empty', items: [] });
  });

  it('handles missing visit lists and preserves a visit timestamp of zero', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [{ id: '1', url: 'https://a.example/' }] }]);
    chrome.history.search.mockResolvedValue([{ url: 'https://a.example/' }]);
    chrome.history.getVisits.mockResolvedValueOnce(null);

    await expect(rankMostUsedBookmarks(30, 0)).resolves.toEqual({ state: 'empty', items: [] });

    chrome.history.getVisits.mockResolvedValueOnce([{ visitTime: 0 }]);
    const result = await rankMostUsedBookmarks(30, 0);

    expect(result).toMatchObject({ state: 'ready' });
    expect(result.items[0]).toMatchObject({ visitCount: 1, lastVisitTime: 0 });
  });

  it('can rank bookmarks when history search is unavailable', async () => {
    const now = 2000000000000;
    chrome.history.search = undefined;
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [{ id: '1', url: 'https://a.example/' }] }]);
    chrome.history.getVisits.mockResolvedValue([{ visitTime: now - 1 }]);

    const result = await rankMostUsedBookmarks(30, now);

    expect(result).toMatchObject({ state: 'ready' });
    expect(result.items[0]).toMatchObject({ id: '1', visitCount: 1 });
  });

  it('does not rank copies already inside the managed folder', async () => {
    const now = 2000000000000;
    chrome.bookmarks.getTree.mockResolvedValue([{
      id: '0', children: [
        { id: '1', title: 'Original', url: 'https://a.example/' },
        { id: 'managed', title: 'Most used', children: [{ id: 'copy', title: 'Copy', url: 'https://a.example/' }] }
      ]
    }]);
    chrome.history.search.mockResolvedValue([{ url: 'https://a.example/' }]);
    chrome.history.getVisits.mockResolvedValue([{ visitTime: now - 1 }]);

    const result = await rankMostUsedBookmarks(30, now, 'managed');

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('1');
  });

  it('creates the managed folder and copies the current ranking into it', async () => {
    const now = Date.now();
    chrome.storage.sync.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksWindowDays: 30 });
      return Promise.resolve({ mostUsedBookmarksWindowDays: 30 });
    });
    chrome.storage.local.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksSystemCopyIds: ['previous-copy'] });
      return Promise.resolve({ mostUsedBookmarksSystemCopyIds: ['previous-copy'] });
    });
    chrome.bookmarks.get.mockResolvedValue([]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.bookmarks.create
      .mockResolvedValueOnce({ id: 'managed', title: '⭐ Les plus consultés', parentId: '1' })
      .mockResolvedValueOnce({ id: 'copy', title: 'A', url: 'https://a.example/', parentId: 'managed' });
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [{ id: '1', title: 'A', url: 'https://a.example/' }] }]);
    chrome.history.search.mockResolvedValue([{ url: 'https://a.example/' }]);
    chrome.history.getVisits.mockResolvedValue([{ visitTime: now - 1 }]);

    const result = await refreshMostUsedBookmarks();

    expect(result.folderId).toBe('managed');
    expect(chrome.bookmarks.create).toHaveBeenNthCalledWith(1, { parentId: '1', title: '⭐ Les plus consultés' });
    expect(chrome.bookmarks.create).toHaveBeenNthCalledWith(2, { parentId: 'managed', title: 'A', url: 'https://a.example/' });
  });

  it('removes stale managed copies before writing the refreshed ranking', async () => {
    const now = Date.now();
    chrome.storage.sync.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksWindowDays: 30 });
      return Promise.resolve({ mostUsedBookmarksWindowDays: 30 });
    });
    chrome.storage.local.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksFolderId: 'managed' });
      return Promise.resolve({ mostUsedBookmarksFolderId: 'managed' });
    });
    chrome.bookmarks.get.mockImplementation(async (id) => {
      if (id === 'managed') return [{ id: 'managed', title: 'Most used', parentId: '1' }];
      return [{ id: '1', title: 'Bookmarks Bar' }];
    });
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [{ id: '1', children: [{ id: 'a', url: 'https://a.example/' }] }] }]);
    chrome.history.search.mockResolvedValue([{ url: 'https://a.example/' }]);
    chrome.history.getVisits.mockResolvedValue([{ visitTime: now - 1 }]);
    chrome.bookmarks.getChildren.mockResolvedValue([
      { id: 'old-copy', url: 'https://old.example/' },
      { id: 'managed-folder', title: 'Nested folder', children: [] }
    ]);

    await refreshMostUsedBookmarks();

    expect(chrome.bookmarks.remove).toHaveBeenCalledWith('old-copy');
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({
      parentId: 'managed',
      title: 'https://a.example/',
      url: 'https://a.example/'
    });
  });

  it('uses the default bookmarks bar title when Chrome cannot read it', async () => {
    chrome.storage.sync.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksWindowDays: 30 });
      return Promise.resolve({ mostUsedBookmarksWindowDays: 30 });
    });
    chrome.storage.local.get.mockImplementation((_keys, callback) => {
      callback?.({});
      return Promise.resolve({});
    });
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [] }]);
    chrome.bookmarks.create.mockResolvedValue({ id: 'managed', title: 'Most used' });
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.bookmarks.get.mockRejectedValue(new Error('bar unavailable'));

    const result = await getMostUsedBookmarks();

    expect(result.folderPath).toBe('Bookmarks Bar > Most used');
  });

  it('moves an existing managed folder back to the bookmarks bar', async () => {
    chrome.storage.sync.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksWindowDays: 30 });
      return Promise.resolve({ mostUsedBookmarksWindowDays: 30 });
    });
    chrome.storage.local.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksFolderId: 'managed' });
      return Promise.resolve({ mostUsedBookmarksFolderId: 'managed' });
    });
    chrome.bookmarks.get.mockImplementation(async (id) => {
      if (id === 'managed') return [{ id: 'managed', title: 'Most used', parentId: '2' }];
      return [{ id: '1', title: 'Bookmarks Bar' }];
    });
    chrome.bookmarks.move.mockResolvedValue({ id: 'managed', title: 'Most used', parentId: '1' });
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [] }]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    await refreshMostUsedBookmarks();

    expect(chrome.bookmarks.move).toHaveBeenCalledWith('managed', { parentId: '1' });
  });

  it('does not treat a bookmark stored under the managed id as a folder', async () => {
    chrome.storage.sync.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksWindowDays: 30 });
      return Promise.resolve({ mostUsedBookmarksWindowDays: 30 });
    });
    chrome.storage.local.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksFolderId: 'managed' });
      return Promise.resolve({ mostUsedBookmarksFolderId: 'managed' });
    });
    chrome.bookmarks.get.mockImplementation(async (id) => {
      if (id === 'managed') return [{ id: 'managed', title: 'Not a folder', url: 'https://bookmark.example/' }];
      return [{ id: '1', title: 'Bookmarks Bar' }];
    });
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [] }]);
    chrome.bookmarks.create.mockResolvedValue({ id: 'replacement', title: MOST_USED_FOLDER_TITLE });
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const result = await refreshMostUsedBookmarks();

    expect(result.folderId).toBe('replacement');
  });

  it('recovers a previously created managed folder from the bookmarks bar tree', async () => {
    chrome.storage.sync.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksWindowDays: 30 });
      return Promise.resolve({ mostUsedBookmarksWindowDays: 30 });
    });
    chrome.storage.local.get.mockImplementation((_keys, callback) => {
      callback?.({});
      return Promise.resolve({});
    });
    chrome.bookmarks.get.mockResolvedValue([{ id: '1', title: 'Bookmarks Bar' }]);
    chrome.bookmarks.getTree.mockResolvedValue([{
      id: '0',
      children: [{ id: '1', title: 'Bookmarks Bar', children: [{ id: 'managed', title: MOST_USED_FOLDER_TITLE, children: [] }] }]
    }]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const result = await refreshMostUsedBookmarks();

    expect(result.folderId).toBe('managed');
    expect(chrome.bookmarks.create).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ mostUsedBookmarksFolderId: 'managed' }, expect.any(Function));
  });

  it('creates a replacement managed folder when the stored folder cannot be read', async () => {
    chrome.storage.sync.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksWindowDays: 30 });
      return Promise.resolve({ mostUsedBookmarksWindowDays: 30 });
    });
    chrome.storage.local.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksFolderId: 'missing' });
      return Promise.resolve({ mostUsedBookmarksFolderId: 'missing' });
    });
    chrome.bookmarks.get.mockRejectedValue(new Error('folder removed'));
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [] }]);
    chrome.bookmarks.create.mockResolvedValue({ id: 'replacement', title: MOST_USED_FOLDER_TITLE });
    chrome.bookmarks.getChildren.mockResolvedValue([]);

    const result = await refreshMostUsedBookmarks();

    expect(result.folderId).toBe('replacement');
    expect(chrome.bookmarks.create).toHaveBeenCalledWith({ parentId: '1', title: MOST_USED_FOLDER_TITLE });
  });

  it('queues a refresh and persists the selected window before scheduling the alarm', async () => {
    chrome.storage.sync.set.mockImplementation((_data, callback) => callback?.());
    chrome.storage.local.set.mockImplementation((_data, callback) => callback?.());

    await queueMostUsedRefresh();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({ mostUsedBookmarksDirty: true }, expect.any(Function));
    expect(chrome.alarms.create).toHaveBeenCalledWith('refreshMostUsedBookmarks', { delayInMinutes: 1 });
  });

  it('normalizes and persists a requested window before refreshing', async () => {
    chrome.storage.sync.set.mockImplementation((_data, callback) => callback?.());
    chrome.storage.sync.get.mockImplementation((_keys, callback) => {
      callback?.({ mostUsedBookmarksWindowDays: 30 });
      return Promise.resolve({ mostUsedBookmarksWindowDays: 30 });
    });
    chrome.storage.local.get.mockImplementation((_keys, callback) => {
      callback?.({});
      return Promise.resolve({});
    });
    chrome.bookmarks.get.mockResolvedValue([]);
    chrome.bookmarks.getChildren.mockResolvedValue([]);
    chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', children: [{ id: '1', children: [] }] }]);
    chrome.bookmarks.create.mockResolvedValue({ id: 'managed', title: 'Most used' });
    chrome.bookmarks.get.mockResolvedValue([{ id: 'managed', title: 'Most used', parentId: '1' }]);

    await setMostUsedWindow('unsupported');

    expect(chrome.storage.sync.set).toHaveBeenCalledWith({ mostUsedBookmarksWindowDays: 30 }, expect.any(Function));
  });
});

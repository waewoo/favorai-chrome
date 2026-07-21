import { historyUrlKey } from '../utils/historyUrlKey.js';

export const MOST_USED_ALARM = 'refreshMostUsedBookmarks';
export const MOST_USED_CACHE_KEY = 'mostUsedBookmarksCache';
export const MOST_USED_DIRTY_KEY = 'mostUsedBookmarksDirty';
export const MOST_USED_WINDOW_KEY = 'mostUsedBookmarksWindowDays';
export const MOST_USED_FOLDER_ID_KEY = 'mostUsedBookmarksFolderId';
export const MOST_USED_SYSTEM_COPY_IDS_KEY = 'mostUsedBookmarksSystemCopyIds';
export const MOST_USED_FOLDER_TITLE = '⭐ Les plus consultés';
const DEFAULT_WINDOW_DAYS = 30;
const MAX_RESULTS = 10;
const HISTORY_SEARCH_LIMIT = 10000;
const CONCURRENCY = 12;

function flattenBookmarks(node, result = [], excludedFolderId = null, excluded = false) {
  const insideExcludedFolder = excluded || String(node?.id) === String(excludedFolderId);
  if (node?.url && !insideExcludedFolder) result.push(node);
  for (const child of node?.children || []) flattenBookmarks(child, result, excludedFolderId, insideExcludedFolder);
  return result;
}

function storageGet(area, keys) {
  return new Promise(resolve => chrome.storage[area].get(keys, resolve));
}

function storageSet(area, values) {
  return new Promise(resolve => chrome.storage[area].set(values, resolve));
}

export function normalizeWindowDays(value) {
  const days = Number.parseInt(value, 10);
  return [7, 30, 90].includes(days) ? days : DEFAULT_WINDOW_DAYS;
}

async function mapConcurrent(items, worker) {
  const output = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      output[index] = await worker(items[index]);
    }
  }));
  return output;
}

export async function rankMostUsedBookmarks(days, now = Date.now(), managedFolderId = null) {
  if (!chrome.history?.getVisits || !chrome.bookmarks?.getTree) {
    return { state: 'history_unavailable', items: [] };
  }

  try {
    const trees = await chrome.bookmarks.getTree();
    const bookmarksByKey = new Map();
    for (const bookmark of flattenBookmarks(trees?.[0], [], managedFolderId)) {
      const key = historyUrlKey(bookmark.url);
      if (key && !bookmarksByKey.has(key)) bookmarksByKey.set(key, bookmark);
    }

    const startTime = now - normalizeWindowDays(days) * 86400000;
    let candidates = [...bookmarksByKey.entries()].map(([key, bookmark]) => ({ key, bookmark, url: bookmark.url }));
    if (chrome.history.search) {
      const historyItems = await chrome.history.search({ text: '', startTime, endTime: now, maxResults: HISTORY_SEARCH_LIMIT });
      const recentKeys = new Set(historyItems.map(item => historyUrlKey(item.url)).filter(Boolean));
      candidates = candidates.filter(({ key }) => recentKeys.has(key));
    }

    const ranked = (await mapConcurrent(candidates, async ({ key, bookmark, url }) => {
      try {
        const visits = await chrome.history.getVisits({ url });
        const inWindow = (visits || []).filter(visit => Number(visit.visitTime) >= startTime && Number(visit.visitTime) <= now);
        if (!inWindow.length) return null;
        return {
          id: bookmark.id,
          title: bookmark.title || bookmark.url,
          url: bookmark.url,
          key,
          visitCount: inWindow.length,
          lastVisitTime: Math.max(...inWindow.map(visit => Number(visit.visitTime) || 0))
        };
      } catch {
        return null;
      }
    })).filter(Boolean);

    ranked.sort((left, right) => right.visitCount - left.visitCount || right.lastVisitTime - left.lastVisitTime || left.key.localeCompare(right.key));
    return { state: ranked.length ? 'ready' : 'empty', items: ranked.slice(0, MAX_RESULTS) };
  } catch {
    return { state: 'history_unavailable', items: [] };
  }
}

async function getManagedFolder(folderId) {
  if (!folderId || !chrome.bookmarks?.get) return null;
  try {
    const [folder] = await chrome.bookmarks.get(folderId);
    return folder?.url ? null : folder;
  } catch {
    return null;
  }
}

async function ensureManagedFolder(folderId) {
  const existing = await getManagedFolder(folderId);
  if (existing) {
    if (String(existing.parentId) !== '1') {
      return chrome.bookmarks.move(existing.id, { parentId: '1' });
    }
    return existing;
  }
  try {
    const trees = await chrome.bookmarks.getTree();
    const bar = trees?.[0]?.children?.find(node => String(node.id) === '1');
    const recovered = bar?.children?.find(node => !node.url && node.title === MOST_USED_FOLDER_TITLE);
    if (recovered) {
      await storageSet('local', { [MOST_USED_FOLDER_ID_KEY]: recovered.id });
      return recovered;
    }
  } catch { /* create a fresh managed folder below */ }
  const created = await chrome.bookmarks.create({ parentId: '1', title: MOST_USED_FOLDER_TITLE });
  await storageSet('local', { [MOST_USED_FOLDER_ID_KEY]: created.id });
  return created;
}

async function reconcileManagedFolder(folder, items) {
  // Managed maintenance intentionally does not enter reorganization history:
  // it changes only system-owned copies, never the user's original bookmarks.
  const children = await chrome.bookmarks.getChildren(folder.id);
  for (const child of children) {
    if (child.url) await chrome.bookmarks.remove(child.id);
  }
  for (const item of items) {
    const copy = await chrome.bookmarks.create({ parentId: folder.id, title: item.title, url: item.url });
    const stored = await storageGet('local', [MOST_USED_SYSTEM_COPY_IDS_KEY]);
    const ids = Array.isArray(stored[MOST_USED_SYSTEM_COPY_IDS_KEY])
      ? stored[MOST_USED_SYSTEM_COPY_IDS_KEY].map(String)
      : [];
    ids.push(String(copy.id));
    await storageSet('local', {
      [MOST_USED_SYSTEM_COPY_IDS_KEY]: ids.slice(-MAX_RESULTS * 2)
    });
  }
}

async function getBookmarksBarTitle() {
  try {
    const [bar] = await chrome.bookmarks.get('1');
    return bar?.title || 'Bookmarks Bar';
  } catch {
    return 'Bookmarks Bar';
  }
}

export async function refreshMostUsedBookmarks() {
  const [settings, local] = await Promise.all([
    storageGet('sync', [MOST_USED_WINDOW_KEY]),
    storageGet('local', [MOST_USED_FOLDER_ID_KEY])
  ]);
  const days = normalizeWindowDays(settings[MOST_USED_WINDOW_KEY]);
  const result = await rankMostUsedBookmarks(days, Date.now(), local[MOST_USED_FOLDER_ID_KEY]);
  const folder = await ensureManagedFolder(local[MOST_USED_FOLDER_ID_KEY]);
  await reconcileManagedFolder(folder, result.state === 'ready' ? result.items : []);
  const bookmarksBarTitle = await getBookmarksBarTitle();
  const payload = {
    ...result,
    days,
    folderId: folder.id,
    folderTitle: folder.title,
    folderPath: `${bookmarksBarTitle} > ${folder.title}`,
    refreshedAt: Date.now()
  };
  await storageSet('local', { [MOST_USED_CACHE_KEY]: payload, [MOST_USED_DIRTY_KEY]: false });
  return payload;
}

export async function getMostUsedBookmarks() {
  return refreshMostUsedBookmarks();
}

export async function setMostUsedWindow(days) {
  const normalizedDays = normalizeWindowDays(days);
  await storageSet('sync', { [MOST_USED_WINDOW_KEY]: normalizedDays });
  return refreshMostUsedBookmarks();
}

export async function queueMostUsedRefresh() {
  await storageSet('local', { [MOST_USED_DIRTY_KEY]: true });
  chrome.alarms.create(MOST_USED_ALARM, { delayInMinutes: 1 });
}

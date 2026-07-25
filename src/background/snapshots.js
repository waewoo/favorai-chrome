import {
  BOOKMARK_SNAPSHOTS_STORAGE_KEY,
  MAX_BOOKMARK_SNAPSHOTS
} from '../utils/constants.js';

export const BOOKMARK_SNAPSHOT_VERSION = 1;

const SNAPSHOT_NODE_KEYS = new Set(['id', 'title', 'url', 'parentId', 'children']);

function getBookmarkTree(bookmarkFolderId) {
  if (bookmarkFolderId && bookmarkFolderId !== 'root') {
    return chrome.bookmarks.getSubTree(bookmarkFolderId).then(nodes => nodes?.[0] || null);
  }
  return chrome.bookmarks.getTree().then(nodes => nodes?.[0] || null);
}

function serializeNode(node, parentId = null) {
  if (!node || node.id === undefined || node.id === null) {
    throw new Error('Cannot create a snapshot from an invalid bookmark tree.');
  }

  const serialized = {
    id: String(node.id),
    title: typeof node.title === 'string' ? node.title : '',
    parentId: node.parentId === undefined ? parentId : (node.parentId === null ? null : String(node.parentId))
  };

  if (typeof node.url === 'string') serialized.url = node.url;
  if (Array.isArray(node.children)) {
    serialized.children = node.children.map(child => serializeNode(child, serialized.id));
  }

  return serialized;
}

function validateNode(node) {
  if (!node || typeof node !== 'object' || typeof node.id !== 'string' || typeof node.title !== 'string') return false;
  if (node.url !== undefined && typeof node.url !== 'string') return false;
  if (node.parentId !== null && node.parentId !== undefined && typeof node.parentId !== 'string') return false;
  if (Object.keys(node).some(key => !SNAPSHOT_NODE_KEYS.has(key))) return false;
  return !node.children || (Array.isArray(node.children) && node.children.every(validateNode));
}

function createSnapshotId(timestamp) {
  return `snap_${timestamp}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createBookmarkSnapshot(rootNode, options = {}) {
  const timestamp = Number.isFinite(options.timestamp) ? options.timestamp : Date.now();
  const tree = serializeNode(rootNode);
  const snapshot = {
    version: BOOKMARK_SNAPSHOT_VERSION,
    id: options.id || createSnapshotId(timestamp),
    timestamp,
    scope: options.bookmarkFolderId && options.bookmarkFolderId !== 'root'
      ? { bookmarkFolderId: String(options.bookmarkFolderId) }
      : null,
    tree
  };

  if (!validateNode(snapshot.tree)) throw new Error('Cannot create a snapshot from an invalid bookmark tree.');
  return snapshot;
}

export async function saveBookmarkSnapshot(snapshot) {
  if (!snapshot || snapshot.version !== BOOKMARK_SNAPSHOT_VERSION || !validateNode(snapshot.tree)) {
    throw new Error('Invalid bookmark snapshot.');
  }

  const stored = await chrome.storage.local.get([BOOKMARK_SNAPSHOTS_STORAGE_KEY]);
  const snapshots = Array.isArray(stored[BOOKMARK_SNAPSHOTS_STORAGE_KEY])
    ? stored[BOOKMARK_SNAPSHOTS_STORAGE_KEY]
    : [];
  const next = [snapshot, ...snapshots.filter(item => item?.id !== snapshot.id)]
    .slice(0, MAX_BOOKMARK_SNAPSHOTS);
  await chrome.storage.local.set({ [BOOKMARK_SNAPSHOTS_STORAGE_KEY]: next });
  return snapshot;
}

export async function captureBookmarkSnapshot(bookmarkFolderId = null) {
  const tree = await getBookmarkTree(bookmarkFolderId);
  if (!tree) throw new Error('Unable to read bookmarks for snapshot.');
  return saveBookmarkSnapshot(createBookmarkSnapshot(tree, { bookmarkFolderId }));
}

export async function getBookmarkSnapshots() {
  const stored = await chrome.storage.local.get([BOOKMARK_SNAPSHOTS_STORAGE_KEY]);
  return Array.isArray(stored[BOOKMARK_SNAPSHOTS_STORAGE_KEY])
    ? stored[BOOKMARK_SNAPSHOTS_STORAGE_KEY]
    : [];
}

export async function getBookmarkSnapshot(snapshotId) {
  const snapshots = await getBookmarkSnapshots();
  return snapshots.find(snapshot => snapshot.id === snapshotId) || null;
}

export { getBookmarkTree, serializeNode as serializeBookmarkTree, validateNode as isValidBookmarkSnapshotTree };

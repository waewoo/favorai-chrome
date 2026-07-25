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

function flattenTree(root) {
  const nodes = [];
  function visit(node, path = [], parentId = null) {
    const currentPath = [...path, node.title];
    const declaredParentId = node.parentId === undefined ? parentId : node.parentId;
    nodes.push({ node, path: currentPath.join(' > '), parentId: declaredParentId });
    for (const child of node.children || []) visit(child, currentPath, node.id);
  }
  visit(root);
  return nodes;
}

function nodeType(node) {
  return node.url === undefined ? 'folder' : 'bookmark';
}

function operationType(prefix, node) {
  return `${prefix}_${nodeType(node)}`;
}

function makeTempId(nodeId) {
  return `new_snapshot_${String(nodeId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}

function sortByDepthAscending(a, b) {
  return a.params.targetPath.split(' > ').length - b.params.targetPath.split(' > ').length;
}

function sortByDepthDescending(a, b) {
  return b.params.sourcePath.split(' > ').length - a.params.sourcePath.split(' > ').length;
}

export function buildBookmarkSnapshotDiff(snapshot, currentTree) {
  if (!snapshot || snapshot.version !== BOOKMARK_SNAPSHOT_VERSION || !validateNode(snapshot.tree)) {
    throw new Error('Invalid bookmark snapshot.');
  }
  if (!currentTree || !validateNode(serializeNode(currentTree))) {
    throw new Error('Invalid current bookmark tree.');
  }

  const targetNodes = flattenTree(snapshot.tree);
  const currentNodes = flattenTree(serializeNode(currentTree));
  const targetToCurrent = new Map();
  const currentUsed = new Set();
  const operations = [];
  const unrestorable = [];

  for (const targetEntry of targetNodes) {
    const target = targetEntry.node;
    const candidates = currentNodes.filter(entry => !currentUsed.has(entry.node.id) && nodeType(entry.node) === nodeType(target));
    let match = candidates.find(entry => entry.node.id === target.id);

    if (!match && target.url !== undefined) {
      match = candidates.find(entry => entry.node.url === target.url);
    }
    if (!match && target.url === undefined) {
      const parentCurrentId = targetToCurrent.get(targetEntry.parentId);
      match = candidates.find(entry => entry.node.title === target.title && (
        (parentCurrentId && entry.parentId === parentCurrentId) || entry.path === targetEntry.path
      ));
    }
    if (!match && target.url === undefined) {
      const sameTitle = candidates.filter(entry => entry.node.title === target.title);
      if (sameTitle.length === 1) match = sameTitle[0];
    }

    if (match) {
      targetToCurrent.set(target.id, match.node.id);
      currentUsed.add(match.node.id);
      continue;
    }

    const parentExistsInTarget = targetNodes.some(entry => entry.node.id === targetEntry.parentId);
    if (targetEntry.parentId !== null && targetEntry.parentId !== undefined && !parentExistsInTarget) {
      unrestorable.push({
        type: operationType('create', target),
        title: target.title,
        code: 'UNRESOLVED_PARENT',
        details: { parentId: targetEntry.parentId }
      });
    }
  }

  const getTargetParentId = targetEntry => {
    if (targetEntry.parentId === null || targetEntry.parentId === undefined) return '1';
    return targetToCurrent.get(targetEntry.parentId) || makeTempId(targetEntry.parentId);
  };

  for (const targetEntry of targetNodes) {
    const target = targetEntry.node;
    if (targetToCurrent.has(target.id)) continue;

    const tempId = makeTempId(target.id);
    targetToCurrent.set(target.id, tempId);
    const parentId = getTargetParentId(targetEntry);
    const params = target.url === undefined
      ? { tempId, title: target.title, parentId, targetPath: targetEntry.path }
      : { tempId, title: target.title, url: target.url, parentId, targetPath: targetEntry.path };
    operations.push({ id: `snapshot_create_${target.id}`, type: operationType('create', target), title: target.title, params });
  }

  for (const targetEntry of targetNodes) {
    const target = targetEntry.node;
    const currentId = targetToCurrent.get(target.id);
    if (!currentId || currentId.startsWith('new_snapshot_')) continue;
    const current = currentNodes.find(entry => entry.node.id === currentId);
    if (!current || targetEntry.parentId === null || targetEntry.parentId === undefined) continue;

    const titleChanged = current.node.title !== target.title;
    const urlChanged = target.url !== undefined && current.node.url !== target.url;
    if (titleChanged || urlChanged) {
      operations.push({
        id: `snapshot_rename_${target.id}`,
        type: operationType('rename', target),
        title: target.title,
        params: {
          nodeId: currentId,
          newTitle: target.title,
          ...(target.url !== undefined ? { newUrl: target.url } : {})
        }
      });
    }

    const expectedParentId = targetToCurrent.get(targetEntry.parentId);
    if (expectedParentId && !expectedParentId.startsWith('new_snapshot_') && current.parentId !== expectedParentId) {
      operations.push({
        id: `snapshot_move_${target.id}`,
        type: operationType('move', target),
        title: target.title,
        params: { nodeId: currentId, newParentId: expectedParentId }
      });
    }
  }

  for (const currentEntry of currentNodes) {
    if (currentUsed.has(currentEntry.node.id) || currentEntry.parentId === null || currentEntry.parentId === undefined) continue;
    operations.push({
      id: `snapshot_delete_${currentEntry.node.id}`,
      type: operationType('delete', currentEntry.node),
      title: currentEntry.node.title,
      targetId: currentEntry.node.id,
      params: { sourcePath: currentEntry.path }
    });
  }

  const orderedOperations = operations.sort((a, b) => {
    const aIsCreate = a.type.startsWith('create_');
    const bIsCreate = b.type.startsWith('create_');
    const createOrder = aIsCreate && bIsCreate
      ? sortByDepthAscending(a, b)
      : 0;
    if (createOrder) return createOrder;
    if (aIsCreate !== bIsCreate) return Number(bIsCreate) - Number(aIsCreate);
    const aIsDelete = a.type.startsWith('delete_');
    const bIsDelete = b.type.startsWith('delete_');
    if (aIsDelete && bIsDelete) return sortByDepthDescending(a, b);
    if (aIsDelete !== bIsDelete) return Number(aIsDelete) - Number(bIsDelete);
    const rank = type => type.startsWith('rename_') ? 1 : 2;
    if (rank(a.type) !== rank(b.type)) return rank(a.type) - rank(b.type);
    return a.id.localeCompare(b.id);
  });

  return {
    snapshotId: snapshot.id,
    operations: orderedOperations,
    unrestorable,
    summary: {
      creates: orderedOperations.filter(operation => operation.type.startsWith('create_')).length,
      moves: orderedOperations.filter(operation => operation.type.startsWith('move_')).length,
      renames: orderedOperations.filter(operation => operation.type.startsWith('rename_')).length,
      deletes: orderedOperations.filter(operation => operation.type.startsWith('delete_')).length,
      unrestorable: unrestorable.length
    }
  };
}

export function getSnapshotExportPayload(snapshot) {
  if (!snapshot || snapshot.version !== BOOKMARK_SNAPSHOT_VERSION || !validateNode(snapshot.tree)) {
    throw new Error('Invalid bookmark snapshot.');
  }
  return {
    version: BOOKMARK_SNAPSHOT_VERSION,
    id: snapshot.id,
    timestamp: snapshot.timestamp,
    scope: snapshot.scope && typeof snapshot.scope === 'object' && typeof snapshot.scope.bookmarkFolderId === 'string'
      ? { bookmarkFolderId: snapshot.scope.bookmarkFolderId }
      : null,
    tree: JSON.parse(JSON.stringify(snapshot.tree))
  };
}

export {
  getBookmarkTree,
  serializeNode as serializeBookmarkTree,
  validateNode as isValidBookmarkSnapshotTree
};

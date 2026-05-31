/* v8 ignore next */
import { NEW_FOLDER_PREFIX, CHROME_ROOT_IDS } from '../utils/constants.js';
import { buildNodeMap, getPathFromMap } from './diff.js';
import { saveSessionToHistory } from './history.js';

/**
 * Résout l'ID réel d'un parent (gestion des IDs temporaires new_).
 * Retourne null si un new_ ID n'a pas été résolu (création du dossier parent échouée).
 * Les appelants doivent vérifier null et ignorer l'opération plutôt que de laisser
 * Chrome placer silencieusement le nœud à la racine de la barre de favoris.
 */
export function resolveParentId(id, idMap) {
  if (!id || String(id) === '0') return '1'; // '0' = racine virtuelle Chrome, pas un parent valide
  const s = String(id);
  if (s.startsWith(NEW_FOLDER_PREFIX)) {
    return idMap[s] || null;
  }
  return s;
}

/**
 * Applique les modifications approuvées par l'utilisateur sur les favoris Chrome.
 */
export async function applyChanges(approvedActionIds, pendingActions, mode, explanation = '') {
  const approvedSet = new Set(approvedActionIds);
  const toRun = pendingActions.filter(a => approvedSet.has(a.id));

  let nodeMap = {};
  try {
    const trees = await chrome.bookmarks.getTree();
    nodeMap = buildNodeMap(trees[0]);
  } catch {
    // Silently continue if unable to read tree
  }

  const idMap = {};
  const history = [];

  // A. Créer les dossiers (ordre croissant de profondeur)
  const creates = toRun.filter(a => a.type === 'create_folder')
    .sort((a, b) => (a.params.targetPath || '').split(' > ').length - (b.params.targetPath || '').split(' > ').length);

  for (const act of creates) {
    const parentId = resolveParentId(act.params.parentId, idMap);
    if (parentId === null) {
      console.warn(`[FavorAI] applyChanges: skipping folder creation "${act.params.title}" — parent ${act.params.parentId} was not created`);
      continue;
    }
    try {
      const created = await chrome.bookmarks.create({ parentId, title: act.params.title });
      idMap[act.params.tempId] = created.id;
      history.push({ type: 'create_folder', title: act.params.title, realId: created.id, parentId, targetPath: getPathFromMap(parentId, nodeMap) });
    } catch {
      // Failed to create folder - continue
    }
  }

  // B. Renommages
  for (const act of toRun.filter(a => a.type === 'rename_folder' || a.type === 'rename_bookmark')) {
    const realId = idMap[act.params.nodeId] || act.params.nodeId;
    let oldTitle = '', oldUrl = null, parentId = '';
    try {
      const nodes = await chrome.bookmarks.get(realId);
      if (nodes?.[0]) { oldTitle = nodes[0].title; oldUrl = nodes[0].url || null; parentId = nodes[0].parentId; }
    } catch { /* ignore */ }
    const update = { title: act.params.newTitle };
    if (act.type === 'rename_bookmark' && act.params.newUrl) update.url = act.params.newUrl;
    try {
      await chrome.bookmarks.update(realId, update);
      history.push({ type: 'rename', nodeId: realId, oldTitle, newTitle: act.params.newTitle, oldUrl, newUrl: update.url || null, isFolder: !oldUrl, parentPath: getPathFromMap(parentId, nodeMap) });
    } catch {
      // Failed to rename - continue
      // // console.error(`Error renaming ${realId}:`);
    }
  }

  // C. Déplacements
  for (const act of toRun.filter(a => a.type === 'move_bookmark' || a.type === 'move_folder')) {
    const realId  = idMap[act.params.nodeId] || act.params.nodeId;
    const realPid = resolveParentId(act.params.newParentId, idMap);
    if (realPid === null) {
      console.warn(`[FavorAI] applyChanges: skipping move of "${act.title}" — target parent ${act.params.newParentId} was not created`);
      continue;
    }
    let oldPid = '', title = '', isFolder = false;
    try {
      const nodes = await chrome.bookmarks.get(realId);
      if (nodes?.[0]) { oldPid = nodes[0].parentId; title = nodes[0].title; isFolder = !nodes[0].url; }
    } catch { /* ignore */ }
    try {
      await chrome.bookmarks.move(realId, { parentId: realPid });
      history.push({ type: 'move', nodeId: realId, title: title || act.title, isFolder, oldParentId: oldPid, newParentId: realPid, sourcePath: getPathFromMap(oldPid, nodeMap), targetPath: getPathFromMap(realPid, nodeMap) });
    } catch {
      // Failed to move - continue
    }
  }

  // D. Suppressions (favoris d'abord, dossiers les plus profonds en dernier)
  const deletions = toRun.filter(a => ['delete_duplicate', 'delete_dead', 'delete_folder'].includes(a.type))
    .sort((a, b) => {
      if (a.type === 'delete_folder' && b.type !== 'delete_folder') return 1;
      if (a.type !== 'delete_folder' && b.type === 'delete_folder') return -1;
      if (a.type === 'delete_folder' && b.type === 'delete_folder') {
        return (b.params.sourcePath || '').split(' > ').length - (a.params.sourcePath || '').split(' > ').length;
      }
      return 0;
    });

  for (const act of deletions) {
    const realId = idMap[act.targetId] || act.targetId;
    let old = null;
    try { const n = await chrome.bookmarks.get(realId); if (n?.[0]) old = n[0]; } catch { /* ignore */ }
    try {
      if (act.type === 'delete_folder') {
        await chrome.bookmarks.removeTree(realId);
      } else {
        await chrome.bookmarks.remove(realId);
      }
      if (old) history.push({ type: 'delete', nodeId: realId, title: old.title, url: old.url || null, parentId: old.parentId, isFolder: !old.url, sourcePath: getPathFromMap(old.parentId, nodeMap) });
    } catch {
      // Failed to delete - continue
      // // console.error(`Error deleting ${realId}:`);
    }
  }

  // E. Post-apply cleanup: remove any folders left empty after moves/deletions
  await removeEmptyFoldersRecursive('0', history);

  if (history.length > 0) {
    const historyWithIds = history.map(entry => ({
      id: `ent_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`,
      ...entry
    }));
    await saveSessionToHistory(historyWithIds, mode, explanation);
  }
}

/**
 * Parcourt récursivement l'arbre et supprime tout dossier vide (depth-first).
 * Les IDs racines Chrome (0,1,2,3) ne sont jamais supprimés.
 */
async function removeEmptyFoldersRecursive(parentId, history) {
  let children;
  try {
    children = await chrome.bookmarks.getChildren(parentId);
  } catch {
    return;
  }

  for (const child of children) {
    if (child.url) continue;

    // Recurse first so leaves are cleaned before their parents
    await removeEmptyFoldersRecursive(child.id, history);

    if (CHROME_ROOT_IDS.has(child.id)) continue;

    // Re-check children after recursion
    let remaining;
    try {
      remaining = await chrome.bookmarks.getChildren(child.id);
    } catch {
      continue;
    }

    if (remaining.length === 0) {
      try {
        await chrome.bookmarks.removeTree(child.id);
        history.push({
          type: 'delete', nodeId: child.id, title: child.title,
          url: null, parentId, isFolder: true, sourcePath: 'post-cleanup (dossier vide)'
        });
      } catch {
        // Post-cleanup error - continue
        // // console.error(`Post-cleanup: impossible de supprimer le dossier vide "${child.title}" (${child.id}):`);
      }
    }
  }
}
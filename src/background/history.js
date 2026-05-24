import { MAX_HISTORY_SESSIONS } from '../utils/constants.js';

/**
 * Enregistre une session dans l'historique persistant (max MAX_HISTORY_SESSIONS sessions).
 */
export function saveSessionToHistory(entries, mode) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['reorgHistory'], (res) => {
      const history = res.reorgHistory || [];
      history.unshift({
        id: `sess_${Date.now()}`,
        timestamp: Date.now(),
        mode: mode || 'minimal',
        entries
      });
      if (history.length > MAX_HISTORY_SESSIONS) history.pop();
      chrome.storage.local.set({ reorgHistory: history }, resolve);
    });
  });
}

/**
 * Annule toutes les modifications d'une session dans l'ordre inverse.
 * Gère les IDs recréés dynamiquement.
 */
export async function rollbackSession(historyEntries) {
  const reversed = [...historyEntries].reverse();
  const idMap = {}; // ancien ID → nouvel ID recréé

  for (const entry of reversed) {
    try {
      if (entry.type === 'create_folder') {
        const realId = idMap[entry.realId] || entry.realId;
        await chrome.bookmarks.remove(realId);

      } else if (entry.type === 'rename') {
        const realId = idMap[entry.nodeId] || entry.nodeId;
        const update = { title: entry.oldTitle };
        if (entry.oldUrl) update.url = entry.oldUrl;
        await chrome.bookmarks.update(realId, update);

      } else if (entry.type === 'move') {
        const realId = idMap[entry.nodeId] || entry.nodeId;
        const targetParent = idMap[entry.oldParentId] || entry.oldParentId;
        await chrome.bookmarks.move(realId, { parentId: targetParent });

      } else if (entry.type === 'delete') {
        const targetParent = idMap[entry.parentId] || entry.parentId;
        const created = await chrome.bookmarks.create({
          parentId: targetParent,
          title: entry.title,
          ...(entry.url ? { url: entry.url } : {})
        });
        idMap[entry.nodeId] = created.id;
      }
    } catch (err) {
      console.error('Rollback error for entry:', entry, err);
    }
  }
}
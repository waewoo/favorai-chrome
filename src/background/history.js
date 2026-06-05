/* v8 ignore next */
import { MAX_HISTORY_SESSIONS } from '../utils/constants.js';

// Serialise les appels concurrents à saveSessionToHistory pour éviter la race condition
// lecture-puis-écriture (last-write-wins) sur chrome.storage.local.
let _historyQueue = Promise.resolve();

/**
 * Enregistre une session dans l'historique persistant (max MAX_HISTORY_SESSIONS sessions).
 * Les appels concurrents sont mis en file et exécutés séquentiellement.
 */
export function saveSessionToHistory(entries, mode, explanation = '') {
  _historyQueue = _historyQueue.then(() => new Promise((resolve) => {
    chrome.storage.local.get(['reorgHistory'], (res) => {
      const history = res.reorgHistory || [];
      history.unshift({
        id: `sess_${Date.now()}`,
        timestamp: Date.now(),
        mode: mode || 'minimal',
        explanation: explanation,
        entries
      });
      if (history.length > MAX_HISTORY_SESSIONS) history.pop();
      chrome.storage.local.set({ reorgHistory: history }, resolve);
    });
  }));
  return _historyQueue;
}

/**
 * Annule toutes les modifications d'une session dans l'ordre inverse.
 * Gère les IDs recréés dynamiquement.
 */
export async function rollbackSession(historyEntries) {
  const reversed = [...historyEntries].reverse();
  const result = {
    successCount: 0,
    failureCount: 0,
    failedEntryIds: [],
    failures: []
  };
  const idMap = {}; // ancien ID → nouvel ID recréé

  for (const entry of reversed) {
    try {
      let handled = true;
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
      } else {
        handled = false;
      }
      if (handled) result.successCount++;
    } catch (error) {
      result.failureCount++;
      if (entry.id) result.failedEntryIds.push(entry.id);
      result.failures.push({
        entryId: entry.id || '',
        type: entry.type,
        title: entry.title || entry.oldTitle || entry.newTitle || '',
        message: error?.message || String(error)
      });
    }
  }

  return result;
}

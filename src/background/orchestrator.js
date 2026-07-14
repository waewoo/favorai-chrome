/**
 * Service Worker Orchestrator
 * Gère la communication et l'orchestration des modules de l'extension.
 */

import { runAnalysis } from './analysis.js';
import { applyChanges } from './apply.js';
import { rollbackSession, saveSessionToHistory } from './history.js';
import { suggestBookmarkLocation } from '../llm/index.js';
import { cleanAndParseJSON } from '../llm/utils.js';
import { buildNodeMap, getPathFromMap } from './diff.js';
import { mergeAnalysisConfigWithStoredApiKey, sanitizeAnalysisConfig, sanitizeLlmConfig } from './config.js';
import { normalizeInterruptedAnalysisStatus } from './status.js';
import { sendRuntimeMessage } from './runtime-messaging.js';
import { AUTO_MOVE_CONFIDENCE_THRESHOLD_DEFAULT } from '../utils/constants.js';

const DIAGNOSTIC_LOG_LIMIT = 100;

let pendingActions = [];
// currentAbortController is intentionally not persisted: if the SW is killed mid-analysis
// the get_current_status handler detects state=analyzing + no controller and resets to idle.
let currentAbortController = null;

function syncInterruptedAnalysisState(status) {
  const interruptedMessage = chrome.i18n.getMessage('bgAnalysisInterrupted') || 'Analyse interrompue.';
  const { status: normalizedStatus, normalized } = normalizeInterruptedAnalysisStatus(
    status,
    interruptedMessage,
    Boolean(currentAbortController)
  );

  if (!normalized) {
    return { status, normalized: false };
  }

  Object.assign(currentStatus, normalizedStatus);
  saveStatusToStorage();

  pendingActions = [];
  chrome.storage.local.set({ pendingActions: [] });

  return { status: normalizedStatus, normalized: true };
}

function handleStartupRecovery() {
  chrome.alarms.clear('keepAliveAlarm');
  chrome.storage.local.get(['extensionStatus'], (res) => {
    syncInterruptedAnalysisState(res.extensionStatus || currentStatus);
  });
}

/**
 * Formate les messages d'erreur pour une meilleure lisibilité
 */
function formatErrorMessage(error) {
  if (typeof error !== 'string') return String(error);

  const lowerError = error.toLowerCase();

  // Check for rate limit first (applies to all providers)
  if (error.includes('429') || lowerError.includes('rate limit') || lowerError.includes('rate_limited')) {
    return '⚠️ Limite de requêtes dépassée. Votre fournisseur API a atteint son quota. Veuillez attendre quelques minutes avant de réessayer.';
  }

  if (
    lowerError.includes('api key') ||
    lowerError.includes('apikey') ||
    lowerError.includes('unregistered callers') ||
    lowerError.includes('identity') ||
    lowerError.includes('key not valid') ||
    lowerError.includes('invalid key') ||
    lowerError.includes('unauthorized') ||
    lowerError.includes('invalid_api_key') ||
    lowerError.includes('permission_denied') ||
    lowerError.includes('permission denied') ||
    lowerError.includes('unauthenticated') ||
    lowerError.includes('401') ||
    lowerError.includes('403')
  ) {
    return "Problème de configuration : Clé API manquante, invalide ou non autorisée. Veuillez vérifier vos paramètres dans l'onglet Configuration.";
  }

  // Essayer d'extraire et de parser le JSON
  const jsonMatch = error.match(/\{[\s\S]*\}$/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // Cas rate limit (double check)
      if (parsed.code === '1300' || parsed.type === 'rate_limited') {
        return '⚠️ Limite de requêtes dépassée. Votre fournisseur API a atteint son quota. Veuillez attendre quelques minutes avant de réessayer.';
      }

      // Extraire le message d'erreur pertinent
      if (parsed.message) {
        return parsed.message;
      }
      if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
        return parsed.error.message;
      }
    } catch {
      // Si le parsing échoue, continuer avec le message original
    }
  }

  // Extraire le message d'erreur API principal
  if (error.includes('Erreur OpenAI')) return error.replace(/\{[\s\S]*\}/, '').trim();
  if (error.includes('Erreur Gemini')) return error.replace(/\{[\s\S]*\}/, '').trim();
  if (error.includes('Erreur Mistral')) return error.replace(/\{[\s\S]*\}/, '').trim();

  return error;
}

const currentStatus = {
  state: 'idle', // 'idle' | 'analyzing' | 'waiting_validation'
  mode: null,
  percentage: 0,
  logs: [],
  actions: [],
  explanation: '',
  lastError: null,
  retryable: false,
  lastConfig: null,
  lastCheckDeadLinks: false,
  analysisTreeFingerprint: null,
  bookmarkFolderId: null
};

const PENDING_AUTO_BOOKMARK_SUGGESTIONS_KEY = 'pendingAutoBookmarkSuggestions';
let suppressAutoBookmarkClassificationCount = 0;
let suppressAutoBookmarkClassificationTimer = null;

chrome.bookmarks.onCreated.addListener((bookmarkId, bookmark) => {
  if (!bookmark?.url) return;
  if (consumeAutoBookmarkClassificationSuppression()) return;
  void processAutoBookmarkCreation({ id: bookmarkId, ...bookmark });
});

chrome.runtime.onStartup.addListener(() => {
  handleStartupRecovery();
});

handleStartupRecovery();

function saveStatusToStorage() {
  chrome.storage.local.set({ extensionStatus: currentStatus });
}

function suppressNextAutoBookmarkClassification() {
  suppressAutoBookmarkClassificationCount += 1;
  if (suppressAutoBookmarkClassificationTimer) clearTimeout(suppressAutoBookmarkClassificationTimer);
  suppressAutoBookmarkClassificationTimer = setTimeout(() => {
    suppressAutoBookmarkClassificationCount = 0;
    suppressAutoBookmarkClassificationTimer = null;
  }, 5000);
}

function consumeAutoBookmarkClassificationSuppression() {
  if (suppressAutoBookmarkClassificationCount <= 0) return false;
  suppressAutoBookmarkClassificationCount -= 1;
  if (suppressAutoBookmarkClassificationCount === 0 && suppressAutoBookmarkClassificationTimer) {
    clearTimeout(suppressAutoBookmarkClassificationTimer);
    suppressAutoBookmarkClassificationTimer = null;
  }
  return true;
}

function clearAutoBookmarkClassificationSuppression() {
  suppressAutoBookmarkClassificationCount = 0;
  if (suppressAutoBookmarkClassificationTimer) {
    clearTimeout(suppressAutoBookmarkClassificationTimer);
    suppressAutoBookmarkClassificationTimer = null;
  }
}

function normalizeAutoMoveThreshold(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return AUTO_MOVE_CONFIDENCE_THRESHOLD_DEFAULT;
  return Math.max(0, Math.min(1, parsed));
}

function normalizeConfidence(value) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
}

function getStoredSync(keys) {
  return new Promise(resolve => chrome.storage.sync.get(keys, resolve));
}

function getStoredLocal(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}

function setStoredLocal(values) {
  return new Promise(resolve => chrome.storage.local.set(values, resolve));
}

async function loadSuggestionConfig() {
  const [syncRes, localRes] = await Promise.all([
    getStoredSync(['provider', 'apiUrl', 'modelName', 'debugMode', 'maxTokens', 'promptSuggest', 'autoMoveNewBookmarks', 'autoMoveConfidenceThreshold']),
    getStoredLocal(['apiKey'])
  ]);

  const fullConfig = sanitizeLlmConfig({ ...syncRes, apiKey: localRes.apiKey }, {
    defaultProvider: 'google',
    defaultMaxTokens: 4096,
    defaultLinkCheckBatchSize: 24
  });

  return {
    ...fullConfig,
    autoMoveNewBookmarks: syncRes.autoMoveNewBookmarks === true,
    autoMoveConfidenceThreshold: normalizeAutoMoveThreshold(syncRes.autoMoveConfidenceThreshold)
  };
}

async function buildBookmarkSuggestionContext(bookmarkUrl, excludeBookmarkId = null) {
  const trees = await chrome.bookmarks.getTree();
  if (chrome.runtime.lastError || !trees?.[0]) {
    throw new Error('Impossible de lire les favoris.');
  }

  const nodeMap = buildNodeMap(trees[0]);
  const folders = [];
  let existingDuplicate = null;

  for (const id in nodeMap) {
    if (excludeBookmarkId && String(id) === String(excludeBookmarkId)) continue;
    const node = nodeMap[id];
    if (!node.url && id !== '0') {
      folders.push({
        id: node.id,
        path: getPathFromMap(node.id, nodeMap)
      });
    } else if (bookmarkUrl && node.url === bookmarkUrl) {
      existingDuplicate = {
        id: node.id,
        title: node.title,
        folderId: node.parentId,
        folderPath: getPathFromMap(node.parentId, nodeMap)
      };
    }
  }

  return { folders, existingDuplicate, nodeMap };
}

async function requestBookmarkSuggestion(bookmark, ignoredFolderIds, signal) {
  const config = await loadSuggestionConfig();
  const { folders, existingDuplicate, nodeMap } = await buildBookmarkSuggestionContext(bookmark.url, bookmark.id);
  const aiResponse = await suggestBookmarkLocation(config, bookmark, folders, ignoredFolderIds, signal);
  const suggestion = cleanAndParseJSON(aiResponse);
  return { config, folders, existingDuplicate, nodeMap, suggestion };
}

async function getPendingBookmarkSuggestions() {
  const res = await getStoredLocal([PENDING_AUTO_BOOKMARK_SUGGESTIONS_KEY]);
  return res[PENDING_AUTO_BOOKMARK_SUGGESTIONS_KEY] || {};
}

async function storePendingBookmarkSuggestion(bookmarkId, payload) {
  const pending = await getPendingBookmarkSuggestions();
  pending[bookmarkId] = payload;
  await setStoredLocal({ [PENDING_AUTO_BOOKMARK_SUGGESTIONS_KEY]: pending });
}

async function readPendingBookmarkSuggestion(bookmarkId) {
  const pending = await getPendingBookmarkSuggestions();
  return pending[bookmarkId] || null;
}

async function clearPendingBookmarkSuggestion(bookmarkId) {
  const pending = await getPendingBookmarkSuggestions();
  if (!pending[bookmarkId]) return;
  delete pending[bookmarkId];
  await setStoredLocal({ [PENDING_AUTO_BOOKMARK_SUGGESTIONS_KEY]: pending });
}

async function openAutoBookmarkPopup(bookmarkId) {
  await chrome.windows.create({
    url: `${chrome.runtime.getURL('extension/popup-light.html')}?mode=autoclassify&bookmarkId=${encodeURIComponent(bookmarkId)}`,
    type: 'popup',
    width: 460,
    height: 690,
    focused: true
  });
}

function buildHistoryEntryId() {
  return `ent_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
}

async function recordAutoBookmarkMove(historyEntries, explanation) {
  if (!historyEntries.length) return;
  const entriesWithIds = historyEntries.map(entry => ({
    id: buildHistoryEntryId(),
    ...entry
  }));
  await saveSessionToHistory(entriesWithIds, 'auto', explanation);
}

export async function applyAutoBookmarkSuggestion(bookmark, suggestion, nodeMap, overrideTargetFolderId = null, overrideTargetTitle = '') {
  const historyEntries = [];
  const bookmarkNodes = await chrome.bookmarks.get(bookmark.id);
  const currentBookmark = bookmarkNodes?.[0] || bookmark;
  const nextTitle = overrideTargetTitle && overrideTargetTitle.trim() ? overrideTargetTitle.trim() : null;
  let targetParentId = null;
  let targetPath = '';

  try {
    if (overrideTargetFolderId) {
      targetParentId = overrideTargetFolderId;
      targetPath = getPathFromMap(targetParentId, nodeMap);
    } else if (suggestion.action === 'create_new') {
      if (!suggestion.newFolderParentId) {
        throw new Error('Suggestion invalide: le dossier parent est manquant.');
      }
      if (!suggestion.newFolderTitle || !suggestion.newFolderTitle.trim()) {
        throw new Error('Suggestion invalide: le titre du nouveau dossier est manquant.');
      }

      const parentPath = getPathFromMap(suggestion.newFolderParentId, nodeMap);
      const createdFolder = await chrome.bookmarks.create({
        parentId: suggestion.newFolderParentId,
        title: suggestion.newFolderTitle.trim()
      });
      targetParentId = createdFolder.id;
      targetPath = parentPath ? `${parentPath} > ${suggestion.newFolderTitle.trim()}` : suggestion.newFolderTitle.trim();
      historyEntries.push({
        type: 'create_folder',
        title: suggestion.newFolderTitle.trim(),
        realId: createdFolder.id,
        parentId: suggestion.newFolderParentId,
        targetPath
      });
    } else {
      if (!suggestion.targetFolderId) {
        throw new Error('Suggestion invalide: le dossier cible est manquant.');
      }
      targetParentId = suggestion.targetFolderId;
      targetPath = getPathFromMap(targetParentId, nodeMap);
    }

    if (nextTitle && nextTitle !== (currentBookmark.title || bookmark.title || '')) {
      const updated = await chrome.bookmarks.update(bookmark.id, { title: nextTitle });
      historyEntries.push({
        type: 'rename',
        nodeId: bookmark.id,
        oldTitle: currentBookmark.title || bookmark.title || '',
        newTitle: nextTitle,
        title: nextTitle,
        oldUrl: currentBookmark.url || bookmark.url || ''
      });
      if (updated?.title) {
        currentBookmark.title = updated.title;
      }
    }

    const sourcePath = getPathFromMap(currentBookmark.parentId || bookmark.parentId || '1', nodeMap);
    const movedBookmark = await chrome.bookmarks.move(bookmark.id, { parentId: targetParentId });
    historyEntries.push({
      type: 'move',
      nodeId: bookmark.id,
      title: currentBookmark.title || bookmark.title || 'Bookmark',
      isFolder: false,
      oldParentId: currentBookmark.parentId || bookmark.parentId || '',
      newParentId: targetParentId,
      sourcePath,
      targetPath
    });

    await recordAutoBookmarkMove(historyEntries, suggestion.explanation || '');
    return movedBookmark;
  } catch (error) {
    if (historyEntries.length) await rollbackSession(historyEntries);
    throw error;
  }
}

async function processAutoBookmarkCreation(bookmark) {
  if (!bookmark?.url) return;

  try {
    await storePendingBookmarkSuggestion(bookmark.id, {
      type: 'loading',
      bookmark: {
        id: bookmark.id,
        title: bookmark.title || '',
        url: bookmark.url || '',
        parentId: bookmark.parentId || ''
      },
      createdAt: Date.now()
    });
    void openAutoBookmarkPopup(bookmark.id).catch(popupError => {
      console.warn('[FavorAI] Unable to open auto-classification popup:', popupError?.message || popupError);
    });

    const suggestionData = await requestBookmarkSuggestion(bookmark, [], currentAbortController?.signal);
    const confidence = normalizeConfidence(suggestionData.suggestion.confidence);
    const shouldAutoMove = suggestionData.config.autoMoveNewBookmarks &&
      confidence !== null &&
      confidence >= suggestionData.config.autoMoveConfidenceThreshold;

    if (shouldAutoMove) {
      await applyAutoBookmarkSuggestion(bookmark, suggestionData.suggestion, suggestionData.nodeMap);
      await storePendingBookmarkSuggestion(bookmark.id, {
        type: 'moved',
        bookmark: {
          id: bookmark.id,
          title: bookmark.title || '',
          url: bookmark.url || '',
          parentId: bookmark.parentId || ''
        },
        suggestion: suggestionData.suggestion,
        confidence,
        threshold: suggestionData.config.autoMoveConfidenceThreshold,
        autoMoveEnabled: suggestionData.config.autoMoveNewBookmarks,
        createdAt: Date.now(),
        movedAt: Date.now()
      });
      return;
    }

    await storePendingBookmarkSuggestion(bookmark.id, {
      type: 'suggestion',
      bookmark: {
        id: bookmark.id,
        title: bookmark.title || '',
        url: bookmark.url || '',
        parentId: bookmark.parentId || ''
      },
      suggestion: suggestionData.suggestion,
      confidence,
      threshold: suggestionData.config.autoMoveConfidenceThreshold,
      autoMoveEnabled: suggestionData.config.autoMoveNewBookmarks,
      folders: suggestionData.folders,
      existingDuplicate: suggestionData.existingDuplicate,
      createdAt: Date.now()
    });
  } catch (error) {
    await storePendingBookmarkSuggestion(bookmark.id, {
      type: 'error',
      bookmark: {
        id: bookmark.id,
        title: bookmark.title || '',
        url: bookmark.url || '',
        parentId: bookmark.parentId || ''
      },
      error: formatErrorMessage(error?.message || String(error)),
      createdAt: Date.now()
    });
  }
}

function logStatus(text, type = 'info') {
  const entry = { text, type, at: Date.now() };
  currentStatus.logs.push(entry);
  if (currentStatus.logs.length > DIAGNOSTIC_LOG_LIMIT) {
    currentStatus.logs.splice(0, currentStatus.logs.length - DIAGNOSTIC_LOG_LIMIT);
  }
  appendDiagnosticLog(entry);
  saveStatusToStorage();
}

function appendDiagnosticLog(entry) {
  chrome.storage.local.get(['diagnosticLogs'], (res) => {
    const diagnosticLogs = Array.isArray(res.diagnosticLogs) ? res.diagnosticLogs : [];
    diagnosticLogs.push(entry);
    chrome.storage.local.set({ diagnosticLogs: diagnosticLogs.slice(-DIAGNOSTIC_LOG_LIMIT) });
  });
}

function registerGlobalErrorHandlers() {
  if (typeof globalThis.addEventListener !== 'function') return;

  globalThis.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.message || event.reason || 'Unhandled promise rejection';
    const message = `[FavorAI] ${chrome.i18n.getMessage('bgUnhandledRejection') || 'Unhandled background promise rejection'}: ${reason}`;
    console.error(message, event.reason);
    appendDiagnosticLog({ text: message, type: 'error', at: Date.now() });
  });

  globalThis.addEventListener('error', (event) => {
    const message = `[FavorAI] ${chrome.i18n.getMessage('bgUnhandledError') || 'Unhandled background error'}: ${event.message || 'Unknown error'}`;
    console.error(message, event.error || event);
    appendDiagnosticLog({ text: message, type: 'error', at: Date.now() });
  });
}

registerGlobalErrorHandlers();

function startKeepAlive() {
  chrome.alarms.create('keepAliveAlarm', { periodInMinutes: 0.1 });
}

function stopKeepAlive() {
  chrome.alarms.clear('keepAliveAlarm');
}

// Alarme pour forcer le keep-alive du Service Worker
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAliveAlarm') {
    chrome.storage.local.get(['__keepalive'], () => {});
  }
});

// Écouteur de messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Sécurité C2 : Valider sender.id pour éviter les appels externes frauduleux
  if (sender.id !== chrome.runtime.id) {
    console.error('Message bloqué : Expéditeur non autorisé.', sender.id);
    return false;
  }

  if (message.action === 'get_current_status') {
    chrome.storage.local.get(['extensionStatus'], (res) => {
      const status = res.extensionStatus || currentStatus;
      const { status: normalizedStatus } = syncInterruptedAnalysisState(status);
      sendResponse(normalizedStatus || status);
    });
    return true; // Réponse asynchrone
  }

  if (message.action === 'start_analysis') {
    if (currentAbortController) {
      sendResponse({
        success: false,
        error: chrome.i18n.getMessage('errAnalysisAlreadyRunning') || 'An analysis is already running.'
      });
      return false;
    }
    currentAbortController = new AbortController();

    currentStatus.state = 'analyzing';
    const effectiveMode = (message.analysisOptions && message.analysisOptions.useAI === false) ? 'cleanup' : (message.mode || 'minimal');
    currentStatus.mode = effectiveMode;
    currentStatus.percentage = 5;
    currentStatus.logs = [];
    currentStatus.actions = [];
    currentStatus.explanation = '';
    currentStatus.lastError = null;
    currentStatus.retryable = false;
    currentStatus.lastConfig = sanitizeAnalysisConfig(message.config);
    currentStatus.lastAnalysisOptions = message.analysisOptions || { useAI: true, checkDeadLinks: message.checkDeadLinks !== false, checkRedirects: false, checkContentDuplicates: false };
    currentStatus.lastCheckDeadLinks = currentStatus.lastAnalysisOptions.checkDeadLinks;
    currentStatus.analysisTreeFingerprint = null;
    currentStatus.bookmarkFolderId = message.bookmarkFolderId || null;

    chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: [] });
    startKeepAlive();

    const modeLabel = effectiveMode === 'complete' ? chrome.i18n.getMessage('bgModeComplete') : chrome.i18n.getMessage('bgModeMinimal');
    logStatus(chrome.i18n.getMessage('bgStartingReorg', [modeLabel]), 'info');

    // Récupérer la clé API depuis le stockage sync par sécurité (C2)
    chrome.storage.local.get(['apiKey'], (res) => {
      const config = mergeAnalysisConfigWithStoredApiKey(message.config, res.apiKey);

      runAnalysis(config, effectiveMode, currentStatus.lastAnalysisOptions, currentAbortController.signal, currentStatus, message.bookmarkFolderId)
        .then(result => {
          currentAbortController = null;
          stopKeepAlive();

          if (result.actions.length === 0) {
            currentStatus.state = 'idle';
            currentStatus.actions = [];
            currentStatus.explanation = '';
            currentStatus.analysisTreeFingerprint = null;
            logStatus(chrome.i18n.getMessage('bgNoChangesNeeded') || 'Aucun changement nécessaire.', 'success');

            pendingActions = [];
            chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: [] });

            void sendRuntimeMessage({
              action: 'analysis_completed',
              actions: [],
              explanation: '',
              mode: effectiveMode
            }, 'analysis_completed notification');
          } else {
            currentStatus.state = 'waiting_validation';
            currentStatus.actions = result.actions;
            currentStatus.explanation = result.explanation;
            currentStatus.analysisTreeFingerprint = result.treeFingerprint || null;
            currentStatus.bookmarkFolderId = result.bookmarkFolderId || message.bookmarkFolderId || null;
            logStatus(chrome.i18n.getMessage('bgAnalysisCompleted') || 'Analyse terminée avec succès.', 'success');
            logStatus(chrome.i18n.getMessage('bgChangesProposed', [String(result.actions.length)]), 'success');

            pendingActions = result.actions;
            chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: result.actions });

            void sendRuntimeMessage({
              action: 'analysis_completed',
              actions: result.actions,
              explanation: result.explanation,
              mode: effectiveMode
            }, 'analysis_completed notification');
          }
        })
        .catch(error => {
          currentAbortController = null;
          stopKeepAlive();

          const isAbort = error.name === 'AbortError' || error.message === 'Cancelled' || error.message?.includes('abort');
          currentStatus.state = 'idle';

          const rawErrorMsg = isAbort ? (chrome.i18n.getMessage('bgAnalysisCancelled') || 'Analyse annulée.') : error.message;
          const errorMsg = isAbort ? rawErrorMsg : formatErrorMessage(rawErrorMsg);
          const isRateLimit = !isAbort && (error.isRateLimit || rawErrorMsg.includes('429') || rawErrorMsg.toLowerCase().includes('rate limit'));
          currentStatus.lastError = errorMsg;
          currentStatus.retryable = isRateLimit;
          currentStatus.analysisTreeFingerprint = null;

          logStatus(chrome.i18n.getMessage('bgReorgFailed', [errorMsg]), 'error');
          chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: [] });

          void sendRuntimeMessage({
            action: 'analysis_failed',
            error: errorMsg,
            retryable: isRateLimit,
            mode: currentStatus.mode
          }, 'analysis_failed notification');
        });
    });

    sendResponse({ success: true, started: true });
    return false;
  }

  if (message.action === 'cancel_analysis') {
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    stopKeepAlive();
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'apply_changes') {
    chrome.storage.local.get(['pendingActions', 'extensionStatus'], (res) => {
      pendingActions = res.pendingActions || pendingActions || [];
      const status = res.extensionStatus || currentStatus;
      const explanation = status.explanation || '';
      applyChanges(message.approvedActionIds, pendingActions, status.mode || currentStatus.mode, explanation, {
        expectedTreeFingerprint: status.analysisTreeFingerprint,
        bookmarkFolderId: status.bookmarkFolderId
      })
        .then((result) => {
          currentStatus.state = 'idle';
          currentStatus.logs = [];
          currentStatus.analysisTreeFingerprint = null;
          chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: [] });
          sendResponse({ success: true, failures: result?.failures || [] });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
    });
    return true;
  }

  if (message.action === 'save_forgotten_deletion') {
    saveSessionToHistory(message.entries, 'forgotten', '')
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'rollback_entry') {
    chrome.storage.local.get(['reorgHistory'], (res) => {
      const history = res.reorgHistory || [];
      const sessionIndex = history.findIndex(s => s.id === message.sessionId);
      if (sessionIndex === -1) {
        sendResponse({ success: false, error: 'Session introuvable.' });
        return;
      }

      const session = history[sessionIndex];
      const entryIndex = session.entries.findIndex(e => e.id === message.entryId);
      if (entryIndex === -1) {
        sendResponse({ success: false, error: 'Modification introuvable.' });
        return;
      }

      const entry = session.entries[entryIndex];
      rollbackSession([entry])
        .then((result) => {
          if (result.failureCount > 0) {
            const failure = result.failures[0];
            sendResponse({ success: false, error: failure?.message || chrome.i18n.getMessage('historyRollbackFailed') || 'Rollback failed.' });
            return;
          }
          session.entries.splice(entryIndex, 1);
          if (session.entries.length === 0) {
            history.splice(sessionIndex, 1);
          }
          chrome.storage.local.set({ reorgHistory: history }, () => {
            sendResponse({ success: true });
          });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
    });
    return true;
  }

  if (message.action === 'delete_entry') {
    chrome.storage.local.get(['reorgHistory'], (res) => {
      const history = res.reorgHistory || [];
      const sessionIndex = history.findIndex(s => s.id === message.sessionId);
      if (sessionIndex === -1) {
        sendResponse({ success: false, error: 'Session introuvable.' });
        return;
      }

      const session = history[sessionIndex];
      const entryIndex = session.entries.findIndex(e => e.id === message.entryId);
      if (entryIndex === -1) {
        sendResponse({ success: false, error: 'Modification introuvable.' });
        return;
      }

      session.entries.splice(entryIndex, 1);
      if (session.entries.length === 0) {
        history.splice(sessionIndex, 1);
      }
      chrome.storage.local.set({ reorgHistory: history }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.action === 'rollback_session') {
    chrome.storage.local.get(['reorgHistory'], (res) => {
      const history = res.reorgHistory || [];
      const sessionIndex = history.findIndex(s => s.id === message.sessionId);
      if (sessionIndex === -1) {
        sendResponse({ success: false, error: chrome.i18n.getMessage('historySessionNotFound') || 'Session introuvable.' });
        return;
      }

      const session = history[sessionIndex];
      rollbackSession(session.entries)
        .then((result) => {
          if (result.failureCount > 0) {
            const failedIds = new Set(result.failedEntryIds);
            session.entries = failedIds.size > 0
              ? session.entries.filter(entry => failedIds.has(entry.id))
              : session.entries;
          } else {
            history.splice(sessionIndex, 1);
          }
          chrome.storage.local.set({ reorgHistory: history }, () => {
            sendResponse({
              success: result.failureCount === 0,
              partial: result.successCount > 0 && result.failureCount > 0,
              rollback: result
            });
          });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
    });
    return true;
  }

  if (message.action === 'suggest_bookmark_location') {
    (async () => {
      try {
        const suggestionData = await requestBookmarkSuggestion(message.bookmark, message.ignoredFolderIds, currentAbortController?.signal);
        sendResponse({
          success: true,
          suggestion: suggestionData.suggestion,
          folders: suggestionData.folders,
          existingDuplicate: suggestionData.existingDuplicate,
          confidence: suggestionData.suggestion.confidence ?? null
        });
      } catch (err) {
        sendResponse({ success: false, error: formatErrorMessage(err?.message || String(err)) });
      }
    })();
    return true; // async
  }

  if (message.action === 'save_suggested_bookmark') {
    const { suggestion, bookmark } = message;
    suppressNextAutoBookmarkClassification();
    
    (async () => {
      let parentId;
      if (suggestion.action === 'create_new') {
        const createdFolder = await chrome.bookmarks.create({
          parentId: suggestion.newFolderParentId || '1',
          title: suggestion.newFolderTitle
        });
        parentId = createdFolder.id;
      } else {
        parentId = suggestion.targetFolderId || '1';
      }
      
      const createdBookmark = await chrome.bookmarks.create({
        parentId,
        title: bookmark.title,
        url: bookmark.url
      });
      
      return createdBookmark;
    })()
    .then(newBookmark => {
      sendResponse({ success: true, bookmark: newBookmark });
    })
    .catch(err => {
      clearAutoBookmarkClassificationSuppression();
      sendResponse({ success: false, error: err.message });
    });
    
    return true; // async
  }

  if (message.action === 'get_pending_auto_bookmark_suggestion') {
    (async () => {
      try {
        const bookmarkId = message.bookmarkId ? String(message.bookmarkId) : '';
        if (!bookmarkId) {
          sendResponse({ success: false, error: 'bookmarkId manquant.' });
          return;
        }

        const pending = await readPendingBookmarkSuggestion(bookmarkId);
        sendResponse({ success: true, pending });
      } catch (err) {
        sendResponse({ success: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message.action === 'apply_pending_auto_bookmark_suggestion') {
    (async () => {
      try {
        const bookmarkId = message.bookmarkId ? String(message.bookmarkId) : '';
        if (!bookmarkId) {
          sendResponse({ success: false, error: 'bookmarkId manquant.' });
          return;
        }

        const pending = await readPendingBookmarkSuggestion(bookmarkId);
        if (!pending) {
          sendResponse({ success: false, error: 'Aucune suggestion en attente.' });
          return;
        }
        if (pending.type !== 'suggestion') {
          sendResponse({ success: false, error: pending.error || 'La suggestion en attente est invalide.' });
          return;
        }

        const { nodeMap } = await buildBookmarkSuggestionContext(pending.bookmark.url, pending.bookmark.id);
        const targetFolderId = message.targetFolderId ? String(message.targetFolderId) : '';
        const targetTitle = message.targetTitle ? String(message.targetTitle) : '';
        await applyAutoBookmarkSuggestion(pending.bookmark, pending.suggestion, nodeMap, targetFolderId || null, targetTitle);
        await clearPendingBookmarkSuggestion(bookmarkId);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message.action === 'clear_pending_auto_bookmark_suggestion') {
    (async () => {
      try {
        const bookmarkId = message.bookmarkId ? String(message.bookmarkId) : '';
        if (!bookmarkId) {
          sendResponse({ success: false, error: 'bookmarkId manquant.' });
          return;
        }

        await clearPendingBookmarkSuggestion(bookmarkId);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err?.message || String(err) });
      }
    })();
    return true;
  }

  if (message.action === 'reset_status') {
    currentStatus.state = 'idle';
    currentStatus.actions = [];
    currentStatus.explanation = '';
    currentStatus.analysisTreeFingerprint = null;
    chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: [] });
    sendResponse({ success: true });
    return false;
  }

  if (message.action === 'get_folders') {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      const folders = [];
      function traverse(node, path = '') {
        const newPath = path ? `${path} > ${node.title}` : node.title;
        if (node.children) {
          folders.push({ id: node.id, title: node.title, path: newPath });
          node.children.forEach(child => traverse(child, newPath));
        }
      }
      bookmarkTreeNodes.forEach(node => traverse(node));
      sendResponse({ success: true, folders });
    });
    return true; // async
  }

  if (message.action === 'save_manual_bookmark') {
    const { bookmark } = message;
    if (!bookmark || !bookmark.title || !bookmark.url || !bookmark.parentId) {
      sendResponse({ success: false, error: 'Invalid bookmark data' });
      return false;
    }

    suppressNextAutoBookmarkClassification();
    chrome.bookmarks.create({
      parentId: bookmark.parentId,
      title: bookmark.title,
      url: bookmark.url
    }, (newBookmark) => {
      if (chrome.runtime.lastError) {
        clearAutoBookmarkClassificationSuppression();
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, bookmark: newBookmark });
      }
    });
    return true; // async
  }
});

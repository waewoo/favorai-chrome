/**
 * Service Worker Orchestrator
 * Gère la communication et l'orchestration des modules de l'extension.
 */

import { runAnalysis } from './analysis.js';
import { applyChanges } from './apply.js';
import { rollbackSession } from './history.js';
import { suggestBookmarkLocation } from '../llm/index.js';
import { cleanAndParseJSON } from '../llm/utils.js';
import { buildNodeMap, getPathFromMap } from './diff.js';
import { mergeAnalysisConfigWithStoredApiKey, sanitizeAnalysisConfig, sanitizeLlmConfig } from './config.js';
import { normalizeInterruptedAnalysisStatus } from './status.js';
import { sendRuntimeMessage } from './runtime-messaging.js';

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

chrome.runtime.onStartup.addListener(() => {
  handleStartupRecovery();
});

handleStartupRecovery();

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

function saveStatusToStorage() {
  chrome.storage.local.set({ extensionStatus: currentStatus });
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
    chrome.storage.sync.get(['apiKey'], (res) => {
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
    chrome.bookmarks.getTree((trees) => {
      if (chrome.runtime.lastError || !trees?.[0]) {
        sendResponse({ success: false, error: 'Impossible de lire les favoris.' });
        return;
      }

      const nodeMap = buildNodeMap(trees[0]);
      const folders = [];
      let existingDuplicate = null;

      for (const id in nodeMap) {
        const node = nodeMap[id];
        if (!node.url && id !== '0') {
          folders.push({
            id: node.id,
            path: getPathFromMap(node.id, nodeMap)
          });
        } else if (node.url === message.bookmark.url && node.url) {
          existingDuplicate = {
            id: node.id,
            title: node.title,
            folderId: node.parentId,
            folderPath: getPathFromMap(node.parentId, nodeMap)
          };
        }
      }

      chrome.storage.sync.get(['provider', 'apiUrl', 'apiKey', 'modelName', 'debugMode', 'maxTokens', 'promptSuggest'], (syncRes) => {
        const fullConfig = sanitizeLlmConfig(syncRes, {
          defaultProvider: 'google',
          defaultMaxTokens: 4096,
          defaultLinkCheckBatchSize: 24
        });

        suggestBookmarkLocation(fullConfig, message.bookmark, folders, message.ignoredFolderIds, currentAbortController?.signal)
          .then(aiResponse => {
            const parsed = cleanAndParseJSON(aiResponse);
            sendResponse({ success: true, suggestion: parsed, folders, existingDuplicate });
          })
          .catch(err => {
            sendResponse({ success: false, error: formatErrorMessage(err.message) });
          });
      });
    });
    return true; // async
  }

  if (message.action === 'save_suggested_bookmark') {
    const { suggestion, bookmark } = message;
    
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
      sendResponse({ success: false, error: err.message });
    });
    
    return true; // async
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

    chrome.bookmarks.create({
      parentId: bookmark.parentId,
      title: bookmark.title,
      url: bookmark.url
    }, (newBookmark) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, bookmark: newBookmark });
      }
    });
    return true; // async
  }
});

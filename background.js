/**
 * Service Worker background.js
 * Point d'entrée de l'extension. Gère la communication et l'orchestration des modules.
 */

import { runAnalysis } from './src/background/analysis.js';
import { applyChanges } from './src/background/apply.js';
import { rollbackSession } from './src/background/history.js';

let pendingActions = [];
let currentAbortController = null;
let popupWindowId = null;

chrome.action.onClicked.addListener(() => {
  const popupUrl = chrome.runtime.getURL('popup.html');
  if (popupWindowId !== null) {
    chrome.windows.get(popupWindowId, (win) => {
      if (chrome.runtime.lastError || !win) {
        popupWindowId = null;
        openPopupWindow(popupUrl);
      } else {
        chrome.windows.update(popupWindowId, { focused: true });
      }
    });
  } else {
    openPopupWindow(popupUrl);
  }
});

function openPopupWindow(url) {
  chrome.windows.create({
    url,
    type: 'popup',
    width: 1200,
    height: 1050,
    left: 100,
    top: 50
  }, (win) => {
    if (!chrome.runtime.lastError && win) {
      popupWindowId = win.id;
      chrome.windows.onRemoved.addListener(function onRemoved(id) {
        if (id === popupWindowId) {
          popupWindowId = null;
          chrome.windows.onRemoved.removeListener(onRemoved);
        }
      });
    }
  });
}

/**
 * Formate les messages d'erreur pour une meilleure lisibilité
 */
function formatErrorMessage(error) {
  if (typeof error !== 'string') return String(error);

  // Essayer d'extraire et de parser le JSON
  const jsonMatch = error.match(/\{[\s\S]*\}$/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // Cas rate limit
      if (parsed.code === '1300' || parsed.type === 'rate_limited' || error.includes('429')) {
        return 'Limite de requêtes dépassée. Veuillez attendre quelques minutes avant de réessayer.';
      }

      // Extraire le message d'erreur pertinent
      if (parsed.message) {
        return parsed.message;
      }
      if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
        return parsed.error.message;
      }
    } catch (e) {
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
  lastCheckDeadLinks: true
};

function saveStatusToStorage() {
  chrome.storage.local.set({ extensionStatus: currentStatus });
}

function logStatus(text, type = 'info') {
  currentStatus.logs.push({ text, type });
  saveStatusToStorage();
}

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
      if (status.state === 'analyzing' && !currentAbortController) {
        status.state = 'idle';
        status.logs.push({ text: chrome.i18n.getMessage('bgAnalysisInterrupted') || 'Analyse interrompue.', type: 'warning' });
        chrome.storage.local.set({ extensionStatus: status });
      }
      sendResponse(status);
    });
    return true; // Réponse asynchrone
  }

  if (message.action === 'start_analysis') {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();

    currentStatus.state = 'analyzing';
    currentStatus.mode = message.mode;
    currentStatus.percentage = 5;
    currentStatus.logs = [];
    currentStatus.actions = [];
    currentStatus.explanation = '';
    currentStatus.lastError = null;
    currentStatus.retryable = false;
    currentStatus.lastConfig = message.config;
    currentStatus.lastCheckDeadLinks = message.checkDeadLinks !== false;

    chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: [] });
    startKeepAlive();

    const modeLabel = message.mode === 'complete' ? 'Complète' : 'Minimale';
    logStatus(`> Démarrage de la réorganisation (${modeLabel})...`, 'info');

    // Récupérer la clé API depuis le stockage sync par sécurité (C2)
    chrome.storage.sync.get(['apiKey'], (res) => {
      const config = { ...message.config, apiKey: res.apiKey || '' };

      runAnalysis(config, message.mode, message.checkDeadLinks !== false, currentAbortController.signal, currentStatus, message.bookmarkFolderId)
        .then(result => {
          currentAbortController = null;
          stopKeepAlive();

          if (result.actions.length === 0) {
            currentStatus.state = 'idle';
            currentStatus.actions = [];
            currentStatus.explanation = '';
            logStatus(chrome.i18n.getMessage('bgNoChangesNeeded') || 'Aucun changement nécessaire.', 'success');

            pendingActions = [];
            chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: [] });

            chrome.runtime.sendMessage({
              action: 'analysis_completed',
              actions: [],
              explanation: '',
              mode: message.mode
            }).catch(() => {});
          } else {
            currentStatus.state = 'waiting_validation';
            currentStatus.actions = result.actions;
            currentStatus.explanation = result.explanation;
            logStatus(chrome.i18n.getMessage('bgAnalysisCompleted') || 'Analyse terminée avec succès.', 'success');
            // Log the count but more concisely - it will show in the UI
            logStatus(`✓ ${result.actions.length} changement(s) proposé(s)`, 'success');

            pendingActions = result.actions;
            chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: result.actions });

            chrome.runtime.sendMessage({
              action: 'analysis_completed',
              actions: result.actions,
              explanation: result.explanation,
              mode: message.mode
            }).catch(() => {});
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

          logStatus(`Échec de la réorganisation : ${errorMsg}`, 'error');
          chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: [] });

          chrome.runtime.sendMessage({
            action: 'analysis_failed',
            error: errorMsg,
            retryable: isRateLimit,
            mode: currentStatus.mode
          }).catch(() => {});
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
    chrome.storage.local.get(['pendingActions'], (res) => {
      pendingActions = res.pendingActions || pendingActions || [];
      applyChanges(message.approvedActionIds, pendingActions, currentStatus.mode)
        .then(() => {
          currentStatus.state = 'idle';
          currentStatus.logs = [];
          chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: [] });
          sendResponse({ success: true });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
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
        .then(() => {
          history.splice(sessionIndex, 1);
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

  if (message.action === 'reset_status') {
    currentStatus.state = 'idle';
    currentStatus.actions = [];
    currentStatus.explanation = '';
    chrome.storage.local.set({ extensionStatus: currentStatus, pendingActions: [] });
    sendResponse({ success: true });
    return false;
  }
});

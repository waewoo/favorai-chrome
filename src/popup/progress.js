/**
 * Popup reorganization progress and orchestration.
 */

import { showToast, addLog, addLoadingLog, removeLoadingLog } from './utils.js';
import { displayRapport } from './report.js';
import { applyActionFilter } from './actions.js';
import { formatFolderPath, createOption } from './dom.js';

const t = (key, fallback = '') => chrome.i18n.getMessage(key) || fallback;

let startRequestInFlight = false;

export function markReorganizationIdle() {
  startRequestInFlight = false;
}

export function updateProgressBar(progressBarContainer, progressBar, percentage) {
  const safePercentage = Math.max(0, Math.min(100, Number(percentage) || 0));
  if (progressBarContainer) {
    progressBarContainer.style.display = 'block';
    progressBarContainer.setAttribute('aria-valuenow', String(safePercentage));
  }
  if (progressBar) progressBar.style.width = `${safePercentage}%`;
}

export function setControlsDisabled(disabled) {
  const providerSelect = document.getElementById('provider');
  const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');
  const btnLaunch = document.getElementById('btnLaunch');

  if (providerSelect) providerSelect.disabled = disabled;
  if (bookmarkFolderSelect) bookmarkFolderSelect.disabled = disabled;
  if (btnLaunch) btnLaunch.disabled = disabled;

  for (const id of ['useAI', 'checkDeadLinks', 'checkRedirects', 'checkContentDuplicates']) {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
  }
  for (const el of document.querySelectorAll('input[name="reorgMode"]')) {
    el.disabled = disabled;
  }
}

export function loadBookmarkFolders() {
  const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');
  if (!bookmarkFolderSelect) return;

  chrome.runtime.sendMessage({ action: 'get_folders' }, (response) => {
    if (response && response.folders && response.folders.length > 0) {
      while (bookmarkFolderSelect.options.length > 1) {
        bookmarkFolderSelect.remove(1);
      }

      response.folders.forEach(folder => {
        bookmarkFolderSelect.appendChild(createOption(folder.id, formatFolderPath(folder.path)));
      });
    }

    if (!bookmarkFolderSelect.value || bookmarkFolderSelect.value === 'root') {
      bookmarkFolderSelect.value = '1';
    }

    updateFolderStats(bookmarkFolderSelect.value);
  });
}

function countBookmarksInTree(node) {
  if (!node) return 0;
  if (node.url) return 1;
  return (node.children || []).reduce((sum, child) => sum + countBookmarksInTree(child), 0);
}

function estimateTokens(node) {
  if (!node) return 0;
  if (node.url) return Math.ceil((node.title || '').length / 4) + 3;
  const folderTokens = Math.ceil((node.title || '').length / 4) + 2;
  return folderTokens + (node.children || []).reduce((sum, child) => sum + estimateTokens(child), 0);
}

export function updateFolderStats(folderId) {
  const el = document.getElementById('folderStats');
  if (!el) return;

  const fetch = (id) => {
    if (!id || id === 'root' || id === '0') {
      chrome.bookmarks.getTree(trees => updateFolderStatsFromNode(el, trees?.[0]));
    } else {
      chrome.bookmarks.getSubTree(id, nodes => updateFolderStatsFromNode(el, nodes?.[0]));
    }
  };
  fetch(folderId);
}

function updateFolderStatsFromNode(el, node) {
  if (!node) { el.textContent = ''; return; }
  const count = countBookmarksInTree(node);
  const tokens = estimateTokens(node);
  const countStr = count.toLocaleString();
  const tokenStr = tokens.toLocaleString();
  const bookmarksLabel = chrome.i18n.getMessage('folderStatsBookmarks', [countStr]) || `~${countStr} bookmarks`;
  const tokensLabel = chrome.i18n.getMessage('folderStatsTokens', [tokenStr]) || `~${tokenStr} tokens est.`;
  el.textContent = `${bookmarksLabel} · ${tokensLabel}`;
}

export function stopReorganization() {
  removeLoadingLog();
  addLog('> Demande d\'interruption envoyée...', 'warning');
  chrome.runtime.sendMessage({ action: 'cancel_analysis' }).catch(() => {});
}

export function showRetryButton(_mode) {
  if (document.getElementById('btnRetryReorg')) return;

  const btn = document.createElement('button');
  btn.id = 'btnRetryReorg';
  btn.className = 'btn btn-primary';
  btn.style.cssText = 'width:100%; margin-top:10px; font-size:12px; animation: fadeIn 0.3s ease-out;';
  btn.textContent = '⏱️ Réessayer l\'analyse';
  btn.addEventListener('click', () => {
    btn.remove();
    retryReorganization();
  });

  const logContainer = document.getElementById('logContainer');
  const statusSection = logContainer ? logContainer.closest('section') : null;
  if (statusSection) {
    statusSection.appendChild(btn);
  }
}

let actionFilterTimer = null;
let pendingActionFilter = 'all';

export function scheduleActionFilter(filterValue) {
  pendingActionFilter = filterValue;
  clearTimeout(actionFilterTimer);
  actionFilterTimer = setTimeout(() => {
    actionFilterTimer = null;
    applyActionFilter(pendingActionFilter);
  }, 50);
}

export function retryReorganization() {
  chrome.storage.local.get(['extensionStatus'], (res) => {
    const status = res.extensionStatus;
    if (!status || !status.lastConfig || !status.mode) {
      addLog('Impossible de réessayer : la configuration précédente est introuvable.', 'error');
      return;
    }
    startReorganizationWithConfig(status.lastConfig, status.mode, status.lastCheckDeadLinks !== false);
  });
}

export function startReorganizationWithConfig(config, mode, analysisOptions) {
  const btnStopReorg = document.getElementById('btnStopReorg');
  const reorgBtnGroup = document.getElementById('reorgBtnGroup');
  const logContainer = document.getElementById('logContainer');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const progressBar = document.getElementById('progressBar');

  setControlsDisabled(true);
  if (reorgBtnGroup) reorgBtnGroup.classList.add('hidden');
  if (btnStopReorg) btnStopReorg.classList.remove('hidden');

  if (logContainer) logContainer.textContent = '';
  addLog(`> Nouvelle tentative (${mode === 'complete' ? 'Complète' : 'Minimale'})...`, 'info');
  addLoadingLog(analysisOptions?.useAI !== false ? 'Interrogation de l\'IA en cours...' : 'Analyse en cours...');
  updateProgressBar(progressBarContainer, progressBar, 5);

  chrome.runtime.sendMessage({
    action: 'start_analysis',
    config: config,
    mode: mode,
    analysisOptions
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      const errorMsg = chrome.runtime.lastError?.message || (response?.error) || 'Impossible de lancer l\'analyse.';
      removeLoadingLog();
      addLog(`Échec du démarrage : ${errorMsg}`, 'error');
      if (progressBarContainer) {
        progressBarContainer.style.display = 'none';
        progressBarContainer.removeAttribute('aria-valuenow');
      }
      if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
      if (btnStopReorg) btnStopReorg.classList.add('hidden');
      setControlsDisabled(false);
      markReorganizationIdle();
    }
  });
}

export async function startReorganization() {
  if (startRequestInFlight) {
    showToast(t('errAnalysisAlreadyRunning', 'An analysis is already running.'));
    return;
  }
  startRequestInFlight = true;

  const useAICheckbox = document.getElementById('useAI');
  const modeRadio = document.querySelector('input[name="reorgMode"]:checked');
  const mode = modeRadio ? modeRadio.value : 'minimal';

  const analysisOptions = {
    useAI: useAICheckbox ? useAICheckbox.checked : true,
    checkDeadLinks: !!(document.getElementById('checkDeadLinks')?.checked),
    checkRedirects: !!(document.getElementById('checkRedirects')?.checked),
    checkContentDuplicates: !!(document.getElementById('checkContentDuplicates')?.checked),
  };

  const providerSelect = document.getElementById('provider');
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const modelNameInput = document.getElementById('modelName');
  const linkCheckBatchSizeSelect = document.getElementById('linkCheckBatchSize');
  const maxTokensSelect = document.getElementById('maxTokens');
  const debugModeCheckbox = document.getElementById('debugMode');
  const promptMinimalInput = document.getElementById('promptMinimal');
  const promptCompleteInput = document.getElementById('promptComplete');
  const promptSuggestInput = document.getElementById('promptSuggest');
  const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');
  const btnStopReorg = document.getElementById('btnStopReorg');
  const reorgBtnGroup = document.getElementById('reorgBtnGroup');
  const logContainer = document.getElementById('logContainer');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const progressBar = document.getElementById('progressBar');

  const needsNetwork = analysisOptions.checkDeadLinks || analysisOptions.checkRedirects || analysisOptions.checkContentDuplicates;
  if (needsNetwork) {
    const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
    if (!granted) {
      const approved = await chrome.permissions.request({ origins: ['<all_urls>'] });
      if (!approved) {
        analysisOptions.checkDeadLinks = false;
        analysisOptions.checkRedirects = false;
        analysisOptions.checkContentDuplicates = false;
        for (const id of ['checkDeadLinks', 'checkRedirects', 'checkContentDuplicates']) {
          const el = document.getElementById(id);
          if (el) el.checked = false;
        }
        addLog(chrome.i18n.getMessage('deadLinksPermissionDenied') || 'Permission refusée — vérification des liens désactivée. L\'analyse continue.', 'warning');
      }
    }
  }

  const syncRes = await new Promise(resolve => {
    chrome.storage.sync.get(['promptMinimal', 'promptComplete', 'promptSuggest'], resolve);
  });

  const config = {
    provider: providerSelect ? providerSelect.value : 'google',
    apiUrl: apiUrlInput ? apiUrlInput.value.trim() : '',
    apiKey: apiKeyInput ? apiKeyInput.value.trim() : '',
    modelName: modelNameInput ? modelNameInput.value.trim() : '',
    linkCheckBatchSize: linkCheckBatchSizeSelect ? (parseInt(linkCheckBatchSizeSelect.value, 10) || 24) : 24,
    maxTokens: maxTokensSelect ? (parseInt(maxTokensSelect.value, 10) || 32768) : 32768,
    debugMode: debugModeCheckbox ? debugModeCheckbox.checked : false,
    promptMinimal: (promptMinimalInput && promptMinimalInput.value.trim()) || syncRes.promptMinimal || '',
    promptComplete: (promptCompleteInput && promptCompleteInput.value.trim()) || syncRes.promptComplete || '',
    promptSuggest: (promptSuggestInput && promptSuggestInput.value.trim()) || syncRes.promptSuggest || ''
  };

  if (analysisOptions.useAI && config.provider !== 'ollama' && !config.apiKey) {
    markReorganizationIdle();
    showToast(chrome.i18n.getMessage('errApiKeyRequired') || 'Clé API requise');
    addLog(chrome.i18n.getMessage('errApiKeyRequired') || '> Erreur : Clé API requise.', 'error');
    return;
  }

  setControlsDisabled(true);
  if (reorgBtnGroup) reorgBtnGroup.classList.add('hidden');
  if (btnStopReorg) btnStopReorg.classList.remove('hidden');

  if (logContainer) logContainer.textContent = '';
  const modeLabel = mode === 'complete' ? chrome.i18n.getMessage('bgModeComplete') : chrome.i18n.getMessage('bgModeMinimal');
  addLog(chrome.i18n.getMessage('bgStartingReorg', [modeLabel]), 'info');
  addLoadingLog(analysisOptions.useAI ? 'Interrogation de l\'IA en cours...' : 'Analyse en cours...');
  updateProgressBar(progressBarContainer, progressBar, 5);

  const bookmarkFolderId = bookmarkFolderSelect ? bookmarkFolderSelect.value : '1';

  chrome.runtime.sendMessage({
    action: 'start_analysis',
    mode,
    config,
    analysisOptions,
    bookmarkFolderId
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      const errorMsg = chrome.runtime.lastError?.message || (response?.error) || 'Impossible de lancer l\'analyse.';
      removeLoadingLog();
      addLog(`Échec du démarrage : ${errorMsg}`, 'error');
      if (progressBarContainer) {
        progressBarContainer.style.display = 'none';
        progressBarContainer.removeAttribute('aria-valuenow');
      }
      if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
      if (btnStopReorg) btnStopReorg.classList.add('hidden');
      setControlsDisabled(false);
      markReorganizationIdle();
    }
  });
}

export function restoreStatus() {
  chrome.runtime.sendMessage({ action: 'get_current_status' }, (status) => {
    if (chrome.runtime.lastError || !status) return;

    const btnStopReorg = document.getElementById('btnStopReorg');
    const reorgBtnGroup = document.getElementById('reorgBtnGroup');
    const logContainer = document.getElementById('logContainer');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBar = document.getElementById('progressBar');
    const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');

    if (status.lastAnalysisOptions) {
      const opts = status.lastAnalysisOptions;
      const useAIEl = document.getElementById('useAI');
      if (useAIEl && opts.useAI !== undefined) {
        useAIEl.checked = opts.useAI;
        const aiModeGroup = document.getElementById('aiModeGroup');
        if (aiModeGroup) aiModeGroup.style.display = opts.useAI ? 'flex' : 'none';
        const aiModeHelp = document.getElementById('aiModeHelp');
        if (aiModeHelp) aiModeHelp.style.display = opts.useAI ? 'block' : 'none';
      }
      for (const key of ['checkDeadLinks', 'checkRedirects', 'checkContentDuplicates']) {
        const el = document.getElementById(key);
        if (el && opts[key] !== undefined) el.checked = opts[key];
      }
      if (status.mode) {
        const radio = document.querySelector(`input[name="reorgMode"][value="${status.mode}"]`);
        if (radio) radio.checked = true;
      }
    } else if (status.lastCheckDeadLinks !== undefined) {
      // backward compat with old status format
      const el = document.getElementById('checkDeadLinks');
      if (el) el.checked = status.lastCheckDeadLinks === true;
    }
    if (bookmarkFolderSelect && status.lastConfig?.bookmarkFolderId) {
      bookmarkFolderSelect.value = status.lastConfig.bookmarkFolderId;
    }

    updateAiModeHelp();

    if (status.state === 'analyzing') {
      setControlsDisabled(true);
      if (reorgBtnGroup) reorgBtnGroup.classList.add('hidden');
      if (btnStopReorg) btnStopReorg.classList.remove('hidden');

      if (logContainer) {
        logContainer.textContent = '';
        status.logs.forEach(log => addLog(log.text, log.type));
      }
      addLoadingLog(status.lastAnalysisOptions?.useAI !== false ? 'Interrogation de l\'IA en cours...' : 'Analyse en cours...');
      updateProgressBar(progressBarContainer, progressBar, status.percentage || 5);
    } else if (status.state === 'waiting_validation') {
      setControlsDisabled(false);
      if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
      if (btnStopReorg) btnStopReorg.classList.add('hidden');

      displayRapport(status.actions, status.explanation, status.mode);
    } else {
      setControlsDisabled(false);
      if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
      if (btnStopReorg) btnStopReorg.classList.add('hidden');

      if (logContainer && status.logs.length > 0) {
        logContainer.textContent = '';
        status.logs.forEach(log => addLog(log.text, log.type));
      }

      if (status.retryable && status.lastError) {
        showRetryButton(status.mode);
      }
    }
  });
}

export function updateAiModeHelp() {
  const aiModeHelp = document.getElementById('aiModeHelp');
  if (!aiModeHelp) return;
  const activeRadio = document.querySelector('input[name="reorgMode"]:checked');
  if (activeRadio) {
    const mode = activeRadio.value;
    const msgKey = mode === 'complete' ? 'btnCompleteTitle' : 'btnMinimalTitle';
    aiModeHelp.textContent = chrome.i18n.getMessage(msgKey);
  }
}

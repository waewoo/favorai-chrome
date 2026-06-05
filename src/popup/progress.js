/**
 * Popup reorganization progress and orchestration.
 */

import { showToast, addLog, addLoadingLog, removeLoadingLog } from './utils.js';
import { displayRapport } from './report.js';
import { applyActionFilter } from './actions.js';
import { formatFolderPath, createOption } from './dom.js';

export function setControlsDisabled(disabled) {
  const providerSelect = document.getElementById('provider');
  const checkDeadLinksCheckbox = document.getElementById('checkDeadLinks');
  const btnMinReorg = document.getElementById('btnMinReorg');
  const btnFullReorg = document.getElementById('btnFullReorg');
  const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');

  if (providerSelect) providerSelect.disabled = disabled;
  if (checkDeadLinksCheckbox) checkDeadLinksCheckbox.disabled = disabled;
  if (btnMinReorg) btnMinReorg.disabled = disabled;
  if (btnFullReorg) btnFullReorg.disabled = disabled;
  if (bookmarkFolderSelect) bookmarkFolderSelect.disabled = disabled;
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
  });
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

export function startReorganizationWithConfig(config, mode, checkDeadLinks) {
  const btnStopReorg = document.getElementById('btnStopReorg');
  const reorgBtnGroup = document.getElementById('reorgBtnGroup');
  const logContainer = document.getElementById('logContainer');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const progressBar = document.getElementById('progressBar');

  setControlsDisabled(true);
  if (reorgBtnGroup) reorgBtnGroup.classList.add('hidden');
  if (btnStopReorg) btnStopReorg.classList.remove('hidden');

  if (logContainer) logContainer.innerHTML = '';
  addLog(`> Nouvelle tentative (${mode === 'complete' ? 'Complète' : 'Minimale'})...`, 'info');
  addLoadingLog('Interrogation de l\'IA en cours...');
  if (progressBarContainer) progressBarContainer.style.display = 'block';
  if (progressBar) progressBar.style.width = '5%';

  chrome.runtime.sendMessage({
    action: 'start_analysis',
    config: config,
    mode: mode,
    checkDeadLinks: checkDeadLinks
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      const errorMsg = chrome.runtime.lastError?.message || (response?.error) || 'Impossible de lancer l\'analyse.';
      removeLoadingLog();
      addLog(`Échec du démarrage : ${errorMsg}`, 'error');
      if (progressBarContainer) progressBarContainer.style.display = 'none';
      if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
      if (btnStopReorg) btnStopReorg.classList.add('hidden');
      setControlsDisabled(false);
    }
  });
}

export async function startReorganization(mode) {
  const checkDeadLinksCheckbox = document.getElementById('checkDeadLinks');
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

  if (checkDeadLinksCheckbox && checkDeadLinksCheckbox.checked) {
    const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
    if (!granted) {
      const approved = await chrome.permissions.request({ origins: ['<all_urls>'] });
      if (!approved) {
        checkDeadLinksCheckbox.checked = false;
        chrome.storage.sync.set({ checkDeadLinks: false });
        addLog(chrome.i18n.getMessage('deadLinksPermissionDenied') || 'Permission refusée — vérification des liens désactivée.', 'warning');
        return;
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

  if (config.provider !== 'ollama' && !config.apiKey) {
    showToast(chrome.i18n.getMessage('errApiKeyRequired') || 'Clé API requise');
    addLog(chrome.i18n.getMessage('errApiKeyRequired') || '> Erreur : Clé API requise.', 'error');
    return;
  }

  setControlsDisabled(true);
  if (reorgBtnGroup) reorgBtnGroup.classList.add('hidden');
  if (btnStopReorg) btnStopReorg.classList.remove('hidden');

  if (logContainer) logContainer.innerHTML = '';
  const modeLabel = mode === 'complete' ? chrome.i18n.getMessage('bgModeComplete') : chrome.i18n.getMessage('bgModeMinimal');
  addLog(chrome.i18n.getMessage('bgStartingReorg', [modeLabel]), 'info');
  addLoadingLog('Interrogation de l\'IA en cours...');
  if (progressBarContainer) progressBarContainer.style.display = 'block';
  if (progressBar) progressBar.style.width = '5%';

  const checkDeadLinks = checkDeadLinksCheckbox ? checkDeadLinksCheckbox.checked : false;
  const bookmarkFolderId = bookmarkFolderSelect ? bookmarkFolderSelect.value : '1';

  chrome.runtime.sendMessage({
    action: 'start_analysis',
    mode,
    config,
    checkDeadLinks,
    bookmarkFolderId
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      const errorMsg = chrome.runtime.lastError?.message || (response?.error) || 'Impossible de lancer l\'analyse.';
      removeLoadingLog();
      addLog(`Échec du démarrage : ${errorMsg}`, 'error');
      if (progressBarContainer) progressBarContainer.style.display = 'none';
      if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
      if (btnStopReorg) btnStopReorg.classList.add('hidden');
      setControlsDisabled(false);
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
    const checkDeadLinksCheckbox = document.getElementById('checkDeadLinks');
    const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');

    if (checkDeadLinksCheckbox && status.lastCheckDeadLinks !== undefined) {
      checkDeadLinksCheckbox.checked = status.lastCheckDeadLinks === true;
    }
    if (bookmarkFolderSelect && status.lastConfig?.bookmarkFolderId) {
      bookmarkFolderSelect.value = status.lastConfig.bookmarkFolderId;
    }

    if (status.state === 'analyzing') {
      setControlsDisabled(true);
      if (reorgBtnGroup) reorgBtnGroup.classList.add('hidden');
      if (btnStopReorg) btnStopReorg.classList.remove('hidden');

      if (logContainer) {
        logContainer.innerHTML = '';
        status.logs.forEach(log => addLog(log.text, log.type));
      }
      addLoadingLog('Interrogation de l\'IA en cours...');
      if (progressBarContainer) progressBarContainer.style.display = 'block';
      if (progressBar) progressBar.style.width = `${status.percentage || 5}%`;
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
        logContainer.innerHTML = '';
        status.logs.forEach(log => addLog(log.text, log.type));
      }

      if (status.retryable && status.lastError) {
        showRetryButton(status.mode);
      }
    }
  });
}

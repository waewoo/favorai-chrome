/**
 * Popup Interface Orchestrator
 */

import { translatePage, showToast, showConfirm, addLog, removeLoadingLog } from './src/popup/utils.js';
import { switchTab, showView } from './src/popup/navigation.js';
import { loadConfig, checkConfigStatus, bindConfigEvents } from './src/popup/config.js';
import { renderHistory } from './src/popup/history.js';
import { renderForgotten } from './src/popup/forgotten.js';
import {
  loadBookmarkFolders,
  startReorganization,
  stopReorganization,
  applyCheckedActions,
  scheduleActionFilter,
  toggleAllCheckboxes,
  showRetryButton,
  setControlsDisabled,
  displayRapport,
  restoreStatus,
  markReorganizationIdle,
  updateProgressBar,
  updateFolderStats
} from './src/popup/reorg.js';

// DOM Elements
const tabRangementBtn = document.getElementById('tabRangementBtn');
const tabConfigBtn = document.getElementById('tabConfigBtn');
const tabHistoryBtn = document.getElementById('tabHistoryBtn');
const tabForgottenBtn = document.getElementById('tabForgottenBtn');
const tabAboutBtn = document.getElementById('tabAboutBtn');
const tabDocsBtn = document.getElementById('tabDocsBtn');

const btnLaunch = document.getElementById('btnLaunch');
const btnStopReorg = document.getElementById('btnStopReorg');

const btnCancel = document.getElementById('btnCancel');
const btnApply = document.getElementById('btnApply');
const btnClearHistory = document.getElementById('btnClearHistory');
const btnPrivacyPolicy = document.getElementById('btnPrivacyPolicy');
const btnPrivacyLink = document.getElementById('btnPrivacyLink');

const selectAllSpan = document.getElementById('selectAll');
const selectNoneSpan = document.getElementById('selectNone');

const toast = document.getElementById('toast');
const progressBarContainer = document.getElementById('progressBarContainer');
const progressBar = document.getElementById('progressBar');

// Bind DOM Events on startup
document.addEventListener('DOMContentLoaded', () => {
  translatePage();
  loadConfig();
  restoreStatus();
  loadBookmarkFolders();

  // Set manifest version dynamically in header badge and About section
  const version = chrome.runtime.getManifest().version;
  const appVersionEl = document.getElementById('appVersion');
  if (appVersionEl) appVersionEl.textContent = 'v' + version;
  const aboutVersionEl = document.getElementById('aboutVersion');
  if (aboutVersionEl) aboutVersionEl.textContent = 'FavorAI v' + version;
  
  if (toast) {
    toast.addEventListener('animationend', () => {
      toast.classList.remove('show');
    });
  }
  
  // Bind tabs navigation
  if (tabRangementBtn) tabRangementBtn.addEventListener('click', () => switchTab('rangement'));
  if (tabConfigBtn) tabConfigBtn.addEventListener('click', () => switchTab('config'));
  if (tabAboutBtn) tabAboutBtn.addEventListener('click', () => switchTab('about'));
  if (tabDocsBtn) tabDocsBtn.addEventListener('click', () => switchTab('docs'));
  if (tabHistoryBtn) {
    tabHistoryBtn.addEventListener('click', () => {
      switchTab('history');
      renderHistory();
    });
  }
  if (tabForgottenBtn) {
    tabForgottenBtn.addEventListener('click', () => {
      switchTab('forgotten');
      renderForgotten();
    });
  }

  // Bind config events
  bindConfigEvents();

  // Update folder stats when selection changes
  const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');
  if (bookmarkFolderSelect) {
    bookmarkFolderSelect.addEventListener('change', () => updateFolderStats(bookmarkFolderSelect.value));
  }

  // Bind reorg actions
  if (btnLaunch) btnLaunch.addEventListener('click', () => startReorganization());
  if (btnStopReorg) btnStopReorg.addEventListener('click', stopReorganization);

  // Toggle AI mode radio visibility
  const useAICheckbox = document.getElementById('useAI');
  const aiModeGroup = document.getElementById('aiModeGroup');
  if (useAICheckbox && aiModeGroup) {
    useAICheckbox.addEventListener('change', () => {
      aiModeGroup.style.display = useAICheckbox.checked ? 'flex' : 'none';
    });
  }

  // Bind validation rapport actions
  if (btnCancel) {
    btnCancel.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'reset_status' }, () => {
        showView('main');
        addLog('> Modifications annulées par l\'utilisateur.', 'info');
      });
    });
  }
  
  if (btnApply) btnApply.addEventListener('click', applyCheckedActions);

  if (selectAllSpan) selectAllSpan.addEventListener('click', () => toggleAllCheckboxes(true));
  if (selectNoneSpan) selectNoneSpan.addEventListener('click', () => toggleAllCheckboxes(false));

  // Action filters click listeners
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      const filterVal = e.currentTarget.getAttribute('data-filter');
      scheduleActionFilter(filterVal);
    });
  });

  // Action report log copy button click listener
  const btnCopyLogs = document.getElementById('btnCopyLogs');
  if (btnCopyLogs) {
    btnCopyLogs.addEventListener('click', () => {
      const logContainer = document.getElementById('logContainer');
      if (logContainer) {
        const text = logContainer.innerText;
        navigator.clipboard.writeText(text).then(() => {
          showToast(chrome.i18n.getMessage('toastLogsCopied') || 'Logs copiés !');
        });
      }
    });
  }

  // Bind history clear click
  if (btnClearHistory) {
    btnClearHistory.addEventListener('click', async () => {
      const title = chrome.i18n.getMessage('btnClearHistory') || 'Clear History';
      const message = chrome.i18n.getMessage('dialogConfirmClearHistory') || 'Are you sure you want to clear all history?';
      const ok = await showConfirm(title, message);
      if (!ok) return;

      chrome.storage.local.remove('reorgHistory', () => {
        showToast(chrome.i18n.getMessage('toastHistoryCleared') || 'History cleared.');
        addLog(chrome.i18n.getMessage('logHistoryCleared') || '> Reorganization history cleared.', 'info');
        renderHistory();
      });
    });
  }

  // Privacy Policy click listener
  if (btnPrivacyPolicy) {
    btnPrivacyPolicy.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(chrome.runtime.getURL('privacy_policy.html'));
    });
  }

  if (btnPrivacyLink) {
    btnPrivacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(chrome.runtime.getURL('privacy_policy.html'));
    });
  }

  // Restore deep link tabs if set
  chrome.storage.local.get(['activeTab'], (res) => {
    if (res.activeTab) {
      switchTab(res.activeTab);
      if (res.activeTab === 'history') {
        renderHistory();
      } else if (res.activeTab === 'forgotten') {
        renderForgotten();
      }
      chrome.storage.local.remove('activeTab');
    } else {
      // Default to "rangement" tab
      switchTab('rangement');
    }
  });
});

// Background messages listener
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.action === 'progress_update') {
    updateProgressBar(progressBarContainer, progressBar, message.percentage);
    addLog(message.message, 'info');
  }
  else if (message.action === 'analysis_completed') {
    markReorganizationIdle();
    removeLoadingLog();
    addLog('✓ Analyse terminée', 'success');
    if (progressBarContainer) {
      progressBarContainer.style.display = 'none';
      progressBarContainer.removeAttribute('aria-valuenow');
    }
    
    const reorgBtnGroup = document.getElementById('reorgBtnGroup');
    if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
    if (btnStopReorg) btnStopReorg.classList.add('hidden');
    setControlsDisabled(false);

    try {
      const actions = Array.isArray(message.actions) ? message.actions : [];
      displayRapport(actions, message.explanation, message.mode);
    } catch (error) {
      console.error('Error in displayRapport:', error);
      addLog('Erreur lors de l\'affichage des modifications: ' + error.message, 'error');
    }
  } 
  else if (message.action === 'analysis_failed') {
    markReorganizationIdle();
    removeLoadingLog();
    if (progressBarContainer) {
      progressBarContainer.style.display = 'none';
      progressBarContainer.removeAttribute('aria-valuenow');
    }
    
    const reorgBtnGroup = document.getElementById('reorgBtnGroup');
    if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
    if (btnStopReorg) btnStopReorg.classList.add('hidden');
    setControlsDisabled(false);

    addLog(`Échec : ${message.error}`, 'error');

    // Check if the error is configuration-related and ensure alert is visible
    checkConfigStatus();

    if (message.retryable) {
      showRetryButton(message.mode);
    }
  }
});

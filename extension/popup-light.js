import { translatePage, showToast as sharedShowToast } from '../src/popup/utils.js';
import { ROOT_FOLDER_NAMES } from '../src/popup/dom.js';
/**
 * popup-light.js — FavorAI Light Mode
 * Handles the compact popup (Add Bookmark only).
 * Loads active tab automatically on open.
 */

// ── i18n helpers ──────────────────────────────────────────────────────────────
function applyI18n() {
  translatePage();
}

// ── State ────────────────────────────────────────────────────────────────────
let activeUrl = '';
let lastSuggestion = null;
let lastFolders = [];
let ignoredIds = [];
let lastDuplicate = null;
let autoClassifyStorageListener = null;
let autoClassifyCloseTimer = null;
let autoSuggestedTargetFolderId = '';

const popupParams = new URLSearchParams(window.location.search);
const isAutoClassifyMode = popupParams.get('mode') === 'autoclassify';
const autoClassifyBookmarkId = popupParams.get('bookmarkId') || '';

// ── DOM refs ─────────────────────────────────────────────────────────────────
const elTitle      = document.getElementById('lightBookmarkTitle');
const elUrl        = document.getElementById('lightTabUrl');
const elError      = document.getElementById('errorBanner');
const elCard       = document.getElementById('lightSuggestionCard');
const elName       = document.getElementById('lightSuggestionName');
const elFolderIcon = document.getElementById('lightFolderIcon');
const elFolderLbl  = document.getElementById('lightFolderLabel');
const elFolderPath = document.getElementById('lightFolderPath');
const elAutoStatus  = document.getElementById('lightAutoClassifyStatus');
const elAutoTargetArea = document.getElementById('lightAutoTargetArea');
const autoTitleInput = document.getElementById('lightAutoTargetTitle');
const autoFolderSelect = document.getElementById('lightAutoTargetFolder');
const elReason     = document.getElementById('lightSuggestionReason');
const elToast      = document.getElementById('lightToast');
const elDuplicateWarning = document.getElementById('lightDuplicateWarning');
const elDuplicateLocation = document.getElementById('lightDuplicateLocation');
const elConfigAlert       = document.getElementById('lightConfigAlert');
const quickReorgCard      = document.getElementById('lightQuickReorgCard');
const btnConfigureAI      = document.getElementById('btnLightConfigureAI');
const btnReorgAll         = document.getElementById('btnLightReorgAll');

const btnAnalyze          = document.getElementById('btnLightAnalyze');
const btnAlternative      = document.getElementById('btnLightAlternative');
const btnConfirm          = document.getElementById('btnLightConfirm');
const btnAdvanced         = document.getElementById('btnOpenAdvanced');
const btnPrivacy          = document.getElementById('btnLightPrivacy');
const btnManualSave       = document.getElementById('btnLightManualSave');
const btnManualConfirm    = document.getElementById('btnLightManualSaveConfirm');
const manualSection       = document.getElementById('lightManualSection');
const manualTitleInput    = document.getElementById('lightManualTitle');
const manualFolderSelect  = document.getElementById('lightManualFolder');

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2800) {
  if (!elToast) return;
  sharedShowToast(msg, elToast);
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    elToast.classList.remove('show');
  }, duration);
}

// ── Error banner ──────────────────────────────────────────────────────────────
function showError(msg) {
  elError.textContent = msg;
  elError.classList.remove('hidden');
}
function hideError() {
  elError.classList.add('hidden');
}

// ── Folder path resolver ──────────────────────────────────────────────────────
function resolveFolder(folderId) {
  if (!folderId) return '-';
  if (!lastFolders.length) return folderId;
  const entry = lastFolders.find(f => f.id === folderId);
  if (!entry) return folderId;
  const parts = entry.path.split(' > ');
  if (parts.length > 1 && ROOT_FOLDER_NAMES.has(parts[0])) return parts.slice(1).join(' > ');
  return parts.join(' > ');
}

// ── Load folders for dropdown ──────────────────────────────────────────────────
function loadFolders() {
  chrome.runtime.sendMessage({ action: 'get_folders' }, (response) => {
    if (response && response.folders) {
      lastFolders = response.folders;
      populateFolderSelect();
    } else {
      showError(chrome.i18n.getMessage('lightErrorLoadingFolders'));
    }
  });
}

// ── Populate folder select ─────────────────────────────────────────────────────
function populateFolderSelect() {
  const selects = [manualFolderSelect, autoFolderSelect].filter(Boolean);
  for (const select of selects) {
    select.textContent = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = chrome.i18n.getMessage('lightSelectFolder');
    select.appendChild(placeholder);
  }

  lastFolders.forEach(folder => {
    for (const select of selects) {
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = resolveFolder(folder.id);
      select.appendChild(option);
    }
  });

  if (autoFolderSelect && autoSuggestedTargetFolderId) {
    autoFolderSelect.value = autoSuggestedTargetFolderId;
  }
}

// ── Reset suggestion UI ───────────────────────────────────────────────────────
function resetSuggestion() {
  lastSuggestion = null;
  lastFolders = [];
  ignoredIds = [];
  elCard.classList.add('hidden');
  btnConfirm.classList.add('hidden');
  btnAlternative.classList.add('hidden');
  autoSuggestedTargetFolderId = '';
  if (elAutoStatus) elAutoStatus.textContent = '';
  if (elAutoTargetArea) elAutoTargetArea.classList.add('hidden');
}

function updateAutoClassifyConfirmState() {
  const selectedFolderId = autoFolderSelect?.value || autoSuggestedTargetFolderId;
  btnConfirm.disabled = Boolean(lastDuplicate && selectedFolderId === String(lastDuplicate.folderId));
  btnConfirm.title = btnConfirm.disabled
    ? chrome.i18n.getMessage('lightDuplicateAvoid')
    : '';
}

function clearAutoClassifyCloseTimer() {
  clearTimeout(autoClassifyCloseTimer);
  autoClassifyCloseTimer = null;
}

function scheduleAutoClassifyClose(delay = 900) {
  clearAutoClassifyCloseTimer();
  autoClassifyCloseTimer = setTimeout(() => {
    chrome.runtime.sendMessage({
      action: 'clear_pending_auto_bookmark_suggestion',
      bookmarkId: autoClassifyBookmarkId
    }, () => {
      window.close();
    });
  }, delay);
}

function renderAutoClassifyLoading(pending) {
  hideError();
  clearAutoClassifyCloseTimer();
  resetSuggestion();
  lastFolders = pending?.folders || [];
  lastDuplicate = pending?.existingDuplicate || null;

  const bookmark = pending?.bookmark || {};
  activeUrl = bookmark.url || '';
  setBookmarkTitle(bookmark.title || '');
  elUrl.textContent = activeUrl || '-';
  elFolderIcon.textContent = '⏳';
  elFolderLbl.textContent = chrome.i18n.getMessage('lightAutoClassifyLoading') || 'Analyse en cours';
  elFolderPath.textContent = '';
  if (elAutoStatus) elAutoStatus.textContent = chrome.i18n.getMessage('lightAutoClassifyLoading') || 'Analyse du favori en cours...';
  elReason.textContent = chrome.i18n.getMessage('lightAutoClassifyLoading') || 'Analyse du favori en cours...';
  btnConfirm.classList.add('hidden');
  if (elAutoTargetArea) elAutoTargetArea.classList.add('hidden');
  elCard.classList.remove('hidden');
}

function setAutoClassifyModeLayout() {
  btnAnalyze.classList.add('hidden');
  btnAlternative.classList.add('hidden');
  btnManualSave.classList.add('hidden');
  manualSection.classList.add('hidden');
  btnAdvanced.classList.add('hidden');
  btnReorgAll.classList.add('hidden');
  elTitle.readOnly = true;
}

function setBookmarkTitle(fullTitle) {
  const value = fullTitle || '';
  elTitle.value = value;
  elTitle.title = value;
  elName.textContent = value || '-';
  elName.title = value;
}

function renderAutoClassifySuggestion(pending) {
  hideError();
  clearAutoClassifyCloseTimer();
  resetSuggestion();
  lastFolders = pending.folders || [];
  lastDuplicate = pending.existingDuplicate || null;

  const bookmark = pending.bookmark || {};
  activeUrl = bookmark.url || '';
  setBookmarkTitle(bookmark.title || '');
  elUrl.textContent = activeUrl || '-';

  if (pending.type === 'error') {
    showError(pending.error || chrome.i18n.getMessage('lightAutoClassifyError') || 'Erreur de suggestion LLM.');
    btnConfirm.classList.add('hidden');
    if (elAutoTargetArea) elAutoTargetArea.classList.add('hidden');
    return;
  }

  if (pending.type === 'loading') {
    renderAutoClassifyLoading(pending);
    return;
  }

  if (pending.type === 'moved') {
    lastSuggestion = pending.suggestion || null;
    setBookmarkTitle(bookmark.title || '');
    if (lastSuggestion?.action === 'create_new') {
      elFolderIcon.textContent = '📁';
      elFolderLbl.textContent = chrome.i18n.getMessage('lightSuggestedFolderLabel') || chrome.i18n.getMessage('lightNewFolder');
      const parentPath = resolveFolder(lastSuggestion.newFolderParentId);
      elFolderPath.textContent = `${lastSuggestion.newFolderTitle}  ←  ${parentPath}`;
    } else if (lastSuggestion?.targetFolderId) {
      elFolderIcon.textContent = '📂';
      elFolderLbl.textContent = chrome.i18n.getMessage('lightSuggestedFolderLabel') || chrome.i18n.getMessage('lightFolderLabel');
      elFolderPath.textContent = resolveFolder(lastSuggestion.targetFolderId);
    }
    if (elAutoStatus) elAutoStatus.textContent = chrome.i18n.getMessage('lightAutoClassifyMoveSuccess') || 'Le favori a été déplacé automatiquement.';
    elReason.textContent = (lastSuggestion?.explanation || '').trim();
    elCard.classList.remove('hidden');
    btnConfirm.classList.add('hidden');
    btnAlternative.classList.add('hidden');
    if (elAutoTargetArea) elAutoTargetArea.classList.add('hidden');
    scheduleAutoClassifyClose(1200);
    return;
  }

  lastSuggestion = pending.suggestion || null;
  if (!lastSuggestion) {
    showError(chrome.i18n.getMessage('lightAutoClassifyError') || 'Suggestion indisponible.');
    btnConfirm.classList.add('hidden');
    return;
  }

  setBookmarkTitle(bookmark.title || '');
  if (lastSuggestion.action === 'create_new') {
    elFolderIcon.textContent = '📁';
    elFolderLbl.textContent = chrome.i18n.getMessage('lightSuggestedFolderLabel') || chrome.i18n.getMessage('lightNewFolder');
    const parentPath = resolveFolder(lastSuggestion.newFolderParentId);
    elFolderPath.textContent = `${lastSuggestion.newFolderTitle}  ←  ${parentPath}`;
  } else {
    elFolderIcon.textContent = '📂';
    elFolderLbl.textContent = chrome.i18n.getMessage('lightSuggestedFolderLabel') || chrome.i18n.getMessage('lightFolderLabel');
    elFolderPath.textContent = resolveFolder(lastSuggestion.targetFolderId);
  }

  const confidence = Number.parseFloat(pending.confidence);
  const threshold = Number.parseFloat(pending.threshold);
  const confidenceText = Number.isFinite(confidence) ? `${Math.round(confidence * 100)}%` : '?';
  const thresholdText = Number.isFinite(threshold) ? `${Math.round(threshold * 100)}%` : '?';
  if (elAutoStatus) {
    if (pending.autoMoveEnabled) {
      elAutoStatus.textContent = Number.isFinite(confidence) && Number.isFinite(threshold)
        ? (chrome.i18n.getMessage('lightAutoClassifyConfidence', [confidenceText, thresholdText]) || `Confiance ${confidenceText} / seuil ${thresholdText}`)
        : (chrome.i18n.getMessage('lightAutoClassifySuggestionReady') || 'Suggestion prête.');
    } else {
      elAutoStatus.textContent = chrome.i18n.getMessage('lightAutoClassifyChooseTarget') || 'Vous pouvez changer le nom et le dossier cible ci-dessous.';
    }
  }

  elReason.textContent = lastSuggestion.explanation || chrome.i18n.getMessage('lightSemanticRecommendation');

  if (lastDuplicate) {
    elDuplicateLocation.textContent = chrome.i18n.getMessage('lightDuplicateLocation', [lastDuplicate.folderPath]);
    elDuplicateWarning.style.display = 'block';
  } else {
    elDuplicateWarning.style.display = 'none';
  }

  btnConfirm.textContent = chrome.i18n.getMessage('lightApplyChosenTargetBtn') || 'Déplacer vers ce dossier';

  if (elAutoTargetArea) elAutoTargetArea.classList.remove('hidden');
  autoSuggestedTargetFolderId = lastSuggestion.action === 'use_existing'
    ? String(lastSuggestion.targetFolderId || '')
    : '';
  populateFolderSelect();
  if (autoTitleInput) {
    const defaultTitle = lastSuggestion.suggestedTitle || bookmark.title || '';
    autoTitleInput.value = defaultTitle;
    autoTitleInput.title = bookmark.title || defaultTitle;
  }
  updateAutoClassifyConfirmState();

  elCard.classList.remove('hidden');
  btnConfirm.classList.remove('hidden');
}

function loadAutoClassifyState() {
  if (!autoClassifyBookmarkId) {
    showError(chrome.i18n.getMessage('lightAutoClassifyError') || 'Aucun bookmark à traiter.');
    return;
  }

  btnAnalyze.disabled = true;
  btnConfirm.classList.add('hidden');
  btnConfirm.textContent = chrome.i18n.getMessage('lightApplyChosenTargetBtn') || 'Déplacer vers ce dossier';

  chrome.runtime.sendMessage({
    action: 'get_pending_auto_bookmark_suggestion',
    bookmarkId: autoClassifyBookmarkId
  }, (response) => {
    if (chrome.runtime.lastError) {
      showError(chrome.i18n.getMessage('lightErrorWorkerComm'));
      return;
    }

    if (!response || !response.success) {
      showError(response?.error || chrome.i18n.getMessage('lightAutoClassifyError') || 'Suggestion indisponible.');
      return;
    }

    if (!response.pending) {
      renderAutoClassifyLoading({});
      return;
    }

    renderAutoClassifySuggestion(response.pending);
  });
}

function confirmAutoClassifyMove() {
  if (!autoClassifyBookmarkId) return;
  btnConfirm.disabled = true;
  const orig = btnConfirm.textContent;
  btnConfirm.textContent = chrome.i18n.getMessage('lightSaving');
  const targetFolderId = autoFolderSelect?.value || '';
  const targetTitle = autoTitleInput?.value?.trim() || elTitle.value.trim();

  chrome.runtime.sendMessage({
    action: 'apply_pending_auto_bookmark_suggestion',
    bookmarkId: autoClassifyBookmarkId,
    targetFolderId,
    targetTitle
  }, (response) => {
    btnConfirm.disabled = false;
    btnConfirm.textContent = orig;

    if (chrome.runtime.lastError) {
      showError(chrome.i18n.getMessage('lightErrorSaving'));
      return;
    }

    if (response && response.success) {
      showToast('✅ ' + (chrome.i18n.getMessage('lightAutoClassifyMoveSuccess') || 'Favori déplacé avec succès !'));
      setTimeout(() => window.close(), 900);
    } else {
      showError(`❌ ${response?.error || chrome.i18n.getMessage('lightAutoClassifyMoveFailed') || 'Déplacement impossible'}`);
    }
  });
}

// ── Check configuration status ──────────────────────────────────────────────
function checkConfig() {
  chrome.storage.sync.get(['provider'], (res) => {
    chrome.storage.local.get(['apiKey'], (localRes) => {
      const provider = res.provider || 'openai';
      const apiKey = localRes.apiKey || '';

      if (provider !== 'ollama' && !apiKey) {
        elConfigAlert.classList.remove('hidden');
        btnAnalyze.disabled = true;
        btnAnalyze.title = chrome.i18n.getMessage('lightConfigApiKeyRequired');
      } else {
        elConfigAlert.classList.add('hidden');
        btnAnalyze.title = '';
      }
    });
  });
}

// ── Load active tab ───────────────────────────────────────────────────────────
function loadActiveTab() {
  elTitle.value = chrome.i18n.getMessage('lightLoading');
  elUrl.textContent = '-';
  btnAnalyze.disabled = true;
  hideError();
  resetSuggestion();

  chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (win) => {
    const queryInfo = { active: true };
    if (win && win.id) {
      queryInfo.windowId = win.id;
    } else {
      queryInfo.lastFocusedWindow = true;
    }

    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError || !tabs?.[0]) {
        elTitle.value = chrome.i18n.getMessage('lightNoTabDetected');
        elUrl.textContent = '-';
        return;
      }

      const tab = tabs[0];
      activeUrl = tab.url || '';
      elTitle.value = tab.title || chrome.i18n.getMessage('tabAddBookmark');
      elUrl.textContent = activeUrl;

      if (activeUrl.startsWith('http://') || activeUrl.startsWith('https://')) {
        chrome.storage.sync.get(['provider'], (res) => {
          chrome.storage.local.get(['apiKey'], (localRes) => {
            const provider = res.provider || 'openai';
            const apiKey = localRes.apiKey || '';
            if (provider !== 'ollama' && !apiKey) {
              btnAnalyze.disabled = true;
              btnAnalyze.title = chrome.i18n.getMessage('lightConfigApiKeyRequired');
            } else {
              btnAnalyze.disabled = false;
              btnAnalyze.title = '';
            }
          });
        });
      } else {
        elTitle.value = chrome.i18n.getMessage('lightTabNotSupported');
        elUrl.textContent = chrome.i18n.getMessage('lightOnlyHttps');
        showError(chrome.i18n.getMessage('lightTabNotSupportedError'));
      }
    });
  });
}

// ── Run analysis ──────────────────────────────────────────────────────────────
function runAnalysis() {
  hideError();
  btnAnalyze.disabled = true;
  btnAlternative.disabled = true;
  const origLabel = btnAnalyze.textContent;
  btnAnalyze.textContent = '🔍 ' + chrome.i18n.getMessage('lightAnalyzeBtn').replace('🔍 ', '');
  btnAnalyze.classList.add('loading-dots');
  elCard.classList.add('hidden');
  btnConfirm.classList.add('hidden');

  chrome.runtime.sendMessage({
    action: 'suggest_bookmark_location',
    bookmark: { title: elTitle.value.trim(), url: activeUrl },
    ignoredFolderIds: ignoredIds
  }, (response) => {
    btnAnalyze.disabled = false;
    btnAlternative.disabled = false;
    btnAnalyze.textContent = origLabel;
    btnAnalyze.classList.remove('loading-dots');

    if (chrome.runtime.lastError) {
      showError(chrome.i18n.getMessage('lightErrorWorkerComm'));
      return;
    }

    if (!response || !response.success) {
      const msg = response?.error || chrome.i18n.getMessage('lightAnalysisFailed');
      // Detect config issues
      if (msg.includes('API key') || msg.includes('clé') || msg.includes('401') || msg.includes('403')) {
        showError(chrome.i18n.getMessage('lightInvalidApiKey'));
      } else {
        showError(`❌ ${msg}`);
      }
      return;
    }

    lastSuggestion = response.suggestion;
    if (response.folders) lastFolders = response.folders;
    if (response.existingDuplicate) lastDuplicate = response.existingDuplicate;

    // Update title if AI suggests a cleaner one
    if (lastSuggestion.suggestedTitle) {
      setBookmarkTitle(lastSuggestion.suggestedTitle);
    } else {
      setBookmarkTitle(elTitle.value);
    }

    // Render folder
    let suggestedFolderId = null;
    if (lastSuggestion.action === 'create_new') {
      elFolderIcon.textContent = '📁';
      elFolderLbl.textContent = chrome.i18n.getMessage('lightSuggestedFolderLabel') || chrome.i18n.getMessage('lightNewFolder');
      const parentPath = resolveFolder(lastSuggestion.newFolderParentId);
      elFolderPath.textContent = `${lastSuggestion.newFolderTitle}  ←  ${parentPath}`;
      suggestedFolderId = 'new_folder';
    } else {
      elFolderIcon.textContent = '📂';
      elFolderLbl.textContent = chrome.i18n.getMessage('lightSuggestedFolderLabel') || chrome.i18n.getMessage('lightFolderLabel');
      elFolderPath.textContent = resolveFolder(lastSuggestion.targetFolderId);
      suggestedFolderId = lastSuggestion.targetFolderId;
    }

    elReason.textContent = lastSuggestion.explanation || chrome.i18n.getMessage('lightSemanticRecommendation');

    // Handle duplicate warning
    if (lastDuplicate) {
      elDuplicateLocation.textContent = chrome.i18n.getMessage('lightDuplicateLocation', [lastDuplicate.folderPath]);
      elDuplicateWarning.style.display = 'block';

      // Disable confirm button if same location
      if (suggestedFolderId === lastDuplicate.folderId) {
        btnConfirm.disabled = true;
        btnConfirm.title = chrome.i18n.getMessage('lightDuplicateAvoid');
      } else {
        btnConfirm.disabled = false;
        btnConfirm.title = '';
      }
    } else {
      elDuplicateWarning.style.display = 'none';
      btnConfirm.disabled = false;
      btnConfirm.title = '';
    }

    elCard.classList.remove('hidden');
    btnConfirm.classList.remove('hidden');
    btnAlternative.classList.remove('hidden');
  });
}

// ── Confirm save (AI suggestion) ──────────────────────────────────────────────
function confirmSave() {
  if (!lastSuggestion) return;

  // If duplicate exists, ask user where to keep it
  if (lastDuplicate) {
    const targetPath = lastSuggestion.action === 'create_new'
      ? lastSuggestion.newFolderTitle
      : resolveFolder(lastSuggestion.targetFolderId);
    const message = `Ce lien existe déjà dans :\n  ${lastDuplicate.folderPath}\n\nOù préférez-vous le garder ?\n\n[Nouveau] ${targetPath}\n[Actuel] ${lastDuplicate.folderPath}`;

    // Simple choice: use confirm dialog
    const choice = confirm(`${message}\n\n(OK = Garder au nouvel emplacement, Annuler = Garder à l'emplacement actuel)`);

    if (!choice) {
      // User wants to keep at existing location
      showToast('✅ Le lien reste à son emplacement');
      setTimeout(() => loadActiveTab(), 1200);
      return;
    }
    // User wants new location - delete old one
    chrome.bookmarks.remove(lastDuplicate.id, () => {
      if (chrome.runtime.lastError) {
        showError('❌ Erreur lors de la suppression du doublons.');
        return;
      }
      saveNewBookmark();
    });
  } else {
    saveNewBookmark();
  }
}

function saveNewBookmark() {
  btnConfirm.disabled = true;
  const orig = btnConfirm.textContent;
  btnConfirm.textContent = chrome.i18n.getMessage('lightSaving');

  chrome.runtime.sendMessage({
    action: 'save_suggested_bookmark',
    suggestion: lastSuggestion,
    bookmark: { title: elTitle.value.trim(), url: activeUrl }
  }, (response) => {
    btnConfirm.disabled = false;
    btnConfirm.textContent = orig;

    if (chrome.runtime.lastError) {
      showError(chrome.i18n.getMessage('lightErrorSaving'));
      return;
    }

    if (response && response.success) {
      showToast('✅ ' + chrome.i18n.getMessage('lightSaveSuccess'));
      // Reset for next use
      setTimeout(() => loadActiveTab(), 1200);
    } else {
      showError(`❌ ${response?.error || chrome.i18n.getMessage('lightSaveFailed')}`);
    }
  });
}

// ── Manual save ────────────────────────────────────────────────────────────────
function saveManualBookmark() {
  const title = manualTitleInput.value.trim();
  const folderId = manualFolderSelect.value;

  if (!title) {
    showError(chrome.i18n.getMessage('lightManualTitleRequired'));
    return;
  }
  if (!folderId) {
    showError(chrome.i18n.getMessage('lightManualFolderRequired'));
    return;
  }

  btnManualConfirm.disabled = true;
  const orig = btnManualConfirm.textContent;
  btnManualConfirm.textContent = chrome.i18n.getMessage('lightSaving');

  chrome.runtime.sendMessage({
    action: 'save_manual_bookmark',
    bookmark: { title, url: activeUrl, parentId: folderId }
  }, (response) => {
    btnManualConfirm.disabled = false;
    btnManualConfirm.textContent = orig;

    if (chrome.runtime.lastError) {
      showError(chrome.i18n.getMessage('lightErrorSaving'));
      return;
    }

    if (response && response.success) {
      showToast('✅ ' + chrome.i18n.getMessage('lightSaveSuccess'));
      // Reset for next use
      setTimeout(() => {
        manualSection.classList.add('hidden');
        loadActiveTab();
      }, 1200);
    } else {
      showError(`❌ ${response?.error || chrome.i18n.getMessage('lightSaveFailed')}`);
    }
  });
}

// ── Open advanced window ──────────────────────────────────────────────────────
function openAdvanced() {
  chrome.windows.create({
    url: chrome.runtime.getURL('extension/popup.html'),
    type: 'popup',
    width: 1200,
    height: 1050,
    left: 100,
    top: 100
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Erreur ouverture avancée:', chrome.runtime.lastError);
    }
  });
}

function openQuickReorg() {
  chrome.storage.local.set({ activeTab: 'rangement' }, () => {
    openAdvanced();
  });
}

// ── Privacy policy ────────────────────────────────────────────────────────────
function openPrivacy() {
  chrome.tabs.create({ url: chrome.runtime.getURL('extension/privacy_policy.html') });
}

// ── Event listeners ───────────────────────────────────────────────────────────
btnAnalyze.addEventListener('click', runAnalysis);

btnAlternative.addEventListener('click', () => {
  if (lastSuggestion) {
    const lastId = lastSuggestion.action === 'create_new'
      ? lastSuggestion.newFolderParentId
      : lastSuggestion.targetFolderId;
    if (lastId && !ignoredIds.includes(lastId)) {
      ignoredIds.push(lastId);
    }
  }
  runAnalysis();
});

btnConfirm.addEventListener('click', () => {
  if (isAutoClassifyMode) {
    confirmAutoClassifyMove();
  } else {
    confirmSave();
  }
});

if (autoFolderSelect) {
  autoFolderSelect.addEventListener('change', updateAutoClassifyConfirmState);
}

btnManualSave.addEventListener('click', () => {
  if (manualSection.classList.contains('hidden')) {
    manualSection.classList.remove('hidden');
    manualTitleInput.value = elTitle.value;
    manualTitleInput.focus();
  } else {
    manualSection.classList.add('hidden');
  }
});

btnManualConfirm.addEventListener('click', saveManualBookmark);

btnAdvanced.addEventListener('click', openAdvanced);
btnPrivacy.addEventListener('click', openPrivacy);
btnConfigureAI.addEventListener('click', () => {
  chrome.storage.local.set({ activeTab: 'config' }, () => {
    openAdvanced();
  });
});
btnReorgAll.addEventListener('click', openQuickReorg);
if (quickReorgCard) {
  quickReorgCard.addEventListener('click', (event) => {
    if (event.target === btnReorgAll) return;
    openQuickReorg();
  });
  quickReorgCard.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openQuickReorg();
    }
  });
}

// ── Auto-load on open ─────────────────────────────────────────────────────────
applyI18n();
if (isAutoClassifyMode) {
  setAutoClassifyModeLayout();
  loadAutoClassifyState();
} else {
  loadActiveTab();
}
loadFolders();
checkConfig();

if (isAutoClassifyMode) {
  autoClassifyStorageListener = (changes, areaName) => {
    if (areaName !== 'local' || !changes.pendingAutoBookmarkSuggestions) return;
    const nextPending = changes.pendingAutoBookmarkSuggestions.newValue?.[autoClassifyBookmarkId] || null;
    if (!nextPending) return;
    renderAutoClassifySuggestion(nextPending);
  };
  chrome.storage.onChanged.addListener(autoClassifyStorageListener);
  window.addEventListener('beforeunload', () => {
    if (autoClassifyStorageListener) {
      chrome.storage.onChanged.removeListener(autoClassifyStorageListener);
      autoClassifyStorageListener = null;
    }
    clearAutoClassifyCloseTimer();
  });
}

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason) || 'Unknown error';
  console.error('Unhandled rejection in popup-light:', event.reason);
  sharedShowToast(chrome.i18n.getMessage('popupUnhandledError', [msg]) || msg, elToast);
});

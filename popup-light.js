/**
 * popup-light.js — FavorAI Light Mode
 * Handles the compact popup (Add Bookmark only).
 * Loads active tab automatically on open.
 */

// ── i18n helpers ──────────────────────────────────────────────────────────────
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr') || 'textContent';
    const msg = chrome.i18n.getMessage(key);
    if (msg) {
      if (attr === 'textContent') {
        el.textContent = msg;
      } else if (attr === 'placeholder') {
        el.placeholder = msg;
      } else if (attr === 'title') {
        el.title = msg;
      } else {
        el.setAttribute(attr, msg);
      }
    }
  });
}

// ── State ────────────────────────────────────────────────────────────────────
let activeUrl = '';
let lastSuggestion = null;
let lastFolders = [];
let ignoredIds = [];

// ── DOM refs ─────────────────────────────────────────────────────────────────
const elTitle      = document.getElementById('lightBookmarkTitle');
const elUrl        = document.getElementById('lightTabUrl');
const elError      = document.getElementById('errorBanner');
const elCard       = document.getElementById('lightSuggestionCard');
const elName       = document.getElementById('lightSuggestionName');
const elFolderIcon = document.getElementById('lightFolderIcon');
const elFolderLbl  = document.getElementById('lightFolderLabel');
const elFolderPath = document.getElementById('lightFolderPath');
const elReason     = document.getElementById('lightSuggestionReason');
const elToast      = document.getElementById('lightToast');

const btnAnalyze     = document.getElementById('btnLightAnalyze');
const btnAlternative = document.getElementById('btnLightAlternative');
const btnConfirm     = document.getElementById('btnLightConfirm');
const btnAdvanced    = document.getElementById('btnOpenAdvanced');
const btnPrivacy     = document.getElementById('btnLightPrivacy');

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, duration = 2800) {
  elToast.textContent = msg;
  elToast.style.opacity = '1';
  elToast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => {
    elToast.style.opacity = '0';
    elToast.style.transform = 'translateX(-50%) translateY(20px)';
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
  const roots = ['Barre de favoris', 'Favoris', 'Bookmarks bar', 'Bookmarks Bar', 'Other bookmarks', 'Autres favoris', 'Mobile bookmarks'];
  if (parts.length > 1 && roots.includes(parts[0])) return parts.slice(1).join(' > ');
  return parts.join(' > ');
}

// ── Reset suggestion UI ───────────────────────────────────────────────────────
function resetSuggestion() {
  lastSuggestion = null;
  lastFolders = [];
  ignoredIds = [];
  elCard.classList.add('hidden');
  btnConfirm.classList.add('hidden');
  btnAlternative.classList.add('hidden');
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
        btnAnalyze.disabled = false;
      } else {
        elTitle.value = 'Onglet non supporté';
        elUrl.textContent = 'Seules les pages HTTP/HTTPS peuvent être ajoutées.';
        showError('⚠️ Cet onglet ne peut pas être ajouté aux favoris. Naviguez vers une page web (http/https).');
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
      showError('❌ Erreur de communication avec le service worker.');
      return;
    }

    if (!response || !response.success) {
      const msg = response?.error || "Échec de l'analyse IA.";
      // Detect config issues
      if (msg.includes('API key') || msg.includes('clé') || msg.includes('401') || msg.includes('403')) {
        showError('🔑 Clé API manquante ou invalide. Ouvrez l\'interface complète pour configurer.');
      } else {
        showError(`❌ ${msg}`);
      }
      return;
    }

    lastSuggestion = response.suggestion;
    if (response.folders) lastFolders = response.folders;

    // Update title if AI suggests a cleaner one
    if (lastSuggestion.suggestedTitle) {
      elTitle.value = lastSuggestion.suggestedTitle;
    }

    // Render bookmark name
    elName.textContent = elTitle.value || '-';

    // Render folder
    if (lastSuggestion.action === 'create_new') {
      elFolderIcon.textContent = '📁';
      elFolderLbl.textContent = 'Nouveau dossier';
      const parentPath = resolveFolder(lastSuggestion.newFolderParentId);
      elFolderPath.textContent = `${lastSuggestion.newFolderTitle}  ←  ${parentPath}`;
    } else {
      elFolderIcon.textContent = '📂';
      elFolderLbl.textContent = chrome.i18n.getMessage('lightFolderLabel');
      elFolderPath.textContent = resolveFolder(lastSuggestion.targetFolderId);
    }

    elReason.textContent = lastSuggestion.explanation || 'Recommandation sémantique de l\'IA.';

    elCard.classList.remove('hidden');
    btnConfirm.classList.remove('hidden');
    btnAlternative.classList.remove('hidden');
  });
}

// ── Confirm save ──────────────────────────────────────────────────────────────
function confirmSave() {
  if (!lastSuggestion) return;
  btnConfirm.disabled = true;
  const orig = btnConfirm.textContent;
  btnConfirm.textContent = 'Enregistrement…';

  chrome.runtime.sendMessage({
    action: 'save_suggested_bookmark',
    suggestion: lastSuggestion,
    bookmark: { title: elTitle.value.trim(), url: activeUrl }
  }, (response) => {
    btnConfirm.disabled = false;
    btnConfirm.textContent = orig;

    if (chrome.runtime.lastError) {
      showError('❌ Erreur lors de l\'enregistrement.');
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

// ── Open advanced window ──────────────────────────────────────────────────────
function openAdvanced() {
  chrome.windows.create({
    url: chrome.runtime.getURL('popup.html'),
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

// ── Privacy policy ────────────────────────────────────────────────────────────
function openPrivacy() {
  chrome.tabs.create({ url: 'https://favorai.app/privacy' });
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

btnConfirm.addEventListener('click', confirmSave);
btnAdvanced.addEventListener('click', openAdvanced);
btnPrivacy.addEventListener('click', openPrivacy);

// ── Auto-load on open ─────────────────────────────────────────────────────────
applyI18n();
loadActiveTab();

// Default prompts
const PROMPT_DEFAULTS = {
  minimal: `MODE: Minimal Reorganization — fix only clear semantic misplacements. Preserve everything else.
RULE #1: When in doubt → do nothing. Prefer false negatives over false positives.

FOR EACH BOOKMARK, follow these 3 steps:

Step 1 — TOPIC EXTRACTION
Infer the bookmark's main topic from its title. Assign 1–3 semantic tags (e.g. "DevOps", "AI", "Finance", "Cooking").

Step 2 — FOLDER THEME
Infer the semantic theme of its current folder from the folder name and its siblings.

Step 3 — COHERENCE SCORE
  2 = Strong match (same domain)        → KEEP
  1 = Weak match (related domain)       → KEEP
  0 = Clear mismatch (different domain) → consider MOVE

MOVE LOGIC (only when score = 0):
  1. Find the existing folder with the highest semantic match (score ≥ 2 required as destination)
  2. If found → move there
  3. If not found → create a new folder ONLY if the topic is unambiguous
  4. If still uncertain → DO NOT MOVE

ABSOLUTE CONSTRAINTS:
- NEVER rename, delete, or move any folder
- NEVER restructure the hierarchy
- NEVER mass-move or "optimize" the structure
- NEVER act on ambiguous or unclear titles
- Only bookmarks with score = 0 AND a clear score-2 destination may be moved
- QUICK ACCESS: any bookmark placed directly on the bookmarks bar (not inside any folder) must be moved into a "★ Quick Access" folder — create it if it doesn't exist

EXPLANATION FORMAT:
Structure the explanation field as:

**MOVED BOOKMARKS**
"Moved '[title]' from '[source]' to '[target]' — [semantic mismatch reason]."

**NEW FOLDERS CREATED** (if any)
"Created '[name]' because [justification]."

**BORDERLINE CASES** (optional)
"Kept '[title]' in '[folder]' despite [ambiguity] — [why it was not moved]."`,

  complete: `MODE: Complete Reorganization (Full Structure Redesign)

CORE OBJECTIVE:
Redesign the entire bookmark structure for maximum semantic clarity and usability.
Create a clean, logically organized system that makes finding any bookmark fast and intuitive.

ANALYSIS PHASE:
1. CATEGORIZE ALL BOOKMARKS by semantic theme:
   - Technical: Programming, DevOps, Cloud, AI, Security, etc.
   - Personal/Hobbies: Pets, Sports, Gaming, Cooking, Travel, etc.
   - Professional: Work, Business, Finance, HR, etc.
   - Reference: Documentation, Learning, Tutorials, News, etc.
   - Entertainment: Videos, Streaming, Music, Podcasts, etc.

2. DETECT SEMANTIC MISMATCHES: Find all bookmarks in wrong categories.
   Example: "Cat care tips" in "Homelab" → MISMATCH (belongs in Pets/Hobbies)
   Example: "Python performance tuning" in "Development" → COHERENT (correct)

3. EVALUATE CURRENT STRUCTURE: Identify:
   - Folders too broad or too narrow
   - Folders with mixed/incoherent content
   - Duplicate folder names (e.g., "JS" and "JavaScript")
   - Empty or thin folders (< 3 bookmarks)

4. DETECT DUPLICATE BOOKMARKS: If two bookmarks point to the same resource,
   keep only the one in the most semantically correct folder and report the removal.

REORGANIZATION STRATEGY:
1. BOOKMARKS BAR USAGE:
   - HARD LIMIT: MAXIMUM 8 top-level folders — never exceed 8, count them before returning
   - TARGET: exactly 6 to 8 top-level folders
   - NEVER collapse everything into 1-3 folders
   - NEVER create a catch-all folder like "Bookmarks" or "Links" at the top level
   - If you have more than 8 categories, merge the most related ones (e.g. "DevOps" + "Cloud" → "DevOps & Cloud")
   - Top-level = broad themes (Development, Personal, Work, Reference, Finance, News, etc.)
   - Sub-folders = specific topics (Python, JavaScript, Pets, Gaming, etc.)
   - Maximum 3 levels of nesting

2. MERGE & CONSOLIDATE:
   - Combine redundant folders: "JS" + "JavaScript" → "JavaScript"
   - Merge thin folders (< 3 bookmarks) into broader parents
   - Example: "Fonts" + "Icons" + "Colors" → "Design Resources"
   - Remove empty folders after merging

3. CREATE NEW FOLDERS ONLY FOR:
   - New semantic categories not covered by current structure
   - Sub-groups when a folder exceeds ~15-20 bookmarks
   - Topics appearing multiple times in unrelated folders

SEMANTIC COHERENCE RULES:
- EVERY bookmark must fit logically in its folder
- Folder titles must accurately describe ALL their content
- No personal bookmarks in technical folders and vice versa
- No mixed themes in a single folder
- Emojis / Prefix symbols: Feel free to prefix folder names with a single expressive emoji (like 💼, 🏠, 🤖, 🎨, etc.) if it represents the theme well.

FINAL VALIDATION:
✅ Top-level folder count is between 6 and 8 — HARD MAXIMUM 8, count them explicitly
✅ If count > 8: STOP, merge least populated top-level folders until count ≤ 8
✅ No single folder contains more than ~40% of all bookmarks
   EXCEPTION: If 70%+ of content is technical, one top-level tech folder may hold up to 60% provided it has 4+ rich sub-folders
✅ No technical bookmarks in personal folders
✅ No personal bookmarks in technical folders
✅ All folder names accurately describe their content
✅ No duplicate URLs in multiple folders
✅ No empty folders remain
✅ NO ORPHAN FOLDERS: original folders whose content was fully moved must be ABSENT from reorganizedTree
✅ QUICK ACCESS: all direct bookmarks on the bar (not in any folder) are in a "★ Quick Access" folder`,

  suggest: `You are an expert bookmark organizer. Your task is to recommend the best parent folder location for a new bookmark.

Analyze the bookmark's title and URL:
- Title: "{title}"
- URL: "{url}"

Here is a list of all existing folder paths in my bookmarks structure (in the format ID: Path):
{folders}

Instructions:
1. If the bookmark fits into one of the existing folders, recommend "use_existing" and return the ID of that folder in "targetFolderId".
2. If the bookmark does not fit into any existing folders, recommend "create_new". Suggest a name for a new folder (e.g. "Cooking", "Finance" - optionally including an emoji like 🍳 Cooking) in "newFolderTitle", and return the existing parent folder ID under which it should be created in "newFolderParentId".
3. Provide a brief explanation for your recommendation in "explanation".
4. Recommend a cleaner/better title for this bookmark (e.g. removing site name suffixes like " - Google Maps" or " | GitHub") and return it in "suggestedTitle".

Your response MUST be a valid JSON object matching this schema:
{
  "action": "use_existing" | "create_new",
  "targetFolderId": "ID of existing folder (if action is use_existing)",
  "newFolderTitle": "Name of new folder (if action is create_new)",
  "newFolderParentId": "ID of existing parent folder (if action is create_new)",
  "suggestedTitle": "Suggested cleaner title for this bookmark",
  "explanation": "Brief reason for this choice"
}`
};

// Cache DOM elements
const btnDetach = document.getElementById('btnDetach');
const tabRangementBtn = document.getElementById('tabRangementBtn');
const tabConfigBtn = document.getElementById('tabConfigBtn');
const tabHistoryBtn = document.getElementById('tabHistoryBtn');

const tabRangementPanel = document.getElementById('tabRangementPanel');
const tabConfigPanel = document.getElementById('tabConfigPanel');
const tabHistoryPanel = document.getElementById('tabHistoryPanel');
const tabAddBookmarkPanel = document.getElementById('tabAddBookmarkPanel');

const tabAddBookmarkBtn = document.getElementById('tabAddBookmarkBtn');
const activeTabUrl = document.getElementById('activeTabUrl');
const btnAnalyzeBookmark = document.getElementById('btnAnalyzeBookmark');
const aiBookmarkSuggestion = document.getElementById('aiBookmarkSuggestion');
const suggestionFolderResult = document.getElementById('suggestionFolderResult');
const suggestionFolderIcon = document.getElementById('suggestionFolderIcon');
const suggestionFolderLabel = document.getElementById('suggestionFolderLabel');
const suggestionBookmarkName = document.getElementById('suggestionBookmarkName');
const suggestionReasonResult = document.getElementById('suggestionReasonResult');
const btnConfirmAddBookmark = document.getElementById('btnConfirmAddBookmark');
const bookmarkTitleInput = document.getElementById('bookmarkTitleInput');
const btnAlternativeBookmark = document.getElementById('btnAlternativeBookmark');
const btnManualAddBookmark = document.getElementById('btnManualAddBookmark');
const manualAddSection = document.getElementById('manualAddSection');
const manualAddTitle = document.getElementById('manualAddTitle');
const manualAddFolder = document.getElementById('manualAddFolder');
const btnManualAddConfirm = document.getElementById('btnManualAddConfirm');

const providerSelect = document.getElementById('provider');
const apiUrlInput = document.getElementById('apiUrl');
const apiKeyInput = document.getElementById('apiKey');
const modelNameInput = document.getElementById('modelName');
const modelSelect = document.getElementById('modelSelect');
const btnFetchModels = document.getElementById('btnFetchModels');
const linkCheckBatchSizeSelect = document.getElementById('linkCheckBatchSize');
const debugModeCheckbox = document.getElementById('debugMode');
const promptMinimalInput = document.getElementById('promptMinimal');
const promptCompleteInput = document.getElementById('promptComplete');
const promptSuggestInput = document.getElementById('promptSuggest');
const btnResetPrompts = document.getElementById('btnResetPrompts');

const btnSaveConfig = document.getElementById('btnSaveConfig');
const btnResetConfig = document.getElementById('btnResetConfig');
const btnExportConfig = document.getElementById('btnExportConfig');
const btnImportConfig = document.getElementById('btnImportConfig');
const importConfigFileInput = document.getElementById('importConfigFile');

const btnMinReorg = document.getElementById('btnMinReorg');
const btnFullReorg = document.getElementById('btnFullReorg');
const btnStopReorg = document.getElementById('btnStopReorg');
const checkDeadLinksCheckbox = document.getElementById('checkDeadLinks');
const reorgBtnGroup = document.getElementById('reorgBtnGroup');

const logContainer = document.getElementById('logContainer');
const progressBarContainer = document.getElementById('progressBarContainer');
const progressBar = document.getElementById('progressBar');
const toast = document.getElementById('toast');

const mainView = document.getElementById('mainView');
const validationView = document.getElementById('validationView');
const explanationBlock = document.getElementById('explanationBlock');
const iaExplanationText = document.getElementById('iaExplanationText');
const actionCountSpan = document.getElementById('actionCount');
const actionListContainer = document.getElementById('actionListContainer');
const selectAllSpan = document.getElementById('selectAll');
const selectNoneSpan = document.getElementById('selectNone');

const btnCancel = document.getElementById('btnCancel');
const btnApply = document.getElementById('btnApply');
const btnPrivacyPolicy = document.getElementById('btnPrivacyPolicy');
const btnClearHistory = document.getElementById('btnClearHistory');
const historyListContainer = document.getElementById('historyListContainer');

// Custom confirmation modal elements
const confirmModal = document.getElementById('confirmModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const modalBtnCancel = document.getElementById('modalBtnCancel');
const modalBtnConfirm = document.getElementById('modalBtnConfirm');

// Add Bookmark state variables
let activeTabUrlValue = '';
let activeTabTitleValue = '';
let lastAiSuggestion = null;
let bookmarkFolders = [];
let lastFoldersList = [];
let ignoredFolderIds = [];

// Default API URL and model names
const PROVIDER_DEFAULTS = {
  openai:   { url: 'https://api.openai.com/v1',                   model: 'gpt-5.5',             maxTokens: '131072' },
  google:   { url: 'https://generativelanguage.googleapis.com',   model: 'gemini-3.5-flash',    maxTokens: '65536'  },
  mistral:  { url: 'https://api.mistral.ai/v1',                   model: 'mistral-large-latest', maxTokens: '131072' },
  grok:     { url: 'https://api.x.ai/v1',                         model: 'grok-2',              maxTokens: '8192'   },
  claude:   { url: 'https://api.anthropic.com',                   model: 'claude-sonnet-4-6',   maxTokens: '131072' },
  deepseek: { url: 'https://api.deepseek.com/v1',                 model: 'deepseek-chat',       maxTokens: '65536'  },
  ollama:   { url: 'http://localhost:11434',                       model: 'llama3.1',            maxTokens: '131072' },
  custom:   { url: '',                                             model: '',                    maxTokens: '131072' }
};

const PROVIDER_MODELS = {
  openai:   ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-4o', 'gpt-4o-mini'],
  google:   ['gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  mistral:  ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  grok:     ['grok-2', 'grok-2-mini', 'grok-beta'],
  claude:   ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  ollama:   ['llama3.1', 'llama3', 'mistral', 'gemma2', 'phi3', 'qwen2.5'],
  custom:   []
};

/**
 * Transtale dynamic pages
 */
function translatePage() {
  document.documentElement.lang = chrome.i18n.getUILanguage() || 'en';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr') || 'textContent';
    const msg = chrome.i18n.getMessage(key);
    if (msg) {
      if (attr === 'textContent') {
        el.textContent = msg;
      } else if (attr === 'title') {
        el.title = msg;
      } else if (attr === 'placeholder') {
        el.placeholder = msg;
      } else {
        el.setAttribute(attr, msg);
      }
    }
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.title = msg;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const msg = chrome.i18n.getMessage(key);
    if (msg) el.placeholder = msg;
  });
}

/**
 * Load folders for manual bookmark save
 */
function loadBookmarkFoldersForUI() {
  chrome.runtime.sendMessage({ action: 'get_folders' }, (response) => {
    if (response && response.folders) {
      bookmarkFolders = response.folders;
      populateManualFolderSelect();
    }
  });
}

/**
 * Populate the manual folder select
 */
function populateManualFolderSelect() {
  manualAddFolder.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = chrome.i18n.getMessage('lightSelectFolder');
  manualAddFolder.appendChild(placeholder);

  bookmarkFolders.forEach(folder => {
    const option = document.createElement('option');
    option.value = folder.id;
    const parts = folder.path.split(' > ');
    const roots = ['Barre de favoris', 'Favoris', 'Bookmarks bar', 'Bookmarks Bar', 'Other bookmarks', 'Autres favoris', 'Mobile bookmarks'];
    const displayPath = parts.length > 1 && roots.includes(parts[0]) ? parts.slice(1).join(' > ') : parts.join(' > ');
    option.textContent = displayPath;
    manualAddFolder.appendChild(option);
  });
}

/**
 * Save bookmark manually
 */
function saveManualBookmarkPopup() {
  const title = manualAddTitle.value.trim();
  const folderId = manualAddFolder.value;
  const url = activeTabUrl.textContent;

  if (!title) {
    alert('Veuillez entrer un titre.');
    return;
  }
  if (!folderId) {
    alert('Veuillez sélectionner un dossier.');
    return;
  }
  if (!url || url === '-') {
    alert('URL invalide.');
    return;
  }

  btnManualAddConfirm.disabled = true;

  chrome.runtime.sendMessage({
    action: 'save_manual_bookmark',
    bookmark: { title, url, parentId: folderId }
  }, (response) => {
    btnManualAddConfirm.disabled = false;

    if (response && response.success) {
      showToast(chrome.i18n.getMessage('lightSaveSuccess'));
      manualAddSection.style.display = 'none';
      manualAddTitle.value = '';
      manualAddFolder.value = '';
    } else {
      showToast(chrome.i18n.getMessage('lightSaveFailed'));
    }
  });
}

/**
 * Custom Confirmation Modal using Promise
 */
function showConfirm(title, message) {
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  confirmModal.classList.remove('hidden');

  return new Promise((resolve) => {
    const cleanUp = (value) => {
      confirmModal.classList.add('hidden');
      modalBtnConfirm.removeEventListener('click', onConfirm);
      modalBtnCancel.removeEventListener('click', onCancel);
      resolve(value);
    };
    const onConfirm = () => cleanUp(true);
    const onCancel = () => cleanUp(false);

    modalBtnConfirm.addEventListener('click', onConfirm);
    modalBtnCancel.addEventListener('click', onCancel);
  });
}

// Load bookmark folders
const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');
function loadBookmarkFolders() {
  chrome.bookmarks.getTree((tree) => {
    const folders = [];

    // Build tree with proper Unicode box-drawing characters
    // parentPrefix tracks the vertical lines needed for ancestors
    function traverse(node, parentPrefix, depth) {
      if (!node.children) return;
      const subFolders = node.children.filter(c => !c.url);
      subFolders.forEach((child, index) => {
        const isLast = index === subFolders.length - 1;
        let linePrefix, childPrefix;
        if (depth === 0) {
          linePrefix = '';
          childPrefix = '    ';
        } else {
          linePrefix = parentPrefix + (isLast ? '└─ ' : '├─ ');
          childPrefix = parentPrefix + (isLast ? '    ' : '│   ');
        }
        const name = (child.title || '(Sans nom)').substring(0, 50);
        folders.push({ id: child.id, display: linePrefix + name });
        traverse(child, childPrefix, depth + 1);
      });
    }
    traverse(tree[0], '', 0);

    while (bookmarkFolderSelect.options.length > 1) bookmarkFolderSelect.remove(1);

    for (const folder of folders) {
      const option = document.createElement('option');
      option.value = folder.id;
      option.textContent = folder.display;
      bookmarkFolderSelect.appendChild(option);
    }

    if (!bookmarkFolderSelect.value || bookmarkFolderSelect.value === 'root') {
      bookmarkFolderSelect.value = '1';
    }
  });
}

// Bind DOM Events on startup
document.addEventListener('DOMContentLoaded', () => {
  translatePage();
  loadConfig();
  restoreStatus();
  loadBookmarkFolders();
  loadBookmarkFoldersForUI();

  // Set manifest version
  const appVersionEl = document.getElementById('appVersion');
  if (appVersionEl) {
    appVersionEl.textContent = 'v' + chrome.runtime.getManifest().version;
  }
  
  toast.addEventListener('animationend', () => {
    toast.classList.remove('show');
  });
  
  providerSelect.addEventListener('change', () => {
    const provider = providerSelect.value;
    const defaults = PROVIDER_DEFAULTS[provider];
    if (defaults) {
      apiUrlInput.value = defaults.url;
      modelNameInput.value = defaults.model;
      if (defaults.maxTokens) maxTokensSelect.value = defaults.maxTokens;
      updateModelOptions(defaults.model);
    }
  });

  modelSelect.addEventListener('change', () => {
    if (modelSelect.value === 'custom') {
      modelNameInput.classList.remove('hidden');
      modelNameInput.value = '';
      modelNameInput.focus();
    } else {
      modelNameInput.classList.add('hidden');
      modelNameInput.value = modelSelect.value;
    }
    saveConfig();
  });

  btnFetchModels.addEventListener('click', () => {
    const provider = providerSelect.value;
    const apiUrl = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();
    fetchModelsFromApi(provider, apiUrl, apiKey);
  });

  btnSaveConfig.addEventListener('click', saveConfig);
  btnResetConfig.addEventListener('click', resetConfig);
  btnResetPrompts.addEventListener('click', resetPromptsToDefaults);
  btnExportConfig.addEventListener('click', exportConfig);
  btnImportConfig.addEventListener('click', () => importConfigFileInput.click());
  importConfigFileInput.addEventListener('change', importConfig);

  btnMinReorg.addEventListener('click', () => startReorganization('minimal'));
  btnFullReorg.addEventListener('click', () => startReorganization('complete'));
  btnStopReorg.addEventListener('click', stopReorganization);

  checkDeadLinksCheckbox.addEventListener('change', () => {
    chrome.storage.sync.set({ checkDeadLinks: checkDeadLinksCheckbox.checked });
  });

  btnCancel.addEventListener('click', async () => {
    const title = chrome.i18n.getMessage('btnCancel') || 'Cancel';
    const message = chrome.i18n.getMessage('dialogConfirmCancel') || 'Are you sure you want to cancel?';
    const ok = await showConfirm(title, message);
    if (!ok) return;

    chrome.runtime.sendMessage({ action: 'reset_status' }, () => {
      showView('main');
      addLog(chrome.i18n.getMessage('bgAnalysisCancelled') || '> Reorganization cancelled.', 'warning');
    });
  });

  btnApply.addEventListener('click', applyCheckedActions);

  selectAllSpan.addEventListener('click', () => {
    toggleAllCheckboxes(true);
    updateApplyButtonState();
  });
  selectNoneSpan.addEventListener('click', () => {
    toggleAllCheckboxes(false);
    updateApplyButtonState();
  });

  actionListContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('edit-btn')) {
      const actionId = e.target.getAttribute('data-id');
      startInlineEdit(actionId, e.target.closest('.action-item'));
    }
  });

  chrome.storage.local.get(['activeTab'], (res) => {
    const activeTab = res.activeTab || 'add-bookmark';
    switchTab(activeTab);
  });

  tabRangementBtn.addEventListener('click', () => switchTab('rangement'));
  tabAddBookmarkBtn.addEventListener('click', () => switchTab('add-bookmark'));
  tabConfigBtn.addEventListener('click', () => switchTab('config'));
  tabHistoryBtn.addEventListener('click', () => switchTab('history'));

  if (btnPrivacyPolicy) {
    btnPrivacyPolicy.addEventListener('click', (e) => {
      e.preventDefault();
      window.open(chrome.runtime.getURL('privacy_policy.html'));
    });
  }

  if (btnDetach) {
    btnDetach.addEventListener('click', () => {
      chrome.windows.create({
        url: chrome.runtime.getURL('popup.html'),
        type: 'popup',
        width: 1200,
        height: 1050,
        left: 100,
        top: 100
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Erreur lors de l\'ouverture de la fenêtre:', chrome.runtime.lastError);
        }
      });
    });
  }

  btnClearHistory.addEventListener('click', async () => {
    const title = chrome.i18n.getMessage('btnClearHistory') || 'Clear History';
    const message = chrome.i18n.getMessage('dialogConfirmClearHistory') || 'Are you sure you want to clear all history?';
    const ok = await showConfirm(title, message);
    if (!ok) return;

    chrome.storage.local.set({ reorgHistory: [] }, () => {
      showToast(chrome.i18n.getMessage('historyEmpty') || "History cleared!");
      renderHistory();
    });
  });

  actionListContainer.addEventListener('change', (e) => {
    if (e.target.classList.contains('action-checkbox')) {
      updateApplyButtonState();
    }
  });



  btnAnalyzeBookmark.addEventListener('click', () => {
    runBookmarkAnalysis();
  });

  btnAlternativeBookmark.addEventListener('click', () => {
    if (lastAiSuggestion) {
      const lastId = lastAiSuggestion.action === 'create_new' 
        ? lastAiSuggestion.newFolderParentId 
        : lastAiSuggestion.targetFolderId;
      if (lastId && !ignoredFolderIds.includes(lastId)) {
        ignoredFolderIds.push(lastId);
      }
    }
    runBookmarkAnalysis();
  });

  function runBookmarkAnalysis() {
    btnAnalyzeBookmark.disabled = true;
    btnAlternativeBookmark.disabled = true;
    const origText = btnAnalyzeBookmark.textContent;
    btnAnalyzeBookmark.textContent = 'Analyse de l\'IA en cours...';
    aiBookmarkSuggestion.style.display = 'none';
    btnConfirmAddBookmark.classList.add('hidden');

    chrome.runtime.sendMessage({
      action: 'suggest_bookmark_location',
      bookmark: {
        title: bookmarkTitleInput.value.trim(),
        url: activeTabUrlValue
      },
      ignoredFolderIds: ignoredFolderIds
    }, (response) => {
      btnAnalyzeBookmark.disabled = false;
      btnAlternativeBookmark.disabled = false;
      btnAnalyzeBookmark.textContent = origText;

      if (chrome.runtime.lastError) {
        showToast("Erreur système d'analyse");
        return;
      }

      if (response && response.success && response.suggestion) {
        lastAiSuggestion = response.suggestion;
        // Cache the folders list for path resolution
        if (response.folders) {
          lastFoldersList = response.folders;
        }

        // Update bookmark title if AI suggested a cleaner one
        if (lastAiSuggestion.suggestedTitle) {
          bookmarkTitleInput.value = lastAiSuggestion.suggestedTitle;
        }

        // --- Render bookmark name row ---
        suggestionBookmarkName.textContent = bookmarkTitleInput.value || '-';

        // --- Render target folder row ---
        suggestionFolderResult.textContent = '';
        if (lastAiSuggestion.action === 'create_new') {
          suggestionFolderIcon.textContent = '📁';
          suggestionFolderLabel.textContent = 'Nouveau dossier';
          const parentPath = getFolderPathFromList(lastAiSuggestion.newFolderParentId, lastFoldersList);
          suggestionFolderResult.textContent = `${lastAiSuggestion.newFolderTitle}  ←  ${parentPath}`;
        } else {
          suggestionFolderIcon.textContent = '📂';
          suggestionFolderLabel.textContent = chrome.i18n.getMessage('targetFolderLabel');
          suggestionFolderResult.textContent = getFolderPathFromList(lastAiSuggestion.targetFolderId, lastFoldersList);
        }

        suggestionReasonResult.textContent = lastAiSuggestion.explanation || chrome.i18n.getMessage('suggestionLabel');
        aiBookmarkSuggestion.style.display = 'block';
        btnConfirmAddBookmark.classList.remove('hidden');
        btnAlternativeBookmark.classList.remove('hidden');
      } else {
        showToast(response?.error || "Échec de l'analyse");
      }
    });
  }

  btnManualAddBookmark.addEventListener('click', () => {
    if (manualAddSection.style.display === 'none') {
      manualAddSection.style.display = 'block';
      manualAddTitle.value = bookmarkTitleInput.value;
      manualAddTitle.focus();
    } else {
      manualAddSection.style.display = 'none';
    }
  });

  btnManualAddConfirm.addEventListener('click', saveManualBookmarkPopup);

  btnConfirmAddBookmark.addEventListener('click', () => {
    btnConfirmAddBookmark.disabled = true;
    const origText = btnConfirmAddBookmark.textContent;
    btnConfirmAddBookmark.textContent = 'Enregistrement...';

    chrome.runtime.sendMessage({
      action: 'save_suggested_bookmark',
      suggestion: lastAiSuggestion,
      bookmark: {
        title: bookmarkTitleInput.value.trim(),
        url: activeTabUrlValue
      }
    }, (response) => {
      btnConfirmAddBookmark.disabled = false;
      btnConfirmAddBookmark.textContent = origText;

      if (chrome.runtime.lastError) {
        showToast("Erreur système de sauvegarde");
        return;
      }

      if (response && response.success) {
        showToast("Favori enregistré avec succès !");
        switchTab('rangement');
      } else {
        showToast(response?.error || "Échec de l'enregistrement");
      }
    });
  });
});

async function loadActiveTabDetails() {
  bookmarkTitleInput.value = 'Chargement...';
  activeTabUrl.textContent = '-';
  btnAnalyzeBookmark.disabled = true;
  aiBookmarkSuggestion.style.display = 'none';
  btnConfirmAddBookmark.classList.add('hidden');
  btnAlternativeBookmark.classList.add('hidden');
  ignoredFolderIds = [];

  chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (win) => {
    const queryInfo = { active: true };
    if (win && win.id) {
      queryInfo.windowId = win.id;
    } else {
      queryInfo.lastFocusedWindow = true;
    }

    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError || !tabs?.[0]) {
        bookmarkTitleInput.value = 'Aucun onglet actif détecté';
        activeTabUrl.textContent = '-';
        return;
      }
      activeTabTitleValue = tabs[0].title || 'Favori';
      activeTabUrlValue = tabs[0].url || '';
      
      bookmarkTitleInput.value = activeTabTitleValue;
      activeTabUrl.textContent = activeTabUrlValue;
      
      if (activeTabUrlValue.startsWith('http://') || activeTabUrlValue.startsWith('https://')) {
        btnAnalyzeBookmark.disabled = false;
      } else {
        bookmarkTitleInput.value = 'Onglet non supporté';
        activeTabUrl.textContent = 'Seules les pages Web HTTP/HTTPS peuvent être ajoutées.';
      }
    });
  });
}

function switchTab(tabId) {
  tabRangementBtn.classList.remove('active');
  tabAddBookmarkBtn.classList.remove('active');
  tabConfigBtn.classList.remove('active');
  tabHistoryBtn.classList.remove('active');

  tabRangementPanel.classList.add('hidden');
  tabAddBookmarkPanel.classList.add('hidden');
  tabConfigPanel.classList.add('hidden');
  tabHistoryPanel.classList.add('hidden');

  if (tabId === 'rangement') {
    tabRangementBtn.classList.add('active');
    tabRangementPanel.classList.remove('hidden');
  } else if (tabId === 'add-bookmark') {
    tabAddBookmarkBtn.classList.add('active');
    tabAddBookmarkPanel.classList.remove('hidden');
    loadActiveTabDetails();
  } else if (tabId === 'config') {
    tabConfigBtn.classList.add('active');
    tabConfigPanel.classList.remove('hidden');
  } else if (tabId === 'history') {
    tabHistoryBtn.classList.add('active');
    tabHistoryPanel.classList.remove('hidden');
    renderHistory();
  }

  chrome.storage.local.set({ activeTab: tabId });
}

function addLog(text, type = 'info') {
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = text;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function addLoadingLog(message) {
  const entry = document.createElement('div');
  entry.id = 'loadingLogEntry';
  entry.className = 'log-entry loading';
  entry.innerHTML = `<span class="loading-spinner"></span>${message}`;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function removeLoadingLog() {
  const loadingEntry = document.getElementById('loadingLogEntry');
  if (loadingEntry) {
    loadingEntry.remove();
  }
}

function showView(viewName) {
  console.log('showView called with:', viewName);
  if (viewName === 'main') {
    mainView.classList.remove('hidden');
    validationView.classList.add('hidden');
    console.log('Showing main view');
  } else if (viewName === 'validation') {
    mainView.classList.add('hidden');
    validationView.classList.remove('hidden');
    console.log('Showing validation view');
  }
}

function setControlsDisabled(disabled) {
  btnMinReorg.disabled = disabled;
  btnFullReorg.disabled = disabled;
  checkDeadLinksCheckbox.disabled = disabled;
  providerSelect.disabled = disabled;
  apiUrlInput.disabled = disabled;
  apiKeyInput.disabled = disabled;
  modelNameInput.disabled = disabled;
  linkCheckBatchSizeSelect.disabled = disabled;
  btnSaveConfig.disabled = disabled;
  btnResetConfig.disabled = disabled;
  btnExportConfig.style.pointerEvents = disabled ? 'none' : 'auto';
  btnImportConfig.style.pointerEvents = disabled ? 'none' : 'auto';
  btnResetConfig.style.pointerEvents = disabled ? 'none' : 'auto';
  
  if (disabled) {
    mainView.setAttribute('aria-busy', 'true');
  } else {
    mainView.removeAttribute('aria-busy');
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
}

const maxTokensSelect = document.getElementById('maxTokens');

function loadConfig() {
  chrome.storage.sync.get(['provider', 'apiUrl', 'apiKey', 'modelName', 'checkDeadLinks', 'linkCheckBatchSize', 'debugMode', 'promptMinimal', 'promptComplete', 'maxTokens', 'promptSuggest'], (res) => {
    if (res.provider) providerSelect.value = res.provider;
    apiUrlInput.value = res.apiUrl || '';
    apiKeyInput.value = res.apiKey || '';
    modelNameInput.value = res.modelName || '';
    checkDeadLinksCheckbox.checked = res.checkDeadLinks === true;
    if (res.linkCheckBatchSize) linkCheckBatchSizeSelect.value = res.linkCheckBatchSize;
    if (res.maxTokens) maxTokensSelect.value = res.maxTokens;
    debugModeCheckbox.checked = res.debugMode === true;
    promptMinimalInput.value = res.promptMinimal || PROMPT_DEFAULTS.minimal;
    promptCompleteInput.value = res.promptComplete || PROMPT_DEFAULTS.complete;
    promptSuggestInput.value = res.promptSuggest || PROMPT_DEFAULTS.suggest;

    // Dynamically update model options based on loaded value
    const provider = res.provider || 'google';
    const defModel = PROVIDER_DEFAULTS[provider]?.model || '';
    updateModelOptions(res.modelName || defModel);
  });
}

function saveConfig() {
  const config = {
    provider: providerSelect.value,
    apiUrl: apiUrlInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    modelName: modelNameInput.value.trim(),
    linkCheckBatchSize: parseInt(linkCheckBatchSizeSelect.value, 10) || 24,
    maxTokens: parseInt(maxTokensSelect.value, 10) || 32768,
    debugMode: debugModeCheckbox.checked,
    promptMinimal: promptMinimalInput.value.trim() || PROMPT_DEFAULTS.minimal,
    promptComplete: promptCompleteInput.value.trim() || PROMPT_DEFAULTS.complete,
    promptSuggest: promptSuggestInput.value.trim() || PROMPT_DEFAULTS.suggest
  };

  chrome.storage.sync.set(config, () => {
    showToast(chrome.i18n.getMessage('toastConfigSaved'));
    addLog('> Configuration sauvegardée avec succès.', 'success');
  });
}

function resetConfig() {
  providerSelect.value = 'google';
  apiUrlInput.value = PROVIDER_DEFAULTS.google.url;
  apiKeyInput.value = '';
  modelNameInput.value = PROVIDER_DEFAULTS.google.model;
  checkDeadLinksCheckbox.checked = false;
  linkCheckBatchSizeSelect.value = '24';
  promptMinimalInput.value = PROMPT_DEFAULTS.minimal;
  promptCompleteInput.value = PROMPT_DEFAULTS.complete;
  promptSuggestInput.value = PROMPT_DEFAULTS.suggest;
  updateModelOptions(PROVIDER_DEFAULTS.google.model);

  chrome.storage.sync.clear(() => {
    chrome.storage.local.clear(() => {
      showToast('Paramètres réinitialisés');
      addLog('> Configuration et cache réinitialisés aux valeurs d\'origine.', 'info');
      saveConfig();
    });
  });
}

function resetPromptsToDefaults() {
  promptMinimalInput.value = PROMPT_DEFAULTS.minimal;
  promptCompleteInput.value = PROMPT_DEFAULTS.complete;
  promptSuggestInput.value = PROMPT_DEFAULTS.suggest;
  saveConfig();
  showToast('Prompts réinitialisés');
}

function exportConfig() {
  chrome.storage.sync.get(null, (config) => {
    const data = {
      provider: config.provider || 'google',
      apiUrl: config.apiUrl || '',
      apiKey: config.apiKey || '',
      modelName: config.modelName || '',
      checkDeadLinks: config.checkDeadLinks === true,
      linkCheckBatchSize: config.linkCheckBatchSize || 24,
      maxTokens: config.maxTokens || 32768,
      debugMode: config.debugMode === true,
      promptMinimal: config.promptMinimal || '',
      promptComplete: config.promptComplete || ''
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `favorai-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('> Configuration exportée avec succès.', 'success');
  });
}

function importConfig(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const config = JSON.parse(event.target.result);
      if (!config.provider) {
        throw new Error('Format de fichier invalide.');
      }

      const configToSave = {
        provider: config.provider,
        apiUrl: config.apiUrl || '',
        apiKey: config.apiKey || '',
        modelName: config.modelName || '',
        checkDeadLinks: config.checkDeadLinks === true,
        linkCheckBatchSize: config.linkCheckBatchSize || 24,
        maxTokens: config.maxTokens || 32768,
        debugMode: config.debugMode === true,
        promptMinimal: config.promptMinimal || '',
        promptComplete: config.promptComplete || ''
      };

      chrome.storage.sync.set(configToSave, () => {
        loadConfig();
        showToast('Configuration importée');
        addLog('> Configuration importée et mise à jour avec succès.', 'success');
      });
    } catch (err) {
      addLog(`Erreur lors de l'importation : ${err.message}`, 'error');
      showToast('Importation échouée');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function startReorganization(mode) {
  const config = {
    provider: providerSelect.value,
    apiUrl: apiUrlInput.value.trim(),
    apiKey: apiKeyInput.value.trim(),
    modelName: modelNameInput.value.trim(),
    linkCheckBatchSize: parseInt(linkCheckBatchSizeSelect.value, 10) || 24,
    maxTokens: parseInt(maxTokensSelect.value, 10) || 32768,
    debugMode: debugModeCheckbox.checked,
    promptMinimal: promptMinimalInput.value.trim() || PROMPT_DEFAULTS.minimal,
    promptComplete: promptCompleteInput.value.trim() || PROMPT_DEFAULTS.complete,
    promptSuggest: promptSuggestInput.value.trim() || PROMPT_DEFAULTS.suggest
  };

  if (config.provider !== 'ollama' && !config.apiKey) {
    addLog('Erreur : Une clé API est requise !', 'error');
    showToast('Clé API manquante');
    return;
  }

  setControlsDisabled(true);
  
  const existingRetry = document.getElementById('btnRetryReorg');
  if (existingRetry) existingRetry.remove();

  reorgBtnGroup.classList.add('hidden');
  btnStopReorg.classList.remove('hidden');

  logContainer.innerHTML = '';
  addLog(`> Démarrage de la réorganisation (${mode === 'complete' ? 'Complète' : 'Minimale'})...`, 'info');
  progressBarContainer.style.display = 'block';
  progressBar.style.width = '5%';

  chrome.runtime.sendMessage({
    action: 'start_analysis',
    config: config,
    mode: mode,
    checkDeadLinks: checkDeadLinksCheckbox.checked,
    bookmarkFolderId: bookmarkFolderSelect.value
  }, (response) => {
    if (chrome.runtime.lastError) {
      addLog(`Erreur système : ${chrome.runtime.lastError.message}`, 'error');
      progressBarContainer.style.display = 'none';
      reorgBtnGroup.classList.remove('hidden');
      btnStopReorg.classList.add('hidden');
      setControlsDisabled(false);
      return;
    }

    if (!response || !response.success) {
      const errorMsg = response?.error || 'Impossible de lancer l\'analyse.';
      addLog(`Échec du démarrage de l'analyse : ${errorMsg}`, 'error');
      progressBarContainer.style.display = 'none';
      reorgBtnGroup.classList.remove('hidden');
      btnStopReorg.classList.add('hidden');
      setControlsDisabled(false);
    }
  });
}

function stopReorganization() {
  removeLoadingLog();
  addLog('> Demande d\'interruption envoyée...', 'warning');
  chrome.runtime.sendMessage({ action: 'cancel_analysis' }).catch(() => {});
}

function showRetryButton(_mode) {
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

  const statusSection = logContainer.closest('section');
  if (statusSection) {
    statusSection.appendChild(btn);
  }
}

function retryReorganization() {
  chrome.storage.local.get(['extensionStatus'], (res) => {
    const status = res.extensionStatus;
    if (!status || !status.lastConfig || !status.mode) {
      addLog('Impossible de réessayer : la configuration précédente est introuvable.', 'error');
      return;
    }
    startReorganizationWithConfig(status.lastConfig, status.mode, status.lastCheckDeadLinks !== false);
  });
}

function startReorganizationWithConfig(config, mode, checkDeadLinks) {
  setControlsDisabled(true);
  reorgBtnGroup.classList.add('hidden');
  btnStopReorg.classList.remove('hidden');

  logContainer.innerHTML = '';
  addLog(`> Nouvelle tentative (${mode === 'complete' ? 'Complète' : 'Minimale'})...`, 'info');
  addLoadingLog('Interrogation de l\'IA en cours...');
  progressBarContainer.style.display = 'block';
  progressBar.style.width = '5%';

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
      progressBarContainer.style.display = 'none';
      reorgBtnGroup.classList.remove('hidden');
      btnStopReorg.classList.add('hidden');
      setControlsDisabled(false);
    }
  });
}

// Background messages listener
chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.action === 'progress_update') {
    progressBarContainer.style.display = 'block';
    progressBar.style.width = `${message.percentage}%`;
    addLog(message.message, 'info');
  }
  else if (message.action === 'analysis_completed') {
    console.log('=== analysis_completed received ===');
    console.log('Message:', message);
    console.log('Actions type:', Array.isArray(message.actions) ? 'array' : typeof message.actions);
    console.log('Actions length:', message.actions?.length || 0);
    console.log('Explanation type:', typeof message.explanation);
    console.log('Mode:', message.mode);

    removeLoadingLog();
    addLog('✓ Analyse terminée', 'success');
    progressBarContainer.style.display = 'none';
    reorgBtnGroup.classList.remove('hidden');
    btnStopReorg.classList.add('hidden');
    setControlsDisabled(false);

    try {
      // Ensure actions is an array
      const actions = Array.isArray(message.actions) ? message.actions : [];
      displayRapport(actions, message.explanation, message.mode);
    } catch (error) {
      console.error('Error in displayRapport:', error);
      addLog('Erreur lors de l\'affichage des modifications: ' + error.message, 'error');
    }
  } 
  else if (message.action === 'analysis_failed') {
    removeLoadingLog();
    progressBarContainer.style.display = 'none';
    reorgBtnGroup.classList.remove('hidden');
    btnStopReorg.classList.add('hidden');
    setControlsDisabled(false);

    addLog(`Échec : ${message.error}`, 'error');
    if (message.retryable) {
      showRetryButton(message.mode);
    }
  }
});

function displayRapport(actions, explanation, mode) {
  console.log('=== displayRapport Called ===');
  console.log('Actions received:', actions.length);
  console.log('Mode:', mode);
  console.log('Explanation type:', typeof explanation);
  console.log('Explanation value:', explanation);

  // Ensure explanation is a string
  if (typeof explanation !== 'string') {
    explanation = typeof explanation === 'object' ? JSON.stringify(explanation) : String(explanation || '');
  }

  reorgModeBadge.textContent = mode === 'complete' ? 'Réorganisation Complète' : 'Réorganisation Minimale';
  if (mode === 'complete') {
    reorgModeBadge.style.background = 'rgba(168, 85, 247, 0.2)';
    reorgModeBadge.style.color = '#c084fc';
    reorgModeBadge.style.borderColor = 'rgba(168, 85, 247, 0.4)';
  } else {
    reorgModeBadge.style.background = 'rgba(99, 102, 241, 0.2)';
    reorgModeBadge.style.color = '#818cf8';
    reorgModeBadge.style.borderColor = 'rgba(99, 102, 241, 0.4)';
  }

  if (explanation && explanation.trim()) {
    explanationBlock.style.display = 'block';
    iaExplanationText.textContent = '';
    const formatted = formatExplanation(explanation);
    const lines = formatted.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Section header: **TITLE**
      const headerMatch = trimmed.match(/^\*\*(.+)\*\*$/);
      if (headerMatch) {
        const h = document.createElement('span');
        h.className = 'expl-section';
        h.textContent = headerMatch[1];
        iaExplanationText.appendChild(h);
        continue;
      }

      // Bullet: starts with "- " or "• "
      if (/^[-•] /.test(trimmed)) {
        const item = document.createElement('div');
        item.className = 'expl-item';
        item.textContent = trimmed.replace(/^[-•] /, '');
        iaExplanationText.appendChild(item);
        continue;
      }

      // Non-empty plain line (e.g. standalone sentence without bullet)
      if (trimmed) {
        const item = document.createElement('div');
        item.className = 'expl-item';
        item.textContent = trimmed;
        iaExplanationText.appendChild(item);
      }
    }

    // If a section was rendered but has no items after it, add a "none" hint
    // (skip — LLM handles this inline)
  } else {
    explanationBlock.style.display = 'none';
  }

  // Set action count
  console.log('Setting action count:', actions.length);
  actionCountSpan.textContent = chrome.i18n.getMessage('actionCount', [String(actions.length)]) || `${actions.length} modifications proposées`;
  actionListContainer.textContent = '';

  if (actions.length === 0) {
    addLog(chrome.i18n.getMessage('bgNoChangesNeeded') || 'Aucun changement nécessaire.', 'success');
    showView('main');
    return;
  }

  console.log('Showing validation view with', actions.length, 'actions');
  btnApply.disabled = false;
  btnCancel.textContent = chrome.i18n.getMessage('btnBack') || "Retour";

  const groups = {
    clean: { title: '🧹 Nettoyage (Doublons & Liens morts)', list: [] },
    structure: { title: '📁 Changements Structurels (Dossiers)', list: [] },
    move: { title: '🔗 Déplacements de favoris', list: [] }
  };

  for (const act of actions) {
    if (groups[act.category]) {
      groups[act.category].list.push(act);
    } else {
      groups.move.list.push(act);
    }
  }

  console.log('Groups:', Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.list.length])));

  // Programmatic DOM construction for each group to avoid any innerHTML XSS injection
  for (const cat in groups) {
    const group = groups[cat];
    if (group.list.length === 0) continue;

    console.log('Creating group:', cat, 'with', group.list.length, 'items');

    const groupDiv = document.createElement('div');
    groupDiv.className = 'action-group';

    const groupHeader = document.createElement('div');
    groupHeader.className = 'action-group-title';
    
    const titleSpan = document.createElement('span');
    titleSpan.textContent = group.title;
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'badge';
    badgeSpan.textContent = String(group.list.length);
    
    groupHeader.appendChild(titleSpan);
    groupHeader.appendChild(badgeSpan);
    groupDiv.appendChild(groupHeader);

    for (const act of group.list) {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'action-item';

      let badgeClass = 'badge-move';
      let badgeText = 'Déplacer';
      if (act.type.startsWith('delete')) {
        badgeClass = 'badge-delete';
        badgeText = 'Supprimer';
      } else if (act.type === 'create_folder') {
        badgeClass = 'badge-create';
        badgeText = 'Créer';
      } else if (act.type.startsWith('rename')) {
        badgeClass = 'badge-rename';
        badgeText = 'Renommer';
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'action-checkbox';
      checkbox.setAttribute('data-id', act.id);
      checkbox.checked = true;
      checkbox.setAttribute('aria-label', `Sélectionner : ${act.title}`);

      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'action-details';

      const titleBar = document.createElement('div');
      titleBar.style.display = 'flex';
      titleBar.style.alignItems = 'center';
      titleBar.style.gap = '6px';

      const typeBadge = document.createElement('span');
      typeBadge.className = `action-badge ${badgeClass}`;
      typeBadge.textContent = badgeText;

      const descSpan = document.createElement('span');
      descSpan.className = 'action-desc';
      descSpan.textContent = act.title;

      const editBtn = document.createElement('span');
      editBtn.className = 'edit-btn';
      editBtn.setAttribute('data-id', act.id);
      editBtn.style.cursor = 'pointer';
      editBtn.style.fontSize = '10px';
      editBtn.style.color = 'var(--accent-color)';
      editBtn.style.marginLeft = '8px';
      editBtn.textContent = '✏️';
      editBtn.title = chrome.i18n.getMessage('btnEdit') || 'Modifier';

      titleBar.appendChild(typeBadge);
      titleBar.appendChild(descSpan);
      titleBar.appendChild(editBtn);
      detailsDiv.appendChild(titleBar);

      // Render details based on type
      if (act.type === 'delete_duplicate') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Emplacement à supprimer : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.sourcePath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);

        const sub2 = document.createElement('span');
        sub2.className = 'action-sub';
        sub2.textContent = 'Existe déjà dans : ';
        const path2 = document.createElement('span');
        path2.className = 'path-highlight-target';
        path2.textContent = act.params.originalPath;
        sub2.appendChild(path2);
        if (act.params.originalTitle && act.params.originalTitle !== act.title) {
          sub2.appendChild(document.createTextNode(' (sous le nom '));
          const nameSpan = document.createElement('span');
          nameSpan.className = 'name-highlight-new';
          nameSpan.textContent = `"${act.params.originalTitle}"`;
          sub2.appendChild(nameSpan);
          sub2.appendChild(document.createTextNode(')'));
        }
        detailsDiv.appendChild(sub2);

        const sub3 = document.createElement('span');
        sub3.className = 'action-sub';
        sub3.style.color = 'var(--error-color)';
        sub3.style.fontWeight = '500';
        sub3.textContent = chrome.i18n.getMessage('actionDeleteDuplicate') || 'Doublon (sera supprimé)';
        detailsDiv.appendChild(sub3);
      } 
      else if (act.type === 'delete_dead') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Dossier source : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.sourcePath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);

        const sub2 = document.createElement('span');
        sub2.className = 'action-sub';
        sub2.style.color = 'var(--error-color)';
        sub2.style.fontWeight = '500';
        sub2.textContent = `${chrome.i18n.getMessage('actionDeadLink') || 'Lien mort'} (${act.description.replace('Lien mort détecté (', '').replace(')', '')})`;
        detailsDiv.appendChild(sub2);
      } 
      else if (act.type === 'create_folder') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Créer sous : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.targetPath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);
      } 
      else if (act.type === 'rename_folder' || act.type === 'rename_bookmark') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Dossier : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.sourcePath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);

        const sub2 = document.createElement('span');
        sub2.className = 'action-sub';
        sub2.textContent = 'Ancien nom : ';
        const oldSpan = document.createElement('span');
        oldSpan.className = 'name-highlight';
        oldSpan.textContent = act.params.oldTitle;
        sub2.appendChild(oldSpan);
        sub2.appendChild(document.createTextNode(' → Nouveau nom : '));
        const newSpan = document.createElement('span');
        newSpan.className = 'name-highlight-new';
        newSpan.textContent = act.params.newTitle;
        sub2.appendChild(newSpan);
        detailsDiv.appendChild(sub2);
      } 
      else if (act.type === 'move_bookmark' || act.type === 'move_folder') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Déplacer de : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.sourcePath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);

        const sub2 = document.createElement('span');
        sub2.className = 'action-sub';
        sub2.textContent = 'Vers : ';
        const path2 = document.createElement('span');
        path2.className = 'path-highlight-target';
        path2.textContent = act.params.targetPath;
        sub2.appendChild(path2);
        detailsDiv.appendChild(sub2);
      } 
      else if (act.type === 'delete_folder') {
        const label = act.params.isEmptyNow 
          ? "Dossier vide (sera supprimé)" 
          : "Dossier vidé par la réorganisation (sera supprimé)";
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Dossier source : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.sourcePath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);

        const sub2 = document.createElement('span');
        sub2.className = 'action-sub';
        sub2.style.color = 'var(--error-color)';
        sub2.style.fontWeight = '500';
        sub2.textContent = label;
        detailsDiv.appendChild(sub2);
      }

      if (act.url) {
        if (isSafeUrl(act.url)) {
          const link = document.createElement('a');
          link.href = act.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'action-sub-link';
          link.textContent = act.url;
          detailsDiv.appendChild(link);
        } else {
          const sub = document.createElement('span');
          sub.className = 'action-sub';
          sub.title = 'Schéma non-HTTP';
          sub.textContent = act.url;
          detailsDiv.appendChild(sub);
        }
      }

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(detailsDiv);
      groupDiv.appendChild(itemDiv);
    }

    actionListContainer.appendChild(groupDiv);
  }

  console.log('All groups rendered. Switching to validation view.');
  console.log('actionListContainer HTML:', actionListContainer.innerHTML.substring(0, 200));
  showView('validation');
  console.log('=== displayRapport Complete ===');
}

function toggleAllCheckboxes(checked) {
  const checkboxes = actionListContainer.querySelectorAll('.action-checkbox');
  checkboxes.forEach(cb => cb.checked = checked);
}

async function applyCheckedActions() {
  const checkboxes = actionListContainer.querySelectorAll('.action-checkbox:checked');
  const approvedActionIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

  if (approvedActionIds.length === 0) {
    showToast('Aucune modification sélectionnée');
    return;
  }

  const title = chrome.i18n.getMessage('btnApply') || 'Apply selected changes';
  const message = chrome.i18n.getMessage('dialogConfirmApply') || 'Are you sure you want to apply changes?';
  const ok = await showConfirm(title, message);
  if (!ok) return;

  btnApply.disabled = true;
  btnCancel.disabled = true;
  btnApply.textContent = 'Application en cours...';

  chrome.runtime.sendMessage({
    action: 'apply_changes',
    approvedActionIds: approvedActionIds
  }, (response) => {
    btnApply.textContent = 'Appliquer la sélection';
    btnApply.disabled = false;
    btnCancel.disabled = false;

    if (chrome.runtime.lastError) {
      addLog(`Erreur système lors de l'application : ${chrome.runtime.lastError.message}`, 'error');
      showToast("Échec de l'application");
      return;
    }

    if (response && response.success) {
      showToast('Favoris mis à jour !');
      showView('main');
      addLog('> Les modifications sélectionnées ont été appliquées avec succès !', 'success');
      addLog('> Vos favoris sont maintenant à jour.', 'success');
    } else {
      const errorMsg = response?.error || 'Erreur inconnue.';
      addLog(`Erreur lors de l'application : ${errorMsg}`, 'error');
      showToast("Échec de l'application");
    }
  });
}

function isSafeUrl(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase().trim();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

function formatExplanation(text) {
  if (!text) return '';
  const str = String(text).trim();

  // Try to parse as JSON
  let explanation = null;
  try {
    explanation = JSON.parse(str);
  } catch (e) {
    // Not JSON, return as-is
    return str.replace(/\r?\n/g, '\n');
  }

  // If it's already a string after parsing, return it
  if (typeof explanation === 'string') {
    return explanation.replace(/\r?\n/g, '\n');
  }

  // Format JSON object into readable text
  const result = [];

  // Summary section
  if (explanation.summary) {
    result.push('📋 ' + explanation.summary);
    result.push('');
  }

  // Moved bookmarks
  if (explanation.movedBookmarks && explanation.movedBookmarks.length > 0) {
    result.push('🔗 Bookmarks Déplacés:');
    for (const item of explanation.movedBookmarks) {
      result.push(`  • ${item.title}: ${item.from} → ${item.to}`);
      result.push(`    Raison: ${item.reason}`);
    }
    result.push('');
  }

  // Created folders
  if (explanation.createdFolders && explanation.createdFolders.length > 0) {
    result.push('📁 Dossiers Créés:');
    for (const folder of explanation.createdFolders) {
      result.push(`  • ${folder.title}: ${folder.purpose}`);
    }
    result.push('');
  }

  // Merged folders
  if (explanation.mergedFolders && explanation.mergedFolders.length > 0) {
    result.push('🔀 Dossiers Fusionnés:');
    for (const merge of explanation.mergedFolders) {
      const fromFolders = merge.folders.join(', ');
      result.push(`  • ${fromFolders} → ${merge.into}`);
      result.push(`    Raison: ${merge.reason}`);
    }
    result.push('');
  }

  // Semantic mismatches fixed
  if (explanation.semanticMismatchesFixed && explanation.semanticMismatchesFixed.length > 0) {
    result.push('✨ Problèmes Sémantiques Résolus:');
    for (const issue of explanation.semanticMismatchesFixed) {
      result.push(`  • ${issue.title}`);
      result.push(`    Problème: ${issue.issue}`);
      result.push(`    Solution: ${issue.fixedBy}`);
    }
  }

  return result.join('\n');
}

function restoreStatus() {
  chrome.runtime.sendMessage({ action: 'get_current_status' }, (status) => {
    if (chrome.runtime.lastError || !status) return;

    if (status.logs && status.logs.length > 0) {
      logContainer.innerHTML = '';
      for (const log of status.logs) {
        addLog(log.text, log.type);
      }
    }

    if (status.state === 'analyzing') {
      setControlsDisabled(true);
      reorgBtnGroup.classList.add('hidden');
      btnStopReorg.classList.remove('hidden');

      progressBarContainer.style.display = 'block';
      progressBar.style.width = `${status.percentage}%`;
    } 
    else if (status.state === 'waiting_validation') {
      if (!status.actions || status.actions.length === 0) {
        showView('main');
        setControlsDisabled(false);
      } else {
        displayRapport(status.actions, status.explanation, status.mode);
      }
    }
    else {
      setControlsDisabled(false);
      reorgBtnGroup.classList.remove('hidden');
      btnStopReorg.classList.add('hidden');
      progressBarContainer.style.display = 'none';

      if (status.retryable && status.lastError) {
        showRetryButton(status.mode);
      }
    }
  });
}

function startInlineEdit(actionId, itemDiv) {
  chrome.storage.local.get(['pendingActions', 'extensionStatus'], (res) => {
    const actions = res.pendingActions || [];
    const status = res.extensionStatus || {};
    const actionIndex = actions.findIndex(a => a.id === actionId);
    if (actionIndex === -1) return;
    
    const act = actions[actionIndex];
    const detailsDiv = itemDiv.querySelector('.action-details');
    if (!detailsDiv) return;
    
    // Save original layout
    const originalChildren = Array.from(detailsDiv.childNodes);
    detailsDiv.textContent = '';
    
    const editContainer = document.createElement('div');
    editContainer.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-top: 6px; background: rgba(255, 255, 255, 0.03); padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); animation: fadeIn 0.2s ease-out;';

    const group1 = document.createElement('div');
    group1.className = 'form-group';
    group1.style.marginBottom = '0';
    const label1 = document.createElement('label');
    label1.style.fontSize = '10px';
    label1.style.display = 'block';
    label1.style.marginBottom = '2px';
    label1.textContent = chrome.i18n.getMessage('btnEdit') || 'Titre';
    const input1 = document.createElement('input');
    input1.type = 'text';
    input1.className = 'edit-inline-title';
    input1.value = act.title;
    input1.style.cssText = 'padding: 4px 8px; font-size: 11px; width: 100%;';
    group1.appendChild(label1);
    group1.appendChild(input1);
    editContainer.appendChild(group1);

    let input2 = null;
    if (act.url) {
      const group2 = document.createElement('div');
      group2.className = 'form-group';
      group2.style.cssText = 'margin-bottom: 0; margin-top: 4px;';
      const label2 = document.createElement('label');
      label2.style.fontSize = '10px';
      label2.style.display = 'block';
      label2.style.marginBottom = '2px';
      label2.textContent = 'URL';
      input2 = document.createElement('input');
      input2.type = 'text';
      input2.className = 'edit-inline-url';
      input2.value = act.url;
      input2.style.cssText = 'padding: 4px 8px; font-size: 11px; width: 100%;';
      group2.appendChild(label2);
      group2.appendChild(input2);
      editContainer.appendChild(group2);
    }

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; gap: 8px; margin-top: 6px; justify-content: flex-end;';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-flat btn-inline-cancel';
    cancelBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; border-radius: 4px; height: auto;';
    cancelBtn.textContent = chrome.i18n.getMessage('btnCancel') || 'Annuler';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary btn-inline-save';
    saveBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; border-radius: 4px; height: auto; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: none;';
    saveBtn.textContent = chrome.i18n.getMessage('btnSave') || 'Enregistrer';

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(saveBtn);
    editContainer.appendChild(buttonRow);
    detailsDiv.appendChild(editContainer);

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      detailsDiv.textContent = '';
      originalChildren.forEach(child => detailsDiv.appendChild(child));
    });

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newTitle = input1.value.trim();
      const newUrl = input2 ? input2.value.trim() : null;

      if (!newTitle) {
        showToast("Le titre ne peut pas être vide");
        return;
      }

      act.title = newTitle;
      if (act.type === 'create_folder') {
        act.params.title = newTitle;
      } else if (act.type === 'rename_folder') {
        act.params.newTitle = newTitle;
      }

      if (newUrl !== null) {
        act.url = newUrl;
        if (act.type === 'delete_dead' || act.type === 'delete_duplicate') {
          act.type = 'rename_bookmark';
          act.category = 'structure';
          act.description = 'Corriger et conserver le favori';
          act.params = {
            nodeId: act.targetId,
            newTitle: newTitle,
            oldTitle: act.title,
            newUrl: newUrl,
            sourcePath: act.params.sourcePath || act.params.originalPath
          };
        } else if (act.type === 'rename_bookmark' || act.type === 'move_bookmark') {
          act.params.newTitle = newTitle;
          act.params.newUrl = newUrl;
        }
      } else {
        if (act.type === 'rename_folder' || act.type === 'move_folder') {
          act.params.newTitle = newTitle;
        }
      }

      actions[actionIndex] = act;
      if (status.actions) {
        const statusIdx = status.actions.findIndex(a => a.id === actionId);
        if (statusIdx !== -1) {
          status.actions[statusIdx] = act;
        }
      }

      chrome.storage.local.set({ pendingActions: actions, extensionStatus: status }, () => {
        showToast(chrome.i18n.getMessage('logReady') ? "Change saved!" : "Favori mis à jour !");
        displayRapport(actions, status.explanation, status.mode);
      });
    });
  });
}

function updateApplyButtonState() {
  const checkboxes = actionListContainer.querySelectorAll('.action-checkbox:checked');
  btnApply.disabled = checkboxes.length === 0;
}

function renderHistory() {
  chrome.storage.local.get(['reorgHistory'], (res) => {
    const history = res.reorgHistory || [];
    historyListContainer.textContent = '';
    
    if (history.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = 'padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;';
      emptyDiv.textContent = chrome.i18n.getMessage('historyEmpty') || 'Aucun historique de réorganisation disponible.';
      historyListContainer.appendChild(emptyDiv);
      btnClearHistory.style.display = 'none';
      return;
    }
    
    btnClearHistory.style.display = 'inline-block';
    
    history.forEach((session) => {
      const dateStr = new Date(session.timestamp).toLocaleString();
      const modeLabel = session.mode === 'complete' ? (chrome.i18n.getMessage('btnComplete') || 'Complet') : (chrome.i18n.getMessage('btnMinimal') || 'Minimal');
      
      const sessionDiv = document.createElement('div');
      sessionDiv.className = 'action-group';
      sessionDiv.style.cssText = 'padding: 10px; margin-bottom: 10px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px;';
      
      const headerDiv = document.createElement('div');
      headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;';
      
      const titleSpan = document.createElement('span');
      titleSpan.style.color = 'var(--text-main)';
      titleSpan.textContent = dateStr;
      
      const modeBadge = document.createElement('span');
      modeBadge.style.cssText = 'margin-left: 6px; font-size: 9px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05);';
      modeBadge.textContent = modeLabel;
      
      const leftContainer = document.createElement('div');
      leftContainer.appendChild(titleSpan);
      leftContainer.appendChild(modeBadge);

      const undoBtn = document.createElement('button');
      undoBtn.className = 'btn btn-flat btn-rollback';
      undoBtn.setAttribute('data-id', session.id);
      undoBtn.style.cssText = 'font-size: 10px; padding: 3px 8px; height: auto; background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.2); color: #818cf8;';
      undoBtn.textContent = '⏪ ' + (chrome.i18n.getMessage('btnRollback') || 'Annuler Tout');
      undoBtn.title = chrome.i18n.getMessage('btnRollback');
      undoBtn.setAttribute('aria-label', `Annuler toute la session du ${dateStr}`);

      headerDiv.appendChild(leftContainer);
      headerDiv.appendChild(undoBtn);
      
      sessionDiv.appendChild(headerDiv);

      // AI global explanation display
      if (session.explanation && session.explanation.trim()) {
        const expDiv = document.createElement('div');
        expDiv.style.cssText = 'font-size: 10px; padding: 8px; background: rgba(99, 102, 241, 0.04); border: 1px dashed rgba(99, 102, 241, 0.2); border-radius: 6px; margin-bottom: 8px; color: var(--text-main); white-space: pre-wrap; line-height: 1.4;';
        
        const expTitle = document.createElement('div');
        expTitle.style.cssText = 'font-weight: 600; margin-bottom: 4px; color: #818cf8; display: flex; align-items: center; gap: 4px;';
        expTitle.textContent = '💡 Description globale de l\'IA :';
        expDiv.appendChild(expTitle);

        const expText = document.createElement('div');
        expText.style.color = 'var(--text-muted)';
        expText.textContent = formatExplanation(session.explanation);
        expDiv.appendChild(expText);

        sessionDiv.appendChild(expDiv);
      }

      const listDiv = document.createElement('div');
      listDiv.style.cssText = 'display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; padding-right: 4px;';
      
      session.entries.forEach(entry => {
        const entryItem = document.createElement('div');
        entryItem.style.cssText = 'font-size: 10px; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px; border-bottom: 1px dashed rgba(255,255,255,0.03); padding-bottom: 4px;';
        
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px;';

        const leftContent = document.createElement('div');
        leftContent.style.cssText = 'display: flex; align-items: center; gap: 6px;';

        const typeLabel = document.createElement('span');
        const entityName = document.createElement('span');
        entityName.style.color = 'var(--text-main)';
        entityName.style.fontWeight = '500';
        entityName.textContent = entry.title || 'Favori';

        if (entry.type === 'create_folder') {
          typeLabel.style.color = 'var(--success-color)';
          typeLabel.style.fontWeight = '600';
          typeLabel.textContent = '📁 Création';
        } else if (entry.type === 'rename') {
          const icon = entry.isFolder ? '📁' : '🔗';
          typeLabel.style.color = 'var(--warning-color)';
          typeLabel.style.fontWeight = '600';
          typeLabel.textContent = `${icon} Renommer`;
          entityName.textContent = ` "${entry.oldTitle}" → "${entry.newTitle}"`;
        } else if (entry.type === 'move') {
          const icon = entry.isFolder ? '📁' : '🔗';
          typeLabel.style.color = '#818cf8';
          typeLabel.style.fontWeight = '600';
          typeLabel.textContent = `${icon} Déplacement`;
        } else if (entry.type === 'delete') {
          const icon = entry.isFolder ? '📁' : '🔗';
          typeLabel.style.color = 'var(--error-color)';
          typeLabel.style.fontWeight = '600';
          typeLabel.textContent = `${icon} Suppression`;
        }
        
        leftContent.appendChild(typeLabel);
        leftContent.appendChild(entityName);
        topRow.appendChild(leftContent);

        // Control container for entry-level rollback & deletion
        const controlContainer = document.createElement('div');
        controlContainer.style.cssText = 'display: flex; align-items: center; gap: 4px;';

        const entryRollbackBtn = document.createElement('button');
        entryRollbackBtn.className = 'btn-entry-rollback';
        entryRollbackBtn.setAttribute('data-session-id', session.id);
        entryRollbackBtn.setAttribute('data-entry-id', entry.id);
        entryRollbackBtn.style.cssText = 'font-size: 8px; padding: 2px 4px; line-height: 1; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); color: #818cf8; border-radius: 4px; cursor: pointer;';
        entryRollbackBtn.textContent = '⏪';
        entryRollbackBtn.title = 'Annuler cette modification spécifique';

        const entryDeleteBtn = document.createElement('button');
        entryDeleteBtn.className = 'btn-entry-delete';
        entryDeleteBtn.setAttribute('data-session-id', session.id);
        entryDeleteBtn.setAttribute('data-entry-id', entry.id);
        entryDeleteBtn.style.cssText = 'font-size: 8px; padding: 2px 4px; line-height: 1; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 4px; cursor: pointer;';
        entryDeleteBtn.textContent = '❌';
        entryDeleteBtn.title = 'Supprimer cette ligne de l\'historique sans l\'annuler';

        controlContainer.appendChild(entryRollbackBtn);
        controlContainer.appendChild(entryDeleteBtn);
        topRow.appendChild(controlContainer);

        entryItem.appendChild(topRow);

        const descContainer = document.createElement('div');
        descContainer.style.cssText = 'font-size: 9px; color: var(--text-muted); line-height: 1.3; margin-top: 1px;';

        if (entry.type === 'create_folder') {
          descContainer.textContent = 'Créé sous : ';
          const pathSpan = document.createElement('span');
          pathSpan.className = 'path-highlight-target';
          pathSpan.textContent = entry.targetPath || 'Barre de favoris';
          descContainer.appendChild(pathSpan);
        } else if (entry.type === 'rename') {
          descContainer.textContent = 'Dans : ';
          const pathSpan = document.createElement('span');
          pathSpan.className = 'path-highlight';
          pathSpan.textContent = entry.parentPath || 'Barre de favoris';
          descContainer.appendChild(pathSpan);
        } else if (entry.type === 'move') {
          descContainer.textContent = 'De : ';
          const pathSpan1 = document.createElement('span');
          pathSpan1.className = 'path-highlight';
          pathSpan1.textContent = entry.sourcePath || 'Barre de favoris';
          descContainer.appendChild(pathSpan1);
          descContainer.appendChild(document.createElement('br'));
          descContainer.appendChild(document.createTextNode('Vers : '));
          const pathSpan2 = document.createElement('span');
          pathSpan2.className = 'path-highlight-target';
          pathSpan2.textContent = entry.targetPath || 'Barre de favoris';
          descContainer.appendChild(pathSpan2);
        } else if (entry.type === 'delete') {
          descContainer.textContent = 'Dossier d\'origine : ';
          const pathSpan = document.createElement('span');
          pathSpan.className = 'path-highlight';
          pathSpan.textContent = entry.sourcePath || 'Barre de favoris';
          descContainer.appendChild(pathSpan);
          if (entry.url) {
            descContainer.appendChild(document.createElement('br'));
            if (isSafeUrl(entry.url)) {
              const link = document.createElement('a');
              link.href = entry.url;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.className = 'action-sub-link';
              link.textContent = entry.url;
              descContainer.appendChild(link);
            } else {
              const sub = document.createElement('span');
              sub.className = 'action-sub';
              sub.title = 'Schéma non-HTTP';
              sub.textContent = entry.url;
              descContainer.appendChild(sub);
            }
          }
        }
        
        entryItem.appendChild(descContainer);
        listDiv.appendChild(entryItem);
      });
      
      sessionDiv.appendChild(listDiv);
      historyListContainer.appendChild(sessionDiv);
    });
    
    // Bind session rollback
    const rollbackBtns = historyListContainer.querySelectorAll('.btn-rollback');
    rollbackBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = e.currentTarget.getAttribute('data-id');
        performRollback(sessionId, e.currentTarget);
      });
    });

    // Bind entry rollback
    const entryRollbackBtns = historyListContainer.querySelectorAll('.btn-entry-rollback');
    entryRollbackBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget;
        const sessionId = target.getAttribute('data-session-id');
        const entryId = target.getAttribute('data-entry-id');
        
        const title = chrome.i18n.getMessage('btnRollback') || 'Annuler la modification';
        const message = 'Voulez-vous vraiment annuler cette modification spécifique ?';
        const ok = await showConfirm(title, message);
        if (!ok) return;

        target.disabled = true;
        target.textContent = '...';

        chrome.runtime.sendMessage({
          action: 'rollback_entry',
          sessionId,
          entryId
        }, (response) => {
          if (chrome.runtime.lastError) {
            showToast("Erreur système");
            renderHistory();
            return;
          }
          if (response && response.success) {
            showToast("Modification annulée !");
            renderHistory();
          } else {
            showToast(response?.error || "Échec de l'annulation");
            renderHistory();
          }
        });
      });
    });

    // Bind entry delete
    const entryDeleteBtns = historyListContainer.querySelectorAll('.btn-entry-delete');
    entryDeleteBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget;
        const sessionId = target.getAttribute('data-session-id');
        const entryId = target.getAttribute('data-entry-id');
        
        const title = 'Supprimer de l\'historique';
        const message = 'Voulez-vous supprimer cette ligne de l\'historique sans annuler la modification sur vos favoris ?';
        const ok = await showConfirm(title, message);
        if (!ok) return;

        target.disabled = true;
        target.textContent = '...';

        chrome.runtime.sendMessage({
          action: 'delete_entry',
          sessionId,
          entryId
        }, (response) => {
          if (chrome.runtime.lastError) {
            showToast("Erreur système");
            renderHistory();
            return;
          }
          if (response && response.success) {
            showToast("Ligne supprimée !");
            renderHistory();
          } else {
            showToast(response?.error || "Échec de la suppression");
            renderHistory();
          }
        });
      });
    });
  });
}

async function performRollback(sessionId, btnElement) {
  const title = chrome.i18n.getMessage('btnRollback') || 'Undo Changes';
  const message = chrome.i18n.getMessage('dialogConfirmRollback') || 'Are you sure you want to undo this session\'s changes?';
  const ok = await showConfirm(title, message);
  if (!ok) return;
  
  const originalText = btnElement.textContent;
  btnElement.textContent = chrome.i18n.getMessage('btnRollbacking') || 'Annulation...';
  btnElement.disabled = true;
  
  chrome.runtime.sendMessage({
    action: 'rollback_session',
    sessionId: sessionId
  }, (response) => {
    btnElement.textContent = originalText;
    btnElement.disabled = false;
    
    if (chrome.runtime.lastError) {
      showToast("Erreur système lors du rollback");
      addLog(`Erreur système lors de la restauration : ${chrome.runtime.lastError.message}`, 'error');
      return;
    }
    
    if (response && response.success) {
      showToast(chrome.i18n.getMessage('btnRollbacked') || "Annulation réussie !");
      addLog("> Restauration de la session effectuée avec succès.", "success");
      renderHistory();
    } else {
      const errorMsg = response?.error || 'Erreur inconnue.';
      showToast("Échec de l'annulation");
      addLog(`Erreur de restauration : ${errorMsg}`, 'error');
    }
  });
}

/**
 * Met à jour la liste déroulante du modèle avec les modèles prédéfinis
 * ou dynamiquement récupérés via l'API. Gère l'option 'custom'.
 */
function updateModelOptions(currentModelValue) {
  const provider = providerSelect.value;
  modelSelect.innerHTML = '';

  chrome.storage.local.get(['cachedApiModels'], (res) => {
    const cached = res.cachedApiModels || {};
    const apiModels = cached[provider] || [];
    const defaults = PROVIDER_MODELS[provider] || [];
    
    // Combiner sans doublon
    const combined = Array.from(new Set([...apiModels, ...defaults]));
    
    combined.forEach(model => {
      const opt = document.createElement('option');
      opt.value = model;
      opt.textContent = model;
      modelSelect.appendChild(opt);
    });

    // Ajouter l'option personnalisée
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = chrome.i18n.getMessage('optionCustomModel') || 'Autre (saisir manuellement)...';
    modelSelect.appendChild(customOpt);

    // Positionner la sélection
    const match = combined.includes(currentModelValue);
    if (currentModelValue && match) {
      modelSelect.value = currentModelValue;
      modelNameInput.classList.add('hidden');
    } else if (currentModelValue) {
      modelSelect.value = 'custom';
      modelNameInput.value = currentModelValue;
      modelNameInput.classList.remove('hidden');
    } else {
      if (combined.length > 0) {
        modelSelect.value = combined[0];
        modelNameInput.value = combined[0];
        modelNameInput.classList.add('hidden');
      } else {
        modelSelect.value = 'custom';
        modelNameInput.value = '';
        modelNameInput.classList.remove('hidden');
      }
    }
  });
}

/**
 * Interroge l'API du fournisseur configuré pour lister dynamiquement
 * les modèles de chat utilisables.
 */
async function fetchModelsFromApi(provider, apiUrl, apiKey) {
  const logMsg = chrome.i18n.getMessage('logFetchingModels') || 'Récupération de la liste des modèles depuis l\'API...';
  addLog(logMsg, 'info');
  btnFetchModels.disabled = true;
  btnFetchModels.textContent = '⏳';

  try {
    let models = [];
    if (provider === 'google') {
      if (!apiKey) throw new Error('Clé API requise pour Gemini.');
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.models) {
        models = data.models
          .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
          .map(m => m.name.replace('models/', ''));
      }
    } else if (provider === 'ollama') {
      const url = `${apiUrl.replace(/\/$/, '')}/api/tags`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.models) {
        models = data.models.map(m => m.name);
      }
    } else {
      // OpenAI, Grok, DeepSeek, Mistral, Claude, Custom
      let endpoint = apiUrl.replace(/\/$/, '');
      if (provider !== 'custom') {
        if (!endpoint.endsWith('/models') && !endpoint.endsWith('/chat/completions')) {
          if (endpoint.endsWith('/v1')) {
            endpoint = `${endpoint}/models`;
          } else {
            endpoint = `${endpoint}/v1/models`;
          }
        }
      } else {
        if (!endpoint.endsWith('/models')) {
          endpoint = `${endpoint}/models`;
        }
      }

      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      if (provider === 'claude') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        headers['dangerously-allow-browser'] = 'true';
      }

      const response = await fetch(endpoint, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        const chatKeywords = ['gpt', 'grok', 'deepseek', 'mistral', 'claude', 'llama', 'qwen', 'gemini', 'chat', 'instruct', 'medium', 'large', 'small', 'codestral', 'devstral'];
        models = data.data
          .map(m => m.id)
          .filter(id => {
            const lower = id.toLowerCase();
            if (lower.includes('embed') || lower.includes('whisper') || lower.includes('tts') || lower.includes('dall-e') || lower.includes('moderation')) {
              return false;
            }
            return chatKeywords.some(kw => lower.includes(kw));
          });
      }
    }

    if (models.length === 0) {
      throw new Error('Aucun modèle de chat trouvé dans la réponse.');
    }

    chrome.storage.local.get(['cachedApiModels'], (res) => {
      const cached = res.cachedApiModels || {};
      cached[provider] = models;
      chrome.storage.local.set({ cachedApiModels: cached }, () => {
        updateModelOptions(modelNameInput.value);
        showToast(chrome.i18n.getMessage('toastModelsFetched') || 'Liste des modèles mise à jour');
        const successMsg = chrome.i18n.getMessage('logFetchModelsSuccess', [String(models.length)]) || `${models.length} modèles récupérés avec succès.`;
        addLog(successMsg, 'success');
      });
    });

  } catch (err) {
    console.error('[FavorAI] Error fetching models:', err);
    const errMsg = chrome.i18n.getMessage('logFetchModelsError', [err.message]) || `Échec : ${err.message}`;
    addLog(errMsg, 'error');
    showToast('Échec de récupération');
  } finally {
    btnFetchModels.disabled = false;
    btnFetchModels.textContent = '🔄';
  }
}


function getFolderPathFromList(folderId, foldersList) {
  if (!folderId) return '-';
  if (!foldersList || foldersList.length === 0) return folderId;
  const entry = foldersList.find(f => f.id === folderId);
  if (!entry) return folderId;
  const parts = entry.path.split(' > ');
  const genericRoots = ['Barre de favoris', 'Favoris', 'Bookmarks bar', 'Bookmarks Bar', 'Other bookmarks', 'Autres favoris', 'Mobile bookmarks'];
  if (parts.length > 1 && genericRoots.includes(parts[0])) {
    return parts.slice(1).join(' > ');
  }
  return parts.join(' > ');
}

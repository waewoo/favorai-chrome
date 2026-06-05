/**
 * Popup Configuration Tab Management
 */

import { PROVIDER_DEFAULTS, PROVIDER_MODELS, showToast, addLog } from './utils.js';
import { PROMPT_MINIMAL, PROMPT_COMPLETE, PROMPT_SUGGEST } from '../llm/prompts.js';

export const PROMPT_DEFAULTS = {
  minimal: PROMPT_MINIMAL,
  complete: PROMPT_COMPLETE,
  suggest: PROMPT_SUGGEST
};

export function checkConfigStatus() {
  const configMissingAlert = document.getElementById('configMissingAlert');
  if (!configMissingAlert) return;

  const providerSelect = document.getElementById('provider');
  const apiKeyInput = document.getElementById('apiKey');
  const apiUrlInput = document.getElementById('apiUrl');

  const provider = providerSelect.value;
  const apiKey = apiKeyInput.value.trim();

  // Show alert if:
  // 1. No provider selected
  // 2. No API key provided (except for Ollama which is local)
  // 3. API URL is missing for non-standard providers
  const shouldShowAlert = !provider ||
                         (provider !== 'ollama' && !apiKey) ||
                         (provider === 'custom' && !apiUrlInput.value.trim());

  if (shouldShowAlert) {
    configMissingAlert.style.display = 'flex';
  } else {
    configMissingAlert.style.display = 'none';
  }
}

export function updateModelOptions(currentModelValue) {
  const providerSelect = document.getElementById('provider');
  const modelSelect = document.getElementById('modelSelect');
  const modelNameInput = document.getElementById('modelName');

  const provider = providerSelect.value;
  if (!modelSelect || !modelNameInput) return;

  // Clear existing options
  modelSelect.textContent = '';

  chrome.storage.local.get(['cachedApiModels'], (res) => {
    const cached = res.cachedApiModels || {};
    let models = [];

    if (cached[provider] && cached[provider].length > 0) {
      models = cached[provider];
    } else {
      models = PROVIDER_MODELS[provider] || [];
    }

    if (models.length > 0) {
      models.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        modelSelect.appendChild(option);
      });

      // Add custom option
      const customOption = document.createElement('option');
      customOption.value = 'custom';
      customOption.textContent = chrome.i18n.getMessage('modelOptionCustom') || 'Custom...';
      modelSelect.appendChild(customOption);

      if (models.includes(currentModelValue)) {
        modelSelect.value = currentModelValue;
        modelNameInput.value = currentModelValue;
        modelNameInput.classList.add('hidden');
      } else if (currentModelValue) {
        modelSelect.value = 'custom';
        modelNameInput.value = currentModelValue;
        modelNameInput.classList.remove('hidden');
      } else {
        modelSelect.selectedIndex = 0;
        modelNameInput.value = modelSelect.value;
        modelNameInput.classList.add('hidden');
      }
    } else {
      // If no models, default to text input only
      const option = document.createElement('option');
      option.value = 'custom';
      option.textContent = chrome.i18n.getMessage('modelOptionCustom') || 'Custom...';
      modelSelect.appendChild(option);
      modelSelect.value = 'custom';
      modelNameInput.value = currentModelValue || '';
      modelNameInput.classList.remove('hidden');
    }
  });
}

export function loadConfig() {
  const providerSelect = document.getElementById('provider');
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const modelNameInput = document.getElementById('modelName');
  const checkDeadLinksCheckbox = document.getElementById('checkDeadLinks');
  const linkCheckBatchSizeSelect = document.getElementById('linkCheckBatchSize');
  const maxTokensSelect = document.getElementById('maxTokens');
  const debugModeCheckbox = document.getElementById('debugMode');
  const promptMinimalInput = document.getElementById('promptMinimal');
  const promptCompleteInput = document.getElementById('promptComplete');
  const promptSuggestInput = document.getElementById('promptSuggest');

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

    // Check config status AFTER loading data into inputs
    checkConfigStatus();
  });
}

export function saveConfig() {
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
    checkConfigStatus();
  });
}

export function resetConfig() {
  const providerSelect = document.getElementById('provider');
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const modelNameInput = document.getElementById('modelName');
  const checkDeadLinksCheckbox = document.getElementById('checkDeadLinks');
  const linkCheckBatchSizeSelect = document.getElementById('linkCheckBatchSize');
  const promptMinimalInput = document.getElementById('promptMinimal');
  const promptCompleteInput = document.getElementById('promptComplete');
  const promptSuggestInput = document.getElementById('promptSuggest');

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

export function resetPromptsToDefaults() {
  const promptMinimalInput = document.getElementById('promptMinimal');
  const promptCompleteInput = document.getElementById('promptComplete');
  const promptSuggestInput = document.getElementById('promptSuggest');

  promptMinimalInput.value = PROMPT_DEFAULTS.minimal;
  promptCompleteInput.value = PROMPT_DEFAULTS.complete;
  promptSuggestInput.value = PROMPT_DEFAULTS.suggest;
  saveConfig();
  showToast('Prompts réinitialisés');
}

export function exportConfig() {
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

export function importConfig(e) {
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

export async function fetchModelsFromApi(provider, apiUrl, apiKey) {
  const btnFetchModels = document.getElementById('btnFetchModels');
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
        updateModelOptions(document.getElementById('modelName').value);
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

export function bindConfigEvents() {
  const providerSelect = document.getElementById('provider');
  const apiUrlInput = document.getElementById('apiUrl');
  const modelNameInput = document.getElementById('modelName');
  const maxTokensSelect = document.getElementById('maxTokens');
  const modelSelect = document.getElementById('modelSelect');
  const apiKeyInput = document.getElementById('apiKey');
  const btnFetchModels = document.getElementById('btnFetchModels');
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  const btnResetConfig = document.getElementById('btnResetConfig');
  const btnResetPrompts = document.getElementById('btnResetPrompts');
  const btnExportConfig = document.getElementById('btnExportConfig');
  const btnImportConfig = document.getElementById('btnImportConfig');
  const importConfigFileInput = document.getElementById('importConfigFile');

  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      const provider = providerSelect.value;
      const defaults = PROVIDER_DEFAULTS[provider];
      if (defaults) {
        apiUrlInput.value = defaults.url;
        modelNameInput.value = defaults.model;
        if (defaults.maxTokens) maxTokensSelect.value = defaults.maxTokens;
        updateModelOptions(defaults.model);
      }
      checkConfigStatus();
    });
  }

  if (modelSelect) {
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
  }

  if (apiKeyInput) {
    apiKeyInput.addEventListener('input', checkConfigStatus);
  }

  if (apiUrlInput) {
    apiUrlInput.addEventListener('input', checkConfigStatus);
  }

  if (btnFetchModels) {
    btnFetchModels.addEventListener('click', () => {
      const provider = providerSelect.value;
      const apiUrl = apiUrlInput.value.trim();
      const apiKey = apiKeyInput.value.trim();
      fetchModelsFromApi(provider, apiUrl, apiKey);
    });
  }

  if (btnSaveConfig) btnSaveConfig.addEventListener('click', saveConfig);
  if (btnResetConfig) btnResetConfig.addEventListener('click', resetConfig);
  if (btnResetPrompts) btnResetPrompts.addEventListener('click', resetPromptsToDefaults);
  if (btnExportConfig) btnExportConfig.addEventListener('click', exportConfig);
  if (btnImportConfig) btnImportConfig.addEventListener('click', () => importConfigFileInput.click());
  if (importConfigFileInput) importConfigFileInput.addEventListener('change', importConfig);
}

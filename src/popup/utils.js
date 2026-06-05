/**
 * Popup Utilities & Constants
 */

import { sanitizeText } from '../utils/sanitizeText.js';

export { sanitizeText };

export const PROVIDER_DEFAULTS = {
  openai:   { url: 'https://api.openai.com/v1',                   model: 'gpt-5.5',             maxTokens: '131072' },
  google:   { url: 'https://generativelanguage.googleapis.com',   model: 'gemini-3.5-flash',    maxTokens: '65536'  },
  mistral:  { url: 'https://api.mistral.ai/v1',                   model: 'mistral-large-latest', maxTokens: '131072' },
  grok:     { url: 'https://api.x.ai/v1',                         model: 'grok-2',              maxTokens: '8192'   },
  claude:   { url: 'https://api.anthropic.com',                   model: 'claude-sonnet-4-6',   maxTokens: '131072' },
  deepseek: { url: 'https://api.deepseek.com/v1',                 model: 'deepseek-chat',       maxTokens: '65536'  },
  ollama:   { url: 'http://localhost:11434',                       model: 'llama3.1',            maxTokens: '131072' },
  custom:   { url: '',                                             model: '',                    maxTokens: '131072' }
};

export const PROVIDER_MODELS = {
  openai:   ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4-pro', 'gpt-5.4-mini', 'gpt-4o', 'gpt-4o-mini'],
  google:   ['gemini-3.5-flash', 'gemini-3.1-pro', 'gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  mistral:  ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  grok:     ['grok-2', 'grok-2-mini', 'grok-beta'],
  claude:   ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner'],
  ollama:   ['llama3.1', 'llama3', 'mistral', 'gemma2', 'phi3', 'qwen2.5'],
  custom:   []
};

export function translatePage() {
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

export function showConfirm(title, message) {
  const confirmModal = document.getElementById('confirmModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalMessage = document.getElementById('modalMessage');
  const modalBtnConfirm = document.getElementById('modalBtnConfirm');
  const modalBtnCancel = document.getElementById('modalBtnCancel');

  modalTitle.textContent = sanitizeText(title);
  modalMessage.textContent = sanitizeText(message);
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

export function showToast(message, toastOrId = 'toast') {
  const toast = typeof toastOrId === 'string'
    ? document.getElementById(toastOrId)
    : toastOrId;
  if (toast) {
    toast.textContent = sanitizeText(message);
    toast.classList.add('show');
  }
}

export function isSafeUrl(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase().trim();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

export function formatExplanation(text) {
  if (!text) return '';
  const str = String(text).trim();

  // Try to parse as JSON
  let explanation = null;
  try {
    explanation = JSON.parse(str);
  } catch {
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

export function addLog(text, type = 'info') {
  const logContainer = document.getElementById('logContainer');
  if (!logContainer) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = text;
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

export function addLoadingLog(message) {
  const logContainer = document.getElementById('logContainer');
  if (!logContainer) return;
  const entry = document.createElement('div');
  entry.id = 'loadingLogEntry';
  entry.className = 'log-entry loading';
  const spinner = document.createElement('span');
  spinner.className = 'loading-spinner';
  entry.appendChild(spinner);
  entry.appendChild(document.createTextNode(message));
  logContainer.appendChild(entry);
  logContainer.scrollTop = logContainer.scrollHeight;
}

export function removeLoadingLog() {
  const loadingEntry = document.getElementById('loadingLogEntry');
  if (loadingEntry) {
    loadingEntry.remove();
  }
}

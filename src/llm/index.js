/* v8 ignore next */
import { queryOpenAI }   from './providers/openai.js';
import { queryGemini }   from './providers/gemini.js';
import { queryMistral }  from './providers/mistral.js';
import { queryOllama }   from './providers/ollama.js';
import { queryCustom }   from './providers/custom.js';
import { queryClaude }   from './providers/claude.js';
import { queryDeepSeek } from './providers/deepseek.js';

import { SYSTEM_PROMPT_COMMON, PROMPT_MINIMAL, PROMPT_COMPLETE, PROMPT_SUGGEST } from './prompts.js';
import { validateReorganizedResponse, validateSuggestionResponse } from './utils.js';

// ─── Context helpers ───────────────────────────────────────────────────────

function countBookmarks(node) {
  if (!node.children) return 1;
  return node.children.reduce((sum, child) => sum + countBookmarks(child), 0);
}

function getTopLevelFolders(tree) {
  if (!tree.children) return [];
  return tree.children.filter(n => n.children).map(n => n.title).filter(Boolean);
}

function detectUserProfile(tree) {
  const techRe = /\b(code|dev|docker|kubernetes|k8s|linux|python|javascript|typescript|react|vue|angular|node|api|git|github|aws|azure|gcp|cloud|server|database|sql|mongodb|redis|nginx|programming|software|engineering|cyber|security|hacking|homelab|sysadmin|bash|shell|vim|vscode|npm|pip|rust|golang|java|php|ruby|swift|flutter|devops|terraform|ansible|prometheus|grafana|ml|ai|llm|gpt|deeplearning|pytorch|tensorflow|data|analytics|kafka|frontend|backend|fullstack)\b/i;
  const personalRe = /\b(food|recipe|cooking|travel|trip|vacation|sport|fitness|gym|yoga|music|movie|film|serie|netflix|youtube|gaming|game|pet|cat|dog|family|kids|baby|health|medical|diet|book|novel|manga|anime|fashion|art|photo|diy|craft|garden|home|house|car|bike)\b/i;

  let tech = 0, personal = 0;
  function scan(node) {
    if (node.title) {
      if (techRe.test(node.title)) tech++;
      if (personalRe.test(node.title)) personal++;
    }
    if (node.children) node.children.forEach(scan);
  }
  scan(tree);

  const total = tech + personal;
  if (total === 0) return 'MIXED';
  if (tech / total > 0.65) return 'TECH';
  if (personal / total > 0.65) return 'PERSONAL';
  return 'MIXED';
}

function getLanguageInstruction() {
  const uiLanguage = chrome.i18n.getUILanguage();
  const languageMap = {
    'en': 'English',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ja': 'Japanese',
    'zh': 'Chinese',
    'ru': 'Russian',
    'ko': 'Korean'
  };

  const language = languageMap[uiLanguage] || languageMap[uiLanguage.split('-')[0]] || 'English';
  return `IMPORTANT: Respond in ${language}. Your entire response (explanation, folder names, everything) must be in ${language}.`;
}

function buildContextBlock(tree) {
  const total = countBookmarks(tree);
  const topFolders = getTopLevelFolders(tree);
  const profile = detectUserProfile(tree);
  return [
    `USER CONTEXT (auto-detected):`,
    `- User profile: ${profile}`,
    `- Total bookmarks: ${total}`,
    `- Current top-level folders: ${topFolders.length > 0 ? topFolders.join(', ') : '(none)'}`,
  ].join('\n');
}

// ───────────────────────────────────────────────────────────────────────────

/**
 * Route la requête vers le bon provider LLM.
 * @param {object} config  - { provider, apiUrl, apiKey, modelName, promptMinimal, promptComplete }
 * @param {object} bookmarksTree - Arborescence nettoyée (sans URLs)
 * @param {string} mode    - 'minimal' | 'complete'
 * @param {AbortSignal} signal
 */
export async function queryLLM(config, bookmarksTree, mode, signal) {
  const { provider, apiUrl, apiKey, modelName, promptMinimal, promptComplete, debugMode, maxTokens } = config;
  const resolvedMaxTokens = parseInt(maxTokens, 10) || 131072;

  const languageInstruction = getLanguageInstruction();
  const systemPrompt = `${SYSTEM_PROMPT_COMMON}\n\n${languageInstruction}`;

  const modeInstruction = mode === 'complete'
    ? (promptComplete || PROMPT_COMPLETE)
    : (promptMinimal || PROMPT_MINIMAL);

  const contextBlock = buildContextBlock(bookmarksTree);
  const userPrompt = `${modeInstruction}\n\n${contextBlock}\n\nHere is the JSON of my current bookmarks to reorganize:\n\n${JSON.stringify(bookmarksTree)}`;

  if (debugMode) {
    console.log('=== DEBUG: LLM Query ===');
    console.log('Provider:', provider);
    console.log('Model:', modelName);
    console.log('Mode:', mode);
    console.log('Context:', contextBlock);
    console.log('--- System Prompt ---');
    console.log(systemPrompt);
    console.log('--- Mode Instruction ---');
    console.log(modeInstruction);
    console.log('--- User Prompt (Preview) ---');
    console.log(userPrompt.substring(0, 500));
    console.log('========================');
  }

  const result = await dispatchToProvider({ provider, apiUrl, apiKey, modelName, debugMode }, userPrompt, systemPrompt, signal, resolvedMaxTokens);
  return validateReorganizedResponse(result);
}

/**
 * Recommande le meilleur emplacement pour un nouveau favori en interrogeant le LLM.
 * @param {object} config - LLM config
 * @param {object} bookmark - { title, url }
 * @param {Array} folders - Liste des dossiers [{ id, path }]
 * @param {AbortSignal} signal
 */

export async function suggestBookmarkLocation(config, bookmark, folders, ignoredFolderIds, signal) {
  const { provider, apiUrl, apiKey, modelName, promptSuggest, debugMode } = config;

  const foldersList = folders.map(f => `${f.id}: "${f.path}"`).join('\n');
  const languageInstruction = getLanguageInstruction();
  const systemPrompt = `You are a strict JSON classifier. You must return ONLY a valid JSON object matching the requested schema without any markdown tags, markdown blocks, or extra conversational text. ${languageInstruction}`;

  const template = promptSuggest || PROMPT_SUGGEST;
  // Single-pass replacement prevents a crafted bookmark title/url (e.g. "{folders}")
  // from being substituted again in a later sequential .replace() call.
  const substitutions = { title: bookmark.title, url: bookmark.url, folders: foldersList };
  const userPrompt = template.replace(/\{(title|url|folders)\}/g, (_, key) => substitutions[key] ?? _);

  let avoidInstruction = '';
  if (ignoredFolderIds && ignoredFolderIds.length > 0) {
    const ignoredPaths = folders
      .filter(f => ignoredFolderIds.includes(f.id))
      .map(f => `${f.id}: "${f.path}"`);
    if (ignoredPaths.length > 0) {
      avoidInstruction = `\n\nCRITICAL CONSTRAINT: You MUST NOT recommend any of the following folders (avoid these IDs):\n${ignoredPaths.join('\n')}\nPlease recommend a DIFFERENT, alternative folder location.`;
    }
  }

  const finalUserPrompt = userPrompt + avoidInstruction;
  const result = await dispatchToProvider({ provider, apiUrl, apiKey, modelName, debugMode }, finalUserPrompt, systemPrompt, signal, 4096);
  return validateSuggestionResponse(result);
}

/**
 * Achemine la requête vers le bon provider LLM.
 * Point unique de dispatch pour éviter la duplication entre queryLLM et suggestBookmarkLocation.
 */
function dispatchToProvider({ provider, apiUrl, apiKey, modelName, debugMode }, userPrompt, systemPrompt, signal, maxTokens) {
  switch (provider) {
    case 'openai':
      return queryOpenAI(apiUrl || 'https://api.openai.com/v1', apiKey, modelName || 'gpt-5.5', userPrompt, systemPrompt, signal, debugMode, maxTokens);
    case 'google':
      return queryGemini(apiUrl || 'https://generativelanguage.googleapis.com', apiKey, modelName || 'gemini-3.5-flash', userPrompt, systemPrompt, signal, debugMode, maxTokens);
    case 'mistral':
      return queryMistral(apiUrl || 'https://api.mistral.ai/v1', apiKey, modelName || 'mistral-medium-latest', userPrompt, systemPrompt, signal, debugMode, maxTokens);
    case 'grok':
      return queryOpenAI(apiUrl || 'https://api.x.ai/v1', apiKey, modelName || 'grok-4-3', userPrompt, systemPrompt, signal, debugMode, maxTokens);
    case 'claude':
      return queryClaude(apiUrl || 'https://api.anthropic.com', apiKey, modelName || 'claude-opus-4-7', userPrompt, systemPrompt, signal, debugMode, maxTokens);
    case 'deepseek':
      return queryDeepSeek(apiUrl || 'https://api.deepseek.com/v1', apiKey, modelName || 'deepseek-reasoner', userPrompt, systemPrompt, signal, debugMode, maxTokens);
    case 'ollama':
      return queryOllama(apiUrl || 'http://localhost:11434', modelName || 'llama-4-scout', userPrompt, systemPrompt, signal, debugMode, maxTokens);
    case 'custom':
      return queryCustom(apiUrl, apiKey, modelName, userPrompt, systemPrompt, signal, debugMode, maxTokens);
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}

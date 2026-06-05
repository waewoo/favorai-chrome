const ALLOWED_PROVIDERS = new Set(['openai', 'google', 'mistral', 'grok', 'claude', 'deepseek', 'ollama', 'custom']);

function normalizeProvider(provider, fallbackProvider = 'google') {
  const normalized = String(provider || '').trim().toLowerCase();
  return ALLOWED_PROVIDERS.has(normalized) ? normalized : fallbackProvider;
}

function normalizePositiveInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function sanitizeLlmConfig(rawConfig = {}, {
  defaultProvider = 'google',
  defaultMaxTokens = 32768,
  defaultLinkCheckBatchSize = 24
} = {}) {
  return {
    provider: normalizeProvider(rawConfig.provider, defaultProvider),
    apiUrl: normalizeString(rawConfig.apiUrl),
    apiKey: normalizeString(rawConfig.apiKey),
    modelName: normalizeString(rawConfig.modelName),
    debugMode: rawConfig.debugMode === true,
    maxTokens: normalizePositiveInteger(rawConfig.maxTokens, defaultMaxTokens),
    linkCheckBatchSize: normalizePositiveInteger(rawConfig.linkCheckBatchSize, defaultLinkCheckBatchSize),
    promptMinimal: normalizeString(rawConfig.promptMinimal),
    promptComplete: normalizeString(rawConfig.promptComplete),
    promptSuggest: normalizeString(rawConfig.promptSuggest)
  };
}

export function sanitizeAnalysisConfig(rawConfig = {}) {
  const sanitized = sanitizeLlmConfig(rawConfig, {
    defaultProvider: 'google',
    defaultMaxTokens: 32768,
    defaultLinkCheckBatchSize: 24
  });

  return {
    ...sanitized,
    apiKey: ''
  };
}

export function mergeAnalysisConfigWithStoredApiKey(rawConfig, apiKey) {
  return {
    ...sanitizeAnalysisConfig(rawConfig),
    apiKey: normalizeString(apiKey)
  };
}

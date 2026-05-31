/* v8 ignore next */
/** IDs des nœuds racines Chrome à ne jamais modifier */
export const CHROME_ROOT_IDS = new Set(['0', '1', '2', '3']);

/** Timeout appels LLM (ms) */
export const LLM_TIMEOUT_MS = 300_000;

/** Timeout vérification liens (ms) */
export const URL_CHECK_TIMEOUT_MS = 10_000;

/** Sessions max dans l'historique */
export const MAX_HISTORY_SESSIONS = 30;

/** Préfixe IDs temporaires de nouveaux dossiers */
export const NEW_FOLDER_PREFIX = 'new_';

/** Domaines restreints (inaccessibles via fetch depuis une extension) */
export const RESTRICTED_DOMAINS = new Set([
  'chromewebstore.google.com',
  'chrome.google.com',
  'microsoftedge.microsoft.com',
  'addons.mozilla.org'
]);

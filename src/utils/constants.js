/* v8 ignore next */
/** IDs des nœuds racines Chrome à ne jamais modifier */
export const CHROME_ROOT_IDS = new Set(['0', '1', '2', '3']);

/** Timeout appels LLM (ms) */
export const LLM_TIMEOUT_MS = 300_000;

/** Timeout vérification liens (ms) */
export const URL_CHECK_TIMEOUT_MS = 10_000;

/** Sessions max dans l'historique */
export const MAX_HISTORY_SESSIONS = 30;

/** Clé de stockage local des snapshots de favoris */
export const BOOKMARK_SNAPSHOTS_STORAGE_KEY = 'bookmarkSnapshots';

/** Nombre maximal de snapshots conservés localement */
export const MAX_BOOKMARK_SNAPSHOTS = 20;

/** Seuil par défaut pour le déplacement automatique des nouveaux favoris */
export const AUTO_MOVE_CONFIDENCE_THRESHOLD_DEFAULT = 0.8;

/** Limite quotidienne par défaut des appels de classification automatique */
export const AUTO_BOOKMARK_DAILY_LIMIT_DEFAULT = 20;

/** Délai de regroupement des créations de favoris (ms) */
export const AUTO_BOOKMARK_DEBOUNCE_MS_DEFAULT = 100;

/** Taille à partir de laquelle une rafale est considérée comme incertaine */
export const AUTO_BOOKMARK_BURST_THRESHOLD_DEFAULT = 3;

/** Durée de conservation des états de classification (ms) */
export const AUTO_BOOKMARK_RETENTION_MS_DEFAULT = 7 * 24 * 60 * 60 * 1000;

/** Préfixe IDs temporaires de nouveaux dossiers */
export const NEW_FOLDER_PREFIX = 'new_';

/** Domaines restreints (inaccessibles via fetch depuis une extension) */
export const RESTRICTED_DOMAINS = new Set([
  'chromewebstore.google.com',
  'chrome.google.com',
  'microsoftedge.microsoft.com',
  'addons.mozilla.org'
]);

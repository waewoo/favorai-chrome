/**
 * Vérifie qu'une URL utilise uniquement http:// ou https://.
 * Prévient les injections via javascript:, data:, etc.
 * @param {string} url
 * @returns {boolean}
 */
export function isSafeUrl(url) {
  if (!url) return false;
  const lower = String(url).toLowerCase().trim();
  return lower.startsWith('http://') || lower.startsWith('https://');
}

/* v8 ignore next */
/**
 * Truncates a string if it exceeds the maximum length and appends ellipsis.
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
export function truncateString(str, maxLength) {
  if (!str) return '';
  const s = String(str);
  if (s.length <= maxLength) return s;
  return s.substring(0, maxLength) + '...';
}

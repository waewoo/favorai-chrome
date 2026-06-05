/* v8 ignore next */
/**
 * Normalizes untrusted values before rendering them through textContent.
 * HTML is not interpreted by textContent; this helper removes invisible control
 * characters that can make UI text misleading or hard to inspect.
 * @param {unknown} value
 * @returns {string}
 */
export function sanitizeText(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n?/g, '\n');
}

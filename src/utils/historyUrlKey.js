import { isSafeUrl } from './isSafeUrl.js';

/**
 * Conservative URL key for history correlation. Unlike duplicate detection,
 * it never merges different schemes or query strings.
 */
export function historyUrlKey(url) {
  if (!isSafeUrl(url)) return null;
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.href;
  } catch {
    return null;
  }
}

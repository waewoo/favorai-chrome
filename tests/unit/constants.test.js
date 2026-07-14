import { describe, it, expect } from 'vitest';
import {
  CHROME_ROOT_IDS,
  AUTO_MOVE_CONFIDENCE_THRESHOLD_DEFAULT,
  LLM_TIMEOUT_MS,
  URL_CHECK_TIMEOUT_MS,
  MAX_HISTORY_SESSIONS,
  NEW_FOLDER_PREFIX,
  RESTRICTED_DOMAINS
} from '../../src/utils/constants.js';

describe('constants', () => {
  it('should contain all four Chrome root IDs', () => {
    expect(CHROME_ROOT_IDS.has('0')).toBe(true);
    expect(CHROME_ROOT_IDS.has('1')).toBe(true);
    expect(CHROME_ROOT_IDS.has('2')).toBe(true);
    expect(CHROME_ROOT_IDS.has('3')).toBe(true);
  });

  it('should contain all expected restricted domains', () => {
    expect(RESTRICTED_DOMAINS.has('chromewebstore.google.com')).toBe(true);
    expect(RESTRICTED_DOMAINS.has('chrome.google.com')).toBe(true);
    expect(RESTRICTED_DOMAINS.has('microsoftedge.microsoft.com')).toBe(true);
    expect(RESTRICTED_DOMAINS.has('addons.mozilla.org')).toBe(true);
  });

  it('should not include unrelated domains in RESTRICTED_DOMAINS', () => {
    expect(RESTRICTED_DOMAINS.has('example.com')).toBe(false);
    expect(RESTRICTED_DOMAINS.has('')).toBe(false);
  });

  it('should export correct timeout and limit values', () => {
    expect(LLM_TIMEOUT_MS).toBeGreaterThan(0);
    expect(URL_CHECK_TIMEOUT_MS).toBeGreaterThan(0);
    expect(MAX_HISTORY_SESSIONS).toBe(30);
    expect(AUTO_MOVE_CONFIDENCE_THRESHOLD_DEFAULT).toBe(0.8);
  });

  it('should export the new folder prefix as new_', () => {
    expect(NEW_FOLDER_PREFIX).toBe('new_');
  });
});

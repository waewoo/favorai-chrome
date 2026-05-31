import { describe, it, expect } from 'vitest';
import { isSafeUrl } from '../../src/utils/isSafeUrl.js';

describe('isSafeUrl', () => {
  it('returns false for null/undefined/empty', () => {
    expect(isSafeUrl(null)).toBe(false);
    expect(isSafeUrl(undefined)).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });
  it('accepts http://', () => expect(isSafeUrl('http://example.com')).toBe(true));
  it('accepts https://', () => expect(isSafeUrl('https://example.com')).toBe(true));
  it('rejects javascript:', () => expect(isSafeUrl('javascript:alert(1)')).toBe(false));
  it('rejects data: URIs', () => expect(isSafeUrl('data:text/html,<h1>XSS</h1>')).toBe(false));
  it('rejects chrome: URLs', () => expect(isSafeUrl('chrome://settings')).toBe(false));
  it('rejects file: URLs', () => expect(isSafeUrl('file:///etc/passwd')).toBe(false));
  it('is case-insensitive', () => {
    expect(isSafeUrl('HTTP://EXAMPLE.COM')).toBe(true);
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
  });
  it('handles leading spaces', () => expect(isSafeUrl('  https://example.com')).toBe(true));

  it('accepts https:// when http:// does not match (tests right side of ||)', () => {
    // url does NOT start with 'http://' → evaluates right side: startsWith('https://')
    expect(isSafeUrl('https://secure.example.com')).toBe(true);
    expect(isSafeUrl('HTTPS://SECURE.EXAMPLE.COM')).toBe(true);
  });

  it('returns false for empty string (0-length)', () => {
    expect(isSafeUrl('')).toBe(false);
  });
});

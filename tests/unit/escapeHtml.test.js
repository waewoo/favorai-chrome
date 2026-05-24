import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../../src/utils/escapeHtml.js';

describe('escapeHtml', () => {
  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });
  it('escapes &', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
  it('escapes <', () => expect(escapeHtml('<script>')).toBe('&lt;script&gt;'));
  it('escapes >', () => expect(escapeHtml('a>b')).toBe('a&gt;b'));
  it('escapes double quotes', () => expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;'));
  it('escapes single quotes', () => expect(escapeHtml("it's")).toBe('it&#039;s'));
  it('handles all at once', () => {
    expect(escapeHtml('<script>alert(\'xss\')</script>')).toBe('&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;');
  });
  it('does not double-escape', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });
  it('converts non-string to string', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(true)).toBe('true');
  });
});

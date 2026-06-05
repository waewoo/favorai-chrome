import { describe, it, expect } from 'vitest';
import { sanitizeText } from '../../src/utils/sanitizeText.js';

describe('sanitizeText', () => {
  it('returns an empty string for nullish values', () => {
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText(undefined)).toBe('');
  });

  it('converts primitive values to text', () => {
    expect(sanitizeText(42)).toBe('42');
    expect(sanitizeText(false)).toBe('false');
  });

  it('keeps HTML as inert text for textContent rendering', () => {
    expect(sanitizeText('<img src=x onerror=alert(1)>')).toBe('<img src=x onerror=alert(1)>');
  });

  it('removes invisible control characters while preserving tab and newline', () => {
    expect(sanitizeText('a\u0000b\u0008c\tline\r\nnext\u007F')).toBe('abc\tline\nnext');
  });

  it('normalizes lone carriage returns to newlines', () => {
    expect(sanitizeText('first\rsecond')).toBe('first\nsecond');
  });
});

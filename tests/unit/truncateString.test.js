import { describe, it, expect } from 'vitest';
import { truncateString } from '../../src/utils/truncateString.js';

describe('truncateString', () => {
  it('should return the string as-is if it is shorter than or equal to maxLength', () => {
    expect(truncateString('hello', 10)).toBe('hello');
    expect(truncateString('hello', 5)).toBe('hello');
  });

  it('should truncate and append ellipsis if string is longer than maxLength', () => {
    expect(truncateString('hello world', 5)).toBe('hello...');
  });

  it('should handle null, undefined, or empty values gracefully by returning an empty string', () => {
    expect(truncateString(null, 5)).toBe('');
    expect(truncateString(undefined, 5)).toBe('');
    expect(truncateString('', 5)).toBe('');
  });

  it('should return empty string for falsy numeric 0 (truthy-check branch)', () => {
    // 0 is falsy → !str is true → early return ''
    expect(truncateString(0, 5)).toBe('');
  });

  it('should return the string when length equals maxLength exactly (boundary of <= branch)', () => {
    expect(truncateString('hello', 5)).toBe('hello');
    expect(truncateString('hi', 2)).toBe('hi');
  });
});

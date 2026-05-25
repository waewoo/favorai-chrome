import { describe, it, expect } from 'vitest';
import { cleanAndParseJSON } from '../../src/llm/utils.js';

describe('cleanAndParseJSON', () => {
  it('should parse standard JSON strings', () => {
    const json = '{"key": "value", "number": 123}';
    expect(cleanAndParseJSON(json)).toEqual({ key: 'value', number: 123 });
  });

  it('should extract JSON from markdown code blocks', () => {
    const json = '```json\n{"key": "value"}\n```';
    expect(cleanAndParseJSON(json)).toEqual({ key: 'value' });
  });

  it('should extract JSON from generic markdown blocks', () => {
    const json = '```\n{"key": "value"}\n```';
    expect(cleanAndParseJSON(json)).toEqual({ key: 'value' });
  });

  it('should extract JSON with surrounding text explanations', () => {
    const json = 'Here is the result:\n{\n  "key": "value"\n}\nHope you like it!';
    expect(cleanAndParseJSON(json)).toEqual({ key: 'value' });
  });

  it('should extract JSON arrays with surrounding text', () => {
    const json = 'Array results: [1, 2, 3] end of line';
    expect(cleanAndParseJSON(json)).toEqual([1, 2, 3]);
  });

  it('should throw isTokenLimit error if the response is likely truncated', () => {
    // Generate a long truncated string
    const truncated = '{"reorganizedTree": {' + 'a'.repeat(2100);
    expect(() => cleanAndParseJSON(truncated)).toThrow(/limite de tokens/i);
    try {
      cleanAndParseJSON(truncated);
    } catch (e) {
      expect(e.isTokenLimit).toBe(true);
    }
  });

  it('should throw an error for invalid JSON strings', () => {
    const invalid = 'not a json';
    expect(() => cleanAndParseJSON(invalid)).toThrow(/invalid/i);
  });
});

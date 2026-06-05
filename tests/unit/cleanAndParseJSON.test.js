import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanAndParseJSON } from '../../src/llm/utils.js';

describe('cleanAndParseJSON', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('should extract JSON when trailing text exists after valid JSON', () => {
    const json = '{"key": "value"} trailing text and explanations';
    expect(cleanAndParseJSON(json)).toEqual({ key: 'value' });
  });

  it('should extract JSON from surrounding text even with escaped characters in strings', () => {
    const json = 'Some text {\n  "key": "value \\"escaped\\""\n} more text';
    expect(cleanAndParseJSON(json)).toEqual({ key: 'value "escaped"' });
  });

  it('should handle brace matching but parsing failure gracefully', () => {
    const json = 'garbage {this is invalid json but brace matched} [1, 2, 3]';
    expect(cleanAndParseJSON(json)).toEqual([1, 2, 3]);
  });

  it('should handle escaped characters in bracket counting loop', () => {
    const json = 'garbage [\n  "value \\"escaped\\""\n] garbage';
    expect(cleanAndParseJSON(json)).toEqual(['value "escaped"']);
  });

  it('should handle bracket matching but parsing failure gracefully', () => {
    const json = 'garbage [invalid json but bracket matched] {"key": "value"}';
    expect(cleanAndParseJSON(json)).toEqual({ key: 'value' });
  });

  it('should sanitize unicode smart quotes and hyphens', () => {
    // \u201C / \u201D -> "
    // \u2018 / \u2019 -> '
    // \u2013 / \u2014 -> -
    // \u2026 -> ...
    const json = '{"quote": "\u201Chello\u201D", "single": "\u2018world\u2019", "hyphen": "\u2013 \u2014", "dots": "\u2026"}';
    expect(cleanAndParseJSON(json)).toEqual({
      quote: '"hello"',
      single: "'world'",
      hyphen: '- -',
      dots: '...'
    });
  });

  it('should cover JSON.parse fallback catch block when prefix parsing fails', () => {
    const originalParse = JSON.parse;
    vi.spyOn(JSON, 'parse').mockImplementation((text) => {
      if (text === '{"key": "value"}') {
        throw new Error('Artificial error');
      }
      return originalParse(text);
    });

    const json = '{"key": "value"} trailing text';
    expect(cleanAndParseJSON(json)).toEqual({ key: 'value' });

    vi.restoreAllMocks();
  });

  it('should return the input as-is if it is not a string', () => {
    const obj = { already: 'parsed' };
    expect(cleanAndParseJSON(obj)).toBe(obj);
  });

  it('should sanitize smart quotes enclosing keys and values when not already inside string literals', () => {
    const json = '\u201Ckey\u201D: \u201Cvalue\u201D';
    expect(cleanAndParseJSON('{' + json + '}')).toEqual({ key: 'value' });
  });

  it('should repair unescaped double quotes inside string values and trailing commas', () => {
    const json = '{"title": "Research "Finance" resources", "children": [],}';
    expect(cleanAndParseJSON(json)).toEqual({
      title: 'Research "Finance" resources',
      children: []
    });
  });

  it('should scan to the end when no significant char follows a closing quote', () => {
    expect(() => cleanAndParseJSON('{"title": "unfinished"   ')).toThrow();
  });

  it('should escape raw literal newlines and carriage returns inside double-quoted string literals', () => {
    const json = '{\n  "key": "line1\r\nline2\nline3"\n}';
    expect(cleanAndParseJSON(json)).toEqual({ key: 'line1\nline2\nline3' });
  });

  it('should escape smart double quotes inside string values (inString=true → \\" branch)', () => {
    // \u201C and \u201D inside a string value should become \" not "
    // This exercises the branch: inString → return '\\"'
    const json = '{"key": "\u201Chello\u201D world"}';
    const result = cleanAndParseJSON(json);
    expect(result.key).toBe('"hello" world');
  });

  it('should handle nested JSON objects (braceCount > 0 inner } FALSE branch)', () => {
    // Inner `}` decrements braceCount to 1 (not 0 yet) — exercises the FALSE branch
    const input = 'Prefix {"outer": {"inner": 1}} suffix';
    expect(cleanAndParseJSON(input)).toEqual({ outer: { inner: 1 } });
  });

  it('should handle nested JSON arrays (bracketCount > 0 inner ] FALSE branch)', () => {
    // Inner `]` decrements bracketCount to 1 (not 0 yet) — exercises the FALSE branch
    const input = 'Text [[1, 2], [3, 4]] end';
    expect(cleanAndParseJSON(input)).toEqual([[1, 2], [3, 4]]);
  });

  it('should propagate error when neither brace nor bracket extraction yields valid JSON', () => {
    // Unclosed [ — bracket extraction: indexOf('[') !== -1 but no matching ] → endIdx = -1
    // After all fallbacks fail, throws the generic error
    expect(() => cleanAndParseJSON('[unclosed array')).toThrow();
  });
});

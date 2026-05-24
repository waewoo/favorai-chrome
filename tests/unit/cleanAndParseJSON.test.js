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

  it('should throw an error for invalid JSON strings', () => {
    const invalid = 'not a json';
    expect(() => cleanAndParseJSON(invalid)).toThrow();
  });
});

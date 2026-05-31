import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT_COMMON, PROMPT_MINIMAL, PROMPT_COMPLETE, PROMPT_SUGGEST } from '../../src/llm/prompts.js';

describe('prompts', () => {
  it('SYSTEM_PROMPT_COMMON should be a non-empty string with key instructions', () => {
    expect(typeof SYSTEM_PROMPT_COMMON).toBe('string');
    expect(SYSTEM_PROMPT_COMMON.length).toBeGreaterThan(100);
    expect(SYSTEM_PROMPT_COMMON).toContain('bookmark');
  });

  it('PROMPT_MINIMAL should be a non-empty string with mode instruction', () => {
    expect(typeof PROMPT_MINIMAL).toBe('string');
    expect(PROMPT_MINIMAL.length).toBeGreaterThan(50);
    expect(PROMPT_MINIMAL).toContain('MODE');
  });

  it('PROMPT_COMPLETE should be a non-empty string with mode instruction', () => {
    expect(typeof PROMPT_COMPLETE).toBe('string');
    expect(PROMPT_COMPLETE.length).toBeGreaterThan(50);
    expect(PROMPT_COMPLETE).toContain('MODE');
  });

  it('PROMPT_SUGGEST should be a non-empty string with required placeholders', () => {
    expect(typeof PROMPT_SUGGEST).toBe('string');
    expect(PROMPT_SUGGEST.length).toBeGreaterThan(50);
    expect(PROMPT_SUGGEST).toContain('{title}');
    expect(PROMPT_SUGGEST).toContain('{folders}');
  });

  it('PROMPT_MINIMAL and PROMPT_COMPLETE should be distinct', () => {
    expect(PROMPT_MINIMAL).not.toBe(PROMPT_COMPLETE);
  });
});

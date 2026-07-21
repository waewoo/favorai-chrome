import { describe, it, expect } from 'vitest';
import { SYSTEM_PROMPT_COMMON, PROMPT_MINIMAL, PROMPT_COMPLETE, PROMPT_SUGGEST } from '../../src/llm/prompts.js';

describe('prompts', () => {
  it('describes the JSON contract and bookmark safety rules', () => {
    expect(SYSTEM_PROMPT_COMMON).toContain('reorganizedTree');
    expect(SYSTEM_PROMPT_COMMON).toContain('explanation');
    expect(SYSTEM_PROMPT_COMMON).toContain('new_');
    expect(SYSTEM_PROMPT_COMMON).toContain('Do NOT lose');
  });

  it('defines minimal mode and its conservative strategy', () => {
    expect(PROMPT_MINIMAL).toContain('MODE');
    expect(PROMPT_MINIMAL).toContain('When in doubt');
    expect(PROMPT_MINIMAL).toContain('DO NOT MOVE');
  });

  it('defines complete mode and its reorganization constraints', () => {
    expect(PROMPT_COMPLETE).toContain('MODE');
    expect(PROMPT_COMPLETE).toContain('6 to 8');
    expect(PROMPT_COMPLETE).toContain('new_');
    expect(PROMPT_COMPLETE).toContain('every bookmark');
  });

  it('contains the required fields for a bookmark suggestion', () => {
    expect(PROMPT_SUGGEST).toContain('{title}');
    expect(PROMPT_SUGGEST).toContain('{folders}');
    expect(PROMPT_SUGGEST).toContain('targetFolderId');
    expect(PROMPT_SUGGEST).toContain('newFolderParentId');
    expect(PROMPT_SUGGEST).toContain('"confidence"');
    expect(PROMPT_SUGGEST).toContain('valid JSON object');
  });

  it('PROMPT_MINIMAL and PROMPT_COMPLETE should be distinct', () => {
    expect(PROMPT_MINIMAL).not.toBe(PROMPT_COMPLETE);
  });
});

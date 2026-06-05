import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryTransientRequest, validateReorganizedResponse, validateSuggestionResponse } from '../../src/llm/utils.js';

describe('LLM response validation helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('accepts a reorganized tree array and validates nested children recursively', () => {
    const response = [
      {
        id: '0',
        title: 'root',
        children: [
          { id: '1', title: 'Folder', children: [{ id: '2' }] }
        ]
      }
    ];

    expect(validateReorganizedResponse(response)).toBe(response);
  });

  it('rejects a reorganized tree with a non-object node', () => {
    expect(() => validateReorganizedResponse({ reorganizedTree: 123 }))
      .toThrow(/doit être un objet ou un tableau/i);
  });

  it('rejects a malformed reorganized response container', () => {
    expect(() => validateReorganizedResponse(null))
      .toThrow(/objet JSON ou un tableau/i);
  });

  it('rejects a non-string explanation on reorganized responses', () => {
    expect(() => validateReorganizedResponse({
      reorganizedTree: { id: '0', title: 'root', children: [] },
      explanation: { text: 'bad' }
    })).toThrow(/explanation/i);
  });

  it('accepts a valid suggestion response', () => {
    const response = {
      action: 'create_new',
      newFolderTitle: 'Design',
      newFolderParentId: '1',
      explanation: 'ok',
      suggestedTitle: 'Design'
    };

    expect(validateSuggestionResponse(response)).toBe(response);
  });

  it('rejects invalid suggestion containers and required fields', () => {
    expect(() => validateSuggestionResponse(null))
      .toThrow(/suggestion doit être un objet JSON/i);
    expect(() => validateSuggestionResponse({ action: 'nope' }))
      .toThrow(/action/i);
    expect(() => validateSuggestionResponse({ action: 'use_existing' }))
      .toThrow(/targetFolderId/i);
    expect(() => validateSuggestionResponse({ action: 'create_new', newFolderTitle: '  ', newFolderParentId: '1' }))
      .toThrow(/newFolderTitle/i);
    expect(() => validateSuggestionResponse({ action: 'create_new', newFolderTitle: 'Design' }))
      .toThrow(/newFolderParentId/i);
  });

  it('rejects non-string optional suggestion fields', () => {
    expect(() => validateSuggestionResponse({
      action: 'use_existing',
      targetFolderId: '1',
      explanation: { text: 'bad' }
    })).toThrow(/explanation/i);

    expect(() => validateSuggestionResponse({
      action: 'use_existing',
      targetFolderId: '1',
      suggestedTitle: { text: 'bad' }
    })).toThrow(/suggestedTitle/i);
  });

  it('rejects when retryTransientRequest is called with an already aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(retryTransientRequest(async () => 'ok', { signal: controller.signal }))
      .rejects.toThrow(/Aborted/);
  });

  it('rejects when retryTransientRequest is aborted while waiting between attempts', async () => {
    const controller = new AbortController();
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('retry me'), { isRateLimit: true }))
      .mockResolvedValue('ok');

    const promise = retryTransientRequest(operation, {
      signal: controller.signal,
      attempts: 2,
      delayMs: 1000
    });

    await vi.advanceTimersByTimeAsync(100);
    controller.abort();

    await expect(promise).rejects.toThrow(/Aborted/);
  });

  it('rejects when retryTransientRequest sees an already aborted signal at sleep entry', async () => {
    const controller = new AbortController();
    const operation = vi.fn().mockImplementation(() => {
      controller.abort();
      throw Object.assign(new Error('retry me'), { isRateLimit: true });
    });

    await expect(retryTransientRequest(operation, {
      signal: controller.signal,
      attempts: 2,
      delayMs: 1000
    })).rejects.toThrow(/Aborted/);
  });

  it('retries immediately when the delay is zero', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('retry me'), { isRateLimit: true }))
      .mockResolvedValue('ok');

    await expect(retryTransientRequest(operation, {
      attempts: 2,
      delayMs: 0
    })).resolves.toBe('ok');
  });

  it('throws immediately for non-retryable errors with the default retry predicate', async () => {
    const operation = vi.fn().mockRejectedValue(new Error('no retry'));

    await expect(retryTransientRequest(operation, { attempts: 2 }))
      .rejects.toThrow('no retry');
  });
});

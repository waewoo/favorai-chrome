import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryOpenAI } from '../../src/llm/providers/openai.js';

describe('queryOpenAI retry behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retries once on 429 before returning the parsed JSON payload', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue('rate limit')
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '{"reorganizedTree":{"id":"0","title":"root","children":[]},"explanation":"ok"}'
              }
            }
          ]
        })
      });

    const promise = queryOpenAI(
      'https://api.openai.com/v1',
      'test-key',
      'gpt-5.5',
      'prompt',
      'system prompt',
      null,
      false,
      256
    );

    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual({
      reorganizedTree: { id: '0', title: 'root', children: [] },
      explanation: 'ok'
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries once on 503 before returning the parsed JSON payload', async () => {
    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue('temporarily unavailable')
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: '{"reorganizedTree":{"id":"0","children":[]},"explanation":"ok after 503"}'
              }
            }
          ]
        })
      });

    const promise = queryOpenAI(
      'https://api.openai.com/v1',
      'test-key',
      'gpt-5.5',
      'prompt',
      'system prompt',
      null,
      false,
      256
    );

    await vi.advanceTimersByTimeAsync(500);

    await expect(promise).resolves.toEqual({
      reorganizedTree: { id: '0', children: [] },
      explanation: 'ok after 503'
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry when the request is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(queryOpenAI(
      'https://api.openai.com/v1',
      'test-key',
      'gpt-5.5',
      'prompt',
      'system prompt',
      controller.signal,
      false,
      256
    )).rejects.toThrow(/Aborted/);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

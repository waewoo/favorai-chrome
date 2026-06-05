import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryOllama } from '../../src/llm/providers/ollama.js';

describe('queryOllama retry behaviour', () => {
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
          message: {
            content: '{"reorganizedTree":{"id":"0","title":"root","children":[]},"explanation":"ok"}'
          }
        })
      });

    const promise = queryOllama(
      'http://localhost:11434',
      'llama3',
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
          message: {
            content: '{"reorganizedTree":{"id":"0","children":[]},"explanation":"ok after 503"}'
          }
        })
      });

    const promise = queryOllama(
      'http://localhost:11434',
      'llama3',
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

    await expect(queryOllama(
      'http://localhost:11434',
      'llama3',
      'prompt',
      'system prompt',
      controller.signal,
      false,
      256
    )).rejects.toThrow(/Aborted/);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends request without an Authorization header (no API key)', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        message: { content: '{"reorganizedTree":{"id":"0","children":[]},"explanation":"ok"}' }
      })
    });

    await queryOllama('http://localhost:11434', 'llama3', 'prompt', 'sys', null, false, 256);

    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers).not.toHaveProperty('Authorization');
  });
});

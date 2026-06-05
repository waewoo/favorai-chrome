import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryCustom } from '../../src/llm/providers/custom.js';

describe('queryCustom retry behaviour', () => {
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
          choices: [{
            message: {
              content: '{"reorganizedTree":{"id":"0","title":"root","children":[]},"explanation":"ok"}'
            }
          }]
        })
      });

    const promise = queryCustom(
      'https://my-llm.example.com',
      'test-key',
      'my-model',
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
          choices: [{
            message: {
              content: '{"reorganizedTree":{"id":"0","children":[]},"explanation":"ok after 503"}'
            }
          }]
        })
      });

    const promise = queryCustom(
      'https://my-llm.example.com',
      'test-key',
      'my-model',
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

    await expect(queryCustom(
      'https://my-llm.example.com',
      'test-key',
      'my-model',
      'prompt',
      'system prompt',
      controller.signal,
      false,
      256
    )).rejects.toThrow(/Aborted/);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('appends /v1/chat/completions to a bare base URL', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"reorganizedTree":{"id":"0","children":[]},"explanation":"ok"}' } }]
      })
    });

    await queryCustom('https://my-llm.example.com', 'k', 'mdl', 'p', 's', null, false, 256);

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe('https://my-llm.example.com/v1/chat/completions');
  });

  it('appends /chat/completions when URL already ends with /v1', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"reorganizedTree":{"id":"0","children":[]},"explanation":"ok"}' } }]
      })
    });

    await queryCustom('https://my-llm.example.com/v1', 'k', 'mdl', 'p', 's', null, false, 256);

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe('https://my-llm.example.com/v1/chat/completions');
  });

  it('does not modify URL that already contains /chat/completions', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"reorganizedTree":{"id":"0","children":[]},"explanation":"ok"}' } }]
      })
    });

    await queryCustom('https://my-llm.example.com/v1/chat/completions', 'k', 'mdl', 'p', 's', null, false, 256);

    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe('https://my-llm.example.com/v1/chat/completions');
  });

  it('omits Authorization header when no key is provided', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        choices: [{ message: { content: '{"reorganizedTree":{"id":"0","children":[]},"explanation":"ok"}' } }]
      })
    });

    await queryCustom('https://my-llm.example.com', '', 'mdl', 'p', 's', null, false, 256);

    const [, init] = global.fetch.mock.calls[0];
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('returns raw data when response has no choices', async () => {
    const rawData = { custom_field: 'value' };
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(rawData)
    });

    const result = await queryCustom('https://my-llm.example.com', 'k', 'mdl', 'p', 's', null, false, 256);

    expect(result).toEqual(rawData);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithTimeout } from '../../src/llm/utils.js';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully fetch if request completes within timeout', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    const response = await fetchWithTimeout('https://api.example.com', {}, 5000);
    expect(response.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('https://api.example.com', expect.any(Object));
  });

  it('should abort and throw timeout error if request exceeds timeout', async () => {
    global.fetch.mockImplementation((url, init) => {
      return new Promise((resolve, reject) => {
        const signal = init?.signal;
        const tid = setTimeout(() => {
          resolve({ ok: true });
        }, 100);

        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(tid);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
    });

    await expect(fetchWithTimeout('https://api.example.com', {}, 10)).rejects.toThrow(/délai d'attente dépassé/i);
  });

  it('should support external abort signals', async () => {
    const controller = new AbortController();
    global.fetch.mockImplementation((url, init) => {
      return new Promise((resolve, reject) => {
        const signal = init?.signal;
        const tid = setTimeout(() => {
          resolve({ ok: true });
        }, 1000);

        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(tid);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
    });

    setTimeout(() => controller.abort(), 10);

    await expect(fetchWithTimeout('https://api.example.com', { signal: controller.signal }, 500)).rejects.toThrow(/aborted/i);
  });

  it('should rethrow standard network errors that are not abort-related', async () => {
    global.fetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(fetchWithTimeout('https://api.example.com', {}, 5000)).rejects.toThrow('Failed to fetch');
  });

  it('should throw timeout error if timeout exceeds but user signal is not aborted', async () => {
    const controller = new AbortController();
    global.fetch.mockImplementation((url, init) => {
      return new Promise((resolve, reject) => {
        const signal = init?.signal;
        const tid = setTimeout(() => { resolve({ ok: true }); }, 100);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(tid);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });
    });

    await expect(fetchWithTimeout('https://api.example.com', { signal: controller.signal }, 10)).rejects.toThrow(/dépassé|timeout/i);
  });

  it('should use default timeout if timeoutMs is not provided', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    const response = await fetchWithTimeout('https://api.example.com', {});
    expect(response.ok).toBe(true);
  });
});

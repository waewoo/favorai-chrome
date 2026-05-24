import { vi } from 'vitest';

export function createChromeMock() {
  return {
    bookmarks: {
      getTree: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'new-id', title: 'New' }),
      update: vi.fn().mockResolvedValue({}),
      move: vi.fn().mockResolvedValue({}),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      local: {
        get: vi.fn((keys, cb) => { if (cb) cb({}); return Promise.resolve({}); }),
        set: vi.fn((data, cb) => { if (cb) cb(); return Promise.resolve(); }),
        clear: vi.fn((cb) => { if (cb) cb(); return Promise.resolve(); }),
      },
      sync: {
        get: vi.fn((keys, cb) => { if (cb) cb({}); return Promise.resolve({}); }),
        set: vi.fn((data, cb) => { if (cb) cb(); return Promise.resolve(); }),
        clear: vi.fn((cb) => { if (cb) cb(); return Promise.resolve(); }),
      },
    },
    runtime: {
      sendMessage: vi.fn().mockResolvedValue({}),
      onMessage: { addListener: vi.fn() },
      onConnect: { addListener: vi.fn() },
      onInstalled: { addListener: vi.fn() },
      lastError: null,
      getURL: vi.fn((path) => `chrome-extension://test-id/${path}`),
      getManifest: vi.fn(() => ({ version: '1.1.0', name: 'FavorAI' })),
      id: 'test-extension-id',
      connect: vi.fn(() => ({
        name: 'test',
        onDisconnect: { addListener: vi.fn() },
        disconnect: vi.fn(),
      })),
    },
    i18n: {
      getMessage: vi.fn((key, subs) => {
        if (subs && subs.length) return `${key}(${subs.join(',')})`;
        return key;
      }),
      getUILanguage: vi.fn(() => 'en'),
    },
  };
}

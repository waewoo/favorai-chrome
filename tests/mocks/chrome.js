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
      removeTree: vi.fn().mockResolvedValue(undefined),
      getChildren: vi.fn().mockResolvedValue([]),
    },
    alarms: {
      create: vi.fn(),
      clear: vi.fn((name, cb) => { if (cb) cb(true); return Promise.resolve(true); }),
      onAlarm: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    windows: {
      get: vi.fn((id, cb) => { if (cb) cb({ id }); return Promise.resolve({ id }); }),
      getLastFocused: vi.fn((queryInfo, cb) => { if (cb) cb({ id: 1 }); return Promise.resolve({ id: 1 }); }),
      create: vi.fn((createData, cb) => {
        const win = { id: 1, ...createData };
        if (cb) cb(win);
        return Promise.resolve(win);
      }),
      update: vi.fn((id, updateInfo, cb) => {
        const win = { id, ...updateInfo };
        if (cb) cb(win);
        return Promise.resolve(win);
      }),
      onRemoved: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
    tabs: {
      query: vi.fn((queryInfo, cb) => {
        const tabs = [{ id: 1, title: 'Example', url: 'https://example.com', active: true }];
        if (cb) cb(tabs);
        return Promise.resolve(tabs);
      }),
      create: vi.fn((createProperties, cb) => {
        const tab = { id: 1, ...createProperties };
        if (cb) cb(tab);
        return Promise.resolve(tab);
      }),
    },
    history: {
      getVisits: vi.fn().mockResolvedValue([]),
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

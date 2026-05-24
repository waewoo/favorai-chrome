import { vi } from 'vitest';
import { createChromeMock } from './mocks/chrome.js';

// Inject chrome mock globally before each test
beforeEach(() => {
  global.chrome = createChromeMock();
  global.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name || 'DOMException';
    }
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

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

  // Silence console methods during tests to keep stdout/stderr clean
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

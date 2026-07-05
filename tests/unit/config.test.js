import { describe, it, expect, beforeEach } from 'vitest';
import { loadConfig, saveConfig } from '../../src/popup/config.js';

function field(value = '') {
  return {
    value,
    checked: false,
    style: {},
    classList: {
      add() {},
      remove() {}
    }
  };
}

describe('popup config storage', () => {
  let elements;

  beforeEach(() => {
    elements = {
      provider: field('google'),
      apiUrl: field('https://example.com'),
      apiKey: field(''),
      modelName: field('gemini-3.5-flash'),
      checkDeadLinks: field(),
      linkCheckBatchSize: field('24'),
      maxTokens: field('32768'),
      debugMode: field(),
      promptMinimal: field('min'),
      promptComplete: field('complete'),
      promptSuggest: field('suggest'),
      configMissingAlert: field()
    };

    global.document = {
      getElementById: (id) => elements[id] || null,
      querySelectorAll: () => []
    };

    chrome.storage.sync.get.mockImplementation((keys, cb) => {
      cb({
        provider: 'mistral',
        apiUrl: 'https://api.mistral.ai/v1',
        modelName: 'mistral-large-latest',
        checkDeadLinks: true,
        linkCheckBatchSize: 12,
        debugMode: true,
        promptMinimal: 'sync-min',
        promptComplete: 'sync-complete',
        promptSuggest: 'sync-suggest',
        maxTokens: 4096
      });
    });

    chrome.storage.local.get.mockImplementation((keys, cb) => {
      if (Array.isArray(keys) && keys.includes('apiKey')) {
        cb({ apiKey: 'local-secret' });
        return;
      }
      cb({});
    });
  });

  it('loads the api key from local storage', async () => {
    await loadConfig();

    expect(elements.apiKey.value).toBe('local-secret');
    expect(chrome.storage.sync.get).toHaveBeenCalledWith([
      'provider',
      'apiUrl',
      'modelName',
      'checkDeadLinks',
      'linkCheckBatchSize',
      'debugMode',
      'promptMinimal',
      'promptComplete',
      'maxTokens',
      'promptSuggest'
    ], expect.any(Function));
    expect(chrome.storage.local.get).toHaveBeenCalledWith(['apiKey'], expect.any(Function));
  });

  it('stores the api key in local storage when saving config', async () => {
    elements.apiKey.value = 'new-secret';

    await saveConfig();

    const [savedConfig] = chrome.storage.sync.set.mock.calls[0];
    expect(savedConfig).not.toHaveProperty('apiKey');
    expect(savedConfig.provider).toBe('google');
    expect(chrome.storage.local.set).toHaveBeenCalledWith({ apiKey: 'new-secret' }, expect.any(Function));
  });
});

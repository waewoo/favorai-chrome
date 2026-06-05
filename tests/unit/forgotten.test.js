import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scanForgottenBatched } from '../../src/popup/forgotten.js';

describe('scanForgottenBatched', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads history visits in bounded batches and skips failed URLs', async () => {
    chrome.bookmarks.getTree.mockResolvedValue([{
      id: '0',
      title: 'Root',
      children: [{
        id: '1',
        title: 'Bar',
        children: [
          { id: '10', title: 'Old A', url: 'https://a.com', parentId: '1' },
          { id: '11', title: 'Recent B', url: 'https://b.com', parentId: '1' },
          { id: '12', title: 'Broken C', url: 'https://c.com', parentId: '1' }
        ]
      }]
    }]);

    const now = Date.now();
    chrome.history.getVisits.mockImplementation(async ({ url }) => {
      if (url === 'https://a.com') return [{ visitTime: now - 90 * 86400000 }];
      if (url === 'https://b.com') return [{ visitTime: now }];
      throw new Error('history failed');
    });

    const result = await scanForgottenBatched(60, 2);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('10');
    expect(chrome.history.getVisits).toHaveBeenCalledTimes(3);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('skipped 1'));
  });
});

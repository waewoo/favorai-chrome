import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTopVisitedBookmarks, runAnalysis } from '../../src/background/analysis.js';
import { queryLLM } from '../../src/llm/index.js';

vi.mock('../../src/llm/index.js', () => ({
  queryLLM: vi.fn()
}));

describe('mostVisited', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTopVisitedBookmarks', () => {
    it('returns the top 10 most visited bookmarks, sorted descending', async () => {
      const bookmarks = [
        { id: '1', url: 'https://a.com' },
        { id: '2', url: 'https://b.com' },
        { id: '3', url: 'https://c.com' },
        { id: '4', url: 'https://d.com' },
        { id: '5', url: 'https://e.com' },
        { id: '6', url: 'https://f.com' },
        { id: '7', url: 'https://g.com' },
        { id: '8', url: 'https://h.com' },
        { id: '9', url: 'https://i.com' },
        { id: '10', url: 'https://j.com' },
        { id: '11', url: 'https://k.com' }
      ];

      chrome.history.getVisits.mockImplementation(async ({ url }) => {
        if (url === 'https://a.com') return [{}, {}, {}]; // 3 visits
        if (url === 'https://b.com') return [{}, {}, {}, {}, {}]; // 5 visits
        if (url === 'https://c.com') return [{}]; // 1 visit
        if (url === 'https://d.com') return []; // 0 visits
        if (url === 'https://e.com') return [{}, {}]; // 2 visits
        if (url === 'https://f.com') return [{}, {}, {}, {}]; // 4 visits
        if (url === 'https://g.com') return [{}, {}, {}, {}, {}, {}]; // 6 visits
        if (url === 'https://h.com') return [{}, {}, {}, {}, {}, {}, {}]; // 7 visits
        if (url === 'https://i.com') return [{}, {}, {}, {}, {}, {}, {}, {}]; // 8 visits
        if (url === 'https://j.com') return [{}, {}, {}, {}, {}, {}, {}, {}, {}]; // 9 visits
        if (url === 'https://k.com') return [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}]; // 10 visits
        return [];
      });

      const top = await getTopVisitedBookmarks(bookmarks, 5);

      expect(top).toHaveLength(10);
      expect(top[0].id).toBe('11'); // k (10 visits)
      expect(top[1].id).toBe('10'); // j (9 visits)
      expect(top[9].id).toBe('3');  // c (1 visit)

      const containsD = top.some(bm => bm.id === '4');
      expect(containsD).toBe(false);
    });

    it('safely handles missing chrome history API', async () => {
      const originalChrome = global.chrome;
      global.chrome = { ...originalChrome, history: undefined };

      const bookmarks = [{ id: '1', url: 'https://a.com' }];
      const top = await getTopVisitedBookmarks(bookmarks, 5);
      expect(top).toEqual([]);

      global.chrome = originalChrome;
    });
  });

  describe('runAnalysis integration', () => {
    it('injects new_most_visited folder at the root level of reorganizedTree', async () => {
      const rootBookmark = {
        id: '1',
        title: 'Bookmarks Bar',
        children: [
          { id: '10', title: 'A', url: 'https://a.com', parentId: '1' },
          { id: '11', title: 'B', url: 'https://b.com', parentId: '1' }
        ]
      };

      chrome.bookmarks.getSubTree.mockResolvedValue([rootBookmark]);
      chrome.bookmarks.getTree.mockResolvedValue([rootBookmark]);

      chrome.i18n.getMessage.mockImplementation((key) => {
        if (key === 'folderMostVisited') return '★ Most Visited';
        return key;
      });

      chrome.history.getVisits.mockImplementation(async ({ url }) => {
        if (url === 'https://a.com') return [{}, {}]; // 2 visits
        if (url === 'https://b.com') return [{}]; // 1 visit
        return [];
      });

      queryLLM.mockResolvedValue({
        reorganizedTree: {
          id: '1',
          title: 'Bookmarks Bar',
          children: [
            { id: '10' },
            { id: '11' }
          ]
        },
        explanation: 'Simplified'
      });

      const config = { provider: 'openai', modelName: 'gpt-4o', maxTokens: 100 };
      const currentStatus = { logs: [], percentage: 0 };

      const result = await runAnalysis(
        config,
        'complete',
        { useAI: true },
        null,
        currentStatus,
        '1'
      );

      // Verify that the new_most_visited folder actions are generated
      const createFolderAction = result.actions.find(act => act.type === 'create_folder' && act.targetId === 'new_most_visited');
      expect(createFolderAction).toBeDefined();
      expect(createFolderAction.title).toBe('★ Most Visited');

      const moveA = result.actions.find(act => act.type === 'move_bookmark' && act.targetId === '10');
      expect(moveA).toBeDefined();
      expect(moveA.params.newParentId).toBe('new_most_visited');

      const moveB = result.actions.find(act => act.type === 'move_bookmark' && act.targetId === '11');
      expect(moveB).toBeDefined();
      expect(moveB.params.newParentId).toBe('new_most_visited');
    });
  });
});

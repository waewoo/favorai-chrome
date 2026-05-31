import { describe, it, expect, beforeEach } from 'vitest';
import {
  flattenBookmarks,
  buildNodeMap,
  buildReorganizedMap,
  getPathFromMap,
  alignReorganizedIds,
  sanitizeReorganizedTree,
  cleanTreeForLLM
} from '../../src/background/diff.js';

describe('diff.js functions', () => {
  describe('flattenBookmarks', () => {
    it('should flatten a single bookmark', () => {
      const nodes = [{ id: '1', url: 'https://example.com' }];
      const result = flattenBookmarks(nodes);
      expect(result).toEqual([{ id: '1', url: 'https://example.com' }]);
    });

    it('should flatten nested bookmarks', () => {
      const nodes = [
        { id: '1', url: 'https://a.com' },
        { id: '2', children: [{ id: '3', url: 'https://b.com' }] }
      ];
      const result = flattenBookmarks(nodes);
      expect(result).toHaveLength(2);
      expect(result.map(b => b.id)).toEqual(['1', '3']);
    });

    it('should skip folders without url', () => {
      const nodes = [{ id: '1', title: 'Folder', children: [] }];
      const result = flattenBookmarks(nodes);
      expect(result).toHaveLength(0);
    });

    it('should handle deeply nested bookmarks', () => {
      const nodes = [
        {
          id: '1',
          children: [
            {
              id: '2',
              children: [{ id: '3', url: 'https://deep.com' }]
            }
          ]
        }
      ];
      const result = flattenBookmarks(nodes);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3');
    });

    it('should use provided list parameter', () => {
      const nodes = [{ id: '1', url: 'https://a.com' }];
      const existingList = [{ id: '0', url: 'https://existing.com' }];
      const result = flattenBookmarks(nodes, existingList);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('0');
    });
  });

  describe('buildNodeMap', () => {
    it('should build a map of a single node', () => {
      const node = { id: '10', title: 'Root' };
      const result = buildNodeMap(node);
      expect(result['10']).toBe(node);
    });

    it('should build a map of nested nodes', () => {
      const node = {
        id: '10',
        title: 'Root',
        children: [{ id: '20', title: 'Child' }]
      };
      const result = buildNodeMap(node);
      expect(result['10']).toBeDefined();
      expect(result['20']).toBeDefined();
    });

    it('should use provided map parameter', () => {
      const node = { id: '10', title: 'Root' };
      const existingMap = { '5': { id: '5' } };
      const result = buildNodeMap(node, existingMap);
      expect(result['5']).toBeDefined();
      expect(result['10']).toBeDefined();
    });
  });

  describe('buildReorganizedMap', () => {
    it('should build reorganized map with parent tracking', () => {
      const node = { id: '10', title: 'Root', children: [{ id: '20', title: 'Child' }] };
      const result = buildReorganizedMap(node);
      expect(result['10'].parentId).toBeNull();
      expect(result['20'].parentId).toBe('10');
    });

    it('should convert IDs to strings', () => {
      const node = { id: 10, title: 'Root', children: [] };
      const result = buildReorganizedMap(node);
      expect(result['10']).toBeDefined();
      expect(result['10'].id).toBe('10');
    });

    it('should track folder vs bookmark', () => {
      const node = {
        id: '10',
        title: 'Root',
        children: [
          { id: '20', title: 'Folder', children: [] },
          { id: '30', title: 'Bookmark', url: 'https://example.com' }
        ]
      };
      const result = buildReorganizedMap(node);
      expect(result['20'].isFolder).toBe(true);
      expect(result['30'].isFolder).toBe(false);
    });

    it('should set url to null for folders', () => {
      const node = { id: '10', title: 'Root', children: [] };
      const result = buildReorganizedMap(node);
      expect(result['10'].url).toBeNull();
    });

    it('should handle multiple levels of nesting', () => {
      const node = {
        id: '10',
        title: 'Root',
        children: [
          {
            id: '20',
            title: 'Level1',
            children: [{ id: '30', title: 'Level2', children: [] }]
          }
        ]
      };
      const result = buildReorganizedMap(node);
      expect(result['30'].parentId).toBe('20');
      expect(result['20'].parentId).toBe('10');
    });
  });

  describe('getPathFromMap', () => {
    it('should return root name when node is root', () => {
      const nodeMap = { '0': { id: '0', title: 'Root' } };
      const result = getPathFromMap('0', nodeMap);
      expect(result).toBe('Barre de favoris');
    });

    it('should build path for nested node', () => {
      const nodeMap = {
        '0': { id: '0', title: 'Root' },
        '10': { id: '10', title: 'Folder A', parentId: '0' },
        '11': { id: '11', title: 'Folder B', parentId: '10' }
      };
      const result = getPathFromMap('11', nodeMap);
      expect(result).toBe('Folder A > Folder B');
    });

    it('should handle nonexistent node', () => {
      const nodeMap = { '0': { id: '0', title: 'Root' } };
      const result = getPathFromMap('999', nodeMap);
      expect(result).toBe('Barre de favoris');
    });

    it('should skip chrome root IDs in path', () => {
      const nodeMap = {
        '0': { id: '0', title: 'Barre de favoris' },
        '10': { id: '10', title: 'Dev', parentId: '0' }
      };
      const result = getPathFromMap('10', nodeMap);
      expect(result).toBe('Dev');
    });
  });

  describe('alignReorganizedIds', () => {
    let originalMap;
    let originalFoldersByTitle;
    let originalBookmarksByTitle;

    beforeEach(() => {
      originalMap = {
        '0': { id: '0', title: 'Root', children: [] },
        '10': { id: '10', title: 'Folder A', parentId: '0', children: [] },
        '20': { id: '20', title: 'Bookmark X', parentId: '10', url: 'https://x.com' },
        '30': { id: '30', title: 'Folder B', parentId: '0', children: [
          { id: '40', title: 'Inner', parentId: '30', url: 'https://inner.com' }
        ]}
      };
      originalFoldersByTitle = {
        'folder a': [originalMap['10']],
        'folder b': [originalMap['30']]
      };
      originalBookmarksByTitle = {
        'bookmark x': [originalMap['20']],
        'inner': [originalMap['40']]
      };
    });

    it('should match by exact ID and title', () => {
      const node = { id: '10', title: 'Folder A', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id).toBe('10');
    });

    it('should match bookmark by exact ID and title', () => {
      const node = { id: '20', title: 'Bookmark X', url: 'https://x.com' };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id).toBe('20');
    });

    it('should handle falsy/empty original node title in exact match', () => {
      originalMap['10'].title = undefined;
      const node = { id: '10', title: '', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id).toBe('10');
    });

    it('should skip exact ID match if folder/bookmark status mismatch', () => {
      const node = { id: '20', title: 'Different Title', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id.startsWith('new_')).toBe(true);
    });

    it('should skip exact ID match if folder/bookmark status mismatch even when title matches but no candidates available in fallback', () => {
      const node = { id: '20', title: 'Bookmark X', children: [] };
      originalBookmarksByTitle['bookmark x'] = [];
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id.startsWith('new_')).toBe(true);
    });

    it('should match by title when ID has drifted', () => {
      const node = { id: 'new_123', title: 'Folder A', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id).toBe('10');
    });

    it('should generate new ID only if old ID is in originalMap but not matched', () => {
      originalMap['5'] = { id: '5', title: 'Old Folder', parentId: '0', children: [] };
      const node = { id: '5', title: 'Completely Different', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id.startsWith('new_')).toBe(true);
    });

    it('should not generate new ID for bookmark', () => {
      const node = { id: '999', title: 'Unknown Bookmark', url: 'https://unknown.com' };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id).toBe('999');
    });

    it('should align child nodes recursively', () => {
      const node = {
        id: '10',
        title: 'Folder A',
        children: [
          { id: 'new_child', title: 'Bookmark X', url: 'https://x.com' }
        ]
      };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle, '0');
      expect(node.children[0].id).toBe('20');
    });

    it('should use parentId for candidate selection', () => {
      originalFoldersByTitle['same name'] = [
        { id: '50', title: 'Same Name', parentId: '10' },
        { id: '60', title: 'Same Name', parentId: '30' }
      ];
      originalMap['50'] = originalFoldersByTitle['same name'][0];
      originalMap['60'] = originalFoldersByTitle['same name'][1];

      const node = { id: 'new_same', title: 'Same Name', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle, '10');
      expect(node.id).toBe('50');
    });

    it('should match cross-type if primary type candidates empty', () => {
      const node = { id: 'new_123', title: 'Bookmark X', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id).toBe('20');
    });

    it('should ensure folders have children array when matched', () => {
      const node = { id: 'new_folder', title: 'New Folder', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(Array.isArray(node.children)).toBe(true);
    });

    it('should handle titleKey as null or missing candidates array in _removeCandidate', () => {
      const node = { id: '10', title: 'Folder A', children: [] };
      alignReorganizedIds(node, originalMap, null, originalBookmarksByTitle);
      expect(node.id).toBe('10');
    });

    it('should handle candidate title array not being an array in _removeCandidate', () => {
      const node = { id: '10', title: 'Folder A', children: [] };
      const invalidFolders = { 'folder a': 'not-an-array' };
      alignReorganizedIds(node, originalMap, invalidFolders, originalBookmarksByTitle);
      expect(node.id).toBe('10');
    });

    it('should handle missing or empty node title in alignReorganizedIds', () => {
      const node = { id: 'new_folder', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id).toBeDefined();
    });

    it('should fall back to first candidate if parentId search fails in alignReorganizedIds', () => {
      originalFoldersByTitle['same name'] = [
        { id: '50', title: 'Same Name', parentId: '10' }
      ];
      originalMap['50'] = originalFoldersByTitle['same name'][0];
      const node = { id: 'new_same', title: 'Same Name', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle, '30');
      expect(node.id).toBe('50');
    });

    it('should initialize children array to empty if folder has no children in alignReorganizedIds', () => {
      const node = { id: '10', title: 'Folder A' };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.children).toEqual([]);
    });

    it('should NOT assign empty children array when matched node has a url (is a bookmark)', () => {
      // matchedNode.url is truthy → the branch `!matchedNode.url && !Array.isArray(node.children)` is false
      // So node.children should remain undefined
      const node = { id: '20', title: 'Bookmark X' }; // no children, no url — matches bookmark by ID+title
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      // The matched node has url → should not assign children
      expect(node.children).toBeUndefined();
    });
  });

  describe('sanitizeReorganizedTree', () => {
    let originalMap;

    beforeEach(() => {
      originalMap = {
        '0': { id: '0', title: 'Root', children: [
          { id: '10', title: 'Folder A', children: [] },
          { id: '20', title: 'Folder B', children: [] }
        ]},
        '10': { id: '10', title: 'Folder A', parentId: '0', children: [] },
        '20': { id: '20', title: 'Folder B', parentId: '0', children: [] }
      };
    });

    it('should merge new folders with existing same-name folders', () => {
      const node = {
        id: '0',
        title: 'Root',
        children: [
          { id: 'new_folderA', title: 'Folder A', children: [] }
        ]
      };
      const idMap = {};
      sanitizeReorganizedTree(node, originalMap, idMap);
      expect(node.children[0].id).toBe('10');
      expect(idMap['new_folderA']).toBe('10');
    });

    it('should remove auto-parented nodes and promote children', () => {
      const node = {
        id: '0',
        title: 'Root',
        children: [
          { id: '0', title: 'Self Parent', children: [
            { id: '100', title: 'Grandchild' }
          ]}
        ]
      };
      sanitizeReorganizedTree(node, originalMap);
      expect(node.children).toHaveLength(1);
      expect(node.children[0].id).toBe('100');
    });

    it('should recurse through all children', () => {
      const extendedMap = {
        ...originalMap,
        '10': { id: '10', title: 'Folder A', parentId: '0', children: [
          { id: '20', title: 'Folder B', parentId: '10', children: [] }
        ]}
      };
      const node = {
        id: '0',
        title: 'Root',
        children: [
          {
            id: '10',
            title: 'Folder A',
            children: [
              { id: 'new_folderB', title: 'Folder B', children: [] }
            ]
          }
        ]
      };
      const idMap = {};
      sanitizeReorganizedTree(node, extendedMap, idMap);
      expect(node.children[0].children[0].id).toBe('20');
      expect(idMap['new_folderB']).toBe('20');
    });

    it('should handle nodes without children', () => {
      const node = { id: '10', title: 'Folder A' };
      sanitizeReorganizedTree(node, originalMap);
      expect(node).toBeDefined();
    });

    it('should handle child with empty or missing title in sanitizeReorganizedTree', () => {
      const node = {
        id: '0',
        title: 'Root',
        children: [
          { id: 'new_no_title', children: [] }
        ]
      };
      sanitizeReorganizedTree(node, originalMap);
      expect(node.children).toHaveLength(1);
    });
  });

  describe('cleanTreeForLLM', () => {
    it('should keep URLs if present', () => {
      const node = {
        id: '1',
        title: 'Root',
        url: 'https://root.com'
      };
      const result = cleanTreeForLLM(node, new Set(), new Set());
      expect(result.url).toBe('https://root.com');
    });

    it('should keep id, title, and url; exclude metadata', () => {
      const node = {
        id: '1',
        title: 'Bookmark',
        url: 'https://example.com',
        metadata: 'extra'
      };
      const result = cleanTreeForLLM(node, new Set(), new Set());
      expect(result).toEqual({ id: '1', title: 'Bookmark', url: 'https://example.com' });
      expect(result.metadata).toBeUndefined();
    });

    it('should filter out duplicates', () => {
      const node = {
        id: '0',
        title: 'Root',
        children: [
          { id: '10', title: 'Keep', url: 'https://keep.com' },
          { id: '20', title: 'Remove', url: 'https://remove.com' }
        ]
      };
      const duplicatesSet = new Set(['20']);
      const result = cleanTreeForLLM(node, duplicatesSet, new Set());
      expect(result.children).toHaveLength(1);
      expect(result.children[0].id).toBe('10');
    });

    it('should filter out dead links', () => {
      const node = {
        id: '0',
        title: 'Root',
        children: [
          { id: '10', title: 'Good', url: 'https://good.com' },
          { id: '20', title: 'Dead', url: 'https://dead.com' }
        ]
      };
      const deadLinksSet = new Set(['20']);
      const result = cleanTreeForLLM(node, new Set(), deadLinksSet);
      expect(result.children).toHaveLength(1);
      expect(result.children[0].id).toBe('10');
    });

    it('should return null for duplicate root', () => {
      const node = { id: '10', title: 'Duplicate' };
      const duplicatesSet = new Set(['10']);
      const result = cleanTreeForLLM(node, duplicatesSet, new Set());
      expect(result).toBeNull();
    });

    it('should return null for dead link root', () => {
      const node = { id: '10', title: 'Dead' };
      const deadLinksSet = new Set(['10']);
      const result = cleanTreeForLLM(node, new Set(), deadLinksSet);
      expect(result).toBeNull();
    });

    it('should preserve nested structure', () => {
      const node = {
        id: '0',
        title: 'Root',
        children: [
          {
            id: '10',
            title: 'Folder',
            children: [
              { id: '20', title: 'Nested', url: 'https://nested.com' }
            ]
          }
        ]
      };
      const result = cleanTreeForLLM(node, new Set(), new Set());
      expect(result.children[0].children[0].id).toBe('20');
    });

    it('should remove nodes leaving empty arrays', () => {
      const node = {
        id: '0',
        title: 'Root',
        children: [
          { id: '10', title: 'Dead', url: 'https://dead.com' }
        ]
      };
      const deadLinksSet = new Set(['10']);
      const result = cleanTreeForLLM(node, new Set(), deadLinksSet);
      expect(result.children).toHaveLength(0);
    });

    it('should filter out only null results from children', () => {
      const node = {
        id: '0',
        title: 'Root',
        children: [
          { id: '10', title: 'Keep', url: 'https://keep.com' },
          { id: '20', title: 'Remove' },
          { id: '30', title: 'Keep2', url: 'https://keep2.com' }
        ]
      };
      const deadLinksSet = new Set(['20']);
      const result = cleanTreeForLLM(node, new Set(), deadLinksSet);
      expect(result.children).toHaveLength(2);
      expect(result.children.map(c => c.id)).toEqual(['10', '30']);
    });

    it('should NOT include url key on folder nodes (if(node.url) guard)', () => {
      const node = { id: '10', title: 'Folder', children: [] };
      const result = cleanTreeForLLM(node, new Set(), new Set());
      // Using toStrictEqual to catch url: undefined being incorrectly added
      expect(result).toStrictEqual({ id: '10', title: 'Folder', children: [] });
    });
  });

  describe('alignReorganizedIds – additional mutation kills', () => {
    let originalMap;
    let originalFoldersByTitle;
    let originalBookmarksByTitle;

    beforeEach(() => {
      originalMap = {
        '10': { id: '10', title: 'Folder A', parentId: '0', children: [] },
        '20': { id: '20', title: 'Bookmark X', parentId: '10', url: 'https://x.com' },
      };
      originalFoldersByTitle = { 'folder a': [originalMap['10']] };
      originalBookmarksByTitle = { 'bookmark x': [originalMap['20']] };
    });

    it('should trim whitespace from node title when building titleKey (line 65)', () => {
      // ' Folder A ' should normalize to 'folder a' and match original '10'
      const node = { id: 'new_x', title: '  Folder A  ', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id).toBe('10');
    });

    it('should trim whitespace from byId.title when comparing for exact match (line 70)', () => {
      // Original node has padded title; incoming node has clean title
      originalMap['10'].title = '  Folder A  ';
      const node = { id: '10', title: 'Folder A', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id).toBe('10'); // exact match still works after trim
    });

    it('should select the candidate matching the given parentId (not always first candidate)', () => {
      // Two folders with same name under different parents — must pick the one with parentId='30'
      const cand1 = { id: '50', title: 'Twin', parentId: '10' };
      const cand2 = { id: '60', title: 'Twin', parentId: '30' };
      originalMap['30'] = { id: '30', title: 'Parent30', parentId: '0', children: [] }; // must be in map
      originalMap['50'] = cand1;
      originalMap['60'] = cand2;
      originalFoldersByTitle['twin'] = [cand1, cand2];

      const node = { id: 'new_twin', title: 'Twin', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle, '30');
      expect(node.id).toBe('60');
    });

    it('should fall back to first candidate when no candidate matches parentId', () => {
      const cand1 = { id: '50', title: 'Solo', parentId: '10' };
      originalMap['50'] = cand1;
      originalFoldersByTitle['solo'] = [cand1];

      // parentId '99' is not in originalMap → falls back to candidates[0]
      const node = { id: 'new_s', title: 'Solo', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle, '99');
      expect(node.id).toBe('50');
    });

    it('should dequeue matched candidate so second match of same title gets different node', () => {
      const cand1 = { id: '50', title: 'Dup', parentId: '0', children: [] };
      const cand2 = { id: '60', title: 'Dup', parentId: '0', children: [] };
      originalMap['50'] = cand1;
      originalMap['60'] = cand2;
      // Two candidates with same name
      originalFoldersByTitle['dup'] = [cand1, cand2];

      const nodeA = { id: 'new_a', title: 'Dup', children: [] };
      const nodeB = { id: 'new_b', title: 'Dup', children: [] };
      const root = { id: '0', title: 'Root', children: [nodeA, nodeB] };
      alignReorganizedIds(root, originalMap, originalFoldersByTitle, originalBookmarksByTitle);

      // cand1 removed after first match; second match must use cand2 (not cand1 again)
      expect(nodeA.id).toBe('50');
      expect(nodeB.id).toBe('60');
    });

    it('should treat node as isNew when id starts with new_ even if in map via || check', () => {
      // startsWith('new_') || !originalMap[id]: if only && is used, this would fail for new_+in-map
      const node = { id: 'new_50', title: 'Unknown', children: [] };
      // Put 'new_50' in originalMap (shouldn't matter — startsWith is enough)
      originalMap['new_50'] = { id: 'new_50', title: 'Other', parentId: '0', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      // node.id must NOT be replaced (it already starts with new_, so isNew=true → no new id generated)
      // The id either stays 'new_50' or gets matched by title — since title 'Unknown' has no match,
      // it keeps 'new_50' (isNew is true so the else branch doesn't fire)
      expect(node.id).not.toMatch(/^new_[a-f0-9]{9}$/); // should NOT generate a second new id
    });

    it('should use || for isNew check: node with id not in originalMap is isNew', () => {
      // !originalMap[node.id] = true → isNew=true → no new id generated (it's already "new")
      const node = { id: 'nonexistent_id', title: 'Unknown Folder', children: [] };
      // id not in originalMap → isNew = startsWith('new_') || !originalMap[...] = false || true = true
      // → don't generate new id (keep existing)
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      expect(node.id).toBe('nonexistent_id');
    });

    it('should generate UUID-based id with exactly 9 alphanumeric chars after new_ prefix', () => {
      originalMap['5'] = { id: '5', title: 'Old', parentId: '0', children: [] };
      const node = { id: '5', title: 'Completely Different Title', children: [] };
      alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
      // isNew=false (id in map, not starts with new_), isFolder=true → generates new_XXXXXXXXX
      expect(node.id).toMatch(/^new_[a-z0-9]{9}$/);
    });
  });

  describe('sanitizeReorganizedTree – additional mutation kills', () => {
    it('should trim whitespace from child.title when building origFoldersByName (line 128)', () => {
      // Original root has child with padded title; reorganized tree uses clean title for lookup
      const originalMap = {
        '0': { id: '0', title: 'Root', children: [
          { id: '10', title: '  Folder A  ', parentId: '0', children: [] }  // padded title
        ]},
        '10': { id: '10', title: '  Folder A  ', parentId: '0', children: [] }
      };
      const node = {
        id: '0', title: 'Root',
        children: [{ id: 'new_fa', title: 'Folder A', children: [] }]
      };
      const idMap = {};
      sanitizeReorganizedTree(node, originalMap, idMap);
      // Should merge 'Folder A' (clean) with '  Folder A  ' (padded) via trim
      expect(node.children[0].id).toBe('10');
    });

    it('should trim whitespace from child.title in reorganized tree for lookup (line 134)', () => {
      // Reorganized tree has padded child title; should still match original folder
      const originalMap = {
        '0': { id: '0', title: 'Root', children: [
          { id: '10', title: 'Folder B', parentId: '0', children: [] }
        ]},
        '10': { id: '10', title: 'Folder B', parentId: '0', children: [] }
      };
      const node = {
        id: '0', title: 'Root',
        children: [{ id: 'new_fb', title: '  Folder B  ', children: [] }]  // padded
      };
      const idMap = {};
      sanitizeReorganizedTree(node, originalMap, idMap);
      expect(node.children[0].id).toBe('10');
    });

    it('should cover _removeCandidate FALSE branch (idx === -1: node not in array)', () => {
      // When folder is matched by ID+title, the second _removeCandidate call uses the opposite type map.
      // If that map has entries for the same titleKey but NOT containing this node → idx = -1 → no-op branch.
      const folderNode = { id: '10', title: 'Folder A', parentId: '0', children: [] };
      const bookmarkNode = { id: '99', title: 'Folder A', parentId: '0', url: 'https://x.com' }; // same title, different node
      const map = {
        '10': folderNode,
        '99': bookmarkNode,
      };
      const foldersByTitle = { 'folder a': [folderNode] };
      // bookmarksByTitle has 'folder a' with a DIFFERENT node → indexOf(folderNode) = -1
      const bookmarksByTitle = { 'folder a': [bookmarkNode] };

      const node = { id: '10', title: 'Folder A', children: [] };
      alignReorganizedIds(node, map, foldersByTitle, bookmarksByTitle);
      expect(node.id).toBe('10'); // matched correctly; FALSE branch of idx !== -1 was exercised
    });

    it('should cover !child.url FALSE branch (bookmark child in origNode.children)', () => {
      // origNode.children contains a bookmark (has url) → `if (!child.url)` is FALSE → not added to origFoldersByName
      const originalMap = {
        '0': { id: '0', title: 'Root', children: [
          { id: '10', title: 'Folder C', parentId: '0', children: [] },
          { id: '11', title: 'A bookmark', parentId: '0', url: 'https://bm.com' } // bookmark child
        ]},
        '10': { id: '10', title: 'Folder C', parentId: '0', children: [] },
      };
      const node = {
        id: '0', title: 'Root',
        children: [{ id: 'new_fc', title: 'Folder C', children: [] }]
      };
      const idMap = {};
      sanitizeReorganizedTree(node, originalMap, idMap);
      // Folder C must still be merged (the bookmark didn't interfere)
      expect(node.children[0].id).toBe('10');
    });

    it('should cover if(child.children) FALSE branch (self-parented child with no children array)', () => {
      // A self-parented node (child.id === origId) but with NO children array → false branch
      const originalMap = {
        '0': { id: '0', title: 'Root', children: [] },
      };
      const node = {
        id: '0', title: 'Root',
        children: [
          { id: '0', title: 'Self-parent' } // no children array, same id as parent → auto-parented
        ]
      };
      sanitizeReorganizedTree(node, originalMap);
      // Self-parented child with no children array → nothing promoted → result is empty
      expect(node.children).toHaveLength(0);
    });

    it('should NOT merge old (in-map) folder even if same name exists (isNew=false guard)', () => {
      // child.id is in originalMap → isNew=false → should NOT be merged into existing same-name folder
      const originalMap = {
        '0': { id: '0', title: 'Root', children: [
          { id: '10', title: 'Folder C', parentId: '0', children: [] }
        ]},
        '10': { id: '10', title: 'Folder C', parentId: '0', children: [] },
        '99': { id: '99', title: 'Folder C', parentId: '0', children: [] } // old ID, same name
      };
      const node = {
        id: '0', title: 'Root',
        children: [{ id: '99', title: 'Folder C', children: [] }] // old ID (in map) → isNew=false
      };
      const idMap = {};
      sanitizeReorganizedTree(node, originalMap, idMap);
      // Should keep id '99' (not merge into '10') because isNew=false
      expect(node.children[0].id).toBe('99');
    });
  });
});

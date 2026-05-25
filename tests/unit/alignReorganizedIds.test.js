import { describe, it, expect, beforeEach } from 'vitest';
import { alignReorganizedIds } from '../../src/background/diff.js';

describe('alignReorganizedIds', () => {
  let originalMap;
  let originalFoldersByTitle;
  let originalBookmarksByTitle;

  beforeEach(() => {
    originalMap = {
      '0': { id: '0', title: 'Root', children: [] },
      '1': { id: '1', title: 'Folder A', parentId: '0', children: [] },
      '2': { id: '2', title: 'Bookmark X', parentId: '1', url: 'https://x.com' }
    };
    originalFoldersByTitle = {
      'folder a': [originalMap['1']]
    };
    originalBookmarksByTitle = {
      'bookmark x': [originalMap['2']]
    };
  });

  it('should align by exact ID and title match', () => {
    const node = { id: '1', title: 'Folder A', children: [] };
    alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
    expect(node.id).toBe('1');
  });

  it('should match and align by exact title when ID has drifted', () => {
    const node = { id: 'new_123', title: 'Folder A', children: [] };
    alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
    expect(node.id).toBe('1');
  });

  it('should fallback to cross-type matching if primary type candidates do not exist', () => {
    // If a folder has the same name as a bookmark, or vice versa, but primary candidate is empty
    const node = { id: 'new_folder_x', title: 'Bookmark X', children: [] };
    alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
    expect(node.id).toBe('2');
  });

  it('should generate a new randomUUID folder id if node is a folder but ID is not new and has no matched node', () => {
    const node = { id: '2', title: 'Completely New Folder', children: [] };
    alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle);
    expect(node.id).toBeTypeOf('string');
    expect(node.id.startsWith('new_')).toBe(true);
  });
});

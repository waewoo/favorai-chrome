import { describe, it, expect } from 'vitest';
import { sanitizeReorganizedTree } from '../../src/background/diff.js';

describe('sanitizeReorganizedTree', () => {
  it('should remove self-parent cyclic references by promoting grand-children', () => {
    const originalMap = {
      '1': { id: '1', title: 'Folder A', children: [] }
    };
    const tree = {
      id: '1',
      title: 'Folder A',
      children: [
        {
          id: '1', // Cycle: child has same ID as parent
          title: 'Folder A',
          children: [
            { id: '2', title: 'Bookmark inside', url: 'https://inner.com' }
          ]
        }
      ]
    };

    sanitizeReorganizedTree(tree, originalMap);
    // Cycle child '1' should be removed, and its grand-children promoted
    expect(tree.children.length).toBe(1);
    expect(tree.children[0].id).toBe('2');
  });

  it('should merge new folders with existing ones of the same name under the same parent', () => {
    const originalMap = {
      'parent-id': {
        id: 'parent-id',
        title: 'Parent Folder',
        children: [
          { id: 'existing-folder-id', title: 'Same Name Folder', children: [] }
        ]
      },
      'existing-folder-id': { id: 'existing-folder-id', title: 'Same Name Folder', parentId: 'parent-id', children: [] }
    };

    const tree = {
      id: 'parent-id',
      title: 'Parent Folder',
      children: [
        {
          id: 'new_folder_temp', // isNew folder
          title: 'Same Name Folder',
          children: [
            { id: 'bookmark-id', title: 'Bookmark', url: 'https://example.com' }
          ]
        }
      ]
    };

    const idMap = {};
    sanitizeReorganizedTree(tree, originalMap, idMap);

    // The temporary folder id should be mapped to the existing folder id
    expect(idMap['new_folder_temp']).toBe('existing-folder-id');
    expect(tree.children[0].id).toBe('existing-folder-id');
  });
});

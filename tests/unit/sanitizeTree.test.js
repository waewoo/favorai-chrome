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
});

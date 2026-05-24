import { describe, it, expect } from 'vitest';
import { buildNodeMap } from '../../src/background/diff.js';

describe('buildNodeMap', () => {
  it('should map all node IDs in a tree to their node objects', () => {
    const root = {
      id: '0',
      title: 'Root',
      children: [
        { id: '1', title: 'Folder 1', children: [] },
        { id: '2', title: 'Bookmark 1', url: 'https://example1.com' }
      ]
    };

    const map = buildNodeMap(root);
    expect(map['0']).toBe(root);
    expect(map['1']).toBe(root.children[0]);
    expect(map['2']).toBe(root.children[1]);
  });
});

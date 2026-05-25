import { describe, it, expect } from 'vitest';
import { buildReorganizedMap } from '../../src/background/diff.js';

describe('buildReorganizedMap', () => {
  it('should build a flat reorganized map of node structure', () => {
    const root = {
      id: '0',
      title: 'Root',
      children: [
        {
          id: '1',
          title: 'Folder 1',
          children: [
            { id: '2', title: 'Bookmark 2', url: 'https://b2.com' }
          ]
        }
      ]
    };

    const map = {};
    buildReorganizedMap(root, map);

    expect(map['0']).toEqual({
      id: '0',
      title: 'Root',
      url: null,
      parentId: null,
      isFolder: true
    });

    expect(map['1']).toEqual({
      id: '1',
      title: 'Folder 1',
      url: null,
      parentId: '0',
      isFolder: true
    });

    expect(map['2']).toEqual({
      id: '2',
      title: 'Bookmark 2',
      url: 'https://b2.com',
      parentId: '1',
      isFolder: false
    });
  });
});

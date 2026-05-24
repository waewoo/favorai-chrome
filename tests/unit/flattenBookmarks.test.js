import { describe, it, expect } from 'vitest';
import { flattenBookmarks } from '../../src/background/diff.js';

describe('flattenBookmarks', () => {
  it('should flatten a tree of bookmarks into a list of leaves', () => {
    const tree = [
      {
        id: '1',
        title: 'Folder 1',
        children: [
          { id: '2', title: 'Bookmark 1', url: 'https://example1.com' },
          {
            id: '3',
            title: 'Folder 2',
            children: [
              { id: '4', title: 'Bookmark 2', url: 'https://example2.com' }
            ]
          }
        ]
      },
      { id: '5', title: 'Bookmark 3', url: 'https://example3.com' }
    ];

    const result = flattenBookmarks(tree);
    expect(result.length).toBe(3);
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('4');
    expect(result[2].id).toBe('5');
  });

  it('should return an empty array if there are no bookmarks', () => {
    const tree = [
      {
        id: '1',
        title: 'Folder 1',
        children: []
      }
    ];
    expect(flattenBookmarks(tree)).toEqual([]);
  });
});

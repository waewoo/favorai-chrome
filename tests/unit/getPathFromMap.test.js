import { describe, it, expect } from 'vitest';
import { getPathFromMap } from '../../src/background/diff.js';

describe('getPathFromMap', () => {
  it('should construct the full path string from a node map', () => {
    const nodeMap = {
      '0': { id: '0', title: 'Root', parentId: null },
      '1': { id: '1', title: 'Folder A', parentId: '0' },
      '2': { id: '2', title: 'Folder B', parentId: '1' }
    };

    expect(getPathFromMap('2', nodeMap)).toBe('Folder A > Folder B');
    expect(getPathFromMap('1', nodeMap)).toBe('Folder A');
    expect(getPathFromMap('0', nodeMap)).toBe('Barre de favoris');
  });
});

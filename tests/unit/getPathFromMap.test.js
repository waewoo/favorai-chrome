import { describe, it, expect } from 'vitest';
import { getPathFromMap } from '../../src/background/diff.js';

describe('getPathFromMap', () => {
  it('should construct the full path string from a node map', () => {
    const nodeMap = {
      '0': { id: '0', title: 'Root', parentId: null },
      '1': { id: '1', title: 'Barre de favoris', parentId: '0' },
      '10': { id: '10', title: 'Folder A', parentId: '1' },
      '20': { id: '20', title: 'Folder B', parentId: '10' }
    };

    expect(getPathFromMap('20', nodeMap)).toBe('Folder A > Folder B');
    expect(getPathFromMap('10', nodeMap)).toBe('Folder A');
    expect(getPathFromMap('1', nodeMap)).toBe('Barre de favoris');
  });
});

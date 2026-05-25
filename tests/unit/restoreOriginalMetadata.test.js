import { describe, it, expect } from 'vitest';
import { restoreOriginalMetadata } from '../../src/background/analysis.js';

describe('restoreOriginalMetadata', () => {
  it('should restore bookmark titles and URLs from originalMap', () => {
    const originalMap = {
      '1': { id: '1', title: 'Folder 1' },
      '10': { id: '10', title: 'Google', url: 'https://google.com', parentId: '1' },
      '20': { id: '20', title: 'GitHub', url: 'https://github.com', parentId: '1' }
    };

    const reorganizedTree = {
      id: '1',
      title: 'Folder 1',
      children: [
        { id: '10' }, // Missing title & url
        { id: '20', title: 'GitHub' } // Missing url, title already present
      ]
    };

    restoreOriginalMetadata(reorganizedTree, originalMap);

    expect(reorganizedTree.children[0]).toEqual({
      id: '10',
      title: 'Google',
      url: 'https://google.com'
    });

    expect(reorganizedTree.children[1]).toEqual({
      id: '20',
      title: 'GitHub',
      url: 'https://github.com'
    });
  });

  it('should not overwrite modified titles (e.g. renamed folders)', () => {
    const originalMap = {
      '1': { id: '1', title: 'Old Folder Name' },
      '10': { id: '10', title: 'Google', url: 'https://google.com', parentId: '1' }
    };

    const reorganizedTree = {
      id: '1',
      title: 'New Folder Name', // Title has been changed by LLM
      children: [
        { id: '10' }
      ]
    };

    restoreOriginalMetadata(reorganizedTree, originalMap);

    expect(reorganizedTree.title).toBe('New Folder Name'); // Preserved renamed folder title
    expect(reorganizedTree.children[0].title).toBe('Google'); // Restored bookmark title
  });
});

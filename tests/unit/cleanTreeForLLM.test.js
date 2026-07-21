import { describe, it, expect } from 'vitest';
import { cleanTreeForLLM } from '../../src/background/diff.js';

describe('cleanTreeForLLM', () => {
  it('should clean the tree, preserving titles and URLs, and filtering out duplicates and dead links', () => {
    const rootNode = {
      id: '1',
      title: 'Barre de favoris',
      children: [
        { id: '10', title: 'Google', url: 'https://google.com' },
        { id: '20', title: 'Duplicate Google', url: 'https://google.com' },
        { id: '30', title: 'Dead Link', url: 'https://deadlink.com' },
        {
          id: '40',
          title: 'Folder',
          children: [
            { id: '50', title: 'GitHub', url: 'https://github.com' }
          ]
        }
      ]
    };

    const duplicates = new Set(['20']);
    const deadLinks = new Set(['30']);

    const cleaned = cleanTreeForLLM(rootNode, duplicates, deadLinks);

    expect(cleaned).toEqual({
      id: '1',
      title: 'Barre de favoris',
      children: [
        { id: '10', title: 'Google', url: 'https://google.com' },
        {
          id: '40',
          title: 'Folder',
          children: [
            { id: '50', title: 'GitHub', url: 'https://github.com' }
          ]
        }
      ]
    });
  });

  it('removes the protected managed folder from the LLM tree', () => {
    const rootNode = {
      id: '1',
      title: 'Bookmarks Bar',
      children: [
        {
          id: 'managed',
          title: '⭐ Les plus consultés',
          children: [{ id: 'copy', title: 'Copy', url: 'https://copy.example' }]
        },
        { id: 'keep', title: 'Keep', url: 'https://keep.example' }
      ]
    };

    const cleaned = cleanTreeForLLM(rootNode, new Set(), new Set(), 'managed');

    expect(cleaned.children).toEqual([
      { id: 'keep', title: 'Keep', url: 'https://keep.example' }
    ]);
  });
});

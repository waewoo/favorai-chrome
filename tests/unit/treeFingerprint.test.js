import { describe, expect, it } from 'vitest';
import { buildBookmarkTreeFingerprint } from '../../src/background/tree-fingerprint.js';

describe('buildBookmarkTreeFingerprint', () => {
  it('returns the same fingerprint for identical trees', () => {
    const tree = {
      id: '0',
      title: 'Root',
      children: [
        { id: '1', title: 'Bar', children: [{ id: '10', title: 'A', url: 'https://a.com', parentId: '1' }] }
      ]
    };

    expect(buildBookmarkTreeFingerprint(tree)).toBe(buildBookmarkTreeFingerprint(structuredClone(tree)));
  });

  it('changes when bookmark structure changes', () => {
    const before = {
      id: '0',
      title: 'Root',
      children: [{ id: '1', title: 'Bar', children: [{ id: '10', title: 'A', url: 'https://a.com' }] }]
    };
    const after = {
      id: '0',
      title: 'Root',
      children: [{ id: '1', title: 'Bar', children: [{ id: '10', title: 'A2', url: 'https://a.com' }] }]
    };

    expect(buildBookmarkTreeFingerprint(before)).not.toBe(buildBookmarkTreeFingerprint(after));
  });

  it('handles null and sparse nodes deterministically', () => {
    expect(buildBookmarkTreeFingerprint(null)).toBe(buildBookmarkTreeFingerprint(null));
    expect(buildBookmarkTreeFingerprint({})).toBe(buildBookmarkTreeFingerprint({
      id: '',
      parentId: '',
      title: '',
      url: ''
    }));
  });
});

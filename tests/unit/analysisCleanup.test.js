import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildArticleFingerprint,
  normalizeUrlForDuplicate,
  performLocalCleanup
} from '../../src/background/analysis.js';
import { buildNodeMap } from '../../src/background/diff.js';

function status() {
  return { percentage: 0, logs: [] };
}

function htmlResponse(url, html, contentType = 'text/html; charset=utf-8') {
  return {
    status: 200,
    url,
    headers: { get: vi.fn(() => contentType) },
    text: vi.fn().mockResolvedValue(html)
  };
}

function articleHtml(title) {
  const body = Array.from({ length: 90 }, (_, i) => `shared paragraph content token ${i}`).join(' ');
  return `<html><head><title>${title}</title></head><body><article><h1>${title}</h1><p>${body}</p></article></body></html>`;
}

function syndicatedArticleHtml(title, wrapperText) {
  const body = Array.from({ length: 95 }, (_, i) => `research ethics participant consent laboratory finding paragraph ${i}`).join(' ');
  return `
    <html>
      <head><title>${title}</title></head>
      <body>
        <nav>${wrapperText}</nav>
        <main>
          <p>${body}</p>
          <p>This article is republished under a Creative Commons license.</p>
        </main>
        <footer>${wrapperText}</footer>
      </body>
    </html>
  `;
}

describe('smart duplicate cleanup', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('normalizes protocol, www, fragments, trailing slash, and tracking params', () => {
    expect(normalizeUrlForDuplicate('http://www.Example.com/path/?utm_source=news#section'))
      .toBe('example.com/path');
    expect(normalizeUrlForDuplicate('https://example.com/path')).toBe('example.com/path');
  });

  it('detects duplicates by canonical URL without network checks', async () => {
    const root = {
      id: '0',
      title: 'Root',
      children: [
        { id: '1', title: 'Example', parentId: '0', url: 'http://www.example.com/article/?utm_source=rss#intro' },
        { id: '2', title: 'Example article with clearer title', parentId: '0', url: 'https://example.com/article' }
      ]
    };

    const result = await performLocalCleanup(root, buildNodeMap(root), false, 2, null, status());

    expect(result.deadLinks).toEqual([]);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].duplicate.id).toBe('1');
    expect(result.duplicates[0].original.id).toBe('2');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('detects duplicates when different URLs redirect to the same final URL', async () => {
    const root = {
      id: '0',
      title: 'Root',
      children: [
        { id: '1', title: 'Short link', parentId: '0', url: 'https://short.example/a' },
        { id: '2', title: 'Canonical article', parentId: '0', url: 'https://example.com/article' }
      ]
    };
    const html = articleHtml('Canonical article');
    global.fetch
      .mockResolvedValueOnce(htmlResponse('https://short.example/a', '', 'text/plain'))
      .mockResolvedValueOnce(htmlResponse('https://example.com/article', '', 'text/plain'))
      .mockResolvedValueOnce(htmlResponse('https://example.com/article', html))
      .mockResolvedValueOnce(htmlResponse('https://example.com/article', html));

    const result = await performLocalCleanup(root, buildNodeMap(root), true, 2, null, status());

    expect(result.deadLinks).toEqual([]);
    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].duplicate.id).toBe('1');
    expect(result.duplicates[0].original.id).toBe('2');
  });

  it('detects same article content on different domains', async () => {
    const root = {
      id: '0',
      title: 'Root',
      children: [
        { id: '1', title: 'Syndicated Story', parentId: '0', url: 'https://site-a.example/story' },
        { id: '2', title: 'Syndicated Story', parentId: '0', url: 'https://site-b.example/story-copy' }
      ]
    };
    const html = articleHtml('Syndicated Story');
    global.fetch
      .mockResolvedValueOnce(htmlResponse('https://site-a.example/story', '', 'text/plain'))
      .mockResolvedValueOnce(htmlResponse('https://site-b.example/story-copy', '', 'text/plain'))
      .mockResolvedValueOnce(htmlResponse('https://site-a.example/story', html))
      .mockResolvedValueOnce(htmlResponse('https://site-b.example/story-copy', html));

    const result = await performLocalCleanup(root, buildNodeMap(root), true, 2, null, status());

    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].duplicate.id).toBe('2');
    expect(result.duplicates[0].original.id).toBe('1');
  });

  it('detects syndicated articles with different site chrome around the same body', async () => {
    const root = {
      id: '0',
      title: 'Root',
      children: [
        { id: '1', title: 'Is it ever OK for scientists to experiment on themselves?', parentId: '0', url: 'https://theconversation.example/article' },
        { id: '2', title: 'Is it ever OK for scientists to experiment on themselves?', parentId: '0', url: 'https://practicalethics.example/article' }
      ]
    };
    global.fetch
      .mockResolvedValueOnce(htmlResponse('https://theconversation.example/article', '', 'text/plain'))
      .mockResolvedValueOnce(htmlResponse('https://practicalethics.example/article', '', 'text/plain'))
      .mockResolvedValueOnce(htmlResponse(
        'https://theconversation.example/article',
        syndicatedArticleHtml('Is it ever OK for scientists to experiment on themselves? - The Conversation', 'newsletter subscribe latest news')
      ))
      .mockResolvedValueOnce(htmlResponse(
        'https://practicalethics.example/article',
        syndicatedArticleHtml('Is it ever OK for scientists to experiment on themselves? - Practical Ethics', 'oxford blog comments related posts')
      ));

    const result = await performLocalCleanup(root, buildNodeMap(root), true, 2, null, status());

    expect(result.duplicates).toHaveLength(1);
    expect(result.duplicates[0].duplicate.id).toBe('2');
    expect(result.duplicates[0].original.id).toBe('1');
  });

  it('does not build an article fingerprint for very short pages', () => {
    expect(buildArticleFingerprint('Tiny', '<html><head><title>Tiny</title></head><body>Too short</body></html>'))
      .toBeNull();
  });
});

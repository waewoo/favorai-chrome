/**
 * Builds a small deterministic fingerprint for a bookmark subtree.
 * It is used to detect if the user changed bookmarks between analysis and apply.
 */
export function buildBookmarkTreeFingerprint(rootNode) {
  const serialized = serializeBookmarkNode(rootNode);
  return `fnv1a:${fnv1a(serialized)}`;
}

function serializeBookmarkNode(node) {
  if (!node) return 'null';

  const parts = [
    String(node.id || ''),
    String(node.parentId || ''),
    String(node.title || ''),
    String(node.url || '')
  ];

  if (Array.isArray(node.children)) {
    parts.push('[');
    for (const child of node.children) {
      parts.push(serializeBookmarkNode(child));
    }
    parts.push(']');
  }

  return parts.join('\u001f');
}

function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

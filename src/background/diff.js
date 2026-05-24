import { NEW_FOLDER_PREFIX, CHROME_ROOT_IDS } from '../utils/constants.js';

/**
 * Aplatit récursivement l'arbre en liste de favoris (feuilles).
 */
export function flattenBookmarks(nodes, list = []) {
  for (const node of nodes) {
    if (node.url) list.push(node);
    if (node.children) flattenBookmarks(node.children, list);
  }
  return list;
}

/**
 * Construit une map ID→Nœud de l'arbre original.
 */
export function buildNodeMap(node, map = {}) {
  map[node.id] = node;
  if (node.children) {
    for (const child of node.children) buildNodeMap(child, map);
  }
  return map;
}

/**
 * Construit une map plate de l'arbre réorganisé par l'IA.
 */
export function buildReorganizedMap(node, map = {}, parentId = null) {
  const id = String(node.id);
  const pid = parentId ? String(parentId) : null;
  map[id] = { id, title: node.title, url: node.url || null, parentId: pid, isFolder: Array.isArray(node.children) };
  if (node.children) {
    for (const child of node.children) buildReorganizedMap(child, map, id);
  }
  return map;
}

/**
 * Reconstruit le chemin complet depuis la map (ex: "Barre de favoris > Dev > JS").
 */
export function getPathFromMap(nodeId, nodeMap) {
  const parts = [];
  let currentId = nodeId;
  while (currentId && nodeMap[currentId]) {
    const node = nodeMap[currentId];
    if (!CHROME_ROOT_IDS.has(currentId)) parts.unshift(node.title);
    currentId = node.parentId;
  }
  return parts.join(' > ') || 'Barre de favoris';
}

/**
 * Aligne les IDs réorganisés de l'IA sur les IDs réels de Chrome.
 * Corrige les décalages de listes pour éviter des renommages aberrants.
 */
export function alignReorganizedIds(node, originalMap, originalFoldersByTitle, originalBookmarksByTitle, parentId = null) {
  const isFolder = Array.isArray(node.children);
  const titleKey = (node.title || '').trim().toLowerCase();
  let matchedNode = null;

  // 1. Match parfait par ID + titre
  const byId = originalMap[node.id];
  if (byId && (byId.title || '').trim().toLowerCase() === titleKey && (!byId.url === isFolder)) {
    matchedNode = byId;
    _removeCandidate(isFolder ? originalFoldersByTitle : originalBookmarksByTitle, titleKey, matchedNode);
    _removeCandidate(isFolder ? originalBookmarksByTitle : originalFoldersByTitle, titleKey, matchedNode);
  }

  // 2. Match par titre exact
  if (!matchedNode) {
    let candidates = isFolder ? originalFoldersByTitle[titleKey] : originalBookmarksByTitle[titleKey];
    if (!candidates?.length) {
      candidates = isFolder ? originalBookmarksByTitle[titleKey] : originalFoldersByTitle[titleKey];
    }
    if (candidates?.length) {
      matchedNode = (parentId && originalMap[parentId])
        ? (candidates.find(c => c.parentId === parentId) || candidates[0])
        : candidates[0];
      _removeCandidate(candidates, null, matchedNode);
    }
  }

  // 3. Réaligner l'ID
  if (matchedNode) {
    node.id = matchedNode.id;
    if (!matchedNode.url && !Array.isArray(node.children)) node.children = [];
  } else {
    const isNew = String(node.id).startsWith(NEW_FOLDER_PREFIX) || !originalMap[node.id];
    if (!isNew && isFolder) {
      node.id = `${NEW_FOLDER_PREFIX}${crypto.randomUUID().replace(/-/g, '').slice(0, 9)}`;
    }
  }

  if (node.children) {
    for (const child of node.children) {
      alignReorganizedIds(child, originalMap, originalFoldersByTitle, originalBookmarksByTitle, node.id);
    }
  }
}

function _removeCandidate(candidates, titleKey, node) {
  if (!candidates) return;
  const arr = titleKey ? candidates[titleKey] : candidates;
  if (!Array.isArray(arr)) return;
  const idx = arr.indexOf(node);
  if (idx !== -1) arr.splice(idx, 1);
}

/**
 * Assainit l'arbre réorganisé : fusionne les nouveaux dossiers avec les existants de même nom,
 * résout les auto-parentés cycliques.
 */
export function sanitizeReorganizedTree(node, originalMap, idMap = {}) {
  if (!node.children) return;

  const origId = idMap[node.id] || node.id;
  const origNode = originalMap[origId];
  const origFoldersByName = {};
  if (origNode?.children) {
    for (const child of origNode.children) {
      if (!child.url) origFoldersByName[child.title.toLowerCase().trim()] = child;
    }
  }

  const cleaned = [];
  for (const child of node.children) {
    const tl = (child.title || '').toLowerCase().trim();
    const isNew = String(child.id).startsWith(NEW_FOLDER_PREFIX) || !originalMap[child.id];

    if (isNew && !child.url && origFoldersByName[tl]) {
      const existing = origFoldersByName[tl];
      idMap[child.id] = existing.id;
      child.id = existing.id;
    }

    if (child.id === origId) {
      // Auto-parenté : remonter les petits-enfants
      if (child.children) cleaned.push(...child.children);
    } else {
      cleaned.push(child);
    }
  }
  node.children = cleaned;

  for (const child of node.children) sanitizeReorganizedTree(child, originalMap, idMap);
}

/**
 * Nettoie l'arbre pour l'envoyer au LLM :
 * - Retire les URLs (vie privée — le LLM n'en a pas besoin pour réorganiser)
 * - Retire les doublons et liens morts déjà traités
 */
export function cleanTreeForLLM(node, duplicatesSet, deadLinksSet) {
  if (duplicatesSet.has(node.id) || deadLinksSet.has(node.id)) return null;

  const clean = { id: node.id, title: node.title };
  if (node.url) clean.url = node.url;

  if (node.children) {
    clean.children = node.children
      .map(c => cleanTreeForLLM(c, duplicatesSet, deadLinksSet))
      .filter(Boolean);
  }
  return clean;
}
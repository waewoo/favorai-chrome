import { URL_CHECK_TIMEOUT_MS, RESTRICTED_DOMAINS, CHROME_ROOT_IDS, NEW_FOLDER_PREFIX } from '../utils/constants.js';
import { queryLLM } from '../llm/index.js';
import {
  flattenBookmarks, buildNodeMap, buildReorganizedMap,
  alignReorganizedIds, sanitizeReorganizedTree,
  getPathFromMap, cleanTreeForLLM
} from './diff.js';
import { sendRuntimeMessage } from './runtime-messaging.js';
import { buildBookmarkTreeFingerprint } from './tree-fingerprint.js';

/** Compte tous les nœuds (favoris + dossiers) d'un arbre pour estimer les tokens de sortie. */
function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) for (const c of node.children) count += countNodes(c);
  return count;
}

/**
 * Restaure les enfants originaux pour les dossiers dont le LLM a retourné [] à la place de [...]
 * (abréviation invalide que cleanAndParseJSON remplace par []).
 * Un dossier avec children:[] dans le résultat LLM mais avec des children dans l'original
 * est traité comme "inchangé" — ses enfants originaux sont restaurés.
 */
function deepCloneNode(node) {
  const clone = { ...node };
  if (Array.isArray(node.children)) {
    clone.children = node.children.map(deepCloneNode);
  }
  return clone;
}

function restorePreservedChildren(node, originalMap) {
  if (!Array.isArray(node.children)) return;

  // Si le dossier a des children vides mais que l'original en avait, restaurer les originaux.
  // Clone profond pour éviter de partager des références avec originalMap : les passes suivantes
  // (alignReorganizedIds, restoreOriginalMetadata) mutent les nœuds et corrompraient l'original.
  if (node.children.length === 0) {
    const origNode = originalMap[String(node.id)];
    if (origNode && Array.isArray(origNode.children) && origNode.children.length > 0) {
      node.children = origNode.children.map(deepCloneNode);
      for (const child of node.children) restorePreservedChildren(child, originalMap);
      return;
    }
  }

  for (const child of node.children) restorePreservedChildren(child, originalMap);
}

/** Cède le contrôle à l'event loop pour permettre le rendu UI entre deux étapes lourdes. */
function yieldToUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

const TRACKING_QUERY_PARAMS = new Set([
  'fbclid', 'gclid', 'igshid', 'mc_cid', 'mc_eid', 'msclkid',
  'ref', 'spm', 'utm_campaign', 'utm_content', 'utm_medium',
  'utm_source', 'utm_term'
]);

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Normalise une URL pour la détection locale de doublons:
 * http/https, www, fragments, slash final et paramètres de tracking.
 */
export function normalizeUrlForDuplicate(url) {
  try {
    const parsed = new URL(String(url || '').trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return String(url || '').trim();

    let hostname = parsed.hostname.toLowerCase();
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);

    let pathname = decodeURIComponent(parsed.pathname || '/');
    pathname = pathname.replace(/\/+/g, '/');
    if (pathname.length > 1) pathname = pathname.replace(/\/$/, '');

    const query = [];
    for (const [key, value] of parsed.searchParams.entries()) {
      const lowerKey = key.toLowerCase();
      if (TRACKING_QUERY_PARAMS.has(lowerKey) || lowerKey.startsWith('utm_')) continue;
      query.push([lowerKey, value]);
    }
    query.sort(([aKey, aValue], [bKey, bValue]) => (
      aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey)
    ));

    const port = parsed.port && !['80', '443'].includes(parsed.port) ? `:${parsed.port}` : '';
    const search = query.length
      ? `?${query.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&')}`
      : '';

    return `${hostname}${port}${pathname}${search}`;
  } catch {
    return String(url || '').trim().toLowerCase();
  }
}

function extractHtmlField(html, regex) {
  const match = html.match(regex);
  return match ? stripHtmlToText(match[1]).trim() : '';
}

function stripHtmlToText(html = '') {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function simplifyArticleTitle(title) {
  const parts = String(title || '')
    .split(/\s+(?:-|–|—|\||:)\s+/)
    .map(part => normalizeText(part))
    .filter(Boolean);
  if (parts.length <= 1) return normalizeText(title);
  return parts.reduce((best, part) => (part.length > best.length ? part : best), parts[0]);
}

function extractMainHtml(html) {
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article) return article[1];

  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) return main[1];

  const roleMain = html.match(/<[^>]+role=["']main["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (roleMain) return roleMain[1];

  const paragraphs = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(match => match[1]);
  return paragraphs.length ? paragraphs.join(' ') : html;
}

/**
 * Construit une empreinte stable pour repérer des articles identiques publiés
 * sous plusieurs domaines, sans stocker le contenu complet.
 */
export function buildArticleFingerprint(title, html) {
  const pageTitle = extractHtmlField(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const ogTitle = extractHtmlField(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i)
    || extractHtmlField(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["'][^>]*>/i);
  const h1 = extractHtmlField(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const normalizedTitle = simplifyArticleTitle(ogTitle || pageTitle || h1 || title);
  const bodyWords = normalizeText(stripHtmlToText(extractMainHtml(html)))
    .split(' ')
    .filter(word => word.length > 3)
    .slice(0, 500);

  if (!normalizedTitle || bodyWords.length < 80) return null;
  return { title: normalizedTitle, words: bodyWords };
}

async function inspectUrl(url, userSignal, includeContent = false) {
  if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const lower = String(url).toLowerCase().trim();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return { dead: false };

  try {
    const { hostname } = new URL(url);
    if (RESTRICTED_DOMAINS.has(hostname.toLowerCase())) return { dead: false };
  } catch { /* URL malformée, on laisse fetch lever l'erreur */ }

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), URL_CHECK_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (userSignal) userSignal.addEventListener('abort', onAbort);

  try {
    let response;
    try {
      response = await fetch(url, { method: 'HEAD', signal: controller.signal });
      if (response.status < 200 || response.status >= 400 || includeContent) {
        response = await fetch(url, { method: 'GET', signal: controller.signal });
      }
    } catch (e) {
      if (userSignal?.aborted) throw e;
      response = await fetch(url, { method: 'GET', signal: controller.signal });
    }
    if (response.status === 404 || response.status >= 500) {
      return { dead: true, reason: `HTTP ${response.status}`, finalUrl: response.url };
    }

    const contentType = response.headers?.get?.('content-type') || '';
    const result = { dead: false, finalUrl: response.url };
    if (includeContent && /text\/html|application\/xhtml\+xml/i.test(contentType) && response.text) {
      result.html = await response.text();
    }
    return result;
  } catch (error) {
    if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const isTimeout = error.name === 'AbortError' || error.message?.includes('timeout');
    return { dead: true, reason: isTimeout ? 'Timeout (10s)' : 'Connection error (DNS/Network)' };
  } finally {
    clearTimeout(tid);
    if (userSignal) userSignal.removeEventListener('abort', onAbort);
  }
}

function pickBestDuplicate(nodes, originalMap) {
  let best = nodes[0];
  let bestDepth = getPathFromMap(best.parentId, originalMap).split(' > ').length;
  for (let i = 1; i < nodes.length; i++) {
    const cur = nodes[i];
    const d = getPathFromMap(cur.parentId, originalMap).split(' > ').length;
    if (d > bestDepth || (d === bestDepth && (cur.title || '').length > (best.title || '').length)) {
      best = cur; bestDepth = d;
    }
  }
  return best;
}

function collectDuplicateGroups(bookmarks, originalMap, getKey, seenDuplicateIds = new Set(), matchType = 'url') {
  const groups = new Map();
  for (const bm of bookmarks) {
    const key = getKey(bm);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(bm);
  }

  const duplicates = [];
  const duplicateIds = new Set(seenDuplicateIds);
  for (const nodes of groups.values()) {
    const candidates = nodes.filter(n => !duplicateIds.has(n.id));
    if (candidates.length < 2) continue;
    const best = pickBestDuplicate(candidates, originalMap);
    for (const node of candidates) {
      if (node.id !== best.id) {
        duplicates.push({ duplicate: node, original: best, matchType });
        duplicateIds.add(node.id);
      }
    }
  }
  return duplicates;
}

function contentSimilarity(a, b) {
  const aWords = new Set(a.words);
  const bWords = new Set(b.words);
  let common = 0;
  for (const word of aWords) {
    if (bWords.has(word)) common++;
  }
  return common / Math.min(aWords.size, bWords.size);
}

function collectContentDuplicateGroups(bookmarks, originalMap, signatures, seenDuplicateIds = new Set()) {
  const duplicateIds = new Set(seenDuplicateIds);
  const byTitle = new Map();
  for (const bm of bookmarks) {
    const signature = signatures.get(bm.id);
    if (!signature || duplicateIds.has(bm.id)) continue;
    if (!byTitle.has(signature.title)) byTitle.set(signature.title, []);
    byTitle.get(signature.title).push({ bookmark: bm, signature });
  }

  const duplicates = [];
  for (const entries of byTitle.values()) {
    const candidates = [];
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const left = entries[i];
        const right = entries[j];
        if (duplicateIds.has(left.bookmark.id) || duplicateIds.has(right.bookmark.id)) continue;
        if (contentSimilarity(left.signature, right.signature) >= 0.55) {
          candidates.push(left.bookmark, right.bookmark);
        }
      }
    }

    const uniqueCandidates = [...new Map(candidates.map(bm => [bm.id, bm])).values()]
      .filter(bm => !duplicateIds.has(bm.id));
    if (uniqueCandidates.length < 2) continue;

    const best = pickBestDuplicate(uniqueCandidates, originalMap);
    for (const bm of uniqueCandidates) {
      if (bm.id !== best.id) {
        duplicates.push({ duplicate: bm, original: best, matchType: 'content' });
        duplicateIds.add(bm.id);
      }
    }
  }
  return duplicates;
}

/**
 * En mode complet, si le LLM a laissé des anciens dossiers (ID non-new_) au top-level
 * de la barre de favoris (id "1"), on les convertit en dossiers "new_" pour forcer leur
 * recréation et la suppression des anciens.
 * Cherche les enfants de "1" (Barre de favoris) qu'il soit la racine de l'arbre ou non.
 */
function enforceNewTopLevel(reorganizedTree, originalMap, currentStatus) {
  if (!reorganizedTree?.children) return reorganizedTree;

  // Trouver le nœud "Barre de favoris" (id "1") — c'est là que vivent les dossiers top-level
  let barNode;
  if (String(reorganizedTree.id) === '1') {
    barNode = reorganizedTree;
  } else if (String(reorganizedTree.id) === '0') {
    barNode = reorganizedTree.children.find(c => String(c.id) === '1') || reorganizedTree;
  } else {
    // Le LLM a utilisé un ID non-standard comme racine — traiter comme barre de favoris
    barNode = reorganizedTree;
  }

  if (!barNode?.children) return reorganizedTree;

  const SAFE_IDS = new Set(['0', '1', '2', '3']);
  let converted = 0;

  for (const child of barNode.children) {
    if (!child.children) continue;
    const id = String(child.id);
    if (SAFE_IDS.has(id)) continue;
    if (id.startsWith('new_')) continue;

    const newId = `new_${id}_toplevel`;
    console.warn(`[FavorAI] enforceNewTopLevel: "${child.title}" (${id}) → ${newId}`);
    child.id = newId;
    converted++;
  }

  if (converted > 0) {
    sendProgress(chrome.i18n.getMessage('bgTopLevelCorrected', [String(converted)]), 94, currentStatus);
  }

  return reorganizedTree;
}

/** Envoie une mise à jour de progression au popup (si ouvert) */
export function sendProgress(message, percentage, currentStatus) {
  currentStatus.percentage = percentage;
  currentStatus.logs.push({ text: message, type: 'info' });
  void sendRuntimeMessage({ action: 'progress_update', message, percentage }, 'progress update');
}

/**
 * Vérifie si une URL est accessible (liens morts).
 */
export async function checkUrlStatus(url, userSignal) {
  return inspectUrl(url, userSignal, false);
}

/**
 * Détecte les doublons et vérifie les liens morts.
 */
export async function performLocalCleanup(rootNode, originalMap, checkDeadLinks, batchSize = 24, userSignal, currentStatus) {
  sendProgress(chrome.i18n.getMessage('bgReadingBookmarks'), 10, currentStatus);
  const all = flattenBookmarks([rootNode]);

  sendProgress(chrome.i18n.getMessage('bgSearchingDuplicates'), 20, currentStatus);

  // Grouper par URL canonique: ignore http/https, www, fragments et tracking params.
  if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
  let duplicates = collectDuplicateGroups(all, originalMap, bm => normalizeUrlForDuplicate(bm.url), new Set(), 'url');

  let duplicateIds = new Set(duplicates.map(d => d.duplicate.id));
  const unique = all.filter(bm => !duplicateIds.has(bm.id));
  const finalUrls = new Map();
  const articleFingerprints = new Map();

  const deadLinks = [];
  if (checkDeadLinks) {
    const actual = parseInt(batchSize, 10) || 24;
    for (let i = 0; i < unique.length; i += actual) {
      if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const batch = unique.slice(i, i + actual);
      await Promise.all(batch.map(async (bm) => {
        const s = await inspectUrl(bm.url, userSignal, true);
        if (s.dead) deadLinks.push({ bookmark: bm, reason: s.reason });
        if (!s.dead && s.finalUrl) finalUrls.set(bm.id, normalizeUrlForDuplicate(s.finalUrl));
        if (!s.dead && s.html) {
          const fingerprint = buildArticleFingerprint(bm.title, s.html);
          if (fingerprint) articleFingerprints.set(bm.id, fingerprint);
        }
      }));
      const progress = Math.min(30 + Math.round((i / unique.length) * 40), 70);
      sendProgress(
        chrome.i18n.getMessage('bgDeadLinksProgress', [String(Math.min(i + actual, unique.length)), String(unique.length)]),
        progress, currentStatus
      );
    }

    const deadLinkIds = new Set(deadLinks.map(d => d.bookmark.id));
    const reachableUnique = unique.filter(bm => !deadLinkIds.has(bm.id));
    const redirectDuplicates = collectDuplicateGroups(
      reachableUnique,
      originalMap,
      bm => finalUrls.get(bm.id),
      duplicateIds,
      'redirect'
    );
    duplicates = duplicates.concat(redirectDuplicates);
    duplicateIds = new Set(duplicates.map(d => d.duplicate.id));

    const similarContentDuplicates = collectContentDuplicateGroups(
      reachableUnique,
      originalMap,
      articleFingerprints,
      duplicateIds
    );
    duplicates = duplicates.concat(similarContentDuplicates);
  } else {
    sendProgress(chrome.i18n.getMessage('bgDeadLinksDisabled'), 70, currentStatus);
  }

  return { duplicates, deadLinks };
}

/**
 * Orchestre l'analyse complète : nettoyage → LLM → diff → actions.
 */
export async function runAnalysis(config, mode, checkDeadLinks, userSignal, currentStatus, bookmarkFolderId) {
  if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // 1. Lire l'arbre de favoris
  let rootNode;
  if (bookmarkFolderId && bookmarkFolderId !== 'root') {
    const nodes = await chrome.bookmarks.getSubTree(bookmarkFolderId);
    rootNode = nodes[0];
  } else {
    const trees = await chrome.bookmarks.getTree();
    rootNode = trees[0];
  }
  const originalMap = buildNodeMap(rootNode);
  const analysisTreeFingerprint = buildBookmarkTreeFingerprint(rootNode);

  if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // 2. Vérifier la taille du JSON (limite de contexte LLM)
  const allBms = flattenBookmarks([rootNode]);
  const bookmarkCount = allBms.length;
  if (bookmarkCount > 2000) {
    currentStatus.logs.push({ text: chrome.i18n.getMessage('bgLargeLibraryWarning', [String(bookmarkCount)]), type: 'warning' });
    void sendRuntimeMessage({
      action: 'progress_update',
      message: chrome.i18n.getMessage('bgLargeLibraryWarning', [String(bookmarkCount)]),
      percentage: 8
    }, 'progress update');
  }

  // 3. Nettoyage local
  const cleanup = await performLocalCleanup(rootNode, originalMap, checkDeadLinks, config.linkCheckBatchSize || 24, userSignal, currentStatus);

  const duplicateIds = new Set(cleanup.duplicates.map(d => d.duplicate.id));
  const deadLinkIds  = new Set(cleanup.deadLinks.map(d => d.bookmark.id));

  if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // 4. Préparer l'arbre pour le LLM
  sendProgress(chrome.i18n.getMessage('bgPreparingAI'), 75, currentStatus);
  const cleanedTree = cleanTreeForLLM(rootNode, duplicateIds, deadLinkIds);

  if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // 5. Appel LLM
  sendProgress(chrome.i18n.getMessage('bgSendingToAI', [String(bookmarkCount)]), 80, currentStatus);

  const LLM_HEARTBEAT_MESSAGES = [
    'bgHeartbeat0', 'bgHeartbeat1', 'bgHeartbeat2', 'bgHeartbeat3',
    'bgHeartbeat4', 'bgHeartbeat5', 'bgHeartbeat6', 'bgHeartbeat7',
  ];
  let heartbeatIndex = 0;
  let heartbeatPct = 82;
  let elapsedSec = 0;
  const heartbeatInterval = setInterval(() => {
    elapsedSec += 4;
    heartbeatPct = Math.min(heartbeatPct + 1, 97);
    const msgIndex = Math.min(heartbeatIndex, LLM_HEARTBEAT_MESSAGES.length - 1);
    const elapsed = elapsedSec >= 8 ? ` (${elapsedSec}s)` : '';
    sendProgress(chrome.i18n.getMessage(LLM_HEARTBEAT_MESSAGES[msgIndex]) + elapsed, heartbeatPct, currentStatus);
    heartbeatIndex++;
  }, 4000);

  // Estimation préventive des tokens de sortie nécessaires :
  // chaque nœud (favori ou dossier) ≈ 30 tokens JSON + 2000 tokens pour l'explication
  const nodeCount = countNodes(cleanedTree);
  const estimatedOutputTokens = nodeCount * 30 + 2000;
  const configuredMax = parseInt(config.maxTokens, 10) || 131072;
  const effectiveMaxTokens = Math.max(configuredMax, estimatedOutputTokens);

  if (config.debugMode) {
    console.log('=== DEBUG: LLM Request ===');
    console.log('Provider:', config.provider);
    console.log('Model:', config.modelName);
    console.log('Mode:', mode);
    console.log('Bookmark Count:', bookmarkCount);
    console.log(`Token estimation: ${nodeCount} nodes × 30 + 2000 = ${estimatedOutputTokens} → effectiveMax: ${effectiveMaxTokens}`);
    console.log('Cleaned Tree Structure:', JSON.stringify(cleanedTree, null, 2));
    console.log('User Prompt:', mode === 'complete' ? config.promptComplete : config.promptMinimal);
    console.log('===========================');
  }

  if (effectiveMaxTokens > configuredMax) {
    sendProgress(chrome.i18n.getMessage('bgSendingToAIWithTokens', [String(bookmarkCount), String(Math.round(effectiveMaxTokens / 1024))]), 80, currentStatus);
  }

  let llmResult;
  try {
    llmResult = await queryLLM({ ...config, maxTokens: effectiveMaxTokens }, cleanedTree, mode, userSignal);
    if (config.debugMode) {
      console.log('=== DEBUG: Raw LLM Response ===');
      console.log('Raw Result:', JSON.stringify(llmResult, null, 2));
      console.log('================================');
    }
  } catch (err) {
    clearInterval(heartbeatInterval);
    if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // Extract clean error message (remove redundant "Erreur Gemini (XXX):" prefix if already in message)
    const msg = err.message || 'Unknown error';
    if (msg.startsWith('Erreur Gemini (') || msg.startsWith('Erreur OpenAI (')) {
      // Already formatted by provider - don't add redundant prefix
      const e = new Error(msg);
      if (err.isRateLimit) e.isRateLimit = true;
      throw e;
    }
    const e = new Error(`${chrome.i18n.getMessage('bgLLMCallFailed')}: ${msg}`);
    if (err.isRateLimit) e.isRateLimit = true;
    throw e;
  }
  clearInterval(heartbeatInterval);
  sendProgress(chrome.i18n.getMessage('bgResponseReceived'), 98, currentStatus);

  if (!llmResult) throw new Error(chrome.i18n.getMessage('bgLLMEmptyResponse'));

  // 6. Parser la réponse LLM
  let reorganizedTree = null;
  let explanation = chrome.i18n.getMessage('aiExplanationNone');

  if (llmResult.reorganizedTree) {
    reorganizedTree = llmResult.reorganizedTree;
    if (llmResult.explanation) {
      explanation = typeof llmResult.explanation === 'string'
        ? llmResult.explanation
        : JSON.stringify(llmResult.explanation);
    }
  } else if (Array.isArray(llmResult)) {
    reorganizedTree = llmResult;
  } else if (llmResult.children || (llmResult.id && llmResult.title)) {
    reorganizedTree = llmResult;
  } else if (llmResult.tree) {
    reorganizedTree = llmResult.tree;
  } else if (llmResult.reorganized_tree) {
    reorganizedTree = llmResult.reorganized_tree;
  } else {
    for (const key in llmResult) {
      if (Array.isArray(llmResult[key]) || llmResult[key]?.children) {
        reorganizedTree = llmResult[key]; break;
      }
    }
  }

  if (!reorganizedTree) {
    console.error('LLM response structure unreadable:', llmResult);
    throw new Error(chrome.i18n.getMessage('bgLLMInvalidTree'));
  }

  // Normaliser en nœud racine
  if (Array.isArray(reorganizedTree)) {
    const root = reorganizedTree.find(n => String(n.id) === '0');
    reorganizedTree = root ?? { id: '0', title: 'root', children: reorganizedTree };
  }

  // Restaurer les enfants originaux pour les dossiers où le LLM a utilisé [...] → []
  restorePreservedChildren(reorganizedTree, originalMap);

  // Validation: forcer les anciens dossiers top-level hors de la racine (mode complete)
  if (mode === 'complete') {
    reorganizedTree = enforceNewTopLevel(reorganizedTree, originalMap, currentStatus);
  }

  // Restauration des métadonnées (titres/URLs originaux) pour les favoris/dossiers existants
  restoreOriginalMetadata(reorganizedTree, originalMap);

  // 7. Aligner les IDs
  const origFoldersByTitle = {};
  const origBookmarksByTitle = {};
  for (const id in originalMap) {
    const node = originalMap[id];
    const tk = (node.title || '').trim().toLowerCase();
    if (!node.url) {
      (origFoldersByTitle[tk] = origFoldersByTitle[tk] || []).push(node);
    } else {
      (origBookmarksByTitle[tk] = origBookmarksByTitle[tk] || []).push(node);
    }
  }
  alignReorganizedIds(reorganizedTree, originalMap, origFoldersByTitle, origBookmarksByTitle);
  sanitizeReorganizedTree(reorganizedTree, originalMap);

  if (config.debugMode) {
    console.log('=== DEBUG: Tree Comparison ===');
    console.log('Original Tree:', JSON.stringify(originalMap, null, 2).substring(0, 1000));
    console.log('Reorganized Tree:', JSON.stringify(reorganizedTree, null, 2).substring(0, 1000));
    console.log('==============================');
  }

  // 8. Calcul du diff (découpé en étapes pour laisser l'UI se mettre à jour)
  const actions = [];
  let counter = 1;

  sendProgress(chrome.i18n.getMessage('bgComputingFolders'), 95, currentStatus);
  await yieldToUI();
  const reorganizedMap = buildReorganizedMap(reorganizedTree);

  // A. Suppressions locales (doublons + liens morts)
  for (const item of cleanup.duplicates) {
    const { duplicate: dup, original } = item;
    actions.push({
      id: `act_${counter++}`, type: 'delete_duplicate', targetId: dup.id,
      title: dup.title, url: dup.url, description: chrome.i18n.getMessage('actionDeleteDuplicate'),
      params: {
        sourcePath: getPathFromMap(dup.parentId, originalMap),
        originalPath: getPathFromMap(original.parentId, originalMap),
        originalTitle: original.title,
        matchType: item.matchType || 'url'
      },
      category: 'clean'
    });
  }
  for (const dead of cleanup.deadLinks) {
    const bm = dead.bookmark;
    actions.push({
      id: `act_${counter++}`, type: 'delete_dead', targetId: bm.id,
      title: bm.title, url: bm.url, description: `${chrome.i18n.getMessage('actionDeadLink')} (${dead.reason})`,
      params: { sourcePath: getPathFromMap(bm.parentId, originalMap), reason: dead.reason },
      category: 'clean'
    });
  }

  // B. Créations de dossiers
  for (const id in reorganizedMap) {
    const n = reorganizedMap[id];
    if ((id.startsWith(NEW_FOLDER_PREFIX) || !originalMap[id]) && n.isFolder) {
      actions.push({
        id: `act_${counter++}`, type: 'create_folder', targetId: id,
        title: n.title, description: chrome.i18n.getMessage('actionCreateFolder'),
        params: { tempId: id, title: n.title, parentId: n.parentId, targetPath: getPathFromMap(n.parentId, reorganizedMap) },
        category: 'structure'
      });
    }
  }

  sendProgress(chrome.i18n.getMessage('bgComputingMoves'), 96, currentStatus);
  await yieldToUI();

  // C. Déplacements et renommages
  for (const id in reorganizedMap) {
    if (CHROME_ROOT_IDS.has(id)) continue;
    const newNode  = reorganizedMap[id];
    const origNode = originalMap[id];
    if (!origNode) continue;

    if (origNode.parentId && newNode.parentId && origNode.parentId !== newNode.parentId) {
      const src = getPathFromMap(origNode.parentId, originalMap);
      const tgt = getPathFromMap(newNode.parentId, reorganizedMap);
      if (src !== tgt) {
        const isFolder = !origNode.url;
        actions.push({
          id: `act_${counter++}`, type: isFolder ? 'move_folder' : 'move_bookmark',
          targetId: id, title: newNode.title, url: origNode.url || null,
          description: isFolder ? chrome.i18n.getMessage('actionMoveFolder') : chrome.i18n.getMessage('actionMoveBookmark'),
          params: { nodeId: id, newParentId: newNode.parentId, oldParentId: origNode.parentId, sourcePath: src, targetPath: tgt },
          category: isFolder ? 'structure' : 'move'
        });
      }
    }

    if (origNode.title !== newNode.title) {
      const isFolder = !origNode.url;
      actions.push({
        id: `act_${counter++}`, type: isFolder ? 'rename_folder' : 'rename_bookmark',
        targetId: id, title: newNode.title,
        description: isFolder ? chrome.i18n.getMessage('actionRenameFolder') : chrome.i18n.getMessage('actionRenameBookmark'),
        params: { nodeId: id, newTitle: newNode.title, oldTitle: origNode.title, sourcePath: getPathFromMap(origNode.parentId, originalMap) },
        category: 'structure'
      });
    }
  }

  sendProgress(chrome.i18n.getMessage('bgDetectingObsolete'), 97, currentStatus);
  await yieldToUI();

  // D. Suppressions de dossiers vides/obsolètes
  const foldersToPreserve = new Set();
  for (const id in originalMap) {
    const n = originalMap[id];
    if (n.url && !reorganizedMap[id] && !duplicateIds.has(id) && !deadLinkIds.has(id)) {
      let pid = n.parentId;
      let guard = 0;
      while (pid && pid !== '0' && guard++ < 50) {
        foldersToPreserve.add(pid);
        pid = originalMap[pid]?.parentId;
      }
    }
  }
  for (const id in originalMap) {
    if (CHROME_ROOT_IDS.has(id) || reorganizedMap[id]) continue;
    const n = originalMap[id];
    if (!n.url) {
      if (foldersToPreserve.has(id)) continue;
      const isEmpty = !n.children || n.children.length === 0;
      actions.push({
        id: `act_${counter++}`, type: 'delete_folder', targetId: id,
        title: n.title, description: isEmpty ? chrome.i18n.getMessage('actionDeleteEmptyFolder') : chrome.i18n.getMessage('actionDeleteObsoleteFolder'),
        params: { sourcePath: getPathFromMap(n.parentId, originalMap), isEmptyNow: isEmpty },
        category: 'structure'
      });
    }
  }

  sendProgress(chrome.i18n.getMessage('bgAnalysisDone'), 100, currentStatus);

  // Ensure explanation is always a string
  if (typeof explanation !== 'string') {
    explanation = typeof explanation === 'object' ? JSON.stringify(explanation) : String(explanation || '');
  }

  // Debug: Log final results
  if (config.debugMode) {
    console.log('=== DEBUG: Analysis Results ===');
    console.log('Total Actions Found:', actions.length);
    console.log('Actions by Category:');
    const byCategory = {};
    for (const action of actions) {
      byCategory[action.category] = (byCategory[action.category] || 0) + 1;
    }
    console.log(byCategory);
    console.log('All Actions:', JSON.stringify(actions, null, 2));
    console.log('Explanation type:', typeof explanation);
    console.log('Explanation:', explanation);
    console.log('==============================');
  }

  return { actions, explanation, treeFingerprint: analysisTreeFingerprint, bookmarkFolderId };
}

/**
 * Restaure de façon récursive les titres et les URLs des dossiers/favoris existants
 * à partir de la structure originale. Permet de réduire la taille des réponses LLM
 * en évitant d'inclure les champs redondants (comme le titre des favoris ou l'URL).
 */
export function restoreOriginalMetadata(node, originalMap) {
  if (!node) return;
  const orig = originalMap[node.id];
  if (orig) {
    if (!node.title && orig.title) {
      node.title = orig.title;
    }
    if (orig.url) {
      node.url = orig.url;
    }
  }
  if (node.children) {
    for (const child of node.children) {
      restoreOriginalMetadata(child, originalMap);
    }
  }
}

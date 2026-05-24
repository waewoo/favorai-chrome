import { URL_CHECK_TIMEOUT_MS, RESTRICTED_DOMAINS, CHROME_ROOT_IDS, NEW_FOLDER_PREFIX } from '../utils/constants.js';
import { queryLLM } from '../llm/index.js';
import {
  flattenBookmarks, buildNodeMap, buildReorganizedMap,
  alignReorganizedIds, sanitizeReorganizedTree,
  getPathFromMap, cleanTreeForLLM
} from './diff.js';

/** Compte tous les nœuds (favoris + dossiers) d'un arbre pour estimer les tokens de sortie. */
function countNodes(node) {
  if (!node) return 0;
  let count = 1;
  if (node.children) for (const c of node.children) count += countNodes(c);
  return count;
}

/** Cède le contrôle à l'event loop pour permettre le rendu UI entre deux étapes lourdes. */
function yieldToUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
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
    sendProgress(`⚠️ ${converted} ancien(s) dossier(s) top-level corrigé(s) automatiquement`, 94, currentStatus);
  }

  return reorganizedTree;
}

/** Envoie une mise à jour de progression au popup (si ouvert) */
export function sendProgress(message, percentage, currentStatus) {
  currentStatus.percentage = percentage;
  currentStatus.logs.push({ text: message, type: 'info' });
  chrome.runtime.sendMessage({ action: 'progress_update', message, percentage }).catch(() => {});
}

/**
 * Vérifie si une URL est accessible (liens morts).
 */
export async function checkUrlStatus(url, userSignal) {
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
      if (response.status < 200 || response.status >= 400) {
        response = await fetch(url, { method: 'GET', signal: controller.signal });
      }
    } catch (e) {
      if (userSignal?.aborted) throw e;
      response = await fetch(url, { method: 'GET', signal: controller.signal });
    }
    if (response.status === 404 || response.status >= 500) {
      return { dead: true, reason: `HTTP ${response.status}` };
    }
    return { dead: false };
  } catch (error) {
    if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const isTimeout = error.name === 'AbortError' || error.message?.includes('timeout');
    return { dead: true, reason: isTimeout ? 'Timeout (10s)' : 'Connection error (DNS/Network)' };
  } finally {
    clearTimeout(tid);
    if (userSignal) userSignal.removeEventListener('abort', onAbort);
  }
}

/**
 * Détecte les doublons et vérifie les liens morts.
 */
export async function performLocalCleanup(rootNode, originalMap, checkDeadLinks, batchSize = 24, userSignal, currentStatus) {
  sendProgress(chrome.i18n.getMessage('bgReadingBookmarks'), 10, currentStatus);
  const all = flattenBookmarks([rootNode]);

  sendProgress(chrome.i18n.getMessage('bgSearchingDuplicates'), 20, currentStatus);

  // Grouper par URL
  const urlGroups = new Map();
  for (const bm of all) {
    if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!urlGroups.has(bm.url)) urlGroups.set(bm.url, []);
    urlGroups.get(bm.url).push(bm);
  }

  const duplicates = [];
  const unique = [];
  for (const [, nodes] of urlGroups) {
    if (nodes.length === 1) { unique.push(nodes[0]); continue; }
    let best = nodes[0];
    let bestDepth = getPathFromMap(best.parentId, originalMap).split(' > ').length;
    for (let i = 1; i < nodes.length; i++) {
      const cur = nodes[i];
      const d = getPathFromMap(cur.parentId, originalMap).split(' > ').length;
      if (d > bestDepth || (d === bestDepth && (cur.title || '').length > (best.title || '').length)) {
        best = cur; bestDepth = d;
      }
    }
    unique.push(best);
    for (const n of nodes) {
      if (n.id !== best.id) duplicates.push({ duplicate: n, original: best });
    }
  }

  const deadLinks = [];
  if (checkDeadLinks) {
    const actual = parseInt(batchSize, 10) || 24;
    for (let i = 0; i < unique.length; i += actual) {
      if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const batch = unique.slice(i, i + actual);
      await Promise.all(batch.map(async (bm) => {
        const s = await checkUrlStatus(bm.url, userSignal);
        if (s.dead) deadLinks.push({ bookmark: bm, reason: s.reason });
      }));
      const progress = Math.min(30 + Math.round((i / unique.length) * 40), 70);
      sendProgress(
        chrome.i18n.getMessage('bgDeadLinksProgress', [String(Math.min(i + actual, unique.length)), String(unique.length)]),
        progress, currentStatus
      );
    }
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

  if (userSignal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // 2. Vérifier la taille du JSON (limite de contexte LLM)
  const allBms = flattenBookmarks([rootNode]);
  if (allBms.length > 2000) {
    currentStatus.logs.push({ text: chrome.i18n.getMessage('bgLargeLibraryWarning', [String(allBms.length)]), type: 'warning' });
    chrome.runtime.sendMessage({ action: 'progress_update', message: chrome.i18n.getMessage('bgLargeLibraryWarning', [String(allBms.length)]), percentage: 8 }).catch(() => {});
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
  const bookmarkCount = flattenBookmarks([rootNode]).length;
  sendProgress(`Envoi à l'IA (${bookmarkCount} favoris)…`, 80, currentStatus);

  const LLM_HEARTBEAT_MESSAGES = [
    'Analyse sémantique des titres…',
    'Identification des catégories…',
    'Vérification de la cohérence des dossiers…',
    'Construction de la hiérarchie…',
    'Résolution des incohérences thématiques…',
    'Validation de la structure proposée…',
    'Génération de l\'explication…',
    'Finalisation de la réponse…',
  ];
  let heartbeatIndex = 0;
  let heartbeatPct = 82;
  let elapsedSec = 0;
  const heartbeatInterval = setInterval(() => {
    elapsedSec += 4;
    heartbeatPct = Math.min(heartbeatPct + 1, 97);
    const msgIndex = Math.min(heartbeatIndex, LLM_HEARTBEAT_MESSAGES.length - 1);
    const elapsed = elapsedSec >= 8 ? ` (${elapsedSec}s)` : '';
    sendProgress(LLM_HEARTBEAT_MESSAGES[msgIndex] + elapsed, heartbeatPct, currentStatus);
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
    sendProgress(`Envoi à l'IA (${bookmarkCount} favoris, ~${Math.round(effectiveMaxTokens / 1024)}K tokens réservés)…`, 80, currentStatus);
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
    const e = new Error(`${chrome.i18n.getMessage('bgLLMCallFailed')}: ${err.message}`);
    if (err.isRateLimit) e.isRateLimit = true;
    throw e;
  }
  clearInterval(heartbeatInterval);
  sendProgress('Réponse reçue, traitement en cours…', 98, currentStatus);

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

  // Validation: forcer les anciens dossiers top-level hors de la racine (mode complete)
  if (mode === 'complete') {
    reorganizedTree = enforceNewTopLevel(reorganizedTree, originalMap, currentStatus);
  }

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

  sendProgress('Calcul des dossiers à créer…', 95, currentStatus);
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
        originalTitle: original.title
      },
      category: 'clean'
    });
  }
  for (const dead of cleanup.deadLinks) {
    const bm = dead.bookmark;
    actions.push({
      id: `act_${counter++}`, type: 'delete_dead', targetId: bm.id,
      title: bm.title, url: bm.url, description: `${chrome.i18n.getMessage('actionDeadLink')} (${dead.reason})`,
      params: { sourcePath: getPathFromMap(bm.parentId, originalMap) },
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

  sendProgress('Calcul des déplacements…', 96, currentStatus);
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

  sendProgress('Détection des dossiers obsolètes…', 97, currentStatus);
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

  return { actions, explanation };
}
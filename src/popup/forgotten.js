/**
 * Forgotten Bookmarks — surface bookmarks not visited for a long time.
 * Uses chrome.history.getVisits() to find the last visit date per URL.
 * Note: Chrome history retention is ~90 days by default; bookmarks with
 * no history entry may have been visited before that window.
 */

import { showToast, showConfirm } from './utils.js';
import { createOption } from './dom.js';

const t = (key, fallback = '') => chrome.i18n.getMessage(key) || fallback;

// Build a flat id→node map and a id→path map from the bookmark tree
function buildPathMap(node, map = {}, pathMap = {}, parentPath = '') {
  const path = parentPath ? `${parentPath} › ${node.title}` : (node.title || '');
  map[node.id] = node;
  pathMap[node.id] = path;
  if (node.children) {
    for (const child of node.children) buildPathMap(child, map, pathMap, path);
  }
  return { map, pathMap };
}

// Flatten tree to bookmarks only (nodes with url)
function flattenBookmarks(node, list = []) {
  if (node.url) list.push(node);
  if (node.children) node.children.forEach(c => flattenBookmarks(c, list));
  return list;
}

function timeAgo(ms) {
  if (!ms) return t('forgottenNeverRecorded');
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  if (days < 1)  return t('forgottenToday');
  if (days < 7)  return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

async function scanForgotten(days) {
  const trees = await chrome.bookmarks.getTree();
  const { pathMap } = buildPathMap(trees[0]);
  const bookmarks = flattenBookmarks(trees[0]);
  // days === 0 → "Never recorded": keep only bookmarks with no history (lastVisit === 0).
  // threshold = 1 so that `lastVisit < 1` matches only lastVisit === 0.
  const threshold = days === 0 ? 1 : Date.now() - days * 24 * 60 * 60 * 1000;
  const forgotten = [];

  for (const bm of bookmarks) {
    try {
      const visits = await chrome.history.getVisits({ url: bm.url });
      const lastVisit = visits.length > 0 ? Math.max(...visits.map(v => v.visitTime)) : 0;
      if (lastVisit < threshold) {
        forgotten.push({ ...bm, lastVisit, folderPath: pathMap[bm.parentId] || '' });
      }
    } catch {
      // history API may fail for some URLs — skip silently
    }
  }

  return forgotten.sort((a, b) => a.lastVisit - b.lastVisit); // oldest first
}

function createCard(bm, container, onDelete) {
  const card = document.createElement('div');
  card.className = 'forgotten-card';
  card.dataset.id = bm.id;
  card.dataset.parentId = bm.parentId;
  card.dataset.title = bm.title || '';
  card.dataset.url = bm.url || '';
  card.dataset.folderPath = bm.folderPath || '';

  const header = document.createElement('div');
  header.className = 'forgotten-card-header';

  const titleEl = document.createElement('div');
  titleEl.className = 'forgotten-card-title';
  titleEl.textContent = bm.title || bm.url;
  titleEl.title = bm.title || bm.url;

  const ageBadge = document.createElement('span');
  ageBadge.className = 'forgotten-card-age';
  ageBadge.textContent = timeAgo(bm.lastVisit);

  header.appendChild(titleEl);
  header.appendChild(ageBadge);

  const urlEl = document.createElement('div');
  urlEl.className = 'forgotten-card-url';
  urlEl.textContent = bm.url;
  urlEl.title = bm.url;

  const pathEl = document.createElement('div');
  pathEl.className = 'forgotten-card-path';
  pathEl.textContent = bm.folderPath ? `📁 ${bm.folderPath}` : '';

  const actions = document.createElement('div');
  actions.className = 'forgotten-card-actions';

  const visitBtn = document.createElement('button');
  visitBtn.className = 'btn btn-flat';
  visitBtn.classList.add('forgotten-card-button', 'forgotten-card-button--visit');
  visitBtn.textContent = t('forgottenVisit');
  visitBtn.addEventListener('click', () => chrome.tabs.create({ url: bm.url }));

  const keepBtn = document.createElement('button');
  keepBtn.className = 'btn btn-flat';
  keepBtn.classList.add('forgotten-card-button', 'forgotten-card-button--keep');
  keepBtn.textContent = t('forgottenKeep');
  keepBtn.addEventListener('click', () => {
    card.style.opacity = '0';
    setTimeout(() => { card.remove(); updateCount(container); }, 200);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-flat';
  deleteBtn.classList.add('forgotten-card-button', 'forgotten-card-button--delete');
  deleteBtn.textContent = t('forgottenDelete');
  deleteBtn.addEventListener('click', async () => {
    try {
      await chrome.bookmarks.remove(bm.id);
      card.style.opacity = '0';
      setTimeout(() => { card.remove(); updateCount(container); onDelete(); }, 200);
      showToast(t('forgottenDeleted'));
      chrome.runtime.sendMessage({
        action: 'save_forgotten_deletion',
        entries: [{
          id: `entry_${Date.now()}`,
          type: 'delete',
          nodeId: bm.id,
          parentId: bm.parentId,
          title: bm.title || '',
          url: bm.url || '',
          sourcePath: bm.folderPath || ''
        }]
      });
    } catch {
      showToast(t('forgottenDeleteError'));
    }
  });

  actions.appendChild(visitBtn);
  actions.appendChild(keepBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(header);
  card.appendChild(urlEl);
  card.appendChild(pathEl);
  card.appendChild(actions);
  return card;
}

function updateCount(container) {
  const countEl = document.getElementById('forgottenCount');
  if (!countEl) return;
  const remaining = container.querySelectorAll('[data-id]').length;
  countEl.textContent = remaining === 0
    ? t('forgottenNoneLeft')
    : t('forgottenCount').replace('{n}', remaining);
}

export async function renderForgotten() {
  const panel = document.getElementById('tabForgottenPanel');
  if (!panel) return;

  // Already built — just show
  if (panel.dataset.rendered === '1') return;
  panel.dataset.rendered = '1';

  panel.textContent = '';

  // ── Header ──────────────────────────────────────────────────────────────
  // Note: dynamic elements are NOT processed by translatePage() (which only runs on static HTML).
  // t() calls chrome.i18n.getMessage() directly — that is the correct i18n mechanism here.
  const title = document.createElement('div');
  title.className = 'forgotten-section-title';
  title.setAttribute('data-i18n', 'tabForgotten'); // kept for E2E selector scoping
  title.textContent = t('tabForgotten');

  const desc = document.createElement('p');
  desc.className = 'forgotten-section-desc';
  desc.textContent = t('forgottenDesc');

  // ── History limitation notice ─────────────────────────────────────────────
  const notice = document.createElement('div');
  notice.className = 'forgotten-notice';
  const noticeIcon = document.createElement('span');
  noticeIcon.className = 'forgotten-notice-icon';
  noticeIcon.textContent = 'ℹ️';
  const noticeText = document.createElement('p');
  noticeText.className = 'forgotten-notice-text';
  noticeText.textContent = t('forgottenHistoryNotice');
  notice.appendChild(noticeIcon);
  notice.appendChild(noticeText);

  // ── Controls ─────────────────────────────────────────────────────────────
  const controls = document.createElement('div');
  controls.className = 'forgotten-controls';

  const label = document.createElement('label');
  label.className = 'forgotten-controls-label';
  label.textContent = t('forgottenThresholdLabel');

  const select = document.createElement('select');
  select.id = 'forgottenThreshold';
  select.className = 'forgotten-controls-select';
  [
    { value: '30', label: t('forgotten30Days') },
    { value: '60', label: t('forgotten60Days') },
    { value: '90', label: t('forgotten90Days') },
    { value: '0',  label: t('forgottenNeverRecorded') },
  ].forEach(({ value, label: lbl }) => {
    select.appendChild(createOption(value, lbl, value === '60'));
  });

  const scanBtn = document.createElement('button');
  scanBtn.id = 'btnScanForgotten';
  scanBtn.className = 'btn btn-primary';
  scanBtn.classList.add('forgotten-scan-button');
  scanBtn.textContent = t('forgottenScan');

  controls.appendChild(label);
  controls.appendChild(select);
  controls.appendChild(scanBtn);

  // ── Results container ─────────────────────────────────────────────────────
  const countEl = document.createElement('div');
  countEl.id = 'forgottenCount';
  countEl.className = 'forgotten-count';

  const listContainer = document.createElement('div');
  listContainer.id = 'forgottenList';
  listContainer.className = 'forgotten-list';

  const bulkActions = document.createElement('div');
  bulkActions.id = 'forgottenBulk';
  bulkActions.className = 'forgotten-bulk';

  const deleteAllBtn = document.createElement('button');
  deleteAllBtn.className = 'btn btn-flat';
  deleteAllBtn.classList.add('forgotten-card-button', 'forgotten-card-button--delete');
  deleteAllBtn.setAttribute('data-i18n', 'forgottenDeleteAll');
  deleteAllBtn.textContent = t('forgottenDeleteAll');

  const keepAllBtn = document.createElement('button');
  keepAllBtn.className = 'btn btn-flat';
  keepAllBtn.classList.add('forgotten-card-button', 'forgotten-card-button--keep');
  keepAllBtn.setAttribute('data-i18n', 'forgottenKeepAll');
  keepAllBtn.textContent = t('forgottenKeepAll');

  bulkActions.appendChild(deleteAllBtn);
  bulkActions.appendChild(keepAllBtn);

  // ── Assemble ──────────────────────────────────────────────────────────────
  panel.appendChild(title);
  panel.appendChild(desc);
  panel.appendChild(notice);
  panel.appendChild(controls);
  panel.appendChild(countEl);
  panel.appendChild(listContainer);
  panel.appendChild(bulkActions);

  // ── Scan logic ────────────────────────────────────────────────────────────
  const runScan = async () => {
    const days = parseInt(select.value, 10);
    scanBtn.disabled = true;
    scanBtn.textContent = t('forgottenScanning');
    listContainer.textContent = '';
    countEl.textContent = '';
    bulkActions.style.display = 'none';

    try {
      const forgotten = await scanForgotten(days);
      if (forgotten.length === 0) {
        countEl.textContent = t('forgottenNoneFound');
        scanBtn.textContent = t('forgottenScan');
        scanBtn.disabled = false;
        return;
      }

      countEl.textContent = t('forgottenFound').replace('{n}', forgotten.length);
      forgotten.forEach(bm => {
        const card = createCard(bm, listContainer, () => {});
        listContainer.appendChild(card);
      });

      bulkActions.style.display = 'flex';
    } catch {
      countEl.textContent = t('forgottenError');
    }

    scanBtn.textContent = t('forgottenScan');
    scanBtn.disabled = false;
  };

  scanBtn.addEventListener('click', () => {
    panel.dataset.rendered = '1'; // keep rendered flag
    runScan();
  });

  keepAllBtn.addEventListener('click', () => {
    listContainer.querySelectorAll('[data-id]').forEach(card => card.remove());
    bulkActions.style.display = 'none';
    countEl.textContent = t('forgottenNoneLeft');
  });

  deleteAllBtn.addEventListener('click', async () => {
    const cards = [...listContainer.querySelectorAll('[data-id]')];
    const confirmed = await showConfirm(
      t('forgottenConfirmDeleteAll').replace('{n}', cards.length)
    );
    if (!confirmed) return;

    let deleted = 0;
    const deletedEntries = [];
    for (const card of cards) {
      try {
        await chrome.bookmarks.remove(card.dataset.id);
        deletedEntries.push({
          id: `entry_${Date.now()}_${card.dataset.id}`,
          type: 'delete',
          nodeId: card.dataset.id,
          parentId: card.dataset.parentId,
          title: card.dataset.title,
          url: card.dataset.url,
          sourcePath: card.dataset.folderPath
        });
        card.remove();
        deleted++;
      } catch { /* skip already-deleted */ }
    }
    bulkActions.style.display = 'none';
    countEl.textContent = t('forgottenNoneLeft');
    showToast(t('forgottenDeletedAll').replace('{n}', deleted));
    if (deletedEntries.length > 0) {
      chrome.runtime.sendMessage({ action: 'save_forgotten_deletion', entries: deletedEntries });
    }
  });
}

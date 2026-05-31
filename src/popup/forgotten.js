/**
 * Forgotten Bookmarks — surface bookmarks not visited for a long time.
 * Uses chrome.history.getVisits() to find the last visit date per URL.
 * Note: Chrome history retention is ~90 days by default; bookmarks with
 * no history entry may have been visited before that window.
 */

import { showToast, showConfirm } from './utils.js';

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
  if (!ms) return t('forgottenNeverRecorded', 'Never recorded');
  const diff = Date.now() - ms;
  const days = Math.floor(diff / 86400000);
  if (days < 1)  return t('forgottenToday', 'Today');
  if (days < 7)  return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

async function scanForgotten(months) {
  const trees = await chrome.bookmarks.getTree();
  const { pathMap } = buildPathMap(trees[0]);
  const bookmarks = flattenBookmarks(trees[0]);
  // months === 0 means "Never visited" → keep only bookmarks with no history at all (lastVisit === 0)
  // Use threshold = 1 so that `lastVisit < 1` matches only lastVisit === 0.
  const threshold = months === 0 ? 1 : Date.now() - months * 30 * 24 * 60 * 60 * 1000;
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
  card.dataset.id = bm.id;
  card.style.cssText = 'padding: 10px 12px; margin-bottom: 8px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-color); border-radius: 8px; transition: opacity .2s;';

  const header = document.createElement('div');
  header.style.cssText = 'display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;';

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-main); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
  titleEl.textContent = bm.title || bm.url;
  titleEl.title = bm.title || bm.url;

  const ageBadge = document.createElement('span');
  ageBadge.style.cssText = 'font-size: 10px; color: var(--text-muted); white-space: nowrap; flex-shrink: 0;';
  ageBadge.textContent = timeAgo(bm.lastVisit);

  header.appendChild(titleEl);
  header.appendChild(ageBadge);

  const urlEl = document.createElement('div');
  urlEl.style.cssText = 'font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin: 3px 0;';
  urlEl.textContent = bm.url;
  urlEl.title = bm.url;

  const pathEl = document.createElement('div');
  pathEl.style.cssText = 'font-size: 10px; color: var(--text-muted); margin-bottom: 8px; opacity: 0.7;';
  pathEl.textContent = bm.folderPath ? `📁 ${bm.folderPath}` : '';

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 6px; flex-wrap: wrap;';

  const visitBtn = document.createElement('button');
  visitBtn.className = 'btn btn-flat';
  visitBtn.style.cssText = 'font-size: 10px; padding: 3px 8px; height: auto;';
  visitBtn.textContent = t('forgottenVisit', '🔗 Visit');
  visitBtn.addEventListener('click', () => chrome.tabs.create({ url: bm.url }));

  const keepBtn = document.createElement('button');
  keepBtn.className = 'btn btn-flat';
  keepBtn.style.cssText = 'font-size: 10px; padding: 3px 8px; height: auto; border-color: rgba(99,102,241,0.3); color: #818cf8;';
  keepBtn.textContent = t('forgottenKeep', '✓ Keep');
  keepBtn.addEventListener('click', () => {
    card.style.opacity = '0';
    setTimeout(() => { card.remove(); updateCount(container); }, 200);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-flat';
  deleteBtn.style.cssText = 'font-size: 10px; padding: 3px 8px; height: auto; border-color: rgba(239,68,68,0.3); color: #ef4444;';
  deleteBtn.textContent = t('forgottenDelete', '🗑 Delete');
  deleteBtn.addEventListener('click', async () => {
    try {
      await chrome.bookmarks.remove(bm.id);
      card.style.opacity = '0';
      setTimeout(() => { card.remove(); updateCount(container); onDelete(); }, 200);
      showToast(t('forgottenDeleted', 'Bookmark deleted'));
    } catch {
      showToast(t('forgottenDeleteError', 'Could not delete bookmark'));
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
    ? t('forgottenNoneLeft', '✅ No more forgotten bookmarks')
    : t('forgottenCount', `${remaining} bookmark(s) found`).replace('{n}', remaining);
}

export async function renderForgotten() {
  const panel = document.getElementById('tabForgottenPanel');
  if (!panel) return;

  // Already built — just show
  if (panel.dataset.rendered === '1') return;
  panel.dataset.rendered = '1';

  panel.textContent = '';

  // ── Header ──────────────────────────────────────────────────────────────
  const title = document.createElement('div');
  title.style.cssText = 'font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #818cf8; margin-bottom: 6px;';
  title.setAttribute('data-i18n', 'tabForgotten');
  title.textContent = t('tabForgotten', '🕰️ Forgotten');

  const desc = document.createElement('p');
  desc.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.4;';
  desc.setAttribute('data-i18n', 'forgottenDesc');
  desc.textContent = t('forgottenDesc', 'Bookmarks you have not visited for a while. Review them to keep your library clean.');

  // ── Controls ─────────────────────────────────────────────────────────────
  const controls = document.createElement('div');
  controls.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap;';

  const label = document.createElement('label');
  label.style.cssText = 'font-size: 11px; color: var(--text-muted);';
  label.setAttribute('data-i18n', 'forgottenThresholdLabel');
  label.textContent = t('forgottenThresholdLabel', 'Not visited since:');

  const select = document.createElement('select');
  select.id = 'forgottenThreshold';
  select.style.cssText = 'flex: 1; min-width: 120px; max-width: 180px;';
  [
    { value: '3',  label: t('forgotten3Months', '3 months') },
    { value: '6',  label: t('forgotten6Months', '6 months') },
    { value: '12', label: t('forgotten12Months', '1 year') },
    { value: '0',  label: t('forgottenNever', 'Never visited') },
  ].forEach(({ value, label: lbl }) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = lbl;
    if (value === '6') opt.selected = true;
    select.appendChild(opt);
  });

  const scanBtn = document.createElement('button');
  scanBtn.id = 'btnScanForgotten';
  scanBtn.className = 'btn btn-primary';
  scanBtn.style.cssText = 'font-size: 11px; padding: 5px 14px; height: auto;';
  scanBtn.setAttribute('data-i18n', 'forgottenScan');
  scanBtn.textContent = t('forgottenScan', '🔍 Scan');

  controls.appendChild(label);
  controls.appendChild(select);
  controls.appendChild(scanBtn);

  // ── Results container ─────────────────────────────────────────────────────
  const countEl = document.createElement('div');
  countEl.id = 'forgottenCount';
  countEl.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-bottom: 8px; min-height: 16px;';

  const listContainer = document.createElement('div');
  listContainer.id = 'forgottenList';
  listContainer.style.cssText = 'max-height: 340px; overflow-y: auto;';

  const bulkActions = document.createElement('div');
  bulkActions.id = 'forgottenBulk';
  bulkActions.style.cssText = 'display: none; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);';

  const deleteAllBtn = document.createElement('button');
  deleteAllBtn.className = 'btn btn-flat';
  deleteAllBtn.style.cssText = 'font-size: 11px; flex: 1; border-color: rgba(239,68,68,0.3); color: #ef4444;';
  deleteAllBtn.setAttribute('data-i18n', 'forgottenDeleteAll');
  deleteAllBtn.textContent = t('forgottenDeleteAll', '🗑 Delete All Shown');

  const keepAllBtn = document.createElement('button');
  keepAllBtn.className = 'btn btn-flat';
  keepAllBtn.style.cssText = 'font-size: 11px; flex: 1; border-color: rgba(99,102,241,0.3); color: #818cf8;';
  keepAllBtn.setAttribute('data-i18n', 'forgottenKeepAll');
  keepAllBtn.textContent = t('forgottenKeepAll', '✓ Keep All');

  bulkActions.appendChild(deleteAllBtn);
  bulkActions.appendChild(keepAllBtn);

  // ── Assemble ──────────────────────────────────────────────────────────────
  panel.appendChild(title);
  panel.appendChild(desc);
  panel.appendChild(controls);
  panel.appendChild(countEl);
  panel.appendChild(listContainer);
  panel.appendChild(bulkActions);

  // ── Scan logic ────────────────────────────────────────────────────────────
  let deleteCount = 0;

  const runScan = async () => {
    const months = parseInt(select.value, 10);
    scanBtn.disabled = true;
    scanBtn.textContent = t('forgottenScanning', '⏳ Scanning…');
    listContainer.textContent = '';
    countEl.textContent = '';
    bulkActions.style.display = 'none';

    try {
      const forgotten = await scanForgotten(months);
      if (forgotten.length === 0) {
        countEl.textContent = t('forgottenNoneFound', '✅ No forgotten bookmarks found for this period.');
        scanBtn.textContent = t('forgottenScan', '🔍 Scan');
        scanBtn.disabled = false;
        return;
      }

      countEl.textContent = t('forgottenFound', `${forgotten.length} forgotten bookmark(s) found`).replace('{n}', forgotten.length);
      forgotten.forEach(bm => {
        const card = createCard(bm, listContainer, () => { deleteCount++; });
        listContainer.appendChild(card);
      });

      bulkActions.style.display = 'flex';
    } catch (err) {
      countEl.textContent = t('forgottenError', '⚠️ Scan failed. Check permissions.');
    }

    scanBtn.textContent = t('forgottenScan', '🔍 Scan');
    scanBtn.disabled = false;
  };

  scanBtn.addEventListener('click', () => {
    panel.dataset.rendered = '1'; // keep rendered flag
    runScan();
  });

  keepAllBtn.addEventListener('click', () => {
    listContainer.querySelectorAll('[data-id]').forEach(card => card.remove());
    bulkActions.style.display = 'none';
    countEl.textContent = t('forgottenNoneLeft', '✅ No more forgotten bookmarks');
  });

  deleteAllBtn.addEventListener('click', async () => {
    const cards = [...listContainer.querySelectorAll('[data-id]')];
    const confirmed = await showConfirm(
      t('forgottenConfirmDeleteAll', `Delete all ${cards.length} bookmarks?`).replace('{n}', cards.length)
    );
    if (!confirmed) return;

    let deleted = 0;
    for (const card of cards) {
      try {
        await chrome.bookmarks.remove(card.dataset.id);
        card.remove();
        deleted++;
      } catch { /* skip already-deleted */ }
    }
    bulkActions.style.display = 'none';
    countEl.textContent = t('forgottenNoneLeft', '✅ No more forgotten bookmarks');
    showToast(t('forgottenDeletedAll', `${deleted} bookmark(s) deleted`).replace('{n}', deleted));
  });
}

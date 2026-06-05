/**
 * Popup action checklist helpers.
 */

import { showConfirm, showToast, addLog } from './utils.js';
import { showView } from './navigation.js';

const t = (key, fallback = '') => chrome.i18n.getMessage(key) || fallback;

export function applyActionFilter(filterValue) {
  const actionListContainer = document.getElementById('actionListContainer');
  const actionCountSpan = document.getElementById('actionCount');
  if (!actionListContainer) return;

  const groups = actionListContainer.querySelectorAll('.action-group');
  let visibleCount = 0;

  groups.forEach(group => {
    const items = group.querySelectorAll('.action-item');
    let groupHasVisibleItems = false;

    items.forEach(item => {
      const cat = item.getAttribute('data-category');
      if (filterValue === 'all' || cat === filterValue) {
        item.classList.remove('hidden');
        groupHasVisibleItems = true;
        visibleCount++;
      } else {
        item.classList.add('hidden');
      }
    });

    if (groupHasVisibleItems) {
      group.classList.remove('hidden');
    } else {
      group.classList.add('hidden');
    }
  });

  if (actionCountSpan) {
    actionCountSpan.textContent = chrome.i18n.getMessage('actionCount', [String(visibleCount)]) || `${visibleCount} modifications proposées`;
  }
}

export function toggleAllCheckboxes(checked) {
  const actionListContainer = document.getElementById('actionListContainer');
  if (!actionListContainer) return;
  const checkboxes = actionListContainer.querySelectorAll('.action-item:not(.hidden) .action-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = checked;
  });
  updateApplyButtonState();
}

export async function applyCheckedActions() {
  const actionListContainer = document.getElementById('actionListContainer');
  const btnApply = document.getElementById('btnApply');
  const btnCancel = document.getElementById('btnCancel');
  if (!actionListContainer) return;

  const checkboxes = actionListContainer.querySelectorAll('.action-checkbox:checked');
  const approvedActionIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-id'));

  if (approvedActionIds.length === 0) {
    showToast(t('toastNoChangesSelected', 'No changes selected.'));
    return;
  }

  const title = t('btnApply', 'Apply selected changes');
  const message = t('dialogConfirmApply', 'Are you sure you want to apply changes?');
  const ok = await showConfirm(title, message);
  if (!ok) return;

  if (btnApply) {
    btnApply.disabled = true;
    btnApply.textContent = t('btnApplying', 'Applying...');
  }
  if (btnCancel) btnCancel.disabled = true;

  chrome.runtime.sendMessage({
    action: 'apply_changes',
    approvedActionIds: approvedActionIds
  }, (response) => {
    if (btnApply) {
      btnApply.textContent = t('btnApply', 'Apply selected changes');
      btnApply.disabled = false;
    }
    if (btnCancel) btnCancel.disabled = false;

    if (chrome.runtime.lastError) {
      addLog(t('logSystemApplyError', 'System apply error: {error}').replace('{error}', chrome.runtime.lastError.message), 'error');
      showToast(t('toastApplyFailed', 'Apply failed.'));
      return;
    }

    if (response && response.success) {
      showToast(t('toastBookmarksUpdated', 'Bookmarks updated.'));
      showView('main');
      addLog(t('logApplySuccess', '> Selected changes were applied successfully.'), 'success');
      addLog(t('logBookmarksUpdated', '> Your bookmarks are now up to date.'), 'success');
    } else {
      const errorMsg = response?.error || t('errorUnknown', 'Unknown error.');
      addLog(t('logApplyFailed', 'Apply error: {error}').replace('{error}', errorMsg), 'error');
      showToast(t('toastApplyFailed', 'Apply failed.'));
    }
  });
}

export { startInlineEdit } from './inlineEdit.js';

export function updateApplyButtonState() {
  const actionListContainer = document.getElementById('actionListContainer');
  const btnApply = document.getElementById('btnApply');
  if (!actionListContainer || !btnApply) return;
  const checkboxes = actionListContainer.querySelectorAll('.action-checkbox:checked');
  btnApply.disabled = checkboxes.length === 0;
}

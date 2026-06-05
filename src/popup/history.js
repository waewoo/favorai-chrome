/**
 * Popup History Management
 */

import { isSafeUrl, formatExplanation, showConfirm, showToast, addLog } from './utils.js';

const t = (key, fallback = '') => chrome.i18n.getMessage(key) || fallback;

export function renderHistory() {
  const historyListContainer = document.getElementById('historyListContainer');
  const btnClearHistory = document.getElementById('btnClearHistory');
  if (!historyListContainer) return;

  chrome.storage.local.get(['reorgHistory'], (res) => {
    const history = res.reorgHistory || [];
    historyListContainer.textContent = '';
    
    if (history.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.style.cssText = 'padding: 20px; text-align: center; color: var(--text-muted); font-size: 12px;';
      emptyDiv.textContent = t('historyEmpty', 'No session history available.');
      historyListContainer.appendChild(emptyDiv);
      if (btnClearHistory) btnClearHistory.style.display = 'none';
      return;
    }
    
    if (btnClearHistory) btnClearHistory.style.display = 'inline-block';
    
    history.forEach((session) => {
      const dateStr = new Date(session.timestamp).toLocaleString();
      const modeLabel = session.mode === 'complete'
        ? t('btnComplete', 'Complete')
        : session.mode === 'forgotten'
          ? t('tabForgotten', 'Forgotten')
          : t('btnMinimal', 'Minimal');
      
      const sessionDiv = document.createElement('div');
      sessionDiv.className = 'action-group';
      sessionDiv.style.cssText = 'padding: 10px; margin-bottom: 10px; background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border-color); border-radius: 8px;';
      
      const headerDiv = document.createElement('div');
      headerDiv.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;';
      
      const titleSpan = document.createElement('span');
      titleSpan.style.color = 'var(--text-main)';
      titleSpan.textContent = dateStr;
      
      const modeBadge = document.createElement('span');
      modeBadge.style.cssText = 'margin-left: 6px; font-size: 9px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05);';
      modeBadge.textContent = modeLabel;

      const countBadge = document.createElement('span');
      countBadge.style.cssText = 'margin-left: 6px; font-size: 9px; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-color); background: rgba(255,255,255,0.05);';
      countBadge.textContent = t('historyEntryCount', '{count} change(s)').replace('{count}', String(session.entries.length));
      
      const leftContainer = document.createElement('div');
      leftContainer.appendChild(titleSpan);
      leftContainer.appendChild(modeBadge);
      leftContainer.appendChild(countBadge);

      const undoBtn = document.createElement('button');
      undoBtn.className = 'btn btn-flat btn-rollback';
      undoBtn.setAttribute('data-id', session.id);
      undoBtn.style.cssText = 'font-size: 10px; padding: 3px 8px; height: auto; background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.2); color: #818cf8;';
      undoBtn.textContent = '⏪ ' + t('btnRollback', 'Undo session');
      undoBtn.title = t('btnRollback', 'Undo session');
      undoBtn.setAttribute('aria-label', t('historyRollbackSessionLabel', 'Undo the full session from {date}').replace('{date}', dateStr));

      headerDiv.appendChild(leftContainer);
      headerDiv.appendChild(undoBtn);
      
      sessionDiv.appendChild(headerDiv);

      // AI global explanation display
      if (session.explanation && session.explanation.trim()) {
        const expDiv = document.createElement('div');
        expDiv.style.cssText = 'font-size: 10px; padding: 8px; background: rgba(99, 102, 241, 0.04); border: 1px dashed rgba(99, 102, 241, 0.2); border-radius: 6px; margin-bottom: 8px; color: var(--text-main); white-space: pre-wrap; line-height: 1.4;';
        
        const expTitle = document.createElement('div');
        expTitle.style.cssText = 'font-weight: 600; margin-bottom: 4px; color: #818cf8; display: flex; align-items: center; gap: 4px;';
        expTitle.textContent = '💡 Description globale de l\'IA :';
        expDiv.appendChild(expTitle);

        const expText = document.createElement('div');
        expText.style.color = 'var(--text-muted)';
        expText.textContent = formatExplanation(session.explanation);
        expDiv.appendChild(expText);

        sessionDiv.appendChild(expDiv);
      }

      const listDiv = document.createElement('div');
      listDiv.style.cssText = 'display: flex; flex-direction: column; gap: 4px; max-height: 160px; overflow-y: auto; padding-right: 4px;';
      
      session.entries.forEach(entry => {
        const entryItem = document.createElement('div');
        entryItem.style.cssText = 'font-size: 10px; color: var(--text-muted); display: flex; flex-direction: column; gap: 2px; margin-bottom: 4px; border-bottom: 1px dashed rgba(255,255,255,0.03); padding-bottom: 4px;';
        
        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; align-items: center; justify-content: space-between; gap: 8px;';

        const leftContent = document.createElement('div');
        leftContent.style.cssText = 'display: flex; align-items: center; gap: 6px;';

        const typeLabel = document.createElement('span');
        const entityName = document.createElement('span');
        entityName.style.color = 'var(--text-main)';
        entityName.style.fontWeight = '500';
        entityName.textContent = entry.title || 'Favori';

        if (entry.type === 'create_folder') {
          typeLabel.style.color = 'var(--success-color)';
          typeLabel.style.fontWeight = '600';
          typeLabel.textContent = '📁 Création';
        } else if (entry.type === 'rename') {
          const icon = entry.isFolder ? '📁' : '🔗';
          typeLabel.style.color = 'var(--warning-color)';
          typeLabel.style.fontWeight = '600';
          typeLabel.textContent = `${icon} Renommer`;
          entityName.textContent = ` "${entry.oldTitle}" → "${entry.newTitle}"`;
        } else if (entry.type === 'move') {
          const icon = entry.isFolder ? '📁' : '🔗';
          typeLabel.style.color = '#818cf8';
          typeLabel.style.fontWeight = '600';
          typeLabel.textContent = `${icon} Déplacement`;
        } else if (entry.type === 'delete') {
          const icon = entry.isFolder ? '📁' : '🔗';
          typeLabel.style.color = 'var(--error-color)';
          typeLabel.style.fontWeight = '600';
          typeLabel.textContent = `${icon} Suppression`;
        }
        
        leftContent.appendChild(typeLabel);
        leftContent.appendChild(entityName);
        topRow.appendChild(leftContent);

        // Control container for entry-level rollback & deletion
        const controlContainer = document.createElement('div');
        controlContainer.style.cssText = 'display: flex; align-items: center; gap: 4px;';

        const entryRollbackBtn = document.createElement('button');
        entryRollbackBtn.className = 'btn-entry-rollback';
        entryRollbackBtn.setAttribute('data-session-id', session.id);
        entryRollbackBtn.setAttribute('data-entry-id', entry.id);
        entryRollbackBtn.style.cssText = 'font-size: 8px; padding: 2px 4px; line-height: 1; background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.3); color: #818cf8; border-radius: 4px; cursor: pointer;';
        entryRollbackBtn.textContent = '⏪';
        entryRollbackBtn.title = t('historyRollbackEntryTitle', 'Undo this change');

        const entryDeleteBtn = document.createElement('button');
        entryDeleteBtn.className = 'btn-entry-delete';
        entryDeleteBtn.setAttribute('data-session-id', session.id);
        entryDeleteBtn.setAttribute('data-entry-id', entry.id);
        entryDeleteBtn.style.cssText = 'font-size: 8px; padding: 2px 4px; line-height: 1; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 4px; cursor: pointer;';
        entryDeleteBtn.textContent = '❌';
        entryDeleteBtn.title = 'Supprimer cette ligne de l\'historique sans l\'annuler';

        controlContainer.appendChild(entryRollbackBtn);
        controlContainer.appendChild(entryDeleteBtn);
        topRow.appendChild(controlContainer);

        entryItem.appendChild(topRow);

        const descContainer = document.createElement('div');
        descContainer.style.cssText = 'font-size: 9px; color: var(--text-muted); line-height: 1.3; margin-top: 1px;';

        if (entry.type === 'create_folder') {
          descContainer.textContent = 'Créé sous : ';
          const pathSpan = document.createElement('span');
          pathSpan.className = 'path-highlight-target';
          pathSpan.textContent = entry.targetPath || 'Barre de favoris';
          descContainer.appendChild(pathSpan);
        } else if (entry.type === 'rename') {
          descContainer.textContent = 'Dans : ';
          const pathSpan = document.createElement('span');
          pathSpan.className = 'path-highlight';
          pathSpan.textContent = entry.parentPath || 'Barre de favoris';
          descContainer.appendChild(pathSpan);
        } else if (entry.type === 'move') {
          descContainer.textContent = 'De : ';
          const pathSpan1 = document.createElement('span');
          pathSpan1.className = 'path-highlight';
          pathSpan1.textContent = entry.sourcePath || 'Barre de favoris';
          descContainer.appendChild(pathSpan1);
          descContainer.appendChild(document.createElement('br'));
          descContainer.appendChild(document.createTextNode('Vers : '));
          const pathSpan2 = document.createElement('span');
          pathSpan2.className = 'path-highlight-target';
          pathSpan2.textContent = entry.targetPath || 'Barre de favoris';
          descContainer.appendChild(pathSpan2);
        } else if (entry.type === 'delete') {
          descContainer.textContent = 'Dossier d\'origine : ';
          const pathSpan = document.createElement('span');
          pathSpan.className = 'path-highlight';
          pathSpan.textContent = entry.sourcePath || 'Barre de favoris';
          descContainer.appendChild(pathSpan);
          if (entry.url) {
            descContainer.appendChild(document.createElement('br'));
            if (isSafeUrl(entry.url)) {
              const link = document.createElement('a');
              link.href = entry.url;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.className = 'action-sub-link';
              link.textContent = entry.url;
              descContainer.appendChild(link);
            } else {
              const sub = document.createElement('span');
              sub.className = 'action-sub';
              sub.title = 'Schéma non-HTTP';
              sub.textContent = entry.url;
              descContainer.appendChild(sub);
            }
          }
        }
        
        entryItem.appendChild(descContainer);
        listDiv.appendChild(entryItem);
      });
      
      sessionDiv.appendChild(listDiv);
      historyListContainer.appendChild(sessionDiv);
    });
    
    // Bind session rollback
    const rollbackBtns = historyListContainer.querySelectorAll('.btn-rollback');
    rollbackBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sessionId = e.currentTarget.getAttribute('data-id');
        performRollback(sessionId, e.currentTarget);
      });
    });

    // Bind entry rollback
    const entryRollbackBtns = historyListContainer.querySelectorAll('.btn-entry-rollback');
    entryRollbackBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget;
        const sessionId = target.getAttribute('data-session-id');
        const entryId = target.getAttribute('data-entry-id');
        
        const title = t('btnRollback', 'Undo change');
        const message = t('dialogConfirmRollbackEntry', 'Undo this specific change?');
        const ok = await showConfirm(title, message);
        if (!ok) return;

        target.disabled = true;
        target.textContent = '...';

        chrome.runtime.sendMessage({
          action: 'rollback_entry',
          sessionId,
          entryId
        }, (response) => {
          if (chrome.runtime.lastError) {
            showToast(t('toastSystemError', 'System error'));
            renderHistory();
            return;
          }
          if (response && response.success) {
            showToast(t('toastRollbackEntrySuccess', 'Change undone.'));
            renderHistory();
          } else {
            showToast(response?.error || t('toastRollbackFailed', 'Undo failed.'));
            renderHistory();
          }
        });
      });
    });

    // Bind entry delete
    const entryDeleteBtns = historyListContainer.querySelectorAll('.btn-entry-delete');
    entryDeleteBtns.forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const target = e.currentTarget;
        const sessionId = target.getAttribute('data-session-id');
        const entryId = target.getAttribute('data-entry-id');
        
        const title = t('historyDeleteEntryTitle', 'Delete from history');
        const message = t('dialogConfirmDeleteHistoryEntry', 'Delete this history row without undoing the bookmark change?');
        const ok = await showConfirm(title, message);
        if (!ok) return;

        target.disabled = true;
        target.textContent = '...';

        chrome.runtime.sendMessage({
          action: 'delete_entry',
          sessionId,
          entryId
        }, (response) => {
          if (chrome.runtime.lastError) {
            showToast(t('toastSystemError', 'System error'));
            renderHistory();
            return;
          }
          if (response && response.success) {
            showToast(t('toastHistoryEntryDeleted', 'History row deleted.'));
            renderHistory();
          } else {
            showToast(response?.error || t('toastHistoryEntryDeleteFailed', 'Deletion failed.'));
            renderHistory();
          }
        });
      });
    });
  });
}

export async function performRollback(sessionId, btnElement) {
  const title = t('btnRollback', 'Undo Changes');
  const message = t('dialogConfirmRollback', 'Are you sure you want to undo this session\'s changes?');
  const ok = await showConfirm(title, message);
  if (!ok) return;
  
  const originalText = btnElement.textContent;
  btnElement.textContent = t('btnRollbacking', 'Undoing...');
  btnElement.disabled = true;
  
  chrome.runtime.sendMessage({
    action: 'rollback_session',
    sessionId: sessionId
  }, (response) => {
    btnElement.textContent = originalText;
    btnElement.disabled = false;
    
    if (chrome.runtime.lastError) {
      showToast(t('toastSystemRollbackError', 'System error during undo.'));
      addLog(t('logSystemRollbackError', 'System rollback error: {error}').replace('{error}', chrome.runtime.lastError.message), 'error');
      return;
    }
    
    if (response && response.success) {
      showToast(t('btnRollbacked', 'Undone'));
      addLog(t('logRollbackSuccess', '> Session restored successfully.'), 'success');
      renderHistory();
    } else if (response?.partial) {
      const rollback = response.rollback || {};
      const summary = t('toastRollbackPartial', '{success} change(s) undone, {failed} failed.')
        .replace('{success}', String(rollback.successCount || 0))
        .replace('{failed}', String(rollback.failureCount || 0));
      showToast(summary);
      addLog(summary, 'warning');
      renderHistory();
    } else {
      const errorMsg = response?.error || t('errorUnknown', 'Unknown error.');
      showToast(t('toastRollbackFailed', 'Undo failed.'));
      addLog(t('logRollbackFailed', 'Rollback error: {error}').replace('{error}', errorMsg), 'error');
    }
  });
}

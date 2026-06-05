/**
 * Popup inline edit helpers.
 */

import { showToast } from './utils.js';
import { displayRapport } from './report.js';
import { createElement, createOption, formatFolderPath } from './dom.js';

export function startInlineEdit(actionId, itemDiv) {
  chrome.storage.local.get(['pendingActions', 'extensionStatus'], (res) => {
    const actions = res.pendingActions || [];
    const status = res.extensionStatus || {};
    const actionIndex = actions.findIndex(a => a.id === actionId);
    if (actionIndex === -1) return;

    const act = actions[actionIndex];
    const detailsDiv = itemDiv.querySelector('.action-details');
    if (!detailsDiv) return;

    const originalChildren = Array.from(detailsDiv.childNodes);
    detailsDiv.textContent = '';

    const editContainer = createElement('div', {
      props: {
        style: 'display: flex; flex-direction: column; gap: 6px; margin-top: 6px; background: rgba(255, 255, 255, 0.03); padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); animation: fadeIn 0.2s ease-out;'
      }
    });

    const group1 = createElement('div', { className: 'form-group', props: { style: 'margin-bottom: 0;' } });
    const label1 = createElement('label', { textContent: chrome.i18n.getMessage('btnEdit') || 'Titre', props: { style: 'font-size: 10px; display: block; margin-bottom: 2px;' } });
    const input1 = createElement('input', {
      className: 'edit-inline-title',
      type: 'text',
      value: act.title,
      props: { style: 'padding: 4px 8px; font-size: 11px; width: 100%;' }
    });
    group1.appendChild(label1);
    group1.appendChild(input1);
    editContainer.appendChild(group1);

    let input2 = null;
    if (act.url) {
      const group2 = createElement('div', { className: 'form-group', props: { style: 'margin-bottom: 0; margin-top: 4px;' } });
      const label2 = createElement('label', { textContent: 'URL', props: { style: 'font-size: 10px; display: block; margin-bottom: 2px;' } });
      input2 = createElement('input', {
        className: 'edit-inline-url',
        type: 'text',
        value: act.url,
        props: { style: 'padding: 4px 8px; font-size: 11px; width: 100%;' }
      });
      group2.appendChild(label2);
      group2.appendChild(input2);
      editContainer.appendChild(group2);
    }

    let folderSelect = null;
    if (act.url && (act.type === 'move_bookmark' || act.type === 'rename_bookmark' || act.type === 'delete_dead' || act.type === 'delete_duplicate')) {
      const groupFolder = createElement('div', { className: 'form-group', props: { style: 'margin-bottom: 0; margin-top: 4px;' } });
      const labelFolder = createElement('label', {
        textContent: chrome.i18n.getMessage('lightFolderLabel') || 'Dossier cible',
        props: { style: 'font-size: 10px; display: block; margin-bottom: 2px;' }
      });
      folderSelect = createElement('select', {
        className: 'edit-inline-folder',
        props: { style: 'padding: 4px 8px; font-size: 11px; width: 100%;' }
      });

      folderSelect.appendChild(createOption('', chrome.i18n.getMessage('lightSelectFolder') || 'Sélectionner un dossier...'));

      chrome.runtime.sendMessage({ action: 'get_folders' }, (response) => {
        if (response && response.folders && response.folders.length > 0) {
          response.folders.forEach(folder => {
            folderSelect.appendChild(createOption(folder.id, formatFolderPath(folder.path)));
          });

          const targetId = act.params?.targetParentId || act.params?.parentId;
          if (targetId) {
            folderSelect.value = targetId;
          }
        }
      });

      groupFolder.appendChild(labelFolder);
      groupFolder.appendChild(folderSelect);
      editContainer.appendChild(groupFolder);
    }

    const buttonRow = createElement('div', { props: { style: 'display: flex; gap: 8px; margin-top: 6px; justify-content: flex-end;' } });
    const cancelBtn = createElement('button', {
      className: 'btn btn-flat btn-inline-cancel',
      textContent: chrome.i18n.getMessage('btnCancel') || 'Annuler',
      props: { style: 'padding: 4px 8px; font-size: 10px; border-radius: 4px; height: auto;' }
    });
    const saveBtn = createElement('button', {
      className: 'btn btn-primary btn-inline-save',
      textContent: chrome.i18n.getMessage('btnSave') || 'Enregistrer',
      props: { style: 'padding: 4px 8px; font-size: 10px; border-radius: 4px; height: auto; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: none;' }
    });

    buttonRow.appendChild(cancelBtn);
    buttonRow.appendChild(saveBtn);
    editContainer.appendChild(buttonRow);
    detailsDiv.appendChild(editContainer);

    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      detailsDiv.textContent = '';
      originalChildren.forEach(child => detailsDiv.appendChild(child));
    });

    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newTitle = input1.value.trim();
      const newUrl = input2 ? input2.value.trim() : null;
      const newFolderId = folderSelect ? folderSelect.value : null;

      if (!newTitle) {
        showToast('Le titre ne peut pas être vide');
        return;
      }

      const previousTitle = act.title;
      act.title = newTitle;
      if (act.type === 'create_folder') {
        act.params.title = newTitle;
      } else if (act.type === 'rename_folder') {
        act.params.newTitle = newTitle;
      }

      if (newUrl !== null) {
        act.url = newUrl;
        if (act.type === 'delete_dead' || act.type === 'delete_duplicate') {
          act.type = 'rename_bookmark';
          act.category = 'structure';
          act.description = 'Corriger et conserver le favori';
          act.params = {
            nodeId: act.targetId,
            newTitle: newTitle,
            oldTitle: previousTitle,
            newUrl: newUrl,
            sourcePath: act.params.sourcePath || act.params.originalPath
          };
        } else if (act.type === 'rename_bookmark' || act.type === 'move_bookmark') {
          act.params.newTitle = newTitle;
          act.params.newUrl = newUrl;
        }
      } else if (act.type === 'rename_folder' || act.type === 'move_folder') {
        act.params.newTitle = newTitle;
      }

      if (newFolderId && newFolderId !== (act.params?.targetParentId || act.params?.parentId)) {
        act.params.targetParentId = newFolderId;
        if (act.type === 'rename_bookmark' || act.type === 'delete_dead' || act.type === 'delete_duplicate') {
          act.type = 'move_bookmark';
          act.category = 'structure';
          act.description = 'Déplacer le favori';
        }
      }

      actions[actionIndex] = act;
      if (status.actions) {
        const statusIdx = status.actions.findIndex(a => a.id === actionId);
        if (statusIdx !== -1) {
          status.actions[statusIdx] = act;
        }
      }

      chrome.storage.local.set({ pendingActions: actions, extensionStatus: status }, () => {
        showToast(chrome.i18n.getMessage('logReady') ? 'Change saved!' : 'Favori mis à jour !');
        displayRapport(actions, status.explanation, status.mode);
      });
    });
  });
}

/**
 * Popup Reorganization Management
 */

import { isSafeUrl, formatExplanation, showConfirm, showToast, addLog, addLoadingLog, removeLoadingLog } from './utils.js';
import { showView } from './navigation.js';

export function setControlsDisabled(disabled) {
  const providerSelect = document.getElementById('provider');
  const checkDeadLinksCheckbox = document.getElementById('checkDeadLinks');
  const btnMinReorg = document.getElementById('btnMinReorg');
  const btnFullReorg = document.getElementById('btnFullReorg');
  const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');

  if (providerSelect) providerSelect.disabled = disabled;
  if (checkDeadLinksCheckbox) checkDeadLinksCheckbox.disabled = disabled;
  if (btnMinReorg) btnMinReorg.disabled = disabled;
  if (btnFullReorg) btnFullReorg.disabled = disabled;
  if (bookmarkFolderSelect) bookmarkFolderSelect.disabled = disabled;
}

export function loadBookmarkFolders() {
  const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');
  if (!bookmarkFolderSelect) return;

  chrome.runtime.sendMessage({ action: 'get_folders' }, (response) => {
    if (response && response.folders && response.folders.length > 0) {
      // Clear all except the first one (All bookmarks)
      while (bookmarkFolderSelect.options.length > 1) {
        bookmarkFolderSelect.remove(1);
      }

      response.folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder.id;
        // Do not display root folders like "Bookmarks Bar" directly, keep it pretty
        const parts = folder.path.split(' > ');
        const roots = ['Barre de favoris', 'Favoris', 'Bookmarks bar', 'Bookmarks Bar', 'Other bookmarks', 'Autres favoris', 'Mobile bookmarks'];
        const displayPath = parts.length > 1 && roots.includes(parts[0]) ? parts.slice(1).join(' > ') : parts.join(' > ');
        option.textContent = displayPath;
        bookmarkFolderSelect.appendChild(option);
      });
    }

    if (!bookmarkFolderSelect.value || bookmarkFolderSelect.value === 'root') {
      bookmarkFolderSelect.value = '1';
    }
  });
}

export function stopReorganization() {
  removeLoadingLog();
  addLog('> Demande d\'interruption envoyée...', 'warning');
  chrome.runtime.sendMessage({ action: 'cancel_analysis' }).catch(() => {});
}

export function showRetryButton(_mode) {
  if (document.getElementById('btnRetryReorg')) return;

  const btn = document.createElement('button');
  btn.id = 'btnRetryReorg';
  btn.className = 'btn btn-primary';
  btn.style.cssText = 'width:100%; margin-top:10px; font-size:12px; animation: fadeIn 0.3s ease-out;';
  btn.textContent = '⏱️ Réessayer l\'analyse';
  btn.addEventListener('click', () => {
    btn.remove();
    retryReorganization();
  });

  const logContainer = document.getElementById('logContainer');
  const statusSection = logContainer ? logContainer.closest('section') : null;
  if (statusSection) {
    statusSection.appendChild(btn);
  }
}

export function retryReorganization() {
  chrome.storage.local.get(['extensionStatus'], (res) => {
    const status = res.extensionStatus;
    if (!status || !status.lastConfig || !status.mode) {
      addLog('Impossible de réessayer : la configuration précédente est introuvable.', 'error');
      return;
    }
    startReorganizationWithConfig(status.lastConfig, status.mode, status.lastCheckDeadLinks !== false);
  });
}

export function startReorganizationWithConfig(config, mode, checkDeadLinks) {
  const btnStopReorg = document.getElementById('btnStopReorg');
  const reorgBtnGroup = document.getElementById('reorgBtnGroup');
  const logContainer = document.getElementById('logContainer');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const progressBar = document.getElementById('progressBar');

  setControlsDisabled(true);
  if (reorgBtnGroup) reorgBtnGroup.classList.add('hidden');
  if (btnStopReorg) btnStopReorg.classList.remove('hidden');

  if (logContainer) logContainer.innerHTML = '';
  addLog(`> Nouvelle tentative (${mode === 'complete' ? 'Complète' : 'Minimale'})...`, 'info');
  addLoadingLog('Interrogation de l\'IA en cours...');
  if (progressBarContainer) progressBarContainer.style.display = 'block';
  if (progressBar) progressBar.style.width = '5%';

  chrome.runtime.sendMessage({
    action: 'start_analysis',
    config: config,
    mode: mode,
    checkDeadLinks: checkDeadLinks
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      const errorMsg = chrome.runtime.lastError?.message || (response?.error) || 'Impossible de lancer l\'analyse.';
      removeLoadingLog();
      addLog(`Échec du démarrage : ${errorMsg}`, 'error');
      if (progressBarContainer) progressBarContainer.style.display = 'none';
      if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
      if (btnStopReorg) btnStopReorg.classList.add('hidden');
      setControlsDisabled(false);
    }
  });
}

export async function startReorganization(mode) {
  const checkDeadLinksCheckbox = document.getElementById('checkDeadLinks');
  const providerSelect = document.getElementById('provider');
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const modelNameInput = document.getElementById('modelName');
  const linkCheckBatchSizeSelect = document.getElementById('linkCheckBatchSize');
  const maxTokensSelect = document.getElementById('maxTokens');
  const debugModeCheckbox = document.getElementById('debugMode');
  const promptMinimalInput = document.getElementById('promptMinimal');
  const promptCompleteInput = document.getElementById('promptComplete');
  const promptSuggestInput = document.getElementById('promptSuggest');
  const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');
  const btnStopReorg = document.getElementById('btnStopReorg');
  const reorgBtnGroup = document.getElementById('reorgBtnGroup');
  const logContainer = document.getElementById('logContainer');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const progressBar = document.getElementById('progressBar');

  // If dead links check is enabled, ensure we have host permission
  if (checkDeadLinksCheckbox && checkDeadLinksCheckbox.checked) {
    const granted = await chrome.permissions.contains({ origins: ['<all_urls>'] });
    if (!granted) {
      const approved = await chrome.permissions.request({ origins: ['<all_urls>'] });
      if (!approved) {
        checkDeadLinksCheckbox.checked = false;
        chrome.storage.sync.set({ checkDeadLinks: false });
        addLog(chrome.i18n.getMessage('deadLinksPermissionDenied') || 'Permission refusée — vérification des liens désactivée.', 'warning');
        return;
      }
    }
  }

  // Load latest prompt defaults if not initialized
  const syncRes = await new Promise(resolve => {
    chrome.storage.sync.get(['promptMinimal', 'promptComplete', 'promptSuggest'], resolve);
  });

  const config = {
    provider: providerSelect ? providerSelect.value : 'google',
    apiUrl: apiUrlInput ? apiUrlInput.value.trim() : '',
    apiKey: apiKeyInput ? apiKeyInput.value.trim() : '',
    modelName: modelNameInput ? modelNameInput.value.trim() : '',
    linkCheckBatchSize: linkCheckBatchSizeSelect ? (parseInt(linkCheckBatchSizeSelect.value, 10) || 24) : 24,
    maxTokens: maxTokensSelect ? (parseInt(maxTokensSelect.value, 10) || 32768) : 32768,
    debugMode: debugModeCheckbox ? debugModeCheckbox.checked : false,
    promptMinimal: (promptMinimalInput && promptMinimalInput.value.trim()) || syncRes.promptMinimal || '',
    promptComplete: (promptCompleteInput && promptCompleteInput.value.trim()) || syncRes.promptComplete || '',
    promptSuggest: (promptSuggestInput && promptSuggestInput.value.trim()) || syncRes.promptSuggest || ''
  };

  if (config.provider !== 'ollama' && !config.apiKey) {
    showToast(chrome.i18n.getMessage('errApiKeyRequired') || 'Clé API requise');
    addLog(chrome.i18n.getMessage('errApiKeyRequired') || '> Erreur : Clé API requise.', 'error');
    return;
  }

  setControlsDisabled(true);
  if (reorgBtnGroup) reorgBtnGroup.classList.add('hidden');
  if (btnStopReorg) btnStopReorg.classList.remove('hidden');

  if (logContainer) logContainer.innerHTML = '';
  const modeLabel = mode === 'complete' ? chrome.i18n.getMessage('bgModeComplete') : chrome.i18n.getMessage('bgModeMinimal');
  addLog(chrome.i18n.getMessage('bgStartingReorg', [modeLabel]), 'info');
  addLoadingLog('Interrogation de l\'IA en cours...');
  if (progressBarContainer) progressBarContainer.style.display = 'block';
  if (progressBar) progressBar.style.width = '5%';

  const checkDeadLinks = checkDeadLinksCheckbox ? checkDeadLinksCheckbox.checked : false;
  const bookmarkFolderId = bookmarkFolderSelect ? bookmarkFolderSelect.value : '1';

  chrome.runtime.sendMessage({
    action: 'start_analysis',
    mode,
    config,
    checkDeadLinks,
    bookmarkFolderId
  }, (response) => {
    if (chrome.runtime.lastError || !response || !response.success) {
      const errorMsg = chrome.runtime.lastError?.message || (response?.error) || 'Impossible de lancer l\'analyse.';
      removeLoadingLog();
      addLog(`Échec du démarrage : ${errorMsg}`, 'error');
      if (progressBarContainer) progressBarContainer.style.display = 'none';
      if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
      if (btnStopReorg) btnStopReorg.classList.add('hidden');
      setControlsDisabled(false);
    }
  });
}

export function displayRapport(actions, explanation, mode) {
  const explanationBlock = document.getElementById('explanationBlock');
  const iaExplanationText = document.getElementById('iaExplanationText');
  const reorgModeBadge = document.getElementById('reorgModeBadge');
  const actionCountSpan = document.getElementById('actionCount');
  const actionListContainer = document.getElementById('actionListContainer');
  const btnApply = document.getElementById('btnApply');
  const btnCancel = document.getElementById('btnCancel');

  console.log('=== displayRapport Called ===');
  console.log('Actions received:', actions.length);
  console.log('Mode:', mode);

  // Ensure explanation is a string
  if (typeof explanation !== 'string') {
    explanation = typeof explanation === 'object' ? JSON.stringify(explanation) : String(explanation || '');
  }

  if (reorgModeBadge) {
    reorgModeBadge.textContent = mode === 'complete' ? 'Réorganisation Complète' : 'Réorganisation Minimale';
    if (mode === 'complete') {
      reorgModeBadge.style.background = 'rgba(168, 85, 247, 0.2)';
      reorgModeBadge.style.color = '#c084fc';
      reorgModeBadge.style.borderColor = 'rgba(168, 85, 247, 0.4)';
    } else {
      reorgModeBadge.style.background = 'rgba(99, 102, 241, 0.2)';
      reorgModeBadge.style.color = '#818cf8';
      reorgModeBadge.style.borderColor = 'rgba(99, 102, 241, 0.4)';
    }
  }

  if (explanation && explanation.trim()) {
    if (explanationBlock) explanationBlock.style.display = 'block';
    if (iaExplanationText) {
      iaExplanationText.textContent = '';
      const formatted = formatExplanation(explanation);
      const lines = formatted.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();

        // Section header: **TITLE**
        const headerMatch = trimmed.match(/^\*\*(.+)\*\*$/);
        if (headerMatch) {
          const h = document.createElement('span');
          h.className = 'expl-section';
          h.textContent = headerMatch[1];
          iaExplanationText.appendChild(h);
          continue;
        }

        // Bullet: starts with "- " or "• "
        if (/^[-•] /.test(trimmed)) {
          const item = document.createElement('div');
          item.className = 'expl-item';
          item.textContent = trimmed.replace(/^[-•] /, '');
          iaExplanationText.appendChild(item);
          continue;
        }

        // Non-empty plain line
        if (trimmed) {
          const item = document.createElement('div');
          item.className = 'expl-item';
          item.textContent = trimmed;
          iaExplanationText.appendChild(item);
        }
      }
    }
  } else {
    if (explanationBlock) explanationBlock.style.display = 'none';
  }

  // Set action count
  if (actionCountSpan) {
    actionCountSpan.textContent = chrome.i18n.getMessage('actionCount', [String(actions.length)]) || `${actions.length} modifications proposées`;
  }
  if (actionListContainer) {
    actionListContainer.textContent = '';
  }

  // Reset active filter pills state
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(b => {
    if (b.getAttribute('data-filter') === 'all') {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  if (actions.length === 0) {
    addLog(chrome.i18n.getMessage('bgNoChangesNeeded') || 'Aucun changement nécessaire.', 'success');
    showView('main');
    return;
  }

  if (btnApply) btnApply.disabled = false;
  if (btnCancel) btnCancel.textContent = chrome.i18n.getMessage('btnBack') || "Retour";

  const groups = {
    clean: { title: '🧹 Nettoyage (Doublons & Liens morts)', list: [] },
    structure: { title: '📁 Changements Structurels (Dossiers)', list: [] },
    move: { title: '🔗 Déplacements de favoris', list: [] }
  };

  for (const act of actions) {
    if (groups[act.category]) {
      groups[act.category].list.push(act);
    } else {
      groups.move.list.push(act);
    }
  }

  for (const cat in groups) {
    const group = groups[cat];
    if (group.list.length === 0) continue;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'action-group';

    const groupHeader = document.createElement('div');
    groupHeader.className = 'action-group-title';
    
    const titleSpan = document.createElement('span');
    titleSpan.textContent = group.title;
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'badge';
    badgeSpan.textContent = String(group.list.length);
    
    groupHeader.appendChild(titleSpan);
    groupHeader.appendChild(badgeSpan);
    groupDiv.appendChild(groupHeader);

    for (const act of group.list) {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'action-item';
      itemDiv.setAttribute('data-category', act.category);

      let badgeClass = 'badge-move';
      let badgeText = 'Déplacer';
      if (act.type.startsWith('delete')) {
        badgeClass = 'badge-delete';
        badgeText = 'Supprimer';
      } else if (act.type === 'create_folder') {
        badgeClass = 'badge-create';
        badgeText = 'Créer';
      } else if (act.type.startsWith('rename')) {
        badgeClass = 'badge-rename';
        badgeText = 'Renommer';
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'action-checkbox';
      checkbox.setAttribute('data-id', act.id);
      checkbox.checked = true;
      checkbox.setAttribute('aria-label', `Sélectionner : ${act.title}`);

      const detailsDiv = document.createElement('div');
      detailsDiv.className = 'action-details';

      const titleBar = document.createElement('div');
      titleBar.style.display = 'flex';
      titleBar.style.alignItems = 'center';
      titleBar.style.gap = '6px';

      const typeBadge = document.createElement('span');
      typeBadge.className = `action-badge ${badgeClass}`;
      typeBadge.textContent = badgeText;

      const descSpan = document.createElement('span');
      descSpan.className = 'action-desc';
      descSpan.textContent = act.title;

      const editBtn = document.createElement('span');
      editBtn.className = 'edit-btn';
      editBtn.setAttribute('data-id', act.id);
      editBtn.style.cursor = 'pointer';
      editBtn.style.fontSize = '10px';
      editBtn.style.color = 'var(--accent-color)';
      editBtn.style.marginLeft = '8px';
      editBtn.textContent = '✏️';
      editBtn.title = chrome.i18n.getMessage('btnEdit') || 'Modifier';

      titleBar.appendChild(typeBadge);
      titleBar.appendChild(descSpan);
      titleBar.appendChild(editBtn);
      detailsDiv.appendChild(titleBar);

      if (act.type === 'delete_duplicate') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Emplacement à supprimer : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.sourcePath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);

        const sub2 = document.createElement('span');
        sub2.className = 'action-sub';
        sub2.textContent = 'Existe déjà dans : ';
        const path2 = document.createElement('span');
        path2.className = 'path-highlight-target';
        path2.textContent = act.params.originalPath;
        sub2.appendChild(path2);
        if (act.params.originalTitle && act.params.originalTitle !== act.title) {
          sub2.appendChild(document.createTextNode(' (sous le nom '));
          const nameSpan = document.createElement('span');
          nameSpan.className = 'name-highlight-new';
          nameSpan.textContent = `"${act.params.originalTitle}"`;
          sub2.appendChild(nameSpan);
          sub2.appendChild(document.createTextNode(')'));
        }
        detailsDiv.appendChild(sub2);

        const sub3 = document.createElement('span');
        sub3.className = 'action-sub';
        sub3.style.color = 'var(--error-color)';
        sub3.style.fontWeight = '500';
        sub3.textContent = chrome.i18n.getMessage('actionDeleteDuplicate') || 'Doublon (sera supprimé)';
        detailsDiv.appendChild(sub3);
      } 
      else if (act.type === 'delete_dead') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Dossier source : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.sourcePath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);

        const sub2 = document.createElement('span');
        sub2.className = 'action-sub';
        sub2.style.color = 'var(--error-color)';
        sub2.style.fontWeight = '500';
        sub2.textContent = `${chrome.i18n.getMessage('actionDeadLink') || 'Lien mort'} (${act.description.replace('Lien mort détecté (', '').replace(')', '')})`;
        detailsDiv.appendChild(sub2);
      } 
      else if (act.type === 'create_folder') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Créer sous : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.targetPath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);
      } 
      else if (act.type === 'rename_folder' || act.type === 'rename_bookmark') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Dossier : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.sourcePath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);

        const sub2 = document.createElement('span');
        sub2.className = 'action-sub';
        sub2.textContent = 'Ancien nom : ';
        const oldSpan = document.createElement('span');
        oldSpan.className = 'name-highlight';
        oldSpan.textContent = act.params.oldTitle;
        sub2.appendChild(oldSpan);
        sub2.appendChild(document.createTextNode(' → Nouveau nom : '));
        const newSpan = document.createElement('span');
        newSpan.className = 'name-highlight-new';
        newSpan.textContent = act.params.newTitle;
        sub2.appendChild(newSpan);
        detailsDiv.appendChild(sub2);
      } 
      else if (act.type === 'move_bookmark' || act.type === 'move_folder') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Déplacer de : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.sourcePath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);

        const sub2 = document.createElement('span');
        sub2.className = 'action-sub';
        sub2.textContent = 'Vers : ';
        const path2 = document.createElement('span');
        path2.className = 'path-highlight-target';
        path2.textContent = act.params.targetPath;
        sub2.appendChild(path2);
        detailsDiv.appendChild(sub2);
      } 
      else if (act.type === 'delete_folder') {
        const label = act.params.isEmptyNow 
          ? "Dossier vide (sera supprimé)" 
          : "Dossier vidé par la réorganisation (sera supprimé)";
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Dossier source : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.sourcePath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);

        const sub2 = document.createElement('span');
        sub2.className = 'action-sub';
        sub2.style.color = 'var(--error-color)';
        sub2.style.fontWeight = '500';
        sub2.textContent = label;
        detailsDiv.appendChild(sub2);
      }

      if (act.url) {
        if (isSafeUrl(act.url)) {
          const link = document.createElement('a');
          link.href = act.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.className = 'action-sub-link';
          link.textContent = act.url;
          detailsDiv.appendChild(link);
        } else {
          const sub = document.createElement('span');
          sub.className = 'action-sub';
          sub.title = 'Schéma non-HTTP';
          sub.textContent = act.url;
          detailsDiv.appendChild(sub);
        }
      }

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(detailsDiv);
      groupDiv.appendChild(itemDiv);

      // Event listener for inline editing
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startInlineEdit(act.id, itemDiv);
      });

      // Event listener for checkbox status update
      checkbox.addEventListener('change', updateApplyButtonState);
    }

    if (actionListContainer) actionListContainer.appendChild(groupDiv);
  }

  showView('validation');
}

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
    showToast('Aucune modification sélectionnée');
    return;
  }

  const title = chrome.i18n.getMessage('btnApply') || 'Apply selected changes';
  const message = chrome.i18n.getMessage('dialogConfirmApply') || 'Are you sure you want to apply changes?';
  const ok = await showConfirm(title, message);
  if (!ok) return;

  if (btnApply) {
    btnApply.disabled = true;
    btnApply.textContent = 'Application en cours...';
  }
  if (btnCancel) btnCancel.disabled = true;

  chrome.runtime.sendMessage({
    action: 'apply_changes',
    approvedActionIds: approvedActionIds
  }, (response) => {
    if (btnApply) {
      btnApply.textContent = 'Appliquer la sélection';
      btnApply.disabled = false;
    }
    if (btnCancel) btnCancel.disabled = false;

    if (chrome.runtime.lastError) {
      addLog(`Erreur système lors de l'application : ${chrome.runtime.lastError.message}`, 'error');
      showToast("Échec de l'application");
      return;
    }

    if (response && response.success) {
      showToast('Favoris mis à jour !');
      showView('main');
      addLog('> Les modifications sélectionnées ont été appliquées avec succès !', 'success');
      addLog('> Vos favoris sont maintenant à jour.', 'success');
    } else {
      const errorMsg = response?.error || 'Erreur inconnue.';
      addLog(`Erreur lors de l'application : ${errorMsg}`, 'error');
      showToast("Échec de l'application");
    }
  });
}

export function startInlineEdit(actionId, itemDiv) {
  chrome.storage.local.get(['pendingActions', 'extensionStatus'], (res) => {
    const actions = res.pendingActions || [];
    const status = res.extensionStatus || {};
    const actionIndex = actions.findIndex(a => a.id === actionId);
    if (actionIndex === -1) return;
    
    const act = actions[actionIndex];
    const detailsDiv = itemDiv.querySelector('.action-details');
    if (!detailsDiv) return;
    
    // Save original layout
    const originalChildren = Array.from(detailsDiv.childNodes);
    detailsDiv.textContent = '';
    
    const editContainer = document.createElement('div');
    editContainer.style.cssText = 'display: flex; flex-direction: column; gap: 6px; margin-top: 6px; background: rgba(255, 255, 255, 0.03); padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); animation: fadeIn 0.2s ease-out;';

    const group1 = document.createElement('div');
    group1.className = 'form-group';
    group1.style.marginBottom = '0';
    const label1 = document.createElement('label');
    label1.style.fontSize = '10px';
    label1.style.display = 'block';
    label1.style.marginBottom = '2px';
    label1.textContent = chrome.i18n.getMessage('btnEdit') || 'Titre';
    const input1 = document.createElement('input');
    input1.type = 'text';
    input1.className = 'edit-inline-title';
    input1.value = act.title;
    input1.style.cssText = 'padding: 4px 8px; font-size: 11px; width: 100%;';
    group1.appendChild(label1);
    group1.appendChild(input1);
    editContainer.appendChild(group1);

    let input2 = null;
    if (act.url) {
      const group2 = document.createElement('div');
      group2.className = 'form-group';
      group2.style.cssText = 'margin-bottom: 0; margin-top: 4px;';
      const label2 = document.createElement('label');
      label2.style.fontSize = '10px';
      label2.style.display = 'block';
      label2.style.marginBottom = '2px';
      label2.textContent = 'URL';
      input2 = document.createElement('input');
      input2.type = 'text';
      input2.className = 'edit-inline-url';
      input2.value = act.url;
      input2.style.cssText = 'padding: 4px 8px; font-size: 11px; width: 100%;';
      group2.appendChild(label2);
      group2.appendChild(input2);
      editContainer.appendChild(group2);
    }

    // Add folder selector for bookmark actions
    let folderSelect = null;
    if (act.url && (act.type === 'move_bookmark' || act.type === 'rename_bookmark' || act.type === 'delete_dead' || act.type === 'delete_duplicate')) {
      const groupFolder = document.createElement('div');
      groupFolder.className = 'form-group';
      groupFolder.style.cssText = 'margin-bottom: 0; margin-top: 4px;';
      const labelFolder = document.createElement('label');
      labelFolder.style.fontSize = '10px';
      labelFolder.style.display = 'block';
      labelFolder.style.marginBottom = '2px';
      labelFolder.textContent = chrome.i18n.getMessage('lightFolderLabel') || 'Dossier cible';
      folderSelect = document.createElement('select');
      folderSelect.className = 'edit-inline-folder';
      folderSelect.style.cssText = 'padding: 4px 8px; font-size: 11px; width: 100%;';

      // Populate folder select
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = chrome.i18n.getMessage('lightSelectFolder') || 'Sélectionner un dossier...';
      folderSelect.appendChild(placeholder);

      // Load folders on demand for inline editing
      chrome.runtime.sendMessage({ action: 'get_folders' }, (response) => {
        if (response && response.folders && response.folders.length > 0) {
          response.folders.forEach(folder => {
            const option = document.createElement('option');
            option.value = folder.id;
            const parts = folder.path.split(' > ');
            const roots = ['Barre de favoris', 'Favoris', 'Bookmarks bar', 'Bookmarks Bar', 'Other bookmarks', 'Autres favoris', 'Mobile bookmarks'];
            const displayPath = parts.length > 1 && roots.includes(parts[0]) ? parts.slice(1).join(' > ') : parts.join(' > ');
            option.textContent = displayPath;
            folderSelect.appendChild(option);
          });

          // Pre-select target folder
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

    const buttonRow = document.createElement('div');
    buttonRow.style.cssText = 'display: flex; gap: 8px; margin-top: 6px; justify-content: flex-end;';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-flat btn-inline-cancel';
    cancelBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; border-radius: 4px; height: auto;';
    cancelBtn.textContent = chrome.i18n.getMessage('btnCancel') || 'Annuler';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary btn-inline-save';
    saveBtn.style.cssText = 'padding: 4px 8px; font-size: 10px; border-radius: 4px; height: auto; background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: none;';
    saveBtn.textContent = chrome.i18n.getMessage('btnSave') || 'Enregistrer';

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
        showToast("Le titre ne peut pas être vide");
        return;
      }

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
            oldTitle: act.title,
            newUrl: newUrl,
            sourcePath: act.params.sourcePath || act.params.originalPath
          };
        } else if (act.type === 'rename_bookmark' || act.type === 'move_bookmark') {
          act.params.newTitle = newTitle;
          act.params.newUrl = newUrl;
        }
      } else {
        if (act.type === 'rename_folder' || act.type === 'move_folder') {
          act.params.newTitle = newTitle;
        }
      }

      // Handle folder change
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
        showToast(chrome.i18n.getMessage('logReady') ? "Change saved!" : "Favori mis à jour !");
        displayRapport(actions, status.explanation, status.mode);
      });
    });
  });
}

export function updateApplyButtonState() {
  const actionListContainer = document.getElementById('actionListContainer');
  const btnApply = document.getElementById('btnApply');
  if (!actionListContainer || !btnApply) return;
  const checkboxes = actionListContainer.querySelectorAll('.action-checkbox:checked');
  btnApply.disabled = checkboxes.length === 0;
}

export function restoreStatus() {
  chrome.runtime.sendMessage({ action: 'get_current_status' }, (status) => {
    if (chrome.runtime.lastError || !status) return;

    const btnStopReorg = document.getElementById('btnStopReorg');
    const reorgBtnGroup = document.getElementById('reorgBtnGroup');
    const logContainer = document.getElementById('logContainer');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBar = document.getElementById('progressBar');
    const checkDeadLinksCheckbox = document.getElementById('checkDeadLinks');
    const bookmarkFolderSelect = document.getElementById('bookmarkFolderSelect');

    // Restore dead links and folder select state
    if (checkDeadLinksCheckbox && status.lastCheckDeadLinks !== undefined) {
      checkDeadLinksCheckbox.checked = status.lastCheckDeadLinks === true;
    }
    if (bookmarkFolderSelect && status.lastConfig?.bookmarkFolderId) {
      bookmarkFolderSelect.value = status.lastConfig.bookmarkFolderId;
    }

    if (status.state === 'analyzing') {
      setControlsDisabled(true);
      if (reorgBtnGroup) reorgBtnGroup.classList.add('hidden');
      if (btnStopReorg) btnStopReorg.classList.remove('hidden');

      if (logContainer) {
        logContainer.innerHTML = '';
        status.logs.forEach(log => addLog(log.text, log.type));
      }
      addLoadingLog('Interrogation de l\'IA en cours...');
      if (progressBarContainer) progressBarContainer.style.display = 'block';
      if (progressBar) progressBar.style.width = `${status.percentage || 5}%`;
    } 
    else if (status.state === 'waiting_validation') {
      setControlsDisabled(false);
      if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
      if (btnStopReorg) btnStopReorg.classList.add('hidden');

      displayRapport(status.actions, status.explanation, status.mode);
    } 
    else {
      setControlsDisabled(false);
      if (reorgBtnGroup) reorgBtnGroup.classList.remove('hidden');
      if (btnStopReorg) btnStopReorg.classList.add('hidden');

      if (logContainer && status.logs.length > 0) {
        logContainer.innerHTML = '';
        status.logs.forEach(log => addLog(log.text, log.type));
      }

      if (status.retryable && status.lastError) {
        showRetryButton(status.mode);
      }
    }
  });
}

/**
 * Popup reorganization report rendering.
 */

import { formatExplanation, addLog, isSafeUrl } from './utils.js';
import { updateApplyButtonState } from './actions.js';
import { showView } from './navigation.js';

export function displayRapport(actions, explanation, mode) {
  const explanationBlock = document.getElementById('explanationBlock');
  const iaExplanationText = document.getElementById('iaExplanationText');
  const reorgModeBadge = document.getElementById('reorgModeBadge');
  const actionCountSpan = document.getElementById('actionCount');
  const actionListContainer = document.getElementById('actionListContainer');
  const btnApply = document.getElementById('btnApply');
  const btnCancel = document.getElementById('btnCancel');

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

        const headerMatch = trimmed.match(/^\*\*(.+)\*\*$/);
        if (headerMatch) {
          const h = document.createElement('span');
          h.className = 'expl-section';
          h.textContent = headerMatch[1];
          iaExplanationText.appendChild(h);
          continue;
        }

        if (/^[-•] /.test(trimmed)) {
          const item = document.createElement('div');
          item.className = 'expl-item';
          item.textContent = trimmed.replace(/^[-•] /, '');
          iaExplanationText.appendChild(item);
          continue;
        }

        if (trimmed) {
          const item = document.createElement('div');
          item.className = 'expl-item';
          item.textContent = trimmed;
          iaExplanationText.appendChild(item);
        }
      }
    }
  } else if (explanationBlock) {
    explanationBlock.style.display = 'none';
  }

  if (actionCountSpan) {
    actionCountSpan.textContent = chrome.i18n.getMessage('actionCount', [String(actions.length)]) || `${actions.length} modifications proposées`;
  }
  if (actionListContainer) {
    actionListContainer.textContent = '';
  }

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
  if (btnCancel) btnCancel.textContent = chrome.i18n.getMessage('btnBack') || 'Retour';

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
      } else if (act.type === 'delete_dead') {
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
      } else if (act.type === 'create_folder') {
        const sub1 = document.createElement('span');
        sub1.className = 'action-sub';
        sub1.textContent = 'Créer sous : ';
        const path1 = document.createElement('span');
        path1.className = 'path-highlight';
        path1.textContent = act.params.targetPath;
        sub1.appendChild(path1);
        detailsDiv.appendChild(sub1);
      } else if (act.type === 'rename_folder' || act.type === 'rename_bookmark') {
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
      } else if (act.type === 'move_bookmark' || act.type === 'move_folder') {
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
      } else if (act.type === 'delete_folder') {
        const label = act.params.isEmptyNow
          ? 'Dossier vide (sera supprimé)'
          : 'Dossier vidé par la réorganisation (sera supprimé)';
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

      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        startInlineEdit(act.id, itemDiv);
      });

      checkbox.addEventListener('change', updateApplyButtonState);
    }

    if (actionListContainer) actionListContainer.appendChild(groupDiv);
  }

  showView('validation');
}

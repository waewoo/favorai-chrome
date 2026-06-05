/**
 * Popup Navigation & Tab Management
 */

export function switchTab(tabId) {
  const tabs = {
    rangement: { btn: 'tabRangementBtn', panel: 'tabRangementPanel' },
    config: { btn: 'tabConfigBtn', panel: 'tabConfigPanel' },
    history: { btn: 'tabHistoryBtn', panel: 'tabHistoryPanel' },
    forgotten: { btn: 'tabForgottenBtn', panel: 'tabForgottenPanel' },
    docs: { btn: 'tabDocsBtn', panel: 'tabDocumentationPanel' },
    about: { btn: 'tabAboutBtn', panel: 'tabAboutPanel' }
  };

  for (const id in tabs) {
    const btn = document.getElementById(tabs[id].btn);
    const panel = document.getElementById(tabs[id].panel);
    if (id === tabId) {
      if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
      if (panel) panel.classList.remove('hidden');
    } else {
      if (btn) { btn.classList.remove('active'); btn.setAttribute('aria-selected', 'false'); }
      if (panel) panel.classList.add('hidden');
    }
  }

  // Update active tab in local storage
  chrome.storage.local.set({ activeTab: tabId });
}

export function showView(viewName) {
  const mainView = document.getElementById('mainView');
  const validationView = document.getElementById('validationView');
  
  if (viewName === 'main') {
    if (mainView) mainView.classList.remove('hidden');
    if (validationView) validationView.classList.add('hidden');
  } else if (viewName === 'validation') {
    if (mainView) mainView.classList.add('hidden');
    if (validationView) validationView.classList.remove('hidden');
  }
}

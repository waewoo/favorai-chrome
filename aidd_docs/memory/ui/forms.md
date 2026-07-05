# Forms

## Approach

- Native inputs, selects, checkboxes, and textareas handle the popup forms.
- Shared form behavior lives in `src/popup/config.js` and related popup modules.

## Conventions

- Validate provider, URL, key, and model fields before saving config.
- Store stable settings in `chrome.storage.sync`; keep transient UI state in `chrome.storage.local`.
- Show validation errors in banners or toasts instead of browser alerts.


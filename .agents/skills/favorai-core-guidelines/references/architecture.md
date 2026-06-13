# Architecture

## Scope

FavorAI is a Manifest V3 Chrome extension for AI-assisted bookmark cleanup and reorganization.

## Main boundaries

- `extension/background.js` is the service worker entrypoint.
- `src/background/` owns orchestration, analysis, diffing, apply, and history.
- `src/llm/` owns provider dispatch and provider-specific API logic.
- `src/popup/` owns popup UI behavior.
- `src/utils/` owns shared helpers.

## State rules

- Keep long-lived workflow state in `chrome.storage.local`.
- Use `chrome.storage.sync` only for stable user settings.
- Do not rely on service-worker memory for critical workflow state.
- Keep bookmark mutations sequential and reversible.

## Data handling

- Treat bookmark titles, URLs, and tree structure as untrusted input.
- Do not move provider network calls into the popup.
- Keep secrets out of logs and debug output.

## Workflow

1. Analyze bookmark data in the background worker.
2. Dispatch the prepared payload to the selected LLM provider.
3. Restore local metadata and align IDs.
4. Apply the approved bookmark mutations.
5. Record history for rollback.

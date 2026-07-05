# AI Operating Guidelines

How this team drives AI coding assistants on this project. Keep it short and specific to FavorAI.

## House rules

- Bookmark titles and URLs are untrusted input. Use DOM APIs and `textContent`; avoid unsafe HTML rendering.
- Network calls for LLM providers stay in the background service worker. The popup should not own provider fetches.
- Keep the `new_` folder contract intact and restore bookmark metadata client-side after LLM output.
- Persist workflow state in `chrome.storage.local`; use `chrome.storage.sync` only for stable user settings.

## Validation depth

- Run `make lint && make test` for normal code changes.
- Run `make test-e2e` for popup or browser-flow changes.
- Run `make security` for provider, auth, URL handling, or rendering changes.

## When the AI drifts

- Restate the exact scope, check the relevant source and tests, and continue with the smallest fix that matches the request.


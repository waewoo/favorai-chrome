# Codebase Audit: FavorAI Chrome Extension

The extension is broadly solid, but the biggest risks are secret handling and debug logging around LLM requests.

- **Date**: 2026-07-05
- **Scope**: full repo, all seven pillars
- **Health**: fair
- **Findings**: 0 critical, 3 warning, 1 minor

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| 🟡 | security | `src/popup/config.js:114` | The API key is loaded from and saved to `chrome.storage.sync`, so it is synced across browser profiles and backed by browser sync rather than kept local. That increases the blast radius for a credential and contradicts the repo rule that sync is for stable preferences. | Move `apiKey` to `chrome.storage.local` or another non-synced store, keep only non-secret preferences in sync, and update the privacy-policy copy accordingly. | M |
| 🟡 | security | `src/background/analysis.js:616` | Debug mode logs the cleaned bookmark tree, prompt text, and raw LLM response. That can expose bookmark titles, URLs, and model output in developer tools or log captures. | Redact content-heavy debug logs, keep only counts/status metadata, and gate any payload dumps behind a stricter local-only debug path. | M |
| 🟡 | tests | `src/popup/config.js:114` | The config flow has no direct unit coverage for persistence, restore, or model-fetch behavior. Given that this module handles API keys, provider selection, and remote model enumeration, regressions here would be easy to miss. | Add focused unit tests for `loadConfig`, `saveConfig`, and `fetchModelsFromApi`, including provider-specific branches and storage writes. | M |
| 🟢 | code-quality | `src/popup/utils.js:97` | `isSafeUrl()` is duplicated here even though the same helper already exists in `src/utils/isSafeUrl.js`. The copies can drift and make URL handling inconsistent across call sites. | Re-export the shared helper or import it directly everywhere, then delete the duplicate body. | S |

## Top actions

1. Fix the API-key storage path and privacy copy from finding `security-1`, then hand off to `refactor`.
2. Remove or redact the debug payload logging in the LLM path from finding `security-2`, then hand off to `refactor`.
3. Add config-flow unit tests and collapse the duplicate `isSafeUrl` helper from findings `tests-1` and `code-quality-1`, then hand off to `test` and `refactor`.

## Coverage

- **Scanned**: code-quality, architecture, security, dependencies, performance, tests, ui
- **Skipped**: none


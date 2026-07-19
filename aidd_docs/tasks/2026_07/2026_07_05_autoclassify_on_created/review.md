---
status: accepted-with-follow-up
---

# Review: Auto-classification des nouveaux bookmarks

- **Verdict**: accepted-with-follow-up
- **Implementation**: `049db06` (`feat(bookmarks): classify new bookmarks with AI`)
- **Date**: 2026-07-19
- **Findings**: 0 critical, 1 warning, 0 minor

## Acceptance

### Phase 1 - Contract & settings

- [x] The prompt and validator support an optional numeric confidence in the normalized `0..1` range - `src/llm/prompts.js`, `src/llm/utils.js`
- [x] The auto-move setting and `0.8` default are loaded, saved, reset, exported, and imported - `src/popup/config.js`

### Phase 2 - Background lifecycle

- [x] `chrome.bookmarks.onCreated` starts one background suggestion workflow and persists its state in local storage - `src/background/orchestrator.js`
- [x] Auto-move is gated by the enabled setting and configured confidence threshold - `src/background/orchestrator.js`
- [x] LLM failures persist an error state without calling bookmark mutation APIs - `src/background/orchestrator.js`

### Phase 3 - Popup fallback UX

- [x] Loading, suggestion, moved, and error states are rendered from persisted pending state - `extension/popup-light.js`
- [x] A user can choose a different destination when the AI target contains a duplicate - covered by the auto-classification popup E2E scenario - `tests/e2e/ui/popup-light.spec.js`
- [x] Auto mode exposes a dedicated title field for the title that will be applied; the read-only bookmark preview is not used as the submission source - `extension/popup-light.js`, `extension/popup-light.html`
- [x] The suggested folder is restored after folder options are populated - covered by the auto-classification popup E2E scenario - `extension/popup-light.js`, `tests/e2e/ui/popup-light.spec.js`

### Phase 4 - Tests & regression coverage

- [x] Unit tests cover confidence threshold auto-move, fallback persistence, loading, LLM failure, and manual-save suppression - `tests/unit/autoclassify.test.js`
- [x] The integration E2E flow passes with the localized suggested-folder label - `tests/e2e/integration/flows.spec.js`
- [ ] E2E coverage still does not exercise the complete `mode=autoclassify` apply-message path or persisted error-state rendering - `tests/e2e/ui/popup-light.spec.js`, `tests/unit/autoclassify.test.js`

## Finding

| Sev | Kind | Location | Issue | Follow-up |
| --- | --- | --- | --- | --- |
| warning | coverage | `tests/e2e/ui/popup-light.spec.js` | The current E2E coverage verifies loading, suggestion rendering, duplicate override, and folder selection, but not the final apply message or persisted error-state rendering in auto-classification mode. | Add focused E2E scenarios for successful apply and LLM failure/error rendering. |

## Verification

| Check | Result |
| --- | --- |
| Targeted unit tests | 7 passed in `tests/unit/autoclassify.test.js` |
| Integration E2E | 3 passed in `tests/e2e/integration/flows.spec.js` |
| Remaining risk | Auto-classification popup apply-message and persisted-error E2E coverage |

# Review: Auto-classification des nouveaux bookmarks

- **Verdict**: changes-requested
- **Diff**: `HEAD...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_14
- **Findings**: 0 critical, 5 warning, 0 minor

## Phases

### Phase 1 - Contract & settings

- [x] The prompt and validator support an optional numeric confidence in the normalized 0-1 range - `src/llm/prompts.js:236`, `src/llm/utils.js:441`
- [x] The auto-move setting and 0.8 default are loaded, saved, reset, exported, and imported - `src/popup/config.js:119`, `src/popup/config.js:211`, `src/popup/config.js:253`

### Phase 2 - Background lifecycle

- [x] `chrome.bookmarks.onCreated` starts one background suggestion workflow and persists its state in local storage - `src/background/orchestrator.js:133`, `src/background/orchestrator.js:378`
- [x] Auto-move is gated by the enabled setting and configured confidence threshold - `src/background/orchestrator.js:397`
- [x] LLM failures persist an error state without calling bookmark mutation APIs - `src/background/orchestrator.js:438`

### Phase 3 - Popup fallback UX

- [x] Loading, suggestion, moved, and error states are rendered from persisted pending state - `extension/popup-light.js:152`, `extension/popup-light.js:190`
- [ ] A user can reliably choose a different destination and apply it - the button remains disabled when the AI target matches an existing duplicate, even after the user selects another folder - `extension/popup-light.js:279`
- [ ] A user-edited bookmark title is applied from the visible bookmark-title field - auto mode reads a separate, unlabeled field instead - `extension/popup-light.js:342`, `extension/popup-light.html:446`, `extension/popup-light.html:521`
- [ ] A selected suggested folder is reliably displayed - concurrent folder loading can rebuild the select after its suggested value is assigned - `extension/popup-light.js:91`, `extension/popup-light.js:286`

### Phase 4 - Tests & regression coverage

- [x] Unit tests cover confidence threshold auto-move, fallback persistence, loading, LLM failure, and manual-save suppression - `tests/unit/autoclassify.test.js:70`
- [ ] The complete E2E suite passes - the popup-light integration expectation still requires `Nouveau dossier` instead of the changed localized label `Dossier cible proposé` - `tests/e2e/integration/flows.spec.js:360`
- [ ] Popup fallback coverage verifies manual target/title overrides and error rendering - no E2E test exercises the `mode=autoclassify` popup or the apply message path - `tests/e2e/ui/popup-light.spec.js:221`, `tests/unit/autoclassify.test.js:70`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| warning | functional | 3 | `extension/popup-light.js:279` | The confirmation state is computed only from the original AI target. If that target contains a duplicate, the button stays disabled after the user selects a safe alternative, so the requested manual override cannot be applied. | Recompute duplicate eligibility on the folder select change and enable the action when the selected destination differs from the duplicate folder. |
| warning | code | 3 | `extension/popup-light.js:342` | Auto mode submits `lightAutoTargetTitle`, while the visible bookmark title at the top is separately editable and never read. The user can edit what appears to be the bookmark name with no effect. | Keep one editable title source, or synchronize both fields and submit that single value. Add a clear accessible label if a second field remains. |
| warning | functional | 3 | `extension/popup-light.js:91`, `extension/popup-light.js:286` | `loadFolders()` and pending-state rendering race. When the pending state arrives first, the suggested select value is set before options exist; the later folder load rebuilds the options without restoring it, leaving the UI apparently unselected. | Populate then select deterministically, or retain the intended target ID and reapply it after each options refresh. |
| warning | code | 3 | `src/background/orchestrator.js:310`, `src/background/orchestrator.js:362`, `src/background/orchestrator.js:374` | A manual rename is performed before folder creation/move, but history is saved only after the move. If the later mutation fails, the rename remains with no rollback record. | Validate the destination before renaming and record/compensate each successful mutation if a later mutation fails. |
| warning | functional | 4 | `tests/e2e/integration/flows.spec.js:360` | `make test-e2e` fails because the changed label was not reflected in its pre-existing E2E assertion. The full browser regression gate is therefore red. | Update the assertion to the localized `lightSuggestedFolderLabel` behavior, then rerun the full E2E suite. |

## Verification

| Metric | Value |
| --- | --- |
| Verified | 64% (7/11) |
| Files checked | `src/background/orchestrator.js`, `extension/popup-light.js`, `extension/popup-light.html`, `src/popup/config.js`, `src/llm/prompts.js`, `src/llm/utils.js`, `_locales/fr/messages.json`, `_locales/en/messages.json`, `tests/unit/autoclassify.test.js`, `tests/e2e/integration/flows.spec.js`, `tests/e2e/ui/popup-light.spec.js` |
| Unchecked | Reliable manual target override - fix; visible title override - fix; deterministic suggested select - fix; full E2E pass - fix; autoclassify popup apply/error E2E coverage - fix |
| Unplanned | Quick-reorganization card interaction and associated UI test are related popup UX work but are outside the recorded auto-classification plan. |

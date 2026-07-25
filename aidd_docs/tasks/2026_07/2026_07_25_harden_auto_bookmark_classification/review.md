# Review: Harden automatic bookmark classification (#13)

- **Verdict**: approve
- **Diff**: `724920a...6639649`
- **Axes run**: code, functional, relevancy
- **Date**: 2026-07-25
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Contrat, réglages et état

- [x] Invalid policy values normalize to safe defaults, and disabled or confirmation-only policy never authorizes automatic mutation — `src/background/auto-bookmark-policy.js:13-54`, `tests/unit/autoBookmarkPolicy.test.js:10-48`
- [x] Queue items preserve bookmark snapshots, status, and cancellation state — `src/background/auto-bookmark-queue.js:17-123`, `tests/unit/autoBookmarkQueue.test.js:13-91`
- [x] Settings are localized, backward-compatible, and do not trigger network or bookmark operations — `src/popup/config.js:1-170`, `_locales/en/messages.json`, `_locales/fr/messages.json`

### Phase 2 — File background et détection des rafales

- [x] `onCreated` validates URL bookmarks, ignores managed copies, and enqueues work — `src/background/orchestrator.js:146-186`
- [x] Queue processing is sequential, debounced, cancellable, and recoverable — `src/background/auto-bookmark-queue.js:36-157`, `tests/unit/autoBookmarkQueue.test.js:13-91`
- [x] Burst protection and daily call limits persist visible recoverable states — `src/background/auto-bookmark-queue.js:61-76`, `src/background/orchestrator.js:535-554`, `tests/unit/autoclassify.test.js:284-304`

### Phase 3 — Revalidation, cancellation et mutations sûres

- [x] Changed bookmark state produces a stale state with no mutation — `src/background/orchestrator.js:248-264`, `tests/unit/autoclassify.test.js:386-401`
- [x] Cancellation prevents late queue results from being marked done or applied — `src/background/auto-bookmark-queue.js:116-157`, `tests/unit/autoBookmarkQueue.test.js:71-91`
- [x] Automatic mutations record history and support rollback, including partial failures — `src/background/orchestrator.js:414-500`, `src/background/history.js:1-120`, `tests/unit/autoclassify.test.js:352-384`

### Phase 4 — UX de confirmation, erreurs et undo

- [x] Persisted loading, uncertain, stale, canceled, rate-limited, error, suggestion, moved, and undone states have distinct rendering — `extension/popup-light.js:187-320`
- [x] Confirmation and one-click undo are exposed without opening advanced mode — `extension/popup-light.js:340-430`
- [x] English/French labels and safe DOM rendering are preserved — `extension/popup-light.js:1-815`, `_locales/en/messages.json`, `_locales/fr/messages.json`

### Phase 5 — Tests unitaires et E2E

- [x] Unit tests cover policy, queueing, bursts, cancellation, restart recovery, limits, stale state, and rollback — `tests/unit/autoBookmarkPolicy.test.js`, `tests/unit/autoBookmarkQueue.test.js`, `tests/unit/autoclassify.test.js`
- [x] Unit tests prove stale items remain untouched and automatic mutations have rollback paths — `tests/unit/autoclassify.test.js:352-401`, `tests/unit/history.test.js`
- [x] E2E tests observe the complete success/error/skip/undo journey — the E2E suite applies and undoes a real moved bookmark, and covers persisted error and untouched states — `tests/e2e/ui/popup-light.spec.js:321-399`

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
None.

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (15/15)                                     |
| Files checked | `src/background/`, `src/popup/`, `extension/popup-light.js`, `_locales/`, `tests/unit/`, `tests/e2e/` |
| Unchecked     | none                                              |
| Unplanned     | none                                              |

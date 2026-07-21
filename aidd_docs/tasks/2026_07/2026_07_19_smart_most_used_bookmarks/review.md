# Review: Managed folder for most-used bookmarks

- **Verdict**: approved with non-blocking follow-up
- **Diff**: `main...feat/most-used-bookmarks` (working tree)
- **Axes run**: code, functional, relevancy
- **Date**: 2026-07-22

## Verified criteria

- [x] Ranking uses the configured time window, deterministic ordering, and a ten-item cap — `src/background/most-used.js`
- [x] History activity stays local and refreshes through the service worker — `src/background/most-used.js`, `src/background/orchestrator.js`
- [x] A real Chrome folder is created or recovered under the bookmarks bar — `src/background/most-used.js`
- [x] Originals are preserved and managed copies are reconciled sequentially — `src/background/most-used.js`
- [x] Only descendants of the managed folder are exempt from duplicate cleanup — `src/background/analysis.js`
- [x] The managed folder is protected from the LLM tree and generated reorganization actions — `src/background/analysis.js`, `src/background/diff.js`
- [x] Legacy `folderMostVisited` / `new_most_visited` injection is removed — `src/background/analysis.js`
- [x] The old popup representation and obsolete localization entries are removed — `extension/`, `src/popup/`, `_locales/`
- [x] E2E verifies stale-copy reconciliation and original preservation — `tests/e2e/integration/most-used-bookmarks.spec.js`

## Non-blocking follow-up

- A browser test could later cover ranking with seeded history events. The current E2E covers the real folder lifecycle and reconciliation; Chrome history timestamps are not deterministic in the extension fixture.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 9/9 acceptance criteria |
| Remaining | History-ranking E2E fixture enhancement only |

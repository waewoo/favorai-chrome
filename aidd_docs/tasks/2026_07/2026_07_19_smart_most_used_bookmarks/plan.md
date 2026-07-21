---
objective: "Users can maintain a dedicated folder of up to ten copied bookmarks ranked by recent Chrome History activity."
status: implemented
---

# Plan: Managed folder for most-used bookmarks

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Maintain a local managed folder of the ten most-used bookmarked URLs, while preserving every original bookmark and allowing duplicates only inside that folder. |
| **Source** | GitHub issue #23: https://github.com/waewoo/favorai-chrome/issues/23 |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Local ranking and MV3-safe refresh | [`phase-1.md`](./phase-1.md) |
| 2 | Managed-folder lifecycle and duplicate exemption | [`phase-2.md`](./phase-2.md) |
| 3 | Privacy and verification | [`phase-3.md`](./phase-3.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://github.com/waewoo/favorai-chrome/issues/23 | Feature scope, privacy constraints, and acceptance criteria |
| https://developer.chrome.com/docs/extensions/reference/api/history | Chrome History API is used locally for visit activity |

## Decisions

| Decision | Why |
| -------- | --- |
| Create a managed folder named `⭐ Les plus consultés` under the bookmarks bar and populate it with copies | Chrome has no bookmark shortcut/reference type; copies preserve the original location. |
| Use a default 30-day window with a user-configurable local setting | It gives a useful recent ranking while satisfying the configurable-window requirement without involving the LLM. |
| Exempt only descendants of the managed folder from duplicate detection and cleanup | The folder is the single explicit exception requested by the user; duplicates elsewhere retain current behavior. |
| Use a dedicated conservative history-match URL key and retain the original bookmark URL for opening | Duplicate-detection normalization merges distinct URLs and must not be reused for activity attribution. |
| Persist refresh invalidation and use `chrome.alarms` for debounce | MV3 service workers may stop before in-memory timers run. |
| Reconcile the folder sequentially from the ranking and record its system folder ID in `chrome.storage.local` | The extension must safely find or recreate its managed folder without confusing a user folder with the same title. |
| Treat managed-folder copy maintenance as a system-owned cache operation, outside reorganization rollback history | Only derived copies are deleted/recreated; original bookmarks are never changed. |

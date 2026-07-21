---
status: done
---

# Instruction: Privacy and verification

## Architecture projection

```txt
.
├── extension/privacy_policy.html ✏️
├── tests/unit/mostUsedBookmarks.test.js ✏️
└── tests/unit/diff.test.js ✏️
```

## Tasks to do

### `1)` Verify managed-folder behavior

> Prove copies are maintained without changing original bookmarks.

1. Test ranking, URL filtering, time windows, counts, latest visit, deterministic ties, and the ten-item cap.
2. Test folder creation, recovery, stale-copy removal, empty/unavailable states, and original preservation.
3. Test the managed folder is excluded from duplicate detection and the LLM tree.

### `2)` Verify privacy and regressions

> Ensure history remains local and existing workflows remain safe.

1. Confirm browsing history is never sent to an LLM provider.
2. Confirm managed-folder maintenance is sequential and does not trigger auto-classification.
3. Run lint and unit tests.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Managed-folder copies remain synchronized while originals and ordinary duplicate handling are preserved. |
| 2 | Privacy, lint, unit, and relevant browser checks pass. |

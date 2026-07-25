---
objective: "Rendre la classification automatique des nouveaux favoris prévisible, résistante aux rafales et réversible, sans déplacer les favoris lorsque leur origine ou leur état est incertain."
status: implemented
---

# Plan: Renforcer la classification automatique des nouveaux favoris

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Sécuriser le flux `chrome.bookmarks.onCreated` avec une file persistante, des garde-fous d’origine et d’obsolescence, une limite d’appels et une annulation explicite. |
| **Source** | [GitHub issue #13](https://github.com/waewoo/favorai-chrome/issues/13) |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1   | Contrat, réglages et état | [`phase-1.md`](./phase-1.md) |
| 2   | File background et heuristiques de rafale | [`phase-2.md`](./phase-2.md) |
| 3   | Revalidation, cancellation et mutations sûres | [`phase-3.md`](./phase-3.md) |
| 4   | UX de confirmation, erreur et undo | [`phase-4.md`](./phase-4.md) |
| 5   | Tests unitaires et E2E | [`phase-5.md`](./phase-5.md) |

## Resources

| Source | Verified |
| ------ | -------- |
| https://github.com/waewoo/favorai-chrome/issues/13 | Scope, acceptance criteria, constraints and related issues verified on 2026-07-25 |
| https://developer.chrome.com/docs/extensions/reference/api/bookmarks | `onCreated` does not provide a reliable manual/import/sync origin flag; conservative heuristics are required |

## Decisions

| Decision | Why |
| -------- | ----- |
| Persist queue items and usage counters in `chrome.storage.local`, while keeping user policy in `chrome.storage.sync` | MV3 workers are ephemeral; runtime state must survive restart without consuming sync quota |
| Default to confirmation-only when origin is uncertain, confidence is below threshold, or the daily budget is exhausted | Automatic mutation must remain opt-in and must not silently act on ambiguous events |
| Reuse `suggestBookmarkLocation()`, `applyAutoBookmarkSuggestion()`, and the existing history/rollback path | Keeps provider dispatch, bookmark mutation, and reversibility centralized |

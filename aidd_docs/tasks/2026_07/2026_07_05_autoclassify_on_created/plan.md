---
objective: "Auto-classify new bookmarks on creation with an optional auto-move threshold and a fallback 'Déplacer quand même' popup."
status: implemented
---

# Plan: Auto-classification des nouveaux bookmarks

## Overview

| Field      | Value |
| ---------- | ----- |
| **Goal**   | Brancher `chrome.bookmarks.onCreated` sur la suggestion LLM existante, avec auto-move configurable et fallback utilisateur. |
| **Source** | User request + current `src/background/orchestrator.js` / `src/llm/index.js` / `extension/popup-light.js` flow |

## Phases

| #   | Phase | File |
| --- | ----- | ---- |
| 1 | Contract & settings | [`phase-1.md`](./phase-1.md) |
| 2 | Background lifecycle | [`phase-2.md`](./phase-2.md) |
| 3 | Popup fallback UX | [`phase-3.md`](./phase-3.md) |
| 4 | Tests & regression coverage | [`phase-4.md`](./phase-4.md) |

## Decisions

| Decision | Why |
| -------- | --- |
| Reuse the existing suggestion LLM path instead of adding a second classifier pipeline | Keeps provider routing, prompt handling, and validation centralized. |
| Add a user setting for auto-move with a default threshold of `0.8` | Gives control without making the feature too aggressive by default. |
| Reuse the popup-light surface for the fallback UI | The repo already has a compact suggestion flow there, so it is the lowest-friction user-facing surface. |

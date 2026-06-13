---
name: bookmark-llm-validator
description: Validate LLM outputs for bookmark reorganization, JSON contracts, metadata restoration, and tree-alignment checks. Use when reviewing provider responses, prompt changes, parsing logic, or any reorganized bookmark payload.
---

# Bookmark LLM Validator

## Purpose

Use this skill to verify bookmark reorganization outputs before they are applied.

Read `favorai-core-guidelines` first when you need the shared LLM and bookmark contract rules.

## Checks

1. Parse the response as JSON first.
2. Require the top-level keys `reorganizedTree` and `explanation`.
3. Require existing bookmarks to contain only `id`.
4. Require new folders to use IDs that start with `new_`.
5. Confirm folder placement matches the target mode and does not invent fallback parents.
6. Restore titles and URLs from local metadata, not the model response.

## How To Review

- Point to the exact failing path or node.
- Prefer a narrow fix: prompt adjustment, parser guard, or tree-alignment change.
- Treat bookmark titles and URLs as untrusted input.

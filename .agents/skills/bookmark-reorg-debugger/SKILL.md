---
name: bookmark-reorg-debugger
description: Debug bookmark reorganization bugs across analysis, diff, apply, metadata restoration, and rollback history. Use when tracing incorrect folder moves, missing IDs, broken new_ folder handling, or mismatches between LLM output and bookmark mutations.
---

# Bookmark Reorg Debugger

## Purpose

Use this skill to diagnose bookmark reorganization failures end to end. Focus on the flow from sanitized tree generation to LLM response alignment, diff creation, bookmark mutation, and history preservation.

Read `favorai-core-guidelines` first when you need the project-wide rules and contract boundaries.

## Debug Flow

1. Reproduce the problem with one bookmark tree and one action path.
2. Check the input tree sent to the model.
3. Check the returned `reorganizedTree` before restore and alignment.
4. Inspect the generated actions or diff.
5. Verify apply logic, parent resolution, and rollback history.

## Checks

- Keep the `new_` folder contract intact.
- Restore titles and URLs from local metadata, not from the model.
- Do not silently fall back to the root when a `new_` parent cannot be resolved.
- Preserve sequential bookmark mutations and record failures explicitly.
- Treat bookmark data as untrusted input.

## Output

- State the first broken step in the pipeline.
- Name the exact file or function to inspect next.
- Prefer the smallest fix that keeps the contract intact.

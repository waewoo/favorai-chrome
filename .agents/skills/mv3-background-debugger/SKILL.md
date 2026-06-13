---
name: mv3-background-debugger
description: Debug Manifest V3 background-worker failures after triage, including popup-to-service-worker messaging, async lifecycle issues, and state bugs that need root-cause tracing.
---

# MV3 Background Debugger

## Purpose

Use this skill for root-cause tracing after first-pass triage points to a specific MV3 boundary.

Read `favorai-core-guidelines` first when you need the shared FavorAI architecture and storage rules.

## Trace

1. Reproduce the smallest failing path with the relevant popup or background action.
2. Follow the call across the failing boundary into `src/background/`, `src/llm/`, or `extension/background.js`.
3. Check the exact state transition, async handoff, or provider response that breaks the flow.
4. Confirm the fix preserves the contract from `favorai-core-guidelines`.

## Output

- State the failing boundary and the most likely root cause.
- Name the file or function that needs the fix.
- Prefer the smallest safe change that restores the contract.

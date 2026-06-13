---
name: mv3-background-troubleshooter
description: Troubleshoot Manifest V3 popup/background issues at first pass, including messaging, storage, lifecycle resets, and async browser API failures.
---

# MV3 Background Troubleshooter

## Purpose

Use this skill for first-pass triage when a popup or background flow is failing.

Read `favorai-core-guidelines` first when you need the shared FavorAI architecture and storage rules.

## Triage

1. Reproduce the issue with the smallest user action path.
2. Identify the boundary that first looks wrong: popup UI, messaging, storage, service worker lifecycle, or browser API.
3. Decide whether the case needs deeper root-cause tracing in `mv3-background-debugger`.

## Output

- Name the failing boundary and the next best skill to use if needed.
- Point to the most likely file or flow.
- Keep the initial fix narrow and contract-safe.

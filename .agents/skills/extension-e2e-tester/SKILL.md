---
name: extension-e2e-tester
description: Design and run end-to-end tests for Chrome extension flows, popup behavior, background orchestration, and storage-driven UI changes. Use when validating visible extension behavior, browser integration, or user-facing regressions.
---

# Extension E2E Tester

## Purpose

Use this skill to cover browser-visible extension behavior.

Read `favorai-core-guidelines` first when you need the shared extension boundaries and storage rules.

## Test Plan

1. Choose the smallest end-to-end path that proves the feature.
2. Use the existing Playwright and Chromium extension harness.
3. Cover one success path and one meaningful edge path.
4. Verify the visible UI plus the resulting storage or background state.

## Checks

- Place tests under `tests/e2e/` unless the repo already uses a tighter convention.
- Load the extension the same way the suite already does.
- Mock only what must be mocked.
- Prefer local fixtures and deterministic inputs.
- Keep selectors and waits resilient.

## Output

- State what flow is covered.
- Mention any browser or storage dependency the test relies on.
- Keep the test narrow enough to diagnose failures quickly.

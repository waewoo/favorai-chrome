---
name: favorai-core-guidelines
description: Shared FavorAI repository guidance for extension architecture, bookmark reorganization, LLM contracts, storage boundaries, and Chrome Web Store constraints. Use when working anywhere in the FavorAI repo or when another skill needs the project-wide rules.
---

# FavorAI Core Guidelines

## Purpose

Use this skill as the shared reference layer for FavorAI work. Read the references before changing extension behavior, bookmark reorganization, provider logic, or release-sensitive code.

## References

- `references/index.md` for the shared navigation map
- `references/architecture.md` for repo boundaries and runtime flow
- `references/bookmark-reorg.md` for LLM and mutation contracts
- `references/chrome-store.md` for MV3 and store readiness checks

## Use

- Read the matching reference before editing code in that area.
- Prefer the smallest change that preserves the documented contract.
- Treat bookmark titles, URLs, and provider output as untrusted input.
- Keep extension state in the documented storage layer.
- Recheck store and MV3 rules before any release-sensitive change.

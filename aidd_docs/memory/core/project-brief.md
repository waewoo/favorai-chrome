# Project Brief

## What it is

- FavorAI is a Manifest V3 Chrome extension for AI-assisted bookmark cleanup and reorganization.
- It helps users analyze bookmarks, review proposed moves, and apply changes safely.

## Why it exists

- Bookmark libraries get messy fast. The extension groups, rewrites, and tidies bookmarks with AI while preserving user control.

## Domain language

| Term | Meaning |
| ---- | ------- |
| `background service worker` | The MV3 worker that owns orchestration, network calls, and bookmark mutations. |
| `popup` | The browser UI the user interacts with. |
| `analysis` | The step that prepares bookmarks, calls the LLM, and builds proposed actions. |
| `apply` | The step that mutates bookmarks and records history. |
| `new_` folder | A new folder ID created during reorganization. |

## Key features

- AI-assisted bookmark reorganization.
- Duplicate and dead-link checks before AI work.
- Safe apply flow with rollback history.
- Provider configuration for local or hosted LLMs.
- Popup views for configuration, history, and reorganization review.


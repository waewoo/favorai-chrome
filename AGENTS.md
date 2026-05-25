# Developer and AI Agent Guide

This guide details the architecture of FavorAI to help developers and other agentic coding systems understand and modify the extension safely and efficiently.

---

## 📂 Project Architecture & File Structure

We follow a strict **Separation of Concerns** to isolate UI logic, background orchestration, and target API clients:

```
FavorAI/
├── manifest.json                    # Extension metadata, permissions & service worker declaration
├── background.js                    # Service Worker entrypoint (event router, keep-alive alarm listener)
├── popup.html                       # Popup UI layout (localized via data-i18n attributes)
├── popup.css                        # UI styling rules
├── popup.js                         # UI logic, state management, chrome.runtime messaging sender
├── Makefile                         # Unified interface for linting, testing, and packaging
├── src/
│   ├── background/
│   │   ├── analysis.js              # Runs duplicate detections, dead-link checks, flattens bookmarks
│   │   ├── diff.js                  # Aligns reorganized LLM outputs and builds node mappings
│   │   ├── apply.js                 # Safe updates, parent ID resolutions, deletions, and moves
│   │   └── history.js               # History tracking and bookmarks rollback mechanics
│   ├── llm/
│   │   ├── index.js                 # Unified LLM query routing and optimized prompt logic
│   │   ├── utils.js                 # LLM response parser, JSON sanitation, and fetch timeout helpers
│   │   └── providers/               # API clients wrappers (openai, gemini, mistral, ollama, etc.)
│   └── utils/
│       ├── constants.js             # Shared static constraints and browser structural root IDs
│       ├── escapeHtml.js            # XSS HTML escaper helper
│       └── isSafeUrl.js             # Scheme and syntax-level URL sanitization checker
```

---

## 🧬 Data Schemas & LLM Contracts

To maintain state integrity, AI agents must respect the exact schemas used for LLM payload exchanges:

### 1. Simplified Input Tree (Sent to LLM)
URLs and descriptions are stripped from the tree before sending to protect user privacy and save tokens.
```json
{
  "id": "1",
  "title": "Barre de favoris",
  "children": [
    { "id": "10", "title": "GitHub repository" },
    {
      "id": "2",
      "title": "Design resources",
      "children": [
        { "id": "11", "title": "CSS Gradients guide" }
      ]
    }
  ]
}
```

### 2. Reorganized Tree Output (Received from LLM)
The LLM response must be a valid JSON object containing a `reorganizedTree` and an `explanation`.
* **Important**: Bookmarks should only contain the `id` field. Titles/URLs are automatically restored on the client side using `restoreOriginalMetadata`.
* **Important**: New folders created by the LLM must use a prefix `new_` (e.g., `new_dev_tools`).
```json
{
  "reorganizedTree": {
    "id": "1",
    "title": "Barre de favoris",
    "children": [
      {
        "id": "new_dev_tools",
        "title": "Developer Tools",
        "children": [
          { "id": "10" }
        ]
      },
      {
        "id": "new_learning",
        "title": "Learning",
        "children": [
          { "id": "11" }
        ]
      }
    ]
  },
  "explanation": "Here is a brief description of the changes made..."
}
```

---

## 🧪 Testing & Mocking Architecture

All logical utility components must maintain **95%+ unit test coverage**. 

### 1. Mocking Chrome APIs
When writing unit tests under `tests/unit/`, do not invoke real browser APIs. A global mock system is pre-configured in [tests/setup.js](file:///d:/Travail/Projet/ExtentionChromiumGestionFavoris/tests/setup.js) using the mocks defined in [tests/mocks/chrome.js](file:///d:/Travail/Projet/ExtentionChromiumGestionFavoris/tests/mocks/chrome.js).
Ensure you mock return values explicitly inside your test cases when test targets make Chrome API calls:
```javascript
// Example of mocking Chrome API inside a test case
chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
```

### 2. Available Commands
AI agents should run these tasks to validate code changes:
- `make lint` : Validates coding styles and scans for syntax errors.
- `make test` : Runs the entire Vitest unit test suite.
- `make test-coverage` : Runs unit tests and prints the formatted global coverage summary.
- `make test-e2e` : Runs Playwright integration tests. Run this to check popup loading flows in a real Chromium context.
- `make clean` : Cleans temporary report folders, build files, and package zips.

---

## ⚠️ Common Gotchas & Extension Best Practices

To ensure compliance with Chrome and Edge Manifest V3 stores:

1. **Service Worker State Ephemerality**:
   - Background service workers are terminated after 30 seconds of inactivity.
   - Do **NOT** store state in memory variables (e.g., `let activeDiff = {...}`). 
   - **Fix**: Persist state to `chrome.storage.local` and retrieve it on event wakes.
2. **Sync Storage Write Limits**:
   - `chrome.storage.sync` write quota is limited to 120 writes per minute.
   - Do **NOT** write to `chrome.storage.sync` inside loop routines or rapid status changes. Use `chrome.storage.local` for dynamic logs or cache.
3. **Background Network Calls**:
   - All external fetch operations must run inside the background service worker. If executed inside the popup, the requests will abort when the user closes the popup window.
4. **XSS Security (CSP)**:
   - Remote script downloads or CDN loading is strictly blocked. All code must be local.
   - Avoid using `innerHTML`, `outerHTML`, or `document.write` to bind values. Use `textContent` or construct DOM elements programmatically using `document.createElement()`.
5. **SOLID, KISS, and DRY Principles**:
   - **TDD (Test-Driven Development)**: Write unit tests first before implementing logical changes, ensuring high code regression safety.
   - **SOLID**: Keep modules short, focused, and single-purpose.
   - **KISS**: Avoid complex, over-engineered layers.
   - **DRY**: Shared helpers (such as HTML escaping, URL checks) should reside under `src/utils/`.
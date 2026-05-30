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

All logical utility components must maintain **100% coverage** across **all metrics**:
- **Statements**: 100%
- **Branch**: 100%
- **Functions**: 100%
- **Lines**: 100%

**Per-file requirement**: Each utility file (`src/background/*.js`, `src/llm/*.js`, `src/utils/*.js`) must individually meet the 100% threshold for all four coverage metrics. No exceptions, no trade-offs.

### 1. Mocking Chrome APIs
When writing unit tests under `tests/unit/`, do not invoke real browser APIs. A global mock system is pre-configured in [tests/setup.js](file:///d:/Travail/Projet/ExtentionChromiumGestionFavoris/tests/setup.js) using the mocks defined in [tests/mocks/chrome.js](file:///d:/Travail/Projet/ExtentionChromiumGestionFavoris/tests/mocks/chrome.js).
Ensure you mock return values explicitly inside your test cases when test targets make Chrome API calls:
```javascript
// Example of mocking Chrome API inside a test case
chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
```

### 2. Available Commands
**CRITICAL: Always run the full test suite before committing changes.**

AI agents must run these tasks to validate code changes:
- `make lint` : Validates coding styles and scans for syntax errors. **Run this first**.
- `make test` : Runs the entire Vitest unit test suite (95%+ coverage required). **Run after lint**.
- `make test-coverage` : Runs unit tests and prints the formatted global coverage summary.
- `make test-e2e` : Runs Playwright end-to-end tests (93 tests covering UI structure, navigation, forms, i18n, and error handling). **Run after unit tests**. This validates actual browser behavior in Chromium context.
- `make clean` : Cleans temporary report folders, build files, and package zips.

**Recommended test workflow before committing:**
```bash
make lint && make test && make test-e2e
```

### 3. Test Coverage Requirements

**Unit Tests** (95%+ coverage):
- Located in `tests/unit/`
- Test utility functions, analysis logic, LLM parsing, diff calculations
- Mock Chrome APIs using `tests/mocks/chrome.js`
- Run with: `make test`

**E2E Tests** (93 tests, 7 test files):
- Located in `tests/e2e/`
- Test UI components, navigation, form inputs, internationalization, error handling
- Currently cover: popup structure, tab navigation, configuration forms, history display, reorganization UI, popup-light interface, error states
- **Add tests for new features**: When implementing a new feature, add corresponding e2e tests to `tests/e2e/` to catch integration errors early
- Run with: `make test-e2e`

**Best Practice: Test-Driven Development**
1. When adding a new feature, write the e2e test first
2. Implement the feature
3. Run full test suite (`make lint && make test && make test-e2e`)
4. All tests must pass before committing

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
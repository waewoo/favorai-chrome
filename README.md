# FavorAI

FavorAI is a Chrome and Chromium-based browser extension that helps you clean up and reorganize your bookmarks using AI.

## Key Features

- **Duplicate Detection**: Smart identification of duplicate links based on URL and depth.
- **Dead Link Verifier**: Checks for 404s, connection errors, and timeouts.
- **Bilingual Interface**: Seamlessly switches between English and French based on browser language.
- **Multi-Provider LLM Integration**: Works with OpenAI, Google Gemini, Anthropic Claude, Mistral AI, DeepSeek, Grok, Ollama (local), or any custom OpenAI-compatible endpoint.
- **Session History & Rollback**: Safely revert any reorganization session with a single click.
- **XSS Safe**: DOM content is rendered programmatically to avoid HTML injections.

## Directory Structure

```
├── manifest.json            # Manifest file (MV3)
├── background.js            # Background service worker entry point
├── popup.html               # Full popup view structure
├── popup-light.html         # Lightweight popup for quick bookmark saving
├── popup.js                 # Popup event handlers and UI localization
├── popup-light.js           # Lightweight popup logic
├── popup.css                # Shared popup styling
├── _locales/                # Internationalization folder
│   ├── en/messages.json
│   └── fr/messages.json
├── src/                     # Module files
│   ├── background/          # Background logic modules (analysis, apply, history, diff)
│   ├── llm/                 # LLM client wrappers + provider dispatch
│   └── utils/               # Sanitization helpers and constants
└── tests/                   # Automated Vitest unit tests and Playwright e2e tests
    ├── unit/                # 130 unit tests (Vitest)
    ├── e2e/                 # 106 e2e tests (Playwright)
    │   ├── helpers.js       # Shared launchExtension / gotoPopup / cleanup helpers
    │   ├── ui/              # UI spec files (structure, navigation, config, history, i18n, …)
    │   └── integration/     # Integration spec files (full reorganization flow)
    └── mocks/               # Chrome API mocks for unit tests
```

## Setup Instructions

### Loading the Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top right.
3. Click **Load unpacked** in the top left.
4. Select the root folder of this project (`favorai-chrome`).

### Local Development

To run tests, check linting, or package the extension, use the provided `Makefile`:

#### Makefile Commands

| Command | Description |
|---|---|
| `make install` | Install Node.js dependencies |
| `make lint` | Run ESLint code validation |
| `make lint-fix` | Auto-fix linter warnings |
| `make test` | Run Vitest unit tests (130 tests, 95%+ coverage) |
| `make test-watch` | Vitest in interactive watch mode |
| `make test-coverage` | Unit tests + coverage summary |
| `make test-e2e` | Run all Playwright e2e tests (106 tests) |
| `make test-e2e-ui` | UI e2e tests only |
| `make test-e2e-integration` | Integration e2e tests only |
| `make clean` | Remove coverage, reports, dist, zip files |
| `make clean-e2e` | Remove leftover Playwright Chrome tmp dirs and reports |
| `make kill-e2e` | Kill any stuck Playwright-spawned Chrome processes |
| `make package` | Package the extension into a ZIP for the Chrome Web Store |

#### Recommended workflow before committing

```bash
make lint && make test
```

For UI or integration changes, also run e2e tests:

```bash
make lint && make test && make test-e2e
```

#### Using npm scripts directly

```bash
npm install          # Install dependencies
npm run lint         # Run ESLint
npm run test         # Run unit tests
npm run test:e2e     # Run e2e tests
npm run package      # Package extension
```

## Architecture Notes

- **Service Worker**: All LLM queries and bookmark mutations run in the background service worker — never in the popup (requests abort on popup close).
- **Storage**: `chrome.storage.local` is used for all dynamic state (status, pending actions, history, popup window ID). `chrome.storage.sync` is only used for user configuration (API keys, provider settings).
- **Privacy**: Bookmark titles, structure, and URLs are sent to the configured external LLM provider for semantic classification. No data is sent to FavorAI servers.
- **Security**: API keys are never logged. Prompt templates use single-pass regex replacement to prevent injection via bookmark content.
- **i18n**: All user-facing strings use `chrome.i18n.getMessage()` with keys defined in `_locales/en/messages.json` and `_locales/fr/messages.json`.

# FavorAI

FavorAI is a Chrome and Chromium-based browser extension that helps you clean up and reorganize your bookmarks using AI.

## Key Features

- **Duplicate Detection**: Smart identification of duplicate links based on URL and depth.
- **Dead Link Verifier**: Checks for 404s, connection errors, and timeouts.
- **Bilingual Interface**: Seamlessly switches between English and French based on browser language.
- **Multi-Provider LLM Integration**: Works with OpenAI, Google Gemini, Mistral AI, Grok, Ollama (local), or any custom OpenAI-compatible endpoint.
- **Session History & Rollback**: Safely revert any reorganization session with a single click.
- **XSS and Privacy Safe**: Bookmark URLs are filtered out before sending structure to the AI, and DOM content is rendered programmatically to avoid HTML injections.

## Directory Structure

```
├── manifest.json            # Manifest file (MV3)
├── background.js            # Background service worker entry point
├── popup.html               # Popup view structure
├── popup.js                 # Popup event handlers and UI localization
├── popup.css                # Extracted and modernized popup styling
├── _locales/                # Internationalization folder
│   ├── en/messages.json
│   └── fr/messages.json
├── src/                     # Module files
│   ├── background/          # Background logic modules (analysis, apply, history, diff)
│   ├── llm/                 # LLM client wrappers
│   └── utils/               # Sanitization helpers and constants
└── tests/                   # Automated Vitest and Playwright tests
```

## Setup Instructions

### Loading the Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle **Developer mode** in the top right.
3. Click **Load unpacked** in the top left.
4. Select the root folder of this project (`favorai-chrome`).

### Local Development
To run tests, check linting, or package the extension, you can use either the npm scripts or the provided `Makefile`:

#### Using the Makefile (Recommended)
- **Install dependencies**: `make install`
- **Run linter checks**: `make lint`
- **Auto-fix linter warnings**: `make lint-fix`
- **Run Vitest unit tests**: `make test`
- **Run tests in watch mode**: `make test-watch`
- **Generate test coverage**: `make test-coverage`
- **Run Playwright E2E tests**: `make test-e2e`
- **Package extension for Chrome Web Store**: `make package`
- **Clean temporary/report files**: `make clean`

#### Using npm scripts directly
1. Install Node.js dependencies:
   ```bash
   npm install
   ```
2. Run unit tests using Vitest:
   ```bash
   npm run test
   ```
3. Run ESLint:
   ```bash
   npm run lint
   ```
4. Package the extension:
   ```bash
   npm run package
   ```
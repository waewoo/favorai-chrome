# FavorAI

[![FavorAI Extension CI](https://github.com/waewoo/favorai-chrome/actions/workflows/ci.yml/badge.svg)](https://github.com/waewoo/favorai-chrome/actions/workflows/ci.yml)
[![E2E Tests](https://github.com/waewoo/favorai-chrome/actions/workflows/e2e-tests.yml/badge.svg)](https://github.com/waewoo/favorai-chrome/actions/workflows/e2e-tests.yml)
[![Latest Release](https://img.shields.io/github/v/release/waewoo/favorai-chrome?display_name=tag&label=release)](https://github.com/waewoo/favorai-chrome/releases/latest)
[![Coverage](https://codecov.io/gh/waewoo/favorai-chrome/graph/badge.svg)](https://app.codecov.io/gh/waewoo/favorai-chrome)
[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red)](./LICENSE.md)

FavorAI is a Chrome and Chromium extension that helps you clean up, reorganize, and maintain your bookmarks with AI-assisted suggestions and local safety checks.

If FavorAI saves you time, you can support the project here:

<a href="https://buymeacoffee.com/waewoo"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="120"></a>

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Load the Extension in Chrome](#load-the-extension-in-chrome)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Makefile Commands](#makefile-commands)
- [Testing](#testing)
- [Security and Privacy](#security-and-privacy)
- [Release and Publishing](#release-and-publishing)
- [Architecture Notes](#architecture-notes)
- [Contributing](#contributing)

## Features

- **AI bookmark reorganization**: reorganizes bookmark trees while preserving original bookmark metadata client-side.
- **Duplicate detection**: detects exact URL duplicates, URL variants, tracking URLs, redirects to the same final page, and similar article content.
- **Dead link checks**: detects unreachable pages, 404 responses, connection errors, and request timeouts.
- **Smart bookmark placement**: suggests the best destination folder when saving a new bookmark.
- **Multi-provider LLM support**: works with OpenAI, Gemini, Claude, Mistral, DeepSeek, Grok, Ollama, and custom OpenAI-compatible endpoints.
- **Session history and rollback**: keeps reorganization sessions so users can revert safely.
- **Bilingual UI**: supports English and French through Chrome i18n.
- **XSS-conscious UI rendering**: avoids unsafe HTML injection patterns and uses escaping helpers where needed.

## Quick Start

```bash
make install
make lint
make test
```

Then load the project folder as an unpacked extension in Chrome.

For UI or integration changes, run the E2E suite too:

```bash
make lint
make test
make test-e2e
```

## Load the Extension in Chrome

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the root folder of this repository.

## Project Structure

```text
favorai-chrome/
|-- manifest.json                 # Extension metadata, permissions, and MV3 service worker
|-- background.js                 # Service worker entrypoint
|-- popup.html                    # Full popup UI
|-- popup-light.html              # Lightweight popup variant
|-- popup.css                     # Shared popup styling
|-- popup.js                      # Full popup entrypoint
|-- popup-light.js                # Lightweight popup entrypoint
|-- Makefile                      # Project task runner
|-- scripts/                      # Tooling, release, packaging, and cleanup scripts
|-- src/
|   |-- background/               # Analysis, diffing, applying changes, history, orchestration
|   |-- llm/                      # Prompt templates, response parsing, provider dispatch
|   |-- popup/                    # Modular popup UI logic
|   `-- utils/                    # Shared utility helpers
|-- tests/
|   |-- unit/                     # Vitest unit tests
|   |-- e2e/                      # Playwright UI and integration tests
|   `-- mocks/                    # Chrome API mocks
|-- store-assets/                 # Chrome Web Store listing assets and generators
|-- icons/                        # Extension icons
|-- fonts/                        # Bundled local fonts
`-- _locales/                     # English and French translations
```

## Development Workflow

Install dependencies once:

```bash
make install
```

Run the standard local check before committing:

```bash
make lint && make test
```

For UI, browser, or integration changes:

```bash
make lint && make test && make test-e2e
```

Git hooks are managed with Husky. The `prepare` npm script installs them after `npm install`; to regenerate hooks manually:

```bash
make install-hooks
```

The hooks currently enforce:

- `pre-commit`: `make lint`
- `pre-push`: `make test-coverage` (unit tests + coverage) and `make security`
- `commit-msg`: Conventional Commits validation through commitlint

CodeGraph is optional local indexing support for Codex and other MCP-aware agents:

```bash
make install-codegraph
```

This creates a local `.codegraph/` index, which is ignored by Git.

## Makefile Commands

Run `make` to print the command list.

### Setup

| Command | Description |
|---|---|
| `make install` | Install project dependencies with `npm install` |
| `make install-ci` | Install dependencies for CI with `npm ci --ignore-scripts` |
| `make install-hooks` | Regenerate Husky hooks through `npm run prepare` |
| `make install-codegraph` | Install and initialize CodeGraph for local indexing |

### Quality

| Command | Description |
|---|---|
| `make lint` | Run ESLint validation checks |
| `make lint-fix` | Auto-fix ESLint warnings and format issues |
| `make test` | Run the Vitest unit test suite |
| `make test-watch` | Run Vitest in interactive watch mode |
| `make test-coverage` | Run unit tests and print a coverage summary |
| `make test-mutation` | Run Stryker mutation testing |
| `make security` | Run dependency, static analysis, extension, and secret scans |
| `make check-deps` | Show outdated devDependencies |
| `make update-deps` | Upgrade devDependencies to latest published versions |

### E2E

| Command | Description |
|---|---|
| `make test-e2e` | Run the full Playwright suite |
| `make test-e2e-ui` | Run only Playwright UI specs |
| `make test-e2e-integration` | Run only Playwright integration specs |

### Release

| Command | Description |
|---|---|
| `make bump` | Auto-detect the SemVer bump type and update the changelog |
| `make bump-patch` | Increment the patch version manually |
| `make bump-minor` | Increment the minor version manually |
| `make bump-major` | Increment the major version manually |
| `make release` | Package, push tags, and create or update the GitHub release |
| `make package` | Package the extension into a ZIP file |
| `make screenshots` | Generate Chrome Web Store asset PNGs |
| `make upload` | Build the ZIP and upload it to the Chrome Web Store |
| `make publish` | Build, upload, and publish to all users |
| `make publish-testers` | Build, upload, and publish to trusted testers |

### Cleanup

| Command | Description |
|---|---|
| `make clean` | Remove build, test, mutation, and generated asset outputs |
| `make clean-e2e` | Remove leftover Playwright reports and temporary directories |
| `make kill-e2e` | Kill stuck Playwright or Chrome processes |

`make clean-e2e` is intentionally narrow and runs before E2E tests. `make clean` is the broader project cleanup and also removes generated ZIP files.

## Testing

Unit tests use Vitest and Chrome API mocks from `tests/mocks/chrome.js`. Tests that call Chrome APIs should explicitly mock return values, for example:

```javascript
chrome.bookmarks.getTree.mockResolvedValue([{ id: '0', title: 'Root', children: [] }]);
```

E2E tests use Playwright and load the extension as an unpacked Chromium extension. Shared helpers live in `tests/e2e/helpers.js`.

Useful commands:

```bash
make test
make test-coverage
make test-e2e
```

## Security and Privacy

- External network calls for LLM providers run from the background service worker.
- API keys must never be logged; debug output should mask secrets.
- Bookmark titles, URLs, and structure may be sent to the configured LLM provider for semantic classification.
- FavorAI does not send bookmark data to FavorAI-owned servers.
- User-facing DOM content should use `textContent`, DOM construction, or escaping helpers instead of raw `innerHTML`.
- Prompt templates use single-pass replacement to reduce prompt injection risk through bookmark titles or URLs.

Run the full local security audit with:

```bash
make security
```

The security workflow includes npm audit, ESLint security checks, web-ext lint, and Gitleaks. Install `gitleaks` locally or make Docker available for the fallback scanner.

## Release and Publishing

Create a local environment file:

```bash
cp .env.example .env
```

Fill in the Chrome Web Store credentials:

- `WEBSTORE_CLIENT_ID`
- `WEBSTORE_CLIENT_SECRET`
- `WEBSTORE_EXTENSION_ID`
- `WEBSTORE_REFRESH_TOKEN`

To obtain a refresh token:

```bash
node scripts/get-refresh-token.mjs
```

Recommended release flow:

```bash
make lint && make test && make test-e2e && make security
make bump
make publish
```

Use `make upload` for a draft upload, or `make publish-testers` for trusted testers.

## Architecture Notes

- **Background orchestration**: `background.js` loads `src/background/orchestrator.js`, which coordinates browser events, state, analysis, and applying changes.
- **Analysis pipeline**: `src/background/analysis.js` handles local duplicate checks, dead link validation, LLM preparation, response alignment, and action checklist generation.
- **LLM dispatch**: `src/llm/index.js` routes requests to provider modules in `src/llm/providers/`.
- **Safe apply flow**: `src/background/apply.js` performs bookmark mutations sequentially and resolves newly created folder IDs before moving children.
- **Popup modules**: `src/popup/` keeps configuration, navigation, history, reorganization, and utilities separated.
- **Storage model**: dynamic state uses `chrome.storage.local`; user configuration uses `chrome.storage.sync`.
- **Internationalization**: strings are stored in `_locales/en/messages.json` and `_locales/fr/messages.json`.

## Contributing

Use Conventional Commits, such as `feat: add prompt preset`, `fix(ui): align history panel`, or `docs: update release notes`.

Before opening a pull request, run:

```bash
make lint && make test
```

For UI or integration changes, also run:

```bash
make test-e2e
```

See [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md), and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) for project guidelines.

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
- [Release Workflow](#release-workflow)
- [Architecture Notes](#architecture-notes)
- [Contributing](#contributing)

## Features

- **AI bookmark reorganization**: reorganizes bookmark trees while preserving original bookmark metadata client-side.
- **Duplicate detection**: detects exact URL duplicates, URL variants, tracking URLs, redirects to the same final page, and similar article content.
- **Dead link checks**: detects unreachable pages, 404 responses, connection errors, and request timeouts.
- **Smart bookmark placement**: suggests the best destination folder when saving a new bookmark.
- **Multi-provider LLM support**: works with OpenAI, Gemini, Claude, Mistral, DeepSeek, Grok, Ollama, and custom OpenAI-compatible endpoints.
- **Folder size estimation**: shows a live bookmark count and approximate token estimate when a target folder is selected, so users can gauge cost and scope before launching.
- **Partial failure reporting**: apply operations collect per-operation failures and surface them individually in the UI instead of silently succeeding.
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

Recommended order for a feature branch:

1. Make the change.
2. Run `make lint && make test`.
3. If the UI changed, run `make test-e2e`.
4. If the change touches release-sensitive areas, run `make security`.
5. When everything is green, bump the version, create the GitHub release, then upload/publish to the Chrome Web Store.

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
| `make bump` | Auto-detect the SemVer bump, update the changelog, commit/tag, package, and create the GitHub release when `gh` is authenticated |
| `make bump-patch` | Increment the patch version manually |
| `make bump-minor` | Increment the minor version manually |
| `make bump-major` | Increment the major version manually |
| `make release` | Recreate or update the GitHub release for the current version/tag |
| `make package` | Package the extension into a ZIP file |
| `make screenshots` | Generate Chrome Web Store asset PNGs |
| `make upload` | Upload the ZIP to the Chrome Web Store as a draft update |
| `make publish` | Upload and publish to all users on the Chrome Web Store |
| `make publish-testers` | Upload and publish to trusted testers on the Chrome Web Store |

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

## Release Workflow

The release process is split into two parts:

1. GitHub release and version bump.
2. Chrome Web Store upload and publish.

If the UI changed, regenerate the store assets before publishing:

```bash
make screenshots
```

Before publishing to the Chrome Web Store, create a local `.env` file:

```bash
cp .env.example .env
```

Then fill in:

- `WEBSTORE_CLIENT_ID`
- `WEBSTORE_CLIENT_SECRET`
- `WEBSTORE_EXTENSION_ID`
- `WEBSTORE_REFRESH_TOKEN`

To obtain the refresh token once:

```bash
node scripts/get-refresh-token.mjs
```

Suggested end-to-end flow:

1. Run the local checks:

   ```bash
   make lint && make test && make test-e2e && make security
   ```

2. Bump the version:

   ```bash
   make bump
   ```

   Or use `make bump-patch`, `make bump-minor`, or `make bump-major` if you want to choose the SemVer step manually.

3. Handle the GitHub release:

   - `make bump` already commits, tags, packages, pushes, and creates the GitHub release when `gh` is authenticated.
   - If you already bumped the version manually and only need the GitHub side, run:

     ```bash
     make release
     ```

4. Upload to the Chrome Web Store:

   - Draft upload only:

     ```bash
     make upload
     ```

   - Publish to trusted testers:

     ```bash
     make publish-testers
     ```

   - Publish to all users:

     ```bash
     make publish
     ```

Use `make publish` only after the ZIP is ready and the store credentials are configured. `make upload` is the safer draft step when you want to check the package before publishing.

## Architecture Notes

- **Background orchestration**: `background.js` loads `src/background/orchestrator.js`, which coordinates browser events, state, analysis, and applying changes.
- **Analysis pipeline**: `src/background/analysis.js` handles local duplicate checks, dead link validation, LLM preparation, response alignment, and action checklist generation.
- **LLM dispatch**: `src/llm/index.js` routes requests to provider modules in `src/llm/providers/`.
- **Safe apply flow**: `src/background/apply.js` performs bookmark mutations sequentially, resolves newly created folder IDs before moving children, and returns `{ failures }` — an array of per-operation errors surfaced in the popup instead of silently swallowed.
- **Popup modules**: `src/popup/` keeps configuration, navigation, history, reorganization, and utilities separated. `progress.js` exposes `updateFolderStats()` to estimate bookmark count and token usage for the selected folder before launch.
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

# Claude Code Configuration for FavorAI

This file contains configuration and context for Claude Code and AI agents working on the FavorAI Chrome extension project.

## 📋 Quick Reference

**Before starting work:**
1. Read [AGENTS.md](./AGENTS.md) - Complete architecture, data schemas, testing requirements
2. Read [README.md](./README.md) - User-facing documentation

**Before committing:**
```bash
make lint && make test && make test-e2e
```

## 🔗 Key Documentation

### [AGENTS.md](./AGENTS.md)
- **Purpose**: Architecture guide for AI agents and developers
- **Contains**:
  - Project structure and file organization
  - LLM data schemas (input/output contracts)
  - Chrome extension best practices & gotchas
  - Testing architecture and coverage requirements
  - Mocking strategy for Chrome APIs
  - Available make commands

### Development Standards
- **Language**: JavaScript (ES6+)
- **Testing Framework**: Vitest (unit tests), Playwright (e2e tests)
- **Linting**: ESLint
- **Minimum Test Coverage**: 95% for logical utilities
- **E2E Test Suite**: 93 tests covering UI, navigation, forms, i18n, errors
- **Architecture Style**: Separation of concerns (UI, background service worker, utilities)

## 🧪 Testing Strategy

### Unit Tests (95%+ coverage)
- Location: `tests/unit/`
- Target: Utility functions, analysis logic, LLM parsing, diff calculations
- Command: `make test`
- Always mock Chrome APIs using `tests/mocks/chrome.js`

### E2E Tests (93 tests, comprehensive)
- Location: `tests/e2e/`
- Target: UI components, navigation, forms, internationalization, error handling
- Command: `make test-e2e`
- **When adding features**: Add corresponding e2e tests to catch integration errors early

### Test-Driven Development (TDD)
1. Write e2e test first for new features
2. Implement the feature
3. Run full suite: `make lint && make test && make test-e2e`
4. All tests must pass before commit

## ⚠️ Critical Gotchas

See full details in [AGENTS.md](./AGENTS.md#-common-gotchas--extension-best-practices):

1. **Service Worker Ephemerality**: Never store state in memory. Use `chrome.storage.local`.
2. **Storage Limits**: `chrome.storage.sync` has 120 writes/minute limit. Use `chrome.storage.local` for dynamic data.
3. **Network in Popup**: All fetch calls must be in service worker, not popup (requests abort on close).
4. **XSS Security**: No `innerHTML`/`outerHTML`/`document.write`. Use `textContent` or `createElement()`.
5. **No Remote Scripts**: All code must be local; CDN loading is blocked by CSP.

## 📊 Current Test Status

- **Unit Tests**: 63 tests pass
- **E2E Tests**: 93 tests pass (tabs, navigation, configuration, history, reorganization, popup-light, i18n, error handling)
- **Lint**: No errors
- **Coverage**: 95%+ for logical utilities

## 🚀 Quick Commands

```bash
# Validate syntax
make lint

# Run unit tests (95%+ coverage)
make test

# Check overall test coverage
make test-coverage

# Run end-to-end tests (93 tests)
make test-e2e

# Full validation (recommended before commit)
make lint && make test && make test-e2e

# Clean build artifacts
make clean
```

## 📝 Notes for AI Agents

- When implementing new features, follow the TDD approach (test first)
- Always run the full test suite before committing
- If tests fail intermittently, add waits (`await page.waitForTimeout()`) to e2e tests
- For UI changes, verify the feature works in both `popup.html` and `popup-light.html`
- For i18n changes, add tests to `tests/e2e/i18n.spec.js`
- Check [AGENTS.md](./AGENTS.md) for LLM payload schemas before modifying reorganization logic

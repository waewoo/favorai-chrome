# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-05-24

### Added
- Created localized translations for French and English (`_locales/`).
- Implemented modular ES6 modules structure for the background SW and LLM providers.
- Integrated a customized HTML confirmation modal to replace blocking browser `confirm()` calls.
- Automated CI pipeline config (`.github/workflows/ci.yml`).
- Added robust Vitest unit tests covering pure functions, and Playwright E2E spec.

### Changed
- Split monolithic `background.js` and `llm.js` into submodules under `src/`.
- Extracted CSS from `popup.html` to `popup.css`.
- Removed URL field transmission to LLM in `cleanTreeForLLM` for user privacy protection.

### Fixed
- Replaced dangerous `innerHTML` calls with secure programmatic DOM creation to prevent XSS.
- Refactored keep-alive interval to use `chrome.alarms` to avoid Service Worker sleep shutdowns.
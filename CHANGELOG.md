# Changelog

All notable changes to this project will be documented in this file.

## [1.4.0] - 2026-05-31

### Added
- **ui**: add config alert and reorg shortcut to popup-light with deep-linking, E2E tests, and deprecation suppression (`c321b9d`)
- **security**: add unified security tooling and fix XSS vulnerability (`3cc1c4e`)

### Changed
- **store-assets** (chore): update screenshot mockups and split listing descriptions (`ea8d0c6`)
- (docs) update AGENTS.md and README.md with current tool/test info (`4c72b2a`)
- **lint** (chore): extend ESLint coverage to all JS files in the project (`36f3f05`)
- **coverage** (test): restore 100%% unit test coverage after security refactoring (`3fc4d52`)
- **security** (chore): resolve vulnerabilities and integrate security scan to CI (`e2e07cd`)
- (docs) document tag and commit automation in README.md and AGENTS.md (`b10a294`)

## [1.3.0] - 2026-05-30

### Changed
- **release** (chore): implement auto SemVer bumping, release workflow, and doc updates (`8421391`)

## [1.2.1] - 2026-05-30

### Added
- **ui**: localize bookmark folder selector label and add targeting help text (`4cf6f2a`)
- **release**: add scripts/bump-version.js and make targets to automate version increments (`aee5407`)

### Changed
- **llm** (refactor): isolate prompts and fix literal newline escaping in JSON parser (`2fa70d2`)

### Fixed
- **llm**: limit explanation length and summarize changes to prevent token limit truncation (`0a07f1e`)

## [1.2.0] - 2026-05-24

### Added
- **ui**: add proposed changes action filters and console log copy button with translations (`d556f88`)
- **theme**: make dropdown selects match dark theme (`29e1919`)
- **store-assets**: redesign screenshots as premium marketing slides (`30f31c8`)
- **about**: add Buy Me a Coffee support button in About tab (`0acdd30`)
- Add Chrome Web Store marketing assets and store listing (`eb80660`)
- Add Chrome Web Store automated publishing + update docs (`a52ec68`)
- Enforce short top-level folder names (≤18 chars) in LLM prompts (`187a86a`)
- Add comprehensive unit tests for diff.js, history.js, and suggestBookmarkLocation (`46bfcfd`)
- Add folder selector to inline bookmark editing (`9144bc6`)
- Add manual bookmark save with folder selector (`101191c`)
- Complete i18n for popup.html and popup.js (`8ad34b1`)
- Add complete i18n for popup-light UI (`51f0b59`)
- Add light popup UI variant (`6bcab19`)
- Add Bookmark AI suggestion, history rollback/delete per entry, prompt customization (`6d5e027`)

### Changed
- (test) reach 100% unit test coverage globally, silence stderr logs, and update AGENTS.md requirements (`d67292a`)
- **e2e** (perf): speed up E2E tests using GPU/V8 launch arguments, limit local workers to 4, and fix Windows kill-e2e target (`1fa684c`)
- (docs) update AGENTS.md and README.md to reflect current codebase state (`6a0f0bd`)
- (docs) fix isSafeUrl JSDoc — file:// and ftp:// are not allowed (`c7e8beb`)
- (perf) avoid double flattenBookmarks call in runAnalysis (`55e5103`)
- (refactor) extract dispatchToProvider to eliminate duplicate switch blocks (`973cd07`)
- (docs) correct misleading privacy comment in cleanTreeForLLM (`87363ab`)
- (docs) update repository references to favorai-chrome (`f7cfbdc`)
- Initial commit: FavorAI Chrome extension (`2bd0ae3`)
- Initial commit: FavorAI Chrome extension (`c6a91fd`)

### Fixed
- Replace $4.99 pricing with Buy Me a Coffee support link (`013df64`)
- Prevent and recover from LLM placing explanation outside JSON wrapper (`413babb`)
- Wire up all missing data-i18n in docs tab — full EN/FR translation (`25f40e2`)
- Correct privacy note — URLs are sent to the LLM (not stripped) (`0ac39fe`)
- Rewrite privacy_policy.html in English (`5944894`)
- Complete privacy_policy.html — version 1.2.0, icon, all placeholders filled (`bd89d29`)
- Chrome Web Store submission blockers and add proprietary license (`c928e02`)
- Correct 3 pre-existing e2e test bugs and 2 flaky tests (`3395ceb`)
- Store e2e tmpDirs in os.tmpdir() and add Makefile cleanup targets (`90bd260`)
- Resolve e2e test timeouts with shared helper and tuned Playwright config (`f029f82`)
- Prevent duplicate onRemoved listeners in openPopupWindow (`00f9c0e`)
- Add string-awareness to JSON array extraction in cleanAndParseJSON (`73b1bf2`)
- Replace hardcoded French strings with chrome.i18n.getMessage calls (`6f35b40`)
- Deep clone restored children to prevent originalMap mutation (`25241dc`)
- Serialize saveSessionToHistory calls to eliminate race condition (`670c9f6`)
- ResolveParentId returns null instead of silently falling back to root (`bb2cb45`)
- Prevent prompt injection via bookmark title/url in suggestBookmarkLocation (`514cd3d`)
- Mask Gemini API key in debug logs to prevent credential leak (`eb6f3e1`)
- Resolve Gemini [...] JSON parsing, config alert timing, and UI polish (`eacc48d`)
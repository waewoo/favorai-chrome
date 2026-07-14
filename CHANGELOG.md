# Changelog

All notable changes to this project will be documented in this file.

## [1.6.0] - 2026-07-14

### Added
- **bookmarks**: classify new bookmarks with AI (`049db06`)
- **skills**: add shared favorai agent skills (`c48c47e`)

### Changed
- **cleanup** (refactor): use shared isSafeUrl helper (`6781c69`)
- **aidd** (chore): add memory bank scaffolding (`2de8656`)
- **ci** (chore): align quality gates and workflow naming (`de37682`)
- (docs) refresh agent and repo workflow docs (`e5ef82f`)
- **tooling** (chore): add local quality scan and mcp bootstrap (`25dc33c`)

### Fixed
- **security**: store api keys locally and redact logs (`e675cf3`)

## [1.5.0] - 2026-06-13

### Added
- Replace quick access with top visited bookmarks and clarify UI analysis options (`eaf6bf9`)
- Show bookmark count and token estimate for selected folder (`e692593`)
- Granular analysis options with separate checkboxes and single launch button (`4cc7bfc`)
- **release**: add `make get-refresh-token` helper for Chrome Web Store authentication (`d665f3f`)
- **ci**: refresh github actions runtime and job names (`9d3e21d`)
- **ci**: split lint and test jobs (`98fb9b6`)
- Improve duplicate bookmark detection (`9a18917`)
- **forgotten**: days-based filters, Chrome history notice, and deletion rollback (`a46480b`)
- **forgotten**: finalize tab order, E2E tests, and store assets (`78d1db0`)
- **forgotten**: add Forgotten Bookmarks tab (`6252feb`)
- **testing**: integrate Stryker mutation testing (`14d7673`)
- **ui**: remove redundant window detach button and update translations and tests (`8d7f329`)

### Changed
- **release** (docs): clarify the end-to-end release workflow across README, AGENTS, and Makefile help (`a5fb2da`)
- **extension** (refactor): regroup runtime entrypoints under `extension/` and move icons/fonts under `assets/` (`005731c`)
- **store-assets** (docs): refresh Chrome Web Store listing copy and asset set (`da0851a`)
- (docs) update agent guidelines (`01dee44`)
- (docs) update AGENTS.md and README.md (`de2929a`)
- (refactor) extract all inline styles from popup.html into popup.css (`74b1f68`)
- (test) add unit tests for all six LLM providers (`2397c2a`)
- (test) strengthen security and llm coverage (`532906b`)
- **popup** (refactor): split reorg popup modules (`30a8e7f`)
- **hooks** (chore): move tests and security to push (`4f6869e`)
- (docs) clarify permission usage (`bc76b4c`)
- (chore) improve make tooling and project docs (`c8d1259`)
- **tooling** (chore): add husky commitlint and codegraph setup (`a9331b7`)
- (docs) place support badge on separate line (`4baf75b`)
- (docs) require conventional commit messages (`9b688d0`)
- **security** (chore): add Gitleaks secret scanning (`4a4bcbb`)
- (docs) document prompt customization (`8f484a2`)
- **ui** (chore): refine support links and footer layout (`6e4df74`)
- **store** (docs): refine metadata and promo assets (`f308e22`)
- (ci) upload coverage to codecov (`51fcccb`)
- (docs) standardize repo metadata and release workflow (`15bea5d`)
- (ci) add install-ci Makefile target and use it in workflows (`330cf57`)
- (ci) add manual E2E workflow (workflow_dispatch) (`fb5e8ce`)
- (ci) apply 7 improvements to GitHub Actions workflow (`bf71f01`)
- **deps** (chore): upgrade all devDependencies to latest + add check/update-deps targets (`9ab07be`)
- **deps** (chore): upgrade @playwright/test 1.44 → 1.60 (`f32813e`)
- **quality-gates** (ci): enforce 100% coverage and 80% mutation score as hard failures (`b5a7711`)
- **mutation** (test): complete surviving mutants — raise score to 84.49% (`f445e86`)
- **mutation** (test): kill surviving mutants — raise score 63% → 80%, restore 100% branch coverage (`2ed732d`)
- **coverage** (test): restore 100% unit test coverage, add cyclic path unit test, and add E2E integration flow tests (`e22a414`)
- **ui** (refactor): modularize popup.js and background.js into ES submodules, update documentation (`d4ef5f8`)
- (chore) update copyright holder and contact format in license file (`871564a`)

### Fixed
- **deps**: resolve audit vulnerabilities (`17a0d6f`)
- Add global unhandledrejection error boundary to popup (`f1c2ea5`)
- **i18n**: replace hardcoded strings with locale keys in popup-light and popup.html (`21e6f8f`)
- Surface apply failures, remove dead code, add ARIA tab roles (`048a64f`)
- Harden dead link checker to eliminate false positives (`63b4f3a`)
- Clarify cleanup and rollback UX (`fdab174`)
- Harden bookmark analysis flow and tests (`c9a6f3c`)
- **llm**: harden provider responses (`645df4e`)
- **background**: harden worker recovery and e2e stability (`999f84f`)
- **ui**: open privacy policy locally (`616594e`)
- **lint**: remove unused catch bindings across codebase (`9bf06af`)
- **forgotten**: render panel content on tab restore from storage (`a94b545`)
- **e2e**: use data-i18n selectors instead of locale-dependent text (`30f617c`)
- **e2e**: force French locale in Playwright to fix CI failures (`a6baa99`)

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

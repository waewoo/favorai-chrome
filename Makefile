# Makefile for FavorAI extension

.PHONY: help install install-ci lint lint-fix test test-watch test-coverage test-mutation test-e2e test-e2e-ui test-e2e-integration package clean clean-e2e kill-e2e upload publish publish-testers screenshots bump bump-patch bump-minor bump-major security release check-deps update-deps

# Default goal: show help instructions
help:
	@echo "========================================================================"
	@echo " FavorAI Bookmark Manager Extension - Available Commands"
	@echo "========================================================================"
	@echo "  make install               Install project dependencies (npm install)"
	@echo "  make install-ci            Install dependencies for CI (npm ci --ignore-scripts)"
	@echo "  make lint                  Run ESLint code validation checks"
	@echo "  make lint-fix              Auto-fix linter warnings and format violations"
	@echo "  make test                  Execute all Vitest unit tests (95%+ coverage)"
	@echo "  make test-watch            Execute Vitest in interactive watch mode"
	@echo "  make test-coverage         Run Vitest tests and generate code coverage report"
	@echo "  make test-mutation         Run Stryker mutation testing to check test suite strength"
	@echo "  make test-e2e              Execute ALL E2E tests with Playwright (UI + Integration)"
	@echo "  make test-e2e-ui           Execute UI E2E tests only (structure, navigation, forms)"
	@echo "  make test-e2e-integration  Execute Integration E2E tests only (workflows, flows)"
	@echo "  make bump                  Auto-detect bump type & update CHANGELOG (SemVer based on git)"
	@echo "  make bump-patch            Increment patch version (e.g. 1.2.0 -> 1.2.1) manually"
	@echo "  make bump-minor            Increment minor version (e.g. 1.2.0 -> 1.3.0) manually"
	@echo "  make bump-major            Increment major version (e.g. 1.2.0 -> 2.0.0) manually"
	@echo "  make release               Package extension, push commits/tags, and create GitHub release"
	@echo "  make package               Package the extension into a ZIP file for Chrome Store"
	@echo "  make screenshots           Generate all store asset PNGs from HTML sources"
	@echo "  make upload                Build ZIP and upload to Chrome Web Store (no publish)"
	@echo "  make publish               Build ZIP, upload and publish to all users"
	@echo "  make publish-testers       Build ZIP, upload and publish to trusted testers only"
	@echo "  make security              Run dependency, static analysis, extension, and secret leak scans"
	@echo "  make check-deps            Show all outdated devDependencies with current vs latest versions"
	@echo "  make update-deps           Upgrade all devDependencies to their latest versions (updates package.json)"
	@echo "  make clean                 Remove reports, zip packages, and temporary folders"
	@echo "  make clean-e2e             Remove leftover Playwright tmp dirs and test-results"
	@echo "  make kill-e2e              Kill any stuck Playwright/Chrome processes from e2e runs"
	@echo "========================================================================"


install:
	npm install

install-ci:
	npm ci --ignore-scripts

# Show all outdated devDependencies (non-zero exit if any are outdated)
check-deps:
	@echo "Checking for outdated dependencies..."
	@npm outdated || true

# Upgrade all devDependencies to their latest published versions
update-deps:
	@echo "Upgrading all devDependencies to latest..."
	npx npm-check-updates --upgrade
	npm install
	@echo "Done. Run 'make test' and 'make security' to validate."

lint:
	npm run lint

lint-fix:
	npm run lint:fix

security:
	node scripts/security-check.js

test:
	npm run test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage
	@node -e "const fs = require('fs'); const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8')); console.log('\n======================================================'); console.log(' GLOBAL COVERAGE SUMMARY:'); console.log('  Statements: ' + summary.total.statements.pct + '%% (' + summary.total.statements.covered + '/' + summary.total.statements.total + ')'); console.log('  Branches:   ' + summary.total.branches.pct + '%% (' + summary.total.branches.covered + '/' + summary.total.branches.total + ')'); console.log('  Functions:  ' + summary.total.functions.pct + '%% (' + summary.total.functions.covered + '/' + summary.total.functions.total + ')'); console.log('  Lines:      ' + summary.total.lines.pct + '%% (' + summary.total.lines.covered + '/' + summary.total.lines.total + ')'); console.log('======================================================\n');"

test-mutation:
	npm run test:mutation

test-e2e: clean-e2e
	npm run test:e2e

test-e2e-ui: clean-e2e
	@echo "Running UI E2E tests..."
	npx playwright test tests/e2e/ui

test-e2e-integration: clean-e2e
	@echo "Running Integration E2E tests..."
	npx playwright test tests/e2e/integration

package:
	npm run package

# Generate all store asset PNGs (screenshots + tiles) from HTML sources
screenshots:
	node store-assets/generate.mjs

# Upload the ZIP to Chrome Web Store (draft — does not publish)
upload: package
	node scripts/publish.mjs

# Upload + publish to all users
publish: package
	node scripts/publish.mjs --publish

# Upload + publish to trusted testers only
publish-testers: package
	node scripts/publish.mjs --testers

clean: clean-e2e
	@echo "Cleaning up generated directories and files..."
	@node -e "const fs = require('fs'); ['coverage', 'playwright-report', 'test-results', 'dist'].forEach(p => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} }); fs.readdirSync('.').forEach(f => { if (f.endsWith('.zip')) { try { fs.rmSync(f, { force: true }); } catch (e) {} } });"
	@echo "Cleanup completed."

# Remove leftover Playwright Chrome user-data dirs (in tests/e2e/ from old runs)
# and os.tmpdir() dirs created by the current helper
clean-e2e:
	@echo "Cleaning up Playwright temporary directories..."
	@node -e "const fs = require('fs'); ['tests/tests', 'test-results', 'playwright-report'].forEach(p => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {} }); if (fs.existsSync('tests/e2e')) { fs.readdirSync('tests/e2e').forEach(f => { if (f.startsWith('tmp-user-data-')) { try { fs.rmSync('tests/e2e/' + f, { recursive: true, force: true }); } catch (e) {} } }); }"
	@node -e "const fs = require('fs'); const path = require('path'); const os = require('os'); const tempDir = os.tmpdir(); if (fs.existsSync(tempDir)) { fs.readdirSync(tempDir).forEach(f => { if (f.startsWith('favorai-e2e-')) { try { fs.rmSync(path.join(tempDir, f), { recursive: true, force: true }); } catch (e) {} } }); }"
	@echo "E2E cleanup done."

# Kill any orphaned Playwright-spawned Chrome processes (--load-extension flag is the fingerprint)
kill-e2e:
	@echo "Killing stuck Playwright Chrome processes..."
	@powershell -Command "Get-CimInstance Win32_Process | Where-Object { $$_.Name -eq 'chrome.exe' -and $$_.CommandLine -match 'load-extension' } | ForEach-Object { Stop-Process -Id $$_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host \"Killed PID $$($$_.ProcessId)\" }" || exit 0
	@echo "Done."

bump:
	node scripts/bump-version.js auto

bump-patch:
	node scripts/bump-version.js patch

bump-minor:
	node scripts/bump-version.js minor

bump-major:
	node scripts/bump-version.js major

release: clean-e2e
	@echo "📦 Packaging the extension zip..."
	npm run package
	@echo "🚀 Pushing commits and tags to GitHub (origin main)..."
	git push origin main --tags
	@echo "🚀 Creating/updating GitHub Release..."
	node scripts/release.js



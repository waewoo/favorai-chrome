# Makefile for FavorAI extension

.PHONY: help install lint lint-fix test test-watch test-coverage test-e2e test-e2e-ui test-e2e-integration package clean clean-e2e kill-e2e upload publish publish-testers

# Default goal: show help instructions
help:
	@echo "========================================================================"
	@echo " FavorAI Bookmark Manager Extension - Available Commands"
	@echo "========================================================================"
	@echo "  make install               Install project dependencies (npm install)"
	@echo "  make lint                  Run ESLint code validation checks"
	@echo "  make lint-fix              Auto-fix linter warnings and format violations"
	@echo "  make test                  Execute all Vitest unit tests (95%+ coverage)"
	@echo "  make test-watch            Execute Vitest in interactive watch mode"
	@echo "  make test-coverage         Run Vitest tests and generate code coverage report"
	@echo "  make test-e2e              Execute ALL E2E tests with Playwright (UI + Integration)"
	@echo "  make test-e2e-ui           Execute UI E2E tests only (structure, navigation, forms)"
	@echo "  make test-e2e-integration  Execute Integration E2E tests only (workflows, flows)"
	@echo "  make package               Package the extension into a ZIP file for Chrome Store"
	@echo "  make upload                Build ZIP and upload to Chrome Web Store (no publish)"
	@echo "  make publish               Build ZIP, upload and publish to all users"
	@echo "  make publish-testers       Build ZIP, upload and publish to trusted testers only"
	@echo "  make clean                 Remove reports, zip packages, and temporary folders"
	@echo "  make clean-e2e             Remove leftover Playwright tmp dirs and test-results"
	@echo "  make kill-e2e              Kill any stuck Playwright/Chrome processes from e2e runs"
	@echo "========================================================================"

install:
	npm install

lint:
	npm run lint

lint-fix:
	npm run lint:fix

test:
	npm run test

test-watch:
	npm run test:watch

test-coverage:
	npm run test:coverage
	@node -e "const fs = require('fs'); const summary = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8')); console.log('\n======================================================'); console.log(' GLOBAL COVERAGE SUMMARY:'); console.log('  Statements: ' + summary.total.statements.pct + '%% (' + summary.total.statements.covered + '/' + summary.total.statements.total + ')'); console.log('  Branches:   ' + summary.total.branches.pct + '%% (' + summary.total.branches.covered + '/' + summary.total.branches.total + ')'); console.log('  Functions:  ' + summary.total.functions.pct + '%% (' + summary.total.functions.covered + '/' + summary.total.functions.total + ')'); console.log('  Lines:      ' + summary.total.lines.pct + '%% (' + summary.total.lines.covered + '/' + summary.total.lines.total + ')'); console.log('======================================================\n');"

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
	@rm -rf coverage/ playwright-report/ test-results/ dist/ *.zip 2>/dev/null || powershell -Command "Remove-Item -Path coverage, playwright-report, test-results, dist, *.zip -Recurse -ErrorAction SilentlyContinue"
	@echo "Cleanup completed."

# Remove leftover Playwright Chrome user-data dirs (in tests/e2e/ from old runs)
# and os.tmpdir() dirs created by the current helper
clean-e2e:
	@echo "Cleaning up Playwright temporary directories..."
	@rm -rf tests/e2e/tmp-user-data-* tests/tests/ test-results/ playwright-report/ 2>/dev/null || true
	@powershell -Command "Get-ChildItem -Path \"$$env:TEMP\" -Directory -Filter 'favorai-e2e-*' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue" 2>/dev/null || true
	@echo "E2E cleanup done."

# Kill any orphaned Playwright-spawned Chrome processes (--load-extension flag is the fingerprint)
kill-e2e:
	@echo "Killing stuck Playwright Chrome processes..."
	@powershell -Command "Get-CimInstance Win32_Process | Where-Object { \$$_.Name -eq 'chrome.exe' -and \$$_.CommandLine -match 'load-extension' } | ForEach-Object { Stop-Process -Id \$$_.ProcessId -Force -ErrorAction SilentlyContinue; Write-Host \"Killed PID \$$(\$$_.ProcessId)\" }" 2>/dev/null || true
	@echo "Done."

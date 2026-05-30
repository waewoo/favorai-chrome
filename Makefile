# Makefile for FavorAI extension

.PHONY: help install lint lint-fix test test-watch test-coverage test-e2e test-e2e-ui test-e2e-integration package clean

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
	@echo "  make clean                 Remove reports, zip packages, and temporary folders"
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

test-e2e:
	npm run test:e2e

test-e2e-ui:
	@echo "Running UI E2E tests..."
	npx playwright test tests/e2e/ui

test-e2e-integration:
	@echo "Running Integration E2E tests..."
	npx playwright test tests/e2e/integration

package:
	npm run package

clean:
	@echo "Cleaning up generated directories and files..."
	@rm -rf coverage/ playwright-report/ test-results/ dist/ *.zip 2>/dev/null || powershell -Command "Remove-Item -Path coverage, playwright-report, test-results, dist, *.zip -Recurse -ErrorAction SilentlyContinue"
	@echo "Cleanup completed."

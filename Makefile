# Makefile for FavorAI extension

.PHONY: help install lint lint-fix test test-watch test-coverage test-e2e package clean

# Default goal: show help instructions
help:
	@echo "========================================================================"
	@echo " FavorAI Bookmark Manager Extension - Available Commands"
	@echo "========================================================================"
	@echo "  make install         Install project dependencies (npm install)"
	@echo "  make lint            Run ESLint code validation checks"
	@echo "  make lint-fix        Auto-fix linter warnings and format violations"
	@echo "  make test            Execute all Vitest unit tests"
	@echo "  make test-watch      Execute Vitest in interactive watch mode"
	@echo "  make test-coverage   Run Vitest tests and generate code coverage report"
	@echo "  make test-e2e        Execute E2E integration tests with Playwright"
	@echo "  make package         Package the extension into a ZIP file for Chrome Store"
	@echo "  make clean           Remove reports, zip packages, and temporary folders"
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

test-e2e:
	npm run test:e2e

package:
	npm run package

clean:
	@echo "Cleaning up generated directories and files..."
	@rm -rf coverage/ playwright-report/ test-results/ dist/ *.zip 2>/dev/null || powershell -Command "Remove-Item -Path coverage, playwright-report, test-results, dist, *.zip -Recurse -ErrorAction SilentlyContinue"
	@echo "Cleanup completed."

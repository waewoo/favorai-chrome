.DEFAULT_GOAL := help

NODE ?= node
NPX ?= npx
SCRIPTS_DIR := scripts

.PHONY: help install install-ci install-hooks install-codegraph lint lint-fix test test-watch test-coverage test-mutation test-e2e test-e2e-ui test-e2e-integration package clean clean-e2e kill-e2e upload publish publish-testers screenshots bump bump-patch bump-minor bump-major security release check-deps update-deps

help:
	@$(NODE) $(SCRIPTS_DIR)/make-help.mjs

install:
	@npm install

install-ci:
	@npm ci --ignore-scripts

install-hooks:
	@echo Generating Husky hooks...
	@npm run prepare
	@echo Husky hooks ready.

install-codegraph:
	@echo Installing CodeGraph and wiring it for Codex...
	@$(NPX) --yes @colbymchenry/codegraph install --target=auto --location=local --yes
	@$(NPX) --yes @colbymchenry/codegraph init -i
	@echo CodeGraph installed and project index initialized.

check-deps:
	@echo Checking for outdated dependencies...
	@$(NPX) npm outdated || exit 0

update-deps:
	@echo Upgrading all devDependencies to latest...
	@$(NPX) npm-check-updates --upgrade
	@npm install
	@echo Done. Run 'make test' and 'make security' to validate.

lint:
	@npm run lint

lint-fix:
	@npm run lint:fix

security:
	@$(NODE) $(SCRIPTS_DIR)/security-check.js

test:
	@npm run test

test-watch:
	@npm run test:watch

test-coverage:
	@npm run test:coverage
	@$(NODE) $(SCRIPTS_DIR)/print-coverage-summary.mjs

test-mutation:
	@npm run test:mutation

test-e2e: clean-e2e
	@npm run test:e2e

test-e2e-ui: clean-e2e
	@echo Running UI E2E tests...
	@$(NPX) playwright test tests/e2e/ui

test-e2e-integration: clean-e2e
	@echo Running Integration E2E tests...
	@$(NPX) playwright test tests/e2e/integration

package:
	@npm run package

screenshots:
	@$(NODE) store-assets/generate.mjs

upload: package
	@$(NODE) scripts/publish.mjs

publish: package
	@$(NODE) scripts/publish.mjs --publish

publish-testers: package
	@$(NODE) scripts/publish.mjs --testers

clean: clean-e2e
	@$(NODE) $(SCRIPTS_DIR)/clean.mjs

clean-e2e:
	@$(NODE) $(SCRIPTS_DIR)/clean-e2e.mjs

kill-e2e:
	@$(NODE) $(SCRIPTS_DIR)/kill-e2e.mjs

bump:
	@$(NODE) $(SCRIPTS_DIR)/bump-version.js auto

bump-patch:
	@$(NODE) $(SCRIPTS_DIR)/bump-version.js patch

bump-minor:
	@$(NODE) $(SCRIPTS_DIR)/bump-version.js minor

bump-major:
	@$(NODE) $(SCRIPTS_DIR)/bump-version.js major

release: clean-e2e
	@echo Packaging the extension zip...
	@npm run package
	@echo Pushing commits and tags to GitHub (origin main)...
	@git push origin main --tags
	@echo Creating/updating GitHub Release...
	@$(NODE) $(SCRIPTS_DIR)/release.js

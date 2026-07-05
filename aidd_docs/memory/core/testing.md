# Testing

## Strategy

- Unit tests cover bookmark logic, provider routing, helpers, and popup modules.
- Playwright tests cover popup behavior and browser integration.

## Tools

- Vitest for unit tests.
- `@playwright/test` for end-to-end tests.
- Mocked Chrome APIs in `tests/mocks/chrome.js` and `tests/setup.js`.

## Conventions

- Unit tests live in `tests/unit/`.
- E2E tests live in `tests/e2e/`.
- Add or update unit tests when changing `src/background/`, `src/llm/`, or `src/utils/`.
- Add or update E2E tests when visible popup behavior or browser flow changes.

## Run

- `make lint`
- `make test`
- `make test-e2e`


# Contributing to FavorAI

Thanks for taking the time to help improve FavorAI.

## Before you start

- Read the README and the architecture notes in `AGENTS.md`.
- Check existing issues and pull requests to avoid duplicates.
- Keep changes focused and small when possible.

## Development workflow

1. Install dependencies.
2. Run lint and tests before opening a pull request:

```bash
make lint && make test
```

3. Install the local Git hooks once so commits are checked automatically:

```bash
make install-hooks
```

Husky manages the tracked hooks in `.husky/` and the `prepare` script installs them automatically after `npm install`:

- `pre-commit`: runs `git diff --check`, `make lint`, `make test`, and `make security`
- `commit-msg`: runs commitlint with `@commitlint/config-conventional`

Commitlint supports Conventional Commits features like `feat!:` and `BREAKING CHANGE:` footers.

CodeGraph is an optional local knowledge graph for agentic code navigation. It gives Codex a pre-indexed view of the repo so structural questions can be answered with fewer file reads. To install it and build the local index, run:

```bash
make install-codegraph
```

4. If your change affects popup UI or extension flows, also run:

```bash
make test-e2e
```

## Code guidelines

- Follow the existing module boundaries and naming conventions.
- Prefer small, local changes over broad refactors.
- Keep browser API usage in the appropriate layer.
- Add or update tests when behavior changes.

## Label conventions

Use the standard labels below so issues and PRs stay consistent and release notes stay readable:

- `bug`: something is broken
- `enhancement`: a user-facing improvement or new capability
- `documentation`: docs or README-only changes
- `security`: a security-sensitive fix or issue
- `refactor`: behavior-preserving code cleanup
- `performance`: a speed, memory, or responsiveness change
- `ci`: CI, workflow, or automation changes
- `tests`: test coverage or test infrastructure work
- `chore`: maintenance, dependency, or release housekeeping
- `skip-release`: do not include this change in release notes

## Pull requests

- Describe what changed and why.
- Mention any manual verification you performed.
- Link related issues when relevant.
- Keep PRs reviewable; split large changes when needed.

## Questions

If you are unsure how to approach a change, open an issue first or contact the maintainer before starting larger work.

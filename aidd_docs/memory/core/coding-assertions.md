# Coding Assertions

## Before commit

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `make lint` | ESLint and project lint rules |
| 2 | `make test` | Vitest unit suite |

## Before handoff

| Order | Command | Checks |
| ----- | ------- | ------ |
| 1 | `make test-e2e` | Popup and browser-flow coverage when visible UI changes |
| 2 | `make security` | Provider, auth, URL, or rendering-sensitive changes |


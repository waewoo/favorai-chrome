# tests audit

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| 🟡 | tests | `src/popup/config.js:114` | The config flow has no direct unit coverage for persistence, restore, or model-fetch behavior. Given that this module handles API keys, provider selection, and remote model enumeration, regressions here would be easy to miss. | Add focused unit tests for `loadConfig`, `saveConfig`, and `fetchModelsFromApi`, including provider-specific branches and storage writes. | M |

## Notes

- The LLM providers and core reorganization logic already have substantial coverage.


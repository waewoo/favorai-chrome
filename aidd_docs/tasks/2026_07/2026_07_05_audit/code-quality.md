# code-quality audit

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| 🟢 | code-quality | `src/popup/utils.js:97` | `isSafeUrl()` is duplicated here even though the same helper already exists in `src/utils/isSafeUrl.js`. The copies can drift and make URL handling inconsistent across call sites. | Re-export the shared helper or import it directly everywhere, then delete the duplicate body. | S |

## Notes

- No other code-quality issues stood out in the sampled core, popup, and LLM paths.


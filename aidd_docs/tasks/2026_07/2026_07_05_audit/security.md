# security audit

## Findings

| Sev | Category | Location | Issue | Suggested fix | Effort |
| --- | --- | --- | --- | --- | --- |
| 🟡 | security | `src/popup/config.js:114` | The API key is loaded from and saved to `chrome.storage.sync`, so it is synced across browser profiles and backed by browser sync rather than kept local. That increases the blast radius for a credential and contradicts the repo rule that sync is for stable preferences. | Move `apiKey` to `chrome.storage.local` or another non-synced store, keep only non-secret preferences in sync, and update the privacy-policy copy accordingly. | M |
| 🟡 | security | `src/background/analysis.js:616` | Debug mode logs the cleaned bookmark tree, prompt text, and raw LLM response. That can expose bookmark titles, URLs, and model output in developer tools or log captures. | Redact content-heavy debug logs, keep only counts/status metadata, and gate any payload dumps behind a stricter local-only debug path. | M |

## Notes

- The rest of the security posture is decent for an extension: network work stays in the background, and URL rendering uses safe links in the popup.


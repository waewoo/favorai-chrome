# Chrome Store Readiness

## Main checks

- Keep the extension Manifest V3 compliant.
- Use the minimum required permissions.
- Avoid remote scripts, CDN dependencies, and dynamic code loading.
- Keep CSP and extension-page loading rules strict.
- Avoid leaking secrets, API keys, or raw bookmark payloads in logs.

## UI and content safety

- Treat bookmark titles, URLs, and other user-controlled text as untrusted.
- Render unsafe data with DOM APIs and `textContent`.
- Keep prompt and content handling free of unsafe HTML insertion.

## Release hygiene

- Confirm packaging includes the intended extension files only.
- Keep locale files, screenshots, and store assets aligned with the release.
- Recheck the latest Chrome Web Store requirements before publishing.

## Review focus

- Ask whether the change affects privacy, permissions, or remote execution.
- Ask whether the change could break store review or rejection criteria.
- Prefer the smallest fix that preserves the existing architecture.

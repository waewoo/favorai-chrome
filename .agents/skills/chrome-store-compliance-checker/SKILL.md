---
name: chrome-store-compliance-checker
description: Check Chrome Web Store readiness for Manifest V3 extensions, including permissions, CSP, remote-code risks, privacy-sensitive flows, packaging, and store-facing assets. Use when preparing releases, reviewing policy risk, or validating extension-store compliance.
---

# Chrome Store Compliance Checker

## Purpose

Use this skill to review whether the extension is ready for Chrome Web Store publication. Focus on MV3 constraints, permission minimization, safe URL and content handling, packaging hygiene, and release-facing assets.

Read `favorai-core-guidelines` first when you need the shared release and architecture rules.

## Compliance Checks

1. Verify the manifest uses MV3 patterns and only the required permissions.
2. Check for remote scripts, CDN dependencies, or dynamic code loading.
3. Check CSP, background worker usage, and extension page loading rules.
4. Confirm that secrets, API keys, and user data are not logged or exposed.
5. Review bookmark titles, URLs, and other user-controlled fields as untrusted input.
6. Confirm that store assets, locale strings, and package contents match the release.
7. Recheck the latest Chrome Web Store policy requirements before release if the rules may have changed.

## Output

- Flag the specific release risk.
- Point to the file or behavior that needs to change.
- Prefer a minimal fix that preserves the existing extension architecture.

# FavorAI — Store Assets

Marketing assets for the Chrome Web Store listing. Not included in the extension ZIP.

## Directory Structure

```
store-assets/
├── README.md                          This file
├── generate.mjs                       Playwright script to render all HTML → PNG
├── screenshots/
│   ├── 01-main-popup.html             1280×800 — Main popup (Organization tab)
│   ├── 02-analysis-in-progress.html  1280×800 — Analysis running (progress + logs)
│   ├── 03-validation-checklist.html  1280×800 — Proposed changes review
│   ├── 04-configuration.html         1280×800 — Config tab (provider, API key)
│   └── 05-session-history.html       1280×800 — History tab with rollback
├── tiles/
│   ├── tile-promotional-440x280.html  440×280  — Small promotional tile
│   └── banner-hero-1400x560.html     1400×560 — Large hero banner
├── listing/
│   └── store-listing.md              All marketing texts (EN + FR, copy-paste ready)
└── output/                           Generated PNGs (gitignored)
    ├── screenshot-01-main-popup.png
    ├── screenshot-02-analysis-in-progress.png
    ├── screenshot-03-validation-checklist.png
    ├── screenshot-04-configuration.png
    ├── screenshot-05-session-history.png
    ├── tile-promotional-440x280.png
    └── banner-hero-1400x560.png
```

## Generating the PNG Assets

```bash
# All assets
make screenshots

# Or directly
node store-assets/generate.mjs

# Screenshots only
node store-assets/generate.mjs --screenshots

# Tiles only
node store-assets/generate.mjs --tiles
```

Requires Playwright (already installed as a dev dependency).
Output goes to `store-assets/output/`.

## Chrome Web Store Upload Checklist

- [ ] Screenshots: 5 × PNG, 1280×800 px
- [ ] Small promotional tile: 440×280 px
- [ ] Large promotional banner: 1400×560 px
- [ ] Summary (≤ 132 chars) → see `listing/store-listing.md`
- [ ] Long description (EN) → see `listing/store-listing.md`
- [ ] Long description (FR) → see `listing/store-listing.md`
- [ ] Keywords → see `listing/store-listing.md`
- [ ] Privacy Policy URL: https://waewoo.github.io/favorai-privacy/privacy_policy.html
- [ ] `<all_urls>` justification → see `listing/store-listing.md` section 6
- [ ] Category: Productivity
- [ ] Price: Free
- [ ] Support link: https://buymeacoffee.com/waewoo

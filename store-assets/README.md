# FavorAI - Store Assets

Marketing assets for the Chrome Web Store listing. Not included in the extension ZIP.

## Directory Structure

```text
store-assets/
|-- README.md                          This file
|-- generate.mjs                       Playwright script to render all HTML -> PNG
|-- readability.css                    Shared high-contrast presentation layer
|-- screenshots/
|   |-- 01-main-popup.html             1280x800 - Main popup (Organization tab)
|   |-- 02-analysis-in-progress.html   1280x800 - Analysis running (progress + logs)
|   |-- 03-validation-checklist.html   1280x800 - Proposed changes review
|   |-- 04-configuration.html          1280x800 - Config tab (provider, API key)
|   |-- 05-session-history.html        1280x800 - History tab with rollback
|   `-- 06-forgotten-bookmarks.html    1280x800 - Forgotten Bookmarks tab
|   `-- 07-auto-classification.html    1280x800 - Automatic bookmark classification
|-- tiles/
|   |-- tile-promotional-440x280.html  440x280  - Small promotional tile
|   `-- banner-hero-1400x560.html      1400x560 - Large hero banner
|-- listing/
|   |-- store-listing-en.md            Marketing text (English, copy-paste ready)
|   `-- store-listing-fr.md            Marketing text (French, copy-paste ready)
`-- output/                             Generated PNGs (gitignored)
    |-- screenshot-01-main-popup.png
    |-- screenshot-02-analysis-in-progress.png
    |-- screenshot-03-validation-checklist.png
    |-- screenshot-04-configuration.png
    |-- screenshot-05-session-history.png
    |-- screenshot-06-forgotten-bookmarks.png
    |-- screenshot-07-auto-classification.png
    |-- tile-promotional-440x280.png
    `-- banner-hero-1400x560.png
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

- [ ] Screenshots: 7 x PNG, 1280x800 px
- [ ] Small promotional tile: 440x280 px
- [ ] Large promotional banner: 1400x560 px
- [ ] Summary (<= 132 chars) -> see `listing/store-listing-en.md` / `store-listing-fr.md`
- [ ] Long description (EN) -> see `listing/store-listing-en.md`
- [ ] Long description (FR) -> see `listing/store-listing-fr.md`
- [ ] Keywords
- [ ] Privacy Policy URL: https://waewoo.github.io/favorai-privacy/privacy_policy.html
- [ ] `<all_urls>` justification -> see `listing/store-listing-en.md` section 6 (if needed)
- [ ] Category: Productivity
- [ ] Price: Free
- [ ] Support link: https://buymeacoffee.com/waewoo

# Design

## System

- The popup uses custom HTML, CSS, and modules rather than a UI framework.
- Styling lives in `extension/popup.css` and the popup HTML files.

## Tokens

- Color and layout tokens are defined with CSS custom properties in the popup styles.
- Fonts come from `assets/fonts/fonts.css`, with `Plus Jakarta Sans` and `Outfit` used in the popup surfaces.

## Components

- Dark cards, tabs, filters, toasts, suggestion panels, and config sections make up the popup UI.
- The visual language leans indigo, purple, green, and dark glass panels.

## Accessibility

- Keep labels tied to controls, maintain visible focus states, and preserve `aria-selected` on tabs.
- Use DOM nodes and `textContent` for user content instead of injected HTML.


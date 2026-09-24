# Jellypal shared components

The component layer lives in `components.css` and is intentionally plain CSS so
the marketing site keeps its no-build, no-dependency setup. A visual catalogue is
available at `components.html`.

## Principles

- Character first: UI surfaces support the real game sprites instead of competing
  with them.
- Soft plus pixel: large actions can squish; structural surfaces keep pixel-cut
  corners.
- Mint means action or life. Gold is reserved for value and legendary states.
- Press Start 2P is limited to eyebrows, badges and tiny system labels. Nunito
  carries every sentence users need to read.
- Motion is short, transform-only and removed by `prefers-reduced-motion`.

## Primitives

- `jp-button` with `--primary`, `--secondary`, `--quiet`, `--small`
- `jp-chip` and `jp-badge` with `--jelly` / `--gold`
- `jp-section-head`, `jp-eyebrow`, `jp-heading`, `jp-lede`
- `jp-card` with `--lift` and optional `jp-panel--dither`
- `jp-info-card` with title and body elements
- `jp-pal-card`, `jp-pal-sprite`, `jp-pal-stack` for renderer-backed character UI
- `jp-pal-picker`, `jp-pal-roster`, `jp-pal-tile` for interactive species selection
- `jp-toast` for discoveries, rewards and visiting-pal moments
- `jp-window` with bar, dots, title and live status
- `jp-disclosure` using native `details` / `summary`

All controls retain visible keyboard focus, a 44px default hit target, and a
reduced-motion fallback.

The catalogue loads `pals.js` and paints every `canvas[data-pal]` through the
real `sprite()` renderer. This keeps component portraits identical to the game
and lets cards swap to expressive faces on hover without extra image assets.

`sprite-text.js` reuses the game's 5x7 bitmap alphabet. The catalogue renders
all visible copy to crisp canvases while retaining visually-hidden source text
for headings, controls, and screen-reader navigation.

The catalogue's live sandbox uses the production `ranch.js` interaction loop:
cursor tracking, boop, drag/hold, typing-to-feed, jelly drops, idle movement,
sleep, and the reduced-motion-aware pause control.

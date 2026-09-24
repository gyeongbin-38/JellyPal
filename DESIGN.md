# JellyPal site — design handoff

You are picking up the **marketing site** for JellyPal, a pixel-art slime
desktop pet for Windows. The product is done and shipping; your job is the
website's visual design and conversion — not the app.

## Live / deploy

- Site: https://jellypal.fun (Cloudflare Pages, project `jellypal`)
- API (worker, not yours): https://api.jellypal.fun — `{"ok":true}` on /health
- Deploy: `cd site && npx wrangler pages deploy . --project-name jellypal --commit-dirty=true`
- New deploys take a few seconds to propagate to the custom domain; check the
  `*.pages.dev` URL wrangler prints if jellypal.fun looks stale.
- `site/dl/` holds the real downloads — **do not delete or rename**:
  - `Jellypal_0.2.0_x64-setup.exe` (1.7 MB) — the NSIS installer
  - `jellypal-0.2.0-win.zip` (2.1 MB) — portable
  - SHA-256 shown on the page (`#safe` section) must be updated if binaries change
- Repo is private: github.com/gyeongbin-38/JellyPal (404s when logged out —
  that's expected, not broken).

## File map

| file | role |
|---|---|
| `site/index.html` | all markup + CSS in one file (vanilla, no build) |
| `site/pals.js` | **real game renderer port** — sprites, species, faces, props, accessories, hybrid engine. Global script, no modules |
| `site/ranch.js` | hero canvas (one live pal) + section icons + dex grid. Runs after pals.js |
| `src/main.js` | the actual product — source of truth for parity. Read-only for site work |

Load order is `pals.js` → `ranch.js` at end of body. No bundler — plain globals.

## pals.js API (the important stuff)

- `SPECIES` — array of 48 entries: `{id, name, r: 0-3, shape, trait?, mv?, sig?, season?, pal, top?}`
  - `r`: 0 common / 1 rare / 2 epic / 3 legendary
  - `shape`: round | tall | flat | square | puddle
  - `trait`: drip | spark | bubble | wisp | glint | gravity | royal | chomp | climb | web
  - `mv`: walk | hover | scurry | blink | hop
  - `sig`: signature act id; `season`: "halloween" | "winter"
  - **`name` not `n`**, and ids are things like `gold` (not "goldie"), `tide` (not "drop")
- `sprite(faceName, spIdx, sil?)` → canvas (72×52, 2x supersampled). faceName is a
  **string key of FACES**, not an index — `sprite("idle", 3)`. `sil:true` = silhouette.
- `FACES` keys: idle lookL lookR blink happy love star wink sleeping shock
  content munch chew held1 held2
- `LEG` — **object map** `LEG[sp.id] → {wings?, halo?, floaty?, starburst?,
  embers?, strut?, trail?, goldtrail?, glow?, notes?, drool?, orbit?, pulse?,
  chips?, legs?}`. Not string tags — check the flags.
- `animProf(i)` → `{blink, blinkLen, fidget, breathe, hop, lean, waddle, arc, glee}`
  (no `hopF`, no `glint` — those names don't exist)
- `sprImg(id)` → prop sprite canvas; ids: bowl cushion box plant music mirror mat jar gem
- `jellyImg()` → 2x jelly-drop icon; `wingImg(frame 0-2, baseHex)`; `drawAccRaw(ctx, id, x, y, unit)`
- `makeHybrid(A, B)` → species object (palette/name blended, r ≤ 2);
  `SPECIES.push()` works, sprite cache handles new entries
- `rng(n)` → Math.random()*n helper

## Design system (current state — sprite-first, night-ranch)

- Palette: `--night #0e0a1e` bg, `--panel #1a1440`, `--edge #2d2454`,
  `--ink #e8e4ff`, `--dim #8f86c8`, `--jelly #8fe8c0` (mint accent),
  `--gold #eec23f` (used sparingly — best pack, season stars)
- Type: **Press Start 2P** for logo/micro-labels/rarity tags, **Nunito** for
  everything else (rounded, jelly-like). Sentence case, not ALL CAPS
- `.pxframe` — stepped 2px pixel-notch corners (clip-path) on every panel
- `.dither` — translucent checker texture on pack cards (the jelly alpha look)
- `.pxsep` — pixel-block section dividers; `.keycap` — key-cap element
- `.hico`/`data-ico` + `[data-lico]` — real sprite icons next to headings and
  loop steps; icon names: jelly | jar | mirror | cushion | pal (→ sprout)
- Hero = live canvas (`#ranch`): one pal, moon+stars sky, cursor-follow eyes,
  click=boop (squash+hearts), drag=held1/held2 wiggle, typing anywhere = jelly
  drops flying to the JELLY counter. `#mot` button pauses motion.
- Dex `#dex`: `.cell` grid with `.nm .rr .sn .sg` children, `.r0-.r3` rarity
  frames, click = squash reaction. Filters `.dexfilter button[data-r]` with
  `data-r="all"|0..3`, `aria-pressed`; `#dexmore` expands, `aria-expanded`.

## Hard rules (don't regress)

- `prefers-reduced-motion` — the sim already damps via `RM`; keep it working
- Keyboard: canvas is `role="button"` (Enter/Space = boop); dex cells are
  role=button with Enter/Space; every interactive element needs focus styles
- No frameworks, no build step, no new deps. Canvas `imageSmoothingEnabled=false`
- Real sprites only — don't hand-draw slime approximations when `sprite()` exists
- Verify before deploying: `node --check site/pals.js && node --check site/ranch.js`
  and grep that ranch.js symbols exist in pals.js (the last rewrite shipped
  `sprite(p.spIdx)` + a nonexistent `drawPal` — an all-empty page for a day)

## Design backlog (what's left)

1. **itch.io wiring** — pack `.packbuy` buttons are `disabled` ("itch.io — soon").
   When the itch listing ships: fill `GEM_SHOP_URL` in `src/main.js` + point the
   buttons there. Same for `UPDATE_URL`.
2. **Real product screenshot/clip** for the hero or a "how it looks on your
   desktop" strip — hardware overlay makes it un-capturable from CI; needs a
   user-side Win+G grab.
3. **Mobile audit** — hero stacking, pack-row → 1 col, dex filters wrapping,
   touch sizes. Never verified on a real phone.
4. **Polish the review leftovers**: og:image (a rendered pal would be a great
   card image), favicon, 404 page.
5. Optional: props/accessories/breeding were ported once (`SPR`, `drawAccRaw`,
   `makeHybrid` are still in pals.js) then cut when the hero went minimal —
   they can come back as a separate "playground" section if wanted, the
   engine is intact.

## Commit conventions

Conventional commits, commit message file `_commitmsg.txt` (the shell mangles
multi-line `-m`). Helper scripts are `_*.cjs` / `_*.ps1`, all committed.

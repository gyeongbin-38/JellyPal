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

## Payments — Stripe (wired, needs account setup)

Flow: **Stripe Payment Link** per pack → buyer's MY ID rides as
`?client_reference_id=` → Stripe webhook `checkout.session.completed` →
worker `POST /stripe` verifies `STRIPE_WHSEC` HMAC + dedupes `ev.id` →
`putGrant` → app polls `/claim` → jelly lands automatically. No codes.

- Site wiring: `PAY_LINKS = {A,B,C,D}` const in `index.html`'s inline script.
  Buttons stay "checkout — soon" until a real `buy.stripe.com/…` link exists.
  `#myid` input validates `JP[A-Z2-7]{24}` before checkout.
- App wiring: `GEM_PACK_URLS` in `src/main.js` — `packUrl()` appends
  `client_reference_id=<uid>` automatically on buy.stripe.com links.
  `GEM_SHOP_URL` = `jellypal.fun#jelly`.
- Worker: `PRICE_<cents>` vars in `wrangler.toml` map amount → pack
  ($1.00→A, $1.79→B, $2.99→C, $5.99→D); `metadata.pack` also honored.

**Owner to finish** (can't be done from code):
1. Stripe dashboard → create 4 Payment Links (250/$1.00, 500/$1.79,
   1000/$2.99, 2500/$5.99) → paste into `PAY_LINKS` + `GEM_PACK_URLS`
2. Dashboard → Developers → Webhooks → endpoint `https://api.jellypal.fun/stripe`,
   event `checkout.session.completed` → copy signing secret →
   `cd server && npx wrangler secret put STRIPE_WHSEC`
3. Rebuild the app so the shop copy/link wiring ships; update `site/dl`
   binaries + SHA-256s on the page

## Design backlog (what's left)

1. ~~itch.io wiring~~ → replaced by Stripe (see above). `UPDATE_URL` still empty.
2. ~~Product screenshot~~ — DONE via the stylized `shot-desktop.png` (slimes on
   a mock desktop) in a `.deskshot` section + as og:image. A real Win+G capture
   would still be better when someone can grab one.
3. ~~Mobile audit~~ — CSS pass done (@560px: packs 1-col, ranch 240px, nav
   collapses to Download only). Still unverified on a real phone.
4. ~~og:image / favicon / 404~~ — DONE: og:image = shot-desktop.png, favicon =
   real 32px app icon, `404.html` shows a sleeping Ghost pal.
5. Optional: props/accessories/breeding were ported once (`SPR`, `drawAccRaw`,
   `makeHybrid` are still in pals.js) then cut when the hero went minimal —
   they can come back as a separate "playground" section if wanted, the
   engine is intact.

## Commit conventions

Conventional commits, commit message file `_commitmsg.txt` (the shell mangles
multi-line `-m`). Helper scripts are `_*.cjs` / `_*.ps1`, all committed.

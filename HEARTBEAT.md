# Heartbeat protocol — how autonomous development runs

Every pulse = **one small, verified improvement**. The app gets quietly
better each cycle and is never left broken. A pulse that can't go green
gets fixed or reverted — it does not ship.

## Autonomy — FULL mode (user-approved)

- **Run continuously** — don't stop for permission between pulses. Keep
  going until: a P0 I can't fix, an inbox item needing a decision, or a
  real design fork.
- **`INBOX.md` first** — the user drops requests there any time. Every
  pulse reads it before the priority queue; inbox items jump everything
  except a live P0 crasher. Check them off with a note when done.
- **Ask more** — a real fork (UX trade-off, rarity, feel, scope) gets
  surfaced in the pulse report as a question instead of being guessed.
  Unsure whether something is wanted? Ask. One-line pulse reports stay,
  but questions never get swallowed.
- **Batch builds** — code+tests per pulse; `cargo build --release` +
  `dist.cjs` when a coherent user-facing batch accumulates (~3-5 pulses
  or one big feature). A stale running exe is fine — the harness is the
  real gate.
- **Monetization is the user's job** — I write code and assets only;
  accounts, payments, uploads, and the itch page are theirs.
  `GEM_SHOP_URL` stays empty until they ship the page.

## The cycle

1. **READ** — check `INBOX.md` (user requests — jump the queue) +
   `HEALTH.txt` (last pulse result) + `PROGRESS.md` (what happened last
   session) + `crash.log` (real-world failures). Pick ONE task from the
   priority queue below.
2. **IMPLEMENT** — the smallest change that completes the task. One
   feature OR one fix per pulse, not a grab-bag.
3. **VERIFY** — `node _pulse.cjs` must be GREEN. Every new behavior gets
   a test in `_verify.cjs` in the same pulse — untested code doesn't land.
4. **LOG** — append the session block to `PROGRESS.md`: what, why, test
   count, build status.
5. **SHIP** — batched, not per-pulse (see Autonomy). `cargo build
   --release` + `node dist.cjs` when a coherent user-facing batch
   accumulates. No butler push, no PRs, unless asked.

## What gets implemented — priority queue, top first

1. **Crashers** — frame-throwers, freezes, NaN, invisible pet. Always
   first; nothing else matters while the loop can die.
2. **Broken behavior** — user-reported bugs, failed harness checks,
   wedged states (stuck acts, sleepwalking, floating pals).
3. **Polish of existing systems** — better motion, sprite detail,
   reaction timing. Improve what's there before adding new.
4. **New content in established patterns** — species, accessories, props,
   interactions. Small, themed, gated-rare, following existing tables
   (ACC_RUNS / PAL_ACC_BITS / SPR / propArrive style).

## What never gets implemented

- Always-on or frequent effects — interactions stay RARE (cooldowns in
  the tens-of-seconds to minutes range).
- Anything that blocks, covers, or steals focus from the user's work —
  no popups, no taskbar occlusion, no forced attention.
- Monetization changes, store flow changes, or price changes.
- Removing features, big rewrites, framework swaps.
- Reading clipboard contents, file contents, or window titles beyond
  the existing app-kind classification.
- New permissions or capabilities outside what exists today.

## Bug priorities

- **P0** — crash, freeze, NaN, pet invisible, save corruption. Stop
  everything; fix before any feature work.
- **P1** — stuck/wedged state, wrong visual (bad pivot, missing glyph,
  z-order), behavior opposite of intent (sleeping pet walking).
- **P2** — timing/rarity tuning, flaky tests, cooldown balance.
- **P3** — cosmetic nits, naming, dead code.

## The verification gate — all must pass before "done"

| Check | Command | Covers |
|---|---|---|
| syntax | `node --check src/main.js` | parse errors |
| sprites | `node _sprcheck.cjs` | row widths + palette chars |
| behavior | `node _verify.cjs` | 93+ driven scenarios |
| frame soak | `node _sim.cjs` | 600 clean frames |
| real save | `node _repro.cjs` | 7200 frames on actual state.json — run when persistence/load touched |

Rules:
- New behavior ⇒ new `_verify.cjs` test in the same pulse.
- A failing test is information, not noise — fix the code or fix the
  test honestly; never delete a test to go green.
- Crash counters exclude "tick" heartbeats and "clip-" diagnostics.
- `node _pulse.cjs --watch` while editing = continuous gate.

## Product values every change must preserve

- **Subtle, rare, interruptible** — every ambient behavior has a
  cooldown, an abort path (grab/panel), and a `reduceMotion` fallback.
- **Low-noise** — the desktop is a workplace first, a diorama second.
- **Lightweight** — heartbeat-scale work only: no per-frame allocations
  of arrays, no heavy loops added to frameBody.
- **Offline & private** — no network calls, no content snooping.

# Jellypal (was Typet) — progress log

## Status
Working Tauri app: transparent fullscreen always-on-top overlay (click-through except pet + UI), slime pet living on the desktop / window tops, ranch UI with gacha, breeding, and accessories. Renamed to **Jellypal** (itch project name) — exe is `jellypal.exe`, identifier `com.jellypal.app`, redeem prefix `JELLYPAL-`. Runs as `src-tauri/target/release/jellypal.exe`.

## How to continue
```bat
taskkill /F /IM jellypal.exe
cd /d C:\dev\mini\typet\src-tauri
set "CARGO_HOME=C:\home\cargo" && set "RUSTUP_HOME=C:\home\rustup" && cargo build
target\debug\jellypal.exe
```
- `node _pulse.cjs` — one-command gate: syntax + sprites + verify + sim,
  GREEN/RED in ~4s, writes `HEALTH.txt`. `--watch` re-pulses on changes.
- `HEARTBEAT.md` — the protocol: what each pulse may implement, bug
  priorities, the verification gate, product guardrails. Follow it.
- `node _sim.cjs` — DOM-stubbed frame harness; run BEFORE rebuilding to
  catch frame()-level ReferenceErrors (the two freeze bugs were this
  class). 600 clean frames = loop alive.
- exe must be killed before rebuild (file lock).
- Frontend (`src/*.js`/`html`/`css`) is embedded into the exe — changes REQUIRE `cargo build`. No hot reload.
- State file: `%APPDATA%\com.jellypal.app\state.json` — dev save migrated from com.typet.app (all species + accessories unlocked).
- Backlog: `NEXT.md` (top 5 mirrored below).

## Last session 61 (user: continue — cleared the remaining backlog)
- **clean-machine first-run test** (`_cleantest.cjs`, 11 checks): kills
  running instances, hides the dev save, boots the REAL exe with no
  state.json → fresh profile verified (sprout only, no acc/pals/codes,
  jelly=50 stipend), no crash.log growth, dev save restored. Registered
  as the `cleanboot` pulse step.
- **qacheck baseline gate**: the 6 authored floating decorations (frog
  stalk eyes, inky wisps) are now an explicit KNOWN set — a NEW float
  fails, and a known one VANISHING also fails (silent sprite change).
  Registered as the `qa` pulse step.
- **surf-vs-hide fix**: the box-ride tracking and window-surf fought —
  a hidden pet got `petX = box.x` then surf added wdx back. surf now
  skips while `boxHide` (the pet is IN the box, not on the deck).
- **cleanboot flake fix**: first save lands on dirty + 5s persist tick
  (daily stipend timing) — poll up to 25s instead of a fixed 9s wait.
- localization item resolved: already DEFERRED in NEXT.md — the 5x7
  ASCII bitmap font can't do KR/JP (or even accented Latin); un-block
  only if a KR/JP launch is planned.
- pulse now **11 steps, all GREEN** (24s): syntax, sprites, fresh ×3,
  codes, verify 303/303, pals 60/60, sim, qa, cleanboot 11/11.
  Rebuilt + zip (2.0MB), relaunched (PID 32708).

## Last session 60 (user confirmed: go with the Stripe + signed-code plan)
- user approved the architecture — hardened the seller workflow:
  - `codes.cjs` mint now **self-verifies every code** before printing (a
    corrupt key fails here, not in a buyer's inbox) and accepts an
    optional outfile: `node codes.cjs C 50 codes_C.txt`
  - gem shop gained a second hint line: "SAVE IT - ONE USE ONLY"
    (hyphen — the bitmap font has no em-dash glyph)
- go-live checklist remaining (seller-side, not code):
  1. back up `seller_ed25519.key` OFFLINE (gitignored already)
  2. Stripe dashboard → Payment Links ×4 ($0.50/$0.90/$1.90/$3.90)
  3. paste links into `GEM_PACK_URLS` in main.js → `cargo build --release`
  4. per order: mint one code (`node codes.cjs <pack> 1`), send it on the
     Stripe success page text or by email; smoke-test with
     `jellypal.exe --verify-code <code>` before handing it out
- gates green: verify **303/303**, codes **11/11**. rebuilt + zip +
  relaunch (PID 28712).

## Last session 59 (user report: "자면서 움직이는데?" — sleep-movement bug hunt)
- audited every path that writes petX/pal x while a sleeper shows the
  sleeping face + zzz. three real leaks found and fixed:
  1. **mid-climb/web doze-off drifted sideways** — the release gave the
     pet petVX=±120 so it glided across the screen asleep. now drops
     straight down (petVX=0) and the doze also clears spinT0/huntScore/
     circScore (a queued twirl could finish mid-doze)
  2. **window-surf carried sleepers** — dragging the window a pet was
     sleeping on slid it along with zzz still puffing. a >10px slide now
     jolts it awake (awakeAt reset, shock face + "!"), same for cushionNap
  3. **napping pals fell asleep-faced when their window closed** — deck
     drop now clears restUntil so they wake mid-fall with the shock face
- also: a hidden pet/pal now tracks a dragged box (popped out at the
  box's old spot before)
- tests: `_verify.cjs` +9 — real-interval doze test (waits for the 1s
  sleep tick), surf-jolt wake for both sleep channels, pal deck-drop
  wake. suite **303/303**. rebuilt release + zip (2.0MB), relaunched
  (PID 29532).

## Last session 58 (user request: Stripe + hack-proof codes)
- **replaced the forgeable HMAC scheme with Ed25519-signed codes** —
  the old `rhash`/`RSALT` validator was symmetric: anyone unpacking the
  exe could mint codes. Now `codes.cjs` signs `JP2:<pack>:<nonce8>` with
  a private key that never ships; the binary embeds only the PUBLIC key
  (`GEM_PUBKEY` in lib.rs), so forged codes are cryptographically
  impossible. `seller_ed25519.key` is gitignored — seller keeps it
  offline, backs it up.
- **Rust verifier**: `verify_gem_code` Tauri command (ed25519-dalek)
  parses `JELLYPAL-<pack>-<nonce8>-<sig>` → returns the gem amount or
  rejects. Frontend `tryRedeem` is now async, normalizes input, checks
  the per-save `redeemed` list (one-shot), and awaits the Rust verdict.
- **`codes.cjs` modes**: `keygen` / `pubkey` / `verify <code>` /
  `<pack> <count>` minting. Also `jellypal.exe --verify-code <code>`
  checks a code in the shipped binary (exit 0/1) — useful before
  listing codes on Stripe.
- **UX**: codes are ~120 chars (signed), so the redeem box gained
  Ctrl+V paste (focus-trap input, native paste) and a 160-char buffer.
- **Stripe setup for the seller**: create 4 Payment Links in the Stripe
  dashboard → paste into `GEM_PACK_URLS` → success page shows the buyer
  their code (mint with `node codes.cjs <pack> N`, embed in the success
  page text or send by email). Money flows Stripe-side; gems flow
  code-side; nothing server-side to hack.
- residual risk, stated honestly: (a) a leaked paid code redeems on any
  machine — bounded, one unique code per buyer; (b) local save editing
  can always inflate gems — inherent to offline single-player apps.
- tests: `_codes.cjs` (9 node checks + 2 real-exe checks: key match,
  crypto verify, pack/nonce/truncation forgery all rejected, shipped
  exe accepts minted + rejects forged); `_verify.cjs` +7 (one-shot,
  malformed, unknown pack, async flow); Rust unit tests exist but
  `cargo test` can't run on this box (rust-lld test-binary CRT quirk —
  the --verify-code path covers the real code path instead).
- gate: verify **294/294**, codes **11/11**, fresh 17/17 ×2 + seeded
  5/5, sprites clean, sim 600 frames clean. Rebuilt release + zip
  (2.0MB), relaunched (PID 32708).

## Last session 57 (user request: real payment for gems)
- **per-pack BUY chips in the gem shop**: each pack row now has a BUY
  chip on its right edge (green when linked, grey "TBD" when not).
  Clicking opens the pack's own checkout URL in the system browser via
  the existing `open_url` Tauri command (https-only).
- **`GEM_PACK_URLS = {A,B,C,D}`** — new constant next to `GEM_SHOP_URL`:
  paste a Stripe Payment Link, Gumroad product URL, or itch reward page
  per pack. `packUrl(id)` falls back to `GEM_SHOP_URL` when a pack has
  no specific link, and the bottom row is now "STORE PAGE" (fallback).
- the money loop is: BUY chip → buyer pays on YOUR checkout → receives a
  one-shot `JELLYPAL-X-NNNNNN-SSSS` code (generate with `node codes.cjs
  <pack> <count>`) → REDEEM row grants the gems. No backend needed —
  verification lives in the salted checksum, codes are one-shot per save.
- NOTE: real payment goes live the moment real links are pasted into
  `GEM_PACK_URLS`/`GEM_SHOP_URL` — no rebuild of logic needed, just the
  constants (rebuild required since frontend is embedded).
- tests: `_verify.cjs` records last invoke args (`callArgs`) and checks
  the pack-B chip invokes `open_url` with exactly its URL, an unlinked
  pack shows STORE LINK TBD without invoking, and the redeem row still
  opens the code modal.
- gate: verify **290/290**, fresh 17/17 ×2 + seeded 5/5, sprites clean,
  sim 600 frames clean. Rebuilt release + zip, relaunched (PID 20560).

## Last session 56 (user request: gear ownership gate + gacha/breed audit)
- **gear ownership is authoritative through `accOwned`** — verified end to
  end and hardened. Pal-card picker and ranch picker already list
  `[null, ...accOwned]` only; the dev save just had every doodad unlocked.
  Hardened the load path: `accEquip` entries now get stripped unless the
  accessory is in `accOwned` AND the species is in `owned`, so a
  stale/doctored save can never show unpurchased gear as equipped.
  Fresh-state `accOwned` starts empty.
- **gear cell affordance**: the empty cell now reads "+" (add gear) not
  "-", and the picker modal shows a "NO GEAR YET / BUY AT RANCH SHOP"
  hint when `accOwned` is empty.
- **cross-audit caught 3 real leaks**:
  1. `doBreed()`'s 25% unowned-base roll had NO rarity filter —
     legendaries (r=3) could be bred, contradicting the "legendary never
     comes from breeding" comment. Fixed: pool is now `s.r <= 2`.
  2. `hatchEgg()`'s pool lacked `seasonOpen()` — eggs could drop
     out-of-season species while every other path (gacha, shop, breed)
     is seasonal-gated. Fixed.
  3. duplicate-pull label hardcoded `+4` while DUP_REFUND pays 15 —
     label now uses the constant.
- **documented live numbers**: gacha `RARITY_W=[60,28,9.5,2.5]` →
  common 60 / rare 28 / epic 9.5 / legend 2.5; pity rare+ ≤12 pulls,
  legend ≤50 (both counters persist); spotlight 15% within rolled tier;
  shiny 8% on NEW species only; bonus accessory drop 18% of a locked one;
  PULL_COST 50, DUP_REFUND 15, JELLY_EVERY 600 keys/gem.
  Breeding: BREED_COST 20, cooldown 5h (skip 100), needs ≥2 owned, demo
  blocked; 25% unowned base species (r≤2, seasonal) else a hybrid;
  hybrid rarity = max(parents) +10% bump when same-rarity, capped at 2;
  each trait slot 50/50 from parents; 15% shiny inherit when a parent
  is shiny; child is a baby for its first hour.
- **tests**: `_verify.cjs` +17 checks — rarity tier rolls, both pity
  floors + reset, pull cost/dup-refund ledger, breed 25%/75% branches,
  empty-`accOwned` picker showing only "-". `_fresh.cjs` gained a
  `seeded` mode (crafted save smuggling unowned gear → stripped on
  load). `_pulse.cjs` registers `freshseed`.
- gate: verify **287/287**, fresh 17/17 ×2 + seeded 5/5, sprites clean,
  sim 600 frames clean. Rebuilt release + zip, relaunched (PID 22332).

## Last session 55 (user request: pal card gear = single cell + modal picker)
- **pal card gear → modal flow**: the inline 6-cell strip on the pal
  status card is now ONE gear cell (shows the equipped doodad or "-")
  with a CHANGE hint — clicking it opens an EQUIP modal overlay inside
  the card: 6-col grid of all owned accessories, equipped cell outlined
  green, "-" unequips, pager beyond 36 items, pick = equip + auto-close,
  click off the grid dismisses, X still closes the whole card
- `_palaudit.cjs` now `process.exit(0)` on success — main.js timers kept
  the event loop alive so the pals step always timed out (was the phantom
  RED in every pulse despite 60/60)
- pulse GREEN: verify **270/270**, pals 60/60, fresh 17×2, sim clean
- release rebuilt, zip repacked (1.9MB), running PID 7000

## Last session 54 (heartbeat: props batch 2 — mirror/mat/jar, click-priority fix)
- **3 more placeable props** — toybox strip is now 9 slots
  (ball/bowl/cushion/box/plant/music/**mirror/mat/jar**):
  - MIRROR: walk up & preen — bold slimes smug + "✦" + sparkles, timid
    (`flee`) ones startle-hop away with "!"; glass gleams periodically
  - MAT: jelly bounce pad — stepping on it launches a happy boing
    (`flying` + content face + "♪"); pad over-inflates on bounce/tap
  - JAR: cookie jar — autonomous nibbles drain `fill` (empty → pout + "?");
    tap restocks AND spills a REAL treat beside it → the snack race fires
  - all: draggable, platform-snap, persisted, per-pet & per-pal cooldowns
- **pal arrival chain extended**: mirror (preen/flee by `ppsy.flee`),
  mat (`fly` launch scaled by `animProf.hop`), jar (nibble/"?")
- **click-priority fix (real product bug)**: furniture grab ran BEFORE the
  slime hit test, so a pet napping ON the cushion could never be picked
  up — the click always grabbed the cushion. Slimes now win the click.
- **flaky-test surgery**: cushion-evict test now pins cursor + every
  channel that can steal `walkTarget` (startle/hunt/dance/web/climb);
  hidden-pal poke check tightened to `palAt() !== pals[0]` (another pal
  may legitimately stand on the spot)
- `_palaudit.cjs`: eval-per-frame → eval-per-3/4-frames (audit runtime
  roughly halved); `_pulse.cjs` pals step timeout 300s→480s
- verify: **268/268** incl. 11 new prop assertions

## Last session 53 (heartbeat: props x3, pal gear card, per-species audit)
- **3 new placeable props** — toybox strip is now 6 slots
  (ball/bowl/cushion/**box/plant/music**):
  - BOX: pet climbs in & vanishes (rustle particles + "?"), tap the box
    to startle it back out; pals hide too (`hideUntil` — no render, no
    hits, no actions, can't be poked)
  - PLANT: walk-over sniff — nuzzle+heart or a pollen sneeze ("!");
    tapping waters it (droplets + perked leaves)
  - MUSIC BOX: wind it → notes + spinning key, the pet dances, and every
    nearby grounded pal bounces along ("♪")
  - all five props draggable (platform snap) + persist across sessions;
    pet errands roll box/plant/music too, pals have cooldowns per prop
- **right-click pal card → accessory picker**: the pal status card now
  shows an owned-accessory strip (6/page + "-" unequip); click a cell to
  equip/unequip that pal's species — `accEquip[species.id]`, persists,
  re-renders live. card height grows when the strip is open
- **hidden-pal physics fix** (audit-caught): a pal inside the box still
  counted as a soft-body — walking pals shoved the invisible body out of
  the box. separation loop now skips `q.hideUntil` — a hidden pal has no
  body to shove
- **`_palaudit.cjs` — the requested one-by-one sweep**: spawns EVERY
  species (60) as a pal and verifies individually — palette completeness,
  PSYCH personality binding, platform landing, gait motion
  (walk/scurry/burst/blink/hop/hover each observed), nap freeze + Z
  trail, species signature flourish fire+clear, accessory render path,
  zero frame crashes. wired into `_pulse.cjs` STEPS as `pals`
- **flaky-test stabilizations** (each traced to a real mechanism):
  - stack-mounts made "blockers" walk — a pal that rolled a mount mid-
    test rode the walker instead of standing still; every pal pin now
    clears `stackOn`+`stackCd`+`follow`+`tag`+`hideUntil`
  - tag-beat test stubbed `Math.random=0.99` mid-chase → deterministic
    timeout laugh (kills pounce/copycat/stumble rolls)
  - gait test reads PEAK petSpd across the walk, not post-arrival 0
  - cushion-nap test parks pals away so one can't steal the treat
  - grab test clears stray props (new prop grab zones could eat clicks)
- pulse GREEN: verify 256/256, pals 60/60, fresh 17x2, sim clean

## Last session 52b (heartbeat: tag chase actually resolves)
- pal-vs-pal TAG could never end in a catch — both slimes walk at the
  same speed, so the chase always burned out on the 3.2s timeout and
  the tags silently evaporated mid-stride (the "어색해" report)
- **tagger pounce-hops** when the gap is >70px (dt*0.45 roll) — a real
  leap that closes distance; **fleer stumbles** (dt*0.55 → walkT=null +
  squash) so the chase can actually end in a TAG!
- **timeout ends with a beat** — both stop, face each other, trade a
  tired laugh + ♪ instead of just forgetting the game existed
- asymmetric break fix (harness-caught): the tagger's pounce sets
  p.fly, and the fleer's shared `o.fly` check silently killed ITS tag —
  now `o.fly` only breaks it for the tagger (fleer launched = escaped);
  grabs/webs/y-gaps still break both ways
- _verify.cjs +2 checks driving a forced tag to resolution; beat guard
  requires a true timeout (`now > until` + both still valid)
- pulse GREEN 222/222

## Last session 52 (heartbeat: autonomy FULL + clean-machine harness)
- user approved full autonomy: pulses run continuously, INBOX.md read
  first each cycle, builds batched (~3-5 pulses), monetization is user's
- HEARTBEAT.md: added Autonomy section + inbox-first ordering; created
  INBOX.md (user drops requests any time, they jump the queue)
- **clean-machine first-run verified** — new `_fresh.cjs` harness boots
  with an EMPTY save (the itch downloader's first launch): sprout
  spawns, owned defaults, DAY1+WEEK gifts land (10→50 jelly = exactly
  one pull), tutorial hint flag works, egg stays gated until first
  typing, first persist writes a sane save, settings/FAB on-screen.
  Edge variant: save file containing literal "null" — caught a real
  crash: `JSON.parse("null")` returns null → `s.xp` threw → the whole
  load silently died. Fixed with `|| {}`
- _pulse.cjs STEPS now: syntax, sprites, fresh, freshnull, verify, sim
- pulse GREEN — fresh 17/17 x2, verify 220/220

## Last session 51 (heartbeat: settings panel fits small screens)
- picked from NEXT.md #5: the 14-row settings panel was a fixed 424px —
  on a small laptop the bottom rows (GEMS/REDEEM/QUIT) rendered offscreen
  AND still took invisible clicks
- `settingsRect()` height = `min(424, max(220, winH-70))`; rows live in a
  clipped viewport (SET_VIEW_TOP 26 / SET_VIEW_BOT 34) between the pinned
  title and the pinned footer stats
- `setScroll` + `setMaxScroll()` (388 = last-row bottom offset); canvas
  `wheel` listener scrolls the list ±26px per notch, panel-bounded,
  preventDefault'd; scrollbar + pixel-triangle chevrons only when the
  content actually overflows (`^` isn't in the FONT table — drew rects)
- hit-test clamps to the viewport so a scrolled-out row can't be clicked;
  `settingsRows()` self-clamps scroll after a window shrink; opening the
  panel resets scroll to top
- `_verify.cjs` +12 checks: panel-fit math, scroll range, wheel inside/
  outside, clamp-at-end, QUIT reachable, hidden-row click rejected,
  resize clamp, tiny-screen footer, no scrollbar at full size. getEl
  stub now records listeners so canvas events are dispatchable
- pulse GREEN 220/220

## Last session 50 (per-species audit + ride removal + pal physics/personality)
- user: per-species verification, webby anchor, remove cursor ride,
  pal side/bottom physics, personality-scaled interactions, pal-play audit
- **cursor ride REMOVED** — the perch-charge→mount→pendulum feature is
  gone (user: "오류가 심하다"): rideT0/rideAng/rideScore/rideUntil/
  perchScore/perchTell/perchLatch/rideCd vars + mount branch + whip-throw
  + hints + status text + joyride face all deleted. begging under the
  cursor stays (sits + paw-wiggle, no climbing). parked cursor now just
  earns a glance: pet pauses its stroll and looks over
- **webby anchor fixed** — pal silk lines hung ±46px BESIDE the cursor;
  now anchor AT it with a ±12px per-pal stagger (physics + line render)
- **pal slab physics** — platforms were tops-only; pals ghosted through
  window bodies and hovered inside them. falling inside a platform's
  column now slides the pal down the side face toward the near edge
  (vx shove + face-dust). platform loss >40px now reads as a REAL drop
  (p.fly) instead of an eerie vertical ease through solid windows
- **personality scaling wired** — psy.pace now scales accActNext (main),
  pal accCd, fidget cadence (was INVERTED: hyper fidgeted less), legFlair
  spacing; psy.follow scales the beg roll. hyper really does act ~2x
- **act starvation fixed** — rare/legendary species wander so often that
  `!walkTarget` in the act gate meant their accessories NEVER fired
  (found by the species sweep). act may now interrupt a stroll —
  startAccAct cancels it anyway. same for pal bits (walkT gate removed)
- **pal play de-awkwardized** — pal-vs-pal bumps now face each other
  (they used to pop hearts while staring into space), plus soft body
  separation: grounded pals on one deck gently shove apart to a
  slime-width gap instead of clipping through each other
- **_verify.cjs species matrix** — 58 species × (profile resolve +
  face render + one real accessory act end-to-end, rotating through all
  18 act ids) + pal side-slide test. total 208 checks
- harness lessons: species sweep must pin nextWander/legFlairT/webCd AND
  park curX at -9999 — the cursor-follow branch otherwise re-assigns
  walkTarget every frame for r≥1 species (240-700px follow radius)
- pulse GREEN 208/208, rebuilt + zip (1.9MB), running PID 15092

## Last session 49 (heartbeat: in-app self-heal + dev pulse)
- user: "자율적으로 디벨롭 가능하게 하트비트 돌리자"
- **in-app self-heal** — the existing 20s tick heartbeat now doubles as a
  self-repair sweep, all cheap O(1)/O(pals) checks:
  - OFFSCREEN rescue: pet/pal flung past the frame edge snaps back in
    view (drop-in with flying), logged OFFSCREEN / PAL-OFFSCREEN
  - ACT-WEDGED: accAct older than 12s (scripts end ≤6s) drops itself —
    covers a flyby stranded with no flight, whose cleanup lives in the
    flying branch. stray propSpin with no act parks too
  - SIG-WEDGED: sigT0 older than 20s resets so a wedged signature can't
    freeze wander/follow forever
  - stale spinT0 (>4s) clears
  - props anchored to a dead platform object (stale poll snapshot)
    re-snap to the nearest live deck via platUnder
  - memory caps: fx/bangs/hearts/ripples trimmed past 420/90/50/70 —
    a particle leak can't grow unbounded
- **_pulse.cjs** — dev heartbeat: `node _pulse.cjs` runs syntax +
  sprites + verify + sim in ~4s, prints GREEN/RED, writes HEALTH.txt.
  `--watch` re-pulses on every src/*.js/css/html + _verify.cjs change
  (debounced) — autonomous sessions self-verify each edit.
- _verify: 93/93 (new: wedged-flyby self-heal via heartbeat).

## Last session 48 (sleepwalking fix + twirl redesign)
- user: "자고 있던 슬라임이 내 커서를 따라오는데?? 한바퀴 도는 모션이 별로"
- **sleepwalking** — the cursor-follow branch only gated its sig roll on
  `state !== "sleeping"`; the walk branches themselves had no check, so a
  sleeping slime glided toward the cursor with its eyes closed. follow +
  treatAim + snack branches now all gate on `state !== "sleeping"`, and
  the sleep transition clears walkTarget/hopTarget/walkGoal so a pet that
  nods off mid-errand stops instead of shambling on. snacks go stale
  (9s expiry) rather than being sleep-chased. the existing wake rules
  stay: cursor inside 85px still stirs it awake.
- **twirl redesign** — the spin used to rotate rigidly AROUND THE FEET at
  a constant rate — a satellite orbit at fixed rpm, which is why it read
  broken. now: eased-out full turn (cubic, fast start soft settle),
  pivoted on the body's mid-height via a translate-rotate-translate,
  a 13px lift arc, jelly stretch tall at speed with an anticipation
  squash in the first 18%, and a landing squashV pop. 620ms total.
  reduceMotion keeps the lift arc but skips the rotation (reads as a
  gentle hop).
- bang glyph audit: "♫" had no sprite/font → added to BANG_SPR→note;
  "…"/"HMM…"/"HMPH♪" fell back to "?" → now "..."/"HMM..."/"HMPH!".
- _verify: 92/92 (new: sleeping pet ignores cursor at 120px).

## Last session 47 (accessory audit — the real bugs + exhaustive verify)
- user: "악세사리 효과들에 지금 버그 있어. 확실하게 전부 되는지 확인하고,
  메인팔만 그런게 아니라 서브 팔들도 상호작용 되게 해줘"
- **THE BUG** — `drawAccRaw`'s propeller branch referenced `t`, which only
  exists inside frameBody — `c.rotate(propSpin ? t * propSpin : 0)` threw a
  ReferenceError EVERY frame during a flyby → frame skipped → pet vanished
  mid-flight. parked propSpin=0 hid it. now `performance.now()/1000`.
- **sleep gate** — the act trigger had no `state` check: a sleeping pet
  could burst into "ACHOO!"/"HMPH". added `state === "idle"`.
- **stack freeze** — the pal bit runner lived inside the `!p.stackOn` else:
  a pal that mounted a totem mid-bit froze its bit forever. `p.accAct=null`
  at mount (interrupts cleanly like grabbing).
- **pal coverage** — `mohawk` had no pal bit at all; added it + 11 more
  (bow, ribbon, patch, pumpkin, santa, cap, beanie, beret, tophat, band,
  clip) → all 29 equipped ids do something. PAL_FLY_BITS +bow/ribbon/
  pumpkin so their little hops don't self-abort. pal bits also respect
  `restUntil` (no bits while napping).
- **`cool` was a no-op** — shades' "slide" set `petVX` while grounded
  (ground speed ignores it). now a real low slide-hop.
- **robustness** — both step-runners wrap each step in try/catch: a bad
  step aborts the act instead of wedging it + spamming crash.log every
  frame. opening settings/ranch now aborts a live act.
- **_verify.cjs is now exhaustive** — sweeps ALL 18 ACC_ACTS through the
  real trigger→steps→cleanup path, all 14 ACC_RUNS scripts force-started,
  all 29 PAL_ACC_BITS run to completion, grab-abort contract, flyby
  render-crash check. crash counter filters "tick" heartbeats (20s pulse,
  not a crash). 91/91. previous run caught the mohawk/stack freeze as a
  400-frame hang.
- harness flake fixes: `accCd=9e9` pinned per bit (a real re-trigger was
  miscounted as a hang), nap-face check clears competing faces first.

## Last session 46 (prop redesign + clipboard diagnosis)
- user: "소품들 더 구체적으로 디자인. 복붙 상호작용 안 되는데? 잘 되긴
  하는 건가"
- **clipboard diagnosis** — the guard was eating it: copyPeek skipped
  entirely while flying/riding/sig/sleeping (which is most of the time).
  now the "!?"/"?" bang + shock face ALWAYS show (only petHome/held skip);
  look+hop only when grounded. copy→"!?" 700ms, paste→"?" 450ms, longer
  bang life. copy cd 6s / paste 8s.
- **arrival instrumentation** — copyLog() counts raw copy/paste events
  into crash.log ("clip-copy#N", first 20) so event delivery is verifiable
  without guessing. hook.log absent → rdev thread healthy.
- **prop redesign** — bowl 11×6→17×9: wooden body, metal rim, heart
  emblem, kibble fill overlay rescaled (mask x-16 w30 / heap above rim /
  scraps / rim shine). cushion→19×9: piping ring, center button tuft,
  corner tassels. egg gains age-based crack overlays (crack1 @70s,
  crack2 @130s) + wobble that quickens and grows as hatch nears.
  ball gains a static shine spot (light source stays while it spins).
- **post-refill steam** — propTap("bowl") sets steamUntil 15s; wisps
  drift up while it lasts.
- grab radii + click-through rects widened for the bigger sprites;
  _sprcheck.cjs added (row-width + palette sanity, all clean).
- verify 88/88, _sim 600 + _repro 7200 clean. rebuilt + relaunched
  (PID 30068), zip 1.9MB.

## Last session 45 (accessory routines + prop detail)
- user: "소품들 더 세세하게. 악세사리에 상호작용을 넣는 거지 — 프로펠러로
  창을 난다거나 망원경으로 지켜본다거나 콧수염으로 뽐낸다거나. 드물게."
- **accessory routines (pet)** — `accAct`/`accActNext`/`propSpin` state +
  `ACC_ACTS` per-acc cooldowns (90–150s) + `ACC_RUNS` timed step scripts +
  `startAccAct()`. triggers only while idle/on-ground/no-walk-target/
  slow-cursor; wander+follow rolls suppressed mid-act; held/sigT0/
  petHome/climbing aborts; landing+recall clean up. routines: flyby
  (prop), inspect (monocle/specs), strut (stache), jam (phones/mohawk),
  bless (halo, pals get love faces), signal (antenna), bask (leaf), hero
  (scarf), cool (shades), royal (crown/tiara, pals turn to watch), spell
  (wiz), sniff→ACHOO (flower), stamp (horns), party (party), flutter
  (wings). reduceMotion blocks all of it.
- **flyby** — gravity-free steering inside the flying block: 650ms spool
  up → cruise toward a random window-top platform (or a point overhead)
  → throttle cut → normal landing. `propSpin` rotates the blade bar +
  cross-blur while hot; prop-wash dust streaks.
- **pal acc bits** — `PAL_ACC_BITS` one/two-beat mini versions on a
  100–200s per-pal cooldown; `PAL_FLY_BITS` whitelists bits that launch
  their own hop; grabbing the pal aborts.
- **prop detail** — bowl kibble level `fill` (3→0): munch decrements,
  empty bowl → slime arrives to a "?" + pout + no munch (bowlCd 60s);
  a TAP on the bowl (grab released within 10px) refills to 3 via
  `propTap()` + pour fx; tap on cushion = `cushionPoof` fluff burst +
  inflate pulse; settling on the cushion puffs dust sideways. fill is
  persisted (old saves default to half). ball gets `sq` impact squash
  (proportional to landing speed) + dust puffs on hard bounces.
- fixed a pre-existing flake: bowl-munch contentUntil could shadow the
  nap-face check → cushion test now clears contentUntil first.
- verify: 88/88 (11 new: act start/complete/cooldown/flyby+spin+landing/
  reduceMotion/pal bit/fill spend/empty pout/tap refill/tap fluff/ball
  splat). _sim 600 + _repro 7200 real-state clean. rebuilt + relaunched
  (PID 23828), dist zip regenerated 1.9MB.

## Last session 44 (floating-pal fix + FAB accordion + HUD removed)
- user: "팔이 공중에 떠 있을 수 있는데? 토글 버튼을 원 하나로 만들고
  아코디언으로 펼치게 — 지금 작업에 방해된다. 젬 수도 빼버려". changes:
- **floating pal FIXED** — p.plat cached a platform OBJECT from an old
  poll; when its window closed the reference went orphaned and the
  hysteresis kept it forever → pal hovering on air. the grounded branch
  now verifies a LIVE platform still supports (p.x, p.y) before keeping
  the cached plat (`stillThere`); gone → re-pick → platUnder → sink +
  shock face (replaces the earlier unconditional shock check).
- **radial FAB** — the five top-right buttons (recall/gear/snack/barn/
  toybox) collapsed into ONE draggable circle (slime icon, "+"/"-"
  affordance). press <6px = toggle, drag = park it anywhere, position
  persisted (`fab` in save, clamped on load). accordion folds out five
  items (recall/snack/toys/barn/gear), stacks downward or flips upward
  near the screen bottom; active states tint gold; outside click folds.
- **toybox strip** relocated — hangs left of the toys item; right-click
  treatKind cycle moved to the snack item. petHome Z badge + wake hint
  re-anchored to the circle.
- **jelly HUD removed** — the bottom-right gem counter (was covering
  the taskbar clock). element + CSS + all 15 hudN writes stripped;
  jelly still tracked internally for gacha/shop UIs.
- verify 76/76 (+5 FAB tests: default pos, open-below, hit-test,
  bottom flip-up, strip anchor). _sim 600f + _repro 7200f clean.

## Last session 43 (missions removed + window-close startle + pal opacity)
- user: "미션은 빼버리자. 사용자랑 상호작용 되는걸 넣자 — 창 껐을때
  놀라며 떨어진다던가. 팔들 불투명도 조금 더 올려줘". changes:
- **daily missions REMOVED** — DAILY table, dailyTick(), all 8 call
  sites, card TODAY row, `daily` save field. daily-login stipend and
  daily selfie (separate features) untouched.
- **window-close startle fall** — the `platforms` listener already set
  flying when a slime's deck vanished; now it also fires startleFall +
  shock face + "!" + shock sfx (skipped when home/riding). landing
  resolves it: dizzy + pout + "!?" — handled on both the platform
  landing and the screen-floor clamp paths. cleared by recall().
- **pal scare too** — a pal whose re-picked deck sits >40px lower gets
  a shock face + squash pulse while it eases down.
- **copy peek contagious** — the nearest pal within 340px also perks
  with a "?" + shock face on ctrl-c/v.
- **opacity raised** — sprite ALPHA table bumped overall
  (i:186→198, b:218→230, s:206→220, l:240→246) plus a firmer `opa`
  bake for pals (i:226 b:246 s:238 l:252) via sprite()'s 4th arg —
  cache key carries it, pal draw + pal card portrait use it.
- verify 71/71 (+startled fall, dazed landing, flag clear; daily tests
  swapped out). _sim 600f + _repro 7200f clean.

## Last session 42 (prop drag + daily missions + mystery egg + copy peek + deep idle)
- user: "소품들 움직일 수 있게 하자. 기능들 더 추가해봐". changes:
- **prop dragging** — bowl/cushion/ball can be grabbed with the pointer
  (propHeld) and dropped anywhere; on release the prop snaps to the
  platform under the cursor (plat + y + clamped x). click-through rect
  extended so furniture is grabbable, not click-through.
- **daily missions** (DAILY) — three light goals/day: PET x3, SNACK x1,
  PROP PLAY x1 → +10/+15 jelly each, quiet +N popup, card shows TODAY
  boxes. dailyTick() resets on date change; `daily` persisted.
- **mystery egg** — once/day (~20s after boot, date-keyed `lastEgg`) an
  egg drops on the pet's platform; pet prioritizes walking over and
  pecks it (1.1s → hatch) or it self-hatches ~150s. hatchEgg() gives an
  unowned common/rare species, else +jelly. wobble render; egg forces
  deepIdle off.
- **copy peek** — backend rdev hook emits "copy"/"paste" on ctrl-c/v
  (content never read); pet perks toward the cursor, shows "?", maybe
  hops. 8s cooldown; skipped while home/held/flying/riding/sig/sleeping.
- **deep-idle throttling** — when pet is home and zero entities/particles
  /UI/egg are live, frameBody runs at 1/4 rate (idleSkip counter); prev
  still updated so dt stays sane on wake.
- verify 71/71 (+7: prop drop snap, daily prog/pay/no-double, egg
  drop+hatch, copy peek). fixed flaky circle test by freezing wander.
  _sim 600f + _repro 7200f real-state clean.

## Last session 41 (placeable props + accessory physics + bond levels)
- user: "다음 기능부터 바로 들어가자 — 악세사리/소품 디테일하게". changes:
- **toybox UI** — the ball button is now a chooser strip: ball / bowl /
  cushion. each toggles its prop; props persist in the save (`props`
  field) and re-anchor to the nearest platform on load (monitor-layout
  safe). strip closes on outside click; click-through rect registered.
- **bowl prop** — slimes occasionally stroll over (wander slot,
  walkGoal marker), face it, munch with crumbs; ~45s cooldown. pals use
  it too (own slot + p.bowlCd, munch face + crumbs).
- **cushion prop** — slimes amble over slower, settle dead-center, and
  doze (sleeping face + lazy zzzs, 8-14s, 30s wake grace). the sprite
  squashes while occupied — pet or pal. pals nap on it too.
- **stale-goal guard** — propArrive + pal arrival re-check proximity,
  so a walk hijacked by a grab/sig doesn't perform the ritual standing
  somewhere else. spawnProp nudges new props off existing furniture.
- **accessory physics** — drawAcc is now a motion wrapper around
  drawAccRaw: `accMV` snapshot {jig, lean, bob, sq, t, ph} per wearer.
  hats tip/dip late (weight), face gear slides a hair, bows/ribbons/
  scarves/antennae TRAIL the shear, halo/wings float on their own
  clock. reduceMotion bypasses; UI cards unaffected (accMV null).
- **bond system** — per-species affection xp, trickle-gated (one award
  per 12s globally — presence, not click-farming). sources: slow-pet 2,
  scritch 2, treat fed 3, snack eaten 3, prop rituals 2, perch 2,
  pal treat/scritch 2. levels SHY→BESTIE at 0/30/90/200/400 xp; status
  card shows heart pips + name. LV3+ slimes greet you once per boot
  (hop + hearts + HI!). persisted as `bond`.
- verified: _verify 64/64 (+bowl/cushion/stale-goal/bond/persist/acc
  tests), _sim 600 clean, _repro 7200 real-state clean; rebuild +
  relaunch, release zip regen.

## Last session 40 (jelly feel retune — softer, springier squash)
- user: "슬라임이 너무 심하게 튕겨 — 갑자기 눌려. 더 탄력있게". changes:
- **spring retuned** — 140/9 → 95/6.5 both springs (pet + pal): the squash
  unfolds over ~100ms with a little overshoot left in, instead of
  snapping flat and recovering instantly.
- **nonlinear compression** — msq now saturates (squash/(1+|s|*0.5)) so a
  huge hit compresses proportionally less, like real jelly resisting;
  small pokes still read at full strength. pals got the same via pmsq.
- **frequent impulses trimmed** — gait footfalls 0.55→0.35 / pal 0.5→0.32,
  face-swap beat 0.7→0.45, window-surf wiggle 0.7→0.45; landing caps
  9→6.5 / 8→6 (pet), 7→5.5 (pal); base landing 3→2 both.
- verified: _verify 53/53, _sim clean; rebuild + relaunch (PID 29792);
  release zip regen.

## Last session 39 (freeze forensics — stack-cycle fix + instrumentation)
- user: "지금 또 멈췄어 — 재빌드 탓인지 기술적 문제인지 확인". findings:
- **process forensics**: exe alive, "Running", ~4s CPU — classic dead-loop
  signature. rAF re-queues at the TOP of frame() so a JS exception can NOT
  stop the loop — meaning either (a) an infinite loop, (b) per-frame early
  exceptions skipping the render tail, (c) NaN-poisoned positions making
  everything draw nothing, or (d) compositor-side rAF stall (transparent
  always-on-top windows can be mis-classed as occluded).
- **real bug found + fixed**: pal totem stack could close a CYCLE —
  pal A rides B, then B is still a legal mount target for A's chain, so
  B.stackOn = A → A↔B. the depth() while-loop then spins forever →
  permanent freeze exactly matching the symptom. fixed two ways: the
  chain walker is capped at pals.length, and mount candidates are
  rejected when the target's chain already contains the rider
  (chainHas). only existed with 2+ pals — user runs 3 (stella/drago/astro).
- **instrumentation (new)**: `log_crash` Tauri cmd appends to
  %APPDATA%\com.jellypal.app\crash.log (256KB cap). frame() is now a
  wrapper: try/catch around frameBody logs each unique error signature
  once; a 20s heartbeat ("tick") distinguishes JS-dead vs raster-dead
  freezes; a NaN watchdog snaps petX/petY/squash + pal/ball coords back
  to finite values and logs the poisoning.
- **rAF watchdog**: if no frame ran for >400ms a 250ms interval drives
  frame() manually — covers the occlusion-stall case where rAF silently
  stops while the window is still visible.
- **_repro.cjs NEW**: real-state harness — loads the actual %APPDATA%
  save (legendary pals, hybrids, hint flags), pumps 7200 frames with a
  moving cursor + injected balls. real state ran clean → the freeze is
  environment/timing-specific, hence the instrumentation net.
- verified: node --check, _sim 600 frames, _verify 53/53, _repro 7200
  frames clean; debug rebuild + relaunch (PID 32124); release build +
  zip regen.
- NEXT FREEZE: read %APPDATA%\com.jellypal.app\crash.log — ticks stopping
  = JS dead (loop); ticks alive + FRAME lines = render-path exception;
  NAN-* lines = poisoned transform source identified.

## Last session 38 (discoverability + ball toy + transition polish)
- user picked the recommended batch: motion transitions → discovery →
  the ball. guiding principle: "업무 방해 없이 귀여움" — everything is
  passive, one-at-a-time, auto-dismissing.
- **direction-change anticipation** — a sharp reversal now costs a ~95ms
  planted-feet beat (turnPause) before the skid carries it through; the
  slime no longer teleports its heading.
- **face transition beat** — swapping expression mid-frame adds a small
  squash pulse (0.7) so changes read as a reaction, not a texture swap.
- **scaled landings** — landPeak tracks worst fall speed; landing squash
  scales 3→11 and drops a dust ripple only on genuinely hard drops
  (>520px/s). pals got the same via p.fallPk.
- **discovery hints** — `HINTS` table (perch, hunt, boop, scritch, circle,
  fling, ride, pals, pals-play, ball): each shows ONCE, contextual when
  possible (parks the cursor → learns perch), else a slow drip starting
  ~60s in, one at a time, 2.5min apart, persisted via `hints` in state.
  gated off during any modal/drag/aim/photo so it never fights the user.
- **first-run wave** — HELLO! hop once on an unseen first launch only.
- **the ball (new toy)** — top-right button drops a physics ball: gravity,
  platform bounces (>170 → bounce+sfx, else settle), wall/ceiling clamps,
  deck friction, rolling rotation. grabbable (drag + fling release
  velocity). slimes on the same deck play with it — a slow ball gets
  nudged/chipped (per-pal 900ms cooldown, main pet dribbles it), a fast
  one (>190px/s) gets hopped over / dodged. walks into a ball = pushes
  it. wanders occasionally target the ball (roll<0.98 slot) so slimes
  drift over and kick it around on their own. click the button again to
  remove it.
- verification: _verify.cjs 53 checks — added ball-settles, pal-nudges,
  discovery-hint-fires. **53/53 PASS + _sim 600 frames clean.**

## Last session 37 (catch removed, gait bounce, slime social life)
- user: "던지고 받기 빼자 / 움직임 개선 — 살짝 튀는 것들 / 슬라임끼리
  상호작용 더 / 더 부드럽고 자연스럽게". changes:
- **mid-air catch REMOVED** — thrownT + the catch-mount block + the
  pointerup arming all deleted. throwing physics stays; the pet just
  lands normally.
- **gait bounce** — distance-driven walk cycle (gaitPhase += speed*dt):
  every footfall (phase crosses pi) dips the blob +0.55 squashV, and the
  render bob syncs to real speed instead of a fixed clock. pals get the
  same via p.gait/p.gaitStep + a 2px pBob in their draw.
- **skid on direction flips** — flipping walk direction above 45px/s
  kicks 3 dust puffs + a squash — carries momentum through the turn.
- **pal lean smoothing** — p.leanSm eases the walk-tilt like the main
  pet's leanSm instead of sign-flipping the rotation.
- **slime social life (pal loop)** — greeting (same-deck idle neighbor
  → both stop, face, trade ♪/HI! chirps, mutual ~20s cooldown),
  follow-the-leader (occasionally picks a buddy and trails it ~6s,
  drops if the leader flies/stacks), sympathetic hop (main pet springs
  past → nearby pal can't help a little bounce), soft bump (main pet
  walks through a pal → both squish, pal nudged into a hop).
- verification: catch tests swapped for gait-advances + pal-bump checks.
  50/50 PASS + _sim 600 frames clean.

## Last session 36 (1-min perch, catch gating, pal smoothing, 2x pixels)
- user: "커서 1분 이상 두면 올라타기 / 앉았다 떨어지고 다시 점프 /
  받기놀이 이상 / 달라붙기 빈도↓ / 팔 끊김 / 상호작용이 메인 펫에만 /
  모션 부드럽게 / 픽셀 더 잘게 — 전 종 적용". changes:
- **perch = 60-second charge** — parked cursor (cdist<140, curV<120)
  fills perchScore over 60s; tells at 20s("?") and 50s("!"). pet lingers
  nearby (targets cleared) but stays alive — no more 1s-mount. beg-path
  mount now also respects perchLatch + rideCd.
- **perchLatch** — after ANY dismount, no remount until the cursor
  leaves the 220px radius once → the sit-drop-jump loop is dead.
  rideUntil extended to 60s (earned seat).
- **catch gated by thrownT** — only armed 3.5s after a real user throw
  (pointer release >400px/s). random hops/falls never grab on →
  "시도때도 없이 달라붙는" fixed.
- **pal stutter fix** — platform hysteresis (keeps current deck while
  valid instead of re-picking every frame) + soft y-snap (ease <3px
  gaps instead of teleporting p.y=pl.y).
- **pal interactions** — boop (slow press → squirm → hop-back + pout)
  and scritch (3 dir-flips → melt + heart) now work on companions;
  per-pal boopT/rubDir/rubCount/rubCd fields, lazy-initialized.
- **motion smoothing** — petSpd ramp (accel into walk, bleeds off when
  idle), p.walkV ramp for pals, leanSm smoothed walk-lean (direction
  flips roll instead of snap).
- **2x supersampled sprites** — buildSprite renders each logical pixel
  as a 2x2 sub-block: feathered silhouette edges (alpha 0.45), contact
  shadows next to outline cells, bounce light near lit cells, and a
  deterministic ±8 grain hash. every species/UI card/ranch/album gets
  finer grain for free — cache keys and draw sizes unchanged.
- verification: _verify.cjs now 50 checks (added charge-builds,
  no-early-mount, latch-blocks-remount, latch-clears, no-catch-without-
  throw). 50/50 PASS + _sim 600 frames clean.

## Last session 35 (ride rework + interactive motions + verification harness)
- user: "커서 아래에서 점프함, 아직 안 되는 느낌, 모션 더 구체적/인터랙티브,
  기존 모션 검증". root causes + fixes:
- **ride redesigned** — was: pet dangled 60px BELOW the cursor (read as
  "jumping under it") and dropped the instant the mouse moved (>1800px/s
  is any normal move). now: the pet sits ON TOP of the cursor tip and
  gets carried — moving keeps it aboard (rideUntil extends while
  curV>250), parking 2.6s = hops off, a hard whip (>3800px/s) flings it
  with a "!" shock face. mount gets a squash hop + WHEE.
- **mid-air catch** — a falling pet that finds the cursor under it grabs
  on (throw it up, catch with the mouse) → "CAUGHT!".
- **new interactions** — boop (slow cursor press into the body → squirm,
  hop back + pout = personal space), scritch (sweep cursor back & forth
  over the body w/o clicking → 3 direction flips → melts into content +
  heart + petUntil). circle trick + hold-cuddle kept from last pass.
- **legFlair perch guard** — legendary idle flairs can no longer interrupt
  a mount-in-progress (perchScore<=0 required).
- **`_verify.cjs` NEW** — scenario-driven harness: same DOM stubs as _sim
  but eval-bridges INTO main.js's scope (`__E`) so tests inject cursor/
  state and ASSERT interactions fire: perch-mount, on-top gap, whip
  dismount, hunt stalk+pounce, all 30 sig acts completing, all legendary
  legFlairs, cuddle, circle trick, scritch, boop, main+pal treat eating,
  mid-air catch, all 22 faces rendering. **45/45 PASS.**
- harness lessons: load_state returns a JSON *string* (stub was returning
  an object → silent empty state); pals state stores species ids;
  tagged/flying pals skip treats by design.
- verified: node --check, _sim 600 frames, _verify 45/45; debug rebuild +
  relaunch (PID 25496); release build + zip regen in flight.

## Last session 34 (no shake/flash + ride reliability + legendary motion pass)
- user: "쉐이크/플래시 삭제, 올라타기 안 됨, 레전더리는 고유 모션 때문에
  레전더리, 표정/상호작용/디자인/모션 더 다듬기"
- **shake/flash fully gone** — sigWow is particle-only fanfare; dead vars
  (shakeUntil/shakeAmp/flashUntil/flashC) already cleaned. Per-frame
  ctx.setTransform reset stays as a defensive measure.
- **ride reliability pass** — perch thresholds loosened (radius 110→140px,
  still-cursor <60→<120px/s, charge 1.4→1.0s, cooldown 45→25s, ride 4-6.5→
  5-8s) + visible tells: "?" at 0.35s, "!" at 0.8s so the player learns
  "park cursor = it climbs on", WHEE! on mount, and a dedicated happy
  joyride face (rideT0 branch in currentSprite). Root cause of the user's
  "doesn't work" was likely the earlier !petUntil truthiness bug (fixed
  last session) + zero feedback during charge.
- **legendary = motion, not particles** — new `legFlair(sp, now)`: every
  ~5-9 idle seconds each legendary does a species-unique micro-act:
  drago wing-flare+ember snort, stella pirouette w/ star afterimages,
  pulsar gravity flex + implosion ring, gold coin-flip sparkle + starstruck,
  rex royal bow + crown glint, siren rising 3-note run, molten belly-glow
  vent, cliff heavy stomp + ripple, bites tail-chase spin→blep, spidr silk
  bounce, comet loop-the-loop hop.
- **sig acts got body language** — starburst now a real pirouette, reentry
  tumbles like a meteor, singularity levitates then drops (with rebound
  grav ring), firebreath rears up to inhale first (the tell), decree holds
  a regal apex pose w/ crown sparkles, shower basks/sways starstruck,
  eruption visibly boils (stretch pulse), song diaphragm swells.
- **new interactions** — cursor-circle trick (swirl loops around the pet
  ~1 loop → it spins + gets dizzy), hold-cuddle (hold a grabbed slime still
  1.2s → melts into content face + heart, repeatable).
- **expression wiring** — frenzy ends with blep tongue-out, successful
  pounce (GOTCHA) shows smug, cuddle shows content, circle-trick dizzy.
- verified: node --check + _sim.cjs 600 frames clean; debug rebuild +
  relaunch (PID 29256). release zip pending release build.

## Last session 33 (interaction reachability + treat race + sig wow pass)
- user: "사냥/올라타기/우산 안 되고, 먹이는 메인 펫만 먹고, 레전더리 스킬
  와우 없음". root causes found and fixed:
- **ride unreachable** — the only entry was beg-chain (75s ignore → beg →
  0.7s still cursor). Added a direct **perch path**: a still cursor
  (<60px/s) parked within 90px of a grounded pet for 1.6s = it climbs
  aboard. 45s `rideCd` cooldown; caught a `!petUntil` timestamp-truthiness
  bug that would have gated it forever after the first pat.
- **hunt tuned up** — trigger loosened (cdist 500, curV 400, score 0.35)
  so a casual whip near the pet reliably starts the stalk.
- **treat race** — pals only eyed snacks on their own platform (+-24px)
  and NEVER actually ate: first slime to reach the treat now eats it
  (pal-eat: consume + YUM + crumbs). Pals hop off ledges for lower
  treats; the main pet itself now strolls off the edge and drops to a
  lower-platform snack (same-level gate made those look ignored).
- **legendary wow** — `sigWow()` on act start: r>=3 gets screen shake
  (0.45s decay, reduced-motion safe), a 180ms warm flash, 16-particle
  radial gold burst; epics get a smaller rattle. NOTE: frame() now
  resets `ctx.setTransform(dpr,...)` each frame — shake translate would
  otherwise accumulate forever (fit() only re-applies on resize).
- weather verified honest-by-design: umbrella only when the API reports
  actual rain (WMO 51-67/80-82/95+, 45min freshness); can't force-test
  from a network-isolated shell.

## Last session 32 (bug audit — "everything is dead" turned out to be petHome)
- user reported "안되는데" — audit found `petHome=true` in the save: the pet
  was parked in its ranch room so every `!petHome`-gated desktop feature
  (hunt, ride, tuck-in, surf, all clicks) was off. Backend event wiring
  (cursor/platforms/keystroke/focus/summon emits↔listens) verified intact;
  daily selfie confirmed working for real (`selfie_*.png` in album).
- **bug 1**: `recall()` never cleared petHome — corner button and tray
  Summon couldn't bring the pet back; only the ranch cell `+` worked.
  recall() now calls `bringPetHome()`.
- **bug 2**: the HOME drop strip (top-center, y<=50, +-66px) checked the
  drop BEFORE the throw-velocity test — any upward fling released through
  the strip sent the pet/pal home. Both drops now require a gentle
  release (<250 px/s). Root cause of the pet "randomly vanishing".
- **bug 3**: zero indication the pet was home — screen just looked dead.
  Now a `Z` badge on the recall button + persistent "PET IS HOME -
  CLICK TO WAKE" hint while petHome.
- verified state round-trip safe (ASCII write, no BOM); save intact.

## Last session 31 (clip-bait batch: selfie + tuck-in + window surf)
- **daily selfie** — once per calendar day (~12s after boot) the pet
  poses for a dated 440x320 card (wink/happy + acc + TODAY: mood from
  the energy tide) saved to the album. `lastSelfie` persisted; users
  get a fresh shareable image every day they open the app.
- **tuck-in** — a cursor parked 5+ minutes reads as asleep: the pet
  waddles over, drops a pixel quilt just under it, sits a beat,
  TUCKED IN + heart. Blanket fades after 9s, 10min cooldown, aborts
  if the cursor wakes mid-walk. `lastCurMove` tracks real movement
  (poll stream alone doesn't count as activity).
- **window surf** — the pet rides the platform it's standing on: when
  a window slides sideways the pet is dragged along with a squash +
  shock face on fast drags (jigX shear picks up the velocity for
  free). Monitor floors never move so only real windows surf.

## Last session 30 (viral/share loop features — pre-launch community test)
- strategy pivot: post to Threads/community FIRST for reaction, decide
  on itch listing after. Built the three features that most directly
  feed that plan.
- **SHARE card** — settings SHARE row renders an 800x450 collection
  snapshot (title, big active slime + name + acc + rarity, DEX/GEMS/
  SHINY stats, rare-species shelf, tagline) and saves it to the photos
  folder + opens Explorer — ready-made "look at my ranch" post image.
- **weather sync** — new `get_weather` cmd (ipapi.co coarse geo ->
  open-meteo current_weather, both free/https/keyless, curl.exe).
  30-min poll; the pet holds a pixel UMBRELLA sprite in rain codes and
  snowflakes drift over it in snow codes. WEATHER row toggles it.
- **autostart** — `set_autostart` cmd writes/removes the HKCU Run key
  ("Jellypal" -> exe path); BOOT row toggles it, persisted, and a saved
  ON re-applies at launch so a moved exe self-heals. Desktop pets die
  without this.
- settings panel grew to 14 rows / 424px.

## Last session 29 (rename to Jellypal + freeze hotfix 2)
- **freeze fix (same class as before)** — `sleepMs` was a `const` inside
  the mood setInterval, but frame()'s nod-off code referenced it →
  ReferenceError every frame → total freeze from boot. Hoisted to a
  module-level `let` the interval updates. New `_sim.cjs` harness
  (DOM/canvas/Tauri stubs) pumps 600 real frames incl. seeded pals —
  catches this bug class without launching the exe.
- **renamed Typet -> Jellypal** — productName, identifier
  (com.jellypal.app), Cargo package/lib, window title, index.html,
  redeem prefix (TYPET- -> JELLYPAL-, salt rotated so old codes
  invalidate), photo filenames, README, dist/launch/unlock scripts,
  itch assets (cover/banner/promo regenerated with the new wordmark).
  Repo folder stays `C:\dev\mini\typet` — internal only.

## Last session 28 (interaction depth + monetization hooks + polish batch)
- **in-game gem shop** — new GEMS row in settings opens a pack panel
  (250/$0.50, 500/$0.90, 1000/$1.90, 2500/$3.90 + jelly balance), a
  BUY ON ITCH.IO button backed by a new `open_url` Rust cmd (https-only,
  explorer launch) that's inert until `GEM_SHOP_URL` is filled, plus a
  REDEEM CODE door. Separate from the ranch accessory shop.
- **status-card target indicator** — the card's subject wears a pulsing
  gold ring at its feet + a bouncing chevron (`tri` sprite) overhead;
  works for the pet and pals, follows movement, auto-clears.
- **panel-position persistence** — ranch/nursery/card drag positions
  save to state.json (`panelPos` + `_res` resolution key); restored on
  reopen/relaunch, clamped to viewport, ignored on resolution change.
- **organic cursor awareness** — look radius scales with rarity
  (280→490px); a lingering close cursor earns a notice beat after ~1s
  (bounce/heart/?); commons slowly approach; fast passes get a glance;
  sleepers stir then fully wake; 75s of nearby neglect makes the pet
  walk under the cursor and BEG (card shows BEGGING/NEEDY/PLAYFUL/LAZY).
- **energy tide** — internal energy drifts up/down on its own so the
  pet cycles through lively and lazy phases; biases fidget choice
  (yawns/sighs when lazy) and wander cadence.
- **cursor hunting** — fast cursor swishes build prey-drive (follow
  trait x energy weighted): the pet stalks with a crouch+butt-wiggle,
  pounces at the cursor's predicted spot, then resolves on landing —
  GOTCHA+hearts+content within 120px, else a pout. 8-14s cooldown;
  grab/sig/escape cancel; nearby pals join with lighter arcs (~60%).
- **cursor riding** — while begging under a still close cursor (~0.7s
  hover) the pet climbs on and HANGS ~60px below it, swinging with
  cursor motion (pendulum sway), hearts trickling; drops after 4-6.5s,
  a cursor whip (>1800px/s), grab, or sig act; falls off with the
  cursor's momentum. Card status: HITCHING A RIDE.
- **treat baiting** — while a treat is armed (aim mode) the cursor IS
  the snack: the pet drools and shadows it eagerly until you click to
  drop the real thing. Card status: EYEBALLING.
- **petting-speed differentiation** — slow reversing strokes while held
  = head pat (petUntil + content + hearts); fast rough strokes =
  tickle-play (tickleUntil + laugh face + squirms). Held sprite picks
  happy/laugh over held1/held2 during those windows.
- **social 3rd pass** — dance-along (pals bounce in time while the pet
  dances), elemental pair SYNERGY table (drip+spark=steam, glint+spark
  =fireworks, spark+wisp=will-o-wisp, drip+glint=prism drops,
  bubble+drip=bubble burst, glint+wisp=aurora motes; 45% on bumps),
  treat FOMO (pals crowd a landed snack hoping for a bite) + shared
  crumbs reaction when the pet eats.
- **legendary aura depth** — pulsar's gravity reels nearby pals across
  the platform (with pull streaks); stella's starlight perks them with
  sparkles + happy faces. Rex's wider court was already in.
- **animProf expanded** — new per-species fields: waddle (walk-bob
  rhythm on scurry/walk), arc (hop/pounce hang-time), glee (biases
  notice reactions — giddy species favor hearts, deadpan favor ?).
- **premium accessories** — MONOCLE (800), TIARA (1000), WINGS (1400,
  reuses the legendary wing bitmap at acc scale) — gold shop frames +
  star marker; per-item `cost` overrides ACC_COST.
- **pet home (`petHome`)** — drop the main pet on the HOME slot (shows
  while dragging it too) or hit SEND HOME on its card: it poofs back
  to its ranch room, sleeps in its cell (green + button), desktop goes
  quiet but economy keeps running. + brings it back — drops in at the
  cursor. Persisted; all AI/render/clickable/aura/play paths gated.
- **verlet-lite jiggle** — second spring (jigX) tracks horizontal
  velocity and shears the sprite's top behind its feet via
  ctx.transform — walks, throws and drags all read as fat physics.
- **sprite polish 2** — `i` core rim dithers into the body
  (checkerboard falloff instead of a hard ellipse); dark-palette lift
  adds an extra milk pour for coal/ninja/shade-class bases so they
  stay readable on dark wallpapers.
- **soundpack hook** — sfx table refactored to SFX_DEFS note lists +
  an sfxPack {pitch, vol, defs} override layer; all call sites
  unchanged, a future DLC pack can re-voice the board wholesale.
- **multi-monitor** — the overlay stretches across the virtual screen
  (union of available_monitors, negative origins handled since every
  converter is (point-mpos)/scale); `get_monitors` cmd feeds per-
  monitor floor platforms (monPlats) so slimes walk between displays.
- **update checker** — `check_update` cmd (Windows curl.exe, https-
  only URL const) polls UPDATE_URL once at boot; a newer semver sets
  a gold NEW V#.#.# badge on the settings version row.
- **ranch/nursery right-click** — context-menu on an active pal cell
  opens its live status card; inactive owned still opens bestiary.
- **redeem modal layering** — moved to the top #info overlay so it
  floats above ranch/nursery/card; overlay swallows clicks during
  keyboard-only entry.
- **album management** — DELETE button with two-tap SURE? confirm,
  new `delete_photo` cmd (sanitized filename); album refreshes when a
  photo lands while open and closes itself when emptied.
- **localization verdict: deferred** — the 5x7 pixel FONT is ASCII-only
  (~55 glyphs); KR/JP needs a composed-jamo or kana bitmap font + every
  textW call assumes fixed width. Major asset project — revisit if a
  KR/JP release becomes a goal.

## Feature inventory
- keystroke-eating slime (global key COUNT only via rdev — never reads key content)
- squash & stretch spring physics
- drag / throw / wall-splat (|vx|>550 splats + dizzy)
- head pat / belly tickle / double-click reactions
- tickle (wiggle while held) + pet (slow stroke)
- cursor-startle: fast cursor rush near pet → hops away
- autonomous walk / hop / sit / stretch / dance / spin
- rarity-scaled cursor follow (rare+ seeks cursor)
- Cliff (legendary): wall-climb
- Bites (legendary): eats a fake desktop file → +1 jelly
- Webby (legendary): shoots a silk line at the cursor and dangles (pendulum)
- 60 species in 4 rarities (50 base + 2 seasonal + 8 this batch)
- gacha pull = 10 gems, pity rare 12 / legendary 50
- breeding: 5h cooldown, color-mix hybrid children, legendary unbreedable (pull-only)
- 6 accessories (cap/specs/bow/crown/tophat/halo), 18% bonus drop per pull
- recall button (top-right), tray menu Summon/Quit
- synthesized WebAudio SFX (zero audio assets)
- JSON persistence (5s debounce when dirty)

## Last session 27 (pastel translucent jelly redesign)
- user direction: cuter read — pastel tones + translucency, away from
  the darker saturated look.
- **pastel pipeline** in buildSprite (procedural — zero palette-table
  edits, all 60 species + hybrids + shinies inherit): body lifts 24%
  toward light then 14% toward white; glow core 66%+12%; the SHADE
  band now lifts toward light (32%+16% white) instead of sitting dark;
  outline tints 45% toward a body-light mix so contours read soft
  dark-pastel rather than near-black; highlight goes milky (+16% WHT).
- **translucency**: per-char alpha — core 186/255, body 218, shade
  206, highlight 240; outline/face/decoration pixels stay opaque so
  silhouettes and expressions stay crisp. The desktop now bleeds
  through the jelly like a real slime.
- silhouettes keep full opacity (no spoilers); assets.cjs slime()
  got the same pastel math (opaque blit for stills) — all PNG/GIF
  regenerated, cover visibly softer.

## Last session 26 (social play + legendary motion detail)
- researched: Slime Rancher's emergent-behavior GDC talk (simple wants
  stacked = "secret sauce"; totem stacking is its DQ homage), verlet
  soft-body repos (verly/anjellyka) — took the spring-deformation
  idea, skipped full soft-body (overkill for 36x26 sprites).
- **totem stacking** — an idle pal beside a stackmate hops onto its
  head (stackOn/stackRise ease-in, 4-9s ride, sway wobble on top).
  The mount carries the rider across the platform; grabbing the
  mount/rider, recall, or the timer all break the stack — the rider
  hops off with a little leap.
- **copycat hop** — a pal that just leapt is contagious: grounded
  neighbors within 130px sometimes bounce along, and the bounce
  chains (hopT stamps).
- **signature audience** — while sigT0 runs, nearby pals look up at
  the main pet and flash shock/happy faces.
- **siren captivate** — her notes now make nearby pals stop and
  listen (lookDir + hearts).
- **legendary motion detail** via LEG/legTick (new kick() callback
  feeds impulses into the caller's squash spring):
  stella — starburst ✦ on every blink-teleport + drifting motes;
  drago — HEAVY landings (bigger ripple, 12 dust, thud squash) +
  smoldering ember breath; gold — glitter trail while gliding;
  pulsar — collapsing vacuum rings (gravRings, drawn inward);
  molten — visible magma heartbeat (kick + ember); rex — proud
  strut bounce while walking; bites — LUNGE speed 300 at treats +
  red dash puffs; spidr — 4 spider legs kick while dangling
  (drawLegs in local space).
- pal legs/braces: grab, recall, send-home all clear stackOn;
  mounts can't be double-stacked.

## Last session 25 (per-species bodies + movement styles + new interactions)
- **shapeVar()** — every species gets a deterministic silhouette remix
  seeded by its species index: height scale 0.88-1.12, belly bulge
  0.9-1.1 with a sine taper, and a -2..+2px lean offset. It rewrites
  the halfwidth array AND transforms authored top/face pixels through
  the same mapping so decorations ride the new shape. Cached per
  species — stable across faces, frames, sessions, and silhouettes.
  Hybrids get it free (index-seeded); assets.cjs buildGrid ported the
  identical seed math so marketing sprites match the game.
- **movement styles finally differ**: scurry = burst-dash with pauses
  (munch face while darting), hover = frictionless eased glide
  (3.5% of remaining distance/frame), blink = 56px teleport pops
  every ~700ms with poof particles, hop = repeated ballistic hops,
  walk = normal pace + footstep dust puffs. Pal movement branches
  mirror all of it.
- **landing feedback**: expanding ground ripple rings + dust puffs on
  every pet/pal landing (skippable under reduceMotion).
- **idle fidgets**: grounded, undisturbed slimes pulse a tiny squash
  every 1.8-4.4s (personality-paced) so they never look frozen.
- **new interactions**: precise face tap = BOOP (heart + happy face +
  squish); 3 quick belly pokes -> HEY! protest bang + longer annoyed
  face + strong squash; dragging stretches the jelly along the pull
  direction (heldStretch springs 0->0.3 cap, directional shear via
  rotate-scale-rotate); releasing a stretched slime snaps it back
  with an extra squash + boing. pointercancel resets the stretch.
- buildSprite signature gained spIdx (sprite() passes species index);
  silhouette mode uses the same varied shape so reveals stay honest.

## Last session 24 (draggable windows + modal layer fix)
- **ranch + nursery are draggable** — grab any button-free strip of the
  title bar (y<42, move-cursor affordance); pointer-captured drag moves
  the div, nursery rides along when stacked below the ranch.
- **bestiary card layering fixed** — it used to draw on the main canvas
  UNDER the ranch div (z-index 10). Now #info is its own fullscreen DOM
  overlay (z-index 20) hosting drawInfo on #ic: never occluded, owns its
  clicks, and survives ranch/nursery closing (infoPick no longer reset
  by the toggles).
- **album moved onto the same top modal layer** — same occlusion bug;
  albumClick() extracted so both the overlay and the canvas fallback
  share one hit-test. Photo mode hides the overlay too.
- ESC still closes whichever modal is up; set_clickable already pushes
  a fullscreen rect while a modal is open so desktop clicks stay eaten.

## Last session 23 (jelly relight + send-pals-home)
- **sprite relight** toward the classic translucent-slime look (DQ /
  Slime Rancher references): dark saturated outline kept, interior
  brightened. buildSprite now emits two new derived fills — `b` lifts
  18% toward the light shade everywhere, and a broad `i` core (60%
  toward light) fills the upper body, normalized to each row's
  halfwidth so it hugs round/tall/flat/puddle/square silhouettes.
  The lowest interior row flips from shade to the bright `i` — light
  shining through the jelly. Highlight blob grew 16->20px radius.
  All computed at build time: zero palette-table edits, hybrids and
  shinies inherit automatically, silhouettes stay flat (no spoilers).
- assets.cjs buildGrid/slime ported to match; PNG/GIF regenerated —
  the cover now shows visibly glowing slimes.
- **send pals home**: while dragging a companion a SEND HOME slot
  appears top-center (house glyph, highlights on hover). Drop on it
  (or simply right-click a pal) -> BYE! poof and it's back in the
  ranch. Stays owned, re-summonable, persisted via pals[].
- README controls updated.

## Last session 22 (F2P pivot: gem-shop economy + redeem codes)
- user pivoted the business model AGAIN: the app is FREE, revenue
  comes from paid gem packs (~$1.9 / 1000 gems). itch has no IAP API
  so monetization runs on one-shot redeem codes validated offline.
- **economy rebalance** so paid gems carry value: PULL 10->50 gems
  (~$0.095/pull), dup refund 4->15, BREED 5->20, ACC 250->300, daily
  8+4->10+3, DEX milestones 5..80->15..150. Free income stays
  ~4-5 pulls/week (typing ~1/3d + daily/weekly) — engagement kept,
  paying accelerates. Current gacha rates: C60/R28/E9.5/L2.5, pity
  rare@12 leg@50, shiny 8%, acc-drop 18%.
- **redeem codes**: format TYPET-<pack>-<6 nonce>-<4 checksum>;
  salted DJB2-style hash validated locally (no server). Packs
  A=250/B=500/C=1000/D=2500. One-shot — redeemed[] persisted, reuse
  shows "CODE USED", tamper/typo shows "BAD CODE".
- **REDEEM settings row** -> fullscreen code-entry modal (type +
  Enter), settings panel grew to 10 rows/344px.
- **codes.cjs**: `node codes.cjs C 5` prints 5 valid 1000-gem codes
  to sell via itch messages/Gumroad auto-delivery.
- verified end-to-end in node: valid->+1000, reuse->USED, tamper->BAD.
- README gained a GEM PACKS section.
- note: the demo.flag split is now MOOT under F2P (the free zip IS the
  product) — dist.cjs --demo still works but shouldn't be shipped.

## Last session 21 (demo split + album + weekly + pomo lengths + GIF)
- **demo/full split** (itch is DRM-free, this IS the paywall): the exe
  checks for `demo.flag` next to itself (`is_demo` cmd); `dist.cjs
  --demo` packs typet-<ver>-demo-win.zip with the flag inside. Demo
  caps the collection at 8 base species ("DEMO FULL - GET FULL VER"),
  locks breeding ("BREED IS FULL VER ONLY"), greys the BREED button,
  shows FREE DEMO in the ranch header + DEMO tag in settings. Demo
  saves stay compatible so buying the full version keeps progress.
- **photo album**: new settings row ALBUM opens a fullscreen overlay
  listing every photo-mode PNG (new `list_photos`/`load_photo`/
  `open_photos` cmds; b64encode in Rust). Left/right click or arrows
  page through shots, OPEN FOLDER launches Explorer at the photos dir.
- **weekly hooks**: first launch each ISO week pays +30 gems
  ("WEEK +30"); a deterministic weekly spotlight species (weekKey
  hash) gets a 15% gacha weight boost + a "WEEK: <NAME>" tag in the
  ranch header second row.
- **custom pomo lengths**: settings gained FOCUS 15/20/25/30/45M and
  BREAK 5/10/15M cycling rows (panel grew to 9 rows/296px); editing a
  live phase re-arms the ring immediately. stats.focusSec accrues
  while a focus sprint runs and shows as FOCUS <min>M in settings.
- **animated promo GIF**: assets.cjs now emits promo.gif (480x270,
  12 frames, 66KB) via a hand-rolled GIF89a encoder (global palette +
  LZW). Sprout hops with squash&stretch while Webby swings on a silk
  line under the cursor — the two headline mechanics in one loop.

## Last session 20 (sale-ready hardening + itch assets)
- **save corruption protection** (sold-product must): save_state now
  writes state.json.tmp -> backups old to state.json.bak -> atomic
  rename; load_state falls back to .bak if the main save won't parse.
  ver:2 field added to the save schema.
- **daily login reward**: first launch each day pays 8 gems +4/day
  streak bonus (cap +24), shows "DAY N! +G" bang; lastDaily +
  dailyStreak persisted.
- **pomodoro ring**: thin countdown arc floats over the slime while a
  pomo phase runs (green=focus, blue=break) + F/B letter.
- **two webbies staggered**: pal web anchors offset ±46px so dangling
  webbies don't stack on the cursor.
- **seasonal shop**: PUMPKIN (halloween) + SANTA (winter) accessories,
  only listed while their SEASONS window is open (EVT tag on cell);
  ranch header pulses a gold EVENT tag during open seasons.
- **itch.io page assets**: `assets.cjs` renders real game sprites +
  pixel font straight out of main.js into PNGs (no canvas dep —
  hand-rolled PNG writer via zlib). Generates cover.png (630x500),
  banner.png (960x170), shot-desktop.png + shot-ranch.png (960x540
  scene mocks). Rerun `node assets.cjs` after species/sprite changes.

## Last session 19 (web play depth + itch.io packaging)
- **web zip-up**: entering the tether now blends the pet from the
  platform onto the rope end over ~300ms (webT0/webFromX/Y + ease-out)
  instead of snapping — reads as a real silk reel-up.
- **web poke = twirl**: tapping a dangling webby (grab + release
  <300ms, <6px) spins it a full eased 360 on the thread and keeps it
  attached; a real drag tears it free (webHeld). While held the line
  stretches elastically from cursor to pet.
- **web reel-in**: parking the cursor ~1.2s makes webby climb its own
  thread — rope length eases 92 -> 44px; moving the cursor drops it
  back down. Cute idle payoff for the dangle.
- **itch.io packaging**: version 0.2.0 (Cargo + tauri.conf +
  productName "Typet"), V0.2.0 label in the settings panel,
  `dist.cjs` packs `dist/typet-<ver>-win.zip` (exe + README.txt) via
  Compress-Archive — 1.8MB ready for itch butler/manual upload.
  README.txt covers run steps, controls, WebView2 requirement, save
  path. `unlock.cjs` stays dev-only (not shipped).
- note: Steam work de-prioritized — user pivoted to selling direct
  (itch.io / internet first); steamworks items moved down NEXT.md.

## Last session 18 (bestiary modal + flavor + passives + unlock tool)
- **bestiary card is now a fullscreen modal**: drawInfo renders on the
  main canvas (380x296) over a dimmed screen, centered — no more text
  squeezed into the 320px ranch panel. Label/value rows get real gaps
  (9px label->value, 24px blocks); missing TRAIT/SKILL show dim NONE;
  rarity name is bold under the showcase; a quoted 1-2 line FLAVOR lore
  sits at the card bottom. Modal click handling: any pointerdown on the
  main canvas OR ranch/nursery closes it (fullscreen clickable rect
  while open). `infoHost` is now vestigial.
- **FLAVOR table**: lore lines for all 60 species + `hyb` fallback;
  unowned silhouettes show "?????" instead of spoiling the text.
- **pal webs are real pendulums now**: p.webA/webAV share the main
  pet's constants (72px rope); swing with curVX, drop with momentum on
  timeout/cursor-loss/whip-snip (curV>2600).
- **web snip**: whipping the cursor >2600px/s cuts the main pet's line
  early — SNIP bang, longer cooldown, fling in the whip's direction.
- **legendary passives**: `gravity` (pulsar) slides landed treats and
  curves flying ones toward itself within ~220px; `royal` (rex) widens
  the pal-gather trigger so its court drifts in from other platforms.
- **dex milestones**: DEX_MILES pays gems at 10/20/30/40/50/58 owned
  base species (5-80 gems), `dexMile` persisted, checkDex() runs on
  pull, breed, and boot (retroactive payout for old saves).
- **dev unlock tool**: `unlock.cjs` writes all species+accs+jelly=99999
  + active=spidr into state.json (run while the exe is closed).

## Last session 17 (species expansion + cursor-web spider)
- 8 new species: legendaries Webby (spider), Drago (dragon), Pulsar
  (gravity), Rex (royal); epics Pinata, Lanty, Dicey, Hops (frog).
  All wired into PSY_ASSIGN, TRAIT_INFO/MV_INFO/SIG_INFO, ROOM_THEME,
  gacha pools (no season -> always pullable).
- **Webby's cursor tether**: `webbing` state — pendulum physics
  (webAng/webAngV) hanging 92px below the LIVE cursor, driven by curVX
  so flicking the mouse swings it. Entered via wander roll (~12% when
  cursor within 480px) or the webshot signature; 4-8s duration, 5-9s
  cooldown; drops with release velocity on timeout/cursor-loss; grab,
  recall, and pointerdown all break the line. Silk line rendered with
  sag + anchor knot; partial growing line during the aim phase.
- pals get a light version: web-trait pals zip up a straight line to a
  dangle point under the cursor for ~1.6s then drop (p.web timer).
- signature acts implemented: webshot (aim->tether), firebreath (flame
  cone along lookDir), singularity (in-spiral + burst), decree (royal
  leap that sets every pal's walkT toward the pet), burst (confetti),
  flare (expanding light rings + alpha pulse), rollout (tumble across
  the platform + random pip count), ribbit (inflate + croak ring).
- `mv: "hop"` implemented in the walkTarget branch — frog leaps in
  arcs instead of gliding (works for treats/follow too).
- LEG map: drago gets colored wings (drawWings takes a color arg now),
  rex a gold halo shimmer, pulsar an orbiting debris in-spiral.
- treat-seeking gated with !webbing so a dangling slime doesn't
  path to snacks mid-air.

## Last session 16 (sleep rework + legendary flourish)
- **sleep decoupled from typing**: `awakeAt` clock tracks direct interaction
  only (poke/drag/pat/tickle/pal/treat/recall). Slime sleeps after 5min of
  no contact — typing no longer keeps it awake. `SLEEP_AFTER` = 5min.
- typing still feeds xp/gems (economy), but slime *reaction* is now a
  species trait: `kr` flag on sprout/bean/mochi/mecha/bites + hybrids
  inherit (`REACTS TO TYPING`). kr species wake & munch while you type;
  everyone else naps. Bestiary shows a KEYS row.
- 20min+ ignored → first touch gets the grumpy greeting (`RETURN_GRUMPY`,
  `annoyedUntil` face) instead of a permanent grumpy state.
- **same-species movement bug**: pal `walkT` from play-bumps was never
  clamped to platform bounds → pals walked off the edge into an infinite
  fall/reland loop. Now re-clamped per frame + cleared on fly & landing.
- click overlap: the pet now wins over a pal standing on it (same-species
  pairs made pals steal clicks); tickle obeys the same priority.
- **legendary flourish** (`LEG` map + `drawWings`/`legTick`):
  Stella — angel wings (live flapping + baked wing-tip pixels) + floaty
  fall capped at 210px/s; Goldie — golden halo ticks + 25% LUCKY bonus
  gem on shower; Comet — ember trail; Molten — magma embers; Siren —
  drifting ♪ notes; Cliff — rock chips; Bites — drool drips. Pals too.
- pixel font: `drawText` gains a `bold` pass (double-draw +1px) applied
  to cell names, tags, info buttons, footer buttons, page number,
  nursery labels, and every bestiary stat value.

## Last session 15 (nursery = separate window)
- babies moved OUT of the ranch into their own floating panel:
  `#nursery` div + `nc` canvas (same CSS/interaction pattern as ranch)
- open/close: NURSERY button in the ranch footer (shows baby count),
  ESC, panel X — positions below the ranch when both are open;
  auto-opens when a hybrid is born (doBreed -> toggleNursery(true))
- nursery panel: blue crib theme, NURSERY header + count, NO BABIES
  empty state; cells = bouncing baby + pacifier + BABY pill + MIN
  countdown top-left + `i` info + `+`/`-` summon + click-to-activate
- ranch simplified: pinned nursery row removed (nurseryH -> 0,
  NURSERY_R deleted), grid/pager/sort/filter unchanged; babies still
  excluded from the collection grid (they live in the nursery window)
- drawInfo refactored to (c, W, H, t) so the bestiary card renders on
  EITHER panel — `infoHost` ("ranch"|"nursery") tracks which one owns
  the open card; rc/nc hit-tests both set it
- clickable-rects interval, frame loop, and photo-mode hide/restore all
  cover the nursery panel now

## Last session 14 (bestiary info panel)
- per-cell `i` button (top-right of every ranch cell AND nursery crib
  cells): opens a bestiary card. Works on silhouettes too — unowned
  species show only rarity + season window + "NOT COLLECTED YET"
- `drawInfo` overlay: 320x206 card with name (s=2 + shiny *), a bigger
  trait-tinted showcase box with rarity pips + bobbing sprite, and
  stat rows: NATURE (psy + flavor), MOVE (mv style), TRAIT, SKILL
  (signature act), SEASON window, BABY grow countdown / pull count
- new lookup tables: PSY_INFO / TRAIT_INFO / MV_INFO / SIG_INFO +
  `seasonText()` (SEASONS dates -> "OCT 24 - NOV 3")
- personality tag pill shifted left to make room for the `i` button
- click priority: infoPick closes on ANY ranch click (checked before
  accPick/footer); `i` hit-test runs before the owned-cell guard so
  silhouettes are inspectable; ESC/shop/breed/ranch-close all reset it

## Last session 13 (ranch UX overhaul)
- pixel font gaps fixed: added `>` `<` `:` `*` `%` `_` `'` `,` glyphs —
  the RUSH `>>` button rendered `??`, shiny `*` rendered `?`, the rename
  cursor `_` rendered `?`, and `SOUND 100%` dropped its `%`
- drawText gained an optional `shadow` color arg (offset +s,+s)
- ranch is now PAGED, not scrolled: fixed window = header + optional
  nursery + 3 rows (12 cells) + footer; wheel flips pages; `ranchPage`
  clamps in fitRanch + drawRanch (auto-refit when nursery appears/dies)
- footer bar: `<` `>` pager + `n/N` + `SORT:`/`FILT:` cyclers (hidden in
  shopMode, which shows an "ACCESSORY SHOP" tag instead)
- sort/filter: SORTS = DEX/RARE/NAME, FILTS = ALL/OWNED/MISS/SHINY;
  `gridIdx()` applies filter then sort; `pageList()/pageItems()` feed
  BOTH the species grid and the accessory shop (shop pages too)
- cell relayout for legibility: rarity pips moved to wall top-left,
  personality/BABY tag is now a dark pill at wall top-right, names sit
  on the floor strip as light text + dark shadow, SOON is a pill on the
  wall — kills the washed-out yellow-on-cream labels from the screenshot
- accPick overlay hit-test moved ahead of footer/pager buttons (it draws
  over the footer, so it must win clicks)
- rename hit area moved to the name row's new spot (y+78..90)

## Last session 12 (NEXT.md batch 3)
- seasonal species: `pumkin` (Halloween) + `yule` (winter) appended; `SEASONS`
  windows `[[m,d],[m,d]]` zero-based months; `seasonOpen()` handles
  year-wrapping (winter) vs normal (halloween) via `lo<=hi` check
- seasonal gating: `rollSpecies` pools + breeding pools filter `seasonOpen`;
  unavailable seasonal cells show SOON instead of the species name; collection
  counter counts open-season + owned-closed species only
- focus recognition upgrade: backend now also resolves the foreground exe via
  GetWindowThreadProcessId -> OpenProcess(QUERY_LIMITED) ->
  QueryFullProcessImageNameW; emits `focus` [title, exe] (~2s). Frontend
  accepts old string payload too. `focusKind()` matches editor/media/browser/
  game on BOTH title and exe; unknown exes = "other" (no more game fallback)
- pomodoro mode: settings POMO row toggles; `pomo`/`pomoPhase`/`pomoUntil`
  persisted (`pomo` bool). 25min focus -> 5min break -> repeat (wall clock);
  FOCUS!/BREAK! bangs on transitions; focus sprints emit a heart every
  40-70s (+30% GO!); break phase shortens sleepMs 0.3x so it naps
- volume steps: SOUND row cycles VOL_STEPS [1, 0.6, 0.3, 0]; `volStep`
  persisted; legacy `muted` loads as volStep=3; blip gain multiplied by step
- treat buff icons: chili pepper + coffee float above the slime while
  `hyperUntil`/`noSleepUntil` are live
- reduce-motion now also caps ambient fx (24 vs 80 particles)
- settings panel grew to 6 rows (240px): SOUND/SIZE/MOTION/PHOTO/POMO/QUIT;
  stats line moved below the rows
- build note: release rebuild took ~7min after the windows-sys feature bump;
  run the exe via node spawn / Start-Process (powershell -c is flaky here)

## Last session 11 (NEXT.md batch 2)
- window-title-aware reactions: backend polls GetForegroundWindow+
  GetWindowTextW every ~2s -> emits `focus` title; `focusKind()` maps it to
  editor/media/game/other; wander roll biases — editor = more sitting
  (+0.08), media/game = more dancing (+0.08)
- photo mode: settings row PHOTO hides every UI element (`photoHide` gate on
  crosshair/buttons/report/tutorial/settings + hud/ranch opacity), captures
  `cv.toDataURL` -> new backend `save_png` command writes to
  `app_data_dir/photos/typet_<ts>.png`, "SAVED" bang
- backend: `save_png` command w/ hand-rolled b64decode (no new crates);
  `focus` title event inside the cursor-poll thread
- pal tickle/pat parity: wiggle-buffer tickle works on `palAt` targets
  (per-pal `tickleCd`, laugh face + hearts); slow-stroke head pat while a
  pal is held (`palRevX` reversal tracking, same 700ms/320px-s rules)
- pal personality play: play cooldown multiplied by `ppsy.pace` (hyper plays
  sooner, lazy waits); shy pals flee 2x farther after a bump
- accessory equip picker: acc slot click opens an EQUIP grid overlay at the
  ranch bottom (4 cols, NONE first, equipped item highlighted); any click
  commits/closes; replaces the one-at-a-time cycle
- treat variety: `TREATS` table (cookie 60xp / cake 200xp / chili =hyper
  60s / coffee =no-sleep 5min); right-click the snack button cycles the
  kind; treatFly/treat carry `kind`; chili adds flame fx + 1.5x speed +
  0.5x wander interval; coffee gates the sleep branch of the mood interval
- hybrid shiny inheritance: 15% when either parent is shiny ->
  `SHINY BORN!` label
- local stats counters: `stats {pulls,breeds,shiny,treats,plays}` persisted,
  shown at the bottom of the settings panel (Steam-achievements groundwork)
- reduce-motion accessibility: MOTION row in settings; damps squash 0.4x +
  rotation 0.35x; spin trick becomes a dance

## Last session 10 (NEXT.md batch 1)
- pal polish: pals munch on every keystroke (`faceId`/`faceT` override faces),
  glance at a nearby cursor (230px), existing look/blink kept
- pals persist: `pals` id list saved in state.json, respawned on load
- away-report panel: replaces the toast — "AWAY REPORT / N MIN AWAY / +G /
  WELCOME BACK" for 9s, click-to-dismiss, own clickable rect
- name-your-slime: click a cell's name row -> type (max 10 chars, A-Z0-9space),
  Enter commits / Esc cancels; `customNames` persisted, `spName()` used by
  ranch cells, nursery, and pull labels
- shiny variants: 8% on NEW gacha species -> gold-tinted sprite (`SHINY_PAL`,
  sprite cache key includes shiny bit), `*` marker on the cell, `SHINY!` label
- ranch rooms tinted per trait (`ROOM_THEME`)

## Last session 9
- BUGFIX: slimes teleported to the TOP of the screen — `plats[0]` fallback is
  the topmost window; when a platform vanished (window moved/closed), grounded
  slimes snapped up to it. New `platUnder(x,y)` picks the nearest platform
  AT/BELOW the slime, else a synthetic floor at winH. Applied to `sup` (main
  pet) AND pal platform re-resolve AND the off-screen floor fallback
- recall() now brings the pals along — drops them beside the pet

## Last session 8
- pals are now fully interactive: `palRect`/`palAt` hit test, registered in
  the clickable-regions interval, drag-to-throw (own palVX/palVY tracking),
  tap-to-poke (squash + happy face + heart), pointercancel releases
- dragged pal skips AI/physics/play (`p === palHeld` gate in the pals loop)
- pal scale bug fixed: pals used blobSize().scale which carries the ACTIVE
  pet's baby factor — now `palScale()` computes its own (baby 0.55 else 0.92)
- nursery: `babyIdx`/`gridIdx`/`nurseryH` helpers; babies render in a pinned
  NURSERY crib row at ranch top (click = set active, `+` = summon), removed
  from the collection grid; grid/scroll/clip math all include nurseryH
- drawPaci enlarged (5x4 shield + 3x3 knob, u*0.85)

## Last session 7
- 20 accessories total (was 6): party, flower, phones, stache, patch, shades,
  antenna, leaf, beanie, horns, band, wiz, mohawk, prop — all fillRect pixel art
  in `drawAcc`, same 250-gem shop
- companion slimes: ranch cell bottom-left `+`/`-` box summons/removes a pal
  (max `MAX_PALS`=2). Pals are simplified AI — wander/hop/land on platforms,
  blink/look faces, own squash spring; they do NOT climb/sig/dance
- pal interactions: same-height proximity triggers play — face each other,
  heart at midpoint, squash bump, then drift apart (6s cooldown per pair,
  `p.playCd` + `mainPlayCd`); pals also wander toward the main pet
- pals re-resolve their platform every frame by position (plats refresh from
  backend — never compare platform object references)
- baby slimes: bred hybrids get `bornAt`; `isBaby()` = hybrid < 1h old →
  0.55x size, pacifier overlay (`drawPaci`), slower walk (0.8x), no
  climb/chomp/sig, ranch tag shows BABY (blue). "GROWN UP" bang on maturing
  (`_wasBaby` runtime flag, not persisted)

## Last session 6
- personality system: `ps` field + `PSY_ASSIGN` map gives all 50 species an
  archetype (hyper/bouncy/calm/lazy/shy/bold); hybrids inherit a parent's
- `psy` multiplies: wander cadence (pace), walk speed (spd), cursor-follow
  range (follow), time-to-sleep (sleep), startle threshold (startle)
- `shy` archetype has `flee: true` — walks AWAY from the approaching cursor
- `baseSpd` is the personality-scaled walk speed; the follow-cooldown check
  (`walkSpd !== baseSpd`) compares against it, not a hardcoded 55
- ranch cell shows the personality tag under the species name
- CONCEPT.md should document the archetype table when next touched

## Last session 5
- species signature acts (`sig` field, inherited by hybrids): epic+ each has one —
  kitty=pounce, bolt=zap, void=voidpull, aurora=veil, toxic=bubbleup, mecha=beep,
  ghost=phase(alpha), astro=orbit, ninja=smokebomb(teleport); legendaries bigger —
  goldie=shower, stella=starburst, comet=reentry(launch+slam), molten=eruption,
  siren=song; cliff/bites keep climb/chomp trait acts
- trigger: ~65% of the spin band roll goes to the species sig when it has one
- gem rate slowed: 1 gem / 600 keys (legendary 300)
- CONCEPT.md now has the full 50-species compendium table (concept/shape/trait/sig)

## Last session 4 (QA pass on session 3)
- treat: 10s stale despawn, only seeks cookies on the pet's own platform, landing wakes the slime, recall clears treat/aim, gems awarded at xp milestones
- treatAim no longer eats UI clicks (runs after gear/snack/settings/recall); Esc or right-click cancels
- rc pointerdown ignores non-left buttons (right-click no longer spends gems)
- RUSH moved into header row [376,12,56,22] — was being overdrawn by the cell grid
- shopMode: scroll range uses ACCS rows, resets scroll on toggle, PULL/BREED greyed while shopping
- silhouette sprites no longer leak FIXED colors (gacha reveal unspoiled)
- saved hybrids validated on load (shape/pal/r sanitized — old dev saves can't crash the frame loop)
- curV decays when cursor idle >200ms (stale speed no longer re-startles)
- button hit rects aligned with clickable masks; cookie lands on highest crossed platform; acc-slot clicks ignored during breed picks

## Last session 3
- 50 species total (was 23): +10 common, +8 rare, +6 epic, +3 legendary
- new body shapes: `square` (waffle/slate/mecha), `puddle` (cloud/taro/toxic/ghost)
- more mv styles in use: ghost/astro/siren hover, comet blink, ninja scurry
- ranch widened 340→470px, cells now 4 columns
- SHOP tab in ranch: accessories purchasable at 250 gems each (OWNED badge when bought)
- treat throw: cookie button (top-right, left of gear) arms aim → click anywhere to arc a cookie → slime runs over and eats it (+60 xp, YUM). Stales after 10s; ignores cookies on other platforms
- dev save: all 50 owned, jelly 999, active=comet

## Last session 2
- per-legendary movement styles via `mv` field (inherited by hybrids):
  Goldie `hover` (floats, shadow stays on ground), Stella `blink` (teleport steps + poof),
  Bites `scurry` (mouth-open sprint), Cliff `walk` + climb
- climb redone: no more 90° sprite rotation — clings upright, scrambles with held1/held2 face swap + climbSq squash wobble
- economy: 1 gem / 400 keys; breed cooldown now skippable — RUSH button under BREED costs 100 gems
- base scale 1.5→1.3
- offline earnings: 1 gem per 10min away (cap 20), `savedAt` in state.json, "AWAY +N" toast on boot

## Last session
- wall-bounce made instant (splat no longer freezes motion)
- gem economy: pull = 10 gems, 1 gem per 400 keys, starter 10, dupe refund +4
- settings panel (gear btn, top-right): SOUND / SIZE / QUIT; persisted
- tutorial hints + collection counter in ranch header
- cross-window hop + time-of-day moods + tray Summon
- **QA pass fixed the big one**: `Date.now()` vs `performance.now()` clock mixing had silently disabled the ENTIRE wander/behavior system plus blink, look, tickle, pat, annoy, shock faces. All timers that `frame()`/`currentSprite()` compare against rAF-time are now perf-clock. Symptom had been "nothing happens / faces stuck".
- other QA fixes: pointercancel release, keydown double-count removed, scrolled-cell clicks under ranch header blocked, persist() before quit_app, contextmenu suppressed, rAF reschedules first (frame exceptions can't kill the loop)

## Rules for future edits
- Timers consumed in `frame()`/`currentSprite()` (blink/look/shock/tickle/pet/annoyed/content/munch/wander/sit/stretch/spin/dance/climb/splat/dizzy): **use `performance.now()`**.
- Wall-clock things (idle time, breed cooldown, boot age): `Date.now()`. Never mix on one variable.

## Open issues / next
1. Steam Cloud save — sync state.json; needs steamworks-rs or equivalent [M]
2. Steam SDK achievements — `stats` counters already persisted locally [M]
3. Focus/Pomodoro moods — cheer during focus sprints, nap on breaks [M]
4. Seasonal event slimes — limited-time species comeback hook [M]
5. Localization (JP/KR) — string count is still small [M]

## 2026-09-18 소셜 뎁스 2차 + anim 프로파일 + QA
- MAX_PALS 3 (3단 토템 탑 가능), 같은 종족 누질, 질투(한 팔 쓰다듬으면 다른 팔 삐져서 접근), 허들(idle끼리 모여듦)
- animProf(): 종족 인덱스 시드로 블링크/피젯/호흡 주기 차별화 — 펫+팔 적용
- shapeVar tfm 버그 수정: 행별 폭비율 스케일+클램프+4px 프로트루전 — 장식이 좁아진 실루엣 밖으로 안 뜸
- qacheck.cjs: 전종×전표정 스윕 + 5x5 근접+클러스터 연결성 검사 + qa-sheet.png. 167->6 (잔여=의도된 플로팅 장식: frog 눈자루/inky 촉수)

## 2026-09-18b 눈 디자인 + 종족별 모션/상호작용 3차
- EYE_TPL 5종 + eyeStyle(i) 시드 배정 + faceSet(spIdx): idle/lookL/lookR 눈을 종족별로 생성 — 라운드(새 기본, 모서리 라운드+샤인+캐치라이트+u 아이리스 뎁스), 스파클, 도트, 스타리(금색 캐치라이트), 멜로우(반개). stella/ghost/void/shade 수동 배정
- u 차 문자 추가 — 눈동자 밑 라이트 아이리스 (assets.cjs 동기화 완료, faceSet/eyeStyle/EYE_TPL regex 추출로 자동)
- love 표정 (하트 눈 v) — 누질/시렌 매혹/팔 쓰다듬기에 적용
- 예비 스쿼시(anticipation): hopTarget/개구리 걷기 점프 전 110-120ms 웅크림 — 펫+팔
- animProf 확장: hop(도약 높이 0.82-1.27)/lean(걷기 기울기 0.7-1.6) — 점프력과 기울기도 종족별
- 걷기 기울기: 이동 방향으로 몸이 살짝 기울어짐 (펫+팔, 종족별 계수)
- 신규 상호작용: TAG 술래잡기 (범프→술래/도망 역할, 잡으면 TAG!+웃음+도약), SHOVE 장난 밀치기 (피해자 !?+shock, 가해자 laugh), 스택 라이더 손짓/노래(♪/HI!), 팔 쓰다듬기/콕 찌르기에 love 확률
- 버그 수정: 시렌 captivate의 p.lookUntil이 Date.now() 사용 → performance.now() 기준으로 수정 (기존엔 사실상 영구 지속)
- QA: faceSet 경로로 전환, love 표정 포함 — 신규 이슈 0 (기존 6 유지)

## 2026-09-18c 우클릭 스테이터스 카드 + 전용 랜치 버튼
- 사용자 요청: 우클릭하면 팔이 자꾸 사라짐(기존=귀가) → 우클릭을 상태 카드 열기로 변경
- `#card`/`#kc` 플로팅 패널 신설 (264x224, z-index 12 — 랜치/너서리 위, bestiary 아래)
- openCard/closeCard/cardMood/cardStatus/drawCard: 우클릭한 슬라임의 라이브 상태 카드
  - 표시: 종족명+샤이니*, 라이브 스프라이트(펫=currentSprite, 팔=p.pf 실시간 얼굴), MOOD(ANNOYED~CONTENT/IN LOVE 등), STATUS(HELD/SWINGING/RIDING X/TAG/FLEEING/AIRBORNE/WANDERING/IDLE), 레어도, 성격, 이동타입, 특성, 시그니처 스킬
  - 메인 펫: LEVEL + 다음 레벨까지 XP 진행 바 (xp%300)
  - 팔: 명시적 SEND HOME 버튼 (기존 우클릭 귀가 동작의 의도적 버전)
- 헤더 드래그로 카드 이동 (X 버튼 제외, 뷰포트 클램프), 호버 시 move 커서, ESC/허공 우클릭으로 닫기
- 랜치 전용 헛간 버튼 추가 (winW-154..-118, 스낵 버튼 왼쪽) — 호버/오픈 시 불투명, 클릭 가능 영역 동기화
- 우클릭 재배선: contextmenu에서 팔→openCard(p), 펫→openCard("pet"), 허공→카드 닫기. sendPalHome 우클릭 경로 제거
- 팔 렌더에서 p.pf 저장 — 카드 스프라이트가 실제 현재 표정과 동기화
- 튜토리얼 힌트 RIGHT CLICK=RANCH → RIGHT CLICK=STATUS
- 포토 모드에서 카드도 숨김/복원
- LEVEL 행 수정: xp는 총키수라 xp/300 진행바가 아니라 xp%300으로 다음 레벨 진행 표시

## 2026-09-18d 레전더리 포함 전종 시그니처 커버
- 사용자 요청: 레전더리 중 고유 특성/스킬 미구현 종 전부 구현
- _audit.cjs 커버리지 도구 신설: SPECIES의 sig/trait/mv 선언 vs 실제 구현(case/LEG/참조) 자동 대조
- 결과: r>=2 종 중 sig 없던 5종 전부 구현 (레전더리 cliff/bites + 에픽 shade/prism/yule)
- 신규 시그니처 5종:
  - cliff `landslide` — 웅크렸다 도약 후 강슬램: 이중 리플+SLAM 텍스트+암석 16개 폭포+측면 먼지
  - bites `frenzy` — 300ms 지그재그 촘핑 대시(총 1.2s, 입 벌린 채로)+부스러기 파편+BURP+하트
  - shade `umbral` — 납작한 그림자로 녹아내림(stretch -0.5+알파 0.5)→바닥 따라 미끄러짐→폴짝 부활
  - prism `spectrum` — 회전하는 무지개 파티클 팬(6색)+반짝임 ✦+SHINE 피날레
  - yule `jingle` — 종처럼 흔들리는 점프+눈송이/오너먼트 샤워+♪+금색 버스트
- LEG 앰비언트 보강: cliff에 tremor(걸음 쿵 kick+먼지)/summit(정상 연기), bites에 snap(이동 중 입질 kick+붉은 파편)
- SIG_INFO 5종 추가, makeHybrid의 sig 상속으로 하이브리드 자동 적용
- 감사 결과: r>=2 전종 sig 보유+구현 완료, trait/mv 전부 참조됨

## 2026-09-18e 귀여움 업그레이드 — 볼터치, 표정 5종, 악세사리 4종, 깃털 날개
- 사용자 요청: 더 귀엽게 + 악세사리 구체화 + 표정 추가 + 현실적인 날개
- 볼터치 확대: idle/lookL/lookR의 k 픽셀을 2x2 클러스터로 — 전종 자동 적용
- 신규 표정 5종 (펫 타이머+currentSprite 우선순위 배선):
  - star(별 눈, gold ★+활짝 미소) — 젬 획득/간식/뽑기 리빌
  - wink(한쪽 윙크+스머크) — BOOP/포토/태그 술래/팔 찌르기
  - cry(울먹+눈물방울+물결 입) — 팔 SEND HOME 시
  - pout(삐짐 쉐브론 눈+찡그림+큰 볼터치) — 찌르기 전환 단계/팔 질투
  - content(감은 눈+ω 고양이 입) — 만족 상태
- 악세사리 구체화: cap 스티치+버튼, flower 잎+꽃술, beanie 폼폼+줄무늬, phones 이어폰+커브 밴드, horns 새김+베이스, wiz 별 패턴+밴드, stache 꼬인 끝, bow 리본 꼬리+매듭 하이라이트, crown 보석+밴드 그림자, santa 퍼 트림+폼폼
- 신규 악세사리 4종 (ACCS 22→26): scarf(니트 줄무늬+드레이프 꼬리+술), beret(기울어진 베레모+꼭지), clip(별 머리핀+핀대), ribbon(긴 꼬리 리본, BOW의 고급판)
- drawWings 리라이트: 커버트층+프라이머리 깃털 3개(팁 지연 플랩), 깃털별 명암(밑이 어두움) — Stella/Drago 적용
- _faces.cjs 신규 표정 미리보기 도구 — faces-new.png로 시각 확인
- QA: 신규 이슈 0 (기존 6 의도 경고 유지)

## 2026-09-18f 전면 스프라이트화 + 내실 패스
- 사용자 요청: 내실 확실히 + 디자인은 전부 스프라이트
- SPR 도화지 시스템: 비트맵 도답 테이블 + sprImg() 오프스크린 프리렌더 캐시 + drawSpr() 블릿 (단색 스프라이트는 tint 재색상 지원)
- OS 폰트 완전 제거 (fillText/ctx.font 0건): bangs 전부 픽셀 drawText(s=2) 전환, ✦♪♥★💎는 BANG_SPR 스프라이트 매핑, hearts=heart 스프라이트, zzz=픽셀 Z
- drawWings 재작성: 베지어 곡선 → WING_F 3프레임 비트맵(올림/중간/날갯짓), wingImg()가 종별 색 틴트 캐시, 미러+미세 회전
- 스프라이트로 전환된 요소: 간식 4종(cookie/cake/chili/coffee), Bites 파일/폴더, 조준경, 기어/헛간/집 아이콘, 수면 버블, 착지 리플(ring), 펄사 진공링(ringv), Webby 거미다리(leg), 가차 에그/크랙 에그/캡슐볼, halo 악세사리 링, patch 스트랩(스텝 픽셀)
- 부드러운 요소도 스프라이트화: shadowImg()/haloImg() 프리렌더 — 펫/팔 그림자 + 레전더리 골드 링이 drawImage로
- fx에 p.spr 옵션: drago 잉걸=ember, stella 모트=mote, yule 눈송이=flake 스프라이트 파티클
- 남은 벡터: 웹 실크 선(연결선), 포모 진행 arc(게이지), clip 마스크 — 기능 요소라 유지
- 내실 수정: frenzy 벽 끼임 → 플랫폼 끝 ricochet(방향 반전+!+먼지+sfx), jingle 공중 버스트 → 착지 후에만 피날레, Date.now 감사(전부 wall-clock 용도로 일관 — 프레임 경로 혼용 0건), palHeld/sendPalHome 생명주기 + stackOn/tag stale 참조는 pals.includes 가드 확인
- _audit 전종 sig/trait/mv impl=Y, qacheck 신규 이슈 0

## 2026-09-18g 레전더리 스킬 미발동 버그 수정 + 팔 미니 액트
- 사용자 보고: 레전더리 슬라임이 스킬을 안 씀 — 원인 2중 구조 버그
- 원인 A (trait 기아): wander roll 체인에서 `roll<0.9 && climb/chomp/web` 분기가 sig 슬롯(0.9~0.95, ×65%)보다 먼저 실행 → cliff/bites/webby는 ~3%, 나머지도 ~11%밖에 sig 도달 불가
- 원인 B (무한 추적): 레전더리 커서 추적 반경 700px — 커서가 근처에 있으면 walkTarget이 계속 재설정돼 wander 롤 자체가 안 돔
- 수정 A: sig를 독립 주사위(sigGo 16%)로 분리 — trait 분기 영향 없이 전종 동일 발동률 (wander당 16% ≈ 레전더리 15~45초 간격)
- 수정 B: 추적 중에도 dt*0.07 확률로 sig 인터럽트 — 몇 분 추적해도 ~14초마다 쇼맨십
- 팔 미니 액트 신설 (PAL_FLAIR): 팔은 풀 액트 머신 없이 ~900ms 플러리시 — 종별 테마 파티클 패턴(rain/ring/rise/drift/cone/crackle/implode/hop/zig 9종) + bang 글리프 + happy 표정
  - 발동: 팔 nextT 롤에서 12%, stackOn/held/webbing 중 취소, 카드 STATUS에 SHOWING OFF 반영
- 부수 버그 수정: `o.web`/`p.web` 타임스탬프를 truthy 체크하던 곳 → `now < .web` (한 번 웹 걸린 팔이 영구 차단되던 버그)

## 2026-09-18h 완전 동결 핫픽스 — lo/hi 스코프 ReferenceError
- 사용자 보고: 슬라임이 아예 안 움직임 + 간헐적 끊김
- 원인: `lo`/`hi`가 `if (onGround…)` 이동 블록 안쪽 `const`인데 디스패치의 rollout/frenzy/umbral이 블록 밖에서 참조 → ReferenceError로 frame()이 디스패치에서 매번 사망. rAF가 먼저 큐잉돼서 루프는 살지만 렌더/물리가 영구 정지. sig 발동률 상승으로 숨어있던 버그가 표면화됨
- 수정: `lo`/`hi`를 `sup` 계산 직후 프레임 스코프로 호이스트 — sup는 platUnder 폴백으로 항상 존재
- 끊김 원인: 이동 블록에 `!sigT0` 게이트 없어서 액트 중 follow가 walkTarget 주입(걷기+액트 싸움) + overdue nextWander가 sigT0 리셋(액트 재시작 루프)
- 수정: 이동 블록에 `!sigT0` 게이트 추가 — 액트 중 wander/follow/스낵 결정 전면 정지. 액트 종료 정리부에 `nextWander = max(now+0.9~1.8s)` 쿨다운 — 액트 연쇄 방지
- hopWind stale 방지: sig 발동 시 hopWind=0 (다음 홉이 예비동작 없이 즉발되던 것)
- 팔 플러리시 정리: 발동 조건에 `!p.tag && !p.fly` 추가, 시작 시 p.tag 해제 — 추격 중 플러리시 싸움 방지
- PAL_FLAIR 27종 전 sig 커버 확인

## 2026-09-18i 커서 반응성 + 유기적 생명감 패스
- 사용자 보고: 마우스 상호작용이 안 느껴짐 — 입력 파이프라인(CLICKABLE/ignore-cursor/포인터 핸들러)은 전수 검증 결과 정상, 실제 결함은 슬라임이 커서를 "알아채지" 못하는 반응성 부재
- 커서 인지 레이어: 눈맞춤 반경 280→280+r*70 (레전더리 490px), 커서가 150px 안에 1.1s 머물면 NOTICE 반응(호기심 바운스/하트/?), 620px 빠른 스치기에도 힐끗
- 커먼 종 약한 추적: r=0도 160px 이내 느린 걸음으로 접근 — 레어 전용이던 커서 반응 전종 개방
- 수면 스터: 잠든 슬라임에 커서 접근 시 흔들림(150px) / 85px까지 오면 완전 기상(!?)
- 어텐션 시스템: ignoreT 75s+ 커서 근처 → 걸어와서 커서 밑에 앉아 조르기(begUntil 4s, 앉기+발톱 흔들기+♥/!) — 카드 STATUS=BEGGING, MOOD=NEEDY
- 에너지 타이드: energy 0.15~1.0 느린 드리프트 — nextWander 주기 ×(1.25-energy*0.6), lazy(<0.3) 피젯이 하품/한숨 위주, MOOD 카드에 PLAYFUL/LAZY 반영
- 신규 모션: 하품(950ms 스트레치+입+숨결 파티클, lazy 전용), 체중 이동 셔플(±5~12px 스텝), 지루한 한숨(ignoreT>30s), 호기심 눈치(좌우 glance), 턴 플러리시(방향 전환 시 피벗 스쿼시+먼지), 졸음 노딩(수면 45s 전 드룹 사이클)
- 더블탭 트릭: 슬라임 더블클릭 → 스핀(r≥2)/바운스 + ♪ + happy
- 클릭 영역 확대: petRect 패딩 8→14/12→16 (움직이는 슬라임 잡기 쉽게)
- 액트 보호: startle/attention-seek/begging에 !sigT0 게이트 — 시그니처 중 끼어들기 차단
- ignoreT는 touch()에서만 리셋 — 타이핑은 프레즌스로 카운트하지 않음(직접 접촉만)

## 2026-09-19a 인게임 젬샵 + 카드 타겟 링 + 패널 위치 저장 + 커서 사냥
- **인게임 젬샵** (`gemShop`, 설정 GEMS 행 신설 — 패널 11행): GEM_PACKS 4팩 가격 표($0.50/$0.90/$1.90/$3.90) + 보유 젬 잔액 + BUY ON ITCH.IO 버튼 + REDEEM CODE 버튼(기존 코드 모달로 연결)
  - `GEM_SHOP_URL` 상수 — itch 페이지 생기면 채우면 됨. 비어있으면 버튼이 "STORE LINK TBD"로 비활성 스타일 + 클릭 시 안내 뱅
  - Rust `open_url` 커맨드 신설 — https만 허용, explorer로 기본 브라우저 오픈 (open_photos와 동일 패턴). tauri-plugin-opener는 있었지만 커스텀 커맨드가 코드베이스 관례와 일치
- **카드 타겟 인디케이터**: 우클릭으로 연 슬라임에 골드 링(ring 스프라이트 틴트, 펄스) + 머리 위 바운싱 쉐브론(tri 스프라이트 신설) — 펫/팔 공통, 위치 실시간 추적, 팔 사라지면 기존 closeCard 가드가 정리
- **패널 위치 저장** (`panelPos` → state.json): 랜치/너서리/카드 드래그 종료 시 좌표 기록, 재오픈·재시작 시 복원 (뷰포트 클램프 유지). 랜치 드래그 시 너서리 위치도 같이 저장. 로드 시 x/y 숫자 검증
- **커서 사냥** (신규 상호작용): 커서를 근처에서 빠르게 휘두르면(curV>480) prey-drive 축적(huntScore, follow 성격×에너지 가중) → 스토킹(0.4s 엉덩이 흔들기+시선 고정) → 커서 진행 방향 리드한 파운스 → 착지 시 120px 이내면 GOTCHA+하트+content, 빗나가면 pout
  - 쿨다운 8~14s, startle/조르기/시그니처와 상호배제, grab/이탈/액트 시작 시 중단
  - 카드 STATUS: STALKING/POUNCING!
- 검증: SYNTAX-OK, _audit 전종 impl=Y, qacheck 기존 6 경고만, 릴리즈 리빌드+zip 재생성, 실행 생존 확인

## 2026-09-19b 수면 권위화 — 자는 슬라임은 절대 안 움직임
- 사용자 보고: 잠자는데 움직임 + 방석 낮잠 중에도 움직임
- 원인: 자율행동 블록이 `state !== "grumpy"`만 제외 → sleeping/cushionNap 중에도 이동·액트 전부 발동. cushionNap은 state="idle"로 남아 모든 idle AI가 그대로 돔. 팔 restUntil은 배회 롤만 막고 follow/tag/스택/카피캣/공 회피/본체 밀치기 전부 통과
- 메인펫: 자율행동 블록을 `state === "idle" && now > cushionNap`으로 — else에서 walkTarget/hopTarget/hopWind 매프레임 정리. 수면 전환 시 sig/accAct/dance/hunt/blanket 취소 + climbing/webbing이면 낙하 전환(벽에 얼어붙는 대신). 방석 도착 시 진행 중 액트 전부 취소. 볼 드리블·트릿 추적·사냥팔 모집에 수면 게이트. 잡으면 cushionNap/W 클리어
- 팔: `nappingP = now < p.restUntil`을 루프 스코프로 — 트릿/커서놀이/소셜/follow/태그/카피캣/관객/스택/악세/공 회피+넛지 전부 게이트. 바디 분리는 자는 팔 고정하고 깨어있는 쪽이 2배 밀림. 잡으면 restUntil=0. 낮잠 중 zzz 파티클 추가
- 하네스 잡은 버그: nappingP가 중첩 else 안 선언돼 스코프 밖 참조 → 매프레임 ReferenceError → 팔 루프 후반 사망(슬라이드/액트/비트 전멸 위장). 루프 스코프 이동으로 해소
- 테스트 플래키 수정: scurry 걸음은 걷는 동안 munchUntil 상시 세팅 → stale-goal 테스트의 오라클을 bowlCd로. 팔 키스가 contentUntil 덮음 → face 체크 전 페이스 타이머 클리어. 그랩 테스트는 클릭을 삼키는 판넬/팔/트릿 전부 리셋 후 디스패치
- 검증: _pulse GREEN (verify 229/229, fresh 17×2, sim clean) — 수면 테스트 8종 신설

## 2026-09-20a 방석 1인승 + 팔 데드락 리프프rog
- 사용자 요청: 방석엔 팔 한 마리만 + 팔끼리 정면으로 막혀 못 지나가는 문제
- `cushionBusy(except, now)` — 방석 점유 판정 (펫 낮잠 or 팔 restUntil이 방석 50px 안)
- 팔 방석 심부름: 롤에서 점유 시 선택 자체를 스킵 + 도착 시점엔 "?" 서있다 포기 (restCd 18s) — 걸어가는 동안 뺏긴 레이스도 자연 해소
- 펫 우선권: 펫이 방석 도착하면 자던 팔은 튕겨남 (restUntil=0, shock 얼굴 + "!" + 낙하) — 방석은 항상 1인승 유지하면서 펫이 뺏는 그림
- 리프프rog: 팔 분리 블록에서 정면 교착 감지 (p의 목표가 q 너머 + q가 비켜나지 않음 — q 정지 or 정면 접근) → 0.52s 밀면 깡총 넘어감 (p.fly, vy -215×hop, vx 175, 먼지 fx) → 착지 후 재탐색. blockCd 1.8s로 연속 점프 방지. 같은 방향으로 같이 움직이는 캐러밴은 잠 아님 — q가 같은 방향으로 걷는 중이면 미발동
- 자는 팔도 넘어감 — 자는 팔은 영원히 못 지나가던 벽이었던 것 해소
- 테스트 플래키 수정 2건: 태그 비트 얼굴이 진행 중이던 팔 플러리시에 덮임 → sigT/accAct/face 핀. 펫 방석 심부름이 배회 롤에 교체됨 → nextWander 핀
- 검증: _pulse GREEN (verify 234/234 — 방석 점유 4종 + 리프프rog 신설)
## 2026-09-21 installer (NSIS)  
- NSIS setup exe: dist\Jellypal_0.2.0_x64-setup.exe (1.7MB)  
- bundle.resources ships WebView2Loader.dll to $INSTDIR (GNU target = dynamic webview2 loader)  
- icon back to C:/dev/assets/icon.ico: C:\dev\mini is a JUNCTION to Desktop (non-ASCII path) - windres cannot open Korean paths  
- validated: silent /S install, jellypal.exe+dll+uninstall.exe land, app alive 10s+, crash.log 0 delta, /S uninstall removes dir  
- currentUser mode (no admin), webview2 runtime auto-downloads if missing 
## 2026-09-22 single-instance fix  
- duplicate launch + \"not responding\": second instance fought over WebView2 user-data dir and wedged  
- fix: Local\JellypalSingleInstance CreateMutexW guard in run() - second launch exits(0) silently  
- windows-sys +Win32_Security feature for CreateMutexW  
- verified: launch twice = 1st alive, 2nd exits; pulse 11/11 GREEN; C:\Jellypal + dist setup.exe rebuilt 

# Jellypal (was Typet) — progress log

## Status
Working Tauri app: transparent fullscreen always-on-top overlay (click-through except pet + UI), slime pet living on the desktop / window tops, ranch UI with gacha, breeding, and accessories. Renamed to **Jellypal** (itch project name) — exe is `jellypal.exe`, identifier `com.jellypal.desktop`, redeem prefix `JELLYPAL-`. Runs as `src-tauri/target/release/jellypal.exe`.

## How to continue
```bat
taskkill /F /IM jellypal.exe
cd /d C:\dev\mini\typet\src-tauri
set "CARGO_HOME=C:\home\cargo" && set "RUSTUP_HOME=C:\home\rustup" && cargo build
target\debug\jellypal.exe
```
- `node _pulse.cjs` — one-command app/backend/site/release gate, GREEN/RED in
  ~20s on a warm checkout, writes `HEALTH.txt`. `--watch` re-pulses on changes.
- `HEARTBEAT.md` — the protocol: what each pulse may implement, bug
  priorities, the verification gate, product guardrails. Follow it.
- `node _sim.cjs` — DOM-stubbed frame harness; run BEFORE rebuilding to
  catch frame()-level ReferenceErrors (the two freeze bugs were this
  class). 600 clean frames = loop alive.
- exe must be killed before rebuild (file lock).
- Frontend (`src/*.js`/`html`/`css`) is embedded into the exe — changes REQUIRE `cargo build`. No hot reload.
- State file: `%APPDATA%\com.jellypal.desktop\state.json` — legacy saves migrate from com.jellypal.app/com.typet.app.
- Backlog: `NEXT.md` (top 5 mirrored below).

## Last session 262 (autonomous loop - reset companion spring deformation on recall)
- Fixed global system recall preserving a companion's current squash and spring
  velocity from an interrupted impact. A pal teleported into the fresh
  top-of-screen drop could visibly replay the previous landing's deformation.
- `recall()` now resets each companion's `squash` and `squashV` together with
  its velocity and fall peak. Ordinary uninterrupted landing bounce and impact
  scaling are unchanged.
- The regression drives a Sprout through the production high-speed landing
  branch and proves it creates both a displaced body (`squash > 0.1`) and live
  spring momentum (`squashV > 1`) before recall. It failed exactly once before
  the fix and now starts the recalled `120`-speed fall with both values at zero.
  The complete prop suite, syntax checks, 600-frame simulation, and
  deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,992 bytes (SHA-256
  `ABEFEA6B65D5A4611AE497BF616DEDADA44AAF21152D58F3DEE0DF41B2333A88`);
  `jellypal-0.2.16-win.zip` is 2,262,779 bytes (SHA-256
  `69ECA0F0E2FE0A828E2F85F2FEC2060C3C1E8662A30E806AB93E7F24270ED301`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no Jellypal
  process, pulse lock, upload, or account action left behind.

## Last session 261 (autonomous loop - clear companion timed gaze on recall)
- Fixed global system recall preserving a companion's timed gaze from an
  interrupted action. Recall stopped the old accessory routine and facial
  reaction, but a pal could keep rendering `lookL`/`lookR` during its fresh
  airborne entrance while staring toward a cursor position from before the
  teleport.
- `recall()` now clears each companion's `lookUntil` while preserving its
  ordinary facing direction. New cursor glances and uninterrupted timed looks
  remain unchanged.
- The regression starts the production `monocle` accessory routine, proves its
  first step creates a live rightward timed gaze, parks the cursor away, then
  recalls and renders another frame. It failed exactly once before the fix by
  retaining that gaze and now enters flight without either look face. The
  complete prop suite, syntax checks, 600-frame simulation, and deterministic
  1,200-frame fuzz are green with zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,992 bytes (SHA-256
  `C05E50EAEC9D81D26D3893A744C0179AE85DE248607A951ED38C9C3812E96BCD`);
  `jellypal-0.2.16-win.zip` is 2,262,736 bytes (SHA-256
  `33A0431589665F340B8C1A53975EFF66D2DDEF13757505264CC56101893086B3`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no Jellypal
  process, pulse lock, upload, or account action left behind.

## Last session 260 (autonomous loop - release companion drag on recall)
- Fixed a backend/global summon arriving while a companion was held. Recall
  teleported the pal but kept `palHeld` and native dragging active, so the next
  frame suspended its fresh drop and the overlay could retain input until a
  later pointer terminal event or the 20-second watchdog.
- `recall()` now cancels companion dragging alongside the main-pet drag and
  clears the grabbing cursor/native drag state whenever either lifecycle was
  active. Ordinary releases, throws, and drag cancellation remain unchanged.
- The regression uses the production companion hit target and pointer-down
  handler, proves native dragging is active, then invokes system recall. It
  failed exactly once before the fix and now synchronously releases `palHeld`,
  restores the default cursor, disables native dragging, and starts the pal's
  `120`-speed recalled fall. The complete prop suite, syntax checks, 600-frame
  simulation, and deterministic 1,200-frame fuzz are green with zero crashes
  or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,992 bytes (SHA-256
  `FD4A42ACBA254A2934DA062C5105A12577AD29DBC4C6DC9D6ABFAD4C5407252A`);
  `jellypal-0.2.16-win.zip` is 2,262,768 bytes (SHA-256
  `6C482185D3E2E3EB40BA453E8043983EF6ABF5AE082B8C4B4D76324D552BE56E`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no Jellypal
  process, pulse lock, upload, or account action left behind.

## Last session 259 (autonomous loop - reset companion fall peak on recall)
- Fixed global system recall preserving a companion's peak impact speed from an
  interrupted fall. Although recall replaced the pal's current velocity with a
  gentle drop, its next landing could still squash with the force accumulated
  before the teleport.
- `recall()` now clears each companion's `fallPk` when it starts the new
  airborne entrance. Normal uninterrupted falls, landing ripples, and impact
  squash scaling are unchanged.
- The regression drives a Sprout through the production airborne physics to
  accumulate a real peak above `900`, then recalls it and checks the synchronous
  `120`-speed entrance. It failed exactly once before the fix by retaining the
  old peak and now starts at zero. The complete prop suite, syntax checks,
  600-frame simulation, and deterministic 1,200-frame fuzz are green with zero
  crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,992 bytes (SHA-256
  `98F195C703C08FB6C715258A955A524A9BDBB429D8B749BCC66AB67B55DAAA52`);
  `jellypal-0.2.16-win.zip` is 2,262,723 bytes (SHA-256
  `42994A915CEC1B7449ECB7AE853F52AC8D802274A70DAD81A94E1BC857E6977A`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no Jellypal
  process, pulse lock, upload, or account action left behind.

## Last session 258 (autonomous loop - clear companion action face on recall)
- Fixed global system recall preserving a companion's timed expression from an
  interrupted action. A pal that had just won a real treat race kept rendering
  its `munch` face while falling through the new recalled entrance even though
  the snack and errand were already gone.
- `recall()` now clears each companion's `faceId` and `faceT` together with its
  interrupted behavior state. Completed rewards, bond gain, interaction
  cooldowns, and future facial reactions are unchanged.
- The regression places a pal at the production treat-arrival point, proves the
  live race consumes the snack and starts its chewing face, then recalls and
  advances a rendered frame. It failed exactly once before the fix by retaining
  `munch`; now the pal is `AIRBORNE`, its mood is `CONTENT`, and no old face
  timer remains. The complete prop suite, syntax checks, 600-frame simulation,
  and deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,992 bytes (SHA-256
  `24D054A764227F520444AAAB073AF7EC1B706768947054D1CD1D16D0E3B527B1`);
  `jellypal-0.2.16-win.zip` is 2,262,714 bytes (SHA-256
  `AB3D5F18CC2AB4508A36F953DFD513E16147E7B12E097C71F7101754810D757C`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no Jellypal
  process, pulse lock, upload, or account action left behind.

## Last session 257 (autonomous loop - reset companion walk acceleration on recall)
- Fixed global system recall preserving a companion's accumulated walking
  speed. A normally walking pal recalled at full speed began its first unrelated
  post-landing stroll at that old maximum instead of smoothly accelerating from
  rest, producing a visible initial slide.
- `recall()` now clears each companion's `walkV` together with its interrupted
  `walkT`. Movement profiles, target selection, and normal uninterrupted speed
  ramps are unchanged.
- The regression advances four real capped frames through the production pal
  walking branch to reach cruising speed, recalls and lands the companion, then
  starts a new walk for one frame. It failed exactly once before the fix by
  retaining speed above `40`; now it restarts below `25` and moves less than two
  pixels. The complete prop suite, syntax checks, 600-frame simulation, and
  deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `8A7014DE0C83387F3169EEB743306ABD2931EDCB1BD2DD8DE06156FD438014B0`);
  `jellypal-0.2.16-win.zip` is 2,262,702 bytes (SHA-256
  `ADFFD441C68BEC862DB18A9A79486BD1D954CE71E06EE8FF2D6E09BF62F0AFB1`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no Jellypal
  process, pulse lock, upload, or account action left behind.

## Last session 256 (autonomous loop - reset companion hop wind-up on recall)
- Fixed global system recall preserving a hop-movement companion's pending
  anticipation deadline. If Hops was recalled during its `110ms` crouch, that
  clock expired during the summoned drop and its next unrelated walk launched
  airborne on the first frame without a fresh anticipation pose.
- `recall()` now clears each companion's `hopWind` together with `walkT`.
  Completed hops, species movement profiles, and ordinary consecutive hops are
  unchanged.
- The regression enters the production Hops movement branch, proves the pal is
  grounded with a future wind-up, recalls it, conditionally ages only a retained
  old clock, then starts a new walk. It failed exactly once before the fix by
  jumping immediately and now remains grounded with a new future deadline. The
  complete prop suite, syntax checks, 600-frame simulation, and deterministic
  1,200-frame fuzz are green with zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `2F092279862B455035CE9B1D679CC48292FBBAF63A06084B9935827EEF57D0FA`);
  `jellypal-0.2.16-win.zip` is 2,262,668 bytes (SHA-256
  `36A633AD7914EF3F7B05C5BA69751FBBD0F9C67E87E157F6161795C18F58AA4C`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no Jellypal
  process, pulse lock, upload, or account action left behind.

## Last session 255 (autonomous loop - reset companion scritch progress on recall)
- Fixed global system recall preserving a companion's partial back-and-forth
  scritch sequence. Two direction samples recorded before recall could combine
  with the first fresh sweep after landing and immediately emit a heart, happy
  face, bond gain, and the full scritch cooldown.
- `recall()` now clears each companion's unfinished `rubCount` and `rubDir`
  gesture state while preserving an already-earned `rubCd`. Normal uninterrupted
  scritches and their cooldown behavior are unchanged.
- The regression drives two real cursor directions through the production pal
  scritch branch, recalls and lands the companion, then applies one fresh sweep.
  It failed exactly once before the fix by completing the old gesture and now
  starts at one new direction with no heart or cooldown. The complete prop suite,
  syntax checks, 600-frame simulation, and deterministic 1,200-frame fuzz are
  green with zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `F7F04BFA2308E7F06EDF03B09A19C823A1B939F4FD8ED8DF69D37F4D9B0D8E39`);
  `jellypal-0.2.16-win.zip` is 2,262,679 bytes (SHA-256
  `EBE60A364F15D9B4E4FEA6A5B9F004F890569B52AB0B77B4050A0C624000EB6E`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no Jellypal
  process, pulse lock, upload, or account action left behind.

## Last session 254 (autonomous loop - reset companion cursor pressure on recall)
- Fixed global system recall preserving a companion's partially accumulated
  slow cursor pressure. A pal recalled just below its personality-adjusted
  shove threshold could land and immediately pout-hop after only two fresh
  contact frames because the pre-recall `boopT` progress was still present.
- `recall()` now clears each companion's `boopT` accumulator together with its
  other interrupted desktop state. Normal uninterrupted pressure, personality
  thresholds, and cooldowns are unchanged.
- The regression advances the production companion cursor-pressure branch to
  just below its threshold, recalls and lands the pal, then applies two fresh
  frames. It failed exactly once before the fix by launching the pal and now
  restarts near zero while remaining grounded. The complete prop suite, syntax
  checks, 600-frame simulation, and deterministic 1,200-frame fuzz are green
  with zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `9BDE7A7DC353FFCC3C05163F77A5549E75CFDF8BFE4D2DBBB69A1B49FFC06427`);
  `jellypal-0.2.16-win.zip` is 2,262,682 bytes (SHA-256
  `AD3B9DB7CBB13568D0CF0263DEBBF7399103A71D7A5C5E04B30E632866665A82`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no Jellypal
  process, pulse lock, upload, or account action left behind.

## Last session 253 (autonomous loop - cancel companion accessory act on recall)
- Fixed global system recall preserving a companion's active accessory routine.
  Flight-compatible routines such as the moustache bit survived the summoned
  drop; after the pal landed, their overdue later step ran immediately and
  launched the pal again as part of the interrupted pre-recall performance.
- `recall()` now clears each companion's active `accAct` while preserving its
  existing long accessory cooldown, so the old routine cannot resume and a new
  one is not scheduled immediately.
- The regression starts the production multi-step moustache scheduler, proves
  its first step is complete, recalls and lands the companion, then advances an
  overdue second step. It failed exactly once before the fix by relaunching the
  pal and now stays grounded with no active routine. The complete prop suite,
  syntax checks, 600-frame simulation, and deterministic 1,200-frame fuzz run
  are green with zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `A88BE430415048C970490A9DC87EE3C21A9CBF85E10773F3F79C49BD8E748D0B`);
  `jellypal-0.2.16-win.zip` is 2,262,672 bytes (SHA-256
  `F6E493FB8F3C4C6613E9392FCD28FE5B49057D1EEBC511C918D5EAC562AB3D91`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no running
  Jellypal process, pulse lock, upload, or account action left behind.

## Last session 252 (autonomous loop - stop companion signature on recall)
- Fixed global system recall preserving a companion's active mini signature.
  Companion flairs intentionally support their own airborne motion, so ordinary
  flight did not cancel the old show; its particles and `SHOWING OFF` status
  could continue over recall's fresh drop instead of presenting `AIRBORNE`.
- `recall()` now clears each companion's signature timer, signature id, and
  one-shot completion flag. Normal autonomous signature selection and future
  flairs retain their existing timing.
- The regression drives Shade's production companion AI into its real Umbral
  mini signature, proves the active id and `SHOWING OFF` status, invokes system
  recall, and requires a clean `AIRBORNE` drop with no retained signature
  lifecycle. It failed exactly once before the fix and now passes. The complete
  prop suite, syntax checks, 600-frame simulation, and deterministic 1,200-frame
  fuzz run are green with zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `FAE1F4BA31BA5F8537CC0912F10F33C04B6DE4FF18594635160583D448592442`);
  `jellypal-0.2.16-win.zip` is 2,262,600 bytes (SHA-256
  `C80E0BA23C8F106AB7C5F43DDE3B3790D8AFC667EC62AC1C48320F0C3A444787`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no running
  Jellypal process, pulse lock, upload, or account action left behind.

## Last session 251 (autonomous loop - cancel companion prop goal on recall)
- Fixed global system recall clearing a companion's walk target but retaining
  its semantic `propGoal`. The targetless goal could survive the fresh drop and
  be consumed by a later unrelated stroll, incorrectly treating that new
  destination as the interrupted bowl, cushion, treat, or furniture errand.
- `recall()` now clears `propGoal` atomically with `walkT` for every companion.
  Prop objects and their normal cooldowns remain intact; only the interrupted
  trip is discarded.
- The regression drives the production companion AI through its real bowl
  decision branch, proves both target and `propGoal="bowl"` are armed, invokes
  system recall, and requires both halves of the errand to be gone while the
  pal starts its fresh airborne drop. It failed exactly once before the fix and
  now passes. The complete prop suite, syntax checks, 600-frame simulation, and
  deterministic 1,200-frame fuzz run are green with zero crashes or invariant
  violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `240565DC71844837577AC13C526F5DEBBF70241EB8A0B31E581D9560380FEF87`);
  `jellypal-0.2.16-win.zip` is 2,262,693 bytes (SHA-256
  `BB1720CE22C9A104BE9B2065C7FD25083C2AAE26FB6B4E0384EEA1C1A0126A2F`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no running
  Jellypal process, pulse lock, upload, or account action left behind.

## Last session 250 (autonomous loop - wake companion nap on system recall)
- Fixed global system recall preserving a companion's active nap. Because the
  pal face and status card both prioritize `restUntil` over flight, the recalled
  companion fell from the top of the screen with a sleeping face and `NAPPING`
  status, then resumed the interrupted nap after landing.
- `recall()` now ends each companion's active nap together with its other
  interrupted occupancy state. The existing rest cooldown is preserved, so a
  freshly recalled pal does not immediately choose another nap.
- The regression arms the live companion nap presentation, proves both the
  sleeping face and `NAPPING` status, invokes production system recall, advances
  one frame, and requires an awake `AIRBORNE` companion. It failed exactly once
  before the fix and now passes. The complete prop suite, syntax checks,
  600-frame simulation, and deterministic 1,200-frame fuzz run are green with
  zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `9A49AA52D8C1BC4779421BC92438506FB129A01238F356EE6BE51EC4056833F2`);
  `jellypal-0.2.16-win.zip` is 2,262,629 bytes (SHA-256
  `007E06ADC0631A870F43752AA2AF3135AD510775C2F702AFD0F7CC4D690707C8`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no running
  Jellypal process, pulse lock, upload, or account action left behind.

## Last session 249 (autonomous loop - evict companion box hide on recall)
- Fixed global system recall failing to pull a hidden companion out of its
  cardboard box. The companion `hiddenInBox` branch runs before flight physics,
  so its retained `hideUntil` timer moved the pal back to the box and cancelled
  recall's fresh airborne drop on the very first frame.
- `recall()` now clears each companion's active box-hide timer while preserving
  the box furniture and the pal's normal box reuse cooldown. Ordinary box play
  and companions that were not hiding retain their existing behavior.
- The regression arms the live companion box-hide branch, proves the pal is
  hidden at the box, invokes production system recall, advances one frame, and
  requires a visible airborne pal away from the old box. It failed exactly once
  before the fix and now passes. The complete prop suite, syntax checks,
  600-frame simulation, and deterministic 1,200-frame fuzz run are green with
  zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `2E452401EEB043C630A403FC7DD61AA6FE50685F07B04C4715E1B102AFB37A5F`);
  `jellypal-0.2.16-win.zip` is 2,262,623 bytes (SHA-256
  `6CCAB46C6C58CF65B81F1852A80C133217C03A45D3D9EDB196893E6C92C25A62`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no running
  Jellypal process, pulse lock, upload, or account action left behind.

## Last session 248 (autonomous loop - cut companion web on system recall)
- Fixed global system recall failing to bring along a companion Webby that was
  dangling from the cursor. Companion web motion runs before ordinary flight,
  so the retained `p.web` timer cancelled recall's fresh airborne drop on the
  very next frame and pulled the pal back under its old cursor anchor.
- `recall()` now clears each recalled companion's web timer, pendulum angle,
  and angular velocity together with its stack, stroll, and tag state. Normal
  autonomous web play and non-Webby companion drops retain their existing
  behavior.
- The regression arms the production companion-web frame branch, proves the
  pal is actively dangling, invokes real system recall, advances a frame, and
  requires the old web to be gone while the fresh drop remains airborne. It
  failed exactly once before the fix and now passes. The complete prop suite,
  syntax checks, 600-frame simulation, and deterministic 1,200-frame fuzz run
  are green with zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `6C99136CAE9A4B5EC8231ACAC63D1E4647EDD5F30839FAE3707DA0A47CFE504C`);
  `jellypal-0.2.16-win.zip` is 2,262,649 bytes (SHA-256
  `25800F9482018DE14F8FAFF5EFDD2B0E15B97AACB26C1A363E2EED018616DD82`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no running
  Jellypal process, pulse lock, upload, or account action left behind.

## Last session 247 (autonomous loop - release native drag on system recall)
- Fixed global system recall interrupting a held main pet only in JavaScript.
  It set `held=false` but left the cursor as `grabbing` and the backend's
  `set_dragging` mode enabled; the later pointer-up then returned early and
  could leave the desktop click-through boundary permanently widened.
- `recall()` now routes an active main/web hold through `cancelPetDrag()` and,
  only when a hold was cancelled, restores the default cursor and sends
  `set_dragging(false)`. The recall drop, ordinary pointer release, and
  unrelated prop/pal/menu drags retain their existing behavior.
- The regression starts a real canvas pointer hold, proves native dragging is
  enabled, invokes production system recall, and requires the JS hold, cursor,
  and last backend drag call to all be terminally clean. It failed exactly
  once before the fix and now passes. The complete prop suite, syntax checks,
  600-frame simulation, and deterministic 1,200-frame fuzz run are green with
  zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `02EC362029DA71981A03784C08493664314BB3C396F1CD859BA77671BC3552C2`);
  `jellypal-0.2.16-win.zip` is 2,262,695 bytes (SHA-256
  `8F0B4C5E6C3EF83B6CCBDFBBD2459BDD51120552343C73E18B489F5B76C1B199`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no running
  Jellypal process, pulse lock, upload, or account action left behind.

## Last session 246 (autonomous loop - wake sleep synchronously on system recall)
- Fixed global system recall leaving `state = "sleeping"` active until the
  one-second mood interval ran. `touch()` refreshed the wake clock and recall
  armed its fresh shock, but the sleeping face/status outranked that reaction,
  so the airborne summon could remain visibly asleep for nearly a second.
- `recall()` now sets the main state to `idle` synchronously after any ranch
  return handling. Existing long-absence grievance timing from `touch()`, the
  deliberate recall shock, and ordinary passive sleep scheduling are unchanged.
- The regression puts the visible pet in the real sleeping state, invokes
  production system recall, and immediately requires an airborne idle pet with
  the `STARTLED` status. It failed exactly once before the fix and now passes.
  The complete prop suite, syntax checks, 600-frame simulation, and
  deterministic 1,200-frame fuzz run are green with zero crashes or invariant
  violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `437EBC95A7898550CBED30B80004A3318D78A61502A212EE9CF4D24EF3A26F89`);
  `jellypal-0.2.16-win.zip` is 2,262,660 bytes (SHA-256
  `D45EFB7DA689367F9A135813AE61906009B0BE5D2EB1E3C010E33A7F0547C99B`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no running
  Jellypal process, pulse lock, upload, or account action left behind.

## Last session 245 (autonomous loop - evict furniture rests on system recall)
- Fixed global system recall retaining the main pet's occupied cushion and box
  states. A recalled cushion nap kept its sleeping presentation, while a live
  `boxHide` timer overrode the fresh launch on the next frame and snapped the
  pet back into the box.
- `recall()` now clears `cushionNap`, its wall-clock twin `cushionNapW`, and
  `boxHide` together with `sitUntil`. The furniture objects and their normal
  reuse cooldowns remain intact; only the interrupted occupancy is evicted.
- Two regressions arm the existing production rest-state fixtures and invoke
  real system recall. Before the fix both failed: the cushion timers survived
  and the box cancelled flight after one frame. Both now pass, along with the
  complete prop suite, syntax checks, 600-frame simulation, and deterministic
  1,200-frame fuzz run with zero crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `784530EE518FEECA36305FB0E54BE183ED0CB1B9C1FDE28BF97C665C71DD00E6`);
  `jellypal-0.2.16-win.zip` is 2,262,639 bytes (SHA-256
  `6425C10E7806C45AFE5CE3E4FE0EF30F2B06A3640A865CDAAF2999B13FEB20D2`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no running
  Jellypal process, pulse lock, upload, or account action left behind.

## Last session 244 (autonomous loop - cancel stale blanket on system recall)
- Fixed an unfinished cursor tuck-in approach surviving global system recall.
  Recall places the pet at the cursor's x-coordinate, so the retained
  `blanketT0` completed on the very next frame and emitted an obsolete
  blanket, heart, and `TUCKED IN` message during the fresh drop-in.
- `recall()` now clears `blanketT0` with its other interrupted walk and action
  state. The existing ranch HOME path already did this; completed blankets,
  the ten-minute cooldown, and later newly selected tuck-ins are unchanged.
- The regression arms the production blanket approach, invokes the real
  system recall, suppresses only a new rare approach, and advances the normal
  frame branch. It failed exactly once before the fix by completing the stale
  job and now stays clean. The complete prop suite, syntax checks, 600-frame
  simulation, and deterministic 1,200-frame fuzz run are green with zero
  crashes or invariant violations.
- The isolated candidate passed the policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `FD8239C1AD2D75DE8406C59479863F9FFF413D5868E48EDD48141E27E8D850E9`);
  `jellypal-0.2.16-win.zip` is 2,262,625 bytes (SHA-256
  `1D0375528F82D777794B74551EF00472111E8F4539D86600B4B7E681C775A4C9`).
  All nine real profile files retained exact hashes and timestamps; recovery
  remained absent and registry `sv` remained the string `15`, with no running
  Jellypal process, pulse lock, upload, or account action left behind.

## Last session 243 (autonomous loop - clear ranch attention debt)
- Fixed latent ignored-time `ignoreT` surviving a ranch HOME roundtrip. A pet
  already above the 75-second attention threshold but not yet begging could
  be sent home and then immediately enter NEEDY on its first grounded frame
  after returning.
- `bringPetHome()` now resets `ignoreT` alongside `awakeAt`, treating the
  explicit ranch return as fresh contact. `recall()` already uses `touch()`
  and remains unchanged.
- The regression arms `ignoreT=100` without activating beg, sends and returns
  the pet, settles it, and pumps the production attention branch with a
  deterministic roll. Before the fix, ranch return immediately begged; now
  ignored time restarts below one second. The recall control remains clean.
- Complete property suite, syntax checks, 600-frame simulation, and
  1,200-step deterministic fuzz run are green.
- Candidate policy gate is 6/6 and the final heartbeat is 32/32. Released
  `jellypal.exe` is 5,524,480 bytes (SHA-256
  `8E1CF7628F97D48F2604EA348228DD6A7A1744DE6ABEBBF8738510C90231E7C5`);
  `jellypal-0.2.16-win.zip` is 2,262,632 bytes (SHA-256
  `035638F0087CA43642969D9FD69ACC8A81E1A8B972A54C04F840EAEE6C830E8B`).
  The real nine-file profile, recovery marker, registry save version, process
  state, and pulse lock all remained unchanged/clean.

## Last session 242 (autonomous loop - end stale content reactions)
- Fixed the positive `contentUntil` reaction surviving HOME or global recall.
  A real BOOP correctly ended its wink at those boundaries but left the
  attached satisfied state alive, so a parked pet retained a hidden desktop
  reaction and recall could reveal the old content face after its entrance
  shock expired.
- HOME and `recall()` now clear `contentUntil` with the other face/reaction
  timers. `bringPetHome()` still deliberately creates its own fresh `HI!`
  content response, so the welcoming ranch entrance remains unchanged.
- The strengthened regression uses the production snoot tap, verifies BOOP
  creates both wink and content, then checks three distinct states: parking
  ends both old timers, ranch return contains only its new greeting content,
  and system recall retains no pre-recall content. The original face-only
  oracle missed that hidden timer. The complete prop suite, syntax checks,
  600-frame simulation, and deterministic 1,200-frame fuzz are green with
  zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `2F704CA89378EC6A228218396FF9332AAAA621B09D610AD8196FF9C5E91BEF04`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `9BCE0A983070A2A4480A650938A3EAEC46D89789582C5EA9E226B9D923621F8F`
  (2,262,651 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 241 (autonomous loop - reset pending double-click tap)
- Fixed a pending first tap surviving HOME or global recall. A tap made just
  before leaving could remain inside the `350ms` double-click window, so the
  first tap after a fresh entrance launched an unintended excited hop.
- HOME and `recall()` now clear only `lastClickT`, the unfinished click-pair
  anchor. Normal uninterrupted double-click hops and all completed tap
  reactions remain unchanged.
- The regression sends a real pointer-down/up tap through the production
  click path, confirms the first-tap window is armed, then performs ranch
  send/bring or system recall before another real tap. Both paths launched
  the double-click flight before the fix; now each records a fresh first tap
  while staying grounded. The complete prop suite, syntax checks, 600-frame
  simulation, and deterministic 1,200-frame fuzz are green with zero crashes
  or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `964E038DF1BA09521898998D5307CDA1210EAA77BEAC3FE8D8112A20E5DF0738`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `AC825ABE481B85396CA733EE8E54557166536718C1A77C16F1D73BBE5F0F5434`
  (2,262,598 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 240 (autonomous loop - reset partial belly-poke combo)
- Fixed an interrupted belly-poke combo surviving HOME or global recall. Two
  real pokes could leave the short combo at `2`, so the first poke after a
  fresh entrance was misread as the third and produced a phantom `HEY!` plus
  the long annoyed reaction.
- HOME and `recall()` now clear both `pokeStreak` and its `pokeLast` time
  anchor. Normal uninterrupted three-poke protests and the reactions already
  earned from them remain unchanged.
- The regression sends real pointer-down/up pairs through the production
  belly-poke branch, verifies two pokes only pout, then performs ranch
  send/bring or system recall before one fresh poke. Both paths produced
  `HEY!` before the fix; now each starts at streak `1` with only its own pout.
  The complete prop suite, syntax checks, 600-frame simulation, and
  deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The first full gate saw one non-reproducing `_socsim.cjs` failure while all
  other 31 steps passed. The social simulation then passed three direct runs,
  the integrated 130/130 verifier, and a further 20/20-run stress sequence;
  the unchanged build's rerun finished **32/32 heartbeat GREEN**.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked. Release exe SHA-256
  `13473E7424895B8DB63B06B7389CE688DBA45BDE80E5F8ABEC353FEC36B1CA45`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `212EF8492E9A100D8F37C7A184FE804C0212FDF2B89AB67472EB6175CE91ED16`
  (2,262,653 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 239 (autonomous loop - reset partial cursor notice)
- Fixed interrupted close-cursor notice time surviving HOME or global recall.
  A pet could watch a still nearby cursor for about `1.05s`, leave the
  desktop, then inherit that hidden progress and fire its `1.1s` notice
  reaction after only `0.1s` of fresh hovering.
- HOME and `recall()` now clear the unfinished `noticeT` accumulator. The
  cooldown from a notice that already completed remains intact, so parking
  cannot be used to spam the ambient reaction.
- The regression drives 21 capped 50ms frames through the production notice
  branch, proves the reaction has not fired, then performs ranch send/bring
  or system recall and adds two fresh frames. Both paths advanced `noticeCd`
  before the fix; now each restarts at about `0.1s` without a reaction. The
  complete prop suite, syntax checks, 600-frame simulation, and deterministic
  1,200-frame fuzz are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `CDC50F0A584272DD9C6BBD3BDC18F2EFDFD0B76BEFAA236204CA49A05CDF77D7`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `30677A5238B026195411F922BC647218AB32C666C150443A605EDD6B6DF6AFF1`
  (2,262,625 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 238 (autonomous loop - reset partial cursor pressure)
- Fixed interrupted slow cursor pressure surviving HOME or global recall. A
  pet could be pressed for about `1.15s`, leave the desktop, then inherit that
  hidden progress and perform the `1.2s` personal-space pout-hop after only
  `0.1s` of fresh contact.
- HOME and `recall()` now clear the unfinished `boopT` pressure accumulator.
  Normal uninterrupted pressure, the resulting reaction, and all unrelated
  cursor cooldowns remain unchanged.
- The regression drives 23 capped 50ms frames through the production
  pressure branch, proves the pet is still below the shove threshold, then
  performs ranch send/bring or system recall and adds two fresh frames. Both
  paths produced the phantom pout and `!` before the fix; now each restarts at
  about `0.1s` with no reaction. The complete prop suite, syntax checks,
  600-frame simulation, and deterministic 1,200-frame fuzz are green with
  zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `4C4790AD8561E681A0D0B7272E37B1A7E735F716B41578C622070097A5C5EDA4`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `725935034DD8608F21E2CF50034F546A92804E7569202A1A7BC8172DBA14FE8E`
  (2,262,597 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 237 (autonomous loop - reset partial cursor-circle progress)
- Fixed an interrupted cursor-circle trick surviving HOME or global recall.
  Five real angular steps could leave the spin score at about `5.0`, just
  below the `5.2` threshold, so one fresh cursor move after returning could
  join the old near-loop and trigger a phantom `WHEE!`, spin, and dizziness.
- HOME and `recall()` now clear both `circScore` and its last-angle anchor
  `circAng`. The completed-trick cooldown remains intact, while a later fresh
  circle still accumulates normally from its own first angle.
- The regression drives six cursor positions through the production circle
  detector, proves the real score stops below threshold with no reaction,
  then performs ranch send/bring or system recall and adds the formerly
  completing wrapped step. Both paths produced `WHEE!` before the fix and now
  seed a clean angle with zero score. The complete prop suite, syntax checks,
  600-frame simulation, and deterministic 1,200-frame fuzz are green with
  zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `549771597A1557BD6A2A3EB420B45314161403AF186688A7DEB08EA1BF50ADC5`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `9AB27B987EF4997CC4384C80B96E79BC5989C963D27E572B36D1029C5F226AC0`
  (2,262,646 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 236 (autonomous loop - reset partial cursor prey drive)
- Fixed partial cursor-hunt prey drive surviving HOME or global recall. A bold
  pet could accumulate about `0.32` of the `0.35` stalk threshold, leave the
  desktop, then begin stalking after only one fresh cursor swish.
- HOME and `recall()` now clear `huntScore` with the active stalk/pounce state.
  The hunt cooldown, successful completed hunts, personality scaling, and later
  fresh accumulation remain unchanged.
- The regression drives four 50ms frames through the real bold-personality
  hunt branch, proves the score is below threshold with no stalk, performs
  ranch send/bring or system recall, then drives one new frame. Both paths
  immediately entered `STALKING` before the fix; now each restarts near `0.08`
  with no stalk. The complete prop suite, syntax checks, 600-frame simulation,
  and deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `C91987F03A481074662ADFA4393C77AD77E5A45F67F16A4B46FD09C594E6476B`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `66E8F2ED211D3F42F449E7F3A514663F8C2BF5D2B6F7D2E16B60CD7F6BE50EC8`
  (2,262,588 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 235 (autonomous loop - cancel airborne cursor hunts on recall)
- Fixed an already-launched cursor-hunt pounce surviving global recall. Recall
  teleported the pet into its own fresh drop but retained `huntPounce`, so that
  landing could resolve the interrupted hunt as a phantom `GOTCHA`, heart, and
  smug reaction.
- `recall()` now cancels both the stalk clock and airborne pounce flag, matching
  the existing HOME boundary. Hunt cooldowns, successful uninterrupted hunts,
  and later new hunts remain unchanged.
- The regression arms a live airborne pounce, performs real system recall,
  places the recalled pet at its landing boundary, and advances the production
  collision resolver. That landing awarded `GOTCHA` and smug before the fix;
  now it lands as recall only, while the separate normal hunt-catch regression
  still succeeds. The complete prop suite, syntax checks, 600-frame
  simulation, and deterministic 1,200-frame fuzz are green with zero crashes
  or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `F9A14CB83D3110EA8334BA951C00FA4D8F42F4CC99E4BCE282AE34399A277D5A`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `8844018286857EC58DC87C5F37580CCF7C0D10C4FB6C3F23CBB104227F3A4390`
  (2,262,619 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 234 (autonomous loop - cancel stale furniture errands on fresh entrances)
- Fixed the arrival ritual for an interrupted furniture walk surviving HOME or
  global recall. Those paths cleared `walkTarget` but retained `walkGoal`, so a
  later unrelated stroll ending near the old target could consume bowl food,
  enter a cushion/box, or trigger another obsolete prop interaction.
- HOME and `recall()` now clear `walkGoal` atomically with the walk coordinate.
  Furniture, cooldowns, completed interactions, and later newly chosen errands
  remain unchanged.
- The regression seeds a pending bowl errand, interrupts it through ranch
  send/bring or system recall, then ends an unrelated walk at the old location
  through the production arrival branch. Before the fix both paths spent the
  stale ritual, reduced bowl stock from three to two, and started munching;
  now stock and reaction remain untouched. The complete prop suite, syntax
  checks, 600-frame simulation, and deterministic 1,200-frame fuzz are green
  with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `5BFBFFA71BC79D38438A92DA67BE6A9A0A5FF1F607DF410D50CDE81913823389`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `791B1FC48D082D9A3BDF9AECAACDC1E2149807DE69B72A64F2262A0132C5ACC8`
  (2,262,602 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 233 (autonomous loop - reset interrupted hop anticipation)
- Fixed the 120ms hop wind-up surviving HOME or global recall. If the old
  deadline expired while the pet was away, its next unrelated hop launched on
  the first frame instead of earning a fresh anticipation crouch.
- HOME and `recall()` now clear `hopWind` alongside `hopTarget`. Completed-hop
  motion, species hop profiles, and normal back-to-back hops are unchanged.
- The regression enters the real production anticipation branch, proves the
  first hop is grounded with a live wind-up, interrupts it through ranch
  send/bring or system recall, conditionally ages only a retained old clock,
  and starts a second hop. Both fresh entrances skipped the new crouch before
  the fix; now both remain grounded with a new wind-up. The complete prop
  suite, syntax checks, 600-frame simulation, and deterministic 1,200-frame
  fuzz are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `0B240562F73744CDA265928EAC7321180E0F511748F4FC3E96AC2CFDFCA19D76`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `5B626762EDDAC31CD5F37FACB0A8921F7AC095713284899FCB85E9AE7355CE61`
  (2,262,612 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 232 (autonomous loop - reset partial tickle wiggles on fresh entrances)
- Fixed an unfinished cursor-wiggle sequence surviving HOME or global recall.
  Four alternating pointer positions could retain two reversals; one movement
  after a fresh entrance then completed the old gesture and triggered a laugh.
- HOME and `recall()` now clear only the partial `wiggleBuf` history. The
  cooldown from a genuinely completed tickle remains intact, preserving the
  existing anti-spam behavior.
- The regression drives `[490, 510, 490, 510]` through the real `pointermove`
  handler, proves a four-sample buffer with two reversals and no tickle,
  performs ranch send/bring or system recall, then supplies one new movement.
  Both paths incorrectly triggered the pre-entrance gesture before the fix;
  now each starts with a one-sample buffer and no laugh. The complete prop
  suite, syntax check, 600-frame simulation, and deterministic 1,200-frame
  fuzz are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `47059CEDB5B742F82006510EFAD4456A985C226A18078318E551D856E315ADE9`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `1D3E1AAE27586971F202CC39094312DC69ED9D54D39B2D6E0F5A2B4CCCC9058E`
  (2,262,623 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 231 (autonomous loop - reset partial scritches on fresh entrances)
- Fixed an unfinished cursor-scritch reversal sequence surviving HOME or
  global recall. Two sweeps before parking could leave `rubCount=2`; after a
  fresh entrance, one short opposite sweep then completed the old gesture and
  triggered PAMPERED immediately.
- HOME and `recall()` now clear only the partial direction/count history. The
  cooldown from a genuinely completed scritch remains intact, preventing
  re-trigger spam as before.
- The regression drives two alternating cursor velocities through the real
  frame detector, proves the partial count is two, performs ranch send/bring or
  system recall, then supplies one new sweep. Both paths incorrectly completed
  the pre-entrance gesture before the fix; now each begins at count one with no
  pampered timer. The complete prop suite, syntax check, 600-frame simulation,
  and deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `B040076372D031E46AFC9EF8042DC9163C1B7870C6A45061F59A260F7D8A4F3C`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `FF1028F9739A4987BB6A1C0070F7B628E3CA36D3D28C983ED761D5D22E22EC89`
  (2,262,567 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 230 (autonomous loop - end interrupted cuddle sessions cleanly)
- Fixed a completed hold-cuddle remaining active after HOME or global recall.
  Both boundaries released the pet, but retained `cuddleUntil` and relied on a
  later frame to decay `cuddleT`; an immediate fresh grab could therefore
  inherit the prior session's held-only content face.
- HOME and `recall()` now zero both the held-still accumulator and active
  cuddle timer. The generic happiness/affection earned by the cuddle remains,
  and a later hold can start a new cuddle normally.
- The regression grabs the pet through real canvas `pointerdown`, primes only
  the elapsed hold accumulator, and lets the production frame cross the 1.2s
  threshold. It proves the heart and held content face before checking ranch
  send/bring and system recall. Both lifecycle assertions failed before the
  fix and now pass. The complete prop suite, syntax check, 600-frame
  simulation, and deterministic 1,200-frame fuzz are green with zero crashes
  or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `90D73A63C7BA923832C9BA8BACBED5FC669E7D4330DF744F2B7643D55C63B75F`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `2FA7609BE9230607451C6259E29ECE0BBC43A63AD3A002B45D8C7672DE58BE8C`
  (2,262,559 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 229 (autonomous loop - stop stale hunt smirks on fresh entrances)
- Fixed the smug face from a successful cursor hunt surviving HOME or global
  recall. Both boundaries already ended stalk/pounce state, but the attached
  `smugUntil` timer could replace the ranch greeting or reappear after recall's
  short shock.
- HOME and `recall()` now end the active smirk while preserving the hunt
  cooldown, affection, success effects, and future cursor hunts.
- The regression arms a live pounce immediately above the floor and advances
  production collision physics. The real landing resolver emits `GOTCHA`, ends
  the pounce, and creates the smug face before ranch send/bring and system
  recall are checked. Both lifecycle assertions failed before the fix and now
  pass. The complete prop suite, syntax check, 600-frame simulation, and
  deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `CC24C7596869432290290DD2A7B92129835A2479B3A56C22E0417DAEEB2859A5`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `BBDACF782E664585C5450F2CB00F52643A21D84908AA3A28F7358E0D85CDE340`
  (2,262,544 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 228 (autonomous loop - stop stale Bites bleps on fresh entrances)
- Fixed Bites' tongue-out face surviving HOME or global recall after its
  legendary idle flourish was interrupted. Those boundaries already ended the
  tail-chasing spin and chewing beat, but the attached `blepUntil` timer could
  replace the ranch greeting or reappear after recall's short shock.
- HOME and `recall()` now end the active blep alongside the flourish motion.
  The rare idle scheduler and all future Bites flourishes remain unchanged.
- The regression selects Bites, expires `legFlairT`, and advances the real
  production frame so the legendary scheduler itself starts the spin, chewing,
  and blep face. It then verifies ranch send/bring and system recall each end
  the complete reaction. Both lifecycle assertions failed before the fix and
  now pass. The complete prop suite, syntax check, 600-frame simulation, and
  deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `38BD29A2370DFFA99BB26330901CE2906542B15883217CA9740F4FADFAE8562F`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `A6930D2E889A8ADB6408329AC8B5E9E75E5F431DD9BDFBA7EB1ED7B9B60FE5F2`
  (2,262,480 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 227 (autonomous loop - stop stale boop winks on fresh entrances)
- Fixed the short wink from a desktop snoot BOOP or photo pose surviving HOME
  or global recall. The old `winkUntil` timer could replace the ranch return's
  fresh greeting, or remain hidden under recall's shock and reappear afterward.
- HOME and `recall()` now end the active wink while leaving the interaction's
  content reward, visuals, and future BOOP reactions intact.
- The regression taps the production canvas snoot hit-zone with real
  `pointerdown`/`pointerup` events and a deterministic reaction roll, proves
  that the BOOP text and `wink` face are live, then verifies ranch send/bring
  and system recall each discard that source. Both lifecycle assertions failed
  before the fix and now pass. The complete prop suite, syntax check,
  600-frame simulation, and deterministic 1,200-frame fuzz are green with zero
  crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `10A61EBF6803EC90E0B9B3347A972F684855A293C72749287EB89A937560402B`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `C64887EF70360C28365FF80F76249E6E6258AE0B414EF87B274726764F55B10A`
  (2,262,573 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 226 (autonomous loop - clear completed-treat reactions on fresh entrances)
- Fixed transient reactions from an already-consumed treat surviving a fresh
  entrance. HOME ended chewing but retained the XP-milestone star eyes, while
  global recall retained both `munchUntil` and `starUntil`; that could replace
  the ranch `HI!` face or make recall report EATING instead of STARTLED.
- HOME now clears the obsolete star timer, and `recall()` clears both chewing
  and star timers. Persistent rewards and intentional treat effects remain:
  XP/gems, chili speed, coffee wakefulness, and the anti-spam behavior are not
  reset.
- The regression places XP exactly one cookie reward below a real milestone,
  consumes the cookie through the production frame path, and proves the live
  EATING mood plus star face before checking ranch send/bring and system
  recall. The three direct lifecycle assertions failed before the fix (and
  contaminated two later face setups) and now all pass. Syntax, the complete
  prop suite, 600-frame simulation, and deterministic 1,200-frame fuzz are
  green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `E9F0D050BC07594B7217D05B69011F92AC840A994F5C57EA44F7E00A6ECAF516`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `BD3086BAD137C2253FCFED285763C2FD4DD34484AA3B11D474C9004BF6B19821`
  (2,262,494 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 225 (autonomous loop - stop stale pampered status on fresh entrances)
- Fixed a completed cursor scritch's short `PAMPERED` status surviving HOME or
  global recall. The stale `petUntil` timer outranked the ranch return's fresh
  content greeting and could reappear after recall's short startle expired.
- HOME and `recall()` now end only the active pampered timer while retaining the
  scritch cooldown, so a fresh entrance has the correct mood without allowing
  immediate cursor-sweep spam.
- The regression drives alternating cursor velocities through the production
  frame loop, proves three sweep directions create the real `PAMPERED` state,
  then verifies ranch send/bring and system recall each discard it. Both
  lifecycle assertions failed before the fix and now pass. The complete prop
  suite, syntax check, 600-frame simulation, and deterministic 1,200-frame fuzz
  are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `EC312E91EB2E0FBF1E45E1D85FA214B9B32CA77B7D8CA568D1D2C0450573C938`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `97F193342E9D8E17B24120D5FF2C2625415FA5B03EA44C97A8FA50C7227EAF2C`
  (2,262,490 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 224 (autonomous loop - stop stale tickle laughs on fresh entrances)
- Fixed an active cursor-tickle laugh surviving HOME or global recall. The old
  `tickleUntil` timer owned the main body face, so a ranch return could keep
  laughing through its fresh greeting or the laugh could reappear as soon as
  recall's short shock ended.
- HOME and `recall()` now end the active laugh while retaining the interaction
  cooldown, preventing stale animation without allowing immediate tickle spam.
- The regression sends alternating real canvas `pointermove` events across the
  visible body, exercising the production wiggle/reversal detector and proving
  the `laugh` face is live. It then verifies ranch send/bring and system recall
  each discard that source. Both lifecycle assertions failed before the fix
  and now pass. The complete prop suite, syntax check, 600-frame simulation,
  and deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `7C1D321157F7C5520ED9AC857B7C5C96D3EC9A3035A7EAF4AB98141AD98FD2C5`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `C56FE1C9B414978E9AFD57E76C5672DA4C103E9F73E9E3FDEB6094724407C2EF`
  (2,262,507 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 223 (autonomous loop - stop stale farewell tears on fresh entrances)
- Fixed a nearby companion's send-home farewell cry surviving the main pet's
  own HOME/return or a global recall. The old `cryUntil` timer directly owned
  the body face, so it could replace the ranch `HI!` expression immediately or
  reappear after system recall's fresh shock expired.
- HOME and `recall()` now clear the interrupted farewell timer. Sending another
  nearby companion home later still creates the intended new teary reaction.
- The regression places a live companion beside the main pet, calls production
  `sendPalHome()`, proves the companion is removed and the main body enters its
  real `cry` face, then verifies ranch send/bring and system recall each discard
  that stale source. Both lifecycle assertions failed before the fix and now
  pass. The complete prop suite, syntax check, 600-frame simulation, and
  deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `48969E2A59AE34783DB8409BD60D30016038C9C6302787C22AE18D3E01DF0749`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `681F0ABBCDE0D19D0BC0CC47A0D5BE64594774DE936AD90B44AA30BC4DCCAE73`
  (2,262,495 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 222 (autonomous loop - clear stale accident pouts on fresh entrances)
- Fixed the longer `poutUntil` tail of a vanished-platform accident surviving
  HOME or global recall after the associated fall/dizzy metadata was reset.
  The old pout could immediately replace the ranch `HI!` body face, or reappear
  after system recall's short fresh shock expired.
- HOME and `recall()` now clear the obsolete pout alongside their collision
  resets. New pouts from later empty props, cursor pokes, missed hunts, or new
  platform accidents still begin normally.
- The regression grounds the pet on a real window platform, removes that
  platform through the production event, and lands the marked fall through
  live physics. It proves the resulting dizzy+pout state, then verifies ranch
  send/bring and system recall each discard the source pout. Both assertions
  failed before the fix and now pass. The complete prop suite, syntax check,
  600-frame simulation, and deterministic 1,200-frame fuzz are green with zero
  crashes or invariant violations.
- The first final heartbeat reported a one-off `_fresh.cjs` child failure in
  the behavior step; direct behavior rerun passed 130/130, standalone fresh
  passed 19/19, and **20/20 repeated behavior gates** stayed green. A complete
  rerun then finished **32/32 heartbeat GREEN**, so no persistent regression
  remained.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked. Release exe SHA-256
  `271362502D9208C29A756E5C11381836A876A51D9BCA6C0757D4CED76F4CBD4E`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `D820D2D9FA51A2AB650DE4AF58EEC6FF86931C608353A1A7D8A2766CCA5030F9`
  (2,262,500 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 221 (autonomous loop - separate stale impact anger from fresh recall mood)
- Fixed the long `ANNOYED` tail of a >800px/s landing surviving HOME and
  global recall after its shorter dizzy/splat reaction was cleared. The stale
  timer outranked the ranch greeting and recall's new shock in the status card,
  and made a ranch return render a grumpy body instead of its fresh entrance.
- HOME now clears the old annoyance. Recall clears it immediately before
  `touch()`, allowing the contact model to award a genuinely new grumpy
  greeting when the user really has been absent for 20+ minutes. Its deliberate
  fresh shock is otherwise visible as before.
- The regression drives a real >800px/s floor impact through production flight
  physics, proves the resulting dizzy body and `ANNOYED` card, then verifies
  both ranch send/bring and system recall discard that physical grievance. A
  separate long-absence setup proves recall still earns the designed new
  `ANNOYED` state. The two stale-lifecycle assertions failed before the fix;
  all three now pass. The complete prop suite, syntax check, 600-frame
  simulation, and deterministic 1,200-frame fuzz are green with zero crashes
  or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `2A339620995562D33B06277212374B63B694D859270C41E0E2479327841B0DB2`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `9CA0AC4D3BA743A35C236379CB89CBD3148070D9554F2EE2082332B07B2684E9`
  (2,262,489 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 220 (autonomous loop - clear collision dizziness on fresh entrances)
- Fixed a recent high-speed collision leaking its `DIZZY` presentation through
  HOME or system recall. Both paths moved the pet into a fresh airborne entry,
  but the old `splatUntil`/`dizzyUntil` clocks still outranked the ranch `HI!`
  greeting and recall's intentional short startled face in both body rendering
  and the status card.
- HOME and global `recall()` now clear the paired collision clocks. System
  recall still applies its own new 350ms shock after the reset, so its summon
  feedback is preserved instead of being masked by the old crash.
- The regression launches the pet into a screen wall above the 550px/s impact
  threshold and drives the production flight physics, proving that both splat
  and dizzy clocks plus body/card faces are active. It then verifies ranch
  send/bring returns clean and system recall shows `shock`/`STARTLED`. The two
  lifecycle assertions failed before the fix and now pass. The complete prop
  suite, syntax check, 600-frame simulation, and deterministic 1,200-frame
  fuzz are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `B1AF42689D8E91821D8220497A7639F71BF023B6D57383F6947C50C6175B0136`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `A68F851ABFDC2088E8B2B859AD14FBCE75DE236235F7E2C05F0E3C3A6E4B24FD`
  (2,262,506 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 219 (autonomous loop - cancel airborne treats at HOME)
- Fixed an aimed treat continuing to fly, render, run physics, and ring the
  companions' dinner bell after the main pet was sent HOME. HOME already
  removed landed treats and closed the aiming crosshair, but omitted the
  in-flight object, contradicting its quiet-desktop contract and keeping the
  deep-idle throttle disabled until the projectile landed or fell away.
- `sendPetHome()` now clears both `treatFly` and its rising-edge broadcast
  latch. Landed treats, signature snacks, and the aiming mode retain their
  existing cleanup, while ordinary throws still use the same ballistic path.
- The regression arms aiming, dispatches the real canvas pointer event, proves
  the treat is airborne and drawn, then requires production HOME to remove it
  before another frame can render or land it. The lifecycle assertion failed
  before the fix and now passes. A pre-existing blanket regression could roll
  a legitimate new rare tuck-in during its assertion; its setup now suppresses
  only that fresh roll, and the complete prop suite passed **30/30 repeated
  runs**. Syntax, the 600-frame simulation, and deterministic 1,200-frame fuzz
  are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `27F962C468B6E4DF9703455428B277BAC2E02D2EF5402E675C3419E2D79AF9CF`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `220DEB0E1A225061FCCDA30F76C3971AEE514C8363F114E0EBDD26B810776D8E`
  (2,262,517 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 218 (autonomous loop - stop stale attention seeking on fresh entrances)
- Fixed an old attention-seeking `NEEDY` window surviving HOME or system
  recall. The original behavior starts a four-second `begUntil` timer; sending
  the pet home cleared its walk target but left that source timer alive, so the
  freshly returned pet could become needy again after its short greeting.
- HOME and global `recall()` now clear `begUntil` together with their other
  interrupted-action clocks. Ordinary attention seeking can still start again
  after the pet has returned and resumed normal idle behavior.
- The regression drives the real attention-seek branch with deterministic
  randomness, proves both its timer and cursor-directed target are active, then
  verifies production ranch send/bring and system recall each keep the obsolete
  needy window stopped. Both assertions failed before the fix and now pass. The
  complete prop suite, syntax check, 600-frame simulation, and deterministic
  1,200-frame fuzz are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `490A6B5A5660525837FA97EFA0D9593D439A3AA2E3F8BF0B7C18588AF0348FA7`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `A915CC637CAACCBC2B8DA69354254023824EAEBDEC677F1882A4C04F9412AE83`
  (2,262,488 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 217 (autonomous loop - stop stale yawns on fresh entrances)
- Fixed a lazy idle yawn resuming after HOME or system recall. The yawn owns a
  source clock (`yawnT`) that refreshes `stretchUntil` every frame, so clearing
  only the visible deformation could not stop the old action from stretching
  the freshly returned pet again.
- HOME now clears both yawn and stretch clocks. The global `recall()` path also
  clears `yawnT` beside its existing stretch reset. New yawns can still begin
  normally after the pet lands and becomes idle again.
- The regression configures a low-energy grounded pet and drives the real lazy
  fidget branch with deterministic randomness, proving both clocks are live.
  It then verifies production ranch send/bring and system recall each keep the
  yawn and stretch stopped on the next frame. Both failed before the fix and
  now pass. The complete prop suite, syntax check, 600-frame simulation, and
  deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `4986285CEC5360E0BF9705397D2DD34788144FE8D6E7275BE6A6A4EDADEF52D8`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `31C2D8D1A6AA5F6923CB6B0A74468CC30D7AD6C132D4E24F4300BD47310FAFB7`
  (2,262,496 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 216 (autonomous loop - reset interrupted-fall metadata)
- Fixed fresh airborne entrances inheriting impact metadata from an interrupted
  fall. A vanished window marks `startleFall` and accumulates `landPeak`; HOME
  or summon could relocate the pet without clearing both values, making the
  new landing dazed and adding the prior fall's extra heavy-impact ring.
- HOME now clears both accident metadata fields, and the global `recall()`
  path clears `landPeak` alongside its existing startle reset. Normal return
  gravity, the standard single landing ripple, and the summon path's deliberate
  short shock feedback remain intact.
- Driven regressions ground the pet on a real window platform, remove that
  platform through the production event, accumulate a >520 impact peak through
  live flight physics, then verify both ranch send/bring and system recall start
  clean. The ranch case also lands and requires no dizziness or extra impact
  ring. Both failed before the fix and now pass. The complete prop suite,
  syntax check, 600-frame simulation, and deterministic 1,200-frame fuzz are
  green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `04B8154FCFC87D69A72C6E8E156F5299AA34F9D51B603A95A14923EEEFF676B5`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `AF0CF98F15903366AFCEB3A618B275FE68E42EF488E64249D3D25EE69FE4A19B`
  (2,262,483 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 215 (autonomous loop - clear stale startle on ranch return)
- Fixed a pre-HOME startled face overriding the ranch cell's fresh `HI!`
  entrance. Clipboard reactions set a short `shockUntil`; a fast HOME/recall
  round trip kept that timer, so the returning pet appeared `STARTLED` instead
  of the cheerful presentation that `bringPetHome()` creates.
- Sending the main pet home now clears the old shock timer. The separate system
  `recall()` path still adds its intentional new 350ms shock after bringing the
  pet back, so summon feedback is preserved.
- The regression invokes the production clipboard reaction, proves it enters
  `STARTLED`, executes production send/bring transitions, advances the fresh
  airborne frame, and requires the stale face to be gone. It failed before the
  fix and now passes. The complete prop suite, syntax check, 600-frame
  simulation, and deterministic 1,200-frame fuzz are green with zero crashes
  or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `C0F11161675BEB26C0343EF9708A1805F0F054A16AEC9BCA13B94FB2A8FDE62E`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `864D9FFDABAFAA5AEC0E80792F219953D846016E6C247F73CFD1F86AB34A01E0`
  (2,262,460 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 214 (autonomous loop - clear stale chewing on home return)
- Fixed the main pet returning with an `EATING` face after its food lifecycle
  had already ended. Treat consumption removes the item and keeps a short
  chewing timer; a fast HOME/recall round trip cleared the food but retained
  that timer, so the fresh entrance visibly chewed nothing.
- Sending the main pet home now clears `munchUntil` together with its landed
  treat and temporary chomp snack. Earned XP, bond, buffs, and independent
  scene state remain unchanged.
- The regression uses the real treat-consumption branch to enter `EATING`,
  executes production send/bring transitions, advances the returned airborne
  frame, and requires the chewing mood to be gone. It failed before the fix
  and now passes. The complete prop suite, syntax check, 600-frame simulation,
  and deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `D64993833E72693FDAF5925C9F6C2AA0B37B5D365CE0758F6350AD9EF9D23183`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `EFB47ADE0CF591AD5EB0F6196AD31DFE773A35ADE406DC5D4062AA9D0A671028`
  (2,262,476 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 213 (autonomous loop - cancel stale body spins at home)
- Fixed a short main-pet twirl surviving a HOME round trip. A double-click or
  legendary idle flourish could start the 620ms body spin; sending the pet
  home and immediately recalling it then overlaid the old rotation on the
  fresh airborne entrance.
- Sending the main pet home now clears `spinT0` alongside its other active
  body actions. Companion animation and independent scene state are unchanged.
- The driven regression arms the real spin timer, executes production
  send/bring transitions, advances the returned airborne frame, and requires
  the old rotation to remain cancelled. It failed before the fix and now
  passes. The complete prop suite, syntax check, 600-frame simulation, and
  deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `979BCF49FD4931F59875C945CAA7FBFFDC7B340C778579AF49AF65C11D3179E4`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `016D118ED7CA2EC73F1F2FDC8A2D248D48DC932B1C4B5FB60D6EC8D2BB97746C`
  (2,262,491 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 212 (autonomous loop - cancel stale blanket approaches at home)
- Fixed an unfinished cursor tuck-in errand surviving the main pet's HOME
  lifecycle. While parked, the approach was only paused; after recall, landing
  near the same idle cursor could complete the obsolete job and unexpectedly
  spawn a blanket, heart, and `TUCKED IN` message.
- Sending the main pet home now clears only the in-progress `blanketT0`
  approach. A blanket that was already placed keeps its normal visible window
  and cooldown, so independent scene history is not removed.
- The driven regression arms a real blanket approach, executes production
  send/bring transitions, simulates the returned landing at the idle cursor,
  advances a frame, and verifies that no blanket, heart, or tuck-in text is
  resumed. It failed before the fix and now passes. The complete prop suite,
  syntax check, 600-frame simulation, and deterministic 1,200-frame fuzz are
  green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `0DA372BB356C5D1F96ABE03F67702B8F11DCA5D6D61A863EBFD089A4449B16B6`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `2D79E84E101ECFEEC5F5D7F042BB07F99896B5FD50526D8934CC3D31644AA3CC`
  (2,262,454 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 211 (autonomous loop - silence parked pomodoro cheers)
- Fixed Pomodoro focus cheers continuing at the main pet's stale desktop
  coordinates after it was parked in the ranch. The timer and focus statistic
  correctly kept running, but each due cheer still spawned a heart and
  sometimes `GO!`, periodically waking the otherwise quiet home scene.
- The focus-cheer emitter now requires the main pet to be on the desktop.
  Pomodoro timing, phase progression, focus-second accrual, and the already
  hidden countdown ring remain unchanged.
- The driven regression arms a due focus cheer, sends the main pet home through
  the production lifecycle function, forces the optional `GO!` branch, and
  verifies that neither hearts nor cheer text increase while focus remains
  active. It failed before the fix and now passes. The complete prop suite,
  syntax check, 600-frame simulation, and deterministic 1,200-frame fuzz are
  green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `BBBDAC83699EA107F0083DF5F18B8D1B334F1026F6FD27796192E0838EF7807A`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `63A356691DC4042EB376E50F7A0039D01D65D5AAD9D9E9473FDE40063C24BF20`
  (2,262,458 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 210 (autonomous loop - close treat aiming when sent home)
- Fixed the snack-throw aiming mode remaining active after the main pet was
  parked through its status card. The hidden pet left the desktop crosshair
  visible and kept the home deep-idle throttle disabled until the player
  cancelled the mode separately.
- `sendPetHome()` now closes only the uncommitted `treatAim` interaction.
  Already-thrown treats and independent companion/furniture activity remain
  untouched.
- The regression arms the real aiming state, tracks the exact crosshair sprite
  draw, invokes the production home function, advances a frame, and requires
  both the mode and its visible crosshair to be gone. It failed before the fix
  and now passes. The complete prop suite, syntax check, 600-frame simulation,
  and deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `51D6AAC5B7314318F558BB8DB58183B9E20DA1BB60352CAE536005360D4AB2A0`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `4766B786675D172DC52AA5065EC7E3316E7ADA25249C28DCF27C0BB25BD01194`
  (2,262,451 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 209 (autonomous loop - remove orphaned chomp snacks at home)
- Fixed Bites' temporary file/folder snack remaining on the desktop after the
  main pet was parked through its status card. The normal grab path clears the
  snack, but direct `sendPetHome()` did not, leaving the pet-only chase object
  visible for up to nine seconds and preventing the home deep-idle throttle.
- Sending the main pet home now clears `snack` beside the ordinary landed
  treat. Independent furniture, balls, eggs, and companion activity remain
  untouched; only the temporary object owned by the departing main-pet act is
  removed.
- The regression forces the real Bites wander branch on a roomy support,
  verifies the generated snack's body-aware placement, then invokes the
  production home function and asserts the snack is gone immediately. It
  failed before the fix and now passes. The full prop suite, syntax check,
  600-frame simulation, and deterministic 1,200-frame fuzz are green with
  zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `08DA077E2DC335AB35936C9AC18DFC2EC397751EEBA11ACBAA976AF47175C416`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `461AA9D6C8BF362F201DE7A6063DC81C6FA3AAB357445865009B587475B9B9F8`
  (2,262,423 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 208 (autonomous loop - clear prop-rest states on recall)
- Fixed ranch recall being overridden by retained furniture rest states. A
  status-card HOME action can park a pet without the normal grab path that
  wakes cushion naps and box hides. `bringPetHome()` then launched the pet but
  left those timers live: a cushion return kept its sleeping presentation,
  while a box return was snapped back to the box and hidden on the next frame.
- Recall now clears `cushionNap`, its wall-clock twin, `sitUntil`, and
  `boxHide` before positioning the fresh airborne entrance. Furniture and its
  cooldowns remain untouched; only the old pet occupancy is ended.
- Driven regressions arm each real prop-park state, perform production
  send/bring transitions, and inspect the fresh return. The cushion case
  failed on all retained timers; the box case additionally advanced a frame
  and proved the old code cancelled flight by pulling the pet back inside.
  Both now pass. The complete prop suite, syntax check, 600-frame simulation,
  and deterministic 1,200-frame fuzz are green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `30808FE8BEE6B2B9CD005A89F60F575351652189E703A0E6D2F0D24A8A3297AC`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `38DA275F86B4A7928EAB298BD688F63CCD30AF7A6A5B7B331CEB1EDE13732AC7`
  (2,262,440 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 207 (autonomous loop - hide treat-buff visuals at home)
- Fixed active chili and coffee buffs rendering at the main pet's stale
  desktop position while it was parked. Buff timers intentionally keep
  counting down, but the chili flame emitter and both floating treat icons
  sat outside the main body's `petHome` visibility boundary.
- Body-bound buff output now requires `!petHome`: chili no longer creates
  hidden-position flame particles, and neither chili nor coffee draws its
  floating icon until the pet is recalled. Buff duration and gameplay effects
  remain untouched, so an unexpired buff resumes normally with the body.
- The canvas harness now tracks `drawImage` calls for one exact cached sprite
  object. Driven tests arm each real buff, park the pet, advance rendered
  frames, and verify both the chili particle count and the exact chili/coffee
  icon calls stay at zero. Both checks failed before the fix and now pass. The
  complete prop suite, syntax check, 600-frame simulation, and deterministic
  1,200-frame fuzz are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `94C8052AB3181C3248E09AA88CDBEEA49E987AA05CA0F8D969B22DB7AAD0497E`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `0051B95D895A3B41D841CBBFA03AD71049D9CC88EF8D7B7831249EAFC4511C39`
  (2,262,346 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 206 (autonomous loop - hide main-pet sleep ambience at home)
- Fixed sleep ambience remaining on the desktop after the main pet was parked
  in its ranch cell. Body rendering already respected `petHome`, but the
  ordinary sleeping bubble/ZZZ block and the separate cushion-nap ZZZ block
  did not. Both could therefore animate at the invisible pet's stale position.
- Main-pet sleep ambience now requires `!petHome` in both paths. Companion
  nap ZZZs remain independent and visible, and ordinary/cushion sleep behaves
  exactly as before whenever the main pet is actually on the desktop.
- Two driven regressions park the pet, force each sleep source with its ZZZ
  cadence ready, and advance real frames. Both failed before the fix by
  appending a new desktop ZZZ and now preserve the particle count. The full
  prop suite, syntax check, 600-frame simulation, and deterministic
  1,200-frame fuzz are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `86B33F05408B7A83B848A63DE4C76BFC64173688FEA8ACD83027DF52DFFDB9A9`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `575E92A058FE9B67C579397F2256586D246E46E800A881CF4B19C64AD2F3752A`
  (2,262,360 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 205 (autonomous loop - silence hidden sleep reactions at home)
- Fixed a parked sleeping pet reacting to the cursor at its stale desktop
  coordinates. Most cursor behavior is gated by `onGround`, which excludes
  `petHome`, but the sleep-stir proximity branch sat outside that guard. A
  cursor near the invisible old body could therefore wake it and emit visible
  `!?` text even though sending it home promises a quiet desktop.
- Sleep-stir proximity now also requires `!petHome`. The ranch cell retains
  its sleeping state without exposing a hidden desktop reaction area, while
  the existing visible-pet stir and close-range wake behavior is unchanged.
- The driven regression puts the cursor exactly at the sleeping pet's body
  center, parks it through the production home function, and advances a real
  frame. It failed before the fix because the mood changed and a bang was
  appended; it now proves both state and reaction count remain unchanged. The
  full prop suite, syntax check, 600-frame simulation, and deterministic
  1,200-frame fuzz are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `B6494C3D032CE727832949234228B729ED2B96671FA0F8D80D27BAF7C69B6A3E`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `FDB6439A76BEB96C4747A666355925053B19AFA1DA45F4F06FFB89133B917EAB`
  (2,262,416 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 204 (autonomous loop - wake the pet synchronously on recall)
- Fixed a sleeping expression leaking into the main pet's ranch recall. A pet
  parked while asleep retained `state = "sleeping"`; `bringPetHome()` refreshed
  `awakeAt`, launched the pet, and showed `HI!`, but relied on the one-second
  mood interval to change the state. Until that tick, the fresh airborne
  entrance visibly used the sleeping face instead of its content greeting.
- Bringing the pet home now sets the mood state to `idle` in the same
  synchronous lifecycle transition that clears parked status and initializes
  the return flight. The first rendered frame therefore agrees with the wake
  clock, greeting, and motion instead of repairing itself later.
- The driven regression arms the real main-pet mood as sleeping, runs the
  production send/bring functions back-to-back, and asserts that the return is
  simultaneously visible, airborne, and idle. It failed on the retained state
  before the fix and now passes. The complete prop suite, syntax check,
  600-frame simulation, and deterministic 1,200-frame fuzz are green with
  zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `205803DEE83955A0BDC314659BA1B91B1FBD567FFD0D26725F7C197C1DBBE8FD`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `BC1FBFD2DB9AB16DDAEF74B7709B63A1A02143AB21D66CD31A26F3DB70C1B92A`
  (2,262,355 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 203 (autonomous loop - release held silk at the home boundary)
- Fixed a dangling Webby grab surviving a main-pet HOME drop. The HOME-slot
  branch returns before the normal web-release branch; `sendPetHome()` cleared
  `held` and `webbing` but left `webHeld` true. After recall, the next ordinary
  click was therefore consumed as a tap on a silk line that no longer existed.
- Parking the pet now clears `webHeld` together with `webbing`, so the HOME
  transition owns the complete silk lifecycle instead of relying on code that
  the transition deliberately skips.
- The driven regression uses the real pointer path: it starts a dangling web,
  grabs the body, performs a deliberately gentle five-second drag into the
  top HOME strip, and releases there. The lifecycle assertion failed before
  the fix and now proves the pet is parked with both silk flags cleared, the
  cursor restored, and native dragging disabled. The full prop suite, syntax
  check, 600-frame simulation, and deterministic 1,200-frame fuzz are green
  with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `A4CBE40D6C976E24CD9135460838BD8B165FD9920316E15D09E34DAD05802554`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `3CF4F6573F01C0135800A113DF141ADDD99CF66A7BCA8569DFF85A2A07D9A3F8`
  (2,262,352 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 202 (autonomous loop - clear accessory acts across the home lifecycle)
- Fixed an accessory routine surviving a rapid main-pet ranch round trip.
  The regular frame loop cancels an act while `petHome` is true, but a player
  could send and bring the pet back between two frames. In that sequence a
  propeller `flyby` retained its old target and steering, then overrode the
  fresh return velocity and pulled the pet upward toward the pre-home route.
- Sending the main pet home now clears `accAct` and `propSpin` immediately.
  Bringing it back defensively performs the same reset, making both public
  lifecycle entry points safe even if either is called from a future path
  that did not first park the pet.
- The driven regression starts the real flyby, performs the production
  send/bring sequence without an intervening frame, and advances the fresh
  airborne return. It failed before the fix because stale steering moved the
  pet upward, and now proves normal gravity moves it downward. The complete
  prop suite, syntax check, 600-frame simulation, and deterministic
  1,200-frame fuzz are green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `7BAE7661A8AEF56E34FE65D64A3A66EED4B0F904F3B48F90913C94C606C49AA9`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `E99F5B58A35EA02EB7D981C4D683145266749284FADDF55B0C12640643327370`
  (2,262,366 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 201 (autonomous loop - clear climbs across the home lifecycle)
- Fixed an unfinished Cliff climb surviving the main pet's ranch lifecycle.
  `sendPetHome()` stopped an active `climbing` animation but left the approach
  state (`climbPhase` and `climbEdge`) intact, and `bringPetHome()` did not
  normalize it. A quick park/return could therefore land on a wall-connected
  floor and immediately resume the old pre-home climb target.
- Sending the main pet home now clears the approach phase and target together
  with active climbing. Bringing it back defensively performs the same reset
  before placing the pet at its fresh airborne entrance, so both the hidden
  ranch state and return flight have an explicit, clean motion boundary.
- Driven tests start the real right-wall Cliff approach, call the production
  send and bring functions, and inspect both lifecycle states. Both checks
  failed on the old retained phase and now prove the parked pet has no climb
  target and the return begins airborne with no climb continuation. All prior
  climb/platform cases, the full prop suite, syntax check, 600-frame
  simulation, and deterministic 1,200-frame fuzz remained green with zero
  crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `C04A014C37212E146ED99854304DE4788306278614C17290A7DD02CE1FCE7BAD`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `EA0C6A1E303295ED0E826DCC167885353EED6B637445D9F0094687A67309A087`
  (2,262,428 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 200 (autonomous loop - cancel stale climb approaches)
- Closed the dynamic half of Cliff's screen-wall climb fix. Session 199
  prevented a detached platform from starting an approach, but an already
  active `climbPhase` did not revalidate its support. If the window moved or
  resized away from the wall during that approach, Cliff retained the old wall
  target and could resume gravity-free travel from the newly detached top.
- Left/right wall connectivity is now computed from the live support on every
  grounded approach frame. If the stored target wall is no longer connected,
  `climbPhase` and `climbEdge` are cleared before any approach displacement.
  The existing window-surf behavior remains intact: in the driven resize case
  the pet rides the platform from x=150 to x=250, but adds no stale wallward
  movement after that platform becomes detached.
- The new churn regression starts a real left-wall climb, moves the supporting
  platform 100px into the desktop, and proves the approach cancels at the
  surf-adjusted coordinate. It failed on the old retained phase and now passes
  alongside the three start/side-selection climb cases. The full prop suite,
  syntax check, 600-frame simulation, and deterministic 1,200-frame fuzz
  remained green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `495E7621128D6A9221F2F59EA02917E020B3673FA064E90AC860D15FF66FA345`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `9C92614835678E2B0B8AF0B8B74E095D1B68EE7DB4B4858907029266817DD611`
  (2,262,400 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 199 (autonomous loop - start climbs only from connected walls)
- Fixed Cliff beginning a screen-wall climb from detached window platforms.
  The approach phase deliberately ignores gravity, but its target was always a
  fixed screen coordinate (24 or `winW - 24`) regardless of the current
  support. From a central window top, Cliff could therefore glide unsupported
  across the desktop until it reached a distant screen wall.
- A climb roll now requires the current support to meet the left or right wall
  within the pet's body edge. A support connected to one wall uses that wall;
  a full-width floor chooses the nearer side. The target center also uses the
  current species/size-aware `petEdge` instead of the fixed 24px coordinate, so
  the body remains aligned with the wall at every supported scale. Detached
  platforms fall through to the existing generic flourish for that roll.
- Deterministic driven tests force the real Cliff wander branch. The detached
  central-platform case failed on the old `climbPhase=1` behavior and now stays
  grounded; connected-left and full-width/right cases prove intended climbs
  remain available and choose the correct body-aware wall. The full prop
  suite, syntax check, 600-frame simulation, and deterministic 1,200-frame
  fuzz remained green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `65955F56B1C7625EEF1AE31B849D49FDCE1D20805CA19A1AA81B4579CB7F63C4`
  (5,524,480 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `B3F82D4DE984EB8BDAE290757107D202113956B1C03C0EF8945034AF4C558C6C`
  (2,262,314 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 198 (autonomous loop - keep chomp snacks on their support)
- Fixed Bites creating its autonomous file/folder snack outside narrow
  platforms. The chomp branch applied an extra 30px inset as
  `max(lo + 30, min(hi - 30, target))`; when the support could not fit the
  pet plus both insets, those limits inverted and selected an off-deck point.
  The subsequent snack chase moves directly toward that point, so this could
  also pull the pet beyond its supported range.
- Chomp placement now delegates to `clampPlatformX` with the combined
  `petEdge + 30` footprint. Roomy decks retain the exact original inner
  margin, while impossible narrow cases balance the snack at the support
  center. This reuses the same no-allocation boundary authority as furniture,
  eggs, companions, treats, and settled main-pet landings.
- A deterministic driven test forces the real Bites wander/chomp branch with a
  fixed random source. It failed on the old narrow-deck placement and now
  proves a 50px platform produces x=25; a paired 300px case proves the normal
  body-plus-30px inset is unchanged. The full prop suite, syntax check,
  600-frame simulation, and deterministic 1,200-frame fuzz remained green
  with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `B5C8AE5D6571FAC0D9194EC1553D60A09BA00CF69218B081FA6005DAF3E46EDE`
  (5,523,968 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `234EE2E9603FBEC9843C9FC483DB31E525CCB9F6BAA92679C68B53C5400B242C`
  (2,262,173 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 197 (autonomous loop - settle main-pet landings on support)
- Fixed the main pet completing a landing while its body still hung outside a
  narrow platform. Airborne collision intentionally allowed 20px of horizontal
  overlap to make ledges catchable, but the settled path copied only the
  platform height. A pet landing at x=35 on a 0..20px deck therefore became
  grounded there instead of balancing at the only legal center, x=10.
- Landing detection now retains the actual highest support and clamps the
  center through the same `clampPlatformX`/`petEdge` authority used by grounded
  movement. If several overlapping platforms share that height, it chooses the
  candidate requiring the least horizontal correction, preventing a narrow
  earlier entry from pulling the pet away from a wider valid support. Strong
  impacts that bounce remain unsnapped until a landing truly settles.
- A driven frame regression failed on the old off-support x=35 result and now
  proves centering on a 20px platform. A second case proves overlapping
  same-height supports preserve x=35 when the wider one already supports the
  body. The full prop suite, syntax check, 600-frame simulation, and
  deterministic 1,200-frame fuzz remained green with zero crashes or invariant
  violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `5DE078152BA0D39BE2D560006122B41350BDB5C9C5907E250222731764B97731`
  (5,523,968 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `6769A41FDCC721EB8A94DABF466DEDCA2839A445823E236E5354DDACAA792E45`
  (2,262,073 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 196 (autonomous loop - make edge treats reachable)
- Fixed the main pet getting trapped in a permanent treat chase on narrow
  platforms. Its legal walking center could be only x=24..26 while an edge
  treat sat at x=49; the walking engine considered x=26 reached within its
  8px tolerance, but the separate 16px center-distance bite test could never
  succeed. The pet consequently reacquired the same impossible target every
  frame instead of eating it.
- Landed-treat pursuit now derives its target from the authoritative `lo/hi`
  body bounds. When the pet has reached the closest legal target, its physical
  body may reach a treat only on that exact support; ordinary 16px bites and
  the intentional walk-off behavior for lower-platform treats remain intact.
  A driven regression failed on the old stuck state and now proves the edge
  treat is eaten from a 50px deck. A paired negative case proves a treat on a
  neighboring same-height platform is not remotely consumed. The focused prop
  suite, syntax check, 600-frame simulation, and deterministic 1,200-frame
  fuzz all remained green with zero crashes or invariant violations.
- The isolated optimized candidate passed the unified pre-promotion policy
  gate **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `A13DAD19A7A3A938B5649ACE981CD031B75B722C5E11904268188DFF38476825`
  (5,523,968 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `5E2A145926EAFD7BC7C016EF853E37109F2705089F8197171C9B3E4FC5A03C34`
  (2,261,923 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent and registry `sv` remained the
  string `15`, with no Jellypal process, pulse lock, upload, or account action
  left behind.

## Last session 195 (autonomous loop - stabilize pals on narrow platforms)
- Fixed companions being unable to remain on a platform narrower than their
  rendered body. Ground AI built `plo = platform.x + palEdge` and
  `phi = platform.right - palEdge`; when `plo > phi`, even a perfectly centered
  pal was classified as outside the edge on its next frame and forced back into
  flight. The result was a repeated fall/land cycle instead of a balanced perch
  on narrow window tops.
- Companion ground bounds now collapse to the platform center when full support
  is impossible, without adding per-frame array allocations. Airborne landing
  clamps the body through the shared `clampPlatformX`, and Rex's court-gathering
  target uses that same rule instead of another inverted clamp. Driven tests
  prove both a pre-grounded pal and an off-center falling pal finish centered,
  live-anchored, and not flying on a 20px platform; the first case failed on the
  old code. All prior furniture, egg, drag, syntax, 600-frame simulation, and
  deterministic 1,200-frame fuzz checks remained clean.
- The isolated optimized candidate passed the unified pre-promotion policy gate
  **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `31F87A59730084009965E7C0A54F8489F488FDF07B7A817215DBD38ED7BB1DD7`
  (5,523,456 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `FABA7E8940320BD7CAC6955766D5BDE7E5B7520FF9F65D27085D30B2B7AED226`
  (2,261,722 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 194 (autonomous loop - kind-aware furniture spawn clamp)
- Closed the remaining narrow-platform gap in the toybox creation path.
  Existing furniture was centered correctly after load, drag/drop, resize,
  cancellation, and heartbeat repair, but `spawnProp()` still used a separate
  fixed 40px edge clamp before the new object had a kind. A newly placed box
  on a 50px window top therefore appeared at x=40 instead of the supported
  center x=25, then stayed there because its platform reference was already
  live and reconciliation correctly had no reason to replace it.
- `spawnProp(kind)` now receives the selected furniture kind and uses the same
  `clampPropX` authority for both its initial offset and any overlap-avoidance
  nudge. Each of the eight furniture types consequently uses its real footprint
  from the moment it leaves the toybox. A driven regression calling the actual
  creation function failed on the old x=40 result and now proves a live,
  centered box anchor; all prior prop/egg/drag checks, syntax, 600-frame soak,
  and deterministic 1,200-frame fuzz remained clean.
- The isolated optimized candidate passed the unified pre-promotion policy gate
  **6/6**, was promoted and repacked, and the final gate finished **32/32
  heartbeat GREEN**. Release exe SHA-256
  `F9857F4B7D198AD8C53FECD9EF36E9CF67668FF74741FBE2A797ACDDA0C7DFDD`
  (5,523,456 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `5DDDD866F3DD6618625B6BF1AA2B4412582FC304006F92F4CF61F1AC0BE5AA85`
  (2,261,714 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 193 (autonomous loop - center daily eggs on narrow decks)
- Fixed daily mystery eggs being pushed to the right side of undersized window
  platforms. Furniture already centered itself when a platform was narrower
  than its requested footprint, but egg creation still used a fixed 50px edge
  clamp and stale-platform repair used a separate fixed 40px clamp. On a 50px
  window top those paths produced x=50 and x=40 instead of the supported center
  x=25, leaving the egg visibly biased or mostly overhanging one side.
- Extracted `clampPlatformX` as the shared narrow-support rule. Furniture keeps
  its per-kind footprint, ordinary egg platforms retain their existing 50px
  spawn/40px repair margins, and only impossible narrow cases balance around
  the platform center. Two driven `_proptest.cjs` cases cover both initial egg
  spawn and periodic stale-anchor repair; both failed before the fix and pass
  now. Four additional deterministic fuzz seeds ran **24,000 frames** with zero
  crashes or invariant violations; focused prop, syntax, 600-frame soak, and
  standard 1,200-frame fuzz checks also stayed clean.
- The first full gate correctly stopped RED only because package freshness
  required the frontend change to be rebuilt. The isolated optimized candidate
  then passed the unified pre-promotion policy gate **6/6**, was promoted and
  repacked, and the final gate finished **32/32 heartbeat GREEN**. Release exe
  SHA-256 `100D562409E63E7E46881CA5B30962C501D655168CBBD225B1D00A99F5B221F6`
  (5,523,456 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `2B45C1A985EBF8EE623F193E5C37B9CD888566DF795CD3DCA66F7A4F62C5F251`
  (2,261,718 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 192 (autonomous loop - fail closed before candidate launch)
- Closed the release-candidate safety gap exposed in session 191. The new
  `_candidatepolicy.cjs` is the single pre-promotion entry point: it reads the
  candidate first and requires all six exact self-test flags and GREEN markers
  before launching any child. It then enforces exit 0, empty stderr, and stdout
  containing exactly one expected marker for input, network, save, photo, log,
  and migration policies. A typo or stale/partial binary therefore fails before
  it can fall through to the normal desktop app and touch the real profile.
- Added a 10/10 built-in gate test covering complete/missing preflight tokens,
  duplicate/noisy markers, stderr, nonzero exit, and spawn errors. A real
  fail-closed probe against `src/main.js` returned exit 2 with the explicit
  "candidate was not launched" result, zero Jellypal processes, and unchanged
  profile hashes. The isolated optimized candidate then passed all six policies
  through the new command: **CANDIDATE POLICY GREEN (6/6)**.
- HEARTBEAT now requires this command before release promotion, watches the new
  gate file, and runs its self-test as a permanent verification step. The full
  gate is now **32/32 heartbeat GREEN**. This tooling/protocol-only pulse did
  not rebuild or repack: release exe remains SHA-256
  `F26CE168F3561024FC806B3FD2C59573F10C672C39268A0EADBB85A8693BB4AD`
  (5,523,456 bytes), and `jellypal-0.2.16-win.zip` remains SHA-256
  `93FA61C9F0D714892C2264C81137443C05E21E5CD6D2B0686845B1D817F3C55D`
  (2,261,600 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 191 (autonomous loop - unify periodic platform self-heal)
- Fixed the 20-second furniture self-heal using a second, weaker anchoring
  implementation. It covered only bowl/cushion/egg and clamped every item with
  a fixed 26px half-width, so box/plant/music/mirror/mat/jar could retain stale
  platforms and wide or undersized-platform props could jump to a position
  that disagreed with cancel, load, resize, and normal-drop repair. The
  heartbeat now calls the shared `reconcileAnchoredPlatforms(now)` authority,
  covering all anchored objects with the same live-platform, real-width, and
  narrow-platform rules as event-time repair.
- Added a driven stale-wide-box regression to `_proptest.cjs`; the old loop
  failed its right-edge anchor, while the shared repair passes. The test's
  synthetic bowl platform now also exists in the live platform feed, keeping
  the lost-grab watchdog case faithful to production. Focused prop tests,
  syntax, 600 simulated frames, and a seeded 1,200-frame fuzz run all passed
  before the full gate finished **31/31 heartbeat GREEN**.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24 with exit 0, one exact
  GREEN marker, and empty stderr before promotion. Release exe SHA-256
  `F26CE168F3561024FC806B3FD2C59573F10C672C39268A0EADBB85A8693BB4AD`
  (5,523,456 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `93FA61C9F0D714892C2264C81137443C05E21E5CD6D2B0686845B1D817F3C55D`
  (2,261,600 bytes).
- Safety audit: an initial manual candidate invocation used an incomplete
  self-test flag and entered the normal app path. Promotion was still blocked;
  the process was terminated, the app's content-addressed recovery copies were
  verified against the pre-run baseline, and state/backup/checkpoint,
  diagnostics, four photos, timestamps, and registry watermark 15 were restored
  exactly. All nine real profile files now match their original hashes and
  timestamps, recovery is absent, and the temporary safety copy was sent to
  the Windows Recycle Bin. No Jellypal/test process, pulse lock, policy log,
  upload, or account action remains.

## Last session 190 (autonomous loop - tear stale Webby silk on grab watchdog)
- Fixed the lost-terminal-event watchdog leaving Webby's special drag state
  active. A grab begun while dangling sets both `held` and `webHeld`; ordinary
  pointer cancellation tore down `heldStretch`, `webHeld`, and `webbing`, but
  the 20-second watchdog cleared only `held`. With a valid cursor anchor the
  silk simulation therefore kept running after the watchdog claimed recovery.
- Added a shared `cancelPetDrag()` path that releases stretch and silk state,
  resumes a zero-vertical-velocity fall, and also repairs an anomalous orphaned
  `webHeld`. Both explicit pointer cancellation and the watchdog now use it,
  and the watchdog predicate includes `webHeld` itself. A driven valid-anchor
  web scenario first reproduced the stale silk, then proved the watchdog
  clears every hold/web flag, cursor/native dragging, and resumes falling.
  Existing prop, companion, ball, 600-frame soak, and strengthened fuzz checks
  remained clean; the full gate finished **31/31 heartbeat GREEN**.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24 before promotion and
  repacking. Release exe SHA-256
  `FB5BA5C6C93FE903B6AFA28DF090EE45188AE89F18D3E5FF031C2625D1255978`
  (5,523,456 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `2534D64048623D78F0E3A6D356C2BA2E16CA44AA1B05FFBB37C7DBEE57AF746C`
  (2,261,596 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 189 (autonomous loop - enforce companion cancel physics in fuzz)
- Strengthened mixed-input fuzz so the companion cancellation fix is protected
  beyond its deterministic prop harness case. Cancellation targeting now
  actively includes a visible companion instead of always preferring the main
  pet, captures the exact held companion before dispatch, and immediately
  fails if release does not leave that object with `fly=true` and zero x/y
  velocity. Runs of at least 1,000 frames must exercise this oracle at least
  once, in addition to the existing drag-flag and cursor cleanup checks.
- Three deterministic 1,200-frame seeds completed with 7, 2, and 7 real
  companion-cancel physics assertions respectively. All 3,600 frames had zero
  crashes or invariant violations. The normal full gate then finished
  **31/31 heartbeat GREEN**, including freshnarrow 4/4, behavior 130/130, all
  60 pals, and cleanboot 11/11.
- This pulse changed only the fuzz harness, so the verified runtime artifacts
  were intentionally not rebuilt. The release exe remains SHA-256
  `0D60FDCCD93A2F79EED8BE8A24B33EA9E99DD43B30E60CEAD8CE56A5EFEEE7A6`
  (5,523,456 bytes), and `jellypal-0.2.16-win.zip` remains SHA-256
  `EE2C20020D239B66C7AD38274BC33EE0308F995AC5627279FA73565349C5B027`
  (2,261,554 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 188 (autonomous loop - resume companion physics after cancelled drags)
- Fixed companions freezing in mid-air after an interrupted drag. Grabbing a
  companion deliberately sets `fly=false`, but the OS `pointercancel` and
  20-second lost-terminal watchdog paths previously cleared only `palHeld`;
  unlike normal pointerup, neither resumed physics. The companion then stayed
  permanently parked at the last cursor coordinate until another interaction.
- Added a shared `cancelPalDrag()` release that preserves the current position,
  zeroes velocity, and resumes a gentle fall. Both cancellation paths now use
  it. Driven tests first reproduced `fly=false` after a live pointer cancel,
  then proved both immediate cancel and watchdog recovery leave `palHeld`
  cleared, cursor/native dragging released, and companion physics active.
  The 600-frame soak, 1,200-frame deterministic fuzz run, aggregate behavior
  130/130, freshnarrow 4/4, and cleanboot remained clean; the full gate
  finished **31/31 heartbeat GREEN**.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24 before promotion and
  repacking. Release exe SHA-256
  `0D60FDCCD93A2F79EED8BE8A24B33EA9E99DD43B30E60CEAD8CE56A5EFEEE7A6`
  (5,523,456 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `EE2C20020D239B66C7AD38274BC33EE0308F995AC5627279FA73565349C5B027`
  (2,261,554 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 187 (autonomous loop - verify saved furniture on a narrow monitor)
- Closed the last direct-test gap around undersized-platform furniture by
  adding a dedicated `fresh(narrowprop)` boot scenario. It loads a saved
  72px-wide box at x=116 onto a synthetic 50px monitor floor and requires the
  real startup re-anchor path to center it at x=25/y=300, retain the actual
  live monitor platform object, and persist the normalized coordinates on the
  next save without emitting a crash.
- Promoted this scenario into `_pulse.cjs` as its own required `freshnarrow`
  step. The targeted boot passed **4/4**, and the enlarged full gate finished
  **31/31 heartbeat GREEN**, including the existing fresh/null/seeded boots,
  behavior 130/130, deterministic fuzz, all 60 pals, and cleanboot 11/11.
- This pulse changed only test infrastructure, so the verified runtime
  artifacts were intentionally not rebuilt. The release exe remains SHA-256
  `B183AC9ADBC4C555ADB1ABF9228DC60DA30BE2A2732B06FF8E544B8451DB2E2E`
  (5,523,456 bytes), and `jellypal-0.2.16-win.zip` remains SHA-256
  `12D3E3B59659AACD881E4E6DD17DF34D8BABE6A3F6A1044FD8BC3D1D74D87D99`
  (2,261,494 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 186 (autonomous loop - drive narrow-platform release paths)
- Closed a verification gap around the new undersized-platform placement rule.
  The prior regression proved automatic platform reconciliation, but the two
  pointer release branches could still have bypassed or miswired the shared
  clamp without being caught. The prop harness now drives a held box while its
  supporting window shrinks from 100px to 50px and cancels the gesture, then
  performs a separate deliberate pointer drop onto that 50px platform.
- Both paths require the exact centered x=25 result, platform y=300, and a
  cleared `propHeld` state. They pass alongside the existing resize,
  off-monitor, watchdog, cursor, and momentum regressions; the normal full gate
  finished **30/30 heartbeat GREEN**, including behavior 130/130,
  deterministic fuzz, all 60 pals, and cleanboot 11/11.
- This pulse changed only the test harness, so the already verified runtime
  artifacts were intentionally not rebuilt. The release exe remains SHA-256
  `B183AC9ADBC4C555ADB1ABF9228DC60DA30BE2A2732B06FF8E544B8451DB2E2E`
  (5,523,456 bytes), and `jellypal-0.2.16-win.zip` remains SHA-256
  `12D3E3B59659AACD881E4E6DD17DF34D8BABE6A3F6A1044FD8BC3D1D74D87D99`
  (2,261,494 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 185 (autonomous loop - center furniture on undersized platforms)
- Fixed furniture placement on a window platform narrower than the prop's full
  footprint. The ordinary clamp interval inverted in that case and forced all
  unavoidable overhang onto the right side (a 72px-wide box on a 50px window
  landed at x=36 instead of the window center x=25). Added `clampPropX()` so
  undersized platforms center the prop symmetrically while normal platforms
  still keep the whole footprint supported.
- Applied the shared rule to all four durable placement paths: cancelled-drag
  restoration, saved-state re-anchoring, live platform reconciliation, and a
  normal user drop. A driven Tauri resize regression first failed on the 50px
  window and then passed at exact center; the existing 100px full-support,
  off-monitor, cancellation, and watchdog cases stayed GREEN. The 600-frame
  soak, 1,200-frame deterministic fuzz run, aggregate behavior 130/130, and
  cleanboot also remained clean; the full gate finished **30/30 heartbeat
  GREEN**.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24 before promotion and
  repacking. Release exe SHA-256
  `B183AC9ADBC4C555ADB1ABF9228DC60DA30BE2A2732B06FF8E544B8451DB2E2E`
  (5,523,456 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `12D3E3B59659AACD881E4E6DD17DF34D8BABE6A3F6A1044FD8BC3D1D74D87D99`
  (2,261,494 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 184 (autonomous loop - preserve a live anchor after off-monitor cancellation)
- Fixed the cancellation restore path storing `platUnder()`'s synthetic floor
  fallback as a durable furniture anchor. If a held prop's window platform
  vanished beyond every current monitor (for example after an off-screen or
  secondary-monitor window disappeared), its coordinates were clamped back
  into view but its `plat` immediately remained stale. Restore now mirrors the
  normal reconciliation path and selects an actual live monitor floor object
  whenever the geometric query returns only a synthetic fallback.
- Added a driven platform-event regression that grabs a plant at x=2100,
  removes that platform, cancels the gesture, and requires both the clamped
  primary-screen position and membership in the current live platform set.
  The stale-anchor assertion failed before the fix and passed afterward.
  Existing cancellation, watchdog, and resize regressions, 600-frame soak, a
  1,200-frame deterministic fuzz run, aggregate behavior 130/130, and
  cleanboot remained clean; the full gate finished **30/30 heartbeat GREEN**.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24 before promotion and
  repacking. Release exe SHA-256
  `7B7DCAD36BFBDE082EFA3543A525CFACE16FD43C39BB9F61B5146D0E85AEAB8E`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `C1182FAC348CAF638F97D6631E992E53E762D9F73D67460F8B4054FC0A7A3280`
  (2,261,411 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 183 (autonomous loop - respect furniture width after platform resize)
- Fixed window-platform reconciliation clamping every furniture type with a
  generic 30px half-width. When a supporting window narrowed, wider props such
  as the 36px-half-width box could be re-seated with six pixels hanging beyond
  the platform edge despite the shared `PROP_HW` table already defining the
  correct footprint. Reconciliation now clamps by the current prop kind.
- Added a driven Tauri-event regression that anchors a box on a 200px window,
  shrinks that platform to 100px, and requires the box center to land at x=64
  so its right edge remains fully supported. The test failed at x=70 before
  the fix and passed afterward. Existing cancellation/watchdog churn tests,
  600-frame soak, a 1,200-frame deterministic fuzz run, aggregate behavior
  130/130, and cleanboot remained clean; the full gate finished **30/30
  heartbeat GREEN**.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24 before promotion and
  repacking. Release exe SHA-256
  `8E43A8492998AD2FCBE100286B424DF28478610D93BD053987604A7CC985E163`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `6055C63F52AB054A89317D9B8F475087822369C1AA0C212682BA3FD98FF76261`
  (2,261,412 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 182 (autonomous loop - re-anchor cancelled furniture after platform churn)
- Fixed static furniture retaining a dead window-platform object when that
  window disappeared during a drag. Live platform reconciliation correctly
  skipped the held prop, but `pointercancel` and the lost-pointer watchdog then
  restored its old coordinates and stale anchor, leaving it suspended in
  mid-air. Origin restore now detects only a genuinely vanished non-null
  anchor and seats the prop on the nearest live platform using its own width.
- Extended the driven prop harness to capture real Tauri `platforms` listeners
  and inject window creation/removal during a held plant drag. The regression
  first failed on the old runtime, then passed for both direct cancellation and
  the 20-second watchdog after the fix. Prop tests, 600-frame simulation,
  aggregate behavior 130/130, deterministic fuzz, and cleanboot all remained
  clean; the full gate finished **30/30 heartbeat GREEN**.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24 before promotion and
  repacking. Release exe SHA-256
  `9F679825BE1254AFA84F921F5D8B9FBCD0DC704327D08BF95150042BC1F61A5E`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `FDBB344BAB0F1E5C84AA278EE1C1E122CE6DE689B8620864A7871F050FAB7A13`
  (2,261,416 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no Jellypal/test process,
  pulse lock, temporary policy log, upload, or account action left behind.

## Last session 181 (autonomous loop — enforce terminal drag cleanup in fuzz)
- Strengthened the new pointer-cancellation coverage into an actual teardown
  oracle. After every live primary `pointerup` or `pointercancel`, the fuzz
  harness now immediately fails if any drag flag remains set or the canvas
  cursor is still `grabbing`; previously it only proved that cancellation
  events occurred, not that they cleaned up correctly.
- Three deterministic 1,200-frame seeds completed with 375 pointerups, 69
  cancel-before-up events, 38 active-drag cancellations, and 40 live terminal
  cleanup assertions. All 3,600 frames had zero crashes or invariant
  violations. The normal full gate then finished **30/30 heartbeat GREEN**.
- This pulse changed only the test harness, so the verified runtime artifacts
  were intentionally not rebuilt. The release exe remains SHA-256
  `556FBC01FDA207FCDC2D4A9760CF9FEE25D01C40BF039084AB5495E0E9CF5F6F`
  (5,522,944 bytes), and `jellypal-0.2.16-win.zip` remains SHA-256
  `77C14D1054AD0BE468231A54780398916083E6BC96C07FB4F18F461C42495670`
  (2,261,327 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no app/test process or pulse
  lock left behind.

## Last session 180 (autonomous loop — fuzz real pointer cancellation)
- Closed a verification blind spot in the mixed-state fuzz harness. Its click
  branch always emitted `pointerup` first and only sometimes emitted
  `pointercancel` afterward, so cancellation handlers were never exercised
  while a gesture was live despite the test claiming pointer churn coverage.
- Primary gestures now choose exactly one terminal event. Cancellation cases
  sometimes target a visible pet or companion, count both cancel-before-up and
  truly active drag cancellations, and make runs of 100+ frames fail if either
  class is absent. The fixed 1,200-frame seed produced 125 pointerups, 17
  cancel-before-up events, and 12 active-drag cancellations with zero crashes
  or invariant violations. The full gate finished **30/30 heartbeat GREEN**.
- This pulse changed only the test harness, so the verified runtime artifacts
  were intentionally not rebuilt. The release exe remains SHA-256
  `556FBC01FDA207FCDC2D4A9760CF9FEE25D01C40BF039084AB5495E0E9CF5F6F`
  (5,522,944 bytes), and `jellypal-0.2.16-win.zip` remains SHA-256
  `77C14D1054AD0BE468231A54780398916083E6BC96C07FB4F18F461C42495670`
  (2,261,327 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, with no app/test process or pulse
  lock left behind.

## Last session 179 (autonomous loop — keep jittered furniture taps anchored)
- Fixed furniture drift caused by ordinary pointer jitter during a tap. The
  release path correctly classified movement under 10px as a tap, but a prior
  `pointermove` had already copied the transient cursor coordinate into the
  prop. Refill/fluff taps could therefore walk static furniture a few pixels
  at a time and leave its y-coordinate off the platform.
- Tap classification now happens while `propHeld` still identifies the prop,
  allowing the shared cancel/watchdog origin restore to run before `propTap`.
  A driven bowl test first reproduced a 6×4px wobble shifting `(360,700)` to
  `(366,701)`, then proved the exact anchor survives. Aggregate behavior stayed
  **130/130**, frame soak stayed 600 clean, and deterministic fuzz ran 1,200
  frames with zero crashes or invariant violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `556FBC01FDA207FCDC2D4A9760CF9FEE25D01C40BF039084AB5495E0E9CF5F6F`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `77C14D1054AD0BE468231A54780398916083E6BC96C07FB4F18F461C42495670`
  (2,261,327 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 178 (autonomous loop — arrest a caught ball before cancel)
- Fixed stale ball momentum across an interrupted drag. Catching a moving ball
  reset only the gesture's toss estimator while leaving the ball object's old
  `vx/vy` live. A normal release overwrote those values, but OS cancellation
  or watchdog recovery could drop the ball at its new cursor position and have
  it suddenly resume its unrelated pre-grab flight.
- Ball pickup now arrests the underlying physics immediately; a normal toss
  still installs the measured release velocity. A real pointer regression
  first reproduced `(480,-200)` surviving a move and `pointercancel`, then
  proved cancellation leaves both components at zero. Aggregate behavior
  stayed **130/130**, frame soak stayed 600 clean, and deterministic fuzz ran
  1,200 frames with zero crashes or invariant violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `5E35FC9D5E5C61EFF1E61CC042AE100C7A664A842AE3A19087304E3391AF43FA`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `493A18204982F932A526F9B77E16C5861952E6580A7E37A7197E169ADD479E75`
  (2,261,395 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 177 (autonomous loop — face companion drags correctly)
- Fixed a companion drag-direction ordering bug. The pointer-move handler
  overwrote `palLX` with the current x-coordinate before comparing direction,
  so both comparisons were always against the same value and a dragged pal
  never turned to face left or right as intended. It now derives movement from
  the previous sample before advancing the sample clock.
- A real pointer regression placed a right-facing companion, dragged it 180px
  left, first reproduced the unchanged `lookDir`, then proved it flips to `-1`
  before release. Aggregate behavior stayed **130/130**, frame soak stayed 600
  clean, and deterministic fuzz ran 1,200 frames with zero crashes or invariant
  violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `4971CB9341610F84CC3F7C5DBA15522152D15E43632CF959C6E7D4E4764E3FF7`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `D60D35A9AC066E74FF0714B2311327558116A138110EB8755296A8C5DDF6D545`
  (2,261,367 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 176 (autonomous loop — show menu drag feedback immediately)
- Fixed the last delayed drag-cursor transition on the movable radial menu.
  Pressing the circle already captured the pointer and enabled native full
  input, but did not show `grabbing` until the first pointer movement. The
  menu now gives closed-hand feedback immediately on press, matching pets,
  companions, balls, furniture, and the volume slider.
- The existing real pointer-path regression first reproduced the missing
  press feedback, then proved press, release, and OS cancellation cursor
  states together with native input teardown and cancelled-position restore.
  Aggregate behavior stayed **130/130**, frame soak stayed 600 clean, and
  deterministic fuzz ran 1,200 frames with zero crashes or invariant
  violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `41B5111BCC142F746C1DEE28FF79E58720FD6929F6A2D173FB1B12DA51CED537`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `9E1CBE922F0661DA558AB3C94F2B78590C087B4AD48F2B3ABFEFDD64B73A3EC4`
  (2,261,364 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 175 (autonomous loop — close companion drag cursors)
- Fixed the remaining stale closed-hand cursor in companion drag teardown.
  Normal companion `pointerup` cleared `palHeld` and native drag input but left
  the canvas cursor as `grabbing` until the next pointer movement. Removing a
  companion while it was held had the same lifecycle gap. Both release paths
  now restore the default cursor immediately without changing toss physics.
- Two driven regressions first reproduced the failures: a real companion
  pointer down/move/up path in the prop harness, and the existing held-pal
  removal scenario in the social harness. Both are GREEN after the fix;
  aggregate behavior stayed **130/130**, frame soak stayed 600 clean, and
  deterministic fuzz ran 1,200 frames with zero crashes or invariant
  violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `FE7F65659DB6E40542101B60699DD3A3C49D517C123516CA739F7B39406E8DF9`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `4B17A719AF8037A275E28F9C9A513C05F6EC90B98028F94A529E3075CCB61DE7`
  (2,261,355 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 174 (autonomous loop — keep active drag cursors honest)
- Fixed a wrong visual state in the shared canvas pointer-move path. Furniture
  began with a `grabbing` cursor but lost it on the first move because
  `propHeld` was absent from the active-drag predicate; the volume slider was
  similarly missing both initial and sustained drag feedback. Furniture and
  volume drags now keep `grabbing` for the whole gesture, and volume release or
  OS cancellation restores the default cursor.
- Driven regressions first reproduced the furniture-move and volume
  press/move failures, then proved press, move, release, and cancel behavior.
  Aggregate behavior stayed **130/130**, frame soak stayed 600 clean, and
  deterministic fuzz ran 1,200 frames with zero crashes or invariant
  violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `D153CEA5C0244E5458FD0D11E17B7FA8859F4B61F4D55CD3BFDEA2A65B069AB0`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `8A1A1D7CD175A2EDDE02E965391A8221596EE00254A4C988016673EA055A8557`
  (2,261,268 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 173 (autonomous loop — restore furniture on watchdog release)
- Completed the cancelled-furniture recovery path for the harder case where
  both `pointerup` and `pointercancel` disappear. The 20-second stuck-grab
  watchdog cleared `propHeld` but, unlike the explicit cancel handler, left the
  static prop at its transient cursor coordinate. With no gravity, that could
  strand furniture in mid-air even after the watchdog reported recovery.
- Explicit cancellation and watchdog recovery now share one prop-origin
  restore function before clearing the held state. A driven regression aged
  both the grab and heartbeat clocks, first reproduced a bowl left at the drag
  coordinate, then proved the watchdog restores its exact `(520,700)` origin,
  clears the hold, and releases native input. Aggregate behavior stayed
  **130/130**; settings and prop/menu drag checks stayed GREEN, frame soak
  stayed 600 clean, and deterministic fuzz ran 1,200 frames with zero crashes
  or invariant violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `FE7D1021E4FF03C4521F8069F01B4D188E0684EED31DA0CEF6A382362AA61908`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `42F17B88A55F265C49D53F9B7247EC7D70476D92D339DD2E84BC3FE12FD9108E`
  (2,261,267 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 172 (autonomous loop — contain pointer-capture failures)
- Closed a WebView pointer-capture exception path shared by draggable pets,
  pals, balls, furniture, the radial menu, volume, and panel headers. Several
  handlers marked an object held before directly calling `setPointerCapture`;
  a rejected stale/lost pointer id therefore threw before native full-input
  mode was enabled, leaving the gesture wedged until the 20-second watchdog.
- All capture attempts now pass through one best-effort boundary. A capture
  failure no longer aborts the handler, so native drag ON, normal release,
  cancellation, and watchdog recovery remain reachable. A driven regression
  injected a throwing capture implementation, first reproduced the handler
  exception and missing native ON, then proved the furniture grab remains
  operable and immediately cancellable. Aggregate behavior stayed **130/130**;
  settings and prop/menu drag checks stayed GREEN, frame soak stayed 600 clean,
  and deterministic fuzz ran 1,200 frames with zero crashes or invariant
  violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `F36544845C32C0467E0A61A76E928364EA939597E0EBD45D5E4B1C013AD1992E`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `97C8A0C0F71D715BA7E78EE6F4BA9DC56A3052C882AA688015D9DA6370145853`
  (2,261,362 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 171 (autonomous loop — keep menu drags inside the overlay)
- Fixed an input-lifecycle hole in the movable radial menu. Unlike pet, pal,
  ball, furniture, and volume drags, pressing the menu circle neither captured
  the pointer nor enabled native `set_dragging`. Once the cursor left its small
  original hit rectangle, the transparent overlay could become click-through
  and lose the rest of the gesture.
- Menu drags now capture the pointer, hold native input from press through
  release, and clear it on normal release, OS cancellation, or the existing
  stuck-grab watchdog. Cancellation/watchdog recovery also restores the exact
  pre-drag menu coordinates instead of leaving an unsaved transient move. A
  driven regression first proved all three lifecycle cases failed, then proved
  one ON/OFF pair per gesture and exact `(600,260)` restoration after a
  cancelled move to `(820,330)`. Aggregate behavior stayed **130/130**;
  settings, prop/menu drag, and syntax checks stayed GREEN, frame soak stayed
  600 clean, and deterministic fuzz ran 1,200 frames with zero crashes or
  invariant violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `894BB95954FD208D307C8F34B0DF33007FB8DB9472140AE49AD34AB5215DE773`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `9D9FAE2BD9D1D0DD8F407579040E78942F043C8EA4AB04B118A15F9CE7B635D1`
  (2,261,236 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 170 (autonomous loop — restore cancelled furniture drags)
- Fixed a cancelled-drag wedge for static furniture. If Windows/WebView sent
  `pointercancel` after a bowl, cushion, box, or other placed prop had followed
  the cursor, the handler cleared `propHeld` but left the prop at that transient
  cursor coordinate. Because furniture has no gravity, it could remain floating
  off its platform until the player found and moved it again.
- Furniture grabs now retain the prop's real starting coordinate and restore it
  when the OS cancels the gesture before releasing the native drag state. A
  driven pointer regression first reproduced a bowl stranded at `(880,250)`
  after starting at `(320,700)`, then proved cancellation restores the exact
  anchored origin and clears the hold. Aggregate behavior stayed **130/130**;
  prop drag/drop stayed GREEN with the added cancel case, frame soak stayed 600
  clean, and deterministic fuzz ran 1,200 frames with zero crashes or invariant
  violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `09DEA63AB9548DF4225E812FA635FD51C2AD6D0A29410EF2BAE8883F8BC0670D`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `A697DB839CBC094FFEF5243C8BBF2FC5A7D2357AF27A010E93768A07B154019A`
  (2,261,109 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 169 (autonomous loop — persist every main-pet jar snack)
- Fixed a persistence hole in the main pet's cookie-jar interaction. Eating a
  cookie reduced live jar stock but did not mark the save dirty directly; it
  happened to persist only when the separate bond-gain path succeeded. During
  the global 12-second bond cooldown, closing the app could therefore restore
  the already-eaten cookie.
- Jar consumption now schedules persistence at the stock mutation itself, just
  like bowl and pal consumption, independently of whether affection can rise.
  A driven regression first proved stock changed 2→1 while `dirty` stayed
  false under a pinned bond cooldown, then proved the same interaction always
  leaves `dirty=true`. Seeded coverage rose from 43/43 to **44/44** and
  aggregate behavior from 129/129 to **130/130**; social/event stayed 58/58,
  malformed-load stayed 5/5, album stayed 20/20, settings stayed 57/57, prop
  drag/drop stayed GREEN, frame soak stayed 600 clean, deterministic fuzz ran
  1,200 frames clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `37A9D46DE790E58C938C72AFAB68580D3E819E101730F88D019C761269279C45`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `13CFE5B4F23247A64DC10088F0D728BD6D26AD5E8C7D0DA28FE9EC5EA444AFAD`
  (2,261,202 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 168 (autonomous loop — normalize restored prop stock)
- Re-established the discrete 0–3 stock invariant for the food bowl and cookie
  jar. Their saved `fill` values were merely clamped, so a corrupt fractional
  value such as `1.8` survived boot; jar consumption could then create and
  persist negative fractional stock before another reload repaired it.
- A shared stock decoder now maps missing/non-finite legacy data to the
  historical half-full default, floors finite values, and clamps them to 0–3.
  A driven regression first observed bowl stock `1.8`, then covered missing,
  null, negative, fractional, overflow, and Infinity inputs while proving the
  restored bowl/jar hold integer `1`/`0`. Seeded coverage rose from 42/42 to
  **43/43** and aggregate behavior from 128/128 to **129/129**; social/event
  stayed 58/58, malformed-load stayed 5/5, album stayed 20/20, settings stayed
  57/57, prop drag/drop stayed GREEN, frame soak stayed 600 clean,
  deterministic fuzz ran 1,200 frames clean, and the real profile replay ran
  **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `AF548654ED29F9536A58266717DD228B1F15F584113F5616E21E3719038139B5`
  (5,522,944 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `5EA06B75621FF47E350F496556C07AA54378C7217AB5B76F1273E4E502BB9058`
  (2,261,041 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 167 (autonomous loop — deduplicate restored companions)
- Restored the same companion invariant enforced by the ranch and nursery UI:
  one live companion per species. A corrupt save could place duplicate species
  at the front of `pals`, consume all three slots, and silently discard later
  distinct companions during boot.
- Saved companion sanitization now keeps the first owned, known occurrence of
  each species and skips duplicates without spending a slot; the existing
  4,096-entry scan bound and three-pal cap remain intact. A driven regression
  first reproduced `sprout, sprout, ember`, then proved a mixed duplicate and
  invalid list restores `sprout, ember, hyb7`. Seeded coverage rose from 41/41
  to **42/42** and aggregate behavior from 127/127 to **128/128**;
  social/event stayed 58/58, malformed-load stayed 5/5, album stayed 20/20,
  settings stayed 57/57, frame soak stayed 600 clean, deterministic fuzz ran
  1,200 frames clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `E5FBF1C361238610C4546F6AEC4E6F7EFEFE562AC4686593A81D2343963FC775`
  (5,522,432 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `1DEB908EDBF50A17B4751B8C5C2BBC8C02AA2CB01B6CFF82542BCFCBE58D8696`
  (2,260,917 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 166 (autonomous loop — preserve hints after malformed save values)
- Fixed a saved-onboarding edge case where every truthy value counted as a
  completed discovery hint. A damaged value such as the string `"false"`, a
  number other than `1`, or an object could permanently suppress help the
  player had never actually seen.
- Hint restoration now accepts only the app's canonical numeric `1` marker and
  the legacy boolean `true` form. A driven regression first reproduced five
  false completions, then proved canonical markers survive while malformed and
  unknown values are discarded without blocking normal runtime hint updates.
  Seeded coverage rose from 40/40 to **41/41** and aggregate behavior from
  126/126 to **127/127**; social/event stayed 58/58, malformed-load stayed 5/5,
  album stayed 20/20, settings stayed 57/57, frame soak stayed 600 clean,
  deterministic fuzz ran 1,200 frames clean, and the real profile replay ran
  **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `A480FB8A7372E7B89AC6B22EB088490EAABB088DC15F4CA3DD3F9245BE04FC7C`
  (5,522,432 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `571E006F350688DED87F7A877A1FDA347D83430582AE8CC4ADB40A625D7A244C`
  (2,260,862 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 165 (autonomous loop — fail closed on malformed weather setting)
- Closed a privacy-sensitive saved-setting edge case in the optional weather
  cosmetic. `weatherOn !== false` treated strings, numbers, objects, and `null`
  as enabled, so a corrupted value such as the string `"false"` could start the
  coarse IP-geolocation request despite not being an authoritative opt-in.
- A small default-on decoder now preserves the legacy migration behavior only
  for a missing field and literal `true`; literal `false` and every malformed
  present value fail closed to WEATHER OFF. A driven regression first proved
  that the crafted string enabled weather, then covered missing, boolean,
  string, number, object, and null inputs. Seeded coverage rose from 39/39 to
  **40/40** and aggregate behavior from 125/125 to **126/126**; social/event
  stayed 58/58, malformed-load stayed 5/5, album stayed 20/20, settings stayed
  57/57, frame soak stayed 600 clean, deterministic fuzz ran 1,200 frames
  clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `055D9EC2BACEAC38661CD9D535ECB8BA25EFE6EF98F690E194D9638DDE8C6A9A`
  (5,522,432 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `E1F792ECA8B9034229982F1A5289EB011EDC8711E2FCE137BA0466EECB2853AC`
  (2,260,846 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 164 (autonomous loop — respect weather opt-out before load)
- Closed a privacy-sensitive boot race in the optional weather cosmetic. The
  in-memory default is WEATHER ON, so the four-second timer or 30-minute poll
  could invoke coarse IP geolocation before an unusually slow `load_state`
  response restored the user's saved WEATHER OFF preference.
- Weather IPC is now gated on a successfully loaded state as well as the
  enabled flag. The boot timer records when it has elapsed; if it ran before
  load completed, the one missed probe resumes immediately afterward only when
  the authoritative saved setting permits it. A driven regression first
  observed the pre-load network call, then proved zero calls while saving is
  locked and exactly one valid request after readiness. Seeded coverage rose
  from 38/38 to **39/39** and aggregate behavior from 124/124 to **125/125**;
  social/event stayed 58/58, malformed-load stayed 5/5, album stayed 20/20,
  settings stayed 57/57, frame soak stayed 600 clean, deterministic fuzz ran
  1,200 frames clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `F6B26F618B6B15420FAB5B6A9353AB0BF9931447D718274DAD60247F55FCF7F7`
  (5,522,432 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `23B155F24C5AE8BFF6BED71A43678B37EEABCEAE68DF6ABAE0FE465998A73D48`
  (2,260,707 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 163 (autonomous loop — re-seat boot anchors immediately)
- Completed the boot platform-order fix for restored objects. A delayed monitor
  response now preserved live window geometry, but replacing `monPlats` still
  invalidated the platform object referenced by a box, egg, or other prop that
  had already loaded. Those objects could remain attached to a dead generation
  until another native window scan arrived.
- Anchor reconciliation is now shared by both monitor and live-window updates.
  Every placed prop, egg, landed snack/treat, and hidden box occupant is moved
  onto a current platform immediately after either source changes. A driven
  regression restores a box and egg before the delayed monitor response and
  proves both references are live as soon as it resolves. Social/event coverage
  rose from 57/57 to **58/58** and aggregate behavior from 123/123 to
  **124/124**; malformed-load stayed 5/5, seeded stayed 38/38, album stayed
  20/20, settings stayed 57/57, frame soak stayed 600 clean, deterministic
  fuzz ran 1,200 frames clean, and the real profile replay ran **7,200 frames**
  clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `44D1EC4CFE7E057FCE4B2B781082AF5C84EDF4BDE4A8034A3FE492E501EC7A28`
  (5,522,432 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `8199F521014C275AE91284AE5E15EE3AD49D28448763AE2D249A4004C2080CD8`
  (2,260,631 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 162 (autonomous loop — preserve live platforms at boot)
- Closed a boot-order race between the one-shot monitor query and native live
  window scans. If a window-platform event arrived first, a later
  `get_monitors` response replaced `plats` with monitor floors only. Pets,
  eggs, and furniture could briefly lose their real window deck and fall or
  re-seat until the next native poll restored it.
- Monitor floors and the last accepted runtime scan are now retained as
  separate sources and rebuilt together. A driven regression delays the boot
  monitor response, emits a window first, then proves both updated monitor
  floors and that newer window survive with their exact geometry. Social/event
  coverage rose from 56/56 to **57/57** and aggregate behavior from 122/122 to
  **123/123**; malformed-load stayed 5/5, seeded stayed 38/38, album stayed
  20/20, settings stayed 57/57, frame soak stayed 600 clean, deterministic
  fuzz ran 1,200 frames clean, and the real profile replay ran **7,200 frames**
  clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `CD7263283EC317547DFB30C8FF6E12A98D23E31E54205F196539D2FA2F0C3B8E`
  (5,522,432 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `442EF8CB3E017C9EDEFDDBCE23BD67A03460533FAE2F9E194A820F5AD8FBBD2A`
  (2,260,738 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 161 (autonomous loop — fail closed on malformed state IPC)
- Hardened the final frontend load boundary. Rust already validates object-root
  saves, preserves rejected generations, and returns `"{}"`, but the webview
  silently converted a malformed `load_state` response into fresh defaults and
  set `saveReady = true`. A later autosave could therefore overwrite the real
  profile if the bridge ever returned invalid text or the wrong value type.
- A strict parser now requires a string containing object-root JSON before the
  save gate opens. Arrays, scalars, malformed JSON, and non-string responses
  throw into the existing visible load-failure path and keep persistence
  locked; the historical textual `"null"` first-boot fallback remains accepted.
  A new integration mode first reproduced the unsafe ready/save behavior, then
  passed **5/5** checks covering visible failure, blocked backend writes, parser
  shape rules, frame-safe defaults, and zero crash leakage. Aggregate behavior
  rose from 117/117 to **122/122**; seeded stayed 38/38, social/event stayed
  56/56, album stayed 20/20, settings stayed 57/57, frame soak stayed 600
  clean, deterministic fuzz ran 1,200 frames clean, and the real profile replay
  ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `103426EB2B1B81EA3276C0D217370D457B77A45084E9A4F66F33ADD15B3815B9`
  (5,522,432 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `5C56632A67F7ECF156F3194C45B7E3A73EB2D2CEE6B3E785CBC48B9D8F6962E1`
  (2,260,668 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 160 (autonomous loop — saturate live bond gains)
- Closed the last direct addition path among persisted progression counters.
  Bond values were bounded when loaded, but `bondGain` added directly to the
  live value. A repaired or hand-edited save at the accepted maximum could
  therefore gain three points and become `9007199254740992`, outside exact
  integer precision, before the next save/reload could sanitize it.
- Bond gains now use the same saturating `addSavedInt` boundary as XP, jelly,
  and lifetime counters. A regression first reproduced the unsafe value, then
  proved an interaction at the cap remains exactly `Number.MAX_SAFE_INTEGER -
  1`. Seeded coverage rose from 37/37 to **38/38** and aggregate behavior from
  116/116 to **117/117**; social/event stayed 56/56, album stayed 20/20,
  settings stayed 57/57, frame soak stayed 600 clean, deterministic fuzz ran
  1,200 frames clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `5F6EEC2F26DD0ACDC777628181492090E39718F1B13EF645A5DD6A8E22DEF4AD`
  (5,521,920 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `297CCF2019A7AA019B74F4C0FC41F1612B51327BD00186A94861D3F8AE7C3E5B`
  (2,260,492 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 159 (autonomous loop — strict demo IPC boolean)
- Hardened the frontend demo-mode boundary. The `is_demo` IPC response was
  coerced with `!!v`, so a malformed truthy value such as the string `"false"`,
  a number, or an object could incorrectly enable demo restrictions, including
  limited breeding/gacha behavior and demo-only UI. Demo mode now activates
  only for the literal boolean `true`.
- The seeded boot harness now deliberately returns `"false"` and proves that
  startup remains in the full product mode. Direct regression checks also prove
  that literal `true` is accepted while string, number, and object responses are
  rejected. Seeded coverage rose from 36/36 to **37/37** and aggregate behavior
  from 115/115 to **116/116**; social/event stayed 56/56, album stayed 20/20,
  settings stayed 57/57, frame soak stayed 600 clean, deterministic fuzz ran
  1,200 frames clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `4C25326535933431F2C3BEAE1D6F3C502AA9990A7B7501D21B68455277F79AA2`
  (5,521,920 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `0BD2BBDCBBF6F1E63095F89FBF52E69ADEDCA286B4BDAED34EE29F0D957DB4A4`
  (2,260,344 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 158 (autonomous loop — contain native event handler failures)
- Hardened the common Tauri event boundary. `listenQuiet` already contained
  synchronous registration throws and registration Promise rejections, but it
  passed each callback through raw. A synchronous throw or returned rejected
  Promise from any current or future native-event handler could therefore leak
  into the global error/rejection path instead of being isolated at its source.
- Every registered callback is now guarded. Both failure forms are consumed and
  recorded as a bounded `LISTEN <event> ...` crash diagnostic; failure of that
  best-effort logger remains contained by `invokeQuiet`. A driven test registers
  synthetic sync-throwing and async-rejecting handlers, fires both events, and
  proves both exact diagnostics arrive with zero `unhandledRejection` events.
  Social/event coverage rose from 55/55 to **56/56** and aggregate behavior from
  114/114 to **115/115**. Seeded coverage stayed 36/36, album stayed 20/20,
  settings stayed 57/57, frame soak stayed 600 clean, deterministic fuzz ran
  1,200 frames clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `A9E59AB3308B09E565C5872CE01A960E7B1E90050BA55C40FC073F5DAF710FAF`
  (5,521,920 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `1C7EBDC85A83466E0E8B383A77900D1C67F798A1102B422FBE6739197AFED2DD`
  (2,260,383 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 157 (autonomous loop — preserve all-invalid platform scans)
- Closed the remaining ambiguity in runtime window-platform events. A malformed
  root was already ignored and bad siblings were filtered, but a non-empty
  payload containing only invalid rows sanitized to `[]`. The handler mistook
  that corruption for a legitimate "no windows" scan, discarded every prior
  window platform, and could drop a resting pet, egg, snack, or furniture.
- Only an originally empty array is now accepted as a real empty scan. If a
  non-empty array yields zero bounded finite positive-width rows, the event is
  ignored and the last good geometry remains intact; mixed payloads still keep
  their valid siblings. A driven event test covers null, `NaN`, negative width,
  string coordinate, and huge-coordinate rows together. Social/event coverage
  rose from 54/54 to **55/55** and aggregate behavior from 113/113 to **114/114**.
  Seeded coverage stayed 36/36, album stayed 20/20, settings stayed 57/57,
  frame soak stayed 600 clean, deterministic fuzz ran 1,200 frames clean, and
  the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `1A0F773EA36B3114642E596F2D652381C71E679667590C4C29F161EEE1155EC0`
  (5,521,920 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `17EC3D40811CDEFA06E02ADCD985EE5774A5ACDCC499106EF6AF1FEFD5390AEA`
  (2,260,360 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 156 (autonomous loop — bounded foreground-focus events)
- Hardened the foreground-window signal used for subtle app-kind mood bias.
  The native poll previously serialized an unbounded OS window title/app name
  every two seconds, while the frontend unconditionally dereferenced and
  stringified the event payload; a malformed event could throw and a very long
  title could remain in global state and be scanned on every classification.
- Rust now truncates by Unicode scalar value before IPC (512 title characters,
  256 app characters). The webview accepts only a two-string array, applies a
  second cheap code-unit bound and lowercase normalization, and ignores bad
  events so the last valid classification remains intact. Driven tests cover
  null events, missing/partial/object/non-string payloads, preservation of the
  last app, long valid data, normalization, bounding, and media classification.
  The Unicode-safe Rust helper passed its focused unit test **1/1**. Social/event
  coverage rose from 52/52 to **54/54** and aggregate behavior from 111/111 to
  **113/113**. Seeded coverage stayed 36/36, album stayed 20/20, settings stayed
  57/57, frame soak stayed 600 clean, deterministic fuzz ran 1,200 frames clean,
  and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `80C4769800315E9DFA3879B7122F2B66FAC0C5BC287087AD1FD4D8700776AA45`
  (5,521,920 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `1FB10479FE3C6EA6C592DC2565AEF2D24223BF2F89197239B55EC48893DB2B6B`
  (2,260,341 bytes). All nine real profile files retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 155 (autonomous loop — bounded boot monitor geometry)
- Hardened the one-shot `get_monitors` boot boundary. The frontend previously
  destructured every returned monitor row and calculated `y + h` without type,
  finiteness, sign, magnitude, or row-count checks, so one poisoned native row
  could put `NaN`, strings, or invalid floors into initial pet geometry.
- Boot monitor conversion now scans at most 64 rows, accepts only bounded finite
  `x/y/w/h` values with positive sizes and a bounded derived floor, and drops
  malformed siblings independently. If the payload has no valid rows, the
  known-safe default floor remains intact. A driven seeded boot mixes two valid
  monitors with null, `NaN`, string, negative-size, and huge-coordinate rows and
  proves the exact two clean floors survive. Seeded coverage rose from 35/35 to
  **36/36** and aggregate behavior from 110/110 to **111/111**. Settings stayed
  57/57, frame soak stayed 600 clean, deterministic fuzz ran 1,200 frames clean,
  and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `FB65BCDBED2276427CB899A18F9E5E9168070C41C7EDB034B509AB1AD8C28CCD`
  (5,520,384 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `12C89E31CD5B043F23758E563E39B21ED70467D8C0A81D03A689170B2844C694`
  (2,259,362 bytes). All nine real profile files, including state, checkpoint,
  crash log, backup, debug record, and four photos, retained their exact hashes
  and timestamps; recovery remained absent, and no app/test process, pulse lock,
  temporary policy log, upload, or account action remained.

## Last session 154 (autonomous loop — bounded runtime coordinate events)
- Hardened native-to-webview cursor and platform event payloads. Both handlers
  destructured their payload immediately, so a missing/partial event could
  throw outside the registration boundary; non-finite coordinates could also
  leave cursor motion or platform geometry poisoned across later frames.
- Cursor events now accept only bounded finite coordinate pairs. Platform
  events accept at most 4,096 bounded rows with positive widths, discard bad
  siblings independently, and treat a malformed whole payload as “ignore”
  rather than an empty scan that drops the pet and furniture. Driven event
  tests cover null/partial/NaN/huge cursor data, malformed platform roots, and
  mixed valid/invalid rows. Social/event coverage rose from 50/50 to **52/52**
  and aggregate behavior from 108/108 to **110/110**. Seeded coverage stayed
  35/35, album stayed 20/20, settings stayed 57/57, frame soak stayed 600
  clean, deterministic fuzz ran 1,200 frames clean, and the real profile replay
  ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `46626F53C3D65C8FF2495BAE92131C94245116829AAAFEC9B2DDC1216323D957`
  (5,520,384 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `70D7F0F70243A7CA1BB8030D03A7F87B73F05B1D92567D0F4EECCFB214EE094C`
  (2,259,280 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, upload, or account action remained.

## Last session 153 (autonomous loop — recoverable album decode failure)
- Fixed the album remaining on `LOADING...` forever when photo file I/O and
  lightweight PNG structure validation succeeded but the browser's actual
  image decoder rejected corrupt IDAT/CRC content. The resolved `Image` had no
  error handler, so the existing click-to-retry path was never reachable.
- Album images are now registered before decode and `Image.onerror` converts a
  still-relevant cache entry to the same explicit `failed` state used for IPC
  read errors; stale off-window errors are discarded. A driven queue test
  covers successful file read, browser decode failure, visible retry state,
  and successful retry without closing the album. Album coverage rose from
  18/18 to **20/20** and aggregate behavior from 106/106 to **108/108**;
  seeded coverage stayed 35/35. Settings stayed 57/57, frame soak stayed 600
  clean, deterministic fuzz ran 1,200 frames clean, and the real profile replay
  ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `2EE43C25E60DE85AC54A0803CC855722A01B4D826C61BB8B7AC8806CBB3696BD`
  (5,519,872 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `6567532694820E6E01F1F1B4B380B149AB666520C98FDDA51F06A40F97164A2E`
  (2,258,976 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, upload, or account action remained.

## Last session 152 (autonomous loop — race-safe weather toggle)
- Fixed a late weather response undoing the user's WEATHER OFF choice. The OFF
  click cleared the current code, but an already-running IPC could resolve
  afterward and repopulate it; the rain/snow predicates also did not consult
  the enabled flag, so cosmetic effects could reappear while settings said OFF.
- Weather polls now carry a monotonically increasing request generation. OFF
  invalidates every in-flight generation and the effect predicate requires the
  feature to remain enabled; overlapping polls likewise accept only the newest
  response. Driven deferred-Promise tests prove a late `95` cannot undo OFF and
  an older `95` cannot overwrite a newer `71`. Seeded coverage rose from 33/33
  to **35/35** and aggregate behavior from 104/104 to **106/106**. Settings
  stayed 57/57, frame soak stayed 600 clean, deterministic fuzz ran 1,200
  frames clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `FB94AA999BDB12005555D7B2F3813D643BF9909C17AC507A048CB1CE20061DFA`
  (5,519,872 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `43E50AF65FE1B1B827159A62134257A9AA94079BEAB38848202F6511C148073C`
  (2,258,888 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, upload, or account action remained.

## Last session 151 (autonomous loop — bounded weather response)
- Hardened the cosmetic weather IPC boundary. The backend forwards an integer
  from two remote JSON responses, but the frontend previously accepted every
  JavaScript number; an out-of-range value such as `999` therefore matched the
  `>=95` rain branch and displayed a false umbrella for up to 45 minutes.
- Weather state now changes only for integer WMO codes in `0..99`; malformed,
  fractional, non-finite, negative, and oversized results leave the last good
  state untouched. A driven async IPC test proves `999` is ignored while a
  valid `95` immediately enables the rain predicate. Seeded coverage rose from
  32/32 to **33/33** and aggregate behavior from 103/103 to **104/104**.
  Settings stayed 57/57, frame soak stayed 600 clean, deterministic fuzz ran
  1,200 frames clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `7D1A5AA06CB533D746326130982123315991AD277C66F308F477E5AFEDEFF100`
  (5,519,872 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `EDB1D35695CB29290C1FDEE7ED726896F6D2D0B259C7FDBAF9D141BADA1AEE4C`
  (2,258,700 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, upload, or account action remained.

## Last session 150 (autonomous loop — canonical daily-login date)
- Fixed the daily-login reward comparing a saved date to an unpadded
  `YYYY-M-D` string. A canonical saved key such as `2026-01-02` was treated as
  a new day on January 2, paying the stipend twice and resetting the streak to
  one even though both keys named the same local calendar day.
- The reward path now captures the local date once, compares both legacy
  unpadded and canonical keys by calendar components, derives yesterday from
  that same snapshot, and always persists padded `YYYY-MM-DD`. A driven seeded
  boot proves a padded current-day key neither pays again nor resets a capped
  streak. Seeded coverage rose from 31/31 to **32/32** and aggregate behavior
  from 102/102 to **103/103**. Settings stayed 57/57, frame soak stayed 600
  clean, deterministic fuzz ran 1,200 frames clean, and the real profile replay
  ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `32E4FB33FD07251AD55A9BF8D21E263A0832D77B058FB52D3EE3DD5369493549`
  (5,519,872 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `4112CB4078EF83305EEC20E1FDFD228E095F4146C415D1971F151A1A8B92258D`
  (2,258,676 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, upload, or account action remained.

## Last session 149 (autonomous loop — strict saved booleans)
- Hardened persisted boolean preferences against truthy non-boolean values. A
  malformed or hand-edited save containing the string `"false"` previously
  restored as true through `!!value`, which could silently enable mute,
  Pomodoro, reduced motion, boot autostart, or suppress the first-run tutorial.
- `muted`, `pomo`, `reduceMotion`, `seen`, and `bootOn` now restore as enabled
  only when their saved value is the literal boolean `true`. A poisoned seeded
  fixture proves string values remain off and, critically, do not dispatch an
  operating-system `set_autostart` request. Seeded coverage rose from 30/30 to
  **31/31** and aggregate behavior from 101/101 to **102/102**. Settings stayed
  57/57, frame soak stayed 600 clean, deterministic fuzz ran 1,200 frames
  clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `537F504DEFCA8C9C3C2D7FB3E0A571E9EF03E75C40D725A0AC921BDC6544C053`
  (5,519,360 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `060C537C6988F22BC78D8E00FD8B4D652FC3E0AD93C92335B40DC74DF28C4AF3`
  (2,258,552 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, upload, or account action remained.

## Last session 148 (autonomous loop — bounded panel-position restore)
- Hardened saved ranch, nursery, and status-card positions. The loader only
  checked `typeof x/y === "number"`, so extreme JSON numbers such as `1e400`
  could become non-finite and poison later CSS positioning, making a panel
  reopen at `NaNpx` or otherwise appear missing.
- Panel positions now require the current resolution, plain finite coordinates,
  and are rounded/clamped to the current viewport before becoming live state.
  Non-finite or wrong-shaped entries are discarded independently so one bad
  panel cannot erase valid siblings.
- Added a poisoned persisted position fixture and drove the real ranch-open
  path, proving the huge finite coordinate clamps on-screen and `Infinity` /
  `NaN` entries never restore. Seeded coverage rose from 29/29 to **30/30**
  and aggregate behavior from 100/100 to **101/101**. Settings stayed 57/57,
  frame soak stayed 600 clean, deterministic fuzz ran 1,200 frames clean, and
  the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `2F8A1AC793B21E1664D5EF770844A5466A607C2025FFB33291AAEE695D99766E`
  (5,519,360 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `01549C00140ADB4C914E572CB3581FA04BBCDDD8425F6243220FE803830ECF2E`
  (2,258,536 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, temp log, upload, or account action remained.

## Last session 147 (autonomous loop — ISO weekly reward boundary)
- Fixed the advertised ISO weekly key using a Gregorian-year approximation.
  Dates in the same ISO week across New Year (for example Dec 31 and Jan 1)
  produced different keys, granting the weekly 30-jelly bonus twice and
  rotating the spotlight species mid-week.
- Weekly rewards and spotlight selection now use a DST-safe local-calendar
  ISO week-year/key (`YYYY-Www`). Migration checks the legacy key against the
  saved profile timestamp, so an upgrade inside the same ISO week canonicalizes
  without paying again while the next real Monday still advances normally.
- Added Dec 31 / Jan 1 / Jan 4 / Jan 5 boundary and legacy-migration cases.
  Seeded coverage rose from 28/28 to **29/29** and aggregate behavior from
  99/99 to **100/100**. Settings stayed 57/57, frame soak stayed 600 clean,
  deterministic fuzz ran 1,200 frames clean, and the real profile replay ran
  **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `F7A4011140917B40901BD59167BC26EB8C0CDC5031E0260B49AA668A7F96BCC3`
  (5,519,360 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `3634E920637323380A666E545644D6559EE84EA4DD160C0F1BDA8628882F78D7`
  (2,258,483 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, temp log, upload, or account action remained.

## Last session 146 (autonomous loop — atomic daily egg date boundary)
- Fixed the once-per-day mystery egg building its date key from three separate
  `new Date()` calls. A frame crossing midnight between those reads could save
  a mixed calendar key and allow a second egg after the first hatched later
  that day.
- Egg due-check and persisted key now use one captured local date. Legacy
  unpadded `YYYY-M-D` keys still compare by calendar components, preventing an
  update from granting an extra egg on the same day. Driven clean/null boot
  tests prove the legacy key suppresses a duplicate and clearing it permits
  exactly one egg.
- Clean and literal-null coverage rose from 18/18 to **19/19**, seeded coverage
  from 27/27 to **28/28**, and aggregate behavior from 98/98 to **99/99**.
  Settings stayed 57/57, frame soak stayed 600 clean, deterministic fuzz ran
  1,200 frames clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `AAF24E0C795726199B0774C0BB761678707C8A8127C958927E100D7EE2B6FA99`
  (5,519,360 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `A4E476A0E427EDDB76453413D46B9A404CA3BF127041FBDD9B4463F745339B08`
  (2,258,177 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, temp log, upload, or account action remained.

## Last session 145 (autonomous loop — local-day daily selfie boundary)
- Fixed the daily-selfie calendar boundary mixing local dates with a UTC boot
  comparison. In positive UTC offsets such as Korea, launches between local
  midnight and 09:00 could repeatedly capture the same local day or skip that
  day's selfie. Card caption, persisted key, and boot due check now share one
  padded local `YYYY-MM-DD` function.
- Added a synthetic UTC-boundary case and verified the successful canvas-save
  path persists exactly the current local key. Seeded-save coverage rose from
  26/26 to **27/27** and aggregate behavior from 97/97 to **98/98**. Settings
  stayed 57/57, frame soak stayed 600 clean, deterministic fuzz ran 1,200
  frames clean, and the real profile replay ran **7,200 frames** clean.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `7570C4AFAE05A0B1EF8F051296602FDB00B4BD2BFCB999BBB4C4E617E98BE4BA`
  (5,519,360 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `75D66E11FAF09332DFF2F6B228A8C12E7913F510B00DF4D56E5BC72E7916A34B`
  (2,258,069 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, temp log, upload, or account action remained.

## Last session 144 (autonomous loop — single-flight album folder launch)
- Prevented repeated `OPEN FOLDER` clicks from spawning overlapping OS
  file-manager launches while the first `open_photos` IPC is still pending.
  `albumFolderRequest` now admits one request at a time, clears on both success
  and failure, and preserves the visible `OPEN FOLDER FAILED` recovery added in
  the previous pulse.
- Expanded the real footer-click coverage with pending double-click suppression,
  failure unlock, and successful retry. The album harness rose from **16/16 to
  18/18** and aggregate behavior from 95/95 to **97/97**. Settings stayed
  57/57, frame soak stayed 600 clean, and the 1,200-frame deterministic fuzz
  run had zero crashes or invariant violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `F3DBA1EAC10E3904F534CB6002233A9C04843AC3697DEB4E7C1515109093A334`
  (5,519,360 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `E79D9265CC3C75BD2D0400CCC2C0310516F99C4EF49CCB8AA989F299270E1146`
  (2,257,991 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, temp log, upload, or account action remained.

## Last session 143 (autonomous loop — visible album folder-open failure)
- Fixed the album's explicit `OPEN FOLDER` action silently swallowing an OS
  shell-launch rejection. A broken or unavailable file-manager association now
  shows `OPEN FOLDER FAILED` without closing or wedging the album.
- Added a driven test through the real album footer hit target and a rejected
  `open_photos` IPC. The album harness rose from **15/15 to 16/16** and
  aggregate behavior from 94/94 to **95/95**. Settings stayed 57/57, frame
  soak stayed 600 clean, and the 1,200-frame deterministic fuzz run had zero
  crashes or invariant violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `B77F9B5DBA3B86B22E8EA65398674E28AA9ACB486EDBA5F429459FE77828DA1E`
  (5,519,360 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `FBDE5236D658A5B9908354170614BB7057E840F7E3A1594943E97EA29E6B7D36`
  (2,258,019 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, temp log, upload, or account action remained.

## Last session 142 (autonomous loop — single-flight album catalog)
- Fixed the album catalog-open boundary. A slow `list_photos` call could be
  duplicated by reopening Settings and pressing ALBUM again, while a rejected
  catalog request failed silently and left no clear retry feedback.
- Album catalog loading is now single-flight through `albumListRequest`.
  Repeated opens share the same Promise, rejection releases the request and
  shows `ALBUM FAILED`, and `albumOpenWanted` prevents a late catalog response
  from reopening an album the user already closed with X, outside-click, or
  Escape. The existing empty-album guidance remains unchanged.
- Expanded the album harness from **12/12 to 15/15** with duplicate-request,
  rejected-catalog recovery, and close-before-response cases; aggregate
  behavior rose from 91/91 to **94/94**. Settings stayed 57/57, frame soak
  stayed 600 clean, and the 1,200-frame deterministic fuzz run had zero
  crashes or invariant violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `12197B554A9309787CEEC045A8D7A1C1966EC6016DA68B2186012E02B3B49FA5`
  (5,519,360 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `596E372EF631B071C3CDFA15F0E8A8992F4BBC2C3AFB600FC2B7BC3629828694`
  (2,257,995 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process,
  pulse lock, temp log, upload, or account action remained.

## Last session 141 (autonomous loop — race-safe album deletion)
- Fixed an asynchronous deletion race in the photo album. After the two-tap
  confirmation, more delete gestures could launch duplicate IPC while the
  first was pending; if the user navigated meanwhile, the completion callback
  spliced the then-current `albumIdx` instead of the filename actually removed
  on disk, hiding the wrong photo from the in-memory catalog.
- Album deletion is now single-flight and visibly reports `DELETING`. Success
  resolves by the captured filename, adjusts the index only when an earlier
  row shifted, and preserves whatever photo the user navigated to. Failure
  leaves the catalog/cache unchanged, releases the lock for another two-tap
  attempt, and shows `DELETE FAILED` instead of silently doing nothing.
- Expanded the album harness from **10/10 to 12/12** with pending duplicate
  suppression, navigate-while-deleting identity, and rejected-delete recovery;
  aggregate behavior rose from 89/89 to **91/91**. Settings stayed 57/57,
  frame soak stayed 600 clean, and the 1,200-frame deterministic fuzz run had
  zero crashes or invariant violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `45B7946E2061F6BD63048B3D528005593670F898391E8A75692A3EBBC9D065DC`
  (5,518,848 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `A5207E183522E46CD478163A4B7AF2FC3A09CB170329355960D98CF87B0114B5`
  (2,257,850 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 140 (autonomous loop — recoverable album photo load)
- Fixed the photo album's failed-read state. A rejected `load_photo` removed
  the cache entry but left the current card visually indistinguishable from an
  active request, so it displayed `LOADING...` forever; a one-photo album had
  no navigation path that could trigger another attempt.
- Failed in-window reads now settle into an explicit bounded `failed` cache
  state and render `PHOTO LOAD FAILED / CLICK TO RETRY`. Clicking the photo
  clears only that entry and dispatches exactly one new read. Off-window
  failures are still discarded, the one-active-IPC queue remains intact, and
  successful retry replaces the sentinel with the decoded image.
- Expanded the album harness from **7/7 to 10/10** with one-shot failure,
  exact single retry, and recovery cases; aggregate behavior rose from 86/86
  to **89/89**. Settings stayed 57/57, frame soak stayed 600 clean, and the
  1,200-frame deterministic fuzz run had zero crashes or invariant violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `DCE2DAF01002850FFB9EE235877B342B8BBB7ABC4C037C72F21F3CB40D6118A7`
  (5,518,848 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `B2DAF516EED4CD762AB93AB41497F42180BD2F4670E753583C9DA2FC9E41846D`
  (2,257,714 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 139 (autonomous loop — visible browser-launch failure)
- Fixed a silent failure in the gem-shop BUY and STORE actions. Both click
  paths previously discarded `open_url` rejection, so a missing/broken default
  browser handler made a valid click appear to do nothing.
- Added one `openExternalUrl()` boundary that returns a truthful boolean and
  shows the lightweight in-world `OPEN FAILED` bang on either a synchronous
  Tauri bridge throw or an asynchronous backend refusal. Successful launches
  remain visually quiet, and every product `open_url` call now routes through
  this single contained boundary.
- Extended the Settings/IPC harness from **53/53 to 57/57** with a source-route
  invariant plus synchronous failure, asynchronous failure, and success cases.
  Behavior stayed 86/86, frame soak stayed 600 clean, and the 1,200-frame
  deterministic fuzz run had zero crashes or invariant violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `B532B93B09241DD32BDFF6D597EEFAEE6221BE6B901C2ACFE3A9B199ADBD6FC2`
  (5,518,336 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `5077C2E3AB1E8471E81DFB6EC898EAFCC2EC3B5628E4DFA2B059D1523D2D14A8`
  (2,257,496 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 138 (autonomous loop — strict update version payload)
- Closed a false-success path in the update probe. Any non-empty response up
  to 32 bytes previously crossed the Rust boundary, so a 404 body, `Infinity`,
  a shortened version, or extra components could be reported as a successful
  remote version and left the permissive frontend comparator to interpret it.
- Added `valid_release_version()` for an exact three-component decimal
  `major.minor.patch` contract. Each component must be canonical (no empty or
  leading-zero form) and fit in `u32`; the existing response-size and UTF-8
  bounds remain in force before the value reaches the UI.
- Expanded the shipped network-policy executable test from **35/35 to 43/43**
  with normal and maximum-component versions plus missing, extra, leading-zero,
  nonnumeric, overflow, and empty-component refusals. The worker stayed 24/24,
  behavior stayed 86/86, Settings stayed 53/53, frame soak stayed 600 clean,
  and the 1,200-frame deterministic fuzz run had zero crashes or invariant
  violations.
- The isolated optimized candidate passed input 23/23, network 43/43, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `8044307EDD843A82CE6C8DB74EE0750A8517A9C72D274C51EC8FEBEBA0374386`
  (5,518,336 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `076B376AC8818301C5B4495A1D301D6EAB7F4C2D127DDEF9B55627483FDE1980`
  (2,257,449 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 137 (autonomous loop — parsed HTTPS boundary)
- Hardened the shared URL gate used by browser opens and the update probe.
  The old check only required a literal `https://` prefix plus printable bytes,
  so hostless inputs, embedded browser credentials, malformed ports, and
  backslash-based cross-parser ambiguities could cross the Tauri IPC boundary.
- `valid_https_url()` now parses with Tauri's URL implementation, requires an
  HTTPS scheme and a real host, rejects usernames/passwords and backslashes,
  and retains the existing printable/2,048-byte bounds. Valid checkout shapes
  still support paths, query parameters, fragments, and explicit ports.
- Expanded the shipped network-policy executable test from **29/29 to 35/35**
  with a valid port/query/fragment URL plus hostless, username, password,
  backslash-confused, and out-of-range-port rejections. The worker stayed
  24/24, behavior stayed 86/86, Settings stayed 53/53, frame soak stayed 600
  clean, and the 1,200-frame deterministic fuzz run had zero crashes or
  invariant violations.
- The isolated optimized candidate passed input 23/23, network 35/35, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `47D19679F983E113EF5D7931F267DA1597C56DA8B2FF485F5FD8590DFEF1DEA2`
  (5,516,800 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `33B8B76B48413D17A2BF2A376AB973D0518D23926EA1F46BC6DB127DC49D74BD`
  (2,256,819 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 136 (autonomous loop — strict grant response contracts)
- Closed two false-success paths at the Rust/server boundary. `ack_grants`
  previously discarded every worker response and returned success even when
  transport failed, JSON was malformed, or the worker rejected the request;
  `claim_grants` treated any valid JSON without a `grants` array (including an
  `{error: ...}` response) as an empty successful claim.
- Added one strict `parse_server_json()` boundary shared by redeem and claim.
  Malformed JSON now becomes `bad response`, while worker `{error: ...}` text
  remains a real refusal. Claims require the documented `grants` array, and
  ACKs additionally require the documented `{ok:true}` result; unavailable
  transport reports `offline`. Existing nonce dedupe and repeat-ACK behavior
  still make lost acknowledgements safe and retryable.
- Expanded the shipped network-policy executable test from **25/25 to 29/29**
  with accepted ACK, false ACK, explicit worker error, and malformed response
  cases. The worker contract stayed 24/24, behavior stayed 86/86, Settings
  stayed 53/53, frame soak stayed 600 clean, and the 1,200-frame deterministic
  fuzz run had zero crashes or invariant violations.
- The isolated optimized candidate passed input 23/23, network 29/29, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `31DA157D25D88D1EC1B25D4587E7EE2756DCA1A66D3477CB68317A2918BE18F6`
  (5,515,776 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `65AD7A23AE886EF212F43191B9929B99E0AFF2D5C3265E05FB9BD42FC308C8DD`
  (2,256,015 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 135 (autonomous loop — uniform sync-safe IPC)
- Closed the remaining frontend bridge exception gap. Boot-time load/monitor/
  demo/update calls, weather polling, shop links, RESET, save/redeem/grants,
  and album list/load/delete/open paths previously mixed direct
  `invoke(...).then/.catch` calls with guarded ones. A bridge throw before a
  Promise was returned could escape top-level/event/timer code; RESET could
  remain stuck at `resetBusy=true`.
- Added one `invokeAsync()` boundary that converts every synchronous bridge
  throw into a normal Promise rejection while preserving successful results
  and asynchronous rejections. Every product IPC path now uses it; a source
  invariant proves the sole remaining raw `invoke(` call is inside that
  boundary.
- Extended the real Settings harness from 47 to **53/53** with boundary
  success/synchronous/asynchronous outcomes plus a synchronous RESET throw.
  The RESET retry lock is released and `RESET FAILED` appears exactly as for an
  asynchronous denial. Existing synchronous save/photo and best-effort IPC
  cases remain green.
- Behavior stayed 86/86, frame soak stayed 600 clean, and canvas save success
  plus four failure modes remained contained. The isolated optimized candidate
  passed input 23/23, network 25/25, save 105/105, photo 71/71, log 33/33, and
  migration 24/24; the repacked artifact finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `E5F83CF253BFC487AE0A1464A0C18D63851DD27B4E9C256F0550A4324C9155B1`
  (5,513,728 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `589F46399096FCC0D415258F17A113C2062FB71FD1B6A4C54ABA55FED64F244E`
  (2,255,247 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 134 (autonomous loop — contained canvas save boundary)
- Closed the same synchronous-exception gap in the two remaining canvas save
  paths. Share-card clicks and the delayed daily-selfie timer previously called
  `toDataURL()` and Tauri `invoke()` directly, so either synchronous throw
  escaped the caller; malformed non-PNG data URLs were also forwarded as an
  undefined payload.
- Added one `saveCanvasPng()` boundary that validates the exact PNG data-URL
  prefix, extracts a non-empty payload, converts synchronous serialization and
  bridge throws into Promise rejections, and normalizes asynchronous bridge
  results. Photo mode now uses the same boundary.
- Share-card failure is visibly reported as `CARD FAILED`; ambient daily
  selfie failure stays quiet and leaves `lastSelfie` untouched for a later
  retry. Successful cards still open the photo folder through contained
  best-effort IPC, and successful selfies retain their reward/pose behavior.
- Expanded the frame harness to exercise share card and daily selfie under
  normal save plus serialization throw, invalid data URL, synchronous IPC
  throw, and asynchronous IPC refusal, proving all ten outcomes settle without
  an unhandled rejection. Settings/photo stayed **47/47**, behavior 86/86,
  frame soak 600 clean, and an additional 3,000-frame fuzz run had zero
  crashes or invariant violations.
- The isolated optimized candidate passed input 23/23, network 25/25, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `C55A1CBA903E696277A0CDEDB2C001B7CF208ED0D7CBE490E6978135B2D0836C`
  (5,513,216 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `3426FAE15B4414982DC7E860570B0B41AE90735F20D5F6591161018B99A511F3`
  (2,255,206 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 133 (autonomous loop — fail-safe photo-mode recovery)
- Fixed a UI wedge in Settings PHOTO. If canvas PNG serialization or the
  Tauri `save_png` bridge threw synchronously inside the delayed capture,
  cleanup never ran: `photoHide` stayed true and the ranch, nursery, card, and
  info layers remained transparent for the rest of the process.
- Wrapped capture/dispatch in a synchronous exception boundary with mandatory
  `finally` restoration, normalized bridge results through `Promise.resolve`,
  and made both synchronous and asynchronous failures visibly report
  `PHOTO FAILED`. The successful save/album path is unchanged.
- Extended the real Settings click-path harness from 39 to **47/47** with
  canvas-serialization throw, synchronous IPC throw, asynchronous IPC refusal,
  and successful-save cases; each asserts all four UI layers and `photoHide`
  recover plus truthful notification. Behavior stayed 86/86 and the frame
  soak stayed 600 clean.
- Before the fix, four independent deterministic fuzz seeds completed 10,000
  frames each with zero crashes or invariant violations, while the read-only
  real-save reproduction completed 7,200 clean frames. After the fix, the
  release pulse's deterministic fuzz and clean-boot checks also stayed green.
- The isolated optimized candidate passed input 23/23, network 25/25, save
  105/105, photo 71/71, log 33/33, and migration 24/24; the repacked artifact
  finished **30/30 heartbeat GREEN**.
- Release exe SHA-256
  `010C6349C2133EAFF26844D92C864D529273F8E01461CB7A302AE415005D92E6`
  (5,513,216 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `8EDD0736A83D2623E88F7EAFE7857F21F1CC04234F0E4B5011C7285CD6398CEE`
  (2,254,982 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 132 (autonomous loop — isolated curl configuration)
- Removed an ambient network-behavior dependency: Jellypal's curl subprocesses
  previously loaded the user's default `.curlrc`. A local proxy, credential,
  output-file, or other option in that file could silently alter update,
  weather, redeem, claim, and acknowledgement requests.
- Centralized curl construction and made `-q` its mandatory first argument,
  which is the position curl requires to disable the default config. Existing
  bounded output, timeouts, request arguments, and offline fallbacks remain
  unchanged.
- Added two no-network command-construction cases proving the config guard is
  first and every caller-supplied argument retains its order. Development Rust
  checking passed; the isolated optimized candidate passed input 23/23,
  network **25/25**, save 105/105, photo 71/71, log 33/33, and migration 24/24.
- Rebuilt and repacked the release; the full artifact pulse finished **30/30
  heartbeat GREEN**, including behavior 86/86, settings/save 39/39, seeded
  fresh-state 26/26, deterministic 1,200-frame fuzz with zero crashes or
  invariant violations, clean boot 11/11, and the release policy CLIs.
- Release exe SHA-256
  `28FD55EF870DDCCA6D2052555D710BA66E6B3C97A67C378B8D242C242E7C7EBB`
  (5,513,216 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `C02CDCC970B84DBB9DE5780949A68F21FD56451ED135393C3A8BD1A358D1F3FD`
  (2,254,772 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 131 (autonomous loop — cross-platform plist build guard)
- Found and fixed a macOS-only compile regression introduced by the preceding
  plist hardening: the escaped executable had become a `String`, but the
  `cfg(target_os = "macos")` branch still called `exe.display()`. Windows Rust
  checks omit that branch, so the error was invisible to the normal host gate.
- Moved complete LaunchAgent document construction into a platform-independent
  `launch_agent_plist()` function. The host build now type-checks the template
  on every pulse, while the macOS branch only converts its native path and
  delegates to the checked builder.
- Extended the mutation-free XML suite from seven to ten cases, asserting the
  complete ProgramArguments/RunAtLoad structure, reserved-character encoding,
  and invalid-character refusal. Development Rust checking passed; the
  isolated optimized candidate passed input 23/23, network 23/23, save
  **105/105**, photo 71/71, log 33/33, and migration 24/24.
- Rebuilt and repacked the release; the full artifact pulse finished **30/30
  heartbeat GREEN**, including behavior 86/86, settings/save 39/39, seeded
  fresh-state 26/26, deterministic 1,200-frame fuzz with zero crashes or
  invariant violations, clean boot 11/11, and the release policy CLIs.
- Release exe SHA-256
  `AA469BCC607D08D6B3F2C50C3AE34119787DB7E3064215FEAAF1C9BD0DAEB7A6`
  (5,511,680 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `F167118C8B74FF2D2568FE5EEE4298B813ED8BD2EE53E54916BDFAE59507B9FD`
  (2,253,422 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 130 (autonomous loop — safe macOS autostart plist)
- Fixed macOS autostart plist generation so executable paths are encoded as
  XML text instead of being interpolated verbatim. Paths containing `&`, `<`,
  `>`, quotes, or apostrophes can no longer corrupt the LaunchAgent document;
  XML-forbidden control characters now produce an explicit Settings failure
  instead of silently writing an unusable startup file.
- Kept this logic platform-independent and added seven mutation-free cases for
  plain paths, all five escaped characters, pre-existing entity text, allowed
  whitespace, and forbidden control/noncharacter input. Development Rust
  checking passed; the isolated optimized candidate passed input 23/23,
  network 23/23, save **102/102**, photo 71/71, log 33/33, and migration 24/24
  without creating or changing any startup entry.
- Rebuilt and repacked the release; the full artifact pulse finished **30/30
  heartbeat GREEN**, including behavior 86/86, settings/save 39/39, seeded
  fresh-state 26/26, deterministic 1,200-frame fuzz with zero crashes or
  invariant violations, clean boot 11/11, and the release policy CLIs.
- Release exe SHA-256
  `20D112E06EAD90AFCE5798E1B8CE11535208DBA38CC2BE0789FA9F82FC54F53F`
  (5,509,632 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `930B606A48E523B79D703001B6AFB8ED0E81C672640E73995DC0D31A5D10A417`
  (2,252,386 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 129 (autonomous loop — idempotent Windows autostart)
- Fixed the Windows startup-OFF path so an already absent `Jellypal` Run value
  is treated as success. The former `reg delete` command returned nonzero in
  that state, causing Settings to report `STARTUP FAILED` and roll the toggle
  back on even though Windows was already in the requested OFF state.
- Replaced the `reg.exe` add/delete subprocesses with direct per-user Windows
  Registry API calls. The enabled command is written as native UTF-16, so an
  executable under a Korean or other non-ASCII path is preserved exactly;
  missing key/value results are idempotent success while access and write
  failures remain visible to the frontend.
- Added six mutation-free registry status cases covering present, missing, and
  access-denied key/value outcomes. Development Rust checking passed, and the
  isolated optimized candidate passed input 23/23, network 23/23, save
  **95/95**, photo 71/71, log 33/33, and migration 24/24 without touching the
  real Run key.
- Rebuilt and repacked the release; the full artifact pulse finished **30/30
  heartbeat GREEN**, including behavior 86/86, settings/save 39/39, seeded
  fresh-state 26/26, deterministic 1,200-frame fuzz with zero crashes or
  invariant violations, clean boot 11/11, and the release policy CLIs.
- Release exe SHA-256
  `7681B52B427D2585243215D243A41F5811D67B462A2EB171CDE5FCB5DC12C326`
  (5,506,048 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `D3467BAB17B42A1822B045873A3EA1564B197315E572B62A86B211BDCB286384`
  (2,250,525 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; recovery remained absent, and no app/test process, pulse
  lock, temp log, upload, or account action remained.

## Last session 128 (autonomous loop — single-flight redeem credit)
- Closed a same-code concurrency gap in redeem. Two submissions could both
  pass the persisted-history check before either verification completed; if
  the server was offline, both local signature checks could then credit the
  same signed pack.
- Added a per-normalized-code in-flight set around the complete server/local
  verification transaction. A duplicate overlapping submission now returns
  `CODE USED`, while `finally` always releases the code after success, refusal,
  or exception so legitimate retries remain possible.
- Added a deferred-verifier simulation proving two concurrent submissions
  issue one verification, credit 500 jelly once, append one history entry,
  reject the second submission, and leave zero pending locks. Behavior coverage
  rose to **86/86**.
- Settings/save stayed 39/39, frame soak stayed 600 clean, read-only real-save
  reproduction stayed clean for 7,200 frames, and deterministic fuzz completed
  1,200 frames with zero crashes or invariant violations. The isolated release
  passed input 23/23, network 23/23, save 89/89, photo 71/71, log 33/33, and
  migration 24/24; the repacked artifact finished **30/30 heartbeat GREEN**.
- Release rebuilt and portable repacked: exe SHA-256
  `E048D1E4695C220CA661A6F4E1B2B331FFC872953DD01C03F49662B6F671AB00`
  (5,504,512 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `610659C474DDD131C33D3CFB33D0BC5C221B64B52110A20AF72A8626BB51FEF0`
  (2,249,659 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 127 (autonomous loop — synchronous save retry safety)
- Closed the remaining frontend save-retry gap. `persist()` previously cleared
  `dirty` before serialization and only restored it from a Promise rejection;
  a synchronous `JSON.stringify` or Tauri bridge throw therefore dropped the
  batch from future autosave attempts.
- Save request construction now runs inside a synchronous guard and the result
  is normalized through `Promise.resolve`, so serialization errors, immediate
  bridge exceptions, and asynchronous backend failures all restore `dirty`
  and return a rejectable Promise to existing callers.
- Settings/save coverage rose to **39/39** with separate async rejection,
  synchronous IPC throw, real cyclic-object serialization failure, and
  successful repaired-state retry cases.
- Stabilized the social simulator's independent chat-bubble assertion. Once
  random chat initiation is proven, one valid chirp frame is scheduled
  deterministically; 30 isolated repetitions completed with zero failures
  instead of occasionally losing the 260ms lead-in to unrelated ambient
  motion.
- Behavior stayed 85/85, frame soak stayed 600 clean, read-only real-save
  reproduction stayed clean for 7,200 frames, and deterministic fuzz completed
  1,200 frames with zero crashes or invariant violations. The isolated release
  passed input 23/23, network 23/23, save 89/89, photo 71/71, log 33/33, and
  migration 24/24; the repacked artifact finished **30/30 heartbeat GREEN**.
- Release rebuilt and portable repacked: exe SHA-256
  `32D5357629DC3F9C23836424CC1AFB8F843D17ABB948AD8D30827A10F280D53D`
  (5,504,512 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `58A95F9526F2315FE30BDA6F51DB2D85CA444AFA16C975E900DC632CC21B7D7D`
  (2,249,540 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 126 (autonomous loop — contained best-effort IPC)
- Added shared fire-and-forget wrappers that consume both synchronous throws
  and Promise rejections from non-critical Tauri IPC. Drag state, clickable
  geometry, quit dispatch, clipboard diagnostics, watchdog records, and crash
  logging can no longer create global unhandled rejections during backend
  shutdown or transient IPC failure.
- Routed all seven Tauri event subscriptions through the same containment.
  A rejected subscription records one bounded diagnostic when possible, while
  a simultaneous logger failure is safely swallowed instead of recursively
  producing more rejection events.
- Normalized redeem errors through `Error.message`/string conversion and added
  a final rejected-Promise UI fallback, so an `Error` object can no longer
  throw at `.toUpperCase()` and leave the redeem action without feedback.
- Settings/IPC coverage rose to **35/35** with explicit simultaneous rejected
  IPC/listener monitoring and Error-object redeem failure. Behavior stayed
  85/85, frame soak stayed 600 clean, read-only real-save reproduction stayed
  clean for 7,200 frames, and deterministic fuzz completed 1,200 frames with
  zero crashes or invariant violations.
- The isolated release passed input 23/23, network 23/23, save 89/89, photo
  71/71, log 33/33, and migration 24/24. The repacked artifact then completed
  the full **30/30 heartbeat GREEN** gate.
- Release rebuilt and portable repacked: exe SHA-256
  `6898F25B85AE8A5938586515B47305E18547ED1D21E53C56044A9371889C477D`
  (5,504,512 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `DC40C7CF8B51B11C45620E9E26BB8E8D2F63DBCC20940B0CC609DA3D9BDFF633`
  (2,249,436 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 125 (autonomous loop — bounded hybrid behavior metadata)
- Closed two nested hybrid-save edge cases. A future `bornAt` timestamp is
  now normalized to the current wall clock instead of keeping a hybrid in
  baby mode forever with an implausible growth countdown.
- Replaced length-only checks for restored hybrid behavior strings with the
  existing trait, movement, signature, and personality registries. The only
  accepted typing-reaction text is the value emitted by the hybrid generator,
  so short invented values can no longer enable undefined behavior.
- Seeded boot rose to **26/26** and behavior to **85/85**. The real breed
  click path, settings 33/33, and 600-frame soak stayed green; read-only
  real-save reproduction stayed clean for 7,200 frames, and deterministic
  fuzz completed 1,200 frames with zero crashes or invariant violations.
- The isolated release passed input 23/23, network 23/23, save 89/89, photo
  71/71, log 33/33, and migration 24/24. The repacked artifact then completed
  the full **30/30 heartbeat GREEN** gate.
- Release rebuilt and portable repacked: exe SHA-256
  `A3538D2A985195E140E19D761C75E320609E124E6461100392C3B72F85EE7106`
  (5,504,000 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `433DE521E9E2CDD9CE2984A5231A64D0BBAF0EECC4D7C67E83C6C56D4A658492`
  (2,249,186 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 124 (autonomous loop — precision-safe persistent gains)
- Added shared saturating arithmetic for persistent integer counters and
  fractional focus time. Experience, jelly, and gameplay statistics now stop
  at the highest exactly representable saved value instead of crossing into
  imprecise JavaScript integers after a corrupt or extreme save.
- Routed every runtime gain path through the boundary: typing, treats, grants,
  redeem codes, offline/daily/weekly/dex rewards, eggs, duplicates, legendary
  drops, pulls, breeding, shiny counts, social play, and Pomodoro focus time.
  Existing spend/reset logic and ordinary progression remain unchanged.
- Seeded boot rose to **25/25** and behavior to **84/84**. Eating, breeding,
  settings, and the 600-frame soak stayed green; read-only real-save
  reproduction stayed clean for 7,200 frames, and deterministic fuzz completed
  1,200 frames with zero crashes or invariant violations.
- The isolated release passed input 23/23, network 23/23, save 89/89, photo
  71/71, log 33/33, and migration 24/24. The repacked artifact then completed
  the full **30/30 heartbeat GREEN** gate.
- Release rebuilt and portable repacked: exe SHA-256
  `B68AF21FADE07795AFCCC32413D9F36A40050E715047A32036E9DA5ADE572311`
  (5,504,000 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `8F337223C4D081DBB6D6E67A7E9F145486ED899DA7ECF3C32724B4A1D7B36FA0`
  (2,249,085 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 123 (autonomous loop — collision-safe hybrid ids)
- Closed the hybrid sequence precision edge. A save-supplied next-id counter
  is no longer trusted; boot derives it from the bounded, validated hybrid
  records that were actually accepted, so a corrupt maximum value cannot
  jump or disable ordinary breeding.
- Added an explicit safe-integer exhaustion guard to the ranch button, breed
  transaction, and hybrid factory. At the final representable id, the next
  attempt now refuses cleanly before spending jelly, incrementing stats,
  arming the cooldown, or inserting a duplicate species id.
- Seeded boot rose to **24/24** and behavior to **83/83**. The real breed
  click path stayed green, settings stayed 33/33, frame soak stayed 600
  clean, read-only real-save reproduction stayed clean for 7,200 frames,
  and deterministic fuzz completed 1,200 frames with zero crashes or
  invariant violations.
- The isolated release passed input 23/23, network 23/23, save 89/89, photo
  71/71, log 33/33, and migration 24/24. The repacked artifact then completed
  the full **30/30 heartbeat GREEN** gate.
- Release rebuilt and portable repacked: exe SHA-256
  `3A58796441B51E9ED238CB05CF5BB1BA02FBA188D6C2634D7A066514DC5EB882`
  (5,504,000 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `9937582BD57E881FF3FD1085DDE8345190D2F82B8E405EE07EF112832F09C527`
  (2,248,868 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 122 (autonomous loop — bounded saved scalars)
- Hardened scalar restoration from legacy or corrupt saves. Large experience,
  currency, pity, hybrid-sequence, selector, streak, and milestone values no
  longer pass through 32-bit bitwise coercion and unexpectedly wrap negative.
- Added finite, range-aware normalization for cooldowns, saved timestamps,
  volume, pet position, bowl/jar fill, and local/ISO day keys. Implausible
  future deadlines are capped to their real gameplay horizon while malformed
  date keys and selectors safely fall back to defaults.
- Expanded the adversarial seeded-boot suite to **23/23** and behavior to
  **82/82**. Settings stayed 33/33, the frame soak stayed 600 clean, the
  read-only real-save reproduction stayed clean for 7,200 frames, and
  deterministic fuzz completed 1,200 frames with zero crashes or invariant
  violations.
- The isolated release passed input 23/23, network 23/23, save 89/89, photo
  71/71, log 33/33, and migration 24/24. The repacked artifact then completed
  the full **30/30 heartbeat GREEN** gate.
- Release rebuilt and portable repacked: exe SHA-256
  `AA55DC8EB59D9D77359130E375E593E41C69A1D3452DA64BFD718BA3A67DD597`
  (5,504,000 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `0999391F68999A8D950A87A8A600BD451ECA680BA06F6B4881463991587F9F8D`
  (2,248,787 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 121 (autonomous loop — bounded save collections)
- Bounded legacy/corrupt save collection scans before they can stall boot.
  Owned species, accessories, equipment, bond, names, shiny flags, and saved
  companions now inspect at most 4,096 entries (well above the real maximum
  of roughly 1,060), while companion restoration stops at `MAX_PALS`.
- Replaced repeated linear ownership lookups with bounded `Set` membership
  during load. Normal list ordering, duplicate removal, starter fallback,
  ownership gating, and repeated-species companion restoration remain intact.
- Added oversized 5,001-entry array and object cases proving valid entries
  placed beyond the scan budget cannot trigger late restoration. Seeded boot
  rose to **21/21** and the behavior suite to **80/80**.
- Frame soak stayed 600 clean, read-only real-save reproduction stayed clean
  for 7,200 frames, and deterministic fuzz completed 1,200 frames with zero
  crashes or invariant violations. The isolated release passed all policies;
  the repacked result finished **30/30 heartbeat GREEN**.
- Release rebuilt and portable repacked: exe SHA-256
  `DF82ABFD0BA476891B7371D75765BF349BDD814A239553B6F0A623EBE22445A3`
  (5,503,488 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `50C88F9B2DCD063F6278E9EB43785B4484B990C1A6F777BBBE1E4EAF6B4DD745`
  (2,248,562 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 120 (autonomous loop — truthful clipboard result)
- Fixed the settings `MY ID` row reporting `ID COPIED` even when Clipboard
  access threw synchronously or its Promise was rejected. Success is now
  announced only after `writeText` resolves; both failure forms produce the
  contained, visible `COPY FAILED` status without an unhandled rejection.
- Extended the real settings click harness to **33/33** with separate async
  denial, synchronous exception, and successful JP install-ID copy cases. The
  test also explicitly replaces Node 24's read-only navigator so every branch
  exercises the intended Clipboard stub rather than a missing API fallback.
- Behavior stayed 78/78, the frame soak stayed 600 clean, and the read-only
  real-save reproduction stayed clean for 7,200 frames. The isolated release
  passed input 23/23, network 23/23, save 89/89, photo 71/71, log 33/33, and
  migration 24/24; the repacked result finished **30/30 heartbeat GREEN**.
- Release rebuilt and portable repacked: exe SHA-256
  `6011BF875D546D672EC9E6B8C6F886547F03B2EC83260FB73EE703AAE6AE019E`
  (5,503,488 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `184080A612E11B011F8C7D800F1693C1D3CC7C2F307261D6AE17E841CCE2511E`
  (2,248,373 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 119 (autonomous loop — overflow-safe save sequence)
- Removed the unchecked rollback-checkpoint sequence increment. A checkpoint
  at `u64::MAX` previously panicked in debug and wrapped to zero in optimized
  release, weakening generation ordering; sequence exhaustion now returns a
  normal save error and leaves the batch dirty for retry/diagnosis.
- Added deterministic absent→1, 41→42, and MAX→error cases, raising the
  shipped save policy to **89/89**. The debug and optimized binaries both
  passed the same policy without panic or residue.
- The read-only real save stayed clean for 7,200 frames, behavior stayed
  78/78, and the frame soak stayed 600 clean. The isolated release passed all
  six direct policy suites before replacement; the repacked result then
  finished **30/30 heartbeat GREEN**, deterministic fuzz, all 60 pals, and
  cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `9CE04ECEF5CAE01C61FA53D894F7DA01D39F167D4D8C873594178FD30D8E39C2`
  (5,503,488 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `35D04870E61313873C75E7FAF136B38001D720830D6AEDF74F056103EA45D26C`
  (2,248,265 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 118 (autonomous loop — object-only save generations)
- Closed a load/save validation mismatch. Save writes already required a JSON
  object, but load accepted any syntactically valid JSON root; sealed or
  legacy `null`, arrays, and strings could therefore be adopted as a current
  generation and later replaced by default frontend state.
- Added one shared loaded-generation predicate that requires both the bounded
  object payload policy and the rollback checkpoint/watermark policy before a
  state or backup can be selected. Rejected bytes still follow the existing
  recovery-preservation path.
- Added four deterministic generation cases (valid object, null, array,
  string), raising the shipped save policy to **86/86**. The read-only real
  save stayed clean for 7,200 frames, behavior stayed 78/78, and the frame
  soak stayed 600 clean.
- The isolated release passed input 23/23, network 23/23, save 86/86, photo
  71/71, log 33/33, and migration 24/24 before replacement. The repacked
  result then finished **30/30 heartbeat GREEN**, deterministic fuzz, all 60
  pals, and cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `713D9FCAF9636F4D628EAB1C16CE245876198EEA01EF8DE0C927E94461F32231`
  (5,503,488 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `96255445ED81471F82BAC5EA05ED27BD1583BB8840A145E6E687C50A5E52433E`
  (2,247,940 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 117 (autonomous loop — fail-closed save load)
- Fixed rollback-watermark read failures being silently treated as sequence
  zero (first boot). Windows now opens the key read-only, distinguishes a
  genuinely absent key/value from access/query failures, validates `REG_SZ`
  type and bounded UTF-16 length, and rejects empty, malformed, or overflowing
  sequence text.
- `load_state` now propagates data-directory and registry failures. The
  frontend keeps saving locked until a load completes successfully, retains
  dirty state, and shows `LOAD FAILED`; this prevents a default in-memory
  ranch from overwriting an existing save after an unsafe load failure.
- Added four deterministic watermark-value cases (normal, `u64::MAX`, empty,
  malformed), raising the shipped save policy to **82/82**. Extended the
  settings/save harness to **30/30** with visible load failure, zero backend
  save calls while locked, and explicit recovery only after a safe load.
- Behavior stayed 78/78, the frame soak stayed 600 clean, and the read-only
  real-save reproduction stayed clean for 7,200 frames. The isolated release
  passed all six direct policy suites, then the repacked result finished
  **30/30 heartbeat GREEN**, deterministic fuzz, all 60 pals, and cleanboot.
- Release rebuilt and portable repacked: exe SHA-256
  `6F5C254F3EDA505393902CECC30EA32679A990E0ACB0CE3DCB82CBC816727524`
  (5,502,464 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `BADB3E8523765C28816F820930467C5302CC7CC45CDB57DE1BBA03D48D176225`
  (2,247,734 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 116 (autonomous loop — durable save retry)
- Fixed a silent save-loss path: `persist()` cleared `dirty` before IPC and
  left it false when the backend rejected a filesystem or registry write.
  Failed batches now restore `dirty=true`; the bounded five-second autosave
  loop suppresses the handled rejection and retries until a save succeeds.
- Windows rollback-watermark writes now check both registry-key acquisition
  and `RegSetValueExW` status. A denied write propagates through checkpoint
  creation and `save_state` instead of being reported as durable success.
  RESET registry deletion uses the same checked-status primitive.
- Added four deterministic registry status cases (success, denied write,
  missing-key clear, denied clear), raising the shipped save policy to
  **78/78**. Extended the settings/save harness to **27/27** with a simulated
  failure that restores dirty state followed by a successful clearing retry.
- Behavior stayed 78/78, the frame soak stayed 600 clean, and the read-only
  real-save reproduction stayed clean for 7,200 frames. The isolated release
  passed all six direct policy suites, then the repacked result finished
  **30/30 heartbeat GREEN**, deterministic fuzz, all 60 pals, and cleanboot.
- Release rebuilt and portable repacked: exe SHA-256
  `AF1E1F2B9EA3E36664D1ED44F3BC0F7C86A2E062F3DC9F9C56589A2098ED84B9`
  (5,499,392 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `4EADFC29F3F33482F363261BBA4FA9A9BD57255E18AEE3B3F0F3F97DB1BAE7B3`
  (2,245,451 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 115 (autonomous loop — fail-closed RESET)
- Fixed RESET falsely restarting after a denied or incomplete cleanup. The
  backend now treats every owned save/checkpoint/temp/photo/recovery/legacy
  deletion and registry-watermark removal as fallible, returns the exact
  failure, and restarts only after the entire cleanup plan succeeds.
- A failed RESET now clears the global reset flag before returning, so the
  still-running app can save and the user can retry instead of remaining
  permanently write-blocked. The frontend awaits the command rejection,
  unlocks the button, and shows `RESET FAILED` instead of silently claiming a
  fresh start.
- Added three deterministic cleanup-plan cases (exact ten-path plan, injected
  denial propagation, fail-fast boundary), raising the shipped save policy to
  **74/74**. Extended the real settings click harness to **25/25** for
  two-click arming, failed-reset retry/visibility, and successful dispatch.
- Behavior stayed 78/78, the frame soak stayed 600 clean, and the read-only
  real-save reproduction stayed clean for 7,200 frames. The isolated release
  also passed input 23/23, network 23/23, photo 71/71, log 33/33, migration
  24/24, then the repacked result finished **30/30 heartbeat GREEN**.
- Release rebuilt and portable repacked: exe SHA-256
  `3A2F59BF9FC27A7DD1D8ED0717C8A5A8FEC6815FA9B59FC2EC2773AC04157ABD`
  (5,498,880 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `A2D23CF76E97FCB4CB6E9E866ED2404D459F795903C1ABDD18AB8D1C97274069`
  (2,244,820 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp log, upload, or
  account action remained.

## Last session 114 (autonomous loop — truthful autostart state)
- Fixed the settings toggle claiming Windows startup was enabled after the
  backend rejected the registry operation. The optimistic UI now rolls back
  to its prior value, persists that truthful state, and shows `STARTUP FAILED`
  for an interactive failure. A failed boot-time path heal silently falls
  back to OFF instead of saving a false promise.
- Serialized autostart OS mutations and attached a monotonically increasing
  request ID. Rapid ON/OFF input can no longer let a slow older registry
  success land last, while an older failure cannot undo the newer UI choice.
- Extended the real settings click-path harness to **21/21** checks covering
  volume behavior, serialized rapid toggles, stale-failure handling, current
  failure rollback/notification, successful enable, exact backend choices,
  and persistence. Behavior stayed 78/78, the frame soak stayed 600 clean,
  and the read-only real-save reproduction stayed clean for 7,200 frames.
- The isolated optimized binary passed its six direct policy suites before
  being copied: input 23/23, network 23/23, save 71/71, photo 71/71, log
  33/33, and migration 24/24. The repacked final result was **30/30 heartbeat
  GREEN**, including deterministic fuzz, all 60 pals, and cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `1C0CC36A5B4595FFA58F77CEE46E2223443284A67A9A359EB5072781EE808F6A`
  (5,488,640 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `33A4463E5144FA8198D43A6C7CFF30436C5AE9E9C578F3C71905F96AD8BDC16F`
  (2,241,179 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 113 (autonomous loop — checked OS command status)
- Fixed false-success reporting from OS helper commands. Windows autostart
  previously awaited `reg.exe` output but ignored its exit status, so access,
  syntax, or registry failures were returned to the frontend as success.
- Added a checked child-status primitive that discards stdout/stderr, avoids
  output buffering, and returns an error for every nonzero exit. Windows Run
  key add/delete now uses it. The macOS LaunchAgent path was aligned with the
  existing regular-directory and atomic hard-link-safe file primitives for
  create/update/removal.
- Extended the shipped network/process policy from 21 to **23/23** using the
  current executable as deterministic exit-0 and exit-7 children. Debug and
  optimized release both accepted success and rejected failure exactly, with
  no process or temp residue.
- The old EXE was first proven stale and the expected pre-release pulse was
  28/30 with only package/network-policy failures. After rebuilding and
  repacking, the final result was **30/30 heartbeat GREEN**, including input
  23/23, save 71/71, photo 71/71, log 33/33, migration 24/24, behavior 78/78,
  deterministic fuzz, all 60 pals, and cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `B5048D81DC5E7D2F6B38E5DAFAECA71A15BDADAEE411EEBFE62A479F5A98801B`
  (5,488,128 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `901F55073EA2302A446B03376C2F735B11B30E470F4343EB816BC444E518FA9E`
  (2,241,001 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 112 (autonomous loop — serialized RESET/save/load)
- Closed a real save-resurrection race. `RESETTING` rejected saves that began
  after RESET, but an in-flight `save_state` that had already passed the flag
  could still land its generation after RESET deleted the files.
- Added one recoverable save-I/O mutex shared by save, load, and RESET. Saves
  check the sequentially-consistent RESET flag only after acquiring it; RESET
  sets the flag first, waits for any active generation to finish, then deletes
  last while holding the same lock. Loads can no longer inspect or preserve an
  intermediate save/checkpoint generation.
- Extended the shipped save policy from 68 to **71/71** with deterministic
  threaded schedules for an already-running save, RESET's final deletion, and
  a queued save rejected after RESET. Debug and optimized release passed with
  no residue; the read-only real-state repro completed 7,200 clean frames.
- The old EXE was first proven stale and the expected pre-release pulse was
  28/30 with only package/save-policy failures. After rebuilding and
  repacking, the final result was **30/30 heartbeat GREEN**, including input
  23/23, photo 71/71, log 33/33, migration 24/24, network 21/21, behavior
  78/78, deterministic fuzz, all 60 pals, and cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `12AE15C5393E4950ED6BB93D28AECD66708D0E929EB93D2DDF687320183E2838`
  (5,486,592 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `326D38786CEE2BA784A741B497AD1C4F39056296286990CEC104768ECCA64FDF`
  (2,240,569 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 111 (autonomous loop — panic-resistant runtime setup/locks)
- Removed product-path `unwrap()` crash points from required main-window and
  tray-icon setup. Missing runtime resources now return an explicit setup
  error instead of panicking. Shared monitor, clickable, last-save, and crash
  log mutexes now recover their guarded value after poisoning rather than
  causing a permanent chain of follow-up panics or disabling diagnostics.
- Extended the shipped input/runtime policy from 20 to **23/23** with mutex
  error-branch recovery plus required-value present/missing cases. The first
  release-only run exposed that an initial self-test implementation created a
  real panic: debug unwound and caught it, but release `panic=abort` exited
  with `0xC0000409`. That binary was never copied or packaged. The test was
  replaced with a directly constructed `PoisonError`, then both debug and
  release passed without panic.
- The expected pre-release pulse was 28/30 with only package/input-policy
  stale failures. After the corrected rebuild and repack, the final result was
  **30/30 heartbeat GREEN**, including isolated real-EXE cleanboot 11/11,
  save 68/68, photo 71/71, log 33/33, migration 24/24, network 21/21,
  behavior 78/78, deterministic fuzz, and all 60 pals.
- Release rebuilt and portable repacked: exe SHA-256
  `E60ECC7F7D919CBF918FB3DF852B7F8BDDE77D83C8E6026F97DB79FF631CC93F`
  (5,475,328 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `C4ACB92D3A984AC0ECD26065A8DF08012641AF86FF6ECD2DD9652145EE0C6439`
  (2,235,064 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 110 (autonomous loop — overflow-safe input polling)
- Hardened the always-running 30 ms cursor/click-through loop against integer
  overflow. Its `u32` cadence tick and held-button divergence counter used
  ordinary addition, while the global `i32` press count used `fetch_add`; an
  extremely long session or pathological missing-release stream could wrap
  them and temporarily defeat cadence or held-gesture protection.
- Poll cadence now advances with explicit wrapping semantics, the divergence
  watchdog saturates, and both press/release transitions clamp and saturate at
  zero/`i32::MAX`. Normal input timing and the existing ~2 second leaked-button
  escape remain unchanged.
- Extended the shipped input-policy CLI from 12 to **20/20** with `i32::MIN`,
  `i32::MAX`, `u32::MAX`, normal press/release, saturated stall, and reset
  boundary cases. Debug and optimized release policy runs passed.
- The old EXE was first proven stale and the expected pre-release pulse was
  28/30 with only package/input-policy failures. After rebuilding and
  repacking, the final result was **30/30 heartbeat GREEN**, including save
  68/68, photo 71/71, log 33/33, migration 24/24, network 21/21, behavior
  78/78, deterministic fuzz, all 60 pals, and cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `D6B8E1BE3D9F56EF9ABB928CF30E186F0713C9D66C06A8223CE42E22279650F6`
  (5,475,328 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `CEAA10429A950764D6E9B1662BBB985ADD195921AF330413A910E71014FC40E3`
  (2,235,338 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 109 (autonomous loop — non-recursive temp leaves)
- Narrowed cleanup for atomic-write temp paths. The shared writer and legacy
  copier previously called the RESET-oriented tree remover; if an exact
  predictable `.tmp` leaf had been replaced by a normal non-empty directory,
  Jellypal would recursively delete that directory before writing.
- Added a file-leaf-only no-follow remover. Regular files and reparse entries
  are safely unlinked, absent leaves remain idempotent, but ordinary
  directories now fail closed without deleting their contents. Atomic write
  error cleanup and migration staging both use the same narrow primitive;
  recursive removal remains only where RESET explicitly owns a tree.
- Extended shipped policies to save **68/68**, photo **71/71**, and migration
  **24/24**. Real filesystem cases place non-empty directories at save,
  photo, and migration temp leaves, verify the operations reject them, and
  prove every `KEEP` file and absent final destination remains intact. Debug
  and release runs left no test residue.
- The old EXE was first proven stale and the expected pre-release pulse was
  26/30 with only package/save/photo/migration-policy failures. After rebuild
  and repack, the final result was **30/30 heartbeat GREEN**, including log
  33/33, network 21/21, behavior 78/78, deterministic fuzz, all 60 pals, and
  isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `CFDF352F61BC25F4CD8AB56A601B1A679DE24B6B33282707C4CE826AE9AB7B49`
  (5,475,328 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `C97A6B85836755B92E1BF02E247C6F8DA610D92598F93A9483C596A0679D6456`
  (2,235,253 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 108 (autonomous loop — bounded atomic panic log)
- Closed the last Windows product-path direct diagnostic overwrite. The panic
  hook wrote `%TEMP%\\jellypal-panic.log` with `std::fs::write`, so a planted
  hard link at that predictable leaf could mutate an outside file precisely
  while the app was already handling a failure.
- Panic diagnostics now pass through the same 4 KiB/8,192-character printable
  one-record formatter as crash reports and the shared safe-temp + atomic
  regular-file replacement. Newlines/control characters cannot forge records,
  oversized messages are marked truncated, and both final and `.tmp` hard
  links are replaced locally without changing their other link.
- Extended the shipped log policy from 24 to **33/33**. Nine new real NTFS
  cases cover normal normalization, oversized panic bounding, final-target
  hard-link isolation, temp hard-link isolation/removal, and exact local
  replacement. Debug and release runs left no policy or panic temp residue.
- The old EXE was first proven stale and the expected pre-release pulse was
  28/30 with only package/log-policy failures. After rebuilding and repacking,
  the final result was **30/30 heartbeat GREEN**, including save 65/65, photo
  69/69, migration 21/21, network 21/21, behavior 78/78, deterministic fuzz,
  all 60 pals, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `B4B4374A3C8E6A3EFA19F1A9CC606EF29CEC08B503019260D5884C12DDA0DC1A`
  (5,471,744 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `39F7EFDD61382576D4D66CBCB7C0D5FCCAD484AD9622E013945EF5966E775EBF`
  (2,233,755 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 107 (autonomous loop — regular data-root containment)
- Closed a containment gap above the hardened save/photo/log leaves. The
  Tauri app-data path was previously returned without validating the root
  itself, so replacing `com.jellypal.desktop` with a junction could make all
  otherwise-safe child operations run inside its external target.
- Every production and marker-gated test `data_dir` resolution now creates or
  accepts only a non-reparse regular directory. A file, symlink, or Windows
  junction at the data root fails closed before save, load, recovery, photo,
  migration, or diagnostic work proceeds.
- Extended the shipped save policy from 56 to **65/65**. Nine new real
  filesystem cases cover root creation/reuse, file rejection, an actual NTFS
  junction, and preservation of the outside sentinel. The debug and release
  policies left no residue; the read-only real-state repro also completed
  7,200 clean frames.
- The old EXE was first proven stale and the expected pre-release pulse was
  28/30 with only package/save-policy failures. After rebuilding and
  repacking, the final result was **30/30 heartbeat GREEN**, including photo
  69/69, migration 21/21, network 21/21, log 24/24, behavior 78/78,
  deterministic fuzz, all 60 pals, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `E82BE757149BC43D3E86ACB73CC365473A6A235053BC54764D90DBFB93CA07A8`
  (5,468,160 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `50B77B01003F4A59548742ADFAD4C6E57228B7EF368BC4FD34BC5F4210FFAFD0`
  (2,232,556 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 106 (autonomous loop — bounded opened-file reads)
- Closed a read-side growth race shared by save, recovery, crash-log, and
  photo loading. The code previously checked path metadata and then called
  `std::fs::read`; a concurrently growing file could make that second step
  allocate/read beyond the declared policy before the post-read rejection.
- The shared regular-file reader now opens the file, validates metadata from
  the opened handle, and streams only `max + 1` bytes into an 8 KiB-initial
  buffer. Exact-bound reads succeed and the first excess byte fails without
  an unbounded allocation. Stable reparse/non-file and pre-open oversize
  checks remain in place.
- Photo loading now uses that shared reader before PNG structural validation.
  Extended the shipped save policy from 54 to **56/56** with exact/overflow
  bounded-stream cases, and photo policy from 65 to **69/69** with valid read,
  undersize, structurally invalid, and 48 MiB + 1 sparse-file rejection.
  Debug and release policy runs left no test residue.
- The old EXE was first proven stale and the expected pre-release pulse was
  27/30 with only package/save/photo-policy failures. After rebuilding and
  repacking, the final result was **30/30 heartbeat GREEN**, including
  migration 21/21, network 21/21, log 24/24, behavior 78/78, deterministic
  fuzz, all 60 pals, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `A4B8C81A82B841083BD7277F485516334379076AB74D342E7183EE564D9403F8`
  (5,464,064 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `511D7D9D018B0022AE8AC6E1F4F9EB8AFE83013D64A12511BE6BBC554C39959D`
  (2,230,817 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 105 (autonomous loop — bounded atomic legacy copy)
- Closed the remaining hard-link overwrite in legacy-profile migration.
  `std::fs::copy` previously wrote directly through an existing regular-file
  destination, so a planted hard link in the new profile could mutate an
  outside file during first-boot adoption.
- Added a bounded streaming copy primitive that validates the source before
  and after opening, reads at most one byte beyond a **64 MiB** per-file cap,
  stages into an exact-leaf `create_new` temp, syncs it, and atomically replaces
  only a regular or absent destination. Stale temp links are unlinked without
  following them and partial/error temps are cleaned up.
- Extended the shipped migration-policy CLI from 13 to **21/21**. New real
  NTFS cases plant hard links at both the final destination and its `.tmp`
  leaf, prove both outside sentinels retain their bytes, verify the migrated
  destination content, and use a 64 MiB + 1 sparse source to prove oversized
  entries are skipped. Debug and release runs left no test residue.
- The old EXE was first proven stale and the expected pre-release pulse was
  28/30 with only package/migration-policy failures. After rebuilding and
  repacking, the final result was **30/30 heartbeat GREEN**, including photo
  policy 65/65, save 54/54, network 21/21, log 24/24, behavior 78/78,
  deterministic fuzz, all 60 pals, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `2EA15D994E34C377AA48CC2A4C7F6911A5D37E5DDFF5BD8056EF808075BB1837`
  (5,460,992 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `44E27C7C67EDB80E6302286A58F6C7083211D08157EEC511EFC422886A23D1C9`
  (2,230,061 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 104 (autonomous loop — atomic photo writes)
- Closed the remaining hard-link overwrite path in `save_png`. A valid PNG
  previously reached `std::fs::write` after a shallow regular-file check, so
  an existing hard-linked photo leaf could mutate the other link's bytes.
- Added `save_photo_file`, which accepts only an absent or non-reparse regular
  destination and commits through the shared safe-temp + atomic-replacement
  primitive. PNG decoding and structural/dimension validation still happen
  before any filesystem change; directory, symlink, and reparse targets remain
  rejected.
- Extended the shipped photo-policy CLI from 55 to **65/65**. Ten real
  filesystem cases cover a valid new photo, final-target hard-link isolation,
  planted `.tmp` hard-link isolation/removal, byte-exact output, and directory
  rejection. The debug and release policies passed with no test residue.
- The old EXE was first proven stale and the expected pre-release pulse was
  28/30 with only package/photo-policy failures. After rebuilding and
  repacking, the final result was **30/30 heartbeat GREEN**, including save
  policy 54/54, network 21/21, log 24/24, behavior 78/78, deterministic fuzz,
  all 60 pals, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `47403C4623C445F826F3D10CC4389BB2EC6268D4F2C71294961E2F7DBEFDC6F0`
  (5,454,848 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `6D49FBAA94C813EB25F69D9F0366F84C3E4A8DAE978AABC2BBC14974D4F4F7DE`
  (2,227,311 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 103 (autonomous loop — atomic diagnostic writes)
- Closed hard-link overwrite paths in always-on diagnostics. `crash.log` was
  opened in append/truncate mode on every heartbeat/error and `clickdbg.json`
  was overwritten about once per second, so a planted hard link could mutate
  an external file continuously even though symlinks/directories were already
  rejected.
- Added a shared atomic regular-file writer: the exact temp leaf is safely
  unlinked, recreated with `create_new`, then renamed over only a regular or
  absent destination. Replacement of a hard-linked destination changes only
  Jellypal's directory entry; the other link retains its original bytes.
- Crash logging now builds a bounded next generation in memory and atomically
  replaces the file rather than opening it for mutation. The existing 256 KiB
  ceiling, latest-tail rotation, record normalization, and serialized writers
  remain intact. `clickdbg.json` and the rare global-hook failure log use the
  same primitive.
- Extended the shipped log-policy CLI from 16 to **24/24**. New real NTFS
  cases place hard links at both the final log and its `.tmp` path, append two
  records, and prove both outside `KEEP` sentinels remain byte-identical while
  the Jellypal log advances. Debug and release policies passed with no temp
  residue.
- The old EXE was first proven stale and the expected pre-release pulse was
  28/30 with only package/log-policy failures. After rebuilding and repacking,
  the final result was **30/30 heartbeat GREEN**, including save policy 54/54,
  behavior 78/78, deterministic fuzz, all 60 pals, and isolated real-EXE
  cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `8B847E8B0C1DB26E5F420A4640D25B503613D7AE21FBDEC3E3055134A556D7E6`
  (5,451,264 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `B8FDC158E0978764D664DCB6D8E987ABA22D4848655FF725DF12DA16AE4A72D6`
  (2,225,400 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no diagnostic temp, app/test process, pulse lock,
  upload, or account action remained.

## Last session 102 (autonomous loop — contained save-file leaves)
- Closed file-level save/recovery escapes left after directory hardening.
  `state.json.tmp`, backup, and checkpoint writes previously opened existing
  leaf entries directly, so a planted hard link/symlink could be truncated;
  rejected-save preservation also accepted a `recovery` junction.
- Save/checkpoint temp files now unlink the exact stale entry first and use
  `create_new`; backups are staged through their own temp and atomically
  replace only a regular/absent destination. All persistent destinations are
  preflighted before the generation changes, checkpoint failure is propagated
  before the registry watermark advances, and RESET also removes the new
  backup temp safely.
- Load and recovery reads now require non-reparse regular files and are capped
  at **24 MiB** for DPAPI/Base64 saves and **4 KiB** for checkpoints. Recovery
  requires a regular leaf directory and creates content-derived artifacts with
  `create_new`, so an existing link or collision is never followed or
  overwritten.
- Extended the shipped save-policy CLI from 33 to **54/54**. The 21 new actual
  filesystem cases exercise exact/oversize reads, directories and invalid
  UTF-8, stale-temp and final-target hard links, atomic replacement, a real
  Windows recovery junction, outside-sentinel preservation, regular recovery,
  and idempotency. Debug and release policies passed with no temp residue;
  the real-state 7,200-frame DPAPI repro also stayed clean.
- The old EXE was first proven stale and the expected pre-release pulse was
  28/30 with only package/save-policy failures. After rebuilding and repacking,
  the final result was **30/30 heartbeat GREEN**, including real-EXE isolated
  cleanboot 11/11, behavior 78/78, deterministic fuzz, and all 60 pals.
- Release rebuilt and portable repacked: exe SHA-256
  `B6BB8F52411B2C8945C076BE383279E38B2F8E3DA36AF207D4AB43E3091CC084`
  (5,449,728 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `65A9903DBA47376D5012326222A73D1621839C602788E3AB042A11B92059CC8F`
  (2,224,440 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 101 (autonomous loop — bounded network command surfaces)
- Closed unbounded network command paths. The Rust backend previously trusted
  frontend UID/code/ACK sizes and used `Command::output()` for curl, which
  buffered an endpoint's entire stdout before checking even the tiny update
  payload.
- Added exact install-UID/base32 nonce/signature validation, a 160-byte redeem
  input ceiling, a 2,048-byte printable HTTPS URL contract, at most 256 ACK
  entries scanned/64 unique valid nonces sent, and at most 64 grants processed
  per claim. Oversized or malformed requests now fail before spawning curl.
- Replaced unbounded curl capture with a shared piped reader that reads only
  one byte past its policy and kills/reaps an oversized child. Server replies
  are capped at 256 KiB, weather replies at 64 KiB, and update replies at 64
  bytes before JSON/text parsing; invalid UTF-8 is rejected instead of lossily
  expanded.
- Added a new shipped `_networkpolicy.cjs` gate with **21/21** cases covering
  UID/code/nonce/signature/URL boundaries, ACK dedupe and scan/result limits,
  plus real small and overflowing child-process stdout. Existing signed-code
  checks remained 11/11 and worker purchase/grant tests 24/24.
- HEARTBEAT now has 30 gates. The old EXE was first proven stale and the
  expected pre-release pulse was 28/30 with only package/network failures.
  After rebuilding and repacking, the final result was **30/30 heartbeat
  GREEN**, including behavior 78/78, deterministic fuzz, all 60 pals, and
  isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `AE6A514E2CAD7E5D6EC8C7D6CC1E2F7421DB19192485B1E99B00DEF6D66098D2`
  (5,435,392 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `26E3353E3A42A7A32C52EE8F92AE701AA566CC73B0352D8CD67292A93B6A9AA2`
  (2,216,664 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, upload, or account
  action remained.

## Last session 100 (autonomous loop — bounded clickable geometry)
- Hardened the 30 Hz Rust click-through poll against malformed or runaway
  frontend geometry. `set_clickable` previously retained every supplied rect
  and the global cursor thread walked the whole vector forever, while NaN,
  infinity, zero/negative dimensions, and extreme coordinates had no explicit
  contract.
- Added a shared sanitizer that preserves order but retains at most **64**
  rectangles, requires four finite values within +/-1,000,000 logical pixels,
  and rejects non-positive widths/heights. Normal Jellypal batches remain well
  below the ceiling.
- Added a new shipped `--self-test-input-policy` path and `_inputpolicy.cjs`
  gate with **12/12** boundary cases: empty/valid batches, NaN/infinity,
  zero/negative sizes, excessive coordinates/dimensions, exact boundary, and
  a 74-rect flood truncated deterministically at 64. The 600-frame frontend
  soak independently verifies its emitted rect batches against the same
  contract (`clickable geometry clean`).
- HEARTBEAT now has 29 gates. The old EXE was first proven stale and the
  expected pre-release pulse was 27/29 with only package/input-policy failures.
  After rebuilding and repacking, the final result was **29/29 heartbeat
  GREEN**, including behavior 78/78, deterministic fuzz, all 60 pals, and
  isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `81BBBA2F674BF7F41DA64DA3B93FE1D9CE1E2DBFD64B78B79850DB68A4A5C83F`
  (5,425,664 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `EB941709E8282527F7782BE2042ED65407B772ED732F38DF2B7E56C564CB67E3`
  (2,211,840 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, upload, or account
  action remained.

## Last session 99 (autonomous loop — contained destructive RESET cleanup)
- Hardened Settings > RESET around externally replaceable directories. The
  photos, recovery, and legacy-profile paths previously went straight to
  recursive deletion without a shipped test defining Windows junction
  behavior.
- Added one shared no-follow cleanup primitive. Regular directories/files are
  removed as intended, missing targets are idempotent, and a root
  symlink/reparse point is unlinked as an entry instead of traversing its
  target. All three RESET directory families now use it.
- Extended the shipped save-policy CLI from 23 to **33/33** with a real
  temporary Windows filesystem matrix: a normal tree containing a nested
  junction, a root junction, an unexpected regular file, and an absent target.
  Both junctions were removed without touching the outside `KEEP` sentinel,
  and no temporary policy tree remained. The old EXE was first proven stale;
  debug and target release policy runs exited 0.
- The expected stale-artifact pulse was 26/28 with only package/save-policy
  failures. After rebuilding and repacking, the final result was **28/28
  heartbeat GREEN**, including photo policy 55/55, behavior 78/78,
  deterministic fuzz, all 60 pals, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `352F0BA7F263E9169CDD49B83BFF95E3F0FFFE5007B02AAC2608A84015E75521`
  (5,424,128 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `EFC6E6DB56AACED63DD7BBD16135E980DC6BF107469D96F5A7D513D2770D7D9C`
  (2,211,202 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no app/test process, pulse lock, temp tree, upload, or
  account action remained.

## Last session 98 (autonomous loop — bounded photo catalog work)
- Closed the remaining unbounded album-open path. `list_photos` previously
  walked every directory entry and collected every eligible name before
  sorting, so an externally flooded photos folder could consume arbitrary IPC
  time and memory even though image decoding itself was already windowed.
- The backend now scans at most **16,384** directory entries and returns at
  most **4,096** lexicographically newest eligible names. Invalid entries and
  read errors consume the scan budget, while a fixed-size min-heap keeps result
  memory bounded and preserves the existing sorted album contract.
- Extended the shipped photo-policy CLI from 46 to **55/55**. It now exercises
  real-directory filtering and catalog truncation, invalid-entry scan-budget
  accounting, zero limits, newest-name retention, and a 16,394-entry synthetic
  load proving the production scan/catalog boundaries (12,288..16,383 kept).
  The old EXE was first proven stale; the new debug and release EXEs passed.
- The expected stale-artifact pulse was 26/28 with only package/photo-policy
  failures. After rebuilding and repacking, the final result was **28/28
  heartbeat GREEN**, including behavior 78/78, deterministic fuzz, all 60
  pals, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `B51447B05A439B0156C4BF1D788ED68D87DB8285228C1611201634539F137DD1`
  (5,419,520 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `2AD9E2B47108EF9DA8F77C09AE8BAC8B4EBF31DF04589C70C761C0F854786EC9`
  (2,209,978 bytes). Real state/checkpoint/crash and all four photo hashes
  remained unchanged; no temp policy tree, app/test process, upload, or account
  action remained.

## Last session 97 (autonomous loop — contained photo-directory root)
- Closed a parent-directory escape left after file-level photo hardening. If
  `%APPDATA%/.../photos` itself was replaced by a Windows junction, every child
  still appeared to be a regular file, so list/load/save/delete/open could act
  on PNGs outside Jellypal's data directory.
- All five photo operations now share a leaf-directory validator. Existing
  folders must be real directories with no symlink/reparse attribute; create
  paths make exactly the missing leaf and verify it again before use. Unsafe
  files, links, junctions, and missing read-only roots fail closed.
- Extended the shipped photo-policy CLI from 38 to **46/46** with eight
  filesystem cases: absent read rejection, safe creation/reopen, file-path
  rejection for read and write, and a real temporary Windows junction rejected
  in both modes while its outside sentinel remains unchanged. Debug, target
  release, and copied release all passed, and every temp junction was removed.
- The old EXE was first proven stale (`exit=2`). The expected stale-artifact
  pulse was 26/28 with only package/photo-policy failures; after rebuild the
  final result was **28/28 heartbeat GREEN**, including behavior 78/78,
  deterministic fuzz, all 60 pals, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `F412D613557FE2C7992ADC3F854ABDE0D906395EE7F01FA4E33796C65B2CFE7A`
  (5,410,304 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `1B459C229A47B8520AC0AD9066A5580CA6B617FDE3DBA6B9AA7113CB096E5B86`
  (2,205,711 bytes). The real photos directory remained a regular directory;
  state/checkpoint/crash and all four photo hashes were unchanged. No app/test
  process, upload, or account action remained.

## Last session 96 (autonomous loop — contained PNG decode surfaces)
- Strengthened photo payload validation beyond the prior eight-byte signature.
  Save and load now require a valid first IHDR, supported bit-depth/color mode,
  continuous nonempty IDAT data, a terminal exact-length IEND, alphabetic chunk
  names, no unknown critical chunks, bounded chunk count, and overflow-safe
  chunk lengths. Malformed structure never reaches the browser decoder.
- Preserved the existing 64 MiB Base64 contract (about 48 MiB decoded) while
  bounding each dimension to 16,384 and the image surface to 64 megapixels.
  Album listing filters out files outside the raw-size policy, and `load_photo`
  checks regular-file metadata/size before reading, then revalidates the full
  structure before allocating its returned Base64 string.
- Expanded the shipped photo-policy CLI from 21 to **38/38**. New cases cover
  a real minimal PNG, signature-only/truncated data, zero/oversize dimensions,
  exact and excessive pixel surfaces, invalid color/compression/filter/
  interlace fields, malformed IHDR/chunk types/lengths, missing IDAT/IEND,
  unknown critical chunks, and trailing bytes. The prior EXE was first proven
  stale (`exit=2`); debug, target release, and copied release all passed.
- Audited all four real photos separately end-to-end: each is 440x320, has 29
  complete chunks and 27 IDAT chunks, and ends exactly at IEND. The expected
  stale-artifact pulse was 26/28 with only package/photo-policy failures; after
  rebuild the final result was **28/28 heartbeat GREEN**, with behavior 78/78,
  deterministic fuzz, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `A93A63F12012861FFC6A2711E83F9C2DAF99178DA78958531A000A3549820212`
  (5,408,256 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `B8F6FEBC90B59FB670304E9B13A37630D8EA35CB5A5CAD94B9250FFAF33CABE4`
  (2,204,949 bytes). Real state/checkpoint/crash and photo hashes were
  unchanged; no app/test process remained and no upload or account action
  occurred.

## Last session 95 (autonomous loop — bounded photo-album memory)
- Fixed the album's unbounded eager load. Opening it previously invoked
  `load_photo` and created a Base64-backed `Image` for every saved PNG at once,
  so ordinary photo history made memory and IPC traffic grow linearly.
- The album now keeps only current/previous/next images. A replaceable queue
  serializes backend photo reads to one active IPC; fast navigation discards an
  obsolete result and replaces pending work with the latest three-photo window
  instead of accumulating concurrent large Base64 responses. New-shot, arrow,
  card-click, and post-delete paths all refresh through the same cache manager.
- Added `_fresh.cjs album` to the integrated behavior gate. Its **7/7** driven
  simulation opens 100 photos, proves only one initial/in-flight request,
  resolves the three-image window, performs 50 rapid real navigation clicks,
  verifies the exact bounded cache, deletes through the two-click UI, and sees
  zero crash diagnostics. Integrated verification rose from 71 to **78/78**.
- The expected stale-artifact pulse was 27/28 with only package freshness
  failing. After the frontend-embedded release rebuild and repack, the final
  result was **28/28 heartbeat GREEN**, including all four backend policy CLIs,
  deterministic fuzz, all 60 pals, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `577672919C18C443354D0100F64C4936172618295D5B8B12D92904D286402575`
  (5,404,672 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `487A9718EA74923232940E6E4454E890ED21483B3B5F7387EB6FA6BE4DB98FD9`
  (2,203,586 bytes). Real state/checkpoint/crash and all four photo files were
  unchanged; no app/test process remained and no upload or account action
  occurred.

## Last session 94 (autonomous loop — contained legacy-profile migration)
- Replaced identifier migration's link-following recursive copy. The old
  `is_dir()` path followed Windows junctions/symlinks, so a legacy profile
  containing a loop could recurse during setup and wedge the first launch.
- The new best-effort copier uses `symlink_metadata`, rejects symlinks and all
  Windows reparse points on both source and destination, copies only regular
  files/directories, caps nesting at eight levels, and skips one malformed
  entry without preventing safe siblings from migrating.
- Added shipped-exe CLI `--self-test-migration-policy` and
  `_migrationpolicy.cjs`. Its **13/13** matrix creates a real temporary Windows
  junction and proves it is neither traversed nor accepted as a root; it also
  covers safe state/photo copies, depth containment, destination directory
  collision preservation, skip accounting, missing/invalid roots, and cleanup.
  The old EXE was first proven stale (`exit=2`); debug, target release, and
  copied release binaries all passed the new policy plus save/photo/log CLIs.
- Persistence regression used the real DPAPI state in memory for 7,200 clean
  frames with identical state/checkpoint/crash hashes before and after. The
  expected stale-artifact pulse was 26/28 with only package/migration failures;
  after rebuild the final result was **28/28 heartbeat GREEN**, including
  isolated real-EXE cleanboot 11/11 and deterministic fuzz.
- Release rebuilt and portable repacked: exe SHA-256
  `92F8F4524791516050A16EFD9CCEB155C88F59ACC252F473A9324B072AAB1501`
  (5,404,160 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `BA48C235B7EFF79C6B221089208456AD960432227058DA411018BCF0075AB9F6`
  (2,203,194 bytes). The real profile was unchanged; recovery/legacy dirs,
  migration temp dirs, and app/test processes were absent. No upload or account
  action occurred.

## Last session 93 (autonomous loop — validated, bounded save writes)
- Closed the backend's unchecked-save write path. `save_state` now rejects an
  invalid JSON document, any non-object root (`null`, arrays, numbers, strings),
  and payloads over 16 MiB before creating `state.json.tmp`, copying the last
  good state to `.bak`, or advancing the checkpoint/watermark chain.
- Measured a deliberately maximized sanitized v2 state — 1,000 hybrids, 64,000
  decoration pixels, 2,000 maximum-length redeem records, and full owned-key
  maps — at 1,839,477 bytes (1.754 MiB). The 16 MiB ceiling therefore leaves
  roughly 9x product-growth headroom rather than narrowing valid saves.
- Extended the shipped save-policy CLI from 14 to **23/23**. The nine new
  cases cover normal/whitespace objects, empty and malformed JSON, `null`,
  array and scalar roots, an exactly-16-MiB valid object, and a 16-MiB+1
  rejection. The old EXE was first proven stale (`exit=2`); debug, target
  release, and copied release binaries then passed the revised policy.
- Because persistence changed, `_repro.cjs` loaded the real DPAPI save in
  memory and ran 7,200 frames clean; state/checkpoint/crash hashes were equal
  before and after. The expected stale-artifact pulse was 25/27 with only
  package/save-policy failures; after rebuild the final result was **27/27
  heartbeat GREEN**, including isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `F387548B4D97C76E9CD7FE8B0420E5C616F7346257C7EF89A9D31110A9BC580E`
  (5,395,456 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `D6DE9EDF7EE1C831FA46290EE6BBE3D6A74FAB9A159C65D67F1658F7D8B3827C`
  (2,199,350 bytes). The real profile and recovery state were unchanged;
  no app/test process or policy temp directory remained, and no upload or
  account action occurred.

## Last session 92 (autonomous loop — bounded forensic crash logging)
- Replaced the backend crash logger's post-write wipe with bounded, serialized
  records and tail-preserving compaction. Each message now scans at most 8,192
  characters, emits at most 4 KiB of body text, preserves UTF-8 boundaries,
  flattens CR/LF runs, replaces other control characters, and marks truncation.
- Log rotation now retains roughly 192 KiB of the newest complete records plus
  the new diagnostic under a 256 KiB ceiling instead of deleting both history
  and the triggering error. A mutex prevents concurrent rotation/appends from
  losing each other, and non-regular `crash.log` targets are rejected.
- Added shipped-exe CLI `--self-test-log-policy` and `_logpolicy.cjs`. Its
  **16/16** matrix covers normal append, CR/LF/control flattening, multibyte and
  newline-bomb bounds, tail retention, new-record retention, size ceiling, and
  non-file rejection. The wrapper first proved the prior EXE stale (`exit=2`),
  then the newly linked target and copied release each passed all three backend
  policy CLIs (save 14/14, photo 21/21, log 16/16).
- Promoted the log policy to the heartbeat/watch contract. The expected stale-
  artifact pulse was 25/27 with only package/log-policy failures; after release
  rebuild and repack the final result was **27/27 heartbeat GREEN**, including
  deterministic fuzz, all 60 pals, and isolated real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `49B149F41DBAC028CC4E04F7E378A4674577ACE4A629A7A970698C3A070E42B1`
  (5,392,896 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `69F8D986EF6419F9D5AB5DA1333B683492E04AEFAEACC5C568408D274BB4C5C7`
  (2,195,765 bytes). Real state/checkpoint/crash-log hashes were unchanged;
  policy temp directories and app/test processes were absent; no app launch
  against the real profile, upload, or account action occurred.

## Last session 91 (autonomous loop — contained photo filesystem policy)
- Hardened Rust photo commands around a shared filename contract. Saves now
  accept only 1..80 ASCII alphanumeric/`-`/`_` stems; loads/deletes require
  the same leaf plus a lowercase `.png`. Traversal, dot names, separators,
  drive punctuation, Unicode lookalikes, extra extensions, and sanitizer
  collisions are rejected instead of being rewritten to another filename.
- Album listing exposes only validated regular files. Load/delete reject
  directories and symbolic links, and save refuses a non-regular existing
  target. PNG writes now require strict base64, a 64 MiB encoded-size ceiling,
  and the eight-byte PNG signature instead of accepting arbitrary bytes.
- Added shipped-exe CLI `--self-test-photo-policy` and checkout-relative
  `_photopolicy.cjs`; its **21/21** matrix covers valid app names, traversal/
  punctuation/length/extension rejections, valid PNG bytes, malformed base64,
  and non-PNG payloads. The wrapper proved the prior EXE fails closed (`exit=2`)
  before rebuild. Promoted the check to HEARTBEAT/watch and documented it.
- Verification: Rust compile clean, target save policy 14/14 and photo policy
  21/21, package preflight 10/10, and final **26/26 heartbeat GREEN** including
  real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `FABFA829A4FF89297134CEDA69117A87B0C8B7BC294B42514D9EDCE9FE363329`
  (5,384,192 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `71BC5EBA3456CCD4CADAC8A8D7E7C1F6FF8D4AB2BCAC14B63F21EA285366907E`
  (2,191,091 bytes). Real state/checkpoint/crash-log hashes were unchanged;
  no app launch against the real profile, upload, or account action occurred.

## Last session 90 (autonomous loop — strict-mode object-state guards)
- Confirmed the frontend is an ES module (strict mode) and closed a real
  saved-state frame exception: primitive `hints` values were assigned
  verbatim, so the next discovery hint's `hintsSeen[id] = 1` throws a
  `TypeError`. Hint history now rebuilds as a mutable object containing only
  known hint IDs.
- Bond history now keeps only owned-species finite nonnegative integer values,
  preventing string concatenation/stuck levels on the next affection gain.
  Shiny history now keeps only owned species with actual boolean/legacy `1`
  flags, stripping arbitrary truthy and unowned entries.
- The malformed seeded save uses `hints:7`, invalid/negative/unowned bond
  values, and string/boolean/legacy/unowned shiny flags. The test drives a real
  hint trigger, applies a bond gain, forces shiny hybrid sprite construction,
  and verifies normalized persistence: seeded **19/19**, integrated **71/71**.
- Verification: source soak/fuzz clean; actual app rebuilt; final **25/25
  heartbeat GREEN** including save policy 14/14 and cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `4ACC851C019897703E25545F1699B3ABF6AAC6D4E76576C9A8B22C1B157A0A66`
  (5,383,680 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `D03CE395435E2821CA08A424168B5203F3F58FFA7C1D3885A3DC54FCF186A8D8`
  (2,190,964 bytes). Real state/checkpoint/crash-log hashes were unchanged;
  no app launch against the real profile, upload, or account action occurred.

## Last session 89 (autonomous loop — bounded saved queues/catalogs)
- Hardened persisted collection/payment queues. `accOwned` now removes
  duplicate/unknown IDs, preventing a corrupt save from inflating both ranch
  and status-card gear grids with repeated cells.
- Redeem history now accepts only unique uppercase UI-compatible codes,
  bounds retained history to 2,000 entries, keeps `redeemedBound` as a subset,
  and validates/deduplicates the newest 300 signed grant nonces. Offline-code
  binding has a re-entrancy guard and processes at most eight items per poll,
  preventing a malformed save from launching thousands of sequential network
  requests during boot while later ten-minute polls can drain a real backlog.
- The malformed seeded save covers duplicate/unknown accessories, mixed-case
  and duplicate codes, invalid types/characters/oversize entries, invalid and
  repeated nonces, and twelve valid codes with ten initially unbound. It proves
  exactly eight boot binding calls, a bounded persisted queue, and zero crash
  logs: seeded **16/16**, integrated app **68/68**, Worker **24/24**.
- Verification: source soak/fuzz clean; actual app rebuilt; final **25/25
  heartbeat GREEN** including save policy 14/14 and cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `A2D2E1A5DAEAAAB4B558C277AE06560796F0B89DBBDDD8C30B232B807603B068`
  (5,383,680 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `E9D5EFD4168145BBC43F4C4272310F69653022101EECA7B91C4343F6CC507886`
  (2,190,932 bytes). Real state/checkpoint/crash-log hashes were unchanged;
  no app launch against the real profile, upload, or account action occurred.

## Last session 88 (autonomous loop — corrupt stats/FAB guard)
- Closed two persisted-metadata failure modes. A string `stats.focusSec`
  concatenated another number every focus frame, causing unbounded growth;
  malformed counters also degraded to `NaN`. Stats now rebuild from a fixed
  schema of finite nonnegative counters/focus seconds before any updates.
- An empty saved `fab:[]` passed `Array.every`, restored two `undefined`
  coordinates as `NaN`, and made the toybox control invisible. FAB restore
  now requires exactly two finite coordinates before viewport clamping.
- The malformed seeded save includes object/string/negative/fractional stats
  and an empty FAB. Tests prove normalized values, the default visible FAB
  position, real settings-counter drawing, numeric updates, normalized
  persistence, and zero crash logs: seeded **14/14**, integrated **66/66**.
- Verification: 600-frame soak and 1,200-frame deterministic fuzz clean;
  actual app rebuilt; final **25/25 heartbeat GREEN** with save policy 14/14
  and real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `930BD6DFE4527F5833940D88D7C6C75B832B18B62B0EAFDAFD209B650D774872`
  (5,383,168 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `86BA2B0D6888F13EFD7E65DC99B4392E0F3AB205C1734A49550C7C28B4B3BD94`
  (2,190,448 bytes). Real state/checkpoint/crash-log hashes were unchanged;
  no app launch against the real profile, upload, or account action occurred.

## Last session 87 (autonomous loop — corrupt hybrid frame-crash guard)
- Closed persisted-hybrid crash/freeze paths. A saved `top:{}` or malformed
  decoration tuple previously reached sprite destructuring/grid writes, while
  unbounded rarity could draw thousands of pips per ranch cell. Loaded
  hybrids are now copied into a bounded schema: canonical safe integer IDs,
  unique/non-base IDs, finite 0..2 rarity, own-key shapes, valid hex palette,
  at most 64 in-bounds decoration pixels, bounded names/optional strings, and
  nonnegative sequence/birth metadata. At most 1,000 saved hybrids load.
- `buildSprite` also defensively ignores malformed/out-of-grid decoration
  entries, so future format drift cannot kill `frame()`. The seeded-save test
  covers `shape:"toString"` prototype lookup, duplicate/base ID collisions,
  invalid palettes, `top:{}`, bad tuples/coordinates/glyphs, rarity 999, and
  negative `hybSeq`; both normalized hybrids are forced through real sprite
  construction and persisted again.
- Verification: seeded save **12/12**, integrated behavior **64/64**, source
  soak/fuzz clean, and final **25/25 heartbeat GREEN** including real-EXE
  cleanboot 11/11 and save policy 14/14.
- Release rebuilt and portable repacked: exe SHA-256
  `59049122682BCF7FF015512979E1896A14D413D0DE1EEDF12E2B67907E01D026`
  (5,383,168 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `4E6EA9CA4CDAD99F14BEC2831A93DFA7B715A45140D57DA8D4EF84107A53E951`
  (2,190,545 bytes). Real state/checkpoint/crash-log hashes were unchanged;
  no app launch against the real profile, upload, or account action occurred.

## Last session 86 (autonomous loop — corrupt custom-name crash guard)
- Closed a saved-state frame-crash path: persisted `names` values were copied
  verbatim, so a number/object could reach the NAME sort's `localeCompare` or
  the pixel renderer. Custom names are now ownership-gated strings, trimmed,
  whitespace-collapsed, uppercased, glyph-validated, and capped at 10 chars;
  `spName` also keeps a defensive string fallback.
- Expanded the seeded-save scenario with an overlong valid name, a numeric
  owned-species name, and an unowned-species name. It proves normalized load,
  safe NAME sorting, normalized persistence, and zero crash logs: **8/8**.
  `_verify.cjs` now includes this malformed-save suite and reports **60/60**.
- Source soak and deterministic fuzz passed (600 + 1,200 frames, 0/0), then
  the actual embedded app was rebuilt. Final **25/25 heartbeat GREEN** includes
  the new seeded checks, 14/14 save policy, and real-EXE cleanboot 11/11.
- Release rebuilt and portable repacked: exe SHA-256
  `4134982FFF58C47F09040830995B2333DDFE289F17AE3407AB566651D1810116`
  (5,382,144 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `A37E755720243E264E0621B3928450A940C59CD4D9CCA2598D1BD444A576229E`
  (2,189,893 bytes). Real state/checkpoint/crash-log hashes were unchanged;
  no app launch against the real profile, upload, or account action occurred.

## Last session 85 (autonomous loop — observable deterministic fuzz gate)
- Exercised mixed pointer/drag/typing, pal/prop churn, gacha/breeding,
  overlays, platform changes, and resizes for **50,000 frames** with seed
  `137531`: 0 crashes and 0 invariant violations. A second 10,000-frame run
  with seed `90210` also finished 0/0.
- Long fuzz runs previously printed nothing between start and finish, making
  healthy CPU work indistinguishable from a hang. `_fuzz.cjs` now emits ten
  deterministic progress reports with crash/violation counts and reports
  total versus unique crashes honestly.
- Replayed seed `424242` twice for 1,200 frames: outputs were byte-identical,
  contained exactly ten progress reports, and ended 0/0. Promoted that short
  deterministic run to the required heartbeat and watch set; `HEARTBEAT.md`
  now documents its input/state/platform coverage.
- Verification: full **25/25 heartbeat GREEN**, including the new fuzz step.
  Tooling/docs-only pulse; release EXE/ZIP were not rebuilt or uploaded.

## Last session 84 (autonomous loop — byte-safe corrupt-save recovery)
- Closed a recovery edge case: `preserve_rejected_save` used
  `read_to_string`, so a damaged save containing invalid UTF-8 was skipped
  precisely when preservation mattered most. Recovery now reads and hashes
  raw bytes, then copies every readable artifact byte-for-byte.
- Expanded the shipped-exe recovery self-test to **14/14** with a deliberately
  invalid UTF-8 backup plus recovery-note and idempotence assertions. Hardened
  `_savepolicy.cjs` to require the current `14/14` result marker in the EXE;
  the old binary was proven to fail closed (`exit=2`) before rebuilding.
- Verification: Rust compile clean, target EXE self-test exit 0, package
  preflight 10/10, and full **24/24 heartbeat GREEN**. The real developer
  state/checkpoint hashes remained unchanged and no real recovery directory
  was created.
- Release rebuilt and portable repacked: exe SHA-256
  `63ECE92FABBE09338967385B1B595FB2804B77ABAB9FF0B693B56B4D449C2A49`
  (5,382,144 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `5DC9F2F9FFB0F10819612D17403722C667F901DBDF1820873F9B9EA6B7ECE238`
  (2,189,557 bytes). No app launch against the real profile, upload, or
  account action was performed.

## Last session 83 (autonomous loop — rejected-save recovery preservation)
- Read-only policy audit found the current developer profile was already an
  invalid rollback before this batch: both plaintext `state.json` generations
  are unknown to sealed checkpoint seq 15 / registry watermark 15. Existing
  and tightened policies both correctly reject them; accepting them would
  reopen the wallet-edit bypass.
- `load_state` now copies rejected main, backup, and checkpoint generations to
  content-addressed `recovery/rejected-*.txt` files before returning a clean
  state. Repeated boots do not duplicate identical evidence, and a README
  explains why files were preserved. Settings RESET removes recovery too.
- Expanded shipped-exe policy self-test from 8 to **13/13**: the five new
  checks prove all three artifacts are preserved byte-for-byte and a second
  preservation pass is idempotent. Package README/project README document the
  recovery folder.
- Verification: **24/24 heartbeat GREEN**, save policy/recovery 13/13,
  cleanboot 11/11, and real-state simulation 7,200 frames clean. Read-only
  audits left the real state/checkpoint hashes unchanged and did not create a
  recovery folder; preservation happens only on the next normal app load.
- Final release supersedes session 82's intermediate build: exe SHA-256
  `409F911B4B9FCF93236E27A65C0C5A36854027A6AFE0186C9CD48C522E88924A`
  (5,381,632 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `3296361D7441B01756B5B80828020252F75B449241C263CECE51DC32CC39D6CF`
  (2,189,158 bytes). No app launch against the real profile, upload, or
  account action was performed.

## Last session 82 (autonomous loop — plaintext checkpoint-bypass closure)
- **closed a real save-integrity bypass**: when `state.chk` was deleted,
  `load_state` rejected a watermark-bearing sealed file but still accepted the
  same forged payload after changing it to plaintext JSON. Checkpointless
  legacy/backup adoption now requires registry watermark 0 (true first boot
  or uninstall/reinstall). The early unknown-generation exception likewise
  requires watermark 0; known current/previous generations retain the intended
  one-generation crash-recovery allowance.
- Extracted the decision into `save_generation_allowed`, added Rust unit cases
  for checkpointless, current/previous, and early-unknown generations, and
  added release CLI `--self-test-save-policy`. Local GNU/Tauri test binaries
  compile but cannot execute on this machine (`STATUS_ENTRYPOINT_NOT_FOUND`),
  so heartbeat exercises the same function inside the actual shipped exe via
  `_savepolicy.cjs`: **8/8 GREEN**. The wrapper refuses a stale binary before
  launch, preventing an unknown flag from starting the normal app.
- Persistence verification: real save loaded and ran **7,200 frames clean**;
  its SHA-256 remained exactly
  `D09272F9A27C8B44A34A4C94AC837633C0EB0F36E1F04025F87BF09D24742151`.
- Gate: **24/24 heartbeat GREEN**, including Rust check, shipped-exe save
  policy 8/8, package/version preflight, cleanboot 11/11, and all existing
  app/site/Worker suites.
- Release rebuilt and portable repacked: exe SHA-256
  `822C9E3238F975FF06EBD76126F0E716F932F030DDEDB02D0978E4201AEF2BC0`
  (5,375,488 bytes); `jellypal-0.2.16-win.zip` SHA-256
  `CB04DF8B39CF23414274F20A4159D70642F925F8F5904A629153A4A7131218F0`
  (2,186,771 bytes). No upload or account action performed.

## Last session 81 (autonomous loop — single release-version contract)
- Updated `DESIGN.md`'s operational `site/dl` inventory from obsolete 0.2.0
  names to all four real 0.2.16 Windows/macOS artifacts and measured sizes.
- Expanded non-mutating `dist.cjs --check` to compare **10** release-version
  surfaces: Tauri authority, Cargo package, frontend `APP_VER`, site version,
  four download/footer references, package README, and DESIGN inventory.
  A partial bump now blocks packaging instead of shipping mixed versions.
- Gate: `PACKAGE INPUTS GREEN v0.2.16 (10 version checks)` and full
  **23/23 heartbeat GREEN**. Docs/tool-only pulse; no rebuild or upload.

## Last session 80 (autonomous loop — safe dev-unlock recovery)
- Repaired `unlock.cjs`, which still targeted the retired
  `%APPDATA%\com.jellypal.app` plaintext save and would now either do nothing
  useful or conflict with DPAPI/checkpoint protection. It is checkout-relative
  and accepts only an absolute `JELLYPAL_TEST_DATA_DIR` containing the backend's
  `.jellypal-test-profile` marker.
- The helper explicitly refuses current/legacy production paths and any sealed
  `JPENC1` file, preserves valid hybrid IDs, writes atomically, and clears only
  stale checkpoint generations inside the marked disposable profile.
- Added `unlock.cjs --self-test` to heartbeat/watch. Its **9/9** scenarios cover
  unmarked/production/sealed refusal, full species/accessory output, hybrid
  preservation, dev wallet/active species, checkpoint cleanup, and atomic-temp
  cleanup. The real production save SHA-256 was identical before/after.
- Gate: **23/23 heartbeat GREEN**. Test-tool-only pulse; no release rebuild.

## Last session 79 (autonomous loop — accountable heartbeat summary)
- `_pulse.cjs` now counts successful steps and writes the ratio into both
  console and `HEALTH.txt`; a broad GREEN claim is visibly tied to the real
  gate size. The current report is `heartbeat GREEN 22/22 (21s)`.
- Updated the continuation guide from the obsolete four-second frontend-only
  estimate to the measured ~20-second warm app/backend/site/release gate.
- Gate: **22/22 GREEN**. Reporting/docs-only pulse; no release rebuild.

## Last session 78 (autonomous loop — Rust compile gate)
- Added checkout-relative `_rustcheck.cjs` and promoted Rust compilation into
  every heartbeat. On Windows, absent/non-ASCII `CARGO_TARGET_DIR` is routed to
  `C:\build\jellypal-target`; this avoids the GNU linker/dlltool corruption
  reproduced when object/DEF paths include the Korean user name. Other
  platforms and explicitly safe target paths keep their normal Cargo setup.
- Standalone parent-directory check and the integrated check both passed
  incrementally (`RUST CHECK GREEN`, ~2.6-2.8s).
- Gate: **22/22 heartbeat GREEN**, now covering Rust compile plus package,
  app, site, Worker, 60/60 pals, and cleanboot. Backend source and release
  artifacts did not change, so no rebuild/repack was required.

## Last session 77 (autonomous loop — non-mutating package preflight)
- Added `dist.cjs --check`: it verifies the single version authority, package
  README version, release exe and WebView2 loader presence/minimum size, and
  proves the release exe is not older than frontend/backend product sources.
  The mode exits before staging or writing a ZIP.
- Registered this as the required `package` heartbeat step and added the
  packaging script/README to watch mode. It was also proven checkout-relative
  from the workspace parent: `PACKAGE INPUTS GREEN v0.2.16`.
- Gate: **21/21 heartbeat GREEN**, including package preflight, all app/site/
  Worker suites, 60/60 pals, and cleanboot 11/11. Tool-only pulse; existing
  exe and ZIP remain byte-identical, with no repack or upload.

## Last session 76 (autonomous loop — replayable long fuzz)
- Ran the existing random state/input churn for **30,000 frames** across
  pointer gestures, typing, props, pals, gacha/breeding, overlay toggles,
  platform churn, and resizes: **0 crashes, 0 invariant violations**.
- Made `_fuzz.cjs` checkout-relative and replayable via
  `node _fuzz.cjs <frames> <seed>`. App/input randomness now shares the printed
  seeded PRNG, while `performance.now` and `Date.now` advance on the virtual
  frame clock instead of host scheduling time.
- Replayed seed `424242` twice for 1,200 frames from the workspace parent:
  both runs were 0/0 and produced byte-identical output/final state. Final
  required gate remained **20/20 heartbeat GREEN**. Test-tool-only pulse; no
  release rebuild required.

## Last session 75 (autonomous loop — site JavaScript dependency gate)
- Hardened `_deps.cjs` into a checkout-relative failure gate: `pals.js`,
  `ranch.js`, and `sprite-text.js` are syntax-compiled without execution, and
  every shared symbol actually referenced by the ranch must be defined by the
  pals module. The old misleading single-argument regex diagnostic was
  removed; it flagged a valid two-argument expression.
- Registered the check as `sitejs` and added all three browser scripts plus
  the harness to watch mode.
- Gate: **20/20 heartbeat GREEN**, including site JS syntax/dependencies,
  site surface 10/10, checkout wiring, worker 24/24, behavior 52/52, all app
  interaction suites, 60/60 pals, and cleanboot 11/11. Test-only pulse; no
  release rebuild or upload.

## Last session 74 (autonomous loop — site size-copy consistency)
- Fixed stale download-size copy: the tracked page and README mixed `1.6 MB`
  with the correct `1.7 MB` installer label. The local 0.2.16 artifacts prove
  1.66 MiB installer -> 1.7 MB and 2.08 MiB ZIP -> 2.1 MB; all visible source
  copy now agrees. No links, prices, account state, or hosted files changed.
- Hardened `_mcheck.cjs` from a print-only diagnostic into a checkout-relative
  **10/10** failing gate for motion/hash anchors, consistent sizes, pack/nav
  controls, dex canvas, and ranch icon/legendary/pause hooks. Registered it as
  the required `site` heartbeat step and watch input without depending on the
  intentionally gitignored `site/dl` binaries.
- Gate: **19/19 heartbeat GREEN**, including site surface 10/10, checkout
  wiring, worker 24/24, behavior 52/52, all app interaction suites, 60/60
  pals, and cleanboot 11/11. Site/test-only pulse; no app rebuild or upload.

## Last session 73 (autonomous loop — provider-neutral checkout gate)
- Repaired tracked `_payck.cjs`, which still searched for an old inline
  `Stripe` comment and failed even though the current Gumroad-capable checkout
  script was present. It now locates the script by its `PAY_LINKS` authority,
  syntax-compiles it in memory (no temporary file), and verifies all four
  pack slots plus Gumroad license and webhook UID-routing hooks.
- Registered the local site checkout check as a required `sitepay` heartbeat
  step and watch input. No network, purchase, account, or upload is involved.
- Gate: **18/18 heartbeat GREEN** with `CHECKOUT WIRING GREEN`, worker 24/24,
  behavior 52/52, all interaction/static suites, 60/60 pals, and cleanboot
  11/11. Test-only pulse; no release rebuild required.

## Last session 72 (autonomous loop — enforceable asset-reference audit)
- Hardened `_audit.cjs` from a print-only report into a checkout-relative
  failing gate. A missing/empty SPR table, any literal `drawSpr` ID without a
  definition, or any treat ID without a sprite now exits nonzero instead of
  quietly printing the problem and returning success.
- Registered it as the required `assets` heartbeat step and watch input.
- Gate: **17/17 heartbeat GREEN** with `ASSET REFERENCES GREEN`, plus worker
  24/24, behavior 52/52, volume/breeding/props/eating interaction harnesses,
  60/60 pals, and cleanboot 11/11. Test-only pulse; no release rebuild.

## Last session 71 (autonomous loop — typing/eating gate)
- Promoted `_eatsim.cjs` into the required heartbeat and made it
  checkout-relative. Its **4/4** checks prove typing wakes a normal species,
  emits the expected floor-anchored crumbs, still grants progress silently
  while the pet is home, and keeps spawned crumbs on the active floor.
- Gate: **16/16 heartbeat GREEN**, including worker 24/24, behavior 52/52,
  volume 13/13, breeding 15/15, props 7/7, eating 4/4, 60/60 pals, and
  cleanboot 11/11. Test-only pulse; no release rebuild required.

## Last session 70 (autonomous loop — prop drag/drop gate)
- Promoted `_proptest.cjs` into the required heartbeat and made it
  checkout-relative. Its **7/7** assertions drive the real prop grab/drop
  handlers, prove a bowl is removed only inside PUT AWAY, verify the feedback
  bang and held-state cleanup, then prove a normal drop preserves the prop.
- Gate: **15/15 heartbeat GREEN** from the workspace parent, including the
  new `props` step plus worker 24/24, behavior 52/52, volume 13/13, breeding
  15/15, 60/60 pals, and cleanboot 11/11. Test-only pulse; no release rebuild.

## Last session 69 (autonomous loop — breeding click-path gate)
- Promoted the tracked `_breedflow.cjs` into the required heartbeat. Its
  **15/15** checks drive real ranch pointer handlers through parent selection,
  cost/cooldown, child creation, reveal completion, and the close-mid-reveal
  recovery path that prevents a wedged ranch.
- The harness now resolves `src/main.js` from its own checkout and was proven
  standalone from the workspace parent before the integrated run.
- Gate: **14/14 heartbeat GREEN**, including worker 24/24, behavior 52/52,
  volume 13/13, breeding 15/15, 60/60 pals, and cleanboot 11/11. Test-only
  pulse; no release rebuild required.

## Last session 68 (autonomous loop — volume regression gate)
- Restored the tracked `_voltest.cjs` after the settings panel grew from its
  old fixed height: it had hardcoded the former row Y coordinate, producing
  six false failures despite the slider using the correct live row. The
  harness now derives its press/drag geometry from `settingsRows()[0]`, so it
  remains valid across panel centering, height, and display-size changes.
- Registered the volume harness as a required heartbeat step and watch input.
  Its **13/13** checks cover load, press/drag/tap levels, mute/unmute, dirty
  state, compatibility `volStep`, persisted `save_state`, and cancel cleanup.
- Gate: **13/13 heartbeat GREEN**, including worker 24/24, behavior 52/52,
  volume 13/13, 60/60 pal coverage, and cleanboot 11/11. Test-only pulse; no
  release rebuild required.

## Last session 67 (autonomous loop — accountable behavior count)
- `_verify.cjs` now requires each child simulator to report at least one
  explicit `PASS` line and totals the executed checks. A child that exits 0
  without exercising assertions is now a gate failure instead of a silent
  pass. The heartbeat reports the current behavior result as **52/52**.
- Replaced the stale `93+` wording in `HEARTBEAT.md` with the real gate
  contract: driven social/state and treat scenarios with an explicit count.
- Gate: **12/12 heartbeat GREEN** with worker 24/24, behavior 52/52,
  60/60 pal coverage, and cleanboot 11/11. The prior watch child was
  explicitly stopped; this run also proved stale-lock reclamation works.
  Test/protocol-only pulse; no release rebuild required.

## Last session 66 (autonomous loop — complete watch coverage)
- Heartbeat watch mode now tracks **19** product and gate inputs instead of
  only the three frontend files plus `_verify.cjs`. Rust backend, Tauri
  config, Worker/grant code, Worker tests, and every directly invoked app
  harness now trigger the same debounced full gate while being edited.
- Live watch verification: initial **12/12 GREEN**; changing only the mtime
  of `server/test.cjs` triggered a second independent **12/12 GREEN** pulse,
  including worker 24/24 and cleanboot 11/11. The host PTY closed before its
  Node child, so the exact verified watch PID was explicitly stopped before
  the next pulse. Test-tool-only pulse; no release rebuild required.

## Last session 65 (autonomous loop — checkout-relative heartbeat)
- `_pulse.cjs` now changes to its own checkout before running steps or writing
  `HEALTH.txt`. Launching it by absolute/relative path from another directory
  can no longer report false missing-file failures or leave the health report
  beside the caller's shell.
- Reproduced from the workspace parent with `node .\typet\_pulse.cjs`:
  **12/12 GREEN**, the repository health file was updated, and no parent-level
  `HEALTH.txt` appeared. Test-tool-only pulse; no release rebuild required.

## Last session 64 (autonomous loop — grant-worker gate)
- **payment regressions now block the heartbeat**: `_pulse.cjs` runs
  `server/test.cjs` as a first-class `worker` step. Its 24 scenarios cover
  signed grant verification, one-license/one-user binding, idempotent
  re-redemption, pending claim/ack handling, refunds, and retryable provider
  outages. Previously these tests were green when run manually but could be
  skipped by the one-command release gate.
- `HEARTBEAT.md` now lists the worker suite in the required verification
  matrix, keeping the documented contract aligned with the executable gate.
- Gate: **12/12 heartbeat GREEN**, including worker **24/24**, app behavior
  simulations, 60/60 pal coverage, sprite/QA sweeps, and cleanboot 11/11.
  Test/protocol-only pulse; release binaries remain byte-identical to session
  63, so no rebuild or repack was required.

## Last session 63 (autonomous loop — redeem hardening + hidden-state UX)
- **redeem response validation**: the frontend now credits only one of the
  four finite integer pack amounts. A null/corrupt server reply can no
  longer become `+null JELLY!`; signed `JELLYPAL-*` codes fall back to the
  local Ed25519 verifier, while malformed branded strings are rejected
  before they reach the store-license endpoint.
- **pending-grant idempotency**: claim batches now validate nonce/amount,
  dedupe repeated nonces before credit, and ACK every verified nonce the
  server still returns. A lost ACK is retried on the next poll without a
  second wallet credit (the old early return left it pending forever).
- **settings growth fixed at the source**: the panel had grown to 16 rows
  but retained the old 424px cap, forcing a pointless scrollbar even at
  1080p. Roomy screens now expose every row; short screens keep the clipped,
  clamped wheel-scrolling path.
- **box hiding is a complete parked state**: entering the box now aborts
  overlapping accessory/signature/spin/hunt/climb/web/flight state. Main
  and companion occupants follow both axes of a dragged/re-seated box and
  move with it when the supporting window closes. Hidden bodies also drop
  internal/backend hit-tests plus shadows, halos, ambient particles, aura,
  clipboard reactions, pomodoro/target markers, and ghost typing effects.
  Status cards now report `HIDING`/`NAPPING` accurately.
- **simulation isolation**: the social harness clears leftover prop errands
  before its gossip scenario, removing a stochastic cross-test failure. It
  now covers corrupt redeem payloads, malformed/one-shot codes, duplicated
  and resent pending grants, full-size settings, box action cancellation,
  x/y anchoring, window-close re-seating, hidden effects, status labels,
  and both click-hit paths: **49/49**, with 10 repeated sweeps green.
  Worker payment tests are **24/24**; randomized state/input fuzz completed
  **6,000 frames** with zero crashes or invariant violations.
- **real-state soak restored**: `_repro.cjs` now selects the current
  `com.jellypal.desktop` profile (legacy IDs remain fallback), is
  checkout-relative, and can decrypt a `JPENC1` DPAPI save in memory without
  rewriting it. The current real state completed **7,200 frames** cleanly.
- **release filename follows the app version**: `dist.cjs` now reads
  `src-tauri/tauri.conf.json` instead of hardcoding `0.2.0`, and resolves the
  checkout from `__dirname__`. The current portable is correctly named
  `jellypal-0.2.16-win.zip`; the stale generated 0.2.0 ZIP was moved to
  `dist/_obsolete` (recoverable, not deleted).
- Read-only cross-check against the old exhaustive 303-scenario harness is
  **299/303**; the four remaining expectations are intentionally obsolete
  (hybrid-only breeding, UID-appended provider links, store-page fallback,
  and the currency label changing from GEMS to JELLY).
- Gate: Rust `cargo check` GREEN; final 11-step heartbeat GREEN; real release
  clean-boot **11/11**. Rebuilt exe SHA-256
  `A6AE83E4AA3BF06631F46A0F648D6FAB6243542043499F0D3CC8426EFAAAF9DD` and
  repacked `jellypal-0.2.16-win.zip` SHA-256
  `6FFF3DC675093179E70032477B0DF3E0E8F77C24854CE87B89B54177C2C798B3`.

## Last session 62 (autonomous loop — safe gates + synchronized naps)
- **clean-boot is save-safe**: `_cleantest.cjs` no longer renames or boots
  against the real profile. A marker-gated `JELLYPAL_TEST_DATA_DIR` routes
  state/photos/logs to a disposable directory and bypasses the production
  registry watermark only there. Verified real `state.json`, `state.chk`,
  and HKCU rollback sequence are byte/value-identical before vs after.
- **first-run contract refreshed**: `_fresh.cjs` and the real-exe test now
  assert the current 100-jelly start plus the free cap. Fresh harnesses are
  18/18 + 18/18 + seeded 5/5; cleanboot is 11/11.
- **heartbeat concurrency lock**: `_pulse.cjs` rejects a second runner while
  one owns `.pulse.lock`, reclaims stale locks, and removes the lock on exit.
  Two-run simulation proved the duplicate is rejected and the owner remains
  GREEN.
- **honest verification failures**: `_verify.cjs` is checkout-relative and
  now propagates either child simulation's nonzero exit instead of printing
  FAILED and returning success.
- **synchronized naps**: when the main pet sleeps, same-platform pals can
  rarely walk into spaced cuddle slots and nap beside it. Waking or picking
  up the pet cancels any in-flight bedtime errand. `_socsim.cjs` covers both
  join and cancellation paths (19/19).
- The honest gate exposed a flaky social test: the main pet could wander
  into the supposedly isolated hidden-pal bump scenario. The test now parks
  the main pet; 12 repeated runs passed. That audit also found and fixed a
  real gap: a visible pal could choose an invisible box-dweller as a totem
  mount. Hidden pals are excluded and the path has a deterministic test.
- **sleep/box isolation audit**: sleeping or hidden pals are no longer
  greeting/huddle targets, cannot be pulled by Pulsar or decorated by Stella,
  and ignore cursor-hunt recruitment plus fast-ball launches. Box dwellers
  also drop their backend clickable rect (fixes an invisible desktop click
  eater) and pause legendary ambient particles until they emerge.
- The social harness now records backend calls and deterministically covers
  nap approach/cancel, hidden greeting/stack/huddle, aura freeze, ghost
  hitboxes, ball launch, and ghost particles. 12 repeated sweeps passed 26/26.
- Gate: Rust `cargo check` GREEN; final heartbeat 11/11 GREEN, social sim
  26/26, 60/60 species pal sweep, sprite/QA/frame simulations clean.
  Release exe rebuilt and `dist/jellypal-0.2.0-win.zip` repacked (2.1MB).

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

## 2026-11-27 Mac App Store candidate + pal separation/responsive pass
- 사용자 보고: 팔 잔렉 + 팔끼리 뭉칠 때 버그. 릴리즈 전 각 기기/화면 크기 대응 후 App Store 진행 요청
- 팔 뭉침: 업데이트 후 `resolvePalCrowding(now, dt)` 위치 솔버(34px 목표, 2회 반복)를 두고 전원 업데이트 → 분리 → 전원 드로잉 순서로 고정. 태그/페어/그룹 이벤트와 소품 도착은 간섭하지 않고, 잠든 팔은 느리게/한쪽만 움직일 땐 움직이는 쪽이 더 많이 밀림. 겹침 방향은 배열 순서 기반 결정론
- 잔렉 후보 제거: 네이티브 rAF와 watchdog이 동시에 `frame()`을 돌려 중복 루프가 생기던 경로를 단일 flight `queueFrame()`로 통합. watchdog이 stale callback을 cancel 후 수동 구동
- 반응형: store 카드/랜치/너서리 패널 좌표를 CSS scale 보정, 작은 work area에서 max-height/transform/origin/clickable rect 재계산, DPR 변경을 매프레임 감지, narrow card margin과 native 스크롤 대응
- 하네스: cancelable rAF·패널 rect·seeded fresh geometry를 실제 동작에 맞춤. NIGHT OWL 트로피는 부팅 후 10분이 지나야 발동해 새벽 테스트 first-boot jelly 오염 방지
- 스토어 인프라: universal arm64+x86_64 GitHub Actions, store-only prepare/check, sandbox verify/sign helpers, StoreKit FFI 모듈, macOS 12 floor/privacy manifest/제출 초안 정리
- 사이트: 62종 dex parity 반영 상태로 배포. App Store privacy URL용 `privacy.html` 추가 후 Cloudflare Pages 배포, https://jellypal.fun/privacy.html 라이브 확인
- 검증: npm test 5/5, layout 9/9, verify 317/317, fresh/null/seeded/narrowprop/malformed GREEN, fuzz 1200 seed 424242 1020회 시나리오 통과, pal audit 62/62, rust check GREEN, site deps/surface/checkout GREEN
- 남은 게이트: Windows release exe는 현재 소스보다 오래돼 package/cleanboot heartbeat는 로컬 재빌드 전까지 RED. Mac 후보는 GitHub Actions에서 새 빌드 필요. 실제 Mac에서 StoreKit Sandbox/디스플레이/서명/스크린샷/Transporter는 사람 계정으로 진행

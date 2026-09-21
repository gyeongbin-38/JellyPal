# Typet — backlog (prioritized)

Benchmarks: Tiny Pasture (idle ranch on desktop), Chillquarium (gacha + tints).
Size: S < half day, M = 1-2 days, L = multi-day.

## Done since last review
- ~~Multiple pets~~ — companions, interactive, persistent across restarts
- ~~Offline earnings~~ — AWAY REPORT panel on boot
- ~~Name-your-slime~~ — ranch cell rename, persisted
- ~~Shiny variants~~ — 8% gold tint on new pulls
- ~~Ranch room themes~~ — trait-tinted walls
- ~~Pal tickle/pet parity~~ — wiggle tickle + slow-stroke pat on pals
- ~~Pal personality play~~ — hyper plays sooner, shy flees farther (pace mult)
- ~~Window-title-aware reactions~~ — `focus` event + editor/media/game biases
- ~~Screenshot/photo mode~~ — settings PHOTO hides UI, saves PNG via backend
- ~~Accessory equip screen~~ — EQUIP grid picker on the acc slot
- ~~Treat variety~~ — cookie/cake/chili/coffee; right-click snack btn cycles
- ~~Hybrid shiny inheritance~~ — 15% if either parent shiny, SHINY BORN!
- ~~Local achievement counters~~ — `stats` persisted, shown in settings
- ~~Accessibility: reduce motion~~ — MOTION row damps squash/rotation/fx
- ~~Pomodoro mode~~ — POMO row; 25/5 focus-break cycle, cheer hearts, naps
- ~~Seasonal slimes~~ — pumkin (Halloween) + yule (winter), date-gated pools
- ~~Process-name focus recognition~~ — `focus` emits [title, exe]; browser/
  editor/media/game classified on exe too; unknowns = other
- ~~Volume steps~~ — SOUND cycles 100/60/30/off, persisted, legacy mute maps
- ~~Treat buff icons~~ — chili/coffee float over the slime while active
- ~~Photo pose~~ — PHOTO makes it happy + hearts before the snapshot
- ~~Ranch pagination~~ — fixed-size window, 12 cells/page, wheel + `<`/`>`
- ~~Sort/filter~~ — footer cyclers: DEX/RARE/NAME + ALL/OWNED/MISS/SHINY
- ~~Pixel font gaps~~ — added `>` `<` `:` `*` `%` `_` `'` `,`; text shadows
- ~~Bestiary info panel~~ — per-cell `i` button -> species card (nature/
  move/trait/skill/season/baby); silhouettes get a teaser version
- ~~Nursery = separate window~~ — babies live in their own floating
  panel (footer button, auto-opens on birth, ESC/X close)
- ~~Sleep = 5min no-interaction~~ — typing no longer wakes; `awakeAt`
  clock + grumpy greeting after 20min ignored
- ~~Key-eating species~~ — `kr` flag (sprout/bean/mochi/mecha/bites);
  typing reacts only for them, hybrids inherit
- ~~Legendary flourish~~ — Stella angel wings + floaty fall; per-species
  ambient quirks (Goldie luck-gem, Comet trail, Molten embers, Siren
  notes, Cliff chips, Bites drool)
- ~~Bolder pixel text~~ — `drawText` bold pass on names/tags/info values
- ~~Cursor-web spider~~ — Webby (legendary) shoots a silk line at the
  cursor and pendulum-dangles; pals zip up too; grab/recall breaks it
- ~~8 more species~~ — legendaries Drago/Pulsar/Rex, epics
  Pinata/Lanty/Dicey/Hops; all with real signature acts + traits
- ~~Bestiary = fullscreen modal~~ — readable stat rows, dim backdrop,
  FLAVOR lore lines for all 60 species
- ~~Pal webs~~ — real pendulum swing under the cursor, whip-snip too
- ~~Legendary passives~~ — pulsar pulls snacks, rex gathers a wider court
- ~~Dex milestones~~ — gem payout at 10/20/30/40/50/58 base species
- ~~Dev unlock tool~~ — `unlock.cjs` opens everything in the test save
- ~~Web play depth~~ — zip-up blend, poke=twirl, drag=tear, reel-in
  climb on a parked cursor
- ~~itch.io packaging~~ — v0.2.0, `dist.cjs` -> `dist/typet-0.2.0-win.zip`
  (1.8MB exe + README), version label in settings
- ~~itch page assets~~ — `assets.cjs` generates cover/banner/screenshot
  PNGs from the game's own sprites + font
- ~~Two webbies staggered~~ — pal anchors offset ±46px
- ~~Seasonal shop~~ — pumpkin + santa accessories, EVT tag, EVENT banner
- ~~Daily login~~ — streak-scaled gem stipend each first launch of the day
- ~~Pomodoro ring~~ — countdown arc + F/B over the slime
- ~~Save versioning + backup~~ — atomic tmp->rename write, .bak fallback
- ~~Demo/full split~~ — `demo.flag` marker: 8-species cap, breed locked,
  FREE DEMO tags; `dist.cjs --demo` packs the demo zip
- ~~Photo album~~ — ALBUM settings row browses saved PNGs in-app
- ~~Weekly hooks~~ — +30 weekly gems, 15% spotlight-species gacha boost
- ~~Custom pomo lengths~~ — FOCUS/BREAK cycling rows + FOCUS-min stat
- ~~Promo GIF~~ — assets.cjs emits promo.gif (480x270, 12f, 66KB)
- ~~F2P gem economy~~ — rebalanced costs (pull 50), redeem-code shop
  (TYPET-X-YYYYYY-ZZZZ, one-shot, offline-validated), codes.cjs seller
  tool. NOTE: demo.flag split is obsolete under F2P — ship ONE free zip.
- ~~Per-species silhouettes~~ — shapeVar() seeds height/bulge/lean per
  species; face+top pixels transform with it; assets.cjs synced
- ~~Distinct movement styles~~ — scurry bursts, hover glide, blink
  teleports, hop arcs, walk dust; pals mirror them all
- ~~Animation density~~ — landing ripples + dust, idle fidgets,
  walking step-bob, directional drag-stretch
- ~~New interactions~~ — face BOOP, 3-poke HEY! combo, stretch-release
  snap-back
- ~~Slime-slime social~~ — totem stacking (mount carries rider), copycat
  hop chains, signature audiences, siren captivates listeners
- ~~Legendary motion detail~~ — per-species: stella starbursts, drago
  heavy landings + ember breath, gold glitter trail, pulsar vacuum
  rings, molten heartbeat, rex strut, bites lunge, webby dangling legs
- ~~Pastel translucent redesign~~ — procedural pastel pipeline (all
  shades lift toward light+white, outline tints toward body) + per-char
  alpha so the desktop bleeds through the jelly
- ~~Prettier per-species eyes~~ — EYE_TPL 5 styles (round/sparkle/dot/
  starry/mellow) seeded per species via faceSet(); `u` iris-depth row;
  new LOVE face (heart eyes) wired to nuzzle/siren/petting
- ~~Anticipation squash~~ — 110-120ms crouch before every hop (pet+pal)
- ~~Walk lean~~ — body tilts into the heading direction, per-species amt
- ~~More pal social~~ — TAG chase (catch=TAG!+laugh+pop-hop), friendly
  SHOVE (!?+shock), stack riders wave/sing, petting shows love faces
- ~~animProf depth~~ — hop height + lean factor seeded per species
- ~~Social depth pass 2~~ — MAX_PALS=3 so real 3-level totem towers are
  possible; same-species pals nuzzle (double hearts, mutual drift);
  petting one pal makes another jealous (grumpy face + hop over);
  idle pals huddle together
- ~~Per-species animation profiles~~ — animProf() seeds blink period,
  blink length, fidget cadence and breath rate per species; pets and
  pals run on different clocks now
- ~~All-species visual QA~~ — qacheck.cjs sweeps 60 species x every
  face, checks transformed pixels stay attached (5x5 proximity +
  decoration-cluster connectivity), emits qa-sheet.png; fixed the real
  shapeVar bug it caught (zero-width rows exploding the tfm ratio ->
  ratio clamp + 4px protrusion cap). 6 remaining warnings are authored
  floating decorations (frog stalk eyes, inky wisps)
- ~~Status card on right-click~~ — any slime right-click opens a live
  floating card (mood/status/rarity/nature/move/trait/skill, pet level
  + XP bar, pal SEND HOME). Draggable header, ESC/X/void-click close,
  #card panel above ranch/nursery. Right-click no longer sends pals
  home — dedicated barn button opens the ranch instead
- ~~Signature coverage~~ — every r>=2 species now has a signature act:
  cliff landslide (slam+rockslide), bites frenzy (zig-zag chomp dash),
  shade umbral (melts to a slinking shadow), prism spectrum (rainbow
  fan), yule jingle (bell-hop + festive shower). cliff/bites LEG
  quirks deepened (tremor/summit vent, jaw snap). _audit.cjs checks
  declared vs implemented sig/trait/mv coverage
- ~~Cuteness pass~~ — blush clusters 2x2 on all base faces; 5 new faces
  (star/wink/cry/pout/content) with triggers (gems, boop, send-home,
  poke-escalation, jealousy, tag); accessory detail pass on 10 pieces +
  4 new accessories (scarf/beret/clip/ribbon); drawWings rewrite
  (coverts + 3 delayed-flap primaries, per-feather shading)
- ~~All-sprite rendering~~ — SPR doodad table + sprImg() prerender cache;
  OS font eliminated (bangs->pixel drawText, ✦♪♥★💎->sprites, hearts,
  zzz); wings now 3 bitmap flap frames; treats/files/icons/bubble/
  ripples/grav-rings/legs/gacha egg+capsule/halo/patch all sprites;
  shadows+halo ring pre-rendered bitmaps; fx p.spr particle sprites.
  remaining vectors: web threads + pomo gauge (functional)
- ~~Core hardening~~ — frenzy ricochets off platform edges instead of
  grinding; jingle bursts only after touchdown; Date.now audit clean
  (all wall-clock uses); pal/stack/tag stale-ref guards verified
- ~~Legendary sig starvation fix~~ — signatures were a tail branch in
  the wander roll (trait species ~3%, others ~11%; cursor-follow could
  starve the roll entirely). Now an independent 16% roll per decision +
  a dt*0.07 interrupt while following — all legendaries perform on cue
- ~~Pal mini signature acts~~ — PAL_FLAIR table: 9 themed particle
  patterns (rain/ring/rise/drift/cone/crackle/implode/hop/zig) + bang
  glyph + happy face, ~900ms. Pals roll it at 12% per decision; card
  shows SHOWING OFF. Fixed a `p.web`/`o.web` truthy-timestamp bug that
  permanently blocked tag/sig after a pal's first web
- ~~Total-freeze hotfix~~ — `lo`/`hi` were block-scoped consts that
  frenzy/umbral/rollout referenced from outside → ReferenceError killed
  frame() every frame (the "not moving" report). Hoisted to frame
  scope; added `!sigT0` movement gate + post-act wander cooldown
- ~~Cursor awareness + organic life~~ — look radius scales with
  rarity; NOTICE reaction when cursor lingers near; commons weakly
  follow too; sleeping stir/wake on approach; attention-seek begging
  (ignoreT>75s, STATUS=BEGGING, MOOD=NEEDY); energy tide modulates
  wander cadence + fidget kind (MOOD PLAYFUL/LAZY); new motions:
  yawn, weight-shift shuffle, bored sigh, peek, turn flourish,
  sleep nod-off; double-tap trick; wider click rect
- ~~In-game gem shop~~ — settings GEMS row opens a pack panel
  (4 prices + balance + BUY ON ITCH.IO + REDEEM CODE). `GEM_SHOP_URL`
  const fills in once the itch page ships; Rust `open_url` (https-only)
  opens the store in the browser. redeem stays reachable inside the shop
- ~~Card target indicator~~ — the slime an open status card tracks now
  gets a pulsing gold ground ring + bouncing chevron (tri sprite);
  follows it live, cleared with the card
- ~~Panel position persistence~~ — ranch/nursery/card drags save
  `panelPos` to state.json; panels reopen where they were parked
  (clamped to the current viewport); ranch drags record the riding
  nursery too
- ~~Cursor hunt~~ — swishing the cursor nearby builds prey-drive
  (personality follow x energy): stalk with butt-wiggle, then a
  cursor-led pounce. Landing in range = GOTCHA + heart + content face,
  missing = pout. Card shows STALKING/POUNCING!
- ~~Cursor ride~~ — while begging under a still cursor, a ~0.7s hover
  lets the pet climb on and hang ~60px below it, swinging with cursor
  motion; drops on timeout/whip/grab/sig. HITCHING A RIDE on the card
- ~~Treat baiting~~ — armed treat turns the cursor into the snack:
  the pet drools + shadows it until you click to drop. EYEBALLING
- ~~Petting-speed split~~ — slow reversing strokes = pat (content +
  hearts); fast rough strokes = tickle-play (laugh + squirm)
- ~~Social pass 3~~ — dance-along pals, SYNERGY elemental pair table
  (steam/fireworks/wisp-ring/prism/bubbles/aurora), treat FOMO crowd +
  shared-crumbs reaction
- ~~Legendary aura depth~~ — pulsar reels pals in, stella sparkles them
- ~~animProf++~~ — waddle (walk rhythm), arc (hang-time), glee (reaction
  bias) seeded per species
- ~~Premium accessories~~ — MONOCLE/TIARA/WINGS at 800/1000/1400, gold
  shop frames; per-item cost field
- ~~Pet go-home~~ — `petHome`: drop pet on HOME slot or card SEND HOME
  → sleeps in its ranch cell, green + brings it back. persisted
- ~~Verlet-lite~~ — jigX shear spring: sprite top lags the feet under
  horizontal accel (ctx.transform shear)
- ~~Sprite polish 2~~ — i-core dithered rim + dark-palette lift
- ~~Soundpack hook~~ — SFX_DEFS note tables + sfxPack {pitch,vol,defs}
- ~~Multi-monitor~~ — overlay spans the virtual screen union;
  get_monitors feeds per-display floors (monPlats)
- ~~Update checker~~ — check_update cmd (curl https), NEW VER badge
  on the settings version row when UPDATE_URL reports newer
- ~~Ranch/nursery right-click card~~ — context-menu on an active pal
  cell opens its live status card
- ~~Redeem layering~~ — moved to the #info top overlay
- ~~Album delete~~ — two-tap SURE? + delete_photo cmd + auto-refresh
- ~~Localization verdict~~ — DEFERRED: 5x7 ASCII FONT can't do KR/JP;
  needs a bitmap font project + textW fixed-width assumptions

## Next up (F2P + gem packs — Steam deferred)

0. **itch.io page + account** — FREE download, upload `assets/*.png` +
   `promo.gif`, write the description; sell gem packs as itch
   "rewards"/Gumroad listings with codes from `codes.cjs`. [S]
1. **Code delivery flow** — pick how buyers get codes: Gumroad
   auto-email (easiest), itch reward tiers, or manual messages. [S]
2. **Real gameplay capture** — promo.gif is synthetic; a real recorded
   clip of dangling/ranch still sells better. [S]
3. ~~In-game shop surface~~ — DONE: GEMS row in settings, pack prices,
   store-link slot + redeem door. Set `GEM_SHOP_URL` once the itch
   page exists.
4. ~~Update checker~~ — DONE: `check_update` polls `UPDATE_URL` at
   boot; set the const once the itch page ships.
5. ~~Settings panel growth~~ — DONE: panel height now fits the viewport
   (min 220px), the 14 rows scroll inside a clipped viewport on a wheel
   turn, footer stats stay pinned, offscreen rows take no clicks.
6. **Gem sinks round 2** — species decor, name dyes, ranch themes —
   premium accs landed; more variety keeps big packs attractive. [M]
7. **More seasonal species** — spring/rainy sets; the `SEASONS` table makes
   each new entry ~20 lines. [S]
8. **Synchronized naps** — pals sleeping in a pile when the pet naps;
   partially covered by existing huddle logic. [S]
9. **Steam Cloud + achievements** — deferred until Steam launch; `stats`
   counters already persist locally so SDK wiring is the only work. [M]
10. **Deck / handheld support** — overlay on SteamOS/Game Mode. [L]
11. **Full verlet soft-body** — the jigX shear ships the cheap version;
    a real verlet ring is still an option for one showcase species. [M]
12. **KR/JP localization** — blocked on the ASCII pixel font (see
    verdict above); un-block only if a KR/JP launch is planned. [L]

## backlog
- [ ] qa-sheet 회귀 검사 자동화
- [x] 스테이터스 카드: 월드 내 타겟 표시 — DONE 골드 링+쉐브론
- [x] 랜치/너서리 셀 우클릭으로도 카드 열기 — DONE
- [x] 창 위치 저장 — DONE panelPos → state.json (해상도 키잉 포함)
- [x] 슬라임끼리 간식 나누기/페어 시너지 — DONE FOMO+crumbs/SYNERGY
- [x] 레전더리 오라 심화 — DONE pulsar 인력/stella 스파클
- [x] animProf 확장 — DONE waddle/arc/glee
- [x] 멀티모니터 — DONE union overlay + monPlats
- [x] 사운드팩 훅 — DONE SFX_DEFS + sfxPack
- [x] 커서 올라타기 — DONE rideT0 pendulum
- [x] 간식 낚시 — DONE treatAim cursor-follow
- [x] 쓰다듬기 속도 차별화 — DONE slow=pat / fast=tickle

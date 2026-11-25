// prop put-away harness — boots main.js with stubbed DOM, spawns a bowl,
// drags it into the top-center PUT AWAY slot, checks it's removed; then
// verifies a normal drag just moves it.
const fs = require("fs");
process.chdir(require("path").join(__dirname, ".."));
const calls = [];
const tauriListeners = {};
global.__PROP_TEST_CALLS = calls;
global.__PROP_TEST_CAPTURE_FAIL = false;
global.__PROP_TEST_DRAW_TARGET = null;
global.__PROP_TEST_DRAW_COUNT = 0;

function fakeCtx(canvas) {
  const store = { canvas };
  return new Proxy(store, {
    get(t, prop) {
      if (prop === "canvas") return canvas;
      if (prop === "createImageData" || prop === "getImageData")
        return (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w, height: h });
      if (prop === "measureText") return () => ({ width: 10 });
      if (prop === "createRadialGradient" || prop === "createLinearGradient" || prop === "createPattern")
        return () => ({ addColorStop() {} });
      if (prop === "getContext") return () => fakeCtx(canvas);
      if (prop === "drawImage") return (...args) => {
        if (args[0] === global.__PROP_TEST_DRAW_TARGET) global.__PROP_TEST_DRAW_COUNT++;
      };
      if (prop in t) return t[prop];
      const f = (...a) => {};
      t[prop] = f;
      return f;
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
const els = {};
const getEl = (id) => {
  if (!els[id]) {
    const e = {
      style: {}, innerHTML: "", textContent: "", children: [], listeners: {},
      addEventListener(ev, fn) { (e.listeners[ev] = e.listeners[ev] || []).push(fn); },
      removeEventListener() {}, appendChild() {}, remove() {},
      setPointerCapture() { if (global.__PROP_TEST_CAPTURE_FAIL) throw new Error("simulated capture failure"); },
      releasePointerCapture() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 470, height: 420 }; },
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      querySelector() { return null; }, querySelectorAll() { return []; },
      width: 470, height: 420, offsetLeft: 0, offsetTop: 0, offsetWidth: 470, offsetHeight: 420,
    };
    e.getContext = () => (e._ctx = e._ctx || fakeCtx(e));
    e.toDataURL = () => "data:image/png;base64,AAAA";
    els[id] = e;
  }
  return els[id];
};
let rafCb = null;
global.window = global;
global.innerWidth = 1920; global.innerHeight = 1080; global.devicePixelRatio = 1;
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
global.performance = require("perf_hooks").performance;
global.document = {
  getElementById: getEl,
  createElement: (tag) => (tag === "canvas" ? getEl("_canvas_" + Math.random()) : getEl("_" + tag)),
  createElementNS: (ns, tag) => getEl("_" + tag),
  body: getEl("body"), documentElement: getEl("html"),
  addEventListener() {}, removeEventListener() {},
  fonts: { load: () => Promise.resolve() }, hidden: false,
};
global.navigator = { userAgent: "sim" };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} createOscillator() { return { connect() { return { connect() {} } }, start() {}, stop() {}, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: "" }; } createGain() { return { connect() { return { connect() {} } }, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 } }; } get destination() { return {}; } };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };

global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      calls.push([cmd, args]);
      if (cmd === "load_state") return Promise.resolve(JSON.stringify({ ver: 2, jelly: 100 }));
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      return Promise.resolve(null);
    },
  },
  event: {
    listen: (name, fn) => {
      (tauriListeners[name] = tauriListeners[name] || []).push(fn);
      return Promise.resolve(() => {});
    },
  },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8")
  + "\n;globalThis.__G = () => ({ bowl, box, plant, music, mirror, mat, jar, cushion, propHeld, ballHeld, ball: ball && { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy }, petHome, held, flying, webbing, webHeld, palHeld, pal: pals[0] && { x: pals[0].x, y: pals[0].y, vx: pals[0].vx, vy: pals[0].vy, fly: pals[0].fly, lookDir: pals[0].lookDir }, winW, winH, bangs, petX, petY, fabX, fabY, fabDrag, fabOpen, toyboxOpen, fabPosV: fabPos(), itemRect: (k) => fabItemRect(k), stripRect: () => toyboxStripRect(), stripHit: (mx, my) => { const [sx, sy, sw, sh] = toyboxStripRect(); const inS = mx >= sx && mx <= sx + sw && my >= sy && my <= sy + sh; const slot = Math.max(0, Math.min(8, Math.floor((mx - sx) / 36))); return { inS, slot, item: fabItemHit(mx, my), rect: [sx, sy, sw, sh], toyboxOpen, fabOpen }; }, dirtyV: () => dirty, cursor: cv.style.cursor, boxPlatLive: !!box && (plats.includes(box.plat) || monPlats.includes(box.plat)), plantPlatLive: !!plant && (plats.includes(plant.plat) || monPlats.includes(plant.plat)), dragCalls: globalThis.__PROP_TEST_CALLS.filter(([cmd]) => cmd === 'set_dragging').map(([, args]) => !!(args && args.on)) });"
  + "\n;globalThis.__W = { placeBowl: (x, y) => { const plat = plats.find((p) => p.y === y && x >= p.x && x <= p.x + p.w); bowl = { x, y, plat: plat || null, fill: 3 }; }, placeBox: (x, y) => { const plat = plats.find((p) => p.y === y && x >= p.x && x <= p.x + p.w); box = { x, y, plat: plat || null }; }, placeStaleBox: (x, y) => { box = { x, y, plat: { x, y, w: 200 } }; }, placePlant: (x, y) => { const plat = plats.find((p) => p.y === y && x >= p.x && x <= p.x + p.w); plant = { x, y, plat: plat || null }; }, placeBall: (x, y, vx, vy) => { ball = { x, y, vx, vy, r: 9, rot: 0, sq: 0 }; }, placePal: (x, y) => { pals.length = 0; if (!owned.includes(SPECIES[0].id)) owned.push(SPECIES[0].id); spawnPal(0); Object.assign(pals[0], { x, y, fly: false, plat: null }); }, startWeb: () => { curX = petX; curY = petY - 120; curV = 0; webbing = true; webHeld = false; webUntil = performance.now() + 60000; webT0 = performance.now(); webFromX = petX; webFromY = petY; }, setCaptureFailure: (on) => { globalThis.__PROP_TEST_CAPTURE_FAIL = on; }, ageHeartbeat: () => { lastBeat = performance.now() - 21000; }, ageGrab: () => { const now = performance.now(); grabT0 = now - 21000; lastBeat = now - 21000; }, clearProps: () => { bowl = null; cushion = null; box = null; plant = null; music = null; mirror = null; mat = null; jar = null; ball = null; fabOpen = false; toyboxOpen = false; } };"
  + "\n;Object.assign(globalThis.__W, { spawnBoxOn: (x, y) => { const ox = petX, oy = petY; petX = x; petY = y; box = spawnProp('box'); petX = ox; petY = oy; }, spawnEggOn: (x, y) => { const ox = petX, oy = petY; petX = x; petY = y; dropEgg(); petX = ox; petY = oy; }, placeStaleEgg: (x, y) => { egg = { x, y, plat: { x, y, w: 200 }, t0: performance.now(), wob: 0 }; }, eggState: () => egg && ({ x: egg.x, y: egg.y, live: plats.includes(egg.plat) || monPlats.includes(egg.plat) }), clearEgg: () => { egg = null; }, placeMainTreat: (px, py, tx, ty) => { petX = px; petY = py; petVX = 0; petVY = 0; flying = false; climbing = false; held = false; webbing = false; petHome = false; state = 'idle'; cushionNap = 0; boxHide = 0; walkTarget = null; walkGoal = null; nextWander = Infinity; introDone = true; greeted = true; treat = { x: tx, y: ty, kind: 0, t0: performance.now() }; }, mainTreatState: () => { const now = performance.now(); return { petX, petY, walkTarget, treat: !!treat, treatPos: treat && { x: treat.x, y: treat.y }, state, climbing, held, flying, webbing, petHome, cushionNap, boxHide, star: now < starUntil, face: faceName(now) }; }, launchMain: (x, y, vx, vy) => { petX = x; petY = y; petVX = vx; petVY = vy; flying = true; climbing = false; held = false; webbing = false; petHome = false; state = 'idle'; cushionNap = 0; boxHide = 0; walkTarget = null; walkGoal = null; treat = null; prev = performance.now() - 50; }, mainState: () => ({ x: petX, y: petY, flying }), armChomp: (x, y) => { const i = SPECIES.findIndex((q) => q.trait === 'chomp'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); active = i; petX = x; petY = y; petVX = 0; petVY = 0; flying = false; climbing = false; held = false; webbing = false; petHome = false; state = 'idle'; cushionNap = 0; boxHide = 0; sigT0 = 0; sigId = null; accAct = null; snack = null; treat = null; treatAim = false; walkTarget = null; walkGoal = null; hopTarget = null; nextWander = 0; nextFidget = Infinity; curX = -9999; curY = -9999; curV = 0; introDone = true; greeted = true; }, snackState: () => snack && ({ x: snack.x, y: snack.y, edge: Math.ceil(Math.max(...SHAPES[SPECIES[active].shape]) * blobSize().scale) + 4 }), finishChomp: () => { active = 0; snack = null; nextWander = Infinity; }, armClimb: (x, y) => { globalThis.__W.armChomp(x, y); const i = SPECIES.findIndex((q) => q.trait === 'climb'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); active = i; snack = null; climbPhase = 0; climbEdge = 0; climbing = false; spinT0 = 0; nextWander = 0; }, climbState: () => ({ x: petX, phase: climbPhase, edge: climbEdge, petEdge: Math.ceil(Math.max(...SHAPES[SPECIES[active].shape]) * blobSize().scale) + 4 }), finishClimb: () => { active = 0; climbPhase = 0; climbEdge = 0; climbing = false; spinT0 = 0; nextWander = Infinity; }, launchPal: () => { if (pals[0]) { pals[0].fly = true; pals[0].vx = 0; pals[0].vy = 100; prev = performance.now() - 50; } }, palState: () => pals[0] && ({ x: pals[0].x, y: pals[0].y, fly: pals[0].fly, live: plats.includes(pals[0].plat) || monPlats.includes(pals[0].plat) }) });";
const homeStateHooks = "\n;Object.assign(globalThis.__W, { setMainSleeping: () => { state = 'sleeping'; }, setMainSleepingNearCursor: () => { state = 'sleeping'; stirT = 0; curX = petX; curY = petY - blobSize().h / 2; curV = 0; }, armMainSleepZzz: () => { state = 'sleeping'; cushionNap = 0; lastZzz = -1e9; }, armCushionZzz: () => { state = 'idle'; cushionNap = performance.now() + 60000; lastZzz = -1e9; }, clearCushionZzz: () => { cushionNap = 0; cushionNapW = 0; }, zzzCount: () => zzzs.length, setMainIdle: () => { state = 'idle'; }, startleMain: () => { copyCd = 0; copyPeek(true); }, mainMood: () => state, mainMoodLabel: () => cardMood('pet', performance.now()) });";
const homeBuffHooks = "\n;Object.assign(globalThis.__W, { armParkedBuff: (kind) => { fx.length = 0; bangs.length = 0; drizzleUntil = 0; if (plant) plant.steamUntil = 0; hyperUntil = kind === 2 ? performance.now() + 60000 : 0; noSleepUntil = kind === 3 ? Date.now() + 60000 : 0; globalThis.__PROP_TEST_DRAW_TARGET = sprImg(TREATS[kind].id); globalThis.__PROP_TEST_DRAW_COUNT = 0; idleSkip = 3; prev = performance.now() - 50; }, clearParkedBuff: () => { hyperUntil = 0; noSleepUntil = 0; globalThis.__PROP_TEST_DRAW_TARGET = null; globalThis.__PROP_TEST_DRAW_COUNT = 0; }, fxCount: () => fx.length });";
const homePropHooks = "\n;Object.assign(globalThis.__W, { armParkedPropState: (kind) => { const now = performance.now(); state = 'idle'; cushionNap = kind === 'cushion' ? now + 60000 : 0; cushionNapW = kind === 'cushion' ? Date.now() + 60000 : 0; sitUntil = kind === 'cushion' ? now + 60000 : 0; boxHide = kind === 'box' ? now + 60000 : 0; if (kind === 'box' && !box) box = { x: 420, y: 300, plat: null }; idleSkip = 3; prev = now - 50; }, clearParkedPropState: () => { cushionNap = 0; cushionNapW = 0; sitUntil = 0; boxHide = 0; }, parkedPropState: () => ({ cushionNap, cushionNapW, sitUntil, boxHide }) });";
const homeModeHooks = "\n;Object.assign(globalThis.__W, { armTreatAim: () => { treatAim = true; treat = null; treatFly = null; curX = 640; curY = 360; globalThis.__PROP_TEST_DRAW_TARGET = sprImg('cross'); globalThis.__PROP_TEST_DRAW_COUNT = 0; idleSkip = 3; prev = performance.now() - 50; }, clearTreatAimProbe: () => { treatAim = false; globalThis.__PROP_TEST_DRAW_TARGET = null; globalThis.__PROP_TEST_DRAW_COUNT = 0; }, treatAimState: () => treatAim });";
const homeTreatHooks = "\n;Object.assign(globalThis.__W, { armTreatFlight: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; cushionNap = 0; boxHide = 0; petX = 500; petY = winH; treat = null; treatFly = null; treatFlySeen = false; treatAim = true; fabOpen = false; globalThis.__PROP_TEST_DRAW_TARGET = sprImg(TREATS[treatKind].id); globalThis.__PROP_TEST_DRAW_COUNT = 0; prev = now - 50; }, resetTreatDraws: () => { globalThis.__PROP_TEST_DRAW_COUNT = 0; }, clearTreatFlightProbe: () => { treatAim = false; treat = null; treatFly = null; treatFlySeen = false; globalThis.__PROP_TEST_DRAW_TARGET = null; globalThis.__PROP_TEST_DRAW_COUNT = 0; }, treatFlightState: () => ({ aim: treatAim, flight: !!treatFly, landed: !!treat, seen: treatFlySeen, draws: globalThis.__PROP_TEST_DRAW_COUNT }) });";
const homeTreatReactionHooks = "\n;Object.assign(globalThis.__W, { armTreatMilestone: () => { const tk = TREATS[0]; const every = SPECIES[active].r >= 3 ? JELLY_EVERY / 2 : JELLY_EVERY; xp = Math.max(0, every - tk.xp); munchUntil = 0; starUntil = 0; shockUntil = 0; contentUntil = 0; }, treatReactionState: () => { const now = performance.now(); return { munch: now < munchUntil, star: now < starUntil, face: faceName(now), mood: cardMood('pet', now) }; } });";
const homePomoHooks = "\n;Object.assign(globalThis.__W, { armPomoCheer: () => { pomo = true; pomoPhase = 'focus'; pomoUntil = Date.now() + 60000; pomoHeartNext = -1; hearts.length = 0; bangs.splice(0, bangs.length); boxHide = 0; idleSkip = 3; prev = performance.now() - 50; }, clearPomoCheer: () => { pomo = false; hearts.length = 0; for (let i = bangs.length - 1; i >= 0; i--) if (bangs[i].t === 'GO!') bangs.splice(i, 1); }, pomoCheerState: () => ({ hearts: hearts.length, go: bangs.filter((b) => b.t === 'GO!').length, focus: pomo && pomoPhase === 'focus' }) });";
const homeActHooks = "\n;Object.assign(globalThis.__W, { armBlanketApproach: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; blanketT0 = now || 1; blanketUntil = 0; blanketCd = 0; lastCurMove = now - 400000; curX = 640; curY = 420; petX = 420; petY = winH; walkTarget = curX; hopTarget = null; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, settleMainAtCursor: () => { petX = curX; petY = winH; petVX = 0; petVY = 0; flying = false; held = false; webbing = false; climbing = false; prev = performance.now() - 50; }, clearBlanketProbe: () => { blanketT0 = 0; blanketUntil = 0; lastCurMove = Date.now(); }, blanketState: () => ({ active: !!blanketT0, visible: blanketUntil > performance.now(), hearts: hearts.length, tucked: bangs.filter((b) => b.t === 'TUCKED IN').length }), armSpin: () => { spinT0 = performance.now() || 1; prev = performance.now() - 50; }, clearSpin: () => { spinT0 = 0; }, spinState: () => spinT0, clearFallProbe: () => { startleFall = false; landPeak = 0; dizzyUntil = 0; }, fallState: () => ({ startle: startleFall, peak: landPeak, dizzy: performance.now() < dizzyUntil, ripples: ripples.length }), armYawnFidget: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; energy = 0.2; nextFidget = 0; yawnNext = 0; yawnT = 0; stretchUntil = 0; walkTarget = null; hopTarget = null; begUntil = 0; nextWander = Infinity; awakeAt = Date.now(); prev = now - 50; }, clearYawnProbe: () => { yawnT = 0; stretchUntil = 0; }, yawnState: () => ({ yawn: yawnT > performance.now(), stretch: stretchUntil > performance.now() }) });";
const homeMainSquashRecallHooks = "\n;Object.assign(globalThis.__W, { armMainImpactRecall: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = true; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH - 2; petVX = 0; petVY = 60; startleFall = false; landPeak = 600; squash = 0; squashV = 0; walkTarget = null; walkGoal = null; hopTarget = null; sigT0 = 0; accAct = null; spinT0 = 0; danceT0 = 0; huntT0 = 0; huntPounce = false; blanketT0 = 0; snack = null; treat = null; treatAim = false; begUntil = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, stepMainImpactRecall: () => { prev = performance.now() - 50; }, mainImpactRecallState: () => ({ squash, squashV, flying, vy: petVY }), clearMainImpactRecall: () => { squash = 0; squashV = 0; flying = false; petVX = 0; petVY = 0; } });";
const homeCollisionHooks = "\n;Object.assign(globalThis.__W, { clearCollisionProbe: () => { splatUntil = 0; dizzyUntil = 0; annoyedUntil = 0; poutUntil = 0; cryUntil = 0; shockUntil = 0; contentUntil = 0; }, armLongIgnoredRecall: () => { state = 'idle'; petHome = false; annoyedUntil = 0; awakeAt = Date.now() - RETURN_GRUMPY - 1000; }, sendFirstPalHome: () => { if (pals[0]) sendPalHome(pals[0]); }, collisionState: () => { const now = performance.now(); return { splat: now < splatUntil, dizzy: now < dizzyUntil, annoyed: now < annoyedUntil, pout: now < poutUntil, cry: now < cryUntil, face: faceName(now), mood: cardMood('pet', now) }; } });";
const homeGestureHooks = "\n;Object.assign(globalThis.__W, { armMainTickle: () => { state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; tickleUntil = 0; tickleCd = 0; shockUntil = 0; contentUntil = 0; wiggleBuf.length = 0; }, armMainScritch: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; petUntil = 0; rubDir = 0; rubCount = 0; rubCd = 0; shockUntil = 0; contentUntil = 0; sigT0 = 0; accAct = null; blanketT0 = 0; walkTarget = null; walkGoal = null; hopTarget = null; nextWander = Infinity; nextFidget = Infinity; curX = petX; curY = petY - blobSize().h / 2; curV = 350; curVX = 0; lastCurT = now; prev = now - 50; }, stepMainScritch: (dir) => { const now = performance.now(); curX = petX; curY = petY - blobSize().h / 2; curV = 350; curVX = dir * 350; lastCurT = now; prev = now - 50; }, clearGestureProbe: () => { tickleUntil = 0; petUntil = 0; rubDir = 0; rubCount = 0; shockUntil = 0; contentUntil = 0; wiggleBuf.length = 0; }, gestureState: () => { const now = performance.now(); return { tickle: now < tickleUntil, pet: now < petUntil, face: faceName(now), mood: cardMood('pet', now) }; } });";
const homeScritchProgressHooks = "\n;Object.assign(globalThis.__W, { settleMainForScritch: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; walkTarget = null; walkGoal = null; hopTarget = null; nextWander = Infinity; nextFidget = Infinity; curX = petX; curY = petY - blobSize().h / 2; curV = 0; curVX = 0; lastCurT = now; prev = now - 50; }, clearScritchProgress: () => { rubDir = 0; rubCount = 0; rubCd = 0; petUntil = 0; shockUntil = 0; contentUntil = 0; }, scritchProgressState: () => ({ count: rubCount, dir: rubDir, pet: performance.now() < petUntil }) });";
const homeWiggleProgressHooks = "\n;Object.assign(globalThis.__W, { clearWiggleProgress: () => { wiggleBuf.length = 0; tickleUntil = 0; tickleCd = 0; shockUntil = 0; contentUntil = 0; }, wiggleProgressState: () => { const now = performance.now(); return { length: wiggleBuf.length, tickle: now < tickleUntil, face: faceName(now) }; } });";
const homeHopProgressHooks = "\n;Object.assign(globalThis.__W, { armMainHopWind: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; webHeld = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; walkTarget = null; walkGoal = null; hopTarget = 700; hopWind = 0; sitUntil = 0; sigT0 = 0; accAct = null; spinT0 = 0; danceT0 = 0; huntT0 = 0; huntPounce = false; blanketT0 = 0; snack = null; treat = null; treatAim = false; begUntil = 0; shockUntil = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; awakeAt = Date.now(); nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, settleMainForFreshHop: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; walkTarget = null; walkGoal = null; hopTarget = 700; sitUntil = 0; sigT0 = 0; accAct = null; spinT0 = 0; danceT0 = 0; huntT0 = 0; huntPounce = false; blanketT0 = 0; snack = null; treat = null; treatAim = false; begUntil = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, ageRetainedHopWind: () => { if (hopWind) hopWind = performance.now() - 1; }, clearHopProgress: () => { hopTarget = null; hopWind = 0; flying = false; petVX = 0; petVY = 0; shockUntil = 0; }, hopProgressState: () => ({ target: hopTarget, wind: hopWind, flying, vy: petVY }) });";
const homeErrandHooks = "\n;Object.assign(globalThis.__W, { armMainBowlErrand: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; webHeld = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; bowl = { x: 600, y: winH, plat: monPlats[0] || null, fill: 3 }; bowlCd = 0; walkTarget = 582; walkGoal = { kind: 'bowl', tx: 582 }; walkSpd = 55; hopTarget = null; hopWind = 0; sitUntil = 0; sigT0 = 0; accAct = null; spinT0 = 0; danceT0 = 0; huntT0 = 0; huntPounce = false; blanketT0 = 0; snack = null; treat = null; treatAim = false; begUntil = 0; shockUntil = 0; munchUntil = 0; contentUntil = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; awakeAt = Date.now(); nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, settleUnrelatedWalkAtOldGoal: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 582; petY = winH; petVX = 0; petVY = 0; walkTarget = 582; walkSpd = 55; hopTarget = null; hopWind = 0; sitUntil = 0; sigT0 = 0; accAct = null; spinT0 = 0; danceT0 = 0; huntT0 = 0; huntPounce = false; blanketT0 = 0; snack = null; treat = null; treatAim = false; begUntil = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, clearErrandProbe: () => { walkTarget = null; walkGoal = null; bowl = null; munchUntil = 0; contentUntil = 0; shockUntil = 0; }, errandState: () => ({ target: walkTarget, goal: walkGoal && walkGoal.kind, fill: bowl && bowl.fill, munch: performance.now() < munchUntil }) });";
const homeBoopHooks = "\n;Object.assign(globalThis.__W, { armMainBoop: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; walkTarget = null; walkGoal = null; hopTarget = null; sigT0 = 0; accAct = null; lastClickT = 0; awakeAt = Date.now(); splatUntil = 0; dizzyUntil = 0; shockUntil = 0; tickleUntil = 0; annoyedUntil = 0; starUntil = 0; winkUntil = 0; cryUntil = 0; poutUntil = 0; smugUntil = 0; blepUntil = 0; embarUntil = 0; contentUntil = 0; petWhy = null; petFaceWhy = {}; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, boopPoint: () => ({ x: petX, y: petY - blobSize().h * 0.65 }), clearBoopProbe: () => { winkUntil = 0; embarUntil = 0; shockUntil = 0; contentUntil = 0; petWhy = null; petFaceWhy = {}; }, boopState: () => { const now = performance.now(); return { wink: now < winkUntil, embar: now < embarUntil, content: now < contentUntil, face: faceName(now), mood: cardMood('pet', now), boops: (petWhy === 'BOOP' || petFaceWhy.embar === 'BOOP') ? 1 : 0 }; } });";
const homeClickProgressHooks = "\n;Object.assign(globalThis.__W, { armMainClickProgress: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; webHeld = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; lastClickT = 0; pokeStreak = 0; pokeLast = 0; contentUntil = 0; shockUntil = 0; spinT0 = 0; sigT0 = 0; accAct = null; huntT0 = 0; huntPounce = false; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; nextWander = Infinity; nextFidget = Infinity; curX = -9999; curY = -9999; curV = 0; curVX = 0; prev = now - 50; }, settleMainForClick: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; shockUntil = 0; sigT0 = 0; accAct = null; huntT0 = 0; huntPounce = false; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; nextWander = Infinity; nextFidget = Infinity; curX = -9999; curY = -9999; curV = 0; curVX = 0; prev = now - 50; }, mainClickPoint: () => ({ x: petX + 20, y: petY - blobSize().h * 0.7 }), primePendingClick: () => { lastClickT = Date.now(); }, clearClickProgress: () => { held = false; flying = false; petVX = 0; petVY = 0; lastClickT = 0; contentUntil = 0; shockUntil = 0; spinT0 = 0; }, clickProgressState: () => ({ pending: lastClickT > 0 && Date.now() - lastClickT < 350, flying, vy: petVY }) });";
const homePokeProgressHooks = "\n;Object.assign(globalThis.__W, { armMainPokeProgress: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; webHeld = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; pokeStreak = 0; pokeLast = 0; lastClickT = 0; annoyedUntil = 0; poutUntil = 0; shockUntil = 0; sigT0 = 0; accAct = null; spinT0 = 0; huntT0 = 0; huntPounce = false; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; nextWander = Infinity; nextFidget = Infinity; curX = -9999; curY = -9999; curV = 0; curVX = 0; for (let i = bangs.length - 1; i >= 0; i--) if (bangs[i].t === 'HEY!' || bangs[i].t === '!') bangs.splice(i, 1); prev = now - 50; }, settleMainForPoke: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; shockUntil = 0; sigT0 = 0; accAct = null; spinT0 = 0; huntT0 = 0; huntPounce = false; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; lastClickT = Date.now() - 400; nextWander = Infinity; nextFidget = Infinity; curX = -9999; curY = -9999; curV = 0; curVX = 0; prev = now - 50; }, mainPokePoint: () => ({ x: petX, y: petY - blobSize().h * 0.25 }), clearPokeProgress: () => { held = false; pokeStreak = 0; pokeLast = 0; lastClickT = 0; annoyedUntil = 0; poutUntil = 0; shockUntil = 0; for (let i = bangs.length - 1; i >= 0; i--) if (bangs[i].t === 'HEY!' || bangs[i].t === '!') bangs.splice(i, 1); }, pokeProgressState: () => { const now = performance.now(); return { streak: pokeStreak, annoyed: now < annoyedUntil, pout: now < poutUntil, hey: bangs.filter((b) => b.t === 'HEY!').length }; } });";
const homePressureProgressHooks = "\n;Object.assign(globalThis.__W, { armMainPressureProgress: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; webHeld = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; boopT = 0; poutUntil = 0; shockUntil = 0; sigT0 = 0; accAct = null; huntT0 = 0; huntPounce = false; huntScore = 0; huntCd = Infinity; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; begUntil = 0; ignoreT = 0; noticeT = 0; noticeCd = Infinity; blanketT0 = 0; blanketCd = Infinity; legFlairT = Infinity; nextWander = Infinity; nextFidget = Infinity; for (let i = bangs.length - 1; i >= 0; i--) if (bangs[i].t === '!') bangs.splice(i, 1); curX = petX + 30; curY = petY - blobSize().h / 2; curV = 100; curVX = 0; lastCurT = now; prev = now - 50; }, stepMainPressureProgress: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; shockUntil = 0; sigT0 = 0; accAct = null; huntT0 = 0; huntPounce = false; huntCd = Infinity; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; begUntil = 0; curX = petX + 30; curY = petY - blobSize().h / 2; curV = 100; curVX = 0; lastCurT = now; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, clearPressureProgress: () => { boopT = 0; poutUntil = 0; shockUntil = 0; huntCd = 0; blanketCd = 0; noticeCd = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; for (let i = bangs.length - 1; i >= 0; i--) if (bangs[i].t === '!') bangs.splice(i, 1); }, pressureProgressState: () => { const now = performance.now(); return { pressure: boopT, flying, pout: now < poutUntil, shove: bangs.filter((b) => b.t === '!').length }; } });";
const homeNoticeProgressHooks = "\n;Object.assign(globalThis.__W, { armMainNoticeProgress: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; webHeld = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; noticeT = 0; noticeCd = 0; boopT = 0; shockUntil = 0; sigT0 = 0; accAct = null; spinT0 = 0; huntT0 = 0; huntPounce = false; huntScore = 0; huntCd = Infinity; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; begUntil = 0; ignoreT = 0; blanketT0 = 0; blanketCd = Infinity; lastCurMove = now; legFlairT = Infinity; nextWander = Infinity; nextFidget = Infinity; curX = petX + 120; curY = petY - blobSize().h / 2; curV = 0; curVX = 0; lastCurT = now; prev = now - 50; }, stepMainNoticeProgress: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; shockUntil = 0; sigT0 = 0; accAct = null; spinT0 = 0; huntT0 = 0; huntPounce = false; huntCd = Infinity; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; begUntil = 0; curX = petX + 120; curY = petY - blobSize().h / 2; curV = 0; curVX = 0; lastCurT = now; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, clearNoticeProgress: () => { noticeT = 0; noticeCd = 0; huntCd = 0; blanketCd = 0; shockUntil = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; }, noticeProgressState: () => { const now = performance.now(); return { progress: noticeT, triggered: noticeCd > now, flying }; } });";
const homeFlairHooks = "\n;Object.assign(globalThis.__W, { armBitesFlair: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.id === 'bites'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); active = i; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; walkTarget = null; walkGoal = null; hopTarget = null; huntT0 = 0; huntPounce = false; blanketT0 = 0; sigT0 = 0; accAct = null; spinT0 = 0; munchUntil = 0; blepUntil = 0; shockUntil = 0; contentUntil = 0; curX = -9999; curY = -9999; curV = 0; legFlairT = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, clearFlairProbe: () => { active = 0; spinT0 = 0; munchUntil = 0; blepUntil = 0; shockUntil = 0; contentUntil = 0; legFlairT = Infinity; }, flairState: () => { const now = performance.now(); return { spin: !!spinT0, munch: now < munchUntil, blep: now < blepUntil, face: faceName(now), mood: cardMood('pet', now), armed: legFlairT > now }; } });";
const homeHuntProgressHooks = "\n;Object.assign(globalThis.__W, { armMainHuntProgress: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.ps === 'bold'); active = i >= 0 ? i : 0; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; energy = 1; huntT0 = 0; huntPounce = false; huntScore = 0; huntCd = 0; begUntil = 0; shockUntil = 0; sigT0 = 0; accAct = null; spinT0 = 0; danceT0 = 0; blanketT0 = 0; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; curX = 800; curY = petY - blobSize().h / 2; curV = 500; curVX = 500; lastCurT = now; awakeAt = Date.now(); nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, stepMainHuntProgress: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; begUntil = 0; shockUntil = 0; sigT0 = 0; accAct = null; spinT0 = 0; danceT0 = 0; blanketT0 = 0; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; curX = 800; curY = petY - blobSize().h / 2; curV = 500; curVX = 500; lastCurT = now; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, clearHuntProgress: () => { active = 0; huntT0 = 0; huntPounce = false; huntScore = 0; huntCd = 0; shockUntil = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; }, huntProgressState: () => ({ score: huntScore, stalking: !!huntT0, pounce: huntPounce, status: cardStatus('pet', performance.now()) }) });";
const homeCircleProgressHooks = "\n;Object.assign(globalThis.__W, { armMainCircleProgress: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; webHeld = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; sigT0 = 0; accAct = null; spinT0 = 0; dizzyUntil = 0; circScore = 0; circAng = null; circCd = 0; huntT0 = 0; huntPounce = false; huntScore = 0; huntCd = Infinity; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; begUntil = 0; shockUntil = 0; legFlairT = Infinity; nextWander = Infinity; nextFidget = Infinity; for (let i = bangs.length - 1; i >= 0; i--) if (bangs[i].t === 'WHEE!') bangs.splice(i, 1); curX = -9999; curY = -9999; curV = 0; curVX = 0; lastCurT = now; prev = now - 50; }, stepMainCircleProgress: (ang) => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; sigT0 = 0; accAct = null; huntT0 = 0; huntPounce = false; huntCd = Infinity; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; begUntil = 0; shockUntil = 0; curX = petX + Math.cos(ang) * 200; curY = petY - blobSize().h / 2 + Math.sin(ang) * 200; curV = 500; curVX = 0; lastCurT = now; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, clearCircleProgress: () => { circScore = 0; circAng = null; circCd = 0; spinT0 = 0; dizzyUntil = 0; huntCd = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; for (let i = bangs.length - 1; i >= 0; i--) if (bangs[i].t === 'WHEE!') bangs.splice(i, 1); }, circleProgressState: () => { const now = performance.now(); return { score: circScore, angle: circAng, spinning: !!spinT0, dizzy: now < dizzyUntil, whee: bangs.filter((b) => b.t === 'WHEE!').length }; } });";
const homeHuntRecallHooks = "\n;Object.assign(globalThis.__W, { armRecallHuntPounce: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = true; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = 300; petVX = 0; petVY = 120; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; huntT0 = 0; huntPounce = true; huntScore = 0; huntCd = 0; sigT0 = 0; accAct = null; spinT0 = 0; splatUntil = 0; dizzyUntil = 0; shockUntil = 0; poutUntil = 0; smugUntil = 0; contentUntil = 0; curX = petX; curY = petY - blobSize().h / 2; curV = 0; curVX = 0; lastCurT = now; for (let i = bangs.length - 1; i >= 0; i--) if (bangs[i].t === 'GOTCHA') bangs.splice(i, 1); nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, landRecalledHuntPounce: () => { const now = performance.now(); petHome = false; held = false; flying = true; petY = winH - 2; petVX = 0; petVY = 220; curX = petX; curY = petY - blobSize().h / 2; curV = 0; curVX = 0; lastCurT = now; prev = now - 50; }, clearRecallHuntProbe: () => { huntT0 = 0; huntPounce = false; huntScore = 0; smugUntil = 0; contentUntil = 0; shockUntil = 0; for (let i = bangs.length - 1; i >= 0; i--) if (bangs[i].t === 'GOTCHA') bangs.splice(i, 1); curX = -9999; curY = -9999; }, recallHuntState: () => ({ stalking: !!huntT0, pounce: huntPounce, flying, gotcha: bangs.filter((b) => b.t === 'GOTCHA').length, smug: performance.now() < smugUntil }) });";
const homeHuntHooks = "\n;Object.assign(globalThis.__W, { armHuntCatch: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = true; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH - 2; petVX = 0; petVY = 0; walkTarget = null; walkGoal = null; hopTarget = null; huntT0 = 0; huntPounce = true; sigT0 = 0; accAct = null; spinT0 = 0; splatUntil = 0; dizzyUntil = 0; shockUntil = 0; tickleUntil = 0; annoyedUntil = 0; starUntil = 0; winkUntil = 0; cryUntil = 0; poutUntil = 0; smugUntil = 0; blepUntil = 0; contentUntil = 0; hearts.length = 0; curX = petX; curY = petY - blobSize().h / 2; curV = 0; curVX = 0; lastCurT = now; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, clearHuntProbe: () => { huntT0 = 0; huntPounce = false; smugUntil = 0; shockUntil = 0; contentUntil = 0; curX = -9999; curY = -9999; }, huntState: () => { const now = performance.now(); return { pounce: huntPounce, smug: now < smugUntil, face: faceName(now), gotcha: hearts.length }; } });";
const homeCuddleHooks = "\n;Object.assign(globalThis.__W, { armMainCuddle: () => { const now = performance.now(); active = 0; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; webHeld = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; walkTarget = null; walkGoal = null; hopTarget = null; sigT0 = 0; accAct = null; splatUntil = 0; dizzyUntil = 0; shockUntil = 0; tickleUntil = 0; petUntil = 0; annoyedUntil = 0; starUntil = 0; winkUntil = 0; cryUntil = 0; poutUntil = 0; smugUntil = 0; blepUntil = 0; contentUntil = 0; cuddleT = 0; cuddleUntil = 0; dragVX = 0; dragVY = 0; hearts.length = 0; awakeAt = Date.now(); nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, cuddlePoint: () => ({ x: petX, y: petY - blobSize().h / 2 }), primeMainCuddle: () => { cuddleT = 1.19; dragVX = 0; dragVY = 0; prev = performance.now() - 50; }, clearCuddleProbe: () => { held = false; cuddleT = 0; cuddleUntil = 0; shockUntil = 0; contentUntil = 0; }, cuddleState: () => { const now = performance.now(); return { held, active: now < cuddleUntil, accrued: cuddleT, face: faceName(now), hearts: hearts.length }; } });";
const homeSocialHooks = "\n;Object.assign(globalThis.__W, { armAttentionSeek: () => { const now = performance.now(); const calm = SPECIES.findIndex((q) => !((PSYCH[q.ps] || {}).flee)); if (calm >= 0) active = calm; state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; curX = 700; curY = winH - 20; curV = 0; curVX = 0; lastCurT = now; ignoreT = 100; begUntil = 0; walkTarget = null; hopTarget = null; blanketT0 = 0; lastCurMove = Date.now(); nextWander = Infinity; nextFidget = Infinity; introDone = true; greeted = true; prev = now - 50; }, clearBegProbe: () => { begUntil = 0; walkTarget = null; }, begState: () => ({ active: begUntil > performance.now(), target: walkTarget }) });";
const homeAttentionDebtHooks = "\n;Object.assign(globalThis.__W, { settleMainForAttention: () => { const now = performance.now(); state = 'idle'; petHome = false; held = false; flying = false; webbing = false; climbing = false; boxHide = 0; cushionNap = 0; petX = 500; petY = winH; petVX = 0; petVY = 0; walkTarget = null; walkGoal = null; hopTarget = null; hopWind = 0; begUntil = 0; sigT0 = 0; accAct = null; huntT0 = 0; huntPounce = false; huntCd = Infinity; noticeT = 0; noticeCd = Infinity; blanketT0 = 0; blanketCd = Infinity; lastCurMove = now; legFlairT = Infinity; curX = 700; curY = petY - blobSize().h / 2; curV = 0; curVX = 0; lastCurT = now; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, clearAttentionDebt: () => { ignoreT = 0; begUntil = 0; walkTarget = null; walkGoal = null; huntCd = 0; noticeCd = 0; blanketCd = 0; }, attentionDebtState: () => ({ ignored: ignoreT, active: begUntil > performance.now(), target: walkTarget }) });";
const homeIsolationHooks = "\n;Object.assign(globalThis.__W, { suppressFreshBlanket: () => { blanketCd = performance.now() + 60000; } });";
const homePalRecallHooks = "\n;Object.assign(globalThis.__W, { armPalWebRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.id === 'spidr'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); pals.length = 0; spawnPal(i); Object.assign(pals[0], { x: 200, y: 300, vx: 0, vy: 0, fly: false, plat: null, web: now + 60000, webA: 0.8, webAV: 0.1 }); curX = 1200; curY = 200; curV = 0; curVX = 0; lastCurT = now; prev = now - 50; }, palWebRecallState: () => { const p = pals[0]; return p && { web: p.web > performance.now(), fly: p.fly, x: p.x, y: p.y, webA: p.webA, webAV: p.webAV }; }, clearPalWebRecall: () => { pals.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; }, armPalBoxRecall: () => { const now = performance.now(); if (!owned.includes(SPECIES[0].id)) owned.push(SPECIES[0].id); pals.length = 0; box = { x: 320, y: winH, plat: plats[0] || null }; spawnPal(0); Object.assign(pals[0], { x: box.x, y: box.y, vx: 0, vy: 0, fly: false, plat: box.plat, hideUntil: now + 60000 }); curX = 1200; curY = 200; curV = 0; curVX = 0; lastCurT = now; prev = now - 50; }, palBoxRecallState: () => { const p = pals[0]; return p && { hidden: p.hideUntil > performance.now(), fly: p.fly, x: p.x, y: p.y, boxX: box && box.x }; }, clearPalBoxRecall: () => { pals.length = 0; box = null; curX = -9999; curY = -9999; curV = 0; curVX = 0; }, armPalNapRecall: () => { const now = performance.now(); if (!owned.includes(SPECIES[0].id)) owned.push(SPECIES[0].id); pals.length = 0; spawnPal(0); Object.assign(pals[0], { x: 420, y: winH, vx: 0, vy: 0, fly: false, plat: plats[0] || null, restUntil: now + 60000, faceT: 0, faceId: null }); curX = 1200; curY = 200; curV = 0; curVX = 0; lastCurT = now; prev = now - 50; }, palNapRecallState: () => { const p = pals[0]; const now = performance.now(); return p && { napping: p.restUntil > now, fly: p.fly, face: p.pf, status: cardStatus(p, now) }; }, clearPalNapRecall: () => { pals.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalErrandRecallHooks = "\n;Object.assign(globalThis.__W, { armPalBowlErrandRecall: () => { const now = performance.now(); if (!owned.includes(SPECIES[0].id)) owned.push(SPECIES[0].id); const pl = plats[0] || { x: 0, y: winH, w: winW }; bowl = { x: 760, y: pl.y, plat: pl, fill: 3 }; pals.length = 0; spawnPal(0); Object.assign(pals[0], { x: 320, y: pl.y, vx: 0, vy: 0, fly: false, plat: pl, walkT: null, propGoal: null, nextT: 0, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, accCd: Infinity, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = pl.y; cushionNap = 0; boxHide = 0; danceT0 = 0; treat = null; treatFly = null; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, palErrandRecallState: () => { const p = pals[0]; return p && { goal: p.propGoal && p.propGoal.kind, target: p.walkT, fly: p.fly }; }, clearPalErrandRecall: () => { pals.length = 0; bowl = null; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalSignatureRecallHooks = "\n;Object.assign(globalThis.__W, { armPalSignatureRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.sig === 'umbral'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); const pl = plats[0] || { x: 0, y: winH, w: winW }; pals.length = 0; spawnPal(i); Object.assign(pals[0], { x: 420, y: pl.y, vx: 0, vy: 0, fly: false, plat: pl, walkT: null, propGoal: null, nextT: 0, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, sigT: 0, sigId: null, sigDid: 0, accCd: Infinity, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = pl.y; cushionNap = 0; boxHide = 0; danceT0 = 0; treat = null; treatFly = null; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, palSignatureRecallState: () => { const p = pals[0]; const now = performance.now(); return p && { active: p.sigT > now, id: p.sigId, did: p.sigDid, fly: p.fly, status: cardStatus(p, now) }; }, clearPalSignatureRecall: () => { pals.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalAccessoryRecallHooks = "\n;Object.assign(globalThis.__W, { armPalAccessoryRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.id === 'sprout'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); accEquip[SPECIES[i].id] = 'stache'; const pl = plats[0] || { x: 0, y: winH, w: winW }; pals.length = 0; spawnPal(i); Object.assign(pals[0], { x: 420, y: pl.y, vx: 0, vy: 0, fly: false, plat: pl, walkT: null, propGoal: null, nextT: Infinity, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, sigT: 0, accAct: null, accCd: 0, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = pl.y; cushionNap = 0; boxHide = 0; danceT0 = 0; treat = null; treatFly = null; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, settlePalAccessoryRecall: () => { const p = pals[0]; const pl = plats[0] || { x: 0, y: winH, w: winW }; p.x = 540; p.y = pl.y; p.vx = 0; p.vy = 0; p.fly = false; p.plat = pl; if (p.accAct) p.accAct.t0 = performance.now() - 700; prev = performance.now() - 50; }, palAccessoryRecallState: () => { const p = pals[0]; return p && { id: p.accAct && p.accAct.id, step: p.accAct && p.accAct.step, fly: p.fly, vy: p.vy }; }, clearPalAccessoryRecall: () => { const i = SPECIES.findIndex((q) => q.id === 'sprout'); delete accEquip[SPECIES[i].id]; pals.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalPressureRecallHooks = "\n;Object.assign(globalThis.__W, { armPalPressureRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.id === 'sprout'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); const pl = plats[0] || { x: 0, y: winH, w: winW }; pals.length = 0; spawnPal(i); const p = pals[0]; const threshold = 1 / ((PSYCH[(SPECIES[p.sp] || {}).ps] || {}).startle || 1); Object.assign(p, { x: 420, y: pl.y, vx: 0, vy: 0, fly: false, plat: pl, walkT: null, propGoal: null, nextT: Infinity, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, sigT: 0, accAct: null, boopT: threshold - 0.11, accCd: Infinity, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = pl.y; cushionNap = 0; boxHide = 0; danceT0 = 0; treat = null; treatFly = null; curX = p.x + 30; curY = p.y - 18; curV = 100; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, settlePalPressureRecall: () => { const now = performance.now(); const p = pals[0]; const pl = plats[0] || { x: 0, y: winH, w: winW }; p.y = pl.y; p.vx = 0; p.vy = 0; p.fly = false; p.plat = pl; petX = 1100; petY = pl.y; flying = false; curX = p.x + 30; curY = p.y - 18; curV = 100; curVX = 0; prev = now - 50; }, palPressureRecallState: () => { const p = pals[0]; const threshold = p && 1 / ((PSYCH[(SPECIES[p.sp] || {}).ps] || {}).startle || 1); return p && { pressure: p.boopT || 0, threshold, fly: p.fly, vy: p.vy, face: p.faceId }; }, clearPalPressureRecall: () => { pals.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalScritchRecallHooks = "\n;Object.assign(globalThis.__W, { armPalScritchRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.id === 'sprout'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); const pl = plats[0] || { x: 0, y: winH, w: winW }; pals.length = 0; spawnPal(i); const p = pals[0]; Object.assign(p, { x: 420, y: pl.y, vx: 0, vy: 0, fly: false, plat: pl, walkT: null, propGoal: null, nextT: Infinity, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, sigT: 0, accAct: null, boopT: 0, rubDir: 0, rubCount: 0, rubCd: 0, faceId: null, faceT: 0, accCd: Infinity, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); hearts.length = 0; state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = pl.y; cushionNap = 0; boxHide = 0; danceT0 = 0; treat = null; treatFly = null; curX = p.x; curY = p.y - 18; curV = 350; curVX = 350; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, stepPalScritchRecall: (dir) => { const now = performance.now(); const p = pals[0]; curX = p.x; curY = p.y - 18; curV = 350; curVX = dir * 350; prev = now - 50; }, settlePalScritchRecall: (dir) => { const now = performance.now(); const p = pals[0]; const pl = plats[0] || { x: 0, y: winH, w: winW }; p.y = pl.y; p.vx = 0; p.vy = 0; p.fly = false; p.plat = pl; petX = 1100; petY = pl.y; flying = false; curX = p.x; curY = p.y - 18; curV = 350; curVX = dir * 350; prev = now - 50; }, palScritchRecallState: () => { const p = pals[0]; return p && { count: p.rubCount || 0, dir: p.rubDir || 0, cooling: (p.rubCd || 0) > performance.now(), fly: p.fly, hearts: hearts.length }; }, clearPalScritchRecall: () => { pals.length = 0; hearts.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalHopRecallHooks = "\n;Object.assign(globalThis.__W, { armPalHopRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.mv === 'hop'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); const pl = plats[0] || { x: 0, y: winH, w: winW }; pals.length = 0; spawnPal(i); const p = pals[0]; Object.assign(p, { x: 420, y: pl.y, vx: 0, vy: 0, fly: false, plat: pl, walkT: 660, propGoal: null, nextT: Infinity, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, sigT: 0, accAct: null, hopWind: 0, accCd: Infinity, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = pl.y; cushionNap = 0; boxHide = 0; danceT0 = 0; treat = null; treatFly = null; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, settlePalHopRecall: () => { const now = performance.now(); const p = pals[0]; const pl = plats[0] || { x: 0, y: winH, w: winW }; p.x = 420; p.y = pl.y; p.vx = 0; p.vy = 0; p.fly = false; p.plat = pl; p.walkT = 660; p.nextT = Infinity; if (p.hopWind) p.hopWind = now - 1; petX = 1100; petY = pl.y; flying = false; curX = -9999; curY = -9999; curV = 0; curVX = 0; prev = now - 50; }, palHopRecallState: () => { const p = pals[0]; return p && { target: p.walkT, wind: p.hopWind || 0, fly: p.fly, vy: p.vy, move: (SPECIES[p.sp] || {}).mv }; }, clearPalHopRecall: () => { pals.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalWalkRecallHooks = "\n;Object.assign(globalThis.__W, { armPalWalkRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => !q.mv); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); const pl = plats[0] || { x: 0, y: winH, w: winW }; pals.length = 0; spawnPal(i); const p = pals[0]; Object.assign(p, { x: 420, y: pl.y, vx: 0, vy: 0, fly: false, plat: pl, walkT: 660, walkV: 0, propGoal: null, nextT: Infinity, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, sigT: 0, accAct: null, hopWind: 0, faceId: null, faceT: 0, accCd: Infinity, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = pl.y; cushionNap = 0; boxHide = 0; danceT0 = 0; treat = null; treatFly = null; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, stepPalWalkRecall: () => { prev = performance.now() - 50; }, settlePalWalkRecall: () => { const now = performance.now(); const p = pals[0]; const pl = plats[0] || { x: 0, y: winH, w: winW }; p.x = 420; p.y = pl.y; p.vx = 0; p.vy = 0; p.fly = false; p.plat = pl; p.walkT = 660; p.nextT = Infinity; petX = 1100; petY = pl.y; flying = false; curX = -9999; curY = -9999; curV = 0; curVX = 0; prev = now - 50; }, palWalkRecallState: () => { const p = pals[0]; return p && { x: p.x, target: p.walkT, speed: p.walkV || 0, fly: p.fly, move: (SPECIES[p.sp] || {}).mv || 'walk' }; }, clearPalWalkRecall: () => { pals.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalFaceRecallHooks = "\n;Object.assign(globalThis.__W, { armPalMunchRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.id === 'sprout'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); const pl = plats[0] || { x: 0, y: winH, w: winW }; pals.length = 0; spawnPal(i); const p = pals[0]; Object.assign(p, { x: 408, y: pl.y, vx: 0, vy: 0, fly: false, plat: pl, walkT: 408, walkV: 0, propGoal: { kind: 'treat', at: now }, nextT: Infinity, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, sigT: 0, accAct: null, faceId: null, faceT: 0, accCd: Infinity, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); treat = { x: 420, y: pl.y, kind: 0, t0: now }; treatFly = null; state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = pl.y; cushionNap = 0; boxHide = 0; danceT0 = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, palFaceRecallState: () => { const p = pals[0]; const now = performance.now(); return p && { face: p.pf, id: p.faceId, active: (p.faceT || 0) > now, mood: cardMood(p, now), status: cardStatus(p, now), treat: !!treat, fly: p.fly }; }, clearPalFaceRecall: () => { pals.length = 0; treat = null; treatFly = null; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalFallRecallHooks = "\n;Object.assign(globalThis.__W, { armPalFallRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.id === 'sprout'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); pals.length = 0; spawnPal(i); const p = pals[0]; Object.assign(p, { x: 420, y: 180, vx: 0, vy: 900, fly: true, plat: null, fallPk: 0, walkT: null, walkV: 0, propGoal: null, nextT: Infinity, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, sigT: 0, accAct: null, faceId: null, faceT: 0, accCd: Infinity, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = winH; cushionNap = 0; boxHide = 0; danceT0 = 0; treat = null; treatFly = null; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, palFallRecallState: () => { const p = pals[0]; return p && { peak: p.fallPk || 0, fly: p.fly, vy: p.vy }; }, clearPalFallRecall: () => { pals.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalLookRecallHooks = "\n;Object.assign(globalThis.__W, { armPalLookRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.id === 'sprout'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); accEquip[SPECIES[i].id] = 'monocle'; const pl = plats[0] || { x: 0, y: winH, w: winW }; pals.length = 0; spawnPal(i); const p = pals[0]; Object.assign(p, { x: 420, y: pl.y, vx: 0, vy: 0, fly: false, plat: pl, walkT: null, walkV: 0, propGoal: null, nextT: Infinity, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, sigT: 0, accAct: null, lookDir: 1, lookUntil: 0, faceId: null, faceT: 0, accCd: 0, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = pl.y; cushionNap = 0; boxHide = 0; danceT0 = 0; treat = null; treatFly = null; curX = 800; curY = pl.y - 20; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, parkPalLookCursor: () => { curX = -9999; curY = -9999; curV = 0; curVX = 0; }, palLookRecallState: () => { const p = pals[0]; const now = performance.now(); return p && { id: p.accAct && p.accAct.id, step: p.accAct && p.accAct.step, looking: (p.lookUntil || 0) > now, face: p.pf, fly: p.fly }; }, clearPalLookRecall: () => { const i = SPECIES.findIndex((q) => q.id === 'sprout'); delete accEquip[SPECIES[i].id]; pals.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
const homePalSquashRecallHooks = "\n;Object.assign(globalThis.__W, { armPalImpactRecall: () => { const now = performance.now(); const i = SPECIES.findIndex((q) => q.id === 'sprout'); if (!owned.includes(SPECIES[i].id)) owned.push(SPECIES[i].id); const pl = plats[0] || { x: 0, y: winH, w: winW }; pals.length = 0; spawnPal(i); const p = pals[0]; Object.assign(p, { x: pl.x + pl.w / 2, y: pl.y - 2, vx: 0, vy: 900, fly: true, plat: null, fallPk: 0, squash: 0, squashV: 0, walkT: null, walkV: 0, propGoal: null, nextT: Infinity, restUntil: 0, hideUntil: 0, stackOn: null, tag: null, web: 0, sigT: 0, accAct: null, faceId: null, faceT: 0, accCd: Infinity, socCd: Infinity, chatCd: Infinity, stackCd: Infinity }); state = 'idle'; petHome = false; held = false; flying = false; petX = 1100; petY = pl.y; cushionNap = 0; boxHide = 0; danceT0 = 0; treat = null; treatFly = null; curX = -9999; curY = -9999; curV = 0; curVX = 0; nextWander = Infinity; nextFidget = Infinity; prev = now - 50; }, palImpactRecallState: () => { const p = pals[0]; return p && { squash: p.squash || 0, squashV: p.squashV || 0, fly: p.fly, vy: p.vy }; }, clearPalImpactRecall: () => { pals.length = 0; curX = -9999; curY = -9999; curV = 0; curVX = 0; } });";
try { (0, eval)(src + homeStateHooks + homeBuffHooks + homePropHooks + homeModeHooks + homeTreatHooks + homeTreatReactionHooks + homePomoHooks + homeActHooks + homeMainSquashRecallHooks + homeCollisionHooks + homeGestureHooks + homeScritchProgressHooks + homeWiggleProgressHooks + homeHopProgressHooks + homeErrandHooks + homeBoopHooks + homeClickProgressHooks + homePokeProgressHooks + homePressureProgressHooks + homeNoticeProgressHooks + homeFlairHooks + homeHuntProgressHooks + homeCircleProgressHooks + homeHuntRecallHooks + homeHuntHooks + homeCuddleHooks + homeSocialHooks + homeAttentionDebtHooks + homeIsolationHooks + homePalRecallHooks + homePalErrandRecallHooks + homePalSignatureRecallHooks + homePalAccessoryRecallHooks + homePalPressureRecallHooks + homePalScritchRecallHooks + homePalHopRecallHooks + homePalWalkRecallHooks + homePalFaceRecallHooks + homePalFallRecallHooks + homePalLookRecallHooks + homePalSquashRecallHooks); } catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }
try {
  (0, eval)("Object.assign(globalThis.__W, { sendMainHome: () => sendPetHome(), bringMainHome: () => bringPetHome(), recallMain: () => recall(), startFlyby: () => startAccAct('flyby', performance.now()) });");
} catch (e) { console.log("HOME HOOK THROW:", e.stack); process.exit(1); }
const G = () => globalThis.__G();
const tauriEv = (name, payload) => {
  for (const fn of tauriListeners[name] || []) fn({ payload });
};

const cvEv = (type, x, y, timeStamp = performance.now()) => {
  const fns = (els.c && els.c.listeners[type]) || [];
  const ev = { button: 0, clientX: x, clientY: y, pointerId: 1, timeStamp, preventDefault() {} };
  fns.forEach((f) => { try { f(ev); } catch (e) { console.log(type.toUpperCase() + " THREW:", e.stack.split("\n").slice(0, 5).join("\n")); fails++; } });
};
const pump = (n) => {
  for (let i = 0; i < n; i++) {
    if (!rafCb) return;
    const cb = rafCb; rafCb = null;
    try { cb(performance.now()); } catch (e) { console.log("FRAME THREW:", e.stack.split("\n").slice(0, 5).join("\n")); process.exit(2); }
  }
};
let fails = 0;
const check = (name, ok) => { console.log(ok ? "PASS" : "FAIL", name); if (!ok) fails++; };

(async () => {
  await new Promise((r) => setImmediate(r));
  pump(5);
  const W = G().winW;
  console.log("winW:", W, "pet at", G().petX, G().petY);

  // place a bowl far from the pet, grab it
  globalThis.__W.placeBowl(200, 400);
  pump(2);
  cvEv("pointerdown", 200, 387); // grab zone: y - 13
  check("propHeld=bowl after grab", G().propHeld === "bowl");
  check("furniture grab shows grabbing cursor", G().cursor === "grabbing");

  // drag to top-center PUT AWAY slot; pump frames so draw path runs too
  cvEv("pointermove", W / 2, 300);
  check("furniture move keeps grabbing cursor", G().cursor === "grabbing");
  pump(3);
  cvEv("pointermove", W / 2, 20);
  pump(3); // strip drawn while propHeld — exercises new draw branch
  cvEv("pointerup", W / 2, 20);
  check("bowl removed after drop in slot", G().bowl === null);
  check("propHeld cleared", G().propHeld === null);
  check("PUT AWAY bang shown", G().bangs.some(b => b.t === "PUT AWAY"));

  // negative: place again, drag to a normal spot — should move, not remove
  globalThis.__W.placeBowl(200, 400);
  pump(2);
  cvEv("pointerdown", 200, 387);
  check("regrab ok", G().propHeld === "bowl");
  cvEv("pointermove", 500, 600);
  pump(2);
  cvEv("pointerup", 500, 600);
  check("bowl survives normal drop", G().bowl !== null);
  if (G().bowl) console.log("  bowl now at", G().bowl.x, G().bowl.y);

  // edge: drop just outside the slot horizontally — should NOT remove
  globalThis.__W.placeBowl(200, 400);
  pump(2);
  cvEv("pointerdown", 200, 387);
  cvEv("pointermove", W / 2 + 200, 20);
  cvEv("pointerup", W / 2 + 200, 20);
  check("drop outside slot keeps prop", G().bowl !== null);

  // OS gesture cancellation is a real cancel, not an unanchored drop.
  // Static furniture has no gravity, so leaving it at the last cursor point
  // would strand it in mid-air until the player drags it again.
  globalThis.__W.placeBowl(320, 700);
  pump(2);
  cvEv("pointerdown", 320, 687);
  cvEv("pointermove", 880, 240);
  check("cancel setup moves held prop", G().bowl && G().bowl.x === 880 && G().bowl.y === 250);
  cvEv("pointercancel", 880, 240);
  check("cancelled prop drag restores anchored origin",
    G().propHeld === null && G().bowl && G().bowl.x === 320 && G().bowl.y === 700);

  // Window platforms can disappear while furniture is held. Cancellation
  // must not restore the furniture onto the now-dead platform object.
  tauriEv("platforms", [[100, 300, 300]]);
  globalThis.__W.placePlant(200, 300);
  check("platform churn setup anchors plant", G().plant && G().plantPlatLive);
  cvEv("pointerdown", 200, 283);
  cvEv("pointermove", 700, 200);
  tauriEv("platforms", []);
  cvEv("pointercancel", 700, 200);
  check("cancel after platform removal reanchors furniture",
    G().propHeld === null && G().plant && G().plantPlatLive && G().plant.y === G().winH);

  // If the vanished platform was beyond every current monitor, platUnder()
  // returns a synthetic screen-floor fallback. The restored prop must store
  // an actual live floor object, not that immediately-stale placeholder.
  tauriEv("platforms", [[2000, 300, 300]]);
  globalThis.__W.placePlant(2100, 300);
  cvEv("pointerdown", 2100, 283);
  cvEv("pointermove", 2200, 200);
  tauriEv("platforms", []);
  cvEv("pointercancel", 2200, 200);
  check("cancel outside current monitors stores a live floor anchor",
    G().propHeld === null && G().plant && G().plantPlatLive
      && G().plant.x === G().winW - 28 && G().plant.y === G().winH);

  // A resized platform must clamp with the actual furniture footprint. The
  // box is 36px wide from its center, not the generic 30px fallback.
  tauriEv("platforms", [[0, 300, 200]]);
  globalThis.__W.placeBox(116, 300);
  tauriEv("platforms", [[0, 300, 100]]);
  check("platform resize keeps wide furniture fully supported",
    G().box && G().box.x === 64 && G().box.y === 300);
  tauriEv("platforms", [[0, 300, 50]]);
  check("too-narrow platform centers furniture symmetrically",
    G().box && G().box.x === 25 && G().box.y === 300);

  // Cancellation uses a separate restore path: shrink the supporting window
  // while the box is held, then ensure the stale origin is centered too.
  tauriEv("platforms", [[0, 300, 100]]);
  globalThis.__W.placeBox(64, 300);
  cvEv("pointerdown", 64, 286);
  cvEv("pointermove", 300, 180);
  tauriEv("platforms", [[0, 300, 50]]);
  cvEv("pointercancel", 300, 180);
  check("cancel onto too-narrow platform centers furniture",
    G().propHeld === null && G().box && G().box.x === 25 && G().box.y === 300);

  // A deliberate drop also has its own deck-selection branch. Exercise the
  // real pointer path rather than relying only on the shared helper directly.
  globalThis.__W.placeBox(25, 300);
  cvEv("pointerdown", 25, 286);
  cvEv("pointermove", 25, 260);
  cvEv("pointerup", 25, 260);
  check("drop onto too-narrow platform centers furniture",
    G().propHeld === null && G().box && G().box.x === 25 && G().box.y === 300);
  globalThis.__W.spawnBoxOn(25, 300);
  check("new furniture centers on a too-narrow platform",
    G().box && G().box.x === 25 && G().box.y === 300 && G().boxPlatLive);

  // The main pet cannot pace on a support narrower than its body, but a treat
  // on that same tiny deck is already within physical reach. It must eat from
  // the center instead of chasing an inverted fixed-margin target forever.
  globalThis.__W.placeMainTreat(25, 300, 49, 300);
  pump(1);
  const narrowTreat = globalThis.__W.mainTreatState();
  check("main pet can eat an edge treat from a too-narrow platform center",
    narrowTreat.treat === false && narrowTreat.petX === 25);
  if (narrowTreat.treat) console.log("  narrow treat state", JSON.stringify(narrowTreat));

  // Equal height alone is not enough: the extended body reach must stay on
  // the pet's own support instead of consuming across a neighboring gap.
  tauriEv("platforms", [[0, 300, 50], [70, 300, 50]]);
  globalThis.__W.placeMainTreat(25, 300, 80, 300);
  pump(1);
  check("main pet cannot remotely eat from another same-height platform",
    globalThis.__W.mainTreatState().treat === true);

  // Main-pet collision allows a small horizontal overlap so a body can catch
  // a ledge. Once the landing settles, its center must still obey the same
  // support bounds as grounded movement and companion landings.
  tauriEv("platforms", [[0, 300, 20]]);
  globalThis.__W.launchMain(35, 298, 0, 0);
  pump(1);
  const landedMain = globalThis.__W.mainState();
  check("main pet landing centers on a too-narrow platform",
    landedMain.flying === false && landedMain.x === 10 && landedMain.y === 300);

  // Overlapping window tops can share a height. Prefer the one that already
  // supports the body instead of snapping to an earlier, narrower candidate.
  tauriEv("platforms", [[0, 300, 20], [-100, 300, 200]]);
  globalThis.__W.launchMain(35, 298, 0, 0);
  pump(1);
  const overlapLanding = globalThis.__W.mainState();
  check("main pet landing prefers the least-shift same-height support",
    overlapLanding.flying === false && overlapLanding.x === 35 && overlapLanding.y === 300);

  // Bites spawns its own file/folder snack. Fixed inner margins must not
  // invert on a tiny support and put that snack beyond the walkable deck.
  tauriEv("platforms", [[0, 300, 50]]);
  globalThis.__W.armChomp(25, 300);
  const realRandom = Math.random;
  Math.random = () => 0.85; // chomp wander branch, rightward snack
  try { pump(1); } finally { Math.random = realRandom; }
  const narrowSnack = globalThis.__W.snackState();
  check("chomp snack stays centered on a too-narrow platform",
    narrowSnack && narrowSnack.x === 25 && narrowSnack.y === 300);
  if (!narrowSnack || narrowSnack.x !== 25) console.log("  narrow snack state", JSON.stringify(narrowSnack));
  globalThis.__W.finishChomp();

  // Roomy supports retain the original body-plus-30px inner margin.
  tauriEv("platforms", [[0, 300, 300]]);
  globalThis.__W.armChomp(150, 300);
  Math.random = () => 0.85;
  try { pump(1); } finally { Math.random = realRandom; }
  const wideSnack = globalThis.__W.snackState();
  check("chomp snack keeps its inner margin on a wide platform",
    wideSnack && wideSnack.x === 300 - wideSnack.edge - 30 && wideSnack.y === 300);

  // The file/folder is a Bites-only chase prop, not independent furniture.
  // Status-card HOME can park the pet without the grab path that clears it,
  // so the lifecycle boundary itself must remove the orphan immediately.
  globalThis.__W.sendMainHome();
  check("send home removes the main pet's chomp snack",
    G().petHome === true && globalThis.__W.snackState() === null);
  globalThis.__W.bringMainHome();
  globalThis.__W.finishChomp();

  // Cliff's approach phase ignores gravity, so it may only start when the
  // supporting surface actually connects to the screen wall it will climb.
  tauriEv("platforms", [[500, 300, 200]]);
  globalThis.__W.armClimb(600, 300);
  Math.random = () => 0.85;
  try { pump(1); } finally { Math.random = realRandom; }
  const detachedClimb = globalThis.__W.climbState();
  check("climb does not start from a detached window platform",
    detachedClimb.phase === 0 && detachedClimb.x === 600);
  globalThis.__W.finishClimb();

  // A support touching the screen wall keeps the intended climb, aligned by
  // the current species body edge rather than a fixed center coordinate.
  tauriEv("platforms", [[0, 300, 300]]);
  globalThis.__W.armClimb(150, 300);
  Math.random = () => 0.85;
  try { pump(1); } finally { Math.random = realRandom; }
  const edgeClimb = globalThis.__W.climbState();
  check("climb starts from a connected screen-edge platform",
    edgeClimb.phase === 1 && edgeClimb.edge === edgeClimb.petEdge);

  // Window geometry can change during the approach. If the same supporting
  // top moves away from the wall, cancel before gravity-free motion starts.
  tauriEv("platforms", [[100, 300, 300]]);
  pump(1);
  const movedClimb = globalThis.__W.climbState();
  check("climb approach cancels when its platform disconnects from the wall",
    movedClimb.phase === 0 && movedClimb.x === 250);
  if (movedClimb.phase !== 0 || movedClimb.x !== 250) console.log("  moved climb state", JSON.stringify(movedClimb));
  globalThis.__W.finishClimb();

  // A full monitor floor connects to both walls; choose the nearer right wall
  // when Cliff starts on that side rather than crossing the whole desktop.
  tauriEv("platforms", [[0, 300, W]]);
  globalThis.__W.armClimb(W - 150, 300);
  Math.random = () => 0.85;
  try { pump(1); } finally { Math.random = realRandom; }
  const rightClimb = globalThis.__W.climbState();
  check("climb chooses the nearer wall on a full-width platform",
    rightClimb.phase === 1 && rightClimb.edge === W - rightClimb.petEdge);

  // Parking the main pet is a lifecycle boundary: neither the hidden ranch
  // state nor the airborne return may retain an unfinished wall approach.
  globalThis.__W.sendMainHome();
  const parkedClimb = globalThis.__W.climbState();
  check("send home clears an unfinished climb approach",
    G().petHome === true && G().flying === false
      && parkedClimb.phase === 0 && parkedClimb.edge === 0);
  globalThis.__W.bringMainHome();
  const returnedClimb = globalThis.__W.climbState();
  check("bring home starts from a clean airborne climb state",
    G().petHome === false && G().flying === true
      && returnedClimb.phase === 0 && returnedClimb.edge === 0);

  // Sending and immediately recalling between animation frames must still
  // end a propeller flyby. Otherwise its stale steering takes over the fresh
  // return velocity and visibly pulls the pet back toward the old target.
  globalThis.__W.startFlyby();
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  const freshReturn = globalThis.__W.mainState();
  globalThis.__W.launchMain(freshReturn.x, freshReturn.y, 0, 120);
  pump(1);
  const afterReturn = globalThis.__W.mainState();
  check("home return does not resume a pre-home flyby",
    afterReturn.flying === true && afterReturn.y > freshReturn.y);

  // The HOME strip is checked before the normal web-release branch. A slow
  // drop there must therefore clear both halves of the dangling grab state;
  // otherwise the first interaction after recall is swallowed as a web tap.
  globalThis.__W.startWeb();
  const webDrop = G();
  const webDropT = performance.now();
  cvEv("pointerdown", webDrop.petX, webDrop.petY - 20, webDropT);
  check("home web drop setup holds pet and silk",
    G().held === true && G().webbing === true && G().webHeld === true);
  cvEv("pointermove", W / 2, 30, webDropT + 5000);
  cvEv("pointerup", W / 2, 30, webDropT + 5001);
  check("home web drop clears the held silk lifecycle",
    G().petHome === true && G().held === false && G().webbing === false
      && G().webHeld === false && G().cursor === "default"
      && G().dragCalls.at(-1) === false);
  // Keep the old-code failure isolated from later pointer scenarios.
  cvEv("pointercancel", W / 2, 30, webDropT + 5002);
  globalThis.__W.bringMainHome();

  // A ranch-cell recall advertises a fresh, cheerful entrance. If the pet
  // was asleep when its status-card HOME button parked it, wake the state
  // synchronously instead of waiting up to a second for the mood interval.
  globalThis.__W.setMainSleeping();
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  check("bring home wakes a previously sleeping pet immediately",
    G().petHome === false && G().flying === true
      && globalThis.__W.mainMood() === "idle");
  globalThis.__W.setMainIdle();

  // The global summon is also an immediate wake, even when the pet is
  // already on the desktop. Its fresh shock must not sit underneath a stale
  // sleeping state until the one-second mood interval happens to run.
  globalThis.__W.setMainSleeping();
  globalThis.__W.recallMain();
  check("system recall wakes a sleeping pet synchronously",
    G().petHome === false && G().flying === true
      && globalThis.__W.mainMood() === "idle"
      && globalThis.__W.mainMoodLabel().startsWith("STARTLED"));
  globalThis.__W.setMainIdle();

  // A summon can arrive from the backend while the pointer still holds the
  // main pet. Dropping only the JS `held` flag strands native dragging on,
  // because the later pointerup sees no hold and returns without cleanup.
  globalThis.__W.armMainCuddle();
  const recallDragPoint = globalThis.__W.cuddlePoint();
  const recallDragT = performance.now();
  cvEv("pointerdown", recallDragPoint.x, recallDragPoint.y, recallDragT);
  check("system recall drag setup enables native dragging",
    G().held === true && G().cursor === "grabbing"
      && G().dragCalls.at(-1) === true);
  globalThis.__W.recallMain();
  const recalledDrag = G();
  check("system recall releases the main pet's native drag lifecycle",
    recalledDrag.held === false && recalledDrag.flying === true
      && recalledDrag.cursor === "default"
      && recalledDrag.dragCalls.at(-1) === false);
  // Keep the intentional pre-fix failure isolated from later pointer tests.
  if (G().dragCalls.at(-1) !== false) {
    const cleanupPoint = globalThis.__W.cuddlePoint();
    cvEv("pointerdown", cleanupPoint.x, cleanupPoint.y, recallDragT + 10);
    cvEv("pointerup", cleanupPoint.x, cleanupPoint.y, recallDragT + 20);
  }
  globalThis.__W.clearCuddleProbe();

  // Backend summon is independent of the active pointer gesture. A held pal
  // must leave both the JS hold and native dragging before recall teleports
  // it, or the companion freezes at the new entrance until the watchdog.
  const palRecallY = G().winH;
  globalThis.__W.placePal(300, palRecallY);
  cvEv("pointerdown", 300, palRecallY - 20);
  check("system recall pal-drag setup enables native dragging",
    G().palHeld !== null && G().cursor === "grabbing"
      && G().dragCalls.at(-1) === true);
  globalThis.__W.recallMain();
  const recalledPalDrag = G();
  check("system recall releases a companion's native drag lifecycle",
    recalledPalDrag.palHeld === null && recalledPalDrag.pal.fly === true
      && recalledPalDrag.pal.vy === 120 && recalledPalDrag.cursor === "default"
      && recalledPalDrag.dragCalls.at(-1) === false);
  // Isolate the deliberate pre-fix failure from the remaining pointer tests.
  if (G().palHeld) cvEv("pointercancel", 300, palRecallY - 20);

  // Companion Webbies update their live silk before ordinary flight physics.
  // A global summon must cut that old anchor, or the first frame after recall
  // cancels the fresh drop and pulls the pal straight back under the cursor.
  globalThis.__W.armPalWebRecall();
  pump(1);
  const preRecallPalWeb = globalThis.__W.palWebRecallState();
  check("pal recall setup uses the live companion web branch",
    preRecallPalWeb.web === true && preRecallPalWeb.fly === false);
  globalThis.__W.recallMain();
  pump(1);
  const recalledPalWeb = globalThis.__W.palWebRecallState();
  check("system recall cuts a companion's previous cursor web",
    recalledPalWeb.web === false && recalledPalWeb.fly === true);
  globalThis.__W.clearPalWebRecall();

  // Box hiding is resolved before companion flight. Keeping its timer during
  // a global summon therefore teleports the pal back into the box and cancels
  // the fresh drop on the very first frame.
  globalThis.__W.armPalBoxRecall();
  pump(1);
  const preRecallPalBox = globalThis.__W.palBoxRecallState();
  check("pal recall setup uses the live companion box-hide branch",
    preRecallPalBox.hidden === true && preRecallPalBox.fly === false
      && preRecallPalBox.x === preRecallPalBox.boxX);
  globalThis.__W.recallMain();
  pump(1);
  const recalledPalBox = globalThis.__W.palBoxRecallState();
  check("system recall pulls a companion out of its previous box hide",
    recalledPalBox.hidden === false && recalledPalBox.fly === true
      && recalledPalBox.x !== recalledPalBox.boxX);
  globalThis.__W.clearPalBoxRecall();

  // A companion nap owns both the rendered sleeping face and the status-card
  // label. Recall's airborne drop must wake that old nap synchronously rather
  // than showing a sleeping, NAPPING pal falling from the top of the screen.
  globalThis.__W.armPalNapRecall();
  pump(1);
  const preRecallPalNap = globalThis.__W.palNapRecallState();
  check("pal recall setup uses the live companion nap presentation",
    preRecallPalNap.napping === true && preRecallPalNap.fly === false
      && preRecallPalNap.face === "sleeping" && preRecallPalNap.status === "NAPPING");
  globalThis.__W.recallMain();
  pump(1);
  const recalledPalNap = globalThis.__W.palNapRecallState();
  check("system recall wakes a napping companion for its airborne drop",
    recalledPalNap.napping === false && recalledPalNap.fly === true
      && recalledPalNap.face !== "sleeping" && recalledPalNap.status === "AIRBORNE");
  globalThis.__W.clearPalNapRecall();

  // A prop errand is a target plus its semantic goal. Recall already drops the
  // target; retaining only the goal lets a later unrelated stroll accidentally
  // spend the interrupted bowl ritual when it reaches its new destination.
  globalThis.__W.armPalBowlErrandRecall();
  Math.random = () => 0.65;
  try { pump(1); } finally { Math.random = realRandom; }
  const preRecallPalErrand = globalThis.__W.palErrandRecallState();
  check("pal recall setup chooses a real companion bowl errand",
    preRecallPalErrand.goal === "bowl" && preRecallPalErrand.target !== null
      && preRecallPalErrand.fly === false);
  globalThis.__W.recallMain();
  const recalledPalErrand = globalThis.__W.palErrandRecallState();
  check("system recall discards a companion's interrupted prop errand",
    recalledPalErrand.goal === null && recalledPalErrand.target === null
      && recalledPalErrand.fly === true);
  globalThis.__W.clearPalErrandRecall();

  // Mini signatures are deliberately allowed to launch their own airborne
  // motion, so flight alone does not cancel them. A system recall is a new
  // entrance and must explicitly end the old show before starting its drop.
  globalThis.__W.armPalSignatureRecall();
  Math.random = () => 0;
  try { pump(1); } finally { Math.random = realRandom; }
  const preRecallPalSignature = globalThis.__W.palSignatureRecallState();
  check("pal recall setup chooses a real companion mini signature",
    preRecallPalSignature.active === true && preRecallPalSignature.id === "umbral"
      && preRecallPalSignature.status === "SHOWING OFF");
  globalThis.__W.recallMain();
  const recalledPalSignature = globalThis.__W.palSignatureRecallState();
  check("system recall ends a companion's interrupted mini signature",
    recalledPalSignature.active === false && recalledPalSignature.id === null
      && recalledPalSignature.did === 0 && recalledPalSignature.fly === true
      && recalledPalSignature.status === "AIRBORNE");
  globalThis.__W.clearPalSignatureRecall();

  // Flight-compatible accessory bits do not cancel themselves during recall.
  // If their step cursor survives, an overdue later beat can fire immediately
  // after landing and launch the pal again as part of the interrupted routine.
  globalThis.__W.armPalAccessoryRecall();
  pump(1);
  const preRecallPalAccessory = globalThis.__W.palAccessoryRecallState();
  check("pal recall setup starts a real multi-step accessory routine",
    preRecallPalAccessory.id === "stache" && preRecallPalAccessory.step === 1
      && preRecallPalAccessory.fly === false);
  globalThis.__W.recallMain();
  globalThis.__W.settlePalAccessoryRecall();
  pump(1);
  const recalledPalAccessory = globalThis.__W.palAccessoryRecallState();
  check("system recall prevents an interrupted companion accessory beat",
    recalledPalAccessory.id === null && recalledPalAccessory.fly === false
      && recalledPalAccessory.vy === 0);
  globalThis.__W.clearPalAccessoryRecall();

  // A timed look belongs to the routine that requested it. Recall already
  // interrupts the monocle routine itself; its old gaze must not keep the
  // airborne pal staring toward a cursor position from before the teleport.
  globalThis.__W.armPalLookRecall();
  pump(1);
  const preRecallPalLook = globalThis.__W.palLookRecallState();
  check("pal recall setup uses a real timed accessory gaze",
    preRecallPalLook.id === "monocle" && preRecallPalLook.step === 1
      && preRecallPalLook.looking === true && preRecallPalLook.face === "lookR"
      && preRecallPalLook.fly === false);
  globalThis.__W.parkPalLookCursor();
  globalThis.__W.recallMain();
  pump(1);
  const recalledPalLook = globalThis.__W.palLookRecallState();
  check("system recall discards a companion's interrupted timed gaze",
    recalledPalLook.id === null && recalledPalLook.looking === false
      && recalledPalLook.face !== "lookL" && recalledPalLook.face !== "lookR"
      && recalledPalLook.fly === true);
  globalThis.__W.clearPalLookRecall();

  // Cursor pressure is intentionally accumulated over multiple grounded
  // frames. A system recall is a new entrance, so an almost-complete press
  // must not survive the airborne drop and shove the pal just after landing.
  globalThis.__W.armPalPressureRecall();
  pump(1);
  const preRecallPalPressure = globalThis.__W.palPressureRecallState();
  check("pal recall setup accumulates real cursor pressure below its threshold",
    preRecallPalPressure.pressure > 0
      && preRecallPalPressure.pressure < preRecallPalPressure.threshold
      && preRecallPalPressure.fly === false);
  globalThis.__W.recallMain();
  globalThis.__W.settlePalPressureRecall();
  pump(2);
  const recalledPalPressure = globalThis.__W.palPressureRecallState();
  check("system recall restarts a companion's partial cursor pressure",
    recalledPalPressure.pressure > 0
      && recalledPalPressure.pressure < 0.2
      && recalledPalPressure.fly === false
      && recalledPalPressure.vy === 0);
  globalThis.__W.clearPalPressureRecall();

  // A partial back-and-forth scritch is another grounded cursor gesture.
  // Recall must not carry two old direction samples into the new landing and
  // turn one fresh sweep into an instant completed affection reaction.
  globalThis.__W.armPalScritchRecall();
  pump(1);
  globalThis.__W.stepPalScritchRecall(-1);
  pump(1);
  const preRecallPalScritch = globalThis.__W.palScritchRecallState();
  check("pal recall setup records two real scritch directions",
    preRecallPalScritch.count === 2 && preRecallPalScritch.dir === -1
      && preRecallPalScritch.cooling === false && preRecallPalScritch.hearts === 0);
  globalThis.__W.recallMain();
  globalThis.__W.settlePalScritchRecall(1);
  pump(1);
  const recalledPalScritch = globalThis.__W.palScritchRecallState();
  check("system recall restarts a companion's scritch reversal sequence",
    recalledPalScritch.count === 1 && recalledPalScritch.dir === 1
      && recalledPalScritch.cooling === false && recalledPalScritch.fly === false
      && recalledPalScritch.hearts === 0);
  globalThis.__W.clearPalScritchRecall();

  // Hop-movement pals use a separate anticipation deadline. If that clock
  // survives recall and expires during the drop, their next unrelated walk
  // launches immediately instead of earning a fresh crouch.
  globalThis.__W.armPalHopRecall();
  pump(1);
  const preRecallPalHop = globalThis.__W.palHopRecallState();
  check("pal recall setup enters the real hop anticipation branch",
    preRecallPalHop.move === "hop" && preRecallPalHop.target !== null
      && preRecallPalHop.wind > performance.now() && preRecallPalHop.fly === false);
  globalThis.__W.recallMain();
  globalThis.__W.settlePalHopRecall();
  pump(1);
  const recalledPalHop = globalThis.__W.palHopRecallState();
  check("system recall gives a companion's next hop fresh anticipation",
    recalledPalHop.target !== null && recalledPalHop.wind > performance.now()
      && recalledPalHop.fly === false && recalledPalHop.vy === 0);
  globalThis.__W.clearPalHopRecall();

  // Ordinary pals ramp into a stroll. Recall is a new physical entrance, so
  // the next walk must not inherit the full speed of an interrupted old one.
  globalThis.__W.armPalWalkRecall();
  pump(1);
  for (let i = 0; i < 3; i++) {
    globalThis.__W.stepPalWalkRecall();
    pump(1);
  }
  const preRecallPalWalk = globalThis.__W.palWalkRecallState();
  check("pal recall setup reaches real companion walking speed",
    preRecallPalWalk.move === "walk" && preRecallPalWalk.speed > 40
      && preRecallPalWalk.target !== null && preRecallPalWalk.fly === false);
  globalThis.__W.recallMain();
  globalThis.__W.settlePalWalkRecall();
  pump(1);
  const recalledPalWalk = globalThis.__W.palWalkRecallState();
  check("system recall restarts a companion's walking acceleration",
    recalledPalWalk.target !== null && recalledPalWalk.speed > 0
      && recalledPalWalk.speed < 25 && recalledPalWalk.x > 420
      && recalledPalWalk.x < 422 && recalledPalWalk.fly === false);
  globalThis.__W.clearPalWalkRecall();

  // A companion's timed expression belongs to the action that created it.
  // Once recall interrupts a real snack arrival, the airborne entrance must
  // not keep rendering the old chewing face for the remainder of its timer.
  globalThis.__W.armPalMunchRecall();
  pump(1);
  const preRecallPalFace = globalThis.__W.palFaceRecallState();
  check("pal recall setup consumes a real treat with a munch face",
    preRecallPalFace.treat === false && preRecallPalFace.id === "munch"
      && (preRecallPalFace.face === "munch" || preRecallPalFace.face === "blink") && preRecallPalFace.active === true);
  globalThis.__W.recallMain();
  pump(1);
  const recalledPalFace = globalThis.__W.palFaceRecallState();
  check("system recall discards a companion's interrupted action face",
    recalledPalFace.id === null && recalledPalFace.active === false
      && recalledPalFace.face !== "munch" && recalledPalFace.mood === "CONTENT"
      && recalledPalFace.status === "AIRBORNE" && recalledPalFace.fly === true);
  globalThis.__W.clearPalFaceRecall();

  // Impact memory belongs to the fall that accumulated it. Recall replaces
  // the companion's velocity with a gentle drop, so it must also start a new
  // peak-speed history instead of landing with the interrupted fall's force.
  globalThis.__W.armPalFallRecall();
  pump(1);
  const preRecallPalFall = globalThis.__W.palFallRecallState();
  check("pal recall setup accumulates real companion fall speed",
    preRecallPalFall.peak > 900 && preRecallPalFall.vy > 900
      && preRecallPalFall.fly === true);
  globalThis.__W.recallMain();
  const recalledPalFall = globalThis.__W.palFallRecallState();
  check("system recall clears a companion's interrupted fall peak",
    recalledPalFall.peak === 0 && recalledPalFall.vy === 120
      && recalledPalFall.fly === true);
  globalThis.__W.clearPalFallRecall();

  // A landing's spring deformation belongs to that impact. Recall teleports
  // the pal into a new fall, so neither its displaced shape nor the old spring
  // velocity should animate at the top of the screen after the transition.
  globalThis.__W.armPalImpactRecall();
  pump(1);
  const preRecallPalImpact = globalThis.__W.palImpactRecallState();
  check("pal recall setup produces real landing deformation",
    preRecallPalImpact.fly === false && preRecallPalImpact.vy === 0
      && preRecallPalImpact.squash > 0.1 && preRecallPalImpact.squashV > 1);
  globalThis.__W.recallMain();
  const recalledPalImpact = globalThis.__W.palImpactRecallState();
  check("system recall clears a companion's interrupted spring deformation",
    recalledPalImpact.squash === 0 && recalledPalImpact.squashV === 0
      && recalledPalImpact.fly === true && recalledPalImpact.vy === 120);
  globalThis.__W.clearPalImpactRecall();

  // A parked pet has no desktop body. Its stale coordinates must not keep
  // accepting proximity wakes and emitting visible reaction text while the
  // ranch cell is supposed to leave the desktop quiet.
  globalThis.__W.setMainSleepingNearCursor();
  globalThis.__W.sendMainHome();
  const parkedBangCount = G().bangs.length;
  pump(1);
  check("parked sleeping pet ignores its hidden desktop hit area",
    G().petHome === true && globalThis.__W.mainMood() === "sleeping"
      && G().bangs.length === parkedBangCount);

  // Body hiding must include its sleep ambience. Both the ordinary sleep
  // bubble/ZZZ path and the separate cushion-nap path used to render at the
  // stale desktop position while the pet was visibly parked in the ranch.
  globalThis.__W.armMainSleepZzz();
  const parkedSleepZzz = globalThis.__W.zzzCount();
  pump(1);
  check("parked sleeping pet emits no desktop ZZZ",
    globalThis.__W.zzzCount() === parkedSleepZzz);
  globalThis.__W.armCushionZzz();
  const parkedCushionZzz = globalThis.__W.zzzCount();
  pump(1);
  check("parked cushion nap emits no desktop ZZZ",
    globalThis.__W.zzzCount() === parkedCushionZzz);
  globalThis.__W.clearCushionZzz();
  globalThis.__W.bringMainHome();
  globalThis.__W.finishClimb();

  // Timed treat buffs may keep counting down at home, but their body-bound
  // icons and chili flames must disappear with the body. Track the exact
  // treat sprite image so unrelated canvas drawing cannot satisfy the check.
  globalThis.__W.armParkedBuff(2);
  globalThis.__W.sendMainHome();
  const parkedChiliFx = globalThis.__W.fxCount();
  Math.random = () => 0;
  try { pump(1); } finally { Math.random = realRandom; }
  check("parked chili buff emits no body-bound visuals",
    globalThis.__W.fxCount() === parkedChiliFx
      && global.__PROP_TEST_DRAW_COUNT === 0);
  globalThis.__W.armParkedBuff(3);
  pump(1);
  check("parked coffee buff emits no body-bound icon",
    global.__PROP_TEST_DRAW_COUNT === 0);
  globalThis.__W.clearParkedBuff();
  globalThis.__W.bringMainHome();

  // Status-card HOME can park a pet without grabbing it first, so cushion
  // and box rest states are still live. Recall must end both immediately;
  // otherwise it returns asleep or the next frame snaps it back into a box.
  globalThis.__W.armParkedPropState("cushion");
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  const recalledCushion = globalThis.__W.parkedPropState();
  check("bring home clears a retained cushion nap",
    recalledCushion.cushionNap === 0 && recalledCushion.cushionNapW === 0
      && recalledCushion.sitUntil === 0 && G().flying === true);
  globalThis.__W.clearParkedPropState();

  globalThis.__W.armParkedPropState("box");
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const recalledBox = globalThis.__W.parkedPropState();
  check("bring home cannot be pulled back into a retained box hide",
    recalledBox.boxHide === 0 && G().petHome === false && G().flying === true);
  globalThis.__W.clearParkedPropState();
  globalThis.__W.bringMainHome();

  // The global summon can interrupt these same occupied furniture states
  // without first parking the pet. It must evict the old cushion/box claim
  // before launching the fresh airborne entrance too.
  globalThis.__W.armParkedPropState("cushion");
  globalThis.__W.recallMain();
  const summonedCushion = globalThis.__W.parkedPropState();
  check("system recall clears a retained cushion nap",
    summonedCushion.cushionNap === 0 && summonedCushion.cushionNapW === 0
      && summonedCushion.sitUntil === 0 && G().flying === true);
  globalThis.__W.clearParkedPropState();

  globalThis.__W.armParkedPropState("box");
  globalThis.__W.recallMain();
  pump(1);
  const summonedBox = globalThis.__W.parkedPropState();
  check("system recall cannot be pulled back into a retained box hide",
    summonedBox.boxHide === 0 && G().petHome === false && G().flying === true);
  globalThis.__W.clearParkedPropState();

  // Snack aiming is a modal desktop interaction owned by the main pet. A
  // status-card HOME action must close it immediately; otherwise the hidden
  // pet leaves a crosshair behind and the home deep-idle throttle stays off.
  globalThis.__W.armTreatAim();
  globalThis.__W.sendMainHome();
  pump(1);
  check("send home closes the main pet's treat aiming mode",
    G().petHome === true && globalThis.__W.treatAimState() === false
      && global.__PROP_TEST_DRAW_COUNT === 0);
  globalThis.__W.clearTreatAimProbe();
  globalThis.__W.bringMainHome();

  // A cookie that has already left the pet is still part of its active treat
  // interaction, not a durable world prop. HOME must cancel its flight too;
  // otherwise the hidden pet leaves a visible projectile and live physics on
  // the desktop after the aiming crosshair itself has correctly disappeared.
  globalThis.__W.armTreatFlight();
  cvEv("pointerdown", 900, 300);
  pump(1);
  const liveTreatFlight = globalThis.__W.treatFlightState();
  check("home treat-flight setup uses the real aimed throw path",
    liveTreatFlight.aim === false && liveTreatFlight.flight === true
      && liveTreatFlight.landed === false && liveTreatFlight.draws > 0);
  globalThis.__W.resetTreatDraws();
  globalThis.__W.sendMainHome();
  pump(1);
  const parkedTreatFlight = globalThis.__W.treatFlightState();
  check("send home removes an in-flight main-pet treat",
    G().petHome === true && parkedTreatFlight.flight === false
      && parkedTreatFlight.landed === false && parkedTreatFlight.draws === 0);
  globalThis.__W.clearTreatFlightProbe();
  globalThis.__W.bringMainHome();

  // Pomodoro timing and focus statistics continue at home, but the periodic
  // cheer is attached to the main pet's body. It must not leave hearts or GO!
  // text at stale desktop coordinates while that body is parked in the ranch.
  globalThis.__W.armPomoCheer();
  globalThis.__W.sendMainHome();
  const parkedPomoBefore = globalThis.__W.pomoCheerState();
  Math.random = () => 0;
  try { pump(1); } finally { Math.random = realRandom; }
  const parkedPomoAfter = globalThis.__W.pomoCheerState();
  check("parked pomodoro focus emits no body-bound cheer",
    G().petHome === true && parkedPomoAfter.focus === true
      && parkedPomoAfter.hearts === parkedPomoBefore.hearts
      && parkedPomoAfter.go === parkedPomoBefore.go);
  globalThis.__W.clearPomoCheer();
  globalThis.__W.bringMainHome();

  // Tucking in an idle cursor is a main-pet errand, not a persistent world
  // object. If HOME merely pauses its approach, a later recall can land by
  // that same cursor and finish the obsolete job with a surprise blanket.
  globalThis.__W.armBlanketApproach();
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  globalThis.__W.settleMainAtCursor();
  // Keep this frame about the interrupted blanket. Without a cooldown the
  // normal rare-start roll can create a brand-new tuck-in and make the stale
  // lifecycle assertion probabilistically fail for the wrong reason.
  globalThis.__W.suppressFreshBlanket();
  const recalledBlanketBefore = globalThis.__W.blanketState();
  pump(1);
  const recalledBlanketAfter = globalThis.__W.blanketState();
  check("home return does not resume a pre-home blanket approach",
    recalledBlanketAfter.active === false && recalledBlanketAfter.visible === false
      && recalledBlanketAfter.tucked === recalledBlanketBefore.tucked);
  globalThis.__W.clearBlanketProbe();

  // The global summon is the same fresh-entrance boundary. Because recall
  // drops the pet at the cursor's x-coordinate, retaining the old approach
  // would complete it immediately on the next production frame.
  globalThis.__W.armBlanketApproach();
  globalThis.__W.recallMain();
  globalThis.__W.suppressFreshBlanket();
  const summonedBlanketBefore = globalThis.__W.blanketState();
  pump(1);
  const summonedBlanketAfter = globalThis.__W.blanketState();
  check("system recall does not complete a pre-recall blanket approach",
    summonedBlanketAfter.active === false && summonedBlanketAfter.visible === false
      && summonedBlanketAfter.tucked === summonedBlanketBefore.tucked);
  globalThis.__W.clearBlanketProbe();

  // A recall is a fresh airborne entrance, so a short twirl started before
  // HOME must not resume on top of the drop-in animation after an immediate
  // ranch-cell summon.
  globalThis.__W.armSpin();
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  check("home return does not resume a pre-home body spin",
    G().petHome === false && G().flying === true
      && globalThis.__W.spinState() === 0);
  globalThis.__W.clearSpin();

  // Eating owns a short chewing timer and a star-eyed reward after the treat
  // disappears. A fresh entrance must end both body reactions; it should not
  // keep celebrating an item that the lifecycle already removed.
  tauriEv("platforms", []);
  globalThis.__W.armTreatMilestone();
  globalThis.__W.placeMainTreat(500, G().winH, 500, G().winH);
  pump(1);
  const preHomeMunch = globalThis.__W.treatReactionState();
  check("home munch setup consumes a real treat",
    globalThis.__W.mainTreatState().treat === false
      && preHomeMunch.munch === true && preHomeMunch.star === true
      && preHomeMunch.face === "star"
      && preHomeMunch.mood.startsWith("EATING"));
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedMunch = globalThis.__W.treatReactionState();
  check("home return does not resume a pre-home chewing face",
    G().petHome === false && G().flying === true
      && returnedMunch.munch === false && !returnedMunch.mood.startsWith("EATING"));
  check("home return does not resume pre-home treat stars",
    returnedMunch.star === false && returnedMunch.face !== "star"
      && G().flying === true);

  globalThis.__W.armTreatMilestone();
  globalThis.__W.placeMainTreat(500, G().winH, 500, G().winH);
  pump(1);
  const preRecallMunch = globalThis.__W.treatReactionState();
  check("recall treat-star setup consumes a real treat",
    globalThis.__W.mainTreatState().treat === false
      && preRecallMunch.munch === true && preRecallMunch.star === true
      && preRecallMunch.face === "star" && preRecallMunch.mood.startsWith("EATING"));
  globalThis.__W.recallMain();
  pump(1);
  const recalledMunch = globalThis.__W.treatReactionState();
  check("system recall discards pre-recall chewing",
    recalledMunch.munch === false && recalledMunch.mood.startsWith("STARTLED")
      && G().flying === true);
  check("system recall discards pre-recall treat stars",
    recalledMunch.star === false && recalledMunch.face === "shock");

  // Ranch-cell recall supplies its own cheerful HI entrance. A prior copy
  // reaction must not outrank that fresh presentation with a stale startled
  // face; system recall remains free to add its deliberate short shock later.
  globalThis.__W.startleMain();
  check("home startle setup uses the production copy reaction",
    globalThis.__W.mainMoodLabel().startsWith("STARTLED"));
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  check("ranch return does not resume a pre-home startled face",
    G().petHome === false && G().flying === true
      && !globalThis.__W.mainMoodLabel().startsWith("STARTLED"));

  // A vanished window marks its fall as an accident and remembers the peak
  // impact speed. HOME is a lifecycle boundary: neither marker may turn the
  // ranch cell's fresh drop-in into a dazed, heavy continuation of that fall.
  tauriEv("platforms", [[400, 300, 300]]);
  globalThis.__W.launchMain(500, 298, 0, 0);
  pump(1);
  tauriEv("platforms", []);
  globalThis.__W.launchMain(500, 300, 0, 650);
  pump(1);
  const preHomeFall = globalThis.__W.fallState();
  check("home fall setup uses a vanished platform and live impact physics",
    preHomeFall.startle === true && preHomeFall.peak > 520);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  const freshHomeFall = globalThis.__W.fallState();
  globalThis.__W.launchMain(500, G().winH - 2, 0, 0);
  pump(1);
  const landedHomeFall = globalThis.__W.fallState();
  const ranchFallClean =
    freshHomeFall.startle === false && freshHomeFall.peak === 0
      && landedHomeFall.dizzy === false
      && landedHomeFall.ripples === freshHomeFall.ripples + 1;
  if (!ranchFallClean) console.log("  ranch fall states", JSON.stringify({ freshHomeFall, landedHomeFall }));
  check("ranch return clears pre-home fall accident metadata", ranchFallClean);
  globalThis.__W.clearFallProbe();

  // The global summon path is another fresh airborne entrance. Its explicit
  // startle reset must also discard the old impact peak, or the teleported pet
  // can still land with the force of the fall that recall interrupted.
  globalThis.__W.launchMain(500, 300, 0, 650);
  pump(1);
  const preRecallFall = globalThis.__W.fallState();
  globalThis.__W.recallMain();
  const recalledFall = globalThis.__W.fallState();
  check("system recall clears an interrupted fall's impact peak",
    preRecallFall.peak > 520 && recalledFall.startle === false
      && recalledFall.peak === 0 && G().flying === true);
  globalThis.__W.clearFallProbe();

  // The body spring is also physical history from the previous scene. A hard
  // landing immediately followed by system recall must not replay that old
  // flatten-and-rebound motion at the fresh top-of-screen entrance.
  globalThis.__W.armMainImpactRecall();
  pump(1);
  globalThis.__W.stepMainImpactRecall();
  pump(1);
  globalThis.__W.stepMainImpactRecall();
  pump(1);
  const preRecallMainImpact = globalThis.__W.mainImpactRecallState();
  check("main recall setup produces real landing deformation",
    preRecallMainImpact.flying === false && preRecallMainImpact.vy === 0
      && preRecallMainImpact.squash > 0.1 && preRecallMainImpact.squashV > 1);
  globalThis.__W.recallMain();
  const recalledMainImpact = globalThis.__W.mainImpactRecallState();
  check("system recall clears the main pet's interrupted spring deformation",
    recalledMainImpact.squash === 0 && recalledMainImpact.squashV === 0
      && recalledMainImpact.flying === true && recalledMainImpact.vy === 90);
  globalThis.__W.clearMainImpactRecall();

  // A hard wall impact owns a live DIZZY face even after the collision itself
  // has ended. HOME and summon are fresh airborne entrances: the ranch return
  // should show its greeting, while system recall should show its deliberate
  // short startle rather than inheriting the previous crash's dizziness.
  globalThis.__W.launchMain(0, 300, -700, 0);
  pump(1);
  const preHomeCollision = globalThis.__W.collisionState();
  check("home dizzy setup uses live high-speed wall collision physics",
    preHomeCollision.splat === true && preHomeCollision.dizzy === true
      && preHomeCollision.face === "dizzy" && preHomeCollision.mood.startsWith("DIZZY"));
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedCollision = globalThis.__W.collisionState();
  check("ranch return does not resume pre-home collision dizziness",
    returnedCollision.splat === false && returnedCollision.dizzy === false
      && returnedCollision.face !== "dizzy" && !returnedCollision.mood.startsWith("DIZZY")
      && G().flying === true);

  globalThis.__W.clearCollisionProbe();
  globalThis.__W.launchMain(0, 300, -700, 0);
  pump(1);
  globalThis.__W.recallMain();
  pump(1);
  const recalledCollision = globalThis.__W.collisionState();
  check("system recall replaces old dizziness with its fresh startle",
    recalledCollision.splat === false && recalledCollision.dizzy === false
      && recalledCollision.face === "shock" && recalledCollision.mood.startsWith("STARTLED")
      && G().flying === true);
  globalThis.__W.clearCollisionProbe();

  // A >800px/s landing remains annoyed longer than it remains dizzy. That
  // physical grievance must not leak through a fresh entrance after the
  // shorter collision face has been reset. The status card gives annoyance
  // higher priority than both the ranch greeting and recall's new shock.
  tauriEv("platforms", []);
  globalThis.__W.launchMain(500, G().winH - 20, 0, 900);
  pump(1);
  const preHomeSlam = globalThis.__W.collisionState();
  check("home annoyance setup uses live hard-landing physics",
    preHomeSlam.dizzy === true && preHomeSlam.annoyed === true
      && preHomeSlam.face === "dizzy" && preHomeSlam.mood.startsWith("ANNOYED"));
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedSlam = globalThis.__W.collisionState();
  check("ranch return does not retain hard-landing annoyance",
    returnedSlam.dizzy === false && returnedSlam.annoyed === false
      && returnedSlam.face !== "grumpy" && !returnedSlam.mood.startsWith("ANNOYED"));

  globalThis.__W.clearCollisionProbe();
  globalThis.__W.launchMain(500, G().winH - 20, 0, 900);
  pump(1);
  globalThis.__W.recallMain();
  pump(1);
  const recalledSlam = globalThis.__W.collisionState();
  check("system recall discards hard-landing annoyance before fresh startle",
    recalledSlam.dizzy === false && recalledSlam.annoyed === false
      && recalledSlam.face === "shock" && recalledSlam.mood.startsWith("STARTLED"));
  globalThis.__W.clearCollisionProbe();

  // Clearing a stale physical reaction must not erase the separate designed
  // grumpy greeting produced by touch() after a genuinely long absence.
  globalThis.__W.armLongIgnoredRecall();
  globalThis.__W.recallMain();
  pump(1);
  const ignoredRecall = globalThis.__W.collisionState();
  check("system recall preserves a newly earned long-absence grievance",
    ignoredRecall.annoyed === true && ignoredRecall.mood === "ANNOYED · IGNORED");
  globalThis.__W.clearCollisionProbe();

  // Losing a real window platform produces a startled fall whose landing is
  // both dizzy and pouty. The pout lasts longer; clearing only impact metadata
  // and dizziness lets a fresh ranch entrance immediately render the old sad
  // face, or lets it reappear after recall's short shock expires.
  tauriEv("platforms", [[400, 300, 300]]);
  globalThis.__W.launchMain(500, 298, 0, 0);
  pump(1);
  tauriEv("platforms", []);
  globalThis.__W.launchMain(500, G().winH - 2, 0, 0);
  pump(1);
  const preHomePout = globalThis.__W.collisionState();
  check("home pout setup lands a real vanished-platform fall",
    preHomePout.dizzy === true && preHomePout.pout === true
      && preHomePout.face === "dizzy");
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedPout = globalThis.__W.collisionState();
  check("ranch return does not resume a vanished-platform pout",
    returnedPout.dizzy === false && returnedPout.pout === false
      && returnedPout.face !== "pout" && G().flying === true);

  globalThis.__W.clearCollisionProbe();
  tauriEv("platforms", [[400, 300, 300]]);
  globalThis.__W.launchMain(500, 298, 0, 0);
  pump(1);
  tauriEv("platforms", []);
  globalThis.__W.launchMain(500, G().winH - 2, 0, 0);
  pump(1);
  globalThis.__W.recallMain();
  pump(1);
  const recalledPout = globalThis.__W.collisionState();
  check("system recall discards a vanished-platform pout",
    recalledPout.dizzy === false && recalledPout.pout === false
      && recalledPout.face === "shock" && G().flying === true);
  globalThis.__W.clearCollisionProbe();
  tauriEv("platforms", []);

  // Saying goodbye to a nearby companion deliberately makes the main pet cry.
  // If the main pet immediately goes HOME too, that farewell belongs to the
  // interrupted desktop scene and must not replace the new ranch-cell HI face
  // or return after system recall's short shock.
  globalThis.__W.launchMain(500, G().winH - 2, 0, 0);
  pump(1);
  globalThis.__W.placePal(520, G().winH);
  globalThis.__W.sendFirstPalHome();
  const preHomeFarewell = globalThis.__W.collisionState();
  check("home farewell setup uses production companion send-home",
    preHomeFarewell.cry === true && preHomeFarewell.face === "cry"
      && !G().pal);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedFarewell = globalThis.__W.collisionState();
  check("ranch return does not resume a companion farewell cry",
    returnedFarewell.cry === false && returnedFarewell.face !== "cry"
      && G().flying === true);

  globalThis.__W.clearCollisionProbe();
  globalThis.__W.launchMain(500, G().winH - 2, 0, 0);
  pump(1);
  globalThis.__W.placePal(520, G().winH);
  globalThis.__W.sendFirstPalHome();
  globalThis.__W.recallMain();
  pump(1);
  const recalledFarewell = globalThis.__W.collisionState();
  check("system recall discards a companion farewell cry",
    recalledFarewell.cry === false && recalledFarewell.face === "shock"
      && G().flying === true);
  globalThis.__W.clearCollisionProbe();

  // Fast cursor reversals over the visible body use the production wiggle
  // detector to start a laugh. HOME/recall must end that active gesture face;
  // keeping only its cooldown is fine, but the old laugh cannot own a fresh
  // airborne entrance or reappear after recall's short shock.
  globalThis.__W.armMainTickle();
  for (const x of [490, 510, 490, 510, 490, 510]) {
    cvEv("pointermove", x, G().winH - 20);
  }
  const preHomeTickle = globalThis.__W.gestureState();
  check("home tickle setup uses real pointer wiggle detection",
    preHomeTickle.tickle === true && preHomeTickle.face === "laugh");
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedTickle = globalThis.__W.gestureState();
  check("ranch return does not resume a pre-home tickle laugh",
    returnedTickle.tickle === false && returnedTickle.face !== "laugh"
      && G().flying === true);

  globalThis.__W.clearGestureProbe();
  globalThis.__W.armMainTickle();
  for (const x of [490, 510, 490, 510, 490, 510]) {
    cvEv("pointermove", x, G().winH - 20);
  }
  globalThis.__W.recallMain();
  pump(1);
  const recalledTickle = globalThis.__W.gestureState();
  check("system recall discards a pre-recall tickle laugh",
    recalledTickle.tickle === false && recalledTickle.face === "shock"
      && G().flying === true);
  globalThis.__W.clearGestureProbe();

  // Two reversals are an unfinished wiggle, not durable interaction history.
  // One move after a fresh entrance must seed a new buffer instead of adding
  // the third reversal that completes the pre-HOME tickle.
  globalThis.__W.armMainTickle();
  for (const x of [490, 510, 490, 510]) {
    cvEv("pointermove", x, G().winH - 20);
  }
  const preHomeWiggle = globalThis.__W.wiggleProgressState();
  check("partial home tickle setup keeps two real pointer reversals",
    preHomeWiggle.length === 4 && preHomeWiggle.tickle === false);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  globalThis.__W.settleMainForScritch();
  cvEv("pointermove", 490, G().winH - 20);
  const returnedWiggle = globalThis.__W.wiggleProgressState();
  check("ranch return starts a fresh tickle wiggle buffer",
    returnedWiggle.length === 1 && returnedWiggle.tickle === false
      && returnedWiggle.face !== "laugh");

  globalThis.__W.clearWiggleProgress();
  globalThis.__W.armMainTickle();
  for (const x of [490, 510, 490, 510]) {
    cvEv("pointermove", x, G().winH - 20);
  }
  globalThis.__W.recallMain();
  globalThis.__W.settleMainForScritch();
  cvEv("pointermove", 490, G().winH - 20);
  const recalledWiggle = globalThis.__W.wiggleProgressState();
  check("system recall starts a fresh tickle wiggle buffer",
    recalledWiggle.length === 1 && recalledWiggle.tickle === false);
  globalThis.__W.clearWiggleProgress();

  // Hop anticipation is an in-progress movement phase, not reusable motion
  // history. If its deadline survives HOME/recall, the next unrelated hop
  // sees an expired wind-up and launches immediately without its new crouch.
  globalThis.__W.armMainHopWind();
  pump(1);
  const preHomeHopWind = globalThis.__W.hopProgressState();
  check("partial home hop setup uses the real anticipation branch",
    preHomeHopWind.target === 700 && preHomeHopWind.wind !== 0
      && preHomeHopWind.flying === false);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  globalThis.__W.ageRetainedHopWind();
  globalThis.__W.settleMainForFreshHop();
  pump(1);
  const returnedHopWind = globalThis.__W.hopProgressState();
  check("ranch return gives the next hop a fresh anticipation crouch",
    returnedHopWind.target === 700 && returnedHopWind.wind > performance.now()
      && returnedHopWind.flying === false && returnedHopWind.vy === 0);

  globalThis.__W.clearHopProgress();
  globalThis.__W.armMainHopWind();
  pump(1);
  globalThis.__W.recallMain();
  globalThis.__W.ageRetainedHopWind();
  globalThis.__W.settleMainForFreshHop();
  pump(1);
  const recalledHopWind = globalThis.__W.hopProgressState();
  check("system recall gives the next hop a fresh anticipation crouch",
    recalledHopWind.target === 700 && recalledHopWind.wind > performance.now()
      && recalledHopWind.flying === false && recalledHopWind.vy === 0);
  globalThis.__W.clearHopProgress();

  // A furniture errand consists of both its walk target and its arrival
  // ritual. If only the coordinate is cancelled, a later unrelated stroll
  // ending at the old spot can spend that stale ritual and consume food.
  globalThis.__W.armMainBowlErrand();
  const preHomeErrand = globalThis.__W.errandState();
  check("home errand setup carries a pending bowl ritual",
    preHomeErrand.target === 582 && preHomeErrand.goal === "bowl"
      && preHomeErrand.fill === 3 && preHomeErrand.munch === false);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  globalThis.__W.settleUnrelatedWalkAtOldGoal();
  pump(1);
  const returnedErrand = globalThis.__W.errandState();
  check("ranch return cannot spend an interrupted bowl errand on a new stroll",
    returnedErrand.target === null && returnedErrand.goal === null
      && returnedErrand.fill === 3 && returnedErrand.munch === false);

  globalThis.__W.clearErrandProbe();
  globalThis.__W.armMainBowlErrand();
  globalThis.__W.recallMain();
  globalThis.__W.settleUnrelatedWalkAtOldGoal();
  pump(1);
  const recalledErrand = globalThis.__W.errandState();
  check("system recall cannot spend an interrupted bowl errand on a new stroll",
    recalledErrand.target === null && recalledErrand.goal === null
      && recalledErrand.fill === 3 && recalledErrand.munch === false);
  globalThis.__W.clearErrandProbe();

  // Cursor scritches use the production frame detector: three alternating
  // sweep directions create the short PAMPERED state. A ranch round-trip or
  // system recall is a fresh entrance, so that old status must not survive
  // (the scritch cooldown itself may remain to prevent immediate retriggers).
  globalThis.__W.armMainScritch();
  for (const dir of [1, -1, 1]) {
    globalThis.__W.stepMainScritch(dir);
    pump(1);
  }
  const preHomeScritch = globalThis.__W.gestureState();
  check("home scritch setup uses the real cursor sweep branch",
    preHomeScritch.pet === true && preHomeScritch.mood.startsWith("PAMPERED"));
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedScritch = globalThis.__W.gestureState();
  check("ranch return does not resume a pre-home pampered status",
    returnedScritch.pet === false && !returnedScritch.mood.startsWith("PAMPERED")
      && G().flying === true);

  globalThis.__W.clearGestureProbe();
  globalThis.__W.armMainScritch();
  for (const dir of [1, -1, 1]) {
    globalThis.__W.stepMainScritch(dir);
    pump(1);
  }
  globalThis.__W.recallMain();
  pump(1);
  const recalledScritch = globalThis.__W.gestureState();
  check("system recall discards a pre-recall pampered status",
    recalledScritch.pet === false && recalledScritch.mood.startsWith("STARTLED")
      && G().flying === true);
  globalThis.__W.clearGestureProbe();

  // An unfinished two-sweep scritch is input history, not a persistent pet
  // state. After a fresh entrance, one opposite sweep must begin a new gesture
  // instead of completing the pre-HOME reversal sequence.
  globalThis.__W.armMainScritch();
  for (const dir of [1, -1]) {
    globalThis.__W.stepMainScritch(dir);
    pump(1);
  }
  const preHomeScritchProgress = globalThis.__W.scritchProgressState();
  check("partial home scritch setup records two real sweep directions",
    preHomeScritchProgress.count === 2 && preHomeScritchProgress.dir === -1
      && preHomeScritchProgress.pet === false);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  globalThis.__W.settleMainForScritch();
  globalThis.__W.stepMainScritch(1);
  pump(1);
  const returnedScritchProgress = globalThis.__W.scritchProgressState();
  check("ranch return starts a fresh scritch reversal sequence",
    returnedScritchProgress.count === 1 && returnedScritchProgress.dir === 1
      && returnedScritchProgress.pet === false);

  globalThis.__W.clearScritchProgress();
  globalThis.__W.armMainScritch();
  for (const dir of [1, -1]) {
    globalThis.__W.stepMainScritch(dir);
    pump(1);
  }
  globalThis.__W.recallMain();
  globalThis.__W.settleMainForScritch();
  globalThis.__W.stepMainScritch(1);
  pump(1);
  const recalledScritchProgress = globalThis.__W.scritchProgressState();
  check("system recall starts a fresh scritch reversal sequence",
    recalledScritchProgress.count === 1 && recalledScritchProgress.dir === 1
      && recalledScritchProgress.pet === false);
  globalThis.__W.clearScritchProgress();

  // A precise tap on the production snoot hit-zone generates BOOP and, with
  // the deterministic reaction roll, a short wink plus content response.
  // Fresh entrances must not inherit either timer from the interaction they
  // ended; checking only the currently dominant face hid stale content.
  globalThis.__W.armMainBoop();
  let boopAt = globalThis.__W.boopPoint();
  cvEv("pointerdown", boopAt.x, boopAt.y, 1000);
  Math.random = () => 0;
  try { cvEv("pointerup", boopAt.x, boopAt.y, 1100); }
  finally { Math.random = realRandom; }
  const preHomeBoop = globalThis.__W.boopState();
  check("home boop setup uses the real snoot tap branch",
    preHomeBoop.boops > 0 && preHomeBoop.wink === true
      && preHomeBoop.content === true && preHomeBoop.face === "wink");
  globalThis.__W.sendMainHome();
  const parkedBoop = globalThis.__W.boopState();
  check("send home ends the desktop boop reaction",
    parkedBoop.wink === false && parkedBoop.content === false);
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedBoop = globalThis.__W.boopState();
  check("ranch return uses only its fresh greeting reaction",
    returnedBoop.wink === false && returnedBoop.embar === false && returnedBoop.content === true
      && returnedBoop.face === "happy"
      && G().flying === true);

  globalThis.__W.clearBoopProbe();
  globalThis.__W.armMainBoop();
  boopAt = globalThis.__W.boopPoint();
  cvEv("pointerdown", boopAt.x, boopAt.y, 2000);
  Math.random = () => 0;
  try { cvEv("pointerup", boopAt.x, boopAt.y, 2100); }
  finally { Math.random = realRandom; }
  globalThis.__W.recallMain();
  pump(1);
  const recalledBoop = globalThis.__W.boopState();
  check("system recall discards pre-recall boop reaction timers",
    recalledBoop.wink === false && recalledBoop.content === false
      && recalledBoop.face === "shock"
      && G().flying === true);
  globalThis.__W.clearBoopProbe();

  // Slow cursor pressure is partial input history. Twenty-three production
  // frames stop just below the shove threshold; returning must not let two
  // new frames finish the interrupted press and create a phantom pout-hop.
  globalThis.__W.armMainPressureProgress();
  for (let i = 0; i < 23; i++) {
    globalThis.__W.stepMainPressureProgress();
    pump(1);
  }
  const preHomePressure = globalThis.__W.pressureProgressState();
  check("partial home pressure setup reaches the real pre-shove threshold",
    preHomePressure.pressure > 1.1 && preHomePressure.pressure < 1.2
      && preHomePressure.flying === false && preHomePressure.pout === false
      && preHomePressure.shove === 0);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  for (let i = 0; i < 2; i++) {
    globalThis.__W.stepMainPressureProgress();
    pump(1);
  }
  const returnedPressure = globalThis.__W.pressureProgressState();
  check("ranch return starts fresh cursor-pressure accumulation",
    returnedPressure.pressure > 0.09 && returnedPressure.pressure < 0.11
      && returnedPressure.pout === false && returnedPressure.shove === 0);

  globalThis.__W.clearPressureProgress();
  globalThis.__W.armMainPressureProgress();
  for (let i = 0; i < 23; i++) {
    globalThis.__W.stepMainPressureProgress();
    pump(1);
  }
  globalThis.__W.recallMain();
  for (let i = 0; i < 2; i++) {
    globalThis.__W.stepMainPressureProgress();
    pump(1);
  }
  const recalledPressure = globalThis.__W.pressureProgressState();
  check("system recall starts fresh cursor-pressure accumulation",
    recalledPressure.pressure > 0.09 && recalledPressure.pressure < 0.11
      && recalledPressure.pout === false && recalledPressure.shove === 0);
  globalThis.__W.clearPressureProgress();

  // Cursor notice time is also partial input history. Twenty-one production
  // frames stop just below the reaction threshold; two fresh hover frames
  // after an entrance must not complete the interrupted old stare.
  globalThis.__W.armMainNoticeProgress();
  for (let i = 0; i < 21; i++) {
    globalThis.__W.stepMainNoticeProgress();
    pump(1);
  }
  const preHomeNotice = globalThis.__W.noticeProgressState();
  check("partial home notice setup reaches the real pre-reaction threshold",
    preHomeNotice.progress > 1.0 && preHomeNotice.progress < 1.1
      && preHomeNotice.triggered === false && preHomeNotice.flying === false);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  for (let i = 0; i < 2; i++) {
    globalThis.__W.stepMainNoticeProgress();
    pump(1);
  }
  const returnedNotice = globalThis.__W.noticeProgressState();
  check("ranch return starts fresh cursor-notice accumulation",
    returnedNotice.progress > 0.09 && returnedNotice.progress < 0.11
      && returnedNotice.triggered === false);

  globalThis.__W.clearNoticeProgress();
  globalThis.__W.armMainNoticeProgress();
  for (let i = 0; i < 21; i++) {
    globalThis.__W.stepMainNoticeProgress();
    pump(1);
  }
  globalThis.__W.recallMain();
  for (let i = 0; i < 2; i++) {
    globalThis.__W.stepMainNoticeProgress();
    pump(1);
  }
  const recalledNotice = globalThis.__W.noticeProgressState();
  check("system recall starts fresh cursor-notice accumulation",
    recalledNotice.progress > 0.09 && recalledNotice.progress < 0.11
      && recalledNotice.triggered === false);
  globalThis.__W.clearNoticeProgress();

  // Belly-poke streaks are a short input combo, not a relationship state.
  // Two real pokes may sulk, but a fresh entrance's first poke must not spend
  // that interrupted pair as the third hit and manufacture a HEY! protest.
  const pokeMain = (stamp) => {
    globalThis.__W.settleMainForPoke();
    const pt = globalThis.__W.mainPokePoint();
    cvEv("pointerdown", pt.x, pt.y, stamp);
    cvEv("pointerup", pt.x, pt.y, stamp + 100);
  };
  globalThis.__W.armMainPokeProgress();
  pokeMain(7000);
  pokeMain(7500);
  const preHomePoke = globalThis.__W.pokeProgressState();
  check("partial home poke setup records two real belly pokes",
    preHomePoke.streak === 2 && preHomePoke.annoyed === false
      && preHomePoke.hey === 0);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pokeMain(8000);
  const returnedPoke = globalThis.__W.pokeProgressState();
  check("ranch return starts a fresh belly-poke combo",
    returnedPoke.streak === 1 && returnedPoke.pout === true
      && returnedPoke.annoyed === false && returnedPoke.hey === 0);

  globalThis.__W.clearPokeProgress();
  globalThis.__W.armMainPokeProgress();
  pokeMain(9000);
  pokeMain(9500);
  globalThis.__W.recallMain();
  pokeMain(10000);
  const recalledPoke = globalThis.__W.pokeProgressState();
  check("system recall starts a fresh belly-poke combo",
    recalledPoke.streak === 1 && recalledPoke.pout === true
      && recalledPoke.annoyed === false && recalledPoke.hey === 0);
  globalThis.__W.clearPokeProgress();

  // A pending first tap is input history too. One real tap before leaving
  // must not pair with the first tap after a fresh entrance and manufacture
  // the excited double-click hop.
  const tapMain = (stamp) => {
    globalThis.__W.settleMainForClick();
    const pt = globalThis.__W.mainClickPoint();
    cvEv("pointerdown", pt.x, pt.y, stamp);
    cvEv("pointerup", pt.x, pt.y, stamp + 100);
  };
  globalThis.__W.armMainClickProgress();
  tapMain(11000);
  globalThis.__W.primePendingClick();
  const preHomeClick = globalThis.__W.clickProgressState();
  check("partial home double-click setup records one real tap",
    preHomeClick.pending === true && preHomeClick.flying === false);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  tapMain(11500);
  const returnedClick = globalThis.__W.clickProgressState();
  check("ranch return starts a fresh double-click window",
    returnedClick.pending === true && returnedClick.flying === false);

  globalThis.__W.clearClickProgress();
  globalThis.__W.armMainClickProgress();
  tapMain(12000);
  globalThis.__W.primePendingClick();
  globalThis.__W.recallMain();
  tapMain(12500);
  const recalledClick = globalThis.__W.clickProgressState();
  check("system recall starts a fresh double-click window",
    recalledClick.pending === true && recalledClick.flying === false);
  globalThis.__W.clearClickProgress();

  // Bites' production idle-flair scheduler starts a tail-chasing spin, a
  // chewing beat, and a tongue-out face together. HOME/recall already abort
  // the source motion, so the attached blep must end at the same boundary.
  globalThis.__W.armBitesFlair();
  pump(1);
  const preHomeFlair = globalThis.__W.flairState();
  check("home Bites setup uses the real legendary flair scheduler",
    preHomeFlair.armed === true && preHomeFlair.spin === true
      && preHomeFlair.munch === true && preHomeFlair.blep === true
      && preHomeFlair.face === "blep");
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedFlair = globalThis.__W.flairState();
  check("ranch return does not resume a pre-home Bites blep",
    returnedFlair.spin === false && returnedFlair.munch === false
      && returnedFlair.blep === false && returnedFlair.face !== "blep"
      && G().flying === true);

  globalThis.__W.clearFlairProbe();
  globalThis.__W.armBitesFlair();
  pump(1);
  globalThis.__W.recallMain();
  pump(1);
  const recalledFlair = globalThis.__W.flairState();
  check("system recall discards a pre-recall Bites blep",
    recalledFlair.spin === false && recalledFlair.munch === false
      && recalledFlair.blep === false && recalledFlair.face === "shock"
      && G().flying === true);
  globalThis.__W.clearFlairProbe();

  // Prey drive is partial cursor-input history. Four real bold-personality
  // hunt frames stop just below the stalk threshold; a fresh entrance must
  // not let one new swish complete that interrupted sequence.
  tauriEv("platforms", []);
  globalThis.__W.armMainHuntProgress();
  for (let i = 0; i < 4; i++) {
    globalThis.__W.stepMainHuntProgress();
    pump(1);
  }
  const preHomeHuntProgress = globalThis.__W.huntProgressState();
  check("partial home hunt setup reaches the real pre-stalk threshold",
    preHomeHuntProgress.score > 0.3 && preHomeHuntProgress.score < 0.35
      && preHomeHuntProgress.stalking === false);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  globalThis.__W.stepMainHuntProgress();
  pump(1);
  const returnedHuntProgress = globalThis.__W.huntProgressState();
  check("ranch return starts fresh cursor prey-drive accumulation",
    returnedHuntProgress.score > 0 && returnedHuntProgress.score < 0.12
      && returnedHuntProgress.stalking === false
      && returnedHuntProgress.status !== "STALKING");

  globalThis.__W.clearHuntProgress();
  globalThis.__W.armMainHuntProgress();
  for (let i = 0; i < 4; i++) {
    globalThis.__W.stepMainHuntProgress();
    pump(1);
  }
  globalThis.__W.recallMain();
  globalThis.__W.stepMainHuntProgress();
  pump(1);
  const recalledHuntProgress = globalThis.__W.huntProgressState();
  check("system recall starts fresh cursor prey-drive accumulation",
    recalledHuntProgress.score > 0 && recalledHuntProgress.score < 0.12
      && recalledHuntProgress.stalking === false
      && recalledHuntProgress.status !== "STALKING");
  globalThis.__W.clearHuntProgress();

  // Cursor-circle progress is partial pointer history too. Five real angular
  // steps stop just short of WHEE; a fresh entrance must seed a new angle
  // instead of joining one new step onto the interrupted near-loop.
  const circleAngles = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];
  const freshCircleAngle = -2.7831853071795862; // 3.5 radians, wrapped
  globalThis.__W.armMainCircleProgress();
  for (const ang of circleAngles) {
    globalThis.__W.stepMainCircleProgress(ang);
    pump(1);
  }
  const preHomeCircle = globalThis.__W.circleProgressState();
  check("partial home circle setup reaches the real pre-WHEE threshold",
    preHomeCircle.score > 4.9 && preHomeCircle.score < 5.1
      && preHomeCircle.spinning === false && preHomeCircle.dizzy === false
      && preHomeCircle.whee === 0);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  globalThis.__W.stepMainCircleProgress(freshCircleAngle);
  pump(1);
  const returnedCircle = globalThis.__W.circleProgressState();
  check("ranch return starts fresh cursor-circle accumulation",
    Math.abs(returnedCircle.score) < 0.01
      && returnedCircle.spinning === false && returnedCircle.dizzy === false
      && returnedCircle.whee === 0);

  globalThis.__W.clearCircleProgress();
  globalThis.__W.armMainCircleProgress();
  for (const ang of circleAngles) {
    globalThis.__W.stepMainCircleProgress(ang);
    pump(1);
  }
  globalThis.__W.recallMain();
  globalThis.__W.stepMainCircleProgress(freshCircleAngle);
  pump(1);
  const recalledCircle = globalThis.__W.circleProgressState();
  check("system recall starts fresh cursor-circle accumulation",
    Math.abs(recalledCircle.score) < 0.01
      && recalledCircle.spinning === false && recalledCircle.dizzy === false
      && recalledCircle.whee === 0);
  globalThis.__W.clearCircleProgress();

  // Recall is a fresh airborne entrance, not a continuation of a cursor hunt.
  // If an already-launched pounce flag survives the teleport, recall's own
  // landing can resolve the obsolete hunt and award a phantom GOTCHA.
  tauriEv("platforms", []);
  globalThis.__W.armRecallHuntPounce();
  const preRecallPounce = globalThis.__W.recallHuntState();
  check("recall hunt setup carries a live airborne pounce",
    preRecallPounce.pounce === true && preRecallPounce.flying === true
      && preRecallPounce.gotcha === 0 && preRecallPounce.smug === false);
  globalThis.__W.recallMain();
  globalThis.__W.landRecalledHuntPounce();
  pump(1);
  const landedRecallPounce = globalThis.__W.recallHuntState();
  check("system recall landing cannot complete the interrupted cursor hunt",
    landedRecallPounce.pounce === false && landedRecallPounce.gotcha === 0
      && landedRecallPounce.smug === false);
  globalThis.__W.clearRecallHuntProbe();

  // A successful cursor hunt earns its smug face inside the production
  // landing resolver. HOME/recall already cancel the pounce itself, so that
  // result cannot remain attached to a later fresh entrance.
  tauriEv("platforms", []);
  globalThis.__W.armHuntCatch();
  pump(1);
  const preHomeHunt = globalThis.__W.huntState();
  check("home hunt setup uses real landing catch resolution",
    preHomeHunt.pounce === false && preHomeHunt.smug === true
      && preHomeHunt.face === "smug" && preHomeHunt.gotcha > 0);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedHunt = globalThis.__W.huntState();
  check("ranch return does not resume a pre-home hunt smirk",
    returnedHunt.pounce === false && returnedHunt.smug === false
      && returnedHunt.face !== "smug" && G().flying === true);

  globalThis.__W.clearHuntProbe();
  globalThis.__W.armHuntCatch();
  pump(1);
  globalThis.__W.recallMain();
  pump(1);
  const recalledHunt = globalThis.__W.huntState();
  check("system recall discards a pre-recall hunt smirk",
    recalledHunt.pounce === false && recalledHunt.smug === false
      && recalledHunt.face === "shock" && G().flying === true);
  globalThis.__W.clearHuntProbe();

  // Holding still for 1.2s completes a cuddle in the production frame path.
  // Parking or recalling the pet ends that specific grab session, including
  // both its accumulated hold time and its held-only content-face timer.
  globalThis.__W.armMainCuddle();
  let cuddleAt = globalThis.__W.cuddlePoint();
  cvEv("pointerdown", cuddleAt.x, cuddleAt.y, 3000);
  globalThis.__W.primeMainCuddle();
  pump(1);
  const preHomeCuddle = globalThis.__W.cuddleState();
  check("home cuddle setup uses the real held-still frame branch",
    preHomeCuddle.held === true && preHomeCuddle.active === true
      && preHomeCuddle.face === "content" && preHomeCuddle.hearts > 0);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedCuddle = globalThis.__W.cuddleState();
  check("ranch return discards the pre-home cuddle session",
    returnedCuddle.held === false && returnedCuddle.active === false
      && returnedCuddle.accrued === 0 && G().flying === true);

  globalThis.__W.clearCuddleProbe();
  globalThis.__W.armMainCuddle();
  cuddleAt = globalThis.__W.cuddlePoint();
  cvEv("pointerdown", cuddleAt.x, cuddleAt.y, 4000);
  globalThis.__W.primeMainCuddle();
  pump(1);
  globalThis.__W.recallMain();
  pump(1);
  const recalledCuddle = globalThis.__W.cuddleState();
  check("system recall discards the pre-recall cuddle session",
    recalledCuddle.held === false && recalledCuddle.active === false
      && recalledCuddle.accrued === 0 && recalledCuddle.face === "shock"
      && G().flying === true);
  globalThis.__W.clearCuddleProbe();

  // A lazy idle fidget owns both a yawn clock and a stretch clock; while the
  // yawn is alive it refreshes the stretch every frame. Both fresh entrance
  // paths must end the source action, not only zero its current deformation.
  globalThis.__W.armYawnFidget();
  Math.random = () => 0;
  try { pump(1); } finally { Math.random = realRandom; }
  const preHomeYawn = globalThis.__W.yawnState();
  check("home yawn setup uses the real lazy fidget branch",
    preHomeYawn.yawn === true && preHomeYawn.stretch === true);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  const returnedYawn = globalThis.__W.yawnState();
  check("ranch return does not resume a pre-home yawn stretch",
    returnedYawn.yawn === false && returnedYawn.stretch === false);

  globalThis.__W.armYawnFidget();
  Math.random = () => 0;
  try { pump(1); } finally { Math.random = realRandom; }
  globalThis.__W.recallMain();
  pump(1);
  const recalledYawn = globalThis.__W.yawnState();
  check("system recall does not resume a pre-recall yawn stretch",
    recalledYawn.yawn === false && recalledYawn.stretch === false);
  globalThis.__W.clearYawnProbe();

  // Attention-seeking owns a four-second NEEDY window after choosing a walk
  // under the cursor. A fresh entrance should not reveal that obsolete mood
  // again after its initial HI/HAPPY presentation expires.
  globalThis.__W.armAttentionSeek();
  Math.random = () => 0;
  try { pump(1); } finally { Math.random = realRandom; }
  const preHomeBeg = globalThis.__W.begState();
  check("home begging setup uses the real attention-seek branch",
    preHomeBeg.active === true && preHomeBeg.target !== null);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  pump(1);
  check("ranch return does not retain a pre-home needy window",
    globalThis.__W.begState().active === false);

  globalThis.__W.armAttentionSeek();
  Math.random = () => 0;
  try { pump(1); } finally { Math.random = realRandom; }
  globalThis.__W.recallMain();
  pump(1);
  check("system recall does not retain a pre-recall needy window",
    globalThis.__W.begState().active === false);
  globalThis.__W.clearBegProbe();

  // A high ignored-time counter that has not yet rolled into a begging act
  // is latent attention debt. Explicit ranch time must not preserve it and
  // make the first grounded frame after return immediately turn NEEDY.
  globalThis.__W.armAttentionSeek();
  const preHomeAttentionDebt = globalThis.__W.attentionDebtState();
  check("home attention-debt setup is armed but not yet begging",
    preHomeAttentionDebt.ignored > 75 && preHomeAttentionDebt.active === false
      && preHomeAttentionDebt.target === null);
  globalThis.__W.sendMainHome();
  globalThis.__W.bringMainHome();
  globalThis.__W.settleMainForAttention();
  Math.random = () => 0;
  try { pump(1); } finally { Math.random = realRandom; }
  const returnedAttentionDebt = globalThis.__W.attentionDebtState();
  check("ranch return starts with no inherited attention debt",
    returnedAttentionDebt.ignored < 1 && returnedAttentionDebt.active === false
      && returnedAttentionDebt.target === null);

  globalThis.__W.clearAttentionDebt();
  globalThis.__W.armAttentionSeek();
  globalThis.__W.recallMain();
  globalThis.__W.settleMainForAttention();
  Math.random = () => 0;
  try { pump(1); } finally { Math.random = realRandom; }
  const recalledAttentionDebt = globalThis.__W.attentionDebtState();
  check("system recall starts with no inherited attention debt",
    recalledAttentionDebt.ignored < 1 && recalledAttentionDebt.active === false
      && recalledAttentionDebt.target === null);
  globalThis.__W.clearAttentionDebt();
  tauriEv("platforms", []);

  // The periodic self-heal is a fallback when an event path was missed. It
  // must cover every furniture kind and use the same width-aware anchoring.
  globalThis.__W.placeStaleBox(1900, 700);
  globalThis.__W.ageHeartbeat();
  pump(1);
  check("heartbeat repairs a stale wide-furniture anchor", G().box && G().boxPlatLive
    && G().box.x === G().winW - 36 && G().box.y === G().winH);

  // Daily eggs use a generous edge margin on ordinary decks. A window top
  // narrower than twice that margin cannot satisfy it, so both initial spawn
  // and stale-platform repair must balance the unavoidable overhang instead
  // of pushing the egg entirely to the right side.
  tauriEv("platforms", [[0, 300, 50]]);
  globalThis.__W.spawnEggOn(25, 300);
  check("daily egg spawn centers on a too-narrow platform",
    globalThis.__W.eggState()?.x === 25 && globalThis.__W.eggState()?.y === 300);
  globalThis.__W.placeStaleEgg(45, 300);
  globalThis.__W.ageHeartbeat();
  pump(1);
  check("stale daily egg repair centers on a too-narrow platform",
    globalThis.__W.eggState()?.x === 25 && globalThis.__W.eggState()?.y === 300
      && globalThis.__W.eggState()?.live === true);
  globalThis.__W.clearEgg();

  // Companion walk bounds collapse to the platform center when the body is
  // wider than its support. Inverted lo/hi bounds used to classify even a
  // centered, grounded pal as off-edge and force it into flight every frame.
  tauriEv("platforms", [[0, 300, 20]]);
  globalThis.__W.placePal(10, 300);
  pump(1);
  check("companion stays grounded at a too-narrow platform center",
    globalThis.__W.palState()?.x === 10 && globalThis.__W.palState()?.y === 300
      && globalThis.__W.palState()?.fly === false && globalThis.__W.palState()?.live === true);
  globalThis.__W.placePal(18, 295);
  globalThis.__W.launchPal();
  pump(1);
  check("companion landing centers on a too-narrow platform",
    globalThis.__W.palState()?.x === 10 && globalThis.__W.palState()?.y === 300
      && globalThis.__W.palState()?.fly === false && globalThis.__W.palState()?.live === true);
  tauriEv("platforms", []);

  // The movable menu must hold the native input region for the entire drag;
  // otherwise the transparent overlay can become click-through as soon as
  // the cursor leaves the menu's original small hit rectangle.
  const dragCallsBeforeFab = G().dragCalls.length;
  cvEv("pointerdown", W - 28, 28);
  check("menu drag captures native input", G().fabDrag !== null
    && G().dragCalls.length === dragCallsBeforeFab + 1
    && G().dragCalls[dragCallsBeforeFab] === true);
  check("menu press shows grabbing cursor", G().cursor === "grabbing");
  cvEv("pointermove", 600, 260);
  cvEv("pointerup", 600, 260);
  check("menu release clears native drag state", G().fabDrag === null
    && G().fabX === 600 && G().fabY === 260
    && G().cursor === "default"
    && G().dragCalls.length === dragCallsBeforeFab + 2
    && G().dragCalls[dragCallsBeforeFab + 1] === false);
  cvEv("pointerdown", 600, 260);
  cvEv("pointermove", 820, 330);
  cvEv("pointercancel", 820, 330);
  check("cancelled menu drag restores origin and native input", G().fabDrag === null
    && G().fabX === 600 && G().fabY === 260
    && G().cursor === "default"
    && G().dragCalls.length === dragCallsBeforeFab + 4
    && G().dragCalls[dragCallsBeforeFab + 2] === true
    && G().dragCalls[dragCallsBeforeFab + 3] === false);

  // Pointer capture is best-effort in WebView. A transient capture exception
  // must not abort after setting propHeld but before native dragging is on.
  globalThis.__W.placeBowl(420, 700);
  pump(2);
  const dragCallsBeforeFailure = G().dragCalls.length;
  globalThis.__W.setCaptureFailure(true);
  cvEv("pointerdown", 420, 687);
  globalThis.__W.setCaptureFailure(false);
  check("capture failure cannot wedge a furniture grab", G().propHeld === "bowl"
    && G().dragCalls.length === dragCallsBeforeFailure + 1
    && G().dragCalls[dragCallsBeforeFailure] === true);
  cvEv("pointercancel", 420, 687);

  // If both pointerup and pointercancel disappear, the 20s watchdog is the
  // only release path. It must apply the same cancel semantics as above.
  tauriEv("platforms", [[400, 700, 300]]);
  globalThis.__W.placeBowl(520, 700);
  pump(2);
  cvEv("pointerdown", 520, 687);
  cvEv("pointermove", 900, 200);
  globalThis.__W.ageGrab();
  pump(1);
  check("stuck-grab watchdog restores furniture origin", G().propHeld === null
    && G().bowl && G().bowl.x === 520 && G().bowl.y === 700
    && G().dragCalls.at(-1) === false);
  tauriEv("platforms", []);

  // The lost-terminal-event watchdog shares the cancellation restore path.
  // It must also repair an anchor invalidated during the long hold.
  tauriEv("platforms", [[400, 360, 300]]);
  globalThis.__W.placePlant(500, 360);
  cvEv("pointerdown", 500, 343);
  cvEv("pointermove", 800, 220);
  tauriEv("platforms", []);
  globalThis.__W.ageGrab();
  pump(1);
  check("watchdog after platform removal reanchors furniture", G().propHeld === null
    && G().plant && G().plantPlatLive && G().plant.y === G().winH);

  // A normal companion release must end the visual drag state immediately.
  // Without an explicit reset, the cursor stays as a closed hand until the
  // user happens to move the pointer again.
  globalThis.__W.placePal(300, 700);
  cvEv("pointerdown", 300, 680);
  check("companion grab shows grabbing cursor", G().palHeld !== null
    && G().cursor === "grabbing");
  cvEv("pointermove", 120, 400);
  check("companion drag faces pointer direction", G().pal && G().pal.lookDir === -1);
  cvEv("pointerup", 120, 400);
  check("companion release clears grabbing cursor", G().palHeld === null
    && G().pal && G().pal.fly === true && G().cursor === "default");

  // OS cancellation must resume companion physics. Clearing only palHeld
  // leaves fly=false from the grab and strands the companion in mid-air.
  globalThis.__W.placePal(340, 700);
  cvEv("pointerdown", 340, 680);
  cvEv("pointermove", 760, 280);
  check("companion cancel setup suspends physics", G().palHeld !== null
    && G().pal && G().pal.fly === false);
  cvEv("pointercancel", 760, 280);
  check("cancelled companion resumes a zero-velocity fall", G().palHeld === null
    && G().pal && G().pal.fly === true && G().pal.vx === 0 && G().pal.vy === 0
    && G().cursor === "default");

  // The lost-terminal watchdog must perform the same physics release rather
  // than only clearing the held reference after twenty seconds.
  globalThis.__W.placePal(380, 700);
  cvEv("pointerdown", 380, 680);
  cvEv("pointermove", 800, 260);
  globalThis.__W.ageGrab();
  pump(1);
  check("companion watchdog resumes falling physics", G().palHeld === null
    && G().pal && G().pal.fly === true && G().cursor === "default"
    && G().dragCalls.at(-1) === false);

  // A dangling Webby grab has extra silk state. The lost-pointer watchdog
  // must tear that state down just like the explicit pointercancel path.
  globalThis.__W.startWeb();
  const webX = G().petX, webY = G().petY;
  cvEv("pointerdown", webX, webY - 20);
  check("web watchdog setup holds pet and silk", G().held === true
    && G().webbing === true && G().webHeld === true);
  cvEv("pointermove", webX + 180, webY - 220);
  globalThis.__W.ageGrab();
  pump(1);
  check("web watchdog tears silk and resumes falling", G().held === false
    && G().webHeld === false && G().webbing === false && G().flying === true
    && G().cursor === "default" && G().dragCalls.at(-1) === false);

  // Grabbing a moving ball must arrest its old physics. A cancelled gesture
  // drops it from the cursor; it must not resume the velocity it had before
  // the user caught it at a completely different position.
  globalThis.__W.placeBall(300, 600, 480, -200);
  cvEv("pointerdown", 300, 591);
  check("moving ball can be grabbed", G().ballHeld === true);
  cvEv("pointermove", 800, 250);
  cvEv("pointercancel", 800, 250);
  check("cancelled ball drag has no stale pre-grab momentum", G().ballHeld === false
    && G().ball && G().ball.vx === 0 && G().ball.vy === 0);

  // A sub-threshold pointer wobble is still a furniture tap, not a move.
  // The transient cursor-follow coordinate must not accumulate into the
  // durable furniture position every time the user refills or fluffs it.
  globalThis.__W.placeBowl(360, 700);
  cvEv("pointerdown", 360, 687);
  cvEv("pointermove", 366, 691); // sqrt(6^2 + 4^2) < 10px tap threshold
  cvEv("pointerup", 366, 691);
  check("jittered furniture tap preserves anchored position", G().propHeld === null
    && G().bowl && G().bowl.x === 360 && G().bowl.y === 700);

  // The whole placement path through the real UI: FAB tap -> toys item ->
  // strip slot click. A ReferenceError in the slot branch used to kill every
  // spawn silently (nw was block-scoped to the remove branch).
  {
    // earlier tests leave placed props + menu state behind — reset so every
    // slot starts from "not placed" and the toggles read correctly
    globalThis.__W.clearProps();
    const [fx, fy] = G().fabPosV;
    cvEv("pointerdown", fx, fy); cvEv("pointerup", fx, fy);
    pump(1);
    check("FAB tap opens the accordion", G().fabOpen === true);
    const [ix, iy, iw, ih] = G().itemRect(2); // toys
    cvEv("pointerdown", ix + iw / 2, iy + ih / 2); cvEv("pointerup", ix + iw / 2, iy + ih / 2);
    pump(1);
    check("toys item opens the chooser strip", G().toyboxOpen === true);
    for (const [kind, slot] of [["bowl", 1], ["cushion", 2], ["box", 3], ["plant", 4], ["music", 5], ["mirror", 6], ["mat", 7], ["jar", 8]]) {
      const [sx, sy] = G().stripRect();
      const cx = sx + slot * 36 + 18, cy = sy + 17;
      cvEv("pointerdown", cx, cy); cvEv("pointerup", cx, cy);
      pump(1);
      check(`strip slot spawns ${kind}`, G()[kind] !== null);
      const [sx2, sy2] = G().stripRect();
      cvEv("pointerdown", sx2 + slot * 36 + 18, sy2 + 17); cvEv("pointerup", sx2 + slot * 36 + 18, sy2 + 17);
      pump(1);
      check(`strip slot toggles ${kind} off`, G()[kind] === null);
    }
    const [sx3, sy3] = G().stripRect();
    cvEv("pointerdown", sx3 + 18, sy3 + 17); cvEv("pointerup", sx3 + 18, sy3 + 17);
    pump(1);
    check("strip slot spawns the ball", G().ball !== null);
    cvEv("pointerdown", sx3 + 18, sy3 + 17); cvEv("pointerup", sx3 + 18, sy3 + 17);
    check("strip slot pockets the ball", G().ball === null);
  }

  console.log(fails === 0 ? "ALL GREEN" : `${fails} FAILURES`);
  process.exit(fails ? 1 : 0);
})();

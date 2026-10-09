// social + sleep-face harness: eval main.js, verify (1) sleeping face
// can't be overridden by cosmetic timers, (2) pals can't bump a sleeping
// pet, (3) gossip chat fires between two idle pals, (4) nap pile joins a
// dozing buddy, (5) mood contagion echoes a laugh, (6) sleeping main pet
// gathers a synchronized nap pile and wake-up cancels the approach.
const fs = require("fs");

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
      if (prop in t) return t[prop];
      const f = (...a) => {};
      t[prop] = f;
      return f;
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
function fakeCanvas() {
  const c = {
    width: 800, height: 600, style: {}, listeners: {},
    addEventListener() {}, removeEventListener() {},
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: c.width, height: c.height }; },
  };
  c.getContext = () => (c._ctx = c._ctx || fakeCtx(c));
  c.toDataURL = () => "data:image/png;base64,AAAA";
  return c;
}
const els = {};
const getEl = (id) => {
  if (!els[id]) {
    const e = {
      style: {}, innerHTML: "", textContent: "", children: [],
      addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
      setPointerCapture() {}, releasePointerCapture() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 400 }; },
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      querySelector() { return null; }, querySelectorAll() { return []; },
      width: 320, height: 400,
    };
    e.getContext = () => (e._ctx = e._ctx || fakeCtx(e));
    e.toDataURL = () => "data:image/png;base64,AAAA";
    els[id] = e;
  }
  return els[id];
};

let rafCb = null;
const invokeMocks = {};
const listeners = {};
let resolveMonitors;
invokeMocks.get_monitors = () => new Promise((resolve) => { resolveMonitors = resolve; });
global.window = global;
global.innerWidth = 1920; global.innerHeight = 1080; global.devicePixelRatio = 1;
global.addEventListener = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
global.removeEventListener = () => {};
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
global.performance = require("perf_hooks").performance;
global.document = {
  getElementById: getEl,
  createElement: (t2) => (t2 === "canvas" ? fakeCanvas() : getEl("_" + t2)),
  createElementNS: (ns, t2) => getEl("_" + t2),
  body: getEl("body"), documentElement: getEl("html"),
  addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  removeEventListener() {}, fonts: { load: () => Promise.resolve() }, hidden: false,
};
global.navigator = { userAgent: "sim" };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} createOscillator(){return{frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){},type:""}}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}} get destination(){return {}} get currentTime(){return 0} };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };

const invokeCalls = {};
const crashMsgs = [];
global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      invokeCalls[cmd] = args;
      if (cmd === "log_crash" && args) crashMsgs.push(args.msg);
      if (Object.prototype.hasOwnProperty.call(invokeMocks, cmd)) {
        const mock = invokeMocks[cmd];
        return typeof mock === "function" ? mock(args) : Promise.resolve(mock);
      }
      if (cmd === "load_state") return Promise.resolve("{}");
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      if (cmd === "is_demo") return Promise.resolve(false);
      return Promise.resolve(null);
    },
  },
  event: { listen: (name, cb) => { (listeners["tauri:" + name] = listeners["tauri:" + name] || []).push(cb); return Promise.resolve(() => {}); } },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8") +
  "\n;globalThis.__T = (expr) => eval(expr);";
try { (0, eval)(src); } catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }

const ev = (s) => globalThis.__T(s);
const frame = (t) => { const cb = rafCb; rafCb = null; if (cb) cb(t); };
let pass = 0, fail = 0;
const check = (ok, name, extra) => { console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  (" + extra + ")" : "")); ok ? pass++ : fail++; };

(async () => {
  await new Promise((r) => setImmediate(r));
  let t = 0;
  for (let i = 0; i < 120; i++) { t += 16.7; frame(t); }

  // Runtime event payloads cross the native/webview boundary. A malformed
  // sample must neither throw nor poison the last good cursor/platform state.
  const cursorHandlers = listeners["tauri:cursor"] || [];
  const oldCursor = ev("[curX,curY,lastCurX,lastCurY,lastCurT]");
  let cursorSafe = true;
  for (const payload of [null, {}, [NaN, 2], [1], ["1", 2], [1e300, 2]]) {
    try { cursorHandlers.forEach((cb) => cb({ payload })); } catch { cursorSafe = false; }
  }
  cursorHandlers.forEach((cb) => cb({ payload: [321, 222] }));
  check(cursorSafe && ev("curX===321 && curY===222 && Number.isFinite(curV) && Number.isFinite(curVX)"),
    "cursor events ignore malformed coordinates without poisoning motion");
  ev(`curX=${oldCursor[0]};curY=${oldCursor[1]};lastCurX=${oldCursor[2]};lastCurY=${oldCursor[3]};lastCurT=${oldCursor[4]};curV=0;curVX=0`);

  const platformHandlers = listeners["tauri:platforms"] || [];
  platformHandlers.forEach((cb) => cb({ payload: [[100, 300, 200]] }));
  ev(`box = { x: 500, y: 1080, plat: monPlats[0] };
      egg = { x: 600, y: 1080, plat: monPlats[0], t0: 0, wob: 0 };`);
  resolveMonitors([[0, 0, 1280, 1080], [1280, 0, 640, 1080]]);
  await Promise.resolve();
  await new Promise((r) => setImmediate(r));
  check(ev("monPlats.length===2 && plats.some(p=>p.x===100&&p.y===300&&p.w===200)"),
    "late boot monitor response preserves newer runtime platforms",
    ev("JSON.stringify({monPlats,plats})"));
  check(ev("plats.includes(box.plat) && plats.includes(egg.plat) && box.y===1080 && egg.y===1080"),
    "late boot monitor response re-seats restored anchors immediately",
    ev("JSON.stringify({boxLive:plats.includes(box.plat),eggLive:plats.includes(egg.plat),boxY:box.y,eggY:egg.y})"));
  ev("box = null; egg = null");
  const platformBefore = ev("JSON.stringify(plats)");
  let platformsSafe = true;
  try { platformHandlers.forEach((cb) => cb({ payload: null })); } catch { platformsSafe = false; }
  const malformedPreserved = ev("JSON.stringify(plats)") === platformBefore;
  try {
    platformHandlers.forEach((cb) => cb({ payload: [
      null, [0, 0, NaN], [1, 2, -4], ["1", 2, 3], [1e300, 2, 3],
    ] }));
  } catch { platformsSafe = false; }
  check(platformsSafe && malformedPreserved && ev("JSON.stringify(plats)") === platformBefore,
    "all-invalid platform scans preserve the last good geometry");
  try {
    platformHandlers.forEach((cb) => cb({ payload: [
      [100, 300, 200], null, [0, 0, NaN], [1, 2, -4], ["1", 2, 3], [1e300, 2, 3],
    ] }));
  } catch { platformsSafe = false; }
  check(platformsSafe
      && ev("plats.some(p=>p.x===100&&p.y===300&&p.w===200)")
      && ev("plats.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.w)&&p.w>0)"),
    "platform events preserve the last scan and keep valid sibling rows");
  platformHandlers.forEach((cb) => cb({ payload: [] }));

  const focusHandlers = listeners["tauri:focus"] || [];
  const oldFocus = ev("[focusTitle,focusExe]");
  focusHandlers.forEach((cb) => cb({ payload: ["KEEP TITLE", "KEEP.EXE"] }));
  let focusSafe = true;
  for (const event of [null, {}, { payload: null }, { payload: {} },
    { payload: ["partial"] }, { payload: ["title", 7] }]) {
    try { focusHandlers.forEach((cb) => cb(event)); } catch { focusSafe = false; }
  }
  check(focusSafe && ev("focusTitle==='keep title' && focusExe==='keep.exe'"),
    "focus events ignore malformed payloads without losing the last app");
  const longTitle = "YouTube " + "A".repeat(700);
  const longExe = "CHROME " + "B".repeat(400);
  focusHandlers.forEach((cb) => cb({ payload: [longTitle, longExe] }));
  check(ev("focusTitle.length===512 && focusExe.length===256 && focusKind()==='media'"),
    "focus events normalize and bound valid title/app strings");
  ev(`focusTitle=${JSON.stringify(oldFocus[0])};focusExe=${JSON.stringify(oldFocus[1])}`);

  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  ev(`listenQuiet("sync-handler-test", () => { throw new Error("sync handler boom"); });
      listenQuiet("async-handler-test", () => Promise.reject(new Error("async handler boom")));`);
  (listeners["tauri:sync-handler-test"] || []).forEach((cb) => cb({ payload: null }));
  (listeners["tauri:async-handler-test"] || []).forEach((cb) => cb({ payload: null }));
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  process.off("unhandledRejection", onUnhandled);
  check(unhandled.length === 0
      && crashMsgs.some((msg) => msg === "LISTEN sync-handler-test sync handler boom")
      && crashMsgs.some((msg) => msg === "LISTEN async-handler-test async handler boom"),
    "event handlers contain and diagnose sync throws and async rejections");

  // --- T1: sleeping face can't be overridden by cosmetic timers ---
  ev("awakeAt = 0; state = 'sleeping'; contentUntil = " + (t + 60000) + "; starUntil = " + (t + 60000) + "; poutUntil = " + (t + 60000) + ";");
  frame(t += 16.7);
  check(ev("faceName(" + t + ")") === "sleeping", "sleeping beats content/star/pout timers");
  // dizzy (physical override) still wins
  ev("dizzyUntil = " + (t + 3000));
  check(ev("faceName(" + t + ")") === "dizzy", "dizzy still overrides sleep (thrown)");
  ev("dizzyUntil = 0");

  // --- T2: pal cannot bump a sleeping pet ---
  ev("owned.push(SPECIES[1].id); spawnPal(1);");
  for (let i = 0; i < 30; i++) { t += 16.7; frame(t); }
  ev("pals[0].x = petX + 40; pals[0].y = petY; pals[0].fly = false; pals[0].plat = null; pals[0].playCd = 0; mainPlayCd = 0; pals[0].walkT = null; pals[0].nextT = 0;");
  const cu0 = ev("contentUntil");
  for (let i = 0; i < 120; i++) { t += 16.7; frame(t); }
  check(ev("contentUntil") <= Math.max(cu0, t), "pal never bumps a sleeping pet (no contentUntil)", "state=" + ev("state"));

  // --- T3: wake paths flip state instantly ---
  ev("state = 'idle'; awakeAt = Date.now();");
  for (let i = 0; i < 20; i++) { t += 16.7; frame(t); }

  // --- T4: gossip chat between two idle pals ---
  ev("owned.push(SPECIES[2].id); spawnPal(2);");
  for (let i = 0; i < 30; i++) { t += 16.7; frame(t); }
  ev(`pals[0].x = 800; pals[0].y = petY; pals[0].fly = false; pals[0].plat = null; pals[0].walkT = null; pals[0].propGoal = null; pals[0].nextT = 1e9; pals[0].stackOn = null; pals[0].stackCd = 1e15; pals[0].playCd = 1e15;
      pals[1].x = 860; pals[1].y = petY; pals[1].fly = false; pals[1].plat = null; pals[1].walkT = null; pals[1].propGoal = null; pals[1].nextT = 1e9; pals[1].stackOn = null; pals[1].stackCd = 1e15; pals[1].playCd = 1e15;
      petX = 300;`); // park both near each other, pet far away; stackCd/playCd pin them un-stacked and un-bumped
  let chatSeen = false, bubbles = 0;
  // count chirp glyphs only while a chat session is live — greeting ♪s
  // must not count, and a chat that ends inside the wait loop must not
  // be missed either
  const chirps = ["♪", "♥", "...", "!", "HEH"];
  const liveBubbles = "pals.some(p=>p.chatMate) ? bangs.filter(b=>" + JSON.stringify(chirps) + ".includes(b.t)).length : 0";
  for (let i = 0; i < 900 && !chatSeen; i++) {
    t += 16.7; frame(t);
    bubbles += ev(liveBubbles);
    if (ev("!!(pals[0] && pals[0].chatMate)")) { chatSeen = true; break; }
  }
  // Once initiation is proven, pin one otherwise-valid chat frame at its
  // scheduled chirp. Random ambient motion may legitimately launch a pal
  // during the 260ms lead-in and cancel the conversation; that should not
  // make the independent bubble-rendering assertion probabilistic.
  if (chatSeen) {
    ev("pals.forEach(p => { p.fly = false; p.vx = 0; p.vy = 0; p.chatNext = 0; });");
    t += 16.7; frame(t);
    bubbles += ev(liveBubbles);
  }
  // count chat bubbles while it runs
  for (let i = 0; i < 300; i++) {
    t += 16.7; frame(t);
    bubbles += ev(liveBubbles);
    if (!ev("pals[0] && pals[0].chatMate")) break;
  }
  check(chatSeen, "gossip chat starts between idle pals",
    ev(`JSON.stringify(pals.map(p=>({w:p.walkT,f:p.fly,n:p.nextT>${t}?1:0,c:p.chatMate?1:0,g:!!p.tag,s:!!p.stackOn,r:p.restUntil>${t}?1:0,h:p.hideUntil>${t}?1:0,cd:p.chatCd>${t}?1:0,pg:!!p.propGoal,fo:!!p.follow,si:!!p.sigT,x:Math.round(p.x)})))`));
  check(bubbles > 0 || ev("bangs.some(b=>['♪','♥','...','!','HEH'].includes(b.t))"), "chat bubbles emitted", "bubbles~" + bubbles);
  for (let i = 0; i < 400; i++) { t += 16.7; frame(t); }
  check(ev("pals.every(p=>!p.chatMate)"), "chat ends cleanly", ev("pals.map(p=>p.chatUntil).join(',')"));

  // --- T5: nap pile — pal joins a dozing buddy (within the 240px sniff range) ---
  ev("pals[0].x = 800; pals[0].restUntil = " + (t + 20000) + "; pals[0].restCd = " + (t + 40000) + "; pals[0].walkT = null; pals[0].chatMate = null; pals[0].chatUntil = 0; pals[0].tag = null; pals[0].stackOn = null;");
  ev("pals[1].x = 950; pals[1].y = petY; pals[1].restUntil = 0; pals[1].restCd = 0; pals[1].nextT = 0; pals[1].walkT = null; pals[1].chatMate = null; pals[1].chatUntil = 0; pals[1].follow = null; pals[1].tag = null; pals[1].stackOn = null; pals[1].stackCd = 1e15;");
  // pin the decision roll inside the cuddle window (0.12-0.22 skips the
  // sig branch but still lands on napper) — tests the mechanic, not luck
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0.15;");
  let cuddled = false;
  for (let i = 0; i < 2600; i++) {
    // force a decision tick each frame — we test the mechanic, not its odds
    ev("if (pals[1] && pals[1].walkT === null && !pals[1].propGoal) pals[1].nextT = 0;");
    t += 16.7; frame(t);
    if (i % 20 === 0) await new Promise((r) => setImmediate(r));
    if (ev("pals[1] && pals[1].restUntil > " + t)) { cuddled = true; break; }
    // keep host asleep for the test duration
    if (i % 50 === 0) ev("if (pals[0]) { pals[0].restUntil = " + (t + 20000) + "; pals[0].walkT = null; pals[0].chatMate = null; }");
  }
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(cuddled, "nap pile: second pal lies down beside the napper", "p1.rest=" + ev("pals[1] && Math.round((pals[1].restUntil||0) - " + t + ")"));
  check(ev(`cardStatus(pals[1],${t})`) === "NAPPING",
    "status card reports a resting pal as NAPPING");

  // --- T6: synchronized nap — a pal curls up beside the sleeping main pet ---
  ev(`(function(){
      state = 'sleeping'; petHome = false; held = false; flying = false; cushionNap = 0;
      petX = 800; petY = plats[0].y;
      pals.forEach((p, i) => { p.fly = false; p.y = petY; p.restUntil = 0; p.restCd = 0;
        p.walkT = null; p.propGoal = null; p.chatMate = null; p.chatUntil = 0;
        p.follow = null; p.tag = null; p.stackOn = null; p.stackCd = 1e15;
        p.hideUntil = i ? 1e15 : 0; p.nextT = i ? 1e15 : 0; });
      pals[0].x = 1020;
    })();`);
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0.15;");
  let petCuddled = false;
  for (let i = 0; i < 900; i++) {
    ev("if (pals[0] && pals[0].walkT === null && !pals[0].propGoal && pals[0].restUntil <= " + t + ") pals[0].nextT = 0;");
    t += 16.7; frame(t);
    if (i % 20 === 0) await new Promise((r) => setImmediate(r));
    if (ev("pals[0] && pals[0].restUntil > " + t)) { petCuddled = true; break; }
  }
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(petCuddled, "main-pet nap pile: pal lies down beside sleeping pet",
    ev("JSON.stringify({x:pals[0]&&Math.round(pals[0].x), petX:Math.round(petX), rest:pals[0]&&Math.round((pals[0].restUntil||0)-" + t + ")})"));

  // Starting the same approach and waking the pet must cancel it at once.
  ev(`(function(){ const p=pals[0]; p.restUntil=0; p.restCd=0; p.x=1040; p.walkT=null;
      p.propGoal=null; p.nextT=0; state='sleeping'; })();`);
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0.15;");
  frame(t += 16.7);
  const aimedAtPetNap = ev("pals[0] && pals[0].propGoal && pals[0].propGoal.kind === 'petCuddle'");
  ev("state='idle'; awakeAt=Date.now();");
  frame(t += 16.7);
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(aimedAtPetNap && ev("pals[0].walkT === null && pals[0].propGoal === null"),
    "waking pet cancels pal nap approach");

  // --- T7: mood contagion — a laugh nearby echoes ---
  ev("pals.forEach(p=>{p.restUntil=0; p.hideUntil=0; p.chatUntil=0; p.chatMate=null; p.follow=null; p.stackOn=null; p.tag=null;});");
  ev("pals[0].x = 700; pals[0].y = petY; pals[0].fly = false; pals[0].faceId = 'laugh'; pals[0].faceT = " + (t + 3000) + "; pals[0].stackCd = 1e15;");
  ev("pals[1].x = 780; pals[1].y = petY; pals[1].fly = false; pals[1].faceT = 0; pals[1].walkT = null; pals[1].chatMate=null; pals[1].chatUntil=0; pals[1].stackCd = 1e15;");
  let echoed = false;
  for (let i = 0; i < 700; i++) {
    t += 16.7; frame(t);
    ev("if (pals[0]) { pals[0].faceId = 'laugh'; pals[0].faceT = " + (t + 3000) + "; pals[0].walkT = null; }"); // hold the laugh
    if (ev("pals[1] && pals[1].faceId === 'happy' && pals[1].faceT > " + t)) { echoed = true; break; }
  }
  check(echoed, "mood contagion: nearby pal smiles along");

  // --- T7: faceName sanity on awake pet (clear leftover timers from T1) ---
  ev("state = 'idle'; awakeAt = Date.now(); contentUntil = 0; starUntil = 0; poutUntil = 0; blinkUntil = 0; lookUntil = 0; munchUntil = 0;");
  frame(t += 16.7);
  check(["idle","blink","lookL","lookR","content","happy"].includes(ev("faceName(" + t + ")")), "awake face resolves normally", ev("faceName(" + t + ")"));

  // --- T8: removePal severs every social tie pointing at the leaver ---
  ev(`(function(){
      pals.length = 0;
      owned.push(SPECIES[1].id, SPECIES[2].id, SPECIES[3].id);
      spawnPal(1); spawnPal(2); spawnPal(3);
      const a = pals[0], b = pals[1], c = pals[2];
      a.chatMate = b; b.chatMate = a; a.chatUntil = b.chatUntil = 1e15;
      c.follow = a; c.followT = 1e15;
      c.tag = { on: a, it: true, until: 1e15 };
      b.propGoal = { kind: 'cuddle', mate: a, at: 0 }; b.walkT = 500;
      c.stackOn = a; c.stackT = 1e15;
    })();`);
  ev("removePal(pals[0])");
  for (let i = 0; i < 10; i++) { t += 16.7; frame(t); }
  check(ev(`pals.every(p => !p.chatMate && !p.follow && !p.tag && !p.stackOn && !(p.propGoal && p.propGoal.mate))`),
    "removePal clears chat/follow/tag/stack/propGoal refs",
    ev(`JSON.stringify(pals.map(p => ({c: !!p.chatMate, f: !!p.follow, g: !!p.tag, s: !!p.stackOn, m: !!(p.propGoal && p.propGoal.mate)})))`));

  // --- T9: removing the held pal drops the drag cleanly ---
  ev(`(function(){ spawnPal(4); owned.push(SPECIES[4].id); const p = pals[pals.length-1]; p.fly = false; palHeld = p; cv.style.cursor = 'grabbing'; })();`);
  ev("removePal(palHeld)");
  frame(t += 16.7);
  check(ev("palHeld === null && cv.style.cursor === 'default'"),
    "removing held pal clears drag state and cursor");

  // --- T10: a hidden pal makes no decisions (box dwellers stay put) ---
  ev(`(function(){ const p = pals[0]; p.hideUntil = ${"1e15"}; p.nextT = 0; p.walkT = null; p.propGoal = null; })();`);
  for (let i = 0; i < 60; i++) { t += 16.7; frame(t); }
  check(ev("pals[0] && pals[0].walkT === null && !pals[0].propGoal && !pals[0].fly"),
    "hidden pal never starts a walk/errand",
    ev("JSON.stringify({w: pals[0] && pals[0].walkT, g: pals[0] && pals[0].propGoal, f: pals[0] && pals[0].fly})"));
  ev("pals[0] && (pals[0].hideUntil = 0)");

  // --- T11: bump play ignores hidden/tagging/stacked partners ---
  ev(`(function(){
      petHome = true; walkTarget = null; hopTarget = null; nextWander = 1e15;
      pals.forEach(p => { p.fly = false; p.walkT = null; p.restUntil = 0; p.hideUntil = 0; p.tag = null; p.stackOn = null; p.playCd = 0; p.stackCd = 1e15; });
      if (pals.length >= 2) {
        pals[0].x = 700; pals[0].y = petY; pals[0].nextT = 1e9;
        pals[1].x = 720; pals[1].y = petY; pals[1].nextT = 1e9;
        pals[1].hideUntil = ${"1e15"};   // invisible partner must not be bumped
      }
    })();`);
  const plays0 = ev("stats.plays");
  for (let i = 0; i < 120; i++) { t += 16.7; frame(t); }
  check(ev("stats.plays") === plays0, "no bump-play with a hidden pal", "plays=" + ev("stats.plays"));
  // The same invisible box-dweller must not become a totem mount.
  ev("pals[0].stackCd = 0; globalThis.__realRandom = Math.random; Math.random = () => 0;");
  frame(t += 16.7);
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(ev("pals[0].stackOn === null"), "visible pal never stacks onto a hidden pal");
  check(ev("!(pals[0].socCd > 0) && !(pals[1].socCd > 0)"),
    "visible pal never greets a hidden pal");

  // A huddle decision must ignore the same invisible target.
  ev(`(function(){ const a=pals[0], b=pals[1]; a.x=700; a.walkT=null; a.nextT=0;
      a.stackCd=1e15; a.socCd=1e15; b.x=820; b.hideUntil=1e15; })();`);
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0.85;");
  frame(t += 16.7);
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(ev("pals[0].walkT === null"), "huddle ignores a hidden pal");
  ev("petHome = false; pals[1].hideUntil = 0;");

  // --- T12: legendary auras never slide a sleeping pal ---
  ev(`(function(){ globalThis.__oldActive=active; active=SPECIES.findIndex(s=>s.id==='pulsar');
      state='sleeping'; petHome=false; held=false; flying=false; petX=900; petY=plats[0].y;
      const p=pals[0]; p.x=700; p.y=petY; p.fly=false; p.plat=plats[0]; p.walkT=null;
      p.stackOn=null; p.web=0; p.restUntil=${t + 10000}; p.hideUntil=0;
      pals[1].x=200; pals[1].hideUntil=1e15; })();`);
  const sleepingX = ev("pals[0].x");
  for (let i = 0; i < 90; i++) { t += 16.7; frame(t); }
  check(Math.abs(ev("pals[0].x") - sleepingX) < 0.01,
    "pulsar aura never drags a sleeping pal",
    "dx=" + (ev("pals[0].x") - sleepingX).toFixed(3));
  ev("active=globalThis.__oldActive; delete globalThis.__oldActive; state='idle'; awakeAt=Date.now(); pals[0].restUntil=0; pals[1].hideUntil=0;");

  // Hidden pals have neither a backend hitbox nor physical toy reactions.
  ev("pals.forEach(p=>{p.hideUntil=0; p.fly=false;}); sendClickable()");
  const visibleRectCount = (invokeCalls.set_clickable && invokeCalls.set_clickable.rects || []).length;
  ev("pals[0].hideUntil=1e15; sendClickable()");
  const hiddenRectCount = (invokeCalls.set_clickable && invokeCalls.set_clickable.rects || []).length;
  check(hiddenRectCount === visibleRectCount - 1,
    "hidden pal drops its backend click hitbox",
    `visible=${visibleRectCount} hidden=${hiddenRectCount}`);

  ev(`(function(){ petHome=true; const p=pals[0]; p.x=700; p.y=plats[0].y; p.plat=plats[0];
      p.fly=false; p.stackOn=null; p.restUntil=0; p.hideUntil=1e15;
      ball={x:p.x,y:p.y,vx:300,vy:0,r:9,rot:0,sq:0}; })();`);
  frame(t += 16.7);
  check(ev("pals[0].fly === false"), "fast ball never launches a hidden pal");
  ev("ball=null; pals[0].hideUntil=0; petHome=false;");

  ev(`(function(){ const p=pals[0]; globalThis.__oldSp=p.sp;
      p.sp=SPECIES.findIndex(s=>s.id==='gold'); if(!owned.includes('gold')) owned.push('gold');
      p.fly=false; p.walkT=null; p.restUntil=0; p.hideUntil=1e15;
      pals[1].hideUntil=1e15; fx.length=0; bangs.length=0; nextFidget=1e15; })();`);
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0;");
  frame(t += 16.7);
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(ev("fx.length === 0 && bangs.length === 0"),
    "hidden legendary emits no ghost particles");
  ev("pals[0].sp=globalThis.__oldSp; delete globalThis.__oldSp; pals.forEach(p=>p.hideUntil=0);");

  // --- T13: a prop on a window that closes drops to the floor, not mid-air ---
  ev(`(function(){
      bowl = { x: 500, y: 400, plat: { x: 400, y: 400, w: 400 }, fill: 2 };
    })();`);
  // the next platform scan arrives without that window — shelf is gone
  (listeners["tauri:platforms"] || []).forEach((cb) => cb({ payload: [] }));
  for (let i = 0; i < 10; i++) { t += 16.7; frame(t); }
  check(ev("bowl && bowl.y >= winH - 1 && plats.includes(bowl.plat)"),
    "prop on a closed window re-anchors to a live platform",
    ev("JSON.stringify({y: bowl && bowl.y, platLive: !!(bowl && plats.includes(bowl.plat))})"));
  // and an egg orphaned the same way lands too
  ev(`(function(){ egg = { x: 600, y: 300, plat: { x: 500, y: 300, w: 300 }, t0: 0, wob: 0 }; })();`);
  (listeners["tauri:platforms"] || []).forEach((cb) => cb({ payload: [] }));
  check(ev("egg && egg.y >= winH - 1"), "egg on a closed window lands instead of hovering",
    ev("JSON.stringify({y: egg && egg.y})"));

  // --- T14: pet on a closed window takes the startled drop, props too ---
  ev(`(function(){ state = 'idle'; awakeAt = Date.now(); petHome = false; held = false; flying = false; climbing = false; petY = 400; petX = 500; })();`);
  (listeners["tauri:platforms"] || []).forEach((cb) => cb({ payload: [] }));
  check(ev("flying === true"), "pet drops when its window closes", "flying=" + ev("flying"));
  for (let i = 0; i < 240; i++) { t += 16.7; frame(t); }
  check(ev("!flying && Math.abs(petY - platUnder(petX, petY).y) < 60"),
    "pet lands on a live platform after the drop",
    ev("JSON.stringify({y: petY, fly: flying})"));

  // --- T15: redeem only credits authenticated, finite pack amounts ---
  // A broken/old server response must fall back to local verification for
  // signed codes, while malformed branded strings are rejected immediately.
  const signed = "JELLYPAL-C-ABCDEFGH-" + "A".repeat(103);
  invokeMocks.redeem_bound = null;
  invokeMocks.verify_gem_code = (args) => Promise.resolve(args.code === signed ? 1000 : null);
  ev("jelly=0; redeemed=[]; redeemedBound=[]");
  const paid = await ev(`tryRedeem(${JSON.stringify(signed)})`);
  check(paid === "+1000 JELLY!" && ev("jelly") === 1000,
    "bad server payload falls back to signed-code verifier", `msg=${paid} jelly=${ev("jelly")}`);
  const reused = await ev(`tryRedeem(${JSON.stringify(signed)})`);
  check(reused === "CODE USED" && ev("jelly") === 1000,
    "signed code still credits only once", `msg=${reused}`);
  const malformed = await ev(`tryRedeem("JELLYPAL-A-SHORT")`);
  check(malformed === "BAD CODE" && ev("jelly") === 1000,
    "malformed branded code is rejected before store lookup", `msg=${malformed}`);
  invokeMocks.redeem_bound = 999999;
  const bogusStore = await ev(`tryRedeem("store-license-key")`);
  check(bogusStore === "SERVER BUSY — TRY AGAIN" && ev("jelly") === 1000,
    "unexpected store grant amount never credits", `msg=${bogusStore}`);

  // Two submits can overlap before the first verifier resolves. The second
  // must see the in-flight code and refuse instead of paying the same signed
  // grant twice through the offline fallback.
  const concurrentSigned = "JELLYPAL-B-BCDEFGH2-" + "B".repeat(103);
  let resolveConcurrent = null, concurrentVerifyCalls = 0;
  invokeMocks.redeem_bound = null;
  invokeMocks.verify_gem_code = () => {
    concurrentVerifyCalls++;
    return new Promise((resolve) => { resolveConcurrent = resolve; });
  };
  ev("jelly=0; redeemed=[]; redeemedBound=[]");
  const firstConcurrent = ev(`tryRedeem(${JSON.stringify(concurrentSigned)})`);
  await new Promise((r) => setImmediate(r));
  const secondConcurrent = await ev(`tryRedeem(${JSON.stringify(concurrentSigned)})`);
  resolveConcurrent(500);
  const firstConcurrentResult = await firstConcurrent;
  check(firstConcurrentResult === "+500 JELLY!" && secondConcurrent === "CODE USED"
      && concurrentVerifyCalls === 1 && ev("jelly") === 500
      && ev("redeemed.length") === 1 && ev("redeemPending.size") === 0,
    "concurrent signed-code submits credit exactly once",
    ev("JSON.stringify({jelly,redeemed,pending:redeemPending.size})"));

  // Pending grants are already signature-checked by Rust, but a duplicate
  // nonce in one response must not pay twice and malformed wire values must
  // never reach the wallet or acknowledgement list.
  ev("jelly=0; redeemed=[]; redeemedBound=[]; claimedNonces=[]; bangs.length=0");
  invokeMocks.claim_grants = JSON.stringify([
    { nonce: "ABCDEFGH", gems: 250 },
    { nonce: "ABCDEFGH", gems: 250 },
    { nonce: "BCDEFGH2", gems: 500 },
    { nonce: "BAD", gems: 1000 },
    { nonce: "CDEFGH23", gems: 999999 },
    { nonce: "DEFGH234", gems: "2500" },
  ]);
  invokeMocks.ack_grants = null;
  await ev("claimGrants()");
  check(ev("jelly") === 750 && ev("claimedNonces.length") === 2,
    "pending grant batch credits each valid nonce exactly once",
    ev("JSON.stringify({jelly,claimedNonces})"));
  check(JSON.stringify(invokeCalls.ack_grants && invokeCalls.ack_grants.nonces) === JSON.stringify(["ABCDEFGH", "BCDEFGH2"]),
    "pending grant ack contains only accepted nonces",
    JSON.stringify(invokeCalls.ack_grants));
  invokeMocks.claim_grants = JSON.stringify([{ nonce: "ABCDEFGH", gems: 250 }]);
  delete invokeCalls.ack_grants;
  await ev("claimGrants()");
  check(ev("jelly") === 750 && JSON.stringify(invokeCalls.ack_grants && invokeCalls.ack_grants.nonces) === JSON.stringify(["ABCDEFGH"]),
    "resent claimed grant is re-acked without a second credit",
    ev("JSON.stringify({jelly,claimedNonces})"));
  delete invokeMocks.redeem_bound;
  delete invokeMocks.verify_gem_code;
  delete invokeMocks.claim_grants;
  delete invokeMocks.ack_grants;

  // --- T16: entering a hidey-box cancels any overlapping scripted act ---
  ev(`(function(){ petHome=false; held=false; flying=false; state='idle';
      box={x:700,y:winH,plat:plats[0]}; petX=690; petY=winH;
      accAct={id:'stache',t0:${t - 500},step:0}; propSpin=1;
      sigT0=${t - 400}; sigId='smokebomb'; spinT0=${t}; huntT0=${t}; huntPounce=true;
      climbing=true; climbPhase=1; webbing=true; webHeld=true;
      propArrive({kind:'box'},${t}); })();`);
  const hiddenAt = ev("petX");
  ev("sendClickable()");
  const hiddenMainRects = (invokeCalls.set_clickable && invokeCalls.set_clickable.rects || []).length;
  ev("(function(){const bh=boxHide;boxHide=0;sendClickable();boxHide=bh})()");
  const visibleMainRects = (invokeCalls.set_clickable && invokeCalls.set_clickable.rects || []).length;
  check(hiddenMainRects === visibleMainRects - 1,
    "hidden main pet drops its backend click hitbox",
    `visible=${visibleMainRects} hidden=${hiddenMainRects}`);
  check(ev("hitTest(box.x, box.y - 18)") === false,
    "hidden main pet cannot steal its box click");
  check(ev(`cardStatus("pet",${t})`) === "HIDING",
    "status card reports hidden main pet as HIDING");
  ev("copyCd=0; bangs.length=0; flying=false; copyPeek(true)");
  check(ev("!flying && bangs.length===0"),
    "clipboard event cannot launch or reveal a hidden main pet");
  ev(`(function(){ globalThis.__hideActive=active; active=SPECIES.findIndex(s=>s.id==='ember');
      const keep=box; globalThis.__hideBox=keep; box=null; fx.length=0; bangs.length=0;
      globalThis.__hidePalTimes=pals.map(p=>p.hideUntil); pals.forEach(p=>p.hideUntil=1e15);
      nextTraitFx=0; globalThis.__realRandom=Math.random; Math.random=()=>0; })()`);
  frame(t += 16.7);
  ev("Math.random=globalThis.__realRandom; delete globalThis.__realRandom");
  check(ev("fx.length===0 && bangs.length===0"),
    "hidden main pet emits no ambient trait or legendary particles",
    ev("JSON.stringify({fx:fx.length,bangs:bangs.map(b=>b.t)})"));
  ev("active=globalThis.__hideActive; box=globalThis.__hideBox; pals.forEach((p,i)=>p.hideUntil=globalThis.__hidePalTimes[i]); delete globalThis.__hideActive; delete globalThis.__hideBox; delete globalThis.__hidePalTimes");
  ev("xp=JELLY_EVERY-1; jelly=0; fx.length=0; bangs.length=0; crumbs.length=0; gainXp(1, petX + 20, petY - 96)");
  check(ev("jelly===1 && fx.length===0 && bangs.length===0 && crumbs.length===0"),
    "hidden feed reward stays functional without ghost effects");
  for (let i = 0; i < 60; i++) { t += 16.7; frame(t); }
  check(ev("accAct===null && sigT0===0 && spinT0===0 && huntT0===0 && !huntPounce && !climbing && !webbing"),
    "box hide cancels overlapping scripted movement");
  check(Math.abs(ev("petX") - hiddenAt) < 0.01 && ev("boxHide") > t,
    "main pet stays anchored while hidden", `dx=${Math.abs(ev("petX") - hiddenAt).toFixed(2)}`);

  // Occupants must follow both axes while the box is dragged. A vertical
  // mismatch used to make them reappear in mid-air at the old shelf height.
  ev(`(function(){ const p=pals[0]; globalThis.__oldBoxEquip=accEquip[SPECIES[p.sp].id];
      accEquip[SPECIES[p.sp].id]='cap'; box.x=930; box.y=520;
      p.x=300; p.y=winH; p.hideUntil=${t + 5000}; p.accCd=0;
      p.web=${t + 5000}; p.fly=true; p.vx=80; p.vy=-100; p.accAct=null; })()`);
  ev("globalThis.__realRandom=Math.random; Math.random=()=>0");
  frame(t += 16.7);
  ev("Math.random=globalThis.__realRandom; delete globalThis.__realRandom");
  check(ev("petX===box.x && petY===box.y && !flying"),
    "hidden main pet follows a vertically dragged box");
  check(ev("pals[0].x===box.x && pals[0].y===box.y && !pals[0].fly && !pals[0].web && !pals[0].accAct"),
    "hidden pal follows dragged box without restarting an act");
  check(ev(`cardStatus(pals[0],${t})`) === "HIDING",
    "status card reports box-dwelling pal as HIDING");
  (listeners["tauri:platforms"] || []).forEach((cb) => cb({ payload: [] }));
  frame(t += 16.7);
  check(ev("box.y===winH && petY===box.y && pals[0].y===box.y && !flying"),
    "closed-window box and hidden occupants re-seat together");
  ev(`(function(){ const p=pals[0], sid=SPECIES[p.sp].id;
      if(globalThis.__oldBoxEquip===undefined) delete accEquip[sid]; else accEquip[sid]=globalThis.__oldBoxEquip;
      delete globalThis.__oldBoxEquip; p.hideUntil=0; })()`);
  ev("boxHide=0; box=null; cushionNap=" + (t + 1000));
  check(ev(`cardStatus("pet",${t})`) === "NAPPING",
    "status card reports a cushion-napping main pet as NAPPING");
  ev("cushionNap=0");

  // --- T17: expanded settings fit without wasting a scroll on large screens ---
  ev("winH=1080; setScroll=999");
  check(ev("setMaxScroll()") === 0, "all settings rows fit at 1080p");
  ev("winH=460; settingsRows()");
  check(ev("setMaxScroll()") > 0 && ev("setScroll") === ev("setMaxScroll()"),
    "short-screen settings remain scrollable and clamped");
  ev("winH=1080; setScroll=0");

  // --- T18: fetch errand — a bonded pal forages and delivers jelly ---
  ev(`(function(){
      pals.length = 0;
      jelly = 1000; dirty = false;
      owned.push(SPECIES[1].id); spawnPal(1);   // berry — no trait needed here
      bond[SPECIES[1].id] = 400;                // BESTIE
      state = 'idle'; petHome = false;
      petX = 900; petY = plats[0].y; walkTarget = null;
      const p = pals[0];
      p.x = 700; p.y = petY; p.fly = false; p.plat = plats[0];
      p.walkT = null; p.nextT = 0; p.chatMate = null; p.chatUntil = 0;
      p.follow = null; p.tag = null; p.stackOn = null;
      p.restUntil = 0; p.hideUntil = 0; p.carry = null; p.propGoal = null;
      p.giftCd = 0; p.comfortCd = 0;
    })();`);
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0.03;");
  frame(t += 16.7);
  check(ev("pals[0].propGoal && pals[0].propGoal.kind === 'find'"),
    "bonded pal starts a fetch errand",
    ev("pals[0].propGoal && pals[0].propGoal.kind"));
  check(ev(`cardStatus(pals[0],${t})`) === "FORAGING",
    "status card reports a foraging pal as FORAGING");
  // let it walk to the lure, pick up, and deliver — pin the pet in place
  let delivered = false;
  for (let i = 0; i < 2400 && !delivered; i++) {
    ev("petX = 900; petY = plats[0].y; walkTarget = null;");
    t += 16.7; frame(t);
    if (i % 40 === 0) await new Promise((r) => setImmediate(r));
    if (ev("jelly") === 1002) delivered = true;
  }
  check(delivered, "fetch delivers +2 jelly to the pet",
    ev(`JSON.stringify({jelly, carry:!!pals[0].carry, pg:pals[0].propGoal && pals[0].propGoal.kind, x:Math.round(pals[0].x)})`));
  check(ev("pals[0].carry === null && pals[0].giftCd > " + t),
    "delivered loot clears carry and starts the cooldown");
  // unbonded pal must not fetch at all
  ev(`(function(){ const p = pals[0];
      bond = {}; p.carry = null; p.propGoal = null; p.walkT = null; p.nextT = 0; p.fly = false; })();`);
  frame(t += 16.7);
  check(ev("!(pals[0].propGoal && pals[0].propGoal.kind === 'find')"),
    "unbonded pal never forages",
    ev("pals[0].propGoal && pals[0].propGoal.kind"));
  ev("bond = {}; bond[SPECIES[1].id] = 400;");

  // --- T19: comfort — bonded pal rushes to a gloomy pet ---
  ev(`(function(){ const p = pals[0];
      p.carry = null; p.propGoal = null; p.walkT = null; p.nextT = 0;
      p.x = petX + 120; p.y = petY; p.fly = false; p.faceT = 0; p.faceId = null;
      dizzyUntil = ${t + 4000}; })();`);
  frame(t += 16.7);
  check(ev("pals[0].faceId === 'love'"),
    "bonded pal rushes to comfort a dizzy pet", ev("pals[0].faceId"));
  check(ev("dizzyUntil") < t + 4000,
    "comfort shortens the daze", ev("Math.round(dizzyUntil - " + t + ")"));
  ev("dizzyUntil = 0;");

  // --- T20: trait chores — a drip pal waters the plant, not just sniffs ---
  // (the pet is pinned far away — its own plant errand would overwrite
  // steamUntil with the plain sniff value and make this look like a fail)
  ev(`(function(){
      owned.push(SPECIES[3].id); spawnPal(3);   // tide — the drip-trait pal
      const p = pals[pals.length - 1];
      const q = pals[0];                        // berry stays out of it
      q.x = 400; q.y = petY; q.nextT = 1e15; q.propGoal = null; q.walkT = null;
      plant = { x: 1500, y: petY, plat: plats[0] };
      p.x = plant.x - 14; p.y = petY; p.fly = false; p.faceT = 0; p.faceId = null;
      p.carry = null; p.propGoal = { kind: 'plant' };
      p.walkT = plant.x - 14; p.plantCd = 0; p.nextT = 1e15;
      p.hideUntil = 0; p.restUntil = 0;
      plant.steamUntil = 0; })();`);
  ev("Math.random = () => 0.9;"); // no sneeze — land the nuzzle path
  for (let i = 0; i < 240 && !ev("plant.steamUntil > 0"); i++) {
    ev("petX = 900; petY = plats[0].y; walkTarget = null;");
    t += 16.7; frame(t);
  }
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom");
  check(ev("plant && plant.steamUntil > Date.now() + 5000"),
    "drip-trait pal waters the plant (9s perk vs 4s sniff)",
    ev("plant && Math.round(plant.steamUntil - Date.now())"));
  ev("plant = null;");

  // --- T21: quiet budget — an editor-focused user silences the loud tier ---
  // palQuiet = editor focus (or cursor moved <15s ago). hops, tag, flairs,
  // totems, cursor webs all hold; walking/prop visits still run.
  ev(`(function(){
      pals.length = 0; palHeld = null;
      owned.push(SPECIES[1].id); spawnPal(1);   // berry — plain walker
      owned.push(SPECIES[3].id); spawnPal(3);   // tide — sig 'shower'
      focusTitle = 'main.ts'; focusExe = 'code';
      state = 'idle'; petHome = false; dizzyUntil = 0; cryUntil = 0; poutUntil = 0;
      petX = 1400; petY = plats[0].y;
      bond = {}; treat = null; treatFly = null; sigT0 = 0; pullAnim = null; pullResults = null;
      huntT0 = 0; huntCd = 1e15; // the pounce pack-hop is user-triggered —
      // deliberately ungated, so keep the pet from pouncing mid-test
      pals.forEach((p, i) => {
        p.x = 500 + i * 110; p.y = petY; p.fly = false; p.plat = null; p.walkT = null;
        p.propGoal = null; p.nextT = 0; p.tag = null; p.stackOn = null; p.stackCd = 0;
        p.sigT = 0; p.carry = null; p.restUntil = 0; p.hideUntil = 0; p.chatMate = null;
        p.chatUntil = 0; p.follow = null; p.vx = 0; p.vy = 0; p.hopWind = 0;
        p.playCd = 0; p.giftCd = 1e15; p.comfortCd = 1e15; p.web = 0;
        p.settleUntil = 0; p.sitMate = null; p.settleCd = 0; p.blockCd = 0;
        p.accAct = null; // queued accessory bits (wings/bow/prop) launch pals
      });
      mainPlayCd = 1e15; })();`);
  for (let i = 0; i < 80; i++) { t += 16.7; frame(t); } // land + settle in
  let loud = 0, ambient = 0;
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0.55;");
  for (let i = 0; i < 900; i++) {
    // force a decision roll every frame — we're testing the gate, not odds
    ev(`pals.forEach((p) => { if (!p.fly && p.walkT === null && !p.propGoal) p.nextT = 0; });`);
    t += 16.7; frame(t);
    if (i % 30 === 0) await new Promise((r) => setImmediate(r));
    loud += ev(`pals.filter((p) => p.fly || p.tag || p.sigT || p.stackOn || p.web > ${t}).length`);
    ambient += ev("pals.filter((p) => p.walkT !== null || p.propGoal || p.settleUntil > " + t + ").length");
  }
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(loud === 0, "editor focus silences hops/tag/flair/totem/web", "loud~" + loud);
  check(ambient > 0, "quiet pals still wander and prop-visit (not frozen)", "ambient~" + ambient);
  // and the proof the gate actually opens: same roll, hands-off user — hop fires
  ev(`focusTitle = ''; focusExe = ''; lastCurMove = 0;
      pals.forEach((p) => { p.fly = false; p.walkT = null; p.propGoal = null; p.nextT = 0;
        p.settleUntil = 0; p.tag = null; p.stackOn = null; p.vx = 0; p.vy = 0; });`);
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0.55;");
  let hopped = false;
  for (let i = 0; i < 300 && !hopped; i++) {
    ev(`pals.forEach((p) => { if (!p.fly && p.walkT === null && !p.propGoal) p.nextT = 0; });`);
    t += 16.7; frame(t);
    if (ev("pals.some((p) => p.fly)")) hopped = true;
  }
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(hopped, "idle hands restore the loud tier (hop fires again)");

  // --- T22: settle — a pal walks up beside the pet and just stays ---
  ev(`(function(){
      petX = 900; petY = plats[0].y; petHome = false; state = 'idle';
      walkTarget = null; hopTarget = null; nextWander = 1e15; flying = false;
      huntT0 = 0; huntCd = 1e15; sigT0 = 0; // pet pinned — a wander would
      // break the settle mid-test, a pounce-pack or landing shove launches pals
      const p = pals[0], q = pals[1];
      p.x = petX + 200; p.y = petY; p.fly = false; p.walkT = null; p.propGoal = null;
      p.nextT = 0; p.settleUntil = 0; p.sitMate = null; p.settleCd = 0; p.playCd = 1e15;
      q.x = 200; q.y = petY; q.nextT = 1e15; q.walkT = null; q.propGoal = null;
      q.settleUntil = 0; q.sitMate = null; })();`);
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0.24;");
  t += 16.7; frame(t);
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(ev("pals[0].propGoal && pals[0].propGoal.kind === 'settle'"),
    "settle roll starts a walk toward the pet",
    ev("pals[0].propGoal && pals[0].propGoal.kind"));
  let settled = false;
  for (let i = 0; i < 1200 && !settled; i++) {
    ev("walkTarget = null; flying = false; sigT0 = 0;"); // pet stays put
    t += 16.7; frame(t);
    if (i % 30 === 0) await new Promise((r) => setImmediate(r));
    if (ev("pals[0].settleUntil > " + t)) settled = true;
  }
  check(settled, "pal parks beside the pet once it arrives",
    ev("pals[0] && Math.round((pals[0].settleUntil||0) - " + t + ")"));
  check(ev(`cardStatus(pals[0],${t})`) === "CHILLING",
    "status card reports a settled pal as CHILLING");
  // parked means parked: forcing a decision while settled must not move it
  ev("pals[0].nextT = 0; pals[0].walkT = null;");
  for (let i = 0; i < 60; i++) {
    ev("walkTarget = null; flying = false; sigT0 = 0;");
    t += 16.7; frame(t);
  }
  check(ev("pals[0].walkT === null && !pals[0].propGoal && pals[0].settleUntil > " + t),
    "a settled pal ignores decision rolls (stays put)");
  // but it breaks the moment the pet wanders off
  ev("petX = petX + 400;");
  t += 16.7; frame(t);
  check(ev("pals[0].settleUntil === 0 || pals[0].settleUntil < " + t),
    "settle breaks when the pet walks away", ev("pals[0].settleUntil - " + t));

  // --- T23: side-by-side — two idle pals sit together and share a beat ---
  ev(`(function(){
      walkTarget = null; hopTarget = null; flying = false; sigT0 = 0;
      huntT0 = 0; huntCd = 1e15;
      const p = pals[0], q = pals[1];
      p.x = 700; p.y = petY; p.fly = false; p.walkT = null; p.propGoal = null;
      p.nextT = 0; p.settleUntil = 0; p.sitMate = null; p.settleCd = 0;
      p.chatMate = null; p.chatUntil = 0; p.tag = null; p.stackOn = null; p.carry = null;
      q.x = 770; q.y = petY; q.fly = false; q.walkT = null; q.propGoal = null;
      q.nextT = 1e15; q.settleUntil = 0; q.sitMate = null; q.settleCd = 0;
      q.chatMate = null; q.chatUntil = 0; q.tag = null; q.stackOn = null;
      petX = 1400; })();`); // pet out of settle range — the buddy wins
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0.30;");
  t += 16.7; frame(t);
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(ev("pals[0].settleUntil > " + t + " && pals[0].sitMate === pals[1] && pals[1].settleUntil > " + t),
    "side-by-side: both pals sit down together",
    ev("JSON.stringify({a:(pals[0].settleUntil||0)-" + t + ",b:(pals[1].settleUntil||0)-" + t + ",m:pals[0].sitMate===pals[1]})"));
  check(ev(`cardStatus(pals[0],${t})`) === "PAL TIME",
    "status card reports a sitting pair as PAL TIME");
  ev(`pals.forEach((p) => { p.settleUntil = 0; p.sitMate = null; });`);

  // --- T24: head-tilt — a parked cursor earns one curious glance ---
  ev(`(function(){
      const p = pals[0];
      p.x = 700; p.y = petY; p.fly = false; p.walkT = null; p.propGoal = null;
      p.nextT = 1e15; p.hovT = 0; p.hovCd = 0; p.lookUntil = 0;
      curX = p.x + 50; curY = p.y - 40; })();`);
  for (let i = 0; i < 45; i++) { t += 16.7; frame(t); } // ~0.75s parked
  check(ev("pals[0].hovCd > " + t + " && pals[0].lookUntil > " + t + " && pals[0].lookDir === 1"),
    "cursor parked beside a pal earns a head-tilt glance",
    ev("JSON.stringify({cd:(pals[0].hovCd||0)-" + t + ",lu:(pals[0].lookUntil||0)-" + t + ",d:pals[0].lookDir})"));
  // it doesn't loop — the same parked cursor gets nothing more
  ev("pals[0].lookUntil = 0; pals[0].hovT = 0;");
  for (let i = 0; i < 40; i++) { t += 16.7; frame(t); }
  check(ev("pals[0].hovT <= 0.1 || pals[0].lookUntil < " + t),
    "head-tilt doesn't repeat while the cursor just sits there");
  ev("curX = -9999; curY = -9999;");

  // --- T25: audience — a reveal draws a quiet stare, ends with one note ---
  ev(`(function(){
      // pin the pet fully — a stale mid-air petY made the pal spawn over
      // empty air once and take the real-drop launch instead of watching
      petX = 700; petY = plats[0].y; flying = false; petVY = 0;
      walkTarget = null; hopTarget = null; sigT0 = 0;
      const p = pals[0], q = pals[1];
      p.x = petX - 140; p.y = petY; p.fly = false; p.walkT = petX - 300; p.propGoal = null;
      p.nextT = 1e15; p.tag = null; p.chatMate = null; p.carry = null; p.lookUntil = 0;
      p.vx = 0; p.vy = 0; p.hopWind = 0; p.accAct = null; p.plat = plats[0];
      q.x = 200; q.y = petY; q.walkT = null; q.nextT = 1e15; q.accAct = null;
      huntT0 = 0; huntCd = 1e15; // a parked cursor may have primed a stalk —
      // the pounce pack-hop would launch the pal mid-test
      pullResults = [{ r: 'c' }]; })();`);
  t += 16.7; frame(t);
  check(ev("pals[0].watched === true && pals[0].walkT === null && pals[0].lookDir === 1"),
    "a pet's reveal pulls a quiet stare (walk cancelled, eyes on pet)",
    ev("JSON.stringify({w:pals[0].watched,wt:pals[0].walkT,ld:pals[0].lookDir,pr:!!pullResults,f:pals[0].fly,ph:petHome,dx:Math.abs(petX-pals[0].x),dy:Math.abs(petY-pals[0].y),rst:pals[0].restUntil>"+t+",hid:pals[0].hideUntil>"+t+",tg:!!pals[0].tag,cm:!!pals[0].chatMate,x:Math.round(pals[0].x),px:Math.round(petX),sym:pals[0].sympCd>"+t+",bmp:pals[0].bumpCd>"+t+",hop:pals[0].hopT>="+t+",acc:!!pals[0].accAct,mat:pals[0].matCd>"+t+",blk:pals[0].blockCd>"+t+",sig:pals[0].sigT>"+t+",comf:pals[0].comfortCd>"+t+",vy:Math.round(pals[0].vy)})"));
  ev("pullResults = null; bangs.length = 0;");
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0.1;");
  t += 16.7; frame(t);
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(ev("pals[0].watched === false && bangs.some((b) => b.t === '♪' && b.x === pals[0].x)"),
    "show ends with a single soft note from the watcher");

  // --- T26: copycat — a nearby pal mirrors the pet's bright face ---
  ev(`(function(){
      const p = pals[0], q = pals[1];
      p.x = petX - 120; p.y = petY; p.fly = false; p.walkT = null; p.propGoal = null;
      p.faceT = 0; p.faceId = null; p.copyCd = 0; p.restUntil = 0; p.hideUntil = 0;
      q.copyCd = ${t + 1e15}; // pin the other pal out of the mirror test
      contentUntil = ${t + 4000}; })();`);
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0;");
  t += 16.7; frame(t);
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  check(ev("pals[0].faceId === 'content' && pals[0].copyCd > " + t),
    "copycat: nearby pal quietly mirrors the pet's content face",
    ev("JSON.stringify({f:pals[0].faceId,cd:(pals[0].copyCd||0)-" + t + "})"));
  // the mirror respects the cooldown — forcing the roll again must not
  // refresh copyCd (it decays toward t instead of jumping back out)
  const copyCd1 = ev("pals[0].copyCd - " + t);
  ev("globalThis.__realRandom = Math.random; Math.random = () => 0;");
  for (let i = 0; i < 60; i++) { t += 16.7; frame(t); }
  ev("Math.random = globalThis.__realRandom; delete globalThis.__realRandom;");
  const copyCd2 = ev("pals[0].copyCd - " + t);
  check(copyCd2 < copyCd1 - 500,
    "copycat respects its cooldown (no chain-mirroring)",
    "cd " + Math.round(copyCd1) + " -> " + Math.round(copyCd2));

  console.log(`\n${pass} pass ${fail} fail`);
  process.exit(fail ? 2 : 0);
})();

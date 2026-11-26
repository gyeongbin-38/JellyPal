// frame() crash harness — stubs enough DOM to eval main.js, then pumps
// requestAnimationFrame frames and reports the first exception with stack.
const fs = require("fs");

const calls = [];
const clickableBatches = [];
let canvasSaveMode = "resolve";
let pngSerializeMode = "resolve";
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
      // any other property: a no-op function (fillRect, save, drawImage...)
      const f = (...a) => {};
      t[prop] = f;
      return f;
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
function fakeCanvas() {
  const c = {
    width: 800, height: 600, style: {},
    listeners: {},
    addEventListener(ev, fn) { (c.listeners[ev] = c.listeners[ev] || []).push(fn); },
    removeEventListener() {},
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: c.width, height: c.height }; },
  };
  c.getContext = () => (c._ctx = c._ctx || fakeCtx(c));
  c.toDataURL = () => {
    if (pngSerializeMode === "throw") throw new Error("simulated PNG serialization failure");
    if (pngSerializeMode === "invalid") return "data:text/plain;base64,AAAA";
    return "data:image/png;base64,AAAA";
  };
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

let rafSeq = 0;
const rafPending = new Map();
const pendingTimers = [];
const listeners = {};

global.window = global;
global.innerWidth = 1920;
global.innerHeight = 1080;
global.devicePixelRatio = 1;
global.addEventListener = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
global.removeEventListener = () => {};
global.requestAnimationFrame = (cb) => { const id = ++rafSeq; rafPending.set(id, cb); return id; };
global.cancelAnimationFrame = (id) => { rafPending.delete(id); };
global.performance = require("perf_hooks").performance;
global.document = {
  getElementById: getEl,
  createElement: (tag) => (tag === "canvas" ? fakeCanvas() : getEl("_" + tag)),
  createElementNS: (ns, tag) => getEl("_" + tag),
  body: getEl("body"),
  documentElement: getEl("html"),
  addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  removeEventListener() {},
  fonts: { load: () => Promise.resolve() },
  hidden: false,
};
global.navigator = { userAgent: "sim" };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };

// Tauri API
const tauriState = {
  ver: 2, jelly: 5000, active: "sprout",
  owned: ["sprout", "berry", "pebble", "tide", "ember", "shade"],
  pals: ["tide", "ember"], // two summoned companions
}; // emulate a dev save
global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      calls.push(cmd);
      if (cmd === "set_clickable") clickableBatches.push(args && args.rects);
      if (cmd === "load_state") return Promise.resolve(JSON.stringify(tauriState));
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      if (cmd === "is_demo") return Promise.resolve(false);
      if (cmd === "save_png") {
        if (canvasSaveMode === "throw") throw new Error("simulated synchronous PNG IPC failure");
        if (canvasSaveMode === "reject") return Promise.reject(new Error("simulated asynchronous PNG IPC failure"));
      }
      return Promise.resolve(null);
    },
  },
  event: { listen: () => Promise.resolve(() => {}) },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

// eval main.js in this context
const src = fs.readFileSync("src/main.js", "utf8");
try {
  (0, eval)(src + "\n;globalThis.__SIM_E = (code) => eval(code);");
} catch (e) {
  console.log("TOPLEVEL THROW:", e.stack);
  process.exit(1);
}

async function pumpFrames(count, startT) {
  let t = startT;
  for (let i = 0; i < count; i++) {
    if (!rafPending.size) throw new Error(`frame ${i}: no rAF queued — loop dead?`);
    if (rafPending.size !== 1) throw new Error(`frame ${i}: ${rafPending.size} rAF callbacks queued — parallel frame loops`);
    const cbs = [...rafPending.values()];
    rafPending.clear();
    t += 16.7;
    try {
      for (const cb of cbs) cb(t);
    } catch (e) {
      e.simFrame = i;
      throw e;
    }
    if (i % 50 === 0) await new Promise((r) => setImmediate(r));
  }
  return t;
}

(async () => {
  await new Promise((r) => setImmediate(r));
  let t = 0;
  try {
    t = await pumpFrames(600, t);
  } catch (e) {
    console.log("\n=== FRAME", e.simFrame ?? "?", "THREW ===");
    console.log(e.stack.split("\n").slice(0, 6).join("\n"));
    process.exit(2);
  }
  console.log("600 frames clean");

  // stalled-frame recovery regression: the occlusion watchdog can invoke
  // frame() while a native rAF is still pending. Recovery must cancel that
  // pending callback; the old path queued a second loop and doubled every
  // subsequent frame's update/render cost.
  t += 450;
  __SIM_E(`frame(${t})`);
  if (rafPending.size !== 1) throw new Error(`watchdog recovery left ${rafPending.size} rAF callbacks queued`);
  t = await pumpFrames(30, t);
  console.log("watchdog recovery keeps one frame loop");

  const badClickable = clickableBatches.some((rects) =>
    !Array.isArray(rects)
      || rects.length > 64
      || rects.some((r) => !Array.isArray(r)
        || r.length !== 4
        || r.some((n) => !Number.isFinite(n) || Math.abs(n) > 1_000_000)
        || r[2] <= 0
        || r[3] <= 0));
  if (!clickableBatches.length || badClickable) {
    console.log("clickable geometry contract FAILED");
    process.exit(2);
  }
  console.log(`clickable geometry clean (${Math.max(...clickableBatches.map((r) => r.length))} max rects)`);
  // Exercise every canvas-save boundary outside frame(): normal output plus
  // serialization, synchronous bridge, and asynchronous bridge failures.
  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  try {
    const normal = await Promise.all([eval("shareCard()"), eval("dailySelfie()")]);
    if (normal.some((ok) => ok !== true)) throw new Error("normal canvas save did not succeed");
    if (!__SIM_E("lastSelfie === localIsoDayKey()")) throw new Error("daily selfie persisted a non-local day key");

    pngSerializeMode = "throw";
    const serialize = await Promise.all([eval("shareCard()"), eval("dailySelfie()")]);
    if (serialize.some((ok) => ok !== false)) throw new Error("serialization failure escaped policy");

    pngSerializeMode = "invalid";
    const invalidData = await Promise.all([eval("shareCard()"), eval("dailySelfie()")]);
    if (invalidData.some((ok) => ok !== false)) throw new Error("invalid PNG data escaped policy");
    pngSerializeMode = "resolve";

    canvasSaveMode = "throw";
    const syncIpc = await Promise.all([eval("shareCard()"), eval("dailySelfie()")]);
    if (syncIpc.some((ok) => ok !== false)) throw new Error("sync IPC failure escaped policy");

    canvasSaveMode = "reject";
    const asyncIpc = await Promise.all([eval("shareCard()"), eval("dailySelfie()")]);
    if (asyncIpc.some((ok) => ok !== false)) throw new Error("async IPC failure escaped policy");
    canvasSaveMode = "resolve";
    await new Promise((r) => setImmediate(r));
    if (unhandled.length) throw new Error(`unhandled canvas rejection: ${unhandled[0]}`);
    console.log("shareCard + dailySelfie clean (success + 4 failure modes)");
  } catch (e) {
    console.log("card fn THREW:", e.stack.split("\n").slice(0, 4).join("\n"));
    process.exit(2);
  } finally {
    process.off("unhandledRejection", onUnhandled);
  }

  // crowded-pal regression: parked companions used to keep clipping through
  // each other because the separation shove explicitly exempted two parked
  // pals. Pin the full trio almost on top of one another; the crowd solver
  // should ease them back to readable slime-width gaps without launching any.
  try {
    const n = __SIM_E(`
      if (pals.length < 3) spawnPal(6);
      pals.forEach((p, ci) => {
        p.x = 960 + (ci - 0.5) * 2;
        p.y = winH;
        p.vx = 0; p.vy = 0; p.fly = false; p.plat = null;
        p.walkT = null; p.walkV = 0; p.walkWhy = null; p.nextT = 1e15;
        p.restUntil = 0; p.hideUntil = 0; p.settleUntil = 1e15;
        p.web = 0; p.stackOn = null; p.follow = null; p.tag = null;
        p.chatMate = null; p.scene = null; p.group = null; p.act = null;
        p.accAct = null; p.propGoal = null; p.hopWind = 0;
        p.socCd = 1e15; p.playCd = 1e15; p.chatCd = 1e15; p.hiCd = 1e15; p.stackCd = 1e15;
      });
      pals.length
    `);
    if (n < 3) throw new Error(`expected three summoned pals, got ${n}`);
    t = await pumpFrames(180, t);
    const gap = __SIM_E(`Math.min(...pals.flatMap((p, pi) => pals.slice(pi + 1).map((q) => Math.abs(q.x - p.x))))`);
    const yGap = __SIM_E(`Math.max(...pals.flatMap((p, pi) => pals.slice(pi + 1).map((q) => Math.abs(q.y - p.y))))`);
    if (!Number.isFinite(gap) || yGap >= 18 || gap < 30) {
      throw new Error(`parked pals stayed clumped: x gap ${gap}, y gap ${yGap}`);
    }
    console.log(`crowded pals separate cleanly (${gap.toFixed(1)}px gap)`);
  } catch (e) {
    console.log("crowded pal regression FAILED:", e.stack.split("\n").slice(0, 4).join("\n"));
    process.exit(2);
  }
  process.exit(0);
})();

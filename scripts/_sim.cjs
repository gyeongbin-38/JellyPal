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

let rafCb = null;
const pendingTimers = [];
const listeners = {};

global.window = global;
global.innerWidth = 1920;
global.innerHeight = 1080;
global.devicePixelRatio = 1;
global.addEventListener = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
global.removeEventListener = () => {};
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
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
  ver: 2, jelly: 5000, active: 0,
  owned: [0, 1, 2, 3, 4, 6, 30],
  pals: [{ sp: 3 }, { sp: 4 }], // two summoned companions
}; // emulate a dev save
global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      calls.push(cmd);
      if (cmd === "set_clickable") clickableBatches.push(args && args.rects);
      if (cmd === "load_state") return Promise.resolve(tauriState);
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

(async () => {
  await new Promise((r) => setImmediate(r));
  let t = 0;
  for (let i = 0; i < 600; i++) {
    if (!rafCb) { console.log("frame", i, ": no rAF queued — loop dead?"); break; }
    const cb = rafCb; rafCb = null;
    t += 16.7;
    try {
      cb(t);
    } catch (e) {
      console.log("\n=== FRAME", i, "THREW ===");
      console.log(e.stack.split("\n").slice(0, 6).join("\n"));
      process.exit(2);
    }
    if (i % 50 === 0) await new Promise((r) => setImmediate(r));
  }
  console.log("600 frames clean");
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
  process.exit(0);
})();

// freeze repro — identical DOM stubs to _verify.cjs, but loads the REAL
// %APPDATA% state (legendary pals, all species, real counters) and pumps
// thousands of frames with a moving cursor + injected ball to hit the
// paths the fixed-state harnesses miss.
const fs = require("fs");

const calls = [];
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
    addEventListener(ev, fn) { (c.listeners[ev] = c.listeners[ev] || []).push(fn); },
    removeEventListener() {},
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
      style: {}, innerHTML: "", textContent: "", children: [], listeners: {},
      addEventListener(ev, fn) { (e.listeners[ev] = e.listeners[ev] || []).push(fn); },
      removeEventListener() {}, appendChild() {}, remove() {},
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

// REAL save — legendary pals, hybrids, equipped accs, hint flags, counters
const realPath = process.env.APPDATA + "\\com.jellypal.app\\state.json";
const tauriState = JSON.parse(fs.readFileSync(realPath, "utf8"));
console.log("real state loaded:", JSON.stringify({ active: tauriState.active, pals: tauriState.pals, petHome: tauriState.petHome, seen: tauriState.seen }));

global.__TAURI__ = {
  core: {
    invoke: (cmd) => {
      calls.push(cmd);
      if (cmd === "load_state") return Promise.resolve(JSON.stringify(tauriState));
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      if (cmd === "is_demo") return Promise.resolve(false);
      return Promise.resolve(null);
    },
  },
  event: { listen: () => Promise.resolve(() => {}) },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8");
try { (0, eval)(src + "\n;globalThis.__E = (c) => eval(c);"); }
catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }

let tNow = 0, frameNo = 0;
async function pump(n) {
  for (let i = 0; i < n; i++) {
    if (!rafCb) { console.log("rAF dead at frame", frameNo); process.exit(3); }
    const cb = rafCb; rafCb = null;
    tNow += 16.7; frameNo++;
    try { cb(tNow); } catch (e) {
      console.log("\n=== FRAME", frameNo, "THREW ===");
      console.log(e.stack.split("\n").slice(0, 8).join("\n"));
      // dump nearby state for context
      try { console.log("ctx:", __E("JSON.stringify({petX,petY,flying,held,rideT0,sigT0,ball:!!ball,palN:pals.length,state,hintText})")); } catch {}
      process.exit(2);
    }
    if (frameNo % 120 === 0) await new Promise((r) => setImmediate(r));
  }
}
const E = (s) => __E(s);

(async () => {
  await new Promise((r) => setImmediate(r));
  await pump(60);
  console.log("boot ok:", E("JSON.stringify({x:petX|0,y:petY|0,pals:pals.length,state})"));

  // deterministic-ish pseudo random so a repro is repeatable
  let seed = 424242;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

  // phase 1: ~2min of normal use — wandering cursor, occasional fast swipes
  for (let i = 0; i < 7200; i++) {
    if (i % 45 === 0) {
      const cx = Math.round(rnd() * 1920), cy = Math.round(400 + rnd() * 680);
      const cv = Math.round(rnd() * rnd() * 2600); // mostly slow, sometimes whip-fast
      E(`curX=${cx};curY=${cy};curV=${cv};lastCurT=${tNow}`);
    }
    if (i === 900) E(`ball={x:petX+60,y:petY-140,vx:40,vy:0,r:9,rot:0}`);   // drop a ball in
    if (i === 2100) E(`ball={x:pals.length?pals[0].x+30:300,y:pals.length?pals[0].y-60:700,vx:-60,vy:0,r:9,rot:0}`);
    if (i === 3300) E(`ball=null`);
    if (i === 4200) E(`ball={x:petX,y:60,vx:0,vy:0,r:9,rot:0}`);
    if (i === 5400) E(`ball=null`);
    await pump(1);
  }
  console.log("7200 frames (~2min) clean with real state");
  process.exit(0);
})();

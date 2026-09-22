// volume slider harness — boots main.js with stubbed DOM, opens the
// settings panel, drags row 0 (the slider), and checks vol lands where
// the cursor put it, mute follows, and the value reaches save_state.
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
const els = {};
const getEl = (id) => {
  if (!els[id]) {
    const e = {
      style: {}, innerHTML: "", textContent: "", children: [], listeners: {},
      addEventListener(ev, fn) { (e.listeners[ev] = e.listeners[ev] || []).push(fn); },
      removeEventListener() {}, appendChild() {}, remove() {},
      setPointerCapture() {}, releasePointerCapture() {},
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

let lastSave = null;
global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      if (cmd === "load_state") return Promise.resolve(JSON.stringify({ ver: 2, jelly: 100, vol: 0.8, muted: false }));
      if (cmd === "save_state") { lastSave = args; return Promise.resolve(null); }
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      return Promise.resolve(null);
    },
  },
  event: { listen: () => Promise.resolve(() => {}) },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8")
  + "\n;globalThis.__G = () => ({ settingsOpen, vol, volDrag, muted, volStep, dirty });"
  + "\n;globalThis.__W = { openSettings: () => { settingsOpen = true; } };";
try { (0, eval)(src); } catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }
const G = () => globalThis.__G();

const cvEv = (type, x, y) => {
  const fns = (els.c && els.c.listeners[type]) || [];
  const ev = { button: 0, clientX: x, clientY: y, pointerId: 1, timeStamp: performance.now(), preventDefault() {} };
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
  check("vol loaded from save (0.8)", Math.abs(G().vol - 0.8) < 0.001);

  globalThis.__W.openSettings();
  pump(2);
  console.log("settingsOpen:", G().settingsOpen);
  console.log("rect:", eval("JSON.stringify(settingsRect())"), "rows0:", eval("JSON.stringify(settingsRows()[0])"));
  // settingsRect(): px=865, py=328 -> row0 = [881, 358, 158, 20]
  // track: x0 = 881+8 = 889, w = 142
  const trackX0 = 889, trackW = 142, rowY = 358 + 10;

  // press at track midpoint
  cvEv("pointerdown", trackX0 + trackW / 2, rowY);
  check("volDrag grabbed", G().volDrag !== null);
  check("vol ~= 0.5 after mid press", Math.abs(G().vol - 0.5) < 0.04);

  // drag to left edge -> mute
  cvEv("pointermove", trackX0, rowY);
  check("vol = 0 at left edge", G().vol === 0);
  check("muted follows 0", G().muted === true);

  // drag to right edge -> full
  cvEv("pointermove", trackX0 + trackW, rowY);
  check("vol = 1 at right edge", G().vol === 1);
  check("unmuted", G().muted === false);

  // release
  cvEv("pointerup", trackX0 + trackW, rowY);
  check("volDrag cleared", G().volDrag === null);

  // a plain click at ~25% position
  cvEv("pointerdown", trackX0 + trackW * 0.25, rowY);
  cvEv("pointerup", trackX0 + trackW * 0.25, rowY);
  check("vol ~= 0.25 after tap", Math.abs(G().vol - 0.25) < 0.04);

  // persistence: dirty set -> persist -> save_state carries vol
  check("dirty flagged", G().dirty === true);
  eval("persist()");
  await new Promise((r) => setImmediate(r));
  const saved = lastSave ? JSON.parse(lastSave.json) : {};
  check("vol persisted in save_state", typeof saved.vol === "number" && Math.abs(saved.vol - G().vol) < 0.001);
  check("volStep shim coherent", typeof saved.volStep === "number");

  // pointercancel safety: grab then cancel
  cvEv("pointerdown", trackX0 + 20, rowY);
  cvEv("pointercancel", trackX0 + 20, rowY);
  check("volDrag cleared on cancel", G().volDrag === null);

  console.log(fails === 0 ? "ALL GREEN" : `${fails} FAILURES`);
  process.exit(fails ? 1 : 0);
})();

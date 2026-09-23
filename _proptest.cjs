// prop put-away harness — boots main.js with stubbed DOM, spawns a bowl,
// drags it into the top-center PUT AWAY slot, checks it's removed; then
// verifies a normal drag just moves it.
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

global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      if (cmd === "load_state") return Promise.resolve(JSON.stringify({ ver: 2, jelly: 100 }));
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      return Promise.resolve(null);
    },
  },
  event: { listen: () => Promise.resolve(() => {}) },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8")
  + "\n;globalThis.__G = () => ({ bowl, propHeld, petHome, held, winW, winH, bangs, petX, petY });"
  + "\n;globalThis.__W = { placeBowl: (x, y) => { bowl = { x, y, plat: null, fill: 3 }; } };";
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
  const W = G().winW;
  console.log("winW:", W, "pet at", G().petX, G().petY);

  // place a bowl far from the pet, grab it
  globalThis.__W.placeBowl(200, 400);
  pump(2);
  cvEv("pointerdown", 200, 387); // grab zone: y - 13
  check("propHeld=bowl after grab", G().propHeld === "bowl");

  // drag to top-center PUT AWAY slot; pump frames so draw path runs too
  cvEv("pointermove", W / 2, 300);
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

  console.log(fails === 0 ? "ALL GREEN" : `${fails} FAILURES`);
  process.exit(fails ? 1 : 0);
})();

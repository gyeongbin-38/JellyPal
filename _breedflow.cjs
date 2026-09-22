// BREED click-path harness — boots main.js with stubbed DOM, captures
// element listeners, then dispatches REAL pointerdown events at BREED_R
// and two ranch cells. Verifies breedMode toggles, breedSel fills,
// doBreed produces a child, and pullAnim clears (no wedge).
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
const listeners = {};
global.window = global;
global.innerWidth = 1920; global.innerHeight = 1080; global.devicePixelRatio = 1;
global.addEventListener = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
global.removeEventListener = () => {};
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
global.performance = require("perf_hooks").performance;
global.document = {
  getElementById: getEl,
  createElement: (tag) => (tag === "canvas" ? getEl("_canvas_" + Math.random()) : getEl("_" + tag)),
  createElementNS: (ns, tag) => getEl("_" + tag),
  body: getEl("body"), documentElement: getEl("html"),
  addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  removeEventListener() {},
  fonts: { load: () => Promise.resolve() }, hidden: false,
};
global.navigator = { userAgent: "sim" };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} createOscillator() { return { connect() { return { connect() {} } }, start() {}, stop() {}, frequency: { setValueAtTime() {} }, type: "" }; } createGain() { return { connect() { return { connect() {} } }, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, value: 0 } }; } get destination() { return {}; } };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };

const tauriState = {
  ver: 2, jelly: 5000, active: "sprout",
  owned: ["sprout", "berry", "pebble"],
  pals: [],
};
global.__TAURI__ = {
  core: {
    invoke: (cmd) => {
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

const src = fs.readFileSync("src/main.js", "utf8")
  + "\n;globalThis.__G = () => ({ranchOpen, breedMode, breedSel, pullAnim, owned, jelly, breedReadyAt, DEMO});"
  + "\n;globalThis.__W = { clearCd: () => { breedReadyAt = 0; }, ageAnim: () => { if (pullAnim) pullAnim.t0 -= 5000; } };";
try { (0, eval)(src); } catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }
const G = () => globalThis.__G();

const rcClick = (x, y) => {
  const fns = (els.rc && els.rc.listeners.pointerdown) || [];
  const ev = { button: 0, clientX: x, clientY: y, pointerId: 1, timeStamp: performance.now(), preventDefault() {} };
  if (!fns.length) console.log("WARN: no rc pointerdown listeners");
  fns.forEach((f) => { try { f(ev); } catch (e) { console.log("CLICK THREW:", e.stack.split("\n").slice(0, 5).join("\n")); fails++; } });
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

  eval("toggleRanch(true)");
  pump(2);
  check("ranchOpen", G().ranchOpen === true);
  console.log("state:", JSON.stringify({ jelly: G().jelly, owned: G().owned.length, cd: G().breedReadyAt, demo: G().DEMO }));

  // click BREED button [190,12,60,22] -> center (220,23)
  rcClick(220, 23);
  check("breedMode on", G().breedMode === true);

  // click cell 0 (sprout) then cell 1 (berry) — centers (60,100)/(176,100)
  const ownedBefore = G().owned.length;
  const jellyBefore = G().jelly;
  rcClick(60, 100);
  check("parent1 selected", G().breedSel.length === 1);
  rcClick(176, 100);
  check("breedSel reset after doBreed", G().breedSel.length === 0);
  check("child added", G().owned.length === ownedBefore + 1);
  check("pullAnim set", G().pullAnim !== null);
  check("jelly spent", G().jelly === jellyBefore - 20);
  check("breed cd armed", G().breedReadyAt > Date.now());

  // pump enough real time to finish the anim — rewind t0 so el>2100
  globalThis.__W.ageAnim();
  pump(3);
  check("pullAnim cleared (no wedge)", G().pullAnim === null);

  // BREED on cooldown now — click must not toggle breedMode
  rcClick(220, 23);
  check("cooldown blocks breedMode", G().breedMode === false);

  // wedge-heal path: mid-anim close + reopen must not brick ranch clicks
  globalThis.__W.clearCd();
  rcClick(220, 23);
  check("breedMode on again", G().breedMode === true);
  rcClick(60, 100); rcClick(176, 100);
  check("second breed", G().pullAnim !== null);
  eval("toggleRanch(false)"); // close mid-anim — drawPull can't tick
  pump(2);
  check("pullAnim survives closed ranch", G().pullAnim !== null);
  eval("toggleRanch(true)");
  globalThis.__W.ageAnim(); // fast-forward past the 2.1s reveal window
  pump(2);
  check("pullAnim heals on reopen", G().pullAnim === null);
  // clicks still reach the handler (cooldown is armed, but no dead-zone)
  const modeBefore = G().breedMode;
  rcClick(220, 23);
  check("ranch clicks still live", G().breedMode === modeBefore);

  console.log(fails ? `${fails} FAIL` : "ALL GREEN");
  process.exit(fails ? 2 : 0);
})();

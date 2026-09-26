// eat() regression: keystroke on fresh boot, then petHome — verify
// crumbs respect the gate and floors, and typing always wakes.
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
      const f = () => {}; t[prop] = f; return f;
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}
function fakeCanvas() {
  const c = { width: 800, height: 600, style: {}, addEventListener() {}, removeEventListener() {},
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: c.width, height: c.height }) };
  c.getContext = () => (c._ctx = c._ctx || fakeCtx(c));
  c.toDataURL = () => "data:image/png;base64,AAAA";
  return c;
}
const els = {};
const getEl = (id) => {
  if (!els[id]) {
    const e = { style: {}, innerHTML: "", textContent: "", children: [], addEventListener() {}, removeEventListener() {},
      appendChild() {}, remove() {}, setPointerCapture() {}, releasePointerCapture() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 400 }),
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      querySelector: () => null, querySelectorAll: () => [], width: 320, height: 400 };
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
  createElement: (t2) => (t2 === "canvas" ? fakeCanvas() : getEl("_" + t2)),
  createElementNS: (ns, t2) => getEl("_" + t2),
  body: getEl("body"), documentElement: getEl("html"),
  addEventListener() {}, removeEventListener() {}, fonts: { load: () => Promise.resolve() }, hidden: false,
};
global.navigator = { userAgent: "sim" };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };
global.__TAURI__ = { core: { invoke: (cmd) => {
  if (cmd === "load_state") return Promise.resolve("{}");
  if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
  if (cmd === "is_demo") return Promise.resolve(false);
  return Promise.resolve(null);
} }, event: { listen: () => Promise.resolve(() => {}) }, window: {} };
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8") + "\n;globalThis.__T = (e) => eval(e);";
try { (0, eval)(src); } catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }
const ev = (s) => globalThis.__T(s);
const frame = (t) => { const cb = rafCb; rafCb = null; if (cb) cb(t); };

(async () => {
  await new Promise((r) => setImmediate(r));
  let t = 0;
  for (let i = 0; i < 90; i++) { t += 16.7; frame(t); }

  // 1) typing wakes every species — switch to a non-kr species and idle-age it
  const nonKr = ev("SPECIES.findIndex(s=>!s.kr)");
  ev(`active=${nonKr}; owned.push(SPECIES[${nonKr}].id); awakeAt = Date.now() - 9e6;`);
  ev("eat()");
  const wokeAll = ev("Date.now() - awakeAt") < 5000;
  console.log(wokeAll ? "PASS typing wakes non-kr" : "FAIL non-kr still asleep-clock");

  // 2) crumbs spawn under a visible pet and carry a floor anchor
  // (needs a key-eater as active — switch back to sprout)
  ev("active = SPECIES.findIndex(s=>s.id==='sprout')");
  ev("crumbs.length = 0; for (let i=0;i<40;i++) eat();");
  const n = ev("crumbs.length");
  const anchored = ev("crumbs.every(c=>typeof c.floor === 'number')");
  console.log(n > 0 && anchored ? `PASS ${n} crumbs w/ floor anchor` : "FAIL crumbs " + n);

  // 3) petHome: typing still pays xp but spawns zero spot-anchored effects
  ev("petHome = true; crumbs.length = 0; bangs.length = 0; hearts.length = 0;");
  const xp0 = ev("xp"), j0 = ev("jelly");
  // force the gem milestone: set xp just under JELLY_EVERY boundary
  ev("xp += (JELLY_EVERY - (xp % JELLY_EVERY)) - 1;");
  ev("eat()");
  const paidJ = ev("jelly") - j0;
  const quiet = ev("crumbs.length") === 0 && ev("bangs.length") === 0 && ev("hearts.length") === 0;
  console.log(paidJ === 1 && quiet ? "PASS petHome: paid silently" : `FAIL j+${paidJ} crumbs=${ev("crumbs.length")} bangs=${ev("bangs.length")} hearts=${ev("hearts.length")}`);

  // 4) crumb cull honors spawn-floor, not live petY
  ev("petHome = false; crumbs.length = 0; petY = 500; crumbs.push({x:100,y:430,vy:0,life:1,floor:500}); petY = 900;");
  for (let i = 0; i < 40; i++) { t += 16.7; frame(t); }
  const culled = ev("crumbs.length === 0");
  console.log(culled ? "PASS crumb landed on spawn floor" : "FAIL crumb survives below floor");
  process.exit(0);
})();

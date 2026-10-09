// gainXp/dripTick regression: xp milestones pay jelly, drips grant +3
// (lucky +30), petHome swallows visual bursts but still pays out, and
// crumb culling honors the spawn-time floor.
const fs = require("fs");
process.chdir(__dirname);

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

  // 1) gainXp banks xp and flips the tutorial flag at 50
  ev("xp = 0; seen = false; jelly = 0;");
  ev("for (let i = 0; i < 4; i++) gainXp(15, null);");
  const banked = ev("xp === 60 && seen === true");
  console.log(banked ? "PASS gainXp banks xp + flips seen" : `FAIL xp=${ev("xp")} seen=${ev("seen")}`);

  // 2) xp milestone pays +1 jelly; a parked pet swallows the burst but pays
  ev("petHome = true; bangs.length = 0; jelly = 0; xp = JELLY_EVERY - 10; gainXp(15, petX + 20, petY - 96);");
  const paidJ = ev("jelly");
  const quiet = ev("bangs.length === 0");
  console.log(paidJ === 1 && quiet ? "PASS petHome: milestone pays silently" : `FAIL jelly=${paidJ} bangs=${ev("bangs.length")}`);

  // 3) dripTick pays +3 after the timer and reschedules five minutes out
  ev("petHome = false; jelly = 0; xp = 0; dripAt = Date.now() - 1; Math.random = () => 0.99;");
  const fired = ev("dripTick()");
  const got3 = ev("jelly") === 3 && ev("xp") === 15;
  const resched = ev("dripAt - Date.now()") > 4 * 60000;
  console.log(fired === true && got3 && resched ? "PASS drip pays +3/+15xp and reschedules" : `FAIL fired=${fired} jelly=${ev("jelly")} xp=${ev("xp")}`);
  ev("jelly = 0;");
  const early = ev("dripTick()");
  console.log(early === false && ev("jelly") === 0 ? "PASS drip waits for the timer" : "FAIL early drip paid");

  // 4) lucky drop: forced rng lands +30 with the celebration burst
  ev("Math.random = () => 0; jelly = 0; dripAt = Date.now() - 1; bangs.length = 0; dripTick(); Math.random = () => 0.99;");
  const lucky = ev("jelly") === 30 && ev("bangs.some(b => b.t === 'LUCKY +30!')");
  console.log(lucky ? "PASS lucky drop pays +30 with a bang" : `FAIL jelly=${ev("jelly")} bangs=${ev("JSON.stringify(bangs.map(b=>b.t))")}`);

  // 5) crumb cull honors spawn-floor, not live petY
  ev("petHome = false; crumbs.length = 0; petY = 500; crumbs.push({x:100,y:430,vy:0,life:1,floor:500}); petY = 900;");
  for (let i = 0; i < 40; i++) { t += 16.7; frame(t); }
  const culled = ev("crumbs.length === 0");
  console.log(culled ? "PASS crumb landed on spawn floor" : "FAIL crumb survives below floor");
  process.exit(0);
})();

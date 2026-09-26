// treat-race harness: eval main.js, spawn pals, inject a thrown treat,
// pump frames, verify every pal reacted and exactly one ate it.
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
const listeners = {};
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
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };

global.__TAURI__ = {
  core: {
    invoke: (cmd) => {
      if (cmd === "load_state") return Promise.resolve("{}");
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      if (cmd === "is_demo") return Promise.resolve(false);
      return Promise.resolve(null);
    },
  },
  event: { listen: () => Promise.resolve(() => {}) },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8") +
  "\n;globalThis.__T = (expr) => eval(expr);"; // eval bridge: same scope as the lets
try { (0, eval)(src); } catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }

const ev = (s) => globalThis.__T(s);
const frame = (t) => { const cb = rafCb; rafCb = null; if (cb) cb(t); };

(async () => {
  await new Promise((r) => setImmediate(r));
  let t = 0;
  for (let i = 0; i < 120; i++) { t += 16.7; frame(t); } // settle

  // fresh-state sanity
  const jelly0 = ev("jelly"), owned0 = ev("owned.join(',')"), acc0 = ev("accOwned.join(',')"), props0 = ev("[bowl,cushion,box,plant,music,mirror,mat,jar].filter(Boolean).length");
  console.log(`fresh: jelly=${jelly0} owned=${owned0} acc=${acc0} props=${props0} pals=${ev("pals.length")}`);

  // summon three pals across the platform (must own the species first —
  // the frame loop culls pals whose species left the collection)
  ev("owned.push(SPECIES[1].id, SPECIES[2].id); spawnPal(0); spawnPal(1); spawnPal(2);");
  for (let i = 0; i < 60; i++) { t += 16.7; frame(t); }
  ev("pals[0].x = 300; pals[1].x = 900; pals[2].x = 1500; pals.forEach(p=>{p.fly=false; p.plat=null;});");
  for (let i = 0; i < 30; i++) { t += 16.7; frame(t); }
  console.log("pals at:", ev("pals.map(p=>Math.round(p.x)+'@'+Math.round(p.y)).join('  ')"));

  // throw a cookie toward x=1100
  ev("treatFly = { x: petX, y: petY - 40, vx: (1100 - petX) / 0.9, vy: -420, kind: 0 }");
  const xp0 = ev("xp"), treats0 = ev("stats.treats"), jelly1 = ev("jelly");

  // pump until treat lands then is eaten (or timeout ~20s of frames)
  let landed = -1, eaten = -1;
  const reactSeen = {};
  for (let i = 0; i < 1400; i++) {
    t += 16.7; frame(t);
    if (i % 10 === 0) await new Promise((r) => setImmediate(r));
    if (landed < 0 && ev("!!treat")) landed = t;
    if (landed >= 0 && eaten < 0 && !ev("!!treat")) eaten = t;
    // snapshot pal reactions while a snack is in play
    if (ev("!!treatFly || !!treat")) {
      ev("pals").forEach((p, k) => {
        if (p.faceId || (p.lookUntil || 0) > t) reactSeen[k] = p.faceId || "look";
      });
    }
    if (eaten > 0 && t > eaten + 1200) break;
  }

  console.log("landed@:", landed > 0 ? Math.round(landed) : "never", " eaten@:", eaten > 0 ? Math.round(eaten) : "never");
  console.log("xp gained:", ev("xp") - xp0, "(cookie=60)");
  console.log("stats.treats:", ev("stats.treats"), " delta:", ev("stats.treats") - treats0);
  console.log("jelly delta:", ev("jelly") - jelly1);
  console.log("pal reactions:", JSON.stringify(reactSeen), " pals:", ev("pals.length"));
  console.log("final faces:", ev("pals.map(p=>p.faceId+':'+Math.round((p.faceT||0)) ).join('  ')"));

  const allReacted = ev("pals.length") === Object.keys(reactSeen).length;
  const eatenOnce = ev("stats.treats") - treats0 === 1;
  const xpOk = ev("xp") - xp0 === 60;
  console.log(allReacted ? "PASS all pals reacted" : "FAIL: a pal never reacted");
  console.log(eatenOnce ? "PASS treat eaten once" : "FAIL: eaten " + (ev("stats.treats") - treats0) + "x");
  console.log(xpOk ? "PASS xp +60 once" : "FAIL: xp delta " + (ev("xp") - xp0));
  process.exit(allReacted && eatenOnce && xpOk ? 0 : 2);
})();

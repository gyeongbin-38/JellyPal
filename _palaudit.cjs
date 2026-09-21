// per-species pal audit — the final "every pal, one by one" sweep.
// boots main.js in the same mocked DOM as _verify.cjs, then for EVERY
// species spawns it as a pal and checks, individually:
//   spawn/land, palette completeness, personality binding, gait motion
//   (walk/scurry/burst/blink/hop/hover), nap freeze + Z trail, species
//   signature flourish, accessory render path, and zero frame crashes.
const fs = require("fs");

const crashMsgs = [];
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
global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      if (cmd === "log_crash" && args) crashMsgs.push(args.msg);
      if (cmd === "load_state") return Promise.resolve(JSON.stringify({
        ver: 2, jelly: 5000, active: "sprout",
        owned: ["sprout"], pals: [],
      }));
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

let tNow = 0;
async function pump(n) {
  for (let i = 0; i < n; i++) {
    if (!rafCb) throw new Error("rAF dead");
    const cb = rafCb; rafCb = null;
    tNow += 16.7;
    cb(tNow);
    if (i % 60 === 0) await new Promise((r) => setImmediate(r));
  }
}
const E = (s) => __E(s);
const crashes = () => crashMsgs.filter((m) => m !== "tick" && !String(m).startsWith("clip-")).length;

(async () => {
  await new Promise((r) => setImmediate(r));
  await pump(40);

  // every species must be "owned" or the pal cull at line ~7321 removes it
  E("SPECIES.forEach((s) => { if (s && !owned.includes(s.id)) owned.push(s.id); });");
  const n = E("SPECIES.length");
  const PAL_KEYS = ["o", "b", "l", "s", "e", "w", "m", "k"];
  let speciesPass = 0;
  const fails = [];

  // quiet the stage: park the pet, pin every ambient roll
  E(`petX = 40; petY = plats[0].y; walkTarget = null; walkGoal = null; flying = false;
     nextWander = ${tNow} + 9e9; noSleepUntil = Date.now() + 9e9; sigT0 = 0;
     treat = null; snack = null; egg = null; ball = null; box = null; plant = null;
     music = null; bowl = null; cushion = null; curX = -9999; curY = -9999; curV = 0;
     danceT0 = 0; settingsOpen = false; ranchOpen = false; toyboxOpen = false; fabOpen = false;
     petHome = true;`); // pet parked in the far corner — it's a physical wall

  for (let i = 0; i < n; i++) {
    const bad = [];
    const c0 = crashes();
    const id = E(`SPECIES[${i}].id`);
    const name = E(`SPECIES[${i}].name`);
    const mv = E(`SPECIES[${i}].mv || "walk"`);
    const sig = E(`SPECIES[${i}].sig || null`);
    const baby = E(`isBaby(SPECIES[${i}])`);

    // 1. palette + personality binding
    const missing = PAL_KEYS.filter((k) => !E(`SPECIES[${i}].pal && SPECIES[${i}].pal.${k}`));
    if (missing.length) bad.push(`palette missing ${missing.join(",")}`);
    if (!E(`PSYCH[SPECIES[${i}].ps]`)) bad.push(`no PSYCH for ps=${E(`SPECIES[${i}].ps`)}`);

    // 2. spawn + land (eval every few frames — per-frame evals are the
    // audit's real runtime cost, not the simulation itself)
    E(`pals.length = 0; spawnPal(${i});`);
    const p = "pals[0]";
    for (let f = 0; f < 150 && !(E(`${p}.plat`) && !E(`${p}.fly`)); f += 3) await pump(3);
    if (!E(`${p}.plat`) || E(`${p}.fly`)) bad.push(`never landed (fly=${E(`${p}.fly`)})`);

    // 3. gait: point it at a far target INSIDE its own platform, watch
    // how it gets there (window tops are narrow — clamp to the plat)
    E(`(() => { const q = ${p}; q.fly = false; q.vx = 0; q.vy = 0; q.restUntil = 0;
       q.nextT = ${tNow} + 9e9; q.follow = null; q.tag = null; q.stackOn = null;
       q.propGoal = null; q.accAct = null; q.hopWind = 0; q.web = 0; q.sigT = 0;
       q.playCd = ${tNow} + 9e9;
       const lo = q.plat.x + 30, hi = q.plat.x + q.plat.w - 30;
       q.x = (lo + hi) / 2;
       // slow personalities (spd 0.6) need a short leash — 150px is
       // ~290 frames at the slowest gait, well inside the budget
       q.walkT = q.x + Math.min(150, (hi - lo) * 0.3); })()`);
    const tgt = E(`${p}.walkT`), startX = E(`${p}.x`);
    let sawFly = false, sawBlink = false;
    for (let f = 0; f < 380; f += 4) {
      await pump(4);
      if (E(`${p}.fly`)) sawFly = true;
      if (E(`${p}.blinkT || 0`) > 0) sawBlink = true;
      if (E(`${p}.walkT`) === null || Math.abs(E(`${p}.x`) - tgt) < 25) break;
    }
    const arrived = E(`${p}.walkT`) === null || Math.abs(E(`${p}.x`) - tgt) < 25;
    if (!arrived) bad.push(`gait never arrived (x=${E(`${p}.x`).toFixed(0)} tgt=${tgt.toFixed(0)} dx=${(E(`${p}.x`) - startX).toFixed(0)})`);
    if (mv === "hop" && !sawFly) bad.push("hop pal never leapt");
    if (mv === "blink" && !sawBlink && !arrived) bad.push("blink pal never blinked");

    // 4. nap: frozen, target cleared, Z trail appears
    E(`(() => { const q = ${p}; q.x = 400; q.y = plats[0].y; q.plat = plats[0]; q.fly = false;
       q.walkT = null; q.restUntil = ${tNow} + 4000; q.nextT = ${tNow}; q.sigT = 0;
       q.zzzT = 0; })()`);
    const napX = E(`${p}.x`);
    await pump(130); // ~2.2s — one zzz cycle is 1.9s
    if (Math.abs(E(`${p}.x`) - napX) > 3) bad.push(`moved while napping (dx=${(E(`${p}.x`) - napX).toFixed(1)})`);
    if (E(`${p}.walkT`) !== null) bad.push("acquired a target while napping");
    if (!E(`${p}.zzzT || 0`)) bad.push("no Z trail while napping");
    E(`${p}.restUntil = 0; ${p}.fly = false; ${p}.walkT = null;`);

    // 5. signature flourish: fires its bang + face, then clears
    if (sig && !baby) {
      E(`(() => { const q = ${p}; q.fly = false; q.web = 0; q.stackOn = null; q.restUntil = 0;
         q.sigT = ${tNow} + 900; q.sigId = "${sig}"; q.sigDid = 0; q.walkT = null; })()`);
      for (let f = 0; f < 75 && E(`${p}.sigT`); f += 3) await pump(3);
      if (!E(`${p}.sigDid`)) bad.push(`sig ${sig} never fired its bang`);
      if (E(`${p}.sigT`)) bad.push(`sig ${sig} never cleared`);
    }

    // 6. accessory render path for this species
    const c1 = crashes();
    E(`accEquip[SPECIES[${i}].id] = "cap";`);
    await pump(8);
    E(`accEquip[SPECIES[${i}].id] = "wings";`);
    await pump(8);
    E(`delete accEquip[SPECIES[${i}].id];`);
    if (crashes() - c1 > 0) bad.push("accessory render crashed");

    if (crashes() - c0 > 0) bad.push(`frame crashes: ${crashMsgs.slice(-2).join(" | ")}`);
    if (bad.length) fails.push(`${id}(${name}) ${bad.join("; ")}`);
    else speciesPass++;
    console.log(`${bad.length ? "FAIL" : "PASS"} ${id.padEnd(8)} ${name.padEnd(9)} mv=${mv.padEnd(6)} sig=${(sig || "-").padEnd(11)} ${baby ? "baby " : ""}${bad.join("; ")}`);
  }

  console.log(`\n=== ${speciesPass}/${n} species pass as pals ===`);
  if (fails.length) { console.log("FAILURES:"); fails.forEach((f) => console.log("  " + f)); process.exit(1); }
  process.exit(0); // main.js timers would keep the loop alive forever otherwise
})();

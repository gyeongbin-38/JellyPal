// clean-machine harness — same DOM stubs as _verify.cjs but load_state
// returns a fresh/empty save: this is the FIRST-EVER boot a real itch.io
// downloader sees. asserts the starter experience works with zero state.
//   node _fresh.cjs        → empty save ("{}")
//   node _fresh.cjs null   → save file literally contains "null" (edge)
const fs = require("fs");

const calls = [];
const crashMsgs = [];
let lastSave = null;
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
global.window = global;
global.innerWidth = 1920;
global.innerHeight = 1080;
global.devicePixelRatio = 1;
global.addEventListener = () => {};
global.removeEventListener = () => {};
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
global.performance = require("perf_hooks").performance;
global.document = {
  getElementById: getEl,
  createElement: (tag) => (tag === "canvas" ? fakeCanvas() : getEl("_" + tag)),
  createElementNS: (ns, tag) => getEl("_" + tag),
  body: getEl("body"),
  documentElement: getEl("html"),
  addEventListener() {},
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

// THE CLEAN MACHINE: no state.json — the backend returns "{}" (or a
// payload passed on argv for edge cases like a literal "null" file).
// "seeded" boots a crafted save that tries to smuggle unowned gear in.
const SEEDED = process.argv[2] === "seeded";
const LOAD_PAYLOAD = SEEDED
  ? JSON.stringify({
      ver: 2, owned: ["sprout", "ember"], active: "sprout", jelly: 5,
      accOwned: ["cap"],
      accEquip: { sprout: "cap", ember: "crown", zzz: "cap" },
      savedAt: Date.now() - 30000, seen: true,
    })
  : (process.argv[2] || "{}");
global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      calls.push(cmd);
      if (cmd === "log_crash" && args) crashMsgs.push(args.msg);
      if (cmd === "save_state" && args) lastSave = args.json;
      if (cmd === "load_state") return Promise.resolve(LOAD_PAYLOAD);
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
    try { cb(tNow); } catch (e) {
      console.log("FRAME THREW:", e.stack.split("\n").slice(0, 5).join("\n"));
      process.exit(2);
    }
    if (i % 60 === 0) await new Promise((r) => setImmediate(r));
  }
}
const E = (s) => __E(s);
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => {
  console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  (" + extra + ")" : ""));
  ok ? pass++ : fail++;
};
const realCrashes = () => crashMsgs.filter((m) => m !== "tick" && !String(m).startsWith("clip-"));

(async () => {
  await new Promise((r) => setImmediate(r));
  await pump(60); // boot: load_state resolves, spawn, first frames

  // ---- first boot basics ----
  check("pet spawns on clean machine", E("petX") > 0 && E("petY") > 0,
    `x=${E("petX").toFixed(0)} y=${E("petY").toFixed(0)}`);
  if (SEEDED) {
    // ---- loaded-save sanitization: gear is gated by real ownership ----
    check("seeded owned list loads", JSON.stringify(E("owned")) === '["sprout","ember"]', JSON.stringify(E("owned")));
    check("seeded accOwned loads", JSON.stringify(E("accOwned")) === '["cap"]', JSON.stringify(E("accOwned")));
    check("unowned acc equip stripped", JSON.stringify(E("accEquip")) === '{"sprout":"cap"}',
      `accEquip=${E("JSON.stringify(accEquip)")}`);
    check("zero crashes on seeded boot", realCrashes().length === 0, realCrashes().slice(0, 3).join(" | "));
    console.log(`=== fresh(seeded): ${pass} passed, ${fail} failed ===`);
    process.exit(fail ? 1 : 0);
  }
  check("starter species is sprout", E("SPECIES[active] && SPECIES[active].id") === "sprout",
    `active=${E("SPECIES[active] && SPECIES[active].id")}`);
  check("owned defaults to sprout", JSON.stringify(E("owned")) === '["sprout"]', JSON.stringify(E("owned")));
  for (let i = 0; i < 120 && E("jelly") < 50; i++) await pump(1);
  check("first-boot gifts land (10 base +10 day +30 week)", E("jelly") === 50, `jelly=${E("jelly")}`);
  check("tutorial flag starts unseen", E("seen") === false);
  check("no pals on clean machine", E("pals.length") === 0);
  check("no props placed", !E("bowl") && !E("cushion") && !E("ball"));
  check("no pet level yet", E("level") === 0 && E("xp") === 0, `lvl=${E("level")} xp=${E("xp")}`);

  // ---- soak ~25s: crosses the 20s uptime gates (egg, hint drip, heartbeat) ----
  await pump(1500);
  check("egg stays gated until first typing", E("egg") === null, `egg=${JSON.stringify(E("egg"))}`);
  check("still alive after 25s soak", E("petX") > 0, `x=${E("petX").toFixed(0)}`);
  E("persist()"); // the 5s wall-clock interval can't fire inside a pump — call it directly
  const sv = lastSave && JSON.parse(lastSave);
  check("persist writes a valid first save", !!sv && Array.isArray(sv.owned) && sv.owned.includes("sprout"),
    sv ? `owned=${JSON.stringify(sv.owned)} jelly=${sv.jelly}` : "no save yet");

  // ---- first typing session: xp -> seen -> eggs unlock ----
  for (let i = 0; i < 55; i++) E("eat()"); // real keystroke path
  check("typing flips the tutorial flag", E("seen") === true);
  check("xp banked (jelly drips at 600 keys)", E("xp") === 55 && E("jelly") >= 50, `xp=${E("xp")} jelly=${E("jelly")}`);
  E("lastEgg = ''");
  for (let i = 0; i < 60 && !E("egg"); i++) await pump(1);
  check("first egg drops once seen", !!E("egg"), `egg=${JSON.stringify(E("egg"))}`);

  // ---- UI fits a 1080p laptop screen ----
  const [px, py, pw, ph] = E("settingsRect()");
  check("settings panel fully on-screen", px >= 0 && py >= 0 && px + pw <= 1920 && py + ph <= 1080,
    `${px},${py} ${pw}x${ph}`);
  const [fx2, fy2] = E("fabPos()");
  check("fab on-screen", fx2 > 0 && fx2 < 1920 && fy2 > 0 && fy2 < 1080, `${fx2},${fy2}`);

  check("zero crashes on clean boot", realCrashes().length === 0, realCrashes().slice(0, 3).join(" | "));

  console.log(`=== fresh(${LOAD_PAYLOAD}): ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

// pull sim: exercise the gacha economy — single pull, x10 bulk sheet,
// the rare+ guarantee, dup refunds, pity counters.
const fs = require("fs");

const listeners = {};
const elc = {};
function fakeCtx() {
  return new Proxy({ measureText: (t) => ({ width: (t || "").length * 6 }) }, {
    get(t, k) { return k in t ? t[k] : () => {}; },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function fakeCanvas() {
  return { width: 0, height: 0, style: {}, getContext: () => fakeCtx(),
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    setPointerCapture() {}, releasePointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1920, height: 1080 }) };
}
const getEl = (id) => elc[id] || (elc[id] = {
  id, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  textContent: "", innerHTML: "", offsetLeft: 0, offsetTop: 0, offsetWidth: 100, offsetHeight: 100,
  getContext: () => fakeCtx(), width: 0, height: 0,
});

global.window = global;
global.innerWidth = 1920; global.innerHeight = 1080; global.devicePixelRatio = 1;
global.addEventListener = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
global.removeEventListener = () => {};
global.requestAnimationFrame = () => 1;
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
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} createOscillator(){return{frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){},type:""}}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}} get destination(){return {}} get currentTime(){return 0} };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };

global.__TAURI__ = {
  core: {
    invoke: (cmd) => {
      if (cmd === "is_store_build") return Promise.resolve(false);
      if (cmd === "load_state") return Promise.resolve("{}");
      if (cmd === "is_demo") return Promise.resolve(false);
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      return Promise.resolve(null);
    },
  },
  event: { listen: (name, cb) => { (listeners["tauri:" + name] = listeners["tauri:" + name] || []).push(cb); return Promise.resolve(() => {}); } },
  window: { getCurrentWindow: () => ({ startDragging: () => Promise.resolve(), show: () => Promise.resolve(), setFocus: () => Promise.resolve() }) },
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8") +
  "\n;globalThis.__T = (expr) => eval(expr);";
try { (0, eval)(src); } catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }

const ev = (s) => globalThis.__T(s);
let pass = 0, fail = 0;
const check = (ok, name, extra) => { console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  (" + extra + ")" : "")); ok ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await sleep(30);

  ev("jelly = 10000");
  const PULL_COST = ev("PULL_COST");
  const DUP_REFUND = ev("DUP_REFUND");

  // single pull still works through the shared apply path
  ev("pullAnim = null; doPull()");
  check(ev("pullAnim !== null"), "single pull starts capsule anim");
  check(ev("jelly") === 10000 - PULL_COST, "single pull charges once", ev("jelly"));
  check(ev("stats.pulls") === 1, "pull counter ticks");
  ev("pullAnim = null");

  // x10: charges 10x, lands a 10-entry sheet, counts 10 pulls.
  // exhaust the dex milestones first so their jelly payouts don't leak
  // into the charge/refund arithmetic
  ev("dexMile = DEX_MILES.length");
  const j9 = ev("jelly");
  ev("pull10 = true; doPull10()");
  const list = ev("pullResults.list");
  check(list.length === 10, "x10 sheet holds ten results", list.length);
  check(ev("jelly") === j9 - PULL_COST * 10 + ev("pullResults.refunded"),
    "x10 charges 10x minus dup refunds", `${ev("jelly")} refund=${ev("pullResults.refunded")}`);
  check(ev("stats.pulls") === 11, "x10 counts ten pulls");

  // rare+ guarantee: force all-common rolls (rand~0 -> lowest tier) with
  // pity counters reset so nothing else bumps the rarity — the sheet must
  // still contain one r>=1
  ev("pityRare = 0; pityLeg = 0");
  const realRandom = Math.random;
  Math.random = () => 0.000001;
  ev("pullResults = null; doPull10()");
  check(ev("pullResults.list.every((r) => SPECIES[r.idx])") === true,
    "guarantee run produced valid species");
  check(ev("pullResults.list.filter((r) => SPECIES[r.idx].r >= 1).length") === 1,
    "all-common x10 upgrades exactly one slot to rare+",
    ev("pullResults.list.map((r) => SPECIES[r.idx].r)").join());
  Math.random = realRandom;

  // no jelly, no pull: x10 with an empty wallet refuses
  ev("pullResults = null; jelly = 100; doPull10()");
  check(ev("pullResults === null && jelly === 100"), "x10 refuses when broke");
  ev("pull10 = false");

  // un-owned accounting: exactly the isNew count lands in owned, the rest
  // came back as dup refunds
  ev("jelly = 50000; pullResults = null");
  const ownedBefore = ev("owned.length");
  ev("doPull10()");
  const news = ev("pullResults.list.filter((r) => r.isNew).length");
  const refunds = ev("pullResults.list.filter((r) => !r.isNew).length");
  check(ev("owned.length") === ownedBefore + news && news + refunds === 10,
    "new pulls own, dup pulls refund",
    `owned=${ev("owned.length")} new=${news} dup=${refunds}`);

  console.log(`\n=== pull sim: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

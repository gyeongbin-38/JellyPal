// store-mode sim: boot the app with is_store_build=true and verify the
// sandboxed card flavor — trimmed settings, no window platforms, a
// full-window click hitbox, and the IAP drain/grant/ack loop.
const fs = require("fs");

const listeners = {};
const invokeCalls = {};
const elc = {};
// iap_drain is a queue the test controls: push events, they get consumed
const iapQueue = [];
let ackedTxs = [];
const IAP_PRODUCTS = [
  { id: "com.jellypal.jelly.small", title: "Jelly Pack S", price: "$0.99", jelly: 250 },
  { id: "com.jellypal.jelly.medium", title: "Jelly Pack M", price: "$1.99", jelly: 500 },
];
function fakeCtx() {
  return new Proxy({ measureText: (t) => ({ width: (t || "").length * 6 }) }, {
    get(t, k) { return k in t ? t[k] : () => {}; },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function fakeCanvas() {
  return { width: 0, height: 0, style: {}, getContext: () => fakeCtx(),
    addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    setPointerCapture() {}, releasePointerCapture() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 560 }) };
}
const getEl = (id) => elc[id] || (elc[id] = {
  id, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  textContent: "", innerHTML: "", offsetLeft: 0, offsetTop: 0, offsetWidth: 100, offsetHeight: 100,
  getContext: () => fakeCtx(), width: 0, height: 0,
});

let rafCb = null;
global.window = global;
global.innerWidth = 480; global.innerHeight = 560; global.devicePixelRatio = 1;
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
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} createOscillator(){return{frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){},type:""}}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}} get destination(){return {}} get currentTime(){return 0} };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };

global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      invokeCalls[cmd] = args === undefined ? true : args;
      if (cmd === "is_store_build") return Promise.resolve(true);
      if (cmd === "load_state") return Promise.resolve("{}");
      if (cmd === "is_demo") return Promise.resolve(false);
      if (cmd === "autostart_available") return Promise.resolve(true); // pretend macOS 13+
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      if (cmd === "iap_ready") return Promise.resolve(true);
      if (cmd === "iap_refresh") return Promise.resolve(null);
      if (cmd === "iap_products") return Promise.resolve(IAP_PRODUCTS);
      if (cmd === "iap_drain") return Promise.resolve(iapQueue.splice(0));
      if (cmd === "iap_ack") { ackedTxs.push(args.tx); return Promise.resolve(null); }
      if (cmd === "iap_buy") return Promise.resolve(null);
      return Promise.resolve(null);
    },
  },
  event: { listen: (name, cb) => { (listeners["tauri:" + name] = listeners["tauri:" + name] || []).push(cb); return Promise.resolve(() => {}); } },
  window: { getCurrentWindow: () => ({
    startDragging: () => Promise.resolve(),
    show: () => { invokeCalls.__win_show = true; return Promise.resolve(); },
    setFocus: () => { invokeCalls.__win_focus = true; return Promise.resolve(); },
  }) },
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8") +
  "\n;globalThis.__T = (expr) => eval(expr);";
try { (0, eval)(src); } catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }

const ev = (s) => globalThis.__T(s);
const emit = (name, payload) => {
  for (const f of listeners["tauri:" + name] || []) f({ payload });
};
let pass = 0, fail = 0;
const check = (ok, name, extra) => { console.log((ok ? "PASS " : "FAIL ") + name + (extra ? "  (" + extra + ")" : "")); ok ? pass++ : fail++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await sleep(30); // let the is_store_build probe resolve and confine the world

  check(ev("STORE") === true, "store flag flips from backend probe");
  await sleep(30); // and the autostart_available probe behind it

  const ids = ev("settingsRowIds()");
  check(ids.length === 14 && !ids.includes(9) && !ids.includes(12),
    "store drops WEATHER/REDEEM rows", JSON.stringify(ids));
  check(ids.includes(11), "JELLY row stays — it opens the IAP panel");
  check(ids.includes(10), "BOOT un-hides when login items are available");
  check(ids.includes(0) && ids.includes(15), "VOL + QUIT survive the trim");

  // zero-network: the store SKU must never fire update or weather probes
  check(invokeCalls.check_update === undefined && invokeCalls.get_weather === undefined,
    "no outbound network calls", `check_update=${JSON.stringify(invokeCalls.check_update)}`);

  // IAP boot wiring: catalog request + the drain poll both fire
  check(invokeCalls.iap_refresh !== undefined && invokeCalls.iap_products !== undefined,
    "iap catalog warms at boot");
  await sleep(20);
  check(ev("iapProds.length") === 2, "product list lands in state", JSON.stringify(ev("iapProds")));

  // purchase grant: drain -> jelly credited once -> acked -> deduped on repeat
  const before = ev("jelly");
  iapQueue.push({ kind: "purchased", product: "com.jellypal.jelly.small", jelly: 250, tx: "777" });
  await ev("iapPoll()");
  check(ev("jelly") === before + 250, "purchased event grants jelly", `jelly=${ev("jelly")}`);
  check(ackedTxs.join() === "777", "grant acks the transaction", ackedTxs.join());
  iapQueue.push({ kind: "purchased", product: "com.jellypal.jelly.small", jelly: 250, tx: "777" });
  await ev("iapPoll()");
  check(ev("jelly") === before + 250, "redelivered tx does not grant twice");

  // cancelled purchases (code 2) stay silent; real failures surface
  const bangN = ev("bangs.length");
  iapQueue.push({ kind: "failed", product: "x", code: 2 });
  await ev("iapPoll()");
  check(ev("bangs.length") === bangN, "user cancel is silent");
  iapQueue.push({ kind: "failed", product: "x", code: 0 });
  await ev("iapPoll()");
  check(ev("bangs.length") === bangN + 1, "real failure notifies");

  // tray summon: floats the card window instead of recalling the slime
  emit("summon");
  await sleep(10);
  check(invokeCalls.__win_show === true && invokeCalls.__win_focus === true,
    "summon floats the card to the front");

  const mons = ev("monPlats");
  check(mons.length === 1 && mons[0].y === 560 - 6 && mons[0].w === 480,
    "world confined to card floor", JSON.stringify(mons));

  // a desktop-wide platform scan must be ignored — no window-hopping here
  emit("platforms", [[0, 100, 400], [50, 200, 300]]);
  await sleep(5);
  check(ev("runtimePlats.length") === 0 && ev("plats.length") === 1,
    "window platform events ignored", `runtime=${ev("runtimePlats.length")}`);

  // hitbox: the whole card is interactive (no click-through underneath)
  const rects = invokeCalls.set_clickable && invokeCalls.set_clickable.rects;
  check(rects && rects.length === 1 && rects[0][2] === 480 && rects[0][3] === 560,
    "hitbox covers the whole card", JSON.stringify(rects));

  // redeem stays unreachable: the row is hidden and the modal can reset
  check(ev("(() => { redeemMode = false; return settingsRowIds().includes(12); })()") === false,
    "redeem surface stays closed");

  console.log(`\n=== store sim: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
})();

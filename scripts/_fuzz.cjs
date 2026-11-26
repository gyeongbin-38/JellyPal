// fuzz harness: eval main.js, hammer it with random input + state churn,
// catch frame exceptions and invariant violations
const fs = require("fs");
process.chdir(require("path").join(__dirname, ".."));

// Print and accept a seed so a random failure can be replayed exactly:
//   node _fuzz.cjs <frames> <seed>
const seedArg = Number.parseInt(process.argv[3] || "", 10);
const FUZZ_SEED = Number.isFinite(seedArg) ? seedArg >>> 0 : Date.now() >>> 0;
let rngState = FUZZ_SEED || 0x6d2b79f5;
function seededRandom() {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let z = rngState;
  z = Math.imul(z ^ (z >>> 15), z | 1);
  z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
  return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
}
Math.random = seededRandom;
let simNow = 0;
const FUZZ_EPOCH = 1700000000000;
Date.now = () => FUZZ_EPOCH + simNow;

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
function recordable(e) {
  e.listeners = e.listeners || {};
  e.addEventListener = (type, fn) => { (e.listeners[type] = e.listeners[type] || []).push(fn); };
  e.fire = (type, ev) => { (e.listeners[type] || []).forEach(fn => fn(ev)); };
  return e;
}
function fakeCanvas() {
  const c = recordable({
    width: 1920, height: 1080, style: {},
    removeEventListener() {}, setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: c.width, height: c.height }; },
  });
  c.getContext = () => (c._ctx = c._ctx || fakeCtx(c));
  c.toDataURL = () => "data:image/png;base64,AAAA";
  return c;
}
const els = {};
const getEl = (id) => {
  if (!els[id]) {
    const e = recordable({
      style: {}, innerHTML: "", textContent: "", children: [],
      removeEventListener() {}, appendChild() {}, remove() {},
      setPointerCapture() {}, releasePointerCapture() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 320, height: 400 }; },
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      querySelector() { return null; }, querySelectorAll() { return []; },
      width: 320, height: 400, offsetLeft: 0, offsetTop: 0,
      focus() {}, blur() {}, click() {}, select() {},
    });
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
global.performance = { now: () => simNow };
global.document = recordable({
  getElementById: getEl,
  createElement: (t2) => (t2 === "canvas" ? fakeCanvas() : getEl("_" + t2)),
  createElementNS: (ns, t2) => getEl("_" + t2),
  body: getEl("body"), documentElement: getEl("html"),
  removeEventListener() {}, fonts: { load: () => Promise.resolve() }, hidden: false,
});
global.navigator = { userAgent: "sim" };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} createOscillator(){return{frequency:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},start(){},stop(){},type:""}}createGain(){return{gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}} get destination(){return {}} get currentTime(){return 0} };
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
  event: { listen: (name, cb) => { (listeners["tauri:" + name] = listeners["tauri:" + name] || []).push(cb); return Promise.resolve(() => {}); } },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8") +
  "\n;globalThis.__T = (expr) => eval(expr);";
try { (0, eval)(src); } catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }

const ev = (s) => global.__T(s);
const cvEl = els["c"];
const R = () => Math.random();
const RI = (n) => (Math.random() * n) | 0;

function pEvt(x, y, extra = {}) {
  return Object.assign({
    clientX: x, clientY: y, button: 0, detail: 1, timeStamp: performance.now(),
    pointerId: 1, preventDefault() {}, stopPropagation() {},
  }, extra);
}
const keyFor = (c) => ({ key: c, code: "Key" + c.toUpperCase(), preventDefault() {}, repeat: false });

const log = [];
function act(s) { log.push(s); if (log.length > 24) log.shift(); }

const frame = () => { simNow += 16.7; const cb = rafCb; rafCb = null; if (cb) cb(simNow); };
const frameOrThrow = () => frame();

// give it a save-free boot + a few pals and props to play with
(async () => {
await new Promise((r) => setImmediate(r));
for (let i = 0; i < 60; i++) frame();
ev("owned.push('berry','pebble','tide'); spawnPal(1); spawnPal(2); spawnPal(3);");
for (let i = 0; i < 60; i++) frame();

const KINDS = ["bowl", "cushion", "box", "plant", "music", "mirror", "mat", "jar", "ball"];
let crashes = 0, violations = 0;
const seen = new Set();
let pointerUps = 0, pointerCancels = 0, activeDragCancels = 0;
let terminalCleanupChecks = 0, palCancelChecks = 0;

function checkTerminalCleanup(kind, wasActive, cancelledPal = null) {
  if (!wasActive) return;
  terminalCleanupChecks++;
  const stillActive = ev("!!(held || palHeld || ballHeld || propHeld || fabDrag || volDrag)");
  const staleCursor = ev("cv.style.cursor === 'grabbing'");
  if (stillActive || staleCursor) {
    violations++;
    console.log(`INVARIANT ${kind} left drag state: active=${stillActive} cursor=${staleCursor}`);
  }
  if (cancelledPal) {
    palCancelChecks++;
    if (cancelledPal.fly !== true || cancelledPal.vx !== 0 || cancelledPal.vy !== 0) {
      violations++;
      console.log(`INVARIANT ${kind} left companion frozen: fly=${cancelledPal.fly} vx=${cancelledPal.vx} vy=${cancelledPal.vy}`);
    }
  }
}

function invariant(tag) {
  const bad = [];
  try {
    if (!Number.isFinite(ev("petX")) || !Number.isFinite(ev("petY"))) bad.push("pet pos NaN");
    const palBad = ev(`pals.filter(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)).length`);
    if (palBad) bad.push(palBad + " pals NaN pos");
    if (ev("palHeld && !pals.includes(palHeld)")) bad.push("palHeld dangling");
    const n = ev("pals.length");
    if (n < 0 || n > 12) bad.push("pals.length=" + n);
    for (const a of ["bangs", "fx", "crumbs", "hearts", "ripples"]) {
      const m = ev(a + ".length");
      if (m > 600) bad.push(a + "=" + m + " (leak?)");
    }
    if (!ev("['idle','sleeping','walk','drag','thrown','climbing','dizzy'].includes(state)")) bad.push("state=" + ev("state"));
    for (const q of ["chatMate", "follow"]) {
      const dangling = ev(`pals.filter(p=>p.${q} && !pals.includes(p.${q})).length`);
      if (dangling) bad.push(dangling + ` dangling ${q}`);
    }
    const tagDangle = ev(`pals.filter(p=>p.tag && p.tag.on && !pals.includes(p.tag.on)).length`);
    if (tagDangle) bad.push(tagDangle + " dangling tag.on");
    const stackDangle = ev(`pals.filter(p=>p.stackOn && !pals.includes(p.stackOn)).length`);
    if (stackDangle) bad.push(stackDangle + " dangling stackOn");
    // props must sit on a live platform — a stale plat means the shelf
    // vanished and the prop is hovering mid-air
    const propFloat = ev(`[bowl,cushion,box,plant,music,mirror,mat,jar,egg].filter(p=>p && p.plat && !plats.includes(p.plat) && !monPlats.includes(p.plat)).length`);
    if (propFloat) bad.push(propFloat + " props on dead platforms");
  } catch (e) { bad.push("invariant eval failed: " + e.message); }
  if (bad.length) { violations++; console.log(`INVARIANT [f${iFrame}] ${tag}: ${bad.join("; ")}`); }
}

let iFrame = 0;
const N = parseInt(process.argv[2] || "6000", 10);
const reportEvery = Math.max(1, Math.floor(N / 10));
console.log(`fuzzing ${N} frames (seed ${FUZZ_SEED})...`);
for (iFrame = 0; iFrame < N; iFrame++) {
  try {
    // random input actions
    const a = R();
    if (a < 0.30) { // mouse move
      const x = RI(1920), y = RI(1080);
      act(`mousemove ${x},${y}`);
      cvEl.fire("pointermove", pEvt(x, y));
    } else if (a < 0.42) { // click (down+up, maybe drag)
      const cancelGesture = R() < 0.15;
      let x = RI(1920), y = RI(1080);
      // Aim some cancellation gestures at a live draggable so the gate
      // exercises real teardown, not only pointercancel on empty desktop.
      if (cancelGesture && R() < 0.7) {
        const target = ev(`(function(){
          const p = pals.find(q => performance.now() >= (q.hideUntil || 0));
          if (p && Math.random() < 0.75) return [p.x, p.y - 20];
          if (!petHome && performance.now() >= boxHide) return [petX, petY - 20];
          return p ? [p.x, p.y - 20] : null;
        })()`);
        if (target) { x = target[0]; y = target[1]; }
      }
      act(`pointerdown ${x},${y}`);
      cvEl.fire("pointerdown", pEvt(x, y, { detail: R() < 0.1 ? 2 : 1 }));
      if (R() < 0.4) { // drag a bit
        for (let k = 0; k < 8; k++) { const nx = x + RI(200) - 100, ny = y + RI(120) - 60; cvEl.fire("pointermove", pEvt(nx, ny)); }
      }
      if (cancelGesture) {
        const active = ev("!!(held || palHeld || ballHeld || propHeld || fabDrag || volDrag)");
        const cancelledPal = ev("palHeld");
        act(`pointercancel`);
        cvEl.fire("pointercancel", pEvt(x, y));
        pointerCancels++;
        if (active) activeDragCancels++;
        checkTerminalCleanup("pointercancel", active, cancelledPal);
      } else {
        const active = ev("!!(held || palHeld || ballHeld || propHeld || fabDrag || volDrag)");
        act(`pointerup`);
        cvEl.fire("pointerup", pEvt(x + RI(60) - 30, y + RI(60) - 30, { detail: 1 }));
        pointerUps++;
        checkTerminalCleanup("pointerup", active);
      }
    } else if (a < 0.47) { // right click
      const x = RI(1920), y = RI(1080);
      act(`rmb ${x},${y}`);
      cvEl.fire("pointerdown", pEvt(x, y, { button: 2 }));
      cvEl.fire("contextmenu", pEvt(x, y));
      cvEl.fire("pointerup", pEvt(x, y, { button: 2 }));
    } else if (a < 0.62) { // typing burst
      const c = "abcdefghijklmnopqrstuvwxyz0123456789"[RI(36)];
      act(`key ${c}`);
      (listeners.keydown || []).forEach(fn => fn(keyFor(c)));
    } else if (a < 0.66) { // wheel
      act(`wheel`);
      cvEl.fire("wheel", pEvt(RI(1920), RI(1080), { deltaY: R() < 0.5 ? -120 : 120 }));
    } else if (a < 0.72) { // spawn/remove a pal
      if (R() < 0.55 && ev("pals.length") < 6) {
        const sp = 1 + RI(6);
        act(`spawnPal ${sp}`);
        ev(`owned.push(SPECIES[${sp}].id); spawnPal(${sp});`);
      } else if (ev("pals.length") > 0) {
        act("removePal random");
        ev(`if (pals.length) removePal(pals[${RI(12)} % pals.length])`);
      }
    } else if (a < 0.78) { // prop place/remove via direct var toggle
      const k = KINDS[RI(KINDS.length)];
      const has = ev(`!!(${k === "ball" ? "ball" : k})`);
      act(`prop ${k} ${has ? "off" : "on"}`);
      if (has) {
        ev(`(function(){const cur=${k === "ball" ? "ball" : k}; if(!cur)return; const nw=performance.now();
            for (const q of pals) { if (Math.abs(q.x-cur.x)<60 && Math.abs(q.y-cur.y)<40 && (nw<(q.restUntil||0)||nw<(q.hideUntil||0)||(q.propGoal&&q.propGoal.kind==='${k}'))) { q.restUntil=0;q.hideUntil=0;q.propGoal=null; } }
            ${k === "ball" ? "ball=null" : k + "=null"};})()`);
      } else {
        ev(`(function(){const p=spawnProp();
            ${k === "ball" ? "ball={x:petX+70,y:60,vx:0,vy:0,r:9,rot:0}" : k + "=p; if('" + k + "'==='bowl')p.fill=3; if('" + k + "'==='jar')p.fill=2"};})()`);
      }
    } else if (a < 0.82) { // throw a treat
      act("treatFly");
      ev(`treatFly = {x: 200 + ${RI(1400)}, y: 120, vx: 60, vy: 40, kind: ${RI(5)}};`);
    } else if (a < 0.855) { // wake/sleep
      act("state flip");
      ev(`state = ${R() < 0.5 ? "'sleeping'" : "'idle'"};`);
    } else if (a < 0.885) { // gacha pull / breed (economy paths)
      if (R() < 0.5) { act("pull"); ev("jelly += 60; doPull();"); }
      else { act("breed"); ev("jelly += 30; breedReadyAt = 0; breedSel = [0, 1]; doBreed(); breedMode = false; breedSel = [];"); }
    } else if (a < 0.91) { // overlay toggles then click through them
      act("overlay churn");
      ev("settingsOpen = " + (R() < 0.3) + "; gemShop = " + (R() < 0.2) + "; ranchOpen = " + (R() < 0.4) + "; shopMode = " + (R() < 0.2) + "; infoPick = " + (R() < 0.2 ? "0" : "null") + ";");
    } else if (a < 0.93) { // pet home + back
      act("petHome round trip");
      ev("if (!petHome) sendPetHome(); else { petHome = false; state = 'idle'; awakeAt = Date.now(); }");
    } else if (a < 0.955) { // send pal home
      if (ev("pals.length") > 0) {
        act("sendPalHome");
        ev(`if (pals.length) sendPalHome(pals[${RI(12)} % pals.length]);`);
      }
    } else if (a < 0.975) { // platform scan churn — windows come and go
      act("platforms churn");
      const set = [];
      if (R() < 0.7) set.push([200 + RI(1000), 200 + RI(500), 300 + RI(400)]);
      if (R() < 0.4) set.push([100 + RI(1600), 150 + RI(600), 200 + RI(300)]);
      (listeners["tauri:platforms"] || []).forEach(fn => fn({ payload: set }));
    } else { // resize
      act("resize");
      global.innerWidth = 800 + RI(1400); global.innerHeight = 500 + RI(700);
      (listeners.resize || []).forEach(fn => fn());
      global.innerWidth = 1920; global.innerHeight = 1080;
      (listeners.resize || []).forEach(fn => fn());
    }
    frameOrThrow();
    if (iFrame % 150 === 0) invariant("periodic");
  } catch (e) {
    crashes++;
    const sig = (e.stack || String(e)).split("\n").slice(0, 3).join(" | ");
    if (!seen.has(sig)) {
      seen.add(sig);
      console.log(`\nCRASH [f${iFrame}] ${e.message}\n  ${sig}\n  last actions: ${log.join(" > ")}`);
    }
    if (crashes > 12) { console.log("too many crashes, stopping"); break; }
  }
  if ((iFrame + 1) % reportEvery === 0 || iFrame + 1 === N) {
    const pct = Math.floor(((iFrame + 1) * 100) / N);
    console.log(`progress: ${iFrame + 1}/${N} (${pct}%) crashes=${crashes} violations=${violations}`);
  }
}
invariant("final");
if (N >= 100 && (!pointerCancels || !activeDragCancels)) {
  violations++;
  console.log(`INVARIANT fuzz missed active cancellation: cancel=${pointerCancels} active=${activeDragCancels}`);
}
if (N >= 1000 && !palCancelChecks) {
  violations++;
  console.log("INVARIANT fuzz missed companion cancellation physics");
}
try {
  console.log("state:", JSON.stringify(ev(`({jelly, xp, plays: stats.plays, treats: stats.treats, keys: stats.keys, pals: pals.length, bangs: bangs.length, held: !!palHeld, state})`)));
} catch (e) { console.log("state dump failed:", e.message); }
console.log(`input terminals: pointerup=${pointerUps} cancel-before-up=${pointerCancels} active-drag-cancel=${activeDragCancels} cleanup-checks=${terminalCleanupChecks} pal-cancel-checks=${palCancelChecks}`);
console.log(`\ndone: ${crashes} crashes (${seen.size} unique), ${violations} invariant violations`);
process.exit(crashes || violations ? 2 : 0);
})();

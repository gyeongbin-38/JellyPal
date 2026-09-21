// behavior verification harness — same DOM stubs as _sim.cjs, but instead
// of just crash-checking it DRIVES scenarios: injects cursor/state via
// eval into main.js's global scope, pumps frames, and asserts each
// interaction actually fires. "code exists" != "it triggers".
const fs = require("fs");

const calls = [];
const crashMsgs = []; // log_crash payloads — args.msg captured for diagnosis
let lastSave = null; // save_state json captured by the invoke stub
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

const tauriState = {
  ver: 2, jelly: 5000, active: "sprout",
  owned: ["sprout", "berry", "pebble", "tide", "ember", "shade", "gold"],
  pals: ["tide", "ember"], // state stores species ids, not indices
};
const callArgs = {}; // last args object seen per invoke cmd
global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      calls.push(cmd);
      if (args) callArgs[cmd] = args;
      if (cmd === "log_crash" && args) crashMsgs.push(args.msg);
      if (cmd === "save_state" && args) lastSave = args.json;
      if (cmd === "load_state") return Promise.resolve(JSON.stringify(tauriState)); // real backend returns a JSON string
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      if (cmd === "is_demo") return Promise.resolve(false);
      // mock the Rust verifier: a well-formed signed code pays its pack
      if (cmd === "verify_gem_code") {
        const m = args && /^JELLYPAL-([A-D])-[A-Z2-7]{8}-[A-Z2-7]{90,}$/.exec(args.code);
        return m ? Promise.resolve({ A: 250, B: 500, C: 1000, D: 2500 }[m[1]])
                 : Promise.reject("bad code");
      }
      return Promise.resolve(null);
    },
  },
  event: { listen: () => Promise.resolve(() => {}) },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync("src/main.js", "utf8");
// bridge: indirect-eval'd `let` bindings are discarded when the eval
// returns, so we append an accessor that evals INSIDE main.js's scope —
// __E("petX") sees every internal let/const/function
try { (0, eval)(src + "\n;globalThis.__E = (c) => eval(c);"); }
catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }

// the frame clock is the rAF timestamp — track it ourselves so injected
// timestamps live in the same time domain as the loop
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

(async () => {
  await new Promise((r) => setImmediate(r));
  await pump(40); // boot: state load, spawn, first frames

  // sanity: pet exists on the ground
  check("pet spawned", E("petX") > 0 && E("petY") > 0, `x=${E("petX").toFixed(0)} y=${E("petY").toFixed(0)}`);
  check("not home", !E("petHome"));

  // wait until grounded + idle so tests start clean
  for (let i = 0; i < 300 && !(E("!flying && !sigT0") && E("state") === "idle"); i++) await pump(1);

  // ---- 1. PARKED CURSOR: a still nearby cursor earns a glance, no mount ----
  E("curX = petX + 70; curY = petY - 10; curV = 0; lastCurT = -1e9"); // -1e9 => decayed already => curV stays 0
  await pump(60); // ~1s parked — the pet pauses and looks over
  check("parked cursor earns a glance", E("lookUntil") > 0 && E("lookDir") === 1, `dir=${E("lookDir")}`);
  check("no cursor mounting exists", E("typeof rideT0") === "undefined", "ride feature removed");
  E("curX = petX + 400; curV = 0");
  await pump(30);

  // ---- 4. HUNT: fast cursor whips nearby trigger the stalk ----
  let hunted = false;
  for (let i = 0; i < 60 && !hunted; i++) {
    E(`curV = 700; lastCurT = ${tNow}; curX = petX + 140; curY = petY - 30`);
    await pump(1);
    hunted = E("huntT0") > 0;
  }
  check("hunt stalk triggers", hunted);
  for (let i = 0; i < 200 && E("huntT0"); i++) await pump(1);
  check("pounce resolved", E("huntT0") === 0 && E("huntCd") > 0, `huntCd=${E("huntCd").toFixed(0)}`);
  E("curV = 0; lastCurT = -1e9");
  for (let i = 0; i < 300 && E("flying"); i++) await pump(1);

  // ---- 5. every species signature act completes ----
  const sigs = E("SPECIES.map((s,i)=>s&&s.sig?[i,s.sig,s.id]:null).filter(Boolean)");
  for (const [idx, sig, sid] of sigs) {
    E(`active=${idx}; sigId="${sig}"; sigT0=${tNow}; sigInit=0; flying=false; petVX=0; petVY=0; walkTarget=null; hopTarget=null`);
    let done = false;
    for (let i = 0; i < 400 && !done; i++) { await pump(1); done = E("sigT0") === 0; }
    check(`sig ${sid}/${sig}`, done);
    E("sigT0=0; sigId=null; sigInit=0; flying=false; petVX=0; petVY=0; webbing=false; angle=0");
  }
  E("active=0");

  // ---- 5b. per-species audit: every slime's profile resolves (psych,
  // movement, face) and each can run a real accessory act end-to-end —
  // rotates through the whole act table so every doodad gets sampled ----
  const allSp = E("SPECIES.map((s,i)=>s&&s.id?[i,s.id]:null).filter(Boolean)");
  const actIds = E("Object.keys(ACC_ACTS)");
  for (const [idx, sid] of allSp) {
    // pin wander/flair far ahead — rare+legendary species wander so often
    // the act never finds a quiet frame otherwise (that's the product's
    // intended rarity cadence, not a bug: commons get idle time sooner)
    E(`active=${idx}; flying=false; sigT0=0; sigId=null; petVX=0; petVY=0; walkTarget=null; hopTarget=null; accAct=null; propSpin=0; state="idle"; held=0; petHome=false; shockUntil=0; treatAim=false; snack=null; treat=null; nextWander=${tNow}+9e9; legFlairT=${tNow}+9e9; begUntil=0; ignoreT=0; curV=0; curX=-9999; curY=-9999; webCd=${tNow}+9e9; webbing=false; climbing=false; climbPhase=0`);
    const pj = JSON.parse(E(`JSON.stringify({ps:SPECIES[${idx}].ps,mv:SPECIES[${idx}].mv||"walk",okps:!!PSYCH[SPECIES[${idx}].ps],okmv:["walk","hover","blink","scurry","hop"].includes(SPECIES[${idx}].mv||"walk"),face:FACES[faceName(${tNow})]!=null})`));
    check(`species ${sid}: profile+face`, pj.okps && pj.okmv && pj.face, `ps=${pj.ps} mv=${pj.mv}`);
    const eq = actIds[idx % actIds.length];
    E(`accEquip["${sid}"]="${eq}"; accActNext=0`);
    let started = false, done = false;
    for (let i = 0; i < 500 && !done; i++) { await pump(1); if (E("accAct")) started = true; else if (started) done = true; }
    const gate = started ? "" : E(`JSON.stringify({fly:flying,web:webbing,climb:climbing,home:petHome,st:state,sig:sigT0,wt:String(walkTarget),ht:String(hopTarget),cv:curV.toFixed(0),nx:accActNext-${tNow},spin:spinT0,dance:danceT0,bl:blanketT0,sit:sitUntil-${tNow},hunt:huntT0})`);
    check(`species ${sid}: act "${eq}"`, started && done, `started=${started} ${gate}`);
    E(`accAct=null; propSpin=0; flying=false; petVX=0; petVY=0; accEquip["${sid}"]=null`);
  }
  E("active=0");

  // ---- 6. legFlair for every legendary ----
  let flairOk = true, flairMsg = "";
  for (const sid of E("SPECIES.map(s=>s.id)")) {
    try { E(`(SPECIES.find(s=>s.id==="${sid}")||{}).r>=3 && legFlair(SPECIES.find(s=>s.id==="${sid}"), ${tNow})`); }
    catch (e) { flairOk = false; flairMsg = sid + ":" + e.message; }
  }
  check("legFlair all legendaries", flairOk, flairMsg);
  await pump(30);

  // ---- 7. CUDDLE: held + still melts ----
  for (let i = 0; i < 300 && E("flying"); i++) await pump(1);
  E("held = 1; dragVX = 0; dragVY = 0");
  await pump(90);
  check("hold-cuddle triggers", E("cuddleUntil") > 0 || E("contentUntil") > tNow);
  E("held = 0");

  // ---- 8. CIRCLE TRICK: orbit the pet fast ----
  for (let i = 0; i < 300 && E("flying"); i++) await pump(1); // land first
  E(`nextWander = ${tNow} + 99999; walkTarget = null; hopTarget = null; egg = null`); // no random hops mid-trick
  let circled = false;
  for (let a = 0; a < 12 && !circled; a += 0.22) {
    E(`curX = petX + Math.cos(${a}) * 150; curY = petY - 30 + Math.sin(${a}) * 150; curV = 700; lastCurT = ${tNow}`);
    await pump(1);
    circled = E("dizzyUntil") > tNow || E("spinT0") > 0;
  }
  check("cursor circle trick", circled,
    `circScore=${E("circScore").toFixed(2)} cdist=${E("Math.hypot(curX-petX, curY-(petY-30))").toFixed(0)} flying=${E("flying")} sigT0=${E("sigT0")}`);
  E("curV = 0; lastCurT = -1e9; spinT0 = 0; dizzyUntil = 0");

  // ---- 9. SCRITCH: rub cursor back and forth over the body ----
  let scritched = false;
  for (let i = 0; i < 14 && !scritched; i++) {
    E(`curVX = ${i % 2 ? 350 : -350}; curV = 350; curX = petX; curY = petY - 20; lastCurT = ${tNow}`);
    await pump(1);
    scritched = E("contentUntil") > tNow;
  }
  check("cursor scritch (petting)", scritched, `rubCount=${E("rubCount").toFixed(1)}`);

  // ---- 10. BOOP: slow push into the body makes it hop back ----
  E("contentUntil = 0; curV = 0");
  const bx0 = E("petX");
  for (let i = 0; i < 90; i++) {
    E(`curX = petX + 12; curY = petY - 15; curV = 100; curVX = 100; lastCurT = ${tNow}`);
    await pump(1);
    if (E("poutUntil") > tNow || E("flying")) break;
  }
  check("boop hops away + pout", E("poutUntil") > tNow || Math.abs(E("petX") - bx0) > 30 || E("flying"));
  E("curV = 0; curVX = 0; lastCurT = -1e9; curX = -9999; curY = -9999");
  for (let i = 0; i < 300 && E("flying"); i++) await pump(1);
  await pump(60); // let any perch charge fully reset far from the pet

  // ---- 11. TREAT: main pet walks over and eats ----
  E(`treat = { x: petX + 130, y: petY, t0: ${tNow}, kind: 0 }`);
  let ate = false;
  for (let i = 0; i < 400 && !ate; i++) { await pump(1); ate = E("treat") === null; }
  check("main pet eats treat", ate,
    `treats=${E("stats.treats")} tx=${E("treat?treat.x:-1").toFixed(0)} petX=${E("petX").toFixed(0)} wt=${E("String(walkTarget)")} sig=${E("sigT0")} snack=${E("String(!!snack)")} fly=${E("flying")}`);

  // ---- 12. PAL EATS: drop a treat right on a pal ----
  const palCount = E("pals.length");
  if (palCount > 0) {
    // neutralize busy states — a pal mid-tag-game or mid-flight ignores
    // snacks by design; we want the eat path itself, not the race. pin
    // wander too so nobody strolls off before the bite lands. seat them
    // on the floor deck: stale platforms now read as REAL falls (the
    // hovering fix), which would skip the grounded eat check entirely
    E("for (const p of pals) { p.tag = null; p.stackOn = null; p.fly = false; p.web = 0; p.walkT = null; p.follow = null; p.nextT = 9e9; p.propGoal = null; p.x = plats[0].x + 400 + pals.indexOf(p) * 90; p.y = plats[0].y; p.plat = plats[0]; }");
    await pump(5);
    E(`treat = { x: pals[0].x + 5, y: pals[0].y, t0: ${tNow}, kind: 0 }`);
    ate = false;
    for (let i = 0; i < 200 && !ate; i++) {
      E("if (pals[0]) { pals[0].walkT = null; pals[0].tag = null; pals[0].follow = null; pals[0].propGoal = null; }"); // social rolls re-queue walks mid-window
      await pump(1);
      ate = E("treat") === null;
    }
    check("pal can eat treat", ate);
  }

  // ---- 13. GAIT: walking drives the distance-based step cycle ----
  E("flying = false; petVY = 0; petVX = 0; gaitPhase = 0; walkTarget = petX + 120; curX = -9999; curY = -9999; hopTarget = null; sitUntil = 0; snack = null; danceT0 = 0; blanketT0 = 0");
  let spd = 0;
  for (let i = 0; i < 40; i++) { await pump(1); spd = Math.max(spd, E("petSpd")); } // peak mid-walk speed — arrival decays it back to 0
  const gait = E("gaitPhase");
  check("walk gait advances with speed", gait > 0.5 && spd > 5, `gait=${gait.toFixed(2)} spd=${spd.toFixed(0)}`);
  E("walkTarget = null; petSpd = 0");

  // ---- 14. PAL BUMP: main pet walks through a pal → tiny hop ----
  if (palCount > 0) {
    E(`for (const p of pals) { p.tag = null; p.stackOn = null; p.fly = false; p.follow = null; p.walkT = null; }`);
    E(`pals[0].x = petX + 24; pals[0].y = petY; pals[0].bumpCd = 0; petSpd = 60;`);
    await pump(3);
    check("pal bump → hop + face", E("pals[0].fly") || E("pals[0].faceT") > 0, `fly=${E("pals[0].fly")} face=${E("pals[0].faceId")}`);
    E("petSpd = 0; for (const p of pals) { p.fly = false; }");
    await pump(20);
  }

  // ---- 14b. TAG RESOLVES: a chase used to footrace forever — both pals
  // walk the same speed so the tagger could never catch up. now the
  // tagger pounce-hops, the fleer stumbles, and a timeout ends with a
  // mutual laugh beat instead of the tags silently evaporating ----
  if (palCount > 1) {
    // pin the pet too — a mid-chase wander could bump a pal and overwrite
    // the resolution faces before the assert reads them
    E(`walkTarget = null; hopTarget = null; nextWander = ${tNow} + 9e9; flying = false; petVX = 0; petVY = 0; treat = null; snack = null; treatAim = false; curX = -9999; curY = -9999`);
    E(`for (const p of pals) { p.tag = null; p.stackOn = null; p.stackCd = 9e9; p.fly = false; p.web = 0; p.follow = null; p.walkT = null; p.nextT = 9e9; p.propGoal = null; p.accCd = 9e9; p.socCd = 9e9; p.playCd = 9e9; p.restUntil = 0; p.hideUntil = 0; p.sigT = 0; p.sigId = null; p.accAct = null; p.faceT = 0; p.faceId = null; }
       pals[0].x = plats[0].x + 300; pals[0].y = plats[0].y; pals[0].plat = plats[0];
       pals[1].x = plats[0].x + 500; pals[1].y = plats[0].y; pals[1].plat = plats[0];
       pals[0].tag = { on: pals[1], it: true, until: ${tNow} + 3200 };
       pals[1].tag = { on: pals[0], it: false, until: ${tNow} + 3200 };`);
    // 0.99 suppresses every random roll mid-chase: no pounce, no copycat
    // hop, no stumble — the chase can only end on the timeout laugh beat
    E("window.__mr2 = Math.random; Math.random = () => 0.99");
    for (let i = 0; i < 320 && (E("pals[0].tag") || E("pals[1].tag")); i++) await pump(1);
    E("Math.random = window.__mr2");
    check("tag chase resolves", !E("pals[0].tag") && !E("pals[1].tag"),
      `t0=${JSON.stringify(E("pals[0].tag"))} t1=${JSON.stringify(E("pals[1].tag"))}`);
    const f0 = E("pals[0].faceId"), f1 = E("pals[1].faceId");
    check("tag ends with a beat (catch or timeout laugh)",
      (f0 === "wink" || f0 === "laugh") && f1 === "laugh", `faces=${f0},${f1}`);
    await pump(80); // faces wash out
    E(`for (const p of pals) { p.playCd = 0; p.socCd = 0; p.accCd = 0; p.nextT = 0; }`);
  }

  // ---- 15. BALL: drops, bounces, settles on a deck, pals nudge it ----
  E(`ball = { x: petX, y: 60, vx: 0, vy: 0, r: 9, rot: 0 }`);
  await pump(300); // ~5s — falls, bounces a few times, settles
  check("ball settles on a platform", E("ball && Math.abs(ball.vy) < 60 && ball.y > 200"), `y=${E("ball && ball.y").toFixed(0)} vy=${E("ball && ball.vy").toFixed(0)}`);
  if (palCount > 0) {
    E(`pals[0].x = plats[0].x + 500; pals[0].y = plats[0].y; pals[0].plat = plats[0]; pals[0].stackOn = null; pals[0].tag = null;`);
    E(`ball.x = pals[0].x + 18; ball.y = pals[0].y; ball.vx = 0; ball.vy = 0; pals[0].ballCd = 0; pals[0].fly = false`);
    await pump(3);
    check("pal nudges the ball", Math.abs(E("ball.vx")) > 15 || E("ball.vy") < 0, `vx=${E("ball && ball.vx").toFixed(0)} vy=${E("ball && ball.vy").toFixed(0)}`);
  }
  E("ball = null");

  // ---- 16. HINTS: drip fires once, marks itself seen ----
  E("hintsSeen = {}; hintDrip = 0");
  await pump(3);
  check("discovery hint fires", E("hintUntil") > 0, `until=${E("hintUntil").toFixed(0)}`);
  E("hintUntil = 0; hintDrip = 1e18");
  E("flying = true; petVY = 50");
  for (let i = 0; i < 300 && E("flying"); i++) await pump(1);

  // ---- 17. BOWL: a placed bowl draws the pet over for a snack ----
  E(`munchUntil = 0; bowlCd = 0; flying = false; sigT0 = 0; held = 0; snack = null; treat = null; walkTarget = null; hopTarget = null; sitUntil = 0; curX = -9999; curY = -9999; curV = 0; lastCurT = -1e9`);
  E(`bowl = { x: petX + 170, y: petY, plat: null }`);
  E(`walkTarget = bowl.x - 18; walkGoal = { kind: "bowl" }`);
  let munched = false;
  for (let i = 0; i < 900 && !munched; i++) { await pump(1); munched = E("munchUntil") > tNow; }
  check("bowl stroll → munch ritual", munched, `munchUntil=${E("munchUntil").toFixed(0)} bowlCd=${E("bowlCd").toFixed(0)}`);
  check("bowl cooldown set", E("bowlCd") > tNow);

  // ---- 18. CUSHION: stroll → plop → nap face ----
  E(`munchUntil = 0; contentUntil = 0; cushionCd = 0; cushionNap = 0; flying = false; sigT0 = 0; walkTarget = null; hopTarget = null; sitUntil = 0`);
  E(`cushion = { x: petX + 150, y: petY, plat: null }`);
  E(`walkTarget = cushion.x; walkGoal = { kind: "cushion" }`);
  let napped = false;
  for (let i = 0; i < 900 && !napped; i++) { await pump(1); napped = E("cushionNap") > tNow; }
  check("cushion stroll → nap", napped, `nap=${E("cushionNap").toFixed(0)} now=${tNow.toFixed(0)}`);
  if (napped) {
    // clear competing faces and check WITHOUT pumping — a pal kiss or
    // scurry-gait munch would re-set a face timer between frames
    E("contentUntil = 0; munchUntil = 0; smugUntil = 0; shockUntil = 0; poutUntil = 0");
    check("nap face = sleeping", E(`faceName(${tNow})`) === "sleeping", E(`faceName(${tNow})`));
  }
  E("sitUntil = 0; cushionNap = 0");

  // ---- 19. STALE GOAL: a diverted errand doesn't fire the ritual ----
  // watch bowlCd, not munchUntil — scurry-gait species set munchUntil every
  // walking frame, so the face timer can't distinguish ritual from gait
  E(`munchUntil = 0; bowl.x = petX + 800; bowlCd = 0; walkTarget = petX; walkGoal = { kind: "bowl" }`);
  await pump(5); // arrives instantly — 800px away from the bowl
  check("stale prop goal ignored", E("bowlCd") <= tNow, `bowlCd=${E("bowlCd")}`);
  E("walkGoal = null; walkTarget = null");

  // ---- 19b. BOX: stroll → dive in → parked while hidden → tap pops out ----
  E(`boxHide = 0; boxCd = 0; flying = false; sigT0 = 0; held = 0; walkGoal = null; walkTarget = null; hopTarget = null;
     sitUntil = 0; cushionNap = 0; state = "idle"; nextWander = ${tNow} + 9e9; treat = null; snack = null; treatAim = false;
     curX = -9999; curY = -9999; curV = 0; petHome = false`);
  E(`box = { x: petX + 140, y: petY, plat: null }`);
  E(`walkTarget = box.x - 10; walkGoal = { kind: "box", tx: box.x - 10 }`);
  let hid = false;
  for (let i = 0; i < 900 && !hid; i++) { await pump(1); hid = E("boxHide") > tNow; }
  check("box stroll → hide inside", hid, `hide=${E("boxHide")} now=${tNow.toFixed(0)}`);
  const pxH = E("petX");
  await pump(90);
  check("hidden pet stays parked", Math.abs(E("petX") - pxH) < 3 && !E("walkTarget"), `dx=${Math.abs(E("petX") - pxH).toFixed(1)}`);
  E(`propTap("box", box)`);
  check("box tap ejects the squatter", E("boxHide") <= tNow && E("flying"), `hide=${E("boxHide")} fly=${E("flying")}`);
  for (let i = 0; i < 400 && E("flying"); i++) await pump(1);
  E("shockUntil = 0; flying = false; petVX = 0; petVY = 0");

  // ---- 19z. SLEEP INTEGRITY: nothing moves a sleeper ----
  // (a) doze-off mid-climb releases with NO lateral drift — it used to
  // inherit ±120px/s and glide sideways with a sleeping face + zzz
  E(`state = "idle"; held = false; flying = false; petHome = false; webbing = false;
     climbing = true; climbUntil = ${tNow} + 99999; climbEdge = 24;
     spinT0 = ${tNow}; huntScore = 0.5; circScore = 3; petVX = 0; walkTarget = null;
     awakeAt = Date.now() - 9e9; noSleepUntil = 0; pomo = false`);
  for (let i = 0; i < 30 && E("state") !== "sleeping"; i++) await new Promise((r) => setTimeout(r, 100)); // real 1s interval
  check("mid-climb doze releases the wall", E("climbing") === false && E("state") === "sleeping",
    `climb=${E("climbing")} state=${E("state")}`);
  check("doze-off drops straight down", E("petVX") === 0, `vx=${E("petVX")}`);
  check("doze clears leftover act state", E("spinT0") === 0 && E("huntScore") === 0 && E("circScore") === 0,
    `spin=${E("spinT0")} hunt=${E("huntScore")} circ=${E("circScore")}`);
  E(`state = "idle"; awakeAt = Date.now(); flying = false; petVX = 0; petVY = 0;
     petX = plats[0].x + 300; petY = plats[0].y`);

  // (b) a window sliding under a sleeper jolts it awake — it used to surf
  // the title bar with its eyes closed
  E(`state = "sleeping"; awakeAt = 0; cushionNap = 0; cushionNapW = 0; held = false;
     flying = false; webbing = false; petHome = false; shockUntil = 0;
     petX = plats[0].x + 300; petY = plats[0].y; walkTarget = null; curX = -9999; curV = 0;
     prevSupX = 0; prevSupY = 0`);
  await pump(2); // settle prevSup on the current deck
  const sxB = E("petX");
  E(`prevSupX = prevSupX - 60;`); // the deck slid +60px between polls
  await pump(1);
  check("surf jolt wakes a sleeping pet", E("awakeAt") > 0, `awakeAt=${E("awakeAt")}`);
  check("jolt reads as a scare", E("shockUntil") > tNow, `shock=${E("shockUntil")}`);
  check("pet rides its deck (+60)", Math.abs(E("petX") - (sxB + 60)) < 2, `dx=${(E("petX") - sxB).toFixed(1)}`);
  // same jolt breaks a cushion doze
  E(`state = "sleeping"; awakeAt = 0; cushionNap = ${tNow} + 99999; cushionNapW = Date.now() + 99999;
     shockUntil = 0`);
  await pump(1);
  E(`prevSupX = prevSupX - 60;`);
  await pump(1);
  check("surf jolt breaks a cushion nap", E("cushionNap") === 0, `nap=${E("cushionNap")}`);
  E(`state = "idle"; awakeAt = Date.now(); cushionNap = 0; cushionNapW = 0; shockUntil = 0`);

  // (c) a napping pal whose deck vanishes wakes up falling — it used to
  // keep restUntil and drop with a sleeping face
  E(`plats.push({ x: 500, y: 500, w: 400 });`);
  await pump(1);
  E(`pals[0].x = 700; pals[0].y = 500; pals[0].fly = false; pals[0].walkT = null;
     pals[0].stackOn = null; pals[0].tag = null; pals[0].web = 0;
     pals[0].plat = { x: 500, y: 500, w: 400 }; pals[0].restUntil = ${tNow} + 99999;
     pals[0].faceT = 0;`);
  E(`plats = plats.filter((p) => !(p.x === 500 && p.y === 500 && p.w === 400));`); // window closed
  await pump(2);
  check("deck drop wakes a napping pal", E("pals[0].restUntil") === 0 && E("pals[0].fly") === true,
    `rest=${E("pals[0].restUntil")} fly=${E("pals[0].fly")}`);
  check("falling pal shows shock", E("pals[0].faceId") === "shock", `face=${E("pals[0].faceId")}`);
  for (let i = 0; i < 600 && E("pals[0].fly"); i++) await pump(1); // let it land
  E(`pals[0].faceT = 0; pals[0].faceId = "idle"; pals[0].restCd = 0`);

  // ---- 19c. PLANT: sniff → nuzzle or sneeze, always a cooldown ----
  E(`plantCd = 0; contentUntil = 0; shockUntil = 0; poutUntil = 0; walkGoal = null; walkTarget = null; flying = false`);
  E(`plant = { x: petX + 40, y: petY, plat: null }`);
  E(`propArrive({ kind: "plant", tx: petX }, ${tNow})`);
  check("plant sniff ritual fires", E("plantCd") > tNow && (E("contentUntil") > tNow || E("shockUntil") > tNow),
    `cd=${E("plantCd")} content=${E("contentUntil")} shock=${E("shockUntil")}`);

  // ---- 19d. MUSIC BOX: wind it → the pet dances, the key spins ----
  E(`musicCd = 0; danceT0 = 0; walkGoal = null; walkTarget = null; flying = false; sigT0 = 0`);
  E(`music = { x: petX + 40, y: petY, plat: null }`);
  E(`propArrive({ kind: "music", tx: petX }, ${tNow})`);
  check("music winds → pet dances", E("danceT0") > 0 && E("musicCd") > tNow, `dance=${E("danceT0")} cd=${E("musicCd")}`);
  check("music key spinning", E("music && music.spinUntil") > Date.now(), `spin=${E("music && music.spinUntil")}`);
  if (palCount > 0) {
    // a nearby grounded pal bounces along to the tune
    E(`pals[0].x = music.x + 40; pals[0].y = music.y; pals[0].fly = false; pals[0].restUntil = 0; pals[0].walkT = null; pals[0].faceT = 0`);
    E(`propTap("music", music)`);
    check("pal bounces to the tune", E("pals[0].fly") || E("pals[0].faceId") === "happy",
      `fly=${E("pals[0].fly")} face=${E("pals[0].faceId")}`);
  }

  // ---- 19e. TOYBOX: the chooser strip toggles the new props too ----
  E("fabOpen = true; toyboxOpen = true; box = null; plant = null; music = null");
  const strip = JSON.parse(E("JSON.stringify(toyboxStripRect())"));
  const cnv3 = els.c;
  (cnv3.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: strip[0] + 3 * 36 + 18, clientY: strip[1] + 17, pointerId: 21, timeStamp: tNow }));
  check("toybox spawns a box", E("!!box"), `box=${JSON.stringify(E("box"))}`);
  (cnv3.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: strip[0] + 3 * 36 + 18, clientY: strip[1] + 17, pointerId: 21, timeStamp: tNow }));
  check("toybox toggles the box off", !E("box"));
  (cnv3.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: strip[0] + 4 * 36 + 18, clientY: strip[1] + 17, pointerId: 21, timeStamp: tNow }));
  check("toybox spawns a plant", E("!!plant"));
  (cnv3.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: strip[0] + 5 * 36 + 18, clientY: strip[1] + 17, pointerId: 21, timeStamp: tNow }));
  check("toybox spawns a music box", E("!!music"));
  E("fabOpen = false; toyboxOpen = false");

  if (palCount > 0) {
    // ---- 19f. PAL BOX: dives in, hides, can't be poked while inside ----
    E(`for (const p of pals) { p.fly = false; p.walkT = null; p.tag = null; p.restUntil = 0; p.hideUntil = 0; p.propGoal = null;
       p.nextT = ${tNow} + 999999; p.playCd = ${tNow} + 999999; p.socCd = ${tNow} + 999999; p.follow = null; p.sigT = 0; }`);
    if (!E("box")) E(`box = { x: pals[0].x + 30, y: plats[0].y, plat: plats[0] }`);
    E(`pals[0].x = box.x - 12; pals[0].y = box.y; pals[0].plat = box.plat || plats[0]; pals[0].walkT = pals[0].x; pals[0].propGoal = { kind: "box" }`);
    await pump(3);
    check("pal dives into the box", E("pals[0].hideUntil") > tNow, `hide=${E("pals[0].hideUntil")} now=${tNow.toFixed(0)}`);
    const hx = E("pals[0].x");
    await pump(60);
    check("hidden pal stays parked", Math.abs(E("pals[0].x") - hx) < 2, `dx=${Math.abs(E("pals[0].x") - hx).toFixed(1)}`);
    check("hidden pal can't be poked", E("palAt(pals[0].x, pals[0].y - 20) !== pals[0]"));
    E("pals[0].hideUntil = 0");
  }

  if (palCount > 0) {
    // ---- 19g. PAL CARD GEAR: single gear cell → modal picker ----
    E(`accOwned = ["cap","scarf"]; accEquip = {}`);
    E("openCard(pals[0])");
    await pump(2); // a drawCard frame populates cardGearCell
    check("card gear cell built", !!E("cardGearCell"), `cell=${E("JSON.stringify(cardGearCell)")}`);
    const gc = JSON.parse(E("JSON.stringify(cardGearCell)"));
    (els.kc.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: gc[0] + 3, clientY: gc[1] + 3, pointerId: 22 }));
    check("gear cell opens the modal", E("cardAccModal") === true);
    await pump(2); // the modal frame populates cardAccCells
    check("gear modal cells built", E("cardAccCells.length") >= 3, `n=${E("cardAccCells.length")}`);
    const cell2 = JSON.parse(E("JSON.stringify(cardAccCells[2])")); // [none, cap, scarf]
    (els.kc.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: cell2[0] + 3, clientY: cell2[1] + 3, pointerId: 22 }));
    check("modal click equips + closes", E("accEquip[SPECIES[pals[0].sp].id]") === "scarf" && E("cardAccModal") === false, E("JSON.stringify(accEquip)"));
    // reopen: "-" cell unequips
    (els.kc.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: gc[0] + 3, clientY: gc[1] + 3, pointerId: 22 }));
    await pump(2);
    const cell0 = JSON.parse(E("JSON.stringify(cardAccCells[0])"));
    (els.kc.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: cell0[0] + 3, clientY: cell0[1] + 3, pointerId: 22 }));
    check("'-' cell unequips", E("accEquip[SPECIES[pals[0].sp].id]") === undefined, E("JSON.stringify(accEquip)"));
    // ownership gate: nothing owned -> the picker lists ONLY the "-" cell,
    // so unpurchased doodads can never be picked through the UI
    E(`accOwned = []`);
    (els.kc.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: gc[0] + 3, clientY: gc[1] + 3, pointerId: 22 }));
    await pump(2);
    check("empty accOwned -> only '-' cell", E("cardAccCells.length") === 1 && E("cardAccCells[0][4]") === null,
      `cells=${E("JSON.stringify(cardAccCells.map(c=>c[4]))")}`);
    E("closeCard()");
    E(`accOwned = []`); // leave the sandbox clean
  }

  // ---- 19h. MIRROR/MAT/JAR: second-batch props each do their own bit ----
  E(`mirrorCd = 0; matCd = 0; jarCd = 0; smugUntil = 0; shockUntil = 0; poutUntil = 0;
     munchUntil = 0; contentUntil = 0; walkGoal = null; walkTarget = null; flying = false; treat = null`);
  E(`mirror = { x: petX + 40, y: petY, plat: null }`);
  E(`propArrive({ kind: "mirror", tx: petX }, ${tNow})`);
  check("mirror preen or flee fires", E("mirrorCd") > tNow && (E("smugUntil") > tNow || E("shockUntil") > tNow),
    `cd=${E("mirrorCd")} smug=${E("smugUntil")} shock=${E("shockUntil")}`);
  E(`flying = false; petVX = 0; petVY = 0; shockUntil = 0; poutUntil = 0`);

  E(`mat = { x: petX + 40, y: petY, plat: null }`);
  E(`propArrive({ kind: "mat", tx: petX }, ${tNow})`);
  check("mat launch: pet boings upward", E("flying") && E("petVY") < -100 && E("matCd") > tNow,
    `fly=${E("flying")} vy=${E("petVY")} cd=${E("matCd")}`);
  for (let i = 0; i < 400 && E("flying"); i++) await pump(1);
  E(`contentUntil = 0; walkTarget = null; walkGoal = null`);

  E(`jar = { x: petX + 40, y: petY, plat: null, fill: 2 }`);
  E(`propArrive({ kind: "jar", tx: petX }, ${tNow})`);
  check("jar nibble: fill drops, munch face", E("jar.fill") === 1 && E("munchUntil") > tNow && E("jarCd") > tNow,
    `fill=${E("jar.fill")} munch=${E("munchUntil")} cd=${E("jarCd")}`);
  E(`jar.fill = 0; munchUntil = 0; poutUntil = 0; jarCd = 0`);
  E(`propArrive({ kind: "jar", tx: petX }, ${tNow})`);
  check("empty jar → pout + '?'", E("poutUntil") > tNow && E("jar.fill") === 0, `pout=${E("poutUntil")}`);
  E(`treat = null; propTap("jar", jar)`);
  check("jar tap restocks + spills a real treat", E("jar.fill") === 3 && !!E("treat"), `fill=${E("jar.fill")} treat=${JSON.stringify(E("treat"))}`);
  E(`treat = null; poutUntil = 0; munchUntil = 0; contentUntil = 0`);

  // toybox slots 6/7/8 spawn the second-batch props
  E("fabOpen = true; toyboxOpen = true; mirror = null; mat = null; jar = null");
  const strip2 = JSON.parse(E("JSON.stringify(toyboxStripRect())"));
  (cnv3.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: strip2[0] + 6 * 36 + 18, clientY: strip2[1] + 17, pointerId: 23, timeStamp: tNow }));
  check("toybox spawns a mirror", E("!!mirror"));
  (cnv3.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: strip2[0] + 7 * 36 + 18, clientY: strip2[1] + 17, pointerId: 23, timeStamp: tNow }));
  check("toybox spawns a mat", E("!!mat"));
  (cnv3.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: strip2[0] + 8 * 36 + 18, clientY: strip2[1] + 17, pointerId: 23, timeStamp: tNow }));
  check("toybox spawns a jar", E("!!jar"));
  E("fabOpen = false; toyboxOpen = false");

  if (palCount > 0) {
    // pals get their own rituals at the new props — pin every channel
    E(`for (const p of pals) { p.fly = false; p.walkT = null; p.tag = null; p.restUntil = 0; p.hideUntil = 0; p.propGoal = null;
       p.stackOn = null; p.follow = null; p.sigT = 0; p.faceT = 0; p.faceId = null; p.web = 0;
       p.nextT = ${tNow} + 999999; p.playCd = ${tNow} + 999999; p.socCd = ${tNow} + 999999; }`);
    E(`pals[0].x = mirror.x - 20; pals[0].y = mirror.y; pals[0].plat = mirror.plat || plats[0]; pals[0].walkT = pals[0].x; pals[0].propGoal = { kind: "mirror" }`);
    await pump(3);
    check("pal reacts at the mirror", E("pals[0].mirrorCd") > tNow && (E("pals[0].faceT") > tNow || E("pals[0].fly")),
      `cd=${E("pals[0].mirrorCd")} face=${E("pals[0].faceId")} fly=${E("pals[0].fly")}`);
    E(`pals[0].fly = false; pals[0].vx = 0; pals[0].vy = 0; pals[0].faceT = 0; pals[0].faceId = null`);

    E(`pals[0].x = mat.x - 20; pals[0].y = mat.y; pals[0].plat = mat.plat || plats[0]; pals[0].walkT = pals[0].x; pals[0].propGoal = { kind: "mat" }`);
    await pump(3);
    check("pal boings off the mat", E("pals[0].fly") && E("pals[0].matCd") > tNow, `fly=${E("pals[0].fly")} cd=${E("pals[0].matCd")}`);
    E(`pals[0].fly = false; pals[0].vx = 0; pals[0].vy = 0`);

    E(`jar.fill = 2; pals[0].x = jar.x - 16; pals[0].y = jar.y; pals[0].plat = jar.plat || plats[0]; pals[0].walkT = pals[0].x; pals[0].propGoal = { kind: "jar" }`);
    await pump(3);
    check("pal raids the cookie jar", E("jar.fill") === 1 && E("pals[0].jarCd") > tNow && E("pals[0].faceId") === "munch",
      `fill=${E("jar.fill")} cd=${E("pals[0].jarCd")} face=${E("pals[0].faceId")}`);
  }

  // ---- 20. BOND: trickle-gated xp per species ----
  E("bond = {}; bondLast = 0");
  E("bondGain(SPECIES[active].id, 2)");
  check("bond gain lands", E("bond[SPECIES[active].id]") === 2);
  E("bondGain(SPECIES[active].id, 2)"); // inside the 12s trickle → blocked
  check("bond trickle gate", E("bond[SPECIES[active].id]") === 2);
  E(`bondLast = 0; bond[SPECIES[active].id] = 95`);
  check("bond level thresholds", E("bondLvl(SPECIES[active].id)") === 3, `xp=95 → lvl 3`);

  // ---- 21. PERSIST: save carries props + bond ----
  E("dirty = true; persist()");
  const sv = JSON.parse(lastSave || "{}");
  check("persist stores props", !!(sv.props && sv.props.bowl && sv.props.cushion), JSON.stringify(sv.props || {}));
  check("persist stores new props", !!(sv.props && sv.props.plant && sv.props.music), JSON.stringify(sv.props || {}));
  check("persist stores batch-2 props", !!(sv.props && sv.props.mirror && sv.props.mat && sv.props.jar), JSON.stringify(sv.props || {}));
  check("persist stores bond", sv.bond && typeof sv.bond === "object");

  // ---- 22. ACCESSORY PHYSICS: equipped gear rides the body spring ----
  E(`accEquip[SPECIES[active].id] = "crown"; if (pals[0]) accEquip[SPECIES[pals[0].sp].id] = "scarf"`);
  E("jigX = 0.3; leanSm = 0.1"); // mid-wobble — wrapper must not throw
  await pump(40);
  check("accessory physics render clean", E("accMV") === null);
  E(`jigX = 0; leanSm = 0; delete accEquip[SPECIES[active].id]; if (pals[0]) delete accEquip[SPECIES[pals[0].sp].id]`);

  // ---- 22b. PAL SLAB PHYSICS: a pal falling inside a window's column
  // slides out the near side instead of hovering inside the body ----
  if (E("pals.length") > 0) {
    E(`plats.push({ x: 500, y: 500, w: 400 });`); // a fake window deck mid-air
    E(`pals[0].fly = true; pals[0].x = 620; pals[0].y = 540; pals[0].vx = 0; pals[0].vy = 120; pals[0].plat = null; pals[0].stackOn = null; pals[0].web = 0; pals[0].tag = null; pals[0].accAct = null;`);
    for (let i = 0; i < 60; i++) await pump(1);
    // sliding down the face = real horizontal travel toward the near edge
    check("pal slides off window side face", E("pals[0].x") < 565,
      `x=${E("pals[0].x").toFixed(0)} (from 620) fly=${E("pals[0].fly")} y=${E("pals[0].y").toFixed(0)} vy=${E("pals[0].vy")} vx=${E("pals[0].vx")} n=${E("pals.length")} rest=${E("pals[0].restUntil")} held=${E("palHeld === pals[0]")} web=${E("pals[0].web")} stack=${E("String(pals[0].stackOn)")} crashes=${E("JSON.stringify(Object.keys(crashSeen || {}))")}`);
    E(`plats = plats.filter((p) => !(p.x === 500 && p.y === 500 && p.w === 400));`);
    for (let i = 0; i < 400 && E("pals[0].fly"); i++) await pump(1);
  }

  // ---- 23. PROP DRAG: furniture drops onto the deck under the cursor ----
  E(`bowl = { x: 400, y: petY, plat: null }`);
  E(`propHeld = "bowl"; bowl.x = petX + 40; bowl.y = petY - 200;`); // held mid-air
  E(`propHeld = null;`); // release happens in pointerup; simulate the snap directly
  E(`(function(){ const q = bowl, mx = petX + 40, my = petY - 200; let best = null, bs = 1e9;
     for (const pl of plats) { if (mx < pl.x - 10 || mx > pl.x + pl.w + 10) continue;
       const dy = pl.y - my; if (dy > -40 && Math.abs(dy) < bs) { bs = Math.abs(dy); best = pl; } }
     if (!best) for (const pl of plats) { const sc = Math.abs(pl.y - my) + Math.max(0, pl.x - mx, mx - (pl.x + pl.w));
       if (sc < bs) { bs = sc; best = pl; } }
     if (best) { q.plat = best; q.y = best.y; q.x = Math.max(best.x + 26, Math.min(best.x + best.w - 26, mx)); } })()`);
  check("dropped prop lands on deck", E("bowl && Math.abs(bowl.y - petY) < 16 && Math.abs(bowl.x - (petX + 40)) < 30"),
    `y=${E("bowl && bowl.y")} x=${E("bowl && bowl.x")}`);

  // ---- 24. WINDOW-CLOSE STARTLE: losing your deck scares the drop ----
  E("flying = false; petHome = false; held = 0; startleFall = false; shockUntil = 0; dizzyUntil = 0; poutUntil = 0");
  const savedPlats = E("JSON.stringify(plats)");
  E(`plats = plats.filter((p) => Math.abs(petY - p.y) > 14);`); // yank the deck
  E(`(function(){ const sup = plats.find((p) => petX > p.x - 20 && petX < p.x + p.w + 20 && Math.abs(petY - p.y) < 14);
     if (!sup) { flying = true; petVY = 0; if (!petHome) { startleFall = true; shockUntil = performance.now() + 1400; bangs.push({ x: petX, y: petY - blobSize().h - 14, life: 1, t: "!" }); sfx.shock(); } } })()`);
  check("window close → startled fall", E("startleFall") === true && E("shockUntil") > 0 && E("flying") === true);
  for (let i = 0; i < 900 && E("flying"); i++) await pump(1);
  check("lands dazed", E("dizzyUntil") > tNow || E("poutUntil") > tNow, `dizzy=${E("dizzyUntil")} pout=${E("poutUntil")}`);
  check("startle flag cleared", E("startleFall") === false);
  E(`plats = JSON.parse(${JSON.stringify(savedPlats)});`); // deck back
  E(`petY = plats.find((p) => petX > p.x - 20 && petX < p.x + p.w + 20 && Math.abs(petY - p.y) < 14)?.y || plats[0].y; petVY = 0;`);

  // ---- 25. FAB MENU: draggable circle, accordion items, edge flip ----
  E("fabX = null; fabY = null; fabOpen = false");
  const [defX, defY] = E("fabPos()");
  check("fab defaults top-right", defX === 1920 - 28 && defY === 28, `pos=${defX},${defY}`);
  const [i0x, i0y] = E("fabItemRect(0)");
  check("accordion opens below", i0y > defY, `iy=${i0y} fy=${defY}`);
  check("item hit-test works", E(`fabItemHit(${i0x + 5}, ${i0y + 5})`) === 0);
  E("fabY = 1050"); // parked near the taskbar
  const [b0x, b0y] = E("fabItemRect(0)");
  check("accordion flips up near bottom", b0y < 1050, `iy=${b0y}`);
  check("strip hangs off toys item", (() => { const [sx, sy, sw] = E("toyboxStripRect()"); const [tx2, ty2] = E("fabItemRect(2)"); return sy === ty2 && sx < tx2; })());
  E("fabX = null; fabY = null");

  // ---- 25b. SETTINGS PANEL: shrinks to fit small screens, rows scroll ----
  // inside a clipped viewport. the bug: 14 rows x 26px needed 424px of
  // panel — on a small laptop the bottom rows drew offscreen and still
  // took clicks you couldn't see.
  E("winW = 1280; winH = 460; settingsOpen = false; setScroll = 0");
  const [pxS, pyS, pwS, phS] = E("settingsRect()");
  check("settings fits small screen", phS === 390 && pyS >= 0 && pyS + phS <= 460, `ph=${phS} py=${pyS}`);
  check("scroll range appears when short", E("setMaxScroll()") > 0, `max=${E("setMaxScroll()")}`);
  const vt = E("SET_VIEW_TOP"), vb = E("SET_VIEW_BOT");
  E("settingsOpen = true; setScroll = 0");
  const q0 = E("settingsRows()")[13];
  check("last row starts below viewport", q0[1] > pyS + phS - vb, `qy=${q0[1]} vy1=${pyS + phS - vb}`);
  const wheel = (els.c.listeners.wheel || [])[0];
  check("wheel handler installed", typeof wheel === "function");
  if (wheel) {
    wheel({ clientX: 30, clientY: 30, deltaY: 120, preventDefault() {} });
    check("wheel outside panel ignored", E("setScroll") === 0);
    wheel({ clientX: pxS + 30, clientY: pyS + phS - 50, deltaY: 120, preventDefault() {} });
    check("wheel inside panel scrolls", E("setScroll") === 26, `s=${E("setScroll")}`);
    for (let i = 0; i < 30; i++) wheel({ clientX: pxS + 30, clientY: pyS + phS - 50, deltaY: 120, preventDefault() {} });
    check("scroll clamps at content end", E("setScroll") === E("setMaxScroll()"), `s=${E("setScroll")} max=${E("setMaxScroll()")}`);
    const qEnd = E("settingsRows()")[13];
    check("quit reachable at bottom", qEnd[1] + qEnd[3] <= pyS + phS - vb + 1 && qEnd[1] >= pyS + vt - 26,
      `qbot=${qEnd[1] + qEnd[3]} vy1=${pyS + phS - vb}`);
    // a scrolled-out row is invisible — clicking its spot must not fire it
    E("setScroll = 0; treatAim = false; fabOpen = false; redeemMode = false; gemShop = false; infoPick = null; albumOpen = false; awayReport = null");
    const before = calls.length;
    (els.c.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: pxS + 30, clientY: q0[1] + 10 }));
    check("hidden row takes no click", !calls.slice(before).includes("quit_app") && E("settingsOpen") === true,
      `open=${E("settingsOpen")}`);
    // window shrinks mid-scroll: the row getter self-clamps
    E("setScroll = 9999; winH = 300");
    E("settingsRows()");
    check("resize clamps scroll", E("setScroll") === E("setMaxScroll()"), `s=${E("setScroll")} max=${E("setMaxScroll()")}`);
    const [, pyT, , phT] = E("settingsRect()");
    check("tiny screen still shows footer zone", phT === 230 && pyT >= 0, `ph=${phT} py=${pyT}`);
    E("winH = 1080");
    check("no scrollbar at full size", E("setMaxScroll()") === 0, `max=${E("setMaxScroll()")}`);
  }
  E("winW = 1920; winH = 1080; settingsOpen = false; setScroll = 0");

  // ---- 26. EGG: drops on the deck, pet pecks it open ----
  E("lastEgg = ''; egg = null; seen = true; flying = false; sigT0 = 0; walkTarget = null; walkGoal = null; nextWander = 0");
  await pump(30); // >20s uptime already — drop should fire this frame
  E("dropEgg()");
  check("egg dropped on deck", !!E("egg") && Math.abs(E("egg.y - petY")) < 20, `egg=${JSON.stringify(E("egg"))}`);
  const ownedBefore = E("owned.length"), jellyBefore = E("jelly");
  E(`walkTarget = egg.x - 16; walkGoal = { kind: "egg", tx: egg.x - 16 }`);
  for (let i = 0; i < 900 && E("egg"); i++) await pump(1);
  await pump(80); // the setTimeout(1100ms) hatch fires on wall clock? no — pump drives rAF only
  await new Promise((r) => setTimeout(r, 1300)); // real-time wait for the peck timeout
  await pump(30);
  check("egg hatches (species or jelly)", !E("egg") && (E("owned.length") > ownedBefore || E("jelly") > jellyBefore),
    `owned=${E("owned.length")}>${ownedBefore} jelly=${E("jelly")}>${jellyBefore}`);

  // ---- 26. COPY PEEK: ctrl-c makes the pet perk up ----
  E("copyCd = 0; flying = false; sigT0 = 0; held = 0; petHome = false; state = 'idle'; shockUntil = 0");
  E("copyPeek(true)");
  check("copy peek perks", E("shockUntil") > 0 && E("lookUntil") > 0, `shock=${E("shockUntil")}`);

  // ---- 26b. SLEEPING PET: ignores the cursor entirely, no sleepwalking ----
  E(`awakeAt = Date.now() - 9e9; noSleepUntil = 0; state = "sleeping"; walkTarget = null; walkGoal = null; hopTarget = null;
     flying = false; sigT0 = 0; held = 0; petHome = false; treatAim = true; snack = { x: petX + 60, y: petY, kind: "file", t0: ${tNow} }`);
  E(`curX = petX + 120; curY = petY - 20; curV = 0; lastCurT = -1e9`); // inside follow radius, outside the 85px wake ring
  const sleepX = E("petX");
  await pump(60);
  check("sleeping pet ignores cursor", E("walkTarget") === null && E("hopTarget") === null && Math.abs(E("petX") - sleepX) < 8,
    `wt=${E("String(walkTarget)")} dx=${(E("petX") - sleepX).toFixed(1)} state=${E("state")}`);
  E(`state = "idle"; awakeAt = Date.now(); treatAim = false; snack = null; curX = -9999; curY = -9999`);

  // ---- 26c. SLEEP IMMOBILIZATION: "sleeping" means STILL ----
  // a whip-fast cursor beside a sleeping pet: no startle hop, no hunt,
  // no budge — the old startle/hunt rolls didn't check state at all
  E(`awakeAt = Date.now() - 9e9; noSleepUntil = 0; state = "sleeping"; flying = false; sigT0 = 0; held = 0;
     petHome = false; walkTarget = null; hopTarget = null; climbPhase = 0; climbing = false; shockUntil = 0;
     huntT0 = 0; huntPounce = false; huntCd = 0; begUntil = 0; treatAim = false; snack = null; treat = null; ball = null`);
  E(`curX = petX + 110; curY = petY - 20; curV = 2200; curVX = 900; lastCurT = ${tNow}`);
  const slpX = E("petX");
  await pump(50);
  check("sleeping pet ignores startle + hunt", !E("flying") && !E("huntT0") && !E("sigT0") && Math.abs(E("petX") - slpX) < 8,
    `fly=${E("flying")} hunt=${E("huntT0")} sig=${E("sigT0")} dx=${(E("petX") - slpX).toFixed(1)}`);

  // cushion nap: state stays "idle" but the puff has it — no errands,
  // no accessory acts, no treat chases, no follows for the whole doze
  E(`state = "idle"; awakeAt = Date.now(); flying = false; walkTarget = null; walkGoal = null; hopTarget = null;
     sitUntil = ${tNow} + 60000; cushionNap = ${tNow} + 60000; cushionNapW = Date.now() + 60000;
     accAct = null; accActNext = 0; sigT0 = 0; nextWander = ${tNow}; curV = 0; curX = petX + 140; curY = petY - 20;
     treat = { x: petX + 80, y: petY, kind: 0, t0: ${tNow} };
     pals.forEach((p) => { p.x = 60; p.walkT = null; });`); // a pal could steal the treat too — park them away
  const napX = E("petX"), napY = E("petY");
  await pump(140);
  check("cushion nap: zero movement/acts", Math.abs(E("petX") - napX) < 2 && Math.abs(E("petY") - napY) < 2 &&
    E("walkTarget") === null && E("hopTarget") === null && !E("accAct") && !E("sigT0") && E("treat") !== null,
    `dx=${(E("petX") - napX).toFixed(2)} dy=${(E("petY") - napY).toFixed(2)} wt=${E("String(walkTarget)")} acc=${E("String(accAct)")} treat=${E("String(!!treat)")}`);
  E("contentUntil = 0; munchUntil = 0; smugUntil = 0; shockUntil = 0; poutUntil = 0"); // pals may kiss during the pump
  check("cushion nap face = sleeping", E(`faceName(${tNow})`) === "sleeping", E(`faceName(${tNow})`));

  // grabbing the pet mid-doze wakes it (and clears both nap clocks)
  // clear every click-eater first: open panels, stray props, treat-aim,
  // and pals parked on the pet's hitbox would all swallow the pointer
  E(`cushion = cushion ? { ...cushion, x: petX + 400 } : null; bowl = bowl ? { ...bowl, x: petX + 500 } : null;
     box = null; plant = null; music = null; propHeld = null; palHeld = null;
     treat = null; ball = null; treatAim = false; snack = null; egg = null; curX = -9999; curY = -9999;
     settingsOpen = false; ranchOpen = false; gemShop = false; albumOpen = false; nurseryOpen = false;
     toyboxOpen = false; fabOpen = false; redeemMode = false; cardTarget = null; infoPick = null; awayReport = null;
     pals.forEach((p, i2) => { p.x = 60 + i2 * 60; p.y = plats[0].y; p.plat = plats[0]; p.fly = false; p.walkT = null; })`);
  const cnv2 = els.c;
  const bh2 = E("blobSize().h");
  (cnv2.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: E("petX"), clientY: E("petY") - bh2 / 2, pointerId: 11, timeStamp: tNow }));
  check("grab wakes cushion nap", E("held") && E("cushionNap") === 0 && E("cushionNapW") === 0,
    `held=${E("held")} nap=${E("cushionNap")}`);
  (cnv2.listeners.pointerup || []).forEach((f) => f({ button: 0, clientX: E("petX"), clientY: E("petY") - bh2 / 2, pointerId: 11, timeStamp: tNow + 120 }));
  E("held = false; flying = false; petVX = 0; petVY = 0; cushionNap = 0; cushionNapW = 0; sitUntil = 0; petHome = false");

  // a napping pal: no wander, no play, no ball dodge, no tag — a fast
  // ball rolls past without launching it, and grabbing wakes it up
  if (E("pals.length") > 0) {
    E(`(() => { const p = pals[0]; p.x = plats[0].x + 600; p.y = plats[0].y; p.plat = plats[0]; p.fly = false; p.vx = 0; p.vy = 0;
       p.walkT = null; p.tag = null; p.stackOn = null; p.follow = null; p.accAct = null; p.propGoal = null; p.sigT = 0;
       p.restUntil = ${tNow} + 60000; p.nextT = ${tNow}; p.playCd = 0; p.ballCd = 0; p.web = 0; })()`);
    E(`petX = plats[0].x + 900; petY = plats[0].y; walkTarget = null; flying = false`); // pet parked far away
    if (E("pals.length") > 1) E(`(() => { const q = pals[1]; q.x = pals[0].x + 46; q.y = pals[0].y; q.plat = pals[0].plat;
       q.fly = false; q.walkT = null; q.tag = null; q.playCd = 0; q.restUntil = 0; q.nextT = ${tNow}; })()`); // awake neighbor — must not drag it in
    const pnX = E("pals[0].x"), pnY = E("pals[0].y");
    await pump(90);
    check("napping pal stays put", Math.abs(E("pals[0].x") - pnX) < 3 && Math.abs(E("pals[0].y") - pnY) < 3 &&
      !E("pals[0].walkT") && !E("pals[0].fly") && !E("pals[0].tag") && !E("pals[0].accAct"),
      `dx=${(E("pals[0].x") - pnX).toFixed(1)} wt=${E("String(pals[0].walkT)")} fly=${E("pals[0].fly")} tag=${E("String(pals[0].tag)")}`);
    // fast ball slams through — no dodge launch while dozing
    E(`ball = { x: pals[0].x - 70, y: plats[0].y - 9, vx: 420, vy: 0, r: 9, rot: 0, sq: 0 }`);
    await pump(26);
    check("napping pal doesn't dodge the ball", !E("pals[0].fly") && E("pals[0].restUntil") > tNow,
      `fly=${E("pals[0].fly")} rest=${E("pals[0].restUntil > 0")}`);
    E("ball = null");
    // tap = wake
    const pr = E("palRect(pals[0])");
    (cnv2.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: pr[0] + pr[2] / 2, clientY: pr[1] + pr[3] / 2, pointerId: 12, timeStamp: tNow }));
    check("grab wakes napping pal", E("palHeld === pals[0]") && E("pals[0].restUntil") === 0,
      `held=${E("palHeld === pals[0]")} rest=${E("pals[0].restUntil")}`);
    (cnv2.listeners.pointerup || []).forEach((f) => f({ button: 0, clientX: pr[0] + pr[2] / 2, clientY: pr[1] + pr[3] / 2, pointerId: 12, timeStamp: tNow + 120 }));
    E(`palHeld = null; pals.forEach((p) => { p.restUntil = 0; p.walkT = null; p.tag = null; p.fly = false; p.x = plats[0].x + 300 + pals.indexOf(p) * 90; p.y = plats[0].y; p.plat = plats[0]; })`);
    E(`petX = plats[0].x + 200; petY = plats[0].y`); // put the pet back
  }

  // ---- 26d. CUSHION IS SINGLE-SEAT: one napper per puff ----
  if (E("pals.length") > 1) {
    E(`cushion = { x: plats[0].x + 320, y: plats[0].y, plat: plats[0] };
       cushionNap = 0; state = "idle"; petX = plats[0].x + 60; walkTarget = null; walkGoal = null;
       pals[0].x = cushion.x; pals[0].y = plats[0].y; pals[0].plat = plats[0];
       pals[0].fly = false; pals[0].walkT = null; pals[0].restUntil = ${tNow} + 9000;
       pals[1].x = cushion.x + 5; pals[1].y = plats[0].y; pals[1].plat = plats[0];
       pals[1].fly = false; pals[1].restUntil = 0; pals[1].nextT = ${tNow} + 999999;
       pals[1].stackOn = null; pals[1].stackCd = ${tNow} + 999999; pals[1].follow = null; pals[1].tag = null;
       pals[1].walkT = cushion.x; pals[1].propGoal = { kind: "cushion" }`);
    await pump(6);
    check("second pal can't nap on a taken cushion", E("pals[1].restUntil") === 0 && !E("pals[1].propGoal"),
      `rest=${E("pals[1].restUntil")} pg=${E("String(pals[1].propGoal)")}`);
    check("first pal still napping", E("pals[0].restUntil") > tNow);

    // the pet outranks pals: arriving at a taken cushion bounces the napper
    E(`pals[1].x = cushion.x; pals[1].restUntil = ${tNow} + 9000; pals[1].fly = false; pals[1].walkT = null;
       pals[1].stackOn = null; pals[1].stackCd = ${tNow} + 999999;
       petX = cushion.x + 4; walkTarget = cushion.x; walkGoal = { kind: "cushion", tx: cushion.x };
       state = "idle"; cushionNap = 0; cushionNapW = 0; cushionCd = 0; nextWander = ${tNow} + 9e9;
       snack = null; treatAim = false; sigT0 = 0; flying = false;
       curX = -9999; curY = -9999; curVX = 0; curV = 0; noticeT = 0;
       huntT0 = 0; huntScore = 0; huntPounce = false; danceT0 = 0; accAct = null;
       webbing = false; climbing = false; climbPhase = 0; boxHide = 0; sitUntil = 0; shockUntil = 0`);
    await pump(4);
    check("pet arrival evicts the napping pal", E("pals[1].restUntil") === 0 && E("pals[1].fly"),
      `rest=${E("pals[1].restUntil")} fly=${E("pals[1].fly")}`);
    check("pet takes the cushion", E("cushionNap") > tNow, `nap=${E("cushionNap")}`);
    E(`cushionNap = 0; cushionNapW = 0; sitUntil = 0; walkGoal = null; walkTarget = null; nextWander = 0`);

    // ---- 26e. LEAPFROG: head-on jam resolves with a hop, not a shove-match ----
    E(`cushion = null; treat = null; ball = null; curX = -9999; curY = -9999;
       nextWander = ${tNow} + 9e9; sigT0 = 0;
       pals[0].restUntil = 0; pals[1].restUntil = 0; pals[0].fly = false; pals[1].fly = false;
       pals[0].blockT = 0; pals[0].blockCd = 0; pals[1].blockT = 0; pals[1].blockCd = 0;
       pals[0].tag = null; pals[1].tag = null; pals[0].follow = null; pals[1].follow = null;
       pals[0].stackOn = null; pals[1].stackOn = null;
       pals[0].playCd = ${tNow} + 999999; pals[1].playCd = ${tNow} + 999999;
       pals[0].x = plats[0].x + 200; pals[0].walkT = plats[0].x + 460; pals[0].nextT = ${tNow} + 999999;
       pals[0].y = plats[0].y; pals[0].plat = plats[0]; pals[0].propGoal = null;
       pals[1].x = plats[0].x + 320; pals[1].walkT = null; pals[1].nextT = ${tNow} + 999999;
       pals[1].y = plats[0].y; pals[1].plat = plats[0];
       petX = plats[0].x + 40; walkTarget = null`);
    let leaped = false;
    for (let i = 0; i < 220 && !leaped; i++) { await pump(1); leaped = E("pals[0].x") > E("pals[1].x") + 4; }
    check("walking pal leapfrogs a standing pal", leaped,
      `p0=${E("pals[0].x").toFixed(0)} p1=${E("pals[1].x").toFixed(0)}`);

    // ---- 26f. STEP-OVER: a jam can also resolve by treading on the
    // blocker — squashed flat + a personality-set reaction ----
    E(`(() => { const S = SPECIES[pals[0].sp]; pals[0]._ps = S.ps; S.ps = "calm"; })()`); // calm pace → step branch open
    E("window.__mr = Math.random; Math.random = () => 0.3"); // <0.65 → picks the tread
    E(`pals[0].follow = null; pals[0].x = plats[0].x + 200; pals[0].walkT = plats[0].x + 460; pals[0].blockT = 0; pals[0].blockCd = 0; pals[0].fly = false;
       pals[0].stackOn = null; pals[0].stackCd = ${tNow} + 999999;
       pals[1].follow = null; pals[1].x = plats[0].x + 320; pals[1].walkT = null; pals[1].fly = false; pals[1].restUntil = 0;
       pals[1].stackOn = null; pals[1].stackCd = ${tNow} + 999999; // a mounted blocker isn't a blocker
       pals[1].faceId = null; pals[1].faceT = 0; pals[1].stepped = 0; pals[1].squash = 0;
       pals[0].y = plats[0].y; pals[0].plat = plats[0]; pals[1].y = plats[0].y; pals[1].plat = plats[0];
       pals[1].nextT = ${tNow} + 999999;`);
    let stepped = false;
    const traj = [];
    for (let i = 0; i < 220 && !stepped; i++) {
      await pump(1);
      traj.push(`${E("pals[0].x").toFixed(1)}|${E("pals[1].x").toFixed(1)}|b${E("pals[0].blockT||0").toFixed(0)}|${E("pals[0].fly") ? "F" : "."}${E("pals[1].fly") ? "f" : "."}|wt1=${E("String(pals[1].walkT)")}|r=${E("pals[1].restUntil||0") > tNow ? "R" : "."}`);
      stepped = E("pals[1].stepped") > 0;
    }
    E("Math.random = window.__mr");
    if (!stepped) {
      // find the frame where pals[0] crossed past pals[1] and show ±20 around it
      const cross = traj.findIndex((s) => {
        const [a, b] = s.split("|").map((v, j) => (j < 2 ? parseFloat(v) : v));
        return a > b;
      });
      console.log(`TRAJ cross@${cross}:`, traj.slice(Math.max(0, cross - 20), cross + 25).join("\n  "));
    }
    check("blocked pal treads on the blocker", stepped,
      `stepped=${E("pals[1].stepped")} p0x=${E("pals[0].x").toFixed(0)} p1x=${E("pals[1].x").toFixed(0)} fly=${E("pals[0].fly")} wt=${E("String(pals[0].walkT)")} wt1=${E("String(pals[1].walkT)")} bT=${E("pals[0].blockT||0")} web=${E("pals[0].web||0")} rest=${E("pals[0].restUntil||0")} hide=${E("pals[0].hideUntil||0")} hopW=${E("String(pals[0].hopWind)")} stack=${E("String(pals[0].stackOn)")}`);
    const qpsy = E("(PSYCH[(SPECIES[pals[1].sp] || {}).ps] || {})");
    const wantF = qpsy.flee ? "dizzy" : ((qpsy.pace || 1) <= 0.85 || (qpsy.startle || 1) > 1.2) ? "grumpy" : "pout";
    check("stepped pal squished + reacts by its own personality",
      E("pals[1].faceId") === wantF && E("pals[1].faceT") > tNow && !E("pals[1].walkT"),
      `face=${E("String(pals[1].faceId)")} want=${wantF} wt=${E("String(pals[1].walkT)")}`);
    E(`(() => { SPECIES[pals[0].sp].ps = pals[0]._ps || SPECIES[pals[0].sp].ps; delete pals[0]._ps; })()`);

    // a sleeping blocker is always hopped over, never stepped on
    E(`pals[0].follow = null; pals[0].fly = false; pals[0].x = plats[0].x + 200; pals[0].walkT = plats[0].x + 460;
       pals[0].blockT = 0; pals[0].blockCd = 0; pals[0].stackOn = null; pals[0].stackCd = ${tNow} + 999999;
       pals[1].follow = null; pals[1].fly = false; pals[1].x = plats[0].x + 320; pals[1].walkT = null;
       pals[1].stackOn = null; pals[1].stackCd = ${tNow} + 999999;
       pals[1].restUntil = ${tNow} + 9000; pals[1].stepped = 0; pals[1].faceId = null`);
    E("window.__mr = Math.random; Math.random = () => 0.3"); // would pick step if it could
    let hopped = false;
    for (let i = 0; i < 220 && !hopped; i++) { await pump(1); hopped = E("pals[0].x") > E("pals[1].x") + 4; }
    E("Math.random = window.__mr");
    check("napping blocker is hopped, never stepped", hopped && !E("pals[1].stepped") && E("pals[1].restUntil") > tNow,
      `stepped=${E("pals[1].stepped")} rest=${E("pals[1].restUntil > 0")}`);

    // pal nap cooldown scales with its own sleep axis
    E(`cushion = { x: plats[0].x + 320, y: plats[0].y, plat: plats[0] }; cushionNap = 0;
       pals[0].restUntil = 0; pals[0].restCd = 0; pals[0].fly = false; pals[0].nextT = ${tNow} + 999999;
       pals[0].follow = null; pals[0].x = cushion.x + 5; pals[0].walkT = cushion.x; pals[0].propGoal = { kind: "cushion" };
       pals[1].restUntil = 0; pals[1].fly = false; pals[1].walkT = null`);
    await pump(8);
    const slp = E("(PSYCH[(SPECIES[pals[0].sp] || {}).ps] || {}).sleep || 1");
    check("pal nap cooldown scales with sleep", E("pals[0].restUntil") > tNow &&
      Math.abs(E("pals[0].restCd") - E("pals[0].restUntil") - 25000 * slp) < 2,
      `cd=${(E("pals[0].restCd") - E("pals[0].restUntil")).toFixed(0)} want=${(25000 * slp).toFixed(0)}`);
  }

  // ---- 27. ACCESSORY ROUTINES: EVERY doodad act, start → finish ----
  // freeze ambient rolls so the sweep is deterministic; noSleepUntil is
  // Date-clock so a long sweep can't drift the pet into sleep
  E(`nextWander = ${tNow} + 9e9; noSleepUntil = Date.now() + 9e9; egg = null; treat = null; snack = null;
     pals.forEach((p) => { p.accCd = 9e9; });`);
  const crashCount = () => crashMsgs.filter((m) => m !== "tick" && !String(m).startsWith("clip-")).length;
  const accIds = E("Object.keys(ACC_ACTS)");
  let accAllOk = true; const accBad = [];
  for (const id of accIds) {
    const c0 = crashCount();
    E(`accEquip[SPECIES[active].id] = "${id}"; accAct = null; accActNext = 0; flying = false; sigT0 = 0;
       walkTarget = null; walkGoal = null; hopTarget = null; petHome = false; held = 0; state = "idle"; curV = 0;
       shockUntil = 0; smugUntil = 0; contentUntil = 0; sitUntil = 0; propSpin = 0; spinT0 = 0; petVX = 0; petVY = 0; webbing = false`);
    await pump(3);
    const started = E("accAct") !== null;
    let frames = 0;
    while (E("accAct") !== null && frames < 900) { await pump(1); frames++; }
    for (let i = 0; i < 500 && E("flying"); i++) await pump(1);
    const crashed = crashCount() - c0;
    const ok = started && E("accAct") === null && E("propSpin") === 0 && !E("flying") && crashed === 0;
    if (!ok) accBad.push(`${id}(start=${started} f=${frames} spin=${E("propSpin")} fly=${E("flying")} crash=${crashed} msg=${JSON.stringify(crashMsgs.slice(-1))})`);
    accAllOk = accAllOk && ok;
  }
  check(`all ${accIds.length} accessory acts start + finish clean`, accAllOk, accBad.join(" "));
  check("cooldown pushed", E("accActNext") > tNow, `next=${E("accActNext")} t=${tNow}`);

  // flyby specifically: blades spun, render path (the old `t` ReferenceError)
  // stayed clean for the whole flight
  E(`accEquip[SPECIES[active].id] = "prop"; accAct = null; accActNext = 0; flying = false; sigT0 = 0; petHome = false; held = 0; state = "idle"; curV = 0`);
  const fbC0 = crashCount();
  await pump(3);
  check("flyby starts", E("accAct && accAct.id") === "flyby" && E("flying") === true, `act=${E("accAct && accAct.id")} fly=${E("flying")}`);
  let spun = 0, flyByDone = false;
  for (let i = 0; i < 900 && !flyByDone; i++) {
    await pump(1);
    if (E("propSpin") > 0) spun = 1;
    if (!E("accAct") && !E("flying")) flyByDone = true;
  }
  check("blades spun + landed clean, no render crash", spun === 1 && flyByDone && E("propSpin") === 0 && crashCount() === fbC0,
    `spun=${spun} done=${flyByDone} spin=${E("propSpin")} crash=${crashCount() - fbC0}`);

  // every stationary script finishes when force-started (skip the roll)
  const runIds = E("Object.keys(ACC_RUNS)");
  let runsOk = true; const runBad = [];
  for (const rid of runIds) {
    const c0 = crashCount();
    E(`accAct = null; flying = false; sigT0 = 0; held = 0; petHome = false; state = "idle"; curV = 0; propSpin = 0; petVX = 0; petVY = 0`);
    E(`startAccAct("${rid}", ${tNow})`);
    let frames = 0;
    while (E("accAct") !== null && frames < 400) { await pump(1); frames++; }
    for (let i = 0; i < 400 && E("flying"); i++) await pump(1);
    const ok = E("accAct") === null && !E("flying") && crashCount() === c0;
    if (!ok) runBad.push(`${rid}(f=${frames} fly=${E("flying")} crash=${crashCount() - c0} msg=${JSON.stringify(crashMsgs.slice(-1))})`);
    runsOk = runsOk && ok;
  }
  check(`all ${runIds.length} timed scripts complete`, runsOk, runBad.join(" "));

  // interrupt contract: grabbing the pet mid-act aborts cleanly
  E(`startAccAct("inspect", ${tNow})`);
  await pump(5);
  E("held = 1");
  await pump(3);
  check("grab aborts mid-act", E("accAct") === null && E("propSpin") === 0);
  E("held = 0");

  // reduceMotion: the doodads stay quiet
  E(`reduceMotion = true; accAct = null; accActNext = 0; accEquip[SPECIES[active].id] = "stache"; flying = false; sigT0 = 0; petHome = false; held = 0; state = "idle"; curV = 0`);
  await pump(5);
  check("reduceMotion suppresses acts", E("accAct") === null);
  E("reduceMotion = false");

  // ---- 28. PAL BITS: trigger path + every bit's steps run to done ----
  E(`(function(){ const p = pals[0]; if (!p) return; accEquip[SPECIES[p.sp].id] = "shades"; p.accCd = 0; p.accAct = null; p.fly = false; p.stackOn = null; p.tag = null; p.follow = null; p.walkT = null; p.propGoal = null; p.restUntil = 0; p.hideUntil = 0; p.web = 0; p.sigT = 0;
     p.socCd = ${tNow} + 999999; p.sympCd = ${tNow} + 999999; p.bumpCd = ${tNow} + 999999; p.playCd = ${tNow} + 999999;
     pals.forEach((q, i2) => { if (i2 > 0) { q.x = 60; q.socCd = ${tNow} + 999999; } }); })()`);
  await pump(4);
  check("pal acc bit fires", E(`(function(){ const p = pals[0]; return p && (p.accAct !== null && p.accAct !== undefined || p.faceId === "smug"); })()`) === true);
  E("pals[0].accAct = null");

  const bitIds = E("Object.keys(PAL_ACC_BITS)");
  let bitsOk = true; const bitBad = [];
  for (const id of bitIds) {
    const c0 = crashCount();
    E(`(function(){ const p = pals[0]; p.accAct = { id: "${id}", t0: ${tNow}, step: 0 }; p.accCd = 9e9;
       p.fly = false; p.vy = 0; p.stackOn = null; p.tag = null; p.walkT = null; p.propGoal = null; p.restUntil = 0; })()`);
    let frames = 0;
    while (E("pals[0].accAct") && frames < 400) { await pump(1); frames++; }
    for (let i = 0; i < 300 && E("pals[0].fly"); i++) await pump(1);
    const ok = !E("pals[0].accAct") && crashCount() === c0;
    if (!ok) bitBad.push(`${id}(f=${frames} crash=${crashCount() - c0} fly=${E("pals[0].fly")} tag=${E("String(pals[0].tag)")} walkT=${E("String(pals[0].walkT)")} msg=${JSON.stringify(crashMsgs.slice(-1))})`);
    bitsOk = bitsOk && ok;
  }
  check(`all ${bitIds.length} pal bits run to completion`, bitsOk, bitBad.join(" "));

  // grabbing a pal mid-bit aborts it
  E(`(function(){ const p = pals[0]; p.accAct = { id: "monocle", t0: ${tNow}, step: 0 }; p.fly = false; })()`);
  await pump(3);
  E("pals[0].accAct = null; pals[0].fly = false"); // grab path sets this; verify runner tolerates
  await pump(3);
  check("pal bit abort tolerated", E("pals[0].accAct") === null);

  // self-heal: a flyby act stranded with no flight (its own cleanup lives
  // in the flying branch) is dropped by the 12s heartbeat wedge check,
  // and a stray propSpin parks
  E(`accAct = { id: "flyby", t0: ${tNow} - 13000, until: ${tNow} - 7000, tx: 0, ty: 0, step: 0 }; lastBeat = 0; propSpin = 4; flying = false`);
  await pump(2);
  check("wedged act self-heals", E("accAct") === null && E("propSpin") === 0, `act=${E("String(accAct)")} spin=${E("propSpin")}`);

  // ---- 28. PROP DETAIL: kibble level, tap refill, ball squish ----
  E(`bowl = { x: petX + 40, y: plats[0].y, plat: plats[0], fill: 1 }; bowlCd = 0; munchUntil = 0; poutUntil = 0`);
  E(`propArrive({ kind: "bowl", tx: petX + 40 }, performance.now())`);
  check("munch spends kibble", E("bowl.fill") === 0 && E("munchUntil") > 0, `fill=${E("bowl.fill")}`);
  E(`munchUntil = 0; poutUntil = 0`);
  E(`propArrive({ kind: "bowl", tx: petX + 40 }, performance.now())`);
  check("empty bowl pouts", E("bowl.fill") === 0 && E("poutUntil") > 0 && E("munchUntil") === 0, `pout=${E("poutUntil")}`);
  E(`propTap("bowl", bowl)`);
  check("tap refills bowl", E("bowl.fill") === 3);
  E(`cushion = cushion || { x: petX - 40, y: plats[0].y, plat: plats[0] }; cushionPoof = 0; propTap("cushion", cushion)`);
  check("tap fluffs cushion", E("cushionPoof") > performance.now());
  E(`ball = { x: petX + 60, y: plats[0].y - 4, vx: 0, vy: 500, r: 9, rot: 0, sq: 0 }`);
  await pump(4);
  check("ball splats on bounce", E("ball && ball.sq") > 0 && E("ball.vy") < 0, `sq=${E("ball && ball.sq")} vy=${E("ball && ball.vy")}`);

  // ---- 14. faces render: sprite() returns canvases for all face ids ----
  const faces = E("Object.keys(FACES)");
  let faceOk = true, faceBad = "";
  for (const f of faces) {
    try { const s = E(`sprite("${f}", 0, false)`); if (!s || !s.width) { faceOk = false; faceBad = f; } }
    catch (e) { faceOk = false; faceBad = f + ":" + e.message; }
  }
  check(`all ${faces.length} faces render`, faceOk, faceBad);

  // ---- 15. legendary species list sanity ----
  const legs = E("SPECIES.filter(s=>s.r>=3).map(s=>s.id)");
  check("legendary species exist", legs.length >= 8, legs.join(","));

  // ---- 29. GACHA: rarity tiers + pity floors are enforced ----
  check("every rarity has an in-season pool",
    E("[0,1,2,3].every(r=>SPECIES.some(s=>s.r===r && !s.id.startsWith('hyb') && seasonOpen(s)))"));
  const tier = (rv) => E(`(function(){ const mr = Math.random; Math.random = () => ${rv};
    const sp = rollSpecies(); Math.random = mr; return sp ? sp.r : -1; })()`);
  E(`pityRare = 0; pityLeg = 0`);
  const t1 = tier(0.50), t2 = tier(0.70), t3 = tier(0.90), t4 = tier(0.99);
  check("roll lands common at w<60", t1 === 0, `r=${t1}`);
  check("roll lands rare", t2 === 1, `r=${t2}`);
  check("roll lands epic", t3 === 2, `r=${t3}`);
  check("roll lands legend", t4 === 3, `r=${t4}`);
  E(`pityRare = 11; pityLeg = 0`);
  const t5 = tier(0.50);
  check("rare pity fires on 12th pull", t5 >= 1, `r=${t5}`);
  E(`pityRare = 0; pityLeg = 49`);
  const t6 = tier(0.50);
  check("legend pity fires on 50th pull", t6 === 3, `r=${t6}`);
  check("legend pity counter reset", E("pityLeg") === 0, `pityLeg=${E("pityLeg")}`);
  // doPull: cost, new-vs-dup bookkeeping, pullAnim queued
  // (dexMile exhausted so a milestone bonus can't muddy the ledger)
  E(`dexMile = DEX_MILES.length; jelly = 200; pullAnim = null; pityRare = 0; pityLeg = 0`);
  const ownedN = E("owned.length");
  E(`__mr0 = Math.random; Math.random = () => 0.5; doPull(); Math.random = __mr0`);
  const jellyAfter = E("jelly"), grew = E("owned.length") === ownedN + 1;
  check("pull nets -50 (new) or -35 (dup refund)", jellyAfter === 150 || jellyAfter === 165, `jelly=${jellyAfter} grew=${grew}`);
  check("pull refunds exactly on duplicate", (grew && jellyAfter === 150) || (!grew && jellyAfter === 165), `jelly=${jellyAfter}`);
  check("pull anim queued", !!E("pullAnim"));
  E(`pullAnim = null; dirty = false`);

  // ---- 30. BREEDING: 25% unowned-base branch can never roll legend ----
  E(`jelly = 100; breedReadyAt = 0; breedMode = true;
     breedSel = [SPECIES.findIndex(s=>s.id==="sprout"), SPECIES.findIndex(s=>s.id==="ember")]`);
  E(`__mr0 = Math.random; Math.random = () => 0.1; doBreed(); Math.random = __mr0`);
  const lastId = E("owned[owned.length-1]"), lastSp = E("SPECIES.find(s=>s.id===owned[owned.length-1])");
  check("breed 25% branch gives an unowned base species",
    lastSp && !lastId.startsWith("hyb") && lastSp.r <= 2, `id=${lastId} r=${lastSp && lastSp.r}`);
  check("breed cost deducted", E("jelly") === 80, `jelly=${E("jelly")}`);
  check("breed cooldown armed", E("breedReadyAt") > 0);
  // the other 75%: a hybrid child enters SPECIES and owned
  const nHyb = E("SPECIES.filter(s=>s.id.startsWith('hyb')).length");
  E(`jelly = 100; breedReadyAt = 0; breedMode = true;
     breedSel = [SPECIES.findIndex(s=>s.id==="sprout"), SPECIES.findIndex(s=>s.id==="ember")]`);
  E(`__mr0 = Math.random; Math.random = () => 0.9; doBreed(); Math.random = __mr0`);
  check("breed 75% branch makes a hybrid", E("SPECIES.filter(s=>s.id.startsWith('hyb')).length") === nHyb + 1,
    `hyb=${E("SPECIES.filter(s=>s.id.startsWith('hyb')).length")}`);
  check("hybrid child is owned", E("owned[owned.length-1].startsWith('hyb')"), `last=${E("owned[owned.length-1]")}`);
  E(`pullAnim = null; breedMode = false; breedSel = []; breedReadyAt = 0; dirty = false`);

  // ---- 31. GEM SHOP: per-pack BUY chips open the right checkout ----
  E(`gemShop = true; GEM_PACK_URLS.A = ""; GEM_PACK_URLS.B = "https://buy.example/b"; GEM_PACK_URLS.C = ""; GEM_PACK_URLS.D = ""`);
  const br1 = JSON.parse(E("JSON.stringify(packBuyRect(1))")); // pack B chip
  (els.c.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: br1[0] + 10, clientY: br1[1] + 10, pointerId: 31, timeStamp: tNow }));
  check("pack BUY opens its checkout link",
    callArgs.open_url && callArgs.open_url.url === "https://buy.example/b",
    `args=${JSON.stringify(callArgs.open_url)}`);
  delete callArgs.open_url;
  const br0 = JSON.parse(E("JSON.stringify(packBuyRect(0))")); // pack A — no link
  (els.c.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: br0[0] + 10, clientY: br0[1] + 10, pointerId: 32, timeStamp: tNow }));
  check("unlinked pack shows TBD, no checkout",
    !callArgs.open_url && E("bangs.some(b=>b.t==='STORE LINK TBD')") === true);
  const rows2 = JSON.parse(E("JSON.stringify(gemShopRows())"));
  (els.c.listeners.pointerdown || []).forEach((f) => f({ button: 0, clientX: rows2[1][0] + 20, clientY: rows2[1][1] + 10, pointerId: 33, timeStamp: tNow }));
  check("redeem row opens code modal", E("redeemMode") === true && E("gemShop") === false);
  E("redeemMode = false; redeemBuf = ''; gemShop = false; bangs.length = 0");

  // ---- 32. SIGNED CODES: redeem pays once, re-use + bad codes bounce ----
  E("jelly = 0; redeemed = []");
  const good = "JELLYPAL-C-ABCDEFGH-" + "A".repeat(103);
  const r1 = await E(`tryRedeem(${JSON.stringify(good)})`);
  check("valid code pays its pack", r1 === "+1000 GEMS!" && E("jelly") === 1000, `msg=${r1} jelly=${E("jelly")}`);
  const r2 = await E(`tryRedeem(${JSON.stringify(good)})`);
  check("same code twice is rejected", r2 === "CODE USED" && E("jelly") === 1000, `msg=${r2}`);
  const r3 = await E(`tryRedeem("JELLYPAL-A-SHORT")`);
  check("malformed code rejected", r3 === "BAD CODE" && E("jelly") === 1000, `msg=${r3}`);
  const r4 = await E(`tryRedeem("JELLYPAL-E-ABCDEFGH-" + "A".repeat(103))`);
  check("unknown pack letter rejected", r4 === "BAD CODE" && E("jelly") === 1000, `msg=${r4}`);
  E("jelly = 5000"); // restore the sandbox balance

  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 2 : 0);
})();

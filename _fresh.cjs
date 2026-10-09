// clean-machine harness — same DOM stubs as _verify.cjs but load_state
// returns a fresh/empty save: this is the FIRST-EVER boot a real itch.io
// downloader sees. asserts the starter experience works with zero state.
//   node _fresh.cjs        → empty save ("{}")
//   node _fresh.cjs null   → save file literally contains "null" (edge)
const fs = require("fs");

const calls = [];
const crashMsgs = [];
let lastSave = null;
const photoLoads = [];
const photoLoadResolvers = [];
const photoDeletes = [];
const photoDeletePending = [];
const photoListPending = [];
let photoListCalls = 0;
const photoFolderPending = [];
let photoFolderCalls = 0;
let weatherReply = null;
let weatherDeferred = false;
const weatherPending = [];
let imageDecodeFailure = false;
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
global.Image = class {
  constructor() { this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; }
  set src(v) {
    this._src = v;
    this.complete = true;
    if (imageDecodeFailure) {
      imageDecodeFailure = false;
      if (this.onerror) this.onerror(new Error("simulated image decode failure"));
      return;
    }
    this.naturalWidth = 1;
    this.naturalHeight = 1;
    if (this.onload) this.onload();
  }
};
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };

// THE CLEAN MACHINE: no state.json — the backend returns "{}" (or a
// payload passed on argv for edge cases like a literal "null" file).
// "seeded" boots a crafted save that tries to smuggle unowned gear in.
const SEEDED = process.argv[2] === "seeded";
const ALBUM = process.argv[2] === "album";
const MALFORMED = process.argv[2] === "malformed";
const NARROW_PROP = process.argv[2] === "narrowprop";
const TODAY_LOCAL = (() => {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0")
    + "-" + String(d.getDate()).padStart(2, "0");
})();
const ALBUM_NAMES = Array.from({ length: 100 }, (_, i) => `photo_${String(i).padStart(3, "0")}.png`);
const LOAD_PAYLOAD = NARROW_PROP
  ? JSON.stringify({ ver: 2, props: { box: { x: 116, y: 300 } } })
  : SEEDED
  ? JSON.stringify({
      ver: 2, owned: ["sprout", "ember", "hyb7", "hyb8"], active: "sprout",
      xp: 4294967303, jelly: 5, pityRare: 999, pityLeg: -4, hybSeq: Number.MAX_SAFE_INTEGER,
      breedReadyAt: 1e300, vol: 1e300, treatKind: 4294967303, dexMile: 999,
      lastSelfie: "X".repeat(5000), lastEgg: "Y".repeat(5000),
      lastDaily: TODAY_LOCAL, dailyStreak: 4294967303,
      accOwned: ["cap", "cap", "bogus", "cap"],
      accEquip: { sprout: "cap", ember: "crown", zzz: "cap" },
      names: { sprout: "  longname12345  ", ember: 42, zzz: "GHOST" },
      stats: { pulls: {}, breeds: -4, shiny: "9", treats: 7.9, plays: 2, focusSec: "grow" },
      fab: [],
      redeemed: [...Array.from({ length: 12 }, (_, i) => `lic-${String(i).padStart(2, "0")}`), "LIC-00", 42, "BAD SPACE", ""],
      redeemedBound: ["lic-00", "LIC-01", "LIC-01", "NOT-REDEEMED"],
      claimed: ["ABCDEFGH", "ABCDEFGH", "BAD", 42, "234567AB"],
      hints: { swish: "false", poke: false, circle: 1, fling: true, pal: 2, pal2: {}, ball: null, unknown: 1 },
      bond: { sprout: 31.9, ember: "bad", hyb7: 42, zzz: 500 },
      shiny: { sprout: "yes", ember: true, hyb7: 1, zzz: true },
      panelPos: {
        _res: "1920x1080",
        ranch: { x: 1e300, y: -1e300 },
        nursery: { x: null, y: 12 },
        card: { x: "20", y: 20 },
      },
      props: {
        bowl: { x: 120, y: 720, fill: 1.8 },
        jar: { x: 220, y: 720, fill: -4 },
      },
      hybrids: [
        { id: "hyb7", name: "  waytoolonghybridname  ", r: 999, shape: "toString",
          pal: { b: "#123456", o: "bad", l: 42 }, top: {}, bornAt: "bad", trait: "glint" },
        { id: "hyb8", name: "Safe", r: -9, shape: "round", pal: {}, bornAt: 1e300,
          trait: "missing", mv: "warp", sig: "explode", ps: "rage", kr: "TYPE HACK",
          top: [[18, 1, "b"], [999, 1, "b"], [18, -1, "b"], [18, 1, "!"], null] },
        { id: "hyb7", name: "Duplicate", r: 0, shape: "round", pal: {}, top: [] },
        { id: "sprout", name: "Base collision", r: 0, shape: "round", pal: {}, top: [] },
      ],
      savedAt: Date.now() - 30000, seen: "false", muted: "false",
      pomo: "false", reduceMotion: "false", bootOn: "false", weatherOn: "false",
    })
  : (ALBUM ? "{}" : (process.argv[2] || "{}"));
global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      calls.push(cmd);
      if (cmd === "log_crash" && args) crashMsgs.push(args.msg);
      if (cmd === "save_state" && args) lastSave = args.json;
      if (cmd === "load_state") return Promise.resolve(LOAD_PAYLOAD);
      if (cmd === "get_monitors") return Promise.resolve(NARROW_PROP ? [[0, 0, 50, 300]] : (SEEDED ? [
        [0, 0, 1280, 720], [1280, 0, 640, 720], null,
        [0, 0, NaN, 720], [0, 0, 100, -1], ["0", 0, 100, 100], [1e300, 0, 100, 100],
      ] : [{ x: 0, y: 0, w: 1920, h: 1080 }]));
      if (cmd === "is_demo") return Promise.resolve(SEEDED ? "false" : false);
      if (cmd === "get_weather") {
        if (weatherDeferred) return new Promise((resolve, reject) => weatherPending.push({ resolve, reject }));
        return Promise.resolve(weatherReply);
      }
      if (ALBUM && cmd === "list_photos") {
        photoListCalls++;
        return new Promise((resolve, reject) => photoListPending.push({ resolve, reject }));
      }
      if (ALBUM && cmd === "load_photo") {
        photoLoads.push(args.name);
        return new Promise((resolve, reject) => photoLoadResolvers.push({ name: args.name, resolve, reject }));
      }
      if (ALBUM && cmd === "delete_photo") {
        photoDeletes.push(args.name);
        return new Promise((resolve, reject) => photoDeletePending.push({ name: args.name, resolve, reject }));
      }
      if (ALBUM && cmd === "open_photos") {
        photoFolderCalls++;
        return new Promise((resolve, reject) => photoFolderPending.push({ resolve, reject }));
      }
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

  if (NARROW_PROP) {
    check("saved wide prop centers on an undersized monitor floor",
      E("box && box.x") === 25 && E("box && box.y") === 300);
    check("restored wide prop keeps a live platform anchor",
      E("box && box.plat === monPlats[0] && plats.includes(box.plat)"));
    await E("persist()");
    const narrowSave = lastSave && JSON.parse(lastSave);
    check("normalized narrow-platform position persists",
      !!narrowSave && narrowSave.props.box.x === 25 && narrowSave.props.box.y === 300);
    check("zero crashes on narrow-prop boot", realCrashes().length === 0,
      realCrashes().slice(0, 3).join(" | "));
    console.log(`=== fresh(narrowprop): ${pass} passed, ${fail} failed ===`);
    process.exit(fail ? 1 : 0);
  }

  if (MALFORMED) {
    check("malformed load response fails closed visibly",
      E("saveReady") === false && E("loadFailed") === true && E("dirty") === true
        && E("bangs.some((b) => b.t === 'LOAD FAILED')"));
    const savesBefore = calls.filter((cmd) => cmd === "save_state").length;
    await E("persist()").catch(() => {});
    check("malformed load response blocks backend save",
      calls.filter((cmd) => cmd === "save_state").length === savesBefore && E("dirty") === true);
    let strictParser = E("typeof parseLoadedState === 'function'");
    if (strictParser) {
      try { E("parseLoadedState('[]')"); strictParser = false; } catch {}
      try { E("parseLoadedState('42')"); strictParser = false; } catch {}
      try { E("parseLoadedState(null)"); strictParser = false; } catch {}
      strictParser = strictParser
        && JSON.stringify(E("parseLoadedState('null')")) === "{}"
        && JSON.stringify(E("parseLoadedState('{\"jelly\":7}')")) === '{"jelly":7}';
    }
    check("load parser accepts only object JSON or textual null", strictParser);
    check("failed-load defaults remain frame-safe", E("petX") > 0 && E("petY") > 0);
    check("zero crashes after malformed load response", realCrashes().length === 0,
      realCrashes().slice(0, 3).join(" | "));
    console.log(`=== fresh(malformed): ${pass} passed, ${fail} failed ===`);
    process.exit(fail ? 1 : 0);
  }

  if (ALBUM) {
    const flush = async () => {
      await Promise.resolve();
      await new Promise((r) => setImmediate(r));
    };
    const resolvePhoto = async () => {
      const pending = photoLoadResolvers.shift();
      if (pending) pending.resolve("AAAA");
      await flush();
    };
    const rejectPhoto = async () => {
      const pending = photoLoadResolvers.shift();
      if (pending) pending.reject(new Error("simulated photo read failure"));
      await flush();
    };
    const drainPhotos = async () => {
      for (let guard = 0; guard < 20; guard++) {
        if (photoLoadResolvers.length) await resolvePhoto();
        else {
          await flush();
          if (!photoLoadResolvers.length && !E("albumLoadName") && E("albumLoadQueue.length") === 0) return;
        }
      }
      throw new Error("album loader did not drain");
    };

    const initialOpen = E("openAlbum()");
    await flush();
    photoListPending.shift().resolve(ALBUM_NAMES);
    await initialOpen;
    await flush();
    check("100-photo album opens on newest entry",
      E("albumOpen") && E("albumList.length") === 100 && E("albumIdx") === 99);
    check("album starts only one photo IPC",
      photoLoads.length === 1 && photoLoadResolvers.length === 1 && E("albumLoadName") === "photo_099.png",
      `loads=${photoLoads.join(",")}`);
    await rejectPhoto();
    await drainPhotos();
    check("failed photo load stops once in an explicit retry state",
      E("albumImgs['photo_099.png']") === "failed"
        && photoLoads.filter((name) => name === "photo_099.png").length === 1
        && photoLoadResolvers.length === 0 && !E("albumLoadName") && E("albumLoadQueue.length") === 0,
      `loads=${photoLoads.join(",")} state=${E("albumImgs['photo_099.png']")}`);
    let [bx, by, bw, bh] = E("albumRect()");
    const loadsBeforeRetry = photoLoads.length;
    E(`albumClick(${bx + bw / 2}, ${by + bh / 2})`);
    await flush();
    check("failed photo click dispatches exactly one retry",
      photoLoads.length === loadsBeforeRetry + 1 && photoLoads.at(-1) === "photo_099.png"
        && photoLoadResolvers.length === 1 && E("albumLoadName") === "photo_099.png");
    await resolvePhoto();
    check("successful retry replaces the failure state",
      E("albumImgs['photo_099.png']") !== "failed" && typeof E("albumImgs['photo_099.png']") === "object");
    E("delete albumImgs['photo_099.png']; loadAlbumWindow()");
    await flush();
    imageDecodeFailure = true;
    await resolvePhoto();
    check("browser photo decode failure becomes an explicit retry state",
      E("albumImgs['photo_099.png']") === "failed"
        && photoLoadResolvers.length === 0 && !E("albumLoadName") && E("albumLoadQueue.length") === 0);
    E(`albumClick(${bx + bw / 2}, ${by + bh / 2})`);
    await flush();
    await resolvePhoto();
    check("decoded-photo retry succeeds without reopening the album",
      E("albumImgs['photo_099.png']") !== "failed"
        && typeof E("albumImgs['photo_099.png']") === "object");
    check("album caches only current and neighbors",
      JSON.stringify(E("Object.keys(albumImgs).sort()")) === '["photo_000.png","photo_098.png","photo_099.png"]',
      `cache=${E("JSON.stringify(Object.keys(albumImgs).sort())")}`);

    E(`albumClick(${bx + bw - 2}, ${by + bh + 10})`); // newest -> wrapped first
    await flush();
    const beforeChurn = photoLoads.length;
    for (let i = 0; i < 50; i++) E(`albumClick(${bx + bw - 2}, ${by + bh + 10})`);
    await flush();
    check("rapid navigation keeps one photo IPC in flight",
      photoLoads.length === beforeChurn && photoLoadResolvers.length === 1,
      `loads=${photoLoads.length} pending=${photoLoadResolvers.length}`);
    await drainPhotos();
    check("navigation cache remains a three-photo window",
      E("Object.keys(albumImgs).length") <= 3
        && JSON.stringify(E("Object.keys(albumImgs).sort()")) === '["photo_049.png","photo_050.png","photo_051.png"]',
      `idx=${E("albumIdx")} cache=${E("JSON.stringify(Object.keys(albumImgs).sort())")}`);

    const folderFailuresBefore = E("bangs.filter((b) => b.t === 'OPEN FOLDER FAILED').length");
    E(`albumClick(${E("winW") / 2}, ${by + bh + 30})`);
    E(`albumClick(${E("winW") / 2}, ${by + bh + 30})`);
    await flush();
    check("album folder launch stays single-flight while pending",
      photoFolderCalls === 1 && photoFolderPending.length === 1 && E("albumFolderRequest") !== null);
    photoFolderPending.shift().reject(new Error("simulated folder launch failure"));
    await flush();
    check("album folder launch failure is visible and unlocks retry",
      photoFolderCalls === 1 && photoFolderPending.length === 0
        && E("albumFolderRequest") === null
        && E("bangs.filter((b) => b.t === 'OPEN FOLDER FAILED').length") === folderFailuresBefore + 1);
    E(`albumClick(${E("winW") / 2}, ${by + bh + 30})`);
    await flush();
    photoFolderPending.shift().resolve(null);
    await flush();
    check("album folder launch retries cleanly after failure",
      photoFolderCalls === 2 && photoFolderPending.length === 0 && E("albumFolderRequest") === null
        && E("bangs.filter((b) => b.t === 'OPEN FOLDER FAILED').length") === folderFailuresBefore + 1);

    [bx, by, bw, bh] = E("albumRect()");
    const deleteX = bx + bw - 10, deleteY = by + bh + 30;
    const deleteName = E("albumList[albumIdx]");
    E(`albumClick(${deleteX}, ${deleteY})`);
    E(`albumClick(${deleteX}, ${deleteY})`);
    await flush();
    E(`albumClick(${deleteX}, ${deleteY})`);
    E(`albumClick(${deleteX}, ${deleteY})`);
    await flush();
    check("album delete stays single-flight while pending",
      photoDeletes.length === 1 && photoDeletes[0] === deleteName
        && photoDeletePending.length === 1 && E("albumDeleteName") === deleteName);
    E(`albumClick(${bx + bw - 2}, ${by + bh + 10})`);
    await flush();
    const viewedAfterNavigation = E("albumList[albumIdx]");
    photoDeletePending.shift().resolve(null);
    await flush();
    await drainPhotos();
    check("delete completion removes its named photo and preserves navigation",
      !E(`albumList.includes(${JSON.stringify(deleteName)})`)
        && !E(`Object.prototype.hasOwnProperty.call(albumImgs, ${JSON.stringify(deleteName)})`)
        && E("albumList[albumIdx]") === viewedAfterNavigation
        && E("albumList.length") === 99 && E("Object.keys(albumImgs).length") <= 3,
      `deleted=${JSON.stringify(photoDeletes)} current=${E("albumList[albumIdx]")}`);
    const failureName = E("albumList[albumIdx]");
    const listBeforeFailure = E("JSON.stringify(albumList)");
    const deleteFailuresBefore = E("bangs.filter((b) => b.t === 'DELETE FAILED').length");
    E(`albumClick(${deleteX}, ${deleteY})`);
    E(`albumClick(${deleteX}, ${deleteY})`);
    await flush();
    photoDeletePending.shift().reject(new Error("simulated photo delete failure"));
    await flush();
    check("delete failure preserves the catalog, unlocks retry, and is visible",
      photoDeletes.at(-1) === failureName && E("JSON.stringify(albumList)") === listBeforeFailure
        && E("albumDeleteName") === null
        && E("bangs.filter((b) => b.t === 'DELETE FAILED').length") === deleteFailuresBefore + 1);
    E("albumOpenWanted = false; albumOpen = false");
    const albumFailuresBefore = E("bangs.filter((b) => b.t === 'ALBUM FAILED').length");
    const catalogCallsBefore = photoListCalls;
    const failedOpenA = E("openAlbum()");
    const failedOpenB = E("openAlbum()");
    await flush();
    check("repeated album opens share one catalog request",
      failedOpenA === failedOpenB && photoListCalls === catalogCallsBefore + 1 && photoListPending.length === 1);
    photoListPending.shift().reject(new Error("simulated album catalog failure"));
    const failedOpenResult = await failedOpenA;
    await flush();
    check("album catalog failure unlocks retry and is visible",
      failedOpenResult === false && E("albumListRequest") === null && !E("albumOpen")
        && E("bangs.filter((b) => b.t === 'ALBUM FAILED').length") === albumFailuresBefore + 1);
    const canceledOpen = E("openAlbum()");
    await flush();
    E("albumOpenWanted = false");
    photoListPending.shift().resolve(ALBUM_NAMES);
    const canceledOpenResult = await canceledOpen;
    await flush();
    check("closed album ignores a late catalog response",
      canceledOpenResult === false && E("albumListRequest") === null && !E("albumOpen"));
    check("zero crashes during album churn", realCrashes().length === 0,
      realCrashes().slice(0, 3).join(" | "));
    console.log(`=== fresh(album): ${pass} passed, ${fail} failed ===`);
    process.exit(fail ? 1 : 0);
  }

  // ---- first boot basics ----
  check("pet spawns on clean machine", E("petX") > 0 && E("petY") > 0,
    `x=${E("petX").toFixed(0)} y=${E("petY").toFixed(0)}`);
  if (SEEDED) {
    // ---- loaded-save sanitization: gear is gated by real ownership ----
    check("seeded owned list loads", JSON.stringify(E("owned")) === '["sprout","ember","hyb7","hyb8"]', JSON.stringify(E("owned")));
    check("seeded accOwned loads", JSON.stringify(E("accOwned")) === '["cap"]', JSON.stringify(E("accOwned")));
    check("unowned acc equip stripped", JSON.stringify(E("accEquip")) === '{"sprout":"cap"}',
      `accEquip=${E("JSON.stringify(accEquip)")}`);
    check("saved names normalized and ownership-gated",
      JSON.stringify(E("customNames")) === '{"sprout":"LONGNAME12"}',
      `names=${E("JSON.stringify(customNames)")}`);
    let nameSortSafe = true;
    try { E("sortMode = 2; gridIdx().map((i) => spName(SPECIES[i]))"); }
    catch { nameSortSafe = false; }
    check("name sort survives malformed save values", nameSortSafe);
    check("numeric metadata normalized and empty FAB rejected",
      E("stats.pulls") === 0 && E("stats.breeds") === 0 && E("stats.shiny") === 0
        && E("stats.treats") === 7 && E("stats.plays") === 2 && E("stats.focusSec") === 0
        && E("Number.isFinite(fabPos()[0]) && Number.isFinite(fabPos()[1])")
        && E("fabPos()[0]") === 1892 && E("fabPos()[1]") === 28);
    check("boot monitor floors discard poisoned rows and keep valid siblings",
      E("monPlats.length") === 2 && E("plats.length") === 2
        && E("monPlats.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.w)&&p.w>0)")
        && JSON.stringify(E("monPlats")) === '[{"x":0,"y":720,"w":1280},{"x":1280,"y":720,"w":640}]'
        && E("sanitizeMonitorPlatforms(null)") === null
        && E("sanitizeMonitorPlatforms([[0,0,NaN,10]])") === null,
      E("JSON.stringify(monPlats)"));
    check("saved boolean preferences require literal true",
      E("muted") === false && E("pomo") === false && E("reduceMotion") === false
        && E("seen") === false && E("bootOn") === false && E("weatherOn") === false
        && calls.filter((cmd) => cmd === "set_autostart").length === 0);
    check("default-on weather preference fails closed on malformed values",
      E("savedDefaultOn(undefined)") === true && E("savedDefaultOn(true)") === true
        && E("savedDefaultOn(false)") === false && E("savedDefaultOn('false')") === false
        && E("savedDefaultOn(1)") === false && E("savedDefaultOn({})") === false
        && E("savedDefaultOn(null)") === false);
    check("demo IPC requires the literal boolean true",
      E("DEMO") === false && E("isDemoResponse(true)") === true
        && E("isDemoResponse('false')") === false && E("isDemoResponse(1)") === false
        && E("isDemoResponse({})") === false);
    const weatherCallsBeforeLoadGate = calls.filter((cmd) => cmd === "get_weather").length;
    weatherReply = 95;
    E("saveReady = false; weatherOn = true; wxCode = -1; wxAt = 0; pollWeather()");
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    const weatherWaitedForLoad = calls.filter((cmd) => cmd === "get_weather").length === weatherCallsBeforeLoadGate
      && E("wxCode") === -1 && E("wxAt") === 0;
    E("saveReady = true; pollWeather()");
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    check("weather probe waits for safe state load before network access",
      weatherWaitedForLoad
        && calls.filter((cmd) => cmd === "get_weather").length === weatherCallsBeforeLoadGate + 1
        && E("wxCode") === 95 && E("wxRainy()") === true);
    E("wxCode = -1; wxAt = 0");
    weatherReply = 999;
    E("pollWeather()");
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    const invalidWeatherIgnored = E("wxCode") === -1 && E("wxAt") === 0;
    weatherReply = 95;
    E("pollWeather()");
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    check("weather IPC ignores invalid codes and accepts a real WMO code",
      invalidWeatherIgnored && E("wxCode") === 95 && E("wxRainy()") === true
        && E("isWeatherCode(Infinity)") === false && E("isWeatherCode(1.5)") === false,
      `code=${E("wxCode")} at=${E("wxAt")}`);
    weatherReply = null;
    weatherDeferred = true;
    E("setWeatherEnabled(true)");
    await Promise.resolve();
    E("setWeatherEnabled(false)");
    weatherPending.shift().resolve(95);
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    check("WEATHER OFF invalidates an in-flight response",
      E("weatherOn") === false && E("wxCode") === -1 && E("wxAt") === 0
        && E("wxRainy()") === false && weatherPending.length === 0);
    E("setWeatherEnabled(true)");
    E("pollWeather()");
    await Promise.resolve();
    const olderWeather = weatherPending.shift();
    const newerWeather = weatherPending.shift();
    newerWeather.resolve(71);
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    const latestWeatherApplied = E("wxCode") === 71 && E("wxSnowy()") === true;
    olderWeather.resolve(95);
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
    check("overlapping weather polls keep the newest response",
      latestWeatherApplied && E("wxCode") === 71 && E("wxSnowy()") === true
        && weatherPending.length === 0);
    E("setWeatherEnabled(false)");
    weatherDeferred = false;
    const restoredPanel = E(`(() => {
      ranch.offsetWidth = 440; ranch.offsetHeight = 400;
      toggleRanch(true);
      const result = {
        saved: JSON.parse(JSON.stringify(panelPos)),
        left: parseFloat(ranch.style.left), top: parseFloat(ranch.style.top),
        poison: sanitizePanelPositions({_res: '1920x1080', ranch: {x: Infinity, y: NaN}}),
      };
      toggleRanch(false);
      return result;
    })()`);
    check("saved panel positions stay finite, bounded, and reopen on-screen",
      restoredPanel.saved.ranch.x === 1920 && restoredPanel.saved.ranch.y === 0
        && !restoredPanel.saved.nursery && !restoredPanel.saved.card
        && Number.isFinite(restoredPanel.left) && restoredPanel.left >= 4 && restoredPanel.left <= 1476
        && Number.isFinite(restoredPanel.top) && restoredPanel.top >= 4 && restoredPanel.top <= 676
        && !restoredPanel.poison.ranch,
      JSON.stringify(restoredPanel));
    check("padded current daily key does not duplicate payout or reset streak",
      E("lastDaily") === TODAY_LOCAL && E("dailyStreak") === 36500,
      `last=${E("lastDaily")} streak=${E("dailyStreak")}`);
    check("large saved counters do not wrap negative",
      E("xp") === 4294967303 && E("level") === 3 && E("jelly") >= 5
        && E("pityRare") === 12 && E("pityLeg") === 0);
    check("deadlines, selectors, and date keys are bounded",
      E("breedReadyAt") > Date.now() && E("breedReadyAt") <= Date.now() + E("BREED_CD") + 1000
        && E("vol") === 1 && E("treatKind") === E("TREATS.length - 1")
        && E("dexMile") === E("DEX_MILES.length")
        && E("lastSelfie") === "" && E("lastEgg") === "");
    check("restored consumable fills are discrete and bounded",
      E("bowl.fill") === 1 && E("jar.fill") === 0
        && E("sanitizePropFill(undefined)") === 2 && E("sanitizePropFill(null)") === 2
        && E("sanitizePropFill(-9)") === 0 && E("sanitizePropFill(3.9)") === 3
        && E("sanitizePropFill(Infinity)") === 2,
      E("JSON.stringify({bowl:bowl.fill,jar:jar.fill})"));
    const jarPersistence = E(`(() => {
      const oldX = petX;
      petX = jar.x; jar.fill = 2; dirty = false;
      bondLast = performance.now() + 100000;
      propArrive({kind: 'jar'}, performance.now());
      const result = { fill: jar.fill, dirty };
      petX = oldX;
      return result;
    })()`);
    check("main-pet jar snack always schedules persistence",
      jarPersistence.fill === 1 && jarPersistence.dirty === true,
      JSON.stringify(jarPersistence));
    check("daily selfie due check uses one padded local calendar key",
      E("localIsoDayKey({getFullYear:()=>2026,getMonth:()=>0,getDate:()=>2})") === "2026-01-02"
        && E("dailySelfieDue('2026-01-02',{getFullYear:()=>2026,getMonth:()=>0,getDate:()=>2})") === false
        && E("dailySelfieDue('2026-01-01',{getFullYear:()=>2026,getMonth:()=>0,getDate:()=>2})") === true);
    check("daily egg comparison accepts a legacy key only for the same local day",
      E("localDayKeyMatches('2026-1-2',{getFullYear:()=>2026,getMonth:()=>0,getDate:()=>2})") === true
        && E("localDayKeyMatches('2026-01-02',{getFullYear:()=>2026,getMonth:()=>0,getDate:()=>2})") === true
        && E("localDayKeyMatches('2026-1-1',{getFullYear:()=>2026,getMonth:()=>0,getDate:()=>2})") === false);
    const weeklyBoundary = E(`(() => {
      const dec31 = new Date(2025, 11, 31, 12);
      const jan1 = new Date(2026, 0, 1, 12);
      const jan4 = new Date(2026, 0, 4, 12);
      const jan5 = new Date(2026, 0, 5, 12);
      return {
        keys: [weekKey(dec31), weekKey(jan1), weekKey(jan4), weekKey(jan5)],
        migratedSame: weeklyKeyMatches(legacyWeekKey(dec31), jan1, dec31.getTime()),
        migratedNext: weeklyKeyMatches(legacyWeekKey(jan4), jan5, jan4.getTime()),
      };
    })()`);
    check("ISO weekly reward stays one week across the year boundary",
      JSON.stringify(weeklyBoundary.keys) === '["2026-W01","2026-W01","2026-W01","2026-W02"]'
        && weeklyBoundary.migratedSame === true && weeklyBoundary.migratedNext === false,
      JSON.stringify(weeklyBoundary));
    check("code history normalized and boot binding bounded",
      E("redeemed.length") === 12 && E("new Set(redeemed).size") === 12
        && E("redeemed.every((code) => code === code.toUpperCase())")
        && E("redeemedBound.length") === 10
        && calls.filter((cmd) => cmd === "redeem_bound").length === 8
        && JSON.stringify(E("claimedNonces")) === '["ABCDEFGH","234567AB"]');
    check("hint, bond, and shiny metadata ownership/type-gated",
      E("hintsSeen && typeof hintsSeen === 'object' && !Array.isArray(hintsSeen) && Object.keys(hintsSeen).every((id) => HINTS.some((h) => h.id === id))")
        && JSON.stringify(E("bond")) === '{"sprout":31,"hyb7":42}'
        && JSON.stringify(E("shinyOwned")) === '{"ember":true,"hyb7":true}',
      `hints=${E("JSON.stringify(hintsSeen)")} bond=${E("JSON.stringify(bond)")} shiny=${E("JSON.stringify(shinyOwned)")}`);
    check("saved hint completion accepts only canonical true markers",
      E("hintsSeen.circle") === 1 && E("hintsSeen.fling") === 1
        && !E("Object.prototype.hasOwnProperty.call(hintsSeen, 'swish')")
        && !E("Object.prototype.hasOwnProperty.call(hintsSeen, 'poke')")
        && !E("Object.prototype.hasOwnProperty.call(hintsSeen, 'pal')")
        && !E("Object.prototype.hasOwnProperty.call(hintsSeen, 'pal2')")
        && !E("Object.prototype.hasOwnProperty.call(hintsSeen, 'ball')")
        && JSON.stringify(E("sanitizeHints({swish:1,poke:true,circle:'false',fling:2,pal:{},unknown:1})")) === '{"swish":1,"poke":1}',
      E("JSON.stringify(hintsSeen)"));
    check("saved companion restore keeps the first distinct species",
      E("JSON.stringify(sanitizeSavedPals(['sprout','sprout','bogus','ember','ember','hyb7','hyb8']))") === '["sprout","ember","hyb7"]');
    check("oversized saved arrays stop at the scan bound",
      E("JSON.stringify(sanitizeOwnedList(Array(5000).fill('bogus').concat('ember')))") === '["sprout"]'
        && E("sanitizeAccOwnedList(Array(5000).fill('bogus').concat('cap')).length") === 0
        && E("sanitizeSavedPals(Array(5000).fill('bogus').concat('ember')).length") === 0);
    check("oversized saved maps stop before late valid entries",
      E("Object.keys(sanitizeAccEquip(Object.fromEntries(Array.from({length: 5000}, (_, i) => ['bad' + i, 'cap']).concat([['sprout', 'cap']])))).length") === 0
        && E("Object.keys(sanitizeBond(Object.fromEntries(Array.from({length: 5000}, (_, i) => ['bad' + i, 1]).concat([['sprout', 9]])))).length") === 0
        && E("Object.keys(sanitizeCustomNames(Object.fromEntries(Array.from({length: 5000}, (_, i) => ['bad' + i, 'X']).concat([['sprout', 'SAFE']])))).length") === 0);
    E("hintDrip = 0; hintUntil = 0; curV = 500; bondLast = 0; bondGain('sprout', 1)");
    await pump(4);
    check("sanitized hint map and bond remain safely mutable",
      E("hintsSeen.swish") === 1 && E("bond.sprout") === 32 && Number.isFinite(E("bond.sprout")));
    E("stats.pulls++; stats.focusSec += 0.5; settingsOpen = true");
    await pump(2); // force the settings counters through the real draw path
    E("settingsOpen = false");
    E("persist()");
    const seededSave = lastSave && JSON.parse(lastSave);
    check("persist keeps only normalized names",
      !!seededSave && JSON.stringify(seededSave.names) === '{"sprout":"LONGNAME12"}',
      seededSave ? `names=${JSON.stringify(seededSave.names)}` : "no save");
    check("normalized stats stay numeric through update and persistence",
      !!seededSave && seededSave.stats.pulls === 1 && seededSave.stats.treats === 7
        && seededSave.stats.plays === 2 && seededSave.stats.focusSec === 0.5);
    check("persist keeps bounded unique code history",
      !!seededSave && seededSave.redeemed.length === 12 && seededSave.redeemedBound.length === 10
        && seededSave.claimed.length === 2);
    check("persist keeps normalized hint, bond, and shiny maps",
      !!seededSave && seededSave.hints.swish === 1 && seededSave.bond.sprout === 32
        && seededSave.bond.hyb7 === 42 && seededSave.shiny.ember === true
        && seededSave.shiny.hyb7 === true && !seededSave.shiny.sprout);
    check("malformed hybrids normalized and collisions rejected",
      E("SPECIES.filter((sp) => sp.id === 'hyb7').length") === 1
        && E("SPECIES.filter((sp) => sp.id === 'sprout').length") === 1
        && E("SPECIES.find((sp) => sp.id === 'hyb7').r") === 2
        && E("SPECIES.find((sp) => sp.id === 'hyb7').shape") === "round"
        && E("SPECIES.find((sp) => sp.id === 'hyb7').top.length") === 0
        && E("SPECIES.find((sp) => sp.id === 'hyb8').bornAt") <= Date.now()
        && E("hybSeq") === 9);
    check("hybrid decoration pixels filtered",
      E("JSON.stringify(SPECIES.find((sp) => sp.id === 'hyb8').top)") === '[[18,1,"b"]]',
      `top=${E("JSON.stringify(SPECIES.find((sp) => sp.id === 'hyb8').top)")}`);
    check("unsupported hybrid behavior metadata stripped",
      E("['trait','mv','sig','ps','kr'].every((key) => !Object.prototype.hasOwnProperty.call(SPECIES.find((sp) => sp.id === 'hyb8'), key))"));
    let hybridSpriteSafe = true;
    try { E("sprite('idle', SPECIES.findIndex((sp) => sp.id === 'hyb7'), false); sprite('idle', SPECIES.findIndex((sp) => sp.id === 'hyb8'), false)"); }
    catch { hybridSpriteSafe = false; }
    check("normalized hybrids render without throwing", hybridSpriteSafe);
    check("persist keeps bounded hybrid schema",
      !!seededSave && seededSave.hybrids.length === 2
        && seededSave.hybrids.every((h) => h.r >= 0 && h.r <= 2 && Array.isArray(h.top)));
    const counterLimit = E(`(() => {
      xp = MAX_SAVED_COUNTER; jelly = MAX_SAVED_COUNTER;
      gainXp(1, null);
      return { xp, jelly, integer: addSavedInt(MAX_SAVED_COUNTER, 2500),
        measure: addSavedMeasure(MAX_SAVED_COUNTER, 0.5) };
    })()`);
    check("persistent counter gains saturate before precision loss",
      counterLimit.xp === Number.MAX_SAFE_INTEGER - 1
        && counterLimit.jelly === Number.MAX_SAFE_INTEGER - 1
        && counterLimit.integer === Number.MAX_SAFE_INTEGER - 1
        && counterLimit.measure === Number.MAX_SAFE_INTEGER - 1,
      JSON.stringify(counterLimit));
    const bondLimit = E(`(() => {
      bond.sprout = MAX_SAVED_COUNTER; bondLast = 0;
      bondGain('sprout', 3);
      return bond.sprout;
    })()`);
    check("bond gains saturate before precision loss",
      bondLimit === Number.MAX_SAFE_INTEGER - 1, `bond=${bondLimit}`);
    const hybridLimit = E(`(() => {
      hybSeq = Number.MAX_SAFE_INTEGER - 1;
      const first = makeHybrid(SPECIES[0], SPECIES[1]);
      const second = makeHybrid(SPECIES[0], SPECIES[1]);
      const speciesBefore = SPECIES.length, breedsBefore = stats.breeds;
      jelly = 100; breedReadyAt = 0; breedSel = [0, 1];
      doBreed();
      return { first: first && first.id, second, seq: hybSeq, species: SPECIES.length - speciesBefore,
        spent: 100 - jelly, breeds: stats.breeds - breedsBefore };
    })()`);
    check("hybrid sequence exhaustion cannot duplicate ids or charge breeding",
      hybridLimit.first === `hyb${Number.MAX_SAFE_INTEGER - 1}`
        && hybridLimit.second === null && hybridLimit.seq === Number.MAX_SAFE_INTEGER
        && hybridLimit.species === 0 && hybridLimit.spent === 0 && hybridLimit.breeds === 0,
      JSON.stringify(hybridLimit));
    check("zero crashes on seeded boot", realCrashes().length === 0, realCrashes().slice(0, 3).join(" | "));
    console.log(`=== fresh(seeded): ${pass} passed, ${fail} failed ===`);
    process.exit(fail ? 1 : 0);
  }
  check("starter species is sprout", E("SPECIES[active] && SPECIES[active].id") === "sprout",
    `active=${E("SPECIES[active] && SPECIES[active].id")}`);
  check("owned defaults to sprout", JSON.stringify(E("owned")) === '["sprout"]', JSON.stringify(E("owned")));
  check("first boot starts with 500 jelly", E("jelly") === 500, `jelly=${E("jelly")}`);
  check("starter cap is owned", JSON.stringify(E("accOwned")) === '["cap"]', JSON.stringify(E("accOwned")));
  check("tutorial flag starts unseen", E("seen") === false);
  check("no pals on clean machine", E("pals.length") === 0);
  check("no props placed", !E("bowl") && !E("cushion") && !E("ball"));
  check("no pet level yet", E("level") === 0 && E("xp") === 0, `lvl=${E("level")} xp=${E("xp")}`);

  // ---- soak ~25s: crosses the 20s uptime gates (egg, hint drip, heartbeat) ----
  await pump(1500);
  check("egg stays gated until first feed", E("egg") === null, `egg=${JSON.stringify(E("egg"))}`);
  check("still alive after 25s soak", E("petX") > 0, `x=${E("petX").toFixed(0)}`);
  E("persist()"); // the 5s wall-clock interval can't fire inside a pump — call it directly
  const sv = lastSave && JSON.parse(lastSave);
  check("persist writes a valid first save", !!sv && Array.isArray(sv.owned) && sv.owned.includes("sprout"),
    sv ? `owned=${JSON.stringify(sv.owned)} jelly=${sv.jelly}` : "no save yet");

  // ---- first feed session: xp -> seen -> eggs unlock ----
  for (let i = 0; i < 55; i++) E("gainXp(1, null)"); // snack/drip path
  check("feeding flips the tutorial flag", E("seen") === true);
  check("xp banked (jelly milestone at 600 xp)", E("xp") === 55 && E("jelly") >= 500, `xp=${E("xp")} jelly=${E("jelly")}`);
  E("lastEgg = localIsoDayKey().replace(/-0/g, '-'); egg = null");
  await pump(2);
  check("legacy local-day key suppresses a duplicate daily egg", E("egg") === null);
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

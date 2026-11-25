// volume slider harness — boots main.js with stubbed DOM, opens the
// settings panel, drags row 0 (the slider), and checks vol lands where
// the cursor put it, mute follows, and the value reaches save_state.
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
const els = {};
const getEl = (id) => {
  if (!els[id]) {
    const e = {
      style: {}, innerHTML: "", textContent: "", children: [], listeners: {},
      addEventListener(ev, fn) { (e.listeners[ev] = e.listeners[ev] || []).push(fn); },
      removeEventListener() {}, appendChild() {}, remove() {},
      setPointerCapture() {}, releasePointerCapture() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 470, height: 420 }; },
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      querySelector() { return null; }, querySelectorAll() { return []; },
      width: 470, height: 420, offsetLeft: 0, offsetTop: 0, offsetWidth: 470, offsetHeight: 420,
    };
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
  createElement: (tag) => (tag === "canvas" ? getEl("_canvas_" + Math.random()) : getEl("_" + tag)),
  createElementNS: (ns, tag) => getEl("_" + tag),
  body: getEl("body"), documentElement: getEl("html"),
  addEventListener() {}, removeEventListener() {},
  fonts: { load: () => Promise.resolve() }, hidden: false,
};
let clipboardMode = "resolve";
const clipboardCalls = [];
Object.defineProperty(global, "navigator", { configurable: true, value: {
  userAgent: "sim",
  clipboard: {
    writeText(value) {
      clipboardCalls.push(value);
      if (clipboardMode === "throw") throw new Error("simulated clipboard exception");
      if (clipboardMode === "reject") return Promise.reject(new Error("simulated clipboard denial"));
      return Promise.resolve();
    },
  },
} });
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} createOscillator() { return { connect() { return { connect() {} } }, start() {}, stop() {}, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, type: "" }; } createGain() { return { connect() { return { connect() {} } }, gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, value: 0 } }; } get destination() { return {}; } };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };

let lastSave = null;
let autostartMode = "resolve";
const autostartCalls = [];
const autostartPending = [];
let resetMode = "resolve";
let resetCalls = 0;
let saveMode = "resolve";
let saveCalls = 0;
let quietReject = false;
const quietCalls = [];
let quietListenReject = false;
let redeemReject = false;
let photoSaveMode = "resolve";
let photoSaveCalls = 0;
let asyncProbeMode = "resolve";
let openUrlMode = "resolve";
const openUrlCalls = [];
global.__TAURI__ = {
  core: {
    invoke: (cmd, args) => {
      if (cmd === "load_state") return Promise.resolve(JSON.stringify({ ver: 2, jelly: 100, vol: 0.8, muted: false }));
      if (cmd === "save_state") {
        saveCalls++;
        lastSave = args;
        if (saveMode === "throw") throw new Error("simulated synchronous save failure");
        return saveMode === "reject"
          ? Promise.reject(new Error("simulated save failure"))
          : Promise.resolve(null);
      }
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1920, h: 1080 }]);
      if (cmd === "set_autostart") {
        autostartCalls.push(args.enable);
        if (autostartMode === "reject") return Promise.reject(new Error("simulated registry failure"));
        if (autostartMode === "defer") return new Promise((resolve, reject) => autostartPending.push({ resolve, reject }));
        return Promise.resolve(null);
      }
      if (cmd === "reset_save") {
        resetCalls++;
        if (resetMode === "throw") throw new Error("simulated synchronous reset failure");
        return resetMode === "reject"
          ? Promise.reject(new Error("simulated reset denial"))
          : Promise.resolve(null);
      }
      if (cmd === "save_png") {
        photoSaveCalls++;
        if (photoSaveMode === "throw") throw new Error("simulated synchronous photo save failure");
        return photoSaveMode === "reject"
          ? Promise.reject(new Error("simulated asynchronous photo save failure"))
          : Promise.resolve(null);
      }
      if (cmd === "async_probe") {
        if (asyncProbeMode === "throw") throw new Error("simulated synchronous probe failure");
        return asyncProbeMode === "reject"
          ? Promise.reject(new Error("simulated asynchronous probe failure"))
          : Promise.resolve("PROBE OK");
      }
      if (cmd === "open_url") {
        openUrlCalls.push(args.url);
        if (openUrlMode === "throw") throw new Error("simulated synchronous browser failure");
        return openUrlMode === "reject"
          ? Promise.reject(new Error("simulated asynchronous browser failure"))
          : Promise.resolve(null);
      }
      if (["set_dragging", "set_clickable", "log_crash", "quit_app"].includes(cmd)) {
        quietCalls.push(cmd);
        return quietReject ? Promise.reject(new Error("simulated best-effort IPC failure")) : Promise.resolve(null);
      }
      if (cmd === "redeem_bound" && redeemReject) return Promise.reject(new Error("simulated redeem failure"));
      return Promise.resolve(null);
    },
  },
  event: { listen: () => quietListenReject
    ? Promise.reject(new Error("simulated listen failure"))
    : Promise.resolve(() => {}) },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

const productSrc = fs.readFileSync("src/main.js", "utf8");
const rawInvokeCallCount = (productSrc.match(/\binvoke\(/g) || []).length;
const rawOpenUrlCallCount = (productSrc.match(/invokeAsync\("open_url"/g) || []).length;
const src = productSrc
  + "\n;globalThis.__G = () => ({ settingsOpen, vol, volDrag, muted, volStep, dirty, bootOn, bangs, resetArm, resetBusy, saveReady, loadFailed, photoHide, cursor: cv.style.cursor, photoOpacity: [ranch.style.opacity, nursery.style.opacity, cardEl.style.opacity, infoEl.style.opacity] });"
  + "\n;globalThis.__W = { openSettings: () => { settingsOpen = true; }, restoreLoad: () => { saveReady = true; loadFailed = false; }, cyclePanelPos: () => { panelPos.loop = panelPos; dirty = true; }, repairPanelPos: () => { delete panelPos.loop; } };";
try { (0, eval)(src); } catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }
const G = () => globalThis.__G();

const cvEv = (type, x, y) => {
  const fns = (els.c && els.c.listeners[type]) || [];
  const ev = { button: 0, clientX: x, clientY: y, pointerId: 1, timeStamp: performance.now(), preventDefault() {} };
  fns.forEach((f) => { try { f(ev); } catch (e) { console.log(type.toUpperCase() + " THREW:", e.stack.split("\n").slice(0, 5).join("\n")); fails++; } });
};
const pump = (n) => {
  for (let i = 0; i < n; i++) {
    if (!rafCb) return;
    const cb = rafCb; rafCb = null;
    try { cb(performance.now()); } catch (e) { console.log("FRAME THREW:", e.stack.split("\n").slice(0, 5).join("\n")); process.exit(2); }
  }
};
let fails = 0;
const check = (name, ok) => { console.log(ok ? "PASS" : "FAIL", name); if (!ok) fails++; };

(async () => {
  await new Promise((r) => setImmediate(r));
  pump(5);
  check("all product IPC routes through one sync-safe boundary", rawInvokeCallCount === 1);
  asyncProbeMode = "throw";
  check("invokeAsync converts synchronous throw to rejection",
    await eval(`invokeAsync("async_probe")`).then(() => false, (e) => /synchronous probe/.test(e.message)));
  asyncProbeMode = "reject";
  check("invokeAsync preserves asynchronous rejection",
    await eval(`invokeAsync("async_probe")`).then(() => false, (e) => /asynchronous probe/.test(e.message)));
  asyncProbeMode = "resolve";
  check("invokeAsync preserves successful result", await eval(`invokeAsync("async_probe")`) === "PROBE OK");
  check("all external URL opens route through one visible-result boundary", rawOpenUrlCallCount === 1);
  const openFailuresBefore = G().bangs.filter((b) => b.t === "OPEN FAILED").length;
  openUrlMode = "throw";
  const syncOpen = await eval(`openExternalUrl("https://example.com/sync")`);
  check("synchronous browser launch failure is visible",
    syncOpen === false && openUrlCalls.at(-1) === "https://example.com/sync"
      && G().bangs.filter((b) => b.t === "OPEN FAILED").length === openFailuresBefore + 1);
  openUrlMode = "reject";
  const asyncOpen = await eval(`openExternalUrl("https://example.com/async")`);
  check("asynchronous browser launch failure is visible",
    asyncOpen === false && openUrlCalls.at(-1) === "https://example.com/async"
      && G().bangs.filter((b) => b.t === "OPEN FAILED").length === openFailuresBefore + 2);
  openUrlMode = "resolve";
  const successfulOpen = await eval(`openExternalUrl("https://example.com/success")`);
  check("successful browser launch alone reports success",
    successfulOpen === true && openUrlCalls.at(-1) === "https://example.com/success"
      && G().bangs.filter((b) => b.t === "OPEN FAILED").length === openFailuresBefore + 2);
  check("vol loaded from save (0.8)", Math.abs(G().vol - 0.8) < 0.001);

  globalThis.__W.openSettings();
  pump(2);
  console.log("settingsOpen:", G().settingsOpen);
  const row0 = eval("settingsCells().filter(c=>c.r).map(c=>c.r)[0]");
  console.log("rect:", eval("JSON.stringify(settingsRect())"), "rows0:", JSON.stringify(row0));
  // Follow the same computed row geometry as the app. The panel is centered
  // and may grow/shrink as rows are added or the simulated display changes.
  const trackX0 = row0[0] + 8, trackW = row0[2] - 16, rowY = row0[1] + row0[3] / 2;

  // press at track midpoint
  cvEv("pointerdown", trackX0 + trackW / 2, rowY);
  check("volDrag grabbed", G().volDrag !== null);
  check("volume grab shows grabbing cursor", G().cursor === "grabbing");
  check("vol ~= 0.5 after mid press", Math.abs(G().vol - 0.5) < 0.04);

  // drag to left edge -> mute
  cvEv("pointermove", trackX0, rowY);
  check("volume move keeps grabbing cursor", G().cursor === "grabbing");
  check("vol = 0 at left edge", G().vol === 0);
  check("muted follows 0", G().muted === true);

  // drag to right edge -> full
  cvEv("pointermove", trackX0 + trackW, rowY);
  check("vol = 1 at right edge", G().vol === 1);
  check("unmuted", G().muted === false);

  // release
  cvEv("pointerup", trackX0 + trackW, rowY);
  check("volDrag cleared", G().volDrag === null);
  check("volume release clears grabbing cursor", G().cursor === "default");

  // a plain click at ~25% position
  cvEv("pointerdown", trackX0 + trackW * 0.25, rowY);
  cvEv("pointerup", trackX0 + trackW * 0.25, rowY);
  check("vol ~= 0.25 after tap", Math.abs(G().vol - 0.25) < 0.04);

  // persistence: dirty set -> persist -> save_state carries vol
  check("dirty flagged", G().dirty === true);
  eval("persist()");
  await new Promise((r) => setImmediate(r));
  const saved = lastSave ? JSON.parse(lastSave.json) : {};
  check("vol persisted in save_state", typeof saved.vol === "number" && Math.abs(saved.vol - G().vol) < 0.001);
  check("volStep shim coherent", typeof saved.volStep === "number");

  // pointercancel safety: grab then cancel
  cvEv("pointerdown", trackX0 + 20, rowY);
  cvEv("pointercancel", trackX0 + 20, rowY);
  check("volDrag cleared on cancel", G().volDrag === null);
  check("volume cancel clears grabbing cursor", G().cursor === "default");

  const row10 = eval("settingsCells().find(c=>c.id===10).r");
  const bootX = row10[0] + row10[2] / 2;
  const bootY = row10[1] + row10[3] / 2;
  const clickBoot = () => {
    cvEv("pointerdown", bootX, bootY);
    cvEv("pointerup", bootX, bootY);
  };

  // The older OS mutation must settle before the newer one is dispatched;
  // otherwise a late registry success could overwrite the displayed choice.
  autostartMode = "defer";
  clickBoot();
  clickBoot();
  await new Promise((r) => setImmediate(r));
  check("autostart rapid toggle ends OFF", G().bootOn === false);
  check("autostart OS writes serialized", autostartPending.length === 1 && autostartCalls.join(",") === "true");
  autostartPending[0].reject(new Error("stale simulated failure"));
  await new Promise((r) => setImmediate(r));
  check("stale failure advances latest write", G().bootOn === false && autostartPending.length === 2 && autostartCalls.join(",") === "true,false");
  autostartPending[1].resolve(null);
  await new Promise((r) => setImmediate(r));
  check("stale autostart failure ignored", G().bootOn === false);

  autostartMode = "reject";
  clickBoot();
  await new Promise((r) => setImmediate(r));
  check("autostart failure rolls back", G().bootOn === false);
  check("autostart failure is visible", G().bangs.some((b) => b.t === "STARTUP FAILED"));

  autostartMode = "resolve";
  clickBoot();
  await new Promise((r) => setImmediate(r));
  check("autostart success stays ON", G().bootOn === true);
  check("autostart calls preserve choices", autostartCalls.join(",") === "true,false,true,true");

  eval("persist()");
  await new Promise((r) => setImmediate(r));
  const bootSaved = lastSave ? JSON.parse(lastSave.json) : {};
  check("autostart choice persisted", bootSaved.bootOn === true);

  const row3 = eval("settingsCells().find(c=>c.id===3).r");
  const photoX = row3[0] + row3[2] / 2;
  const photoY = row3[1] + row3[3] / 2;
  const clickPhoto = () => {
    globalThis.__W.openSettings();
    cvEv("pointerdown", photoX, photoY);
    cvEv("pointerup", photoX, photoY);
  };
  const waitPhoto = async () => {
    await new Promise((r) => setTimeout(r, 190));
    await new Promise((r) => setImmediate(r));
  };
  const photoFailures = () => G().bangs.filter((b) => b.t === "PHOTO FAILED").length;

  const originalToDataURL = els.c.toDataURL;
  let beforePhotoFailures = photoFailures();
  els.c.toDataURL = () => { throw new Error("simulated canvas serialization failure"); };
  clickPhoto();
  await waitPhoto();
  check("photo serialization failure restores all UI", G().photoHide === false && G().photoOpacity.every((v) => v === ""));
  check("photo serialization failure is visible", photoFailures() === beforePhotoFailures + 1 && photoSaveCalls === 0);
  els.c.toDataURL = originalToDataURL;

  beforePhotoFailures = photoFailures();
  photoSaveMode = "throw";
  clickPhoto();
  await waitPhoto();
  check("synchronous photo IPC failure restores all UI", G().photoHide === false && G().photoOpacity.every((v) => v === ""));
  check("synchronous photo IPC failure is visible", photoFailures() === beforePhotoFailures + 1 && photoSaveCalls === 1);

  beforePhotoFailures = photoFailures();
  photoSaveMode = "reject";
  clickPhoto();
  await waitPhoto();
  check("asynchronous photo IPC failure restores all UI", G().photoHide === false && G().photoOpacity.every((v) => v === ""));
  check("asynchronous photo IPC failure is visible", photoFailures() === beforePhotoFailures + 1 && photoSaveCalls === 2);

  const savedBeforePhoto = G().bangs.filter((b) => b.t === "SAVED").length;
  photoSaveMode = "resolve";
  clickPhoto();
  await waitPhoto();
  check("successful photo restores all UI", G().photoHide === false && G().photoOpacity.every((v) => v === ""));
  check("successful photo alone reports saved", G().bangs.filter((b) => b.t === "SAVED").length === savedBeforePhoto + 1 && photoSaveCalls === 3);

  // PHOTO intentionally closes Settings; reopen it before the independent
  // RESET and clipboard click-path checks below.
  globalThis.__W.openSettings();
  const row14 = eval("settingsCells().find(c=>c.id===14).r");
  const resetX = row14[0] + row14[2] / 2;
  const resetY = row14[1] + row14[3] / 2;
  const clickReset = () => {
    cvEv("pointerdown", resetX, resetY);
    cvEv("pointerup", resetX, resetY);
  };
  resetMode = "reject";
  clickReset();
  check("reset first click only arms", G().resetArm > Date.now() && resetCalls === 0);
  clickReset();
  await new Promise((r) => setImmediate(r));
  check("reset failure unlocks retry", resetCalls === 1 && G().resetBusy === false);
  check("reset failure is visible", G().bangs.some((b) => b.t === "RESET FAILED"));

  const resetFailuresBeforeThrow = G().bangs.filter((b) => b.t === "RESET FAILED").length;
  resetMode = "throw";
  clickReset();
  clickReset();
  await new Promise((r) => setImmediate(r));
  check("synchronous reset throw unlocks retry", resetCalls === 2 && G().resetBusy === false);
  check("synchronous reset throw is visible", G().bangs.filter((b) => b.t === "RESET FAILED").length === resetFailuresBeforeThrow + 1);

  resetMode = "resolve";
  clickReset();
  clickReset();
  await new Promise((r) => setImmediate(r));
  check("reset success dispatches once", resetCalls === 3 && G().resetBusy === true);

  saveMode = "reject";
  eval("dirty = true");
  await eval("persist()").catch(() => {});
  check("failed save restores dirty", G().dirty === true);
  saveMode = "throw";
  eval("dirty = true");
  await eval("persist()").catch(() => {});
  check("synchronous IPC save failure restores dirty", G().dirty === true);
  saveMode = "resolve";
  await eval("persist()");
  check("successful retry clears dirty", G().dirty === false);

  const savesBeforeCycle = saveCalls;
  globalThis.__W.cyclePanelPos();
  await eval("persist()").catch(() => {});
  check("serialization failure restores dirty before IPC", G().dirty === true && saveCalls === savesBeforeCycle);
  globalThis.__W.repairPanelPos();
  await eval("persist()");
  check("serialization retry succeeds after state repair", G().dirty === false && saveCalls === savesBeforeCycle + 1);

  const savesBeforeLoadFailure = saveCalls;
  eval("handleLoadFailure()");
  check("load failure locks saving visibly", G().saveReady === false && G().loadFailed === true && G().bangs.some((b) => b.t === "LOAD FAILED"));
  await eval("persist()").catch(() => {});
  check("load failure blocks backend save", saveCalls === savesBeforeLoadFailure && G().dirty === true);
  globalThis.__W.restoreLoad();
  await eval("persist()");
  check("saving resumes only after safe load", saveCalls === savesBeforeLoadFailure + 1 && G().dirty === false);

  const row13 = eval("settingsCells().find(c=>c.id===13).r");
  const copyX = row13[0] + row13[2] / 2;
  const copyY = row13[1] + row13[3] / 2;
  const clickCopy = () => {
    cvEv("pointerdown", copyX, copyY);
    cvEv("pointerup", copyX, copyY);
  };
  clipboardMode = "reject";
  clickCopy();
  await new Promise((r) => setImmediate(r));
  check("async clipboard denial is visible", G().bangs.some((b) => b.t === "COPY FAILED"));
  clipboardMode = "throw";
  clickCopy();
  check("sync clipboard exception is contained", clipboardCalls.length === 2 && G().bangs.filter((b) => b.t === "COPY FAILED").length >= 2);
  clipboardMode = "resolve";
  clickCopy();
  await new Promise((r) => setImmediate(r));
  check("clipboard success alone reports copied", clipboardCalls.length === 3 && /^JP[A-Z2-7]{24}$/.test(clipboardCalls[2]) && G().bangs.some((b) => b.t === "ID COPIED"));

  const unhandled = [];
  const onUnhandled = (reason) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  const quietBefore = quietCalls.length;
  quietReject = true;
  quietListenReject = true;
  eval(`invokeQuiet("set_dragging", { on: true }); invokeQuiet("set_clickable", { rects: [] }); invokeQuiet("log_crash", { msg: "test" }); listenQuiet("test-event", () => {})`);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  quietReject = false;
  quietListenReject = false;
  process.off("unhandledRejection", onUnhandled);
  check("best-effort IPC and listener rejections are fully contained",
    unhandled.length === 0 && quietCalls.slice(quietBefore).includes("set_dragging")
      && quietCalls.slice(quietBefore).includes("set_clickable") && quietCalls.slice(quietBefore).includes("log_crash"));

  redeemReject = true;
  const redeemFailure = await eval(`tryRedeem("STORE-LICENSE")`);
  redeemReject = false;
  check("Error-object redeem rejection becomes visible text", redeemFailure === "SIMULATED REDEEM FAILURE");

  console.log(fails === 0 ? "ALL GREEN" : `${fails} FAILURES`);
  process.exit(fails ? 1 : 0);
})();

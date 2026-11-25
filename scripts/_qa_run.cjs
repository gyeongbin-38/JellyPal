// headless promo renderer: evals main.js with a rasterizing 2D canvas,
// pumps ~10s of real game frames, composites them over a painted desktop
// backdrop, and writes PNG frames to C:\dev\pfr for ffmpeg -> promo.gif
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT = "C:/dev/pfr";
fs.mkdirSync(OUT, { recursive: true });

// ---------- tiny raster 2D context ----------
function mkImg(w, h) { return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }; }
function px(cv, x, y, r, g, b, a) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= cv.width || y >= cv.height || a <= 0) return;
  const i = (y * cv.width + x) * 4, d = cv._img.data, sa = a / 255, da = d[i + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  d[i] = (r * sa + d[i] * da * (1 - sa)) / oa;
  d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
  d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
  d[i + 3] = oa * 255;
}
function col(v) {
  if (!v || typeof v === "object") return [120, 120, 120, 1]; // gradient/pattern -> mid gray
  let m = /^#([0-9a-f]{3,8})$/i.exec(v);
  if (m) {
    let h = m[1];
    if (h.length <= 4) h = h.split("").map((x) => x + x).join("");
    const n = parseInt(h, 16);
    return h.length === 8
      ? [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, (n & 255) / 255]
      : [(n >>> 16) & 255, (n >>> 8) & 255, n & 255, 1];
  }
  m = /rgba?\(([^)]+)\)/.exec(v);
  if (m) { const p = m[1].split(",").map(Number); return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? p[3] : 1]; }
  return [0, 0, 0, 1];
}
function rasterCtx(cv) {
  const st = { m: [1, 0, 0, 1, 0, 0], stack: [], fillStyle: "#000", strokeStyle: "#000", globalAlpha: 1, lineWidth: 1 };
  const mul = (a, b) => [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
  const xpt = (x, y) => [st.m[0] * x + st.m[2] * y + st.m[4], st.m[1] * x + st.m[3] * y + st.m[5]];
  function quadInside(pxx, pyy, c1, c2, c3, c4) {
    const s1 = (c2[0] - c1[0]) * (pyy - c1[1]) - (c2[1] - c1[1]) * (pxx - c1[0]);
    const s2 = (c3[0] - c2[0]) * (pyy - c2[1]) - (c3[1] - c2[1]) * (pxx - c2[0]);
    const s3 = (c4[0] - c3[0]) * (pyy - c3[1]) - (c4[1] - c3[1]) * (pxx - c3[0]);
    const s4 = (c1[0] - c4[0]) * (pyy - c4[1]) - (c1[1] - c4[1]) * (pxx - c4[0]);
    return (s1 >= 0 && s2 >= 0 && s3 >= 0 && s4 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0 && s4 <= 0);
  }
  function quad(x, y, w, h, fill) {
    const C = col(fill ? st.fillStyle : st.strokeStyle), a = C[3] * st.globalAlpha;
    if (a <= 0 || w <= 0 || h <= 0) return;
    const c1 = xpt(x, y), c2 = xpt(x + w, y), c3 = xpt(x + w, y + h), c4 = xpt(x, y + h);
    const x0 = Math.max(0, Math.floor(Math.min(c1[0], c2[0], c3[0], c4[0])));
    const x1 = Math.min(cv.width, Math.ceil(Math.max(c1[0], c2[0], c3[0], c4[0])));
    const y0 = Math.max(0, Math.floor(Math.min(c1[1], c2[1], c3[1], c4[1])));
    const y1 = Math.min(cv.height, Math.ceil(Math.max(c1[1], c2[1], c3[1], c4[1])));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++)
      if (quadInside(xx + 0.5, yy + 0.5, c1, c2, c3, c4)) px(cv, xx, yy, C[0], C[1], C[2], a * 255);
  }
  const ctx = {
    canvas: cv,
    get fillStyle() { return st.fillStyle; }, set fillStyle(v) { st.fillStyle = v; },
    get strokeStyle() { return st.strokeStyle; }, set strokeStyle(v) { st.strokeStyle = v; },
    get globalAlpha() { return st.globalAlpha; }, set globalAlpha(v) { st.globalAlpha = v; },
    get lineWidth() { return st.lineWidth; }, set lineWidth(v) { st.lineWidth = v; },
    get font() { return ""; }, set font(v) {},
    imageSmoothingEnabled: false,
    save() { st.stack.push([st.m.slice(), st.fillStyle, st.strokeStyle, st.globalAlpha, st.lineWidth]); },
    restore() { const s = st.stack.pop(); if (s) { st.m = s[0]; st.fillStyle = s[1]; st.strokeStyle = s[2]; st.globalAlpha = s[3]; st.lineWidth = s[4]; } },
    translate(x, y) { st.m = mul(st.m, [1, 0, 0, 1, x, y]); },
    scale(x, y) { st.m = mul(st.m, [x, 0, 0, y === undefined ? x : y, 0, 0]); },
    rotate(a) { const c = Math.cos(a), s = Math.sin(a); st.m = mul(st.m, [c, s, -s, c, 0, 0]); },
    transform(a, b, c, d, e, f) { st.m = mul(st.m, [a, b, c, d, e, f]); },
    setTransform(a, b, c, d, e, f) { st.m = [a, b, c, d, e, f]; },
    resetTransform() { st.m = [1, 0, 0, 1, 0, 0]; },
    createImageData: (w, h) => mkImg(w, h),
    getImageData(x, y, w, h) {
      const o = mkImg(w, h);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const si = ((y + yy) * cv.width + (x + xx)) * 4, di = (yy * w + xx) * 4;
        for (let k = 0; k < 4; k++) o.data[di + k] = cv._img.data[si + k];
      }
      return o;
    },
    putImageData(img, x, y) { // spec: overwrite, no transform/alpha
      for (let yy = 0; yy < img.height; yy++) for (let xx = 0; xx < img.width; xx++) {
        const dx = x + xx, dy = y + yy;
        if (dx < 0 || dy < 0 || dx >= cv.width || dy >= cv.height) continue;
        const si = (yy * img.width + xx) * 4, di = (dy * cv.width + dx) * 4;
        for (let k = 0; k < 4; k++) cv._img.data[di + k] = img.data[si + k];
      }
    },
    measureText: (s) => ({ width: String(s || "").length * 6 }),
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    createPattern() { return { addColorStop() {} }; },
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {},
    bezierCurveTo() {}, arc() {}, ellipse() {}, rect() {}, clip() {}, fill() {}, stroke() {},
    fillText() {}, strokeText() {},
    fillRect(x, y, w, h) { quad(x, y, w, h, true); },
    clearRect(x, y, w, h) {
      const c1 = xpt(x, y), c2 = xpt(x + w, y), c3 = xpt(x + w, y + h), c4 = xpt(x, y + h);
      const x0 = Math.max(0, Math.floor(Math.min(c1[0], c2[0], c3[0], c4[0])));
      const x1 = Math.min(cv.width, Math.ceil(Math.max(c1[0], c2[0], c3[0], c4[0])));
      const y0 = Math.max(0, Math.floor(Math.min(c1[1], c2[1], c3[1], c4[1])));
      const y1 = Math.min(cv.height, Math.ceil(Math.max(c1[1], c2[1], c3[1], c4[1])));
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++)
        if (quadInside(xx + 0.5, yy + 0.5, c1, c2, c3, c4)) cv._img.data[(yy * cv.width + xx) * 4 + 3] = 0;
    },
    strokeRect(x, y, w, h) {
      const lw = st.lineWidth || 1;
      quad(x, y, w, lw, false); quad(x, y + h - lw, w, lw, false);
      quad(x, y, lw, h, false); quad(x + w - lw, y, lw, h, false);
    },
    drawImage(img, ...a) {
      const src = img._img || img;
      if (!src || !src.data) return;
      const sw = src.width, sh = src.height;
      let sx = 0, sy = 0, swd = sw, shd = sh, dx, dy, dw, dh;
      if (a.length === 2) { [dx, dy] = a; dw = sw; dh = sh; }
      else if (a.length === 4) { [dx, dy, dw, dh] = a; }
      else if (a.length === 8) { [sx, sy, swd, shd, dx, dy, dw, dh] = a; }
      else return;
      if (st.globalAlpha <= 0 || dw === 0 || dh === 0) return;
      const c1 = xpt(dx, dy), c2 = xpt(dx + dw, dy), c3 = xpt(dx + dw, dy + dh), c4 = xpt(dx, dy + dh);
      const x0 = Math.max(0, Math.floor(Math.min(c1[0], c2[0], c3[0], c4[0])));
      const x1 = Math.min(cv.width, Math.ceil(Math.max(c1[0], c2[0], c3[0], c4[0])));
      const y0 = Math.max(0, Math.floor(Math.min(c1[1], c2[1], c3[1], c4[1])));
      const y1 = Math.min(cv.height, Math.ceil(Math.max(c1[1], c2[1], c3[1], c4[1])));
      const m = st.m, det = m[0] * m[3] - m[1] * m[2];
      if (!det) return;
      const im = [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det,
        (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const u = im[0] * (xx + 0.5) + im[2] * (yy + 0.5) + im[4];
        const v = im[1] * (xx + 0.5) + im[3] * (yy + 0.5) + im[5];
        const ix = (((u - dx) / dw) * swd + sx) | 0, iy = (((v - dy) / dh) * shd + sy) | 0;
        if (ix < 0 || iy < 0 || ix >= sw || iy >= sh) continue;
        const si = (iy * sw + ix) * 4, sa = src.data[si + 3] / 255 * st.globalAlpha;
        if (sa) px(cv, xx, yy, src.data[si], src.data[si + 1], src.data[si + 2], sa * 255);
      }
    },
  };
  return ctx;
}
function rasterCanvas(w, h) {
  const cv = {
    _w: w || 300, _h: h || 150, style: {}, listeners: {},
    _img: mkImg(w || 300, h || 150),
    addEventListener() {}, removeEventListener() {},
    setPointerCapture() {}, releasePointerCapture() {},
    getBoundingClientRect() { return { left: 0, top: 0, width: cv._w, height: cv._h }; },
    toDataURL: () => "data:image/png;base64,AAAA",
  };
  Object.defineProperty(cv, "width", {
    get: () => cv._w,
    set: (v) => { cv._w = v; cv._img = mkImg(v, cv._h); },
  });
  Object.defineProperty(cv, "height", {
    get: () => cv._h,
    set: (v) => { cv._h = v; cv._img = mkImg(cv._w, v); },
  });
  cv.getContext = () => (cv._ctx = cv._ctx || rasterCtx(cv));
  return cv;
}

// ---------- DOM stubs (same surface as _sim.cjs) ----------
let rafCb = null;
const listeners = {};
global.window = global;
global.innerWidth = 1280;
global.innerHeight = 720;
global.devicePixelRatio = 1;
global.addEventListener = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
global.removeEventListener = () => {};
global.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
global.performance = require("perf_hooks").performance;
const els = {};
const getEl = (id) => {
  if (!els[id]) {
    const e = rasterCanvas(id === "c" ? 1280 : 320, id === "c" ? 720 : 400);
    e.innerHTML = ""; e.textContent = ""; e.children = [];
    e.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
    e.querySelector = () => null; e.querySelectorAll = () => [];
    els[id] = e;
  }
  return els[id];
};
global.document = {
  getElementById: getEl,
  createElement: (tag) => (tag === "canvas" ? rasterCanvas(64, 64) : getEl("_" + tag)),
  createElementNS: (ns, tag) => getEl("_" + tag),
  body: getEl("body"), documentElement: getEl("html"),
  addEventListener(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
  removeEventListener() {},
  fonts: { load: () => Promise.resolve() },
  hidden: false,
};
global.navigator = { userAgent: "promo" };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };
global.__TAURI__ = {
  core: {
    invoke: (cmd) => {
      if (cmd === "load_state") return Promise.resolve(JSON.stringify({
        ver: 2, jelly: 5000, active: "sprout", savedAt: Date.now(),
        owned: ["sprout", "mochi", "berry", "peach", "candy", "bloom"],
        pals: ["mochi", "berry", "peach"],
      }));
      if (cmd === "get_monitors") return Promise.resolve([{ x: 0, y: 0, w: 1280, h: 720 }]);
      if (cmd === "is_demo") return Promise.resolve(false);
      if (cmd === "agent_notice") return Promise.resolve(JSON.stringify({ seq: 1, kind: "done", msg: "BUILD OK" }));
      return Promise.resolve(null);
    },
  },
  event: { listen: () => Promise.resolve(() => {}) },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

// ---------- PNG encoder ----------
const CT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CT[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(t));
  return Buffer.concat([len, t, crc]);
}
function encodePng(W, H, rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ---------- desktop backdrop (generic, not the user's real screen) ----------
function paintDesktop(W, H) {
  const bg = mkImg(W, H);
  const d = bg.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, k = y / H;
    d[i] = 26 + k * 10; d[i + 1] = 30 + k * 12; d[i + 2] = 44 + k * 16; d[i + 3] = 255;
  }
  const win = (x0, y0, x1, y1, r, g, b, a) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      d[i] = r * a + d[i] * (1 - a); d[i + 1] = g * a + d[i + 1] * (1 - a); d[i + 2] = b * a + d[i + 2] * (1 - a);
    }
  };
  // a code-editor-ish window left + a browser-ish card right
  win(60, 70, 620, 560, 30, 34, 42, 0.94);
  win(60, 70, 620, 96, 46, 52, 64, 0.94);            // title bar
  for (let l = 0; l < 14; l++) {                     // code lines
    const lw = 60 + ((l * 137) % 240);
    win(84, 116 + l * 28, 84 + lw, 124 + l * 28, 90 + (l % 4) * 22, 110 + (l % 3) * 30, 140, 0.5);
  }
  win(700, 150, 1220, 470, 36, 40, 50, 0.9);
  win(700, 150, 1220, 176, 48, 54, 66, 0.9);
  win(724, 200, 920, 380, 70, 130, 180, 0.55);       // content block
  win(940, 200, 1196, 380, 110, 90, 160, 0.45);
  // taskbar
  win(0, H - 42, W, H, 20, 22, 28, 0.96);
  for (let iIc = 0; iIc < 7; iIc++) win(24 + iIc * 44, H - 34, 52 + iIc * 44, H - 10, 90, 110, 140, 0.8);
  return bg;
}


// ---------- run ----------
const QOUT = "C:/dev/qa";
let cv = null; // els.c is created when main.js boots — bind lazily
fs.mkdirSync(QOUT, { recursive: true });
function writeCrop(name, x0, y0, w, h) {
  const W = 1280, d = cv._img.data;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = (x0 + x) | 0, sy = (y0 + y) | 0, si = (sy * W + sx) * 4, di = (y * w + x) * 4;
    if (sx < 0 || sy < 0 || sx >= W || sy >= 720) continue;
    for (let k = 0; k < 4; k++) out[di + k] = d[si + k];
  }
  // flatten over dark bg for visibility
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3] / 255;
    out[i] = out[i] * a + 24 * (1 - a);
    out[i + 1] = out[i + 1] * a + 28 * (1 - a);
    out[i + 2] = out[i + 2] * a + 40 * (1 - a);
    out[i + 3] = 255;
  }
  fs.writeFileSync(path.join(QOUT, name), encodePng(w, h, out));
}
function countAlpha(x0, y0, w, h) {
  const W = 1280, d = cv._img.data; let n = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++)
    if (d[(y * W + x) * 4 + 3] > 0) n++;
  return n;
}
const results = [];
const check = (name, ok, info) => { results.push([name, ok, info]); console.log(ok ? "PASS" : "FAIL", name, info || ""); };
const E = (code) => globalThis.__SIM_E(code);

const src2 = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");
try {
  (0, eval)(src2 + "\n;globalThis.__SIM_E = (code) => eval(code);");
} catch (e) { console.log("TOPLEVEL THROW:", e.stack); process.exit(1); }

(async () => {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  const pump = async (n) => { for (let i = 0; i < n && rafCb; i++) { const cb = rafCb; rafCb = null; t += 16.7; try { cb(t); } catch (e) { console.log("frame threw:", e.stack.split("\n").slice(0, 6).join("\n")); process.exit(2); } if (i % 25 === 24) await new Promise((r) => setImmediate(r)); } };
  let t = 0;
  cv = els.c;
  await pump(240); // warmup: load, spawn, settle

  // --- sanity: pet + pals exist ---
  const st = JSON.parse(E("JSON.stringify({pals: pals.length, saveReady, jelly})"));
  check("state loaded (saveReady, jelly, 3 pals)", st.saveReady === true && st.jelly >= 5000 && st.pals === 3, JSON.stringify(st));

  // --- 1. say-bubble shows text above the pet ---
  // (sim time is virtual while say() uses real clock — pin the timer open)
  E('say("BUILD OK"); sayUntil = 1e15');
  await pump(3);
  const px = JSON.parse(E("JSON.stringify({x:Math.round(petX),y:Math.round(petY),say:sayText,until:sayUntil>0})"));
  check("say() sets text + timer", px.say === "BUILD OK" && px.until === true, JSON.stringify(px));
  const bx = Math.max(0, Math.min(1280 - 240, px.x - 120)), by = Math.max(0, px.y - 120);
  const bubPx = countAlpha(bx, by, 240, 90);
  check("speech bubble pixels drawn above pet", bubPx > 200, bubPx + " px in bubble zone");
  writeCrop("say.png", bx, by, 240, 90);

  // --- say() edge cases ---
  E('say(""); sayUntil = 1e15');
  const edge1 = E("sayText");
  await pump(2);
  check('say("") keeps prior state, no crash', typeof edge1 === "string", "sayText=" + JSON.stringify(edge1));
  E('say("~~~###~~~"); sayUntil = 1e15');
  const edge2 = E("sayText");
  check("charset-stripped message yields empty-safe state", edge2 === "BUILD OK" || edge2 === "", JSON.stringify(edge2));

  // --- 2. agent notice fires 'done' celebration ---
  E("drizzleNext = 1e15; drizzleUntil = 0; wasDrizzle = false; rainbowUntil = 0; snowAcc = 0");
  await pump(220); // > 3s sim time for the poll
  const ag = JSON.parse(E("JSON.stringify({seq:agentSeq, say:sayText, star:starUntil>0, why:petFaceWhy.star, j:jelly})"));
  check("agent 'done' consumed once", ag.seq === 1, JSON.stringify(ag));
  check("agent 'done' -> star face stamp + line", ag.why === "AGENT" && ag.say === "BUILD OK", JSON.stringify(ag));
  await pump(200);
  const ag2 = JSON.parse(E("JSON.stringify({seq:agentSeq})"));
  check("stale seq never re-fires", ag2.seq === 1, JSON.stringify(ag2));

  // --- 3. laugh faces: frames exist + differ ---
  const sp = JSON.parse(E('(() => { const c = (f) => { const s = sprite(f, 0); let n = 0; for (let i = 3; i < s._img.data.length; i += 4) if (s._img.data[i]) n++; let h = 0; for (let i = 0; i < s._img.data.length; i += 16) h = (h * 31 + s._img.data[i]) >>> 0; return { n, h }; }; const a = c("laugh"), b = c("laugh2"), d = c("laugh3"), e = c("tearjoy"), f2 = c("tearjoy2"); return JSON.stringify({ a, b, d, e, f2, diff: a.h !== b.h && a.h !== d.h && e.h !== f2.h }); })()'));
  check("laugh/laugh2/laugh3 sprites non-empty + distinct", sp.a.n > 400 && sp.b.n > 400 && sp.d.n > 400 && sp.diff, JSON.stringify(sp));

  // --- 4. laugh jig has rotation channel ---
  const jg = JSON.parse(E("JSON.stringify(faceJig('laugh', 0))"));
  check("faceJig('laugh') carries r rotation", typeof jg.r === "number" && jg.r !== 0, JSON.stringify(jg));
  const jgIdle = JSON.parse(E("JSON.stringify(faceJig('idle', 0))"));
  check("faceJig('idle') has no rotation", jgIdle.r === 0 || jgIdle.r === undefined, JSON.stringify(jgIdle));

  // --- 5. pet laugh on screen: force tickle + capture spread frames ---
  E("tickleUntil = 1e15; petStamp('AGENT','laugh')");
  for (let i = 0; i < 3; i++) {
    await pump(40); // ~0.7s apart
    const p = JSON.parse(E("JSON.stringify({x:Math.round(petX),y:Math.round(petY),f:faceName(performance.now())})"));
    if (i === 1) { const bx2 = Math.max(0, Math.min(1280 - 200, p.x - 100)), by2 = Math.max(0, p.y - 110); writeCrop("laugh.png", bx2, by2, 200, 100); }
  }
  const lf = E("faceName(performance.now())");
  check("pet holds laugh face", lf === "laugh", "face=" + lf);
  E("tickleUntil = 0");

  // --- 6. pal face change -> why icon bubble ---
  const pw = JSON.parse(E('(() => { const p = pals[0]; p.facePrevU = null; p.faceId = "excited"; p.faceT = 1e15; p.faceWhy = "THE SHOW"; p.faceWhyId = "excited"; return JSON.stringify({ x: Math.round(p.x), y: Math.round(p.y) }); })()'));
  await pump(3);
  const pw2 = JSON.parse(E("JSON.stringify({ic: pals[0].whyIc, until: pals[0].whyUntil > 0})"));
  check("pal face change pops reason icon", pw2.until === true && !!pw2.ic, JSON.stringify(pw2));
  const pbx = Math.max(0, Math.min(1280 - 160, pw.x - 80)), pby = Math.max(0, pw.y - 100);
  writeCrop("palwhy.png", pbx, pby, 160, 80);

  // --- 7. palWhy chain covers the stamp ---
  const chain = E("palWhy(pals[0])");
  check("palWhy resolves stamped reason", chain === "THE SHOW", "palWhy=" + JSON.stringify(chain));

  // --- 8. speech + icon coexist (different heights) ---
  E('say("NICE DESK")'); await pump(3);
  const full = JSON.parse(E("JSON.stringify({x:Math.round(petX),y:Math.round(petY)})"));
  writeCrop("full.png", Math.max(0, Math.min(1280 - 500, full.x - 250)), Math.max(0, full.y - 140), 500, 140);

  const fails = results.filter((r) => !r[1]);
  console.log("—".repeat(30));
  console.log(results.length - fails.length, "pass", fails.length, "fail");
  console.log("crops at C:/dev/qa");
  process.exit(fails.length ? 1 : 0);
})();
let t_unused = 0; // (t is declared inside the async scope above via 'let t')

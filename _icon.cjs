// icon generator — evals main.js in a DOM stub, renders the real sprout
// sprite ("happy" face, species 0) through the same buildSprite pipeline the
// app uses, then packs it into a multi-size .ico (PNG frames) + preview png.
// nearest-neighbor scaling keeps the pixel-art edges crisp.
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

// ---------- DOM stub (same shape as _sim.cjs, but putImageData keeps pixels)
function fakeCtx(canvas) {
  const store = { canvas };
  return new Proxy(store, {
    get(t, prop) {
      if (prop === "canvas") return canvas;
      if (prop === "createImageData")
        return (w, h) => ({ data: new Uint8ClampedArray((w || 1) * (h || 1) * 4), width: w, height: h });
      if (prop === "getImageData")
        return (x, y, w, h) => canvas._im ? { data: canvas._im.data.slice(), width: w, height: h } : { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
      if (prop === "putImageData") return (im) => { canvas._im = im; };
      if (prop === "measureText") return () => ({ width: 10 });
      if (prop === "createRadialGradient" || prop === "createLinearGradient" || prop === "createPattern")
        return () => ({ addColorStop() {} });
      if (prop === "getContext") return () => fakeCtx(canvas);
      if (prop in t) return t[prop];
      const f = () => {};
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
global.window = global;
global.innerWidth = 1920; global.innerHeight = 1080; global.devicePixelRatio = 1;
global.addEventListener = () => {}; global.removeEventListener = () => {};
global.requestAnimationFrame = () => 1;
global.performance = require("perf_hooks").performance;
global.document = {
  getElementById: getEl,
  createElement: (tag) => (tag === "canvas" ? fakeCanvas() : getEl("_" + tag)),
  createElementNS: (ns, tag) => getEl("_" + tag),
  body: getEl("body"), documentElement: getEl("html"),
  addEventListener() {}, removeEventListener() {},
  fonts: { load: () => Promise.resolve() }, hidden: false,
};
global.navigator = { userAgent: "icon-gen" };
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.AudioContext = class { constructor() { this.state = "running"; } resume() {} };
global.webkitAudioContext = global.AudioContext;
global.Image = class { set src(v) { this.onload && this.onload(); } };
global.URL = { createObjectURL: () => "blob:", revokeObjectURL() {} };
global.__TAURI__ = {
  core: { invoke: (cmd) => Promise.resolve(cmd === "load_state" ? "null" : null) },
  event: { listen: () => Promise.resolve(() => {}) },
  window: {},
};
window.__TAURI__ = global.__TAURI__;

const src = fs.readFileSync(path.join(__dirname, "src", "main.js"), "utf8");
(0, eval)(src);

// ---------- pull the real sprite pixels
const cv0 = eval('sprite("happy", 0)');
const im = cv0._im;
if (!im || !im.data) { console.log("FAIL: sprite produced no pixels"); process.exit(1); }
const SW2 = im.width, SH2 = im.height;

// content bbox (alpha > 8)
let x0 = SW2, y0 = SH2, x1 = 0, y1 = 0;
for (let y = 0; y < SH2; y++) for (let x = 0; x < SW2; x++) {
  if (im.data[(y * SW2 + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
}
const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
console.log(`sprite ${SW2}x${SH2}, content bbox ${cw}x${ch} @(${x0},${y0})`);

// render into a square frame at size s — sprite occupies ~90% of frame
function renderIcon(s) {
  const px = new Uint8ClampedArray(s * s * 4);
  const fit = Math.min(s / cw, s / ch) * 0.9;
  const dw = Math.round(cw * fit), dh = Math.round(ch * fit);
  const ox = Math.round((s - dw) / 2), oy = Math.round((s - dh) / 2);
  for (let y = 0; y < dh; y++) {
    const sy = y0 + Math.min(ch - 1, Math.floor(y / fit));
    for (let x = 0; x < dw; x++) {
      const sx = x0 + Math.min(cw - 1, Math.floor(x / fit));
      const si = (sy * SW2 + sx) * 4, di = ((oy + y) * s + (ox + x)) * 4;
      px[di] = im.data[si]; px[di + 1] = im.data[si + 1];
      px[di + 2] = im.data[si + 2]; px[di + 3] = im.data[si + 3];
    }
  }
  return px;
}

// ---------- minimal PNG encoder
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function pngEncode(w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
// classic DIB frame: universally readable (NSIS installer icon, old tools)
// — PNG-compressed ICO frames are Vista+-only and some bundlers choke
function dibFrame(s, rgba) {
  const hdr = Buffer.alloc(40);
  hdr.writeUInt32LE(40, 0);
  hdr.writeInt32LE(s, 4);
  hdr.writeInt32LE(s * 2, 8); // height*2 = XOR bitmap + AND mask
  hdr.writeUInt16LE(1, 12); hdr.writeUInt16LE(32, 14);
  hdr.writeUInt32LE(s * s * 4, 20);
  const xor = Buffer.alloc(s * s * 4); // bottom-up BGRA
  for (let y = 0; y < s; y++) {
    const sy = s - 1 - y;
    for (let x = 0; x < s; x++) {
      const si = (sy * s + x) * 4, di = (y * s + x) * 4;
      xor[di] = rgba[si + 2]; xor[di + 1] = rgba[si + 1];
      xor[di + 2] = rgba[si]; xor[di + 3] = rgba[si + 3];
    }
  }
  const maskStride = Math.ceil(s / 32) * 4;
  const and = Buffer.alloc(maskStride * s); // 1bpp, 1 = transparent
  for (let y = 0; y < s; y++) {
    const sy = s - 1 - y;
    for (let x = 0; x < s; x++) {
      if (rgba[(sy * s + x) * 4 + 3] < 8) and[y * maskStride + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  return Buffer.concat([hdr, xor, and]);
}
function icoEncode(frames) {
  const dir = Buffer.alloc(6 + 16 * frames.length);
  dir.writeUInt16LE(1, 2); dir.writeUInt16LE(frames.length, 4);
  let off = 6 + 16 * frames.length;
  const datas = [];
  frames.forEach((f, i) => {
    const b = i * 16 + 6;
    dir[b] = f.size >= 256 ? 0 : f.size;
    dir[b + 1] = f.size >= 256 ? 0 : f.size;
    dir.writeUInt16LE(1, b + 4); dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(f.data.length, b + 8); dir.writeUInt32LE(off, b + 12);
    off += f.data.length; datas.push(f.data);
  });
  return Buffer.concat([dir, ...datas]);
}

// icns container: 'icns' magic + total len, then entries of
// (4-byte OSType + u32 len + PNG payload). modern macOS accepts
// PNG-encoded entries — ic07=128, ic08=256, ic09=512, ic10=1024
function icnsEncode(entries) {
  const parts = entries.map(([type, png]) => {
    const h = Buffer.alloc(8);
    h.write(type, 0, "ascii");
    h.writeUInt32BE(png.length + 8, 4);
    return Buffer.concat([h, png]);
  });
  const total = 8 + parts.reduce((a, p) => a + p.length, 0);
  const head = Buffer.alloc(8);
  head.write("icns", 0, "ascii");
  head.writeUInt32BE(total, 4);
  return Buffer.concat([head, ...parts]);
}

// ---------- emit
const outDir = path.join(__dirname, "src-tauri", "icons");
const sizes = [16, 24, 32, 48, 64, 128, 256];
const frames = sizes.map((s) => {
  const px = renderIcon(s);
  return { size: s, data: dibFrame(s, px), png: pngEncode(s, s, px) };
});
fs.writeFileSync(path.join(outDir, "icon.ico"), icoEncode(frames));
fs.writeFileSync(path.join(outDir, "icon.png"), frames[frames.length - 1].png);
fs.writeFileSync(path.join(outDir, "32x32.png"), frames.find((f) => f.size === 32).png);
fs.writeFileSync(path.join(outDir, "128x128.png"), frames.find((f) => f.size === 128).png);
fs.writeFileSync(path.join(outDir, "128x128@2x.png"), frames.find((f) => f.size === 256).png);
fs.writeFileSync(path.join(outDir, "icon.icns"), icnsEncode([
  ["ic07", frames.find((f) => f.size === 128).png],
  ["ic08", frames.find((f) => f.size === 256).png],
  ["ic09", pngEncode(512, 512, renderIcon(512))],
  ["ic10", pngEncode(1024, 1024, renderIcon(1024))],
]));
console.log("icon.ico + icon.icns + pngs written to", outDir);
process.exit(0);

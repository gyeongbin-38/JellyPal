// renders the settings panel to _settings.png for visual QA — extracts the
// real geometry engine + draw block from src/main.js and replays them over
// a pixel-buffer fake 2D context. variants: default / scrolled / armed /
// store build (hides rows 9,10,12).
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "src", "main.js"), "utf8");

// ---- sprite slice (for the title mascot) ----
const a = src.indexOf("// ---------- sprite engine");
const b = src.indexOf("// ---------- audio");
const slice = src.slice(a, b);
function mkCtx(cv) {
  return {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img, x, y) { cv._img = img; },
  };
}
global.document = {
  createElement() {
    const cv = { width: 0, height: 0, _img: null };
    cv.getContext = () => mkCtx(cv);
    return cv;
  },
};
global.window = {};
global.shinyOwned = {};
eval(slice + "\n;globalThis.__X = { SPECIES, sprite };");
const SP = globalThis.__X.SPECIES, SPR = globalThis.__X.sprite;

// ---- pixel font + drawText ----
const fa = src.indexOf("const FONT = {");
const fb = src.indexOf("function textW(text, s)");
const fontSrc = src.slice(fa, fb) + "function textW(text, s) { return String(text).length * 6 * s - s; }";
eval(fontSrc + "\n;globalThis.__F = { drawText, textW };");
const DT = globalThis.__F.drawText, TW = globalThis.__F.textW;

// ---- settings geometry block ----
const ga = src.indexOf("let setScroll = 0;");
const gb = src.indexOf("// gem shop: the paid-gem surface");
const geoSrc = src.slice(ga, gb);
global.winW = 1280; global.winH = 800;
global.STORE = false; global.settingsOpen = true; global.resetArm = 0;
eval(geoSrc + "\n;globalThis.__G = { settingsRect, settingsCells, setMaxScroll, closeSettings, SET_VIEW_TOP, SET_VIEW_BOT, SET_CAP_H, SET_ROW_P, setScroll: (v) => { setScroll = v; }, getScroll: () => setScroll };");
const G = globalThis.__G;

// ---- settings draw block ----
const da = src.indexOf("  // settings panel: captioned sections");
const db = src.indexOf("  // gem shop: pack prices");
const drawSrc = src.slice(da, db);
const drawSettings = new Function("env", "with (env) { " + drawSrc + " }");

// ---- fake pixel ctx ----
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
function pixCtx(W, H, buf) {
  let fill = "#000000", stroke = "#000000", lw = 1, alpha = 1;
  let clipX = 0, clipY = 0, clipW = W, clipH = H;
  const stack = [];
  const put = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x < clipX || x >= clipX + clipW || y < clipY || y >= clipY + clipH || x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4, al = alpha;
    buf[i] = c[0] * al + buf[i] * (1 - al);
    buf[i + 1] = c[1] * al + buf[i + 1] * (1 - al);
    buf[i + 2] = c[2] * al + buf[i + 2] * (1 - al);
    buf[i + 3] = 255;
  };
  return {
    set fillStyle(v) { fill = v; },
    set strokeStyle(v) { stroke = v; },
    set lineWidth(v) { lw = v; },
    set globalAlpha(v) { alpha = v; },
    get globalAlpha() { return alpha; },
    fillRect(x, y, w, h) {
      const c = hex(fill);
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(x + xx, y + yy, c);
    },
    strokeRect(x, y, w, h) {
      const c = hex(stroke);
      for (let k = 0; k < lw; k++) {
        for (let xx = 0; xx < w; xx++) { put(x + xx, y + k, c); put(x + xx, y + h - 1 - k, c); }
        for (let yy = 0; yy < h; yy++) { put(x + k, y + yy, c); put(x + w - 1 - k, y + yy, c); }
      }
    },
    drawImage(img, x, y, w, h) {
      const src2 = img._img;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
        const sx = Math.min(src2.width - 1, Math.floor(xx / w * src2.width));
        const sy = Math.min(src2.height - 1, Math.floor(yy / h * src2.height));
        const si = (sy * src2.width + sx) * 4, a2 = (src2.data[si + 3] / 255) * alpha;
        if (a2 <= 0) continue;
        const tx = Math.round(x + xx), ty = Math.round(y + yy);
        if (tx < clipX || tx >= clipX + clipW || ty < clipY || ty >= clipY + clipH || tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const di = (ty * W + tx) * 4;
        buf[di] = src2.data[si] * a2 + buf[di] * (1 - a2);
        buf[di + 1] = src2.data[si + 1] * a2 + buf[di + 1] * (1 - a2);
        buf[di + 2] = src2.data[si + 2] * a2 + buf[di + 2] * (1 - a2);
        buf[di + 3] = 255;
      }
    },
    save() { stack.push([fill, stroke, lw, alpha, clipX, clipY, clipW, clipH]); },
    restore() { [fill, stroke, lw, alpha, clipX, clipY, clipW, clipH] = stack.pop(); },
    beginPath() {},
    rect(x, y, w, h) { this._r = [x, y, w, h]; },
    clip() { const [x, y, w, h] = this._r; clipX = Math.max(clipX, x); clipY = Math.max(clipY, y); clipW = Math.min(clipX + clipW, x + w) - clipX; clipH = Math.min(clipY + clipH, y + h) - clipY; },
    setTransform() {}, clearRect() {}, translate() {}, scale() {}, rotate() {},
  };
}

// ---- PNG encode ----
const CT = new Int32Array(256).map((_, n) => {
  let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c;
});
const crc32 = (b2) => { let c = -1; for (const by of b2) c = CT[(c ^ by) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const s = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(s)); return Buffer.concat([l, s, c]); }
function encodePng(W, H, rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ---- render variants ----
const P = 200, PH = 470, S = 3, PAD = 24;
const variants = [
  { name: "default", env: { vol: 0.6 } },
  { name: "small-win+scroll", env: { winH: 460, vol: 0.35, scroll: 60, hover: 6 } },
  { name: "armed", env: { arm: true, pomo: true, vol: 0 } },
  { name: "store", env: { store: true, vol: 0.8 } },
];
const W = variants.length * (P * S + PAD) + PAD;
const H = PH * S + PAD * 2;
const buf = Buffer.alloc(W * H * 4);
for (let i = 0; i < buf.length; i += 4) { const x = (i / 4) % W, y = (i / 4 / W) | 0; const d = ((x >> 4) + (y >> 4)) & 1; buf[i] = d ? 34 : 42; buf[i + 1] = d ? 38 : 48; buf[i + 2] = d ? 46 : 56; buf[i + 3] = 255; }

variants.forEach((v, vi) => {
  const w2 = Math.min(1280, v.env.winW || 1280), h2 = v.env.winH || 800;
  const pw2 = Math.min(470, Math.max(220, h2 - 70));
  const pbuf = Buffer.alloc(w2 * h2 * 4); // transparent bg
  const ctx = pixCtx(w2, h2, pbuf);
  global.winW = w2; global.winH = h2;
  global.STORE = !!v.env.store; global.resetArm = 0;
  const env = {
    get setScroll() { return G.getScroll(); },
    ctx, settingsOpen: true, settingsRect: G.settingsRect, settingsCells: G.settingsCells,
    setMaxScroll: G.setMaxScroll, SET_VIEW_TOP: G.SET_VIEW_TOP, SET_VIEW_BOT: G.SET_VIEW_BOT,
    SET_CAP_H: G.SET_CAP_H, SET_ROW_P: G.SET_ROW_P,
    sprite: SPR, active: SP.findIndex((s) => s.id === "gold"),
    drawSm(c, img, x, y, w, h) { c.drawImage(img, x, y, w, h); },
    curX: v.env.hover != null ? w2 / 2 - 100 + 14 + 40 : -9999,
    curY: v.env.hover != null ? h2 / 2 - pw2 / 2 + 30 + (15 + 26 * 2 + 15 + 52) : -9999,
    pomo: !!v.env.pomo, pomoPhase: "focus", pomoUntil: Date.now() + 12 * 60000,
    pomoFocusMin: 25, pomoBreakMin: 5,
    vol: v.env.vol ?? 0.6, sizeMul: 1.2, reduceMotion: false,
    saverMode: 1, SAVER_LABEL: ["OFF", "AUTO", "ON"],
    weatherOn: true, bootOn: false, uid: "JPKQX7Y3MNB2V4C8H6JD2F5",
    resetArm: v.env.arm ? Date.now() + 3000 : 0,
    stats: { pulls: 42, breeds: 7, shiny: 2, treats: 128, plays: 31, focusSec: 3240 },
    newVer: "", DEMO: false, APP_VER: "0.2.16",
    drawText: DT, textW: TW, Date, Math,
  };
  // draw twice for the scrolled variant: force setScroll before the call
  G.setScroll(v.env.scroll || 0);
  drawSettings(env);
  // blit the panel region scaled
  const px = Math.round(w2 / 2 - 100), py = Math.round(h2 / 2 - pw2 / 2);
  for (let y = 0; y < pw2 * S; y++) for (let x = 0; x < P * S; x++) {
    const sx = px + Math.floor(x / S), sy = py + Math.floor(y / S);
    const si = (sy * w2 + sx) * 4, dx = PAD + vi * (P * S + PAD) + x, dy = PAD + y;
    const di = (dy * W + dx) * 4;
    const al = pbuf[si + 3] / 255;
    if (al <= 0) continue;
    buf[di] = pbuf[si] * al + buf[di] * (1 - al);
    buf[di + 1] = pbuf[si + 1] * al + buf[di + 1] * (1 - al);
    buf[di + 2] = pbuf[si + 2] * al + buf[di + 2] * (1 - al);
    buf[di + 3] = 255;
  }
});

fs.writeFileSync(path.join(__dirname, "_settings.png"), encodePng(W, H, buf));
console.log(`wrote _settings.png ${W}x${H}`);

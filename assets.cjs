// itch.io page asset generator — renders cover/banner/screenshot PNGs by
// reusing the game's own sprite + pixel-font tables ripped out of main.js.
// Run: node assets.cjs   ->   assets/*.png
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SRC = path.join(__dirname, "src", "main.js");
const code = fs.readFileSync(SRC, "utf8");

// ---- rip data tables out of main.js (pure literals -> safe eval) ----
const grab = (re, name) => {
  const m = code.match(re);
  if (!m) throw new Error(`could not extract ${name}`);
  return eval(`(${m[1]})`);
};
const FONT = grab(/const FONT = (\{[\s\S]*?\n\});/, "FONT");
const FACES = grab(/const FACES = (\{[\s\S]*?\n\});/, "FACES");
const EYE_TPL = grab(/const EYE_TPL = (\[[\s\S]*?\n\]);/, "EYE_TPL");
const EYE_BASE = grab(/const EYE_BASE = (\{[\s\S]*?\});/, "EYE_BASE");
const eyeStyle = grab(/(function eyeStyle\(i\) \{[\s\S]*?\n\})/, "eyeStyle");
const faceSet = grab(/(function faceSet\(spIdx\) \{[\s\S]*?\n\})/, "faceSet");
const SPECIES = grab(/const SPECIES = (\[[\s\S]*?\n\]);/, "SPECIES");
const HW = {};
for (const m of code.matchAll(/const (HW_\w+) = (\[[\d,\s]*\]);/g)) HW[m[1]] = eval(m[2]);
const SHAPES = { round: HW.HW_ROUND, tall: HW.HW_TALL, flat: HW.HW_FLAT, square: HW.HW_SQUARE, puddle: HW.HW_PUDDLE };
const SW = 36, SH = 26, CX = 18;
const hexRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRgb = (a, b, f) => [a[0] + (b[0] - a[0]) * f | 0, a[1] + (b[1] - a[1]) * f | 0, a[2] + (b[2] - a[2]) * f | 0];
const FIXED = { d: hexRgb("#8fd4f0"), c: hexRgb("#ffd75e"), g: hexRgb("#2f2f3a"), v: hexRgb("#ff8fb8") };

// ---- minimal RGBA canvas ----
function makeCanvas(w, h, fill) {
  const buf = Buffer.alloc(w * h * 4);
  const cv = {
    w, h, buf,
    px(x, y, c, a = 255) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      if (a >= 255) { buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; return; }
      const t = a / 255;
      buf[i] = buf[i] * (1 - t) + c[0] * t;
      buf[i + 1] = buf[i + 1] * (1 - t) + c[1] * t;
      buf[i + 2] = buf[i + 2] * (1 - t) + c[2] * t;
      buf[i + 3] = Math.max(buf[i + 3], a);
    },
    rect(x, y, rw, rh, c, a) {
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) cv.px(x + i, y + j, c, a);
    },
    circle(cx, cy, r, c, a) {
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++)
        if (i * i + j * j <= r * r) cv.px(cx + i, cy + j, c, a);
    },
    line(x0, y0, x1, y1, c, a) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i++) cv.px(x0 + (x1 - x0) * (i / n), y0 + (y1 - y0) * (i / n), c, a);
    },
  };
  if (fill) cv.rect(0, 0, w, h, fill);
  return cv;
}

function text(cv, s, x, y, sc, c) {
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] || FONT["?"];
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "#") cv.rect(cx + col * sc, y + r * sc, sc, sc, c);
    cx += 6 * sc;
  }
  return cx;
}
const textW = (s, sc) => s.length * 6 * sc - sc;

// per-species silhouette variation — identical seed math to main.js so
// marketing sprites match the in-game blobs exactly
const shapeVarCache = {};
function shapeVar(i) {
  if (shapeVarCache[i]) return shapeVarCache[i];
  const hw0 = SHAPES[SPECIES[i].shape];
  let s = (i * 2654435761 + 0x9e3779b9) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const hs = 0.88 + rnd() * 0.24;
  const bulge = 0.9 + rnd() * 0.2;
  const lean = Math.round((rnd() - 0.5) * 4);
  const hw = new Array(SH);
  for (let y = 0; y < SH; y++) {
    const sy = SH - 1 - Math.round((SH - 1 - y) / hs);
    let w = sy < 0 ? 0 : hw0[Math.min(SH - 1, sy)];
    w = Math.round(w * bulge * (0.88 + 0.24 * Math.sin(Math.PI * y / SH)));
    hw[y] = Math.max(0, Math.min(CX - 1, w));
  }
  const tfm = (x, y) => {
    const ny = Math.max(0, Math.min(SH - 1, SH - 1 - Math.round((SH - 1 - y) * hs)));
    const srcW = hw0[y] || 1, dstW = hw[ny] || 1;
    const r = Math.min(2, Math.max(0.4, dstW / srcW));
    let nx = CX + Math.round((x - CX) * r) + Math.round(lean * (1 - ny / SH));
    const lim = dstW + 4;
    nx = Math.max(CX - lim, Math.min(CX + lim, nx));
    return [Math.max(0, Math.min(SW - 1, nx)), ny];
  };
  return (shapeVarCache[i] = { hw, tfm });
}

// sprite -> char grid, same math as the game's buildSprite
function buildGrid(faceName, pal, top, hw, spIdx) {
  const grid = Array.from({ length: SH }, () => new Array(SW).fill("."));
  const v = spIdx != null ? shapeVar(spIdx) : null;
  const hhw = v ? v.hw : hw;
  for (let y = 0; y < SH; y++) {
    for (let x = CX - hhw[y]; x < CX + hhw[y]; x++) {
      let c = "b";
      const dx = x - 12, dy = y - 6;
      if (dx * dx + dy * dy < 20) c = "l";
      if (y >= 21 || (x - CX >= 8 && y >= 17)) c = "s";
      if (c === "b") {
        const gx = (x - CX) / Math.max(5, hw[y] * 0.7), gy = (y - 12) / 7.5;
        if (gx * gx + gy * gy < 1) c = "i";
      }
      grid[y][x] = c;
    }
  }
  const tfm = v ? v.tfm : (x, y) => [x, y];
  const F = faceSet(spIdx)[faceName];
  for (const [x, y, ch] of top || []) { const [nx, ny] = tfm(x, y); grid[ny][nx] = ch; }
  for (const [x, y] of F.a || []) { const [nx, ny] = tfm(x, y); grid[ny][nx] = "b"; }
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      if (grid[y][x] === ".") continue;
      const n = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      if (n.some(([nx, ny]) => ny < 0 || ny >= SH || nx < 0 || nx >= SW || grid[ny][nx] === ".")) grid[y][x] = "o";
    }
  for (let y = SH - 2; y > 0; y--)
    for (let x = 0; x < SW; x++)
      if (grid[y][x] === "s" && (grid[y + 1][x] === "o" || grid[y + 1][x] === ".")) grid[y][x] = "i";
  for (const ch in F) {
    if (ch === "a") continue;
    for (const [x, y] of F[ch]) { const [nx, ny] = tfm(x, y); grid[ny][nx] = ch; }
  }
  return { grid, pal };
}

// blit a slime with its feet on `by` (baseline), centered on `bx`;
// optional squash factor squishes vertically / bulges horizontally
function slime(cv, spId, bx, by, sc, face = "idle", sq = 0) {
  const sp = SPECIES.find((p) => p.id === spId);
  if (!sp) throw new Error("no species " + spId);
  const { grid, pal } = buildGrid(face, sp.pal, sp.top, SHAPES[sp.shape] || SHAPES.round, SPECIES.indexOf(sp));
  const sx = sc * (1 + sq * 0.8), sy = sc * (1 - sq);
  // same pastel translucent-jelly pipeline as the game's buildSprite
  const WHT = [255, 255, 255];
  const bR = hexRgb(pal.b), lR = hexRgb(pal.l || pal.b), sR = hexRgb(pal.s || pal.b), oR = hexRgb(pal.o || pal.b);
  const bIn = mixRgb(mixRgb(bR, lR, 0.24), WHT, 0.14);
  const iIn = mixRgb(mixRgb(bR, lR, 0.66), WHT, 0.12);
  const sIn = mixRgb(mixRgb(sR, lR, 0.32), WHT, 0.16);
  const oIn = mixRgb(oR, mixRgb(bR, lR, 0.35), 0.45);
  const lIn = mixRgb(lR, WHT, 0.16);
  const uIn = mixRgb(hexRgb(pal.e || "#26262e"), lR, 0.45);
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const ch = grid[y][x];
      if (ch === ".") continue;
      const rgb = ch === "i" ? iIn : ch === "b" ? bIn : ch === "s" ? sIn : ch === "o" ? oIn : ch === "l" ? lIn
        : ch === "u" ? uIn : (FIXED[ch] || hexRgb(pal[ch] || pal.b));
      cv.rect(Math.round(bx + (x - SW / 2) * sx), Math.round(by - SH * sy + y * sy), Math.ceil(sx), Math.ceil(sy), rgb);
    }
}

// little pixel doodads
const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
const GEM = ["...#...", ".#####.", "#######", "#######", ".#####.", "..###..", "...#..."];
const CURSOR = [
  "#...........", "##..........", "#.#.........", "#..#........",
  "#...#.......", "#....#......", "#.....#.....", "#......#....",
  "#.......#...", "#........#..", "#.....#####.", "#..#..#.....",
  "#.#...#.....", "##....#.....", "#.....#.....", "......#.....",
];
function bitmap(cv, rows, x, y, sc, map) {
  for (let r = 0; r < rows.length; r++)
    for (let c = 0; c < rows[r].length; c++) {
      const col = map[rows[r][c]];
      if (col) cv.rect(x + c * sc, y + r * sc, sc, sc, col);
    }
}

// ---- PNG writer ----
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (b) => ~b.reduce((c, byte) => crcTable[(c ^ byte) & 0xff] ^ (c >>> 8), ~0) >>> 0;
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function savePng(cv, file) {
  const raw = Buffer.alloc(cv.h * (cv.w * 4 + 1));
  for (let y = 0; y < cv.h; y++) {
    raw[y * (cv.w * 4 + 1)] = 0;
    cv.buf.copy(raw, y * (cv.w * 4 + 1) + 1, y * cv.w * 4, (y + 1) * cv.w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(cv.w, 0); ihdr.writeUInt32BE(cv.h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  console.log(file, `${(png.length / 1024).toFixed(0)}KB`);
}

const out = (n) => path.join(__dirname, "assets", n);
fs.mkdirSync(path.join(__dirname, "assets"), { recursive: true });

const CREAM = hexRgb("#f7ecd7"), BROWN = hexRgb("#5c4632"), LBROWN = hexRgb("#8a6b4a");
const DARK = hexRgb("#241b2e"), GOLD = hexRgb("#eec23f"), PINK = hexRgb("#ff8fb8");

// ================= cover.png — 630x500 itch cover =================
// asset generation only runs when executed directly — qacheck.cjs and
// other tools import this file for the sprite/PNG internals below
if (require.main === module) {
{
  const cv = makeCanvas(630, 500, DARK);
  // soft vignette + floor
  for (let y = 0; y < 500; y++) {
    const t = y / 500;
    cv.rect(0, y, 630, 1, [36 + 20 * t | 0, 27 + 14 * t | 0, 46 + 20 * t | 0]);
  }
  cv.rect(0, 400, 630, 100, hexRgb("#3a2c40"));
  cv.rect(0, 398, 630, 3, hexRgb("#554060"));
  // sparkle field
  [[60, 60], [540, 90], [120, 200], [500, 240], [300, 60], [420, 140], [80, 330], [560, 330]]
    .forEach(([x, y], i) => bitmap(cv, GEM, x, y, 2, { "#": i % 2 ? GOLD : PINK }));
  // title
  const tw = textW("JELLYPAL", 10);
  text(cv, "JELLYPAL", 315 - tw / 2 + 4, 58, 10, hexRgb("#000000"));
  text(cv, "JELLYPAL", 315 - tw / 2, 54, 10, GOLD);
  const tag = "A TINY SLIME RANCH THAT LIVES ON YOUR DESKTOP";
  text(cv, tag, 315 - textW(tag, 2) / 2, 156, 2, hexRgb("#cbb8d9"));
  // the crew
  slime(cv, "stella", 150, 390, 5, "happy");
  slime(cv, "sprout", 315, 398, 7, "happy");
  slime(cv, "spidr", 480, 390, 5, "happy");
  // webby's silk line up to a floating cursor
  cv.line(480, 390 - 26 * 5 + 6, 520, 210, [238, 242, 246], 200);
  bitmap(cv, CURSOR, 520, 200, 3, { "#": hexRgb("#f4f0e8") });
  bitmap(cv, HEART, 205, 250, 4, { "#": PINK });
  text(cv, "V0.2.0", 8, 484, 1, LBROWN);
  savePng(cv, out("cover.png"));
}

// ================= banner.png — 960x170 library banner =================
{
  const cv = makeCanvas(960, 170, DARK);
  for (let x = 0; x < 960; x++) {
    const t = x / 960;
    cv.rect(x, 0, 1, 170, [36 + 30 * t | 0, 27 + 10 * t | 0, 46 + 34 * t | 0]);
  }
  cv.rect(0, 152, 960, 18, hexRgb("#3a2c40"));
  text(cv, "JELLYPAL", 60 - 4, 40 - 2, 9, hexRgb("#000000"));
  text(cv, "JELLYPAL", 60, 36, 9, GOLD);
  text(cv, "FEED. COLLECT. BREED. LOVE.", 62, 120, 2, hexRgb("#cbb8d9"));
  slime(cv, "gold", 640, 148, 4, "happy");
  slime(cv, "mochi", 730, 152, 4, "idle");
  slime(cv, "drago", 820, 150, 4, "lookL");
  slime(cv, "pulsar", 905, 148, 4, "idle");
  bitmap(cv, HEART, 560, 60, 3, { "#": PINK });
  savePng(cv, out("banner.png"));
}

// ================= shot-desktop.png — 960x540 fake gameplay shot =================
{
  const cv = makeCanvas(960, 540, hexRgb("#2b3242"));
  // wallpaper gradient + a floating window (its top edge is a platform)
  for (let y = 0; y < 540; y++) {
    const t = y / 540;
    cv.rect(0, y, 960, 1, [43 + 16 * t | 0, 50 + 12 * t | 0, 66 + 16 * t | 0]);
  }
  cv.rect(120, 90, 500, 240, hexRgb("#1c2030"));
  cv.rect(120, 90, 500, 22, hexRgb("#39415c"));
  text(cv, "NOTES.TXT", 132, 98, 1, hexRgb("#9aa7c4"));
  cv.rect(124, 122, 480, 4, hexRgb("#3f4a6a"));
  cv.rect(124, 140, 400, 4, hexRgb("#333d5c"));
  cv.rect(124, 158, 460, 4, hexRgb("#333d5c"));
  // taskbar
  cv.rect(0, 496, 960, 44, hexRgb("#181c28"));
  cv.rect(0, 496, 960, 2, hexRgb("#39415c"));
  cv.rect(8, 506, 24, 24, hexRgb("#4a90c4"));
  cv.rect(40, 506, 120, 24, hexRgb("#232a3d"));
  // slimes: sprout on taskbar, pebble + webby on the window edge, cursor dangle
  slime(cv, "sprout", 700, 496, 4, "happy");
  slime(cv, "pebble", 240, 90, 3, "idle");
  const wx = 420, wy = 236;                 // webby hangs below the cursor
  cv.line(500, 130, wx, wy - 26 * 4 + 4, [238, 242, 246], 220);
  slime(cv, "spidr", wx, wy, 4, "idle");
  bitmap(cv, CURSOR, 498, 118, 3, { "#": hexRgb("#f4f0e8") });
  // YUM bubble + hearts near sprout
  cv.rect(716, 392, 74, 30, hexRgb("#f4f0e8"));
  cv.rect(724, 422, 10, 8, hexRgb("#f4f0e8"));
  text(cv, "YUM", 730, 400, 2, BROWN);
  bitmap(cv, HEART, 660, 420, 3, { "#": PINK });
  bitmap(cv, GEM, 640, 470, 2, { "#": GOLD });
  text(cv, "TYPE AND IT SNACKS", 620, 470, 2, hexRgb("#9aa7c4"));
  savePng(cv, out("shot-desktop.png"));
}

// ================= shot-ranch.png — 960x540 collection mock =================
{
  const cv = makeCanvas(960, 540, DARK);
  // panel
  cv.rect(180, 40, 600, 460, CREAM);
  cv.rect(180, 40, 600, 4, hexRgb("#b9834f"));
  cv.rect(180, 486, 600, 14, hexRgb("#b9834f"));
  text(cv, "RANCH", 200, 56, 2, BROWN);
  bitmap(cv, GEM, 268, 58, 2, { "#": GOLD });
  text(cv, "99999", 290, 56, 2, BROWN);
  text(cv, "60/60", 200, 78, 1, LBROWN);
  cv.rect(648, 52, 56, 20, hexRgb("#4fbd82"));
  text(cv, "PULL", 660, 58, 1, hexRgb("#10231a"));
  // 4x3 grid of cells
  const cells = ["sprout", "berry", "ember", "mochi", "pulsar", "spidr", "drago", "stella", "pinata", "dice", "frog", "rex"];
  cells.forEach((id, i) => {
    const x = 196 + (i % 4) * 144, y = 92 + Math.floor(i / 4) * 132;
    cv.rect(x, y, 132, 122, hexRgb("#f3e6cd"));
    cv.rect(x, y, 132, 3, hexRgb("#8fd4f0"));
    cv.rect(x, y + 100, 132, 22, hexRgb("#c9a06c"));
    slime(cv, id, x + 66, y + 88, 3, "idle");
    const sp = SPECIES.find((p) => p.id === id);
    text(cv, sp.name.toUpperCase(), x + 66 - textW(sp.name.toUpperCase(), 1) / 2, y + 106, 1, hexRgb("#fff6e6"));
  });
  text(cv, "< 1/1 >", 436, 470, 1, LBROWN);
  savePng(cv, out("shot-ranch.png"));
}

// ================= promo.gif — 480x270 animated loop for the itch page =================
// minimal GIF89a writer: 256-color global palette + LZW compression
function gifEncode(frames, w, h, delayCs) {
  // pass 1: build the global palette from every frame's colors
  const palMap = new Map();
  const pal = [[0, 0, 0]];
  const idxOf = (r, g, b) => {
    const k = r | (g << 8) | (b << 16);
    let i = palMap.get(k);
    if (i === undefined) {
      i = pal.length;
      palMap.set(k, i);
      pal.push([r, g, b]);
    }
    return i;
  };
  const indexed = frames.map((f) => {
    const px = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      px[i] = idxOf(f[i * 4], f[i * 4 + 1], f[i * 4 + 2]);
    }
    return px;
  });
  if (pal.length > 256) throw new Error(`palette overflow: ${pal.length} colors`);

  // LZW compressor (GIF variant, LSB-first codes)
  function lzw(indices) {
    const CLEAR = 256, EOI = 257;
    const out = [];
    let cur = 0, nbits = 0;
    const emit = (code, size) => {
      cur |= code << nbits;
      nbits += size;
      while (nbits >= 8) { out.push(cur & 255); cur >>= 8; nbits -= 8; }
    };
    let dict = new Map(), next = 258, size = 9, max = 511;
    const reset = () => { dict = new Map(); next = 258; size = 9; max = 511; };
    emit(CLEAR, size);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const seq = (prefix << 8) | k;
      if (dict.has(seq)) { prefix = dict.get(seq); continue; }
      emit(prefix, size);
      dict.set(seq, next++);
      if (next === 4096) { emit(CLEAR, size); reset(); }
      else if (next > max) { size++; max = (1 << size) - 1; }
      prefix = k;
    }
    emit(prefix, size);
    emit(EOI, size);
    if (nbits > 0) out.push(cur & 255);
    return out;
  }

  const parts = [];
  const push = (...b) => parts.push(Buffer.from(b));
  push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);              // GIF89a
  const lsd = Buffer.alloc(7);
  lsd.writeUInt16LE(w, 0); lsd.writeUInt16LE(h, 2);
  lsd[4] = 0xf7;                                        // GCT, 256 colors
  parts.push(lsd);
  const gct = Buffer.alloc(256 * 3);
  pal.forEach((c, i) => { gct[i * 3] = c[0]; gct[i * 3 + 1] = c[1]; gct[i * 3 + 2] = c[2]; });
  parts.push(gct);
  // NETSCAPE loop extension (infinite)
  push(0x21, 0xff, 0x0b);
  parts.push(Buffer.from("NETSCAPE2.0"));
  push(0x03, 0x01, 0x00, 0x00, 0x00);
  for (const px of indexed) {
    push(0x21, 0xf9, 0x04, 0x00);                       // GCE, no transparency
    const dl = Buffer.alloc(2); dl.writeUInt16LE(delayCs);
    parts.push(dl);
    push(0x00, 0x00);
    const id = Buffer.alloc(10);
    id[0] = 0x2c;
    id.writeUInt16LE(0, 1); id.writeUInt16LE(0, 3);
    id.writeUInt16LE(w, 5); id.writeUInt16LE(h, 7);
    parts.push(id);
    const data = lzw(px);
    parts.push(Buffer.from([8]));                        // LZW min code size
    for (let i = 0; i < data.length; i += 255) {
      const n = Math.min(255, data.length - i);
      parts.push(Buffer.from([n]));
      parts.push(Buffer.from(data.slice(i, i + n)));
    }
    push(0x00);                                          // block terminator
  }
  push(0x3b);                                            // trailer
  return Buffer.concat(parts);
}

{
  const W = 480, H = 270, N = 12;
  const frames = [];
  for (let f = 0; f < N; f++) {
    const cv = makeCanvas(W, H, DARK);
    for (let y = 0; y < H; y++) {
      const tt = y / H;
      cv.rect(0, y, W, 1, [36 + 18 * tt | 0, 27 + 12 * tt | 0, 46 + 18 * tt | 0]);
    }
    cv.rect(0, 232, W, 38, hexRgb("#3a2c40"));
    cv.rect(0, 230, W, 3, hexRgb("#554060"));
    const tw = textW("JELLYPAL", 6);
    text(cv, "JELLYPAL", W / 2 - tw / 2 + 2, 22, 6, hexRgb("#000000"));
    text(cv, "JELLYPAL", W / 2 - tw / 2, 20, 6, GOLD);
    // sprout hops left->right across the floor with squash & stretch
    const ph = (f / N) * Math.PI * 2;
    const sx = 90 + (f / N) * 300;
    const hop = Math.abs(Math.sin(ph * 2)) * 34;
    const sq = hop < 4 ? 0.35 : 0;
    slime(cv, "sprout", sx, 232 - hop, 3, "happy", sq);
    // webby dangles on a swinging silk line under the cursor
    const ang = Math.sin(ph) * 0.5;
    const ax = 350, ay = 78;
    const wx2 = ax + Math.sin(ang) * 110, wy2 = ay + Math.cos(ang) * 110;
    cv.line(ax, ay, wx2, wy2 - 26 * 3 + 6, [238, 242, 246], 220);
    slime(cv, "spidr", wx2, wy2, 3, "idle");
    bitmap(cv, CURSOR, ax - 2, ay - 14, 2, { "#": hexRgb("#f4f0e8") });
    // hearts pop above sprout on alternating frames
    if (f % 4 < 2) bitmap(cv, HEART, sx + 40, 170 - (f % 4) * 10, 2, { "#": PINK });
    bitmap(cv, GEM, 60, 100 + Math.sin(ph) * 6, 2, { "#": GOLD });
    frames.push(cv.buf);
  }
  const gif = gifEncode(frames, W, H, 12);
  fs.writeFileSync(out("promo.gif"), gif);
  console.log(out("promo.gif"), `${(gif.length / 1024).toFixed(0)}KB`);
}

console.log("done — upload these to the itch.io page (Edit game > Images)");
}

module.exports = { SPECIES, SHAPES, FACES, EYE_TPL, eyeStyle, faceSet, FONT, SW, SH, CX, hexRgb, mixRgb, FIXED, makeCanvas, text, textW, bitmap, slime, buildGrid, shapeVar, savePng, HEART, GEM, CURSOR };

// renders every species' idle sprite to _palshot.png for visual QA,
// plus _palfaces.png (a few species x idle/lookL/lookR/blink).
// extracts the sprite-engine slice of src/main.js and evals it with a
// fake canvas that just records putImageData pixels.
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "src", "main.js"), "utf8");
const a = src.indexOf("// ---------- sprite engine");
const b = src.indexOf("// ---------- audio");
if (a < 0 || b < 0) throw new Error("slice markers not found");
const slice = src.slice(a, b);

// ---- stubs ----
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
const X = globalThis.__X;
const SP = X.SPECIES, SPR = X.sprite;

// ---- tiny 3x5 font, uppercase ----
const FONT = {};
" A:.X./X.X/XXX/X.X/X.X B:XX./X.X/XX./X.X/XX. C:.XX/X../X../X../.XX D:XX./X.X/X.X/X.X/XX. E:XXX/X../XX./X../XXX F:XXX/X../XX./X../X.. G:.XX/X../X.X/X.X/.XX H:X.X/X.X/XXX/X.X/X.X I:XXX/.X./.X./.X./XXX J:..X/..X/..X/X.X/.X. K:X.X/X.X/XX./X.X/X.X L:X../X../X../X../XXX M:X.X/XXX/XXX/X.X/X.X N:X.X/XX./X.X/.XX/X.X O:.X./X.X/X.X/X.X/.X. P:XX./X.X/XX./X../X.. Q:.X./X.X/X.X/XX./.XX R:XX./X.X/XX./X.X/X.X S:.XX/X../.X./..X/XX. T:XXX/.X./.X./.X./.X. U:X.X/X.X/X.X/X.X/XXX V:X.X/X.X/X.X/X.X/.X. W:X.X/X.X/XXX/XXX/X.X X:X.X/X.X/.X./X.X/X.X Y:X.X/X.X/.X./.X./.X. Z:XXX/..X/.X./X../XXX 0:XXX/X.X/X.X/X.X/XXX 1:.X./XX./.X./.X./XXX 2:XX./..X/.X./X../XXX 3:XX./..X/.X./..X/XX. 4:X.X/X.X/XXX/..X/..X 5:XXX/X../XX./..X/XX. 6:.XX/X../XX./X.X/.X. 7:XXX/..X/.X./.X./.X. 8:.X./X.X/.X./X.X/.X. 9:.X./X.X/.XX/..X/XX."
  .split(" ").forEach((e) => { const [k, v] = e.split(":"); if (v) FONT[k] = v.split("/"); });

// ---- minimal PNG encoder ----
const CT = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CT[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(t));
  return Buffer.concat([len, t, crc]);
}
function encodePng(W, H, rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- sheet painter ----
function sheet(cols, rows, cw, ch) {
  const W = cols * cw, H = rows * ch;
  const buf = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const dark = ((x >> 4) + (y >> 4)) & 1;
    buf[i] = dark ? 38 : 46; buf[i + 1] = dark ? 40 : 50; buf[i + 2] = dark ? 48 : 58; buf[i + 3] = 255;
  }
  const blit = (img, dx, dy, s) => {
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      const si = (y * img.width + x) * 4;
      const al = img.data[si + 3] / 255;
      if (al === 0) continue;
      for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) {
        const px = dx + x * s + sx, py = dy + y * s + sy;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const di = (py * W + px) * 4;
        buf[di] = img.data[si] * al + buf[di] * (1 - al);
        buf[di + 1] = img.data[si + 1] * al + buf[di + 1] * (1 - al);
        buf[di + 2] = img.data[si + 2] * al + buf[di + 2] * (1 - al);
        buf[di + 3] = 255;
      }
    }
  };
  const text = (str, dx, dy) => {
    [...str.toUpperCase()].forEach((c, ci) => {
      const g = FONT[c];
      if (!g) return;
      for (let y = 0; y < 5; y++) for (let x = 0; x < 3; x++) {
        if (g[y][x] !== "X") continue;
        const i = ((dy + y) * W + dx + ci * 4 + x) * 4;
        buf[i] = 210; buf[i + 1] = 210; buf[i + 2] = 220; buf[i + 3] = 255;
      }
    });
  };
  return { W, H, buf, blit, text };
}

const SCALE = 3;
const SWP = 72, SHP = 52;
const LABEL = 12;
const CW = SWP * SCALE, CH = SHP * SCALE + LABEL;

// ---- main sheet: every species idle ----
const COLS = 8;
const rows = Math.ceil(SP.length / COLS);
const s1 = sheet(COLS, rows, CW, CH);
const seen = {};
SP.forEach((sp, i) => {
  const cv = SPR("idle", i);
  const x = (i % COLS) * CW, y = ((i / COLS) | 0) * CH;
  s1.blit(cv._img, x + ((CW - SWP * SCALE) >> 1), y, SCALE);
  s1.text(sp.id, x + 4, y + SHP * SCALE + 3);
  // uniqueness by actual pixels — two species sharing an idle sprite
  // reads as a palette swap bug, not a feature
  let h = 0; for (const b of cv._img.data) h = (h * 31 + b) | 0;
  const key = String(h);
  seen[key] = (seen[key] || []).concat(sp.id);
});
fs.writeFileSync(path.join(__dirname, "_palshot.png"), encodePng(s1.W, s1.H, s1.buf));

// ---- face strip: representative species x 7 frames ----
const PICK = ["sprout", "kitty", "ninja", "snowy", "bites", "spidr", "dice", "frog", "ghost", "toxic", "drago", "honey"];
const FACES4 = ["idle", "lookL", "lookR", "blink", "sleeping", "chew", "held1", "munch"];
const s2 = sheet(PICK.length, FACES4.length, CW, CH);
PICK.forEach((id, ci) => {
  const si = SP.findIndex((s) => s.id === id);
  FACES4.forEach((f, ri) => {
    const cv = SPR(f, si);
    s2.blit(cv._img, ci * CW + ((CW - SWP * SCALE) >> 1), ri * CH, SCALE);
    s2.text(id, ci * CW + 4, ri * CH + SHP * SCALE + 3);
  });
});
fs.writeFileSync(path.join(__dirname, "_palfaces.png"), encodePng(s2.W, s2.H, s2.buf));

const dup = Object.entries(seen).filter(([, v]) => v.length > 1);
console.log(`wrote _palshot.png ${s1.W}x${s1.H} + _palfaces.png ${s2.W}x${s2.H} — ${SP.length} species`);
console.log(`face combos: ${Object.keys(seen).length} unique`);
if (dup.length) console.log("shared combos:", JSON.stringify(dup));

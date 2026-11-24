// renders laugh frames at 6x using the real sprite() — same as _faceshot
const fs = require("fs");
const zlib = require("zlib");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "src", "main.js"), "utf8");
const a = src.indexOf("// ---------- sprite engine");
const b = src.indexOf("// ---------- audio");
const slice = src.slice(a, b);

function mkCtx(cv) {
  return {
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    putImageData(img, x, y) { cv._img = img; },
  };
}
global.document = { createElement() { const cv = { width: 0, height: 0, _img: null }; cv.getContext = () => mkCtx(cv); return cv; } };
global.window = {};
global.shinyOwned = {};
eval(slice + "\n;globalThis.__X = { SPECIES, sprite };");
const { SPECIES, sprite: SPR } = globalThis.__X;

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

const FACES = ["laugh", "laugh2", "laugh3", "tearjoy", "tearjoy2", "excited", "excited2", "happy", "happy2"];
const PICK = ["sprout", "pebble", "kitty"];
const SCALE = 6, SWP = 72, SHP = 52;
const CW = SWP * SCALE, CH = SHP * SCALE;
const W = PICK.length * CW, H = FACES.length * CH;
const buf = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  const dark = ((x >> 5) + (y >> 5)) & 1;
  buf[i] = dark ? 38 : 46; buf[i + 1] = dark ? 40 : 50; buf[i + 2] = dark ? 48 : 58; buf[i + 3] = 255;
}
const blit = (img, dx, dy, s) => {
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const si = (y * img.width + x) * 4;
    const al = img.data[si + 3] / 255;
    if (al === 0) continue;
    for (let sy = 0; sy < s; sy++) for (let sx = 0; sx < s; sx++) {
      const px = dx + x * s + sx, py = dy + y * s + sy;
      const di = (py * W + px) * 4;
      buf[di] = img.data[si] * al + buf[di] * (1 - al);
      buf[di + 1] = img.data[si + 1] * al + buf[di + 1] * (1 - al);
      buf[di + 2] = img.data[si + 2] * al + buf[di + 2] * (1 - al);
      buf[di + 3] = 255;
    }
  }
};
PICK.forEach((id, ci) => {
  const si = SPECIES.findIndex((s) => s.id === id);
  if (si < 0) return;
  FACES.forEach((f, ri) => {
    const cv = SPR(f, si);
    if (cv && cv._img) blit(cv._img, ci * CW + ((CW - SWP * SCALE) >> 1), ri * CH + ((CH - SHP * SCALE) >> 1), SCALE);
  });
});
fs.writeFileSync(path.join(__dirname, "_laughlab.png"), encodePng(W, H, buf));
console.log(`wrote _laughlab.png ${W}x${H}`);

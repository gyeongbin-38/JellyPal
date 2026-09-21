// all-species visual QA sweep — checks every species x every face for
// floating pixels (face/top coords that land on air after the shapeVar
// transform), then renders a contact sheet (assets/qa-sheet.png) for
// eyeball review. Run: node qacheck.cjs
const path = require("path");
const A = require("./assets.cjs");
const { SPECIES, SHAPES, FACES, eyeStyle, faceSet, SW, SH, CX, shapeVar, buildGrid, makeCanvas, text, slime, savePng, hexRgb } = A;

// authored decorations verified by eye on the qa sheet — frog stalk
// eyes and inky wisps legitimately float. a NEW float fails the gate,
// and one of these VANISHING also fails (the sprite changed silently)
const KNOWN = new Set([
  'inky: top pixel (26,2,"b") -> (24,1) floats off the body',
  'inky: top pixel (27,4,"b") -> (26,3) floats off the body',
  'frog: top pixel (13,0,"b") -> (13,0) floats off the body',
  'frog: top pixel (23,0,"b") -> (22,0) floats off the body',
  'frog: top pixel (13,1,"e") -> (13,1) floats off the body',
  'frog: top pixel (23,1,"e") -> (22,1) floats off the body',
]);
const issues = [];
const known = (msg) => KNOWN.has(msg);
const warn = (msg) => { issues.push(msg); console.log(known(msg) ? " ~ known:" : " !", msg); };

// face pixel sets that must sit on body mass, not air
const FACE_CHARS = ["e", "w", "m", "k", "d", "x"];

for (let i = 0; i < SPECIES.length; i++) {
  const sp = SPECIES[i];
  const hw = SHAPES[sp.shape];
  if (!hw) { warn(`${sp.id}: unknown shape "${sp.shape}"`); continue; }
  const v = shapeVar(i);

  // body mask BEFORE faces are drawn — silhouette + top + accents
  const mask = Array.from({ length: SH }, () => new Array(SW).fill(false));
  for (let y = 0; y < SH; y++)
    for (let x = CX - v.hw[y]; x < CX + v.hw[y]; x++)
      if (x >= 0 && x < SW) mask[y][x] = true;

  // a pixel counts as "on the body" if it touches the silhouette within
  // a 5x5 neighborhood — decorations legitimately poke ~2-3px past the
  // edge (ears, crowns), so only truly ISOLATED pixels are bugs
  const near = (nx, ny) => {
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const yy = ny + dy, xx = nx + dx;
        if (yy >= 0 && yy < SH && xx >= 0 && xx < SW && mask[yy][xx]) return true;
      }
    return false;
  };

  // top decorations: a pixel is fine if it's near the body OR connected
  // to the body through other decoration pixels (frog eye-stalks,
  // fungi caps legitimately float above thin silhouettes). Two passes:
  // mark pixels near body, then mark pixels adjacent to marked ones.
  const tops = (sp.top || []).map(([x, y, ch]) => ({ x, y, ch, tfm: v.tfm(x, y), ok: false }));
  for (const t2 of tops) if (near(t2.tfm[0], t2.tfm[1])) t2.ok = true;
  for (let pass = 0; pass < 3; pass++)
    for (const t2 of tops) {
      if (t2.ok) continue;
      if (tops.some((o) => o.ok && Math.abs(o.tfm[0] - t2.tfm[0]) <= 1 && Math.abs(o.tfm[1] - t2.tfm[1]) <= 1)) t2.ok = true;
    }
  for (const t2 of tops) {
    if (!t2.ok) warn(`${sp.id}: top pixel (${t2.x},${t2.y},"${t2.ch}") -> (${t2.tfm[0]},${t2.tfm[1]}) floats off the body`);
  }

  const fs = faceSet(i);
  for (const faceName in fs) {
    const f = fs[faceName];
    for (const ch in f) {
      for (const [x, y] of f[ch]) {
        const [nx, ny] = v.tfm(x, y);
        // accent ("a") and sweat ("d") pixels intentionally leave the body
        if (!near(nx, ny) && ch !== "a" && ch !== "d") warn(`${sp.id}/${faceName}: face "${ch}" (${x},${y}) -> (${nx},${ny}) on air`);
      }
    }
  }
}

// variation extremes report
let minH = 99, maxH = -99, maxLean = 0;
for (let i = 0; i < SPECIES.length; i++) {
  const v = shapeVar(i);
  let topRow = -1, botRow = -1;
  for (let y = 0; y < SH; y++) {
    if (v.hw[y] > 0) { if (topRow < 0) topRow = y; botRow = y; }
  }
  const h = botRow - topRow + 1;
  minH = Math.min(minH, h); maxH = Math.max(maxH, h);
  const [tx] = v.tfm(CX, 0); maxLean = Math.max(maxLean, Math.abs(tx - CX));
}
console.log(`variation range: height ${minH}-${maxH}px, max lean ${maxLean}px across ${SPECIES.length} species`);

// contact sheet: every species idle + blink + happy, name under each
const COLS = 10, CELLW = 96, CELLH = 96;
const rows = Math.ceil(SPECIES.length / COLS);
const cv = makeCanvas(COLS * CELLW, rows * CELLH + 8, hexRgb("#241b2e"));
SPECIES.forEach((sp, i) => {
  const cx = (i % COLS) * CELLW, cy = ((i / COLS) | 0) * CELLH;
  cv.rect(cx + 1, cy + 1, CELLW - 2, CELLH - 2, hexRgb("#2e2440"));
  slime(cv, sp.id, cx + 26, cy + 58, 1.6, "idle");
  slime(cv, sp.id, cx + 52, cy + 58, 1.6, "blink");
  slime(cv, sp.id, cx + 78, cy + 58, 1.6, "love");
  text(cv, sp.name.slice(0, 11).toUpperCase() + " E" + eyeStyle(i), cx + 4, cy + 74, 1, hexRgb("#cbb8d9"));
});
savePng(cv, path.join(__dirname, "assets", "qa-sheet.png"));

const fresh = issues.filter((i) => !known(i));
const gone = [...KNOWN].filter((k) => !issues.includes(k));
for (const k of gone) console.log(" ! known decoration vanished:", k);
console.log(fresh.length || gone.length
  ? `${fresh.length} new issue(s), ${gone.length} vanished known decoration(s)`
  : `all species/faces clean — ${KNOWN.size} authored floats verified`);
process.exit(fresh.length || gone.length ? 1 : 0);

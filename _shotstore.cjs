// App Store screenshot generator — renders the sandboxed companion card
// on a stylized macOS desktop at the exact pixel sizes App Store Connect
// accepts. Reuses the game's own sprite/font pipeline via assets.cjs so
// the shots match the real build pixel-for-pixel.
// Run: node _shotstore.cjs  ->  assets/store-shot{1,2,3}-{1280,2560}.png
const path = require("path");
const A = require("./assets.cjs");
const { SPECIES, makeCanvas, text, textW, slime, bitmap, savePng, HEART, GEM, CURSOR, hexRgb, mixRgb } = A;

const CREAM = hexRgb("#f7ecd7"), BROWN = hexRgb("#5c4632"), LBROWN = hexRgb("#8a6b4a");
const GOLD = hexRgb("#eec23f"), PINK = hexRgb("#ff8fb8");

// rounded-rect fill: pixel-art radius, no antialiasing
function rr(cv, x, y, w, h, r, c) {
  cv.rect(x + r, y, w - 2 * r, h, c);
  cv.rect(x, y + r, w, h - 2 * r, c);
  cv.circle(x + r, y + r, r, c);
  cv.circle(x + w - 1 - r, y + r, r, c);
  cv.circle(x + r, y + h - 1 - r, r, c);
  cv.circle(x + w - 1 - r, y + h - 1 - r, r, c);
}

// one companion card: frameless window (titlebar-less by design — the
// store SKU drags by its body), cream sky + tan ground + slime + HUD
function card(cv, x, y, w, slimeId, opts = {}) {
  const h = Math.round(w * 560 / 480);
  const u = w / 480; // ui unit: in-app css px -> shot px
  // drop shadow + body
  rr(cv, x + 6 * u, y + 8 * u, w, h, 10 * u, [40, 30, 44]);
  rr(cv, x, y, w, h, 10 * u, hexRgb("#f7ecd7"));
  // sky -> ground, same gradient stops as body.store in styles.css
  const groundTop = y + h - Math.round(130 * u);
  for (let i = 0; i < h; i++) {
    const yy = y + i;
    const skyT = i / (h - Math.round(130 * u));
    if (yy < groundTop) cv.rect(x, yy, w, 1, mixRgb([253, 244, 221], [247, 236, 215], Math.min(1, skyT)));
    else cv.rect(x, yy, w, 1, mixRgb([232, 213, 174], [220, 196, 154], (yy - groundTop) / (h - (groundTop - y))));
  }
  // rounded-mask the corners back off (cheap clip: repaint outside edge)
  // interior already painted inside the rr() silhouette, corners were part
  // of it — paint them by masking: not needed, rr() body is the silhouette
  const floorY = groundTop + Math.round(6 * u);
  // jelly chip + fab (the always-on HUD)
  rr(cv, x + w - 100 * u, y + 14 * u, 62 * u, 24 * u, 4 * u, hexRgb("#f3e6cd"));
  bitmap(cv, GEM, x + w - 94 * u, y + 14 * u + 5 * u, 2 * u, { "#": GOLD });
  text(cv, "500", x + w - 76 * u, y + 14 * u + 7 * u, 1.5 * u, BROWN);
  // fab circle
  cv.circle(x + w - 24 * u, y + 26 * u, 15 * u, hexRgb("#f3e6cd"));
  slime(cv, slimeId, x + w / 2, floorY, 4 * u, "happy");
  if (opts.bang) text(cv, "+3 JELLY", x + w / 2 - textW("+3 JELLY", 2 * u) / 2, floorY - 150 * u, 2 * u, GOLD);
  if (opts.hearts) bitmap(cv, HEART, x + w / 2 + 70 * u, floorY - 120 * u, 3 * u, { "#": PINK });
  return h;
}

// stylized mac desktop: menu bar, wallpaper, dock, a code editor window
function desktop(cv, s) {
  const W = cv.w, H = cv.h;
  for (let y = 0; y < H; y++) {
    const t = y / H;
    cv.rect(0, y, W, 1, mixRgb([64, 52, 92], [26, 30, 52], t)); // dusk violet
  }
  // code editor window (the "work" the slime lives over)
  const ew = 560 * s, eh = 420 * s, ex = 70 * s, ey = 90 * s;
  cv.rect(ex, ey, ew, eh, hexRgb("#1c2030"));
  cv.rect(ex, ey, ew, 26 * s, hexRgb("#39415c"));
  for (let i = 0; i < 3; i++) cv.circle(ex + (14 + i * 18) * s, ey + 13 * s, 5 * s, [hexRgb("#e05a6e"), GOLD, hexRgb("#4fbd82")][i]);
  text(cv, "RANCH.JS", ex + 80 * s, ey + 9 * s, 1 * s, hexRgb("#9aa7c4"));
  const lineCols = [hexRgb("#3f4a6a"), hexRgb("#4a5578"), hexRgb("#333d5c")];
  for (let i = 0; i < 12; i++) {
    const lw = (180 + ((i * 97) % 240)) * s;
    cv.rect(ex + (16 + (i % 3) * 20) * s, ey + 46 * s + i * 28 * s, lw, 5 * s, lineCols[i % 3]);
  }
  // menu bar
  cv.rect(0, 0, W, 22 * s, [244, 240, 232]);
  text(cv, "JELLYPAL  FILE  EDIT  VIEW", 30 * s, 7 * s, 1 * s, [90, 80, 70]);
  text(cv, "FRI 9:41", W - 120 * s, 7 * s, 1 * s, [90, 80, 70]);
  // dock: centered icon strip
  const n = 7, dw = n * 52 * s + 40 * s;
  rr(cv, W / 2 - dw / 2, H - 64 * s, dw, 52 * s, 14 * s, [60, 56, 70]);
  const dockCols = [[120, 170, 230], [250, 190, 90], [150, 200, 140], [230, 130, 160], [140, 140, 200], [240, 150, 80], [170, 190, 210]];
  for (let i = 0; i < n; i++) rr(cv, W / 2 - dw / 2 + (16 + i * 52) * s, H - 60 * s, 44 * s, 44 * s, 10 * s, dockCols[i]);
  return { W, H };
}

function shot(which, W, H) {
  const cv = makeCanvas(W, H, [26, 26, 40]);
  const s = W / 1280;
  desktop(cv, s);
  if (which === 1) {
    // hero: card mid-desktop, sprout happy, hearts, drip bang
    card(cv, Math.round(760 * s), Math.round(140 * s), Math.round(380 * s), "sprout", { bang: true, hearts: true });
  } else if (which === 2) {
    // collection: card + open ranch panel beside it
    const cx = Math.round(120 * s), cy = Math.round(120 * s);
    card(cv, cx, cy, Math.round(360 * s), "mochi", {});
    const rw = 470 * s, rh = 300 * s, rx = Math.round(560 * s), ry = Math.round(150 * s);
    rr(cv, rx + 5 * s, ry + 7 * s, rw, rh, 8 * s, [40, 30, 44]);
    rr(cv, rx, ry, rw, rh, 8 * s, CREAM);
    text(cv, "RANCH", rx + 16 * s, ry + 14 * s, 2 * s, BROWN);
    const cells = ["sprout", "berry", "ember", "mochi", "frog", "pinata", "drago", "stella"];
    cells.forEach((id, i) => {
      const x = rx + 14 * s + (i % 4) * 112 * s, y = ry + 44 * s + Math.floor(i / 4) * 116 * s;
      cv.rect(x, y, 104 * s, 104 * s, hexRgb("#f3e6cd"));
      cv.rect(x, y, 104 * s, 3 * s, hexRgb("#8fd4f0"));
      slime(cv, id, x + 52 * s, y + 78 * s, 2.4 * s, "idle");
      const nm = SPECIES.find((p) => p.id === id).name.toUpperCase();
      text(cv, nm, x + 52 * s - textW(nm, 1 * s) / 2, y + 90 * s, 1 * s, LBROWN);
    });
    const dex = `${SPECIES.filter((p) => !p.id.startsWith("hyb")).length}/62`;
    text(cv, dex, rx + 16 * s, ry + rh - 26 * s, 1 * s, LBROWN);
  } else {
    // reveal: legendary moment — stella + stars + gem
    card(cv, Math.round(420 * s), Math.round(80 * s), Math.round(430 * s), "stella", { hearts: true });
    const bx = Math.round(430 * s), by = Math.round(120 * s);
    bitmap(cv, GEM, bx - 60 * s, by, 4 * s, { "#": GOLD });
    bitmap(cv, GEM, bx + 400 * s, by + 60 * s, 3 * s, { "#": GOLD });
    text(cv, "SHINY!", bx + 150 * s, by + 30 * s, 3 * s, GOLD);
  }
  return cv;
}

const outDir = path.join(__dirname, "assets");
require("fs").mkdirSync(outDir, { recursive: true });
for (const which of [1, 2, 3]) {
  for (const w of [1280, 2560]) {
    const h = Math.round(w * 0.625); // 1280x800, 2560x1600 — ASC sizes
    savePng(shot(which, w, h), path.join(outDir, `store-shot${which}-${w}.png`));
  }
}
console.log("done — App Store Connect accepts 1280x800 and 2560x1600");

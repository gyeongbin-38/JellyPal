// sprite sanity: row widths + every glyph has a palette entry
const fs = require("fs");
global.window = global;
const src = fs.readFileSync("src/main.js", "utf8");
// extract just the SPR table — no DOM/TAURI needed for row math
const m = src.match(/const SPR = (\{[\s\S]*?\n\});/);
if (!m) { console.log("SPR not found"); process.exit(1); }
const SPRITES = eval("(" + m[1] + ")");
let bad = 0;
for (const [id, d] of Object.entries(SPRITES)) {
  const ws = d.rows.map((r) => r.length);
  const missing = new Set();
  for (const r of d.rows) for (const ch of r) if (ch !== "." && !(ch in d.pal)) missing.add(ch);
  const minW = Math.min(...ws), maxW = Math.max(...ws);
  const skew = maxW - minW > 2 ? "  <- UNEVEN" : "";
  if (missing.size || skew) { bad++; console.log(`${id}: w=${ws.join(",")} missing=[${[...missing].join("")}]${skew}`); }
}
for (const id of ["bowl", "cushion", "crack1", "crack2"]) {
  const d = SPRITES[id];
  console.log(`${id}: ${Math.max(...d.rows.map((r) => r.length))}x${d.rows.length}`);
}
console.log(bad ? `${bad} sprites flagged` : "all sprites clean");

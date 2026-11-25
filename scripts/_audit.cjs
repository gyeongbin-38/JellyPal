const fs = require("fs");
process.chdir(require("path").join(__dirname, ".."));
const src = fs.readFileSync("src/main.js", "utf8");

// extract the SPR object block by brace matching from "const SPR = {"
const i0 = src.indexOf("const SPR = {");
if (i0 < 0) {
  console.error("FAIL: SPR table not found");
  process.exit(2);
}
let depth = 0, i1 = i0;
for (let i = src.indexOf("{", i0); i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (!depth) { i1 = i; break; } }
}
const sprBlock = src.slice(i0, i1);
const sprKeys = [...new Set([...sprBlock.matchAll(/^\s{2}([a-zA-Z0-9_]+):\s*\{/gm)].map(m => m[1]))];
if (!sprKeys.length) {
  console.error("FAIL: SPR table parsed with zero keys");
  process.exit(2);
}
const sprCalls = [...new Set([...src.matchAll(/drawSpr\([^,]+,\s*"([a-zA-Z0-9_]+)"/g)].map(m => m[1]))];
const missing = sprCalls.filter(k => !sprKeys.includes(k));
console.log("SPR keys(" + sprKeys.length + "):", sprKeys.join(","));
console.log("missing:", missing.length ? missing.join(",") : "none");

// TREATS ids used via TREATS[kind].id — check each treat id exists in SPR
const tStart = src.indexOf("const TREATS");
const tSlice = src.slice(tStart, tStart + 1200);
const treatIds = [...tSlice.matchAll(/id:\s*"([a-z]+)"/g)].map(m => m[1]);
const missingTreats = treatIds.filter(t => !sprKeys.includes(t));
console.log("TREATS ids:", treatIds.join(","), "| missing in SPR:", missingTreats.join(",") || "none");

if (missing.length || missingTreats.length) process.exit(2);
console.log("ASSET REFERENCES GREEN");

// p.spr dynamic draws — what values can .spr take? check snack/treat sprite fields

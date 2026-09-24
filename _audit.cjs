const fs = require("fs");
const src = fs.readFileSync("C:\\dev\\mini\\typet\\src\\main.js", "utf8");

// extract the SPR object block by brace matching from "const SPR = {"
const i0 = src.indexOf("const SPR = {");
let depth = 0, i1 = i0;
for (let i = src.indexOf("{", i0); i < src.length; i++) {
  if (src[i] === "{") depth++;
  else if (src[i] === "}") { depth--; if (!depth) { i1 = i; break; } }
}
const sprBlock = src.slice(i0, i1);
const sprKeys = [...new Set([...sprBlock.matchAll(/^\s{2}([a-zA-Z0-9_]+):\s*\{/gm)].map(m => m[1]))];
const sprCalls = [...new Set([...src.matchAll(/drawSpr\([^,]+,\s*"([a-zA-Z0-9_]+)"/g)].map(m => m[1]))];
const missing = sprCalls.filter(k => !sprKeys.includes(k));
console.log("SPR keys(" + sprKeys.length + "):", sprKeys.join(","));
console.log("missing:", missing.length ? missing.join(",") : "none");

// TREATS ids used via TREATS[kind].id — check each treat id exists in SPR
const tStart = src.indexOf("const TREATS");
const tSlice = src.slice(tStart, tStart + 1200);
const treatIds = [...tSlice.matchAll(/id:\s*"([a-z]+)"/g)].map(m => m[1]);
console.log("TREATS ids:", treatIds.join(","), "| missing in SPR:", treatIds.filter(t => !sprKeys.includes(t)).join(",") || "none");

// p.spr dynamic draws — what values can .spr take? check snack/treat sprite fields

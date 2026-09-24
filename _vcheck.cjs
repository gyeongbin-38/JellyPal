const { execSync } = require("child_process");
const fs = require("fs");
for (const f of ["site/pals.js", "site/ranch.js"]) {
  try { execSync(`node --check ${f}`); console.log(f + ": syntax ok"); }
  catch (e) { console.log(f + ": SYNTAX ERROR\n" + e.stderr); process.exit(1); }
}
const s = fs.readFileSync("site/index.html", "utf8");
console.log("script tags:", (s.match(/<script/g) || []).length);
console.log("has pals.js:", s.includes("pals.js"), "| ranch.js:", s.includes("ranch.js"));
console.log("has pull btn:", s.includes('id="pull"'), "| strip:", s.includes('id="strip"'));
console.log("old PAL gone:", !s.includes("const PAL"), "| old blob gone:", !s.includes("function blob"));
